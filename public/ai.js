// AI composer. Claude writes a Song (song.js) from a description; Diddums validates it and plays it.
// Two routes, both usable on a phone:
//  1. Direct: the Claude API from the browser with the person's own API key (kept on this device only).
//  2. Chat app: copy a self-contained prompt into the Claude (or any chat) app, paste the reply back.
import {sounds,soundCategories,familySound} from './sounds.js';
import {compositionById} from './collection.js';
import {patterns} from './patterns.js';
import {rhythms,modes,ROLES,checkSong,songFromComposition,songFromText} from './song.js';
import {AUTOMATABLE,GLOBAL_AUTOMATABLE} from './timeline.js';

// Pinned SDK build, loaded only when someone composes with an API key.
const SDK_URL='https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm';
export const MODELS=[
 {id:'claude-opus-5-5',label:'Claude Opus 5.5 · best results'},
 {id:'claude-sonnet-5-5',label:'Claude Sonnet 5.5 · faster'},
 {id:'claude-haiku-5-5',label:'Claude Haiku 5.5 · fastest, cheapest'}
];

// Typical useful pitch ranges, so a model does not put a heartbeat at C5 or a beacon at C1.
const RANGE={roundBass:'C1–C3',acidBass:'C1–C3',heartbeat:'A1–E2 (one note per beat; lub and dub are both built into each note)',orbitBlip:'A4–C7',sonar:'C5–C7',radioSnow:'any (sets a faint whistle)',
 phantomRoot:'C2–C4 (heard pitch is the missing root)',ghostBeat:'C2–C4',shepard:'any (rises on its own)',kick:'C1–C2',snare:'C2–C3',tom:'C1–C3',hat:'C6–C8',clap:'C3',rain:'C3–C5 (adds a faint pitched air tone)',
 sineVox:'speech roles only',speechGesture:'speech roles only',sineChoir:'speech roles only',chamber:'not a note source (room effect)'};

function soundTable(){
 return soundCategories.map(cat=>`### ${cat}\n`+sounds.filter(s=>s.category===cat).map(s=>`- \`${s.id}\` — ${s.label}: ${s.about} (instrument \`${s.pattern}\`, plays as \`${s.role}\` when it has no seq)`).join('\n')).join('\n\n');
}
function familyTable(){
 return Object.values(patterns).filter(p=>p.id!=='chamber').map(p=>`- \`${p.id}\` — ${p.label}. Sounds: ${familySound[p.id]}. How it is made: ${p.about} Range: ${RANGE[p.id]||'C2–C6'}.`).join('\n');
}
// A song-shaped example: a Collection piece as a Song, with engine-internal fields removed.
export function songExample(){
 const s=songFromComposition(compositionById.lowlight);
 for(const k of ['seed','space','arpStride'])delete s[k];
 s.seconds=Math.round(s.seconds);s.tracks=s.tracks.map(({id,...t})=>t);
 return s;
}

