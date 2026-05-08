export type JobStatus =
  | 'queued'
  | 'converting'
  | 'transcribing'
  | 'awaiting'
  | 'done'
  | 'error'
  | 'cancelled'

export type JobPhase =
  | 'idle'
  | 'convert'
  | 'transcribe'
  | 'postprocess'
  | 'awaiting-prompt'
  | 'llm-correct'
  | 'embed'
  | 'done'

export type Job = {
  id: string
  inputPath: string
  outputDir: string
  outputPath?: string
  status: JobStatus
  phase: JobPhase
  progress: number
  log: string[]
  error?: string
  startedAt?: number
  finishedAt?: number
  extraPrompt?: string
}

export type AudioFilters = {
  loudnorm: boolean
  highpassHz: number
  denoise: boolean
  compress: boolean
}

export type LlmSettings = {
  enabled: boolean
  modelId: string
  batchSize: number
  contextSize: number
  useDictionary: boolean
  requirePrompt: boolean
  sharedPrompt?: string
}

export type Settings = {
  model: string
  ffmpegConcurrency: number
  whisperConcurrency: number
  audioFilters: AudioFilters
  conditionOnPreviousText: boolean
  noSpeechThreshold: number
  logprobThreshold: number
  wordTimestamps: boolean
  language?: string
  replaceDictPath?: string
  outputDir?: string
  embedSubtitles: boolean
  suppressHallucinations: boolean
  hallucinationsListPath?: string
  llm: LlmSettings
}

export type LlmModelPreset = {
  id: string
  label: string
  uri: string
  approxSizeMB: number
}

export type LlmModelStatus = {
  modelId: string
  downloaded: boolean
  loaded: boolean
}

export type LlmDownloadProgress = {
  modelId: string
  totalBytes?: number
  downloadedBytes: number
  finished: boolean
  error?: string
}

export type ToolStatus = {
  found: boolean
  path?: string
  version?: string
  error?: string
}

export type ToolsCheck = {
  ffmpeg: ToolStatus
  mlxWhisper: ToolStatus
}
