# Licence research: can rimbalzello be permissive instead of GPL-3.0?

Date: 2026-11-12. Not legal advice. Sources checked on this date.

## Short answer

Not while it ships the Grids drum map copied byte for byte, unless Émilie Gillet gives permission. The Peaks side is no problem: Peaks is MIT. The realistic ways to get to permissive are (b) ask her for the map under MIT, or (c) build an own map. (d), a split with a GPL data file, keeps your own code reusable under MIT, but the app as published stays GPL-3.0 in practice.

## 1. Licences upstream (pichenettes/eurorack)

- README, "License" section: "Code (AVR projects): GPL3.0. Code (STM32F projects): MIT license. Hardware: cc-by-sa-3.0". https://github.com/pichenettes/eurorack#license
- The repo has no top-level LICENSE file (GitHub API reports `license: null`), so the README and the file headers are what count.
- Grids (AVR): every file carries a GPL-3.0-or-later header, "Copyright 2011/2012 Emilie Gillet".
  - `grids/resources.cc` (the drum map, `node_0` to `node_24`): GPL-3.0-or-later. It says "Automatically generated with: make resources". https://github.com/pichenettes/eurorack/blob/master/grids/resources.cc
  - The map's real source is `grids/resources/lookup_tables.py` (`nodes = [...]`), also GPL-3.0-or-later. https://github.com/pichenettes/eurorack/blob/master/grids/resources/lookup_tables.py
  - `grids/pattern_generator.cc`: GPL-3.0-or-later.
  - `lut_res_euclidean` in the same `resources.cc` is GPL as well. It can be computed from scratch (Bjorklund), so regenerate it rather than copy it.
- The official docs say "Grids' source code is available under the GPL licence." https://pichenettes.github.io/mutable-instruments-documentation/modules/grids/open_source/
- Peaks (STM32): `peaks/drums/bass_drum.cc`, `snare_drum.cc` and `high_hat.cc` all carry MIT headers ("Copyright 2013 Emilie Gillet"). https://github.com/pichenettes/eurorack/tree/master/peaks/drums
- Authorship: the commit history of `grids/resources/lookup_tables.py` shows only Émilie Gillet (first release 2013-08-26, then a 2019 name update). She looks like the sole copyright holder, so she alone can relicense it.
- How the map was made, per the manual: "obtained through machine learning techniques" from "the drum patterns used in a large collection of electronic music tracks and drum loops ... spatially organized and compressed into a 2-dimensional map." https://pichenettes.github.io/mutable-instruments-documentation/modules/grids/manual/

## 2. Statements by Émilie Gillet

- I found no statement that Grids code or the drum map may be used under other terms, and no AVR project that was relicensed. The README's license section has been unchanged in substance since 2013 (the last edit, 2026-10-12, only added a Beads footnote).
- She does answer GitHub issues, and fast:
  - Issue #41: a stray GPL header in an MIT project (Braids `envelope.h`) was fixed to MIT. That only corrected an STM32 file to the stated MIT; it is not an AVR relicence. https://github.com/pichenettes/eurorack/issues/41
  - Issue #35: Surge asked to embed Clouds and Plaits. She replied "No objection or concern", suggested generic names, and approved "Nimbus" and "Twist". This is the precedent for asking. https://github.com/pichenettes/eurorack/issues/35
- I did not search the Mutable forum archive exhaustively, so a statement there cannot be ruled out.

## 3. Derivative works and their licences

GitHub code search for the first bytes of `node_0` (`255, 0, 0, 0, 0, 0, 145, 0`) finds the map in many repos.

| Project | Licence | How the map is handled |
|---|---|---|
| VCV Audible Instruments | GPL-3.0 (panel graphics "used with permission") | Vendors eurorack as a submodule. https://github.com/VCVRack/AudibleInstruments |
| Valley Topograph (ValleyRackFree) | GPL-3.0 | Grids port |
| sc-grids, Pd-Grids, NanoGris, Gris, Griddy, drumgen, cyrene (norns), faderpunk, ChoralRootFM1, elixir, phasorbeatgen, mutadrums | GPL-3.0 | Copied map |
| shoreline | AGPL-3.0 | Copied map |
| dexterlabs1/openpatch | Repo MIT, map file headed "Copyright 2011 Emilie Gillet. GPL-3.0-or-later" | README: "Original OpenPatch code is MIT licensed. The distributed app also includes GPL code and is provided under GPL-3.0-or-later." This is the split model done properly. https://github.com/dexterlabs1/openpatch |
| modulove/MOD1 | Repo CC0, but `gridz/lookup_tables.py` keeps the GPL header | Mixed; the file stays GPL |
| stellar-aria/gridulizer | MIT | Copies the map into `nodes.js` with no GPL notice. Looks like an oversight, not a basis. |
| tomhazledine/Grids-for-Droid, TomWhitwell/Workshop_Computer (Grids card), GLITCHSTORM_MK2, designerzen/audiobus, schollz/grids-jack | No licence file | Copied map |

Conclusion: no permissively licensed project I found includes the map on a stated legal basis or with permission. The serious ones are GPL, or keep the map GPL inside a mixed repo (openpatch, MOD1). The permissive or unlicensed copies show no reasoning and look like they ignored the question.

## 4. Is the drum map copyrightable? (Sober summary, not legal advice)

