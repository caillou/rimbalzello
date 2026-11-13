// The strips of the phone layouts, folded into tabs: `mix` (the bd, sd and
// hh densities), `fx` (chaos, drift and drive) and `tempo` (bpm, swing and
// tap tempo), on a tab row like sound mode's drum tabs. Each tab holds three
// 44 px rows, so the pad keeps its size when the tab changes.

import { createUniqueId, For, type Accessor, type JSX } from 'solid-js';
import './tabs.css';
import './strip-tabs.css';

const STRIP_TABS = ['mix', 'fx', 'tempo'] as const;
export type StripTab = (typeof STRIP_TABS)[number];

export interface StripTabsProps {
  active: Accessor<StripTab>;
  onSelect(tab: StripTab): void;
  /** The active tab's rows. */
  children(tab: StripTab): JSX.Element;
}

export function StripTabs(props: StripTabsProps) {
  const id = createUniqueId();
  const tabId = (tab: StripTab) => `${id}-${tab}`;

  return (
    <div class="strip-tabs">
      <div class="tab-row">
        <div class="tab-list" role="tablist" aria-label="strips">
          <For each={STRIP_TABS}>
            {(tab) => (
              <button
                type="button"
                role="tab"
                id={tabId(tab)}
                class="tab"
                aria-selected={props.active() === tab}
                onClick={() => props.onSelect(tab)}
              >
                {tab}
              </button>
            )}
          </For>
        </div>
      </div>
      <div role="tabpanel" aria-labelledby={tabId(props.active())}>
        {props.children(props.active())}
      </div>
    </div>
  );
}
