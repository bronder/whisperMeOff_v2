# whisperMeOff

A desktop voice transcription app using Whisper for accurate speech-to-text conversion.

## Features

- **Global Hotkey**: Press `Ctrl+Shift+R` anywhere to start/stop recording
- **Real-time VU Meter**: Visual audio level indicator
- **Waveform Visualizer**: See your voice in real-time
- **System Tray**: Runs in background with tray icon
- **GPU Acceleration**: Uses Vulkan/AMD GPU for fast transcription

## Requirements

- Windows 10/11
- FFmpeg (for audio conversion)
- Whisper model file (.bin)

## Setup

1. Install dependencies:
```bash
cd electron-vue
npm install
```

2. Run in development mode:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Usage

1. **Select Microphone**: Choose your input device in Settings
2. **Select Model**: Point to your Whisper .bin model file
3. **Set Hotkey**: Customize the global recording hotkey (default: Ctrl+Shift+R)
4. **Record**: Press the hotkey or click START to begin recording
5. **Transcribe**: Release the key or click STOP to transcribe

## Settings

- **Hotkey**: Global keyboard shortcut for recording
- **Microphone**: Input audio device selection
- **Model Path**: Location of Whisper model file (.bin)
- **Language**: Source language for transcription (auto-detect supported)

## Keyboard Shortcuts

- `Ctrl+Shift+R` - Start/Stop recording (default)
- Customize in Settings

## System Tray

The app runs in the system tray. Right-click the tray icon to:
- Show/Hide window
- Open Settings
- Exit

## License

MIT
