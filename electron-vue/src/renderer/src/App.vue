<template>
  <div class="container">
    <!-- Settings Window - Only show settings -->
    <template v-if="isSettingsWindow">
      <!-- Settings Panel -->
      <div class="card">
        
        <div class="setting-group">
          <label>Hotkey</label>
          <div class="hotkey-row">
            <input 
              type="text" 
              v-model="hotkeyInput" 
              @keydown="captureHotkey"
              placeholder="Click and press keys..."
              class="hotkey-input"
              readonly
              ref="hotkeyInputRef"
            />
            <button 
              class="btn btn-record" 
              :class="{ recording: isRecordingHotkey }"
              @click="toggleHotkeyRecording"
            >
              {{ isRecordingHotkey ? '⏹ Stop' : '🎤 Record' }}
            </button>
          </div>
          <p class="hint" v-if="isRecordingHotkey">Press a key combination (e.g., Ctrl+R, Ctrl+Alt+T)...</p>
        </div>

        <div class="setting-group">
          <label>Microphone</label>
          <select v-model="selectedMic" class="select-input" @change="onMicChange">
            <option value="">Default Microphone</option>
            <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
              {{ device.label || `Microphone ${device.deviceId}` }}
            </option>
          </select>
        </div>

        <div class="setting-group">
          <label>Language</label>
          <select v-model="selectedLanguage" class="select-input">
            <option value="auto">Auto Detect</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="ru">Russian</option>
            <option value="zh">Chinese</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
          </select>
        </div>

        <div class="setting-group">
          <label>Model Path</label>
          <div class="path-display">{{ modelPath || 'Not selected' }}</div>
          <button class="btn" @click="selectModelFile">Select Model File</button>
        </div>

        <div class="setting-actions">
          <button class="btn btn-primary" @click="saveSettingsAndClose">Save & Close</button>
        </div>
      </div>
    </template>
    
    <!-- Main Window - Show all UI -->
    <template v-else>
      <!-- Recording Card with VU Meter -->
      <div class="card recording-card" :class="{ recording: isRecording }">
        <div class="status-row">
          <div class="status-indicator" :class="{ recording: isRecording }">
            <span class="status-dot"></span>
            <span>{{ statusText }}</span>
          </div>
          
          <button 
            class="mic-button" 
            :class="{ active: isRecording }"
            @click="toggleRecording"
          >
            {{ isRecording ? '⏹️ STOP' : '🎤 START' }}
          </button>
        </div>
        
        <!-- VU Meter -->
        <VuMeter :level="audioLevel" />
        
        <!-- Waveform Visualizer -->
        <WaveformVisualizer 
          :analyser="analyserNode" 
          :isRecording="isRecording" 
        />
        
        <p class="recording-hint" v-if="isRecording">
          Recording audio... Press STOP or release hotkey to transcribe
        </p>
      </div>

      <!-- Global Hotkey Info -->
      <div class="card hotkey-card">
        <h2>Global Hotkey</h2>
        <p class="hotkey-display">{{ currentHotkey }}</p>
        <p class="hint">Press this key combination anywhere to start/stop recording</p>
      </div>

      <!-- Settings Panel -->
      <div class="card" v-if="showSettings">
      
      <div class="setting-group">
        <label>Hotkey</label>
        <input 
          type="text" 
          v-model="hotkeyInput" 
          @keydown="captureHotkey"
          placeholder="Click and press keys..."
          class="hotkey-input"
        />
      </div>

      <div class="setting-group">
        <label>Microphone</label>
        <select v-model="selectedMic" class="select-input" @change="onMicChange">
          <option value="">Default Microphone</option>
          <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
            {{ device.label || `Microphone ${device.deviceId}` }}
          </option>
        </select>
      </div>

      <div class="setting-group">
        <label>Whisper Binary</label>
        <div class="model-status">
          <span v-if="hasBinary">✅ Installed</span>
          <span v-else class="no-model">Not installed</span>
        </div>
      </div>

      <div class="setting-group">
        <button class="test-button" @click="downloadBinary" :disabled="isDownloadingBinary">
          {{ isDownloadingBinary ? 'Downloading Binary...' : hasBinary ? '✅ Binary Ready' : '⬇️ Download Binary' }}
        </button>
      </div>

      <div class="setting-group">
        <label>Model Status</label>
        <div class="model-status">
          <span v-if="modelPath">{{ modelPath }}</span>
          <span v-else class="no-model">No model selected</span>
        </div>
      </div>

      <div class="setting-group">
        <button class="test-button" @click="downloadModel" :disabled="isDownloading || !hasBinary">
          {{ isDownloading ? 'Downloading...' : modelPath ? '✅ Model Ready' : '⬇️ Download Model' }}
        </button>
      </div>

      <div class="setting-group">
        <button class="test-button secondary" @click="selectModel">
          📁 Select Existing Model
        </button>
      </div>

      <div class="setting-group">
        <label>
          <input type="checkbox" v-model="translateToEnglish" />
          Translate to English
        </label>
      </div>

      <div class="setting-group">
        <label>Language</label>
        <select v-model="selectedLanguage" class="select-input">
          <option value="auto">Auto-detect</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="ru">Russian</option>
          <option value="zh">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
        </select>
      </div>

      <button class="save-button" @click="saveSettings">Save Settings</button>
    </div>
    </template>

    <!-- Transcription Result -->
    <div class="card" v-if="transcriptionResult">
      <h2>Last Transcription</h2>
      <p class="transcription">{{ transcriptionResult }}</p>
    </div>

    <!-- System Tray Info -->
    <div class="card">
      <h2>System Tray</h2>
      <p class="hint">App minimizes to system tray when closed</p>
      <p class="hint">Click tray icon to show/hide • Right-click for menu</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import VuMeter from './components/VuMeter.vue'
