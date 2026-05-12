// 全 UI 文字列を 1 ファイルに集約。新しいキーは en/ja 両方に同時に追加すること。
// `{name}` プレースホルダは t() の第 2 引数の同名キーで置換される。
//
// Type-safety: en の key set が "正"。ja は同じ key を全て埋める。
// 抜けがあると `Messages` 型が要求する key が無いのでビルド時に検出される。

export const EN = {
  // App header
  'app.subtitle': 'Video → SRT subtitles (ffmpeg + mlx-whisper)',
  'app.manual': 'Manual',
  'app.locale.ja': '日本語',
  'app.locale.en': 'English',

  // ToolStatusPanel
  'tools.title': 'Environment check',
  'tools.recheck': 'Re-check',
  'tools.installed': 'Installed',
  'tools.notInstalled': 'Not installed',
  'tools.copy': 'Copy',
  'tools.copied': 'Copied',
  'tools.mlxHint': 'On first pipx use, reopen the terminal or run `pipx ensurepath`',

  // DropZone
  'drop.disabled': 'Please install the dependencies first',
  'drop.hint': 'Drop video files here, or',
  'drop.pick': 'Choose files…',

  // SettingsPanel — basic
  'settings.title': 'Settings',
  'settings.advanced.show': 'Show advanced…',
  'settings.advanced.hide': 'Hide advanced',
  'settings.outputDir': 'Output folder',
  'settings.outputDir.empty': '(unset — picked when adding files)',
  'settings.outputDir.change': 'Change…',
  'settings.embedSubtitles.main': 'Also output an .subbed.mp4 with embedded subtitles',
  'settings.embedSubtitles.hint': '(no re-encode, for standalone distribution)',
  'settings.outputFcpxml.main': 'Also output .fcpxml for Final Cut Pro',
  'settings.outputFcpxml.hint':
    '(video + caption bundle clip definition; subtitles follow the clip on the timeline)',
  'settings.fcpxml.section': 'FCPXML subtitle settings',
  'settings.fcpxml.section.hint': 'Output format and style for the .fcpxml',
  'settings.fcpxml.mode': 'Subtitle format',
  'settings.fcpxml.mode.title': 'Title (regular text clips)',
  'settings.fcpxml.mode.caption': 'Caption (SRT track)',
  'settings.fcpxml.mode.titleHint':
    'Easier to style/edit in FCPX. Style options below apply.',
  'settings.fcpxml.mode.captionHint':
    'SRT-compatible caption track. Harder to restyle in FCPX.',
  'settings.fcpxml.alignment': 'Horizontal alignment',
  'settings.fcpxml.align.left': 'Left',
  'settings.fcpxml.align.center': 'Center',
  'settings.fcpxml.align.right': 'Right',
  'settings.fcpxml.verticalAnchor': 'Vertical position',
  'settings.fcpxml.vertical.top': 'Top',
  'settings.fcpxml.vertical.middle': 'Middle',
  'settings.fcpxml.vertical.bottom': 'Bottom (lower-third)',
  'settings.fcpxml.font': 'Font',
  'settings.fcpxml.fontSize': 'Font size (pt)',
  'settings.model': 'Whisper model',
  'settings.language': 'Language',
  'settings.language.auto': 'Auto-detect',
  'settings.language.ja': 'Japanese',
  'settings.language.en': 'English',
  'settings.language.zh': 'Chinese',
  'settings.language.ko': 'Korean',
  'settings.language.es': 'Spanish',
  'settings.language.fr': 'French',
  'settings.language.de': 'German',
  'settings.ffmpegConcurrency': 'ffmpeg concurrency',
  'settings.whisperConcurrency': 'mlx-whisper concurrency',

  // SettingsPanel — audio filters
  'settings.audio.title': 'Audio filters',
  'settings.audio.subtitle': 'Conservative defaults; optimum depends on the source',
  'settings.audio.loudnorm': 'Loudness normalization',
  'settings.audio.loudnorm.hint': '(loudnorm)',
  'settings.audio.highpass': 'Highpass filter',
  'settings.audio.highpass.off': 'Off',
  'settings.audio.highpass.80': '80 Hz (recommended)',
  'settings.audio.highpass.120': '120 Hz',
  'settings.audio.highpass.200': '200 Hz (cuts low end)',
  'settings.audio.compress': 'Compressor',
  'settings.audio.compress.hint': '(large volume swings / for interview audio)',
  'settings.audio.denoise': 'Noise reduction',
  'settings.audio.denoise.hint': '(afftdn / can backfire depending on source)',

  // SettingsPanel — whisper options
  'settings.whisper.title': 'Whisper options',
  'settings.whisper.subtitle': 'Balance between missed speech and over-detection',
  'settings.whisper.condition': 'Use previous cues as context',
  'settings.whisper.condition.hint':
    'When ON, errors in earlier cues can cascade (e.g. "!!!" overload). Default OFF.',
  'settings.whisper.wordTimestamps': 'Use word-level timestamps',
  'settings.whisper.wordTimestamps.hint':
    '(cross-attention aligns subtitle starts with speech onset; ~10% inference overhead)',
  'settings.whisper.noSpeech.label': 'no-speech-threshold:',
  'settings.whisper.noSpeech.hint':
    'Lower → fewer missed speech, more noise false-positives (default 0.30)',
  'settings.whisper.logprob.label': 'logprob-threshold:',
  'settings.whisper.logprob.hint':
    'Lower → keeps low-quality decode outputs (default -1.50)',

  // SettingsPanel — postprocess
  'settings.postproc.suppress.title': 'Post-processing — Hallucination suppression',
  'settings.postproc.suppress.subtitle':
    'Removes "Thanks for watching"-type misdetections in silent regions',
  'settings.postproc.suppress.enable': 'Enable hallucination suppression',
  'settings.postproc.suppress.enable.hint':
    '(in addition to built-in patterns, the file below is also suppressed)',
  'settings.postproc.suppress.fileLabel': 'Additional suppression list',
  'settings.postproc.dict.title': 'Post-processing — Term dictionary (simple substitution)',
  'settings.postproc.dict.subtitle': 'misspell [TAB] correct / one rule per line',
  'settings.postproc.dict.fileLabel': 'Term dictionary file',

  // LlmPanel
  'llm.title': 'Post-processing — LLM correction (local)',
  'llm.subtitle':
    'Polish the transcribed text using Qwen etc. The corrected output is saved to .corrected.srt',
  'llm.enable': 'Enable LLM correction',
  'llm.enable.hint': '(model is fetched on first correction if not yet downloaded)',
  'llm.requirePrompt': 'Require an extra prompt per job',
  'llm.requirePrompt.hint': '(when off, correction runs even with an empty prompt)',
  'llm.shared': 'Shared prompt (passed to LLM for all jobs / optional)',
  'llm.shared.placeholder':
    'e.g. Videos from my YouTube channel "heavymoons". Proper nouns and military/political terms appear often.',
  'llm.model': 'Model',
  'llm.batchSize': 'Batch size',
  'llm.batchSize.hint': '(cues per request)',
  'llm.contextSize': 'Context size',
  'llm.batchOverlap': 'Batch overlap',
  'llm.batchOverlap.hint':
    '(cues that overlap between consecutive batches, for context continuity at boundaries)',
  'llm.allowMerge': 'Merge adjacent cues by context',
  'llm.allowMerge.hint':
    '(let the LLM join "tomorrow is" + "sunny" into one cue when natural)',
  'llm.maxMergeSize': 'Max cues per merge',
  'llm.maxMergeSize.hint': '(upper bound on how many cues can be combined)',
  'llm.useDictionary': 'Pass term dictionary to prompt',
  'llm.useDictionary.hint.enabled': '(can correct proper nouns in context)',
  'llm.useDictionary.hint.disabled': '(configure the term dictionary file above to enable)',
  'llm.status.modelPrefix': 'Model: {label}',
  'llm.status.downloaded': '✓ Downloaded',
  'llm.status.notDownloaded': 'Not downloaded',
  'llm.download': 'Download',
  'llm.download.progress': '{cur} / {total} ({pct}%)',
  'llm.download.progress.unknown': '{cur} downloading…',

  // FileEditor
  'file.confirmDiscard': 'You have unsaved changes. Discard and continue?',
  'file.useDefault': 'Use default',
  'file.pickAnother': 'Pick another file…',
  'file.edit': 'Edit',
  'file.close': 'Close',
  'file.default': 'Default file',
  'file.custom': 'Custom file',
  'file.loading': 'Loading…',
  'file.unsavedHint': '※ Unsaved changes (Cmd+S to save)',
  'file.saved': 'Saved',
  'file.tabHint': '  /  Tab inserts a tab character',
  'file.save': 'Save',
  'file.revert': 'Revert',

  // JobList — section
  'jobs.title': 'Jobs',
  'jobs.empty': 'Files added here will be listed below',
  'jobs.clearFinished': 'Clear finished',

  // JobList — status / phase
  'job.status.queued': 'Queued',
  'job.status.converting': 'Converting audio',
  'job.status.transcribing': 'Transcribing',
  'job.status.awaiting': 'Awaiting prompt',
  'job.status.done': 'Done',
  'job.status.error': 'Error',
  'job.status.cancelled': 'Cancelled',
  'job.phase.postprocess': 'Post-processing',
  'job.phase.awaiting-prompt': 'Awaiting prompt',
  'job.phase.llm-correct': 'LLM correcting',
  'job.phase.embed': 'Embedding subtitles',
  'job.phase.fcpxml': 'Generating FCPXML',

  // JobList — buttons / actions
  'job.preview.show': '▸ Preview',
  'job.preview.hide': '▾ Preview',
  'job.preview.title': 'Inline video preview',
  'job.reveal.video': 'Show original',
  'job.reveal.video.title': 'Reveal original video in Finder (open with QuickTime etc.)',
  'job.reveal.srt': 'Show SRT',
  'job.embed.button': 'Embed subtitles into MP4',
  'job.embed.busy': 'Encoding MP4…',
  'job.embed.title':
    'After hand-editing .corrected.srt (or .srt) externally, click to regenerate the .subbed.mp4 with the new content.\nThe original video and SRT are not modified.',
  'job.prompt.toggle.add': '+ Extra prompt',
  'job.prompt.toggle.edit': '✎ Extra prompt',
  'job.log.show': 'Log',
  'job.log.hide': 'Close log',
  'job.log.full': 'Full log',
  'job.log.full.title':
    'Open the complete log file (the UI shows only the tail; useful for past entries)',
  'job.cancel': 'Cancel',
  'job.remove': 'Remove',
  'job.preview.error':
    'Failed to load the video ({code}): {msg}\nUse the "Show original" button to play in an external player.',

  // JobList — prompt area
  'job.prompt.placeholder':
    'e.g. Political talk show by XX. Japanese politicians and place names appear often. Edit in formal style.',
  'job.prompt.hint': 'Appended to the LLM correction system prompt',
  'job.prompt.startCorrection': 'Start LLM correction',
  'job.prompt.rerunCorrection': 'Rerun from LLM correction',
  'job.prompt.running': 'Running…',
  'job.prompt.startTitle': 'Enter the extra prompt first',

  // JobList — errors
  'job.error.preload.embed':
    'window.api.rerunJobEmbed not found. The preload script is outdated — please restart the app.',
  'job.error.preload.rerun':
    'window.api.rerunJobFromLlm not found. The preload script is outdated — restart the app (Ctrl+C the npm run dev process and re-run).',
  'job.error.savePromptFailed': 'Failed to save extraPrompt: {error}',

  // JobList — elapsed time
  'job.elapsed.ms': '{minutes}m {seconds}s',
  'job.elapsed.s': '{seconds}s',

  // ErrorBoundary (also rendered by bilingual fallback when provider is missing)
  'error.title': 'A UI error occurred',
  'error.stack': 'Stack trace',
  'error.reset': 'Reset state',
  'error.reload': 'Reload'
} as const

