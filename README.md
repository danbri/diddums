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

`public/sounds.js` holds 54 named presets (space drones, radio chatter, choirs, timpani, harp, music box, rain, heartbeat…). Each preset uses one of the 23 existing hash-matched LeanDSP instrument families and sets its score role, register (`transpose`) and existing colour/life/level/pan/send controls. No new DSP is added, so the pinned native-Lean catalog and its proof boundary are unchanged. Adding a new instrument family still requires the native Lean build described in `public/lean/README.md`.

## Timelines, automation and stereo pairs

Compositions can be written against the clock as well as the bar grid (`public/timeline.js`). `?piece=firstcontact` is a worked example.

- **Timeline tracks** (`role:'timeline'`) place notes in seconds: `seq:'x@.9 . . x .*7 | A2:2 _'` (x = the track note, `.` rest, `@velocity`, `:length` in steps, `*repeat`), `step` seconds per step, `from`/`to` window. `step` may itself be a curve, so a pattern can accelerate.
- **Automation** (`automate:{level:'0@0 1@1.2 1@14.7 0@15', pan:'-0.75@15 0.75@30', tune:'0@35 5@50'}`) on any track: `level` (× track level), `pan`, `send`, `colour`, `life`, `tune` (semitones). Composition-level `automate` drives `master`, `room`, `damp`, `wet`, `echo`. Points are `value@seconds` (suffix `b` for bars), linear between points; two points at the same time make a jump. Curves are evaluated in the AudioWorklet at score time, so seeking and proof renders follow them.
- **Stereo pairs** (`pair:{width:.8, delay:.023, seqR:'…', noteR:'E5', transposeR:7}`) expand one track into `<id>L`/`<id>R` at ∓width; the right side can play its own sequence, note or transposition and is delayed by `delay` seconds. Pan automation on a pair sets the width.

The same features are available in share URLs: `auto.<sound>.<key>=curve`, `auto.master=curve`, and `sounds=radioSnow^0.9/0.37` for a pair. A session may hold up to 16 tracks (the worklet's bound).

## Native Lean build

The LeanDSP release can be reproduced in a container with Lean 4.34.0:

```sh
curl -sSfL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --default-toolchain leanprover/lean4:v4.34.0
# unpack public/lean/project-files.json into a directory, then:
npm install && node build.mjs     # writes out/catalog.json and out/build-report.json
```

Studio 0.7 used this to add four families: `heartbeat` (HumanHeart lub-dub), `orbitBlip` (Sputnik-style beacon), `sonar` (SonarBlup ping with echo) and `radioSnow` (shortwave static). The same native run rebuilt all 23 earlier families with byte-identical source, WAT and Wasm hashes; the published catalog keeps those entries verbatim, adds the four new ones, and records the run under `extensions` (see `public/lean/build-report-0.7.json`). `public/lean-client.js` pins the new catalog SHA-256.

Proof-audio exports use a content-addressed renderer copy; automation support adds `proof-renderers/studio-worklet-6353dc37c9c05897.js` beside the earlier one so older proofs remain verifiable.

## GitHub Pages

The static site is deployed from `public/` by `.github/workflows/pages.yml`.

The 6.36 MB Lean-generated Factoidal Wasm is deliberately fetched during the Pages job from pinned `danbri/factoidal` commit `30154c0467ee529b7a056bb9c2ac61f144578619` and must match SHA-256:

`6201b6c477e81b9996df1cd75d9a90630118eb02cf48f5dbb94d40af330172b4`

The harvested Plugin Universe tar snapshot is not needed by the runtime and is not published to Pages.

One-time repository setting: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Without it, the workflow's `GITHUB_TOKEN` cannot create the Pages site and the `Configure Pages` step fails with "Resource not accessible by integration".

Diddums' static URLs are deployment-root-relative, so the same tree works at both `/diddums/` on GitHub Pages and `/` on a future custom domain.
