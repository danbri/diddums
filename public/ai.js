// AI composer. Claude writes a Song (song.js) from a description; Diddums validates it and plays it.
// Two routes, both usable on a phone:
//  1. Direct: the Claude API from the browser with the person's own API key (kept on this device only).
//  2. Chat app: copy a self-contained prompt into the Claude (or any chat) app, paste the reply back.
import {sounds,soundCategories} from './sounds.js';
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
 return Object.values(patterns).filter(p=>p.id!=='chamber').map(p=>`- \`${p.id}\` — ${p.label} (${p.family}): ${p.about} Range: ${RANGE[p.id]||'C2–C6'}.`).join('\n');
}

let guideCache=null;
export function songGuide(example){
 if(guideCache)return guideCache;
 guideCache=`# Writing music for Diddums

Diddums is a browser music engine. Every sound is synthesised live by small, formally checked DSP programs (no samples). You compose by writing a **Song**: a JSON object describing tracks, notes placed in time, and automation curves. Diddums validates the JSON, schedules the notes and plays it; people can then edit it on their phone and share it as a link.

Write music that responds to what was asked for: if the request names events at particular times, place them at those times; if it describes a mood or a scene, build an arc with contrast — entrances, a change, a peak, a release. Silence and space are musical tools. Prefer a few well-chosen, well-placed sounds to many busy ones.

## Song fields

- \`title\`, \`description\` (one or two sentences about what happens), \`seconds\` (total length, 10–600).
- \`bpm\`, \`meter\` ("4/4", "3/4", "6/8", "5/4", "7/8"), \`key\` (e.g. "E minor", "F# lydian"; modes: ${Object.keys(modes).join(', ')}).
- \`rhythm\`: the built-in drum machine pattern, or "none" for no drums. Options: ${rhythms.join(', ')}.
- \`room\` 0–1 (reverb size), \`say\` (words the sine-wave speech voices speak).
- \`sections\`: [{"name", "start" (seconds)}] — named parts shown to the listener as movements.
- \`chords\`: scale degrees 1–7 for the harmony that role-based tracks follow, e.g. [1,6,3,7].
- \`tracks\`: up to 16 voices (a stereo pair counts as two).
- \`automate\`: whole-mix curves: ${GLOBAL_AUTOMATABLE.join(', ')}. \`master\` 0 means total silence.

## Tracks

Each track has a \`sound\` (a sound id or an instrument id from the lists below). Then either:

**A. Timed notes** — give \`seq\`, and the track plays exactly what you write:
- \`seq\`: space-separated steps. \`x\` = the track's \`note\`; \`.\` = rest; a note name (C4 = middle C, F#3, Bb5) or MIDI number; \`C4+E4+G4\` = chord; \`@0.6\` = velocity 0–1; \`:4\` = hold for 4 steps; \`*8\` = repeat the token 8 times. Example: \`"x . . x@.6 .*4 G4:2 C4+E4+G4:4"\`.
- \`note\` (default note for \`x\`), \`step\` (seconds per step, e.g. 0.25 — or a curve such as "0.9@35 0.15@50" to accelerate), \`from\` / \`to\` (seconds; the seq loops inside this window; \`loop\`: false plays it once), \`gate\` (how long each note sounds, in steps; default 0.5).

**B. Role playback** — omit \`seq\` and the sound plays its role (bass line, chords, melody, arpeggio, drone, speech…) from the song's harmony and sections. Set \`role\` to change it: ${ROLES.filter(r=>r!=='timeline').join(', ')}. Speech roles (speechVowel/speechConsonant) speak the \`say\` text.

Both kinds accept: \`label\`, \`level\` (0–1.5), \`pan\` (−1 left … 1 right), \`send\` (reverb/echo 0–1), \`colour\` (0–1, brightness/character, instrument-specific), \`life\` (0.03–8 s, decay/release), \`transpose\` (semitones).

**Stereo pairs** — \`"pair": {"width": 0.8, "delay": 0.02, "seqR": "…", "noteR": "E5", "transposeR": 7}\` turns one track into a left and a right voice at ∓width. The right side can play its own sequence (\`seqR\`), note or transposition, and starts \`delay\` seconds later (0.01–0.03 widens a sound; 0.1–0.4 gives call-and-response or decorrelated noise).

**Automation** — \`"automate": {"level": "0@0 1@2.5 1@14.8 0@15"}\`: points are value@seconds, joined linearly; two points at the same time make an instant change. Track keys: ${AUTOMATABLE.join(', ')} (\`level\` multiplies the track level; \`tune\` is in semitones and bends all notes, good for Doppler or rising tension; \`pan\` on a pair sets its width). Use automation for fades, sweeps, movement and transformation.

Limits: at most 16 track voices; a single track should not hold more than about 20 overlapping notes (long \`life\` with fast steps piles up); keep total notes under ~8000.

## Sounds (presets: an instrument plus sensible settings)

${soundTable()}

## Instruments (use the id as \`sound\` for full control)

${familyTable()}

## Example

A 70-second piece: a heartbeat fades in, becomes a radio beacon at 15 s with answering blips in stereo, total silence at 30–35 s, then an accelerating sonar contact and a fade into radio static.

\`\`\`json
${JSON.stringify(example)}
\`\`\`

Return one Song JSON object.`;
 return guideCache;
}

