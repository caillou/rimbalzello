import { createSignal, onCleanup, Show } from 'solid-js';
import { createAudioSession, type AudioSessionState } from '../engine/audio-session';
import { createNativeKit } from '../engine/kit';
import { createScheduler, type Scheduler } from '../engine/scheduler';
import { createSetupStore } from '../engine/setup-store';
import { createTransport } from '../engine/transport';
import './play-screen.css';

export function App() {
  const store = createSetupStore();
  // A fresh chaos seed per session, so each visit's bars vary differently.
  const transport = createTransport({ setup: store.setup(), seed: Math.floor(Math.random() * 2 ** 32) });
  onCleanup(store.subscribe(() => transport.update(store.setup())));

  // Audio is locked until the first tap; the pad shows `▶ tap to play` until
  // then, and `tap to resume` when the browser refuses to resume audio while playing.
  const [audio, setAudio] = createSignal<AudioSessionState>('locked');
  const session = createAudioSession({ onChange: setAudio });
  const [playing, setPlaying] = createSignal(false);
  let scheduler: Scheduler | undefined;

  // Runs inside a tap or click: browsers only let a user gesture start audio.
  function play() {
    const context = session.unlock();
    scheduler ??= createScheduler(context, createNativeKit(context), transport, store);
    scheduler.play();
    session.setPlaying(true);
    setPlaying(true);
  }

  function stop() {
    scheduler?.stop();
    session.setPlaying(false);
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
        <Show when={audio() !== 'unlocked'}>
          <button type="button" class="tap-to-play" onClick={() => (audio() === 'locked' ? play() : session.unlock())}>
            <span>{audio() === 'locked' ? '▶ tap to play' : 'tap to resume'}</span>
          </button>
        </Show>
      </div>
    </main>
  );
}
