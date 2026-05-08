import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { Pipeline } from './pipeline'
import type {
  Job,
  Settings as PipelineSettings,
  LlmModelStatus
} from '../shared/types'
import { checkAllTools } from './tools'
import { LLM_MODEL_PRESETS, findPreset } from './llm/presets'
import {
  downloadModel,
  isModelDownloaded,
  isModelLoaded,
  onDownloadProgress,
  unloadModel
} from './llm/manager'
import {
  readPersistedSettings,
  writePersistedSettings,
  readPersistedJobs,
  writePersistedJobs
} from './store'
import {
  ensureAllDefaultFiles,
  defaultFilePath,
  readUserFile,
  writeUserFile,
  registerDialogPath,
  isPathAllowed,
  type UserFileKind
} from './userFiles'
import { registerVideoProtocol } from './preview'

const DEFAULT_SETTINGS: PipelineSettings = {
  model: 'mlx-community/whisper-large-v3-turbo',
  ffmpegConcurrency: 2,
  whisperConcurrency: 1,
  audioFilters: {
    loudnorm: true,
    highpassHz: 80,
    denoise: false,
    compress: false
  },
  conditionOnPreviousText: false,
  noSpeechThreshold: 0.3,
  logprobThreshold: -1.5,
  embedSubtitles: false,
  suppressHallucinations: true,
  llm: {
    enabled: false,
    modelId: 'qwen3.5-4b-q4',
    batchSize: 30,
    contextSize: 4096,
    useDictionary: true,
    requirePrompt: true,
    sharedPrompt: ''
  }
}