import WaveformVisualizer from './components/WaveformVisualizer.vue'
import { AudioRecorder, getAudioDevices } from './utils/audioRecorder'

// State
const statusText = ref('Ready')
const isRecording = ref(false)
const currentHotkey = ref('Ctrl+Shift+R')
const hotkeyInput = ref('')
const selectedMic = ref('')
const modelPath = ref('')
const isDownloading = ref(false)
const isDownloadingBinary = ref(false)
const hasBinary = ref(false)
const translateToEnglish = ref(false)
const selectedLanguage = ref('auto')
const audioDevices = ref<MediaDeviceInfo[]>([])
const transcriptionResult = ref('')
const showSettings = ref(false)
const audioLevel = ref(0)
const analyserNode = ref<AnalyserNode | null>(null)
const isSettingsWindow = ref(false)
const isRecordingHotkey = ref(false)
const hotkeyInputRef = ref<HTMLInputElement | null>(null)

// Audio recorder
let audioRecorder: AudioRecorder | null = null

// Cleanup functions
let cleanupHotkey: (() => void) | null = null
let cleanupSettings: (() => void) | null = null

// Toggle recording
const toggleRecording = async () => {
  if (isRecording.value) {
    await stopRecording()
  } else {
    await startRecording()
  }
}

// Start recording
const startRecording = async () => {
  try {
    audioRecorder = new AudioRecorder()
    
    // Set up level callback
    audioRecorder.setLevelCallback((level) => {
      audioLevel.value = level
    })
    
    // Start recording with selected microphone
    await audioRecorder.start(selectedMic.value || undefined)
    
    // Get analyser for waveform
    analyserNode.value = audioRecorder.getAnalyser()
    
    isRecording.value = true
    statusText.value = 'Recording...'
    
  } catch (err) {
    console.error('[App] Error starting recording:', err)
    statusText.value = 'Microphone error'
  }
}

// Stop recording and transcribe
const stopRecording = async () => {
  let audioBlob: Blob | null = null
  
  if (audioRecorder) {
    audioBlob = await audioRecorder.stop()
    audioRecorder.dispose()
    audioRecorder = null
  }
  
  isRecording.value = false
  audioLevel.value = 0
  analyserNode.value = null
  
  if (!audioBlob) {
    statusText.value = 'Ready'
    return
  }
  
  statusText.value = 'Saving audio...'
  
  try {
    // Convert blob to ArrayBuffer
    const audioArrayBuffer = await audioBlob.arrayBuffer()
    
    // Save audio to temp file
    statusText.value = 'Transcribing...'
    const saveResult = await window.api.whisper.saveAudio(audioArrayBuffer)
    
    if (!saveResult.success || !saveResult.path) {
      throw new Error(saveResult.error || 'Failed to save audio')
    }
    
    // Transcribe the audio
    const result = await window.api.whisper.transcribe(saveResult.path)
    
    if (result.success && result.text) {
      transcriptionResult.value = result.text
      statusText.value = 'Transcription complete!'
      
      // Copy to clipboard - use Electron API so it works when window is not focused
      try {
        await window.api.copyToClipboard(result.text)
        statusText.value = 'Copied to clipboard!'
      } catch {
        statusText.value = 'Transcription complete!'
      }
    } else {
      transcriptionResult.value = `Error: ${result.error || 'Transcription failed'}`
      statusText.value = 'Transcription failed'
    }
    
  } catch (error: any) {
    console.error('[App] Transcription error:', error)
    transcriptionResult.value = `Error: ${error.message}`
    statusText.value = 'Transcription error'
  }
  
  // Reset status after delay
  setTimeout(() => {
    if (!isRecording.value) {
      statusText.value = 'Ready'
    }
  }, 3000)
}

