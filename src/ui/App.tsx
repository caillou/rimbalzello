import { createSignal, For, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import { Portal } from 'solid-js/web';
import { createAudioSession, type AudioSessionState } from '../engine/audio-session';
import { createNativeKit, type Kit } from '../engine/kit';
import { createScheduler, type Scheduler } from '../engine/scheduler';
import { DRUMS, type Setup } from '../engine/setup';
import { createSetupStore, type Mutes, type SetupSnapshot } from '../engine/setup-store';
import { createTransport, type LoopSteps } from '../engine/transport';
import { startingSetup, syncUrlHash } from '../engine/url-hash';
import { repositoryUrl } from '../repository';
import { About } from './About';
import { claimLinkClick, createAboutRoute } from './about-route';
import { DrumTabs } from './DrumTabs';
import { createFirstLaunchHint, FirstLaunchHint, HelpBox, touchScreen } from './Help';
import { createLayout, isWide } from './layout';
import { LoopStrip } from './LoopStrip';
import { Pad } from './Pad';
import { PressButton } from './PressButton';
import { RotateHint } from './RotateHint';
import { SoundSections } from './SoundSections';
import { StepDisplay } from './StepDisplay';
import { Strip } from './Strip';
import { StripTabs, type StripTab } from './StripTabs';
import { SwingRow, TapTempo, TempoPanel } from './TempoPanel';
import './play-screen.css';
import './short-and-compact.css';
import './wide-layouts.css';

interface StripField {
  label: string;
  colour: string;
  get(setup: SetupSnapshot): number;
  set(setup: Setup, value: number): void;
}

/** The six strips by tab: `mix` the densities, `fx` chaos, drift and drive. */
const STRIPS_BY_TAB: Readonly<Record<StripTab, readonly StripField[]>> = {
  mix: DRUMS.map((drum) => ({
    label: drum,
    colour: `var(--${drum})`,
    get: (setup: SetupSnapshot) => setup.density[drum],
    set: (setup: Setup, value: number) => void (setup.density[drum] = value),
  })),
  fx: (['chaos', 'drift', 'drive'] as const).map((field) => ({
    label: field,
    colour: `var(--${field})`,
    get: (setup: SetupSnapshot) => setup[field],
    set: (setup: Setup, value: number) => void (setup[field] = value),
  })),
};

/** The six strips of the phone, tablet and laptop layouts, top to bottom (the laptop's in two columns). */
const STRIPS = [...STRIPS_BY_TAB.mix, ...STRIPS_BY_TAB.fx];

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
  /** The loop held from the loop strip. */
  const [loop, setLoop] = createSignal<LoopSteps>();

  // About opens over the play screen, which keeps playing underneath.
  const about = createAboutRoute(store);

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
    setLoop(undefined);
  }

  // The looper works only while playing, and stop ends the loop.
  function holdLoop(steps: LoopSteps) {
    if (!playing()) return;
    scheduler?.hold(steps);
    setLoop(steps);
  }

  function releaseLoop() {
    if (loop() === undefined) return;
    scheduler?.release();
    setLoop(undefined);
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

  // What sits in the strips' place: the strips in play, the drum tabs in
  // sound mode, or the tempo panel.
  const [mode, setMode] = createSignal<'play' | 'sound' | 'tempo'>('play');

  // The play screen's layout, from its size. The short and compact layouts
  // fold the strips into tabs, and the compact layout also moves the step
  // display into the pad.
  const { layout, soundFolded, observe } = createLayout();
  let screen!: HTMLElement;
  onMount(() => observe(screen));
  const [stripTab, setStripTab] = createSignal<StripTab>('mix');
  const stripsInTabs = () => layout() === 'short' || layout() === 'compact';
  const wide = () => isWide(layout());
  // The mode, as the strips' place shows it. Wide layouts show the sound
  // beside the strips, so sound mode is for phones only. The laptop keeps
  // its strips when the tempo panel opens: swing is inline there, so the
  // panel only adds tap tempo next to it.
  const stripsPlace = () => (layout() === 'laptop' || (wide() && mode() === 'sound') ? 'play' : mode());

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

  const stepDisplay = () => (
    <StepDisplay
      setup={setup}
      mutes={mutes}
      playing={playing}
      heard={() => scheduler?.heard()}
      onToggleMute={(drum) => store.toggleMute(drum)}
    />
  );

  const stripRow = (strip: StripField) => (
    <Strip
      label={strip.label}
      colour={strip.colour}
      value={strip.get(setup())}
      onChange={(value) => store.change((draft) => strip.set(draft, value))}
    />
  );

  // No long-press menus on the instrument; links keep theirs.
  function noContextMenu(event: MouseEvent) {
    if (!(event.target instanceof Element && event.target.closest('a'))) event.preventDefault();
  }

  return (
    <main
      ref={screen}
      class="play-screen"
      data-layout={layout()}
      data-sound-folded={soundFolded() ? '' : undefined}
      inert={about.open() || layout() === 'rotate'}
      onContextMenu={noContextMenu}
    >
      {/* Both mounted in <body>, outside the play screen, which is inert under
          them. About covers the rotate hint, so it reads on a phone held sideways. */}
      <Show when={about.open()}>
        <Portal>
          <About playing={playing()} onClose={about.close} />
        </Portal>
      </Show>
      <Show when={layout() === 'rotate'}>
        <Portal>
          <RotateHint />
        </Portal>
      </Show>

      <header class="header">
        <h1 class="title">
          <span class="marker">#</span> rimbalzello
        </h1>
        <div class="header-controls">
          <PressButton class="tempo-button" label="tempo down" repeat onPress={() => changeTempo(-1)}>
            −
          </PressButton>
          {/* Opens the tempo panel from play or sound mode; closes it back to play. */}
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

      <Pad store={store} mapNodes={layout() === 'laptop'} onMove={firstLaunchHint.dismiss}>
        <Show when={layout() === 'compact'}>{stepDisplay()}</Show>
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

      <Show when={layout() !== 'compact'}>{stepDisplay()}</Show>

      <LoopStrip held={loop} playing={playing} onHold={holdLoop} onRelease={releaseLoop} />

      <Switch>
        <Match when={stripsPlace() === 'play' && !stripsInTabs()}>
          <div class="strips">
            <For each={STRIPS}>{stripRow}</For>
          </div>
        </Match>
        <Match when={stripsPlace() === 'play'}>
          <StripTabs active={stripTab} onSelect={setStripTab}>
            <For each={STRIPS_BY_TAB[stripTab()]}>{stripRow}</For>
          </StripTabs>
        </Match>
        <Match when={stripsPlace() === 'sound'}>
          <DrumTabs setup={setup} onChange={(edit) => store.change(edit)} />
        </Match>
        <Match when={stripsPlace() === 'tempo'}>
          <TempoPanel setup={setup} onChange={(edit) => store.change(edit)} />
        </Match>
      </Switch>

      <Switch>
        <Match when={layout() === 'tablet'}>
          <DrumTabs setup={setup} onChange={(edit) => store.change(edit)} />
        </Match>
        <Match when={layout() === 'laptop'}>
          <div class="inline-tempo">
            <SwingRow setup={setup} onChange={(edit) => store.change(edit)} />
            <Show when={mode() === 'tempo'}>
              <TapTempo onChange={(edit) => store.change(edit)} />
            </Show>
          </div>
          {/* A window too short for the three sound sections folds them into the drum tabs. */}
          <Show when={soundFolded()} fallback={<SoundSections setup={setup} onChange={(edit) => store.change(edit)} />}>
            <DrumTabs setup={setup} onChange={(edit) => store.change(edit)} />
          </Show>
        </Match>
      </Switch>

      <div class="bottom-bar">
        {/* One button, so it keeps focus when `→ sound` or `← play` swaps what sits above it.
            Wide layouts have no sound mode: there it only closes the tempo panel. */}
        <Show when={!wide() || mode() === 'tempo'}>
          <button type="button" class="bar-button" onClick={() => setMode(mode() === 'play' ? 'sound' : 'play')}>
            <span class="marker">{mode() === 'play' ? '→' : '←'}</span> {mode() === 'play' ? 'sound' : 'play'}
          </button>
        </Show>
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
        <a
          class="footer-item"
          href="/about/"
          aria-label="about"
          onClick={(event) => {
            if (claimLinkClick(event)) about.show();
          }}
        >
          {'// about'}
        </a>
        <a class="footer-item" href={repositoryUrl} target="_blank" rel="noopener">
          {'// source'}
        </a>
      </footer>
    </main>
  );
}
