import React, { useCallback, useEffect, useState } from 'react'
import type { Job, Settings, ToolsCheck } from '../../shared/types'
import ToolStatusPanel from './components/ToolStatusPanel'
import SettingsPanel from './components/SettingsPanel'
import DropZone from './components/DropZone'
import JobList from './components/JobList'
import Help from './components/Help'
import { I18nProvider, detectLocale, useT, type Locale } from './i18n'

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
  const engine = settings?.engine ?? 'mlx-whisper'
  const engineFound =
    engine === 'vibevoice-asr' ? tools?.vibevoiceAsr.found : tools?.mlxWhisper.found
  const allFound = Boolean(tools?.ffmpeg.found && engineFound)
  const locale: Locale = settings?.uiLocale ?? detectLocale()

  const setLocale = (next: Locale): void => {
    void updateSettings({ uiLocale: next })
  }

  return (
    <I18nProvider locale={locale}>
      <AppShell
        tools={tools}
        settings={settings}
        engine={engine}
        jobs={jobsList}
        helpOpen={helpOpen}
        allFound={allFound}
        locale={locale}
        onLocaleChange={setLocale}
        onOpenHelp={() => setHelpOpen(true)}
        onCloseHelp={() => setHelpOpen(false)}
        onRefreshTools={refreshTools}
        onPickOutputDir={() => void pickOutputDir()}
        onUpdateSettings={patch => void updateSettings(patch)}
        onAddFiles={paths => void addFiles(paths)}
        onPickFiles={() => void pickFiles()}
        onCancelJob={cancelJob}
        onRemoveJob={id => void removeJob(id)}
        onReveal={reveal}
        onClearFinished={() => void clearFinished()}
      />
    </I18nProvider>
  )
}

type ShellProps = {
  tools: ToolsCheck | null
  settings: Settings | null
  engine: Settings['engine']
  jobs: Job[]
  helpOpen: boolean
  allFound: boolean
  locale: Locale
  onLocaleChange: (l: Locale) => void
  onOpenHelp: () => void
  onCloseHelp: () => void
  onRefreshTools: () => void
  onPickOutputDir: () => void
  onUpdateSettings: (patch: Partial<Settings>) => void
  onAddFiles: (paths: string[]) => void
  onPickFiles: () => void
  onCancelJob: (id: string) => void
  onRemoveJob: (id: string) => void
  onReveal: (path: string) => void
  onClearFinished: () => void
}

function AppShell({
  tools, settings, engine, jobs, helpOpen, allFound, locale,
  onLocaleChange, onOpenHelp, onCloseHelp, onRefreshTools, onPickOutputDir,
  onUpdateSettings, onAddFiles, onPickFiles, onCancelJob, onRemoveJob, onReveal, onClearFinished
}: ShellProps): JSX.Element {
  const t = useT()
  return (
    <div className="app">
      <header className="header">
        <h1>mp4tosrt</h1>
        <div className="header-right">
          <span className="muted">{t('app.subtitle')}</span>
          <select
            className="ghost small"
            value={locale}
            onChange={e => onLocaleChange(e.target.value as Locale)}
            aria-label="UI language"
          >
            <option value="ja">{t('app.locale.ja')}</option>
            <option value="en">{t('app.locale.en')}</option>
          </select>
          <button className="ghost small" onClick={onOpenHelp}>
            {t('app.manual')}
          </button>
        </div>
      </header>

      {tools && <ToolStatusPanel tools={tools} engine={engine} onRefresh={onRefreshTools} />}

      {settings && (
        <SettingsPanel
          settings={settings}
          onPickOutputDir={onPickOutputDir}
          onChange={onUpdateSettings}
        />
      )}

      <DropZone onFiles={onAddFiles} onPick={onPickFiles} disabled={!allFound} />

      <JobList
        jobs={jobs}
        onCancel={onCancelJob}
        onRemove={onRemoveJob}
        onReveal={onReveal}
        onClearFinished={onClearFinished}
      />

      {helpOpen && <Help onClose={onCloseHelp} />}
    </div>
  )
}
