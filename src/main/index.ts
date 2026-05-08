import { app, BrowserWindow, protocol, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { ensurePathEnv } from './tools'

ensurePathEnv()

// 動画プレビュー用の独自スキーム。app.ready 前に privileged 登録が必要。
// production の file:// レンダラから <video src="mp4tosrt-video://..."> を
// 読めるよう、CORS / streaming に関する privilege を全部付ける。
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mp4tosrt-video',
    privileges: {
      stream: true,
      bypassCSP: true,
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 820,
    minHeight: 540,
    show: false,
    title: 'mp4tosrt',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  const win = createWindow()
  await registerIpcHandlers(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = createWindow()
      void registerIpcHandlers(w)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
