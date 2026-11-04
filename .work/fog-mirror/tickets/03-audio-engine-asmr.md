# 03: Audio Engine — Mic Breath VAD & Procedural ASMR Synthesizer

## What to build

Audio subsystem providing acoustic breath turbulence detection via microphone bandpass filtering (1.5–4 kHz) combined with zero-asset Web Audio procedural synthesis for steam whooshes, velocity-sensitive glass wipe squeaks, and water drip pings.

## Specification and contracts

- `docs/architecture.md#audioengine`
- `AudioEngine.updateMicBreath()` returning normalized energy.
- `AudioEngine.playGlassSqueak(velocity)` modulating pitch and gain based on swipe speed.
- `AudioEngine.setSteamIntensity(intensity)` controlling pink noise gain.

## Blocked by

- `02-vision-engine-tracking`

## Acceptance criteria

- [ ] AC1: Physical exhalation onto the laptop mic/screen produces high-frequency energy that triggers or boosts steam condensation.
- [ ] AC2: Normal speaking voice (<1 kHz) does NOT falsely trigger steam.
- [ ] AC3: Moving finger across the glass triggers procedural wet-glass friction squeaks whose pitch and intensity reflect swipe velocity.
- [ ] AC4: Mute toggle silences all synthesized sounds without interrupting visual tracking.

## Verification criteria

- Speak into mic; verify breath meter remains low.
- Blow air directly onto the laptop keyboard/mic grill; verify breath meter spikes and steam sounds play.
- Swipe finger across canvas; verify squeaks scale with speed.
- Click mute button; confirm audio stops immediately.
