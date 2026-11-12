# Looper strip: legal sanity check

Date: 2026-11-12. Status: desk research by a non-lawyer agent. **This is not legal advice** and it is not a freedom-to-operate opinion.

## The question

The looper reimplements the behaviour of the touch-strip looper on a commercial hardware drum machine, called here "the reference hardware" (its manufacturer also uses the same strip on a related sequencer). While a finger is held on the strip, a slice of the running pattern repeats from the moment of touch. The slice is 1/4, 1/8, 1/16 or 1/32, chosen by finger position, and sliding changes it. On release, playback jumps to where it would have been without the loop. Nothing is copied: no code, samples, graphics, manual text or product names. Rimbalzello is free, GPL-3.0, browser-based, and the developer is in Switzerland.

## Short answer

Reimplementing this behaviour from scratch looks low risk in Switzerland, the EU and the US.

- **Copyright** protects expression (code, text, artwork, sounds), not functionality or a method of operation.
- **Patents** are the only right that could cover pure behaviour. The behaviour has been public in DJ mixers, DJ software and DAW effects since at least the mid-2000s, which leaves little room for a valid live patent on the basic mechanism. I found no patent by the reference hardware's manufacturer on it.
- **Unfair competition** and **trademark** risk is negligible as long as names, look and trade dress are not imitated.

The remaining uncertainty is a narrow, implementation-specific patent claim that my search missed. That risk applies to almost any software feature.

## 1. Copyright: behaviour is free, expression is not

### EU

- **Software Directive 2009/24/EC, Art. 1(2):** protection "shall apply to the expression in any form of a computer program. Ideas and principles which underlie any element of a computer program, including those which underlie its interfaces, are not protected by copyright." Recital 11 says the same about logic, algorithms and programming languages.
- **CJEU C-406/10, *SAS Institute v World Programming* (Grand Chamber, 2 May 2012):** neither a program's functionality, nor its programming language, nor its data file formats is a form of expression, so none is protected. A competitor may reproduce the functionality without access to the source code. The court added two caveats: copying the *code* that implements the functionality infringes, and reproducing substantial parts of a *user manual* can infringe if those parts are their author's own intellectual creation. The English High Court and Court of Appeal applied this in 2013.
- **CJEU C-393/09, *BSA* (2010):** a graphical user interface is not a "computer program" under the Directive, but it can be protected as an ordinary work if it is original. So the screen look and artwork can be protected even though the behaviour is not.
- **Art. 5(3):** a lawful user may observe, study and test a program to find the ideas and principles behind it. Studying how the reference hardware behaves is therefore fine.

### Switzerland

- **URG Art. 2(1) and 2(3):** a work is an intellectual creation with individual character, and computer programs are protected as works. Like the EU and the US, Swiss doctrine and practice hold that ideas, principles, algorithms and functionality are not protected; only the concrete expression is. The URG has no express "ideas" exclusion; the rule follows from the individual-character requirement and from consistent doctrine. Swiss courts and authors treat the EU Directive and *SAS* as persuasive. (Sources: IGE explanatory material on the URG; Swiss practitioner summaries; netzwoche.ch reporting on *SAS*.)

### US

- **17 U.S.C. §102(b):** "In no case does copyright protection ... extend to any idea, procedure, process, system, method of operation, concept, principle, or discovery ..."
- **Lotus v. Borland, 49 F.3d 807 (1st Cir. 1995)**, affirmed by an equally divided Supreme Court in 1996: a menu command hierarchy is an uncopyrightable "method of operation". A press-and-hold, slide-to-resize, release-to-resume gesture is a textbook method of operation.
- **Google v. Oracle, 593 U.S. 1 (2021):** decided on fair use and expressly declined to rule on whether API declarations are copyrightable, so it adds nothing against reimplementing behaviour. It concerned copying actual declaring code; here nothing is copied.

### Where the line is

| Free to reimplement | Not free to copy |
|---|---|
| Hold to loop, position chooses 1/4 to 1/32, slide to resize, release resumes the "shadow" position | Firmware or source code, even translated |
| Quantising loop start and size to musical divisions | Manual text, diagrams, help copy beyond short functional phrases |
| Generic labels for divisions ("1/8", "1/16") | Panel artwork, icons, distinctive layout and graphics, photos |
| Describing the feature in your own words | Factory samples, kits and patterns |

