export type SrtCue = {
  start: string
  end: string
  text: string
}

const TIME_RE = /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/

export function parseSrt(raw: string): SrtCue[] {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').trim()
  if (!text) return []
  const blocks = text.split(/\n{2,}/)
  const cues: SrtCue[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    let i = 0
    if (lines[i] && /^\d+$/.test(lines[i]!.trim())) i++
    const timeLine = lines[i]
    if (!timeLine) continue
    const m = timeLine.match(TIME_RE)
    if (!m) continue
    const start = m[1]!
    const end = m[2]!
    const cueText = lines.slice(i + 1).join('\n').trim()
    cues.push({ start, end, text: cueText })
  }
  return cues
}

export function serializeSrt(cues: SrtCue[]): string {
  return (
    cues
      .map((c, i) => `${i + 1}\n${c.start} --> ${c.end}\n${c.text}`)
      .join('\n\n') + '\n'
  )
}
