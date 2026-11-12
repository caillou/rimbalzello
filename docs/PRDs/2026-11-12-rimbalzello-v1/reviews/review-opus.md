# Review of the rimbalzello v1 plan

Reviewer: Claude (Opus), 2026-11-12. Scope: `AGENTS.md`, `CONTEXT.md`, `prd.md`, `design.md`, `handover-grids-peaks.md`, all ten screenshots, and the upstream `pichenettes/eurorack` sources (README, `grids/pattern_generator.cc`, `grids/resources.cc`, `grids/resources/resources.py`, `peaks/drums/*.cc`).

Labels: **[fact]** means I checked it in the repo, the upstream source, or by computing it. **[judgement]** means it is my opinion. **[verify]** means I believe it is true but did not check it in this session.

---

## Findings, ranked

### 1. Blocker: phone layouts are sized for screen height, but a browser tab gets much less
- **Where:** `design.md` "Play screen, phone portrait" and "Short phones"; `prd.md` "Layout rules"; screenshots `01`, `04`, `05`.
- **What:** The mockups use device screen sizes (390×844, 375×667, 844×390). Safari's visible viewport is much smaller because of the status bar, the address bar and the bottom toolbar. An iPhone 14 in Safari portrait gives about 660–750 px, an iPhone SE about 550 px, and a landscape phone about 320–340 px [verify the exact numbers on devices]. Consequences:
  - The `< ~760 px` breakpoint puts nearly every iPhone in Safari into the short layout. Screen `01` then only appears on tall Android phones or in a home-screen web app.
  - Screen `04` does not fit an SE in Safari. Header 52 + pad 240 + steps ~70 + loop ~50 + tabs ~40 + 3 strips × 44 + bottom bar 44 + footer ~30 comes to about 660 px, against about 550 px available [fact: arithmetic from the screenshot measurements].
  - **Sound mode on short phones has no design.** bd has 5 sliders, so 5 × 44 = 220 px plus tabs. That does not fit in the space the short layout leaves for 3 strips [fact: no screenshot or text covers it].
- **Why it matters:** "Never scrolls, every touch lands on a control" is the core phone promise. Each agent will improvise a different fix.
- **Recommendation:**
  - Size against `100dvh`/`svh` and design for measured Safari viewports: about 660, 550 and 340 px tall.
  - Add a third, compact tier: 36–40 px strips, footer folded into a `···` or merged into the header, smaller step-display font.
  - Specify sound mode for the short tier. Options: two sliders per row, or the pad shrinks to its minimum while in sound mode.
  - Ship a web manifest plus `apple-mobile-web-app-capable` in v1 (no service worker needed), so "Add to Home Screen" gets the full height.

### 2. Blocker: the iOS silent switch mutes the instrument
- **Where:** `prd.md` "Further Notes": "iOS: the hardware mute switch silences Web Audio … handle later if it bites."
- **What:** It will bite. Most iPhones sit in silent mode, and Web Audio on iOS uses the "ambient" audio session, which the ringer switch silences. In a phone-first instrument, the first impression would be no sound at all.
- **Recommendation:** Make this v1:
  - Set `navigator.audioSession.type = 'playback'` where it exists (Safari 16.4/17+ [verify]).
  - As a fallback, start a silent looping `<audio>` element in the same unlocking gesture.
  - Also handle `AudioContext` state `interrupted`/`suspended` (phone calls, app switching) with a resume on `visibilitychange` and on the next tap.
  - Consider the Screen Wake Lock API while playing.

