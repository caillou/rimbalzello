# Rimbalzello v1: a Grids-style drum machine for the browser

## Problem Statement

Pierre wants a drum machine he can play live: Mutable Instruments Grids' topographic pattern generator driving three analog-style drum voices (bass drum, snare, hi-hat) in the spirit of Peaks. The hardware route (porting to the M-VAVE FM-1) is blocked and slow to iterate on. No web instrument gives the Grids experience (move through a map of grooves, add chaos, shape the drums) with a touch-first interface that works on a phone, a tablet and a laptop.

## Solution

Rimbalzello ("skipping stones") is a static web app at `rimbalzello.caillou.ch`. It is a live instrument first: one screen, always playing once started, and every touch does something musical.

- A large X/Y pad moves through the Grids drum map, live.
- Three density strips, chaos, drift (analog-style randomness in the voices) and a master drive shape the groove and the sound.
- A step display shows the pattern, one bar of 32 steps, as text (`x` and `·`), coloured per drum. Its drum labels are the mute toggles.
- A touch-strip looper loops 1/4 to 1/32 of a bar while held, then slips back to where the music would have been.
- An anchor snapshots the current groove and sound; "return" brings it back at the next bar.
- Swing delays the off-beat 16ths. Tempo, swing and tap tempo live in the `tempo` tab next to `mix` and `fx` (a group of their own on wide screens).
- The URL hash always holds the current setup, so a link shares a groove.
- The look follows caillou.ch: IBM Plex Mono, dark `#202322`, Monokai-style accents, lowercase text, `#` markers.

The visual and interaction spec is `design.md` next to this PRD, with screenshots in `designs/`. Several screenshots predate the review round and are marked outdated in `design.md` until a new design pass replaces them. Domain vocabulary is in the repo's `CONTEXT.md`. The source of the design exploration is the Claude Design canvas at https://claude.ai/artifact/JJBihVwA9ZeCqJdVk8qFvs (boards "B1 · chosen", "Sound 1", "LOCKED · laptop", green note "Design decided"). The engine handover from the earlier hardware session is in `handover-grids-peaks.md` next to this PRD. The review round that shaped this version is in `reviews/`, with the decision table in `reviews/summary.md`.

Where `prd.md` and `design.md` disagree, `prd.md` wins for behaviour and `design.md` for looks. Where text and a screenshot disagree, the text wins.

## User Stories

### Playing

1. As a player, I want to open the app and see a big `▶ tap to play` over the pad, so that I know one tap starts the music.
2. As a player, I want that one tap to unlock audio and start the groove, so that browsers that block autoplay (iOS Safari) still work.
3. As a player, I want to stop and restart playback, so that I can begin a take cleanly.
4. As a player, I want hits to land exactly on the beat, so that the instrument feels tight even on a phone.
5. As an iPhone player, I want sound even when the silent switch is on, so that the app never looks broken.
6. As an iPhone player, I want the music to resume after a call or an app switch, or a visible `tap to resume` when the browser refuses, so that I am never left with silent controls.
7. As a player, I want the screen to stay on while the music plays, so that the phone doesn't lock mid-set.

### Tempo and swing

8. As a player, I want tempo, swing and tap tempo in a `tempo` tab next to `mix` and `fx`, and a tap on the bpm readout to open it, so that I can find them.
9. As a player, I want − and + for tempo that repeat while held, so that I can get from 128 to 172 without forty taps.
10. As a player, I want to tap the beat to set the tempo, so that I can match the music around me.
11. As a player, I want a swing control that delays the off-beat 16ths, so that the groove can shuffle.
12. As a player, I want a light swing on by default, so that the first groove already feels loose rather than mechanical.
13. As a tablet or laptop player, I want tempo, swing and tap tempo shown beside the strips without opening a tab, so that I see everything at once.

### The pad

