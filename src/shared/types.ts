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
  | 'download-model'
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
  // 1行あたり最大文字数（全角換算・句読点/空白で折返し・0で無効）。wrapAutoFit=false 時に使用
  maxCharsPerLine: number
  // true=フォントサイズ連動で自動算出、false=手動の maxCharsPerLine を使用
  wrapAutoFit: boolean
  // 自動算出の係数 (floor(動画幅 ÷ フォントサイズ × wrapAutoFitRatio))。小さいほど1行が短く余白大
  wrapAutoFitRatio: number
}

export type LlmSettings = {
  enabled: boolean
  modelId: string
  batchSize: number
  contextSize: number
  useDictionary: boolean
  requirePrompt: boolean
  sharedPrompt?: string
  // バッチ間で文脈を橋渡しするための重複 cue 数。0 = 重複なし（旧挙動）。
  batchOverlap: number
  // 隣接 cue を LLM 判断で 1 つにマージできるようにする。
  allowMerge: boolean
  // 1 つのマージで束ねられる最大 cue 数。1 にすると実質マージ無効。
  maxMergeSize: number
}

export type TranscribeEngine = 'mlx-whisper' | 'vibevoice-asr'

export type Settings = {
  engine: TranscribeEngine
  model: string
  vibevoiceModel: string
  vibevoiceSpeakerLabels: boolean
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

export type VibeVoiceModelStatus = {
  modelId: string
  downloaded: boolean
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
  vibevoiceAsr: ToolStatus
}