export async function registerIpcHandlers(win: BrowserWindow): Promise<void> {
  await ensureAllDefaultFiles()
  const stored = (await readPersistedSettings<PipelineSettings>()) ?? {}
  let settings: PipelineSettings = mergeSettings(DEFAULT_SETTINGS, stored)
  // 初回起動 / パス未設定時はデフォルトファイルを既定値として割り当てる
  if (!settings.replaceDictPath) settings.replaceDictPath = defaultFilePath('dict')
  if (!settings.hallucinationsListPath) settings.hallucinationsListPath = defaultFilePath('hallucinations')
  // 永続化された設定から来るカスタムパスも、過去にユーザー承認されたものとして allowlist に追加
  if (settings.replaceDictPath) registerDialogPath(settings.replaceDictPath)
  if (settings.hallucinationsListPath) registerDialogPath(settings.hallucinationsListPath)
  const pipeline = new Pipeline(settings)
  registerVideoProtocol(pipeline)


  let jobsSaveTimer: NodeJS.Timeout | undefined
  const scheduleJobsSave = (): void => {
    if (jobsSaveTimer) clearTimeout(jobsSaveTimer)
    jobsSaveTimer = setTimeout(() => {
      jobsSaveTimer = undefined
      const list = pipeline.list().map(j => ({
        ...j,
        log: j.log.slice(-100)
      }))
      writePersistedJobs(list).catch(err =>
        console.error('failed to persist jobs', err)
      )
    }, 800)
  }

  let settingsSaveTimer: NodeJS.Timeout | undefined
  const scheduleSettingsSave = (): void => {
    if (settingsSaveTimer) clearTimeout(settingsSaveTimer)
    settingsSaveTimer = setTimeout(() => {
      settingsSaveTimer = undefined
      writePersistedSettings(settings).catch(err =>
        console.error('failed to persist settings', err)
      )
    }, 500)
  }

  const storedJobs = await readPersistedJobs<Job>()
  if (storedJobs && storedJobs.length > 0) {
    pipeline.restoreJobs(storedJobs)
  }

  pipeline.onUpdate(job => {
    if (!win.isDestroyed()) {
      win.webContents.send('jobs:update', job)
    }
    scheduleJobsSave()
  })

  onDownloadProgress(p => {
    if (!win.isDestroyed()) {
      win.webContents.send('llm:download-progress', p)
    }
  })

  ipcMain.handle('tools:check', () => checkAllTools())

  ipcMain.handle('dialog:openFiles', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: '動画ファイルを選択',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'flv', 'wmv', 'mpg', 'mpeg'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus'] },
        { name: 'All', extensions: ['*'] }
      ]
    })
    return r.canceled ? [] : r.filePaths
  })

  ipcMain.handle('dialog:openDir', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: '出力先フォルダを選択',
      properties: ['openDirectory', 'createDirectory']
    })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('dialog:openDictFile', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: '用語辞書ファイルを選択 (誤変換 \\t 正解 形式)',
      properties: ['openFile'],
      filters: [
        { name: 'Text', extensions: ['txt', 'tsv', 'dict'] },
        { name: 'All', extensions: ['*'] }
      ]
    })
    if (r.canceled || !r.filePaths[0]) return null
    registerDialogPath(r.filePaths[0])
    return r.filePaths[0]
  })

  ipcMain.handle('dialog:openHallucinationsFile', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'ハルシネーション抑制リストを選択 (1行1パターン)',
      properties: ['openFile'],
      filters: [
        { name: 'Text', extensions: ['txt'] },
        { name: 'All', extensions: ['*'] }
      ]
    })
    if (r.canceled || !r.filePaths[0]) return null
    registerDialogPath(r.filePaths[0])
    return r.filePaths[0]
  })

  ipcMain.handle(
    'jobs:add',
    (_e, inputPath: string, outputDir: string, extraPrompt?: string): Job => {
      return pipeline.add(inputPath, outputDir, extraPrompt)
    }
  )

  ipcMain.handle('jobs:setExtraPrompt', (_e, id: string, text: string) => {
    pipeline.setExtraPrompt(id, text)
  })

  ipcMain.handle('jobs:rerunFromLlm', async (_e, id: string) => {
    await pipeline.rerunFromLlm(id)
  })

  ipcMain.handle('jobs:rerunEmbed', async (_e, id: string) => {
    await pipeline.rerunEmbed(id)
  })

  ipcMain.handle('jobs:cancel', (_e, id: string) => {
    pipeline.cancel(id)
  })

  ipcMain.handle('jobs:remove', (_e, id: string) => {
    pipeline.remove(id)
    scheduleJobsSave()
  })

  ipcMain.handle('jobs:clearFinished', () => {
    pipeline.clearFinished()
    scheduleJobsSave()
  })

  ipcMain.handle('jobs:list', (): Job[] => pipeline.list())

  ipcMain.handle('settings:get', (): PipelineSettings => settings)

  ipcMain.handle('settings:set', async (_e, next: Partial<PipelineSettings>): Promise<PipelineSettings> => {
    const prev = settings
    settings = mergeSettings(settings, next)
    pipeline.updateSettings(settings)
    if (prev.llm.enabled && !settings.llm.enabled) {
      try { await unloadModel() } catch { /* ignore */ }
    }
    scheduleSettingsSave()
    return settings
  })

  ipcMain.handle('shell:revealInFinder', (_e, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('llm:listPresets', () => LLM_MODEL_PRESETS)

  ipcMain.handle('llm:status', async (_e, modelId: string): Promise<LlmModelStatus> => {
    const downloaded = await isModelDownloaded(modelId)
    return { modelId, downloaded, loaded: isModelLoaded(modelId) }
  })

  ipcMain.handle('llm:download', async (_e, modelId: string) => {
    if (!findPreset(modelId)) throw new Error(`unknown preset: ${modelId}`)
    await downloadModel(modelId)
  })

  ipcMain.handle('llm:unload', async () => {
    await unloadModel()
  })

  ipcMain.handle('userFile:defaultPath', (_e, kind: UserFileKind) => defaultFilePath(kind))

  ipcMain.handle('userFile:read', async (_e, path: string) => {
    if (!isPathAllowed(path)) {
      throw new Error(`このパスへのアクセスは許可されていません: ${path}`)
    }
    return await readUserFile(path)
  })

  ipcMain.handle('userFile:write', async (_e, path: string, content: string) => {
    if (!isPathAllowed(path)) {
      throw new Error(`このパスへの書き込みは許可されていません: ${path}`)
    }
    await writeUserFile(path, content)
  })
}

function mergeSettings(
  base: PipelineSettings,
  patch: Partial<PipelineSettings>
): PipelineSettings {
  return {
    ...base,
    ...patch,
    audioFilters: patch.audioFilters
      ? { ...base.audioFilters, ...patch.audioFilters }
      : base.audioFilters,
    llm: patch.llm ? { ...base.llm, ...patch.llm } : base.llm
  }
}
