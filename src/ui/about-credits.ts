// The credits in the about view, as HTML (design.md, About). One source for
// both places they appear: vite.config.ts prerenders them into
// about/index.html, so /about/ shows them before any JavaScript runs, and the
// about view in the app renders the same HTML. Free of imports, so
// vite.config.ts can load it.

export interface CreditsBuild {
  /** The commit the site was built from. */
  commitHash: string;
  repositoryUrl: string;
  /** The path the site is served under, with both slashes: '/' or '/rimbalzello/'. */
  basePath: string;
}

const COMMIT = /^[0-9a-f]{7,40}$/;

const GRIDS = 'https://github.com/pichenettes/eurorack/tree/master/grids';
const PEAKS = 'https://github.com/pichenettes/eurorack/tree/master/peaks';
const EMILIE_GILLET = 'https://github.com/pichenettes';
const CAILLOU = 'https://caillou.ch';

/**
 * A blog-style link in grey brackets. External pages open in a new tab, so a
 * player reading the credits keeps the music playing.
 */
function link(href: string, text: string): string {
  return (
    '<span class="blog-link">' +
    '<span class="marker" aria-hidden="true">[</span>' +
    `<a href="${href}" target="_blank" rel="noopener">${text}</a>` +
    '<span class="marker" aria-hidden="true">]</span>' +
    '</span>'
  );
}

/** The credits: what the app is, what it is made from, who made it, its licence and source. */
export function creditsHtml({ commitHash, repositoryUrl, basePath }: CreditsBuild): string {
  // A build without git history links to the repository instead of a commit.
  const source = COMMIT.test(commitHash)
    ? link(`${repositoryUrl}/tree/${commitHash}`, `source at ${commitHash.slice(0, 7)}`)
    : link(repositoryUrl, 'source');

  return `
<h1><span class="marker">#</span> rimbalzello</h1>
<p>a drum machine you play by moving through a map. skip a stone, watch it bounce.</p>
<h2><span class="marker">##</span> made from</h2>
<p>the pattern generator is based on ${link(GRIDS, 'Grids')}, the topographic drum sequencer by ${link(EMILIE_GILLET, 'Émilie Gillet')}.</p>
<p>the drum voices follow ${link(PEAKS, 'Peaks')}, also by Émilie.</p>
<h2><span class="marker">##</span> made by</h2>
<p>Pierre Spring ${link(CAILLOU, 'caillou.ch')}</p>
<h2><span class="marker">##</span> licence</h2>
<p>GPL-3.0-or-later, like Grids.</p>
<p>read the ${source} and the ${link(`${basePath}third-party-notices.txt`, 'third-party notices')}.</p>
<footer class="about-footer">
  <a href="${repositoryUrl}" target="_blank" rel="noopener" aria-label="source">// source</a>
  <a href="${CAILLOU}" target="_blank" rel="noopener" aria-label="caillou.ch">// caillou.ch</a>
</footer>
<p class="about-note">not affiliated with Mutable Instruments. "Mutable Instruments" is a registered trademark.</p>
`;
}
