# JigScore formal score roadmap

Diddums separates composition generation from audio rendering:

    composition data
        ↓
    JigScore event plan
        ↓
    sample-rate timestamp mapping
        ↓
    LeanDSP/Wasm voices
        ↓
    host mixer / echo / room

## Current deployed boundary

public/score.js remains the executable score planner. It deterministically expands bars, sections, rhythm grammars, harmony, bass patterns, authored step sequences, speech events and track roles into note events.

public/jigscore.js produces two canonical SHA-256 identities:

- program hash — the authored composition/arrangement data that controls score generation;
- event-plan hash — the sample-rate-independent event stream (bar, step, nominal beat, humanisation, note, velocity, duration in beats, colour/life and relevant metadata).

Audio-frame positions are intentionally excluded from the second hash. The same composition should therefore have the same JigScore event-plan identity at 44.1, 48 or 96 kHz.

User edits/overrides create a different event-plan hash. A saved local pattern is not automatically applied when a composition is opened: every piece, including Factory Monday, always starts from its authored standalone score.

## Lean model

/lean/JigScore.lean is a draft formal model, not part of the pinned release certificate.

Its first deliberately small model is a repeating step-pattern emitter. The intended theorem boundary is structural rather than aesthetic:

- at most one event can be emitted per score step;
- event generation is deterministic for a fixed program;
- event count is bounded by the score-step budget;
- later parity work will bind exact canonical event streams/hashes.

The file includes Factory Monday's original Diddums bass and 32-step sequencer data as a useful parity fixture.

## Next proof milestones

1. Check JigScore.lean with the exact final Lean 4.34.0 release toolchain and record the full compiler commit in release evidence.
2. Model harmony-relative note resolution and section/role gating.
3. Model the factory drum grammar and prove per-bar event bounds.
4. Generate a canonical Lean event-plan serialization matching public/jigscore.js.
5. Add a release gate: JavaScript and Lean event-plan SHA-256 values must match for every supported composition fixture.
6. Replace the JS implementation incrementally only after parity is demonstrated.
7. Extend proof-carrying audio certificates with the JigScore program hash and checked event-plan hash before DSP/Wasm/audio hashes.

## Trust boundary

Today, LeanDSP's source→typed-Wasm-subset proof is stronger than score generation. Do not describe JigScore.lean as certified yet. Until the native build is refreshed, the scheduler, arrangement rules, timestamp mapping, mixer, effects and WebAudio runtime remain explicit host trust boundaries.