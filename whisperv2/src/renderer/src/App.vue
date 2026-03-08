<template>
  <div class="container">
    <!-- Slide-out Menu -->
    <div class="menu-toggle" @click="menuOpen = !menuOpen">
      ☰
    </div>
    <div class="sidebar" :class="{ open: menuOpen }">
      <div class="sidebar-header">
        <h3>Menu</h3>
        <button class="close-menu" @click="menuOpen = false">✕</button>
      </div>
      <div class="sidebar-content">
        <button v-if="!showSettings" class="menu-item" @click="showSettings = true; menuOpen = false">
          ⚙️ Settings
        </button>
        <button v-else class="menu-item" @click="showSettings = false; menuOpen = false">
          🏠 Go Home
        </button>
      </div>
    </div>
    <div class="sidebar-overlay" :class="{ open: menuOpen }" @click="menuOpen = false"></div>

    <!-- Settings Window - Only show settings -->
    <template v-if="isSettingsWindow">
      <!-- Settings Panel -->
      <div class="card">
         
        <!-- Tabs -->
        <div class="tabs">
          <button 
            class="tab-button" 
            :class="{ active: activeTab === 'audio' }"
            @click="activeTab = 'audio'"
          >
            🎤 Audio
          </button>
          <button 
            class="tab-button" 
            :class="{ active: activeTab === 'whisper' }"
            @click="activeTab = 'whisper'"
          >
            🎙️ Whisper
          </button>
          <button 
            class="tab-button" 
            :class="{ active: activeTab === 'llama' }"
            @click="activeTab = 'llama'"
          >
            🦙 Llama
          </button>
          <button 
            class="tab-button" 
            :class="{ active: activeTab === 'general' }"
            @click="activeTab = 'general'"
          >
            ⚙️ General
          </button>
          <button 
            class="tab-button" 
            :class="{ active: activeTab === 'history' }"
            @click="activeTab = 'history'; loadTranscriptionHistory()"
          >
            📜 History
          </button>
        </div>

        <!-- Audio Tab -->
        <div v-if="activeTab === 'audio'" class="tab-content">
          <div class="settings-section">
            <div class="setting-group">
              <label>Microphone</label>
              <select v-model="selectedMic" class="select-input" @change="onMicChange">
                <option value="">Default Microphone</option>
                <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
                  {{ device.label || `Microphone ${device.deviceId}` }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Whisper Tab -->
        <div v-if="activeTab === 'whisper'" class="tab-content">
          <div class="settings-section">
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
              <button class="btn btn-primary" style="margin-top: 10px;" @click="selectModelFile">Select Model File</button>
            </div>
          </div>
        </div>

        <!-- Llama Tab -->
        <div v-if="activeTab === 'llama'" class="tab-content">
          <div class="settings-section">
            <div class="setting-group">
              <label>
                <input type="checkbox" v-model="llamaEnabled" @change="saveLlamaSettings" />
                Enable llama.cpp text formatting
              </label>
            </div>

            <div class="setting-group">
              <label>Llama Binary</label>
              <div class="model-status">
                <span v-if="hasLlamaBinary">✅ Installed</span>
                <span v-else class="no-model">Not installed</span>
              </div>
            </div>

          <div class="setting-group">
            <label>Llama Model Path</label>
            <div class="path-row">
              <div class="model-status path-status">
                <span v-if="llamaModelPath">{{ llamaModelPath }}</span>
                <span v-else class="no-model">No model selected</span>
              </div>
              <button class="test-button secondary select-btn" @click="selectLlamaModel">
                📁 Select
              </button>
            </div>
          </div>

          <div class="setting-group">
            <label>Enter HuggingFace model ID (e.g., ggml-org/tinygemma3-GGUF:Q8_0): <span title="Find models at huggingface.co/models - search for 'GGUF' quantized models" style="cursor: help; color: #60a5fa;">ⓘ</span></label>
            <div class="custom-model-row">
              <input 
                type="text" 
                v-model="llamaModelId" 
                placeholder="e.g., ggml-org/tinygemma3-GGUF:Q8_0"
                class="model-input"
                @blur="saveLlamaSettings"
              />
              <button 
                class="test-button secondary" 
                @click="downloadFromHuggingFace"
                :disabled="isDownloadingLlama || !llamaModelId"
              >
                ⬇️ Download
              </button>
            </div>
            <p class="hint">Enter a HuggingFace model ID with optional quantization (e.g., :Q8_0, :Q4_K_M)</p>
          </div>

          <div class="setting-group">
            <label>HuggingFace Token:</label>
            <input 
              type="password" 
              v-model="huggingFaceToken" 
              placeholder="hf_xxxxxxxxxxxxx"
              class="model-input"
              @blur="saveLlamaSettings"
            />
            <p class="hint">Get your token from https://huggingface.co/settings/tokens</p>
          </div>
          </div>
        </div>

        <!-- General Tab -->
        <div v-if="activeTab === 'general'" class="tab-content">
          <div class="settings-section">
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
                  {{ isRecordingHotkey ? '⏹ Stop' : '⌨️ Record' }}
                </button>
              </div>
              <p class="hint" v-if="isRecordingHotkey">Press a key combination (e.g., Ctrl+R, Ctrl+Alt+T)...</p>
            </div>
          </div>
        </div>

        <!-- History Tab -->
        <div v-if="activeTab === 'history'" class="tab-content">
          <div class="history-box">
            <div class="history-header">
              <h3>Transcription History</h3>
              <input 
                type="text" 
                v-model="historyFilter" 
                placeholder="Filter history..." 
                class="history-filter-input"
              />
            </div>
            <div class="history-list" v-if="filteredHistory.length > 0">
              <div 
                v-for="item in filteredHistory" 
                :key="item.id" 
                class="history-item"
              >
                <div class="history-item-header">
                  <div class="history-timestamp">{{ new Date(item.timestamp).toLocaleString() }}</div>
                  <div class="history-actions">
                    <button class="history-btn" @click="copyHistoryItem(item.text)" title="Copy">📋</button>
                    <button class="history-btn history-btn-delete" @click="deleteHistoryItem(item.id)" title="Delete">🗑️</button>
                  </div>
                </div>
                <div class="history-text">{{ item.text }}</div>
              </div>
            </div>
            <div v-else-if="historyFilter && filteredHistory.length === 0" class="no-history">
              No matching transcriptions found.
            </div>
            <div v-else class="no-history">
              No transcriptions yet. Start recording to see history.
            </div>
          </div>
        </div>

        <div class="setting-actions" v-if="activeTab === 'history'">
          <button class="btn" @click="goHome">🏠 Go Home</button>
        </div>

        <div class="setting-actions" v-if="activeTab !== 'history'">
          <button class="btn btn-primary" @click="saveSettingsAndClose">Save & Close</button>
        </div>
      </div>
    </template>
    
    <!-- Main Window - Show all UI -->
    <template v-else>
      <!-- Status Header -->
      <div class="setting-group status-section" v-if="!showSettings">
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
        <div class="binary-status">
          <span class="status-dot" :class="{ active: hasBinary }"></span>
          <span>{{ hasBinary ? '✅' : '❌' }} Whisper {{ hasBinary ? 'Loaded' : 'Unloaded' }}</span>
        </div>
        <div class="binary-status">
          <span class="status-dot" :class="{ active: llamaEnabled && llamaModelPath }"></span>
          <span>{{ llamaEnabled && llamaModelPath ? '✅' : '⬜' }} Llama {{ llamaEnabled && llamaModelPath ? 'Ready' : 'Off' }}</span>
        </div>
        <div class="binary-status" v-if="llamaModelPath">
          <span>✅ {{ llamaModelPath.split(/[/\\]/).pop() }} - Loaded</span>
        </div>
      </div>
       
      <!-- Recording Card with VU Meter -->
      <div class="card recording-card" :class="{ recording: isRecording }" v-if="!showSettings">
        <!-- Waveform Visualizer -->
        <WaveformVisualizer 
          :analyser="analyserNode" 
          :isRecording="isRecording" 
        />
        
        <p class="recording-hint" v-if="isRecording">
          Recording audio... Press STOP or release hotkey to transcribe
        </p>
      </div>

      <!-- Settings Panel -->
      <div class="card" v-if="showSettings">
       
      <!-- Tabs -->
      <div class="tabs">
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'audio' }"
          @click="activeTab = 'audio'"
        >
          🎤 Audio
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'whisper' }"
          @click="activeTab = 'whisper'"
        >
          🎙️ Whisper
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'llama' }"
          @click="activeTab = 'llama'"
        >
          🦙 Llama
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'general' }"
          @click="activeTab = 'general'"
        >
          ⚙️ General
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'history' }"
          @click="activeTab = 'history'; loadTranscriptionHistory()"
        >
          📜 History
        </button>
      </div>

      <!-- Audio Settings Tab -->
      <div v-if="activeTab === 'audio'" class="tab-content">
        <div class="setting-group">
          <label>Microphone</label>
          <select v-model="selectedMic" class="select-input" @change="onMicChange">
            <option value="">Default Microphone</option>
            <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
              {{ device.label || `Microphone ${device.deviceId}` }}
            </option>
          </select>
        </div>
      </div>

      <!-- Whisper Settings Tab -->
      <div v-if="activeTab === 'whisper'" class="tab-content">
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

        <div class="setting-group">
          <label>
            <input type="checkbox" v-model="translateToEnglish" />
            Translate to English
          </label>
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
          <div class="path-row">
            <div class="model-status path-status">
              <span v-if="modelPath">{{ modelPath }}</span>
              <span v-else class="no-model">No model selected</span>
            </div>
            <button class="test-button select-btn" @click="selectModel">
              📁 Select
            </button>
          </div>
        </div>

        <div class="setting-group">
          <button class="test-button" @click="downloadModel" :disabled="isDownloading || !hasBinary">
            {{ isDownloading ? 'Downloading...' : modelPath ? '✅ Model Ready' : '⬇️ Download Model' }}
          </button>
        </div>
      </div>

      <!-- Llama Settings Tab -->
      <div v-if="activeTab === 'llama'" class="tab-content">
        <div class="setting-group">
          <label>
            <input type="checkbox" v-model="llamaEnabled" @change="saveLlamaSettings" />
            Enable llama.cpp text formatting
          </label>
        </div>

        <div class="setting-group">
          <label>Llama Binary</label>
          <div class="model-status">
            <span v-if="hasLlamaBinary">✅ Installed</span>
            <span v-else class="no-model">Not installed</span>
          </div>
        </div>

        <div class="setting-group">
          <label>Llama Model Path</label>
          <div class="path-row">
            <div class="model-status path-status">
              <span v-if="llamaModelPath">{{ llamaModelPath }}</span>
              <span v-else class="no-model">No model selected</span>
            </div>
            <button class="test-button secondary select-btn" @click="selectLlamaModel">
              📁 Select
            </button>
          </div>
        </div>

        <div class="setting-group">
          <label>Enter HuggingFace model ID (e.g., ggml-org/tinygemma3-GGUF:Q8_0): <span title="Find models at huggingface.co/models - search for 'GGUF' quantized models" style="cursor: help; color: #60a5fa;">ⓘ</span></label>
          <div class="custom-model-row">
            <input 
              type="text" 
              v-model="llamaModelId" 
              placeholder="e.g., ggml-org/tinygemma3-GGUF:Q8_0"
              class="model-input"
              @blur="saveLlamaSettings"
            />
            <button 
              class="test-button secondary" 
              @click="downloadFromHuggingFace"
              :disabled="isDownloadingLlama || !llamaModelId"
            >
              ⬇️ Download
            </button>
          </div>
          <p class="hint">Enter a HuggingFace model ID with optional quantization (e.g., :Q8_0, :Q4_K_M)</p>
        </div>

        <div class="setting-group">
          <label>HuggingFace Token:</label>
          <input 
            type="password" 
            v-model="huggingFaceToken" 
            placeholder="hf_xxxxxxxxxxxxx"
            class="model-input"
            @blur="saveLlamaSettings"
          />
          <p class="hint">Get your token from https://huggingface.co/settings/tokens</p>
        </div>
      </div>

      <!-- General Settings Tab -->
      <div v-if="activeTab === 'general'" class="tab-content">
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
            />
            <button 
              class="btn btn-record"
              :class="{ recording: isRecordingHotkey }"
              @click="toggleHotkeyRecording"
            >
              {{ isRecordingHotkey ? '⏹ Stop' : '⌨️ Record' }}
            </button>
          </div>
          <p class="hint" v-if="isRecordingHotkey">Press a key combination (e.g., Ctrl+R, Ctrl+Alt+T)...</p>
        </div>
      </div>

      <!-- History Tab -->
      <div v-if="activeTab === 'history'" class="tab-content">
        <div class="history-box">
          <div class="history-header">
            <h3>Transcription History</h3>
            <input 
              type="text" 
              v-model="historyFilter" 
              placeholder="Filter history..." 
              class="history-filter-input"
            />
          </div>
          <div class="history-list" v-if="filteredHistory.length > 0">
            <div 
              v-for="item in filteredHistory" 
              :key="item.id" 
              class="history-item"
            >
              <div class="history-item-header">
                <div class="history-timestamp">{{ new Date(item.timestamp).toLocaleString() }}</div>
                <div class="history-actions">
                  <button class="history-btn" @click="copyHistoryItem(item.text)" title="Copy">📋</button>
                  <button class="history-btn history-btn-delete" @click="deleteHistoryItem(item.id)" title="Delete">🗑️</button>
                </div>
              </div>
              <div class="history-text">{{ item.text }}</div>
            </div>
          </div>
          <div v-else-if="historyFilter && filteredHistory.length === 0" class="no-history">
            No matching transcriptions found.
          </div>
          <div v-else class="no-history">
            No transcriptions yet. Start recording to see history.
          </div>
        </div>
      </div>

      <div class="button-row" v-if="activeTab === 'history'" style="margin-top: -8px;">
        <div></div>
        <div class="button-row-right">
          <button class="cancel-button" @click="goHome">🏠 Go Home</button>
        </div>
      </div>

      <div class="button-row" v-if="activeTab !== 'history'">
        <button class="browse-button" @click="browseHuggingFace" v-if="activeTab === 'llama'">
          🌐 Browse HuggingFace
        </button>
        <div v-else></div>
        <div class="button-row-right">
          <button class="cancel-button" @click="cancelSettings">Cancel</button>
          <button class="save-button" @click="saveSettings">Save Settings</button>
        </div>
      </div>
    </div>
    </template>

    <!-- Transcription History -->
    <div class="card transcription-history" v-if="transcriptionHistory.length > 0 && !showSettings">
      <h2>Recent Transcriptions</h2>
      <div class="transcription-list">
        <div v-for="(item, index) in transcriptionHistory" :key="index" class="transcription-item">
          <p class="transcription-small">• {{ item.text }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
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
const pushToTalk = ref(true)
const llamaEnabled = ref(false)
const llamaModelPath = ref('')
const llamaModelId = ref('')
const huggingFaceToken = ref('')
const hasLlamaBinary = ref(false)
const isProcessingLlama = ref(false)
const availableLlamaModels = ref<{ id: string; name: string; size: string; url: string }[]>([])
const isDownloadingLlama = ref(false)
const downloadProgress = ref(0)
const customModelPath = ref('')
const audioDevices = ref<MediaDeviceInfo[]>([])
const transcriptionResult = ref('')
const transcriptionHistory = ref<{ text: string; prompt?: string }[]>([])
const dbTranscriptionHistory = ref<{ id: number; text: string; timestamp: string }[]>([])
const historyFilter = ref('')
const showSettings = ref(false)

const filteredHistory = computed(() => {
  if (!historyFilter.value.trim()) {
    return dbTranscriptionHistory.value
  }
  const filter = historyFilter.value.toLowerCase()
  return dbTranscriptionHistory.value.filter(item => 
    item.text.toLowerCase().includes(filter)
  )
})

// Load transcription history from database
async function loadTranscriptionHistory() {
  try {
    const records = await window.api.transcription.getAll(50)
    dbTranscriptionHistory.value = records.map(r => ({
      id: r.id,
      text: r.text,
      timestamp: r.timestamp
    }))
  } catch (err) {
    console.error('[App] Failed to load transcription history:', err)
  }
}

// Copy history item text to clipboard
async function copyHistoryItem(text: string) {
  try {
    await window.api.copyToClipboard(text)
  } catch (err) {
    console.error('[App] Failed to copy to clipboard:', err)
  }
}

// Delete a history item
async function deleteHistoryItem(id: number) {
  try {
    await window.api.transcription.delete(id)
    // Remove from local list
    dbTranscriptionHistory.value = dbTranscriptionHistory.value.filter(item => item.id !== id)
  } catch (err) {
    console.error('[App] Failed to delete history item:', err)
  }
}

const menuOpen = ref(false)
const activeTab = ref('audio')
const audioLevel = ref(0)
const analyserNode = ref<AnalyserNode | null>(null)
const isSettingsWindow = ref(false)
const isRecordingHotkey = ref(false)
const hotkeyInputRef = ref<HTMLInputElement | null>(null)

// Audio recorder
let audioRecorder: AudioRecorder | null = null

// Cleanup functions
let cleanupHotkeyDown: (() => void) | null = null
let cleanupHotkeyUp: (() => void) | null = null
let cleanupHotkeyChanged: (() => void) | null = null
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
      // Send audio level to overlay
      window.api?.sendAudioLevel(level)
    })
    
    // Start recording with selected microphone
    await audioRecorder.start(selectedMic.value || undefined)
    
    // Get analyser for waveform
    analyserNode.value = audioRecorder.getAnalyser()
    
    isRecording.value = true
    statusText.value = 'Recording...'
    
    // Show recording overlay
    window.api?.showRecordingOverlay()
    
    // Track that we had a previous window to paste to
    window.api?.setPreviousWindowFocused(true)
    
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
  
  // Hide recording overlay
  window.api?.hideRecordingOverlay()
  
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
      let finalText = result.text

      // Process with llama.cpp if enabled (either HuggingFace model ID or local file)
      if (llamaEnabled.value && hasLlamaBinary.value && (llamaModelId.value || llamaModelPath.value)) {
        statusText.value = 'Formatting with llama.cpp...'
        try {
          const llamaResult = await window.api.llama.processText(result.text)
          if (llamaResult.success && llamaResult.formattedText) {
            finalText = llamaResult.formattedText
            statusText.value = 'Formatting complete!'
          }
        } catch (error: any) {
          console.error('[App] Llama processing error:', error)
          statusText.value = 'Transcription complete (llama failed)'
        }
      }

      transcriptionResult.value = finalText
      // Add to history (keep last 3)
      transcriptionHistory.value.unshift({ text: finalText })
      if (transcriptionHistory.value.length > 200) {
        transcriptionHistory.value.pop()
      }
      statusText.value = 'Transcription complete!'
      
      // Log transcription to database
      try {
        await window.api.transcription.log(finalText)
        console.log('[App] Transcription logged to database')
      } catch (err) {
        console.error('[App] Failed to log transcription:', err)
      }
       
      // Copy to clipboard and paste to previous window
      try {
        await window.api.copyToClipboard(finalText)
        statusText.value = 'Copied to clipboard!'
        
        // Try to paste to the previous window
        await window.api.pasteToPreviousWindow()
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
    translate: translateToEnglish.value,
    pushToTalk: pushToTalk.value
  })
  
  // Save to localStorage
  localStorage.setItem('whisperSettings', JSON.stringify({
    modelPath: modelPath.value,
    language: selectedLanguage.value,
    translate: translateToEnglish.value,
    pushToTalk: pushToTalk.value,
    microphone: selectedMic.value
  }))
}

