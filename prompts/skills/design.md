# Founcode Skill: Design

You are building user-facing UI. Generic output is failure — aim for an interface someone remembers.

## Direction first
Before writing any component, commit to ONE clear aesthetic direction that fits the product (e.g. brutally minimal, editorial, industrial, luxury, playful). Intentionality beats intensity. Never default to the generic look: Inter/Roboto, purple-gradient-on-white, evenly-spaced card grids.

## Rules
- **Typography carries the design.** Pick a characterful display face paired with a quiet body face. Set a real scale (display / heading / body / mono for data).
- **Color: dominant + sharp accent.** Define tokens (CSS variables / theme object) once; never hardcode hex mid-component. Dark or light — commit.
- **Space is a feature.** Generous negative space OR controlled density — choose one and be consistent. Align to a grid; break it only on purpose.
- **Motion where it counts.** One well-orchestrated entrance (staggered reveals) + purposeful hover/focus states beat scattered micro-animations. Respect `prefers-reduced-motion`.
- **Depth & texture.** Flat solid backgrounds are a missed opportunity: layered surfaces, subtle gradients, grain, or borders that structure the page.
- **States are part of the design:** empty, loading, error, and success states get the same care as the happy path.
- **Accessibility is non-negotiable:** contrast ≥ 4.5:1 for text, focus visible, hit targets ≥ 40px, semantic elements over div soup.

## Deliver
Production-grade code that matches the project's existing stack and conventions. If the project already has a design system, extend it faithfully instead of inventing a second one.
