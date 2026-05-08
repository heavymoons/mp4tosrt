import type { SrtCue } from '../srt'
import type { ReplaceRule } from '../replace'
import { generateCompletion } from './manager'

const SYSTEM_PROMPT_BASE = `あなたは日本語字幕の校正者。Whisper の音声認識ミスを修正する。

# 出力フォーマット（厳守）
入力1行 \`[N] 本文\` ごとに、出力1行 \`[N] 本文\` を返す。
- 入力と完全に同じ件数・同じ番号
- 修正不要・困難な行も \`[N] 元の本文\` で必ず返す（行数を保つ）
- 説明・前置き・コメント・空行は一切出力しない

# 一般的な校正
- 同音異義語の誤変換を直す
- てにをはの欠落・誤りを直す
- 過剰な句読点は付けない
- 意味を変える書き換えは禁止`

export function buildSystemPrompt(glossary?: ReplaceRule[], extraPrompt?: string): string {
  let prompt = SYSTEM_PROMPT_BASE
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

function parseResponse(text: string, expected: number): Map<number, string> {
  const cleaned = stripThinking(text)
  const map = new Map<number, string>()
  for (const raw of cleaned.split(/\r?\n/)) {
    const line = raw.trim()
    const m = line.match(/^\[(\d+)\]\s*(.*)$/)
    if (m) {
      const n = parseInt(m[1]!, 10)
      const body = m[2]!.trim()
      if (body && n >= 1 && n <= expected) map.set(n, body)
    }
  }
  return map
}

export async function correctCues(
  cues: SrtCue[],
  options: {
    batchSize: number
    contextSize: number
    glossary?: ReplaceRule[]
    extraPrompt?: string
    log: (s: string) => void
    onProgress?: (done: number, total: number) => void
  }
): Promise<SrtCue[]> {
  const { batchSize, contextSize, glossary, extraPrompt, log, onProgress } = options
  const systemPrompt = buildSystemPrompt(glossary, extraPrompt)
  const result: SrtCue[] = []
  const totalBatches = Math.ceil(cues.length / batchSize)
  log(`[llm] starting: ${cues.length} cues, ${totalBatches} batches (size ${batchSize})`)

  for (let i = 0; i < cues.length; i += batchSize) {
    const batch = cues.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const userMsg = formatBatch(batch)
    const t0 = Date.now()
    log(`[llm] batch ${batchNum}/${totalBatches}: generating ${batch.length} cues…`)

    let streamedText = ''
    let liveLines = 0
    let lastLogged = -1

    let response = ''
    try {
      response = await generateCompletion(systemPrompt, userMsg, contextSize, {
        onTextChunk: (chunk: string) => {
          streamedText += chunk
          const matches = streamedText.match(/^\[\d+\]/gm)
          const newLines = matches ? matches.length : 0
          if (newLines !== liveLines) {
            liveLines = newLines
            const partialDone = Math.min(batch.length, liveLines)
            onProgress?.(i + partialDone, cues.length)
          }
          if (lastLogged < 0 || streamedText.length - lastLogged > 256) {
            lastLogged = streamedText.length
            log(`[llm] batch ${batchNum}/${totalBatches}: ${liveLines}/${batch.length} cues, ${streamedText.length} chars streamed`)
          }
        }
      })
    } catch (e) {
      log(`[llm] batch ${batchNum}/${totalBatches} error: ${e instanceof Error ? e.message : String(e)} — keeping original batch`)
      result.push(...batch)
      onProgress?.(result.length, cues.length)
      continue
    }

    const elapsedMs = Date.now() - t0
    const elapsedSec = (elapsedMs / 1000).toFixed(1)
    const parsed = parseResponse(response, batch.length)
    const matched = parsed.size

    if (matched === 0) {
      const preview = response.replace(/\s+/g, ' ').slice(0, 240)
      log(`[llm] batch ${batchNum}/${totalBatches}: 0/${batch.length} parsed — keeping original batch (${elapsedSec}s)`)
      log(`[llm] raw response preview: ${preview}${response.length > 240 ? '…' : ''}`)
      result.push(...batch)
    } else {
      let changed = 0
      for (let j = 0; j < batch.length; j++) {
        const original = batch[j]!.text
        const fixed = parsed.get(j + 1) ?? original
        if (fixed !== original) changed++
        result.push({ ...batch[j]!, text: fixed })
      }
      const charsPerSec = Math.round((response.length / Math.max(elapsedMs, 1)) * 1000)
      log(`[llm] batch ${batchNum}/${totalBatches}: ${matched}/${batch.length} parsed, ${changed} changed (${elapsedSec}s, ${charsPerSec} char/s)`)
      if (matched < batch.length) {
        const preview = response.replace(/\s+/g, ' ').slice(0, 240)
        log(`[llm] raw response preview: ${preview}${response.length > 240 ? '…' : ''}`)
      }
    }
    onProgress?.(result.length, cues.length)
  }
  log(`[llm] all ${totalBatches} batches done`)
  return result
}