// Handle microphone change
const onMicChange = () => {
  // If currently recording, restart with new mic
  if (isRecording.value) {
    stopRecording().then(() => startRecording())
  }
}

// Capture hotkey combination
const captureHotkey = async (event: KeyboardEvent) => {
  if (!isRecordingHotkey.value) return
  
  event.preventDefault()
  event.stopPropagation()
  
  const modifiers: string[] = []
  if (event.ctrlKey) modifiers.push('CommandOrControl')
  if (event.shiftKey) modifiers.push('Shift')
  if (event.altKey) modifiers.push('Alt')
  // Note: Meta (Windows key) is not supported for global shortcuts in Electron
  
  const key = event.key.toUpperCase()
  const isModifierOnly = ['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)
  
  // Electron requires at least one non-modifier key (like R, A, etc.)
  // Valid: Ctrl+R, Ctrl+Alt+A, Ctrl+Shift+T
  // Invalid: Ctrl+Shift (no regular key), just a single modifier
  if (!isModifierOnly && modifiers.length >= 1) {
    // One modifier + regular key
    hotkeyInput.value = [...modifiers, key].join('+')
    isRecordingHotkey.value = false
  } else if (isModifierOnly && modifiers.length >= 2) {
    // Two modifiers pressed but no regular key - show hint
    // This won't be accepted by Electron, so don't set it
  }
}

// Toggle hotkey recording
const toggleHotkeyRecording = () => {
  isRecordingHotkey.value = !isRecordingHotkey.value
  if (isRecordingHotkey.value) {
    hotkeyInput.value = ''
    // Focus the input so user can start typing immediately
    nextTick(() => {
      hotkeyInputRef.value?.focus()
    })
  }
}

// Save settings
const saveSettings = async () => {
  if (hotkeyInput.value) {
    await window.api.registerHotkey(hotkeyInput.value)
    currentHotkey.value = hotkeyInput.value.replace('CommandOrControl', 'Ctrl')
  }
  
  // Save Whisper settings to main process
  await window.api.whisper.saveSettings({
    modelPath: modelPath.value,
    language: selectedLanguage.value,
    translate: translateToEnglish.value
  })
  
  // Save to localStorage
  localStorage.setItem('whisperSettings', JSON.stringify({
    modelPath: modelPath.value,
    language: selectedLanguage.value,
    translate: translateToEnglish.value,
    microphone: selectedMic.value
  }))
}

// Save settings and close window (for settings window)
const saveSettingsAndClose = async () => {
  await saveSettings()
  // Close the settings window
  window.close()
}

// Select model file using native file dialog
const selectModelFile = async () => {
  const result = await window.api.whisper.selectModel()
  if (result.success) {
    modelPath.value = result.path
  }
}

// Download whisper binary
const downloadBinary = async () => {
  isDownloadingBinary.value = true
  statusText.value = 'Downloading whisper binary...'
  
  try {
    const result = await window.api.whisper.downloadBinary()
    
    if (result.success) {
      hasBinary.value = true
      statusText.value = 'Binary downloaded!'
    } else {
      statusText.value = `Download failed: ${result.error}`
    }
  } catch (error: any) {
    statusText.value = `Error: ${error.message}`
  } finally {
    isDownloadingBinary.value = false
  }
}

// Download model
const downloadModel = async () => {
  isDownloading.value = true
  statusText.value = 'Downloading model...'
  
  try {
    // Use 'base' as default model size for download
    const result = await window.api.whisper.downloadModel('base')
    
    if (result.success) {
      modelPath.value = result.path || ''
      statusText.value = 'Model downloaded!'
    } else {
      statusText.value = `Download failed: ${result.error}`
    }
  } catch (error: any) {
    statusText.value = `Error: ${error.message}`
  } finally {
    isDownloading.value = false
  }
}

// Select existing model
const selectModel = async () => {
  try {
    const result = await window.api.whisper.selectModel()
    if (result.success && result.path) {
      modelPath.value = result.path
    }
  } catch (error: any) {
    console.error('[App] Error selecting model:', error)
  }
}

// Load settings
const loadSettings = async () => {
  // Check binary status
  try {
    const modelStatus = await window.api.whisper.checkModel()
    hasBinary.value = modelStatus.hasBinary
  } catch (e) {
    console.error('[App] Error checking model status:', e)
  }
  
  // Load from main process
  try {
    const settings = await window.api.whisper.getSettings()
    modelPath.value = settings.modelPath || ''
    selectedLanguage.value = settings.language || 'auto'
    translateToEnglish.value = settings.translate || false
  } catch (e) {
    console.error('[App] Error loading settings from main:', e)
  }
  
  // Load hotkey
  try {
    const hotkey = await window.api.getHotkey()
    currentHotkey.value = hotkey.replace('CommandOrControl', 'Ctrl')
    hotkeyInput.value = hotkey
  } catch (e) {
    console.error('[App] Error loading hotkey:', e)
  }
  
  // Load from localStorage as backup
  const saved = localStorage.getItem('whisperSettings')
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      modelPath.value = settings.modelPath || ''
      selectedLanguage.value = settings.language || 'auto'
      translateToEnglish.value = settings.translate || false
      selectedMic.value = settings.microphone || ''
    } catch (e) {
      console.error('[App] Error loading settings:', e)
    }
  }
}