14. As a player, I want to tap anywhere on the pad and have the pattern move there at once, so that I can jump between grooves without lag.
15. As a player, I want a tap to glide to the new spot over one or two steps instead of cutting hard, so that jumps sound like musical transitions.
16. As a player, I want to touch and drag on the pad and have the point glide to my finger and then follow it, so that I can sweep through the map.
17. As a player, I want a two-finger tap to undo my last pad move, so that I can get back to the groove I just left.
18. As a player, I want a second two-finger tap to redo (flip/flop), so that I can A/B two spots on the map.
19. As a player, I want double-tap-and-slide to make fine, slower, relative adjustments, so that I can dial in a spot precisely on a small screen.
20. As a new player, I want a one-line hint about the pad gestures on first launch, so that I can discover the two-finger undo and fine adjust.
21. As a player, I want to see the current X/Y position on every layout, so that I know where I am on the map.

### Pattern controls

22. As a player, I want a density strip per drum (bd, sd, hh), so that I can thin out or fill each part.
23. As a player, I want a chaos strip, so that I can add Grids' randomness to the pattern.
24. As a player, I want to tap a drum's label in the step display to mute or unmute it, so that I can build drops and breaks from any screen.
25. As a player, I want a muted drum's line shown grey with its label struck through, so that I can see at a glance what is muted.
26. As a player, I want the step display to show which steps each drum plays and the current step, so that I can see the groove I hear.
27. As a player, I want each drum in its own colour (bd yellow, sd pink, hh green), so that the display reads at a glance.

### Sound

28. As a player, I want to open the sound controls without losing the pad, so that I can shape the sound while still playing the map.
29. As a player, I want bd controls for frequency, punch, tone, decay and level, so that I can shape the kick.
30. As a player, I want sd controls for frequency, tone, snappy, decay and level, so that I can shape the snare.
31. As a player, I want a level control for hh, so that I can balance the hats.
32. As a player, I want a drift control that adds small random variations per hit (pitch, decay, level, timing, tone), so that the machine sounds warm and analog instead of static.
33. As a player, I want a master drive control, so that I can crunch the whole kit.
34. As a player, I want drive not to make everything much louder, so that turning it up doesn't blow my ears or my speakers.

### Looper

35. As a player, I want to hold a loop size (1/4, 1/8, 1/16, 1/32 of a bar) to loop that slice of the pattern, so that I can perform stutters and fills.
36. As a player, I want the loop to start on the step I am hearing when I touch, so that I catch the moment I like.
37. As a player, I want to slide between loop sizes while holding, so that I can build rolls that stay in time.
38. As a player, I want the pattern to jump to where it would have been when I release, so that I always land back on the grid.
39. As a player, I want pad moves to stay live inside a loop, so that I can morph a looped beat.

### Anchor

40. As a player, I want to set an anchor at any moment, so that I can mark a groove I like before I start noodling.
41. As a player, I want "return" to bring back the anchored pattern, sound, swing, drift and drive at the next bar, so that coming back sounds like a drop, not a stumble.
42. As a player, I want the return button to pulse until it lands, so that I know a return is pending.
43. As a player, I want return to leave tempo and mutes alone, so that it doesn't fight what I'm doing in the moment.
44. As a player, I want return before I have set any anchor to bring back the setup the session started with, so that the button always does something sensible.

### Sharing and persistence

45. As a player, I want the URL to always reflect the current setup, so that I can copy it and share my groove.
46. As someone who receives a link, I want it to open with that exact groove, sound, swing and tempo, so that I hear what was shared.
47. As a player, I want the URL to update without filling my browser history, so that the back button still leaves the app.
48. As a player, I want old links to keep working after new features ship, so that shared grooves don't break.
49. As a player, I want the app to reopen with my last setup when I open the bare address, so that I pick up where I left off.

### Layouts

