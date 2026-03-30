# 🎵 Offline Spotify - Premium Local Music Experience

> **Your Local Library, Reimagined.** A high-fidelity, offline-first music player that brings the premium Spotify experience to your local audio collection.

![License](https://img.shields.io/badge/license-ISC-green)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)
![Vibe](https://img.shields.io/badge/vibe-premium-blueviolet)

---

## ✨ Key Features

### 📱 Mobile Remote Control
Control your music from anywhere on your WiFi.
- **QR Connection**: Scan the terminal QR code to instantly connect your phone.
- **Remote Queue**: Manage your "Next Up" and "Recommended" tracks from mobile.
- **Sync Controls**: Real-time volume, seek, and playback synchronization.

### 🎨 Visual Vibe & Aesthetics
- **Dynamic Color Extraction**: The UI background smoothly transitions its gradient to match the "vibe" of the current song's icon.
- **Visualizer Gallery**: Choose between three immersive modes: **Bars**, **Pulse** (Circular), and **Wave** (Sinusoidal).
- **Glassmorphism Design**: A sleek, modern dark-mode interface with smooth animations and transitions.

### 🤖 AI-Powered Intelligence
- **AI DJ**: Contextual track recommendations based on your recent listening habits (powered by local LLMs via Ollama).
- **Auto-Metadata**: Intelligent labeling and icon assignment for your local library.

### 🌙 Premium Utilities
- **Sleep Timer**: Set a timer (15–60 mins) with a gentle volume fade-out at the end.
- **Global Keyboard Shortcuts**: Control the player without leaving your current tab.

---

## 🚀 Quick Start

### 1. Installation
Ensure you have [Node.js](https://nodejs.org/) installed.
```bash
git clone https://github.com/your-username/offline-spotify.git
cd offline-spotify
npm install
```

### 2. Add Your Music
Place your music files (.mp3, .wav, .m4a) into the `music/` directory (or configure the path in `.env`).

### 3. Launch
The easiest way to start is by running the batch script:
```bash
./start.bat
```
This will:
1. Start the Node.js server.
2. Open the host player in your default browser.
3. **Show a QR code** in the terminal—scan it with your phone to start the remote!

---

## ⌨️ Global Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Play / Pause |
| `N` | Next Track |
| `P` | Previous Track |
| `L` | Like / Unlike Song |
| `M` | Mute / Unmute |
| `S` | Toggle Shuffle |
| `R` | Toggle Repeat |
| `Q` | Toggle Queue View |
| `E` | Toggle Visualizer Mode |

---

## 🛠️ Tech Stack
- **Backend**: Node.js, Express, Multer
- **Frontend**: Vanilla HTML5, CSS3 (Custom Properties, Gradients), Modern JS (ES6+)
- **Networking**: `express.static` for high-performance streaming
- **AI Integration**: Ollama (Phi-3) for metadata and recommendations

---

## 🤝 Contributing
Feel free to fork this project and submit PRs! Suggestions for new visualizer modes or better AI models are always welcome.

## 📄 License
This project is licensed under the ISC License.

---
*Made with ❤️ for audio lovers who appreciate the offline vibe.*
