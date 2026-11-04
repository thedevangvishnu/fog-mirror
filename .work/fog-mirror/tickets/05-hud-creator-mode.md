# 05: Minimalist Frosted HUD & Creator Recording Mode

## What to build

A refined, Apple-inspired floating frosted glass pill dock providing status feedback, sound toggle, reset controls, full steam button, customizable subconscious message reveal, and Creator Recording Mode (`H` hotkey) to completely strip the UI for clean video capture.

## Specification and contracts

- `docs/architecture.md#hud--interactions`
- Clean CSS frosted glass styling (`backdrop-filter: blur(20px)`).
- Keyboard shortcuts: `H` (hide UI), `Space` (manual steam blow), `C` (clear glass), `F` (full steam), `M` (toggle sound).

## Blocked by

- `04-surface-tension-droplets`

## Acceptance criteria

- [ ] AC1: Floating pill dock displays system readiness status dot, live breath meter bar, and control buttons.
- [ ] AC2: Pressing `H` smoothly toggles the visibility of the entire HUD dock and helper text.
- [ ] AC3: Keyboard shortcuts (`Space`, `C`, `F`, `M`) operate reliably.
- [ ] AC4: Full screen toggle adapts layout seamlessly.
- [ ] AC5: Production build passes with zero TypeScript errors and zero bundle warnings.

## Verification criteria

- Verify dock renders with crisp typography and frosted glass blur.
- Press `H`; verify dock disappears completely; press `H` again to restore.
- Press `F` to instantly steam up; press `C` to wipe clean.
- Run `npm run build`; confirm successful production bundle generation.

## Agreed review checkpoint

Final Project Review & Checkpoint.
