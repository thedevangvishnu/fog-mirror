# Fog Mirror

An interactive digital fog mirror that brings physical condensation and tactile friction to your laptop screen.

Breathe on your camera to fog up the glass with procedural condensation, and use your fingers or hand gestures in mid-air to wipe clear streaks through the steam—complete with procedural ASMR glass friction squeaks and dripping water physics.

## ✨ Features

- **Mouth Breath Condensation:** Real-time facial landmark tracking detects mouth opening and blowing posture, blooming dynamic steam plumes onto the mirror surface.
- **Microphone Turbulence VAD:** High-frequency audio bandpass filter (~2.4 kHz) distinguishes genuine breath whooshes from normal speech, preventing accidental triggers while speaking.
- **Touchless Hand Wiping:** Real-time hand landmark tracking tracks fingertips and pinch gestures, allowing you to wipe away the steam in mid-air or draw through the condensation.
- **ASMR Procedural Audio:**
  - Dynamic breath and steam hiss synthesis.
  - Velocity-sensitive wet glass squeaks (`triangle` oscillator + bandpass filter) triggered by finger movement across condensation.
  - Resonant water droplet drip sounds.
- **Gravity Condensation Droplets:** Heavy steam areas form condensation water beads that trickle down the glass under gravity, clearing fine streaks in their wake.
- **Subconscious Steam Message ("Ghost Message"):** A customizable handwritten reflection or quote rendered inside the steam layer that only emerges as the glass fogs up.
- **Content Creator Mode:** Press **`H`** to instantly hide the entire floating dock for clean, cinematic screen recordings.
- **Mouse & Touch Fallback:** Works seamlessly with mouse, trackpad, and touchscreen clicks/drags even without camera permissions.

## 🛠️ Stack & Architecture

- **Runtime:** Vanilla TypeScript + Vite
- **Computer Vision:** MediaPipe Tasks-Vision (`FaceLandmarker` + `HandLandmarker`) running locally via WebAssembly
- **Graphics:** HTML5 2D Canvas with `destination-out` composite masking and radial gradient feathered brushes
- **Sound:** Native Web Audio API procedural synthesis (zero external audio asset dependencies)

## ⌨️ Shortcuts

- **`Space`**: Manually blow steam
- **`M`**: Toggle ASMR sound
- **`C`**: Wipe/clear all fog
- **`F`**: Instantly steam up the glass
- **`H`**: Toggle HUD dock visibility (ideal for recording Reels/TikToks)

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Production build
npm run build
```

---

*Part of Devang's creative engineering explorations.*
