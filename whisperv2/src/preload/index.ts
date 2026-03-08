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
  
  // Open URL in browser
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
   
  // Event listeners
  onHotkeyTriggered: (callback: () => void) => {
    ipcRenderer.on('hotkey-triggered', callback)
    return () => ipcRenderer.removeListener('hotkey-triggered', callback)
  },
  onHotkeyDown: (callback: () => void) => {
    ipcRenderer.on('hotkey-down', callback)
    return () => ipcRenderer.removeListener('hotkey-down', callback)
  },
  onHotkeyUp: (callback: () => void) => {
    ipcRenderer.on('hotkey-up', callback)
    return () => ipcRenderer.removeListener('hotkey-up', callback)
  },
  onHotkeyChanged: (callback: (hotkey: string) => void) => {
    ipcRenderer.on('hotkey-changed', (_, hotkey) => callback(hotkey))
    return () => ipcRenderer.removeAllListeners('hotkey-changed')
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
  },

  // Llama.cpp text processing
  llama: {
    getSettings: () => ipcRenderer.invoke('llama:get-settings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('llama:save-settings', settings),
    checkBinary: () => ipcRenderer.invoke('llama:check-binary'),
    selectModel: () => ipcRenderer.invoke('llama:select-model'),
    processText: (text: string) => ipcRenderer.invoke('llama:process-text', text),
    getModels: () => ipcRenderer.invoke('llama:get-models'),
    downloadModel: (modelId: string) => ipcRenderer.invoke('llama:download-model', modelId),
    downloadCustomModel: (modelPath: string) => ipcRenderer.invoke('llama:download-custom-model', modelPath),
    getModelsPath: () => ipcRenderer.invoke('llama:get-models-path'),
    onDownloadProgress: (callback: (progress: { status: string; progress: number; message: string }) => void) => {
      ipcRenderer.on('llama:download-progress', (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('llama:download-progress')
    }
  },

  // Clipboard - works when window is not focused
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  
  // Recording overlay
  showRecordingOverlay: () => ipcRenderer.invoke('show-recording-overlay'),
  hideRecordingOverlay: () => ipcRenderer.invoke('hide-recording-overlay'),
  showMainWindowForRecording: () => ipcRenderer.invoke('show-main-window-for-recording'),
  sendAudioLevel: (level: number) => ipcRenderer.send('audio-level', level),
  
  // Auto-paste functionality
  setPreviousWindowFocused: (focused: boolean) => ipcRenderer.invoke('set-previous-window-focused', focused),
  pasteToPreviousWindow: () => ipcRenderer.invoke('paste-to-previous-window'),
  
  // Transcription log
  transcription: {
    log: (text: string, duration?: number, model?: string, language?: string) => 
      ipcRenderer.invoke('transcription:log', text, duration, model, language),
    getAll: (limit?: number) => ipcRenderer.invoke('transcription:get-all', limit),
    get: (id: number) => ipcRenderer.invoke('transcription:get', id),
    delete: (id: number) => ipcRenderer.invoke('transcription:delete', id),
    clear: () => ipcRenderer.invoke('transcription:clear')
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
