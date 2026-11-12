import { afterEach, describe, expect, test, vi } from 'vitest';
import { createAudioSession, type AudioSession, type SessionContext, type WakeLockHandle } from './audio-session';
import { tunables } from './tunables';

/** What the browser does with a resume. */
type ResumeAnswer = 'allow' | 'refuse' | 'hang';

class FakeContext implements SessionContext {
  state: AudioContextState = 'suspended';
  answer: ResumeAnswer = 'allow';
  private readonly listeners: (() => void)[] = [];

  addEventListener(_type: 'statechange', listener: () => void) {
    this.listeners.push(listener);
  }

  resume(): Promise<void> {
    if (this.answer === 'refuse') return Promise.reject(new Error('resume refused'));
    if (this.answer === 'hang') return new Promise(() => {});
    this.become('running');
    return Promise.resolve();
  }

  /** The browser changes the state: a call, an app switch, the end of an interruption. */
  become(state: AudioContextState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

class FakeWakeLock implements WakeLockHandle {
  released = false;
  release() {
    this.released = true;
    return Promise.resolve();
  }
}

/** Lets pending promise callbacks run. */
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function setUp() {
  const context = new FakeContext();
  const visibilityListeners: (() => void)[] = [];
  const document = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_type: 'visibilitychange', listener: () => void) => void visibilityListeners.push(listener),
  };
  const locks: FakeWakeLock[] = [];
  let lockGranted = (lock: FakeWakeLock) => Promise.resolve(lock);

  const session = createAudioSession({
    onChange: () => {},
    host: {
      createContext: () => context,
      document,
      wakeLock: {
        request: () => {
          const lock = new FakeWakeLock();
          locks.push(lock);
          return lockGranted(lock);
        },
      },
      createSilentAudio: () => ({ play: () => Promise.resolve() }),
    },
  });

  function setVisibility(state: DocumentVisibilityState) {
    document.visibilityState = state;
    for (const listener of visibilityListeners) listener();
  }

  return {
    session,
    context,
    locks,
    heldLocks: () => locks.filter((lock) => !lock.released).length,
    /** Makes the next wake lock requests wait until the returned function grants them. */
    delayLocks() {
      let grant = () => {};
      lockGranted = (lock) => new Promise((resolve) => (grant = () => resolve(lock)));
      return () => grant();
    },
    hide() {
      setVisibility('hidden');
      // The browser releases a wake lock when the page is hidden.
      for (const lock of locks) lock.released = true;
    },
    show: () => setVisibility('visible'),
  };
}

/** The play tap, as the app runs it. */
function play(session: AudioSession<FakeContext>) {
  session.unlock();
  session.setPlaying(true);
}

describe('resume after an interruption', () => {
  afterEach(() => void vi.useRealTimers());

  test('a context the browser lets resume plays on without asking for a tap', async () => {
    const { session, context } = setUp();
    play(session);
    context.become('suspended');
    await flush();
    expect(context.state).toBe('running');
    expect(session.state).toBe('unlocked');
  });

  test('a refused resume asks for a tap; the tap resumes and the ask goes away', async () => {
    const { session, context } = setUp();
    play(session);
    context.answer = 'refuse';
    context.become('suspended');
    await flush();
    expect(session.state).toBe('refused');

    context.answer = 'allow';
    session.unlock();
    expect(context.state).toBe('running');
    expect(session.state).toBe('unlocked');
  });

  test('a resume left pending during a call asks for a tap, which goes away when the call ends', async () => {
    vi.useFakeTimers();
    const { session, context } = setUp();
    play(session);
    context.answer = 'hang';
    context.become('interrupted');
    await vi.advanceTimersByTimeAsync(tunables.resumeWait / 2);
    expect(session.state, 'still trying on its own').toBe('unlocked');
    await vi.advanceTimersByTimeAsync(tunables.resumeWait);
    expect(session.state).toBe('refused');

    context.become('running');
    expect(session.state).toBe('unlocked');
  });

  test('after an app switch it resumes once the page is visible, and asks for a tap only then', async () => {
    const { session, context, hide, show } = setUp();
    play(session);
    context.answer = 'refuse';
    hide();
    context.become('suspended');
    await flush();
    expect(session.state).toBe('unlocked');

    show();
    await flush();
    expect(session.state).toBe('refused');
  });

  test('stop takes the ask away; the next play tap resumes', async () => {
    const { session, context } = setUp();
    play(session);
    context.answer = 'refuse';
    context.become('suspended');
    await flush();
    session.setPlaying(false);
    expect(session.state).toBe('unlocked');

    context.answer = 'allow';
    play(session);
    expect(context.state).toBe('running');
  });
});

describe('wake lock', () => {
  test('held while playing, released on stop, taken again when the page is visible again', async () => {
    const { session, heldLocks, hide, show } = setUp();
    play(session);
    await flush();
    expect(heldLocks()).toBe(1);

    hide();
    show();
    await flush();
    expect(heldLocks(), 'taken again after the page was hidden').toBe(1);

    session.setPlaying(false);
    expect(heldLocks()).toBe(0);
    hide();
    show();
    await flush();
    expect(heldLocks(), 'not taken while stopped').toBe(0);
  });

  test('a stop while the lock is still being granted releases it once granted', async () => {
    const { session, locks, heldLocks, delayLocks } = setUp();
    const grant = delayLocks();
    play(session);
    session.setPlaying(false);
    grant();
    await flush();
    expect(locks).toHaveLength(1);
    expect(heldLocks()).toBe(0);
  });
});
