// The drums' full names, and where the UI writes them out instead of `bd`
// `sd` `hh`. The tablet and laptop layouts write them out on the strips, the
// drum tabs and the sound headings. The step display's mute labels write them
// out only on the laptop: on the tablet the step display shares a half-width
// column with its 32 steps. The phone layouts keep `bd` `sd` `hh` everywhere
// but in a tall window's sound mode, whose stacked headings have the whole
// row for the full names.
//
// A control's accessible name holds the text it shows (`mute bd`, `mute bass
// drum`), so voice control finds it by what it says (WCAG 2.5.3).

import type { Drum } from '../engine/setup';

export const DRUM_NAMES: Readonly<Record<Drum, string>> = { bd: 'bass drum', sd: 'snare drum', hh: 'hi-hat' };
