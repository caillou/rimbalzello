# Review of the rimbalzello v1 plan

Reviewed: `AGENTS.md`, `CONTEXT.md`, `prd.md`, `design.md`, `handover-grids-peaks.md`, all ten PNGs in `designs/`, the mockup source in `designs/src/`, and upstream `pichenettes/eurorack` (`README.md`, `grids/pattern_generator.{h,cc}`, `grids/resources.cc`, `grids/resources/lookup_tables.py`, `grids/grids.cc`, `peaks/drums/*.cc`).

Each finding is marked **[verified]** (checked against a file or upstream source) or **[judgement]** (my opinion). Viewport heights and browser-behaviour claims are from memory and marked as such.

## Findings, most important first

### 1. Blocker: a Grids step is a 32nd note, not a 16th. The pattern is one bar, not two

- **Where**: `CONTEXT.md` (Step, bar, Looper), `prd.md` modules 1 and 2, `handover-grids-peaks.md` ("Once per 16th note: TickClock(3)").
- **What** [verified]: `grids/pattern_generator.h` line 39: `kPulsesPerStep = 3;  // 24 ppqn ; 8 steps per quarter note.` and `beat_ = (step_ & 0x7) == 0`. So 32 steps are 4 quarter notes: one 4/4 bar. I parsed the 25 nodes: 20 of them have zeros on every odd step (they are 16th-note patterns over one bar), 5 nodes (11, 15, 17, 23, 24) use odd steps for 32nd-note detail.
- **Why it matters**: the plan plays every groove at half speed (a "120 bpm" setup sounds like 60 bpm with 8th-note resolution). "Bar = 16 steps" makes return land mid-pattern. The looper table (4, 2, 1, ½ steps) is off by a factor of two, and the awkward "½ step" case only exists because of this error.
- **Recommendation**: fix the glossary: step = 32nd note, pattern = 32 steps = 1 bar, beat = 8 steps. Looper sizes become 8, 4, 2, 1 steps (no sub-step case). Return lands on step 0. The step display stays 32 characters and now shows exactly one bar. Correct the handover note so nobody copies it.

### 2. Blocker: the phone layouts are designed for viewport heights that phones in a browser do not have

- **Where**: `01-phone-play.png` (390×844), `04-phone-short.png` (375×667), `prd.md` Layout rules, PWA out of scope.
- **What**: 844 and 667 are full screen heights. Without PWA/standalone mode the app runs inside Safari or Chrome with toolbars. From memory, visible heights are roughly 660 px on an iPhone 14/15 and roughly 550 px on an iPhone SE [judgement, approximate numbers; measure on devices]. Measured from `04-phone-short.png` [verified]: non-pad chrome in the short layout is about 424 px, so a 240 px pad needs about 664 px of viewport. Consequences: the "normal" portrait layout of screenshot 01 almost never appears; a current iPhone only just fits the short layout; an SE gets a pad of about 125 px, half the stated minimum.
- **Why it matters**: this is the primary target ("phone first") and the pad is the instrument.
- **Recommendation**: redesign against real small-viewport heights (about 550, 640, 660 px). Decide what gives on small heights: overlay the step display on the pad's bottom edge (as landscape already does), merge the footer into the header, shrink strip rows. Specify `100dvh`/`svh`, `env(safe-area-inset-*)`, `overscroll-behavior: none`. Consider pulling a web app manifest with `display: standalone` into v1 (no service worker needed) so "add to home screen" gives the full height.

### 3. Major: native Web Audio voices, tuned "by ear", implemented by agents that cannot hear

- **Where**: `prd.md` module 6, Testing Decisions, Out of Scope.
- **What** [judgement]: the plan rejects the route the handover proved (Peaks DSP, already rendering correct WAVs) and replaces it with voices that have no tests and no reference. Module 6 even leaves the BD topology open ("pitched oscillator or high-Q filter ping"). Every agent run will produce a different-sounding kit and none can check it.
- **Coupled problem**: native nodes force the scheduler onto the main thread (see finding 4).
- **Recommendation**: port the three Peaks drums to TypeScript inside one AudioWorklet (they are MIT, integer-only, a few hundred lines; `high_hat.cc` is 40 lines). Test in Vitest against golden WAVs rendered from the C++ build. Run the context at 48 kHz (`new AudioContext({ sampleRate: 48000 })`) so the original tables apply. Add level, drift and drive on top. Put the transport in the same worklet. WASM is unnecessary at this size. If native voices stay, at minimum: fix one topology per drum with concrete numbers (HH partials are 540, 800, 414, 607, 740, 1050 Hz [verified from `high_hat.cc` phase increments at 48 kHz], band-pass 8 kHz, high-pass 13 kHz, half-wave rectified VCA), keep the six HH oscillators running permanently instead of creating them per hit, and define choke behaviour (Peaks drums are monophonic and retrigger; per-hit graphs overlap).

