# 15: Pencil-Feel Pinch Writing & Strict Fist Disambiguation

## Problem

1. **Fatal Conflict Between Pinch Writing and Fist Eraser**:
   When a user pinches to write (like holding a pencil), their index finger curls to touch the thumb, and their middle, ring, and pinky fingers naturally tuck into the palm. The current fist detection checks if all 4 fingers have a low curl ratio — which is TRUE during a writing pinch! As a result, the engine misidentifies the pinch as a closed fist eraser, moves the cursor to the center of the palm, forces `isPinching = false`, and erases giant circular blobs instead of writing.
2. **Lag / Sluggish Response**:
   `OneEuroFilter` beta parameter was set to `0.05` (10x too dampening), causing noticeable latency and dragging lag during hand movement. It felt like dragging a heavy sponge rather than writing with a responsive pencil.
3. **Threshold Calibration & False Triggers on Entering Frame**:
   The pinch threshold (`0.075`) was overly wide (triggering even when fingers were 2–3 inches apart). When a hand entered the camera frame from the edge, landmark crowding triggered instant false fist wipes on frame 1.
4. **Brush Purity**:
   The default wipe brush radius was too wide (20px radius = 40px swath) and too blurry to write legible words or letters.

## What to build

1. **Strict Pinch Priority & Fist Disambiguation**:
   - Detect Pinch FIRST. If fingers are pinched (`isPinching = true`), `isFist` is unconditionally `false`.
   - To qualify as a Fist:
     - All 4 non-thumb fingers must be curled.
     - Thumb must ALSO be curled across the knuckles (`dist(thumbTip, indexMcp) < 0.55 * handScale`).
     - Pinch distance must be clearly open (`pinchDist > 0.08`).
     - Must be sustained for at least 3 consecutive frames (`fistHoldCount >= 3`) before engaging the broad squeegee.
2. **Pencil-Grade Zero-Latency Tuning**:
   - Update `OneEuroFilter` parameters: `minCutOff = 1.2`, `beta = 0.5`. Keeps jitter-free stillness at rest, but removes latency entirely when moving.
3. **Calibrated Pinch Thresholds**:
   - Realistic contact distance: `pinchThreshold = 0.048` (engage at 0.048, release at 0.070).
4. **Crisp Pencil Stroke Rendering**:
   - Pinch writer brush radius default = `8px` (fine, legible pencil line).
   - Crisp radial gradient profile (concentrated core with defined edge, mimicking drawing on misty glass).
   - Fist eraser keeps broad radius (`55px`).

## Acceptance criteria

- [ ] AC1: Pinching index and thumb immediately starts writing at the fingertip contact point with zero lag.
- [ ] AC2: Middle, ring, and pinky curled during pinch writing NEVER trigger the fist eraser.
- [ ] AC3: Only an intentional tight closed fist (thumb curled across knuckles) triggers the broad squeegee eraser after a 3-frame confirmation.
- [ ] AC4: Hand entering the camera frame does not trigger accidental erasing.
- [ ] AC5: Wiped letters and drawings look sharp and legible, like a finger/pencil on misty glass.
- [ ] AC6: `npm run build` passes with zero errors.
