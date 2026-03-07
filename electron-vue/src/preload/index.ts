import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Hotkey management
  registerHotkey: (hotkey: string) => ipcRenderer.invoke('register-hotkey', hotkey),
  unregisterHotkey: () => ipcRenderer.invoke('unregister-hotkey'),
  getHotkey: () => ipcRenderer.invoke('get-hotkey'),
  
  // Settings window
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  
  // Event listeners
  onHotkeyTriggered: (callback: () => void) => {
    ipcRenderer.on('hotkey-triggered', callback)
    return () => ipcRenderer.removeListener('hotkey-triggered', callback)
  },
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', callback)
    return () => ipcRenderer.removeListener('open-settings', callback)
  },
  
  // Whisper transcription (using bundled whisper.cpp binary)
  whisper: {
    getSettings: () => ipcRenderer.invoke('whisper:get-settings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('whisper:save-settings', settings),
    getModels: () => ipcRenderer.invoke('whisper:get-models'),
    getModelSizes: () => ipcRenderer.invoke('whisper:get-model-sizes'),
    downloadBinary: () => ipcRenderer.invoke('whisper:download-binary'),
    downloadModel: (modelSize: string) => ipcRenderer.invoke('whisper:download-model', modelSize),
    selectModel: () => ipcRenderer.invoke('whisper:select-model'),
    checkModel: () => ipcRenderer.invoke('whisper:check-model'),
    transcribe: (audioPath: string) => ipcRenderer.invoke('whisper:transcribe', audioPath),
    saveAudio: (audioData: ArrayBuffer) => ipcRenderer.invoke('whisper:save-audio', audioData)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
