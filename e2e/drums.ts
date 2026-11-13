// The drums' full names, where the tablet and laptop layouts write them out
// (`src/ui/drum-names.ts`). A copy, since the specs cannot import that module:
// its extensionless imports do not resolve under the e2e tsconfig.

export const DRUM_NAMES = { bd: 'bass drum', sd: 'snare drum', hh: 'hi-hat' } as const;

export type Drum = keyof typeof DRUM_NAMES;

export const DRUMS: readonly Drum[] = ['bd', 'sd', 'hh'];
