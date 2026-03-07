import { ipcMain, app, dialog, shell } from 'electron'
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

interface LlamaSettings {
  enabled: boolean
  modelPath: string       // Local file path (kept for backward compatibility)
  modelId: string         // HuggingFace model ID (e.g., "model-name:Q8_0")
  huggingFaceToken?: string  // HuggingFace API token for private models
}

// Default settings
let whisperSettings: WhisperSettings = {
  modelPath: '',
  modelSize: 'small',
  language: 'auto',
  translate: false,
  pushToTalk: false
}

// Default llama settings
let llamaSettings: LlamaSettings = {
  enabled: false,
  modelPath: '',
  modelId: ''
}

// node-llama-cpp - will be loaded dynamically
let nodeLlama: any = null
let llamaBinPath: string

function getLlamaBinPath(): string {
  if (!llamaBinPath) {
    // Check if user has their own llama.cpp build
    const userLlamaPath = 'C:\\Utils\\llama.cpp\\build\\bin\\llama-cli.exe'
    if (fs.existsSync(userLlamaPath)) {
      llamaBinPath = userLlamaPath
    } else {
      const userDataPath = app.getPath('userData')
      llamaBinPath = path.join(userDataPath, 'llama', 'llama-cli.exe')
    }
  }
  return llamaBinPath
}

// Available llama models for download
interface LlamaModel {
  id: string
  name: string
  size: string
  memory: string
  description: string
  url: string
}

function getLlamaModelsPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'llama-models')
}

const availableLlamaModels: LlamaModel[] = [
  {
    id: 'qwen2.5-0.5b',
    name: 'Qwen2.5-0.5B Instruct',
    size: '~370MB',
    memory: '~1GB RAM',
    description: 'Fast, low memory, great for formatting',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf'
  }
]

