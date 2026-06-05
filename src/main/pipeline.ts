import { spawn, ChildProcess } from 'child_process'
import { promises as fs, createWriteStream, type WriteStream } from 'fs'
import { tmpdir } from 'os'
import { basename, extname, join } from 'path'
import { app } from 'electron'
import { Semaphore } from './queue'
import { applyDictionaryToFile, loadReplaceRules } from './replace'
import { applyHallucinationSuppression } from './suppress'
import { generateFcpxml } from './fcpxml'
import { parseSrt, serializeSrt } from './srt'
import { ensureModelLoaded } from './llm/manager'
import { correctCues } from './llm/correct'
import type { Job, Settings as PipelineSettings, AudioFilters } from '../shared/types'

export type { Job, PipelineSettings }

const MAX_LOG_LINES = 2000

export function jobLogPath(id: string): string {
  return join(app.getPath('userData'), 'logs', `${id}.log`)
}

type Listener = (job: Job) => void

const LOG_EMIT_DEBOUNCE_MS = 100

export class Pipeline {
  private jobs = new Map<string, Job>()
  private procs = new Map<string, ChildProcess>()
  private convertSem: Semaphore
  private transcribeSem: Semaphore
  private listeners = new Set<Listener>()
  private settings: PipelineSettings
  private logEmitTimers = new Map<string, NodeJS.Timeout>()
  private logStreams = new Map<string, WriteStream>()

  constructor(settings: PipelineSettings) {
    this.settings = settings
    this.convertSem = new Semaphore(settings.ffmpegConcurrency)
    this.transcribeSem = new Semaphore(settings.whisperConcurrency)
  }

  updateSettings(settings: PipelineSettings): void {
    this.settings = settings
    this.convertSem.setLimit(settings.ffmpegConcurrency)
    this.transcribeSem.setLimit(settings.whisperConcurrency)
  }

  onUpdate(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  list(): Job[] {
    return [...this.jobs.values()]
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  restoreJobs(jobs: Job[]): void {
    for (const j of jobs) {
      if (j.status === 'converting' || j.status === 'transcribing') continue
      if (j.status === 'queued') continue
      const restored: Job = {
        ...j,
        log: Array.isArray(j.log) ? j.log.slice(-100) : []
      }
      this.jobs.set(j.id, restored)
      void this.validateRestoredJob(j.id)
    }
    for (const j of this.jobs.values()) this.emit(j)
  }

  private async validateRestoredJob(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) return
    const missing: string[] = []
    try {
      await fs.access(job.inputPath)
    } catch {
      missing.push(`元動画 (${job.inputPath})`)
    }
    if (job.outputPath) {
      try {
        await fs.access(job.outputPath)
      } catch {
        missing.push(`SRT (${job.outputPath})`)
      }
    }
    if (missing.length > 0) {
      this.appendLog(id, `[restore] ファイルが見つかりません: ${missing.join(', ')}`)
      this.update(id, {
        status: 'error',
        error: `復元時にファイル欠落: ${missing.join(', ')}`,
        finishedAt: job.finishedAt ?? Date.now()
      })
    }
  }

  add(inputPath: string, outputDir: string, extraPrompt?: string): Job {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const job: Job = {
      id, inputPath, outputDir,
      status: 'queued', phase: 'idle', progress: 0, log: [],
      extraPrompt
    }
    this.jobs.set(id, job)
    this.emit(job)
    void this.run(id)
    return this.snapshot(job)
  }

  setExtraPrompt(id: string, text: string): void {
    const job = this.jobs.get(id)
    if (!job) return
    job.extraPrompt = text || undefined
    this.emit(job)
  }

  async rerunEmbed(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) throw new Error('job not found')
    if (!job.outputPath) throw new Error('base SRT not yet generated for this job')
    if (job.status === 'converting' || job.status === 'transcribing') {
      throw new Error('job is currently running')
    }

    this.update(id, {
      status: 'transcribing',
      phase: 'embed',
      progress: 0,
      error: undefined,
      finishedAt: undefined
    })

    const release = await this.convertSem.acquire()
    try {
      await this.runEmbedSubtitles(id, job.inputPath, job.outputPath, job.outputDir)
      this.update(id, {
        status: 'done',
        phase: 'done',
        progress: 100,
        finishedAt: Date.now()
      })
    } catch (e) {
      this.update(id, {
        status: 'error',
        error: errMsg(e),
        finishedAt: Date.now()
      })
    } finally {
      release()
    }
  }

