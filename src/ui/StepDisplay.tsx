// The step display: one bar as text, `x` for a hit and `·` for a rest, one
// line per drum, the played step highlighted. While playing it follows the
// step heard now, written straight to the DOM every animation frame, outside
// Solid's update cycle. The drum labels are the mute toggles.

import { createEffect, For, onCleanup, type Accessor } from 'solid-js';
import { hitsAt, PATTERN_STEPS, type PatternInput } from '../engine/pattern';
import { DRUMS, type Drum } from '../engine/setup';
import type { Mutes, SetupSnapshot } from '../engine/setup-store';
import type { TimedStep } from '../engine/transport';
import './step-display.css';

export interface StepDisplayProps {
  setup: Accessor<SetupSnapshot>;
  mutes: Accessor<Mutes>;
  playing: Accessor<boolean>;
  /** The step heard now while playing, or undefined before the first; read every frame. */
  heard: () => TimedStep | undefined;
  onToggleMute(drum: Drum): void;
}

const NO_CHAOS: PatternInput['perturbation'] = { bd: 0, sd: 0, hh: 0 };

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

  function highlight(step: number) {
    if (step === highlighted) return;
    for (const drum of DRUMS) {
      cells[drum][highlighted]?.classList.remove('now');
      cells[drum][step]?.classList.add('now');
    }
    highlighted = step;
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
        highlight(step.played);
      }
      frame = requestAnimationFrame(follow);
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });

  return (
    <div class="step-display" role="group" aria-label="step display">
      <For each={DRUMS}>
        {(drum) => (
          <div class="step-row" data-drum={drum} classList={{ muted: props.mutes()[drum] }}>
            <button
              type="button"
              class="step-label"
              aria-label={`mute ${drum}`}
              aria-pressed={props.mutes()[drum] ? 'true' : 'false'}
              onClick={() => props.onToggleMute(drum)}
            >
              {drum}
            </button>
            <span class="step-line" aria-hidden="true" ref={(line) => fill(drum, line)} />
          </div>
        )}
      </For>
    </div>
  );
}
