import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import type { LlmModelPreset, LlmDownloadProgress } from '../../shared/types'
import { findPreset, presetFilename } from './presets'
import { sanitizeGemma4Output } from './sanitize'

type LlamaInstance = unknown
type LlamaSequence = { dispose: () => void }
type LlamaContext = {
  getSequence: () => LlamaSequence
  dispose?: () => void | Promise<void>
  readonly sequencesLeft?: number
}
type LlamaModel = {
  dispose: () => Promise<void>
  createContext: (opts: { contextSize: number; sequences?: number }) => Promise<LlamaContext>
  fileInfo?: { metadata?: { tokenizer?: { chat_template?: string } } }
}
type LlamaChatSessionInstance = {
  prompt: (
    text: string,
    opts: { temperature: number; onTextChunk?: (chunk: string) => void }
  ) => Promise<string>
  dispose: (opts?: { disposeSequence?: boolean }) => void
}

let llamaInstance: LlamaInstance | undefined
let modelInstance: LlamaModel | undefined
let currentModelPath: string | undefined
let contextInstance: LlamaContext | undefined
let currentContextSize = 0
let downloadingModelId: string | undefined
// Gemma 4 はモデル切替で変わる「現在ロード中モデル」固有の状態。
// generateCompletion は modelId を受け取らないのでモジュール変数で保持する。
let currentIsGemma4 = false
let currentChatTemplate: string | undefined

const CONTEXT_SEQUENCES = 4

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
    // 'lastBuild' を指定して、setup スクリプトで自前ビルドした localBuild
    // (gilad/gemma4 + llama.cpp b9524) を確実に掴ませる。引数なし getLlama() だと
    // packaged app で build options のミスマッチにより 3.18.1 prebuilt(b8390=
    // Gemma 4 非対応) が選ばれてしまうことがある。
    llamaInstance = await m.getLlama('lastBuild')
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

async function disposeContext(): Promise<void> {
  if (!contextInstance) return
  try {
    const r = contextInstance.dispose?.()
    if (r && typeof (r as Promise<void>).then === 'function') await r
  } catch { /* ignore */ }
  contextInstance = undefined
  currentContextSize = 0
}

async function ensureContext(contextSize: number): Promise<LlamaContext> {
  if (!modelInstance) throw new Error('Model not loaded')
  if (contextInstance && currentContextSize === contextSize) return contextInstance
  await disposeContext()
  contextInstance = await modelInstance.createContext({
    contextSize,
    sequences: CONTEXT_SEQUENCES
  })
  currentContextSize = contextSize
  return contextInstance
}

export async function ensureModelLoaded(modelId: string, _contextSize: number): Promise<void> {
  const preset = findPreset(modelId)
  if (!preset) throw new Error(`Unknown model preset: ${modelId}`)
  let path = await findModelFile(preset)
  if (!path) {
    path = await downloadModel(modelId)
  }
  if (currentModelPath === path && modelInstance) return
  await disposeContext()
  if (modelInstance) {
    try { await modelInstance.dispose() } catch { /* ignore */ }
    modelInstance = undefined
    currentModelPath = undefined
  }
  // 旧モデルの Gemma 4 状態が新モデルへ漏れないよう、ロード前にクリアする。
  currentIsGemma4 = false
  currentChatTemplate = undefined
  const llama = await getLlama() as { loadModel: (opts: { modelPath: string }) => Promise<LlamaModel> }
  modelInstance = await llama.loadModel({ modelPath: path })
  currentModelPath = path

  // Gemma 4 判定は preset id が 'gemma4' 始まりで確定。
  // 内蔵 Gemma 4 ラッパーは未完成(空出力/segfault)なので、GGUF 埋め込みの
  // jinja chat_template を JinjaTemplateChatWrapper で直接使う。
  if (preset.id.startsWith('gemma4')) {
    try {
      const template = modelInstance.fileInfo?.metadata?.tokenizer?.chat_template
      if (!template || template.trim().length === 0) {
        throw new Error(
          `Gemma 4 モデル (${preset.id}) の chat_template が GGUF メタデータから取得できませんでした。` +
          'このモデルでは jinja テンプレート直叩きが必須のため処理を中止します。'
        )
      }
      // テンプレートが Gemma 4 新形式かを健全性チェック (auto wrapper へ落とさない)。
      if (!template.includes('<|turn>') && !template.includes('<|channel>')) {
        throw new Error(
          `Gemma 4 モデル (${preset.id}) の chat_template が想定形式 (<|turn> / <|channel>) を含みません。` +
          '正しい Gemma 4 GGUF か確認してください。'
        )
      }
      currentChatTemplate = template
      currentIsGemma4 = true
    } catch (e) {
      // 検証失敗時はロード済み状態を破棄し、次回 early-return で
      // Gemma 状態なしのまま進むのを防ぐ（壊れた auto wrapper を回避）。
      try { await modelInstance.dispose() } catch { /* ignore */ }
      modelInstance = undefined
      currentModelPath = undefined
      currentIsGemma4 = false
      currentChatTemplate = undefined
      throw e
    }
  }
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
  // コンテキストはモデルと同じ寿命で1度だけ作る (sequences プールあり)。
  // バッチごとに createContext / dispose を繰り返すと llama-addon.node 内部で
  // use-after-free を起こしてプロセスがクラッシュする (state_seq_get_data) ため、
  // 長寿命コンテキストにして session 経由でシーケンスをやりくりする方式。
  const ctx = await ensureContext(contextSize)
  const sequence = ctx.getSequence()
  let session: LlamaChatSessionInstance | undefined
  try {
    const sessionOpts: {
      contextSequence: never
      systemPrompt: string
      chatWrapper?: unknown
    } = {
      contextSequence: sequence as never,
      systemPrompt
    }
    // Gemma 4 は GGUF 埋め込みの jinja テンプレートを直接ラッパーに渡す。
    // currentChatTemplate は ensureModelLoaded で非空が保証されている。
    if (currentIsGemma4 && currentChatTemplate) {
      sessionOpts.chatWrapper = new m.JinjaTemplateChatWrapper({ template: currentChatTemplate })
    }
    session = new m.LlamaChatSession(
      sessionOpts as never
    ) as unknown as LlamaChatSessionInstance
    const promptOpts: { temperature: number; onTextChunk?: (chunk: string) => void } = {
      temperature: 0.5
    }
    if (options?.onTextChunk) promptOpts.onTextChunk = options.onTextChunk
    const out = await session.prompt(userMessage, promptOpts)
    // Gemma 4 出力は先頭に思考チャネルが付くので限定的に剥がす。非 Gemma はそのまま。
    return currentIsGemma4 ? sanitizeGemma4Output(out) : out
  } finally {
    // session.dispose({ disposeSequence: true }) で session とシーケンスを
    // セットで解放し、context の sequences プールに返却する。
    if (session) {
      try { session.dispose({ disposeSequence: true }) } catch { /* ignore */ }
    } else {
      try { sequence.dispose() } catch { /* ignore */ }
    }
  }
}

export async function unloadModel(): Promise<void> {
  await disposeContext()
  if (modelInstance) {
    try { await modelInstance.dispose() } catch { /* ignore */ }
    modelInstance = undefined
    currentModelPath = undefined
  }
  currentIsGemma4 = false
  currentChatTemplate = undefined
}
