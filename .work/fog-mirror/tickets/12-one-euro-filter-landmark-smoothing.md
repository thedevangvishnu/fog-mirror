# 12: Vision Engine Landmark Smoothing (One Euro Filter) & Pinch Hysteresis

## Problem

MediaPipe hand landmarks suffer from high-frequency coordinate jitter (2–5px frame-to-frame) even when the user's hand is held completely stationary. This causes:
1. Spurious wiping on open/relaxed hands because noisy coordinate spikes dip below the pinch threshold.
2. Jittery, jagged wipe paths when moving the hand.
3. Rapid on/off flickering at the boundary of the pinch threshold.

## What to build

1. **One Euro Filter Implementation**:
   - Add an adaptive low-pass filter (`OneEuroFilter` and `LowPassFilter`) in `src/vision/smoothing.ts` or `src/vision/visionEngine.ts`.
   - Adaptive frequency filtering: heavy smoothing at low speeds (dampens jitter completely), near-zero latency at high speeds (instant responsiveness).
   - Filter landmark X and Y coordinates across frames for each detected hand.
2. **Scale-Invariant Pinch Detection with Hysteresis**:
   - Normalize the thumb-to-index distance by hand scale (`wrist` to `indexMcp` distance) so pinch sensitivity is uniform whether the hand is 30cm or 1m from the camera.
   - Dual-threshold hysteresis state machine:
     - `pinchOnThreshold`: finger distance ratio must fall below this value to engage wipe.
     - `pinchOffThreshold`: finger distance ratio must rise above this value to release wipe.
   - Eliminates single-threshold edge jitter.

## Specification and contracts

- `src/vision/oneEuroFilter.ts`: self-contained filter class.
- `src/vision/visionEngine.ts`:
  - Integrate filter bank for hand landmarks (x, y).
  - Implement hysteresis state: track `wasPinching` per hand index.
  - Return smoothed coordinates in `HandPointer`.

## Acceptance criteria

- [ ] AC1: Stationary hand held in front of camera shows steady cursor with zero jitter/vibration.
- [ ] AC2: Relaxed open hand moving across frame never false-triggers wiping.
- [ ] AC3: Pinching thumb and index engages wiping cleanly, and releasing disengages without boundary flickering.
- [ ] AC4: Hand distance changes (near vs far) do not break pinch or fist detection.
- [ ] AC5: TypeScript build passes (`npm run build`).
