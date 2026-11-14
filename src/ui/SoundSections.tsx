// The laptop's sound: `## bass drum`, `## snare drum` and `## hi-hat` side by
// side under a hairline, each drum's sliders in one column, with no tabs. A
// tall phone window's sound mode stacks them, two columns each (stacked.css).

import { createUniqueId, For } from 'solid-js';
import { DRUMS } from '../engine/setup';
import { DRUM_NAMES } from './drum-names';
import { SoundSection, type DrumsSoundProps } from './SoundSection';
import './sound.css';

export function SoundSections(props: DrumsSoundProps) {
  const id = createUniqueId();

  return (
    <div class="sound-sections">
      <For each={DRUMS}>
        {(drum) => (
          <section aria-labelledby={`${id}-${drum}`}>
            <h2 id={`${id}-${drum}`} class="sound-heading" style={{ color: `var(--${drum})` }}>
              <span class="marker" aria-hidden="true">
                ##
              </span>{' '}
              {DRUM_NAMES[drum]}
            </h2>
            <SoundSection drum={drum} setup={props.setup} onChange={props.onChange} />
          </section>
        )}
      </For>
    </div>
  );
}
