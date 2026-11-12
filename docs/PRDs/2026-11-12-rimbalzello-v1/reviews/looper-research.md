# Looper: behaviour research and spec

Question: how exactly does a hardware drum machine's touch-strip looper behave, so that Rimbalzello's loop strip can copy it?

Section 1 is vendor-neutral and ready to paste into the PRD. Section 2 gives the evidence. Source tags like [S1] point to section 3. Products are not named anywhere in this file: "the reference hardware looper" is the drum machine being copied, and "sibling" means a sequencer from the same manufacturer with the same looper strip.

Tags used in section 2: **[doc]** = stated in a manual or official note. **[review]** = stated by a third-party review. **[inferred]** = my reading where the sources are silent. **[decision]** = a choice for our app that the references don't settle.

## 1. Behaviour spec

Terms: **playhead** = the transport's real position, which keeps running at all times while playing. **Played step** = the step whose hits sound at a step boundary. With no loop held, played step = playhead step. Steps are 32nd notes, numbered 0–31 in a one-bar pattern.

### Zones

| Zone | Loop length |
|---|---|
| 1/4 | 8 steps |
| 1/8 | 4 steps |
| 1/16 | 2 steps |
| 1/32 | 1 step |

- The strip has four zones, ordered from longest on the left to shortest on the right: 1/4, 1/8, 1/16, 1/32. Keys `1`–`4` map to the zones in the same order.
- There are no triplet sizes.

### Engage

1. The looper works only while the transport is playing.
2. Touching a zone engages a loop. The **start step** `s` is the step the player hears at the moment of touch: the latest step boundary that has already sounded, with output latency taken into account. It is not the step being scheduled ahead.
3. The start is on the step grid. It is **not** snapped to a multiple of the loop length. A 1/8 loop touched while step 13 sounds covers steps 13–16.
4. The loop takes effect from the next step boundary. No hit is cut or retriggered in the middle of a step.
5. The **window** is steps `s … s+L−1`, counted modulo 32. A window may cross the bar line: a 1/4 loop started at step 28 plays 28, 29, 30, 31, 0, 1, 2, 3.

### While held

6. The playhead keeps advancing one step per step boundary, exactly as if no loop were held.
7. At each step boundary, with playhead step `p` counted without wrapping (so `p − s` is the number of steps since engage), the played step is `(s + ((p − s) mod L)) mod 32`.
   - Example: with a 1/8 loop at step 13, the played steps are 13, 14, 15, 16, 13, 14, 15, 16, …
   - With 1/32, the step `s` repeats on every step boundary.
8. **Sliding to another zone** while holding keeps the start step `s` and the phase. It changes `L` only, and rule 7 keeps applying with the new `L`.
   - Because all sizes are powers of two, a shorter loop always plays a sub-slice of the longer one, in time with it.
   - Sliding never restarts the loop and never re-reads the touch time.
9. Sliding off the strip, or lifting the finger, counts as a release. With keys: while more than one zone key is held, the key pressed most recently wins. Releasing it falls back to another key that is still held, as if the finger slid there. The loop ends only when no zone is held.

### Release (slip)

10. On release, the next step boundary plays the playhead step `p`. The loop leaves no trace, and playback continues exactly where it would have been had the loop never been engaged. This is called the **slip**.

### What stays live inside a loop

11. The looper changes **which step index is read**, not what the pattern contains. Each played step is read from the current pattern at that moment:
    - **Pad moves, densities and chaos amount** change what the looped steps contain, and the change is heard on the next pass.
    - **Accents** are repeated as stored in the looped steps. A held 1/32 on an accented step accents every retrigger.
    - **Mutes** apply immediately, as they do outside a loop.
    - **Sound, drift and drive** apply immediately. Every retrigger is a new hit and draws its own drift.
12. **Chaos re-roll** follows the playhead, not the played step. The perturbation is re-rolled when the playhead crosses step 0. Wrapping a loop through step 0 does not re-roll.
13. **Swing** follows the playhead, not the played step. The swing offset of a hit is the offset of the playhead slot it lands in. A looped slice therefore lands on the same swung grid that the rest of the music is on.
14. **Return** is measured on the playhead. A pending return lands when the playhead crosses step 0, even while a loop is held. The loop keeps running and from then on reads the restored setup.
15. **Tempo changes** apply to the playhead, and the loop follows.

