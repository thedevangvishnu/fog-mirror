# 04: Physicality & Surface Tension — Condensation Droplets & Moisture Rim

## What to build

Physical realism layer for condensation simulation: surface tension water bead accumulation along wiped stroke margins, natural thermodynamic evaporation over time, and gravity-driven water droplet particles that trickle down the glass when steam is dense.

## Specification and contracts

- `docs/architecture.md#fogcanvas`
- Evaporation step: slow linear or exponential decrease of idle fog mask.
- Droplet physics: particles with velocity, trail clearing, and bottom-edge exit triggers.

## Blocked by

- `03-audio-engine-asmr`

## Acceptance criteria

- [ ] AC1: Wiped strokes push moisture to boundaries, creating a soft surface-tension bead rim.
- [ ] AC2: Sustained heavy breathing causes condensation droplets to spawn and trickle downward under gravity.
- [ ] AC3: Falling droplets carve a thin, clear vertical streak in their wake.
- [ ] AC4: Droplets reaching the bottom of the viewport play a resonant water drip sound.
- [ ] AC5: Idle fog slowly evaporates and clears over time if no new breath is added.

## Verification criteria

- Steam up the glass completely; observe water droplets forming and slowly running down the screen.
- Verify clear drip trails left behind falling droplets.
- Listen for subtle water drip ping when droplets reach the bottom edge.
- Leave screen untouched for 30 seconds; verify steam naturally fades away.

## Agreed review checkpoint

Human Checkpoint: Test tactile feel, surface tension, and gravity droplet physics before UI polish.
