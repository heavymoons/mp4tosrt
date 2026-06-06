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
// 解決結果はモジュールにキャッシュ（null = 未解決として確定キャッシュ）。
let venvBinCache: string | null | undefined
let downloadingModelId: string | undefined

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
  if (venvBinCache !== undefined) return venvBinCache ?? undefined
  try {
    const cliPath = await which('mlx_audio.stt.generate')
    if (!cliPath) {
      venvBinCache = null
      return undefined
    }
    const real = realpathSync(cliPath)
    venvBinCache = dirname(real)
    return venvBinCache
  } catch {
    venvBinCache = null
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

export async function downloadVibeVoiceModel(
  modelId: string,
  opts?: DownloadOptions
): Promise<void> {
  if (downloadingModelId) {
    throw new Error(`Another VibeVoice model is already downloading: ${downloadingModelId}`)
  }
  const venvBin = await resolveVenvBin()
  if (!venvBin) {
    throw new Error(
      'mlx-audio (mlx_audio.stt.generate) が見つからないため VibeVoice モデルをダウンロードできません'
    )
  }

  const preset = findVibeVoicePreset(modelId)
  const totalBytes = preset ? preset.approxSizeMB * 1024 * 1024 : undefined
  const cacheDir = repoCacheDir(modelId)

  downloadingModelId = modelId

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
      downloadingModelId = undefined
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
      downloadingModelId = undefined
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
