# whisperMeOff

A desktop voice transcription app using Whisper for accurate speech-to-text conversion.

## Features

- **Push-to-Talk**: Hold `Ctrl+Shift+R` (or custom hotkey) to record, release to transcribe
- **Real-time VU Meter**: Visual audio level indicator
- **Waveform Visualizer**: See your voice in real-time
- **System Tray**: Runs in background with tray icon
- **GPU Acceleration**: Uses GPU for fast transcription
- **Text Formatting**: Optional Llama.cpp integration for formatting transcriptions
- **Transcription History**: Automatically saves all transcriptions to local SQLite database
- **Model Download**: Download Whisper models directly from the app

## Requirements

- Windows 10/11
- Whisper model file (.bin) - can be downloaded from the app
- Optional: Llama model for text formatting

## Setup

1. Install dependencies:
```bash
cd whisperv2
npm install
```

2. Run in development mode:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build:win
```

## Usage

1. **Select Microphone**: Choose your input device in Settings
2. **Download Model**: Use Settings to download a Whisper model (or point to your own .bin file)
3. **Set Hotkey**: Customize the global recording hotkey (default: Ctrl+Shift+R)
4. **Record**: Hold the hotkey to start recording
5. **Transcribe**: Release the hotkey to stop and transcribe
6. **View History**: Check the History tab for past transcriptions

## Settings

### Audio Tab
- Microphone selection
- Audio input device

### Whisper Tab
- Model selection (download or use custom)
- Language selection (auto-detect supported)
- Translate to English option

### Llama Tab (Optional)
- Enable/disable text formatting
- Select Llama model for post-processing
- Download models from HuggingFace

### General Tab
- Hotkey configuration (push-to-talk mode)
- Record button to set custom hotkey

### History Tab
- View all past transcriptions
- Timestamps for each entry

## Push-to-Talk Mode

The app uses push-to-talk mode by default:
- **Hold** the hotkey to start recording
- **Release** to stop and transcribe

This provides more control than toggle mode and avoids accidental recordings.

## Keyboard Shortcuts

- `Ctrl+Shift+R` - Hold to record (default)
- Customize in Settings

## System Tray

The app runs in the system tray. Right-click the tray icon to:
- Show/Hide window
- Open Settings
- Exit

## Database

Transcriptions are stored in a local SQLite database at:
- Windows: `%APPDATA%/whisperMeOff/transcriptions.db`
- Mac: `~/Library/Application Support/whisperMeOff/transcriptions.db`

## License

MIT
