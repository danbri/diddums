# Diddums 0.5 — implementation notes

Studio 0.5 joins four previously separate concerns: native-Lean DSP artifacts, a compact mobile sequencer, a structured A/B/C/D musical comparison lab, and optional pretrained diagnostics.

## Native Lean

The app verifies the SHA-256 of `/lean/catalog.json` before loading any internal DSP module. Each catalog entry binds exact source, WAT and Wasm hashes to a native Lean build and names its proof scope. Editing source in the Workbench stages a draft; it does not replace running audio until the native build certifies a new catalog.

The current proved compiler path is now:

```
LeanDSP source semantics
  -> verified LeanDSP stack IR
  -> verified typed WasmSubset expressions / ordered blocks
  -> textual WAT
  -> WABT
  -> WebAssembly engine
```

The production emitter consumes the typed Wasm subset. `WasmSubset.lowerCode_correct`, `compileExpr_toWasm_correct`, `lowerBlock_correct`, and `compileBlock_toWasm_correct` were checked with Lean 4.34.0 without `sorryAx`.

All 17 current patterns were rebuilt after the typed-Wasm change and generated **identical WAT text** to the pinned catalog. Therefore this proof-boundary upgrade changed no DSP bytes. See `/lean/wasm-subset-report.json`.

The remaining compiler trust boundary starts at typed WasmSubset -> textual WAT pretty-printing/helper bodies, followed by WABT and the WebAssembly implementation. The JavaScript scheduler, mixer, effects routing and voice allocator also remain outside these theorems.

## Mobile sequencer

The Sequencer view is distinct from the piano roll. It uses one compact lane per track, or individual percussion lanes, and fits the active bar window to the phone width. Zoom is the number of visible bars (1/2/4/8) and never changes transport behaviour.

Looping is explicit. “Loop view” loops exactly the visible bars; “Loop movement” uses the current named movement. The AudioWorklet splits rendering at the exact score-frame boundary, releases gated voices there, rewinds score dispatch, and keeps echo/reverb state alive across the loop boundary.

A 390×844 Chromium test showed no horizontal page overflow. A two-bar loop wrapped correctly with zero reported non-finite samples.

## Taste Lab

Compare presents four controlled treatments of the same base composition and same selected movement:

- A: current reference.
- B: negative space / reduced density and drier treatment.
- C: resonant-object orchestration using pluck, glass and mallet families.
- D: fractured/drier pulse and stab treatment.

The user can choose best overall, winners for space/rhythm/timbre/harmony/arrangement, per-version diagnostic tags, and free notes. Records are stored locally and export as `jigdaw-taste-corpus/1`. Model-derived evidence is deliberately stored under `modelSignals` and never replaces the human preference.

### Level matching

A first-play comparison performs a **silent short-window RMS calibration**, then seeks back to the chosen movement and fades in with a bounded post-render gain correction. The correction is limited to 0.5×–2.5×. The stored diagnostics include measured RMS, peak, crest factor, gain correction, whether the safety bound was hit, and sample count.

In a Low-Light mobile test:

- A measured about 0.030 RMS and received +3.6 dB.
- C measured about 0.017 RMS and requested enough correction to hit the +8.0 dB safety bound.
- Both remained finite.

This materially reduces obvious “louder wins” bias but is **not BS.1770/LUFS perceptual loudness matching**. It is an intermediate comparison aid, not a psychoacoustic loudness theorem.

## Pretrained pitch critic

The Workbench includes an optional, lazy-loaded **Spotify Basic Pitch 1.0.1** diagnostic. Normal playback does not download the model.

The critic:

1. takes one already-certified LeanDSP Wasm kernel;
2. renders a short C4 probe directly through it at 22.05 kHz;
3. normalizes that probe for analysis only;
4. runs Basic Pitch locally in the browser;
5. compares the inferred MIDI pitch with the intended note;
6. stores the result as a model signal rather than a musical-quality judgement.

Velvet Sub recovered C3, C4 and A4 exactly at MIDI-note resolution: 0.00 mean absolute semitone error, zero missed intended notes, and zero strong extras.

A failure or ambiguity on a bell, plucked string, noisy percussion source, or intentionally inharmonic timbre would **not by itself prove the DSP is wrong**. It is evidence useful for diagnosing “something sounds off”, particularly when score pitch and acoustic/fundamental pitch may diverge.

A second, model-free **Tuning audit** now measures a narrow expected-frequency autocorrelation peak with fractional-lag interpolation. This is fast enough to use on any selected pattern. It reports frequency, cents error, normalized autocorrelation and a confidence class, and stores its result separately under `modelSignals.tuningAudit`.

For Orchard String, direct measurement at C3/C4/A4 gave approximately **+1.8, +3.5 and +5.8 cents** respectively, with autocorrelation above 0.997. Basic Pitch recovered C4 exactly; its two strong additional detections were C7/D7, classified as the 8th/9th harmonics rather than non-harmonic errors. The fractional-delay tuning was therefore left alone.

The library-wide deterministic sweep found one clear tonal outlier: **Ceramic Resonator** measured about +46 cents through the sampled decay. Basic Pitch heard its C4 probe as C♯4 and reported a strong non-harmonic F5 component. Inspection showed this came from deliberate design choices: a fixed 13% onset pitch lift plus a 2.73× rim oscillator. A revised colour-linked design now uses `pitchBend := 0.025 + colour * 0.09` and a quieter `colour²` rim term. The final native-Lean artifact measures about **+21.6/+21.8/+22.0 cents** at C3/C4/A4, and Basic Pitch recovers C4 with no strong extra note detections. This keeps a natural downward tom pitch envelope while making ordinary tom colours more harmonically centered; high-colour rim remains aggressive.

The Basic Pitch probe has subsequently been shortened and the expensive melodia-recovery pass disabled, to make it a faster sanity checker rather than exhaustive transcription.

## RDF / interop

The active foreign-plugin profile loader uses the pinned npm `@factoidal/core` 0.7.1 path. Cascade's live Turtle profile was parsed to 90 triples; its five indexed controls, `Abi1` module and processor were recovered from RDF. Full Cascade loading then verified remote resource integrity, instantiated the processor, exposed five controls and processed live composition audio with zero reported non-finite samples.

## Boundaries

The musical comparison variants are heuristics, not trained taste models. Short-window RMS matching is not perceptual loudness normalization. Basic Pitch is diagnostic evidence, not proof and not a musical-quality score. The stave remains time-proportional rather than engraved notation. The internal note event log is AudioWorklet dispatch history, not external MIDI input.