### Scope

16. The loop applies to all three drums together. There is no per-drum loop.

### Transport

17. Touching a zone while stopped does nothing. A zone that is still held when play is pressed does not engage. The player must touch again.
18. Pressing stop while a loop is held ends the loop. Afterwards the transport's normal stop rule applies.

### Display

19. The step display highlights the played step. While a loop is held, the playhead step is also shown, dimmed. The held zone is shown inverted.

### Audio

20. Engaging a loop, sliding to another zone and releasing all cancel any hits that are scheduled but have not started, so that the change is heard at the next step boundary.

### Out of scope for v1

- Moving the loop start while holding (the reference lets you press a step button for this).
- MIDI CC input and output for the strip.
- A roll mode.

### Test statements

- "Holding 1/8 while step 13 is heard plays steps 13, 14, 15, 16, 13, … and on release plays the step the playhead has reached."
- "Holding 1/4 from step 4, then sliding to 1/8 when the playhead is at step 10, plays 6, 7, 4, 5, 6, …" (10 − 4 = 6 steps since engage, so `4 + (6 mod 4) = 6`.)
- "Holding 1/4 from step 4, then sliding to 1/32, repeats step 4." Sliding to 1/32 always collapses onto the start step. To freeze the step being heard instead, see the alternative in 2.3.
- "A 1/8 loop started at step 30 plays 30, 31, 0, 1, and holding it across the bar line does not re-roll chaos. The re-roll happens when the playhead crosses step 0."

## 2. Findings and evidence

### 2.1 Loop sizes and mapping

- There are four sizes: 1/4 is the largest and 1/32 the smallest. Moving the finger changes the size. [doc: S1 §2.3.3.1, S2 §6.6.2.1, S3 §3.2.4.1, S5 §4.2.12.1]
- On the main reference, the strip has five MIDI regions: OFF, 1/4, 1/8, 1/16, 1/32. They send the fixed CC values 0, 25, 50, 75, 100, and receiving 0–24, 25–49, 50–74, 75–99 or 100–127 activates the matching region. The table lists 1/4 to 1/32 in that order. [doc: S1 §9.10.3.2]
  - On the reference this goes from left to right. I am inferring that from the table order and the printed strip labels, which I remember but did not re-check. [inferred]
- The sizes are note values, and the number of steps depends on the sequencer's step length. A sibling unit's FAQ says: "If you're in time division 1/16 and press 1/4, the sequencer will repeat four steps … set time division to … 1/32 … will now repeat 8 steps instead of 4 when you press 1/4." [doc: S5 §4.2.12.2]
  - This confirms our mapping, with 32nd-note steps: 8, 4, 2 and 1 steps.
- There are no triplet loop sizes. Triplets appear only in Step Repeat (step edit) and in the Roller when the pattern's time division is a triplet. [doc: S1 §4.2.6, §4.1.5.2]
  - How the looper behaves on a triplet-division pattern is not documented. It doesn't matter for us.
- What the reference does with a 1/32 loop when the pattern runs at 1/16 steps (half a step) is not documented. This doesn't matter for us, because our step is a 32nd. [inferred]
- `CONTEXT.md` still says "4, 2, 1, ½ steps", which is based on 16th-note steps. The spec above uses 8, 4, 2, 1, following the step = 32nd correction in `review-fable.md` #1.

### 2.2 Loop start

- "The start point of the loop is based on when you touch the strip during playback." [doc: S1 §2.3.3.1, S3 §3.2.4.2, S5 §4.2.12.2]
- An earlier manual of the same family is more explicit: "The start and end points of the loop are based on the playback location of the pattern at the time the Looper strip is pressed." [doc: S3 §2.3.4.2]
- A review describes it as "looping the sequence at its current position at the current quantise length when pressed." [review: S6]
- None of the sources says the start snaps to a multiple of the loop size. Because the reference is a step sequencer, the start must be a step. Because a step button can move the start to any step while the loop is held [doc: S1 §2.3.3.1; S4 v2.0 note "Change the looper start point in the sequence by pressing steps"], loops can begin on any step and are not aligned to the loop-size grid. [inferred]
- The sources don't say whether the start is the step sounding at the touch or the next one. Spec rule 2 picks the step being heard. This repeats what the player just heard, which is how a beat-repeat effect is expected to work. It needs output-latency compensation (`review-opus.md` #5). [decision]