let guideCache=null;
export function songGuide(example){
 if(guideCache)return guideCache;
 guideCache=`# Writing music for Diddums

Diddums is a browser music engine. Every sound is synthesised live by small, formally checked DSP programs (no samples). You compose by writing a **Song**: a JSON object describing tracks, notes placed in time, and automation curves. Diddums validates the JSON, schedules the notes and plays it; people can then edit it on their phone and share it as a link.

Write music that responds to what was asked for: if the request names events at particular times, place them at those times; if it describes a mood or a scene, build an arc with contrast — entrances, a change, a peak, a release. Silence and space are musical tools. Prefer a few well-chosen, well-placed sounds to many busy ones.

## Make it a song, not a loop

Most requests (“a track”, “a song”, “music for…”, a genre or a mood) want music: harmony that moves, a bass line, a melody, a pulse, and sections that build and release. Build that core from **role tracks** (B below), which follow the song's chords, and add **timed-note tracks** (A) for particular events, hooks and sound effects. A piece made only of short looping \`seq\` patterns sounds like a loop, not a song. Use timed tracks as the core only for sound design that is about exact moments (a countdown, a signal at 15 s).

A song-shaped piece:

1. Choose \`key\`, \`bpm\`, \`meter\` and a \`rhythm\` (the drum machine) that suit the style; \`"none"\` for drumless pieces.
2. Harmony: \`chords\` as scale degrees, 4–8 of them; each chord lasts two bars and the list repeats. Or exact chords in \`harmony\`.
3. \`melody\` and \`bass\`: one bar of steps (16 in 4/4, 12 in 3/4 or 6/8; only the first bar's worth is used), each a number of semitones above the current chord's root, or \`null\` for a rest. Diddums moves the pattern onto every chord. Values that are a third (3, 4, 15, 16, 27, 28) or a seventh (10, 11, 22, 23) in any octave snap to the current chord's own third or seventh, so they never clash; other values are played as written (7 and 19 are the fifth, 12 and 24 the root, 2, 5, 9, 14, 17, 21 are passing notes). The melody sounds an octave above these values. The engine varies it: bar 2 of every 4 starts four steps later in the pattern, bars 5–8 of every 8 lift some notes an octave, and the last bar of every 8 ends with a short fill. Leave either out and Diddums writes one. For a longer hook than one bar, or a different chorus tune, add a timed track: the role harmony starts at 0 s and each chord lasts two bars (2 × beats per bar × 60 / bpm seconds), so a timed melody can be lined up with it.
4. 4–6 \`sections\`, each with \`energy\` (0–1; higher is louder and busier: below 0.5 the arpeggio keeps to the beats, below 0.4 the melody does) and \`roles\`, the only kinds of role track that play in it: \`bass\`, \`pad\`, \`lead\`, \`arp\`, \`air\`, \`drums\`. Arrange by bringing parts in and out: a sparse opening, a build, a full peak, a breakdown, a return, a fade. Pick a bpm that makes bars a round number of seconds (60 or 120 bpm: 4 s or 2 s per 4/4 bar; 96 bpm: 2.5 s) so section starts are easy to place. Sections do not affect timed tracks: give those \`from\`/\`to\` or a \`level\` automation curve.
5. 3–6 role tracks: a bass, a chord instrument, a lead, and optionally an arpeggio, a texture and a voice. Role kinds: \`bass\` and \`drone\` count as bass; \`pad\`, \`keys\`, \`stabs\` and \`long\` as pad; \`arp\` and \`sequence\` as arp; \`lead\`, \`sparse\`, \`answer\` and the speech roles as lead; \`air\` and \`continuous\` as air.
6. Then add timed tracks for hooks, fills and effects, and automation for fades and sweeps.
7. Songs usually run 1.5–3 minutes; ambient pieces can be longer.

## Song fields

- \`title\`, \`description\` (one or two sentences about what happens), \`seconds\` (total length, 10–600). The length is rounded up to whole bars (one bar lasts beats-per-bar × 60 / bpm seconds: 4 s at 60 bpm in 4/4, 5 s at 60 bpm in 5/4), so choose bpm and meter that divide the length when it matters.
- \`bpm\`, \`meter\` ("4/4", "3/4", "6/8", "5/4", "7/8"), \`key\` (e.g. "E minor", "F# lydian"; modes: ${Object.keys(modes).join(', ')}).
- \`rhythm\`: the built-in drum machine pattern, or "none" for no drums. Drums play only in sections whose \`roles\` include \`drums\`; below energy 0.5 they thin out. Patterns: \`house\` four-on-the-floor kick, off-beat hats, claps at high energy; \`motorik\` the same steady four-to-the-floor drive; \`postpunk\` driving syncopated kick, backbeat snare, straight eighth hats; \`broken\` loose broken-beat/trip-hop groove; \`halftime\` slow heavy backbeat (snare on 3), rim clicks; \`shuffle\` swung hats, backbeat; \`brush\` soft jazz-brush feel, rim and light hats (suits 3/4 and 6/8); \`factory\` busy industrial kick pattern, claps and tom fills; \`euclid\` evenly spread off-kilter kicks, rims and hats; \`seven\` a 7/8 groove; \`ritual\` sparse kick every other bar with occasional toms; \`suite\` a kit that builds over 8-bar blocks.
- \`room\` 0–1 (reverb size), \`say\` (words the sine-wave speech voices speak).
- \`sections\`: [{"name", "start" (seconds), "energy" (0–1), "roles" (list)}] — named parts shown to the listener as movements. Starts are rounded to bar lines.
- \`chords\`: scale degrees 1–7 for the harmony that role-based tracks follow, e.g. [1,6,3,7]. Each chord lasts two bars.
- \`harmony\` (instead of \`chords\`): exact chords, each \`[root MIDI note 24–60, 0, third, fifth, seventh]\` in semitones above the root, e.g. \`[[36,0,3,7,10],[39,0,4,7,11]]\` (Cm7, Ebmaj7).
- \`melody\`, \`bass\`: one-bar step patterns in semitones above each chord's root, \`null\` for rests (see above).
- \`swing\` 0–0.2: delays every second sixteenth for a shuffled feel.
- \`tracks\`: up to 16 voices (a stereo pair counts as two).
- \`automate\`: whole-mix curves. \`master\` 0–1.5 (1 = normal, 0 = total silence); \`room\` (reverb size), \`damp\` (reverb darkness), \`wet\` (reverb level) and \`echo\` (echo level) all 0–0.94.

## Tracks

Each track has a \`sound\` (a sound id or an instrument id from the lists below). Then either:

**A. Timed notes** — give \`seq\`, and the track plays exactly what you write:
- \`seq\`: space-separated steps. \`x\` = the track's \`note\`; \`.\` = rest; a note name (C4 = middle C, F#3, Bb5) or MIDI number; \`C4+E4+G4\` = chord; \`@0.6\` = velocity 0–1; \`:4\` = this note sounds for 4 steps (every token still advances exactly one step, so follow a held note with rests if nothing else should start); \`*8\` = repeat the token 8 times. Example: \`"x . . x@.6 .*4 G4:2 C4+E4+G4:4"\`.
- \`note\` (default note for \`x\`), \`step\` (seconds per step, e.g. 0.25 — or a curve such as "0.9@35 0.15@50" to accelerate), \`from\` / \`to\` (seconds; the seq loops inside this window; \`loop\`: false plays it once; nothing starts at or after \`to\` and notes are cut at \`to\`), \`gate\` (how long notes without \`:N\` sound, in steps; default 0.5; \`:N\` overrides it). Without \`note\`, \`x\` is C4.

**B. Role playback** — omit \`seq\` and the sound plays its role (bass line, chords, melody, arpeggio, drone, speech…) from the song's harmony and sections. Set \`role\` to change it: ${ROLES.filter(r=>r!=='timeline').join(', ')}. Speech roles (speechVowel/speechConsonant) speak the \`say\` text. A role track plays in every section, unless the section lists \`roles\` (bass, pad, lead, arp, air, drums) that exclude its kind; \`onlySections\` / \`excludeSections\` (lists of section names) restrict it further. \`from\`, \`to\` and \`loop\` apply only to timed notes.

Both kinds accept: \`label\`, \`level\` (0–1.5), \`pan\` (−1 left … 1 right), \`send\` (reverb/echo 0–1), \`colour\` (0–1, brightness/character, instrument-specific), \`life\` (0.03–8 s, decay/release), \`transpose\` (semitones). A bare instrument id starts from level 0.4, colour 0.4, life 1.2, send 0.3; a sound id starts from its preset's values.

**Stereo pairs** — \`"pair": {"width": 0.8, "delay": 0.02, "seqR": "…", "noteR": "E5", "transposeR": 7}\` turns one track into a left and a right voice at ∓width. The right side can play its own sequence (\`seqR\`), note or transposition, and starts \`delay\` seconds later (0.01–0.03 widens a sound; 0.1–0.4 gives call-and-response or decorrelated noise).

**Automation** — \`"automate": {"level": "0@0 1@2.5 1@14.8 0@15"}\`: points are value@seconds, joined linearly; two points at the same time make an instant change. Track keys: ${AUTOMATABLE.join(', ')} (\`level\` multiplies the track level; \`tune\` is in semitones and bends all notes, good for Doppler or rising tension; \`pan\` on a pair sets its width, so to sweep a sound across the stereo field use a single track). Ranges: \`level\` 0–1.5, \`pan\` −1…1, \`send\` 0–1.5, \`colour\` 0–1, \`life\` 0.03–8 s, \`tune\` ±48 semitones. Use automation for fades, sweeps, movement and transformation: a lighthouse beam or passing craft is \`pan\` plus \`level\` on one track; a horn or engine is a low sustained \`organ\`, \`acidBass\` or \`darkDrone\` note with slow \`tune\` and \`level\` curves.

Limits: at most 16 track voices. Each track can sound at most 24 notes at once, counting each note from its start until its length plus about 1.7 × \`life\` (so a long \`life\` with fast steps piles up; a chord counts once per note); Diddums names the track if this is exceeded. At most 32768 notes in the whole song.

## Sounds (presets: an instrument plus sensible settings)

${soundTable()}

## Instruments (use the id as \`sound\` for full control)

${familyTable()}

## Examples

### A song

Low-Light, from the Diddums collection: four role tracks over a four-chord progression, with a written melody and bass, six sections that bring the bass, arpeggio and drums in and out, and a “broken” drum pattern.

\`\`\`json
${JSON.stringify(songExample())}
\`\`\`

### Timed sound design

A 70-second piece: a heartbeat fades in, becomes a radio beacon at 15 s with answering blips in stereo, total silence at 30–35 s, then Geiger clicks, a Morse signal, a slow choir and a monotone voice over the returning heartbeat, and a fade into radio static.

\`\`\`json
${JSON.stringify(example)}
\`\`\`

Return one Song JSON object.`;
 return guideCache;
}

