PRD: Sunset Lamp Controller — Initial macOS GUI App

1. Product Overview

Sunset Lamp Controller is a standalone macOS desktop application for controlling a Bluetooth sunset lamp currently exposed as SSL-99A4C3 through the iStrip-compatible BLE protocol.

The app should allow the user to connect to the lamp from their Mac, adjust RGB and brightness values, create and manage visual presets, and organize those presets into collapsible sections. The app should not require Docker, Home Assistant, a browser dashboard, or a terminal process once packaged. It should behave like a normal Mac application.

The initial version focuses on manual control and preset management. Automations, Raycast integration, natural language mood generation, music-reactive modes, and advanced effects should be planned for future versions but not implemented in this initial version unless explicitly requested later.

⸻

2. Goals

Primary Goals

Build a native macOS app that can:

* Connect to the Bluetooth sunset lamp named SSL-99A4C3.
* Keep the Bluetooth connection active while the app is open.
* Allow the user to manually control the lamp color using RGB sliders.
* Allow the user to control brightness.
* Allow the user to choose a color from a circular color spectrum/color picker UI.
* Allow the user to create, save, rename, edit, delete, reorder, and use presets.
* Display presets visually using a gradient preview that can represent the lamp’s visual output, including border light, main light, and middle light.
* Allow presets to be organized into user-created sections.
* Persist settings and presets locally across app restarts.

Secondary Goals

* Build the codebase in a way that can later support:
    * Raycast extension integration.
    * Local API or CLI control.
    * Natural language color selection.
    * Fading, pulsing, and custom effects.
    * Time-based automations.
    * More advanced mood/scene generation.

⸻

3. Non-Goals for Initial Version

The initial version should not include:

* Raycast extension.
* Home Assistant integration.
* Docker-based backend.
* Cloud sync.
* User accounts.
* Mobile app.
* Music-reactive lighting.
* Video-reactive lighting.
* Natural language AI mood generation.
* Full automation builder.
* Multi-device support unless trivial to support.
* App Store distribution.
* Apple notarization/signing beyond what is needed for local development use.

⸻

4. Recommended Tech Stack

Use the following stack unless there is a strong technical blocker:

Desktop App Framework

* Tauri
* React
* TypeScript

Backend / Native Layer

* Rust inside the Tauri backend.
* Use Rust for Bluetooth connection handling, BLE scanning, GATT writes, AES command encryption, and connection state.

UI Styling

Use one of the following:

* Tailwind CSS
* shadcn/ui
* Radix primitives where useful

The UI should feel clean, modern, and compact. It should not look like a generic utility app or a raw developer tool.

Local Storage

Use local app storage for presets and settings.

Acceptable options:

* Tauri store plugin.
* Local JSON file managed by the Tauri backend.
* SQLite only if the implementation remains simple.

For V1, a local JSON file is acceptable and preferred for simplicity.

⸻

5. Known Lamp Details

The lamp is a BLE device visible as:

SSL-99A4C3

The previous Python test successfully controlled the lamp using BLE with:

Characteristic UUID:
0000ac52-1212-efde-1523-785fedbeda25

The protocol used AES-encrypted 16-byte commands.

The app should port the working Python logic into Rust.

The existing Python command structure was:

command = [
    0x54, 0x52, 0x00, 0x57,
    0x02,
    0x01,
    0x00,
    r, g, b,
    brightness,
    0x40,
    0x00,
    0x00, 0x00, 0x00
]

AES key:

34 52 2A 5B 7A 6E 49 2C 08 09 0A 9D 8D 2A 23 F8

The Python implementation used AES-128 ECB.

The app should preserve this behavior unless testing shows a required change.

⸻

6. User Experience Requirements

6.1 App Launch

On launch, the app should show:

* App title: Sunset Lamp Controller
* Connection panel
* Manual controls
* Preset sections
* Current selected color preview

If the app is not connected, color controls should still be usable, but the user should clearly see that changes are not being sent to the lamp.

6.2 Connection Panel

