---
name: diddums-song
description: Compose music, soundscapes and sound-design pieces for Diddums, a browser synthesiser, and hand back a link that plays them. Use when someone asks for a piece, ambience or sound effect sequence they can listen to in a browser.
---

# Diddums songs

You write a **Song** (JSON, described below) and give the person a link. Opening the link plays the piece at https://danbri.github.io/diddums/, where it can also be edited and shared. No account, key or install is needed.

## Delivering the result

1. Write the Song JSON. Leave out every optional field you do not need; shorter is better.
2. Build the link: `https://danbri.github.io/diddums/?song=` followed by the JSON percent-encoded exactly as JavaScript `encodeURIComponent` does it (letters, digits and `- _ . ! ~ * ' ( )` stay; everything else, including spaces, quotes, braces, `#`, `+`, `@`, `:` and `,`, becomes `%XX`).
3. The whole link must stay under **8000 characters** (the host rejects longer ones). If it would be longer, simplify the piece: fewer tracks, shorter `seq` patterns that loop, fewer automation points.
4. Give the link on its own line, as plain text.
5. If you cannot produce a correct link (no way to percent-encode reliably, or it is too long), give the Song JSON instead and tell the person: open https://danbri.github.io/diddums/, choose **Labs**, type any short description in the text box, tap **Copy prompt for any AI assistant**, then paste the JSON into the reply box that appears and tap **Use this song**.

Before answering, check: every track has a `sound` from the lists below; every `seq` uses only the tokens described; times in automation and `from`/`to` fall inside `seconds`.

Diddums is a browser music engine. Every sound is synthesised live by small, formally checked DSP programs (no samples). You compose by writing a **Song**: a JSON object describing tracks, notes placed in time, and automation curves. Diddums validates the JSON, schedules the notes and plays it; people can then edit it on their phone and share it as a link.

Write music that responds to what was asked for: if the request names events at particular times, place them at those times; if it describes a mood or a scene, build an arc with contrast — entrances, a change, a peak, a release. Silence and space are musical tools. Prefer a few well-chosen, well-placed sounds to many busy ones.

## Song fields

- `title`, `description` (one or two sentences about what happens), `seconds` (total length, 10–600). The length is rounded up to whole bars (one bar lasts beats-per-bar × 60 / bpm seconds: 4 s at 60 bpm in 4/4, 5 s at 60 bpm in 5/4), so choose bpm and meter that divide the length when it matters.
- `bpm`, `meter` ("4/4", "3/4", "6/8", "5/4", "7/8"), `key` (e.g. "E minor", "F# lydian"; modes: minor, major, dorian, lydian, phrygian, mixolydian).
- `rhythm`: the built-in drum machine pattern, or "none" for no drums. Options: none, brush, halftime, broken, shuffle, house, motorik, postpunk, factory, euclid, seven, ritual, suite.
- `room` 0–1 (reverb size), `say` (words the sine-wave speech voices speak).
- `sections`: [{"name", "start" (seconds)}] — named parts shown to the listener as movements. Starts are rounded to bar lines.
- `chords`: scale degrees 1–7 for the harmony that role-based tracks follow, e.g. [1,6,3,7].
- `tracks`: up to 16 voices (a stereo pair counts as two).
- `automate`: whole-mix curves. `master` 0–1.5 (1 = normal, 0 = total silence); `room` (reverb size), `damp` (reverb darkness), `wet` (reverb level) and `echo` (echo level) all 0–0.94.

## Tracks

Each track has a `sound` (a sound id or an instrument id from the lists below). Then either:

**A. Timed notes** — give `seq`, and the track plays exactly what you write:
- `seq`: space-separated steps. `x` = the track's `note`; `.` = rest; a note name (C4 = middle C, F#3, Bb5) or MIDI number; `C4+E4+G4` = chord; `@0.6` = velocity 0–1; `:4` = this note sounds for 4 steps (every token still advances exactly one step, so follow a held note with rests if nothing else should start); `*8` = repeat the token 8 times. Example: `"x . . x@.6 .*4 G4:2 C4+E4+G4:4"`.
- `note` (default note for `x`), `step` (seconds per step, e.g. 0.25 — or a curve such as "0.9@35 0.15@50" to accelerate), `from` / `to` (seconds; the seq loops inside this window; `loop`: false plays it once; nothing starts at or after `to` and notes are cut at `to`), `gate` (how long notes without `:N` sound, in steps; default 0.5; `:N` overrides it). Without `note`, `x` is C4.

