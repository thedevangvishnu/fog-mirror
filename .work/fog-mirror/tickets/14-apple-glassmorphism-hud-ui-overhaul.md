# 14: Apple Glassmorphism HUD & Visual Polish

## Problem

The current user interface styling uses generic dark-mode patterns and lacks the tactile elegance of premium glass interfaces:
- Controls feel disconnected from the mirror and condensation metaphor.
- Harsh edges, default slider controls, and generic modal dialogs.
- Need an Apple Liquid Glass (visionOS / macOS) aesthetic with smooth curved squircles, deep multi-layered frosted blur, specular highlights, and refined micro-interactions.

## What to build

1. **Apple Liquid Glass HUD**:
   - Ultra-smooth curved dock (`border-radius: 24px` squircle styling).
   - Multi-layered frosted glass material (`backdrop-filter: blur(28px) saturate(190%) contrast(105%)`).
   - Hairline specular highlight (`box-shadow: 0 16px 40px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2)`).
   - Refined typography using Apple system stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`).
2. **Glass Controls & Micro-Interactions**:
   - Polished glass buttons with subtle tactile hover lift and soft glow states.
   - Sleek glass sliders with custom styled metallic thumbs and luminous pill tracks.
   - Refined breath indicator bar with subtle organic luminance.
3. **Apple-Style Glass Settings Sheet & Message Modal**:
   - Settings popover redesigned as a visionOS-style floating glass sheet with smooth 22px rounded corners, grouped row items, and hairline dividers.
   - Secret message modal redesigned with frosted glass backdrop, curved squircle container, and elegant glass action buttons.
4. **Refined Cursor Reticles**:
   - Subtle Apple glass lens reticle for hovering.
   - Luminous water droplet reticle for pinch wiping.
   - Soft frosted glass squeegee ring for fist wiping.

## Specification and contracts

- `src/style.css`: Update glass variables, HUD dock styles, glass button styles, slider styles, modal sheets, and cursor styling.
- `src/ui/hud.ts`: Enhance DOM structure to support glass layout, clean SVG icons, and smoother interaction states.

## Acceptance criteria

- [ ] AC1: HUD pill renders with premium Apple-style frosted glass, specular top edge, and smooth curved corners.
- [ ] AC2: Sliders and buttons respond with tactile fluid feedback and glass highlight states.
- [ ] AC3: Settings popover renders as a floating visionOS glass card with clean grouped rows.
- [ ] AC4: Secret steam message modal renders as an elegant frosted glass sheet.
- [ ] AC5: Cursor displays smooth, non-intrusive glass indicators for hover, pinch, and fist states.
- [ ] AC6: TypeScript build passes (`npm run build`).
