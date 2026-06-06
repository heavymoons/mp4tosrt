import type { SrtCue } from '../srt'
import type { ReplaceRule } from '../replace'
import { generateCompletion } from './manager'

// batch-local 1-based 範囲 (LLM 出力の [N] or [N-M])
type LocalRow = { from: number; to: number; text: string }
// 0-based グローバル cue index 範囲 (バッチ合成後の確定行)
type GlobalRow = { from: number; to: number; text: string }
type BatchSpan = { start: number; end: number }

const SYSTEM_PROMPT_INTRO = `あなたは日本語字幕の校正者。Whisper の音声認識ミスを修正する。`

const FORMAT_STRICT = `

# 出力フォーマット（厳守）
入力1行 \`[N] 本文\` ごとに、出力1行 \`[N] 本文\` を返す。
- 入力と完全に同じ件数・同じ番号
- 修正不要・困難な行も \`[N] 元の本文\` で必ず返す（行数を保つ）
- 説明・前置き・コメント・空行は一切出力しない`

function formatMerge(maxMergeSize: number): string {
  return `

# 出力フォーマット（厳守）
入力 \`[N] 本文\` ごとに、出力1行を返す。各行の形式は以下の **どちらか**:
- \`[N] 本文\` … その 1 件だけ（マージなし）
- \`[N-M] 本文\` … 連続する N..M 行を 1 つに統合（マージ）。M-N+1 ≤ ${maxMergeSize}

ルール:
- 入力の全 N (1..入力件数) を **ちょうど 1 度** だけカバー（マージ範囲なら範囲内すべてを含む）
- 重複・飛び番禁止（[1-3] と書いたら [2] を別行で出してはいけない）
- 意味を変えるマージ禁止。Whisper の機械的な切れ目を文として自然に繋ぐマージのみ
- 修正不要・困難な行も必ず \`[N] 元の本文\` で返す
- 説明・前置き・コメント・空行は一切出力しない

例（マージあり）:
入力:
[1] 明日は
[2] 晴れですよ
[3] ありがとう

出力:
[1-2] 明日は晴れですよ
[3] ありがとう`
}

const RULES_GENERAL = `

# 一般的な校正
- 同音異義語の誤変換を直す
- てにをはの欠落・誤りを直す
- 過剰な句読点は付けない
- 意味を変える書き換えは禁止`

export function buildSystemPrompt(
  glossary?: ReplaceRule[],
  extraPrompt?: string,
  maxMergeSize: number = 1
): string {
  let prompt = SYSTEM_PROMPT_INTRO
  prompt += maxMergeSize > 1 ? formatMerge(maxMergeSize) : FORMAT_STRICT
  prompt += RULES_GENERAL
  if (extraPrompt && extraPrompt.trim()) {
    prompt += `

# 動画の文脈（最優先）

**以下のメモに含まれる単語・固有名詞・地名・商品名は「正しい表記」として扱う。** Whisper は音声認識でこれらを誤認識している可能性が非常に高い。字幕中に音が近いが意味の通らない表記があれば、メモの表記に置き換える。
メモに無関係な話題のセグメントには適用しない。

## このジョブのメモ

${extraPrompt.trim()}

## 操作方法の例（このメモとは無関係な参考例）

仮にメモが「株式会社 ABC の新製品発表会。CEO は山田太郎氏。新製品ははっさく風味のクッキー」だった場合の校正例:

入力:
[1] AVCの新製品発表会が始まりました
[2] 山田たろう代表が登壇
[3] 発作風味のクッキーを試食
[4] 今日は良い天気でしたね
[5] 取引先との会食もあった

出力:
[1] ABCの新製品発表会が始まりました
[2] 山田太郎代表が登壇
[3] はっさく風味のクッキーを試食
[4] 今日は良い天気でしたね
[5] 取引先との会食もあった

解説:
- \`AVC\` → メモの \`ABC\` の誤認識として置換
- \`山田たろう\` → メモの \`山田太郎\` に
- \`発作風味\` → 病気ではなく文脈的にメモの \`はっさく\`（柑橘）が自然
- \`今日は良い天気\` \`取引先との会食\` → メモ・主題と無関係。そのまま残す

このパターンで、上のメモに含まれる単語を字幕中の誤認識と照らし合わせて校正してください。`
  }
  if (glossary && glossary.length > 0) {
    const lines = glossary.map(r => `- 「${r.from}」 → 「${r.to}」`).join('\n')
    prompt += `

# 用語辞書

以下は固有名詞の辞書（誤認識 → 正しい表記）。文脈に応じて適用する:
${lines}

辞書はガイド。文脈に合わない箇所は適用しない。`
  }
  return prompt
}

function formatBatch(cues: SrtCue[]): string {
  const lines = cues.map((c, i) => `[${i + 1}] ${c.text.replace(/\s*\n\s*/g, ' ')}`).join('\n')
  return `/no_think\n\n以下を校正してください。出力は \`[N] 本文\` 形式のみで。\n\n${lines}`
}

