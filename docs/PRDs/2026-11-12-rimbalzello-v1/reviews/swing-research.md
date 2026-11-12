# Swing default: research note

Question: what default swing should Rimbalzello ship with (Grids-based, 16th steps, 32-step patterns, BD/SD/HH, 120 bpm default), on by default, audible but not cartoonish?

**Recommendation: 56% (MPC convention, 50% = straight), applied to every off-beat 16th (steps 2, 4, 6, … counting from 1), equally on all three voices. UI range 50–75%, 1% steps.**

Confidence: medium. The convention and range are well established; the exact "sweet spot" is a matter of taste and the sources are interviews and manuals, not measurements. Sources marked (memory) were not re-fetched in this session and should be spot-checked before they are quoted elsewhere.

## 1. How the reference machines define swing

| Machine | Unit swung | Scale | Notes |
|---|---|---|---|
| Akai MPC (60, 3000, 2000XL, MPC software) | 16th or 8th (user picks) | 50–75% | % = share of the 8th-note pair taken by the first 16th. 50 straight, 66 = triplet feel, 75 = dotted-16th/32nd. Roger Linn designed this scheme, carried over from the Linn 9000. (memory; MPC manuals "Timing Correct / Swing") |
| Linn LM-1 / LinnDrum / Linn 9000 | 16th (or 8th) | 50–75% (LM-1 had fixed steps, e.g. 50/54/58/62/66/71) | Roger Linn, MusicRadar interview (2013): "between 50% and 70%… the magic happens between 54% and 62%"; he describes small values like 54% loosening a straight 16th hi-hat without sounding like a shuffle. (memory) |
| Roland TR-909 | 16th | "Shuffle" 0–6 (7 positions), applied to the off-beat 16ths | Fixed steps; delays the off-beat 16ths by a number of internal clock ticks (96 ppqn, i.e. 24 ticks per 16th, so each step ≈ 2 ticks). Setting 6 is close to triplet. (memory, TR-909 owner's manual) |
| Roland TR-8S | 16th | Shuffle −90…+90 (per pattern; also per-instrument via "Inst Shuffle"/"Flam") | Negative values pull the off-beats early. Exact ms/% mapping not documented in the manual. (memory) |
| Elektron Digitakt / Analog Rytm | 16th (every second trig) | Swing 50–80% | Same ratio convention as MPC, extended to 80%. Pattern-wide; the "swing trig" mask can choose which steps swing. (memory, Digitakt manual section "Track/Pattern settings – Swing") |
| Ableton Live grooves | 8th or 16th per groove file | Groove "Amount" 0–130%, plus MPC/SP-1200 grooves ("MPC 16 Swing-54", "-58", "-62", "-66", "-71") | The MPC-derived groove names directly reuse the MPC percentage. (memory, Live manual ch. "Using Grooves") |
| Reference hardware looper device | 16th | Swing 50–75% (global + per-track on Impact) | MPC convention. (memory, manufacturer manual) |
| Mutable Grids | see below | 0 to ~33% period skew, set by the CHAOS knob when swing is enabled | Source-verified. |

### Mutable Grids (source: github.com/pichenettes/eurorack, `grids/`)

- Swing is an option toggled in settings mode (`grids.cc`, `PARAMETER_SWING`, `pattern_generator.set_swing(...)`).
- When swing is on, **the CHAOS knob stops adding randomness and becomes the swing amount** (`pattern_generator.cc`: `randomness = options_.swing ? 0 : ...`).
- `PatternGenerator::swing_amount()`:
  ```cpp
  int8_t value = U8U8MulShift8(settings_.options.drums.randomness, 42 + 1);
  return (!(step_ & 2)) ? value : -value;
  ```
  so the knob maps 0..255 to a skew of 0..42.
- `Clock::Wrap(amount)` (`clock.h`) makes the internal clock's phase wrap at `128 + amount` instead of 128, alternating `+value` / `-value`. One period is lengthened by up to 42/128 ≈ 33%, the next is shortened by the same amount, so the long/short pair is at most 170:86, i.e. a long share of about **66%** — roughly triplet swing. Full CHAOS ≈ 66% MPC; half ≈ 58%.
- Swing only exists in drums mode, and only on the **internal clock** (the external-clock path in `grids.cc` does not call `Wrap`). The alternation is keyed on `step_ & 2`; how many internal ticks make one 16th depends on the clock resolution setting, so mapping "one period" to exactly one 16th is my reading, not verified on hardware.
- Takeaway: Grids's own range tops out at ~66% (triplet). It does not use an MPC-style percentage, but converts to one cleanly.

## 2. Sweet spots and tempo

- Roger Linn: the musical zone is ~54–62%; values much above 62 start to sound like an obvious shuffle. (memory, MusicRadar 2013)
- MPC folklore and Ableton's MPC grooves: 54 (subtle), 58 (classic house/hip-hop pocket), 62 (heavy), 66 (triplet). House producers often quote 54–58% on hats; 90s hip-hop 58–66% at 85–95 bpm.
- Techno is often near straight (50–54%), with swing concentrated on hats; UK garage/2-step runs 58–66%.
- Tempo dependence: the percentage is relative, so the absolute delay grows as tempo drops. At 120 bpm a 16th is 125 ms; the off-beat delay is `(p − 50%) × 2 × 125 ms`:
  - 54% → 10 ms, 56% → 15 ms, 58% → 20 ms, 62% → 30 ms, 66% → 40 ms.
  Delays under ~10 ms read as "feel" rather than a rhythm change; 20 ms+ is clearly heard as swing. At faster tempos (130–140) the same % is less audible, which is why techno at 130+ can carry 56–58% without sounding shuffled. The perception thresholds here are general timing-perception knowledge, not a cited study.

## 3. What gets swung, and on which voices

- Every reference machine above swings the **off-beat 16ths** (the 2nd of each pair) when set to 16th resolution; the downbeat 16ths stay on the grid. MPC and Ableton also offer 8th swing, which is irrelevant for a 16th-step grid.
- Grids swings its own clock pulses alternately, which amounts to the same thing.
- Most machines apply swing pattern-wide to all voices (909, MPC, Grids, Digitakt by default). Per-track swing exists (some hardware drum machines, TR-8S Inst Shuffle) as an advanced feature. In practice BD rarely lands on off-beat 16ths in Grids patterns, so global swing mostly moves hats and ghost snares, which is where swing is wanted anyway. Apply equally to all three voices for v1.

## Recommendation, with reasoning

- **Default 56%.** At 120 bpm that is a 15 ms delay on off-beat 16ths: clearly audible on a 16th hi-hat (above Linn's lowest "loosening" value of 54%) and well short of the 62%+ zone where it reads as shuffle. It fits house/breaks and does not spoil techno patterns. 54% is the safer alternative if "audible" is judged on laptop speakers by non-musicians; 58% if the owner wants it unmistakable.
- **UI range 50–75%** (MPC/Linn convention, familiar to users). Grids itself only reaches ~66%, so capping at 66% would be defensible too; 75% costs nothing and matches the references. Elektron's 80% is beyond useful territory.
- Store the value as a percentage and compute the delay as `(p − 0.5) × 2 × sixteenthDuration`, so it scales with tempo like every reference machine.
- Uncertainties: the exact Linn quotes and manual ranges come from memory and should be checked; the 56% choice is a judgment call and should be confirmed by ear at 120 bpm against 54 and 58.
