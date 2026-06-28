# Sunset Lamp Controller

A native macOS desktop app for controlling Bluetooth sunset lamps over the iStrip-compatible BLE protocol. Connect to your lamp, pick colors in real time, save presets, and build multi-step lighting loops — no Docker, Home Assistant, or browser dashboard required.

**[Download v0.1.0 →](https://github.com/rawsab/sunlight/releases/tag/v0.1.0)**

---

## Screenshots

### Presets

Organize favorite colors into sections and apply them with one click.

<img width="1205" height="945" alt="Screenshot 2026-06-28 at 12 16 42 AM" src="https://github.com/user-attachments/assets/f04c523b-86dd-41d8-b278-25fc954ca2e7" />

### Loops

Run multi-step color sequences with smooth transitions. See live progress while a loop plays.

<img width="1205" height="945" alt="Screenshot 2026-06-28 at 12 17 54 AM" src="https://github.com/user-attachments/assets/0d507c71-8ff6-481a-9c18-b7e4fb7e236d" />

### Loop editor

<img width="1205" height="945" alt="Screenshot 2026-06-28 at 12 17 47 AM" src="https://github.com/user-attachments/assets/3da9a5a9-4487-47a7-addf-e47035828119" />

---

## Features

- **Bluetooth connection** — Scan, connect, reconnect, and disconnect from your lamp directly from the app
- **Live color control** — Color wheel or RGB sliders with brightness; toggle live updates on or off
- **Presets** — Save, edit, reorder, and organize colors into collapsible sections
- **Loops** — Create multi-step lighting sequences with per-step hold times and smooth or instant transitions
- **Smooth transitions** — Configurable fade duration when switching presets or loop steps
- **Import / export** — Back up and restore presets, loops, and settings as JSON
- **Local persistence** — Everything is stored on your Mac; no account or cloud sync

---

## Requirements

- **macOS** (Apple Silicon or Intel)
- **Bluetooth** enabled
- A compatible **sunset lamp** that appears over BLE with an `SSL-` device name (iStrip protocol)

> **Tip:** Close the official iStrip mobile app before connecting. Only one client can control the lamp at a time.

---

## Install

1. Download the latest release from [GitHub Releases](https://github.com/rawsab/sunlight/releases/tag/v0.1.0).
2. Open the `.dmg` and drag **Sunset Lamp Controller** into Applications.
3. Launch the app, turn on your lamp, and click **Connect**.

Because the app is not notarized, macOS may block it on first launch. If that happens, open **System Settings → Privacy & Security** and choose **Open Anyway**.

---

## Quick start

1. **Connect** — Use the connection panel in the sidebar. If the lamp isn't found, try **Refresh** and make sure the lamp is powered on.
2. **Pick a color** — Use the color wheel or sliders. With **Live** enabled, changes are sent to the lamp immediately.
3. **Save a preset** — Click **Save Current as Preset** to add the color to your library.
4. **Run a loop** — Switch to the **Loops** tab, open or create a loop, and press **Play**.

Settings (gear icon) include auto-connect on launch, default transition behavior, and import/export.

---

## Build from source

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)
- [Tauri prerequisites for macOS](https://v2.tauri.app/start/prerequisites/)

### Commands

```bash
npm install
npm run tauri dev      # development
npm run tauri build    # production .app / .dmg in src-tauri/target/release/bundle/
```

---

## Tech stack

- [Tauri 2](https://v2.tauri.app/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- Rust backend with `btleplug` for Bluetooth LE
- [Tailwind CSS](https://tailwindcss.com/) for styling


---

## License

Private / personal use. License TBD.