### 2.3 Sliding to another size

- "Changing the location of your finger changes the size of the loop." That is all the sources say. They say nothing about whether the start or the phase is kept. [doc: S1, S2, S3, S5]
- Spec rule 8 keeps the start and computes the phase from the playhead. This is deterministic. Because the sizes are powers of two, the shorter loops nest inside the longer one, so going 1/4 → 1/8 → 1/16 → 1/32 is heard as a roll tightening toward the start of the slice. [decision]
- One alternative was considered: when the size changes, re-anchor the start to the step being played at that moment, so that sliding to 1/32 freezes the step currently heard rather than the original start.
  - Pro: it feels more "where I am now".
  - Con: the window wanders across repeated slides, and the loop position can then depend on the order of slides.
  - Not recommended for v1. Revisit if it feels wrong on the instrument. [decision]

### 2.4 Release

- The song-mode text: "While using the Looper/Roller feature the Song continues to play in the background, so when you release the Touch strip it will jump to the place it would have been in the music if the Looper/Roller hadn't been activated." [doc: S1 §5.7.1.1]
- For the sibling sequencer (pattern playback, no song mode), a review says: "with the latest Firmware installed it even locks the sequence to a master bar-based grid … so that when released, it picks up where it would have been playing had the Roller/Looper not been engaged." [review: S6]
- A later sibling's review says: "On release, playback resumes at the point it would have reached if uninterrupted." [review: S7]
- The sibling's v2.0 notes include "No more notes jumped when using the Looper with MIDI, USB or Clk Sync" and "Exiting Looper now plays the right note information". [doc: S4] This suggests the slip was refined in firmware, which matches the review in S6.
- For the reference in **pattern mode**, no source states the jump-back explicitly. The manual puts the paragraph under "song-level features", a heading that only separates settings that survive pattern changes from those that don't. The same looper code drives both modes, and every sibling device behaves this way in pattern playback. [inferred, high confidence]

### 2.5 Pattern changes, mutes, parameters, swing, accents

- None of this is documented for the looper.
- A later sibling states: "The Looper loops all tracks simultaneously. This includes CC# values that you may have stored in the Control track." [doc: S5 §4.2.12] Per-step data is therefore replayed with the looped steps. Accents (velocity) are per-step data on the reference and are repeated as stored. [inferred]
- Mutes are global, live performance state on the reference ("The status of the Mute/Solo buttons is Global, so they affect all patterns and songs") and act at playback. They should therefore apply inside a loop as they do outside one. [doc: S1 §4.1.4; inferred for the loop]
- Pattern changes: the reference queues a selected pattern either immediately or at the end of the current pattern ("At End"). In song mode the song keeps running in the background while the loop is held [doc: S1 §2.2.2.2, §5.7.1.1], which implies that pattern changes follow the background position. [inferred]
  - Our app has no pattern slots. The pattern is generated live from the setup, and story 32 already requires pad moves to stay live inside a loop. Rules 11–14 follow from that. [decision]
- Swing: the reference has swing from 50 to 75%, globally and per track [doc: S1 §2.3.1]. How swing combines with a loop is not documented.
  - Rule 13 keys swing on the playhead slot. The other option keys it on the played step. With a 1/16 loop started on an on-beat, that option produces a straight roll inside swung music, and with a loop started on an off-beat it produces a late, straight roll.
  - Playhead keying keeps every hit on the shared grid. [decision]