### 3. Major: the voice design is too vague, and native graphs undercut "modelled on Peaks"
- **Where:** `prd.md` module 6; "Out of Scope" ("native voices only in v1").
- **What:** "Pitched oscillator or high-Q filter ping", "tuned resonators plus filtered noise" and "parameters mirror Peaks" do not define a sound. What punch, tone or snappy do in a native graph is left open, so every agent run will sound different. Peaks' drums are short MIT code: 808-style SVF pings with excitation pulses, integer DSP, and 7 tables [fact: `peaks/drums/bass_drum.cc` header is MIT; the handover lists the tables].
- **Better approach [judgement]:** Port the three Peaks drums to TypeScript and run them in an `AudioWorkletProcessor`. Run the sequencer clock in the same worklet as well, from a sample counter. This gives:
  - the actual Peaks sound, with the handover's demo parameters as defaults;
  - no licence cost (MIT, notice only);
  - sample-accurate timing with no main-thread scheduler;
  - looper retriggers, mutes and cancellation that are trivial (nothing is pre-scheduled);
  - no per-hit node churn (up to ~64 hh hits/s × ~10 nodes with 1/32 loops on a phone);
  - easy drift.

  Compute coefficients from `sampleRate` instead of forcing 48 kHz. Keep drive as a `WaveShaperNode` after the worklet, or do it in the worklet.

  WASM is not worth it here. The code is small, and TypeScript in a worklet is fast enough with a huge margin; the handover measured C++ at 550× real time.

  If you keep native graphs, the PRD must give each voice's node graph and its parameter-to-node mappings with ranges.
- **Note:** The claim that "a later Peaks port in an AudioWorklet can replace them without touching the rest" only holds if the voice interface is `trigger(drum, when, velocity, params)` and the scheduler does not depend on node-level cancellation. Say so explicitly.

### 4. Major: the scheduler design does not account for live latency, cancellation or output latency
- **Where:** `prd.md` module 2 (lookahead 25–100 ms); stories 5, 28–32, 17.
- **What:**
  - Hits are scheduled up to 100 ms ahead as native nodes. A loop press, a mute or a pad move cannot affect them unless voices are tracked and stopped.
  - "The loop starts where you touch" needs the step the player is hearing, which is `currentTime − outputLatency` (Bluetooth adds 150–250 ms) — not the step being scheduled.
  - The step display has the same problem.
- **Recommendation:**
  - Specify mute as a per-drum gain on the bus, applied immediately.
  - Specify that looper engage and release cancel voices that are scheduled but not yet started.
  - Compute the "touched step" and the display highlight from `getOutputTimestamp()`/`outputLatency`.
  - Keep the lookahead at one step or less.
  - All of this disappears with the worklet engine from finding 3.

### 5. Major: Grids port details that an agent will get wrong
- **Where:** `prd.md` module 1, "Testing Decisions"; `handover-grids-peaks.md`.
- **Facts from `grids/pattern_generator.cc`:**
  - **The 5×5 map is a permutation of the nodes**, not `node_0..24` in order:
    `drum_map[5][5] = {{10,8,0,9,11},{15,7,13,12,6},{18,14,4,5,3},{23,16,21,1,2},{24,19,17,20,22}}`. "Copy the 25 nodes exactly" is not enough; the table must be copied too.
  - It indexes `drum_map[x>>6][y>>6]` and interpolates with `U8Mix(…, x<<2)` in **uint8** arithmetic. `x<<2` wraps to `(x & 63) * 4`, and `x = 255` never reaches node 4 exactly. A TypeScript port must mask with `& 0xff`.
  - Chaos is `randomness >> 2`, so the maximum perturbation is 63. `part_perturbation_[i] = GetByte() * (randomness>>2) >> 8` runs per part at step 0. The level is clipped to 255. An accent needs `level > 192` **and** a hit.
  - `Random::Update()` also runs on **every** `Evaluate()` call, not only at step 0. Golden fixtures that include chaos therefore depend on the exact tick and call sequence. "Seeded RNG passed in" will not match them unless that sequence is replicated.
- **Contradiction:** module 1 is described as "pure" with "step in, hits out", yet it is said to "re-roll chaos at step 0". That needs state, and it is unclear who owns it, especially when the looper wraps across step 0.
- **Recommendation:**
  - Make the generator a pure function `(x, y, densities, perturbations[3], step) → hits/accents`.
  - Make the transport own the 16-bit LFSR and roll the perturbations when the **playhead** (not the looped step) crosses step 0.
  - Golden fixtures: test the deterministic part (perturbations given as input) against C++ output, and commit the fixture JSON plus the harness under `tools/` so CI needs no C++.
  - Replace "ported in spirit" with "ported exactly".

