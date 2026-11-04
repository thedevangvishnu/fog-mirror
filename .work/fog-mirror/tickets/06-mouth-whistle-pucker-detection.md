# 06: Mouth Whistle & Pucker Detection (Small "O" Blow)

## What to build

Update `VisionEngine` to detect small pursed "O" / whistle mouth shapes in addition to wide open mouth postures. Evaluates lip aspect ratio (circularity), horizontal mouth corner narrowing, and MediaPipe's `mouthPucker` / `mouthFunnel` blendshapes.

## Specification and contracts

- `docs/architecture.md#visionengine`
- Update `VisionEngine.processFrame` mouth detection logic.
- Landmark points: 13 & 14 (inner lips), 61 & 291 (lip corners), 33 & 263 (eyes).

## Blocked by

None (extends Ticket 02).

## Acceptance criteria

- [ ] AC1: Whistling or blowing air through a small pursed "O" mouth posture triggers steam condensation.
- [ ] AC2: Wide "HA" open mouth postures continue to trigger steam condensation.
- [ ] AC3: Neutral or closed mouth postures do not falsely trigger steam.

## Verification criteria

- Look into camera; purse lips into small "O" / whistle shape; verify breath meter activates and steam blooms on canvas.
- Open mouth wide ("HA"); verify steam activates.
- Keep face relaxed / neutral; verify breath meter stays at zero.
