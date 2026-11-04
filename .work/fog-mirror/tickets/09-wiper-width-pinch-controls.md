# 09: Wiper Width & Pinch Sensitivity Controls

## What to build

Refine default wiper brush radius from 38px to 20px for crisp drawing. Add interactive sliders in the floating frosted HUD dock to adjust Wiper Width (10px–60px) and Pinch Trigger Sensitivity.

## Specification and contracts

- `docs/architecture.md#hud--interactions`
- `FogCanvas.setBrushRadius(radius: number)`.
- `VisionEngine.pinchThreshold: number`.
- HUD pill dock controls with clean styling.

## Blocked by

- `08-intentional-pinch-fist-gestures`

## Acceptance criteria

- [ ] AC1: Default wiper width is 20px, enabling fine lines and handwritten doodles.
- [ ] AC2: Wiper width slider in HUD dynamically updates brush stroke thickness in real-time.
- [ ] AC3: Pinch sensitivity slider allows tuning finger trigger distance.

## Verification criteria

- Adjust wiper slider to minimum (10px); draw text on foggy mirror to verify fine precision.
- Adjust wiper slider to maximum (60px); verify broad stroke.
- Adjust pinch sensitivity slider; confirm activation threshold updates accordingly.