// Download llama model
async function downloadLlamaModel(modelId: string, progressCallback?: (progress: number) => void): Promise<{ success: boolean; path?: string; error?: string }> {
  const model = availableLlamaModels.find(m => m.id === modelId)
  if (!model) {
    return { success: false, error: 'Model not found' }
  }

  const modelsPath = getLlamaModelsPath()
  if (!fs.existsSync(modelsPath)) {
    fs.mkdirSync(modelsPath, { recursive: true })
  }

  const modelFileName = `${modelId}.gguf`
  const modelPath = path.join(modelsPath, modelFileName)

  // Check if already downloaded
  if (fs.existsSync(modelPath)) {
    console.log('[Llama] Model already exists:', modelPath)
    return { success: true, path: modelPath }
  }

  console.log('[Llama] Downloading model:', model.name)
  console.log('[Llama] URL:', model.url)

  return new Promise((resolve) => {
    const { spawn } = require('child_process')
    
    // Use curl for download (more reliable than PowerShell)
    // Use -L to follow redirects, -f to fail on HTTP errors, -o for output
    // Add User-Agent to work with HuggingFace
    const curl = spawn('curl', [
      '-L', '-f', '-o', modelPath,
      '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      model.url
    ], { shell: true })

    let stderrOutput = ''
    
    curl.stderr.on('data', (data: Buffer) => {
      stderrOutput += data.toString()
    })

    curl.stdout.on('data', (data: Buffer) => {
      const output = data.toString()
      // Extract progress if available
      if (output.includes('%')) {
        const match = output.match(/(\d+)%/)
        if (match && progressCallback) {
          progressCallback(parseInt(match[1]))
        }
      }
    })

    curl.on('close', (code: number) => {
      // Check if file exists and has content (at least 1MB for a valid model)
      const MIN_SIZE = 1024 * 1024 // 1MB minimum
      const fileStats = fs.existsSync(modelPath) ? fs.statSync(modelPath) : null
      
      if (code === 0 && fileStats && fileStats.size > MIN_SIZE) {
        console.log('[Llama] Model downloaded successfully:', modelPath, `(${fileStats.size} bytes)`)
        resolve({ success: true, path: modelPath })
      } else {
        // Delete empty or too-small files (likely error pages)
        if (fileStats && fileStats.size > 0 && fileStats.size < MIN_SIZE) {
          console.log('[Llama] File too small, deleting:', fileStats.size, 'bytes')
          try { fs.unlinkSync(modelPath) } catch {}
        }
        console.log('[Llama] Curl failed with code:', code, 'stderr:', stderrOutput)
        
        // Try PowerShell as fallback
        console.log('[Llama] Trying PowerShell fallback...')
        const ps = spawn('powershell', [
          '-Command',
          `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('${model.url}', '${modelPath}')`
        ], { shell: true })

        ps.on('close', (psCode: number) => {
          const MIN_SIZE = 1024 * 1024 // 1MB minimum
          const psStats = fs.existsSync(modelPath) ? fs.statSync(modelPath) : null
          if (psCode === 0 && psStats && psStats.size > MIN_SIZE) {
            console.log('[Llama] Model downloaded via PowerShell:', modelPath, `(${psStats.size} bytes)`)
            resolve({ success: true, path: modelPath })
          } else {
            // Clean up failed download
            console.log('[Llama] PowerShell download also failed')
            if (psStats && psStats.size > 0 && psStats.size < MIN_SIZE) {
              try { fs.unlinkSync(modelPath) } catch {}
            }
            resolve({ success: false, error: 'Download failed. Check console for details.' })
          }
        })
        
        ps.on('error', (err) => {
          console.log('[Llama] PowerShell error:', err.message)
        })
      }
    })

    curl.on('error', (err) => {
      console.log('[Llama] Curl error:', err.message)
      // Fallback to PowerShell
      const ps = spawn('powershell', [
        '-Command',
        `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('${model.url}', '${modelPath}')`
      ], { shell: true })

      ps.on('close', (psCode: number) => {
        const MIN_SIZE = 1024 * 1024 // 1MB minimum
        const psStats = fs.existsSync(modelPath) ? fs.statSync(modelPath) : null
        if (psCode === 0 && psStats && psStats.size > MIN_SIZE) {
          resolve({ success: true, path: modelPath })
        } else {
          if (psStats && psStats.size > 0 && psStats.size < MIN_SIZE) {
            try { fs.unlinkSync(modelPath) } catch {}
          }
          resolve({ success: false, error: 'Download failed' })
        }
      })
    })
  })
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
      const allSettings = JSON.parse(data)
      whisperSettings = { ...whisperSettings, ...allSettings.whisper }
      llamaSettings = { ...llamaSettings, ...allSettings.llama }
      console.log('[Whisper] Settings loaded:', whisperSettings)
      console.log('[Llama] Settings loaded:', llamaSettings)
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
    fs.writeFileSync(settingsFile, JSON.stringify({ whisper: whisperSettings, llama: llamaSettings }, null, 2))
    console.log('[Whisper] Settings saved:', whisperSettings)
  } catch (error) {
    console.error('[Whisper] Error saving settings:', error)
  }
}

// Save llama settings to file
function saveLlamaSettings(settings: Partial<LlamaSettings>): void {
  llamaSettings = { ...llamaSettings, ...settings }
  try {
    const settingsFile = getSettingsPath()
    const dir = path.dirname(settingsFile)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(settingsFile, JSON.stringify({ whisper: whisperSettings, llama: llamaSettings }, null, 2))
    console.log('[Llama] Settings saved:', llamaSettings)
  } catch (error) {
    console.error('[Llama] Error saving settings:', error)
  }
}