// JSON Schema for structured outputs (no numeric bounds: song.js clamps values and reports problems).
const curve={type:'string',description:'value@seconds points, e.g. "0@0 1@2 1@14 0@15"'};
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const soundIds=[...new Set([...sounds.map(s=>s.id),...Object.keys(patterns).filter(k=>k!=='chamber')])];
export const SONG_SCHEMA=obj({
 title:{type:'string'},description:{type:'string'},seconds:{type:'number'},bpm:{type:'number'},meter:{type:'string',enum:['4/4','3/4','5/4','6/8','7/8']},key:{type:'string'},
 rhythm:{type:'string',enum:rhythms},room:{type:'number'},say:{type:'string'},chords:{type:'array',items:{type:'integer'}},
 sections:{type:'array',items:obj({name:{type:'string'},start:{type:'number'}},['name','start'])},
 automate:obj(Object.fromEntries(GLOBAL_AUTOMATABLE.map(k=>[k,curve]))),
 tracks:{type:'array',items:obj({
  sound:{type:'string',enum:soundIds},label:{type:'string'},role:{type:'string',enum:ROLES.filter(r=>r!=='timeline')},
  seq:{type:'string'},note:{type:'string'},step:{type:'string',description:'seconds per step, e.g. "0.25", or a curve'},from:{type:'number'},to:{type:'number'},gate:{type:'number'},loop:{type:'boolean'},
  level:{type:'number'},pan:{type:'number'},send:{type:'number'},colour:{type:'number'},life:{type:'number'},transpose:{type:'number'},
  pair:obj({width:{type:'number'},delay:{type:'number'},seqR:{type:'string'},noteR:{type:'string'},transposeR:{type:'number'}}),
  automate:obj(Object.fromEntries(AUTOMATABLE.map(k=>[k,curve])))
 },['sound'])}
},['title','description','seconds','tracks']);

function request(prompt,base){
 return base?`Here is the current song:\n\n\`\`\`json\n${JSON.stringify(base)}\n\`\`\`\n\nChange it as follows, keeping what works: ${prompt}\n\nReturn the complete updated song.`:`Compose a song for this request: ${prompt}`;
}
const problemNote=problems=>`Diddums could not use parts of that song:\n${problems.map(p=>'- '+p).join('\n')}\n\nReturn the complete corrected song.`;

// Self-contained text for a chat app (Claude, or another assistant): instructions + request + reply format.
export function chatPrompt(prompt,base,example){
 return `${songGuide(example)}\n\n---\n\n${request(prompt,base)}\n\nReply with only the Song JSON object, no other text, so it can be pasted straight into Diddums.`;
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
  const params={model,max_tokens:32000,system,messages,thinking:{type:'adaptive'},output_config:{effort:'medium',format:{type:'json_schema',schema:SONG_SCHEMA}}};
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
  let song;try{song=JSON.parse(text);}catch{throw new Error('Claude returned something that is not a Song.');}
  const {problems}=checkSong(song);
  last={song,problems,model:msg.model};
  if(!problems.length)return last;
  // One repair round: show Claude exactly what Diddums rejected. The full assistant content is appended unchanged.
  messages.push({role:'assistant',content:msg.content},{role:'user',content:problemNote(problems)});
 }
 return last;
}

export function exampleSong(composition){const s=songFromComposition(composition);delete s.harmony;delete s.melody;delete s.bass;delete s.space;delete s.speech;delete s.drumKit;delete s.arpStride;delete s.seed;
 for(const sec of s.sections||[]){delete sec.roles;delete sec.energy;}for(const t of s.tracks)delete t.id;return s;}
