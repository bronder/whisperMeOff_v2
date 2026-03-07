import { ipcMain, app, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'

// Import kutalia whisper for GPU acceleration
import whisper from '@kutalia/whisper-node-addon'

interface WhisperSettings {
  modelPath: string
  modelSize: string
  language: string
  translate: boolean
  pushToTalk: boolean
}

// Default settings
let whisperSettings: WhisperSettings = {
  modelPath: '',
  modelSize: 'small',
  language: 'auto',
  translate: false,
  pushToTalk: false
}

let settingsPath: string
let whisperBinPath: string

function getSettingsPath(): string {
  if (!settingsPath) {
    const userDataPath = app.getPath('userData')
    settingsPath = path.join(userDataPath, 'whisper-settings.json')
  }
  return settingsPath
}

function getWhisperBinPath(): string {
  if (!whisperBinPath) {
    // First check if user has their own whisper.cpp build
    const userWhisperPath = 'C:\\Utils\\whisper.cpp\\Release\\whisper-cli.exe'
    if (fs.existsSync(userWhisperPath)) {
      whisperBinPath = userWhisperPath
    } else {
      const userDataPath = app.getPath('userData')
      whisperBinPath = path.join(userDataPath, 'whisper', 'whisper-cli.exe')
    }
  }
  return whisperBinPath
}

function getDefaultModelPath(): string {
  // Use the model from whisper.cpp release folder if available
  const releaseModelPath = 'C:\\Utils\\whisper.cpp\\Release\\models\\ggml-small.bin'
  if (fs.existsSync(releaseModelPath)) {
    return releaseModelPath
  }
  return ''
}

function getModelsPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'whisper-models')
}

// Load settings from file
function loadSettings(): void {
  try {
    const settingsFile = getSettingsPath()
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf-8')
      whisperSettings = { ...whisperSettings, ...JSON.parse(data) }
      console.log('[Whisper] Settings loaded:', whisperSettings)
    }
    
    // If no model configured OR saved model doesn't exist, try to use default
    const defaultModel = getDefaultModelPath()
    if ((!whisperSettings.modelPath || !fs.existsSync(whisperSettings.modelPath)) && defaultModel) {
      whisperSettings.modelPath = defaultModel
      console.log('[Whisper] Using default model:', defaultModel)
    }
  } catch (error) {
    console.error('[Whisper] Error loading settings:', error)
  }
}

// Save settings to file
function saveSettings(settings: Partial<WhisperSettings>): void {
  whisperSettings = { ...whisperSettings, ...settings }
  try {
    const settingsFile = getSettingsPath()
    const dir = path.dirname(settingsFile)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(settingsFile, JSON.stringify(whisperSettings, null, 2))
    console.log('[Whisper] Settings saved:', whisperSettings)
  } catch (error) {
    console.error('[Whisper] Error saving settings:', error)
  }
}

// Get model sizes info
function getModelSizes(): { size: string; name: string; memory: string }[] {
  return [
    { size: 'tiny', name: 'tiny', memory: '~75 MB' },
    { size: 'base', name: 'base', memory: '~150 MB' },
    { size: 'small', name: 'small', memory: '~500 MB' },
    { size: 'medium', name: 'medium', memory: '~1.5 GB' },
    { size: 'large', name: 'large', memory: '~3 GB' }
  ]
}

// Get available models from models folder
function getAvailableModels(): string[] {
  const modelsPath = getModelsPath()
  if (!fs.existsSync(modelsPath)) {
    return []
  }
  
  try {
    const files = fs.readdirSync(modelsPath)
    return files.filter(f => f.endsWith('.bin'))
  } catch {
    return []
  }
}