**B. Role playback** — omit `seq` and the sound plays its role (bass line, chords, melody, arpeggio, drone, speech…) from the song's harmony and sections. Set `role` to change it: bass, drone, pad, long, keys, stabs, arp, sequence, lead, sparse, answer, air, continuous, speechVowel, speechConsonant. Speech roles (speechVowel/speechConsonant) speak the `say` text. A role track plays in every section, unless the section lists `roles` (bass, pad, lead, arp, air, drums) that exclude its kind; `onlySections` / `excludeSections` (lists of section names) restrict it further. `from`, `to` and `loop` apply only to timed notes.

Both kinds accept: `label`, `level` (0–1.5), `pan` (−1 left … 1 right), `send` (reverb/echo 0–1), `colour` (0–1, brightness/character, instrument-specific), `life` (0.03–8 s, decay/release), `transpose` (semitones). A bare instrument id starts from level 0.4, colour 0.4, life 1.2, send 0.3; a sound id starts from its preset's values.

**Stereo pairs** — `"pair": {"width": 0.8, "delay": 0.02, "seqR": "…", "noteR": "E5", "transposeR": 7}` turns one track into a left and a right voice at ∓width. The right side can play its own sequence (`seqR`), note or transposition, and starts `delay` seconds later (0.01–0.03 widens a sound; 0.1–0.4 gives call-and-response or decorrelated noise).

**Automation** — `"automate": {"level": "0@0 1@2.5 1@14.8 0@15"}`: points are value@seconds, joined linearly; two points at the same time make an instant change. Track keys: level, pan, send, colour, life, tune (`level` multiplies the track level; `tune` is in semitones and bends all notes, good for Doppler or rising tension; `pan` on a pair sets its width, so to sweep a sound across the stereo field use a single track). Ranges: `level` 0–1.5, `pan` −1…1, `send` 0–1.5, `colour` 0–1, `life` 0.03–8 s, `tune` ±48 semitones. Use automation for fades, sweeps, movement and transformation: a lighthouse beam or passing craft is `pan` plus `level` on one track; a horn or engine is a low sustained `organ`, `acidBass` or `darkDrone` note with slow `tune` and `level` curves.

Limits: at most 16 track voices. Each track can sound at most 24 notes at once, counting each note from its start until its length plus about 1.7 × `life` (so a long `life` with fast steps piles up; a chord counts once per note); Diddums names the track if this is exceeded. At most 32768 notes in the whole song.

## Sounds (presets: an instrument plus sensible settings)

### Space & sci-fi
- `voidDrone` — Void drone: Missing-fundamental low drone: the root is implied, not played. (instrument `phantomRoot`, plays as `drone` when it has no seq)
- `hullHum` — Hull hum: Very low sine hum that follows the chord root. (instrument `roundBass`, plays as `drone` when it has no seq)
- `engineThrob` — Engine throb: Two near-identical tones beating slowly against each other. (instrument `ghostBeat`, plays as `drone` when it has no seq)
- `starfield` — Starfield: High inharmonic bell glints with long tails. (instrument `glass`, plays as `sparse` when it has no seq)
- `nebulaPad` — Nebula pad: Slow, wide detuned chord wash. (instrument `silk`, plays as `pad` when it has no seq)
- `warpAscent` — Warp ascent: Endlessly rising Shepard/Risset tone for the whole track. (instrument `shepard`, plays as `continuous` when it has no seq)
- `commsBeeps` — Comms beeps: Short high console beeps. (instrument `pulse`, plays as `sparse` when it has no seq)
- `telemetry` — Telemetry: Sparse computer-style data sequence. (instrument `pulse`, plays as `sequence` when it has no seq)
- `sputnikBeacon` — Sputnik beacon: Driven radio beacon tone, on/off like Sputnik 1 (native-Lean OrbitBlip family). (instrument `orbitBlip`, plays as `sequence` when it has no seq)
- `sonarBlup` — Sonar blup: Sonar ping with an upward blup and built-in echo (native-Lean SonarBlup family). (instrument `sonar`, plays as `sparse` when it has no seq)
- `sonarPing` — Sonar ping: Dark, slow bell pings answering the melody. (instrument `glass`, plays as `answer` when it has no seq)
- `solarWind` — Solar wind: Bright noise breathing in long swells. (instrument `rain`, plays as `air` when it has no seq)