### 4. Major: main-thread lookahead scheduler is fragile on phones and adds control latency

- **Where**: `prd.md` module 2 ("short lookahead (25–100 ms)").
- **What** [judgement]: pad dragging plus canvas/DOM step animation on a mid-range phone will produce main-thread stalls above 25 ms; hits are then late or dropped. Timers are throttled to about 1 s when the tab is hidden, so the groove falls apart. A longer lookahead fixes jitter but makes pad moves, looper presses and return feel late, because scheduled hits cannot be recalled.
- **Recommendation**: run the pure transport state machine inside the AudioWorklet, counting samples (it stays testable with a fake clock). Parameters arrive by `port.postMessage` and apply on the next step. If the main-thread design stays: tick from a Worker timer, lookahead of at least 100 ms, mute through per-drum gain nodes so mutes are instant, and state what happens when the tab is hidden.

### 5. Major: iOS audio and screen behaviour is deferred, but it decides the first impression

- **Where**: `prd.md` Further Notes ("handle later if it bites"), Audio context, stories 1 and 2.
- **What** [judgement, from memory of platform behaviour]:
  - The ring/silent switch mutes Web Audio. Many iPhones are permanently on silent; the app will look broken. Fix: `navigator.audioSession.type = 'playback'` where available, with a silent looping `<audio>` element as fallback.
  - The AudioContext goes `interrupted`/`suspended` after calls, tab switches and lock; it needs a resume on `visibilitychange` and on the next gesture.
  - The screen dims and locks during play. A live instrument needs the Screen Wake Lock API while playing.
- **Contradiction** [verified]: "always playing", story 1 ("press play and hear a groove immediately") and story 2 ("audio starts after my first tap") describe three different start behaviours. No screenshot shows the not-yet-started state; all show `stop`.
- **Recommendation**: specify the cold-start state (header shows `play`; the first tap on play or the pad creates and resumes the context and starts the transport) and what a shared link shows before the first tap. Move the three iOS items into v1.

### 6. Major: licence. GPL is correct today; a permissive licence is reachable only for Pierre's own code or with a new map

See the Licence section below. The decision affects module boundaries and fixtures, so it must be taken before issues are generated.

### 7. Major: tap latency. Every pad tap waits for the double-tap window

- **Where**: `prd.md` stories 7, 9–11, modules 2 and 5; `design.md` Pad interaction.
- **What**: a tap is held back about 250 ms, then glides over 1–2 steps. With steps being 32nds (62 ms at 120 bpm) the glide is one or two intermediate values, so it is inaudible as a glide while the delay is clearly felt [judgement]. Modules 2 and 5 both claim the double-tap delay ("jump (on tap, after the double-tap window)" in the interpreter and "glide ... starts after the double-tap window" in the transport) [verified], so two agents will implement it twice or disagree on who owns it.
- **Recommendation**: remove the conflict by moving undo off the double-tap: a two-finger tap on the pad, or a small `undo` text button in the pad corner. Taps then act on the next step. If double-tap stays, give the delay to exactly one module (the gesture interpreter, in milliseconds only, no "at least one step") and define glide in milliseconds.

### 8. Major: pattern generator interface and golden fixtures do not fit how Grids uses randomness

