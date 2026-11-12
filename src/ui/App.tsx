import { createSignal, For, onCleanup, Show } from 'solid-js';
import { repositoryUrl } from '../build-info';
import { createAudioSession, type AudioSessionState } from '../engine/audio-session';
import { createNativeKit, type Kit } from '../engine/kit';
import { createScheduler, type Scheduler } from '../engine/scheduler';
import { DRUMS, type Setup } from '../engine/setup';
import { createSetupStore, type Mutes, type SetupSnapshot } from '../engine/setup-store';
import { createTransport } from '../engine/transport';
import { createFirstLaunchHint, FirstLaunchHint, HelpBox, touchScreen } from './Help';
import { startingSetup, syncUrlHash } from '../engine/url-hash';
import { Pad } from './Pad';
import { PressButton } from './PressButton';
import { StepDisplay } from './StepDisplay';
import { Strip } from './Strip';
import { TempoPanel } from './TempoPanel';
import './play-screen.css';

/** The six strips of the phone layout, top to bottom. */
const STRIPS: readonly {
  label: string;
  colour: string;
  get(setup: SetupSnapshot): number;
  set(setup: Setup, value: number): void;
}[] = [
  ...DRUMS.map((drum) => ({
    label: drum,
    colour: `var(--${drum})`,
    get: (setup: SetupSnapshot) => setup.density[drum],
    set: (setup: Setup, value: number) => void (setup.density[drum] = value),
  })),
  ...(['chaos', 'drift', 'drive'] as const).map((field) => ({
    label: field,
    colour: `var(--${field})`,
    get: (setup: SetupSnapshot) => setup[field],
    set: (setup: Setup, value: number) => void (setup[field] = value),
  })),
];

/** What the kit follows from the store: drift, drive and mutes. */
interface KitState {
  drift: number;
  drive: number;
  mutes: Mutes;
}

/** Brings the kit along when the store's drift, drive or mutes change (strips, mute labels, return). */
function updateKit(kit: Kit, before: KitState, after: KitState) {
  if (after.drift !== before.drift) kit.setDrift(after.drift);
  if (after.drive !== before.drive) kit.setDrive(after.drive);
  for (const drum of DRUMS) if (after.mutes[drum] !== before.mutes[drum]) kit.setMuted(drum, after.mutes[drum]);
}

