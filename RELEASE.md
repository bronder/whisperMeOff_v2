# Release Notes

## v1.1.0

### New Features
- **Push-to-Talk Mode**: Hold the hotkey to record, release to transcribe (no more toggle mode)
- **Transcription History**: All transcriptions are automatically saved to a local SQLite database
- **Built-in Model Download**: Download Whisper models directly from the app
- **Llama.cpp Integration**: Optional text formatting using local Llama models
- **HuggingFace Model Download**: Download Llama models directly from HuggingFace

### Improvements
- Cleaner push-to-talk implementation using uiohook-napi for global keyboard hooks
- SQLite database for persistent transcription storage
- Better hotkey recording with visual feedback

### UI Updates
- History tab to view past transcriptions
- Record button for easier hotkey configuration
- Download progress indicators

---

## v1.0.0

### Features
- Global hotkey recording (`Ctrl+Shift+R`)
- Real-time VU meter visualization
- Waveform visualizer
- System tray integration
- GPU-accelerated transcription (Vulkan/AMD)
- Custom model file selection
- Multi-language support

### UI Improvements
- Compact main window design
- Settings window without menu bar
- Dark theme throughout

---

## Installation

1. Download the latest release
2. Run `whisperMeOff.exe`
3. Configure your Whisper model path in Settings (or download from the app)

### First Time Setup
1. Open Settings (click the gear icon or use menu)
2. Go to Whisper tab and download a model (or select your own .bin file)
3. Optionally, enable and configure Llama.cpp in the Llama tab
4. Set your preferred hotkey in the General tab
5. Start recording by holding the hotkey!

### Prerequisites
- Whisper model file (.bin) required for transcription (can be downloaded in-app)
- Optional: Llama model for text formatting

## Database Location

Transcriptions are stored at:
- Windows: `%APPDATA%/whisperMeOff/transcriptions.db`
- Mac: `~/Library/Application Support/whisperMeOff/transcriptions.db`