- **Where**: `prd.md` module 1, Testing Decisions.
- **What** [verified]: the chaos perturbation is state (`part_perturbation_[3]`, rolled at step 0, used for the next 32 steps), so "setup and step in, hits out" is not a pure function. Grids' RNG is a global LFSR that also advances on every clock pulse (`Random::Update()` in `Evaluate()`), so "a fixed seed" only reproduces C++ output if the port replicates the exact call sequence. Perturbation is `randomByte * (chaos >> 2) >> 8`, at most 62, and it also changes accents.
- **Recommendation**: split the interface: `rollPerturbation(chaos, rng) → [p0, p1, p2]` and `evaluate(x, y, densities, perturbation, step) → hits, accents`. Golden fixtures take the perturbation as explicit input; no RNG matching. Also specify `U8Mix` exactly (`(a*(255-f) + b*f) >> 8`, with `f = (x << 2) & 0xff`) and the 5×5 node arrangement table from `pattern_generator.cc`, because "copied exactly" must include the arrangement, not only the 25 arrays. Say when chaos re-rolls during a held loop (recommendation: when the hidden playhead passes step 0).

### 9. Major: looper, anchor and transport edge cases are unspecified

- **Where**: `prd.md` module 2 and 3, stories 28–36; `CONTEXT.md`.
- **Missing decisions** (each one an agent will guess):
  - Loop start: the step sounding at touch time or the next step? Quantised how?
  - Sliding to another size: same start step, or restart at the slide moment?
  - Which step the display highlights during a loop: played step or playhead? (Recommendation: highlight the played step, show the playhead dimly.)
  - A pending return while a loop is held: lands on the hidden playhead's bar line or waits for release?
  - Return before any anchor was set: disabled, or returns to the setup at load? (Recommendation: anchor initialises to the loaded setup.)
  - Return pressed twice: cancel or no-op? Return while stopped: immediate?
  - Stop/play: restart at step 0? Clears pending return and held loop?
  - Is the anchor persisted across reload? It is not in the URL.
  - Does return glide or jump the position? What happens to a slider the player is holding when return lands?
  - What the pad undo slot holds after a drag, a fine adjust, an arrow nudge and a return.
  - Multi-touch: story 32 needs one finger on the loop strip and another on the pad at once; nothing says pointers are tracked independently.
- **Recommendation**: add a short "transport rules" table to the PRD answering each line; these become the transport tests.

### 10. Major: URL format must be frozen before launch, and the throttle has a hard browser limit

- **Where**: `prd.md` module 4, stories 37–40, Further Notes ("tempo range: implementer's choice").
- **What**: story 40 promises old links keep working, yet the byte order, the bpm encoding and the tempo range are left to the implementer [verified]. The byte count works out (20 parameters → 27 base64url characters + `v1.` = 30) [verified]. The sound a byte maps to is "tuned by ear", so retuning voices later silently changes every shared groove [judgement]. Safari throws a SecurityError above 100 `replaceState` calls per 30 seconds [from memory], so "throttled" needs a number.
- **Recommendation**: write the byte table in the PRD (order, range, default per field; bpm as `byte + 40`, clamped 40–240, for example). State the compatibility rule: v1 payloads shorter than expected fill defaults, new fields are appended, a changed meaning bumps the version and old versions are migrated. Update the hash on gesture end plus at most once per second, inside try/catch. Handle `hashchange` (pasting a link into the open tab). Freeze voice parameter curves at release.

### 11. Major: no feedback loop for half the product

- **Where**: `prd.md` Testing Decisions ("Voices, drive and UI are not unit tested").
- **What** [judgement]: with agents doing the implementation, untested means unverified until Pierre plays it. Layout rules across five form factors, the never-scroll rule and the audio graph are exactly where agents drift.
- **Recommendation**: add Playwright: (a) screenshot runs at the agreed viewports compared by eye or by diff against `designs/`, with an assertion that `document.scrollingElement.scrollHeight <= innerHeight`; (b) an audio smoke test that renders 2 bars and checks each drum is non-silent and the master does not clip. With the worklet DSP port (finding 3), voice tests run in plain Vitest. Also name the toolchain so agents do not choose: package manager, Node version, linter/formatter, `tsconfig` strictness, CI workflow, deploy workflow (GitHub Actions to Pages, `public/CNAME`).

### 12. Major: touch handling rules are missing

- **Where**: `prd.md` module 5 and 8, `design.md`.
- **Missing**: `touch-action: none` on pad, strips and loop strip; `user-select: none` and `-webkit-touch-callout: none` (holding a loop zone is a long press, which selects text on iOS); pointer capture; the iOS left-edge back swipe, which starts on the pad because the pad is edge-to-edge and becomes live once about pushes a history entry; strips: does a tap on the track jump the value (dangerous live) or is dragging relative? (Recommendation: relative drag from anywhere on the row, no jump.) Can a muted drum's density be changed, and why does the value vanish behind `mute`?
- **Recommendation**: add an "input rules" section with these as explicit requirements.

