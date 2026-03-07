/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Custom API exposed from preload
interface WhisperSettings {
  modelPath: string
  modelSize: string
  language: string
  translate: boolean
}

interface DownloadResult {
  success: boolean
  path?: string
  error?: string
}

interface SelectModelResult {
  success: boolean
  path?: string
}

interface ModelStatus {
  ready: boolean
  hasBinary: boolean
  hasModel: boolean
  binaryPath: string
  modelPath: string
}

interface TranscribeResult {
  success: boolean
  text?: string
  error?: string
}

interface SaveAudioResult {
  success: boolean
  path?: string
  error?: string
}

interface ModelSize {
  size: string
  name: string
  memory: string
}

interface WhisperApi {
  getSettings: () => Promise<WhisperSettings>
  saveSettings: (settings: Partial<WhisperSettings>) => Promise<WhisperSettings>
  getModels: () => Promise<string[]>
  getModelSizes: () => Promise<ModelSize[]>
  downloadBinary: () => Promise<DownloadResult>
  downloadModel: (modelSize: string) => Promise<DownloadResult>
  selectModel: () => Promise<SelectModelResult>
  checkModel: () => Promise<ModelStatus>
  transcribe: (audioPath: string) => Promise<TranscribeResult>
  saveAudio: (audioData: ArrayBuffer) => Promise<SaveAudioResult>
}

interface Api {
  registerHotkey: (hotkey: string) => Promise<boolean>
  unregisterHotkey: () => Promise<boolean>
  getHotkey: () => Promise<string>
  openSettingsWindow: () => Promise<void>
  onHotkeyTriggered: (callback: () => void) => () => void
  onOpenSettings: (callback: () => void) => () => void
  whisper: WhisperApi
}

declare global {
  interface Window {
    api: Api
  }
}
