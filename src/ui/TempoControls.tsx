// Tempo: bpm and swing, each with − and +, which repeat while held, and the
// boxed `tap tempo` button, which sets the tempo from the beat the player
// taps. The store rounds and clamps both into their ranges (60–200 bpm,
// 50–75 %). Phones show them as the `tempo` tab's three rows, after `mix` and
// `fx`; the tablet and laptop layouts set them in one row under the strips.

import type { Accessor } from 'solid-js';
import type { Setup } from '../engine/setup';
import type { SetupSnapshot } from '../engine/setup-store';
import { PressButton } from './PressButton';
import { createTapTempo } from './tap-tempo';
import './tempo-controls.css';

export interface TempoControlsProps {
  setup: Accessor<SetupSnapshot>;
  /** Change the setup; the store rounds and clamps every field. */
  onChange(edit: (setup: Setup) => void): void;
}

export function TempoControls(props: TempoControlsProps) {
  const tapTempo = createTapTempo();

  const changeTempo = (by: number) => props.onChange((setup) => void (setup.bpm += by));
  const changeSwing = (by: number) => props.onChange((setup) => void (setup.swing += by));

  // Each tap counts from the moment of the touch.
  function tap(time: number) {
    const bpm = tapTempo.tap(time);
    if (bpm !== undefined) props.onChange((setup) => void (setup.bpm = bpm));
  }

  return (
    <div class="tempo-controls" role="group" aria-label="tempo">
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
    </div>
  );
}