One practical point: the repo's design notes should describe the behaviour in their own words, not paste manual passages. That is already the plan.

## 2. Patents

### Search done

- **Google Patents, assignee search on the manufacturer:** a single result, a Chinese utility model (CN209433848U, priority 2018-07-30) for an instrument keyboard, with family members in JP, DE and FR. It has nothing to do with a looper. A free-text search on the manufacturer's name hit rate limits (HTTP 503), so the assignee search is the main evidence. Patents filed under subsidiaries or inventor names could be missed.
- **Google Patents, full-text search in G10H** for "loop roll", "beat repeat", "slip mode" and "roll function", plus a G11B search for slip/loop/background playback position: 10 G10H hits, none claiming the strip looper as such. The relevant ones:
  - **US11488568B2** (Algoriddim, priority 2020-03-06, active, expected expiry 2040). The description mentions "a loop roll or slip loop effect", which it defines exactly like this looper's release behaviour. Claim 1, however, requires *decomposing mixed audio into timbre (stem) tracks* and applying the transport control to one stem. Rimbalzello sequences discrete drum voices and does no source separation, so it falls outside this claim. Note, though, that the patent's own description presents slip loop as a known, standard effect.
  - **US11023028B2** (inMusic, priority 2017): waveform *display* during slip-style playback. Google lists it as "Expired - Fee Related". Not relevant.
  - **JPH10319961A** (Yamaha, 1997): a "roll function" flag for sounding timing. It is old, and any patent from it has long expired.
- **Not done:** an Espacenet or Swissreg search, claim-by-claim review, or a search in the CN, JP or KR databases. A professional FTO search would cover these.

### Prior art: the behaviour is old and public

