// A keycap hint: the key that plays a control, drawn as a small outlined key
// next to it (design.md, Keycap hints). Screen readers skip it and read the
// control's own name. keycaps.css shows it only while the play screen shows
// keycap hints.

import type { JSX } from 'solid-js';
import './keycaps.css';

export function Keycap(props: { children: JSX.Element }) {
  return (
    <kbd class="keycap" aria-hidden="true">
      {props.children}
    </kbd>
  );
}
