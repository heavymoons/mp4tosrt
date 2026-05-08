import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  Job,
  Settings,
  ToolsCheck,
  LlmModelPreset,
  LlmModelStatus,
  LlmDownloadProgress
} from '../shared/types'

const api = {
  checkTools: (): Promise<ToolsCheck> => ipcRenderer.invoke('tools:check'),
  openFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFiles'),
  openDir: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDir'),
  openDictFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDictFile'),
  addJob: (inputPath: string, outputDir: string, extraPrompt?: string): Promise<Job> =>
    ipcRenderer.invoke('jobs:add', inputPath, outputDir, extraPrompt),
  setJobExtraPrompt: (id: string, text: string): Promise<void> =>
    ipcRenderer.invoke('jobs:setExtraPrompt', id, text),
  rerunJobFromLlm: (id: string): Promise<void> =>
    ipcRenderer.invoke('jobs:rerunFromLlm', id),
  cancelJob: (id: string): Promise<void> => ipcRenderer.invoke('jobs:cancel', id),
  removeJob: (id: string): Promise<void> => ipcRenderer.invoke('jobs:remove', id),
  clearFinished: (): Promise<void> => ipcRenderer.invoke('jobs:clearFinished'),
  listJobs: (): Promise<Job[]> => ipcRenderer.invoke('jobs:list'),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (next: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', next),
  revealInFinder: (path: string): Promise<void> =>
    ipcRenderer.invoke('shell:revealInFinder', path),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return (file as unknown as { path?: string }).path ?? ''
    }
  },
  onJobUpdate: (cb: (job: Job) => void): (() => void) => {
    const listener = (_e: unknown, job: Job): void => cb(job)
    ipcRenderer.on('jobs:update', listener)
    return () => ipcRenderer.removeListener('jobs:update', listener)
  },
  llmListPresets: (): Promise<LlmModelPreset[]> => ipcRenderer.invoke('llm:listPresets'),
  llmStatus: (modelId: string): Promise<LlmModelStatus> =>
    ipcRenderer.invoke('llm:status', modelId),
  llmDownload: (modelId: string): Promise<void> => ipcRenderer.invoke('llm:download', modelId),
  llmUnload: (): Promise<void> => ipcRenderer.invoke('llm:unload'),
  onLlmDownloadProgress: (cb: (p: LlmDownloadProgress) => void): (() => void) => {
    const listener = (_e: unknown, p: LlmDownloadProgress): void => cb(p)
    ipcRenderer.on('llm:download-progress', listener)
    return () => ipcRenderer.removeListener('llm:download-progress', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