### Radio & voices
- `radioChatter` — Radio chatter: Sine-wave speech transmissions. Words come from the "say" text. (instrument `sineVox`, plays as `speechVowel` when it has no seq)
- `radioConsonants` — Radio consonants: Consonant clicks and hiss that make sine-wave speech intelligible. (instrument `speechGesture`, plays as `speechConsonant` when it has no seq)
- `secondOperator` — Second operator: A second voice repeating the transmission a beat and a half later. (instrument `sineVox`, plays as `speechVowel` when it has no seq)
- `radioSnow` — Radio snow: Shortwave static with crackle and slow fading (native-Lean RadioSnow family). (instrument `radioSnow`, plays as `air` when it has no seq)
- `squelch` — Squelch bursts: Short bursts of bright noise between transmissions. (instrument `rain`, plays as `sparse` when it has no seq)
- `whistleChoir` — Whistle choir: Six-sine chorus singing the "say" text. (instrument `sineChoir`, plays as `speechVowel` when it has no seq)
- `vowelChoir` — Vowel choir: Synthetic vowel-like chord voices. (instrument `choir`, plays as `pad` when it has no seq)

### Cinematic
- `vaultedChoir` — Vaulted choir: Large slow choir chords in a big room. (instrument `choir`, plays as `pad` when it has no seq)
- `stringEnsemble` — String ensemble: Detuned ensemble chords. (instrument `silk`, plays as `pad` when it has no seq)
- `brassStabs` — Brass stabs: Bright off-beat chord stabs. (instrument `organ`, plays as `stabs` when it has no seq)
- `hornCall` — Horn call: Sustained drawbar melody line. (instrument `organ`, plays as `lead` when it has no seq)
- `timpani` — Timpani: Low tuned drum hits on the downbeats. (instrument `tom`, plays as `sparse` when it has no seq)
- `cathedralOrgan` — Cathedral organ: Held organ chords. (instrument `organ`, plays as `long` when it has no seq)
- `epicSub` — Epic sub: Round sub-bass line. (instrument `roundBass`, plays as `bass` when it has no seq)

### Keys & mallets
- `electricPiano` — Electric piano: FM tine chords on a syncopated keys rhythm. (instrument `tine`, plays as `keys` when it has no seq)
- `bells` — Bells: Inharmonic bell melody. (instrument `glass`, plays as `lead` when it has no seq)
- `celesta` — Celesta: Soft high arpeggio. (instrument `glass`, plays as `arp` when it has no seq)
- `marimba` — Marimba: Wooden-sounding arpeggio. (instrument `felt`, plays as `arp` when it has no seq)
- `musicBox` — Music box: Tiny, high mallet notes. (instrument `felt`, plays as `sparse` when it has no seq)
- `feltPiano` — Felt piano: Soft mallet melody. (instrument `felt`, plays as `lead` when it has no seq)
- `drawbarOrgan` — Drawbar organ: Sustained drawbar chords. (instrument `organ`, plays as `pad` when it has no seq)

### Strings & plucks
- `harp` — Harp: Plucked-string arpeggio. (instrument `pluck`, plays as `arp` when it has no seq)
- `nylonGuitar` — Nylon guitar: Plucked melody. (instrument `pluck`, plays as `lead` when it has no seq)
- `koto` — Koto: Bright, sparse high plucks. (instrument `pluck`, plays as `sparse` when it has no seq)
- `pluckBass` — Pluck bass: Plucked bass line. (instrument `pluck`, plays as `bass` when it has no seq)

### Bass
- `subBass` — Sub bass: Sine sub-bass line. (instrument `roundBass`, plays as `bass` when it has no seq)
- `acidLine` — Acid line: Resonant filtered saw bass. (instrument `acidBass`, plays as `bass` when it has no seq)
- `darkDrone` — Dark drone bass: Held, filtered saw on the chord root. (instrument `acidBass`, plays as `drone` when it has no seq)

