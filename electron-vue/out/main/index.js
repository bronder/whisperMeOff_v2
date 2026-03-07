"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const fs = require("fs");
const child_process = require("child_process");
const whisper = require("@kutalia/whisper-node-addon");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
let whisperSettings = {
  modelPath: "",
  modelSize: "small",
  language: "auto",
  translate: false
};
let settingsPath;
let whisperBinPath;
function getSettingsPath() {
  if (!settingsPath) {
    const userDataPath = electron.app.getPath("userData");
    settingsPath = path__namespace.join(userDataPath, "whisper-settings.json");
  }
  return settingsPath;
}
function getWhisperBinPath() {
  if (!whisperBinPath) {
    const userWhisperPath = "C:\\Utils\\whisper.cpp\\Release\\whisper-cli.exe";
    if (fs__namespace.existsSync(userWhisperPath)) {
      whisperBinPath = userWhisperPath;
    } else {
      const userDataPath = electron.app.getPath("userData");
      whisperBinPath = path__namespace.join(userDataPath, "whisper", "whisper-cli.exe");
    }
  }
  return whisperBinPath;
}
function getDefaultModelPath() {
  const releaseModelPath = "C:\\Utils\\whisper.cpp\\Release\\models\\ggml-small.bin";
  if (fs__namespace.existsSync(releaseModelPath)) {
    return releaseModelPath;
  }
  return "";
}
function getModelsPath() {
  const userDataPath = electron.app.getPath("userData");
  return path__namespace.join(userDataPath, "whisper-models");
}
function loadSettings() {
  try {
    const settingsFile = getSettingsPath();
    if (fs__namespace.existsSync(settingsFile)) {
      const data = fs__namespace.readFileSync(settingsFile, "utf-8");
      whisperSettings = { ...whisperSettings, ...JSON.parse(data) };
      console.log("[Whisper] Settings loaded:", whisperSettings);
    }
    const defaultModel = getDefaultModelPath();
    if ((!whisperSettings.modelPath || !fs__namespace.existsSync(whisperSettings.modelPath)) && defaultModel) {
      whisperSettings.modelPath = defaultModel;
      console.log("[Whisper] Using default model:", defaultModel);
    }
  } catch (error) {
    console.error("[Whisper] Error loading settings:", error);
  }
}
function saveSettings(settings) {
  whisperSettings = { ...whisperSettings, ...settings };
  try {
    const settingsFile = getSettingsPath();
    const dir = path__namespace.dirname(settingsFile);
    if (!fs__namespace.existsSync(dir)) {
      fs__namespace.mkdirSync(dir, { recursive: true });
    }
    fs__namespace.writeFileSync(settingsFile, JSON.stringify(whisperSettings, null, 2));
    console.log("[Whisper] Settings saved:", whisperSettings);
  } catch (error) {
    console.error("[Whisper] Error saving settings:", error);
  }
}
function getModelSizes() {
  return [
    { size: "tiny", name: "tiny", memory: "~75 MB" },
    { size: "base", name: "base", memory: "~150 MB" },
    { size: "small", name: "small", memory: "~500 MB" },
    { size: "medium", name: "medium", memory: "~1.5 GB" },
    { size: "large", name: "large", memory: "~3 GB" }
  ];
}
function getAvailableModels() {
  const modelsPath = getModelsPath();
  if (!fs__namespace.existsSync(modelsPath)) {
    return [];
  }
  try {
    const files = fs__namespace.readdirSync(modelsPath);
    return files.filter((f) => f.endsWith(".bin"));
  } catch {
    return [];
  }
}
async function downloadWhisperBinary() {
  const binPath = getWhisperBinPath();
  const binDir = path__namespace.dirname(binPath);
  if (fs__namespace.existsSync(binPath)) {
    console.log("[Whisper] Binary already exists:", binPath);
    return { success: true };
  }
  if (!fs__namespace.existsSync(binDir)) {
    fs__namespace.mkdirSync(binDir, { recursive: true });
  }
  const url = "https://github.com/ggerganov/whisper.cpp/releases/download/v1.4.0/whisper-bin-win-x64.zip";
  const zipPath = path__namespace.join(binDir, "whisper-bin.zip");
  console.log("[Whisper] Downloading binary from:", url);
  return new Promise((resolve) => {
    const { spawn: spawn2 } = require("child_process");
    const curl = spawn2("curl", [
      "-L",
      "-o",
      zipPath,
      url
    ], { shell: true });
    curl.on("close", (code) => {
      if (code !== 0 || !fs__namespace.existsSync(zipPath)) {
        console.log("[Whisper] Curl failed, trying PowerShell...");
        const ps = spawn2("powershell", [
          "-Command",
          `Invoke-WebRequest -Uri '${url}' -OutFile '${zipPath}'`
        ], { shell: true });
        ps.on("close", (psCode) => {
          if (psCode !== 0) {
            resolve({ success: false, error: "Download failed. Please download whisper.exe manually." });
            return;
          }
          extractAndFinish();
        });
        ps.on("error", () => resolve({ success: false, error: "Download failed" }));
        return;
      }
      extractAndFinish();
    });
    curl.on("error", () => {
      const ps = spawn2("powershell", [
        "-Command",
        `Invoke-WebRequest -Uri '${url}' -OutFile '${zipPath}'`
      ], { shell: true });
      ps.on("close", (psCode) => {
        if (psCode !== 0) {
          resolve({ success: false, error: "Download failed. Please download whisper.exe manually." });
          return;
        }
        extractAndFinish();
      });
    });
    function extractAndFinish() {
      console.log("[Whisper] Extracting binary...");
      const unzip = spawn2("powershell", [
        "-Command",
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force`
      ], { shell: true });
      unzip.on("close", (unzipCode) => {
        try {
          if (fs__namespace.existsSync(zipPath)) fs__namespace.unlinkSync(zipPath);
        } catch {
        }
        const possiblePaths = [
          path__namespace.join(binDir, "main.exe"),
          path__namespace.join(binDir, "whisper-bin-win-x64", "main.exe"),
          path__namespace.join(binDir, "whisper", "main.exe")
        ];
        let foundPath = "";
        for (const p of possiblePaths) {
          if (fs__namespace.existsSync(p)) {
            foundPath = p;
            break;
          }
        }
        if (foundPath) {
          if (foundPath !== binPath) {
            fs__namespace.copyFileSync(foundPath, binPath);
            try {
              if (foundPath.includes("whisper-bin-win-x64")) {
                fs__namespace.rmSync(path__namespace.dirname(foundPath), { recursive: true, force: true });
              }
            } catch {
            }
          }
          console.log("[Whisper] Binary ready at:", binPath);
          resolve({ success: true });
        } else {
          console.log("[Whisper] Extraction contents:", fs__namespace.readdirSync(binDir));
          resolve({ success: false, error: "main.exe not found after extraction. Please download manually." });
        }
      });
    }
  });
}
async function downloadModel(modelSize) {
  const modelsPath = getModelsPath();
  if (!fs__namespace.existsSync(modelsPath)) {
    fs__namespace.mkdirSync(modelsPath, { recursive: true });
  }
  const modelFile = `ggml-${modelSize}.bin`;
  const modelPath = path__namespace.join(modelsPath, modelFile);
  if (fs__namespace.existsSync(modelPath)) {
    console.log("[Whisper] Model already exists:", modelPath);
    whisperSettings.modelPath = modelPath;
    saveSettings({ modelPath });
    return { success: true, path: modelPath };
  }
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${modelFile}`;
  console.log("[Whisper] Downloading model:", modelSize);
  return new Promise((resolve) => {
    const { spawn: spawn2 } = require("child_process");
    const ps = spawn2("powershell", [
      "-Command",
      `Invoke-WebRequest -Uri '${url}' -OutFile '${modelPath}'`
    ], { shell: true });
    ps.stdout.on("data", (data) => {
      console.log("[Whisper] Download progress:", data.toString().substring(0, 100));
    });
    ps.on("close", (code) => {
      if (code === 0 && fs__namespace.existsSync(modelPath)) {
        console.log("[Whisper] Model downloaded successfully");
        whisperSettings.modelPath = modelPath;
        saveSettings({ modelPath });
        resolve({ success: true, path: modelPath });
      } else {
        resolve({ success: false, error: `Download failed with code ${code}` });
      }
    });
    ps.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}
async function transcribeAudio(audioPath) {
  try {
    const modelPath = whisperSettings.modelPath || getDefaultModelPath();
    if (!modelPath || !fs__namespace.existsSync(modelPath)) {
      throw new Error("Model not found. Please check Settings.");
    }
    console.log("[Whisper] Using model:", modelPath);
    console.log("[Whisper] Transcribing audio:", audioPath);
    let inputPath = audioPath;
    if (audioPath.toLowerCase().endsWith(".webm")) {
      const wavPath = audioPath.replace(".webm", ".wav");
      console.log("[Whisper] Converting webm to wav...");
      await new Promise((resolve, reject) => {
        const ffmpeg = child_process.spawn("ffmpeg", [
          "-i",
          audioPath,
          "-ar",
          "16000",
          "-ac",
          "1",
          "-c:a",
          "pcm_s16le",
          "-y",
          wavPath
        ], { shell: true });
        ffmpeg.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error("ffmpeg failed"));
        });
        ffmpeg.on("error", reject);
      });
      inputPath = wavPath;
    }
    console.log("[Whisper] Calling whisper.transcribe with GPU...");
    const result = await whisper.transcribe({
      fname_inp: inputPath,
      model: modelPath,
      language: whisperSettings.language === "auto" ? "auto" : whisperSettings.language,
      use_gpu: true,
      // Enable GPU (Vulkan on AMD!)
      n_threads: 8,
      // Output options - get plain text without timestamps
      output_txt: true,
      print_special: false,
      print_progress: false
    });
    console.log("[Whisper] Raw result type:", typeof result);
    console.log("[Whisper] Raw result:", JSON.stringify(result, null, 2));
    let text = "";
    if (result?.transcription && Array.isArray(result.transcription) && result.transcription.length > 0) {
      text = result.transcription.map((segment) => {
        return segment[2] || "";
      }).join(" ").trim();
    } else if (typeof result === "string") {
      text = result;
    } else if (result?.text) {
      text = result.text;
    }
    console.log("[Whisper] Final text:", text);
    return text;
  } catch (error) {
    console.error("[Whisper] Transcription error:", error);
    throw new Error(error.message || "Transcription failed");
  }
}
function registerWhisperHandlers() {
  loadSettings();
  electron.ipcMain.handle("whisper:get-settings", () => {
    return whisperSettings;
  });
  electron.ipcMain.handle("whisper:save-settings", (_, settings) => {
    saveSettings(settings);
    return whisperSettings;
  });
  electron.ipcMain.handle("whisper:get-models", () => {
    return getAvailableModels();
  });
  electron.ipcMain.handle("whisper:get-model-sizes", () => {
    return getModelSizes();
  });
  electron.ipcMain.handle("whisper:download-binary", async () => {
    return await downloadWhisperBinary();
  });
  electron.ipcMain.handle("whisper:download-model", async (_, modelSize) => {
    return await downloadModel(modelSize);
  });
  electron.ipcMain.handle("whisper:select-model", async () => {
    const result = await electron.dialog.showOpenDialog({
      title: "Select Whisper Model",
      defaultPath: getModelsPath(),
      filters: [
        { name: "Whisper Model", extensions: ["bin"] }
      ],
      properties: ["openFile"]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const modelPath = result.filePaths[0];
      whisperSettings.modelPath = modelPath;
      saveSettings({ modelPath });
      return { success: true, path: modelPath };
    }
    return { success: false };
  });
  electron.ipcMain.handle("whisper:check-model", () => {
    const hasBinary = fs__namespace.existsSync(getWhisperBinPath());
    const hasModel = whisperSettings.modelPath && fs__namespace.existsSync(whisperSettings.modelPath);
    return {
      ready: hasBinary && hasModel,
      hasBinary,
      hasModel,
      binaryPath: getWhisperBinPath(),
      modelPath: whisperSettings.modelPath
    };
  });
  electron.ipcMain.handle("whisper:transcribe", async (_, audioPath) => {
    try {
      console.log("[Whisper] Starting transcription for:", audioPath);
      if (!fs__namespace.existsSync(audioPath)) {
        throw new Error("Audio file not found");
      }
      const result = await transcribeAudio(audioPath);
      return { success: true, text: result };
    } catch (error) {
      console.error("[Whisper] Transcription error:", error);
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("whisper:save-audio", async (_, audioData) => {
    try {
      const tempDir = electron.app.getPath("temp");
      const audioPath = path__namespace.join(tempDir, `whisper_${Date.now()}.webm`);
      fs__namespace.writeFileSync(audioPath, Buffer.from(audioData));
      console.log("[Whisper] Audio saved to:", audioPath);
      return { success: true, path: audioPath };
    } catch (error) {
      console.error("[Whisper] Error saving audio:", error);
      return { success: false, error: error.message };
    }
  });
  console.log("[Whisper] IPC handlers registered");
}
let mainWindow = null;
let settingsWindow = null;
let tray = null;
let isQuitting = false;
let currentHotkey = "CommandOrControl+Shift+R";
function getHotkeyPath() {
  return path.join(electron.app.getPath("userData"), "hotkey.txt");
}
function loadHotkey() {
  const defaultHotkey = "CommandOrControl+Shift+R";
  try {
    const path2 = getHotkeyPath();
    if (fs__namespace.existsSync(path2)) {
      const saved = fs__namespace.readFileSync(path2, "utf-8").trim();
      if (saved && saved !== defaultHotkey && !saved.includes("Meta")) {
        try {
          if (electron.globalShortcut.register(saved, () => {
          })) {
            electron.globalShortcut.unregister(saved);
            currentHotkey = saved;
            return saved;
          }
        } catch (e) {
          console.log("[Hotkey] Saved hotkey invalid, using default");
        }
      }
    }
  } catch (e) {
    console.error("[Hotkey] Error loading hotkey:", e);
  }
  currentHotkey = defaultHotkey;
  return defaultHotkey;
}
function saveHotkey(hotkey) {
  try {
    fs__namespace.writeFileSync(getHotkeyPath(), hotkey);
    currentHotkey = hotkey;
  } catch (e) {
    console.error("[Hotkey] Error saving hotkey:", e);
  }
}
function createWindow() {
  const iconPath = path.join(__dirname, "../../../flatrobot.ico");
  console.log("[Icon] Window icon path:", iconPath);
  const icon = electron.nativeImage.createFromPath(iconPath);
  console.log("[Icon] Window icon size:", icon.getSize());
  mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: false,
    icon,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  const iconPath = path.join(__dirname, "../../../flatrobot.ico");
  const icon = electron.nativeImage.createFromPath(iconPath);
  settingsWindow = new electron.BrowserWindow({
    width: 550,
    height: 500,
    minWidth: 400,
    minHeight: 400,
    show: false,
    resizable: true,
    icon,
    parent: mainWindow || void 0,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.on("ready-to-show", () => {
    settingsWindow?.show();
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    settingsWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}?settings=true`);
  } else {
    settingsWindow.loadFile(path.join(__dirname, "../renderer/index.html"), { query: { settings: "true" } });
  }
}
function createAppMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            createSettingsWindow();
          }
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: "Alt+F4",
          click: () => {
            isQuitting = true;
            electron.app.quit();
          }
        }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About whisperMeOff",
          click: () => {
            const { dialog } = require("electron");
            dialog.showMessageBox({
              type: "info",
              title: "About whisperMeOff",
              message: "whisperMeOff v1.0.0",
              detail: "Voice transcription app using Whisper AI.\n\nPress Ctrl+Shift+R to start/stop recording."
            });
          }
        }
      ]
    }
  ];
  const menu = electron.Menu.buildFromTemplate(template);
  electron.Menu.setApplicationMenu(menu);
}
function createTray() {
  const iconPath = path.join(__dirname, "../../../flatrobot.ico");
  console.log("[Tray] Icon path:", iconPath);
  const icon = electron.nativeImage.createFromPath(iconPath);
  console.log("[Tray] Icon size:", icon.getSize());
  const trayIcon = icon.resize({ width: 16, height: 16 });
  tray = new electron.Tray(trayIcon);
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        mainWindow?.show();
      }
    },
    {
      label: "Settings",
      click: () => {
        createSettingsWindow();
      }
    },
    { type: "separator" },
    {
      label: "Exit",
      click: () => {
        isQuitting = true;
        electron.app.quit();
      }
    }
  ]);
  tray.setToolTip("whisperMeOff");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}
function registerGlobalHotkey() {
  const hotkey = loadHotkey();
  const registered = electron.globalShortcut.register(hotkey, () => {
    console.log("[Hotkey] Triggered:", hotkey);
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.webContents.send("hotkey-triggered");
    }
  });
  if (registered) {
    console.log("[Hotkey] Registered:", hotkey);
  } else {
    console.error("[Hotkey] Failed to register:", hotkey);
  }
  electron.ipcMain.handle("register-hotkey", (_, hotkey2) => {
    try {
      electron.globalShortcut.unregisterAll();
      if (hotkey2.includes("Meta")) {
        console.error("[Hotkey] Meta (Windows key) is not supported for global shortcuts");
        return false;
      }
      const result = electron.globalShortcut.register(hotkey2, () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.webContents.send("hotkey-triggered");
        }
      });
      if (result) {
        saveHotkey(hotkey2);
        console.log("[Hotkey] Registered:", hotkey2);
      } else {
        console.error("[Hotkey] Failed to register:", hotkey2);
      }
      return result;
    } catch (error) {
      console.error("[Hotkey] Error:", error);
      return false;
    }
  });
  electron.ipcMain.handle("unregister-hotkey", () => {
    electron.globalShortcut.unregisterAll();
    console.log("[Hotkey] Unregistered all");
    return true;
  });
  electron.ipcMain.handle("get-hotkey", () => {
    return loadHotkey();
  });
  electron.ipcMain.handle("open-settings-window", () => {
    createSettingsWindow();
  });
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.whispermeoff");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.handle("node-version", () => {
    return process.versions.node;
  });
  createWindow();
  createTray();
  createAppMenu();
  registerGlobalHotkey();
  registerWhisperHandlers();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") ;
});
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
});
