# 11: Rewrite Fist Detection — Per-Finger Curl Ratio

## Problem

Current fist detection mixes absolute and relative coordinate comparisons in inconsistent ways. It compares some fingertips to their MCP joints and others to the wrist, without normalizing by hand scale properly. The result: at typical webcam distances with varying hand sizes, the thresholds never reliably fire. Screenshots confirm: a clearly closed fist shows no fist state — cursor stays as the small hover ring instead of the large purple fist ring.

## What to build

Replace the fist detection block with a per-finger curl ratio approach:

For each of the four non-thumb fingers:
1. Compute `tipToMcp` = 2D distance from fingertip to its MCP (knuckle) joint
2. Compute `mcpToWrist` = 2D distance from MCP to wrist
3. Curl ratio = `tipToMcp / mcpToWrist`
4. A curled finger has a low curl ratio (tip is close to MCP relative to the hand segment length)
5. Threshold: `curlRatio < 0.85` = curled

All four non-thumb fingers curled simultaneously = fist.

This approach is scale-invariant: works at any hand distance from camera.

## Specification and contracts

- File: `src/vision/visionEngine.ts`
- Replace the existing `isFist` block entirely
- Landmark indices: index=[5,8], middle=[9,12], ring=[13,16], pinky=[17,20] as [MCP, tip]
- Wrist = landmark[0]
- Guard against degenerate case: if `mcpToWrist < 0.01`, treat as not curled
- Curl threshold: `0.85` (tunable)
- No interface changes

## Blocked by

- `10-fix-pinch-2d-distance` (must land first so detection states don't conflict)

## Acceptance criteria

- [ ] AC1: Relaxed open hand → `isFist = false` → small hover cursor shown.
- [ ] AC2: Tight closed fist → `isFist = true` → large purple fist ring shown.
- [ ] AC3: Fist wipe produces a broad clearing stroke across the fog.
- [ ] AC4: Releasing fist back to open hand instantly drops `isFist = false`.
- [ ] AC5: `npm run build` passes with zero TypeScript errors.

## Verification

- Open relaxed hand: confirm small dotted hover cursor.
- Make tight fist: confirm large purple ring cursor appears.
- Drag fist across fog: confirm broad streak of fog cleared.
- Release fist: confirm cursor returns to small ring immediately.
