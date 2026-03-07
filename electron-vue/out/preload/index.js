"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  // Hotkey management
  registerHotkey: (hotkey) => electron.ipcRenderer.invoke("register-hotkey", hotkey),
  unregisterHotkey: () => electron.ipcRenderer.invoke("unregister-hotkey"),
  getHotkey: () => electron.ipcRenderer.invoke("get-hotkey"),
  // Settings window
  openSettingsWindow: () => electron.ipcRenderer.invoke("open-settings-window"),
  // Event listeners
  onHotkeyTriggered: (callback) => {
    electron.ipcRenderer.on("hotkey-triggered", callback);
    return () => electron.ipcRenderer.removeListener("hotkey-triggered", callback);
  },
  onOpenSettings: (callback) => {
    electron.ipcRenderer.on("open-settings", callback);
    return () => electron.ipcRenderer.removeListener("open-settings", callback);
  },
  // Whisper transcription (using bundled whisper.cpp binary)
  whisper: {
    getSettings: () => electron.ipcRenderer.invoke("whisper:get-settings"),
    saveSettings: (settings) => electron.ipcRenderer.invoke("whisper:save-settings", settings),
    getModels: () => electron.ipcRenderer.invoke("whisper:get-models"),
    getModelSizes: () => electron.ipcRenderer.invoke("whisper:get-model-sizes"),
    downloadBinary: () => electron.ipcRenderer.invoke("whisper:download-binary"),
    downloadModel: (modelSize) => electron.ipcRenderer.invoke("whisper:download-model", modelSize),
    selectModel: () => electron.ipcRenderer.invoke("whisper:select-model"),
    checkModel: () => electron.ipcRenderer.invoke("whisper:check-model"),
    transcribe: (audioPath) => electron.ipcRenderer.invoke("whisper:transcribe", audioPath),
    saveAudio: (audioData) => electron.ipcRenderer.invoke("whisper:save-audio", audioData)
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
