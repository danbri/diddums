# Diddums 0.4

## What changed

The main app is now one composition workspace rather than a stack of historical demonstrations. Compose, Patterns and Workbench are separate panes. Opening a drum stays inside the same graph: composition → percussion → voice source. Pooled instruments use composition → pool → instance → source. Both use the same graph renderer, inspector, controls and measurement display.

The old 909 demonstration is represented musically by **909 · Nine Rooms**, a 72-bar, nine-movement percussion suite. This uses newly authored LeanDSP percussion kernels; it is not a claim of exact TR-909 or VALIS compatibility. The former laboratory is retained at `/lab-v26.html`, behind the Workbench archive disclosure, not reached from any normal drum node.

## Composition collection

Three revisited pieces (Low-Light, Glass Transit, Dub Nocturne), ten new compositions (Porcelain Weather; Velvet Satellites; Cathedral of Static; Silver Orchard; Amber Afterimage; Tidal Memory; Night Letters; Violet Escalator; Soft Machines, Hard Rain; Last Ferry Home), plus Nine Rooms.

Scores have explicit harmony, meter, seed, track/pattern selection, movements, role activation, timed note events and endings. Meter includes 4/4, 6/8, 5/4 and 7/8. Musical variation includes chord changes, call/response, alternate phrases, fills, orchestration changes and breakdowns. Pieces stop after a six-second tail; the collection-once option advances through a finite pass. These remain algorithmically arranged instrumental sketches, not a claim of human musical polish established by automated tests.

## Pattern library

17 original source patterns: roundBass, acidBass, tine, glass, pluck, felt, silk, choir, organ, pulse, rain, kick, snare, hat, clap, tom and chamber. These include actual fractional-delay plucked-string feedback, frequency modulation, modal/harmonic synthesis, polyBLEP waveforms, TPT filtering, independent percussion voices and damped comb/allpass reverberation.

Patterns expand to ordinary LeanDSP source before checking. There are no hidden big-plugin intrinsics. Each active instance has its own Wasm state and bounded memory. The chamber runs as two independent channels. Closed hats choke the open-hat voice.

## Evidence boundary

The leaf pipeline is **Lean-shaped source → JavaScript structural checker → WAT → WABT → WebAssembly validation**. This is not Lean-kernel verification. Semantic parameter annotations are not a complete dimensional type system. Scheduling, pool management, stereo mixing, cross-feedback echo and telemetry remain explicitly labelled JavaScript host infrastructure. The system-DSL panel remains a structural sketch checker, not an executable implementation of every surveyed architecture.

The compiler now supports comparison-valued local bindings, measures parameters/input/sample rate as well as named bindings and state, and declares equal initial/maximum Wasm memory pages. The host limits scores to 32,768 events, eight tracks and eight voices per track. It splits rendering at note/onset/release frame boundaries rather than applying upcoming events early to a whole render block.

## Measurements and UX

No independent activity is invented for unprobed expressions. Source nodes with actual slots show their measured values. Selected voices identify the concrete instance, probe, frame interval and executable hash. The waveform is a contiguous up-to-1024-sample trace, not concatenated unrelated render blocks. Spectrum uses a Hann-windowed radix-2 FFT, with its limited frequency resolution labelled. Track RMS includes both channels; the trace is the left output channel. History is a recent sequence of measured summaries, not a full-rate recording.

Visualization scaling offers recent min/max, symmetric recent peak, fixed 0–1 and fixed ±1. It does not modify the sound or raw numbers. Pausing clears live indications; an idle voice explicitly reports that it is resting. Internal traces from one voice are not silently mixed with another voice in the same pool.

Generic controls include level, colour, decay, auxiliary send, pan, mute, solo and audition. Drum voices also expose tuning and step overrides. Source binding and initializer edits compile and replace the shared pattern. A pattern replacement resets its instances; transparent state migration is not yet implemented. Source parameter defaults do not override explicit score-supplied values. Session export includes composition data, current pattern source/hashes and UI overrides, but not a sample-exact runtime-state checkpoint.

## Tests performed

All 17 patterns compiled and validated as Wasm. At 48 kHz a deterministic harness executed the actual deployed worklet source for all 14 compositions: 1.2 seconds from the opening, 2.4 seconds from the third movement, and the last bar plus 6.1 seconds. All produced finite, nonzero audio in the sampled opening/middle, distinct sampled output fingerprints, zero reported non-finite samples, and a completed ending with a zero final buffer. These are sampled runtime checks, not full-length listening tests or audio equivalence proofs.

A live Chromium AudioWorklet at 44.1 kHz was tested at a 390×844 viewport: play, movement seek, composition → percussion → kick navigation, actual internal values/trace/frame provenance, back navigation, pause and clearing live indicators. No horizontal page overflow or obsolete 909 footer was present. This viewport check is not a test on physical iPhone/Safari hardware.

Danny's Cascade/Pulse loader is retained in Workbench as an explicitly experimental external-plugin path; this release's audio test matrix concerns the new internal collection, not renewed end-to-end interoperability certification.