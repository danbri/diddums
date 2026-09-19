# Diddums 0.6 — verified DSP, score diagnostics and auditory oddities

Studio 0.6 is the point where the prototype stops treating “LeanDSP” as branding and uses an actual Lean-defined DSP language for the published internal kernels.

## LeanDSP

The active DSP path is:

```
Lean `dsp … where` source
  → CertifiedProgram
  → proved stack IR
  → proved typed WasmSubset expression/block lowering
  → textual WAT
  → WABT
  → hash-pinned Wasm
  → AudioWorklet
```

The current catalog contains **23 native-Lean-certified families**. The release build is pinned to Lean 4.34.0 and audits each required theorem/pattern with `#print axioms`. No release certificate accepts `sorryAx`.

The strongest current refinement theorem is `LeanDSP.WasmSubset.compileBlock_toWasm_correct`: it covers an entire ordered sample block, including local bindings, persistent state writes, buffer pushes and output. `compile_trace_correct` additionally quantifies over arbitrary finite input/parameter traces.

The remaining compiler/runtime trust boundary begins at typed WasmSubset → textual WAT/helper WAT bodies, followed by WABT, the WebAssembly engine and the JavaScript host.

See `/lean/README.md`, `/lean/build-report.json` and `/lean/wasm-subset-report.json`.

## Voice allocation polish

The old fixed pools (2 bass / 6 lead / 8 pad voices) were too small for the actual release tails in several compositions.

In a 12-second Low-Light run the old policy produced **44 runtime voice-steal tail cuts**, predominantly Nocturnal Keys. Static lifetime analysis showed that track needed up to 24 simultaneously live state-isolated voices.

Studio 0.6 sizes each track pool from the authored score's gate + release lifetime, bounded at 24 voices per track. Emergency stealing, if ever needed, prefers the quietest already-released tail.

The same 12-second Low-Light test after the change produced **0 voice steals**, zero non-finite samples and no mobile layout regression. Porcelain Weather, one of the heaviest sessions, advanced ~10.14 seconds of score in ~10.29 seconds wall time in the browser-farm stress run with zero non-finite output.

## Score provenance and critic

Every generated event now carries authored `bar`, `step`, `nominalBeat` and humanisation offset separately from its rendered frame.

That matters: attempting to infer musical intent from jittered audio frames can assign a note to the wrong side of a bar boundary.

The score critic reports descriptive facts, not quality scores:

- fraction of events on the current harmony's pitch classes;
- gate overlap across two-bar harmony changes;
- long non-chord notes;
- coincident minor-second / tritone onsets;
- per-track bounded voice-pool requirement.

For Low-Light, the original score has 108 harmony-boundary gate overlaps; **96 are Nocturnal Keys**. The focused Compare test “Legato gates / Clean boundaries” changes only keys/stabs gate endpoints and reduces the keyboard count from 96 → 0, leaving the 12 Distant Bell overlaps untouched. Both alternatives are short-window RMS matched before audition.

This remains an A/B preference question: suspensions and overlaps are not automatically mistakes.

## Pitch and pretrained diagnostics

The Workbench has two different pitch diagnostics:

1. **Tuning audit** — deterministic narrow-band normalized autocorrelation with fractional-lag interpolation.
2. **Spotify Basic Pitch 1.0.1** — optional lazy-loaded learned transcription, used as a cross-check rather than a quality score.

Examples observed in the deployed build:

- Velvet Sub C4: ~0 cents deterministic error; Basic Pitch recovers C4 exactly.
- Amber Ladder C4: ~0 cents; Basic Pitch C4 exactly, plus C5 identified as H2.
- Orchard String: about +1.8 / +3.5 / +5.8 cents at C3/C4/A4. Basic Pitch recovers C4 and its extra strong C7/D7 detections align with H8/H9, so the fractional-delay tuning was left alone.
- Ceramic Resonator originally measured about +46 cents and Basic Pitch heard C♯4 plus a non-harmonic F5 component. The revised colour-linked pitch envelope measures about +22 cents and Basic Pitch recovers C4 without a strong extra note.

## Auditory oddities

### Impossible ascent

`ImpossibleAscent` uses five staggered octave-wrapped layers with complementary sine amplitude windows.

At colour 0.55, the `rise` state completed a full wrap at about **21.9 seconds**. Runtime inspection showed no output-energy collapse around the wrap. The composition **Impossible Stairwell** gives this component one uninterrupted ~144-beat gate so the state does not retrigger every phrase.

### Phantom root

`PhantomRoot` generates only harmonics 2, 3, 4 and 5 of the requested pitch.

For an intended C4, Basic Pitch nevertheless recovered **C4** strongly. The deterministic periodicity estimator returned the missing root within about **0.05 cents**; the only strong extra model detection was C5/H2.

### Ghost beating

`GhostBeating` uses two slightly different oscillator frequencies, with no tremolo LFO. At the tested setting, the designed difference frequency was ~0.82 Hz and the measured slow envelope modulation was ~0.85 Hz.

## Sine-wave speech and Toki Pona

Classic sine-wave speech replaces speech resonances with a few independently moving sinusoids. The original perceptual work showed that three sinusoids tracking the first three formants can carry substantial phonetic information.

Studio 0.6 now contains:

- `ThreeSineVoice` — three pure tones at a morphable F1/F2/F3 vowel target.
- `SpeechGestures` — compact stop-like, nasal and approximant onset gestures.
- `SixSineChoir` — two detuned copies around each of the three formant tracks.

The five vowel anchors are currently:

| vowel | F1 | F2 | F3 |
|---|---:|---:|---:|
| a | 800 | 1200 | 2500 Hz |
| e | 500 | 1900 | 2600 Hz |
| i | 300 | 2300 | 3000 Hz |
| o | 500 | 900 | 2400 Hz |
| u | 350 | 800 | 2200 Hz |

Goertzel checks on both vowel kernels find energy at the intended formant targets; the choir additionally shows the designed ±0.17% paired peaks.

The composition **kalama pona** encodes the Toki Pona phrase:

```
to · ki · po · na · li · po · na
```

Word-initial syllables are given greater duration/velocity. Vowel and consonant events are separate score events, and speech events carry their actual syllable label through the sequencer and AudioWorklet event log instead of pretending to be ordinary C4 notes.

The first implementation is deliberately a perceptual experiment, not a claim of high-intelligibility TTS. Real sine-wave speech normally follows continuously measured formant trajectories from natural utterances; here the trajectories are generated from a compact symbolic vowel/consonant model.

References:
- Robert E. Remez, musical/poetic sine-wave speech: https://www.columbia.edu/~remez/musical-and-poetic-sine-wave-speech.html
- Remez, Rubin & Pisoni, “Coding of the speech spectrum in three time-varying sinusoids”: https://pubmed.ncbi.nlm.nih.gov/6575670/
- Dan Ellis / LabROSA sine-wave speech analysis/synthesis notes: https://www.ee.columbia.edu/~dpwe/LabROSA/matlab/sws/

## RDF

All active RDF parsing/query/conversion remains on pinned `@factoidal/core` 0.7.1. The active Diddums JigDAW-compatibility loader does not use the former ad-hoc Turtle parser.

## Current limits

- The host scheduler/mixer/effects are JavaScript, not Lean.
- Unit/rate annotations are checked declaration metadata, not a complete dimensional type system.
- Textual WAT serialization/helper bodies remain outside the refinement theorem.
- Short-window RMS comparison matching is not BS.1770/LUFS perceptual loudness.
- Basic Pitch is diagnostic evidence, not proof.
- Sine-wave Toki Pona is a compact synthetic speech experiment, not a trained TTS model.