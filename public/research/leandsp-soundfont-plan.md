# A LeanDSP sound font with composable parts

Status: proposal. Nothing here is built yet.

## Goal

A General MIDI–compatible instrument set for Diddums in which every sound is a LeanDSP program (no samples), built from a small library of reusable parts, good enough that a MIDI file from elsewhere sounds like music rather than a demo. "Good enough" is measured, not asserted (see Evaluation).

## Where we are

- 27 instrument families, each one self-contained `dsp` block: parameters (`freq`, `gate`, `colour`, `life`), state, buffers and a per-sample body. Each is compiled to WebAssembly by the native Lean 4.34 build and pinned by hash in `catalog.json`.
- No reuse: a mallet, a bell and a pluck each re-implement envelopes, oscillators and filters.
- MIDI import maps the 128 GM programs onto the 54 presets of these 27 families, so a GM piano is a felt mallet, a violin a detuned pad, a flute an organ.
- The kernel signature is `process(in, out, n, freq, gate, colour, life)`: there is already an audio input, so instances could be chained at run time.

## Design

### Parts

Reusable fragments, each with its own parameters and state, grouped by job:

| Job | Parts |
|---|---|
| Exciters | strike (felt, hard, metal), pluck burst (noise, shaped), bow (stick-slip friction), breath (filtered noise with turbulence), reed (pressure–flow nonlinearity), lip (brass buzz), membrane hit |
| Resonators | modal bank (N damped modes with ratios and decays: bells, bars, plates, piano strings), digital waveguide string (fractional delay, loss filter, dispersion), waveguide tube (open/closed bore, tone holes as a filter), membrane (2-D mode set) |
| Bodies | formant body filter banks (guitar, violin, piano soundboard, marimba resonator tube), radiation filter |
| Modifiers | state-variable filter, soft clip / tube drive, chorus, tremolo/vibrato, pitch glide |
| Envelopes and control | ADSR, strike envelope, velocity curves, key tracking (brightness and decay by pitch), release behaviour (damper) |

### Composition: two levels

1. **Inside one program (preferred).** A `voice` declaration composes parts and is elaborated by a Lean macro into one ordinary `dsp` program, renaming each part's state (`body.z1`, `string.delay`) and wiring outputs to inputs. The result is a single checked program, a single Wasm module and a single certificate, exactly like today's instruments, so the proof story is unchanged.

   ```
   voice NylonGuitar where
     part exciter : PluckBurst (hardness := colour)
     part string  : WaveguideString (freq := freq, loss := 0.996, dispersion := 0.0002)
     part body    : FormantBody GuitarBody
     route exciter -> string -> body
     map velocity -> exciter.level, key -> string.loss
   ```

2. **Between programs (later).** For effects shared across voices (body resonance, reverb sends), chain Wasm instances through the existing `in` buffer in the worklet. Each link is separately certified; the graph is described in the existing `system` notation.

### General MIDI coverage

Each of the 128 programs becomes a `voice` recipe plus parameter values; the 47 GM percussion notes become recipes from membrane, metal-modal and noise parts. Families share parts (all plucked strings use the same exciter, string and body parts with different numbers), which keeps the library small: roughly 15–20 parts for 128 + 47 sounds.

## Evaluation

- **Objective:** for each GM program, render reference notes (several pitches and velocities) and compare with a reference sample set (for example FluidR3 or GeneralUser GS, used only as measurement targets, never shipped) on spectral envelope distance, attack time, decay profile and inharmonicity. The Workbench already has pitch and tuning critics to build on.
- **Listening:** blind A/B in the existing Compare lab (old preset vs new voice vs reference), with preference recorded as structured taste data.
- **Budget:** CPU per voice at 48 kHz (the worklet allows 16 tracks × up to 24 voices); every voice has a bounded state footprint by construction.

## Milestones

1. **Composition in LeanDSP.** The `voice` macro, state renaming and wiring; 6 parts (strike, pluck burst, modal bank, waveguide string, formant body, ADSR); 4 voices (piano, nylon guitar, marimba, bell) built from them; certificates and hashes as today.
2. **Sustained sounds.** Bow, breath, reed and lip exciters; tube resonator; violin, cello, flute, clarinet, trumpet.
3. **Drum kit.** GM percussion from membrane, metal-modal and noise parts.
4. **Full GM map.** All 128 programs as recipes; MIDI import uses them instead of the nearest preset.
5. **Evaluation pass.** Objective comparison and listening tests; tune the worst 20.

Milestone 1 is the risky one: it changes the LeanDSP front end, so it must keep every existing instrument's hash and certificate identical.
