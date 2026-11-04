# 02: Vision Engine — Mouth Breath Detection & Hand Fingertip Tracking

## What to build

MediaPipe Tasks-Vision integration running local WebAssembly models (`FaceLandmarker` and `HandLandmarker`). Detects mouth opening/exhale postures to dynamically spawn steam plumes on the mirror surface, and tracks index fingertip positions to wipe away fog touchlessly in mid-air.

## Specification and contracts

- `docs/architecture.md#visionengine`
- `VisionEngine.processFrame(video)` returning `{ breath, pointers }`.
- Fingertip coordinates normalized and mirrored ($x_{\text{screen}} = 1 - x_{\text{camera}}$).

## Blocked by

- `01-video-feed-fog-canvas`

## Acceptance criteria

- [ ] AC1: When user opens mouth in a blowing posture, steam condensation dynamically blooms outward from the mouth location.
- [ ] AC2: Index fingertip position is tracked in real-time with an active tracking reticle.
- [ ] AC3: Moving finger across the air wipes the fog layer cleanly in real-time.
- [ ] AC4: Fast finger sweeps interpolate intermediate points so stroke lines do not break into disconnected circles.

## Verification criteria

- Verify model files load from `/wasm` and `/models` without external CDN requests.
- Hold hand up to webcam; move index finger; verify on-screen cursor follows fingertip and erases fog.
- Open mouth into camera; verify steam plume spawns and expands.
- Verify 60 FPS performance on laptop.

## Agreed review checkpoint

Human Checkpoint: Test live camera breath and hand tracking interaction before moving to audio and physics.