- Accent loudness on 1/32 retriggers: `review-opus.md` #13 suggests muting accents after the first retrigger. That would differ from the reference, which replays step data verbatim. Rule 11 stays faithful to the reference. If it proves too loud by ear, the owner can choose to deviate. [decision]
- Chaos re-roll (rule 12) has no counterpart in the reference. It follows the playhead so that a held loop does not re-roll on every wrap through step 0 (`review-fable.md` #8, `review-opus.md` #5). [decision]

### 2.6 All tracks or per track

- The reference loops "sections of the current pattern", with no per-track option anywhere in the manual or its settings. [doc: S1 §2.3.3.1, §9.10.3]
- The siblings: "It affects all three sequencers at the same time." [doc: S2 §6.6] "The Looper loops all tracks simultaneously." [doc: S5 §4.2.12]
- The reference has a per-track length mode (Polyrhythm), and its interaction with the looper is not documented. That doesn't matter for us. [doc: S1 §2.2.2.4]

### 2.7 Stopped, and recording

- The looper is described only while playing: "Press the Touch strip while [the unit] is playing a song or pattern to activate the Looper function", and "When a pattern is playing back (i.e., not being recorded) this strip can be used to loop…". [doc: S1 §2.3.3.1]
  - Behaviour while stopped is not documented. With no running playhead there is nothing to loop, so rule 17 makes it a no-op. [inferred, decision]
- While recording: "The Looper is not available while recording." The strip then acts as a Roller, which records note repeats into the pattern. [doc: S1 §4.1.5, §2.3.3.2]
- In the sibling, the Roller (not the looper) keeps running while stopped, on the internal clock. [doc: S2 §6.6.1.2]
- Our app has no recording, so the recording case doesn't apply.

### 2.8 Settings and MIDI

- Mode: Roller or Looper, an exclusive choice while playing. It is toggled with Shift + Step 9 (lit = Roller) or in the companion editor app. [doc: S1 §1.2.11, §2.2.2.1, §9.10.3.1]
- MIDI: the strip can send and receive one CC (the number is configurable, 9 on the siblings), on the global MIDI channel. The CC values are fixed (see 2.1). The strip sends nothing while it is being used to set Step Repeat. [doc: S1 §2.3.3.3, §9.10.3.2; S5 §9.1.9]
- A later sibling sends 0 on release and can disable the strip with Shift + touch. [doc: S5 §1.5, §9.1.9.3]
- None of these settings changes the timing behaviour. Moving the start with a step button while holding is the one extra gesture. [doc: S1 §2.3.3.1, S4]

### 2.9 What I could not find

- I found no forum, video or review that pins down how the start is quantised, or what happens when you slide between sizes. A forum thread on the sibling's 2.0 firmware and the manufacturer's support article both blocked fetching (403), and general forum and Reddit searches returned nothing specific.
- Rules 2, 8, 13 and 17 are therefore decisions. They are not copied from the reference. If a hardware unit is available, a ten-minute test settles them: play a 1/32 hi-hat line, touch 1/8 at a known step, then slide.

## 3. Sources

Products are not named here, at the owner's request. Local extracts sit in the session scratchpad.

- **S1**: the manufacturer's manual for the reference hardware looper, v1.0 (local extract `manuals/dbi.txt`): sections 1.2.11, 2.2.2, 2.3.3, 4.1.4, 4.1.5, 4.2.6, 5.7.1.1 and 9.10.3.
- **S2**: the manufacturer's manual for a sibling step sequencer with the same strip, v1.x (local extract `manuals/bsp.txt`): sections 2.2.3, 6.6, 6.6.1.2 and 6.6.2.
- **S3**: the manufacturer's manual for the reference's predecessor drum machine, 1.0.0: sections 2.3.4.2 "Looper", 3.2.4.1–3.2.4.2 and 4.6.1.2. The URL is omitted because it contains a product name.
- **S4**: the sibling sequencer's firmware 2.0 release notes, as reported by music-tech news sites. The URLs are omitted because they contain product names. Quotes: "Change the looper start point in the sequence by pressing steps"; "No more notes jumped when using the Looper with MIDI, USB or Clk Sync"; "Exiting Looper now plays the right note information".
- **S5**: the manufacturer's manual for a later sibling keyboard sequencer: section 1.5 (v2.0 changes), section 4.2.12 "The Looper" including the "Can you change the rate of repeat" FAQ, and section 9.1.9. https://www.adorama.com/col/productManuals/AR430211.pdf
- **S6**: a print review of the sibling sequencer in Computer Music, Autumn 2015, p. 95, read from a retailer's PDF reprint. The URL is omitted because it contains a product name.
- **S7**: Sound On Sound's review of the later sibling, cited from a search summary because the page itself was not fetched: https://www.soundonsound.com/node/4922239
- Also checked, without anything new on timing: a German magazine test of the reference, a community cheat sheet, and the manufacturer's support "tips and tricks" article. The support article returned 403. Its search snippet says only "it will repeat the steps depending of the division pressed". The URLs are omitted because they contain product names.