export function App() {
  const store = createSetupStore({ setup: startingSetup(location.hash) });
  onCleanup(syncUrlHash(store));
  const [setup, setSetup] = createSignal(store.setup());
  const [mutes, setMutes] = createSignal(store.mutes());

  // A fresh chaos seed per session, so each visit's bars vary differently.
  const transport = createTransport({ setup: store.setup(), seed: Math.floor(Math.random() * 2 ** 32) });
  // Whether a return is pending, for the button's pulse. A return lands, at
  // the bar or on stop, with a store change, so every store change reads it again.
  const [returnPending, setReturnPending] = createSignal(false);

  let kit: Kit | undefined;
  let scheduler: Scheduler | undefined;

  let before: KitState = { ...store.setup(), mutes: store.mutes() };
  onCleanup(
    store.subscribe(() => {
      const next = store.setup();
      const nextMutes = store.mutes();
      transport.update(next);
      const after = { ...next, mutes: nextMutes };
      if (kit) updateKit(kit, before, after);
      before = after;
      setSetup(next);
      setMutes(nextMutes);
      setReturnPending(transport.returnPending);
    }),
  );

  // Audio is locked until the first tap; the pad shows `▶ tap to play` until
  // then, and `tap to resume` when the browser refuses to resume audio while playing.
  const [audio, setAudio] = createSignal<AudioSessionState>('locked');
  const session = createAudioSession({ onChange: setAudio });
  const [playing, setPlaying] = createSignal(false);

  // Runs inside a tap or click: browsers only let a user gesture start audio.
  function play() {
    const unlocked = session.unlock();
    if (!scheduler) {
      const { drift, drive } = store.setup();
      kit = createNativeKit(unlocked, { drift, drive });
      for (const drum of DRUMS) kit.setMuted(drum, store.mutes()[drum]);
      scheduler = createScheduler(unlocked, kit, transport, store);
    }
    scheduler.play();
    session.setPlaying(true);
    setPlaying(true);
  }

  function stop() {
    scheduler?.stop();
    session.setPlaying(false);
    setPlaying(false);
  }

  // Touch screens get the help box; laptops' keycap hints come with keyboard play.
  const [helpOpen, setHelpOpen] = createSignal(false);
  const firstLaunchHint = createFirstLaunchHint();

  function toggleHelp() {
    if (touchScreen()) setHelpOpen((open) => !open);
  }

  function changeTempo(by: number) {
    store.change((draft) => void (draft.bpm += by));
  }

  // What sits in the strips' place: the strips, or the tempo panel.
  const [mode, setMode] = createSignal<'play' | 'tempo'>('play');

  function setAnchor() {
    store.setAnchor();
    // A return already pending restores the new anchor.
    if (transport.returnPending) transport.requestReturn(store.returnSetup());
  }

  // While playing, the anchor comes back at the next bar; while stopped, at once.
  function returnOnBar() {
    if (!transport.playing) return store.applyAnchor();
    transport.requestReturn(store.returnSetup());
    setReturnPending(true);
  }

  // No long-press menus on the instrument; links keep theirs.
  function noContextMenu(event: MouseEvent) {
    if (!(event.target instanceof Element && event.target.closest('a'))) event.preventDefault();
  }

  return (
    <main class="play-screen" onContextMenu={noContextMenu}>
      <header class="header">
        <h1 class="title">
          <span class="marker">#</span> rimbalzello
        </h1>
        <div class="header-controls">
          <PressButton class="tempo-button" label="tempo down" repeat onPress={() => changeTempo(-1)}>
            −
          </PressButton>
          <button
            type="button"
            class="bpm"
            aria-expanded={mode() === 'tempo'}
            onClick={() => setMode(mode() === 'tempo' ? 'play' : 'tempo')}
          >
            <span class="bpm-value">{setup().bpm}</span>
            <span class="bpm-unit"> bpm</span>
          </button>
          <PressButton class="tempo-button" label="tempo up" repeat onPress={() => changeTempo(1)}>
            +
          </PressButton>
          <button type="button" class="text-button play-stop" onClick={() => (playing() ? stop() : play())}>
            {playing() ? 'stop' : 'play'}
          </button>
        </div>
      </header>

      <Pad store={store} onMove={firstLaunchHint.dismiss}>
        {/* The help box says all the hint says, so the hint steps aside while it is open. */}
        <Show when={firstLaunchHint.shown() && !helpOpen()}>
          <FirstLaunchHint />
        </Show>
        <Show when={helpOpen()}>
          <HelpBox />
        </Show>
        <Show when={audio() !== 'unlocked'}>
          <button type="button" class="tap-to-play" onClick={() => (audio() === 'locked' ? play() : session.unlock())}>
            <span>{audio() === 'locked' ? '▶ tap to play' : 'tap to resume'}</span>
          </button>
        </Show>
      </Pad>

      <StepDisplay
        setup={setup}
        mutes={mutes}
        playing={playing}
        heard={() => scheduler?.heard()}
        onToggleMute={(drum) => store.toggleMute(drum)}
      />

      <Show
        when={mode() === 'tempo'}
        fallback={
          <div class="strips">
            <For each={STRIPS}>
              {(strip) => (
                <Strip
                  label={strip.label}
                  colour={strip.colour}
                  value={strip.get(setup())}
                  onChange={(value) => store.change((draft) => strip.set(draft, value))}
                />
              )}
            </For>
          </div>
        }
      >
        <TempoPanel setup={setup} onChange={(edit) => store.change(edit)} />
      </Show>

      {/* Placed now; sound mode comes with its own issue. */}
      <div class="bottom-bar">
        {/* One button, so it keeps focus when `← play` closes the tempo panel. */}
        <button type="button" class="bar-button" onClick={() => setMode('play')}>
          <span class="marker">{mode() === 'play' ? '→' : '←'}</span> {mode() === 'play' ? 'sound' : 'play'}
        </button>
        <button type="button" class="bar-button text-button" onClick={setAnchor}>
          set anchor
        </button>
        <button
          type="button"
          class="bar-button return-button"
          classList={{ pending: returnPending() }}
          aria-description={returnPending() ? 'pending' : undefined}
          onClick={returnOnBar}
        >
          <span>↺ return on bar</span>
        </button>
      </div>

      <footer class="footer">
        <button
          type="button"
          class="footer-item"
          aria-label="help"
          aria-pressed={helpOpen() ? 'true' : 'false'}
          onClick={toggleHelp}
        >
          {'// help'}
        </button>
        <button type="button" class="footer-item">
          {'// about'}
        </button>
        <a class="footer-item" href={repositoryUrl} target="_blank" rel="noopener">
          {'// source'}
        </a>
      </footer>
    </main>
  );
}