50. As a phone player, I want the pad on top and everything else below, without scrolling, so that every touch lands on a control.
51. As a phone player, I want the strips and tempo folded into `mix`, `fx` and `tempo` tabs, so that the pad stays big enough to play.
52. As a player on the smallest phones (iPhone SE in Safari), I want a compact layout that still fits without scrolling, so that the instrument works there too.
53. As a tablet player, I want two columns like the laptop, so that I use the wider screen.
54. As a laptop player, I want the pad on the left and all controls on the right, including all three drums' sound controls side by side, so that I see everything at once.
55. As a player, I want the loop strip and the bottom bar (sound, set anchor, return) always visible, so that performance controls are never hidden.
56. As a phone player who turns the phone sideways, I want a hint to rotate back, so that I'm not left with a broken layout.

### Keyboard

57. As a laptop player, I want keyboard shortcuts (space play/stop, `,` `.` tempo, `1`–`4` hold loop, `a` anchor, `r` return, `q` `w` `e` mutes, `z` undo, arrows nudge the pad, shift for fine), so that the laptop becomes a real instrument.
58. As a laptop player, I want shortcuts bound to physical key positions, so that they work the same on my Swiss keyboard as on a US one.
59. As a laptop player, I want to press `?` or `h` to show the shortcuts as keycaps next to each control, so that I learn them where I use them.
60. As a laptop player, I want hints hidden by default and my show/hide choice remembered, so that the UI stays clean once I know the keys.
61. As a laptop player, I want a quiet footer line telling me `?` shows shortcuts, so that I can find them.

### Help, about and 404

62. As a visitor, I want an about page that credits Grids, Peaks and Émilie Gillet and links to caillou.ch, so that the origins are clear.
63. As a visitor, I want a link to the exact source code of the version I'm using, and its licence, so that I can see how it works and reuse it under the GPL.
64. As a player, I want to open about from a footer link without the music stopping, so that I can read the credits mid-session.
65. As a player, I want `← back to play`, a close button, `esc` and the browser's back button to return me to the play screen, so that I never get stuck.
66. As a visitor, I want `/about/` to work when I open it directly or reload it, so that I can share the credits page.
67. As a touch player, I want `// help` to show a hint box over the pad explaining gestures (including the two-finger undo) and controls, so that I can learn the instrument without leaving it.
68. As a laptop player, I want `// help` to toggle the keycap hints, so that help means the same thing as `?`.
69. As a visitor who follows a broken link, I want a 404 page in the same style with a link back, so that I land somewhere useful.

### Accessibility

70. As a keyboard or screen-reader user, I want controls to be real buttons with labels and a visible focus ring, so that I can reach and identify them.

## Implementation Decisions

### Stack and delivery

- TypeScript throughout. UI in Solid with Vite. The hot paths (pad, step display animation) render on a `<canvas>` or with direct DOM writes, outside the framework's update cycle.
- Engine and state are framework-free TypeScript; the UI only subscribes to them. Swapping the UI framework must not touch the engine.
- Static site on GitHub Pages from a public GitHub repo, custom subdomain `rimbalzello.caillou.ch`. Plain site in v1, with no web manifest and no service worker.
- GitHub Actions runs typecheck, unit tests and Playwright checks on every push. A failing run blocks the deploy. Every push to `main` deploys once CI is green.
- Acceptance devices: Pierre's iPhone (Safari) and laptop (Chrome, Safari, Firefox). No Android device is a target.

### Licence

- Everything is GPL-3.0-or-later, because the Grids drum map and generator logic are GPL. The README notes that MIT is a possible later step: Pierre is the sole author of everything else and can relicense once the map is replaced or Émilie Gillet grants permission. Asking her stays optional.
- Dependency rule: permissive, LGPL or GPL-3-compatible licences only. No GPL-2.0-only, no unlicensed or non-commercial code or assets. The rule covers future sample packs.
- Grids' Euclidean table is not copied; if a Euclidean table is needed, it is regenerated from the algorithm.
- The build ships third-party notices: Grids (GPL-3.0-or-later), Peaks (MIT, if any code or tables are ported) and IBM Plex Mono (OFL, self-hosted).
- The about page's source link points at the deployed commit. The build injects the commit hash.
- The product name avoids "Mutable Instruments" and "Grids" (the author asks derivatives not to reuse module names); the about page credits both.

