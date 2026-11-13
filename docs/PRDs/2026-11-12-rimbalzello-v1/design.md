# Rimbalzello v1: design

The visual and interaction spec for v1. Where text and a screenshot disagree, this text wins. Where this file and `prd.md` disagree, `prd.md` wins for behaviour and this file for looks. Vocabulary follows the glossary in the repo's `CONTEXT.md`. The screenshots are rendered from the throwaway mockup in `designs/src/` (not production code). The exploration canvas, including rejected directions, is https://claude.ai/artifact/JJBihVwA9ZeCqJdVk8qFvs.

## Screens

The review round in `reviews/` changed the step resolution, the layouts, mutes, the pad gestures, keys and tempo. Screenshots that no longer match are marked outdated and stay as references for the look until a new design pass replaces them. Use them for colours, type and spacing, not for behaviour or layout tiers.

| File | What it shows | Status |
| --- | --- | --- |
| `designs/06-laptop-shortcuts-shown.png` | Laptop (1280×800) with keycap hints shown | outdated, pending design pass: old tempo and help keys, no tempo row, map nodes drawn inset; steps now in four beats |
| `designs/07-laptop-shortcuts-hidden.png` | Laptop, default state, hints hidden | outdated, pending design pass: as 06, steps too |
| `designs/08-about.png` | About view | current |
| `designs/09-404.png` | 404 page | current |
| `designs/v2-01-phone.png` | Phone in Safari (393×659): mix / fx tabs, mutes on step labels, X/Y readout | current, but without the `tempo` tab after `fx`; steps now in four beats |
| `designs/v2-02-phone-compact.png` | Compact (SE in Safari, 375×553): slim header, step display inside the pad | current, but steps now in four beats |
| `designs/v2-03-phone-sound.png` | Sound mode on a phone: drum tabs, sliders in two columns | current, but steps now in four beats |
| `designs/v2-04-phone-tempo.png` | The former tempo panel: bpm, swing 56 %, tap tempo | outdated: the `tempo` tab holds the same three rows with bpm and swing as strips, not − and +, and without the `## tempo` heading and `← play` |
| `designs/v2-05-phone-tap-to-play.png` | First launch: `▶ tap to play` over the dimmed pad | current, but steps now in four beats |
| `designs/v2-06-phone-help.png` | Help open: two-finger undo, tap labels to mute | current, but steps now in four beats |
| `designs/v2-07-tablet.png` | Tablet portrait (820×1106): pad on top, two columns below | current, but with `bd` `sd` `hh` where the strips and drum tabs now write the names out; steps now in four beats |
| pending | Rotate hint | screenshots pending |

## Visual language

Borrowed from caillou.ch, so the app reads as part of the site.

- **Font**: IBM Plex Mono only, self-hosted. Weights follow screen resolution like the blog: normal 400 / bold 600 at 1×, 300 / 500 at 2×, 200 / 400 at 3×.
- **Colours** (unchanged for v1):
  - background `#202322`, pad `#1a1c1b`, hairlines and empty tracks `#3a3d3c`
  - text `#ffffff`, secondary `#ababab`, tertiary and markers `#757575`
  - bd `#ffd866` (yellow), sd `#ff61ef` (pink), hh `#bef289` (green), drive `#fc618d` (red), chaos, drift, bpm and swing white
