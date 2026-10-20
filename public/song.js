// Song JSON: the one editable, shareable description of a piece. The Make tab edits it, Claude writes it,
// and links carry it. compositionFromSong() expands it into an ordinary Diddums composition.
//
// {title, description, prompt, bpm, meter:"4/4", key:"E minor", rhythm:"none", seconds, room, say, seed,
//  sections:[{name, start}], chords:[1,6,3,7], harmony, melody, bass, automate:{master:"…"},
//  tracks:[{sound, label, role, seq, note, step, from, to, gate, loop, level, pan, send, colour, life,
//           transpose, pair:{width, delay, seqR, noteR, transposeR}, automate:{level:"0@0 1@2", …}}]}
//
// A track with `seq` is placed in seconds (timeline.js); a track without one plays its sound's role
// (bass line, chords, melody, drone, speech…) from the song's harmony.
import {sounds,soundById} from './sounds.js';
import {patterns} from './patterns.js';
import {makeSession} from './score.js';
import {AUTOMATABLE,GLOBAL_AUTOMATABLE,parseCurve,parseSequence,parseNote} from './timeline.js';

export const SONG_SCHEMA_ID='diddums-song/1';
export const MAX_TRACKS=16; // studio-worklet.js accepts at most 16 tracks per session (a stereo pair uses two)
export const MAX_SECONDS=600;
export const rhythms=['none','brush','halftime','broken','shuffle','house','motorik','postpunk','factory','euclid','seven','ritual','suite','clave','bembe','dembow','amen','ska','reggae','glam','rock','metal','disco','motown','punk','waltz','stomp','bossa','dnb','funk','train'];
export const ROLES=['bass','drone','pad','long','keys','stabs','arp','sequence','lead','sparse','answer','air','continuous','speechVowel','speechConsonant','ostinato','euclid','phase','canon','tintinnabuli','cloud','timeline'];
export const modes={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11],dorian:[0,2,3,5,7,9,10],lydian:[0,2,4,6,7,9,11],phrygian:[0,1,3,5,7,8,10],mixolydian:[0,2,4,5,7,9,10],
 // Beyond the church modes. Chords stack every other scale note, so five- and six-note scales give
 // open, quartal or whole-tone chords rather than ordinary triads.
 locrian:[0,1,3,5,6,8,10],harmonic:[0,2,3,5,7,8,11],hijaz:[0,1,4,5,7,8,10],acoustic:[0,2,4,6,7,9,10],
 pentatonic:[0,3,5,7,10],yo:[0,2,5,7,9],hirajoshi:[0,2,3,7,8],pelog:[0,1,3,7,8],blues:[0,3,5,6,7,10],wholetone:[0,2,4,6,8,10],octatonic:[0,2,3,5,6,8,9,11]};
