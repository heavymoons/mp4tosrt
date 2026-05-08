import React, { useCallback, useEffect, useState } from 'react'
import type { Job, Settings, ToolsCheck } from '../../shared/types'
import ToolStatusPanel from './components/ToolStatusPanel'
import SettingsPanel from './components/SettingsPanel'
import DropZone from './components/DropZone'
import JobList from './components/JobList'
import Help from './components/Help'

export default function App(): JSX.Element {
  const [tools, setTools] = useState<ToolsCheck | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [jobs, setJobs] = useState<Map<string, Job>>(new Map())
  const [helpOpen, setHelpOpen] = useState(false)

  const refreshTools = useCallback(async () => {
    const t = await window.api.checkTools()
    setTools(t)
  }, [])

  useEffect(() => {
    void refreshTools()
    void window.api.getSettings().then(setSettings)
    void window.api.listJobs().then(list => {
      const m = new Map<string, Job>()
      for (const j of list) m.set(j.id, j)
      setJobs(m)
    })
    const off = window.api.onJobUpdate(job => {
      setJobs(prev => {
        const next = new Map(prev)
        next.set(job.id, job)
        return next
      })
    })
    return off
  }, [refreshTools])

  const updateSettings = async (patch: Partial<Settings>): Promise<void> => {
    const next = await window.api.setSettings(patch)
    setSettings(next)
  }

  const pickOutputDir = async (): Promise<string | null> => {
    const dir = await window.api.openDir()
    if (dir) {
      const next = await window.api.setSettings({ outputDir: dir })
      setSettings(next)
      return dir
    }
    return null
  }

  const ensureOutputDir = async (): Promise<string | null> => {
    if (settings?.outputDir) return settings.outputDir
    return pickOutputDir()
  }

  const addFiles = async (paths: string[]): Promise<void> => {
    if (paths.length === 0) return
    const dir = await ensureOutputDir()
    if (!dir) return
    for (const p of paths) {
      await window.api.addJob(p, dir)
    }
  }

  const pickFiles = async (): Promise<void> => {
    const files = await window.api.openFiles()
    if (files.length) await addFiles(files)
  }

  const cancelJob = (id: string): void => {
    void window.api.cancelJob(id)
  }

  const removeJob = async (id: string): Promise<void> => {
    await window.api.removeJob(id)
    setJobs(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  const clearFinished = async (): Promise<void> => {
    await window.api.clearFinished()
    const list = await window.api.listJobs()
    const m = new Map<string, Job>()
    for (const j of list) m.set(j.id, j)
    setJobs(m)
  }

  const reveal = (path: string): void => {
    void window.api.revealInFinder(path)
  }

  const jobsList = [...jobs.values()].sort(
    (a, b) => (a.startedAt ?? Number.MAX_SAFE_INTEGER) - (b.startedAt ?? Number.MAX_SAFE_INTEGER)
  )
  const allFound = Boolean(tools?.ffmpeg.found && tools?.mlxWhisper.found)

  return (
    <div className="app">
      <header className="header">
        <h1>mp4tosrt</h1>
        <div className="header-right">
          <span className="muted">動画ファイル → SRT 字幕（ffmpeg + mlx-whisper）</span>
          <button className="ghost small" onClick={() => setHelpOpen(true)}>
            マニュアル
          </button>
        </div>
      </header>

      {tools && <ToolStatusPanel tools={tools} onRefresh={refreshTools} />}

      {settings && (
        <SettingsPanel
          settings={settings}
          onPickOutputDir={() => void pickOutputDir()}
          onChange={patch => void updateSettings(patch)}
        />
      )}

      <DropZone onFiles={paths => void addFiles(paths)} onPick={() => void pickFiles()} disabled={!allFound} />

      <JobList
        jobs={jobsList}
        onCancel={cancelJob}
        onRemove={id => void removeJob(id)}
        onReveal={reveal}
        onClearFinished={() => void clearFinished()}
      />

      {helpOpen && <Help onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
