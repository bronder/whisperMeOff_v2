import { app, shell, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage, clipboard } from 'electron'
import { join } from 'path'
import { registerWhisperHandlers } from './whisperService'
import * as fs from 'fs'
import { uIOhook } from 'uiohook-napi'
import { 
  initTranscriptionLog, 
  logTranscription, 
  getTranscriptions, 
  getTranscription,
  deleteTranscription,
  clearTranscriptions,
  closeTranscriptionLog,
  TranscriptionRecord 
} from './transcriptionLog'

// Check if running in development mode
const isDev = process.env.NODE_ENV !== 'production'

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let recordingOverlay: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let currentHotkey = 'CommandOrControl+Shift+R'
let previousWindowFocused: boolean = false

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
      if (saved && !saved.includes('Meta')) {
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

// Track if a window was focused before we show ours
function setPreviousWindowFocused(focused: boolean): void {
  previousWindowFocused = focused
}

// Track if main window was visible before recording started
let mainWindowWasVisible = false

// Paste to the previously focused window using Windows API
function pasteToPreviousWindow(): void {
  if (!previousWindowFocused) {
    console.log('[Paste] No previous window to paste to')
    return
  }
   
  const { exec } = require('child_process')
  const { clipboard } = require('electron')
  const fs = require('fs')
  const path = require('path')
  
  console.log('[Paste] Starting paste process...')
  
  // 1. Save existing clipboard content so we can restore it
  const previousClipboard = clipboard.readText()
  
  // 2. Write the transcribed text to clipboard (already done before calling this)
  
  // 3. Only hide the window if it was hidden before recording started
  // This way, if the user had the main window visible, it stays visible
  if (mainWindow && !mainWindowWasVisible) {
    mainWindow.hide()
  }
  
  // 4. Simulate Ctrl+V using Windows API via PowerShell - more reliable than SendKeys
  const tempDir = require('os').tmpdir()
  const scriptPath = path.join(tempDir, 'paste_script.ps1')
    
    // Using Windows API keybd_event which is more reliable
    const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KeySim {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public const byte VK_CONTROL = 0x11;
    public const byte VK_V = 0x56;
    public const uint KEYEVENTF_KEYDOWN = 0x0000;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public static void SendCtrlV() {
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
        keybd_event(VK_V, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
        keybd_event(VK_V, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@
[KeySim]::SendCtrlV()
`
    
    fs.writeFileSync(scriptPath, psScript, 'utf8')
    
    exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error: Error | null) => {
      // Clean up temp file
      try {
        fs.unlinkSync(scriptPath)
      } catch (e) {}
      
      if (error) {
        console.error('[Paste] Error pasting:', error)
      } else {
        console.log('[Paste] Sent Ctrl+V to previous window')
      }
      
      // 6. Restore old clipboard
      clipboard.writeText(previousClipboard)
      console.log('[Paste] Restored clipboard')
    })
}

function createWindow(): void {
  // Get the path to the icon - icon is in project root, not whisperv2
  const iconPath = join(__dirname, '../../../flatrobot.ico')
  console.log('[Icon] Window icon path:', iconPath)
  
  // Load the icon
  const icon = nativeImage.createFromPath(iconPath)
  console.log('[Icon] Window icon size:', icon.getSize())
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
    title: 'whisperMeOff',
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
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showMainWindowWithSettings(): void {
  // Show and focus the main window
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.show()
    mainWindow.focus()
    
    // Send message to renderer to show settings
    mainWindow.webContents.send('open-settings')
  }
}

function createSettingsWindow(): void {
  // Now use the same approach - show main window with settings
  showMainWindowWithSettings()
}

function createRecordingOverlay(): void {
  if (recordingOverlay) {
    recordingOverlay.focus()
    return
  }
  
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const width: number = primaryDisplay.workAreaSize.width
  const height: number = primaryDisplay.workAreaSize.height
  
  recordingOverlay = new BrowserWindow({
    width: 216,
    height: 60,
    x: Math.round((width - 216) / 2),
    y: height - 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  
  recordingOverlay.on('closed', () => {
    recordingOverlay = null
  })
  
  // Simple recording indicator with blinking red dot
  const overlayHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: transparent;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          overflow: hidden;
        }
        .overlay-container {
          background: rgba(0, 0, 0, 0.7);
          border-radius: 30px;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .recording-dot {
          width: 14px;
          height: 14px;
          background: #ef4444;
          border-radius: 50%;
          animation: blink 1s ease-in-out infinite;
          box-shadow: 0 0 10px #ef4444;
        }
        .recording-text {
          color: white;
          font-size: 17px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      </style>
    </head>
    <body>
      <div class="overlay-container">
        <div class="recording-dot"></div>
        <span class="recording-text">Recording</span>
      </div>
    </body>
    </html>
  `
  
  recordingOverlay.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml)}`)
}

function showRecordingOverlay(): void {
  // Track if main window was visible before recording starts
  mainWindowWasVisible = mainWindow?.isVisible() || false
  
  if (!recordingOverlay) {
    createRecordingOverlay()
  }
  recordingOverlay?.show()
}

function hideRecordingOverlay(): void {
  recordingOverlay?.hide()
}

function sendAudioLevel(level: number): void {
  if (recordingOverlay && !recordingOverlay.isDestroyed()) {
    recordingOverlay.webContents.send('audio-level', level)
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
  // Use the app icon for tray - works in both dev and production
  let iconPath: string = ''
  const fs = require('fs')
  
  if (app.isPackaged) {
    // In production, the icon is in the app.asar
    // Try multiple possible locations
    const possiblePaths = [
      join(process.resourcesPath, 'app.asar', 'flatrobot.ico'),
      join(app.getAppPath(), 'flatrobot.ico'),
      join(app.getPath('exe'), '..', 'resources', 'app.asar', 'flatrobot.ico')
    ]
    
    for (const p of possiblePaths) {
      console.log('[Tray] Checking path:', p)
      if (fs.existsSync(p)) {
        iconPath = p
        break
      }
    }
    
    if (!iconPath) {
      iconPath = possiblePaths[0]
    }
  } else {
    // In development
    iconPath = join(__dirname, '../../flatrobot.ico')
  }
  
  console.log('[Tray] Icon path:', iconPath)
  
  let icon = nativeImage.createFromPath(iconPath)
  
  // If icon not found, create empty icon
  if (icon.isEmpty()) {
    console.log('[Tray] Icon not found, using default')
    // Create a simple 16x16 icon
    icon = nativeImage.createEmpty()
  }
  
  console.log('[Tray] Icon size:', icon.getSize())
  
  // Resize for tray (16x16 on Windows)
  const trayIcon = icon.isEmpty() ? icon : icon.resize({ width: 16, height: 16 })
  
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
  
  // Parse the hotkey to get the key name (e.g., "CommandOrControl+Shift+R" -> "R")
  const hotkeyKey = hotkey.split('+').pop() || ''
  
  // Map key names to uiohook key codes
  const keyMap: Record<string, number> = {
    'a': 30, 'b': 48, 'c': 46, 'd': 32, 'e': 18, 'f': 33, 'g': 34, 'h': 35,
    'i': 23, 'j': 36, 'k': 37, 'l': 38, 'm': 50, 'n': 49, 'o': 24, 'p': 25,
    'q': 16, 'r': 19, 's': 31, 't': 20, 'u': 22, 'v': 47, 'w': 17, 'x': 45,
    'y': 21, 'z': 44,
    '0': 11, '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 7, '7': 8, '8': 9, '9': 10,
    'f1': 59, 'f2': 60, 'f3': 61, 'f4': 62, 'f5': 63, 'f6': 64, 'f7': 65, 'f8': 66,
    'f9': 67, 'f10': 68, 'f11': 87, 'f12': 88,
    'space': 57, 'enter': 28, 'tab': 15, 'backspace': 14, 'delete': 3667,
    'escape': 1, 'esc': 1
  }
  const keyCode = keyMap[hotkeyKey.toLowerCase()] || null
  
  // Parse hotkey to determine required modifiers
  const hotkeyParts = hotkey.split('+')
  const modifiers = hotkeyParts.slice(0, -1).map(m => m.toLowerCase())
  const requiresCtrl = modifiers.includes('control') || modifiers.includes('ctrl')
  const requiresShift = modifiers.includes('shift')
  const requiresAlt = modifiers.includes('alt')
  
  // Track modifier key states
  let ctrlPressed = false
  let shiftPressed = false
  let altPressed = false
  let isHotkeyPressed = false
  
  if (keyCode) {
    try {
      uIOhook.on('keydown', (e: any) => {
        // Track modifier key states - CORRECT keycode mapping:
        // Keycode 29 = Left Ctrl, Keycode 42 = Left Shift, Keycode 56 = Left Alt
        if (e.keycode === 29) ctrlPressed = true      // Left Ctrl
        if (e.keycode === 3617) ctrlPressed = true   // Right Ctrl
        if (e.keycode === 42) shiftPressed = true    // Left Shift
        if (e.keycode === 3640) shiftPressed = true  // Right Shift
        if (e.keycode === 56) altPressed = true      // Left Alt
        if (e.keycode === 3618) altPressed = true    // Right Alt
        
        // Check for hotkey with required modifiers
        if (e.keycode === keyCode && !isHotkeyPressed) {
          // Validate required modifiers
          const ctrlMatch = !requiresCtrl || ctrlPressed
          const shiftMatch = !requiresShift || shiftPressed
          const altMatch = !requiresAlt || altPressed
          
          if (ctrlMatch && shiftMatch && altMatch) {
            isHotkeyPressed = true
            // Note: e.preventDefault() can cause crashes with uIOhook, so we skip it
            if (mainWindow) {
              mainWindow.webContents.send('hotkey-down')
            }
          }
        }
      })
      
      uIOhook.on('keyup', (e: any) => {
        // Reset modifier key states - CORRECT keycode mapping
        if (e.keycode === 29) ctrlPressed = false      // Left Ctrl
        if (e.keycode === 3617) ctrlPressed = false   // Right Ctrl
        if (e.keycode === 42) shiftPressed = false    // Left Shift
        if (e.keycode === 3640) shiftPressed = false  // Right Shift
        if (e.keycode === 56) altPressed = false      // Left Alt
        if (e.keycode === 3618) altPressed = false    // Right Alt
        
        if (e.keycode === keyCode && isHotkeyPressed) {
          isHotkeyPressed = false
          // Note: e.preventDefault() can cause crashes with uIOhook, so we skip it
          if (mainWindow) {
            mainWindow.webContents.send('hotkey-up')
          }
        }
      })
      
      uIOhook.start()
      console.log('[Uiohook] Started on app startup for push-to-talk')
    } catch (error) {
      console.error('[Uiohook] Failed to start on startup:', error)
    }
  }
  
  // Note: We don't use globalShortcut for push-to-talk - uIOhook handles it
  console.log('[Hotkey] Using uIOhook for push-to-talk')
}

// Register IPC handlers for hotkey management
function registerHotkeyHandlers(): void {
  // Track if hotkey is currently pressed for hold-to-talk
  let isHotkeyPressed = false
  let currentHotkeyKeyCode: number | null = null
  let previousKeyCode: number | null = null
  let isUiohookSetup = false
  
  // Track modifier keys state
  let ctrlPressed = false
  let shiftPressed = false
  let altPressed = false
  
  // Required modifiers for the hotkey
  let requiresCtrl = false
  let requiresShift = false
  let requiresAlt = false
  
  // Map key names to uiohook key codes using UiohookKey enum values
  function getUiohookKeyCode(keyName: string): number | null {
    const keyMap: Record<string, number> = {
      // Letters (uIOhook key codes)
      'a': 30, 'b': 48, 'c': 46, 'd': 32, 'e': 18, 'f': 33, 'g': 34, 'h': 35,
      'i': 23, 'j': 36, 'k': 37, 'l': 38, 'm': 50, 'n': 49, 'o': 24, 'p': 25,
      'q': 16, 'r': 19, 's': 31, 't': 20, 'u': 22, 'v': 47, 'w': 17, 'x': 45,
      'y': 21, 'z': 44,
      // Numbers
      '0': 11, '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 7, '7': 8, '8': 9, '9': 10,
      // Function keys
      'f1': 59, 'f2': 60, 'f3': 61, 'f4': 62, 'f5': 63, 'f6': 64, 'f7': 65, 'f8': 66,
      'f9': 67, 'f10': 68, 'f11': 87, 'f12': 88,
      // Special keys
      'space': 57, 'enter': 28, 'tab': 15, 'backspace': 14, 'delete': 3667,
      'escape': 1, 'esc': 1,
      // Modifiers
      'control': 29, 'ctrl': 29, 'shift': 56, 'alt': 56
    }
    return keyMap[keyName.toLowerCase()] || null
  }
   
  // Set up uiohook for global key tracking
  function setupUiohook() {
    // Don't set up if no hotkey is configured yet
    if (!currentHotkeyKeyCode) {
      console.log('[Uiohook] No hotkey keycode configured yet')
      return
    }
    
    // If already set up with same keycode, skip
    if (isUiohookSetup && previousKeyCode === currentHotkeyKeyCode) {
      console.log('[Uiohook] Already set up with same keycode, skipping')
      return
    }
    
    // If keycode changed, need to re-setup
    if (isUiohookSetup) {
      console.log('[Uiohook] Keycode changed, re-setting up...')
      try {
        uIOhook.stop()
      } catch (e) {
        console.log('[Uiohook] Stop error (may not be running):', e)
      }
      isUiohookSetup = false
    }
    
    try {
      // Track modifier keys - CORRECT keycode mapping:
      // Keycode 29 = Left Ctrl, Keycode 42 = Left Shift, Keycode 56 = Left Alt
      uIOhook.on('keydown', (e: any) => {
        // Track modifier states
        if (e.keycode === 29) ctrlPressed = true   // Left Ctrl
        if (e.keycode === 3617) ctrlPressed = true  // Right Ctrl  
        if (e.keycode === 42) shiftPressed = true   // Left Shift
        if (e.keycode === 3640) shiftPressed = true // Right Shift
        if (e.keycode === 56) altPressed = true     // Left Alt
        if (e.keycode === 3618) altPressed = true   // Right Alt
        
        // Check for hotkey with modifiers
        if (e.keycode === currentHotkeyKeyCode && !isHotkeyPressed) {
          const ctrlMatch = !requiresCtrl || ctrlPressed
          const shiftMatch = !requiresShift || shiftPressed
          const altMatch = !requiresAlt || altPressed
          
          if (ctrlMatch && shiftMatch && altMatch) {
            isHotkeyPressed = true
            // Note: e.preventDefault() can cause crashes with uIOhook
            if (mainWindow) {
              mainWindow.webContents.send('hotkey-down')
            }
          }
        }
      })
      
      uIOhook.on('keyup', (e: any) => {
        // Reset modifier states - CORRECT keycode mapping
        if (e.keycode === 29) ctrlPressed = false   // Left Ctrl
        if (e.keycode === 3617) ctrlPressed = false // Right Ctrl
        if (e.keycode === 42) shiftPressed = false  // Left Shift
        if (e.keycode === 3640) shiftPressed = false
        if (e.keycode === 56) altPressed = false    // Left Alt
        if (e.keycode === 3618) altPressed = false
        
        if (e.keycode === currentHotkeyKeyCode && isHotkeyPressed) {
          isHotkeyPressed = false
          // Note: e.preventDefault() can cause crashes with uIOhook
          if (mainWindow) {
            mainWindow.webContents.send('hotkey-up')
          }
        }
      })
      
      uIOhook.start()
      isUiohookSetup = true
      previousKeyCode = currentHotkeyKeyCode
      console.log('[Uiohook] Started global keyboard hook')
    } catch (error) {
      console.error('[Uiohook] Failed to start:', error)
    }
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
      
      // Update current hotkey
      currentHotkey = hotkey
      
      // Parse the hotkey to get modifiers and key name
      const parts = hotkey.split('+')
      const hotkeyKey = parts.pop() || ''
      
      // Check which modifiers are required
      const modifiers = parts.map(m => m.toLowerCase())
      requiresCtrl = modifiers.includes('control') || modifiers.includes('ctrl')
      requiresShift = modifiers.includes('shift')
      requiresAlt = modifiers.includes('alt')
      
      // Store required modifiers for validation
      currentHotkeyKeyCode = getUiohookKeyCode(hotkeyKey)
      
      console.log(`[Hotkey] Registered: ${hotkey}, requires: ctrl=${requiresCtrl}, shift=${requiresShift}, alt=${requiresAlt}`)
      
      // Start uiohook for push-to-talk (handles both keydown and keyup)
      setupUiohook()
      
      // For push-to-talk, we rely solely on uIOhook for key events
      // globalShortcut is not needed and can cause duplicate events
      const result = true
      
      // Save the hotkey only if registration succeeded
      if (result) {
        saveHotkey(hotkey)
        // Notify renderer to update hotkey display
        mainWindow?.webContents.send('hotkey-changed', hotkey)
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
  
  // Recording overlay controls
  ipcMain.handle('show-recording-overlay', () => {
    showRecordingOverlay()
    return true
  })
  
  ipcMain.handle('hide-recording-overlay', () => {
    hideRecordingOverlay()
    return true
  })
  
  ipcMain.on('audio-level', (_, level: number) => {
    sendAudioLevel(level)
  })
}

app.whenReady().then(async () => {
  // Initialize transcription log database
  await initTranscriptionLog()
  
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.whispermeoff')
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    // Watch window shortcuts - simplified version
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown') {
        // F12 to toggle DevTools
        if (input.key === 'F12') {
          window.webContents.toggleDevTools()
          event.preventDefault()
        }
        // Ctrl+R to reload (only in dev)
        if (input.control && input.key.toLowerCase() === 'r' && isDev) {
          window.webContents.reload()
          event.preventDefault()
        }
      }
    })
  })

  // IPC test
  ipcMain.handle('node-version', () => {
    return process.versions.node
  })

  // Clipboard handler - works even when window is not focused
  ipcMain.handle('copy-to-clipboard', (_, text: string) => {
    clipboard.writeText(text)
    return true
  })
  
  // Track previous window state before recording starts
  ipcMain.handle('set-previous-window-focused', (_, focused: boolean) => {
    previousWindowFocused = focused
    console.log('[Window] Previous window focused:', focused)
    return true
  })
  
  // Paste to previous window after transcription
  ipcMain.handle('paste-to-previous-window', () => {
    pasteToPreviousWindow()
    return true
  })

  // Transcription log handlers
  ipcMain.handle('transcription:log', (_, text: string, duration?: number, model?: string, language?: string) => {
    return logTranscription(text, duration, model, language)
  })

  ipcMain.handle('transcription:get-all', (_, limit?: number) => {
    return getTranscriptions(limit)
  })

  ipcMain.handle('transcription:get', (_, id: number) => {
    return getTranscription(id)
  })

  ipcMain.handle('transcription:delete', (_, id: number) => {
    return deleteTranscription(id)
  })

  ipcMain.handle('transcription:clear', () => {
    return clearTranscriptions()
  })
 
  createWindow()
  createTray()
  createAppMenu()
  registerGlobalHotkey()
  registerWhisperHandlers()
  registerHotkeyHandlers()

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
  // Close transcription log database
  closeTranscriptionLog()
})