// Save settings and close window (for settings window)
const saveSettingsAndClose = async () => {
  await saveSettings()
  // Close the settings window
  window.close()
}

// Cancel settings and close window (for settings window)
const cancelSettings = async () => {
  // Close the settings window
  window.close()
}

// Go home from history tab
const goHome = () => {
  showSettings.value = false
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

// Save llama settings
const saveLlamaSettings = async () => {
  try {
    await window.api.llama.saveSettings({
      enabled: llamaEnabled.value,
      modelPath: llamaModelPath.value,
      modelId: llamaModelId.value,
      huggingFaceToken: huggingFaceToken.value
    })
  } catch (error: any) {
    console.error('[App] Error saving llama settings:', error)
  }
}

// Select llama model
const selectLlamaModel = async () => {
  try {
    const result = await window.api.llama.selectModel()
    if (result.success && result.path) {
      llamaModelPath.value = result.path
      await saveLlamaSettings()
    }
  } catch (error: any) {
    console.error('[App] Error selecting llama model:', error)
  }
}

// Browse HuggingFace for GGUF models
const browseHuggingFace = () => {
  console.log('[App] browseHuggingFace called')
  const url = 'https://huggingface.co/models?num_parameters=min:0,max:6B&sort=downloads&search=gguf'
  if (window.api?.openExternal) {
    window.api.openExternal(url)
  } else {
    console.error('[App] window.api.openExternal not available')
    // Fallback: open in same window
    window.open(url, '_blank')
  }
}

const downloadLlamaModel = async (modelId: string) => {
  try {
    isDownloadingLlama.value = true
    downloadProgress.value = 0
    
    const result = await window.api.llama.downloadModel(modelId)
    if (result.success) {
      llamaModelPath.value = result.path
      await saveLlamaSettings()
      alert('Model downloaded successfully!')
    } else {
      alert('Download failed: ' + result.error)
    }
  } catch (error: any) {
    console.error('[App] Error downloading llama model:', error)
    alert('Download failed: ' + error.message)
  } finally {
    isDownloadingLlama.value = false
    downloadProgress.value = 0
  }
}

const downloadCustomModel = async () => {
  if (!customModelPath.value) return
  
  try {
    isDownloadingLlama.value = true
    downloadProgress.value = 0
    
    const result = await window.api.llama.downloadCustomModel(customModelPath.value)
    if (result.success) {
      llamaModelPath.value = result.path
      await saveLlamaSettings()
      alert('Model downloaded successfully!')
    } else {
      alert('Download failed: ' + result.error)
    }
  } catch (error: any) {
    console.error('[App] Error downloading custom llama model:', error)
    alert('Download failed: ' + error.message)
  } finally {
    isDownloadingLlama.value = false
    downloadProgress.value = 0
  }
}

const downloadFromHuggingFace = async () => {
  if (!llamaModelId.value) return
  
  try {
    isDownloadingLlama.value = true
    downloadProgress.value = 0
    
    const result = await window.api.llama.downloadCustomModel(llamaModelId.value)
    if (result.success) {
      llamaModelPath.value = result.path
      await saveLlamaSettings()
      alert('Model downloaded successfully!')
    } else {
      alert('Download failed: ' + result.error)
    }
  } catch (error: any) {
    console.error('[App] Error downloading from HuggingFace:', error)
    alert('Download failed: ' + error.message)
  } finally {
    isDownloadingLlama.value = false
    downloadProgress.value = 0
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
    pushToTalk.value = settings.pushToTalk ?? true
  } catch (e) {
    console.error('[App] Error loading settings from main:', e)
  }

  // Load llama settings
  try {
    const llamaSettings = await window.api.llama.getSettings()
    llamaEnabled.value = llamaSettings.enabled || false
    llamaModelPath.value = llamaSettings.modelPath || ''
    llamaModelId.value = llamaSettings.modelId || ''
    huggingFaceToken.value = llamaSettings.huggingFaceToken || ''
    hasLlamaBinary.value = await window.api.llama.checkBinary()
    
    // Load available models
    try {
      const models = await window.api.llama.getModels()
      availableLlamaModels.value = models
    } catch (e) {
      console.error('[App] Error loading available llama models:', e)
    }
  } catch (e) {
    console.error('[App] Error loading llama settings:', e)
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
   
  // Listen for hotkey down (push-to-talk mode)
  cleanupHotkeyDown = window.api.onHotkeyDown(() => {
    console.log('[Renderer] Hotkey down - starting recording for push-to-talk!')
    // Don't trigger recording while in settings, recording hotkey, or menu open
    if (!isRecording.value && !showSettings.value && !menuOpen.value && !isRecordingHotkey.value) {
      startRecording()
    }
  })
    
  // Listen for hotkey up (push-to-talk mode)
  cleanupHotkeyUp = window.api.onHotkeyUp(() => {
    console.log('[Renderer] Hotkey up - stopping recording for push-to-talk!')
    if (isRecording.value) {
      stopRecording()
    }
  })
   
  // Listen for hotkey changes from settings
  cleanupHotkeyChanged = window.api.onHotkeyChanged((hotkey) => {
    console.log('[Renderer] Hotkey changed to:', hotkey)
    currentHotkey.value = hotkey.replace('CommandOrControl', 'Ctrl')
  })
  
  // Listen for settings open from tray - only for main window
  cleanupSettings = window.api.onOpenSettings(() => {
    showSettings.value = true
    menuOpen.value = false
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
  cleanupHotkeyDown?.()
  cleanupHotkeyUp?.()
  cleanupHotkeyChanged?.()
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
  max-height: 100vh;
  overflow: hidden;
  color: #fff;
}

/* Menu Toggle */
.menu-toggle {
  position: fixed;
  top: 15px;
  left: 15px;
  font-size: 24px;
  cursor: pointer;
  z-index: 1001;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: 8px;
  color: #fff;
}

.menu-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Sidebar */
.sidebar {
  position: fixed;
  top: 0;
  left: -280px;
  width: 280px;
  height: 100vh;
  background: rgba(20, 20, 40, 0.98);
  z-index: 1002;
  transition: left 0.3s ease;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar.open {
  left: 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h3 {
  margin: 0;
  color: #00d4ff;
}

.close-menu {
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
}

.sidebar-content {
  padding: 20px;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  text-align: left;
  margin-bottom: 10px;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Sidebar Overlay */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.sidebar-overlay.open {
  opacity: 1;
  visibility: visible;
}

.container {
  max-width: 100%;
  margin: 0 auto;
  padding: 40px 20px 40px 80px;
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

.status-dot:not(.active) {
  background: #ef4444;
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
  padding: 12px 24px;
  font-size: 1.2rem;
  font-weight: bold;
  border: none;
  border-radius: 50px;
  background: #3b82f6;
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
  text-align: left;
}

.status-section {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 15px;
}

.setting-group label {
  display: block;
  margin-bottom: 5px;
  color: #aaa;
  text-align: left;
}

.hotkey-input, .select-input {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.85rem;
}

.select-input option {
  background: #1a1a2e;
  color: white;
}

/* Tab styles */
.tabs {
  display: flex;
  gap: 5px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 10px;
}

.tab-button {
  flex: 1;
  padding: 10px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #aaa;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.tab-button.active {
  background: #3b82f6;
  color: white;
  border-color: transparent;
}

.tab-content {
  animation: fadeIn 0.2s ease;
  overflow-y: auto;
  max-height: calc(100vh - 150px);
}

.settings-section {
  border: 2px solid rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
}

.setting-actions {
  margin-top: 20px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.save-button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #22c55e;
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
}

.save-button:hover {
  background: #16a34a;
}

.button-row-right {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
}

.button-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
}

.browse-button {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.8rem;
  cursor: pointer;
}

.browse-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.cancel-button {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: transparent;
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
}

.cancel-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.test-button {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s;
  text-align: left;
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

.button-row {
  display: flex;
  gap: 10px;
}

.button-row .test-button {
  flex: 1;
}

.custom-model-row {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.custom-model-row .test-button {
  width: auto;
  white-space: nowrap;
  padding: 6px 16px;
  background: #3b82f6;
  border: none;
}

.custom-model-row .test-button:hover {
  background: #2563eb;
}

.model-input {
  flex: 1;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.85rem;
  caret-color: #ffffff;
  min-height: 28px;
}

.model-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.3);
}

.model-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.model-status {
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  font-size: 0.85rem;
  word-break: break-all;
  text-align: left;
}

.path-row {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.path-status {
  flex: 1;
}

.select-btn {
  width: auto;
  white-space: nowrap;
  background: #3b82f6 !important;
  border: none;
}

.select-btn:hover {
  background: #2563eb !important;
}

.model-status .no-model {
  color: #f97316;
}

.transcription {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #ddd;
}

.transcription-small {
  font-size: 0.85rem;
  line-height: 1.5;
  color: #aaa;
  margin: 4px 0;
}

.transcription-history {
  max-height: 300px;
  overflow: hidden;
}

/* History tab styles */
.history-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.history-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 6px;
  margin-bottom: 4px;
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.history-actions {
  display: flex;
  gap: 4px;
}

.history-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 3px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: background 0.2s;
}

.history-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.history-btn-delete:hover {
  background: rgba(255, 100, 100, 0.3);
}

.history-timestamp {
  font-size: 0.65rem;
  color: #888;
  margin-bottom: 2px;
}

.history-text {
  font-size: 0.8rem;
  color: #ddd;
}

.no-history {
  text-align: center;
  color: #888;
  padding: 10px;
}

/* History tab heading */
.setting-group h3 {
  font-size: 1rem;
  margin: 0 0 8px 0;
}

.history-filter-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.8rem;
  margin-bottom: 8px;
}

.history-filter-input::placeholder {
  color: #888;
}

.history-filter-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.history-box {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
}

.history-header {
  margin-bottom: 8px;
}

.history-header h3 {
  margin: 0 0 8px 0;
  font-size: 1rem;
}

.transcription-list {
  max-height: 250px;
  overflow-y: auto;
}

.prompt-text {
  font-size: 0.75rem;
  color: #888;
  font-family: monospace;
  margin-bottom: 8px;
}

.recording-hint {
  text-align: center;
  color: #ef4444;
  font-size: 0.9rem;
  margin-top: 10px;
  animation: pulse 1s infinite;
}
</style>