### 13. Major: keyboard conflicts and layouts

- **Where**: `design.md` Keyboard, `prd.md` module 7.
- **What** [judgement]: Pierre is likely on a Swiss keyboard, where `=` is shift+0 and `?` is shift+'. `event.code` and `event.key` give different answers; the plan does not choose. Key auto-repeat on held `1`–`4` must be ignored. Arrow keys on a focused slider versus pad nudge, and space on a focused button versus play/stop, are undefined. Nudge step sizes are not given.
- **Recommendation**: match by `event.key` for `?`, `-`, `+`/`=`; by `event.code` for letters and digits; ignore `repeat`; shortcuts are global except that arrows go to a focused slider; nudge 8, fine 1.

### 14. Minor: contradictions between documents and screenshots

All [verified]:

- `10-interaction-reference.png` says about opens by tapping `# rimbalzello` in the header; `prd.md` and `design.md` say footer `// about`. The mockup hint text has the same stale line.
- Values: glossary says 0–255; strips in every screenshot show 0–100 style numbers (63, 78, 34); the pad readout shows `x 087 · y 148`. Display scale is undefined.
- Story 49 wants a footer line telling laptop players that `?` shows shortcuts; `07-laptop-shortcuts-hidden.png` (the default state) shows no `?`. `design.md` lists `// help ?` unconditionally.
- `05-phone-landscape.png` has no tempo − / +, no footer and no about/help entry; `design.md` says the header is on the right.
- `06`/`07`: the 5×5 node marks are inset (at about 15 %, 32 %, 50 %, 68 %, 85 % of the pad). Real nodes sit at 0, 64, 128, 192, 256, so the outer nodes are on the pad edges.
- `set anchor` is underlined on phones and not on the laptop screenshots; `design.md` says underlined.
- Story 14 (see the X/Y position): the readout exists only in the laptop screenshots.
- The title phrase "a Grids-style drum machine" (`prd.md` title, `AGENTS.md` line 3) conflicts with `AGENTS.md` "Grids ... appear only as credits".
- Pad axes: no document says whether y grows up or down.

### 15. Minor: responsive rules have gaps

- No width breakpoint for "wide"; no tablet layout although tablets are a target (iPad portrait is 768–834 px wide).
- "Touch screens" versus "laptops" for help is not defined (iPad with keyboard, touch laptops). Recommendation: hint box when `(pointer: coarse)`, keycaps after the first keydown.
- Landscape phone: "drop it if it causes trouble" is not a decision an agent can make. Recommendation: cut it from v1; visible landscape height is about 300 px.
- Sound mode on phones and the `fx` tab hide the drum labels, so mutes are unreachable there, against "performance controls are never hidden".

### 16. Minor: about as app state with pushed history is more machinery than a credits page needs

- **Where**: `prd.md` About page, `design.md` About.
- **What** [judgement]: prerendering through Solid means SSR and hydration for one static block. History is undefined for a direct visit to `/about/` (back leaves the site; "still playing" is false). `// source` and the caillou.ch links navigate away and stop the music.
- **Recommendation**: keep the credits as plain static HTML present in both entry files, shown and hidden by the app, no Solid rendering. Close uses `history.back()` when the app pushed the entry and `replaceState('/')` otherwise. External links open in a new tab. Or cut the URL entirely: an overlay in the app and nothing else.

### 17. Minor: accessibility is absent

- Tertiary `#757575` on `#202322` is about 3.5:1 [computed], below 4.5:1 for small text; it is used for the 12 px footer and rest dots. Weight 200 at 3× makes small text thinner still.
- Custom sliders need `role="slider"`, `aria-valuenow`, keyboard operation, visible focus. Mute state is conveyed by strike-through only.
- The return pulse should respect `prefers-reduced-motion`.

### 18. Minor: tempo control cannot do what story 3 asks

`−`/`+` with no stated step, range or hold-repeat cannot "match the music around me" in reasonable time. Recommendation: hold-to-repeat with acceleration, plus tap tempo on the bpm number.

### 19. Minor: smaller items

