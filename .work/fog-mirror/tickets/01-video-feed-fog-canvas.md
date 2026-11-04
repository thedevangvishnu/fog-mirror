# 01: Mirrored Video Feed & Interactive Fog Canvas

## What to build

A responsive browser app displaying a mirrored webcam video stream covered by an interactive canvas layer representing steamed glass. Users can wipe away the fog using mouse or touch drag interactions via `destination-out` compositing with soft feathered brush strokes.

## Specification and contracts

- `docs/architecture.md#fogcanvas`
- Canvas layer must mirror screen dimensions on window resize.
- Mirrored video feed styled with CSS `transform: scaleX(-1)`.

## Blocked by

None.

## Acceptance criteria

- [ ] AC1: Application loads in browser and renders the user's webcam stream mirrored horizontally.
- [ ] AC2: A frosted steam overlay covers the screen by default.
- [ ] AC3: Clicking and dragging with mouse or trackpad erases a clear circular path through the fog, revealing the clear video reflection underneath.
- [ ] AC4: Window resizing updates canvas buffer resolution without stretching or distortion.

## Verification criteria

- Start local dev server (`npm run dev`).
- Open `http://localhost:3000`.
- Grant camera permission; confirm reflection orientation (raising right hand moves hand on screen's right).
- Drag mouse across screen; confirm clean wipe stroke.
- Resize window; confirm wipe buffer maintains correct aspect ratio.
