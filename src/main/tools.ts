import { execFile } from 'child_process'
import { promisify } from 'util'
import { homedir } from 'os'

const execFileP = promisify(execFile)

export function ensurePathEnv(): void {
  const home = homedir()
  const extras = [
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    `${home}/.local/bin`,
    `${home}/Library/Python/3.11/bin`,
    `${home}/Library/Python/3.12/bin`,
    `${home}/Library/Python/3.13/bin`
  ]
  const current = (process.env.PATH ?? '').split(':').filter(Boolean)
  const seen = new Set(current)
  const merged: string[] = []
  for (const p of extras) {
    if (!seen.has(p)) {
      merged.push(p)
      seen.add(p)
    }
  }
  process.env.PATH = [...merged, ...current].join(':')
}

export type ToolStatus = {
  found: boolean
  path?: string
  version?: string
  error?: string
}

async function which(name: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileP('/usr/bin/which', [name])
    const p = stdout.trim()
    return p || undefined
  } catch {
    return undefined
  }
}

export async function checkFfmpeg(): Promise<ToolStatus> {
  const p = await which('ffmpeg')
  if (!p) return { found: false }
  try {
    const { stdout } = await execFileP(p, ['-version'])
    const m = stdout.match(/ffmpeg version (\S+)/)
    return { found: true, path: p, version: m?.[1] }
  } catch (e) {
    return { found: false, path: p, error: errMsg(e) }
  }
}

export async function checkMlxWhisper(): Promise<ToolStatus> {
  const p = await which('mlx_whisper')
  if (!p) return { found: false }
  try {
    await execFileP(p, ['--help'], { maxBuffer: 4 * 1024 * 1024 })
    return { found: true, path: p, version: 'installed' }
  } catch (e) {
    return { found: false, path: p, error: errMsg(e) }
  }
}

export async function checkAllTools(): Promise<{ ffmpeg: ToolStatus; mlxWhisper: ToolStatus }> {
  const [ffmpeg, mlxWhisper] = await Promise.all([checkFfmpeg(), checkMlxWhisper()])
  return { ffmpeg, mlxWhisper }
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
