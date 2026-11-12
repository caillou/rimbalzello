// The about view: the credits as a blog post over the play screen, which keeps
// playing underneath (design.md, About; designs/08-about.png). `← back to
// play`, `×` and `esc` close it. The credits are the same HTML the build
// prerenders into /about/, whose markup this view repeats around them.

import { onCleanup, onMount, Show } from 'solid-js';
import { commitHash } from '../build-info';
import { repositoryUrl } from '../repository';
import { creditsHtml } from './about-credits';
import { claimLinkClick } from './about-route';
import './blog.css';
import './about.css';

const credits = creditsHtml({ commitHash, repositoryUrl });

export interface AboutProps {
  playing: boolean;
  onClose: () => void;
}

export function About(props: AboutProps) {
  let view!: HTMLElement;
  // Focus returns here on close: `// about` in the footer, when it was the way in.
  const opener = document.activeElement;

  function onLinkClick(event: MouseEvent) {
    if (claimLinkClick(event)) props.onClose();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') props.onClose();
  }

  onMount(() => {
    document.title = 'about · rimbalzello';
    window.addEventListener('keydown', onKeyDown);
    view.focus();
  });

  onCleanup(() => {
    document.title = 'rimbalzello';
    window.removeEventListener('keydown', onKeyDown);
    // Once the play screen is no longer inert.
    if (opener instanceof HTMLElement) queueMicrotask(() => opener.focus());
  });

  return (
    <section ref={view} class="about" aria-label="about" tabindex="-1">
      <nav class="about-nav">
        <span>
          <a class="about-back" href="/" onClick={onLinkClick}>
            <span class="marker">←</span> back to play
          </a>
          <Show when={props.playing}>
            <span class="still-playing"> · still playing</span>
          </Show>
        </span>
        <a class="about-close" href="/" aria-label="close" onClick={onLinkClick}>
          ×
        </a>
      </nav>
      {/* eslint-disable-next-line solid/no-innerhtml -- our own credits: constants and a commit hash */}
      <article class="about-credits blog" innerHTML={credits} />
    </section>
  );
}
