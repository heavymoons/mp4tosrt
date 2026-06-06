import { spawn, execFile, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { promises as fs, realpathSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import type { LlmDownloadProgress } from '../shared/types'
import { findVibeVoicePreset } from '../shared/vibevoiceModels'

const execFileP = promisify(execFile)

// venvBin = dirname(realpath(which('mlx_audio.stt.generate')))。
// mlx_audio CLI / python / hf(HF CLI) は同じ pipx venv の bin/ に同居する。
// 成功時のみキャッシュ。失敗はキャッシュしない（次回呼び出しで再解決）。
// これにより、後から pipx install mlx-audio しても DL 側が「未検出」のまま固定されない。
let venvBinCache: string | undefined

// 同一 modelId の DL を dedupe する。in-flight な DL があれば 2 本目以降は
// その Promise を await し、進捗のみ転送する（同一モデルを二重 DL しない）。
const inFlightDownloads = new Map<string, Promise<void>>()

type DownloadListener = (p: LlmDownloadProgress) => void
const downloadListeners = new Set<DownloadListener>()

export function onVibeVoiceDownloadProgress(fn: DownloadListener): () => void {
  downloadListeners.add(fn)
  return () => downloadListeners.delete(fn)
}

function emitProgress(p: LlmDownloadProgress): void {
  for (const l of downloadListeners) l(p)
}

async function which(name: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileP('/usr/bin/which', [name])
    const p = stdout.trim()
    return p || undefined
  } catch {
    return undefined
  }
}

export async function resolveVenvBin(): Promise<string | undefined> {
  if (venvBinCache) return venvBinCache
  try {
    const cliPath = await which('mlx_audio.stt.generate')
    if (!cliPath) return undefined
    venvBinCache = dirname(realpathSync(cliPath))
    return venvBinCache
  } catch {
    return undefined
  }
}

export function hfHubDir(): string {
  return process.env.HF_HOME
    ? join(process.env.HF_HOME, 'hub')
    : join(homedir(), '.cache', 'huggingface', 'hub')
}

export function repoCacheDir(modelId: string): string {
  return join(hfHubDir(), 'models--' + modelId.replace(/\//g, '--'))
}

export async function isVibeVoiceModelDownloaded(modelId: string): Promise<boolean> {
  const venvBin = await resolveVenvBin()
  if (!venvBin) return false
  try {
    // local_files_only=True で全ファイルがキャッシュ済みなら exit 0。未完なら例外で非 0。
    await execFileP(
      join(venvBin, 'python'),
      [
        '-c',
        `from huggingface_hub import snapshot_download as s; s('${modelId}', local_files_only=True)`
      ],
      { maxBuffer: 4 * 1024 * 1024 }
    )
    return true
  } catch {
    return false
  }
}

// repoCacheDir 配下の実ファイル合計サイズ（.incomplete を含む）を再帰的に測る。
async function dirSize(dir: string): Promise<number> {
  let total = 0
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const ent of entries) {
    const p = join(dir, ent.name)
    try {
      if (ent.isDirectory()) {
        total += await dirSize(p)
      } else if (ent.isFile()) {
        const st = await fs.stat(p)
        total += st.size
      }
    } catch {
      /* ignore racing deletes / symlink targets */
    }
  }
  return total
}

export type DownloadOptions = {
  onProgress?: (p: LlmDownloadProgress) => void
  onProc?: (p: ChildProcess) => void
}

export function downloadVibeVoiceModel(
  modelId: string,
  opts?: DownloadOptions
): Promise<void> {
  const existing = inFlightDownloads.get(modelId)
  if (existing) {
    // 2 本目以降: 既存 DL の進捗をこの呼び出しの onProgress にも転送しつつ完了を待つ。
    // owner が DL を所有しているため、ここでは onProc（プロセス）は配線しない
    // ＝このジョブをキャンセルしても共有 DL は止めない（owner が必要としているため正しい）。
    // owner が失敗すれば、await している 2 本目以降も同じ rejection を受ける。
    if (!opts?.onProgress) return existing
    const off = onVibeVoiceDownloadProgress(p => {
      if (p.modelId === modelId) opts.onProgress!(p)
    })
    return existing.finally(off)
  }

  // in-flight 登録は get→set の間に await を挟まず同期的に行う（同時開始の二重 DL を防ぐ）。
  const tracked = runVibeVoiceDownload(modelId, opts).finally(() => {
    inFlightDownloads.delete(modelId)
  })
  inFlightDownloads.set(modelId, tracked)
  return tracked
}

async function runVibeVoiceDownload(
  modelId: string,
  opts?: DownloadOptions
): Promise<void> {
  const venvBin = await resolveVenvBin()
  if (!venvBin) {
    throw new Error(
      'mlx-audio (mlx_audio.stt.generate) が見つからないため VibeVoice モデルをダウンロードできません'
    )
  }

  const preset = findVibeVoicePreset(modelId)
  const totalBytes = preset ? preset.approxSizeMB * 1024 * 1024 : undefined
  const cacheDir = repoCacheDir(modelId)

  const emit = (p: LlmDownloadProgress): void => {
    opts?.onProgress?.(p)
    emitProgress(p)
  }

  emit({ modelId, totalBytes, downloadedBytes: 0, finished: false })

  return new Promise<void>((resolve, reject) => {
    const proc = spawn(join(venvBin, 'hf'), ['download', modelId])
    opts?.onProc?.(proc)

    // 1 秒ごとにキャッシュ dir の実サイズをポーリングして進捗を出す（tqdm はパースしない）。
    const timer = setInterval(() => {
      void dirSize(cacheDir).then(size => {
        emit({ modelId, totalBytes, downloadedBytes: size, finished: false })
      })
    }, 1000)

    const stop = (): void => clearInterval(timer)

    proc.on('error', err => {
      stop()
      emit({
        modelId,
        totalBytes,
        downloadedBytes: 0,
        finished: true,
        error: err instanceof Error ? err.message : String(err)
      })
      reject(err)
    })

    proc.on('close', code => {
      stop()
      if (code === 0) {
        emit({
          modelId,
          totalBytes,
          downloadedBytes: totalBytes ?? 0,
          finished: true
        })
        resolve()
        return
      }
      const msg =
        code === null
          ? 'hf download was terminated'
          : `hf download exited with code ${code}`
      emit({ modelId, totalBytes, downloadedBytes: 0, finished: true, error: msg })
      reject(new Error(msg))
    })
  })
}