- Up to ten Plex Mono font files (five weights, two styles). Self-host, subset, preload; include the OFL notice.
- Drive: add a limiter after the waveshaper; "does not get much louder" needs a measurable target (for example ±2 dB RMS across the drive range).
- Accents are not visible in the step display; muted lanes have no defined look.
- Repo has no `LICENSE` or `README`.
- "Commit straight to main" plus deploy-on-push publishes every agent commit. Decide whether deploys are manual or tagged.
- The hardware looper reference should stay in docs, not in the UI.

## Licence

**Verified facts**

- Upstream README, section "License": "Code (AVR projects): GPL3.0. Code (STM32F projects): MIT license." https://github.com/pichenettes/eurorack/blob/master/README.md
- Grids is an AVR project. `grids/pattern_generator.cc`, `grids/resources.cc` (the 25 nodes) and `grids/resources/lookup_tables.py` (the node source data) each carry a GPL "version 3 of the License, or (at your option) any later version" header, copyright Emilie Gillet. https://github.com/pichenettes/eurorack/blob/master/grids/resources/lookup_tables.py
- `peaks/drums/bass_drum.cc` carries an MIT header. https://github.com/pichenettes/eurorack/blob/master/peaks/drums/bass_drum.cc
- README, "Guidelines for derivative works": "Mutable Instruments is a registered trademark. The name 'Mutable Instruments' should not be used on any of the derivative works"; keeping the module name is "not recommended".

**Conclusion** [judgement, not legal advice]

1. Shipping the copied map makes the distributed app GPL-3.0-or-later. The plan is right on that.
2. "The data is not copyrightable" is not a safe basis. The map is 2,400 hand-curated values expressing musical patterns, published by the author under an explicit GPL header. Originality thresholds differ by country and nobody has tested this; taking it against the stated licence would also be a poor way to treat the person being credited.
3. Routes to a permissive licence, best first:
   - **Split licensing, available today.** Licence all of Pierre's own code (UI, transport, store, codec, gestures, voices) as MIT with per-file SPDX headers. Keep the map and the ported generator in one isolated module under GPL-3.0-or-later. The built site is GPL as a whole; anyone can reuse the MIT parts by swapping the map. This needs the map behind a data interface, which is good design anyway.
   - **Ask Émilie Gillet** for permission to use the Grids map and generator under MIT (she is the sole copyright holder named in the headers; the README gives her email). A yes makes the whole project MIT. Keep the reply in the repo.
   - **Own map.** Author 25 nodes yourself. The algorithm (bilinear blend between nodes, density threshold, random lift, accent threshold) is an idea and can be reimplemented, but the implementer has read the source, so write it from a prose description rather than porting line by line. The app would then no longer play Grids' grooves, and the C++ golden fixtures could not be used (they embed the map).
   - Fetching the GPL map at runtime from a separate URL to keep the bundle "MIT" is a dodge; do not do it.
4. Peaks: modelling voices on it creates no obligation. If code or tables are ported (finding 3), keep the MIT notice in those files and in a third-party notices file.
5. GPL duty for a static site: minified JS is object code, so link the exact source (the about page already plans this) and keep the licence text in the repo.
6. Naming: the plan complies. Keep "Grids" and "Mutable Instruments" out of the page title, meta description, social card and repo description; use them only in the credits with the existing non-affiliation line.

## Questions for the owner

1. Engine: accept a TypeScript port of the Peaks drums plus transport in an AudioWorklet for v1, or stay with native nodes and accept untestable voices and a main-thread scheduler?
2. Licence: split licensing now (MIT for your code, GPL map module), and will you write to Émilie Gillet?
3. Is "add to home screen" (manifest, standalone) in v1? If not, which control gives way on a 550 px tall viewport?
4. Undo gesture: keep double-tap and its delay on every tap, or move undo to a two-finger tap or button?
5. Tempo: range, step, and is tap tempo in v1?
6. Displayed values: 0–100, 0–255, or no numbers?
7. Looper: does the loop start on the sounding step or the next one, and does sliding sizes keep the start?
8. Anchor: what does return do before the first set, and does the anchor survive a reload?
9. Is landscape phone cut? Is there a tablet layout or does the tablet get the laptop layout above a given width (which)?
10. About: keep the `/about/` URL, or an overlay only?
11. Should the last setup be remembered when the bare URL is opened again?
12. Deploy: every push to main, or manual?
