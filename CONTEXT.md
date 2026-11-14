# Rimbalzello: domain glossary

Use these words, with these meanings, in code, tests, issues and docs. Don't invent synonyms.

## The instrument

- **Rimbalzello**: the app. Italian for skipping stones on water. Never call it "Grids" (the Mutable Instruments module it is based on).
- **Map**: the 5×5 grid of drum patterns from Grids (25 nodes, placed by a fixed permutation). Every point between nodes is an interpolated pattern. Nodes sit at 0, 64, 128, 192 and 256, so the outer ones lie on the pad edges.
- **Pad**: the X/Y surface the player touches to move through the map. "Position" is the point on the pad, `x` and `y` stored as 0–255, shown as 0–100.
- **Pattern**: the 32 steps the pattern generator produces for the current position, densities and chaos. One pattern is one bar.
- **Step**: one 32nd note. A **beat** is 8 steps; a **bar** is 32 steps, one pattern. Steps are numbered 0–31.
- **Drum**: one of the three voices: **bd** (bass drum), **sd** (snare drum), **hh** (hi-hat). Lowercase in the UI: the two-letter names on phones and in the tablet's step display, the full names where the tablet and laptop layouts have room (strips, drum tabs, sound headings, the laptop's step display). A control's accessible name holds the name it shows (`mute bd`, `mute bass drum`).
- **Kit**: the set of drum voices behind one interface. The transport triggers drums through the kit and never knows how they make sound. v1 ships one kit of native Web Audio voices; other kits can load later.
- **Hit**: one drum firing on one step. A hit can be an **accent** (louder; on hh it can also open the hat), which Grids marks when the map level is above 192.
- **Density**: per-drum fill amount, 0–255. Higher density means more hits.
- **Chaos**: Grids' randomness applied to the pattern; re-rolled when the playhead crosses step 0, never when a loop wraps.
- **Swing**: the delay of the off-beat 16ths (steps 2, 6, 10, …), as a percentage: 50 % is straight, range 50–75 %, default 56 %. Part of the setup. Same for all drums. Not the same as chaos.
- **Drift**: per-hit random variation in the voices (pitch, decay, level, timing, tone) that makes the sound feel analog. It is a sound parameter, not a pattern parameter. Not the same as chaos.
- **Drive**: master distortion on the sum of all drums.
- **Sound**: the per-drum voice parameters: bd freq, punch, tone, decay, level; sd freq, tone, snappy, decay, level; hh accent, level.
- **Open hat**: an accented hh hit that rings longer than the closed hat. The hh `accent` strip sets how far it opens: at 0 an accent is only louder, at 100 the hat is fully open. Plain hh hits stay closed.
- **Choke**: a new hh hit cutting off the hh still ringing, with a short fade so it does not click. Every hh hit chokes, closed or open.
- **Tempo**: bpm, 60–200, default 128.

## State

- **Setup**: everything that defines the music: position, chaos, densities, sound, drift, drive, swing, tempo. The URL hash encodes the setup; the bare address, or a broken hash, opens with the default setup. The device does not remember it.
- **Mutes**: which drums are silenced. Performance state, not part of the setup.
- **Anchor**: a stored snapshot of the setup minus tempo. **Set anchor** stores it; **return** restores it when the playhead next crosses step 0. On load the anchor is the loaded setup; it is not kept across reloads. Mutes and tempo are never touched by return.
- **Pad undo**: one-step flip/flop of the last pad move (two-finger tap, or `z`). Pad only.
- **Tunables**: the one module that holds every value tuned by ear or feel (defaults, drift amounts, drive curve, gesture thresholds, breakpoints, lookahead), each with a comment.

## Performance

- **Looper**: hold a loop size to repeat the start of the beat you heard when you touched: the loop is the first 8, 4, 2 or 1 steps of that beat (sizes 1/4, 1/8, 1/16, 1/32). A touch in a beat's last step counts for the next beat (the grace step). The loop stays in that beat while held, also when sliding between sizes. It keeps the grid: the played step sits at the same place in the loop as the playhead, so 1/4 never jumps and 1/32 repeats the beat's first step. On release the pattern **slips**: it continues where the **playhead** would have been.
- **Playhead**: the transport's real position, which keeps running while the looper repeats.
- **Played step**: the step whose hits sound. Equal to the playhead step unless a loop is held.
- **Glide**: the short travel (1–2 steps) of the position toward a new pad target instead of a hard jump. Starts at once on a tap.
- **Fine adjust**: double-tap-and-slide on the pad, or shift+arrows: relative, slower movement.
- **Tap to play**: the `▶ tap to play` overlay on the pad at load. One tap unlocks audio and starts the groove.
- **Tap tempo**: setting the tempo by tapping the beat on the `tap tempo` button, next to bpm and swing.

## Screen

- **Play screen**: the main screen. Never scrolls.
- **Strips**: the horizontal slider rows (densities, chaos, drift, drive, bpm, swing, sound parameters, hh accent among them). A touch or pen moves a strip relative to the drag and a tap never changes it; a mouse click on the track sets the value there. Strip labels do not mute.
- **Loop strip**: the four-zone looper control.
- **Bottom bar**: `sound` / `play`, `set anchor`, `↺ return on bar`.
- **Footer**: `// help  // about  // source` under the bottom bar.
- **Tabs**: narrow-screen folding. **mix** (bd sd hh densities), **fx** (chaos drift drive) and **tempo** (bpm, swing, tap tempo) on phones, where tapping the bpm readout opens the tempo tab; **drum tabs** (bd sd hh) in sound mode. The tablet and laptop show mix, fx and tempo side by side as groups instead.
- **Step display**: the text rendering of one bar (`x` hit, bold `x` accent, `·` rest, 32 characters per drum), current step highlighted yellow. Its drum labels are the mute toggles.
- **Keycap hints**: small outlined keys next to controls on laptops, toggled with `?`, `h` or `// help`.
- **Help**: on touch screens, a hint box over the pad explaining gestures and controls; on laptops, the keycap hints.
- **About**: the credits view. An app state with its own prerendered URL `/about/`; opening it from the app keeps the music playing.

## Layouts

- **Phone layout**: one column, pad on top, the strips and tempo folded into mix / fx / tempo tabs below.
- **Compact layout**: the smallest phone case (iPhone SE in Safari), tighter than the phone layout.
- **Tablet layout**: about 700 px wide or more; two columns like the laptop, tabs only for sound.
- **Laptop layout**: two columns, all sound sections side by side, no tabs; on a window larger than 1280×800 every size in it grows with the window, up to twice.
- **Rotate hint**: what a landscape phone shows when it is too short for the tablet layout.
