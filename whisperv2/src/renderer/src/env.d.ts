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

interface LlamaSettings {
  enabled: boolean
  modelPath: string
  modelId: string
}

interface LlamaProcessResult {
  success: boolean
  formattedText?: string
  error?: string
}

interface LlamaModel {
  id: string
  name: string
  size: string
  memory: string
  description: string
  url: string
}

interface LlamaApi {
  getSettings: () => Promise<LlamaSettings>
  saveSettings: (settings: Partial<LlamaSettings>) => Promise<LlamaSettings>
  checkBinary: () => Promise<boolean>
  selectModel: () => Promise<SelectModelResult>
  processText: (text: string) => Promise<LlamaProcessResult>
  getModels: () => Promise<LlamaModel[]>
  downloadModel: (modelId: string) => Promise<{ success: boolean; path?: string; error?: string }>
  downloadCustomModel: (modelPath: string) => Promise<{ success: boolean; path?: string; error?: string }>
  getModelsPath: () => Promise<string>
}

interface TranscriptionRecord {
  id: number
  text: string
  timestamp: string
  duration: number | null
  model: string | null
  language: string | null
}

interface TranscriptionApi {
  log: (text: string, duration?: number, model?: string, language?: string) => Promise<number>
  getAll: (limit?: number) => Promise<TranscriptionRecord[]>
  get: (id: number) => Promise<TranscriptionRecord | null>
  delete: (id: number) => Promise<boolean>
  clear: () => Promise<boolean>
}

interface Api {
  registerHotkey: (hotkey: string) => Promise<boolean>
  unregisterHotkey: () => Promise<boolean>
  getHotkey: () => Promise<string>
  openSettingsWindow: () => Promise<void>
  openExternal: (url: string) => Promise<void>
  onHotkeyTriggered: (callback: () => void) => () => void
  onHotkeyDown: (callback: () => void) => () => void
  onHotkeyUp: (callback: () => void) => () => void
  onHotkeyChanged: (callback: (hotkey: string) => void) => () => void
  onOpenSettings: (callback: () => void) => () => void
  copyToClipboard: (text: string) => Promise<boolean>
  whisper: WhisperApi
  llama: LlamaApi
  transcription: TranscriptionApi
}

declare global {
  interface Window {
    api: Api
  }
}
