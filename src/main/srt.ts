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

export function secondsToSrtTime(sec: number): string {
  const total = Number.isFinite(sec) && sec > 0 ? sec : 0
  const ms = Math.round(total * 1000)
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const millis = ms % 1000
  const pad = (n: number, w: number): string => String(n).padStart(w, '0')
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`
}
