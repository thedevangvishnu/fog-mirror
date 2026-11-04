# 10: Fix Pinch Detection — 2D XY Distance Only

## Problem

Pinch detection currently uses 3D Euclidean distance including the `.z` depth component from MediaPipe landmarks. MediaPipe's `.z` values at typical webcam distances are noisy and fluctuate unpredictably frame-to-frame. This causes the pinch distance to randomly dip below the threshold on a relaxed open hand, triggering spurious wipe strokes even with no intentional gesture.

Screenshots confirm: chaotic zigzag wipe paths across the entire glass on a visibly open hand.

## What to build

Remove `.z` from the pinch distance calculation entirely. Compute distance using only normalized `x` and `y` screen coordinates, which are stable and consistent across working distances.

Raise the default threshold slightly from `0.07` to `0.09` to give more headroom against false fires on a relaxed hand (fingers naturally sit ~0.08–0.10 apart in screen-space).

## Specification and contracts

- File: `src/vision/visionEngine.ts`
- Change `pinchDist` computation from `Math.hypot(dx, dy, dz)` to `Math.hypot(dx, dy)`
- Change default `this.pinchThreshold` from `0.07` to `0.09`
- No interface changes — `HandPointer.pinchDistance` still stores the new 2D value

## Blocked by

- Nothing

## Acceptance criteria

- [ ] AC1: Relaxed open hand moving across the screen does NOT trigger any wipe strokes.
- [ ] AC2: A deliberate slow pinch (thumb + index approaching) cleanly begins wiping at the contact point.
- [ ] AC3: Releasing the pinch stops wiping with no trailing artifacts.
- [ ] AC4: `npm run build` passes with zero TypeScript errors.

## Verification

- Wave relaxed open hand; confirm zero fog erasure.
- Slowly bring thumb and index together; confirm wipe starts cleanly.
- Release; confirm wipe stops immediately.