  async rerunFromLlm(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) throw new Error('job not found')
    if (!job.outputPath) throw new Error('base SRT not yet generated for this job')
    if (job.status === 'converting' || job.status === 'transcribing') {
      throw new Error('job is currently running')
    }
    if (
      this.settings.llm.enabled &&
      this.settings.llm.requirePrompt &&
      !job.extraPrompt?.trim()
    ) {
      throw new Error('追加プロンプトを入力してください (LLM校正の前提条件)')
    }

    this.update(id, {
      status: 'transcribing',
      phase: 'idle',
      progress: 0,
      error: undefined,
      finishedAt: undefined
    })

    const release = await this.transcribeSem.acquire()
    try {
      if (this.settings.llm.enabled) {
        this.update(id, { phase: 'llm-correct', progress: 0 })
        try {
          await this.runLlmCorrection(id, job.outputPath)
        } catch (e) {
          this.appendLog(id, `[llm] correction failed: ${errMsg(e)}`)
        }
      } else {
        this.appendLog(id, '[rerun] llm correction is disabled in settings — skipping')
      }
      if (this.settings.embedSubtitles) {
        this.update(id, { phase: 'embed', progress: 0 })
        try {
          await this.runEmbedSubtitles(id, job.inputPath, job.outputPath, job.outputDir)
        } catch (e) {
          this.appendLog(id, `[embed] failed: ${errMsg(e)}`)
        }
      }
      if (this.settings.outputFcpxml) {
        this.update(id, { phase: 'fcpxml', progress: 0 })
        try {
          await this.runGenerateFcpxml(id, job.inputPath, job.outputPath, job.outputDir)
        } catch (e) {
          this.appendLog(id, `[fcpxml] failed: ${errMsg(e)}`)
        }
      }
      this.update(id, {
        status: 'done',
        phase: 'done',
        progress: 100,
        finishedAt: Date.now()
      })
    } finally {
      release()
    }
  }

  cancel(id: string): void {
    const proc = this.procs.get(id)
    if (proc) {
      try { proc.kill('SIGTERM') } catch { /* ignore */ }
    }
    const job = this.jobs.get(id)
    if (job && job.status !== 'done' && job.status !== 'error') {
      this.update(id, { status: 'cancelled', finishedAt: Date.now() })
    }
  }

  remove(id: string): void {
    this.cancel(id)
    this.jobs.delete(id)
    this.procs.delete(id)
    this.closeLogStream(id)
    fs.unlink(jobLogPath(id)).catch(() => undefined)
  }

  clearFinished(): void {
    for (const [id, job] of [...this.jobs]) {
      if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') {
        this.jobs.delete(id)
        this.closeLogStream(id)
        fs.unlink(jobLogPath(id)).catch(() => undefined)
      }
    }
  }

  private snapshot(job: Job): Job {
    return { ...job, log: job.log.slice(-MAX_LOG_LINES) }
  }

  private emit(job: Job): void {
    const snap = this.snapshot(job)
    for (const l of this.listeners) l(snap)
  }

  private update(id: string, patch: Partial<Job>): void {
    const j = this.jobs.get(id)
    if (!j) return
    Object.assign(j, patch)
    this.flushLogEmit(id)
    this.emit(j)
  }

  private appendLog(id: string, line: string): void {
    const j = this.jobs.get(id)
    if (!j) return
    j.log.push(line)
    if (j.log.length > MAX_LOG_LINES) j.log.splice(0, j.log.length - MAX_LOG_LINES)
    this.writeLogToDisk(id, line)
    this.scheduleLogEmit(id)
  }

  private writeLogToDisk(id: string, line: string): void {
    let stream = this.logStreams.get(id)
    if (!stream) {
      try {
        const path = jobLogPath(id)
        // ensure dir
        const dir = join(app.getPath('userData'), 'logs')
        // mkdir sync via Node fs to keep this method sync
        // (small one-time cost when stream is first created)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('fs').mkdirSync(dir, { recursive: true })
        const ts = new Date().toISOString()
        stream = createWriteStream(path, { flags: 'a' })
        stream.write(`\n=== job ${id} log opened at ${ts} ===\n`)
        this.logStreams.set(id, stream)
      } catch {
        return
      }
    }
    try {
      stream.write(line + '\n')
    } catch {
      /* ignore disk write errors */
    }
  }

  private closeLogStream(id: string): void {
    const stream = this.logStreams.get(id)
    if (stream) {
      try { stream.end() } catch { /* ignore */ }
      this.logStreams.delete(id)
    }
  }

  private scheduleLogEmit(id: string): void {
    if (this.logEmitTimers.has(id)) return
    const t = setTimeout(() => {
      this.logEmitTimers.delete(id)
      const job = this.jobs.get(id)
      if (job) this.emit(job)
    }, LOG_EMIT_DEBOUNCE_MS)
    this.logEmitTimers.set(id, t)
  }

  private flushLogEmit(id: string): void {
    const t = this.logEmitTimers.get(id)
    if (t) {
      clearTimeout(t)
      this.logEmitTimers.delete(id)
    }
  }

  private async run(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) return
    job.startedAt = Date.now()
    let tempWav: string | undefined

    try {
      const releaseConvert = await this.convertSem.acquire()
      try {
        if (this.jobs.get(id)?.status === 'cancelled') return
        this.update(id, { status: 'converting', phase: 'convert', progress: 0 })
        tempWav = join(tmpdir(), `mp4tosrt-${id}.wav`)
        await this.runFfmpeg(id, job.inputPath, tempWav)
      } finally {
        releaseConvert()
      }

      if (this.jobs.get(id)?.status === 'cancelled') return

      const releaseTrans = await this.transcribeSem.acquire()
      try {
        if (this.jobs.get(id)?.status === 'cancelled') return
        this.update(id, { status: 'transcribing', phase: 'transcribe', progress: 0 })
        await fs.mkdir(job.outputDir, { recursive: true })
        const outputPath = await this.runWhisper(id, tempWav!, job.outputDir, job.inputPath)
        this.update(id, { outputPath })

        if (this.settings.suppressHallucinations) {
          this.update(id, { phase: 'postprocess' })
          try {
            const dropped = await applyHallucinationSuppression(
              outputPath,
              this.settings.hallucinationsListPath
            )
            if (dropped > 0) {
              this.appendLog(id, `[suppress] dropped ${dropped} hallucination cue(s)`)
            } else {
              this.appendLog(id, `[suppress] no hallucination cues detected`)
            }
          } catch (e) {
            this.appendLog(id, `[suppress] error: ${errMsg(e)}`)
          }
        }

        if (this.settings.replaceDictPath) {
          this.update(id, { phase: 'postprocess' })
          this.appendLog(id, `[replace] applying ${this.settings.replaceDictPath}`)
          try {
            const n = await applyDictionaryToFile(outputPath, this.settings.replaceDictPath)
            this.appendLog(id, `[replace] ${n} rules applied`)
          } catch (e) {
            this.appendLog(id, `[replace] error: ${errMsg(e)}`)
          }
        }

        const currentJob = this.jobs.get(id)
        if (
          this.settings.llm.enabled &&
          this.settings.llm.requirePrompt &&
          !currentJob?.extraPrompt?.trim()
        ) {
          this.appendLog(id, '[llm] 追加プロンプトが未入力のため一時停止 — プロンプト入力後「LLM校正を開始」ボタンで再開')
          this.update(id, {
            status: 'awaiting',
            phase: 'awaiting-prompt',
            progress: 100,
            finishedAt: Date.now()
          })
          return
        }

        if (this.settings.llm.enabled) {
          this.update(id, { phase: 'llm-correct', progress: 0 })
          try {
            await this.runLlmCorrection(id, outputPath)
          } catch (e) {
            this.appendLog(id, `[llm] correction failed: ${errMsg(e)}`)
          }
        }

        if (this.settings.embedSubtitles) {
          this.update(id, { phase: 'embed', progress: 0 })
          try {
            await this.runEmbedSubtitles(id, job.inputPath, outputPath, job.outputDir)
          } catch (e) {
            this.appendLog(id, `[embed] failed: ${errMsg(e)}`)
          }
        }

        if (this.settings.outputFcpxml) {
          this.update(id, { phase: 'fcpxml', progress: 0 })
          try {
            await this.runGenerateFcpxml(id, job.inputPath, outputPath, job.outputDir)
          } catch (e) {
            this.appendLog(id, `[fcpxml] failed: ${errMsg(e)}`)
          }
        }

        this.update(id, {
          status: 'done', phase: 'done', progress: 100, finishedAt: Date.now()
        })
      } finally {
        releaseTrans()
      }
    } catch (e) {
      const j = this.jobs.get(id)
      if (j && j.status !== 'cancelled') {
        this.update(id, { status: 'error', error: errMsg(e), finishedAt: Date.now() })
      }
    } finally {
      if (tempWav) {
        fs.unlink(tempWav).catch(() => undefined)
      }
      this.procs.delete(id)
    }
  }

  private async getDuration(input: string): Promise<number | undefined> {
    return new Promise(resolve => {
      const p = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=nw=1:nk=1',
        input
      ])
      let out = ''
      p.stdout.on('data', d => { out += d.toString() })
      p.on('error', () => resolve(undefined))
      p.on('close', () => {
        const n = parseFloat(out.trim())
        resolve(Number.isFinite(n) ? n : undefined)
      })
    })
  }

  private runFfmpeg(id: string, input: string, output: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const duration = await this.getDuration(input)
      const filterChain = buildFilterChain(this.settings.audioFilters)
      const args = [
        '-y', '-i', input,
        '-vn',
        '-ac', '1',
        '-ar', '16000'
      ]
      if (filterChain) args.push('-af', filterChain)
      args.push('-c:a', 'pcm_s16le', output)

      const proc = spawn('ffmpeg', args)
      this.procs.set(id, proc)
      this.appendLog(id, `[ffmpeg] ${args.join(' ')}`)

      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        for (const line of text.split(/\r?\n/)) {
          if (!line) continue
          this.appendLog(id, line)
          if (duration) {
            const m = line.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/)
            if (m) {
              const t = parseInt(m[1]!) * 3600 + parseInt(m[2]!) * 60 + parseFloat(m[3]!)
              const pct = Math.min(99, Math.round((t / duration) * 100))
              this.update(id, { progress: pct })
            }
          }
        }
      })

      proc.on('error', err => reject(err))
      proc.on('close', code => {
        if (code === 0) {
          this.update(id, { progress: 100 })
          resolve()
        } else if (code === null) {
          reject(new Error('ffmpeg was terminated'))
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`))
        }
      })
    })
  }

  private runWhisper(id: string, audio: string, outDir: string, originalInput: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args: string[] = [
        audio,
        '--model', this.settings.model,
        '--output-format', 'srt',
        '--output-dir', outDir,
        '--no-speech-threshold', String(this.settings.noSpeechThreshold),
        '--logprob-threshold', String(this.settings.logprobThreshold)
      ]
      if (this.settings.wordTimestamps) {
        args.push('--word-timestamps', 'True')
      }
      if (this.settings.language) {
        args.push('--language', this.settings.language)
      }
      if (!this.settings.conditionOnPreviousText) {
        args.push('--condition-on-previous-text', 'False')
      }
      const proc = spawn('mlx_whisper', args)
      this.procs.set(id, proc)
      this.appendLog(id, `[mlx_whisper] ${args.join(' ')}`)

      const handleChunk = (chunk: Buffer): void => {
        const text = chunk.toString()
        for (const line of text.split(/\r?\n/)) {
          if (!line.trim()) continue
          this.appendLog(id, line)
          const m = line.match(/(\d+(?:\.\d+)?)\s*%/)
          if (m) {
            const pct = Math.min(99, Math.round(parseFloat(m[1]!)))
            this.update(id, { progress: pct })
          }
        }
      }
      proc.stdout.on('data', handleChunk)
      proc.stderr.on('data', handleChunk)

      proc.on('error', err => reject(err))
      proc.on('close', async code => {
        if (code !== 0) {
          if (code === null) reject(new Error('mlx_whisper was terminated'))
          else reject(new Error(`mlx_whisper exited with code ${code}`))
          return
        }
        const tempStem = basename(audio, extname(audio))
        const tempSrt = join(outDir, `${tempStem}.srt`)
        const finalStem = basename(originalInput, extname(originalInput))
        const finalSrt = join(outDir, `${finalStem}.srt`)
        try {
          if (tempSrt !== finalSrt) {
            await fs.rename(tempSrt, finalSrt).catch(async err => {
              if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
                await fs.copyFile(tempSrt, finalSrt)
                await fs.unlink(tempSrt)
              } else {
                throw err
              }
            })
          }
          resolve(finalSrt)
        } catch (e) {
          reject(new Error(`failed to move srt: ${errMsg(e)}`))
        }
      })
    })
  }

  private async runGenerateFcpxml(
    id: string,
    videoPath: string,
    srtPath: string,
    outDir: string
  ): Promise<void> {
    // 校正済みがあればそれを優先
    const correctedPath = srtPath.replace(/\.srt$/i, '.corrected.srt')
    let chosenSrt = srtPath
    try {
      await fs.access(correctedPath)
      chosenSrt = correctedPath
    } catch {
      /* no corrected */
    }
    const stem = basename(videoPath, extname(videoPath))
    const outPath = join(outDir, `${stem}.fcpxml`)
    this.appendLog(id, `[fcpxml] using ${chosenSrt}`)
    await generateFcpxml(
      videoPath,
      chosenSrt,
      outPath,
      this.settings.fcpxmlSubtitle,
      line => this.appendLog(id, line)
    )
  }

  private async runEmbedSubtitles(
    id: string,
    videoPath: string,
    srtPath: string,
    outDir: string
  ): Promise<void> {
    const correctedPath = srtPath.replace(/\.srt$/i, '.corrected.srt')
    let chosenSrt = srtPath
    try {
      await fs.access(correctedPath)
      chosenSrt = correctedPath
    } catch {
      /* no corrected version */
    }
    const stem = basename(videoPath, extname(videoPath))
    const outPath = join(outDir, `${stem}.subbed.mp4`)

    const args: string[] = [
      '-y',
      '-i', videoPath,
      '-i', chosenSrt,
      '-map', '0:v',
      '-map', '0:a?',
      '-map', '1:0',
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-c:s', 'mov_text'
    ]
    const lang = toIso6392(this.settings.language) ?? 'jpn'
    args.push('-metadata:s:s:0', `language=${lang}`)
    args.push('-disposition:s:0', 'default')
    args.push('-movflags', '+faststart', outPath)

    this.appendLog(id, `[embed] using ${chosenSrt}`)
    this.appendLog(id, `[ffmpeg embed] ${args.join(' ')}`)
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', args)
      this.procs.set(id, proc)
      proc.stderr.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split(/\r?\n/)) {
          if (line) this.appendLog(id, line)
        }
      })
      proc.on('error', err => reject(err))
      proc.on('close', code => {
        if (code === 0) resolve()
        else if (code === null) reject(new Error('ffmpeg embed terminated'))
        else reject(new Error(`ffmpeg embed exited with code ${code}`))
      })
    })
    this.appendLog(id, `[embed] saved ${outPath}`)
  }

  private async runLlmCorrection(id: string, srtPath: string): Promise<void> {
    const job = this.jobs.get(id)
    const llm = this.settings.llm
    this.appendLog(id, `[llm] loading model ${llm.modelId}…`)
    try {
      await ensureModelLoaded(llm.modelId, llm.contextSize)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const enriched = `${msg}\n\nヒント: モデルのロードに失敗しました。Gemma 4 12B は自前ビルドの llama.cpp で対応していますが、メモリ不足（12B は 16GB+ RAM 推奨）やビルド未適用などで失敗することがあります。改善しない場合は設定の「モデル」を Qwen3.5 4B Q4 などに切り替えて再試行してください。`
      throw new Error(enriched)
    }
    this.appendLog(id, `[llm] model ready`)

    const text = await fs.readFile(srtPath, 'utf-8')
    const cues = parseSrt(text)
    if (cues.length === 0) {
      this.appendLog(id, '[llm] no cues to correct')
      return
    }

    let glossary: { from: string; to: string }[] | undefined
    if (llm.useDictionary && this.settings.replaceDictPath) {
      try {
        glossary = await loadReplaceRules(this.settings.replaceDictPath)
        this.appendLog(id, `[llm] using dictionary with ${glossary.length} rules`)
      } catch (e) {
        this.appendLog(id, `[llm] dictionary load error: ${errMsg(e)}`)
      }
    }

    const sharedPart = llm.sharedPrompt?.trim()
    const perJobPart = job?.extraPrompt?.trim()
    const combinedPrompt = [sharedPart, perJobPart].filter(Boolean).join('\n\n---\n\n') || undefined
    if (sharedPart) this.appendLog(id, `[llm] using shared prompt (${sharedPart.length} chars)`)
    if (perJobPart) this.appendLog(id, `[llm] using per-job extra prompt (${perJobPart.length} chars)`)

    const corrected = await correctCues(cues, {
      batchSize: llm.batchSize,
      contextSize: llm.contextSize,
      batchOverlap: llm.batchOverlap,
      allowMerge: llm.allowMerge,
      maxMergeSize: llm.maxMergeSize,
      glossary,
      extraPrompt: combinedPrompt,
      log: line => this.appendLog(id, line),
      onProgress: (done, total) => {
        const pct = Math.min(99, Math.round((done / total) * 100))
        this.update(id, { progress: pct })
      }
    })

    const correctedSrt = serializeSrt(corrected)
    const correctedPath = srtPath.replace(/\.srt$/i, '.corrected.srt')
    await fs.writeFile(correctedPath, correctedSrt, 'utf-8')
    this.appendLog(id, `[llm] saved ${correctedPath}`)
  }
}

const ISO_639_1_TO_2: Record<string, string> = {
  ja: 'jpn',
  en: 'eng',
  zh: 'zho',
  ko: 'kor',
  es: 'spa',
  fr: 'fra',
  de: 'deu'
}

export function toIso6392(code?: string): string | undefined {
  if (!code) return undefined
  if (code.length === 3) return code
  return ISO_639_1_TO_2[code] ?? code
}

export function buildFilterChain(f: AudioFilters): string {
  const filters: string[] = []
  if (f.compress) filters.push('acompressor=threshold=-20dB:ratio=3:attack=5:release=50')
  if (f.denoise) filters.push('afftdn=nr=10:nf=-25')
  if (f.loudnorm) filters.push('loudnorm=I=-16:TP=-1.5:LRA=11')
  if (f.highpassHz > 0) filters.push(`highpass=f=${f.highpassHz}`)
  return filters.join(',')
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