### Modules

1. **Pattern generator (deep, pure).** Grids ported in spirit to TypeScript. A pure function: position (x, y), three densities, three chaos perturbations and a step in; hits and accents per drum out. It holds no RNG and no state.
   - The 25 node arrays (96 bytes each) are copied exactly, and so is their placement on the 5×5 map. The placement is a permutation, `drum_map[5][5]` in Grids, not the nodes in order.
   - Node lookup uses `x >> 6` and `y >> 6`. Interpolation uses 8-bit arithmetic: mix(a, b, f) = (a × (255 − f) + b × f) >> 8, with f = (x << 2) & 0xff. The port must mask to 8 bits to get Grids' wraparound. x = 255 never reaches the far node exactly.
   - Map nodes sit at 0, 64, 128, 192 and 256, so the outer nodes lie on the pad edges.
   - Perturbation per drum = random byte × (chaos >> 2) >> 8, at most 63. The level plus perturbation is clipped to 255. A step is a hit when the level passes the density threshold; an accent needs a hit and a level above 192.
2. **Transport (deep, pure state machine).** Owns tempo, swing, the playhead, the RNG and time. Driven by an injected clock, it emits "play these hits at time t" events for a lookahead window. Pure and clock-injected, so it can move into an AudioWorklet later without changes. Contains:
   - the playhead: steps are 32nd notes, a pattern is 32 steps and one bar;
   - chaos: the transport owns a seeded RNG and rolls the three perturbations when the playhead crosses step 0, never when a loop wraps;
   - swing (see Swing below);
   - the looper (see Looper rules below);
   - anchor return quantisation: a pending return lands when the playhead next crosses step 0;
   - glide timing: a new pad target glides from the current position over one or two steps, starting at once.
   A thin real-time wrapper runs it from `AudioContext.currentTime` with a lookahead of about 100 ms.
3. **Setup store (deep).** Holds the setup (x, y, chaos, densities, per-drum sound, drift, drive, swing, bpm), plus mutes, the anchor snapshot and the pad's undo slot. Anchor captures pattern, sound, swing, drift and drive; never tempo or mutes. On load the anchor is set to the loaded setup, so return before any `set anchor` restores the start setup. The anchor is not kept across reloads. The last setup is remembered on the device (localStorage, wrapped in try/catch); a URL hash always wins over it. Pad undo is one step and flip/flops.
4. **URL codec (deep, pure).** Setup ↔ URL hash, encoded as `v1.` plus base64url. Each field is one byte; the byte order below is fixed for v1. Includes bpm and swing; excludes mutes and anchor. An unknown version or a malformed payload falls back to the default setup. A later version appends fields and bumps the version; decoders for older versions stay. The hash updates with `replaceState`, at most once per second, inside try/catch. See URL format below.
5. **Pad gesture interpreter (deep, pure).** Pointer events with timestamps in, intents out: jump (on tap, at once), drag (glide then follow), undo (two-finger tap), fine adjust (double-tap and slide, relative, about ¼ speed). It owns all gesture timing in milliseconds; the transport owns step timing. The state machine is in `design.md`. Thresholds live in the tunables module.
6. **Kit, voices and master bus.** The transport plays drums through a **kit** interface: trigger a drum at a time with a velocity and its sound parameters, cancel hits that are scheduled but not started, and set per-drum mute gains. v1 ships one kit of native Web Audio voices:
   - BD: pitched oscillator or high-Q filter ping with pitch envelope and punch.
   - SD: tuned resonators plus filtered noise, snappy.
   - HH: six detuned square oscillators through band-pass and high-pass, 808-style.
   Parameters mirror Peaks (frequency, punch/snappy, tone, decay) plus level. Peaks is a starting point; the sound will move towards hard techno, and later kits (including a Peaks port in an AudioWorklet) load through the same interface without touching the rest. Drift scales per-hit random offsets in pitch (cents), decay, level, timing (1–2 ms) and filter cutoff. Accents drive velocity. Mutes are per-drum gains on the bus and act at once. All drums sum into a master drive: a `WaveShaperNode` with a soft-clip curve, 4× oversampling and gain compensation.
