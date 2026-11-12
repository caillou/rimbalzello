// A drum's sound: its voice parameters as sliders in the drum's colour. Sound
// mode on a phone shows one drum at a time under the drum tabs; a wider
// layout can set the three side by side. The number of columns comes from
// the `--sound-columns` custom property, one by default.

import { For, type Accessor } from 'solid-js';
import type { Drum, Setup, Sound } from '../engine/setup';
import type { SetupSnapshot } from '../engine/setup-store';
import { Strip } from './Strip';
import './sound.css';

/** A sound parameter of drum `D`. */
type Param<D extends Drum> = keyof Sound[D] & string;

/** Each drum's sound parameters, in the order the sliders show them. */
const PARAMS: { readonly [D in Drum]: readonly Param<D>[] } = {
  bd: ['freq', 'punch', 'tone', 'decay', 'level'],
  sd: ['freq', 'tone', 'snappy', 'decay', 'level'],
  hh: ['level'],
};

/** The sound as bytes by drum and parameter, so a parameter of `D` indexes drum `D`'s sound. */
type Bytes = { [D in Drum]: Record<Param<D>, number> };

export interface SoundSectionProps<D extends Drum> {
  drum: D;
  setup: Accessor<SetupSnapshot>;
  /** Changes the setup, as the store's `change` does. */
  onChange(edit: (setup: Setup) => void): void;
}

export function SoundSection<D extends Drum>(props: SoundSectionProps<D>) {
  function value(param: Param<D>): number {
    const sound: Readonly<Bytes> = props.setup().sound;
    return sound[props.drum][param];
  }

  function change(param: Param<D>, value: number) {
    const drum = props.drum;
    props.onChange((draft) => {
      const sound: Bytes = draft.sound;
      const bytes: Record<Param<D>, number> = sound[drum];
      bytes[param] = value;
    });
  }

  return (
    <div class="sound-section">
      <For each={PARAMS[props.drum]}>
        {(param) => (
          <Strip
            label={param}
            colour={`var(--${props.drum})`}
            value={value(param)}
            onChange={(byte) => change(param, byte)}
          />
        )}
      </For>
    </div>
  );
}