// Download whisper.cpp binary
async function downloadWhisperBinary(): Promise<{ success: boolean; error?: string }> {
  const binPath = getWhisperBinPath()
  const binDir = path.dirname(binPath)
  
  // Check if already exists
  if (fs.existsSync(binPath)) {
    console.log('[Whisper] Binary already exists:', binPath)
    return { success: true }
  }
  
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true })
  }
  
  // Try older release that has the binary - v1.4.0 was the last with pre-built binary
  const url = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.4.0/whisper-bin-win-x64.zip'
  const zipPath = path.join(binDir, 'whisper-bin.zip')
  
  console.log('[Whisper] Downloading binary from:', url)
  
  return new Promise((resolve) => {
    const { spawn } = require('child_process')
    
    // Use curl instead of PowerShell for more reliable downloads
    const curl = spawn('curl', [
      '-L', '-o', zipPath, url
    ], { shell: true })
    
    curl.on('close', (code: number) => {
      if (code !== 0 || !fs.existsSync(zipPath)) {
        console.log('[Whisper] Curl failed, trying PowerShell...')
        // Fallback to PowerShell
        const ps = spawn('powershell', [
          '-Command',
          `Invoke-WebRequest -Uri '${url}' -OutFile '${zipPath}'`
        ], { shell: true })
        
        ps.on('close', (psCode: number) => {
          if (psCode !== 0) {
            resolve({ success: false, error: 'Download failed. Please download whisper.exe manually.' })
            return
          }
          extractAndFinish()
        })
        ps.on('error', () => resolve({ success: false, error: 'Download failed' }))
        return
      }
      
      extractAndFinish()
    })
    
    curl.on('error', () => {
      // Fallback to PowerShell
      const ps = spawn('powershell', [
        '-Command',
        `Invoke-WebRequest -Uri '${url}' -OutFile '${zipPath}'`
      ], { shell: true })
      
      ps.on('close', (psCode: number) => {
        if (psCode !== 0) {
          resolve({ success: false, error: 'Download failed. Please download whisper.exe manually.' })
          return
        }
        extractAndFinish()
      })
    })
    
    function extractAndFinish() {
      console.log('[Whisper] Extracting binary...')
      const unzip = spawn('powershell', [
        '-Command',
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force`
      ], { shell: true })
      
      unzip.on('close', (unzipCode: number) => {
        // Clean up zip
        try { 
          if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
        } catch {}
        
        // Check multiple possible locations
        const possiblePaths = [
          path.join(binDir, 'main.exe'),
          path.join(binDir, 'whisper-bin-win-x64', 'main.exe'),
          path.join(binDir, 'whisper', 'main.exe')
        ]
        
        let foundPath = ''
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            foundPath = p
            break
          }
        }
        
        if (foundPath) {
          if (foundPath !== binPath) {
            fs.copyFileSync(foundPath, binPath)
            try {
              if (foundPath.includes('whisper-bin-win-x64')) {
                fs.rmSync(path.dirname(foundPath), { recursive: true, force: true })
              }
            } catch {}
          }
          console.log('[Whisper] Binary ready at:', binPath)
          resolve({ success: true })
        } else {
          console.log('[Whisper] Extraction contents:', fs.readdirSync(binDir))
          resolve({ success: false, error: 'main.exe not found after extraction. Please download manually.' })
        }
      })
    }
  })
}

// Download model from HuggingFace
async function downloadModel(modelSize: string): Promise<{ success: boolean; path?: string; error?: string }> {
  const modelsPath = getModelsPath()
  if (!fs.existsSync(modelsPath)) {
    fs.mkdirSync(modelsPath, { recursive: true })
  }
  
  const modelFile = `ggml-${modelSize}.bin`
  const modelPath = path.join(modelsPath, modelFile)
  
  // Check if already exists
  if (fs.existsSync(modelPath)) {
    console.log('[Whisper] Model already exists:', modelPath)
    whisperSettings.modelPath = modelPath
    saveSettings({ modelPath })
    return { success: true, path: modelPath }
  }
  
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${modelFile}`
  console.log('[Whisper] Downloading model:', modelSize)
  
  return new Promise((resolve) => {
    const { spawn } = require('child_process')
    
    const ps = spawn('powershell', [
      '-Command',
      `Invoke-WebRequest -Uri '${url}' -OutFile '${modelPath}'`
    ], { shell: true })
    
    ps.stdout.on('data', (data: any) => {
      console.log('[Whisper] Download progress:', data.toString().substring(0, 100))
    })
    
    ps.on('close', (code: number) => {
      if (code === 0 && fs.existsSync(modelPath)) {
        console.log('[Whisper] Model downloaded successfully')
        whisperSettings.modelPath = modelPath
        saveSettings({ modelPath })
        resolve({ success: true, path: modelPath })
      } else {
        resolve({ success: false, error: `Download failed with code ${code}` })
      }
    })
    
    ps.on('error', (err: Error) => {
      resolve({ success: false, error: err.message })
    })
  })
}

// Transcribe audio using @kutalia/whisper-node-addon (Vulkan GPU accelerated)
async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    // Use default model or custom path
    const modelPath = whisperSettings.modelPath || getDefaultModelPath()
    
    if (!modelPath || !fs.existsSync(modelPath)) {
      throw new Error('Model not found. Please check Settings.')
    }
    
    console.log('[Whisper] Using model:', modelPath)
    console.log('[Whisper] Transcribing audio:', audioPath)
    
    // Convert webm to wav if needed
    let inputPath = audioPath
    if (audioPath.toLowerCase().endsWith('.webm')) {
      const wavPath = audioPath.replace('.webm', '.wav')
      console.log('[Whisper] Converting webm to wav...')
      
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', audioPath,
          '-ar', '16000',
          '-ac', '1',
          '-c:a', 'pcm_s16le',
          '-y',
          wavPath
        ], { shell: true })
        
        ffmpeg.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error('ffmpeg failed'))
        })
        ffmpeg.on('error', reject)
      })
      
      inputPath = wavPath
    }
    
    // Use kutalia whisper with GPU - request plain text output
    console.log('[Whisper] Calling whisper.transcribe with GPU...')
    const result: any = await whisper.transcribe({
      fname_inp: inputPath,
      model: modelPath,
      language: whisperSettings.language === 'auto' ? 'auto' : whisperSettings.language,
      use_gpu: true,  // Enable GPU (Vulkan on AMD!)
      n_threads: 8,
      // Output options - get plain text without timestamps
      output_txt: true,
      print_special: false,
      print_progress: false,
    })
    
    console.log('[Whisper] Raw result type:', typeof result)
    console.log('[Whisper] Raw result:', JSON.stringify(result, null, 2))
    
    // Handle different result formats from @kutalia/whisper-node-addon
    // Format: { language: "en", transcription: [ [startTime, endTime, text], ... ] }
    let text = ''
    if (result?.transcription && Array.isArray(result.transcription) && result.transcription.length > 0) {
      // Extract text from all segments
      text = result.transcription.map((segment: any[]) => {
        // Each segment is [startTime, endTime, text]
        return segment[2] || ''
      }).join(' ').trim()
    } else if (typeof result === 'string') {
      text = result
    } else if (result?.text) {
      text = result.text
    }
    
    console.log('[Whisper] Final text:', text)
    return text
    
  } catch (error: any) {
    console.error('[Whisper] Transcription error:', error)
    throw new Error(error.message || 'Transcription failed')
  }
}