7. **Tunables.** One module holds every value tuned by ear or feel, each with a comment: initial setup, drift amounts, drive curve and gain compensation, accent velocity, glide length, gesture thresholds and windows, fine-adjust speed, lookahead, layout breakpoints, minimum pad height, tap-tempo averaging. Code reads these values from here and nowhere else.
8. **Keyboard bindings.** Key down/up → intents, including hold semantics for the looper and the hint toggle. Keys bind by physical position (`event.code`), designed for the US layout. Key repeat is ignored except for tempo. Hint visibility is stored in localStorage (wrapped in try/catch).
9. **Audio session.** Creates and resumes the AudioContext on the first gesture. Sets `navigator.audioSession.type = 'playback'` where it exists, otherwise starts a silent looping `<audio>` element in the same gesture, so the iOS silent switch does not mute the app. Resumes after interruptions (calls, app switches, `visibilitychange`); when the browser refuses, shows `tap to resume`. Holds a Screen Wake Lock while playing.
10. **UI (Solid).** Layouts, controls, step display, pad rendering, tabs, hints, about page.

### Steps, bars and swing

- A step is a 32nd note. A pattern is 32 steps, one 4/4 bar; a beat is 8 steps. At 128 bpm a step lasts about 59 ms.
- Swing delays the off-beat 16ths, steps 2, 6, 10, … (step mod 4 = 2). Swing p is a percentage, 50 % = straight, range 50–75 % in 1 % steps, default 56 %. The delay is d = (p − 0.5) × 2 × the length of a 16th, so it scales with tempo. At 120 bpm, 56 % is about 15 ms. If 56 % sounds wrong by ear, 54 % and 58 % are the fallbacks.
- The 32nd steps between straight and delayed 16ths (step mod 4 = 1 or 3) shift by d/2, so they stay halfway between their neighbours.
- Swing applies to all drums equally. Swing and chaos are separate controls (in Grids, swing reuses the chaos knob).
- Swing follows the playhead, not the played step, so looped hits land on the same swung grid.

### Tempo

- Default 128 bpm, range 60–200, whole bpm.
- On phones the `tempo` tab, after `mix` and `fx`, holds a bpm strip, a swing strip and a tap-tempo button, in three rows like the other tabs, so the pad keeps its size. The strips show their own values, not 0–100. Tapping the bpm readout opens it, also from sound mode. The header's − and + repeat while held. Tap tempo averages the last few taps (count in tunables), rounds to whole bpm and clamps to the range.
- On the tablet and laptop, tempo is a third group beside mix and fx, always shown, so no tab is needed to see or change it.

### Transport rules

- On load the app is stopped and shows `▶ tap to play` over the pad. One tap anywhere on that overlay unlocks audio and starts playing.
- Play starts at step 0, which rolls chaos. Stop ends any held loop.
- A pending return lands when the playhead crosses step 0, even while a loop is held. Return jumps the position; it does not glide.

### Looper rules

Terms: the **playhead** is the transport's real position, which keeps running while playing. The **played step** is the step whose hits sound at a step boundary. With no loop held, played step = playhead step. Steps are numbered 0–31.

| Zone | Loop length |
| --- | --- |
| 1/4 | 8 steps |
| 1/8 | 4 steps |
| 1/16 | 2 steps |
| 1/32 | 1 step |

Zones:

- The loop strip has four zones, longest on the left: 1/4, 1/8, 1/16, 1/32. Keys `1`–`4` map to them in the same order. There are no triplet sizes.

Engage:

1. The looper works only while the transport is playing.
2. Touching a zone engages a loop. The start step `s` is the step the player hears at the moment of touch: the latest step boundary that has already sounded, with output latency taken into account. It is not the step being scheduled ahead.
3. The start is on the step grid, not snapped to a multiple of the loop length. A 1/8 loop touched while step 13 sounds covers steps 13–16.
4. The loop takes effect from the next step boundary. No hit is cut or retriggered mid-step.
5. The window is steps `s … s+L−1`, counted modulo 32. A window may cross the bar line: a 1/4 loop started at step 28 plays 28, 29, 30, 31, 0, 1, 2, 3.

While held:

6. The playhead keeps advancing one step per step boundary, exactly as if no loop were held.
7. At each step boundary, with playhead step `p` counted without wrapping, the played step is (s + ((p − s) mod L)) mod 32. A 1/8 loop at step 13 plays 13, 14, 15, 16, 13, …; a 1/32 loop repeats `s` on every step boundary.
8. Sliding to another zone while holding keeps `s` and the phase; it changes `L` only. Because all sizes are powers of two, a shorter loop plays a sub-slice of the longer one, in time with it. Sliding never restarts the loop.
9. Sliding off the strip or lifting the finger is a release. With keys, the zone key pressed most recently wins; releasing it falls back to another held zone key. The loop ends only when no zone is held.

Release:

10. On release, the next step boundary plays the playhead step `p`. Playback continues exactly where it would have been without the loop. This is the slip.

What stays live inside a loop:

11. The looper changes which step index is read, not what the pattern contains. Each played step is read from the current pattern:
    - Pad moves, densities and chaos amount change what the looped steps contain; the change is heard on the next pass.
    - Accents repeat as stored in the looped steps. A held 1/32 on an accented step accents every retrigger.
    - Mutes apply at once.
    - Sound, drift and drive apply at once. Every retrigger is a new hit and draws its own drift.
12. Chaos re-rolls when the playhead crosses step 0. A loop wrapping through step 0 does not re-roll.
13. Swing follows the playhead slot a hit lands in, not the played step.
14. A pending return lands when the playhead crosses step 0, even while a loop is held. The loop keeps running and reads the restored setup.
15. Tempo changes apply to the playhead, and the loop follows.

Scope and transport:

16. The loop applies to all three drums together.
17. Touching a zone while stopped does nothing. A zone still held when play is pressed does not engage; the player must touch again.
18. Stop while a loop is held ends the loop.

Display and audio:

19. The step display highlights the played step. While a loop is held, the playhead step is also shown, dimmed. The held zone is inverted.
20. Engaging, sliding and releasing cancel hits that are scheduled but not started, so the change is heard at the next step boundary.

Points the behaviour above doesn't settle are implemented as the simplest reading and adjusted after playing it.

### URL format

`v1.` followed by base64url of 21 bytes, in this order:

| # | Field | Range |
| --- | --- | --- |
| 0 | x | 0–255 |
| 1 | y | 0–255 |
| 2 | chaos | 0–255 |
| 3–5 | density bd, sd, hh | 0–255 |
| 6–10 | bd freq, punch, tone, decay, level | 0–255 |
| 11–15 | sd freq, tone, snappy, decay, level | 0–255 |
| 16 | hh level | 0–255 |
| 17 | drift | 0–255 |
| 18 | drive | 0–255 |
| 19 | bpm | 60–200, stored as the bpm value |
| 20 | swing | 50–75, stored as the percentage |

Out-of-range bpm or swing values clamp. A wrong length, bad base64 or an unknown version falls back to the default setup.

### Layout rules