function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '')
    .replace(/^<think>[\s\S]*$/i, '')
}

// `[N] text` および `[N-M] text` の両方を許容してパースする。
// 行頭から `[`、数値、(`-` か `–`/`—`) 経由のレンジ、`]`、本文。
function parseResponse(text: string, batchLen: number, maxMergeSize: number): LocalRow[] {
  const cleaned = stripThinking(text)
  const rows: LocalRow[] = []
  for (const raw of cleaned.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const range = line.match(/^\[\s*(\d+)\s*[-–—]\s*(\d+)\s*\]\s*(.*)$/)
    if (range) {
      const from = parseInt(range[1]!, 10)
      const to = parseInt(range[2]!, 10)
      const body = range[3]!.trim()
      if (!body) continue
      if (from < 1 || to > batchLen || from > to) continue
      if (to - from + 1 > maxMergeSize) continue   // 上限超えは破棄
      rows.push({ from, to, text: body })
      continue
    }
    const single = line.match(/^\[\s*(\d+)\s*\]\s*(.*)$/)
    if (single) {
      const n = parseInt(single[1]!, 10)
      const body = single[2]!.trim()
      if (!body) continue
      if (n < 1 || n > batchLen) continue
      rows.push({ from: n, to: n, text: body })
    }
  }
  return rows
}

// バッチ内の rows が 1..batchLen をちょうど 1 度ずつ覆っているか確認する。
// 覆えていない場合は、from === to の単一行のみを採用したフラット版にフォールバック。
function normalizeBatchRows(
  rows: LocalRow[],
  batchLen: number,
  log: (s: string) => void,
  batchTag: string
): LocalRow[] {
  // sort by from
  const sorted = [...rows].sort((a, b) => a.from - b.from)
  let cursor = 1
  let valid = true
  for (const r of sorted) {
    if (r.from !== cursor) {
      valid = false
      break
    }
    cursor = r.to + 1
  }
  if (valid && cursor === batchLen + 1) {
    return sorted
  }
  // フォールバック: 単一行 (from === to) だけ拾い、欠落は呼び出し側で補完
  const flat = sorted.filter(r => r.from === r.to)
  if (flat.length !== rows.length) {
    log(`[llm] ${batchTag}: imperfect cover, dropping merges and falling back to 1:1`)
  }
  return flat
}

function computeBatches(
  total: number,
  batchSize: number,
  overlap: number
): { batches: BatchSpan[]; step: number } {
  const step = Math.max(1, batchSize - Math.max(0, overlap))
  const batches: BatchSpan[] = []
  if (total === 0) return { batches, step }
  let start = 0
  while (start < total) {
    const end = Math.min(start + batchSize, total)
    batches.push({ start, end })
    if (end === total) break
    start += step
  }
  return { batches, step }
}

// バッチごとのトラスト窓 [left, right) を返す (グローバル cue index)。
// 隣接バッチとの overlap を半分ずつ譲り合う設計。
function computeTrustWindows(
  batches: BatchSpan[],
  step: number,
  overlap: number,
  total: number
): { left: number; right: number }[] {
  const half = Math.floor(Math.max(0, overlap) / 2)
  return batches.map((b, k) => {
    const isFirst = k === 0
    const isLast = k === batches.length - 1
    const left = isFirst ? 0 : b.start + half
    const right = isLast ? total : b.start + step + half
    return { left, right }
  })
}

