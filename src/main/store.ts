import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

const SETTINGS_FILE = 'settings.json'
const JOBS_FILE = 'jobs.json'

function settingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

function jobsPath(): string {
  return join(app.getPath('userData'), JOBS_FILE)
}

export async function readPersistedSettings<T>(): Promise<Partial<T> | undefined> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf-8')
    return JSON.parse(raw) as Partial<T>
  } catch {
    return undefined
  }
}

export async function writePersistedSettings<T>(data: T): Promise<void> {
  const dir = app.getPath('userData')
  await fs.mkdir(dir, { recursive: true })
  const path = settingsPath()
  const tmp = `${path}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmp, path)
}

export async function readPersistedJobs<T>(): Promise<T[] | undefined> {
  try {
    const raw = await fs.readFile(jobsPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    return parsed as T[]
  } catch {
    return undefined
  }
}

export async function writePersistedJobs<T>(jobs: T[]): Promise<void> {
  const dir = app.getPath('userData')
  await fs.mkdir(dir, { recursive: true })
  const path = jobsPath()
  const tmp = `${path}.tmp`
  await fs.writeFile(tmp, JSON.stringify(jobs, null, 2), 'utf-8')
  await fs.rename(tmp, path)
}
