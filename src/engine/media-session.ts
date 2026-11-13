// The lock screen: what an iPhone shows for the playing groove on its lock
// screen and in Control Center, and a Mac in Now Playing. The title
// `rimbalzello`, the tempo under it, and the icon as artwork, through the
// Media Session metadata. Safari applies it to the AudioContext's own Now
// Playing entry, so the page needs no media element for it. Without it,
// Safari shows the bare domain.
//
// Feature-detected: a browser without the Media Session API shows its own
// defaults. No UI framework.

/** The lock screen's text. */
export interface LockScreen {
  /** The tempo shown under the title, in whole bpm. */
  setTempo(bpm: number): void;
}

/**
 * The icon, 512 px first: Safari may use only the first entry (WebKit bug
 * 265824), and both Safari and Chrome rate 512 px best. Chrome takes 256 px
 * on low-end phones.
 */
const ARTWORK: MediaImage[] = [512, 256].map((size) => ({
  src: `${import.meta.env.BASE_URL}icon-${size}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
}));

const subtitle = (bpm: number) => `${bpm} bpm`;

/** Sets the lock screen's title, tempo and artwork, at load: the tile shows once the groove plays. */
export function createLockScreen(bpm: number): LockScreen {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return { setTempo() {} };
  let shown = bpm;
  const metadata = new MediaMetadata({ title: 'rimbalzello', artist: subtitle(bpm), artwork: ARTWORK });
  navigator.mediaSession.metadata = metadata;
  return {
    setTempo(next) {
      if (next === shown) return;
      shown = next;
      // A change on the same metadata keeps the artwork: a new one would load it again.
      metadata.artist = subtitle(next);
    },
  };
}
