import { app, BrowserWindow, dialog, shell } from 'electron'
import path from 'node:path'
import { APP_ID, APP_NAME, ensurePaths, migrateLegacyData } from './paths'
import { registerIpcHandlers } from './ipc'
import { t } from './i18n'
import { hasRunningServers, killAll } from './process-manager'

app.setName(APP_NAME)

let mainWindow: BrowserWindow | null = null
let quitting = false

function appIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../icon.png')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    backgroundColor: '#06090f',
    title: 'CraftPulse',
    icon: appIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (quitting || !mainWindow) return
    if (!hasRunningServers()) return
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: [t('Отмена'), t('Остановить и выйти')],
      defaultId: 0,
      cancelId: 0,
      title: t('Запущенные серверы'),
      message: t('Есть запущенные серверы Minecraft.'),
      detail: t(
        'При выходе все Java-процессы будут принудительно завершены. Несохранённый прогресс мира может быть потерян.'
      )
    })
    if (choice === 0) {
      event.preventDefault()
    } else {
      quitting = true
      killAll()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const isDevTools =
      input.key === 'F12' ||
      (input.control && input.shift && input.key.toLowerCase() === 'i')
    if (isDevTools) {
      mainWindow?.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Переносим данные прежнего бренда до создания окон и профиля Electron.
migrateLegacyData()

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID)
    ensurePaths()
    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  quitting = true
  killAll()
})