// Register IPC handlers
export function registerWhisperHandlers(): void {
  loadSettings()

  // Get settings
  ipcMain.handle('whisper:get-settings', () => {
    return whisperSettings
  })

  // Save settings
  ipcMain.handle('whisper:save-settings', (_, settings: Partial<WhisperSettings>) => {
    saveSettings(settings)
    return whisperSettings
  })

  // Get available models
  ipcMain.handle('whisper:get-models', () => {
    return getAvailableModels()
  })

  // Get model size options
  ipcMain.handle('whisper:get-model-sizes', () => {
    return getModelSizes()
  })

  // Download whisper binary
  ipcMain.handle('whisper:download-binary', async () => {
    return await downloadWhisperBinary()
  })

  // Download model
  ipcMain.handle('whisper:download-model', async (_, modelSize: string) => {
    return await downloadModel(modelSize)
  })

  // Open models folder dialog
  ipcMain.handle('whisper:select-model', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Whisper Model',
      defaultPath: getModelsPath(),
      filters: [
        { name: 'Whisper Model', extensions: ['bin'] }
      ],
      properties: ['openFile']
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      const modelPath = result.filePaths[0]
      whisperSettings.modelPath = modelPath
      saveSettings({ modelPath })
      return { success: true, path: modelPath }
    }
    return { success: false }
  })

  // Check if binary and model are ready
  ipcMain.handle('whisper:check-model', () => {
    const hasBinary = fs.existsSync(getWhisperBinPath())
    const hasModel = whisperSettings.modelPath && fs.existsSync(whisperSettings.modelPath)
    return {
      ready: hasBinary && hasModel,
      hasBinary,
      hasModel,
      binaryPath: getWhisperBinPath(),
      modelPath: whisperSettings.modelPath
    }
  })

  // Transcribe audio file
  ipcMain.handle('whisper:transcribe', async (_, audioPath: string) => {
    try {
      console.log('[Whisper] Starting transcription for:', audioPath)
      
      if (!fs.existsSync(audioPath)) {
        throw new Error('Audio file not found')
      }

      const result = await transcribeAudio(audioPath)
      return { success: true, text: result }
    } catch (error: any) {
      console.error('[Whisper] Transcription error:', error)
      return { success: false, error: error.message }
    }
  })

  // Save audio blob to temp file
  ipcMain.handle('whisper:save-audio', async (_, audioData: ArrayBuffer) => {
    try {
      const tempDir = app.getPath('temp')
      const audioPath = path.join(tempDir, `whisper_${Date.now()}.webm`)
      
      fs.writeFileSync(audioPath, Buffer.from(audioData))
      console.log('[Whisper] Audio saved to:', audioPath)
      
      return { success: true, path: audioPath }
    } catch (error: any) {
      console.error('[Whisper] Error saving audio:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[Whisper] IPC handlers registered')
}
