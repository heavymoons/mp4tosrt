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
  | 'fcpxml'
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

export type FcpxmlSubtitleStyle = {
  // caption: SRT キャプション (FCPX のキャプショントラックに乗る、編集しづらいが SRT 互換)
  // title:   通常のテキストタイトル (Basic Title 効果ベース、編集しやすい)
  mode: 'caption' | 'title'
  // 以下は mode='title' 時のみ意味を持つ
  // テキスト内の左右揃え (FCPX text-style/@alignment)
  alignment: 'left' | 'center' | 'right'
  // 画面上の上下位置 (adjust-transform で y を ±videoHeight/3 / 0 にオフセット)
  verticalAnchor: 'top' | 'middle' | 'bottom'
  // フォント名 (FCPX text-style/@font)。例: "Helvetica", "Hiragino Sans", "Noto Sans JP"
  font: string
  // フォントサイズ (pt)
  fontSize: number
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
  outputFcpxml: boolean
  fcpxmlSubtitle: FcpxmlSubtitleStyle
  suppressHallucinations: boolean
  hallucinationsListPath?: string
  llm: LlmSettings
  // UI 表示言語。未定義なら起動時に navigator.language から自動判定する。
  // 既存の `language` フィールドは Whisper の書き起こし言語なので別物。
  uiLocale?: 'ja' | 'en'
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