- The map is 25 × 96 bytes (32 steps × 3 instruments × level 0–255), produced by ML clustering of drum loops and probably curated by hand.
- **US:** Feist says facts are not protected, but these are not facts about the world: they are values the author chose or generated. Numbers that come from creative judgment have sometimes been protected (CDN v. Kapes), and sometimes not (Southco v. Kanebridge). The US Copyright Office does not protect purely machine-generated output, so the degree of human curation matters, and that is unknown. Verbatim copying from a GPL source file is also copying part of a licensed program's source.
- **EU:** Copyright in a database or work needs free creative choices (Football Dataco, C-604/10). The sui generis database right protects investment in *obtaining* data, not in *creating* it (BHB v. William Hill, C-203/02). Generated values like these are a weak fit for the database right, but they might still count as part of the program's expression.
- **Switzerland:** URG art. 2 protects works with individual character, and computer programs explicitly. There is no sui generis database right.
- **Net:** it is genuinely uncertain whether the bare numbers are protected. Courts treat a verbatim 2,400-value table lifted from a GPL file conservatively. Betting a published project's licence on "the data is not copyrightable" is the weakest position, and it would also go against the author's clear wish that Grids be GPL. Treat the map as GPL-3.0.
- **Algorithm:** ideas and methods (bilinear interpolation between nodes, density thresholds, chaos perturbation, accent bits) are not protected. A TypeScript implementation written from your own understanding is your own code. A close line-by-line translation of `pattern_generator.cc` would be a derivative work. Since an earlier prototype compiled the C++, keep the TS port honestly independent and don't mirror its structure function by function.

## 5. Options

| Option | Licence result | Pros | Cons |
|---|---|---|---|
| (a) GPL-3.0-or-later for everything (current PRD) | GPL | Zero legal doubt. Matches upstream wishes and the whole ecosystem. Static site: the source repo link covers the source obligation. | Others cannot reuse your code permissively. |
| (b) Ask Émilie for permission to use the map (and optionally the euclidean table) under MIT | MIT | Her code, her call, and she is the sole holder. Precedent (#35) shows she answers and is generous. A short issue or email covers it. | Could be "no" or no answer. Then fall back to (a) or (c). Keep her answer in the repo (link to the issue). |
| (c) Own map | MIT | Fully yours. Possible method: build a corpus of your own or public-domain drum patterns (or program 25 grooves by hand), cluster them onto a 5×5 grid (SOM or k-means plus layout by similarity), quantise to 0–255 levels per step, with the backbone hits highest. The Grids feel comes mostly from the mechanism (2D morph plus per-channel density threshold plus chaos), which you keep. | Real work, and the grooves will differ: Grids' specific musical character is in its data. The result needs tuning by ear. Do not "derive" it by perturbing Grids' numbers: that is still a derivative. |
| (d) Split: app code MIT, map as a separate GPL-3.0 data file (`grids-map.json`) | Source files MIT, but the published app is effectively GPL | Your original files are reusable under MIT (the openpatch model). An app that reads a data file is arguably not a derivative of that file. | Does not give a permissive app. The site you distribute bundles both, so the bundle must comply with GPL (offer the map's source and licence, which is easy). Whether the JS that embeds or fetches the map is "based on" it is debatable, especially if the map is bundled into the JS. Honest labelling: "code MIT, distribution includes GPL data, overall GPL-3.0-or-later". Little practical gain over (a) for a personal app. |
| (e1) Ship your own default map MIT, with the Grids map as an optional, separately distributed GPL "map pack" (separate repo or URL, loaded at runtime or by user choice) | Core MIT. Map pack GPL. | The core is truly permissive, and Grids fidelity is still available. | Two artefacts to maintain. The hosted site that offers the pack is still distributing GPL data, which is fine but not "pure MIT". More complex than the PRD needs. |
| (e2) Dual-license your own code as MIT OR GPL-3.0 | Ships as GPL now; original code reusable as MIT | Cheap. Future-proof if (b) or (c) lands later. | Needs clear per-file headers. |

**Recommendation:** do (b) now: one short GitHub issue on pichenettes/eurorack asking to use the Grids drum map in a browser drum machine under MIT, with credit and no Mutable or Grids name. Release v1 under (a) GPL-3.0-or-later (or (e2): your original files headed MIT, the map file GPL, the combined app GPL, as openpatch does), so nothing waits on her. If she says yes, switch to MIT. If she says no, or later wants full independence, go to (c) and keep the old map as an opt-in GPL pack (e1). Do not rely on the "data is not copyrightable" argument.

Side notes:

- Peaks voices modelled on structure and parameter names need no licence at all. If you copy Peaks code or tables (e.g. a later AudioWorklet port), keep its MIT notice. That is compatible with both GPL and MIT.
- Regenerate `lut_res_euclidean` instead of copying it.

## 6. Trademark and naming (README "Guidelines for derivative works")

- "Mutable Instruments is a registered trademark."
- "The name 'Mutable Instruments' should not be used on any of the derivative works you create from these files."
- "We do not recommend you to keep the original name of the Mutable Instruments module for your derivative works." Example: "Foobar Modular - Particle Generator".
- In #35 she accepted crediting her in an about page and generic or evocative names.

The PRD already complies: the product is named "rimbalzello", the about page credits Grids, Peaks and Émilie Gillet, and it carries a not-affiliated note. Credit by name in the about text is fine. Don't use "Grids" or "Mutable" in the product name, the domain or the app title.

## Uncertainty

- The copyright status of the bare map values is unsettled law in the US, the EU and Switzerland, and depends on unknown facts (how much human curation went in).
- Whether a JS bundle that fetches a GPL JSON at runtime is a GPL derivative is debatable. Bundling the data into the code makes the derivative argument stronger.
- I may have missed a statement by Émilie on the Mutable forum archive or in interviews. None turned up in web or GitHub issue searches.
- None of this is legal advice. If the licence matters commercially, ask a lawyer, or just get her written permission.