- **Note repeat on pads:** drum machines and samplers since the late 1980s, for example the Akai MPC60's note repeat (1988), which retriggers at a chosen division while held.
- **DJ mixer "Roll" effect:** Pioneer DJM-800 (mid-2000s) and the earlier DJM-600 had beat-synced Roll and Reverse Roll at divisions from 1/16 to 16/1 beats, captured and repeated while the effect is engaged.
- **Ableton Live 5 Beat Repeat** (released July 2005): captures and repeats slices of the stream at rhythmic intervals.
- **Serato "Slip mode":** present in Scratch Live by 2011, since the 2.3 release notes of 11 August 2011 fix existing Slip-mode bugs. The playhead keeps running in the background and playback resumes there afterwards.
- **Native Instruments Traktor "Flux mode":** Kontrol Z2 and Traktor Pro 2.6 (October 2012). Loops and cue jumps run while the track position keeps advancing, and playback resumes there.
- **Pioneer DJ controllers and players:** slip loop, slip roll and "loop roll" on pads. Their manuals state that normal playback continues in the background during the loop and resumes from where it would have reached.
- **Other public examples:** VirtualDJ and djay "loop roll"/"slip" (djay's docs: playback snaps back to the exact position it would have reached), the Korg Kaoss Pad and Electribe roll/repeat features, Roland's TR-8 Scatter (2014), the Teenage Engineering Pocket Operator punch-in loop effects (2015), iZotope Stutter Edit (2011) and Sugar Bytes Effectrix.
- **The reference hardware itself:** its manufacturer shipped this strip on its sequencer around 2015 and on the drum machine in 2017/2018. A European patent has no grace period, so any later filing on the feature would be anticipated by the manufacturer's own product, and the US one-year grace period has long passed.

### Assessment

- **Basic mechanism** (hold to repeat a beat-quantised slice, size by position, resume at the shadow position): roughly 20 years of public prior art. Any patent filed early enough to predate the prior art has expired (20-year term), and anything later could not validly claim the basic mechanism.
- **What could still exist:** narrow claims tied to particular hardware, for example a specific sensor arrangement, stem separation (as in the Algoriddim patent) or a specific display. A browser app with a pointer or touch strip and no stem separation is unlikely to fall inside those.
- **Territoriality:** a patent bites only where it is in force. For Switzerland that means a CH national patent or a European patent validated for CH/LI (the Unitary Patent does not cover Switzerland). EU coverage is by European or national patents. US coverage needs a US patent. EPC Art. 52(2)(c) and (3) exclude programs "as such", and in the US *Alice* (2014) limits abstract-idea claims. Both cut against broad software claims on a loop gesture, but neither is a guarantee.
- **Practical exposure** for a free GPL project: low. Enforcing patents against a non-commercial open-source browser project is rare. A rights holder would be more likely to target a commercial distributor, for example a paid app-store wrapper.

## 3. Unfair competition (Swiss UWG) and trade dress

- **Freedom to imitate (*Nachahmungsfreiheit*):** this is the Swiss starting point. Anything not covered by a special IP right may in principle be imitated. The UWG only steps in for unfair *manner*.
- **UWG Art. 3(1)(d):** creating confusion with another's goods, works or business. This needs a likelihood of confusion, which would require using their name, look, layout or other distinctive presentation. A generic strip, an original visual design and no reference to the product leave no foothold. A purely technical or functional form is not protected as get-up anyway.
- **UWG Art. 5(c):** taking over another's *market-ready work result* "by technical reproduction processes, without reasonable own effort" (BGE 118 II 459; BGE 131 III 384 holds that Art. 5(c) covers direct takeover, not imitation). Writing your own code from a description of the behaviour is the opposite of direct technical reproduction, so this does not apply.
- **UWG Art. 2 (general clause):** systematic, parasitic imitation could fall here only with aggravating circumstances such as deliberate passing-off or exploiting another's reputation. These are absent if the product is not named or evoked.
- **US trade dress:** functional features cannot be trade dress (*TrafFix Devices v. Marketing Displays*, 532 U.S. 23 (2001)). EU design law likewise excludes appearance features dictated solely by technical function (Community Design Regulation Art. 8(1); Swiss DesG Art. 4(c)).
- **Watch-out:** saying "works like [product]" in marketing could support a confusion or reputation-exploitation argument and raises trademark issues. Plain factual comparative statements are usually allowed, but the owner has chosen not to name the product, which removes the issue.

## 4. The manufacturer's terms, EULA and manual

- **What I found:** the manufacturer's software EULAs, as printed in its plug-in and controller manuals, restrict the *licensee* (no modification, reverse engineering or copying of the *software*). The manuals carry the usual copyright notice and say the software is supplied under a licence agreement.
- **What I did not find:** any term in its product terms, manuals or website that purports to forbid third parties from implementing similar features. I did not read every current website terms page, so this is not exhaustive.
- **Why it would not matter much:** contracts bind only the parties. A EULA or shrink-wrap term binds a buyer, at most, and not a developer who never accepted it.
- **If the developer owns the hardware:** observing its behaviour as a user is permitted in the EU and Switzerland whatever a licence says. Software Directive Art. 5(3) and Art. 8 make contrary clauses void, and the URG has a comparable rule in Art. 21 for interoperability decompilation. Rimbalzello needs no decompilation; watching and listening is enough. Do not disassemble or extract the firmware.
- **Website terms of use:** these typically govern use of the site and its content (no copying of text or images). Not copying manual text or images already respects them.

## 5. Trademarks

- **Not using the manufacturer's or product names** in the app, UI, repo, store listings or marketing removes the main trademark risk. The owner's no-names rule in this repo goes further than the law requires (descriptive, nominative references are often permitted), and that is fine.
- **"Looper"** is in wide generic use for a device or feature that records and repeats audio. Retailers use it as a product category. Several "LOOPER"-*formative* marks exist or were filed, for example LOOPER + (Ed Sheeran Ltd, pedals) and BOOMERANG LOOPER. Those protect the composite marks, not the generic word, and a descriptive feature label inside an app is not trademark use as a brand.
- **"Roller"** (roll, note repeat) is a descriptive music term. I did not run a register search for it.
- **Recommendation:** label the feature descriptively ("loop", "repeat", "roll", "stutter"), or use the project's own term ("strip" or whatever CONTEXT.md settles on), and avoid copying any stylised combination the reference hardware prints on its panel. If Rimbalzello itself is ever to be registered or sold, run a proper search on the *project* name in Swissreg, EUIPO and USPTO. That is separate from this feature.

## Conclusion and uncertainty

- **Copyright:** the behaviour is free in CH, EU and US. Confidence is high, provided no code, manual text, graphics or samples are copied. Keep the spec in the project's own words.
- **Patents:** I found no live patent plausibly covering a beat-quantised hold-to-repeat strip with resume at the shadow position. Two decades of public prior art make a valid broad claim unlikely. Confidence is medium-high: the search was a quick, non-exhaustive Google Patents pass with incomplete coverage (no Espacenet, Swissreg, CN or JP review, no claim charts).
- **UWG and trade dress:** low risk if names and look are not imitated.
- **Product terms:** no relevant restriction found, and none would bind a non-party.
- **Trademarks:** avoiding the names suffices. "Looper" and "roller" are descriptive.

**Residual risk:** an unknown narrow patent. If Rimbalzello ever becomes commercial (paid app, hardware, or a company distributing it), a short professional FTO search by a Swiss or European patent attorney is the proportionate step. For a free GPL browser project, the current plan is reasonable.

## Sources

- Directive 2009/24/EC (Software Directive), Art. 1(2), 5(3), 8, recital 11: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009L0024
- CJEU C-406/10 *SAS Institute v World Programming*: https://curia.europa.eu/juris/liste.jsf?num=C-406/10 ; summaries: https://en.wikipedia.org/wiki/SAS_Institute_Inc_v_World_Programming_Ltd , https://www.scl.org/2436-sas-v-wpl-no-copyright-says-ecj/ , https://www.scl.org/2964-no-copyright-in-software-functionality-sas-v-wpl-final-chapter/
- CJEU C-393/09 *BSA* (GUI): https://curia.europa.eu/juris/liste.jsf?num=C-393/09
- Swiss URG (SR 231.1): https://www.fedlex.admin.ch/eli/cc/1993/1798_1798_1798/de ; netzwoche on *SAS*: https://www.netzwoche.ch/news/2014-01-31/programmiersprachen-und-software-funktionen-nicht-urheberrechtlich-geschuetzt ; law.ch on software copyright: https://law.ch/lawinfo/ict-law-informations-und-kommunikationstechnologie/software/software-urheberrecht/
- Swiss UWG (SR 241): https://www.fedlex.admin.ch/eli/cc/1988/223_223_223/de ; BGE 118 II 459: https://justement.ch/ref/118+II+459 ; BGE 131 III 384: https://datenrecht.ch/en/bge-131-iii-384-schutz-von-datenbanken-nach-uwg-5-lit-c-such-spider/
- 17 U.S.C. §102(b): https://www.law.cornell.edu/uscode/text/17/102 ; *Lotus v. Borland*: https://en.wikipedia.org/wiki/Lotus_Dev._Corp._v._Borland_Int%27l,_Inc. ; *Google v. Oracle* (2021): https://www.supremecourt.gov/opinions/20pdf/18-956_d18f.pdf ; *TrafFix* (2001): https://www.law.cornell.edu/supct/html/99-1571.ZS.html
- US11488568B2 (Algoriddim, slip loop in stems context): https://patents.google.com/patent/US11488568B2/en
- US11023028B2 (inMusic, slip waveform display): https://patents.google.com/patent/US11023028B2/en
- JPH10319961A (Yamaha roll function): https://patents.google.com/patent/JPH10319961A/en
- Ableton Live 5 / Beat Repeat (July 2005): https://www.ableton.com/en/pages/press/releases/2005_07_22/
- Serato Scratch Live 2.3 release notes (Aug 2011, Slip mode fixes): https://serato.com/scratchlive/downloads/2.3.0/releasenotes
- Traktor Flux mode (Traktor Pro 2.6, Oct 2012): https://djtechtools.com/2012/10/25/traktor-pro-2-6-released-available-for-download , https://djtechtools.com/2013/08/30/three-flux-mode-tricks-for-playing-traktor-like-an-instrument/
- Pioneer DJM-800 manual, Roll beat effect: https://www.manualsdir.com/manuals/485644/pioneer-djm-800.html?page=14
- Pioneer DDJ-SZ manual, slip mode description: https://www.manualslib.com/manual/878738/Pioneer-Ddj-Sz.html?page=18
- djay slip mode: https://help.algoriddim.com/user-manual/djay-pro-windows/dj-tools/cueing-looping/slip-mode
- Mixxx slip-mode feature request (open-source precedent): https://bugs.launchpad.net/mixxx/+bug/703585
- "Looper" marks: https://trademarks.justia.com/854/53/loooper-85453911.html , https://trademark.justia.com/905/94/boomerang-90594145.html
