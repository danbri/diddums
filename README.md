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


## Make & share (URL recipes)

The **Make** tab turns a short text prompt, or a hand-picked set of sounds, into a full composition. Everything is encoded in the URL query string, so a link reproduces the same track for anyone:

```
https://danbri.github.io/diddums/?prompt=epic+space+opera+ambiance+with+radio+chatter
https://danbri.github.io/diddums/?sounds=voidDrone,starfield,radioChatter,radioConsonants:0.3&key=D+minor&bpm=64&rhythm=none&say=control+this+is+orbit+four
```

| Parameter | Meaning |
|---|---|
| `prompt` | Free text. Keywords (space, radio, epic, ambient, rain, ocean, city, forest, cathedral, machine, dance, retro, dark, dream…) choose sounds, key, tempo, beat and section names. |
| `sounds` | Comma list of sound ids from `public/sounds.js`, each optionally `:level`. A raw `pattern.role` pair (e.g. `tine.keys`) also works. Maximum 8, the worklet's track limit. |
| `title`, `bpm`, `key`, `meter`, `rhythm` | e.g. `key=F# lydian`, `meter=7/8`, `rhythm=none` for ambient. |
| `minutes`, `room`, `seed` | Approximate length, reverb size (0–1), seed for generated melody/bass. |
| `say` | Words spoken by the sine-wave speech voices (Radio chatter, Whistle choir…). |
| `chords`, `melody`, `bass`, `harmony`, `names` | Optional explicit musical material; see the reference panel in the Make tab. |

Explicit parameters override anything derived from `prompt`. The prompt mapping is a deterministic keyword table in `public/maker.js`; it uses no network service or ML model.

### Sound library

`public/sounds.js` holds 51 named presets (space drones, radio chatter, choirs, timpani, harp, music box, rain, heartbeat…). Each preset uses one of the 23 existing hash-matched LeanDSP instrument families and sets its score role, register (`transpose`) and existing colour/life/level/pan/send controls. No new DSP is added, so the pinned native-Lean catalog and its proof boundary are unchanged. Adding a new instrument family still requires the native Lean build described in `public/lean/README.md`.

## GitHub Pages

The static site is deployed from `public/` by `.github/workflows/pages.yml`.

The 6.36 MB Lean-generated Factoidal Wasm is deliberately fetched during the Pages job from pinned `danbri/factoidal` commit `30154c0467ee529b7a056bb9c2ac61f144578619` and must match SHA-256:

`6201b6c477e81b9996df1cd75d9a90630118eb02cf48f5dbb94d40af330172b4`

The harvested Plugin Universe tar snapshot is not needed by the runtime and is not published to Pages.

One-time repository setting: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Without it, the workflow's `GITHUB_TOKEN` cannot create the Pages site and the `Configure Pages` step fails with "Resource not accessible by integration".

Diddums' static URLs are deployment-root-relative, so the same tree works at both `/diddums/` on GitHub Pages and `/` on a future custom domain.