The connection panel should include:

* Current connection status:
    * Disconnected
    * Scanning
    * Connecting
    * Connected
    * Connection failed
* Device name when found/connected.
* Connect button.
* Disconnect button.
* Optional Reconnect button if connection drops.
* Optional Auto-connect on launch toggle.

Expected behavior:

* When the user clicks Connect, scan for SSL-99A4C3.
* If found, connect to the lamp.
* Once connected, allow color writes.
* If the app loses connection, show a clear disconnected state.
* The app should not crash if the lamp is off, unavailable, already connected to the phone app, or out of range.

Connection errors should be user-friendly, for example:

Could not connect to SSL-99A4C3. Make sure the lamp is on and the iStrip app is closed.

⸻

7. Manual Color Controls

7.1 RGB Sliders

The manual control area should include sliders for:

* Red: 0–255
* Green: 0–255
* Blue: 0–255
* Brightness: 0–64

Each slider should show:

* Label
* Current numeric value
* Slider track
* Optional input field for precise numeric entry

Changing a slider should update:

* The current color preview.
* The current RGB state.
* The connected lamp, if connected.

To avoid spamming BLE writes, slider updates should be debounced or throttled.

Recommended debounce/throttle:

100–200ms

The user should not need to press “Apply” for every change, but there should be a setting or toggle for:

Live update

When Live update is enabled, slider changes send to the lamp automatically.

When Live update is disabled, show an Apply to Lamp button.

Default:

Live update: enabled

7.2 Color Picker Mode

The manual control area should support switching between:

Sliders
Color Wheel

The color wheel should be a circular or spectrum-style color picker.

Requirements:

* Choosing from the color wheel updates RGB values.
* RGB sliders should update to reflect the selected color.
* The lamp should update if connected and live update is enabled.
* Brightness remains controlled separately.

This does not need to be a custom-built color algorithm if a reliable React color picker library is easier. Choose a lightweight, well-maintained color picker component if appropriate.

7.3 Current Color Preview

Show the current selected color prominently.

The preview should include:

* Solid preview based on the current RGB value.
* Text display of current RGB and brightness.
* Optional hex value derived from RGB.

Example:

RGB: 255, 128, 0
Brightness: 64
HEX: #FF8000

⸻

8. Preset System

8.1 Preset Data Model

Each preset should store:

type LampPreset = {
  id: string;
  name: string;
  r: number;
  g: number;
  b: number;
  brightness: number;
  gradient?: {
    borderColor: string;
    mainColor: string;
    middleColor: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

8.2 Preset Sections Data Model

Presets should be grouped into sections.

type PresetSection = {
  id: string;
  name: string;
  collapsed: boolean;
  presetIds: string[];
  createdAt: string;
  updatedAt: string;
};

The app should include a default section:

My Presets

Optional default sections may include:

Sunset
Soft Lights
Vibrant
Experimental

But avoid adding too many built-in presets. The user should be able to customize their own.

8.3 Creating Presets

The user should be able to create a preset in two ways:

Option A: Create from Current Color

User clicks:

Save Current as Preset

The app opens a modal or inline editor with:

* Preset name
* Current RGB values prefilled
* Current brightness prefilled
* Gradient preview fields prefilled based on current RGB if possible
* Section selection

Option B: Create Custom Preset

User clicks:

New Preset

The app opens a preset editor with:

* Name
* R value
* G value
* B value
* Brightness value
* Section
* Optional gradient colors
* Optional notes

8.4 Using Presets

Clicking a preset should:

* Update current RGB and brightness.
* Update the manual controls.
* Send the preset values to the lamp if connected.
* Show the selected preset as active.

Preset cards should display:

* Preset name
* RGB values
* Brightness
* Linear gradient preview
* Optional small actions menu

8.5 Preset Gradient Preview

Because the sunset lamp can visually produce different colors across the projection, each preset should show a linear gradient preview.

The gradient is not necessarily the exact lamp output, but should help represent:

border light → main light → middle light

Each preset should store up to three visual preview colors:

* Border color
* Main color
* Middle color

The card preview should use:

linear-gradient(90deg, borderColor, mainColor, middleColor)

When a preset is created from current RGB values and no custom gradient is supplied, default all gradient stops to the same RGB-derived color.

The user should be able to edit these gradient colors manually later.

This is important because the lamp’s actual projected color may not match a simple RGB swatch.

8.6 Renaming Presets

The user should be able to rename any preset.

Renaming should:

* Update local storage.
* Preserve preset values.
* Preserve section placement.
* Preserve ordering.

8.7 Editing Presets

The user should be able to edit:

* Name
* RGB values
* Brightness
* Gradient preview colors
* Notes
* Section

The edit interaction may be:

* Modal
* Drawer
* Inline form

Choose whichever is fastest and cleanest.

8.8 Deleting Presets

The user should be able to delete a preset.

Deletion should require lightweight confirmation, such as:

Delete “Orange Sunset”? This cannot be undone.

8.9 Reordering Presets

The user should be able to reorder presets through drag and drop.

Requirements:

* Drag within a section to reorder.
* Drag from one section to another if feasible.
* Save the updated order persistently.

Use a stable drag-and-drop library if needed.

Recommended:

@dnd-kit

8.10 Preset Sections

The user should be able to:

* Create a section.
* Rename a section.
* Delete a section.
* Collapse/expand a section.
* Reorder presets inside sections.
* Move presets between sections.

When deleting a section, do not silently delete all contained presets.

Use one of these approaches:

Preferred:

Ask the user whether to move contained presets to “My Presets” or delete the presets too.

Simpler acceptable V1 behavior:

Move contained presets to “My Presets” automatically and show a message.

Do not allow deleting the last remaining section.

⸻

9. Initial Built-In Presets

Include a small set of starter presets based on observed calibration.

Use these as defaults:

const DEFAULT_PRESETS = [
  {
    name: "Red",
    r: 255,
    g: 0,
    b: 0,
    brightness: 64,
    gradient: {
      borderColor: "#FF0000",
      mainColor: "#FF0000",
      middleColor: "#FF0000"
    }
  },
  {
    name: "Green",
    r: 0,
    g: 255,
    b: 0,
    brightness: 64,
    gradient: {
      borderColor: "#00FF00",
      mainColor: "#00FF00",
      middleColor: "#00FF00"
    }
  },
  {
    name: "Blue",
    r: 0,
    g: 0,
    b: 255,
    brightness: 64,
    gradient: {
      borderColor: "#0000FF",
      mainColor: "#0000FF",
      middleColor: "#0000FF"
    }
  },
  {
    name: "Orange Sunset",
    r: 255,
    g: 128,
    b: 0,
    brightness: 64,
    gradient: {
      borderColor: "#FFB000",
      mainColor: "#FF8000",
      middleColor: "#FF4A00"
    }
  },
  {
    name: "Dark Orange",
    r: 255,
    g: 80,
    b: 10,
    brightness: 64,
    gradient: {
      borderColor: "#FF7A1A",
      mainColor: "#FF500A",
      middleColor: "#D93A00"
    }
  },
  {
    name: "Reddish Orange",
    r: 255,
    g: 40,
    b: 0,
    brightness: 64,
    gradient: {
      borderColor: "#FF5A00",
      mainColor: "#FF2800",
      middleColor: "#CC1F00"
    }
  },
  {
    name: "Pink Purple",
    r: 255,
    g: 0,
    b: 255,
    brightness: 64,
    gradient: {
      borderColor: "#FF7AFF",
      mainColor: "#FF00FF",
      middleColor: "#A000FF"
    }
  },
  {
    name: "Blue Green Border",
    r: 0,
    g: 255,
    b: 255,
    brightness: 64,
    gradient: {
      borderColor: "#00FFAA",
      mainColor: "#00D5FF",
      middleColor: "#008CFF"
    }
  },
  {
    name: "Pink Yellow Border",
    r: 255,
    g: 255,
    b: 255,
    brightness: 64,
    gradient: {
      borderColor: "#FFE066",
      mainColor: "#FFB3D9",
      middleColor: "#FFD1E8"
    }
  }
];

These values can be refined later.

⸻

10. Persistence Requirements

The app should persist:

* Presets
* Preset sections
* Preset ordering
* Collapsed/expanded section state
* Last selected RGB value
* Last brightness value
* Live update toggle
* Auto-connect preference

Local storage format should be human-readable if possible.

Example structure:

{
  "settings": {
    "deviceName": "SSL-99A4C3",
    "autoConnect": false,
    "liveUpdate": true,
    "lastColor": {
      "r": 255,
      "g": 128,
      "b": 0,
      "brightness": 64
    }
  },
  "sections": [],
  "presets": []
}

On first launch, seed the app with default sections and default presets.

⸻

11. BLE Backend Requirements

11.1 Tauri Commands

Implement Tauri commands such as:

connect_lamp()
disconnect_lamp()
get_connection_status()
set_color(r: number, g: number, b: number, brightness: number)
scan_for_lamp()

Optional commands:

get_known_device()
reconnect_lamp()

11.2 Validation

The backend should validate:

r: 0–255
g: 0–255
b: 0–255
brightness: 0–64

Invalid values should return a clear error instead of panicking.

11.3 Connection State

The backend should keep track of connection state while the app is open.

The frontend should be able to display this state.

The app should handle:

* Lamp unavailable.
* Bluetooth off.
* iStrip app currently connected to lamp.
* Connection drop.
* Failed GATT write.
* App close while connected.

11.4 BLE Writes

When connected, the backend should write encrypted color commands to:

0000ac52-1212-efde-1523-785fedbeda25

Use the known AES key and command format from the working Python script.

⸻

12. UI Layout

The app should have a clean two-column or dashboard layout.

Recommended layout:

┌───────────────────────────────────────────────┐
│ Sunset Lamp Controller                         │
│ Connected to SSL-99A4C3                         │
├───────────────────────┬───────────────────────┤
│ Manual Controls        │ Presets               │
│                        │                       │
│ Color Preview          │ [Section: Sunset]      │
│ Sliders / Color Wheel  │ [Preset Cards...]      │
│ Brightness             │                       │
│ Apply / Live Toggle    │ [Section: Custom]      │
│                        │ [Preset Cards...]      │
└───────────────────────┴───────────────────────┘

Left Panel

* Connection status
* Current color preview
* Sliders/color wheel switch
* RGB sliders
* Brightness slider
* Live update toggle
* Save current as preset

Right Panel

* Preset sections
* Preset cards
* New preset button
* New section button

⸻

13. Component Breakdown

Suggested React components:

App
ConnectionPanel
ColorControlPanel
RgbSliders
ColorWheelPicker
BrightnessSlider
CurrentColorPreview
PresetPanel
PresetSection
PresetCard
PresetEditorModal
SectionEditorModal
ConfirmDialog

Suggested frontend modules:

types.ts
storage.ts
presets.ts
lampApi.ts
colorUtils.ts

Suggested backend modules:

main.rs
lamp.rs
protocol.rs
state.rs
errors.rs

⸻

14. Error Handling

Show user-friendly errors in the UI.

Examples:

Could not find SSL-99A4C3. Make sure the lamp is plugged in and nearby.
Connection failed. Close the iStrip app and try again.
Failed to send color. The lamp may have disconnected.
Bluetooth permission is required to control the lamp.

Errors should not crash the app.

⸻

15. macOS Permissions

The packaged app should include the necessary macOS Bluetooth permission description.

Include in the appropriate Tauri/macOS config:

NSBluetoothAlwaysUsageDescription

Suggested description:

Sunset Lamp Controller uses Bluetooth to connect to and control your sunset lamp.

If there are additional required macOS permission keys for BLE, add them as needed.

⸻

16. Packaging Requirements

The app should be buildable as a standalone macOS app.

Expected command:

npm run tauri build

Expected output:

Sunset Lamp Controller.app

The app should be runnable by double-clicking the .app.

For initial personal use, do not focus on App Store distribution, notarization, or public release packaging.

⸻

17. Acceptance Criteria

The initial version is complete when:

Connection

* The app launches as a macOS desktop app.
* The user can scan/connect to SSL-99A4C3.
* The user can disconnect.
* The app shows connection status clearly.
* The app does not crash if the lamp is unavailable.

Manual Controls

* The user can adjust R, G, and B values.
* The user can adjust brightness.
* The user can use a circular/spectrum color picker.
* Color picker and sliders stay in sync.
* The lamp updates when connected.
* BLE writes are throttled/debounced.

Presets

* The app includes useful starter presets.
* The user can create a preset from current RGB/brightness.
* The user can create a preset manually.
* The user can use a preset to change the lamp.
* The user can rename presets.
* The user can edit presets.
* The user can delete presets.
* Presets show gradient previews.
* Presets persist after restarting the app.

Sections

* The user can create preset sections.
* The user can rename preset sections.
* The user can collapse and expand sections.
* The user can reorder presets.
* The user can organize presets into sections.
* Section state persists after restart.

Packaging

* The app can be built into a standalone macOS .app.
* The app can run without Docker, Home Assistant, or a terminal process.

⸻

18. Implementation Order

Build in this order:

Phase 1: Project Setup

* Create Tauri + React + TypeScript project.
* Set up basic UI shell.
* Add styling system.
* Add local storage structure.

Phase 2: BLE Backend

* Port Python lamp protocol to Rust.
* Implement AES command encryption.
* Implement scan/connect/disconnect.
* Implement set_color.
* Test with the actual lamp.

Phase 3: Manual Controls

* Build connection panel.
* Build RGB sliders.
* Build brightness slider.
* Build current color preview.
* Wire sliders to backend.
* Add live update debounce.

Phase 4: Presets

* Add default presets.
* Add preset cards.
* Add create-from-current flow.
* Add manual preset editor.
* Add rename/edit/delete.
* Add gradient previews.
* Persist presets.

Phase 5: Sections and Organization

* Add preset sections.
* Add create/rename/delete section.
* Add collapse/expand.
* Add drag-and-drop preset reordering.
* Add moving presets between sections.
* Persist section order and collapse state.

Phase 6: Polish

* Add friendly errors.
* Add loading states.
* Add empty states.
* Improve spacing and visual hierarchy.
* Verify macOS packaging.
* Verify app can be opened normally.

⸻

19. Future Roadmap

Do not implement these in V1, but keep the architecture flexible enough to support them.

V2: Effects

* Fade between two colors.
* Pulse/breathing mode.
* Sunrise transition.
* Sunset transition.
* Looping color scenes.

V3: Raycast Integration

* Raycast commands for presets.
* Raycast command to set RGB values.
* Raycast command to toggle/connect/disconnect.
* Potential local API or CLI bridge.

V4: Local Automation

* Schedule presets by time.
* Create routines.
* Trigger scenes based on app usage or focus mode.
* Create a simple flow builder.

V5: Natural Language

* Ask for moods like:
    * ocean blue
    * cozy study
    * late night calm
    * sunset but softer
* Convert mood prompts into RGB/brightness/preset suggestions.

V6: Music/Mood Suggestions

* Suggest lighting based on a song or vibe.
* Potentially pulse/fade based on tempo or manually selected rhythm.

⸻

20. Development Notes

Prioritize correctness and maintainability over trying to over-polish the first version.

The most important technical risk is BLE behavior in the Tauri/Rust backend. Implement and test the connection/color-write path before spending too much time on advanced UI features.

The app should be designed so that future integrations can call the same internal lamp control functions used by the GUI.

Avoid hardcoding too much UI state into components. Keep lamp state, preset state, and settings state clearly separated.

The final result should feel like a small but polished native utility app for controlling the sunset lamp.