export async function correctCues(
  cues: SrtCue[],
  options: {
    batchSize: number
    contextSize: number
    glossary?: ReplaceRule[]
    extraPrompt?: string
    batchOverlap?: number
    allowMerge?: boolean
    maxMergeSize?: number
    log: (s: string) => void
    onProgress?: (done: number, total: number) => void
    shouldCancel?: () => boolean
  }
): Promise<SrtCue[]> {
  const {
    batchSize,
    contextSize,
    glossary,
    extraPrompt,
    batchOverlap = 0,
    allowMerge = false,
    maxMergeSize: rawMax = 1,
    log,
    onProgress,
    shouldCancel
  } = options

  const overlap = Math.max(0, Math.min(batchOverlap, Math.max(0, batchSize - 1)))
  const maxMergeSize = allowMerge && rawMax > 1 ? Math.min(rawMax, 10) : 1
  const systemPrompt = buildSystemPrompt(glossary, extraPrompt, maxMergeSize)
  const { batches, step } = computeBatches(cues.length, batchSize, overlap)
  const trusts = computeTrustWindows(batches, step, overlap, cues.length)

  log(
    `[llm] starting: ${cues.length} cues, ${batches.length} batches ` +
      `(size ${batchSize}, overlap ${overlap}, step ${step}, mergeMax ${maxMergeSize})`
  )

  // 各バッチをグローバル index で正規化した行のリスト
  const adoptedByBatch: GlobalRow[][] = []

  for (let k = 0; k < batches.length; k++) {
    // キャンセル時は break ではなく早期 return（break だと未処理バッチの
    // adoptedByBatch[k] が未定義になり、後段の collation で TypeError になる）。
    // 呼び出し側 (runLlmCorrection) は cancelled を再チェックし結果を書き込まない。
    if (shouldCancel?.()) { log('[llm] cancelled — stopping batch loop'); return cues }
    const span = batches[k]!
    const batchCues = cues.slice(span.start, span.end)
    const batchLen = batchCues.length
    const tag = `batch ${k + 1}/${batches.length}`
    const userMsg = formatBatch(batchCues)
    const t0 = Date.now()
    log(`[llm] ${tag}: generating ${batchLen} cues (cues ${span.start + 1}..${span.end})…`)

    let streamedText = ''
    let liveLines = 0
    let lastLogged = -1
    let response = ''
    try {
      response = await generateCompletion(systemPrompt, userMsg, contextSize, {
        onTextChunk: (chunk: string) => {
          streamedText += chunk
          const matches = streamedText.match(/^\[\d+/gm)
          const newLines = matches ? matches.length : 0
          if (newLines !== liveLines) {
            liveLines = newLines
          }
          if (lastLogged < 0 || streamedText.length - lastLogged > 256) {
            lastLogged = streamedText.length
            log(`[llm] ${tag}: ${liveLines}/${batchLen} rows, ${streamedText.length} chars streamed`)
          }
        }
      })
    } catch (e) {
      log(`[llm] ${tag} error: ${e instanceof Error ? e.message : String(e)} — keeping original batch`)
      adoptedByBatch.push([])
      onProgress?.(Math.round(((k + 1) / batches.length) * cues.length), cues.length)
      continue
    }

    const elapsedMs = Date.now() - t0
    const elapsedSec = (elapsedMs / 1000).toFixed(1)
    const parsedLocal = parseResponse(response, batchLen, maxMergeSize)
    const normalized = normalizeBatchRows(parsedLocal, batchLen, log, tag)

    if (normalized.length === 0) {
      const preview = response.replace(/\s+/g, ' ').slice(0, 240)
      log(`[llm] ${tag}: 0 rows parsed — keeping original batch (${elapsedSec}s)`)
      log(`[llm] raw response preview: ${preview}${response.length > 240 ? '…' : ''}`)
      adoptedByBatch.push([])
    } else {
      const global: GlobalRow[] = normalized.map(r => ({
        from: span.start + (r.from - 1),
        to: span.start + (r.to - 1),
        text: r.text
      }))
      const mergeCount = normalized.filter(r => r.from !== r.to).length
      const charsPerSec = Math.round((response.length / Math.max(elapsedMs, 1)) * 1000)
      log(`[llm] ${tag}: ${normalized.length} rows, ${mergeCount} merged (${elapsedSec}s, ${charsPerSec} char/s)`)
      adoptedByBatch.push(global)
    }
    onProgress?.(Math.round(((k + 1) / batches.length) * cues.length), cues.length)
  }

  // トラスト窓に基づき各バッチから採用する。中心位置で振り分け。
  // 衝突が起きた場合は「後勝ち (より右側のバッチ)」で上書きする。
  const adopted: GlobalRow[] = []
  for (let k = 0; k < batches.length; k++) {
    const trust = trusts[k]!
    for (const row of adoptedByBatch[k]!) {
      const center = (row.from + row.to) / 2
      if (center < trust.left || center >= trust.right) continue
      adopted.push(row)
    }
  }
  // sort + 衝突解消 (後ろの行が前の行を覆っているなら前を削る)
  adopted.sort((a, b) => a.from - b.from || a.to - b.to)
  const finalRows: GlobalRow[] = []
  let nextAllowed = 0
  for (const row of adopted) {
    if (row.from < nextAllowed) {
      // 直前の行と重複。後勝ちにするため前を撤回。
      while (finalRows.length > 0 && finalRows[finalRows.length - 1]!.to >= row.from) {
        const dropped = finalRows.pop()!
        log(`[llm] collation: dropping overlapping row [${dropped.from + 1}-${dropped.to + 1}] in favor of [${row.from + 1}-${row.to + 1}]`)
      }
    }
    finalRows.push(row)
    nextAllowed = row.to + 1
  }

  // グローバル cue index を歩いて、確定行 or 元 cue でフォールバック。
  const result: SrtCue[] = []
  const rowAtStart = new Map<number, GlobalRow>()
  for (const r of finalRows) rowAtStart.set(r.from, r)

  let i = 0
  let fallbackCount = 0
  while (i < cues.length) {
    const row = rowAtStart.get(i)
    if (row) {
      result.push({
        start: cues[row.from]!.start,
        end: cues[row.to]!.end,
        text: row.text
      })
      i = row.to + 1
    } else {
      result.push(cues[i]!)
      fallbackCount++
      i++
    }
  }

  const mergedTotal = finalRows.filter(r => r.from !== r.to).length
  log(
    `[llm] all ${batches.length} batches done: ${cues.length} → ${result.length} cues ` +
      `(${mergedTotal} merges, ${fallbackCount} fallback to original)`
  )
  return result
}