### Synth
- `arpeggiator` — Arpeggiator: Classic filtered saw arpeggio. (instrument `pulse`, plays as `arp` when it has no seq)
- `stepSequencer` — Step sequencer: Two-octave hardware-style sequence. (instrument `pulse`, plays as `sequence` when it has no seq)
- `chromeLead` — Chrome lead: Bright saw melody. (instrument `pulse`, plays as `lead` when it has no seq)

### Nature & texture
- `rain` — Rain: Soft hash-noise rain. (instrument `rain`, plays as `air` when it has no seq)
- `wind` — Wind: Dark, slow noise swells. (instrument `rain`, plays as `air` when it has no seq)
- `birdCalls` — Bird calls: Short high chirps answering the melody. (instrument `glass`, plays as `answer` when it has no seq)
- `waterDrops` — Water drops: Brief high droplets. (instrument `felt`, plays as `sparse` when it has no seq)
- `tapeAir` — Tape air: Faint hiss bed. (instrument `rain`, plays as `air` when it has no seq)

### Pulse & percussion
- `heartbeat` — Heartbeat: Human lub-dub heartbeat on the downbeats (native-Lean HumanHeart family). (instrument `heartbeat`, plays as `sparse` when it has no seq)
- `clockTicks` — Clock ticks: Light metallic ticks. (instrument `hat`, plays as `arp` when it has no seq)
- `woodBlocks` — Wood blocks: Tuned rim/block pattern. (instrument `tom`, plays as `arp` when it has no seq)

### Illusions
- `impossibleAscent` — Impossible ascent: A tone that seems to rise forever. (instrument `shepard`, plays as `continuous` when it has no seq)
- `phantomRoot` — Phantom root: Harmonics only; the ear supplies the fundamental. (instrument `phantomRoot`, plays as `sparse` when it has no seq)
- `ghostPulse` — Ghost pulse: Slow acoustic beating. (instrument `ghostBeat`, plays as `air` when it has no seq)

## Instruments (use the id as `sound` for full control)

