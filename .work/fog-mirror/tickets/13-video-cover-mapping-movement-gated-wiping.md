# 13: Video Cover-Fit Coordinate Mapping & Movement-Gated Wiping

## Problem

1. **Coordinate Misalignment from `object-fit: cover`**:
   The webcam `<video>` element uses CSS `object-fit: cover; width: 100%; height: 100%`. When the browser window aspect ratio does not match the camera aspect ratio (e.g., 16:10 laptop screen vs 16:9 1280x720 video), the video feed is letterbox-cropped. Currently, code computes screen coordinates via naive scaling `pointer.x * window.innerWidth`, causing cursor and wipe positions to drift away from the physical hand seen on screen.
2. **Stationary Over-Erasing**:
   When holding a pinch or fist in place without moving, `FogCanvas.wipeAt` continues to call `destination-out` on every frame, eating away fog into an oversized blotch even when the user is not actively drawing.

## What to build

1. **Cover-Fit Viewport Transform**:
   - Calculate the displayed video bounding box taking into account `videoWidth`, `videoHeight`, `window.innerWidth`, and `window.innerHeight`.
   - Map normalized video landmarks into exact screen-space pixels matching the rendered feed.
2. **Delta-Gated Wiping**:
   - In `FogCanvas.wipeAt`, require a minimum spatial displacement (`dist >= 2.0px`) between consecutive frames to execute `destination-out` stroke interpolation.
   - Record initial contact point on first pinch/fist frame without clearing excessive area.

## Specification and contracts

- `src/main.ts`:
  - Add `getVideoRenderedRect(video: HTMLVideoElement): { x: number; y: number; width: number; height: number }`.
  - Transform pointer coordinates through the rendered video rect.
- `src/canvas/fogCanvas.ts`:
  - Gate stroke drawing by movement delta (`dist >= 2.0px`).

## Acceptance criteria

- [ ] AC1: The cursor reticle lands directly on the user's visible fingertips regardless of browser window aspect ratio.
- [ ] AC2: Holding a pinch stationary in mid-air does not hollow out or expand the erased area into a giant blotch.
- [ ] AC3: Swift wiping strokes remain smooth, continuous, and connected.
- [ ] AC4: TypeScript build passes (`npm run build`).
