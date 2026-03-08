// Audio Recording Service using Web Audio API

export class AudioRecorder {
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private isRecording = false
  
  private onLevelChange: ((level: number) => void) | null = null
  private animationFrame: number | null = null

  async start(deviceId?: string): Promise<void> {
    try {
      // Get microphone access
      const constraints: MediaStreamConstraints = {
        audio: deviceId 
          ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          : { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      }
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Set up MediaRecorder for saving audio
      this.audioChunks = []
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }
      
      this.mediaRecorder.start(100) // Collect data every 100ms
      
      // Create audio context and analyser for visualization
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.8
      
      // Resume audio context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      
      // Connect microphone to analyser
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.source.connect(this.analyser)
      
      this.isRecording = true
      
      // Start monitoring audio levels
      this.monitorLevels()
      
    } catch (error) {
      console.error('[AudioRecorder] Error starting:', error)
      throw error
    }
  }

  private monitorLevels(): void {
    if (!this.analyser || !this.isRecording) return
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    
    const updateLevel = () => {
      if (!this.analyser || !this.isRecording) return
      
      this.analyser.getByteFrequencyData(dataArray)
      
      // Calculate RMS (root mean square) for better level representation
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sum / dataArray.length)
      
      // Convert to 0-100 scale (with some scaling)
      const level = Math.min(100, Math.round(rms * 1.5))
      
      if (this.onLevelChange) {
        this.onLevelChange(level)
      }
      
      this.animationFrame = requestAnimationFrame(updateLevel)
    }
    
    updateLevel()
  }

  setLevelCallback(callback: (level: number) => void): void {
    this.onLevelChange = callback
  }

  async stop(): Promise<Blob | null> {
    this.isRecording = false
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
    
    // Stop MediaRecorder and get audio data
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null)
        return
      }
      
      // FIX: Request final data chunk before stopping to ensure EBML header is complete
      // This fixes the issue with very short recordings (< 100ms) that result in malformed webm
      try {
        this.mediaRecorder.requestData()
      } catch (e) {
        // Ignore if requestData fails
      }
      
      // Small delay to ensure final chunk is collected
      setTimeout(() => {
        this.mediaRecorder!.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
          this.audioChunks = []
          
          // Stop all tracks
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop())
            this.mediaStream = null
          }
          
          resolve(audioBlob)
        }
        
        this.mediaRecorder!.stop()
      }, 50)
    })
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  dispose(): void {
    this.stop()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.analyser = null
    this.source = null
  }
}

// Helper to get available audio input devices
export async function getAudioDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter(d => d.kind === 'audioinput')
}

// Helper to request microphone permission
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(track => track.stop())
    return true
  } catch {
    return false
  }
}
