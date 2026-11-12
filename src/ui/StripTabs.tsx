// The strips of the short and compact layouts, folded into two tabs: `mix`
// (the bd, sd and hh densities) and `fx` (chaos, drift and drive), on a tab
// row like sound mode's drum tabs. The panel holds the active tab's strips.

import { createUniqueId, For, type Accessor, type JSX } from 'solid-js';
import './tabs.css';
import './strip-tabs.css';

const STRIP_TABS = ['mix', 'fx'] as const;
export type StripTab = (typeof STRIP_TABS)[number];

export interface StripTabsProps {
  active: Accessor<StripTab>;
  onSelect(tab: StripTab): void;
  /** The active tab's strips. */
  children: JSX.Element;
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
        {props.children}
      </div>
    </div>
  );
}
