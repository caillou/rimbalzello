// Tempo: the bpm and swing strips, which show their own values (60–200 bpm,
// 50–75 %), and the boxed `tap tempo` button, which sets the tempo from the
// beat the player taps. The store rounds and clamps both into their ranges.
// Phones show them as the `tempo` tab's three rows, after `mix` and `fx`;
// the tablet and laptop layouts set them in one row under the strips.

import type { Accessor } from 'solid-js';
import { BPM_RANGE, SWING_RANGE, type Setup } from '../engine/setup';
import type { SetupSnapshot } from '../engine/setup-store';
import { PressButton } from './PressButton';
import { Strip } from './Strip';
import { createTapTempo } from './tap-tempo';
import './tempo-controls.css';

export interface TempoControlsProps {
  setup: Accessor<SetupSnapshot>;
  /** Change the setup; the store rounds and clamps every field. */
  onChange(edit: (setup: Setup) => void): void;
}

export function TempoControls(props: TempoControlsProps) {
  const tapTempo = createTapTempo();

  // Each tap counts from the moment of the touch.
  function tap(time: number) {
    const bpm = tapTempo.tap(time);
    if (bpm !== undefined) props.onChange((setup) => void (setup.bpm = bpm));
  }

  return (
    <div class="tempo-controls" role="group" aria-label="tempo">
      <Strip
        label="bpm"
        colour="var(--bpm)"
        range={BPM_RANGE}
        value={props.setup().bpm}
        onChange={(bpm) => props.onChange((setup) => void (setup.bpm = bpm))}
      />
      <Strip
        label="swing"
        colour="var(--swing)"
        range={SWING_RANGE}
        unit="%"
        value={props.setup().swing}
        onChange={(swing) => props.onChange((setup) => void (setup.swing = swing))}
      />
      <PressButton class="tap-tempo" onPress={tap}>
        tap tempo
      </PressButton>
    </div>
  );
}