export const JA: Messages = {
  // App header
  'app.subtitle': '動画ファイル → SRT 字幕（ffmpeg + mlx-whisper）',
  'app.manual': 'マニュアル',
  'app.locale.ja': '日本語',
  'app.locale.en': 'English',

  // ToolStatusPanel
  'tools.title': '環境チェック',
  'tools.recheck': '再チェック',
  'tools.installed': 'インストール済み',
  'tools.notInstalled': '未インストール',
  'tools.copy': 'コピー',
  'tools.copied': 'コピー済',
  'tools.mlxHint': 'pipx 初回利用時はターミナルを開き直すか pipx ensurepath が必要',

  // DropZone
  'drop.disabled': '依存ツールをセットアップしてください',
  'drop.hint': '動画ファイルをここにドロップ、または',
  'drop.pick': 'ファイルを選択…',

  // SettingsPanel — basic
  'settings.title': '設定',
  'settings.advanced.show': '詳細設定…',
  'settings.advanced.hide': '詳細を閉じる',
  'settings.outputDir': '出力先',
  'settings.outputDir.empty': '(未指定 — ファイル追加時に選択)',
  'settings.outputDir.change': '変更…',
  'settings.embedSubtitles.main': '字幕を埋め込んだ .subbed.mp4 も出力',
  'settings.embedSubtitles.hint': '(再エンコードなし・単体配布向け)',
  'settings.outputFcpxml.main': 'Final Cut Pro 用に .fcpxml も出力',
  'settings.outputFcpxml.hint':
    '(動画 + キャプション一束のクリップ定義。タイムラインで字幕がクリップに追従)',
  'settings.fcpxml.section': 'FCPXML 字幕設定',
  'settings.fcpxml.section.hint': '.fcpxml の出力形式とスタイル',
  'settings.fcpxml.mode': '字幕の出力形式',
  'settings.fcpxml.mode.title': 'タイトル (通常のテキストクリップ)',
  'settings.fcpxml.mode.caption': 'キャプション (SRT トラック)',
  'settings.fcpxml.mode.titleHint':
    'FCPX 上で色やフォントを後から自由に編集できる。下のスタイル設定が反映される。',
  'settings.fcpxml.mode.captionHint':
    'SRT 互換のキャプショントラックとして出力。FCPX 上での見た目調整は面倒。',
  'settings.fcpxml.alignment': '左右揃え',
  'settings.fcpxml.align.left': '左寄せ',
  'settings.fcpxml.align.center': '中央',
  'settings.fcpxml.align.right': '右寄せ',
  'settings.fcpxml.verticalAnchor': '上下位置',
  'settings.fcpxml.vertical.top': '上',
  'settings.fcpxml.vertical.middle': '中央',
  'settings.fcpxml.vertical.bottom': '下 (下 1/3)',
  'settings.fcpxml.font': 'フォント',
  'settings.fcpxml.fontSize': 'フォントサイズ (pt)',
  'settings.model': 'Whisper モデル',
  'settings.language': '言語',
  'settings.language.auto': '自動検出',
  'settings.language.ja': '日本語',
  'settings.language.en': 'English',
  'settings.language.zh': '中文',
  'settings.language.ko': '한국어',
  'settings.language.es': 'Español',
  'settings.language.fr': 'Français',
  'settings.language.de': 'Deutsch',
  'settings.ffmpegConcurrency': 'ffmpeg 並列',
  'settings.whisperConcurrency': 'mlx-whisper 並列',

  // SettingsPanel — audio filters
  'settings.audio.title': '音声フィルタ',
  'settings.audio.subtitle': '素材によって最適解が変わるので保守的にデフォを設定',
  'settings.audio.loudnorm': 'ラウドネス正規化',
  'settings.audio.loudnorm.hint': '(loudnorm)',
  'settings.audio.highpass': 'ハイパスフィルタ',
  'settings.audio.highpass.off': 'オフ',
  'settings.audio.highpass.80': '80 Hz (推奨)',
  'settings.audio.highpass.120': '120 Hz',
  'settings.audio.highpass.200': '200 Hz (低音減衰)',
  'settings.audio.compress': 'コンプレッサ',
  'settings.audio.compress.hint': '(音量差大 / インタビュー向け)',
  'settings.audio.denoise': 'ノイズ低減',
  'settings.audio.denoise.hint': '(afftdn / 素材次第で逆効果)',

  // SettingsPanel — whisper options
  'settings.whisper.title': 'Whisper オプション',
  'settings.whisper.subtitle': '書き起こしの抜け / 過剰検出のバランス調整',
  'settings.whisper.condition': '前のキューを参考にする',
  'settings.whisper.condition.hint':
    'ON にすると、前のキューの誤認識を引きずって「！」連発などの暴走を起こしやすいのでデフォ OFF',
  'settings.whisper.wordTimestamps': '単語タイムスタンプを使う',
  'settings.whisper.wordTimestamps.hint':
    '(クロスアテンションで字幕の開始時刻を発話開始に合わせる、推論時間+10%程度)',
  'settings.whisper.noSpeech.label': 'no-speech-threshold:',
  'settings.whisper.noSpeech.hint':
    '下げるほど抜けは減るがノイズ誤検出が増える (デフォ 0.30)',
  'settings.whisper.logprob.label': 'logprob-threshold:',
  'settings.whisper.logprob.hint':
    '下げるほど低品質decode出力も採用される (デフォ -1.50)',

  // SettingsPanel — postprocess
  'settings.postproc.suppress.title': '後処理 — ハルシネーション抑制',
  'settings.postproc.suppress.subtitle':
    '「ご視聴ありがとうございました」型の無音区間誤検出を削除',
  'settings.postproc.suppress.enable': 'ハルシネーション抑制を有効化',
  'settings.postproc.suppress.enable.hint':
    '(内蔵パターンに加え、下のファイル内容も抑制対象になる)',
  'settings.postproc.suppress.fileLabel': '追加の抑制リスト',
  'settings.postproc.dict.title': '後処理 — 用語辞書（単純置換）',
  'settings.postproc.dict.subtitle': '誤変換 [TAB] 正解 / 1行1ルール',
  'settings.postproc.dict.fileLabel': '用語辞書ファイル',

  // LlmPanel
  'llm.title': '後処理 — LLM 校正（ローカル）',
  'llm.subtitle':
    '書き起こし結果を Qwen 等で整える。校正済みは .corrected.srt に保存',
  'llm.enable': 'LLM 校正を有効化',
  'llm.enable.hint': '(モデル未ダウンロード時は最初の校正時に取得)',
  'llm.requirePrompt': 'ジョブごとの追加プロンプトを必須にする',
  'llm.requirePrompt.hint': '(オフの場合、空でも自動で校正実行)',
  'llm.shared': '共通プロンプト（全ジョブ共通で LLM に渡される / 任意）',
  'llm.shared.placeholder':
    '例: 自分のYouTubeチャンネル「heavymoons」の動画です。日本語の固有名詞や軍事/政治用語が頻出します。',
  'llm.model': 'モデル',
  'llm.batchSize': 'バッチサイズ',
  'llm.batchSize.hint': '(1回のリクエストで送るキュー数)',
  'llm.contextSize': 'コンテキストサイズ',
  'llm.batchOverlap': 'バッチ重複',
  'llm.batchOverlap.hint': '(連続する2バッチで重ねる cue 数。境界の文脈を橋渡しする用)',
  'llm.allowMerge': '文脈に応じてキューをマージする',
  'llm.allowMerge.hint':
    '(例: 「明日は」+「晴れです」が自然な場合に1キューに統合される)',
  'llm.maxMergeSize': '最大マージ数',
  'llm.maxMergeSize.hint': '(1 回のマージで束ねられる cue 数の上限)',
  'llm.useDictionary': '用語辞書をプロンプトに渡す',
  'llm.useDictionary.hint.enabled': '(固有名詞を文脈つきで修正できる)',
  'llm.useDictionary.hint.disabled': '(上の「用語辞書ファイル」を設定すると有効化)',
  'llm.status.modelPrefix': 'モデル: {label}',
  'llm.status.downloaded': '✓ ダウンロード済み',
  'llm.status.notDownloaded': '未ダウンロード',
  'llm.download': 'ダウンロード',
  'llm.download.progress': '{cur} / {total} ({pct}%)',
  'llm.download.progress.unknown': '{cur} ダウンロード中…',

  // FileEditor
  'file.confirmDiscard': '未保存の変更があります。破棄して続行しますか？',
  'file.useDefault': 'デフォルトに戻す',
  'file.pickAnother': '別のファイル…',
  'file.edit': '編集',
  'file.close': '閉じる',
  'file.default': 'デフォルトファイル',
  'file.custom': 'カスタムファイル',
  'file.loading': '読み込み中…',
  'file.unsavedHint': '※ 未保存の変更があります (Cmd+S で保存)',
  'file.saved': '保存済み',
  'file.tabHint': '  ／  Tab キーでタブ文字を挿入',
  'file.save': '保存',
  'file.revert': '元に戻す',

  // JobList — section
  'jobs.title': 'ジョブ',
  'jobs.empty': 'ファイルが追加されるとここに表示されます',
  'jobs.clearFinished': '完了済みを片付け',

  // JobList — status / phase
  'job.status.queued': '待機',
  'job.status.converting': '音声変換中',
  'job.status.transcribing': '文字起こし中',
  'job.status.awaiting': 'プロンプト入力待ち',
  'job.status.done': '完了',
  'job.status.error': 'エラー',
  'job.status.cancelled': '中止',
  'job.phase.postprocess': '後処理',
  'job.phase.awaiting-prompt': 'プロンプト入力待ち',
  'job.phase.llm-correct': 'LLM校正中',
  'job.phase.embed': '字幕埋め込み中',
  'job.phase.fcpxml': 'FCPXML 生成中',

  // JobList — buttons / actions
  'job.preview.show': '▸ プレビュー',
  'job.preview.hide': '▾ プレビュー',
  'job.preview.title': '動画をインラインプレビュー',
  'job.reveal.video': '元動画を表示',
  'job.reveal.video.title': '元動画を Finder で表示（QuickTime 等で開ける）',
  'job.reveal.srt': 'SRT を表示',
  'job.embed.button': 'MP4 へ字幕埋め込み',
  'job.embed.busy': 'MP4 出力中…',
  'job.embed.title':
    '.corrected.srt（無ければ .srt）を外部エディタで手直ししてからこのボタンを押すと、\nその内容を反映した .subbed.mp4 を再生成します。\n元動画・元 SRT は触りません。',
  'job.prompt.toggle.add': '+ 追加プロンプト',
  'job.prompt.toggle.edit': '✎ 追加プロンプト',
  'job.log.show': 'ログ',
  'job.log.hide': 'ログを閉じる',
  'job.log.full': 'ログ全文',
  'job.log.full.title':
    '完全なログをファイルで開く（UI には末尾分しか表示されないため、過去ログ確認用）',
  'job.cancel': '中止',
  'job.remove': '削除',
  'job.preview.error':
    '動画の読み込みに失敗しました ({code}): {msg}\n「元動画を表示」ボタンから外部プレイヤーで再生できます。',

  // JobList — prompt area
  'job.prompt.placeholder':
    '例: 〇〇による政治系ライブの書き起こし。日本の政治家・地名が頻出。フォーマルな文体で校正',
  'job.prompt.hint': 'LLM 校正時のシステムプロンプトに付加される',
  'job.prompt.startCorrection': 'LLM校正を開始',
  'job.prompt.rerunCorrection': 'LLM校正からやり直す',
  'job.prompt.running': '実行中…',
  'job.prompt.startTitle': '追加プロンプトを入力してください',

  // JobList — errors
  'job.error.preload.embed':
    'window.api.rerunJobEmbed が見つかりません。preload が古いため、アプリを再起動してください。',
  'job.error.preload.rerun':
    'window.api.rerunJobFromLlm が見つかりません。preload が古いため、アプリを再起動してください (npm run dev を Ctrl+C → 再実行)。',
  'job.error.savePromptFailed': 'extraPrompt 保存失敗: {error}',

  // JobList — elapsed time
  'job.elapsed.ms': '{minutes}分{seconds}秒',
  'job.elapsed.s': '{seconds}秒',

  // ErrorBoundary
  'error.title': 'UIエラーが発生しました',
  'error.stack': 'スタックトレース',
  'error.reset': '状態をリセット',
  'error.reload': 'リロード'
}

export type Messages = { [K in keyof typeof EN]: string }

export const MESSAGES: Record<'en' | 'ja', Messages> = { en: EN, ja: JA }

export type Locale = keyof typeof MESSAGES
export type LocaleKey = keyof typeof EN
