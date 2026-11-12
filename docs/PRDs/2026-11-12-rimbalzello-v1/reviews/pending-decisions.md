# Decisions taken during the review, not yet folded into prd.md / design.md

Apply these when the reviews are merged.

## Swing is in v1 (2026-11-12)

- Swing moves from Out of Scope into v1.
- One `swing` strip in the **fx** group (chaos, drift, drive, swing). Short phones: the fx tab holds four strips.
- Part of the **setup**: stored by the anchor, encoded in the URL hash.
- Implementation: every second 16th step (the off-beat 16ths) is delayed. Express swing as the MPC-style ratio, 50 % = straight, up to about 75 %.
- **Default: 56 %**: a light, clearly audible shuffle, the classic MPC sweet spot. Not 0 / straight. Confirmed by `swing-research.md` (about 15 ms off-beat delay at 120 bpm); check by ear, 54 % (subtler) and 58 % (stronger) are the fallbacks.
- Range 50–75 % in 1 % steps (common drum-machine convention). Stored as percent; delay = (p − 0.5) × 2 × 16th duration, so it scales with tempo. Applies to all drums equally (per-drum swing is out of scope).
- Note: in original Grids, swing reuses the chaos knob; we keep chaos and swing as separate controls.
- Accents and the looper keep working on swung timing; the looper's slip lands on the swung grid.
- Glossary: add **swing** to CONTEXT.md.
