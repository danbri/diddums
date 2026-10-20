# Diddums

A music engine that runs in the browser. Every sound is synthesised live by a small DSP program written in LeanDSP, compiled from Lean 4 to WebAssembly, and checked against a pinned build. Pieces are JSON "Songs" that travel in a link.

## Links

- App: https://danbri.github.io/diddums/
- Labs (example songs, AI sketches, sine-wave speech): https://danbri.github.io/diddums/ → Labs
- Skill page for AI assistants (how to write a Song and return it as a link): https://danbri.github.io/diddums/skill/SKILL.md, indexed from https://danbri.github.io/diddums/llms.txt
- Instrument list: https://danbri.github.io/diddums/skill/INSTRUMENTS.md
- Adaptive game music demo: https://danbri.github.io/diddums/game.html
- Characters-in-a-scene demo: https://danbri.github.io/diddums/scene.html
- Used from another site: [Escape / Great Maze Pond](https://danbri.github.io/glitchcan-minigam/magpie/guys/game.html) loads the engine from its public URL and plays a songbook piece on each floor, re-arranged by game state.

Status: a research prototype. Schemas and APIs can change without notice.

## Songs

A Song is JSON: key and scale, tempo, meter, a drum pattern, chords, melody, sections with energy, and tracks. Each track is an instrument playing either a part generated from the chords (bass, pad, arpeggio, lead, and process parts such as phasing or isorhythm) or notes placed in time. A Song can be opened from `?song=` in a link, so a piece can be shared without a server.

Labs lists about 50 example pieces in groups: Featured, Kids (a nursery-rhyme medley and lullabies), Arty, Genres (22 styles, from ska and sea shanty to drum and bass and krautrock), Techniques, and Themes and sketches. Each one plays, opens for editing, and shares as its own link.

The Kids, Arty and Genres pieces are written in `tools/songbook/songs.mjs` as chord charts, accompaniment patterns and melodies. `node tools/songbook/build.mjs` builds them into `public/songbook.js` and checks each with the Song validator, and `node tools/songbook/audit.mjs` renders them offline and reports each part's level.

Scales are defined once, in `public/song.js` (`modes`), and are available to every Song through its `key` (for example `"D hijaz"`): the church modes, harmonic minor, hijaz (Phrygian dominant), acoustic, pentatonic, yo, hirajoshi, pelog, blues, whole-tone and octatonic. The Labs editor's Mode menu, the AI prompt, the skill page and the game all use the same table.

## Voices

- Sine-wave speech: a Song's `say` text is turned into syllables sung by a vowel voice and a consonant voice. Labs has a sine-wave speech page.
- Sung vowels: 70 generated voice instruments (a, e, i, o, u, aa; bass to child; clean or breathy) for melodies, humming and choirs.
- Choir and radio-voice presets among the named sounds.

## Instruments

- 27 hand-written instruments in the pinned catalog (`public/lean/catalog.json`), with 54 named presets on top of them (`public/sounds.js`).
- 1017 generated instruments in 17 categories (`public/families.js`, sources in `public/lean/families/src/`), built from synthesis archetypes in `tools/families`: struck bars and bells, plucked and bowed strings, winds, reeds, FM, subtractive synths, drawbar organs, wavefolders, sung vowels, drums, noise textures, chip sounds, beating drones, ring modulators, comb resonators and others. The browser loads a shard of 40 only when one of its instruments is used.

Every published kernel comes from a native Lean 4.34 build with kernel axiom audits; the browser checks the pinned catalog or shard index hash and each instrument's source, WAT and Wasm hashes before use. A JavaScript draft compiler (`public/leandsp.js`, bit-identical output on the published instruments) is used only for screening and editing.

To change generated instruments:

```sh
cd tools/families && npm install
node screen.mjs          # all candidates: compile, render, reject faulty ones, set loudness, remove near-duplicates
node refresh.mjs         # or: regenerate published ones in place after fixing an archetype (same ids)
node build-shards.mjs    # native Lean build in shards (needs elan/lake); only changed shards rebuild
node publish.mjs         # public/families.js and sources; prints the index hash to pin in public/lean-client.js
node measure-winds.mjs   # tuning and sustain audit of published wind, reed and bowed instruments
node ../build-skill.mjs  # skill page and instrument list
```

The hand-written catalog is reproduced with Lean 4.34.0 from `public/lean/project-files.json` (`npm install && node build.mjs`); see `public/lean/README.md`.

## Adaptive music

`public/adaptive.js` plays an endless score written a few bars ahead from live state. The caller reports what things mean; a plan function chooses the arrangement, and changes land on the next bar line, optionally through a fill, pickup, crossfade or cut. `hit()` plays event sounds on the chord that is sounding, within one 16th note. Characters can enter over the scene with their own motifs, treated according to their state (power, mood, stability, health). There are also immediate controls (level, muffle, pitch wobble and drift, ducking), a tempo map with ramps and rubato, and per-layer timing feel. The skill page documents the API and a mapping from game meaning to music.

The game demo has seven levels, each playing a songbook piece. A page on another site can import the engine from `https://danbri.github.io/diddums/adaptive.js`; it fetches its worklet and instruments relative to its own URL.

`adaptiveCore` is the scheduler without audio, so the tests drive the real worklet and native kernels offline:

```sh
node tools/adaptive/test.mjs
```

## MIDI

Labs opens Standard MIDI Files: channels become timed-note tracks on a 16th-note grid, General MIDI programs map to the nearest instrument (`public/midi-import.js`), and channel 10 drums map to the drum kit. Any Song downloads as MIDI with GM program numbers.

## Timelines and automation

Tracks can place notes in seconds as well as follow the bar grid (`public/timeline.js`): `seq:'x@.9 . A2:2 C4+E4+G4 .*7'` with `step` seconds per step (which may itself be a curve). Automation curves (`'0@0 1@1.2 0@15'`, value@seconds) drive level, pan, send, colour, life and tune per track, and master, room and echo for the piece. Stereo pairs expand one track into left and right, optionally delayed or with different notes. `?piece=firstcontact` is a worked example.

## Proofs and signing

- Proof-carrying WAV export with replayable renderer, Wasm and PCM provenance (`public/audio-proof.js`), checked by `public/proof-verifier.html`.
- RDF canonicalisation with a pinned Lean-generated Factoidal Wasm, and compatibility with the [JigDAW](https://github.com/danja/jigdaw) `jigdaw-eddsa-2026` signing profile (`public/jigdaw-signing.html`).

## Deployment

GitHub Pages serves `public/` through `.github/workflows/pages.yml`, which stamps one build id onto every page and module (`tools/stamp-build.py`) and fetches the Factoidal Wasm from a pinned `danbri/factoidal` commit, checked by SHA-256. URLs are relative, so the same tree works under `/diddums/` or at a domain root.

## License

Apache License 2.0 (`LICENSE`). Vendored third-party material keeps its own licence and notices.