- **Text**: lowercase labels. `#` before the app title and `##` before section headings, in grey. Italic for text buttons and navigation.
- **Drum names**: `bd` `sd` `hh` on phones and in the tablet's step display; `bass drum`, `snare drum`, `hi-hat` where the tablet and laptop layouts have room: the strips, the drum tabs, the laptop's sound headings and its step display. A control's accessible name holds the name it shows (`mute bd`, `mute bass drum`), so voice control finds it by what it says.
- **Current step**: yellow background, black text, like the blog's text selection.
- **Sliders**: 2 px track; filled part and square thumb in the control's colour; value right-aligned in grey, shown 0–100, except bpm and swing, which show their own values (`128`, `56%`).
- **Loop strip**: four boxed zones (`1/4 1/8 1/16 1/32`) with hairline borders; the held zone is white with black text.
- **Buttons**: text buttons, italic. `set anchor` underlined. `↺ return on bar` is the only solid block (yellow, black text) and pulses while a return is pending.
- **Footer**: `// help   // about   // source` in small grey uppercase with wide letter spacing (the blog's footer style); the active item turns white.
- **Keycap hints**: small keys with a grey 1 px outline and grey text next to their control; on light backgrounds (held loop zone, return button) the keycap inverts to black.
- **Touch targets**: at least 44 px.
- **Focus**: every control is a real button or labelled input with a visible keyboard focus ring.
- No rounded cards, no gradients, no emoji, no shadows.

## Layouts

Every layout is sized against the real browser viewport (`100dvh`), not the device screen. Safari on a current iPhone leaves roughly 660–750 px of height in portrait; an iPhone SE leaves about 550 px. The design pass measures these on Pierre's devices and sets the breakpoints, which then live in the tunables module. Until then, the numbers below are starting points.

| Layout | When | Shape |
| --- | --- | --- |
| phone | narrow | one column, strips and tempo in `mix` / `fx` / `tempo` tabs, as below |
| compact | the smallest case (SE in Safari) | slimmer header, step display moves into the pad as an overlay (`v2-02-phone-compact.png`) |
| tablet | about 700 px wide or more | portrait: pad on top, two columns below; landscape: like the laptop (`v2-07-tablet.png`) |
| laptop | wide enough for the three sound sections side by side | two columns, no tabs |
| rotate hint | wider than tall and too short for the tablet layout | a hint to turn the phone upright; screenshots pending |

The play screen never scrolls. Every touch lands on a control. Loop strip and bottom bar are always visible.

## Play screen, phone portrait

Top to bottom, filling the viewport exactly:

1. **Header**: `# rimbalzello` left; `− 128 bpm +` and `stop`/`play` (italic, underlined) right. Tapping the bpm readout opens the `tempo` tab. The title is not a link.
2. **Pad**: takes all remaining height. Dark field, thin crosshair through the position, a faint ring around it, the position as a yellow square, and the X/Y readout (0–100). The pad keeps clear of the left 16 px of the screen.
3. **Step display**: three lines, `bd`, `sd`, `hh`, 32 characters each, one bar, in four beats of 8 with a small gap (a quarter of the text size) between beats: `x` in the drum's colour for a hit, bold for an accent, `·` in grey for a rest. The bold is the screen's bold weight (see Font) and stays on a muted line and under the highlight. Current step highlighted. The drum labels are the mute toggles (see Mutes).
4. **Loop strip**.
5. **Tabs**: `mix` (the bd, sd and hh density strips), `fx` (chaos, drift and drive) and `tempo` (see Tempo). Each tab holds three 44 px rows, so the pad keeps its size when the tab changes.
6. **Bottom bar**: `→ sound`, `set anchor`, `↺ return on bar`.
7. **Footer**: `// help   // about   // source`, centred.

### First launch

On load the app is stopped. A big `▶ tap to play` sits over the pad; one tap starts audio and the groove, and the overlay goes away. If the browser later suspends audio and refuses to resume it, a visible `tap to resume` takes its place. See the `v2-` screenshots.

### Sound mode (phone)

Tapping `→ sound` swaps the `mix` / `fx` / `tempo` tabs for drum tabs: `bd` `sd` `hh`, the active tab in its drum's colour with an underline and the drum's full name (`bass drum`) in grey italics on the right. The tablet and a short laptop window write the names out on the tabs instead (`bass drum` `snare drum` `hi-hat`), with nothing on the right. Below: that drum's sliders. The pad, step display and loop strip stay. The bottom bar's first item becomes `← play`. On phones the drum's sliders sit in two columns so they fit under the pad (`v2-03-phone-sound.png`).

The hh tab holds two sliders, `accent` and `level`, in one row. `accent` sets how far an accented hh hit opens the hat: at 0 an accent is only louder, at 100 the hat is fully open; plain hh hits stay closed. Any hh hit cuts off an hh still ringing (the choke).

### Tempo

The `tempo` tab, after `mix` and `fx`, holds three rows: the bpm strip, the swing strip and a boxed `tap tempo` button. The two strips work like every other strip but show their own values: tempo runs 60–200 bpm, default 128; swing runs 50–75 %, default 56 % (shown `56%`). The header's − and + repeat while held. Tapping the bpm readout opens the tab, from `mix`, `fx` or sound mode. `v2-04-phone-tempo.png` shows the rows under the former panel's heading, with − and + where the strips now are.

The tablet and laptop show tempo as a third group beside mix and fx, always on screen: the bpm and swing strips and `tap tempo` in one 44 px row under the strips, the two strips sharing what `tap tempo` leaves. The row has half the usual gaps and labels only as wide as their text, so the tracks keep about 75–90 px on the narrowest laptop column. There the bpm readout has nothing to open and is only a readout, without the dashed underline.

### Compact phones

On every phone the pad keeps at least 200 px; with 44 px rows, 240 does not fit the SE. Loop strip, bottom bar and footer stay visible. The compact layout covers the smallest case (iPhone SE in Safari) with tighter rows and a smaller step display. Its exact shape comes from the design pass.

### Landscape phones

Not a v1 layout. A wide viewport that is tall enough gets the tablet layout; otherwise the app shows a rotate hint.

## Tablets

About 700 px wide or more. Portrait: pad on top (takes the remaining height), below it two columns: step display and all six strips on the left; loop strip and sound drum tabs on the right (see `v2-07-tablet.png`); then the tempo row across both columns. Landscape: pad on the left, everything else on the right, like the laptop. Drum tabs are the only tabs on a tablet.

The strips and the drum tabs write the drum names out; the six strip labels share the width of the longest, `snare drum`, so the tracks line up. The step display keeps `bd` `sd` `hh`: it shares a half-width column with its 32 steps and their beat gaps (299 px at 15 px), which leaves about 19–86 px for the label beside the steps. The label is a button reaching 16 px further, into the side padding, so where less than 28 px is left the text drops to 14 px and the label keeps 44 px (see Keyboard for the keycaps). `snare drum` with its gap needs 102 px, which only the 12.9″ iPad in portrait has. So on an iPad at 820 or 834 px the step display's `bd` sits right above the `bass drum` strip, in the same order and colours. Turning the tablet to landscape gives the laptop layout, whose step display writes the names out.

## Laptops

- Pad on the left (about 560 px wide on a 1280 px screen), full height, with the 5×5 map nodes drawn as faint `+` marks and the position readout (`x 34 · y 58`, 0–100). The nodes sit at 0, 64, 128, 192 and 256 on the 0–255 scale, so the outer nodes lie on the pad edges.
- Right column: step display, its labels the full drum names; strips in two columns (bass drum / chaos, snare drum / drift, hi-hat / drive), every label as wide as `snare drum`; the tempo row (bpm, swing, `tap tempo`); loop strip; a hairline; then `## bass drum`, `## snare drum`, `## hi-hat` side by side with all sound sliders. No tabs. On the narrowest right column (520 px) the strip tracks keep about 78 px.
- Bottom row: footer bottom left (`// help ?  // about  // source`), `set anchor` and `↺ return on bar` bottom right.
- On a window larger than 1280×800 the whole layout grows with it, by the smaller of width ÷ 1280 and height ÷ 800, up to twice the size: text, rows, gaps, the right column and the pad's marks alike. Hairlines stay 1 px. A window short enough to fold the sound never grows. While the layout's zoom stays between 1 and 2, it absorbs browser zoom: each Cmd + or Cmd − step changes the window's CSS px by one factor and the layout's zoom by its inverse, so nothing on screen changes size. Outside that range Cmd + and Cmd − work as usual, Cmd + once the layout's zoom is down to 1 and Cmd − once it is up to 2.

### Keyboard

Designed for the US layout. Keys bind by physical position (`event.code`), so they sit in the same place on other layouts. Key repeat is ignored except for tempo.

| Key | Action |
| --- | --- |
| space | play / stop |
| `,` `.` | tempo down / up (repeats while held) |
| `1` `2` `3` `4` (hold) | loop 1/4, 1/8, 1/16, 1/32 |
| `a` | set anchor |
| `r` | return on next bar |
| `q` `w` `e` | mute bd, sd, hh |
| `z` | pad undo / redo |
| arrows | nudge the pad |
| shift + arrows | fine nudge |
| `?` or `h` | show / hide keycap hints |

Keycap hints are hidden by default; `?`, `h` or `// help` toggles them, and the choice is remembered on the device. When shown, the pad's corner reads `nudge ←↑↓→  shift fine`. They show on the tablet and laptop layouts of a screen without touch; elsewhere `// help` opens the help box. In a tablet layout under about 750 px wide, the step display's text drops from 15 to 14 px while they show, and under about 710 px to 13 px, so the `q` `w` `e` keycaps fit beside their drum labels. `?` also works by the character it types, so it works where a layout puts it elsewhere (on a Swiss keyboard, shift and the key right of 0).

Keys play wherever focus is, except in a text input and for the keys a focused control uses itself: space presses a focused button (a focused loop zone holds), and the arrows move a focused strip. A click or drag leaves no focus on a button or strip, so a focused control is one reached with Tab, and its focus ring shows where space and the arrows go. Keys play nothing while about is open or the rotate hint shows. Letting go of Cmd lets go of every held key, since macOS drops the keyup of a key released while Cmd is down.

## Pad interaction

Taps act at once: the glide starts on touch-down, with no wait for a double-tap. Undo moved to a two-finger tap.

| Gesture | Result |
| --- | --- |
| tap | the position glides to the tap point (absolute), starting at once, over one or two steps |
| touch and drag | glide to the finger, then follow it |
| two-finger tap | undo the last pad move; again to redo (flip/flop) |
| double-tap and slide | fine adjust: relative, about ¼ speed, from the current position |

Gesture state machine. Thresholds (movement, double-tap window, two-finger window) are tunables.

| State | Event | Result | Next state |
| --- | --- | --- | --- |
| idle | one finger down | glide toward the touch point | touching |
| idle | one finger down within the double-tap window of the last tap, near it | nothing moves yet | second touch |
| touching | moves past the threshold | follow the finger (drag) | dragging |
| touching | second finger down within the two-finger window | revert the first finger's move (not recorded as a move) | two fingers |
| touching | up | the tap is one pad move | idle |
| dragging | up | the whole drag is one pad move | idle |
| second touch | moves past the threshold | fine adjust, relative from the current position | fine |
| second touch | up without moving | glide toward the touch point; one pad move | idle |
| fine | up | the fine adjust is one pad move | idle |
| two fingers | both up with little movement | undo (flip/flop with the undo slot) | idle |
| two fingers | moves past the threshold | cancel; nothing happens | idle after all fingers lift |

The first finger of a two-finger tap may be heard for a step before the revert. That is the price of instant taps. On the laptop, `z` undoes, and a run of arrow nudges counts as one pad move.

On first launch a one-line hint inside the pad shows `tap · drag · two-finger tap undo · double-tap+slide fine`.

## Mutes

The step display's drum labels (`bd` `sd` `hh`, or the full names on the laptop) are the only mute toggles, on every layout and in every mode. Each label has a hit area of at least 44 px; a full name's reaches across the whole name. A muted drum's line turns grey and its label is struck through, a full name across both words. Strip labels do not mute. Keys `q` `w` `e` also mute.

## Looper display

The step display highlights the played step. While a loop is held, the playhead step is also shown, dimmed. The held zone is white with black text. The loop strip tracks the finger across zones while held. Loop rules are in `prd.md`.

## Input rules

- `touch-action: none` on the pad, strips and loop strip.
- No text selection, no long-press callouts or context menus.
- Sliders move relative to a touch or pen; a tap on the track does not jump the value. With a mouse, a click on the track sets the value there and a drag from there follows the pointer; a press on the thumb grabs it without moving the value.

## Help

- **Touch screens**: `// help` opens a hint box over the lower part of the pad with the gestures (including the two-finger undo) plus a line each on anchor, loop, mutes (tap the step display labels: `tap bd sd hh: mute`, or `tap a drum name: mute` where they are the full names) and sound. `// help` turns white while open; tapping it again closes the box. The pad stays playable.
- **Laptops**: `// help`, `?` or `h` toggles the keycap hints.

## About

- Entry: `// about` in the footer only.
- Content: `← back to play · still playing` and a `×` close button at the top; h1 `# rimbalzello` (italic, yellow, grey `#`); one-line description; `## made from` (Grids and Peaks by Émilie Gillet, linked); `## made by` (Pierre Spring, linked to caillou.ch); `## licence` (GPL-3.0-or-later, like Grids, with links to the source at the deployed commit and to the third-party notices); footer `// source  // caillou.ch`; small grey note: not affiliated with Mutable Instruments, "Mutable Instruments" is a registered trademark.
- Styled like a blog post: body 18 px with line-height 1.8, h2s italic with grey `##`, no bold headings, links yellow with a dashed underline inside grey `[ ]` brackets, pink on hover.
- Behaviour: about is an app state, not a separate app. Opening it from the footer keeps the music playing and changes the URL to `/about/` (history push). `← back to play`, `×`, `esc` and the browser's back button all return to the play screen at `/`. The setup hash stays on both URLs.
- `/about/` also exists as a real, prerendered file, so a direct visit or reload works on static hosting and shows the credits before any JavaScript runs.
- The about view may scroll; the play screen may not.

## 404

A plain static page served by GitHub Pages for unknown URLs: h1 `# 404` (italic, yellow), `this stone sank.`, and a blog-style link `[back to rimbalzello]`. No app code.

## Later (not in v1)

Ripples on hits, a heat map of the map, per-drum drive, per-drum swing, accent suppression on loop retriggers, memory slots, landscape phone layout, web manifest and home-screen install.
