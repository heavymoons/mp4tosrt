import { promises as fs } from 'fs'
import { parseSrt, serializeSrt, type SrtCue } from './srt'

export const DEFAULT_HALLUCINATION_PATTERNS: string[] = [
  'ご視聴ありがとうございました',
  'ご視聴ありがとうございます',
  'ご視聴ありがとう',
  'ご清聴ありがとうございました',
  'ご清聴ありがとうございます',
  'チャンネル登録お願いします',
  'チャンネル登録よろしくお願いします',
  'チャンネル登録お願いいたします',
  '高評価チャンネル登録お願いします',
  'バイバイ',
  '字幕by',
  '字幕 by'
]

const NORMALIZE_RE = /[\s。、！？!?.\-*〜~ー…]+/g

function normalize(text: string): string {
  return text.replace(NORMALIZE_RE, '')
}

export function isHallucination(cueText: string, patterns: string[]): boolean {
  const t = normalize(cueText)
  if (!t) return false
  for (const p of patterns) {
    const np = normalize(p)
    if (!np) continue
    // 正規化後の完全一致のみ削除対象とする。
    // partial match は本物の発話との誤削除リスクが高いので採用しない。
    if (t === np) return true
  }
  return false
}

export async function loadCustomPatterns(path: string): Promise<string[]> {
  const text = await fs.readFile(path, 'utf-8')
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    out.push(line)
  }
  return out
}

export async function applyHallucinationSuppression(
  srtPath: string,
  customListPath?: string
): Promise<number> {
  let patterns = [...DEFAULT_HALLUCINATION_PATTERNS]
  if (customListPath) {
    try {
      const custom = await loadCustomPatterns(customListPath)
      patterns = patterns.concat(custom)
    } catch {
      /* ignore — file missing etc. */
    }
  }
  const text = await fs.readFile(srtPath, 'utf-8')
  const cues = parseSrt(text)
  const filtered: SrtCue[] = cues.filter(c => !isHallucination(c.text, patterns))
  const dropped = cues.length - filtered.length
  if (dropped > 0) {
    await fs.writeFile(srtPath, serializeSrt(filtered), 'utf-8')
  }
  return dropped
}