function request(prompt,base){
 return (base?`Here is the current song:\n\n\`\`\`json\n${JSON.stringify(base)}\n\`\`\`\n\nChange it as follows, keeping what works: ${prompt}\n\nReturn the complete updated song.`:`Compose a song for this request: ${prompt}`)+'\n\nReply with only the Song JSON object.';
}
const problemNote=problems=>`Diddums could not use parts of that song:\n${problems.map(p=>'- '+p).join('\n')}\n\nReturn the complete corrected song.`;

// Self-contained text for a chat app (Claude, or another assistant): instructions + request + reply format.
export function chatPrompt(prompt,base,example){
 return `${songGuide(example)}\n\n---\n\n${request(prompt,base)}`;
}
export function songFromReply(text){const song=songFromText(text);return {song,problems:checkSong(song).problems};}

// Direct API route. Returns {song, problems, model}; throws an Error with a person-readable message.
export async function composeWithClaude({apiKey,model='claude-opus-5-5',prompt,base=null,example,onProgress=()=>{},signal}){
 if(!apiKey)throw new Error('Add your Anthropic API key first.');
 onProgress({phase:'loading'});
 const mod=await import(SDK_URL),Anthropic=mod.default;
 const client=new Anthropic({apiKey,dangerouslyAllowBrowser:true,maxRetries:2});
 const system=[{type:'text',text:songGuide(example),cache_control:{type:'ephemeral'}}];
 const messages=[{role:'user',content:request(prompt,base)}];
 let last=null;
 for(let attempt=0;attempt<2;attempt++){
  // No structured-output schema: the API limits those to 24 optional parameters and a Song has more. The guide
  // describes the format, the reply is parsed leniently and checkSong() feeds any problems back for one repair.
  const params={model,max_tokens:32000,system,messages,thinking:{type:'adaptive'},output_config:{effort:'medium'}};
  // Server-side fallback re-runs a safety-classifier decline on a suitable model (not offered for Haiku).
  if(model!=='claude-haiku-5-5')Object.assign(params,{betas:['server-side-fallback-2026-07-01'],fallbacks:'default'});
  let chars=0;
  let msg;
  try{
   const stream=client.beta.messages.stream(params,{signal});
   onProgress({phase:attempt?'repairing':'composing',chars});
   stream.on('text',d=>{chars+=d.length;onProgress({phase:attempt?'repairing':'composing',chars});});
   msg=await stream.finalMessage();
  }catch(e){
   if(e instanceof Anthropic.AuthenticationError)throw new Error('The API key was not accepted. Check it in settings.');
   if(e instanceof Anthropic.PermissionDeniedError)throw new Error('This API key cannot use '+model+'.');
   if(e instanceof Anthropic.RateLimitError)throw new Error('Rate limited by the API. Wait a moment and try again.');
   if(e instanceof Anthropic.APIUserAbortError||e?.name==='AbortError')throw new Error('Stopped.');
   if(e instanceof Anthropic.APIConnectionError)throw new Error('Could not reach the Claude API. Check the connection.');
   if(e instanceof Anthropic.APIError)throw new Error('Claude API error '+(e.status||'')+': '+(e.error?.error?.message||e.message));
   throw e;
  }
  if(msg.stop_reason==='refusal')throw new Error('Claude declined this request'+(msg.stop_details?.explanation?': '+msg.stop_details.explanation:'.'));
  if(msg.stop_reason==='max_tokens')throw new Error('The song was too long to finish. Ask for something shorter or simpler.');
  const text=msg.content.filter(b=>b.type==='text').map(b=>b.text).join('');
  let song,problems;try{song=songFromText(text);({problems}=checkSong(song));}catch(e){song=null;problems=['The reply was not a single Song JSON object ('+e.message+'). Reply with only the JSON object.'];}
  last={song,problems,model:msg.model};
  if(song&&!problems.length)return last;
  // One repair round: show Claude exactly what Diddums rejected. The full assistant content is appended unchanged.
  messages.push({role:'assistant',content:msg.content},{role:'user',content:problemNote(problems)});
 }
 if(!last.song)throw new Error('Claude did not return a usable Song. Try again, or rephrase the request.');
 return last;
}

export function exampleSong(composition){const s=songFromComposition(composition);delete s.harmony;delete s.melody;delete s.bass;delete s.space;delete s.speech;delete s.drumKit;delete s.arpStride;delete s.seed;
 for(const sec of s.sections||[]){delete sec.roles;delete sec.energy;}for(const t of s.tracks)delete t.id;return s;}
