<p align="center">
  <img width="1024" src="https://github.com/user-attachments/assets/fbf0a597-f567-4b6a-9823-4d8a3055a63d" alt="ray.so">
</p>

<h1 align="center">
   Sunlight
</h1>

<div align="center">

[![macOS](https://img.shields.io/badge/platform-macOS-007AFF?style=flat&logo=apple&logoColor=white&labelColor=3D444D)](https://github.com/rawsab/sunlight/releases/latest)
[![Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8D8?style=flat&logo=tauri&logoColor=white&labelColor=3D444D)](https://v2.tauri.app/)
[![Release](https://img.shields.io/github/v/release/rawsab/sunlight?style=flat&logo=github&label=release&labelColor=3D444D&color=5865F2)](https://github.com/rawsab/sunlight/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-22C55E?style=flat&labelColor=3D444D)](LICENSE)

</div>


<h3 align="center">
  Built by <a href="https://github.com/rawsab" target="_blank" rel="noopener noreferrer">Rawsab Said</a>
</h3>
<p align="center">
  A native macOS app for controlling iStrip-compatible Bluetooth sunset lamps. Connect to your lamp, adjust colors in real time, organize presets, and create custom lighting sequences — all from your desktop.
</p>


---

## Quick Installation

Built with Tauri, React, TypeScript, and Rust, Sunlight communicates directly with iStrip-compatible lamps over Bluetooth Low Energy (BLE). No additional hardware, cloud services, or external servers required.

<a href="https://github.com/rawsab/sunlight/releases/tag/v0.1.0" target="_self"><img width="200" src="https://github.com/user-attachments/assets/29236d73-1dbb-4437-81ed-69554ac0eee5" alt="Download for macOS" /></a>

**[Download v0.1.0 →](https://github.com/rawsab/sunlight/releases/tag/v0.1.0)**


## Highlighted Features

### Color Presets

Save your favorite colors, organize them into collapsible sections, and switch between them instantly.

<img width="1205" alt="Sunlight color presets" src="https://github.com/user-attachments/assets/f04c523b-86dd-41d8-b278-25fc954ca2e7" />

### Lighting Loops

Create and play custom lighting sequences with configurable timing and transitions. Monitor the current step and playback progress in real time.

<img width="1205" alt="Sunlight lighting loops" src="https://github.com/user-attachments/assets/0d507c71-8ff6-481a-9c18-b7e4fb7e236d" />

### Loop Editor

Build multi-step sequences with individually configured colors, hold durations, and transition behaviors.

<img width="1205" alt="Sunlight loop editor" src="https://github.com/user-attachments/assets/3da9a5a9-4487-47a7-addf-e47035828119" />



## Feature List

- **Bluetooth connectivity** — Discover, connect, reconnect, and disconnect from compatible lamps using Bluetooth Low Energy.
- **Real-time color control** — Adjust colors using a color wheel or RGB sliders, with brightness control and optional live updates.
- **Custom presets** — Save, edit, reorder, and organize your favorite colors into collapsible sections.
- **Lighting loops** — Build multi-step color sequences with configurable hold times and smooth or instant transitions.
- **Smooth color transitions** — Configure fade durations when switching presets or advancing through loop steps.
- **Import and export** — Back up and restore presets, loops, and application settings using JSON files.
- **Local persistence** — Store your configurations directly on your Mac, without accounts or cloud synchronization.
- **Auto-connect** — Automatically reconnect to your lamp when launching the application.

## Compatibility

Sunlight supports macOS on both Apple Silicon and Intel Macs.

You'll need:

- A Mac with Bluetooth enabled.
- An iStrip-compatible Bluetooth sunset lamp that advertises an `SSL-` device name.

> **Note:** Close the official iStrip mobile app before connecting through Sunlight. The lamp supports only one active client connection at a time.



## Installation

1. Download the latest `.dmg` from [GitHub Releases](https://github.com/rawsab/sunlight/releases/latest).
2. Open the disk image and drag **Sunlight** into your Applications folder.
3. Launch Sunlight, power on your lamp, and click **Connect**.

### macOS security notice

Sunlight is not currently notarized by Apple. On first launch, macOS may prevent the application from opening.

If this happens, navigate to **System Settings → Privacy & Security** and select **Open Anyway** after attempting to launch the application.



## Getting started

1. **Connect your lamp** — Open Sunlight and use the connection panel in the sidebar to discover and connect to your device.
2. **Choose a color** — Use the color wheel or RGB sliders to select a color. Enable **Live** to send adjustments immediately.
3. **Create presets** — Save your current color as a preset and organize your presets into sections for easy access.
4. **Build lighting loops** — Open the Loops tab to create a sequence of colors, configure transitions, and start playback.

Additional preferences, including automatic reconnection, default transition settings, and data import/export, are available from the Settings menu.



## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Rust](https://rustup.rs/)
- [Tauri v2 macOS prerequisites](https://v2.tauri.app/start/prerequisites/)

### Run locally

Clone the repository and install the dependencies:

```bash
git clone https://github.com/rawsab/sunlight.git
cd sunlight
npm install
```

Start the application in development mode:

```bash
npm run tauri dev
```

### Build for production

```bash
npm run tauri build
```

Production `.app` and `.dmg` bundles are generated in:

```text
src-tauri/target/release/bundle/
```



## Tech stack

- **Desktop framework:** [Tauri 2](https://v2.tauri.app/)
- **Frontend:** [React](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/)
- **Backend:** Rust
- **Bluetooth communication:** [`btleplug`](https://github.com/deviceplug/btleplug)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)

Sunlight uses a Rust backend for Bluetooth Low Energy communication with iStrip-compatible devices, while the React frontend provides the desktop interface for color controls, presets, and lighting sequences.



## License

Sunlight is open-source software licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
