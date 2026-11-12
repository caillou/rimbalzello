import { createSignal, For, onCleanup, Show } from 'solid-js';
import { repositoryUrl } from '../build-info';
import { createAudioSession, type AudioSessionState } from '../engine/audio-session';
import { createNativeKit, type Kit } from '../engine/kit';
import { createScheduler, type Scheduler } from '../engine/scheduler';
import { DRUMS, type Setup } from '../engine/setup';
import { createSetupStore, type Mutes, type SetupSnapshot } from '../engine/setup-store';
import { createTransport } from '../engine/transport';
import { createFirstLaunchHint, FirstLaunchHint, HelpBox, touchScreen } from './Help';
import { Pad } from './Pad';
import { StepDisplay } from './StepDisplay';
import { Strip } from './Strip';
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
  const store = createSetupStore();
  const [setup, setSetup] = createSignal(store.setup());
  const [mutes, setMutes] = createSignal(store.mutes());

  // A fresh chaos seed per session, so each visit's bars vary differently.
  const transport = createTransport({ setup: store.setup(), seed: Math.floor(Math.random() * 2 ** 32) });

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
          <button type="button" class="tempo-button" aria-label="tempo down" onClick={() => changeTempo(-1)}>
            −
          </button>
          <span class="bpm">
            {setup().bpm}
            <span class="bpm-unit"> bpm</span>
          </span>
          <button type="button" class="tempo-button" aria-label="tempo up" onClick={() => changeTempo(1)}>
            +
          </button>
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

      {/* Placed now; set anchor, return and sound mode come with their own issues. */}
      <div class="bottom-bar">
        <button type="button" class="bar-button">
          <span class="marker">→</span> sound
        </button>
        <button type="button" class="bar-button text-button">
          set anchor
        </button>
        <button type="button" class="bar-button return-button">
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