- `roundBass` — Velvet sub (Bass): A sine fundamental with a restrained second harmonic; sample-rate-aware attack/release and saturation. Range: C1–C3.
- `acidBass` — Amber ladder (Bass): Band-limited saw and sub into a moving two-integrator filter. The envelope opens the cutoff on each note. Range: C1–C3.
- `tine` — Velvet tines (Keys): Decaying frequency modulation with a soft fundamental: electric-piano-like attacks without sampled recordings. Range: C2–C6.
- `glass` — Prismatic bell (Mallet): An inharmonic FM bell with a second shimmering partial. Brightness falls with the strike envelope. Range: C2–C6.
- `pluck` — Orchard string (String): A genuinely stateful plucked delay loop: noise excitation, fractional-length string and damped feedback, not a pluck-shaped oscillator. Range: C2–C6.
- `felt` — Felt mallet (Mallet): Three slowly detuned modal partials, with a rounded transient and a deliberately quieter upper resonance. Range: C2–C6.
- `silk` — Silk ensemble (Pad): Each note is a slow detuned three-oscillator voice. Chords are separate runtime voices with independent state. Range: C2–C6.
- `choir` — Distant vowels (Pad): A synthetic vowel-like partial cluster, slowly changing between warm and hollow spectra. No voice samples. Range: C2–C6.
- `organ` — Nocturnal drawbars (Keys): Harmonic drawbar synthesis with subtle tremolo. Clean sustained chords and gentle key clicks. Range: C2–C6.
- `pulse` — Chrome sequence (Sequence): Band-limited saw shaped by a short strike envelope and a colour-dependent low-pass; suitable for long evolving arpeggios. Range: C2–C6.
- `rain` — Breathing rain (Texture): Bounded deterministic hash noise through two smoothing stages; a pitched air overtone gives the texture harmonic context. Range: C3–C5 (adds a faint pitched air tone).
- `shepard` — Impossible ascent (Psychoacoustic): A continuously rising Shepard/Risset-style stack: five octave bands climb forever while sine-shaped amplitude windows hide each octave wrap. Range: any (rises on its own).
- `phantomRoot` — Phantom root (Psychoacoustic): The fundamental is absent: only harmonics 2, 3, 4 and 5 are generated, yet the ear tends to hear the missing root pitch. Range: C2–C4 (heard pitch is the missing root).
- `ghostBeat` — Ghost beating (Psychoacoustic): Two almost coincident tones create a slow interference pulse. There is no tremolo oscillator: the amplitude motion is the acoustic beat itself. Range: C2–C4.
- `sineVox` — Three-sine voice (Vocal): A sine-wave-speech vowel source: three pure tones trace a five-vowel F1/F2/F3 space. No vocal sample, pulse train or formant filter is used. Range: speech roles only.
- `sineChoir` — Six-sine choir (Vocal): A choral extension of the three-sine voice: two slightly detuned copies of each formant trajectory create a small synthetic chorus with no sampled or pulse-train voice source. Range: speech roles only.
- `speechGesture` — Speech gestures (Vocal): A compact companion for sine-wave vowels: brief stop-like noise, nasal tones and approximant whistles selected by the event colour. Range: speech roles only.
- `kick` — Round membrane (Drums): Pitch-swept sine membrane with a separate short transient and a decay in seconds. Range: C1–C2.
- `snare` — Paper snare (Drums): Two body resonances and high-passed noise. The noise and body have different decay shapes. Range: C2–C3.
- `hat` — Metallic hat (Drums): Inharmonic oscillators blended with bright noise; closed and open hats share the source but not state or decay. Range: C6–C8.
- `clap` — Room hands (Drums): A three-burst exciter feeding a filtered-noise tail; independent state per handclap voice. Range: C3.
- `tom` — Ceramic resonator (Drums): A damped sine with an intentional downward pitch envelope plus a weak non-harmonic rim resonance; shared by three toms and the rim voice. Range: C1–C3.
- `heartbeat` — Human heartbeat (Body): A single trigger produces the lub (S1) and, after a gap set by life, the softer and higher dub (S2): squared gamma-shaped thumps with a downward pitch settle, low-passed chest noise and soft saturation. Range: A1–E2 (one note per beat; lub and dub are both built into each note).
- `orbitBlip` — Orbit beacon (Signal): A Sputnik-style radio beacon tone: driven sine into a square-ish carrier, a slightly detuned beating partial, receiver hiss and a fast click-free gate. Range: A4–C7.
- `sonar` — Sonar blup (Signal): Sonar ping with an upward pitch “blup” at the attack, colour-driven brass harmonics, and an internal damped echo whose return time shortens as colour rises. Range: C5–C7.
- `radioSnow` — Radio snow (Texture): Shortwave static: band-limited noise, sparse crackle impulses, slow two-rate fading and a faint heterodyne whistle at the note frequency. Range: any (sets a faint whistle).

## Example

A 70-second piece: a heartbeat fades in, becomes a radio beacon at 15 s with answering blips in stereo, total silence at 30–35 s, then Geiger clicks, a Morse signal, a slow choir and a monotone voice over the returning heartbeat, and a fade into radio static.