- Size everything against the real browser viewport (`100dvh`), not the device screen. Safari on an iPhone shows roughly 660–750 px of height in portrait, an iPhone SE about 550 px. Breakpoints are recomputed from measured viewports in the design pass and live in the tunables module.
- Four layouts:
  - **Phone**, one column: header (`# rimbalzello`, − bpm +, stop), pad (takes the remaining height), step display, loop strip, tabs `mix` (bd sd hh), `fx` (chaos drift drive) and `tempo` (bpm, swing, tap tempo), bottom bar (`→ sound`, `set anchor`, `↺ return on bar`), centred footer (`// help  // about  // source`). Minimum pad height about 200 px; 240 does not fit with 44 px rows.
  - **Compact**: the smallest case (iPhone SE in Safari). Tighter rows and a smaller step display so it fits without scrolling. Sound mode is designed for compact as well.
  - **Tablet**, about 700 px wide or more: two columns like the laptop; tabs only for sound; tempo in one row across both columns.
  - **Laptop**: pad on the left; on the right the step display, the strips in two columns (bd/chaos, sd/drift, hh/drive), tempo in one row (bpm, swing, tap tempo), the loop strip, then `## bd`, `## sd`, `## hh` sound sections side by side.
- Exact visuals for compact, tablet, the tempo tab, `▶ tap to play` and the rotate hint come from a later design pass; screenshots pending.
- Landscape phones are not a v1 layout. A wide viewport that is tall enough gets the tablet layout; otherwise the app shows a rotate hint.
- The play screen never scrolls; every touch must land on a control. Loop strip and bottom bar are always visible.
- Sound mode on phones: the `mix` / `fx` / `tempo` tabs are replaced by drum tabs (`bd` `sd` `hh`, active tab in the drum's colour) with that drum's sliders; the pad stays playable; the bottom bar shows `← play`.
- Wide screens: footer bottom left, sharing the row with `set anchor` and `return`.

### Input rules

- `touch-action: none` on the pad, strips and loop strip. No text selection, no long-press callouts or context menus.
- The pad keeps clear of the left 16 px of the screen, so the iOS edge swipe does not navigate back mid-performance.
- The loop strip tracks the finger across zones while held.
- Sliders move relative to the touch; a tap on the track does not jump the value.
- Mutes are the step display's drum labels only, each with a hit area of at least 44 px. Strip labels do not mute. Keys `q` `w` `e` also mute.
- Displayed values, including the X/Y readout, run 0–100. Stored values are bytes.

### Visual style

- IBM Plex Mono everywhere, with caillou.ch's resolution-dependent weights: normal 400 / bold 600 at 1×, 300 / 500 at 2×, 200 / 400 at 3× (thin on retina, like the blog).
- Background `#202322`, pad `#1a1c1b`, hairlines `#3a3d3c`; text white, secondary `#ababab`, tertiary `#757575`. Colours stay as they are in v1.
- bd `#ffd866`, sd `#ff61ef`, hh `#bef289`, drive `#fc618d`, chaos, drift, bpm and swing white.
- Lowercase labels, `#` and `##` markers in grey, italic text buttons, `return` as the one solid yellow block. The current step is highlighted like caillou.ch's text selection (yellow background, black text).
- Sliders: 2 px line, square thumb in the control's colour.
- Loop strip: four boxed zones; the held zone is white with black text.
- Keycap hints: small grey outlined keys next to each control; on light backgrounds (held loop box, return button) they invert to black.
- Touch targets at least 44 px.
- Controls are real `<button>` elements (or labelled inputs) with accessible names and a visible keyboard focus.

### About page

Entry point: `// about` in the footer, nowhere else. About is an app state, not a separate app: opening it from the app keeps the music playing and pushes the URL `/about/`; `← back to play · still playing`, `×`, `esc` and the browser back button return to `/`. The setup hash stays on both URLs. The build emits two entry files, `/index.html` and `/about/index.html`, both loading the same app (the second starting with about open) with the credits prerendered into the HTML, so direct visits and reloads work on GitHub Pages without redirect tricks. Styled like a caillou.ch blog post: h1 `# rimbalzello` italic and yellow with a grey `#`, h2s italic with a grey `##`, no bold headings, body 18 px with line-height 1.8, links yellow with a dashed underline inside grey `[ ]` brackets and pink on hover, a `// source  // caillou.ch` footer in small grey uppercase. Credits Grids and Peaks by Émilie Gillet (Mutable Instruments), "made by Pierre Spring · caillou.ch", licence GPL-3.0-or-later with a link to the source at the deployed commit, a link to the third-party notices, and a note that the project is not affiliated with Mutable Instruments ("Mutable Instruments" is a registered trademark). The about page may scroll; the play screen may not.

### Audio context

The AudioContext is created on the first gesture (the `▶ tap to play` tap). Sample rate is not forced: native Web Audio voices are rate-independent (the 48 kHz constraint in the handover only applies to running Peaks' original code).

## Testing Decisions

- Tests check external behaviour through each module's public interface, never internal state or private helpers. A good test reads like a statement about the instrument: "holding 1/8 while step 13 is heard plays steps 13, 14, 15, 16, 13, … and on release plays the step the playhead has reached".
- Tested modules: pattern generator, transport (looper, swing, chaos re-roll, return quantisation, glide timing), setup store (anchor, undo, persistence), URL codec (round-trip, byte order, clamping, malformed input), pad gesture interpreter, keyboard bindings.
- Pattern generator: tests check behaviour with perturbations given as input: node placement, interpolation at node positions and in between, 8-bit wraparound, density thresholds, accents. Golden fixtures from the original C++ are optional, not required.
- Looper test statements, at least:
  - "Holding 1/4 from step 4, then sliding to 1/8 when the playhead is at step 10, plays 6, 7, 4, 5, 6, …"
  - "Holding 1/4 from step 4, then sliding to 1/32, repeats step 4."
  - "A 1/8 loop started at step 30 plays 30, 31, 0, 1, and holding it across the bar line does not re-roll chaos; the re-roll happens when the playhead crosses step 0."
- Transport and gestures are tested with an injected fake clock and synthetic timestamped events; no real timers.
- Audio smoke tests render the kit offline (`OfflineAudioContext`): output is not silent, does not clip, and hits land at the expected times.
- Playwright rule checks at each target viewport: the play screen never scrolls, every control is at least 44 px, no controls overlap. No screenshot comparison yet.
- How the voices and drive sound, and how the gestures feel, is checked by Pierre on the acceptance devices, including a real iPhone for the audio session, silent switch and wake lock.
- No prior art: the repo is new. Use Vitest for unit tests and Playwright for browser checks. CI runs both and blocks the deploy on failure.

## Out of Scope

- MIDI clock in/out and MIDI controller mapping.
- PWA: web manifest, home-screen install, service worker and offline support.
- Landscape phone layout (a rotate hint instead).
- Memory slots (m1–m3), presets beyond the shareable URL.
- Per-drum swing, per-drum drive, per-drum accent controls.
- Accent suppression on loop retriggers (accents repeat as looped).
- Moving the loop start while holding, a roll mode, MIDI for the loop strip.
- Ripples on hits, heat map of the drum map, other pad visualisations.
- Undo for anything other than the pad.
- A port of Peaks' DSP (WASM or AudioWorklet); native voices only in v1, behind the kit interface.
- Export (MIDI, WAV), recording.
- The M-VAVE FM-1 hardware port.

## Further Notes

- Help: on touch screens `// help` toggles a hint box over the pad (gestures including the two-finger undo, anchor, loop, mutes on the step display labels, sound); on laptops it toggles the keycap hints, like `?` or `h`.
- 404: a plain static `404.html` (no app code): `# 404`, "this stone sank.", `[back to rimbalzello]`.
- Every value tuned by ear or feel lives in the tunables module. Values marked "about" or "~" are starting points to tune in the running app, not fixed requirements.
- Domain: `rimbalzello.caillou.ch` needs one CNAME record pointing at GitHub Pages.
- The Grids drum map, its placement table and its GPL licence are the only hard dependency on Mutable's code. Peaks is a reference for voice structure and parameter names.
- `handover-grids-peaks.md` predates the step correction: where it says the generator ticks once per 16th note, read 32nd note.
