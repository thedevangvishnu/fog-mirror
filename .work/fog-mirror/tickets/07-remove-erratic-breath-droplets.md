# 07: Remove Erratic Breath Droplet Spawns

## What to build

Remove random droplet spawning inside `FogCanvas.addBreathSteam()` so that breathing on the mirror produces only uniform, smooth condensation without premature droplet runs or erratic drip sounds.

## Specification and contracts

- `docs/architecture.md#fogcanvas`
- Clean `addBreathSteam()` in `src/canvas/fogCanvas.ts`.

## Blocked by

- `06-mouth-whistle-pucker-detection`

## Acceptance criteria

- [ ] AC1: Breathing on the glass produces smooth, natural steam without spawning random water beads.
- [ ] AC2: No unexpected droplet drip sounds play during exhalation.

## Verification criteria

- Blow steam onto screen continuously; observe smooth radial steam plume with zero erratic droplet drops.
- Verify audio plays only steam hiss whoosh, no drip pings.
