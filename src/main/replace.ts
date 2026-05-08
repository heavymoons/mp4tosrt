import { promises as fs } from 'fs'

export type ReplaceRule = { from: string; to: string }

export async function loadReplaceRules(path: string): Promise<ReplaceRule[]> {
  const text = await fs.readFile(path, 'utf-8')
  const rules: ReplaceRule[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    if (!line || line.startsWith('#')) continue
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const from = line.slice(0, tab)
    const to = line.slice(tab + 1)
    if (!from) continue
    rules.push({ from, to })
  }
  return rules
}

export function applyRules(text: string, rules: ReplaceRule[]): string {
  let out = text
  for (const r of rules) {
    out = out.split(r.from).join(r.to)
  }
  return out
}

export async function applyDictionaryToFile(srtPath: string, dictPath: string): Promise<number> {
  const rules = await loadReplaceRules(dictPath)
  if (rules.length === 0) return 0
  const text = await fs.readFile(srtPath, 'utf-8')
  const replaced = applyRules(text, rules)
  if (replaced !== text) {
    await fs.writeFile(srtPath, replaced, 'utf-8')
  }
  return rules.length
}