const progressions={locrian:[[1,2,1,7]],harmonic:[[1,4,5,1],[1,6,4,5]],hijaz:[[1,2,1,7],[1,4,2,1]],acoustic:[[1,2,1,7]],pentatonic:[[1,4,3,5],[1,2,4,1]],yo:[[1,4,2,5],[1,3,4,1]],hirajoshi:[[1,4,1,5]],pelog:[[1,4,5,1]],blues:[[1,3,1,4]],wholetone:[[1,2,3,4]],octatonic:[[1,3,5,7]],minor:[[1,6,3,7],[1,4,6,5],[1,7,6,7],[1,6,4,5]],major:[[1,5,6,4],[1,4,6,5],[1,6,4,5]],dorian:[[1,4,1,7],[1,2,4,1]],lydian:[[1,2,1,7],[1,2,5,1]],phrygian:[[1,2,1,7],[1,2,7,1]],mixolydian:[[1,7,4,1],[1,4,7,4]]};
const NOTE={c:0,d:2,e:4,f:5,g:7,a:9,b:11};
const PC_NAME=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
export const DEFAULT_NAMES=['Opening','Rising','Bloom','Hush','Peak','Fade'];
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const num=(v,d,a,b)=>{const n=Number(v);return v!==''&&v!=null&&Number.isFinite(n)?clamp(n,a,b):d;};
export function hash(text){let h=2166136261;for(const ch of String(text)){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function rng(seed){let s=seed|0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}

export function parseKey(text){
 const m=String(text||'').trim().toLowerCase().match(/^([a-g])\s*(#|♯|b(?![a-z])|♭|-?sharp|-?flat)?\s*(.*)$/);
 if(!m)return null;
 let pc=NOTE[m[1]];if(m[2])pc+=/#|♯|sharp/.test(m[2])?1:-1;
 const rest=m[3].trim(),mode=rest.startsWith('maj')||rest==='ionian'?'major':rest.startsWith('min')||rest==='m'||rest==='aeolian'?'minor':Object.keys(modes).find(k=>rest.startsWith(k))||(rest?null:'major');
 return mode?{pc:(pc+12)%12,mode}:null;
}
export const keyName=(pc,mode)=>`${PC_NAME[pc]} ${mode}`;
export const parseMeter=m=>{if(Array.isArray(m))return [clamp(m[0]|0,2,15),m[1]===8?8:4];const x=String(m||'4/4').match(/^(\d{1,2})\/(4|8)$/);return x?[clamp(+x[1],2,15),+x[2]]:[4,4];};

// "say" text → sine-wave-speech syllables. Coarse by design: one onset consonant, one of five vowels, optional coda.
const CMAP={c:'k',q:'k',x:'k',z:'s',y:'j'},DIGRAPH={th:'t',sh:'s',ch:'k',ph:'f',wh:'w',ck:'k',ng:'n',qu:'k',gh:'g'};
const VMAP={ee:'i',ea:'i',ie:'i',oo:'u',ou:'u',ue:'u',ew:'u',ai:'e',ay:'e',ei:'e',oa:'o',oe:'o',au:'o',aw:'o'};
const consonant=run=>run?DIGRAPH[run.slice(0,2)]||CMAP[run[0]]||run[0]:undefined;
const tailConsonant=run=>run?DIGRAPH[run.slice(-2)]||CMAP[run.at(-1)]||run.at(-1):undefined;
export function syllablesFor(text,stepsPerSyllable=1.75){
 const out=[];let at=0;
 for(const word of String(text||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(Boolean).slice(0,24)){
  const runs=word.replace(/^y(?=[aeiou])/,'j').match(/[aeiouy]+|[^aeiouy]+/g);
  if(runs.length>2&&runs.at(-1)==='e'&&!/[aeiouy]/.test(runs.at(-2)))runs.pop(); // silent final e
  const syl=[];
  runs.forEach((run,i)=>{
   if(!/[aeiouy]/.test(run[0]))return;
   const before=runs[i-1],medial=i>1;
   if(medial&&before.length>1&&syl.length)syl.at(-1).coda=consonant(before);
   syl.push({c:before?(medial?tailConsonant(before):consonant(before)):undefined,v:VMAP[run.slice(0,2)]||(run[0]==='y'?'i':run[0])});
  });
  if(!syl.length)continue;
  const last=runs.at(-1);if(!/[aeiouy]/.test(last[0]))syl.at(-1).coda=consonant(last);
  syl.forEach((x,i)=>{out.push({...x,stress:i===0,at:Math.round(at*100)/100,label:(x.c||'')+x.v,word});at+=stepsPerSyllable;});
  at+=stepsPerSyllable*.6;
 }
 return out;
}

function chordFor(tonic,scale,degree,r,extended){
 const n=scale.length,i=(degree-1)%n,at=k=>scale[(i+k)%n]+12*Math.floor((i+k)/n),root=scale[i];
 let midi=36+((tonic+root)%12);if(midi>45)midi-=12;
 return [midi,0,at(2)-root,at(4)-root,extended&&r()<.5?14:at(6)-root];
}
function generateMelody(r,sparse,stepsPerBar,scale){
 // Seven-note scales keep the original pool (and so the original seeded melodies); other scales use their own notes.
 const pool=!scale||scale.length===7?[12,14,15,17,19,21,22,24,26]:[...scale.map(v=>v+12),...scale.map(v=>v+24)].filter(v=>v<=27),out=[];let last=Math.min(4,pool.length-1);
 for(let i=0;i<stepsPerBar;i++){
  // Downbeats feed lead/sparse roles; the off-beat (step 2 of each beat) feeds answer-role sounds.
  const p=i%4===0?(sparse?.55:.85):i%4===2?(sparse?.4:.6):(sparse?.08:.4);
  if(r()>p){out.push(null);continue;}
  last=clamp(last+Math.round((r()-.5)*4),0,pool.length-1);out.push(pool[last]);
 }
 if(out.every(v=>v==null))out[0]=12;
 return out;
}
function generateBass(r,stepsPerBar){
 const out=Array(stepsPerBar).fill(null);out[0]=0;
 for(let i=2;i<stepsPerBar;i+=2)if(r()<.4)out[i]=[0,0,7,5,3,10][Math.floor(r()*6)];
 return out;
}
const ALL_GROUPS=['bass','pad','lead','arp','air'];
const sectionShape={
 none:[[.24,['pad','air','bass']],[.42,['pad','air','bass','lead']],[.62,ALL_GROUPS],[.34,['pad','air','bass']],[.72,ALL_GROUPS],[.2,['pad','air']]],
 beat:[[.30,['pad','air','lead']],[.58,['bass','pad','arp','drums','air']],[.82,[...ALL_GROUPS,'drums']],[.42,['pad','lead','air']],[.95,[...ALL_GROUPS,'drums']],[.24,['pad','lead','air']]]
};

// What a sound id resolves to: a preset from sounds.js, or a bare instrument family from patterns.js.
export function resolveSound(id){
 const preset=soundById[id];if(preset)return {preset,family:preset.pattern};
 if(patterns[id])return {preset:null,family:id};
 return null;
}
const defaultRoleFor=family=>sounds.find(s=>s.pattern===family)?.role||patterns[family]?.role||'lead';
const slug=s=>String(s||'track').replace(/[^A-Za-z0-9]/g,'').slice(0,24)||'track';

// Expand a Song into a composition. Problems with individual fields are collected in `warnings`
// (the field is dropped) so a slightly wrong song from a person or a model still plays.
export function compositionFromSong(input){
 const song=input||{},warnings=[],seed=num(song.seed,hash(JSON.stringify(song.tracks||[])+song.title)%100000,0,2**31-1)|0,r=rng(seed);
 const key=parseKey(song.key)||{pc:9,mode:'minor'},scale=modes[key.mode];
 const meter=parseMeter(song.meter),stepsPerBar=Math.round(meter[0]*16/meter[1]),bpm=num(song.bpm,80,30,200);
 const rhythm=rhythms.includes(song.rhythm)?song.rhythm:'none',ambient=rhythm==='none';
 const progression=Array.isArray(song.chords)&&song.chords.length?song.chords.slice(0,8).map(d=>num(d,1,1,7)|0):progressions[key.mode][Math.floor(r()*progressions[key.mode].length)];
 const harmony=Array.isArray(song.harmony)&&song.harmony.length?song.harmony.slice(0,8).map(c=>c.slice(0,5).map((v,i)=>i?num(v,0,0,24):num(v,40,24,60))).filter(c=>c.length>=4):progression.map(d=>chordFor(key.pc,scale,d,r,ambient));
 const melody=Array.isArray(song.melody)&&song.melody.some(v=>v!=null)?song.melody.slice(0,64).map(v=>v==null?null:num(v,12,-24,48)):generateMelody(r,ambient,stepsPerBar,scale);
 const bass=Array.isArray(song.bass)&&song.bass.some(v=>v!=null)?song.bass.slice(0,64).map(v=>v==null?null:num(v,0,-24,48)):generateBass(r,stepsPerBar);
 const barSeconds=meter[0]*4/meter[1]*60/bpm,groups=ambient?ALL_GROUPS:[...ALL_GROUPS,'drums'];
 let sections;
 if(Array.isArray(song.sections)&&song.sections.length){
  const okRoles=r=>Array.isArray(r)?r.filter(x=>[...ALL_GROUPS,'drums'].includes(x)):null;
  const list=song.sections.slice(0,24).map((s,i)=>({name:String(s.name||'Part '+(i+1)).slice(0,40),start:num(s.start,0,0,MAX_SECONDS),energy:num(s.energy,.6,0,1),roles:okRoles(s.roles)})).sort((a,b)=>a.start-b.start);
  const totalBars=Math.max(1,Math.ceil(num(song.seconds,list.at(-1).start+30,1,MAX_SECONDS)/barSeconds-.01));
  const starts=[];for(const s of list){const b=Math.min(totalBars-1,Math.round(s.start/barSeconds));if(!starts.length||b>starts.at(-1).bar)starts.push({...s,bar:starts.length?b:0});}
  sections=starts.map((s,i)=>({name:s.name,start:s.bar,bars:(starts[i+1]?.bar??totalBars)-s.bar,energy:s.energy,roles:s.roles||groups}));
 }else{
  const shape=sectionShape[ambient?'none':'beat'],names=Array.isArray(song.names)&&song.names.length?song.names:DEFAULT_NAMES;
  const total=song.seconds!=null?num(song.seconds,180,4,MAX_SECONDS):num(song.minutes,ambient?4:3,.1,10)*60;
  const per=total<shape.length*barSeconds*2?Math.max(1,Math.round(total/barSeconds/shape.length)):Math.max(2,Math.round(total/barSeconds/shape.length/2)*2);
  let start=0;sections=shape.map(([energy,roles],i)=>{const s={name:String(names[i%names.length]).slice(0,40)+(i>=names.length?' '+(i+1):''),start,bars:per,energy,roles};start+=per;return s;});
 }
 const bars=sections.reduce((n,s)=>n+s.bars,0),seconds=bars*barSeconds,used=new Set(),tracks=[];let slots=0;
 for(const [i,t] of (Array.isArray(song.tracks)?song.tracks:[]).entries()){
  const where=`track ${i+1} (${t?.sound||'?'})`,resolved=resolveSound(t?.sound);
  if(!resolved){warnings.push(`${where}: unknown sound`);continue;}
  const {preset,family}=resolved,pair=t.pair&&typeof t.pair==='object'?t.pair:null;
  if(slots+(pair?2:1)>MAX_TRACKS){warnings.push(`${where}: over the ${MAX_TRACKS}-voice track limit`);continue;}
  let id=slug(t.id||preset?.id||family),n=2;while(used.has(id)||used.has(id+'L')||used.has(id+'R'))id=slug(t.id||preset?.id||family).slice(0,20)+n++;
  const {category,scene,about,companion,id:_p,label:_l,pattern:_f,...base}=preset||{level:.4,colour:.4,life:1.2,pan:0,send:.3,transpose:0};
  const role=t.seq?'timeline':ROLES.includes(t.role)?t.role:preset?.role||defaultRoleFor(family);
  const track={...base,id,label:String(t.label||preset?.label||patterns[family].label).slice(0,48),pattern:family,role,sound:preset?.id||null};
  for(const [k,a,b] of [['level',0,1.5],['pan',-1,1],['send',0,1.5],['colour',0,1],['life',.03,8],['transpose',-48,48]])if(t[k]!=null)track[k]=num(t[k],track[k],a,b);
  if(role==='timeline'){
   // Role-playback settings of a preset (register shift, built-in step pattern) do not apply to explicit notes.
   for(const k of ['sequence','octave','gate','humanize','speechOffsetSteps'])delete track[k];if(t.transpose==null)track.transpose=0;
   try{parseSequence(t.seq,parseNote(t.note,60));track.seq=String(t.seq).slice(0,16000);}catch(e){warnings.push(`${where}: ${e.message}`);continue;}
   if(t.note!=null)track.note=t.note;
   if(t.step!=null){try{parseCurve(t.step);track.step=typeof t.step==='number'?num(t.step,.25,.01,30):String(t.step);}catch(e){warnings.push(`${where}: step ${e.message}`);}}
   for(const [k,a,b] of [['from',0,MAX_SECONDS],['to',0,MAX_SECONDS],['gate',.02,64]])if(t[k]!=null)track[k]=num(t[k],undefined,a,b);
   if(t.loop===false)track.loop=false;
  }
  if(pair){const p={width:num(pair.width,.75,0,1),delay:num(pair.delay,.023,0,2)};
   if(pair.seqR){try{parseSequence(pair.seqR,60);p.seqR=String(pair.seqR).slice(0,16000);}catch(e){warnings.push(`${where}: seqR ${e.message}`);}}
   if(pair.noteR!=null)p.noteR=pair.noteR;if(pair.transposeR!=null)p.transposeR=num(pair.transposeR,0,-48,48);if(pair.colourR!=null)p.colourR=num(pair.colourR,.5,0,1);
   track.pair=p;}
  if(t.automate&&typeof t.automate==='object'){const a={};for(const [k,v] of Object.entries(t.automate)){if(!AUTOMATABLE.includes(k)){warnings.push(`${where}: cannot automate ${k}`);continue;}try{parseCurve(v);a[k]=typeof v==='string'?v.slice(0,2000):v;}catch(e){warnings.push(`${where}: ${k} ${e.message}`);}}if(Object.keys(a).length)track.automate=a;}
  // Advanced role-playback fields, mainly carried over when a collection piece is remixed.
  const names=new Set(sections.map(s=>s.name)),nameList=v=>Array.isArray(v)?v.filter(x=>names.has(x)):undefined;
  if(t.onlySections)track.onlySections=nameList(t.onlySections);if(t.excludeSections)track.excludeSections=nameList(t.excludeSections);
  if(role!=='timeline'){if(t.octave!=null)track.octave=num(t.octave,12,-36,48);if(t.gate!=null)track.gate=num(t.gate,.18,.05,2);if(typeof t.humanize==='boolean')track.humanize=t.humanize;if(t.speechOffsetSteps!=null)track.speechOffsetSteps=num(t.speechOffsetSteps,0,-16,16);for(const [k,lo,hi] of [['hits',1,32],['cycle',1,64],['delaySteps',1,64],['interval',-24,24]])if(t[k]!=null)track[k]=num(t[k],lo,lo,hi)|0;
   if(Array.isArray(t.sequence))track.sequence=t.sequence.slice(0,64).map(v=>v==null?null:typeof v==='object'?{note:num(v.note,0,-24,48),velocity:num(v.velocity,1,.2,1.4)}:num(v,0,-24,48));}
  // Transmissions come and go in generated forms: leave the opening and the quietest movement to the room.
  if((role==='speechVowel'||role==='speechConsonant')&&!song.sections&&sections.length>=4)track.excludeSections=[sections[0].name,sections[3].name];
  used.add(id);if(pair){used.add(id+'L');used.add(id+'R');}tracks.push(track);slots+=pair?2:1;
 }
 let automate=null;
 if(song.automate&&typeof song.automate==='object'){automate={};for(const [k,v] of Object.entries(song.automate)){if(!GLOBAL_AUTOMATABLE.includes(k)){warnings.push(`cannot automate ${k} globally`);continue;}try{parseCurve(v);automate[k]=v;}catch(e){warnings.push(`global ${k}: ${e.message}`);}}}
 const speechNeeded=tracks.some(t=>t.role==='speechVowel'||t.role==='speechConsonant');
 const given=song.speech&&Array.isArray(song.speech.syllables)?song.speech:null;
 const syllables=speechNeeded?(given?given.syllables.slice(0,64):syllablesFor(song.say||'this is diddums do you read')):[];
 const phraseSteps=syllables.length?syllables.at(-1).at+4:0,room=num(song.room,ambient?.85:.62,0,1);
 const space=song.space&&typeof song.space==='object'?{room:num(song.space.room,room,0,.94),damp:num(song.space.damp,.55,0,.94),wet:num(song.space.wet,.18+room*.32,0,.94),echo:num(song.space.echo,ambient?.16:.18,0,.94),delayBeats:num(song.space.delayBeats,ambient?1.5:.75,.05,2)}:{room,damp:.55,wet:.18+room*.32,echo:ambient?.16:.18,delayBeats:ambient?1.5:.75};
 const drumKit=song.drumKit&&typeof song.drumKit==='object'?Object.fromEntries(Object.entries(song.drumKit).filter(([k])=>['bd','sd','rs','cp','lt','mt','ht','ch','oh'].includes(k)).map(([k,v])=>[k,Object.fromEntries(Object.entries(v||{}).filter(([f])=>['freq','colour','life','level','send'].includes(f)).map(([f,x])=>[f,num(x,.5,0,12000)]))])):null;
 return {
  id:'song-'+hash(JSON.stringify(song)).toString(36),title:String(song.title||'Untitled').slice(0,80),subtitle:song.prompt?'Composed from a prompt':'Shared song',tag:(song.prompt?'Prompt':'Song')+' / '+(ambient?'ambient':rhythm),
  bpm,meter,key:keyName(key.pc,key.mode),rhythm,...(song.arpStride!=null?{arpStride:num(song.arpStride,2,1,4)|0}:{}),swing:num(song.swing,rhythm==='brush'||rhythm==='shuffle'?.08:0,0,.3),seed,
  description:String(song.description||(song.prompt?`From the prompt “${song.prompt}”.`:'Made in the Diddums Make tab.')).slice(0,600),
  harmony,melody,bass,tracks,
  ...(speechNeeded&&syllables.length?{speech:given?{text:String(given.text??song.say??''),syllables,...(given.everyBars!=null?{everyBars:num(given.everyBars,4,1,16)}:{}),...(given.leadMs!=null?{leadMs:num(given.leadMs,50,0,160)}:{})}:{text:song.say||'',everyBars:Math.max(2,Math.ceil(phraseSteps/stepsPerBar)+1),leadMs:45,syllables}}:{}),
  space,...(drumKit?{drumKit}:{}),
  ...(automate&&Object.keys(automate).length?{automate}:{}),
  sections,bars,seconds,song,warnings,shared:true
 };
}

// Build the composition and the scheduled session, returning every problem a person or a model should fix.
export function checkSong(song){
 const problems=[];let c=null;
 try{c=compositionFromSong(song);problems.push(...c.warnings);if(!c.tracks.length)problems.push('no playable tracks');makeSession(c,48000);}
 catch(e){problems.push(e.message);}
 return {composition:c,problems};
}

// Describe any composition (collection piece or earlier song) as a Song, so it can be remixed or shown to Claude.
export function songFromComposition(c){
 if(c.song)return structuredClone(c.song);
 const barSeconds=c.meter[0]*4/c.meter[1]*60/c.bpm,k=parseKey(c.key);
 const tracks=c.tracks.map(t=>{
  const preset=t.sound&&soundById[t.sound]||sounds.find(s=>s.pattern===t.pattern&&s.role===t.role);
  const out={id:t.id,sound:preset?.id||t.pattern,label:t.label};
  if(t.role!=='timeline'&&(!preset||preset.role!==t.role))out.role=t.role;
  // Emit every field where the track differs from what its sound id would supply, including fields the track
  // never set (a preset's transposition, say), so the Song rebuilds exactly this track.
  const supplied=resolveSound(out.sound)?.preset||{},neutral={level:.4,colour:.4,life:1.2,pan:0,send:.3,transpose:0,octave:12,gate:.18,sequence:[0,null,7,null],humanize:true,speechOffsetSteps:0};
  for(const k of ['level','pan','send','colour','life','transpose','octave','gate','sequence','humanize','speechOffsetSteps']){const have=t[k]??(k in supplied?neutral[k]:undefined);if(have!==undefined&&JSON.stringify(have)!==JSON.stringify(supplied[k]??neutral[k]))out[k]=structuredClone(have);}
  for(const k of ['seq','note','step','from','to','pair','automate','onlySections','excludeSections','hits','cycle','delaySteps','interval'])if(t[k]!=null)out[k]=structuredClone(t[k]);
  if(t.loop===false)out.loop=false;
  return out;
 });
 return {title:c.title,description:c.description,bpm:c.bpm,meter:c.meter.join('/'),key:k?keyName(k.pc,k.mode):undefined,rhythm:c.rhythm,swing:c.swing||undefined,seconds:Math.round(c.bars*barSeconds*100)/100,
  room:c.space?.room,space:c.space?{...c.space}:undefined,say:c.speech?.text||undefined,speech:c.speech?structuredClone(c.speech):undefined,drumKit:c.drumKit?structuredClone(c.drumKit):undefined,seed:c.seed,harmony:c.harmony,melody:c.melody,bass:c.bass||[0,null,null,0,null,7,null,null,0,null,3,null,7,null,5,null],arpStride:c.arpStride??(['amber','violet'].includes(c.id)?1:2),
  sections:c.sections.map(s=>({name:s.name,start:Math.round(s.start*barSeconds*1000)/1000,energy:s.energy,roles:[...s.roles]})),tracks,...(c.automate?{automate:structuredClone(c.automate)}:{})};
}

// Links: ?song=<deflate-raw, base64url>. CompressionStream is available in current Safari, Chrome and Firefox.
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64url=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0));
async function pipe(bytes,stream){return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());}
export async function encodeSong(song){const bytes=await pipe(new TextEncoder().encode(JSON.stringify(song)),new CompressionStream('deflate-raw'));let s='';for(let i=0;i<bytes.length;i+=8190)s+=b64url(bytes.subarray(i,i+8190));return s;} // 8190 = a multiple of 3, so no padding mid-string
export async function decodeSong(text){
 const raw=String(text||'').trim();
 if(raw.startsWith('{')||raw.startsWith('%7B'))return JSON.parse(raw.startsWith('%')?decodeURIComponent(raw):raw);
 return JSON.parse(new TextDecoder().decode(await pipe(unb64url(raw),new DecompressionStream('deflate-raw'))));
}
export async function songLink(song,base=location.href){const u=new URL(base);u.search='?song='+await encodeSong(song);u.hash='';return u.toString();}
// A model's reply may wrap the JSON in prose or a code fence: take the outermost object.
export function songFromText(text){
 const s=String(text||''),start=s.indexOf('{'),end=s.lastIndexOf('}');
 if(start<0||end<=start)throw new Error('No JSON object found in the reply');
 const song=JSON.parse(s.slice(start,end+1));
 if(!song||!Array.isArray(song.tracks))throw new Error('The JSON has no "tracks" list');
 return song;
}
