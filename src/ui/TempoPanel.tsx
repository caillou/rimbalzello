// The tempo panel, `## tempo`: it takes the strips' place while open. bpm and
// swing each step with − and +, which repeat while held, and `tap tempo`
// sets the tempo from the beat the player taps. The store rounds and clamps
// both into their ranges (60–200 bpm, 50–75 %).

import { createUniqueId, type Accessor } from 'solid-js';
import type { Setup } from '../engine/setup';
import type { SetupSnapshot } from '../engine/setup-store';
import { PressButton } from './PressButton';
import { createTapTempo } from './tap-tempo';
import './tempo-panel.css';

export interface TempoPanelProps {
  setup: Accessor<SetupSnapshot>;
  /** Change the setup; the store rounds and clamps every field. */
  onChange(edit: (setup: Setup) => void): void;
}

export function TempoPanel(props: TempoPanelProps) {
  const headingId = createUniqueId();
  const tapTempo = createTapTempo();

  const changeTempo = (by: number) => props.onChange((setup) => void (setup.bpm += by));
  const changeSwing = (by: number) => props.onChange((setup) => void (setup.swing += by));

  function tap(time: number) {
    const bpm = tapTempo.tap(time);
    if (bpm !== undefined) props.onChange((setup) => void (setup.bpm = bpm));
  }

  return (
    <section class="tempo-panel" aria-labelledby={headingId}>
      <h2 id={headingId} class="tempo-heading">
        <span class="marker" aria-hidden="true">
          ##
        </span>{' '}
        tempo
      </h2>
      <div class="tempo-row">
        <span class="tempo-label">bpm</span>
        <PressButton class="tempo-button" label="bpm down" repeat onPress={() => changeTempo(-1)}>
          −
        </PressButton>
        <span class="tempo-value">{props.setup().bpm}</span>
        <PressButton class="tempo-button" label="bpm up" repeat onPress={() => changeTempo(1)}>
          +
        </PressButton>
      </div>
      <div class="tempo-row">
        <span class="tempo-label">swing</span>
        <PressButton class="tempo-button" label="swing down" repeat onPress={() => changeSwing(-1)}>
          −
        </PressButton>
        <span class="tempo-value">{props.setup().swing}%</span>
        <PressButton class="tempo-button" label="swing up" repeat onPress={() => changeSwing(1)}>
          +
        </PressButton>
      </div>
      <PressButton class="tap-tempo" onPress={tap}>
        tap tempo
      </PressButton>
    </section>
  );
}
