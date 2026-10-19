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

Not done yet: tempo changes, transition fills between states, a mood map stored inside the Song so the whole adaptive score is one document, and packaging for game engines (it needs a browser; the instruments are WebAssembly, the scheduler is JavaScript).

### Mapping game meaning to music

Keep the game reporting what things *mean*; keep musical decisions in the plan and in one table of events. Three channels, each with a different reaction time:

| Channel | Use it for | Reaction | Mechanism |
|---|---|---|---|
| State | Situations that last: danger, safety, stealth, power, morale, progress | Next bar line | \`set()\` → \`plan()\` |
| Event | Moments: a success, a mistake, a pickup, being seen, a choice | Next 16th or beat | \`hit()\` |
| Mix | Bodily or continuous signals: health, proximity, breath | Immediate | \`control()\` |

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

## Sources

The DSP source of every instrument is public: \`${SITE}lean/patterns/<instrument id>.lean\` (for example ${SITE}lean/patterns/felt.lean), and ${SITE}?pattern=<instrument id> opens its definition in the app.
`;
fs.mkdirSync(path.join(root,'skill'),{recursive:true});
fs.writeFileSync(path.join(root,'skill','SKILL.md'),skill);
fs.writeFileSync(path.join(root,'llms.txt'),`# Diddums

> A browser music workstation. Every sound is synthesised live by small DSP programs. Pieces are JSON "Songs" that can be opened from a link.

- [Diddums song skill](${SITE}skill/SKILL.md): how to compose a Song and turn it into a playable ${SITE}?song=… link. Provider-neutral; usable by any LLM or agent.
- [Example song](${SITE}?piece=lowlight): Low-Light, a two-minute role-based piece.
- [Example sound design](${SITE}?piece=firstcontact): First Contact, 70 seconds.
- [Adaptive game music demo](${SITE}game.html): an endless score re-arranged from game state, with in-key event sounds.
- [Source](https://github.com/danbri/diddums)
`);
console.log('wrote skill/SKILL.md ('+skill.length+' chars) and llms.txt');
