import { app, shell, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerWhisperHandlers } from './whisperService'
import * as fs from 'fs'

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let currentHotkey = 'CommandOrControl+Shift+R'

// Path to store hotkey
function getHotkeyPath(): string {
  return join(app.getPath('userData'), 'hotkey.txt')
}

// Load saved hotkey
function loadHotkey(): string {
  const defaultHotkey = 'CommandOrControl+Shift+R'
  try {
    const path = getHotkeyPath()
    if (fs.existsSync(path)) {
      const saved = fs.readFileSync(path, 'utf-8').trim()
      // Validate - don't load hotkeys with Meta (Windows key) as they're not supported
      if (saved && saved !== defaultHotkey && !saved.includes('Meta')) {
        // Try to verify it can be registered
        try {
          if (globalShortcut.register(saved, () => {})) {
            globalShortcut.unregister(saved)
            currentHotkey = saved
            return saved
          }
        } catch (e) {
          console.log('[Hotkey] Saved hotkey invalid, using default')
        }
      }
    }
  } catch (e) {
    console.error('[Hotkey] Error loading hotkey:', e)
  }
  currentHotkey = defaultHotkey
  return defaultHotkey
}

// Save hotkey
function saveHotkey(hotkey: string): void {
  try {
    fs.writeFileSync(getHotkeyPath(), hotkey)
    currentHotkey = hotkey
  } catch (e) {
    console.error('[Hotkey] Error saving hotkey:', e)
  }
}

function createWindow(): void {
  // Get the path to the icon - icon is in project root, not electron-vue
  const iconPath = join(__dirname, '../../../flatrobot.ico')
  console.log('[Icon] Window icon path:', iconPath)
  
  // Load the icon
  const icon = nativeImage.createFromPath(iconPath)
  console.log('[Icon] Window icon size:', icon.getSize())
  
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: false,
    icon: icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createSettingsWindow(): void {
  // If settings window already exists, focus it
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }
  
  // Get the path to the icon
  const iconPath = join(__dirname, '../../../flatrobot.ico')
  const icon = nativeImage.createFromPath(iconPath)
  
  settingsWindow = new BrowserWindow({
    width: 550,
    height: 500,
    minWidth: 400,
    minHeight: 400,
    show: false,
    resizable: true,
    icon: icon,
    parent: mainWindow || undefined,
    modal: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show()
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  // Load settings page with query param
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?settings=true`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), { query: { settings: 'true' } })
  }
}

function createAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            createSettingsWindow()
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => {
            isQuitting = true
            app.quit()
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About whisperMeOff',
          click: () => {
            const { dialog } = require('electron')
            dialog.showMessageBox({
              type: 'info',
              title: 'About whisperMeOff',
              message: 'whisperMeOff v1.0.0',
              detail: 'Voice transcription app using Whisper AI.\n\nPress Ctrl+Shift+R to start/stop recording.'
            })
          }
        }
      ]
    }
  ]
  
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createTray(): void {
  // Use the flatrobot.ico file for tray icon - icon is in project root
  const iconPath = join(__dirname, '../../../flatrobot.ico')
  console.log('[Tray] Icon path:', iconPath)
  
  const icon = nativeImage.createFromPath(iconPath)
  console.log('[Tray] Icon size:', icon.getSize())
  
  // Resize for tray (16x16 on Windows)
  const trayIcon = icon.resize({ width: 16, height: 16 })
  
  tray = new Tray(trayIcon)
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        mainWindow?.show()
      }
    },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow()
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  
  tray.setToolTip('whisperMeOff')
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
    }
  })
}

function registerGlobalHotkey(): void {
  // Load saved hotkey or use default
  const hotkey = loadHotkey()
  
  const registered = globalShortcut.register(hotkey, () => {
    console.log('[Hotkey] Triggered:', hotkey)
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
      mainWindow.webContents.send('hotkey-triggered')
    }
  })
  
  if (registered) {
    console.log('[Hotkey] Registered:', hotkey)
  } else {
    console.error('[Hotkey] Failed to register:', hotkey)
  }
  
  // IPC handlers for hotkey management
  ipcMain.handle('register-hotkey', (_, hotkey: string) => {
    try {
      globalShortcut.unregisterAll()
      
      // Validate hotkey - Electron doesn't support Meta (Windows key) in global shortcuts
      if (hotkey.includes('Meta')) {
        console.error('[Hotkey] Meta (Windows key) is not supported for global shortcuts')
        return false
      }
      
      const result = globalShortcut.register(hotkey, () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) {
            mainWindow.show()
          }
          mainWindow.webContents.send('hotkey-triggered')
        }
      })
      
      // Save the hotkey only if registration succeeded
      if (result) {
        saveHotkey(hotkey)
        console.log('[Hotkey] Registered:', hotkey)
      } else {
        console.error('[Hotkey] Failed to register:', hotkey)
      }
      
      return result
    } catch (error) {
      console.error('[Hotkey] Error:', error)
      return false
    }
  })
  
  ipcMain.handle('unregister-hotkey', () => {
    globalShortcut.unregisterAll()
    console.log('[Hotkey] Unregistered all')
    return true
  })
  
  ipcMain.handle('get-hotkey', () => {
    return loadHotkey()
  })
  
  // Open settings in new window
  ipcMain.handle('open-settings-window', () => {
    createSettingsWindow()
  })
}

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.whispermeoff')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.handle('node-version', () => {
    return process.versions.node
  })

  createWindow()
  createTray()
  createAppMenu()
  registerGlobalHotkey()
  registerWhisperHandlers()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows are closed - we have a tray
  if (process.platform !== 'darwin') {
    // Keep running in tray
  }
})

app.on('will-quit', () => {
  // Unregister all shortcuts when quitting
  globalShortcut.unregisterAll()
})
