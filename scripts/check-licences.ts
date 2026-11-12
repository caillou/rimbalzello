// Checks every installed dependency against the licence rule in README.md:
// permissive, LGPL or GPL-3-compatible licences only. Anything not on the
// allow list fails, including GPL-2.0-only, unknown, unlicensed and
// non-commercial licences. Add an id here only after checking that it fits
// the rule.

import { execFileSync } from 'node:child_process';

const allowed = new Set([
  // Permissive
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MIT-0',
  'Python-2.0',
  'Unlicense',
  'Zlib',
  // Fonts
  'OFL-1.1',
  // Weak copyleft that can be combined with GPL-3.0
  'MPL-2.0',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  // GPL-3.0, or a GPL that lets us pick 3.0
  'GPL-2.0-or-later',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
]);

// Deprecated SPDX ids still found in package.json files.
const aliases: Record<string, string> = {
  'GPL-2.0+': 'GPL-2.0-or-later',
  'GPL-3.0': 'GPL-3.0-only',
  'GPL-3.0+': 'GPL-3.0-or-later',
  'LGPL-2.1': 'LGPL-2.1-only',
  'LGPL-2.1+': 'LGPL-2.1-or-later',
  'LGPL-3.0': 'LGPL-3.0-only',
  'LGPL-3.0+': 'LGPL-3.0-or-later',
};

/** Evaluates an SPDX expression: OR needs one allowed side, AND needs both. */
function isAllowed(expression: string): boolean {
  const tokens = expression.replace(/[()]/g, ' $& ').trim().split(/\s+/);
  let position = 0;
  const peek = () => tokens[position]?.toUpperCase();

  function either(): boolean {
    let result = both();
    while (peek() === 'OR') {
      position++;
      const right = both();
      result = result || right;
    }
    return result;
  }

  function both(): boolean {
    let result = single();
    while (peek() === 'AND') {
      position++;
      const right = single();
      result = result && right;
    }
    return result;
  }

  function single(): boolean {
    const token = tokens[position++];
    if (token === '(') {
      const result = either();
      if (tokens[position++] !== ')') return false;
      return result;
    }
    if (token === undefined) return false;
    // An exception such as "WITH LLVM-exception" only adds permissions.
    if (peek() === 'WITH') position += 2;
    const id = aliases[token] ?? token;
    return allowed.has(id);
  }

  const result = either();
  return result && position === tokens.length;
}

interface Package {
  name: string;
  versions: string[];
  license: string;
}

const output = execFileSync('pnpm', ['licenses', 'list', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const byLicence = JSON.parse(output) as Record<string, Package[]>;
const packages = Object.values(byLicence).flat();

const rejected = packages.filter((pkg) => !isAllowed(pkg.license));
for (const pkg of rejected) {
  console.error(`${pkg.name}@${pkg.versions.join(', ')}: ${pkg.license}`);
}

if (rejected.length > 0) {
  console.error(`\n${rejected.length} package(s) break the licence rule.`);
  process.exit(1);
}
console.log(`${packages.length} packages checked, all licences allowed.`);
