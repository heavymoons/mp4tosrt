import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import type { LlmModelPreset, LlmDownloadProgress } from '../../shared/types'
import { findPreset, presetFilename } from './presets'

type LlamaInstance = unknown
type LlamaModel = { dispose: () => Promise<void>; createContext: (opts: { contextSize: number }) => Promise<LlamaContext> }
type LlamaContext = { getSequence: () => unknown; dispose?: () => void }

let llamaInstance: LlamaInstance | undefined
let modelInstance: LlamaModel | undefined
let currentModelPath: string | undefined
let downloadingModelId: string | undefined

type DownloadListener = (p: LlmDownloadProgress) => void
const downloadListeners = new Set<DownloadListener>()

export function onDownloadProgress(fn: DownloadListener): () => void {
  downloadListeners.add(fn)
  return () => downloadListeners.delete(fn)
}

function emitProgress(p: LlmDownloadProgress): void {
  for (const l of downloadListeners) l(p)
}

export function modelsDir(): string {
  return join(app.getPath('userData'), 'models')
}

export async function findModelFile(preset: LlmModelPreset): Promise<string | undefined> {
  const baseName = presetFilename(preset)
  const dir = modelsDir()
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return undefined
  }
  const match = entries.find(f => f === baseName || f.endsWith('_' + baseName) || f.endsWith('-' + baseName))
  if (!match) return undefined
  const path = join(dir, match)
  try {
    const stat = await fs.stat(path)
    if (!stat.isFile() || stat.size < 1024 * 1024) return undefined
    return path
  } catch {
    return undefined
  }
}

export async function isModelDownloaded(modelId: string): Promise<boolean> {
  const preset = findPreset(modelId)
  if (!preset) return false
  return Boolean(await findModelFile(preset))
}

export function isModelLoaded(modelId: string): boolean {
  const preset = findPreset(modelId)
  if (!preset || !currentModelPath) return false
  const baseName = presetFilename(preset)
  return currentModelPath.endsWith(baseName)
}

async function loadLlamaCpp(): Promise<typeof import('node-llama-cpp')> {
  return await import('node-llama-cpp')
}

async function getLlama(): Promise<LlamaInstance> {
  if (!llamaInstance) {
    const m = await loadLlamaCpp()
    llamaInstance = await m.getLlama()
  }
  return llamaInstance
}

export async function downloadModel(modelId: string): Promise<string> {
  if (downloadingModelId) {
    throw new Error(`Another model is already downloading: ${downloadingModelId}`)
  }
  const preset = findPreset(modelId)
  if (!preset) throw new Error(`Unknown model preset: ${modelId}`)
  const dir = modelsDir()
  await fs.mkdir(dir, { recursive: true })

  downloadingModelId = modelId
  emitProgress({ modelId, downloadedBytes: 0, finished: false })

  try {
    const m = await loadLlamaCpp()
    const dl = await m.createModelDownloader({
      modelUri: preset.uri,
      dirPath: dir,
      showCliProgress: false,
      onProgress: ({ totalSize, downloadedSize }: { totalSize?: number; downloadedSize: number }) => {
        emitProgress({
          modelId,
          totalBytes: totalSize,
          downloadedBytes: downloadedSize,
          finished: false
        })
      }
    })
    const path = await dl.download()
    emitProgress({
      modelId,
      totalBytes: dl.totalSize,
      downloadedBytes: dl.totalSize ?? 0,
      finished: true
    })
    return path
  } catch (e) {
    emitProgress({
      modelId,
      downloadedBytes: 0,
      finished: true,
      error: e instanceof Error ? e.message : String(e)
    })
    throw e
  } finally {
    downloadingModelId = undefined
  }
}

export async function ensureModelLoaded(modelId: string, _contextSize: number): Promise<void> {
  const preset = findPreset(modelId)
  if (!preset) throw new Error(`Unknown model preset: ${modelId}`)
  let path = await findModelFile(preset)
  if (!path) {
    path = await downloadModel(modelId)
  }
  if (currentModelPath === path && modelInstance) return
  if (modelInstance) {
    try { await modelInstance.dispose() } catch { /* ignore */ }
    modelInstance = undefined
    currentModelPath = undefined
  }
  const llama = await getLlama() as { loadModel: (opts: { modelPath: string }) => Promise<LlamaModel> }
  modelInstance = await llama.loadModel({ modelPath: path })
  currentModelPath = path
}

export type GenerateOptions = {
  onTextChunk?: (chunk: string) => void
}

export async function generateCompletion(
  systemPrompt: string,
  userMessage: string,
  contextSize: number,
  options?: GenerateOptions
): Promise<string> {
  if (!modelInstance) throw new Error('Model not loaded')
  const m = await loadLlamaCpp()
  const ctx = await modelInstance.createContext({ contextSize })
  try {
    const session = new m.LlamaChatSession({
      contextSequence: ctx.getSequence() as never,
      systemPrompt
    })
    const promptOpts: { temperature: number; onTextChunk?: (chunk: string) => void } = {
      temperature: 0.5
    }
    if (options?.onTextChunk) promptOpts.onTextChunk = options.onTextChunk
    const out = await session.prompt(userMessage, promptOpts)
    return out
  } finally {
    try { ctx.dispose?.() } catch { /* ignore */ }
  }
}

export async function unloadModel(): Promise<void> {
  if (modelInstance) {
    try { await modelInstance.dispose() } catch { /* ignore */ }
    modelInstance = undefined
    currentModelPath = undefined
  }
}
