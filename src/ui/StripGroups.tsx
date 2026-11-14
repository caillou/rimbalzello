// The strips of a tall phone window, stacked instead of folded into tabs:
// `## mix`, `## fx` and `## tempo`, each under a hairline heading over the
// same rows the tabs hold (stacked.css, imported by App). Rendered by the
// same function as StripTabs' panels, so the rows are identical.

import { createUniqueId, For, type JSX } from 'solid-js';
import { STRIP_TABS, type StripTab } from './StripTabs';

export interface StripGroupsProps {
  /** A group's rows. */
  children(group: StripTab): JSX.Element;
}

export function StripGroups(props: StripGroupsProps) {
  const id = createUniqueId();

  return (
    <div class="strip-groups">
      <For each={STRIP_TABS}>
        {(group) => (
          <section aria-labelledby={`${id}-${group}`}>
            <h2 id={`${id}-${group}`} class="group-heading">
              <span class="marker" aria-hidden="true">
                ##
              </span>{' '}
              {group}
            </h2>
            {props.children(group)}
          </section>
        )}
      </For>
    </div>
  );
}
