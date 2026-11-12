import { createSignal, Show } from 'solid-js';
import { createNativeKit } from '../engine/kit';
import { createScheduler, type Scheduler } from '../engine/scheduler';
import { defaultSetup } from '../engine/setup';
import { createTransport } from '../engine/transport';
import './play-screen.css';

export function App() {
  // Audio is locked until the first tap; the `▶ tap to play` overlay stays until then.
  const [unlocked, setUnlocked] = createSignal(false);
  const [playing, setPlaying] = createSignal(false);
  let scheduler: Scheduler | undefined;

  // Runs inside a tap or click: browsers only let a user gesture start audio.
  function play() {
    if (!scheduler) {
      const context = new AudioContext();
      void context.resume();
      const setup = defaultSetup();
      scheduler = createScheduler(context, createNativeKit(context), createTransport(setup.bpm), setup.sound);
      setUnlocked(true);
    }
    scheduler.play();
    setPlaying(true);
  }

  function stop() {
    scheduler?.stop();
    setPlaying(false);
  }

  return (
    <main class="play-screen">
      <header class="header">
        <h1 class="title">
          <span class="marker">#</span> rimbalzello
        </h1>
        <button type="button" class="text-button" onClick={() => (playing() ? stop() : play())}>
          {playing() ? 'stop' : 'play'}
        </button>
      </header>
      <div class="pad">
        <Show when={!unlocked()}>
          <button type="button" class="tap-to-play" onClick={play}>
            <span>▶ tap to play</span>
          </button>
        </Show>
      </div>
    </main>
  );
}
