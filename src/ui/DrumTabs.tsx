// Sound mode's drum tabs: `bd` `sd` `hh`, the active tab in its drum's colour
// and underlined, the drum's full name on the right, and below them that
// drum's sound in two columns, so it fits under the pad on a phone (a tall
// phone window stacks the drums instead: SoundSections). The tablet layout
// shows them all the time, beside the strips, in one column; a laptop
// window too short for the three sound sections, in two. Where the tabs
// write the names out (drum-names.ts), nothing shows on the right.

import { createSignal, createUniqueId, For, Show } from 'solid-js';
import { DRUMS, type Drum } from '../engine/setup';
import { DRUM_NAMES } from './drum-names';
import { SoundSection, type DrumsSoundProps } from './SoundSection';
import './sound.css';
import './tabs.css';

export interface DrumTabsProps extends DrumsSoundProps {
  /** Whether the tabs write the drums' names out (drum-names.ts). */
  fullNames: boolean;
}

export function DrumTabs(props: DrumTabsProps) {
  const [active, setActive] = createSignal<Drum>('bd');
  const id = createUniqueId();
  const tabId = (drum: Drum) => `${id}-${drum}`;

  return (
    <div class="drum-tabs">
      <div class="tab-row">
        <div class="tab-list" role="tablist" aria-label="sound">
          <For each={DRUMS}>
            {(drum) => (
              <button
                type="button"
                role="tab"
                id={tabId(drum)}
                class="tab"
                aria-selected={active() === drum}
                style={{ '--colour': `var(--${drum})` }}
                onClick={() => setActive(drum)}
              >
                {props.fullNames ? DRUM_NAMES[drum] : drum}
              </button>
            )}
          </For>
        </div>
        <Show when={!props.fullNames}>
          <span class="drum-name">{DRUM_NAMES[active()]}</span>
        </Show>
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
