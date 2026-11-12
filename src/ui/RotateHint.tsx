// The rotate hint: a landscape viewport too short or too narrow for two
// columns gets this instead of the play screen. A phone is asked to turn
// upright; a laptop window, to grow taller. The play screen stays mounted
// under it, inert and hidden, so the music keeps going.

import { touchScreen } from './Help';
import './rotate-hint.css';

export function RotateHint() {
  return (
    <div class="rotate-hint" role="status">
      <p class="rotate-hint-title">
        <span class="marker">#</span> rimbalzello
      </p>
      <p>{touchScreen() ? 'turn the phone upright' : 'make the window taller'}</p>
    </div>
  );
}
