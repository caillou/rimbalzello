// Sound mode's drum tabs: `bd` `sd` `hh`, the active tab in its drum's colour
// and underlined, the drum's full name on the right, and below them that
// drum's sound in two columns, so it fits under the pad on a phone.

import { createSignal, createUniqueId, For, Show } from 'solid-js';
import { DRUMS, type Drum } from '../engine/setup';
import { SoundSection, type SoundSectionProps } from './SoundSection';
import './sound.css';

const NAMES: Record<Drum, string> = { bd: 'bass drum', sd: 'snare drum', hh: 'hi-hat' };

export type DrumTabsProps = Omit<SoundSectionProps<Drum>, 'drum'>;

export function DrumTabs(props: DrumTabsProps) {
  const [active, setActive] = createSignal<Drum>('bd');
  const id = createUniqueId();
  const tabId = (drum: Drum) => `${id}-${drum}`;

  return (
    <div class="drum-tabs">
      <div class="drum-tab-row">
        <div class="drum-tab-list" role="tablist" aria-label="sound">
          <For each={DRUMS}>
            {(drum) => (
              <button
                type="button"
                role="tab"
                id={tabId(drum)}
                class="drum-tab"
                aria-selected={active() === drum}
                style={{ '--colour': `var(--${drum})` }}
                onClick={() => setActive(drum)}
              >
                {drum}
              </button>
            )}
          </For>
        </div>
        <span class="drum-name">{NAMES[active()]}</span>
      </div>
      <div role="tabpanel" aria-labelledby={tabId(active())}>
        {/* Keyed, so each drum gets its own sliders: a drag held across a tab
            switch ends with its drum's sliders instead of writing into the next drum. */}
        <Show when={active()} keyed>
          {(drum) => <SoundSection drum={drum} setup={props.setup} onChange={props.onChange} />}
        </Show>
      </div>
    </div>
  );
}