### 6. Major: the pad gesture semantics are ambiguous, and tap latency is high
- **Where:** `prd.md` stories 6–12, module 5; `design.md` "Pad interaction"; `10-interaction-reference.png`.
- **Open questions:**
  - Does undo fire on the second pointer**down** or on the second **up** with no movement? It must be "up with no movement", otherwise double-tap-and-slide undoes first.
  - What does "fine adjust from the position before the double-tap" mean? The first tap was cancelled, so it is the current position. Say so.
  - What is one "pad move" for undo: a tap, a whole drag, each arrow-key nudge, a run of nudges, a return?
  - Does return write the undo slot?
  - What do a second finger on the pad and the movement threshold do?
  - Which way does y point? Is y = 0 at the top or the bottom?
  - What is the keyboard nudge step size?
- **Latency:** at 120 bpm, a 250 ms window plus a "≥ 1 step" start plus a 1–2 step glide means a tap is heard 3–4 steps (375–500 ms) later. That is sluggish for a live instrument. Also, the generator samples x/y once per step, so a "1–2 step glide" is at most one intermediate pattern.
- **Recommendation:**
  - Write the gesture state machine out as a table in the PRD.
  - Consider applying a tap at the next step boundary and letting the double-tap revert it. A first tap is audible for at most one or two steps — a trade-off for the owner.
  - Let the gesture module own ms windows and the transport own step quantisation. Today both claim "the double-tap window".

### 7. Major: browser touch defaults that will break playing
- **Where:** `design.md` "Pad interaction", loop strip; screenshot `01` (pad is full-bleed, edge to edge).
- **What:**
  - In iOS Safari, a swipe from the left screen edge navigates back. Android gesture navigation does the same from either edge. A pad that touches the screen edge will trigger this mid-performance [judgement; behaviour verified in practice, not this session].
  - Long-pressing the loop zones and labels triggers text selection, the iOS callout, or the Android context menu.
  - "Slide between loop sizes while holding" fails with default implicit pointer capture: touch pointers stay captured to the first zone.
- **Recommendation:**
  - Inset the pad from the screen edges by about 16 px and honour `env(safe-area-inset-*)` with `viewport-fit=cover`.
  - Set `touch-action: none` on the pad and the loop strip; `user-select: none` and `-webkit-touch-callout: none` globally; `overscroll-behavior: none`; prevent `contextmenu`.
  - For the loop strip, release pointer capture and hit-test with `elementFromPoint`.
  - Specify multi-touch: one finger holds a loop while another plays the pad or a mute, with each pointer tracked by `pointerId`.