// Initialize on mount
onMounted(async () => {
  // Check if this is the settings window
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('settings') === 'true') {
    showSettings.value = true
    isSettingsWindow.value = true
  }
  
  // Load saved settings
  await loadSettings()
  
  // Get current hotkey
  const hotkey = await window.api.getHotkey()
  currentHotkey.value = hotkey.replace('CommandOrControl', 'Ctrl')
  
  // Listen for hotkey triggers
  cleanupHotkey = window.api.onHotkeyTriggered(() => {
    console.log('[Renderer] Hotkey triggered!')
    toggleRecording()
  })
  
  // Listen for settings open from tray - only for main window
  cleanupSettings = window.api.onOpenSettings(() => {
    window.api.openSettingsWindow()
  })
  
  // Get audio devices
  try {
    audioDevices.value = await getAudioDevices()
  } catch (err) {
    console.error('[App] Error getting devices:', err)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  cleanupHotkey?.()
  cleanupSettings?.()
  if (audioRecorder) {
    audioRecorder.dispose()
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  color: #fff;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.subtitle {
  color: #888;
  font-size: 1.1rem;
}

.card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  backdrop-filter: blur(10px);
}

.card.recording {
  border-color: rgba(239, 68, 68, 0.5);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
}

.card h2 {
  font-size: 1.2rem;
  color: #00d4ff;
  margin-bottom: 15px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.status-card {
  text-align: center;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 1.2rem;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #22c55e;
}

.status-indicator.recording .status-dot {
  background: #ef4444;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.hotkey-card {
  text-align: center;
}

.hotkey-display {
  font-size: 1.5rem;
  font-weight: bold;
  color: #7c3aed;
  margin: 10px 0;
}

.hint {
  color: #666;
  font-size: 0.9rem;
}

/* Button styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: #22c55e;
}

.btn-primary:hover {
  background: #16a34a;
}

.btn-record {
  background: #3b82f6;
  margin-left: 8px;
}

.btn-record:hover {
  background: #2563eb;
}

.btn-record.recording {
  background: #ef4444;
  animation: pulse-record 1s infinite;
}

@keyframes pulse-record {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Hotkey row */
.hotkey-row {
  display: flex;
  align-items: center;
}

.hotkey-row .hotkey-input {
  flex: 1;
}

.actions {
  display: flex;
  justify-content: center;
}

.mic-button {
  padding: 20px 40px;
  font-size: 1.2rem;
  font-weight: bold;
  border: none;
  border-radius: 50px;
  background: linear-gradient(135deg, #00d4ff, #7c3aed);
  color: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.mic-button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(0, 212, 255, 0.5);
}

.mic-button.active {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.setting-group {
  margin-bottom: 15px;
}

.setting-group label {
  display: block;
  margin-bottom: 5px;
  color: #aaa;
}

.hotkey-input, .select-input {
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
}

.select-input option {
  background: #1a1a2e;
  color: white;
}

.save-button {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #22c55e;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 10px;
}

.save-button:hover {
  background: #16a34a;
}

.test-button {
  width: 100%;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.test-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.test-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-button.secondary {
  background: rgba(255, 255, 255, 0.05);
}

.model-status {
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  font-size: 0.85rem;
  word-break: break-all;
}

.model-status .no-model {
  color: #f97316;
}

.transcription {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #ddd;
}

.recording-hint {
  text-align: center;
  color: #ef4444;
  font-size: 0.9rem;
  margin-top: 10px;
  animation: pulse 1s infinite;
}
</style>