```json
{"title":"First Contact","description":"A human heartbeat fades in and quickens; at 15 seconds it becomes a Sputnik-style beacon crossing the sky, answered by blips and minor tones. At 30 seconds everything stops. Then Geiger clicks, a Morse signal and a slow synthetic choir: a monotone voice reports contact over the returning heartbeat, before the signal dissolves into radio snow.","bpm":60,"meter":"5/4","key":"E minor","rhythm":"none","seconds":70,"room":0.7,"say":"we have contact","sections":[{"name":"Heartbeat","start":0},{"name":"Beacon","start":15},{"name":"Silence","start":30},{"name":"Contact","start":35},{"name":"Radio snow","start":50}],"tracks":[{"sound":"heartbeat","label":"Heartbeat","level":0.95,"send":0.06,"transpose":0,"gate":0.06,"seq":"x@.92 x@.86 x@.95 x@.88","note":"A1","step":"0.94@0 0.81@14","to":15,"pair":{"width":0.22,"delay":0.012},"automate":{"level":"0@0 1@1.2 1@14.7 0@15.02"}},{"sound":"orbitBlip","label":"Beacon","level":0.62,"send":0.22,"colour":0.55,"life":0.04,"seq":"x:1 .","note":"B5","step":0.3,"from":15,"to":30,"automate":{"pan":"-0.75@15 0.75@30","tune":"0.5@15 -0.6@30","level":"0@14.98 1@15.04 1@29.9 0@30"}},{"sound":"orbitBlip","label":"Answering blips","level":0.34,"send":0.42,"colour":0.25,"life":0.05,"seq":". . . x . . . . G5 . . . . . x@.7 . . . . . D5 . . .","note":"E5","step":0.15,"from":18,"to":30,"pair":{"width":0.85,"delay":0.075,"seqR":". . . . . . . B4 . . . . . . . . x . . . . . F#5@.6 .","noteR":"E5","transposeR":-12},"automate":{"colour":"0.15@18 0.45@29","level":"0@18 1@21 1@29.9 0@30"}},{"sound":"silk","label":"Minor tones","level":0.3,"send":0.6,"colour":0.22,"life":3.2,"seq":"x:1","note":"E3","step":6,"from":17,"to":50,"pair":{"width":0.6,"delay":0.4,"noteR":"G3"},"automate":{"level":"0@17 1@22 1@29.9 0@30 0@35 0.8@38 0.8@48 0@51","colour":"0.1@17 0.35@29"}},{"sound":"phantomRoot","label":"Deep root","level":0.26,"pan":0,"send":0.35,"colour":0.4,"life":4,"seq":"x:1","note":"E2","step":13,"from":17,"to":50,"automate":{"level":"0@17 1@24 1@29.9 0@30 0@35 0.7@39 0.7@48 0@51","tune":"0@17 -0.3@30"}},{"sound":"radioSnow","label":"Radio snow","level":0.72,"send":0.3,"colour":0.55,"seq":"x:1","note":"F#5","step":30,"from":47,"to":68,"pair":{"width":0.9,"delay":0.37,"noteR":"C#6"},"automate":{"level":"0@47 1@53 1@62 0@69","colour":"0.25@47 0.7@60"}},{"sound":"hat","label":"Geiger counter","level":0.22,"send":0.12,"colour":0.85,"life":0.03,"gate":0.3,"seq":"x@0.90 x@0.48 . . x@.9 x@.5 . . . . . . x@0.57 . . x@0.76 . . . x@0.66 . . . . . . . x@.9 x@.5 . x@.9 x@.5 x@0.53 . x@0.91 . . . x@0.51 . . . x@0.90 x@0.57 x@.9 x@.5 . . . x@0.59 x@0.57 . x@.9 x@.5 . . x@0.89 . . . . . . . . .","note":"F#8","step":"0.11@35 0.05@48","from":35,"to":50,"automate":{"level":"0@35 1@36.5 1@48.5 0@50.5","pan":"-0.7@35 0.6@42 -0.3@50"}},{"sound":"orbitBlip","label":"Morse","level":0.24,"pan":-0.45,"send":0.5,"colour":0.3,"life":0.03,"seq":"x:3 . . . x . x:3 . . . x . . . x:3 . . . x:3 . . . x:3 . . . . . x:3 . . . x . . . x:3 . . . . . x . x:3 . . . . . x:3 . . . x . x:3 . . . x . . . x:3 . . . . .","note":"A5","step":0.085,"from":37.5,"to":50,"loop":false},{"sound":"choir","label":"Orchestron choir","level":0.42,"send":0.72,"colour":0.55,"life":3.2,"gate":1,"seq":"E3+G3+B3+E4 C3+E3+G3+B3 A2+C3+E3+A3 B2+D#3+F#3+B3","note":"E3","step":3.75,"from":35,"to":50,"automate":{"level":"0@35 1@37.5 1@47 0@50.5","colour":"0.4@35 0.7@44 0.5@50"}},{"sound":"radioChatter","label":"Vocoder voice","level":0.48,"pan":-0.08,"send":0.38,"colour":0.4,"life":1.2,"onlySections":["Contact"]},{"sound":"radioConsonants","label":"Voice consonants","level":0.26,"pan":-0.04,"send":0.2,"life":1.2,"onlySections":["Contact"]},{"sound":"heartbeat","label":"Heartbeat returns","level":0.55,"send":0.18,"transpose":0,"gate":0.06,"seq":"x@.8 x@.7","note":"A1","step":1.11,"from":38,"to":50,"automate":{"level":"0@38 1@40 1@48 0@50"}}],"automate":{"master":"1@29.97 0@30.02 0@34.98 1@35","room":"0.7@0 0.92@35","wet":"0.28@0 0.4@40"}}
```
