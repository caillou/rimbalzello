# Handover: Grids + Peaks drums → web version

From a session with Pierre (2026-11-12). The dream is a dedicated drum machine: Mutable Instruments **Grids**
(topographic drum sequencer) driving three **Peaks** drum algorithms (analog BD, SD, HH). The first target
looked at was the M-VAVE FM-1 (a hackable €60 synth); Pierre now wants a **web version**.

## Bottom line

The combination already works off-hardware. I built Grids' pattern generator and Peaks' BD/SD/HH together
as plain C++ on Linux, with Grids' and Peaks' own source unchanged (only small shims), and rendered demo
WAVs that sound right. About 21 KB of code+tables, a few hundred bytes of state, integer-only DSP, and it
renders ~550× faster than real time on x86. A browser has a huge margin.

## Sources

- Mutable eurorack repo: https://github.com/pichenettes/eurorack (Grids in `grids/`, Peaks in `peaks/`)
- stmlib: https://github.com/pichenettes/stmlib (Peaks needs `stmlib/stmlib.h`, `utils/dsp.h`,
  `utils/random.h`, `utils/random.cc`)
- Licences: Grids is **GPL-3.0-or-later**, Peaks is **MIT**. A web app that ships Grids code must be GPL-3
  with source available.

## Files needed

Grids: `grids/pattern_generator.{h,cc}`, `grids/resources.{h,cc}` (the drum map `node_0..24`, 96 bytes
each, and `lut_res_euclidean`).

Peaks: `peaks/drums/{bass_drum,snare_drum,high_hat}.{h,cc}`, `peaks/drums/{excitation,svf}.h`,
`peaks/gate_processor.h` (GateFlags, ControlMode), `peaks/resources.{h,cc}`. The drums only use
`lut_env_expo, lut_env_increments, lut_oscillator_increments, lut_svf_cutoff, lut_svf_damp, wav_sine,
wav_overdrive`; `peaks/resources.cc` is 376 KB of source, so emitting only those 7 tables is worth it.

## Shims (put the shim dir first on the include path)

Grids includes AVR headers; the generator only needs these:

- `avrlib/base.h`: `<stdint.h>`, `DISALLOW_COPY_AND_ASSIGN(T)`, include `avr/pgmspace.h`.
- `avr/pgmspace.h`: `#define PROGMEM` (empty); `typedef char prog_char;` plus `prog_uint8_t / 16 / 32`
  as plain ints; `pgm_read_byte/word/dword(p)` as plain pointer reads.
- `avr/eeprom.h`: `eeprom_read_byte()` returns `0xFF`, `eeprom_write_byte()` does nothing. 0xFF unpacks to
  **drums mode, trigger outputs, swing off**, which is what we want.
- `avrlib/op.h` (namespace avrlib):
  - `U8U8Mul(a,b) = (uint16_t)a*b`
  - `U8U8MulShift8(a,b) = a*b >> 8`
  - `U8Mix(a,b,x) = (a*(255-x) + b*x) >> 8`
- `avrlib/random.h`: class `Random` with `static uint16_t rng_state_` and a Galois LFSR:
  `Update(){ s = (s>>1) ^ (-(s&1) & 0xb400); }`, `GetByte(){Update(); return s>>8;}`, plus `state()`,
  `Seed()` and `GetWord()`. Define `uint16_t avrlib::Random::rng_state_ = 0x21;` in one .cc file.
- `avrlib/resources_manager.h`: empty templates
  `template<class I,class T> struct ResourcesManager{};` and
  `template<const char* const* S, const unsigned short* const* L> struct ResourcesTables{};`.
- `grids/hardware_config.h` (replaces the real one, which pulls in GPIO/SPI/serial): include
  `avrlib/base.h` and `namespace grids { enum LedBits { LED_CLOCK=1, LED_BD=8, LED_SD=4, LED_HH=2, LED_ALL=15 }; }`.

Build line that worked:
`g++ -std=c++11 -O2 -Ishim -I<eurorack> -I<parent of stmlib> main.cc grids/pattern_generator.cc
grids/resources.cc peaks/drums/{bass_drum,snare_drum,high_hat}.cc peaks/resources.cc stmlib/utils/random.cc`

## How the glue works

