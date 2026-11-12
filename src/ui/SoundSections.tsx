// The laptop's sound: `## bd`, `## sd` and `## hh` side by side under a
// hairline, each drum's sliders in one column, with no tabs.

import { createUniqueId, For } from 'solid-js';
import { DRUMS } from '../engine/setup';
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
              {drum}
            </h2>
            <SoundSection drum={drum} setup={props.setup} onChange={props.onChange} />
          </section>
        )}
      </For>
    </div>
  );
}
