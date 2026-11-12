// The tracer's fixed groove: the pattern at one fixed point, the map node at
// x 64, y 128 (nearest the initial pad position), at the initial densities
// and no chaos. A stand-in until the transport plays the pattern for the
// live setup; that swap replaces this call with `hitsAt` on the setup.

import { hitsAt, type PatternInput, type StepHits } from './pattern';
import { tunables } from './tunables';

const fixedInput: PatternInput = {
  x: 64,
  y: 128,
  density: tunables.initialSetup.density,
  perturbation: { bd: 0, sd: 0, hh: 0 },
};

/** Hits and accents of all three drums at one step (0–31) of the groove. */
export function grooveHits(step: number): StepHits {
  return hitsAt(fixedInput, step);
}