```cpp
using namespace grids;
pattern_generator.Init();                       // LoadSettings (shimmed eeprom) + Reset
auto* s = pattern_generator.mutable_settings();
s->options.drums.x = 0..255; s->options.drums.y = 0..255; s->options.drums.randomness = 0..255;
s->density[0..2] = 0..255;                      // BD, SD, HH fill

// Once per step (a 32nd note: Grids runs 24 ppqn, 3 pulses per step): TickClock(3) (kPulsesPerStep = 3). It evaluates the CURRENT step, then advances.
pattern_generator.TickClock(3);
uint8_t st = pattern_generator.state();         // bit0 BD, bit1 SD, bit2 HH; bits 3-5 accents
                                                // (level > 192); bit 6 always set, bit 7 random
// 32 steps per pattern. Randomness (chaos) is re-rolled at step 0 per part.
```

Peaks drums: `Init()`, then `Configure(uint16_t p[4], peaks::CONTROL_MODE_FULL)`:

| Drum | p[0] | p[1] | p[2] | p[3] |
| --- | --- | --- | --- | --- |
| BD | frequency (32768 = centre) | punch | tone | decay |
| SD | frequency | tone | snappy | decay |

HH has no parameters. Values used for the demos: BD `{32768, 40000, 30000, 38000}`,
SD `{32768, 32768, 36000, 30000}`.

`Process(const GateFlags* gates, int16_t* out, size_t n)` gives mono int16. On a hit frame, pass
`GATE_FLAG_RISING | GATE_FLAG_HIGH`; otherwise `GATE_FLAG_HIGH` or `GATE_FLAG_LOW`. The drums trigger on
RISING. Mix used: `bd*11>>4 + sd*9>>4 + hh*7>>4`, then clip (`>>1` each clipped a little).

Demo settings, as x y bd sd hh bpm:

| Demo | x | y | bd | sd | hh | bpm |
| --- | --- | --- | --- | --- | --- | --- |
| centre | 128 | 128 | 160 | 128 | 200 | 120 |
| breaks | 30 | 220 | 200 | 170 | 230 | 128 |
| sparse | 220 | 40 | 140 | 110 | 150 | 104 |

## Sample rate (important for the web)

Peaks' tables and some constants assume **48 kHz**.

- **Web: create the AudioContext with `{ sampleRate: 48000 }`** and use the original tables and code
  unchanged. This is the simplest route.
- If you must run at 44.1 kHz (as on the FM-1), three things change:
  1. **Regenerate the 7 tables.** In `peaks/resources/lookup_tables.py`, set `sample_rate = 44100` (two
     places) and `44100 / 8` (one place). The stmlib `resources_compiler.py` is Python 2, so instead
     import `lookup_tables` / `waveforms` from Python 3 (with `builtins.xrange = range`,
     `builtins.file = open`) and emit the arrays yourself, using `int(v)` truncation. At 48 kHz this
     reproduced the shipped tables exactly, except `oscillator_increments`, which differs by 5 ppm.
  2. **Snare:** `set_delay(1e-3 * 48000)` becomes `44`.
  3. **Hi-hat** phase increments, ×48000/44100: 48318382→52591436, 71582788→77913239,
     37044092→40320100, 54313440→59116669, 66214079→72069746, 93952409→102261125.

  Even with these changes, the hats are slightly darker at 44.1 kHz because an SVF cutoff clamp is f ≤ fs/8.

## Suggested web architecture

- Compile the same C++ (with the shims) to **WASM with Emscripten**, and run it in an
  **AudioWorkletProcessor**.
  - Render 128-frame quanta; advance the Grids step (a 32nd note) from a sample counter for sample-accurate timing.
  - Export plain C functions: `init()`, `set_xy()`, `set_density(i, v)`, `set_chaos()`, `set_bpm()`,
    `set_drum_param(drum, idx, v)`, `render(ptr, n)`, plus `get_step()` / `get_state()` for the UI.
  - Pass parameters via port messages or a SharedArrayBuffer.
- A JS/TS port is also feasible: the code is small and integer-only. But WASM keeps it bit-identical to the
  hardware and is less work.
- UI ideas:
  - X/Y pad over the drum map, chaos knob, three density sliders, BPM, swing.
  - Per-drum tone/decay controls; a 32-step × 3 lane display lighting the current step; mutes.
  - Accent bits can drive velocity.
  - Possibly Web MIDI clock in/out.

## Not done

- Nothing exists for the web yet.
- The FM-1 port was not compiled for the chip (the JieLi toolchain download was blocked in that sandbox).
- The earlier prototype (`main.cc`, shims, 44.1 kHz tables, WAVs) lives in that session's cloud workspace
  `/root/grids-peaks/`, which you can't reach. Rebuild from the notes above; everything needed is here.
