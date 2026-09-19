# Diddums

Diddums is a web-native music workstation and audio experimentation environment built around deterministic score generation, LeanDSP/Wasm instruments, proof-carrying audio, and Lean-first RDF/signing verification.

Current themes:

- LeanDSP instruments and effects with pinned native-Lean build evidence.
- JigScore deterministic score/event-plan hashing and a growing Lean model.
- Proof-carrying WAVs with replayable renderer/Wasm/PCM provenance.
- Lean-generated Factoidal Wasm for RDF parsing/canonicalisation.
- JigDAW compatibility, including Danny Ayers' `jigdaw-eddsa-2026` signing profile.
- Browser-first composition, sequencer, score, telemetry and psychoacoustic experiments.

## Status

Early-stage research/prototype. There are currently no compatibility guarantees for Diddums-owned schemas or browser APIs.

JigDAW identifiers are preserved only where they belong to the external JigDAW vocabulary/specification/cryptosuite.

## Source layout

The application lives under `public/`, mirroring the current Hatchable deployment layout.

Notable paths:

- `public/index.html` — main Diddums UI.
- `public/studio.js` / `public/studio-worklet.js` — host/runtime.
- `public/lean/` — LeanDSP and JigScore sources/evidence.
- `public/audio-proof.js` — proof-carrying audio format/replay.
- `public/proof-verifier.html` — standalone proof verifier.
- `public/jigdaw-signing.html` — JigDAW signing compatibility console.
- `public/vendor/factoidal-lean-0.8.0/` — pinned Lean-generated Factoidal Wasm used for RDF canonicalisation/signing verification.

## JigDAW compatibility

Diddums aims to interoperate with https://github.com/danja/jigdaw, including profile/resource integrity and `jigdaw-eddsa-2026` signatures.

That is a compatibility target, not the Diddums product name.

## Licensing

Project-level licensing is not yet declared in this repository. Vendored third-party material retains its own licensing and notices.


## GitHub Pages

The static site is deployed from `public/` by `.github/workflows/pages.yml`.

The 6.36 MB Lean-generated Factoidal Wasm is deliberately fetched during the Pages job from pinned `danbri/factoidal` commit `30154c0467ee529b7a056bb9c2ac61f144578619` and must match SHA-256:

`6201b6c477e81b9996df1cd75d9a90630118eb02cf48f5dbb94d40af330172b4`

The harvested Plugin Universe tar snapshot is not needed by the runtime and is not published to Pages.

Diddums' static URLs are deployment-root-relative, so the same tree works at both `/diddums/` on GitHub Pages and `/` on a future custom domain.
