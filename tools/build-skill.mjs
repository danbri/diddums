#!/usr/bin/env node
// Writes public/skill/SKILL.md and public/llms.txt: a provider-neutral description of the Diddums Song
// format for any LLM or agent, built from the same sound/instrument lists and guide the app uses.
// Run after changing sounds.js, patterns.js, song.js or the First Contact example: node tools/build-skill.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','public');
const {songGuide,exampleSong}=await import(path.join(root,'ai.js'));
const {compositionById}=await import(path.join(root,'collection.js'));
const SITE='https://danbri.github.io/diddums/';
const {GENERATED}=await import(path.join(root,'families.js'));
const genCats=[...new Set(GENERATED.map(g=>g[2]))];
const instruments=`# Diddums instruments: the generated families

${GENERATED.length} LeanDSP instrument programs generated from synthesis archetypes (modal, waveguide, FM, subtractive, additive, wavefolding, formant, noise, chip and others), screened by rendering, and built by the native Lean 4.34 toolchain. Each is its own program, not a preset of another. Use any id below as a track's \`sound\`; without \`seq\` it plays the default part shown. Sources: ${SITE}lean/families/src/<id>.lean

`+genCats.map(c=>`## ${c}\n\n`+GENERATED.filter(g=>g[2]===c).map(([id,label,,s,role])=>`- \`${id}\` — ${label}. ${s}. Default part: ${role}.`).join('\n')).join('\n\n')+'\n';
const guide=songGuide(exampleSong(compositionById.firstcontact)).replace(/\n\nReturn one Song JSON object\.$/,'');
const skill=`---
name: diddums-song
description: Compose music, soundscapes and sound-design pieces for Diddums, a browser synthesiser, and hand back a link that plays them. Use when someone asks for a piece, ambience or sound effect sequence they can listen to in a browser.
---

# Diddums songs

You write a **Song** (JSON, described below) and give the person a link. Opening the link plays the piece at ${SITE}, where it can also be edited and shared. No account, key or install is needed.

## What kind of music system this is

Diddums is a small browser music engine with four layers. Knowing which one to use is most of the skill.

1. **Instruments synthesised live, no samples.** Every sound is a short DSP program written in LeanDSP (a DSP language embedded in Lean 4), compiled to WebAssembly and pinned by hash. A "piano" is a felt-mallet synth and a "choir" is a cluster of vowel-like partials, not recordings. Sine-wave speech voices can speak words.
2. **A rule-based arranger.** A Song can describe music rather than list notes: a chord progression, one-bar melody and bass patterns, tracks with *roles* (bass, chords, arpeggio, melody, texture, voice) and sections with an energy level and the roles that play in them. A deterministic score generator turns that into notes: it moves the patterns onto each chord, makes thirds and sevenths follow the chord, thins or fills parts by energy, adds phrase-end fills and picks drum patterns. This is procedural music in the older, pre-machine-learning sense: rules, not randomness or a trained model.
3. **Exact, DAW-style placement.** Timed-note tracks (\`seq\`) put notes at given times, with automation curves for any parameter and stereo pairs. Standard MIDI files can be opened in Labs (General MIDI instruments map to the nearest Diddums sound, channel 10 to the drum instruments) and any song can be downloaded as MIDI.
4. **An adaptive engine for games** (\`adaptive.js\`), described at the end of this page: an endless piece re-arranged a couple of bars ahead from live game state, with in-key event sounds a sixteenth note after the event.

It is not a sample-based DAW and not a live-coding environment: a Song is data that is compiled into notes, not a program that runs.

## Delivering the result

1. Write the Song JSON. Leave out every optional field you do not need; shorter is better.
2. Build the link: \`${SITE}?song=\` followed by the JSON percent-encoded exactly as JavaScript \`encodeURIComponent\` does it (letters, digits and \`- _ . ! ~ * ' ( )\` stay; everything else, including spaces, quotes, braces, \`#\`, \`+\`, \`@\`, \`:\` and \`,\`, becomes \`%XX\`).
3. The whole link must stay under **8000 characters** (the host rejects longer ones). If it would be longer, simplify: fewer tracks, fewer automation points, shorter timed patterns. Role tracks cost almost nothing in length, so a song built on them fits easily.
4. Give the link on its own line, as plain text.
5. If you cannot produce a correct link (no way to percent-encode reliably, or it is too long), give the Song JSON instead and tell the person: open ${SITE}, choose **Labs**, type any short description in the text box, tap **Copy prompt for any AI assistant**, then paste the JSON into the reply box that appears and tap **Use this song**.

${guide.replace(/^# Writing music for Diddums\n\n/,'')}

## Before answering

Check: every track has a \`sound\` from the lists above; every \`seq\` uses only the tokens described; times in automation and \`from\`/\`to\` fall inside \`seconds\`; a song-like request has role tracks, chords and sections.

## Adaptive music for games

What exists now (a working demo, not yet a packaged library): ${SITE}game.html, source in \`adaptive.js\` and \`game.js\`.

- \`startAdaptive({composition, plan})\` starts an endless piece. \`composition\` is an ordinary Song compiled with \`compositionFromSong\`; its tracks are the palette.
- The game calls \`music.set(state)\` whenever its state changes, with game meanings such as \`{threat: 0.7, health: 0.3, power: false, level: 2}\`. A \`plan(state)\` function written by the composer turns that into an arrangement: which tracks play, the drum pattern, energy, chords, melody and bass. Changes take effect from the next bar line, because the engine writes notes two bars ahead using the same score rules as everything else.
- \`music.hit(track, {tones, octave, grid, spread})\` plays an event sound: notes are chord tones of the chord playing at that moment (0 root, 1 third, 2 fifth, 3 seventh, +4 per octave), placed on the next 16th note (\`grid: 4\` waits for the next beat). They are heard about 0.1–0.17 s after the event in a browser, always in key and in time.
- \`music.control(trackId, key, value)\` changes a mix parameter at once: level, pan, send, colour (tone), life (decay). The demo raises a heartbeat as health falls this way.

The demo's own plan, as a worked example. Threat (hunters chasing, nearest distance) adds parts one at a time: drone and a process layer when unseen, sub bass and a sparse kit when watched, then arpeggio, acid bass, saw lead and harder drums. Health below half drops the bell melody and saw lead; near death the chords turn to a flat-second progression over a halftime beat and a heartbeat rises. Power switches to a heroic progression and a house beat; shelter settles everything. Each level is a different idiom: night synth (A minor), hijaz (D, koto isorhythm, clave), pentatonic phasing (E, marimba, bembé), octatonic (F, Amen breaks), whole-tone (C, bell cloud), pelog (G). Melodies are written as scale degrees so each idiom keeps to its own notes. Pickups, gems, fruit, alarms, impacts and level changes are \`hit()\` calls. The characters follow Heider and Simmel's 1944 film (a circle, two triangles, a house); on touch screens movement is a relative trackpad so the thumb never covers the view.

### Characters, transitions and expression

A second demo, ${SITE}scene.html (source \`scene.js\`), puts characters over a running scene. All of this is in \`adaptive.js\` and \`motif.js\`; \`tools/adaptive/test.mjs\` renders each feature offline through the same worklet and checks it.

- **Characters.** \`startAdaptive({..., characters: {mentor: {track: 'mentor', motif: [0, null, 2, null, 4, …]}}})\`. A motif is written in scale degrees (0 = chord root, null = rest, one entry per 16th). \`music.enter('mentor', {state})\`, \`music.leave('mentor')\` and \`music.setCharacter('mentor', {power, mood, stability, health})\` take effect at the next bar line; the scene's own tracks are unchanged note for note. A character's instrument is a track of the composition, so it is loaded at start.
- **State → treatment.** \`STATE_OPS\` in \`motif.js\` is an editable table. Defaults: sad (mood below −0.3) plays twice as slow in a darker mode (minor → phrygian; major → minor) with rubato, a rising motif inverted to fall; happy brightens the mode; powerless (power below 0.5) plays only the first two or three notes, an octave up, quieter, dropping notes; powerful plays an octave down with accents; unstable (stability below 0.75) wobbles and drifts in pitch and plays loosely; ill (health below 0.6) is muffled and drops notes. States combine.
- **Motif operations** on their own: \`transform(motif, {transpose, invert, retrograde, augment, fragment, displace, drop, mode, octave}, scale)\`.
- **Expression controls, immediate:** \`music.control(id, 'wobble', {depth, rate})\` (semitones, Hz), \`'drift'\` (semitones of random walk), \`'muffle'\` (0–1 low-pass: through a wall, underwater, dazed). \`id\` can be a track, a character, \`'scene'\`, \`'drums'\` or \`'characters'\`.
- **Ducking:** \`music.duck({by: 'mentor', targets: 'scene', amount: 0.6, release: 0.4})\` lowers the targets while the character's notes sound; \`amount: 0\` removes it.
- **Tempo:** a plan may return \`tempo\` (and \`tempoRamp\` in bars); \`music.tempoTo(bpm, {ramp})\` does the same directly. Bar lines, \`hit()\` timing and events follow the tempo map. A plan's \`rubato\` (0–1) bends time inside each bar for the whole scene.
- **Feel per layer:** \`feel: {arp: {looseness: 40, swing: 0.1, accents: [1, 0.6], rubato: 0.3}}\` at start, or \`music.feel(track, {...})\` later (ms of timing jitter, extra swing in beats, a repeating velocity pattern or \`'random'\`, per-bar rubato).
- **Transitions:** \`music.set(state, {transition: 'fill' | 'pickup' | 'crossfade' | 'cut', beats: 2})\`, or return \`transition\` from the plan, or pass \`transitions: (prev, next) => …\` to choose per pair of states. Fill, pickup and cut play out in the next bar and the new arrangement starts after it; a crossfade starts at the next bar and fades leaving layers out and entering layers in over the given beats.

Not done yet: a mood map stored inside the Song so the whole adaptive score is one document, and packaging for game engines (it needs a browser or another WebAssembly host; the scheduler is JavaScript).

### Mapping game meaning to music

Keep the game reporting what things *mean*; keep musical decisions in the plan and in one table of events. Three channels, each with a different reaction time:

| Channel | Use it for | Reaction | Mechanism |
|---|---|---|---|
| State | Situations that last: danger, safety, stealth, power, morale, progress | Next bar line | \`set()\` → \`plan()\` |
| Event | Moments: a success, a mistake, a pickup, being seen, a choice | Next 16th or beat | \`hit()\` |
| Mix | Bodily or continuous signals: health, proximity, breath | Immediate | \`control()\`, \`duck()\` |
| Character | Who is present and how they are: power, mood, stability, health | Next bar line | \`enter()\`, \`setCharacter()\` |

Map each game meaning onto a small set of musical dimensions, and keep the mapping consistent so players learn it:

| Game meaning | Musical dimension | Concrete choices |
|---|---|---|
| Threat, pursuit | Density and drive | Add layers one threshold at a time (drone → sub bass → arpeggio → acid bass → stabs); harder drum patterns; higher energy |
| Safety, low threat | Space | Fewer layers, no drums, long decays, more reverb send |
| Health, resources | Harmonic colour and register | Healthy: plain minor or major progressions; low: flat-second progression (i–♭II), halftime beat, pad replaced by a low drone, heartbeat level rising |
| Power, confidence | Contour and brass | Rising melody with wide leaps, brass stabs, a heroic progression (i–VI–VII–i), four-on-the-floor |
| Stealth, caution | Restraint | Drumless or sparse kit, plucked high notes, softer dynamics, low register |
| Progress, level | Key and orchestration | Modulate (the demo moves A minor → C minor → G minor…), add a new colour per level |

Events follow the same logic at the scale of a beat:

| Event | Tones and timing |
|---|---|
| Small success (pickup, hit landed) | One consonant chord tone on the next 16th; consecutive successes climb the chord (root, third, fifth, octave…) so a streak becomes an arpeggio |
| Big success (level, boss) | A rising phrase on the beat (root–third–fifth–octave), plus a low impact |
| Mistake, damage | A low impact on the root, with a falling or flat-second figure; no reward tone |
| Being noticed | A single bright ping on the beat (\`grid: 4\`), so it sounds like a signal rather than an accident |
| Failure, game over | A slow falling phrase (\`spread: 3\` or more) over a cut to sparse layers |

**Choices** (cautious or brave, kind or cruel) work best as both an event and a lingering stance. At the moment of choice, play an event: a cautious choice resolves (root, soft, long), a brave one leaps (fifth to octave, accented, perhaps a one-bar fill). Then add a stance value to the state, decaying over the next 8–16 bars, which biases the plan: brave adds energy and a forward layer such as an arpeggio or brass; cautious removes drums and widens the space. For longer arcs, keep a running *morale* (successes add, mistakes subtract, both decay slowly) and let it choose between progressions, so a run of mistakes darkens the harmony gradually rather than in one jump.

## More instruments

Beyond the instruments above there are ${GENERATED.length} more LeanDSP instruments generated from synthesis archetypes (${genCats.join(', ')}). The full list, with how each sounds and the part it plays by default, is at ${SITE}skill/INSTRUMENTS.md. Use any of those ids as \`sound\`. Read that list when the request needs a specific timbre (a sitar, a clarinet, a gong, a chip-tune pulse) that the sounds above do not cover.

## Sources

The DSP source of every instrument is public: \`${SITE}lean/patterns/<instrument id>.lean\` (for example ${SITE}lean/patterns/felt.lean), and ${SITE}?pattern=<instrument id> opens its definition in the app.
`;
fs.mkdirSync(path.join(root,'skill'),{recursive:true});
fs.writeFileSync(path.join(root,'skill','SKILL.md'),skill);
fs.writeFileSync(path.join(root,'skill','INSTRUMENTS.md'),instruments);
fs.writeFileSync(path.join(root,'llms.txt'),`# Diddums

> A browser music workstation. Every sound is synthesised live by small DSP programs. Pieces are JSON "Songs" that can be opened from a link.

- [Diddums song skill](${SITE}skill/SKILL.md): how to compose a Song and turn it into a playable ${SITE}?song=… link. Provider-neutral; usable by any LLM or agent.
- [Example song](${SITE}?piece=lowlight): Low-Light, a two-minute role-based piece.
- [Example sound design](${SITE}?piece=firstcontact): First Contact, 70 seconds.
- [Generated instruments](${SITE}skill/INSTRUMENTS.md): ${GENERATED.length} more LeanDSP instrument programs, by category.
- [Adaptive game music demo](${SITE}game.html): an endless score re-arranged from game state, with in-key event sounds.
- [Characters in a scene](${SITE}scene.html): characters enter a running scene, each motif treated according to the character's state.
- [Source](https://github.com/danbri/diddums)
`);
console.log('wrote skill/SKILL.md ('+skill.length+' chars) and llms.txt');
