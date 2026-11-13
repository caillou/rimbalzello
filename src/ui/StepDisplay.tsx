// The step display: one bar as text, `x` for a hit and `·` for a rest, one
// line per drum, the played step highlighted. While a loop is held, the
// playhead step is also shown, dimmed. While playing it follows the step
// heard now, written straight to the DOM every animation frame, outside
// Solid's update cycle. The drum labels are the mute toggles, `bd` `sd` `hh`
// or the full names (drum-names.ts).

import { createEffect, For, onCleanup, type Accessor } from 'solid-js';
import { hitsAt, PATTERN_STEPS, type PatternInput } from '../engine/pattern';
import { DRUMS, type Drum } from '../engine/setup';
import type { Mutes, SetupSnapshot } from '../engine/setup-store';
import type { TimedStep } from '../engine/transport';
import { DRUM_NAMES } from './drum-names';
import { Keycap } from './Keycap';
import './step-display.css';

export interface StepDisplayProps {
  setup: Accessor<SetupSnapshot>;
  mutes: Accessor<Mutes>;
  playing: Accessor<boolean>;
  /** The step heard now while playing, or undefined before the first; read every frame. */
  heard: () => TimedStep | undefined;
  /** Whether the labels write the drums' names out (drum-names.ts). */
  fullNames: Accessor<boolean>;
  onToggleMute(drum: Drum): void;
}

const NO_CHAOS: PatternInput['perturbation'] = { bd: 0, sd: 0, hh: 0 };

/** The keys that mute each drum, for the keycap hints. */
const MUTE_KEYS: Readonly<Record<Drum, string>> = { bd: 'q', sd: 'w', hh: 'e' };

function samePattern(a: PatternInput, b: PatternInput): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    DRUMS.every((drum) => a.density[drum] === b.density[drum] && a.perturbation[drum] === b.perturbation[drum])
  );
}

export function StepDisplay(props: StepDisplayProps) {
  const cells: Record<Drum, HTMLSpanElement[]> = { bd: [], sd: [], hh: [] };
  let shown: PatternInput | undefined;
  let highlighted = -1;
  let dimmed = -1;
  // While stopped the display shows the setup's pattern with the chaos last
  // heard, none before the first play.
  let perturbation = NO_CHAOS;

  function fill(drum: Drum, line: HTMLSpanElement) {
    cells[drum] = Array.from({ length: PATTERN_STEPS }, () => line.appendChild(document.createElement('span')));
  }

  function render(pattern: PatternInput) {
    if (shown && samePattern(shown, pattern)) return;
    shown = pattern;
    for (let step = 0; step < PATTERN_STEPS; step++) {
      const hits = hitsAt(pattern, step);
      for (const drum of DRUMS) {
        const cell = cells[drum][step];
        const hit = hits[drum].hit;
        if (!cell || (cell.textContent && cell.classList.contains('hit') === hit)) continue;
        cell.textContent = hit ? 'x' : '·';
        cell.classList.toggle('hit', hit);
      }
    }
  }

  /** Moves the class `name` from step `from` to step `to` on every line; -1 is none. */
  function mark(name: string, from: number, to: number) {
    for (const drum of DRUMS) {
      cells[drum][from]?.classList.remove(name);
      cells[drum][to]?.classList.add(name);
    }
  }

  /** Highlights the played step, and dims the playhead step where a held loop plays another. */
  function highlight(played: number, playhead = played) {
    const toDim = playhead === played ? -1 : playhead;
    if (played !== highlighted) mark('now', highlighted, played);
    if (toDim !== dimmed) mark('playhead', dimmed, toDim);
    highlighted = played;
    dimmed = toDim;
  }

  // Stopped: the setup's pattern, nothing highlighted.
  createEffect(() => {
    if (props.playing()) return;
    const { x, y, density } = props.setup();
    render({ x, y, density, perturbation });
    highlight(-1);
  });

  // Playing: the step heard now.
  createEffect(() => {
    if (!props.playing()) return;
    let frame = requestAnimationFrame(function follow() {
      const step = props.heard();
      if (step) {
        perturbation = step.pattern.perturbation;
        render(step.pattern);
        highlight(step.played, step.playhead);
      }
      frame = requestAnimationFrame(follow);
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });

  // A change of layout changes only the labels' text. The rows stay: their
  // lines are filled once and redrawn only when the pattern changes.
  return (
    <div
      class="step-display"
      role="group"
      aria-label="step display"
      data-names={props.fullNames() ? 'full' : undefined}
    >
      <For each={DRUMS}>
        {(drum) => {
          // The mute toggle's name holds the label it shows.
          const label = () => (props.fullNames() ? DRUM_NAMES[drum] : drum);
          return (
            <div class="step-row" data-drum={drum} classList={{ muted: props.mutes()[drum] }}>
              <button
                type="button"
                class="step-label"
                aria-label={`mute ${label()}`}
                aria-pressed={props.mutes()[drum] ? 'true' : 'false'}
                onClick={() => props.onToggleMute(drum)}
              >
                {label()}
                <Keycap>{MUTE_KEYS[drum]}</Keycap>
              </button>
              <span class="step-line" aria-hidden="true" ref={(line) => fill(drum, line)} />
            </div>
          );
        }}
      </For>
    </div>
  );
}