### 8. Major: agents cannot "tune by ear", and nothing tests the UI
- **Where:** `prd.md` "Testing Decisions" (voices, drive and UI not tested); "Further Notes" ("Implementer's choice, tune by ear").
- **What:** The implementers are agents. Every run will invent different defaults, and nobody but Pierre can judge sound or feel. The hardest v1 requirements — no scroll, 44 px targets, breakpoints, about routing — have no automated check, so an agent cannot know it is done.
- **Recommendation:**
  - Add one `tunables.ts` with named defaults, chosen in the PRD (start from the handover's demo values). Agents never change it without an issue.
  - Add Playwright smoke tests at the target viewports: no scroll (`scrollHeight <= innerHeight`), every control ≥ 44 px, `/about/` direct load, back-button behaviour, hash round-trip.
  - Voice acceptance check: render each voice offline in Playwright (`OfflineAudioContext`, or the worklet's process function in Node if you port Peaks). Assert no NaN, peak below 0 dBFS, decay within range, and drive gain compensation within ±3 dB RMS.
  - Make "checked on a real phone by Pierre" an explicit gate per phase.

### 9. Major: the first launch and audio start are undefined
- **Where:** stories 1–2; `design.md` header (`stop`/`play`); every screenshot shows `stop`, so playing.
- **What:** An AudioContext needs a gesture, so the app cannot open already playing. Open questions:
  - Is the initial state `play` and stopped?
  - Does the first tap anywhere (pad, slider) both unlock audio and start the transport, and does it also act on the control it lands on?
  - Does stop reset to step 0 and re-roll chaos?
- **Recommendation:**
  - Open stopped, with `play` shown.
  - The first pointerdown anywhere resumes the context and starts the transport, and the tapped control still acts.
  - Play always starts at step 0, which rolls chaos.
  - Write this down.

### 10. Major: mute cannot be reached in most phone states
- **Where:** story 17; `design.md` ("tapping a drum label mutes"); screenshots `03`, `04`, `05`.
- **What:** Drum labels exist only on the density strips. In the `fx` tab, in sound mode (where `bd sd hh` are tab labels) and in landscape `fx`/`sound`, mute is unreachable. In sound mode, tapping `sd` selects the tab instead of muting.
- **Recommendation:** Make the step display's row labels (`bd sd hh`, always visible) the mute toggles, at least 44 px tall per row together. Keep the strip labels as a second target.

### 11. Major: GPL obligations are under-specified
- **Where:** `prd.md` "Stack and delivery"; `design.md` "About".
- **What:**
  - Distributing minified GPL code requires the Corresponding Source. "A link to the source" should point at the exact deployed commit.
  - If any Peaks code is ported, its MIT notice must ship with it, and Vite strips comments by default.
  - IBM Plex Mono is under the OFL. Self-host it and ship `OFL.txt`; don't load it from Google Fonts, for privacy and for the later PWA.
- **Recommendation:**
  - Inject the commit SHA at build time and link `source` to `/tree/<sha>`.
  - Add `THIRD_PARTY_NOTICES` (Grids GPL, Peaks MIT, Plex OFL) and link it from about.
  - Self-host a subset of Plex Mono with only the weights actually used. The DPR-dependent weights 200–600, with italics, could mean about 10 font files; consider cutting them.

### 12. Major: breakpoints are only defined by height; tablets and input type are undefined
- **Where:** `prd.md` "Layout rules" (the "wide / laptop" width is never given); `design.md` "Help" (touch vs laptop).
- **What:** There is no width breakpoint for the laptop layout and no tablet design (iPad portrait 820×1180 or landscape 1180×820). "Touch screens vs laptops" for `// help` has no detection rule (touch laptops, iPads with keyboards).
- **Recommendation:**
  - Define the layout tiers as a table of width/height conditions.
  - Use the laptop layout for any viewport at least ~1000 px wide and ~640 px tall, including iPad landscape.
  - Choose the help behaviour by `matchMedia('(hover: hover) and (pointer: fine)')`, not by layout.

### 13. Major: the looper and the anchor have unanswered edge cases
- **Where:** `prd.md` module 2 and stories 28–36; `CONTEXT.md` "Looper", "Anchor".
- **Looper:**
  - Does sliding to another size keep the start step or restart at the current step?
  - Are accents repeated on 1/16 and 1/32 retriggers? They get loud.
  - Does chaos re-roll on loop wraps? It should not (see finding 5).
  - Does the step display show the played step, the playhead, or both?
  - Is the start quantised to the step grid?
- **Anchor:**
  - What does return do before any anchor is set?
  - Does pressing return again while pending cancel it?
  - Is "next bar" measured on the playhead while looping?
  - What does return do while stopped?
  - Does return glide or jump?
- **Recommendation:**
  - Initialise the anchor to the setup loaded at startup.
  - Pressing return again cancels.
  - The bar is measured on the playhead.
  - Return applies immediately when stopped.
  - Return jumps, with no glide.
  - Accents are suppressed on retriggers after the first.
  - Sliding keeps the start step.
  - Show the playhead as a faint marker while looping.

### 14. Major: the URL codec rules miss mapping drift and navigation details
- **Where:** `prd.md` module 4; stories 37–40; `design.md` "About".
- **What:**
  - Bytes store normalised values. If a later version changes the curve from a byte to Hz or decay time, old links sound different, which breaks story 40 in spirit. Old-version decoders must be kept forever.
  - `hashchange` (a link pasted into the same tab) is not handled.
  - The bpm range is unspecified; it must fit one byte.
  - About: if `← back to play` does `pushState('/')`, the back button returns to about. On a direct visit to `/about/` there is no history to go back to. "· still playing" is wrong if nothing is playing.
- **Recommendation:**
  - Make the version byte cover parameter mappings. Keep a decoder per version and add fixture tests with frozen v1 URLs.
  - Listen for `hashchange`.
  - Set bpm to 40–240.
  - Back = `history.back()` if the app pushed the entry, otherwise `replaceState('/')`.
  - Show "· still playing" only while playing.

### 15. Minor: contradictions between the documents and the screenshots
- `10-interaction-reference.png` says about opens by tapping `# rimbalzello` in the header. `prd.md` and `design.md` say `// about` in the footer. Pick one; both is fine.
- `05-phone-landscape.png` has no `−`/`+` tempo controls and no footer (no help, about or source). `design.md` says "header" and implies the footer.
- Story 14 says the X/Y position is visible to every player. Only laptops show `x 087 · y 148`; the phone screenshots have no readout.
- `06`/`07`: the 5×5 node `+` marks are inset (at about 15–85 % of the pad). In Grids, the nodes sit at x/y = 0, 64, 128, 192 and ~255, so on the edges [fact: `x>>6` indexing]. An agent copying the mockup will draw wrong nodes.
- `set anchor` is underlined on phones but not on laptops.
- Values shown are 0–99 (63, 78), while parameters are bytes 0–255. The display mapping is unspecified.
- Laptop sound sliders show no values; phone sliders do.
- `prd.md` module 1 says "ported in spirit" but also "follow the original" and "golden fixtures must match".
- `design.md` says "text wins over screenshots", but the precedence between `prd.md` and `design.md` is unstated. State it.

### 16. Minor: keyboard bindings on non-US layouts and with focus
- **Where:** `design.md` "Keyboard"; `prd.md` module 7.
- **What:**
  - On Swiss German QWERTZ (Pierre's own keyboard), `=` is Shift+0 and `?` is Shift+'. On AZERTY, `q`/`a` move and digits need Shift.
  - Key autorepeat re-fires the `1`–`4` holds.
  - Space activates a focused button and also toggles play.
  - Arrow keys move a focused native range input as well as nudging the pad.
- **Recommendation:**
  - Use `event.code` for the positional keys (`KeyQ/W/E`, `KeyA`, `KeyR`, `Digit1–4`).
  - Use `event.key` for `?`, and accept `+` as well as `=`.
  - Ignore `event.repeat`.
  - Handle keys globally with `preventDefault`, and keep focus off the controls (or define the conflicts).

### 17. Minor: master safety, and how accents map to velocity
- **What:** Three voices, accents and drive can still clip the output. "Accents drive velocity" has no amount.
- **Recommendation:**
  - Put a fixed brick-wall limiter (`DynamicsCompressorNode` with a high ratio and fast attack) last in the chain.
  - Accent: +4 to +6 dB, or non-accent hits at about 0.6.
  - Put both in `tunables.ts`.

### 18. Minor: accessibility is not mentioned
- **What:**
  - The tertiary grey `#757575` on `#202322` has a contrast of about **3.4:1** [fact: computed]. It is used for the small uppercase footer and markers, and fails WCAG AA for small text (4.5:1). `#ababab` is about 6.9:1.
  - Ultra-thin Plex at weight 200 on 3× screens hurts legibility in dim or outdoor use [judgement].
  - The canvas pad has no accessible equivalent.
  - The return pulse ignores reduced motion.
- **Recommendation:**
  - Lift the footer grey to about `#8a8a8a`.
  - Use a minimum weight of 300.
  - Use native `<input type=range>` or ARIA sliders for the strips.
  - Expose the pad as an `role=application` / slider pair driven by the arrow keys.
  - Respect `prefers-reduced-motion` for the pulse.

### 19. Minor: scope
- **Cut or simplify [judgement]:**
  - The landscape phone layout: already "drop if trouble". Make it explicitly phase-last.
  - The prerendered `/about/` as an app state with a live "still playing" view: keep it, but generate both from one HTML source (Vite multi-page input). With Solid there is no SSR, so "prerendered credits" otherwise means duplicating the content.
  - Fine adjust (double-tap-and-slide) could wait until the basic gestures feel right.
- **Missing for v1:**
  - iOS audio session and interruption handling (finding 2).
  - The start state (finding 9).
  - The web manifest (finding 1).
  - A fallback screen when Web Audio or AudioWorklet is unavailable.
  - A CI workflow (typecheck, lint, Vitest, Playwright) that gates the Pages deploy.
  - `public/CNAME`.
  - Vite `base: '/'`.
- **Music [judgement]:** hh has only `level`, so the hats are the least playable voice. One extra `decay` (open/closed feel) is cheap even if Peaks' HH has none.

### 20. Minor: process
- **Where:** `AGENTS.md` "Commit straight to `main`".
- **What:** With agents committing and Pages deploying from `main`, every intermediate commit goes live at the public URL.
- **Recommendation:** Deploy from tags or a `release` workflow, or gate the deploy on CI passing.

---

## Licence

**Verified facts:**
- The eurorack README says: "Code (AVR projects): GPL3.0. Code (STM32F projects): MIT license. Hardware: cc-by-sa-3.0. By: Emilie Gillet". Grids is AVR; Peaks is STM32F. Source: https://github.com/pichenettes/eurorack/blob/master/README.md
- `grids/pattern_generator.cc`, `grids/resources.cc` (which holds `node_0..24`) and the generator script `grids/resources/resources.py` (pulling `lookup_tables.drum_map_nodes`) all carry "Copyright 2011/2012 Emilie Gillet … GPL version 3 … or (at your option) any later version". The node-placement table `drum_map[5][5]` is in `pattern_generator.cc`. https://github.com/pichenettes/eurorack/tree/master/grids
- `peaks/drums/bass_drum.cc` and the other drum files are MIT, "Copyright 2013 Emilie Gillet". https://github.com/pichenettes/eurorack/tree/master/peaks/drums
- Trademark guidance in the README: "Mutable Instruments is a registered trademark. The name 'Mutable Instruments' should not be used on any of the derivative works … We do not recommend you to keep the original name of the Mutable Instruments module." "rimbalzello" plus credits-only use of "Grids"/"Peaks" complies.

**Assessment [judgement, not legal advice]:**
- The **algorithm** (bilinear interpolation of per-step levels, a density threshold, per-pattern perturbation, accent > 192) is an idea or method, not expression. A fresh TypeScript implementation written from a description is yours to licence. The only GPL-bound part is the **drum map data**: 25 × 96 hand-designed bytes plus their placement.
- Whether that table is copyrightable is uncertain. It encodes composed musical patterns, which points towards protection. Under Swiss law (URG Art. 2, "individual character") and under US *Feist* (minimal creativity), it could go either way. Don't build on "it's just data".

**Ways to a permissive licence, best first:**
1. **Ask Émilie Gillet** (sole copyright holder per the headers and README) for a written grant to use the Grids drum map (and the `drum_map` placement) under MIT. This costs one email. Note that a "GPL-or-later" grant does not allow MIT; only she can grant it.
2. **Split licensing now, whatever her answer:** your own code is MIT. Only `src/grids-map.ts` (and the C++ fixture harness) is GPL-3.0-or-later. State in the README that the built app, as a combined work, is distributed under GPL-3.0-or-later while it contains the map. The engine, UI and voices stay reusable under MIT, and if permission comes, you only change one file header. Use SPDX headers per file.
3. **Your own map:** derive 25 nodes yourself, e.g. from your own or public-domain drum patterns, with a small script that builds level maps from pattern sets. The result is fully MIT, but the groove landscape differs from Grids; ship it as an alternative "map" if the answer to option 1 is no. A clean-room process adds little here: the map is the expression, and an independently made one is fine without it.
4. **Not recommended:** fetching the GPL map at runtime as a "separate file" to argue mere aggregation. The program is built around the data, so the argument is weak.
- Peaks being MIT means a Peaks voice port (finding 3) adds no licence burden beyond keeping the notice.

---

## Questions for the owner

1. Will you email Émilie for an MIT grant on the drum map, and adopt the split-licence layout (MIT code, one GPL map file) in the meantime?
2. Voices: native Web Audio graphs as planned, or a TypeScript port of Peaks' drums plus the sequencer clock in an AudioWorklet?
3. Tap response: keep the silent-undo rule (3–4 steps of latency at 120 bpm), or apply a tap at the next step and accept a brief audible blip before a double-tap undo?
4. Which real devices and viewports are the acceptance targets, and should the compact tier (iPhone SE in Safari) and sound mode on short phones be designed now?
5. First launch: open stopped with `play`, with the first touch anywhere starting the music? And does stop/play restart at step 0?
6. Mutes: move the toggles to the always-visible step-display labels?
7. About entry: footer `// about`, header title, or both?
8. Are Playwright layout and audio smoke tests in scope, so that agents have a definition of done for UI and voice issues?
9. Who sets the `tunables.ts` defaults before the agents start, and are agents forbidden to change them?
10. Deploy on every commit to `main`, or only from tags or after CI passes?
