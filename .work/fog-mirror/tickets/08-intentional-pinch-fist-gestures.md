# 08: Intentional Gestures (Pinch-to-Wipe & Closed-Fist Wiper)

## What to build

Gate wiping behind intentional hand gestures. An open hand moving across the camera hovers a soft reticle without wiping. Wiping triggers when thumb and index fingertips pinch together, or when all fingers are curled into a closed fist.

## Specification and contracts

- `docs/architecture.md#visionengine`
- `HandPointer.isPinching: boolean` based on 3D Euclidean distance between landmark 4 and 8.
- Closed fist detection comparing finger tips (8, 12, 16, 20) with knuckles and wrist.
- `FogCanvas.wipeAt(pointerId, normX, normY, isPinching)` executing `destination-out` only when `isPinching === true`.

## Blocked by

- `07-remove-erratic-breath-droplets`

## Acceptance criteria

- [ ] AC1: Moving an open hand across the screen displays the tracking cursor but does NOT erase fog.
- [ ] AC2: Pinching thumb and index fingertips together immediately begins precision wiping/drawing.
- [ ] AC3: Releasing the pinch stops wiping immediately.
- [ ] AC4: Curling hand into a closed fist acts as a broad squeegee eraser.

## Verification criteria

- Wave open hand across foggy screen; confirm no fog is erased.
- Pinch thumb and index together; confirm clean drawing path through fog.
- Release pinch while moving hand; confirm wiping stops cleanly without trailing dots.
- Make a fist and wipe; confirm broad clearing stroke.
