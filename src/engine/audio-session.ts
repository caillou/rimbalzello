// The audio session: what keeps the app sounding on a phone. The first tap
// creates and starts the AudioContext and puts the page in a playback audio
// session, so the iPhone silent switch does not mute it. After that it
// resumes the context when the browser suspends it (calls, app switches, a
// hidden page) and, when the browser refuses, asks the player for one tap.
// While the groove plays it holds a screen wake lock.
//
// Every browser API here is feature-detected: a browser without one plays
// as before. No UI framework: the state reaches the UI through a callback.

import { tunables } from './tunables';

/**
 * What the pad asks of the player:
 * - `locked`: no tap yet; the pad shows `▶ tap to play`.
 * - `unlocked`: audio runs, or the session is resuming it on its own.
 * - `refused`: the browser refused to resume while the groove plays; the pad shows `tap to resume`.
 */
export type AudioSessionState = 'locked' | 'unlocked' | 'refused';

export interface AudioSession<C extends SessionContext = AudioContext> {
  readonly state: AudioSessionState;
  /**
   * Call inside a tap or click, before playing: browsers only start audio
   * from a user gesture. The first call creates and starts the context and
   * sets up the playback session; later calls resume the context if the
   * browser suspended it. Returns the context.
   */
  unlock(): C;
  /**
   * Whether the groove plays. The session holds a screen wake lock while it
   * plays, and only asks for a tap to resume while it plays.
   */
  setPlaying(playing: boolean): void;
}

/** The part of an AudioContext the session drives. */
export interface SessionContext {
  readonly state: AudioContextState;
  resume(): Promise<void>;
  addEventListener(type: 'statechange', listener: () => void): void;
}

/** A held screen wake lock, as `navigator.wakeLock.request('screen')` hands it out. */
export interface WakeLockHandle {
  /** True once released, by the session or by the browser when the page is hidden. */
  readonly released: boolean;
  release(): Promise<void>;
}

/** The browser around the session. Defaults to the page's own; tests pass fakes. */
export interface AudioSessionHost<C extends SessionContext> {
  createContext(): C;
  readonly document: {
    readonly visibilityState: DocumentVisibilityState;
    addEventListener(type: 'visibilitychange', listener: () => void): void;
  };
  /** `navigator.audioSession`, where the browser has it. */
  readonly audioSession?: { type: string };
  /** `navigator.wakeLock`, where the browser has it. */
  readonly wakeLock?: { request(type: 'screen'): Promise<WakeLockHandle> };
  /** A looping silent `<audio>` element, played where there is no `audioSession`. */
  createSilentAudio(): { play(): Promise<void> };
}

export interface AudioSessionOptions<C extends SessionContext> {
  /** Called on every state change. */
  onChange(state: AudioSessionState): void;
  host?: AudioSessionHost<C>;
}

export function createAudioSession<C extends SessionContext = AudioContext>({
  onChange,
  host = browserHost() as unknown as AudioSessionHost<C>,
}: AudioSessionOptions<C>): AudioSession<C> {
  let state: AudioSessionState = 'locked';
  let context: C | undefined;
  let silentAudio: { play(): Promise<void> } | undefined;
  let playing = false;
  // Counts resume attempts: only the latest one may ask for a tap.
  let attempts = 0;
  let wakeLock: WakeLockHandle | undefined;
  let requestingWakeLock = false;

  const visible = () => host.document.visibilityState === 'visible';

  function setState(next: AudioSessionState) {
    if (next === state) return;
    state = next;
    onChange(next);
  }

  /** Sets `navigator.audioSession.type`; false where the browser lacks it. */
  function setPlaybackSession(): boolean {
    if (!host.audioSession) return false;
    try {
      host.audioSession.type = 'playback';
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    // A call or an app switch can pause the silent audio too. Outside a tap
    // the browser may refuse to restart it; the next tap does.
    const audio = silentAudio;
    if (audio) ignoreFailure(() => audio.play());
    const ctx = context;
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;

    const attempt = ++attempts;
    function settle() {
      clearTimeout(wait);
      if (attempt !== attempts || !ctx) return;
      if (ctx.state === 'running') setState('unlocked');
      else if (playing && visible()) setState('refused');
    }
    const wait = setTimeout(settle, tunables.resumeWait);
    ctx.resume().then(settle, settle);
  }

  function holdWakeLock() {
    const api = host.wakeLock;
    if (!api || !playing || !visible() || requestingWakeLock) return;
    if (wakeLock && !wakeLock.released) return;
    // Requested at once, still inside the play tap where there is one.
    // The browser releases the lock when the page is hidden; it is requested again once visible.
    let request: Promise<WakeLockHandle>;
    try {
      request = api.request('screen');
    } catch {
      return;
    }
    requestingWakeLock = true;
    request.then(
      (handle) => {
        requestingWakeLock = false;
        wakeLock = handle;
        // Stopped while the request was pending.
        if (!playing) releaseWakeLock();
      },
      () => {
        requestingWakeLock = false;
      },
    );
  }

  function releaseWakeLock() {
    const handle = wakeLock;
    wakeLock = undefined;
    if (handle && !handle.released) ignoreFailure(() => handle.release());
  }

  host.document.addEventListener('visibilitychange', () => {
    if (!visible()) return;
    resume();
    holdWakeLock();
  });

  return {
    get state() {
      return state;
    },
    unlock() {
      if (!context) {
        // The session type must be set before any audio starts.
        if (!setPlaybackSession()) silentAudio = host.createSilentAudio();
        const ctx = host.createContext();
        ctx.addEventListener('statechange', () => {
          if (ctx.state === 'running') setState('unlocked');
          else if (visible()) resume();
        });
        context = ctx;
      }
      setState('unlocked');
      resume();
      return context;
    },
    setPlaying(next) {
      playing = next;
      if (playing) {
        holdWakeLock();
      } else {
        releaseWakeLock();
        // Stopped: there is nothing to resume until the player presses play.
        if (state === 'refused') setState('unlocked');
      }
    },
  };
}

/** Calls an optional browser API, ignoring a throw or a rejection. */
function ignoreFailure(call: () => Promise<unknown>) {
  try {
    call().catch(() => {});
  } catch {
    // Missing or refused: the app plays without it.
  }
}

function browserHost(): AudioSessionHost<AudioContext> {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  return {
    createContext: () => new AudioContext(),
    document,
    get audioSession() {
      return nav.audioSession;
    },
    get wakeLock() {
      return 'wakeLock' in nav ? nav.wakeLock : undefined;
    },
    createSilentAudio,
  };
}

/**
 * A playing media element puts the page in a playback audio session on iOS,
 * which the silent switch does not mute; Web Audio alone does not.
 */
function createSilentAudio(): HTMLAudioElement {
  const audio = document.createElement('audio');
  audio.loop = true;
  audio.src = URL.createObjectURL(silentWav());
  // It only holds the audio session: keep it out of AirPlay and casting menus.
  audio.disableRemotePlayback = true;
  audio.setAttribute('x-webkit-airplay', 'deny');
  // In the page, so it can be found in the inspector and by browser tests.
  document.body.append(audio);
  return audio;
}

/**
 * A quarter second of silence: a 16-bit mono PCM WAV at 48 kHz. At a low
 * rate iOS could run the whole audio session at that rate and mix the Web
 * Audio output down with it, cutting the hi-hat.
 */
function silentWav(): Blob {
  const rate = 48000;
  const frames = rate / 4;
  const dataBytes = frames * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per frame
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  // The samples stay 0: silence.
  return new Blob([view], { type: 'audio/wav' });
}