// Process text with llama.cpp for formatting using llama-cli
async function processWithLlama(text: string): Promise<{ success: boolean; formattedText?: string; error?: string }> {
  const modelPath = llamaSettings.modelPath

  // Check if we have a local file
  if (!modelPath || !fs.existsSync(modelPath)) {
    return { success: false, error: 'Llama model not found. Please download a model first.' }
  }

  try {
    const { spawn } = require('child_process')
    
    // Get llama-cli path
    const llamaBinPath = getLlamaBinPath()
    
    if (!fs.existsSync(llamaBinPath)) {
      return { success: false, error: 'llama-cli.exe not found. Please install llama.cpp to C:\\Utils\\llama.cpp\\build\\bin\\' }
    }
    
    console.log('[Llama] Using binary:', llamaBinPath)
    console.log('[Llama] Using model:', modelPath)
    
    // Create prompt for text formatting
    const prompt = `Please format this transcription by adding proper punctuation and paragraph breaks. Just return the formatted text, nothing else.

Transcription:
${text}

Formatted:`

    // Use llama-cli with simple prompt
    const args = [
      '-m', modelPath,
      '-p', prompt,
      '-n', '256',
      '--temp', '0.1',
      '--no-display'
    ]
    

    
    return new Promise((resolve) => {
      const llama = spawn(llamaBinPath, args, { shell: true })
      
      let stdout = ''
      let stderr = ''
      
      llama.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })
      
      llama.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })
      
      llama.on('close', (code: number) => {
        console.log('[Llama] llama-cli exit code:', code)
        console.log('[Llama] stdout:', stdout)
        console.log('[Llama] stderr:', stderr)
        
        if (code === 0 && stdout.trim()) {
          const formattedText = stdout.trim()
          console.log('[Llama] Formatted text:', formattedText)
          resolve({ success: true, formattedText: formattedText || text })
        } else {
          console.error('[Llama] Error:', stderr)
          resolve({ success: false, error: stderr || 'Llama processing failed' })
        }
      })
      
      llama.on('error', (err: any) => {
        console.error('[Llama] Spawn error:', err)
        resolve({ success: false, error: err.message })
      })
    })
  } catch (error: any) {
    console.error('[Llama] Error:', error)
    return { success: false, error: error.message || 'Llama processing failed' }
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

  // ===== Llama.cpp IPC Handlers =====

  // Get llama settings
  ipcMain.handle('llama:get-settings', () => {
    return llamaSettings
  })

  // Save llama settings
  ipcMain.handle('llama:save-settings', (_, settings: Partial<LlamaSettings>) => {
    saveLlamaSettings(settings)
    return llamaSettings
  })

  // Check if llama binary exists (npm package includes binary)
  ipcMain.handle('llama:check-binary', () => {
    // node-llama-cpp package includes the binary, so we just need the package installed
    return true
  })

  // Select llama model
  ipcMain.handle('llama:select-model', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Llama Model',
      filters: [
        { name: 'GGUF Models', extensions: ['gguf'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: false }
    }

    const modelPath = result.filePaths[0]
    llamaSettings.modelPath = modelPath
    saveLlamaSettings({ modelPath })
    return { success: true, path: modelPath }
  })

  // Process text with llama
  ipcMain.handle('llama:process-text', async (_, text: string) => {
    try {
      return await processWithLlama(text)
    } catch (error: any) {
      console.error('[Llama] Error processing text:', error)
      return { success: false, error: error.message }
    }
  })

  // Get available models list
  ipcMain.handle('llama:get-models', () => {
    return availableLlamaModels
  })

  // Download model
  ipcMain.handle('llama:download-model', async (_, modelId: string) => {
    console.log('[Llama] Starting download for model:', modelId)
    const result = await downloadLlamaModel(modelId)
    
    if (result.success && result.path) {
      // Auto-select the downloaded model
      llamaSettings.modelPath = result.path
      saveLlamaSettings({ modelPath: result.path })
    }
    
    return result
  })

  // Download custom model from HuggingFace path
  ipcMain.handle('llama:download-custom-model', async (_, modelPath: string) => {
    console.log('[Llama] Starting custom download for:', modelPath)
    
    try {
      const modelsPath = getLlamaModelsPath()
      if (!fs.existsSync(modelsPath)) {
        fs.mkdirSync(modelsPath, { recursive: true })
      }
      
      // Check if it's a full URL or just a path
      let url = ''
      let filename = ''
      
      // Handle model ID with quantization (e.g., "ggml-org/tinygemma3-GGUF:Q8_0")
      // Extract the base model path and quantization
      let modelId = modelPath
      
      // Check if it's a full URL first
      if (modelPath.startsWith('http')) {
        // Full URL provided
        url = modelPath
        filename = modelPath.split('/').pop() || 'model.gguf'
      } else if (modelPath.includes(':')) {
        // Has quantization suffix, extract the model path
        const parts = modelPath.split(':')
        modelId = parts[0]  // e.g., "ggml-org/tinygemma3-GGUF"
        console.log('[Llama] Extracted model ID:', modelId)
      } else {
        modelId = modelPath
      }
      
      if (url) {
        // Already have full URL
        // Extract filename from URL
        filename = url.split('/').pop() || 'model.gguf'
      } else {
        // Just the HuggingFace path (e.g., "bartowski/Llama-3.2-3B-Instruct-GGUF")
        
        // First, try to find the GGUF file by common patterns
        const modelNameFromPath = modelId.split('/').pop() || modelId
        
        // Common GGUF filename patterns to try
        const possibleFilenames = [
          `${modelNameFromPath.toLowerCase()}-q4_k_m.gguf`,
          `${modelNameFromPath.toLowerCase()}-q4_km.gguf`,
          `${modelNameFromPath.toLowerCase()}-Q4_K_M.gguf`,
          `${modelNameFromPath.toLowerCase()}-q5_k_m.gguf`,
          `${modelNameFromPath.toLowerCase()}-q8_0.gguf`,
          `${modelNameFromPath.toLowerCase()}.gguf`,
          'model-q4_k_m.gguf',
          'model-q5_k_m.gguf',
          'model.gguf'
        ]
        
        // Try each pattern until one works
        for (const tryFilename of possibleFilenames) {
          const tryUrl = `https://huggingface.co/${modelId}/resolve/main/${tryFilename}`
          console.log('[Llama] Trying URL:', tryUrl)
          
          // Check if file exists using HEAD request
          try {
            const response = await (globalThis as any).fetch(tryUrl, {
              method: 'HEAD',
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            })
            
            if (response.ok) {
              url = tryUrl
              filename = tryFilename
              console.log('[Llama] Found GGUF file:', filename)
              break
            }
          } catch (e) {
            // Continue to next pattern
          }
        }
        
        // If no pattern worked, try the API
        if (!url) {
          const apiUrl = `https://huggingface.co/api/models/${modelId}/tree/main`
          console.log('[Llama] Trying API:', apiUrl)
          
          try {
            const response = await (globalThis as any).fetch(apiUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            })
            
            if (response.ok) {
              const files: any[] = await response.json()
              console.log('[Llama] API response files:', JSON.stringify(files).slice(0, 500))
              
              // Handle different API response formats
              if (!Array.isArray(files)) {
                console.log('[Llama] API response is not an array')
              }
              
              // The API uses 'path' not 'name' for the file path
              const ggufFiles = (Array.isArray(files) ? files : [])
                .filter((f: any) => f && f.type === 'file' && f.path && f.path.toLowerCase && f.path.toLowerCase().endsWith('.gguf'))
                .map((f: any) => f.path)
              
              console.log('[Llama] API response files:', JSON.stringify(files.slice(0, 5)))
              
              if (ggufFiles.length > 0) {
                filename = ggufFiles[0]
                url = `https://huggingface.co/${modelId}/resolve/main/${filename}`
                console.log('[Llama] Found GGUF file via API:', filename)
              } else {
                console.log('[Llama] No GGUF files found in API response')
              }
            }
          } catch (e) {
            console.log('[Llama] API error:', e)
          }
        }
        
        if (!url) {
          return { 
            success: false, 
            error: 'Could not find GGUF file. Please enter the full HuggingFace download URL.' 
          }
        }
      }
      
      const modelFileName = filename || url.split('/').pop() || 'model.gguf'
      const modelPath_ = path.join(modelsPath, modelFileName)
      
      // Get the HuggingFace token if available
      const hfToken = llamaSettings.huggingFaceToken || ''
      
      console.log('[Llama] Downloading from:', url)
      console.log('[Llama] Saving to:', modelPath_)
      if (hfToken) {
        console.log('[Llama] Using HuggingFace token')
      }
      
      return new Promise((resolve) => {
        const { spawn } = require('child_process')
        
        // Check if curl is available
        const curlTest = spawn('curl', ['--version'], { shell: true })
        curlTest.on('error', () => {
          console.log('[Llama] curl not found, trying with PowerShell Invoke-WebRequest')
          
          // Build PowerShell headers
          let psHeaders = "-UserAgent 'Mozilla/5.0'"
          if (hfToken) {
            psHeaders += ` -Headers @{'Authorization'='Bearer ${hfToken}'}`
          }
          
          const ps = spawn('powershell', [
            '-Command',
            `Invoke-WebRequest -Uri '${url}' -OutFile '${modelPath_}' ${psHeaders}`
          ], { shell: true })
          
          let stderrOutput = ''
          ps.stderr.on('data', (data: Buffer) => {
            stderrOutput += data.toString()
          })
          
          ps.on('close', (code: number) => {
            const fileStats = fs.existsSync(modelPath_) ? fs.statSync(modelPath_) : null
            if (code === 0 && fileStats && fileStats.size > 1024 * 1024) {
              console.log('[Llama] Model downloaded via PowerShell:', modelPath_, `(${fileStats.size} bytes)`)
              llamaSettings.modelPath = modelPath_
              saveLlamaSettings({ modelPath: modelPath_ })
              resolve({ success: true, path: modelPath_ })
            } else {
              console.log('[Llama] PowerShell download failed:', stderrOutput)
              resolve({ success: false, error: 'Download failed. Please check the URL and try again.' })
            }
          })
          return
        })
        
        // Build curl command string with proper quoting for Windows
        let curlCmd = `curl -L -f -o "${modelPath_}" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`
        if (hfToken) {
          curlCmd += ` -H "Authorization: Bearer ${hfToken}"`
        }
        curlCmd += ` "${url}"`
        
        console.log('[Llama] Running curl command')
        
        const curl = spawn(curlCmd, [], { shell: true })
        
        let stderrOutput = ''
        
        curl.stderr.on('data', (data: Buffer) => {
          stderrOutput += data.toString()
        })
        
        curl.on('close', (code: number) => {
          const MIN_SIZE = 1024 * 1024 // 1MB minimum
          const fileStats = fs.existsSync(modelPath_) ? fs.statSync(modelPath_) : null
          
          if (code === 0 && fileStats && fileStats.size > MIN_SIZE) {
            console.log('[Llama] Custom model downloaded:', modelPath_, `(${fileStats.size} bytes)`)
            
            // Auto-select the downloaded model
            llamaSettings.modelPath = modelPath_
            saveLlamaSettings({ modelPath: modelPath_ })
            
            resolve({ success: true, path: modelPath_ })
          } else {
            if (fileStats && fileStats.size > 0 && fileStats.size < MIN_SIZE) {
              try { fs.unlinkSync(modelPath_) } catch {}
            }
            console.log('[Llama] Custom download failed:', stderrOutput)
            resolve({ success: false, error: 'Download failed. Please check the URL and try again.' })
          }
        })
        
        curl.on('error', (err: any) => {
          console.log('[Llama] Curl error:', err.message)
          resolve({ success: false, error: err.message })
        })
      })
    } catch (error: any) {
      console.error('[Llama] Custom download error:', error)
      return { success: false, error: error.message }
    }
  })

  // Get download progress (for future use)
  ipcMain.handle('llama:get-models-path', () => {
    return getLlamaModelsPath()
  })

  // Open URL in default browser
  ipcMain.handle('open-external', (_, url: string) => {
    shell.openExternal(url)
  })

  console.log('[Whisper] IPC handlers registered')
}
