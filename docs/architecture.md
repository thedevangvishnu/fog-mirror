# Fog Mirror Architecture & System Design

## 1. System Overview

Fog Mirror is a browser-native spatial computing experiment that transforms a laptop screen into a steamy mirror surface using webcam reflection, computer vision, and procedural audio.

```
                  ┌────────────────────────┐
                  │    App Orchestrator    │
                  └───────────┬────────────┘
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  VisionEngine   │  │   AudioEngine   │  │    FogCanvas    │
│ (Face/Hand CV)  │  │ (ASMR & Mic VAD)│  │ (Physics & Wipe)│
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 2. Core Subsystems

### VisionEngine (`src/vision/visionEngine.ts`)
- **Perception:** MediaPipe Tasks-Vision (`FaceLandmarker` + `HandLandmarker`) running locally via WebAssembly and pre-bundled models.
- **Breath Detection:** Tracks upper lip (`landmark 13`) and lower lip (`landmark 14`) normalized by facial height (`landmark 10` to `152`).
- **Hand Tracking:** Tracks index fingertip (`landmark 8`) and pinch proximity (`landmark 4` and `8`). Coordinates are horizontally mirrored to match the mirrored webcam view.

### AudioEngine (`src/audio/audioEngine.ts`)
- **Acoustic Breath VAD:** Web Audio API `BiquadFilterNode` configured as a bandpass filter (1.5–4 kHz) to isolate high-frequency breath wind turbulence from human vocal chords (<1 kHz).
- **Procedural ASMR Synthesizer:**
  - *Steam Hiss:* Lowpass-filtered pink/brown noise modulated by breath intensity.
  * *Glass Wipe Squeak:* Triangle/sine oscillator with pitch-glide modulated by fingertip velocity vector $(\Delta x, \Delta y)$.
  * *Water Drop Ping:* Resonant sine ping with exponential volume decay.

### FogCanvas (`src/canvas/fogCanvas.ts`)
- **Dual-Canvas Architecture:** Offscreen condensation buffer + primary display canvas.
- **Wiping Mask:** Uses `destination-out` composite operation with feathered radial gradient brushes and stroke interpolation.
- **Physical Surface Tension:** Simulates moisture rims at stroke perimeters and gravity-driven condensation droplet particles.
- **Thermodynamics:** Gradual natural evaporation drying the glass when idle.

### HUD & Interactions (`src/ui/hud.ts`)
- Floating frosted glass pill dock (Apple glass aesthetic).
- Live breath energy meter and tracking status.
- Creator Mode (`H` hotkey) to completely hide UI for clean video recording.
- Full mouse/touch fallback for touchscreens and camera-denied environments.
