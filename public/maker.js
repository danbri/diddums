// Shareable track recipes. A recipe is small, readable data that travels in a URL query string
// (?prompt=…&bpm=…&key=…&sounds=…) and expands deterministically into an ordinary Diddums composition.
import {sounds,soundById} from './sounds.js';
import {patterns} from './patterns.js';
import {AUTOMATABLE,GLOBAL_AUTOMATABLE,parseCurve} from './timeline.js';

export const RECIPE_SCHEMA='diddums-recipe/1';
export const MAX_TRACKS=16; // studio-worklet.js accepts at most 16 tracks per session (a stereo pair uses two)
export const MAX_SOUNDS=12;
export const rhythms=['none','brush','halftime','broken','shuffle','house','motorik','postpunk','factory','euclid','seven','ritual','suite'];
export const modes={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11],dorian:[0,2,3,5,7,9,10],lydian:[0,2,4,6,7,9,11],phrygian:[0,1,3,5,7,8,10],mixolydian:[0,2,4,5,7,9,10]};
const progressions={minor:[[1,6,3,7],[1,4,6,5],[1,7,6,7],[1,6,4,5]],major:[[1,5,6,4],[1,4,6,5],[1,6,4,5]],dorian:[[1,4,1,7],[1,2,4,1]],lydian:[[1,2,1,7],[1,2,5,1]],phrygian:[[1,2,1,7],[1,2,7,1]],mixolydian:[[1,7,4,1],[1,4,7,4]]};
const NOTE={c:0,d:2,e:4,f:5,g:7,a:9,b:11};
const PC_NAME=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const ROLES=['bass','drone','pad','long','keys','stabs','arp','sequence','lead','sparse','answer','air','continuous','speechVowel','speechConsonant'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const num=(v,d,a,b)=>{const n=Number(v);return Number.isFinite(n)&&v!==''&&v!==null?clamp(n,a,b):d;};
function hash(text){let h=2166136261;for(const ch of String(text)){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let s=seed|0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}

// Prompt themes. Matching is plain keyword lookup, so results are predictable and need no network or model.
const themes=[
 {id:'space',words:['space','spacey','cosmic','cosmos','galaxy','galactic','star','stars','orbit','planet','nebula','sci-fi','scifi','starship','spaceship','astronaut','interstellar','lunar','moon','mars','void','alien'],sounds:['voidDrone','nebulaPad','starfield','sputnikBeacon','hullHum','warpAscent'],bpm:[62,76],mode:'minor',room:.92,names:['Launch window','Low orbit','Transmission','Dark side','Deep field','Signal lost'],say:'control this is orbit four we read you'},
 {id:'radio',words:['radio','chatter','comms','transmission','transmissions','mission','control','voices','voice','talk','talking','dispatch','pilot','cockpit','walkie'],sounds:['radioChatter','radioConsonants','radioSnow','secondOperator'],say:'copy that control we are go for launch'},
 {id:'epic',words:['epic','opera','operatic','cinematic','heroic','battle','orchestral','orchestra','trailer','soundtrack','score','grand','majestic'],sounds:['vaultedChoir','stringEnsemble','timpani','epicSub','hornCall'],bpm:[66,84],mode:'minor',room:.88,names:['Overture','Gathering','The vow','Calm before','Ascension','Aftermath']},
 {id:'ambient',words:['ambient','ambiance','ambience','atmosphere','atmospheric','drone','calm','focus','work','working','study','studying','sleep','relax','relaxing','meditation','meditative','chill','background','soundscape','peaceful'],rhythm:'none',bpm:[58,72],room:.86},
 {id:'rain',words:['rain','rainy','storm','stormy','thunder','drizzle','wet'],sounds:['rain','wind','electricPiano'],bpm:[70,86],mode:'minor'},
 {id:'ocean',words:['ocean','sea','underwater','water','waves','tide','tidal','submarine','deep','river','lake'],sounds:['sonarBlup','waterDrops','nebulaPad','hullHum'],bpm:[60,72],mode:'lydian',room:.9,names:['Surface','Descent','Reef','Trench','Current','Ebb']},
 {id:'city',words:['city','urban','night','noir','neon','street','downtown','late','cafe','coffee','jazz','lofi','lo-fi'],sounds:['electricPiano','subBass','rain','nylonGuitar'],bpm:[78,92],mode:'dorian',rhythm:'brush'},
 {id:'forest',words:['forest','nature','birds','bird','woods','garden','meadow','spring','morning','dawn','sunrise','pastoral'],sounds:['harp','birdCalls','stringEnsemble','feltPiano'],bpm:[72,90],mode:'major',names:['First light','Canopy','Clearing','Stillness','Bloom','Evening']},
 {id:'sacred',words:['cathedral','church','sacred','choir','chant','temple','monastery','hymn','spiritual'],sounds:['vowelChoir','cathedralOrgan','bells','voidDrone'],bpm:[56,66],mode:'dorian',room:.96,rhythm:'none'},
 {id:'machine',words:['machine','machines','factory','industrial','engine','robot','robots','cyber','cyberpunk','computer','data','digital','server'],sounds:['acidLine','stepSequencer','brassStabs','telemetry','engineThrob'],bpm:[112,128],mode:'minor',rhythm:'factory'},
 {id:'dance',words:['dance','techno','house','club','rave','disco','upbeat','energetic','driving','workout'],sounds:['acidLine','arpeggiator','stringEnsemble','chromeLead'],bpm:[120,128],mode:'minor',rhythm:'house'},
 {id:'retro',words:['synthwave','retro','80s','eighties','outrun','motorik','krautrock'],sounds:['arpeggiator','subBass','chromeLead','stringEnsemble'],bpm:[104,122],mode:'minor',rhythm:'motorik'},
 {id:'eerie',words:['dark','eerie','ominous','horror','haunted','creepy','tense','tension','suspense','mystery','mysterious','dread'],sounds:['darkDrone','ghostPulse','phantomRoot','sonarPing'],mode:'phrygian',bpm:[56,70]},
 {id:'dream',words:['dream','dreamy','floating','ethereal','magic','magical','fairy','wonder','lullaby','child','kids','toy'],sounds:['celesta','musicBox','nebulaPad','harp'],mode:'lydian'},
 {id:'heart',words:['heart','heartbeat','pulse','breathing','alive'],sounds:['heartbeat']},
 {id:'clock',words:['clock','time','ticking','tick'],sounds:['clockTicks']},
 {id:'illusion',words:['illusion','impossible','shepard','endless','infinite','rising','psychoacoustic'],sounds:['impossibleAscent','phantomRoot','ghostPulse']}
];
const moodModes={sad:'minor',melancholy:'minor',melancholic:'minor',happy:'major',bright:'major',hopeful:'major',joyful:'major',uplifting:'lydian',triumphant:'major',mysterious:'phrygian',exotic:'phrygian',bluesy:'mixolydian',funky:'dorian'};
const DEFAULT_NAMES=['Opening','Rising','Bloom','Hush','Peak','Fade'];

export function parseKey(text){
 const m=String(text||'').trim().toLowerCase().match(/^([a-g])\s*(#|♯|b|♭|-?sharp|-?flat)?\s*(.*)$/);
 if(!m)return null;
 let pc=NOTE[m[1]];if(m[2])pc+=/#|♯|sharp/.test(m[2])?1:-1;
 const rest=m[3].trim(),mode=rest.startsWith('maj')||rest==='ionian'?'major':rest.startsWith('min')||rest==='m'||rest==='aeolian'?'minor':Object.keys(modes).find(k=>rest.startsWith(k))||(rest?null:'major');
 return mode?{pc:(pc+12)%12,mode}:null;
}
export const keyName=(pc,mode)=>`${PC_NAME[pc]} ${mode}`;

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

function themeMatches(prompt){
 const words=String(prompt||'').toLowerCase().split(/[^a-z0-9\-]+/).filter(Boolean),set=new Set(words);
 return {matched:themes.filter(t=>t.words.some(w=>set.has(w))),words};
}

// Fill any unspecified recipe fields from a free-text prompt. Explicit fields always win.
export function recipeFromPrompt(prompt,given={}){
 const {matched,words}=themeMatches(prompt),seed=hash(prompt||'diddums'),r=rng(seed);
 const pick=a=>a[Math.floor(r()*a.length)];
 const out={prompt:prompt||'',...given};
 const bpmRange=matched.find(t=>t.bpm)?.bpm||[72,96];
 const mood=words.map(w=>moodModes[w]).find(Boolean);
 const mode=mood||matched.find(t=>t.mode)?.mode||'minor';
 if(out.key==null)out.key=keyName(pick([0,2,4,5,7,9,10]),mode);
 if(out.rhythm==null)out.rhythm=matched.find(t=>t.id==='ambient'||t.id==='sacred')?'none':matched.find(t=>t.rhythm)?.rhythm||(matched.length?'none':'broken');
 if(out.bpm==null){let bpm=Math.round(bpmRange[0]+r()*(bpmRange[1]-bpmRange[0]));if(out.rhythm==='none')bpm=Math.min(bpm,76);out.bpm=bpm;}
 if(out.room==null)out.room=matched.find(t=>t.room)?.room??(out.rhythm==='none'?.85:.62);
 if(out.say==null){const say=matched.find(t=>t.say)?.say;if(say)out.say=say;}
 if(out.sounds==null){
  const ids=[];
  // The first sound of every matched theme first, then the rest, so mixed prompts keep each idea audible.
  const lists=matched.map(t=>t.sounds||[]);
  for(let i=0;i<6;i++)for(const l of lists)if(l[i]&&!ids.includes(l[i]))ids.push(l[i]);
  if(!ids.length)ids.push('nebulaPad','feltPiano','subBass','rain');
  if(ids.includes('radioChatter')&&!ids.includes('radioConsonants'))ids.splice(ids.indexOf('radioChatter')+1,0,'radioConsonants');
  out.sounds=ids.slice(0,8).map(id=>({id}));
 }
 if(out.names==null)out.names=matched.find(t=>t.names)?.names||DEFAULT_NAMES;
 if(out.title==null){const t=String(prompt||'').trim();out.title=t?t[0].toUpperCase()+t.slice(1,60):'Untitled';}
 if(out.seed==null)out.seed=seed%100000;
 return out;
}

// --- URL encoding -----------------------------------------------------------
// sounds=starfield,radioChatter:0.4,tine.keys:0.5,rain^0.9/0.37   (preset id or pattern.role, optional :level,
// optional ^width[/delay] = stereo pair: two copies at ∓width, the right one `delay` seconds later)
const short=v=>(+v).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
const encodeSound=s=>(s.id||`${s.pattern}.${s.role}`)+(s.level!=null?':'+short(s.level):'')+(s.pair?'^'+short(s.pair.width)+(s.pair.delay?'/'+short(s.pair.delay):''):'');
function decodeSound(token){
 const [head,pairText]=token.split('^'),[name,level]=head.split(':'),lv=level!=null&&level!==''?num(level,null,0,1.2):null;
 const extra={...(lv!=null?{level:lv}:{})};
 if(pairText!=null){const [w,d]=pairText.split('/');extra.pair={width:num(w,.75,0,1),delay:num(d,.023,0,2)};}
 if(soundById[name])return {id:name,...extra};
 const [pattern,role]=name.split('.');
 if(patterns[pattern]&&ROLES.includes(role))return {pattern,role,...extra};
 return null;
}
const list=v=>String(v).split(/[,\s]+/).filter(Boolean);
const steps=v=>list(v).slice(0,64).map(x=>x==='_'||x==='.'||x==='-'?null:num(x,null,-24,48));

export function recipeFromParams(params){
 const p=params instanceof URLSearchParams?params:new URLSearchParams(params);
 const known=['prompt','title','bpm','key','meter','rhythm','room','sounds','say','minutes','seed','melody','bass','chords','harmony','names'];
 if(!known.some(k=>p.has(k)))return null;
 // auto.<sound id>.<key>=0@0 1@2.5 … and auto.<master|room|damp|wet|echo>=… (see timeline.js for the curve syntax)
 const automate={};for(const [k,v] of p){const m=k.match(/^auto\.(?:([A-Za-z0-9]+)\.)?([a-z]+)$/);if(!m)continue;try{parseCurve(v);}catch{continue;}if(m[1]?AUTOMATABLE.includes(m[2]):GLOBAL_AUTOMATABLE.includes(m[2]))(automate[m[1]||'*']||={})[m[2]]=v.slice(0,600);}
 const g={};
 if(p.has('title'))g.title=p.get('title').slice(0,80);
 if(p.has('bpm'))g.bpm=num(p.get('bpm'),80,30,200);
 if(p.has('key')&&parseKey(p.get('key')))g.key=p.get('key');
 if(p.has('meter')){const m=p.get('meter').match(/^(\d{1,2})\/(4|8)$/);if(m)g.meter=[clamp(+m[1],2,15),+m[2]];}
 if(p.has('rhythm')&&rhythms.includes(p.get('rhythm')))g.rhythm=p.get('rhythm');
 if(p.has('room'))g.room=num(p.get('room'),.7,0,1);
 if(p.has('sounds'))g.sounds=list(p.get('sounds')).map(decodeSound).filter(Boolean).slice(0,MAX_SOUNDS);
 if(p.has('say'))g.say=p.get('say').slice(0,160);
 if(p.has('minutes'))g.minutes=num(p.get('minutes'),3,.5,20);
 if(p.has('seed'))g.seed=num(p.get('seed'),1,0,1e9)|0;
 if(p.has('melody'))g.melody=steps(p.get('melody'));
 if(p.has('bass'))g.bass=steps(p.get('bass'));
 if(p.has('chords'))g.chords=list(p.get('chords')).slice(0,8).map(x=>num(x,1,1,7)|0);
 if(p.has('harmony'))g.harmony=list(p.get('harmony')).slice(0,8).map(c=>c.split('.').map(Number)).filter(c=>c.length>=4&&c.every(Number.isFinite)).map(c=>c.slice(0,5).map((v,i)=>i?clamp(v,0,24):clamp(v,24,60)));
 if(p.has('names'))g.names=p.get('names').split('|').map(s=>s.trim().slice(0,32)).filter(Boolean).slice(0,9);
 if(Object.keys(automate).length)g.automate=automate;
 return recipeFromPrompt(p.get('prompt')||'',g);
}

export function recipeToParams(recipe){
 const p=new URLSearchParams();
 const set=(k,v)=>{if(v!=null&&v!==''&&!(Array.isArray(v)&&!v.length))p.set(k,v);};
 set('prompt',recipe.prompt);set('title',recipe.title);set('bpm',recipe.bpm);set('key',recipe.key);
 if(recipe.meter&&recipe.meter.join('/')!=='4/4')set('meter',recipe.meter.join('/'));
 set('rhythm',recipe.rhythm);set('room',recipe.room!=null?(+recipe.room).toFixed(2):null);set('minutes',recipe.minutes);
 set('sounds',(recipe.sounds||[]).map(encodeSound).join(','));
 set('say',recipe.say);
 if(recipe.chords)set('chords',recipe.chords.join(','));
 if(recipe.harmony)set('harmony',recipe.harmony.map(c=>c.join('.')).join(','));
 if(recipe.melody)set('melody',recipe.melody.map(v=>v==null?'_':v).join(','));
 if(recipe.bass)set('bass',recipe.bass.map(v=>v==null?'_':v).join(','));
 if(recipe.names&&recipe.names!==DEFAULT_NAMES)set('names',recipe.names.join('|'));
 set('seed',recipe.seed);
 for(const [track,keys] of Object.entries(recipe.automate||{}))for(const [k,v] of Object.entries(keys))set(track==='*'?`auto.${k}`:`auto.${track}.${k}`,v);
 return p;
}
export function shareUrl(recipe,base=location.href){const u=new URL(base);u.search=recipeToParams(recipe).toString();u.hash='';return u.toString();}

// Track ids a recipe's sounds receive: the preset id (or pattern), numbered from the second copy.
export function trackIds(list){const seen=new Map();return (list||[]).map(s=>{const base=s.id||s.pattern,n=(seen.get(base)||0)+1;seen.set(base,n);return n>1?base+n:base;});}
// "level=0@0 1@3; pan=-1@0 1@20" ⇄ {level:'0@0 1@3',pan:'-1@0 1@20'}
export function parseAutoText(text,keys){const out={};for(const part of String(text||'').split(';').map(x=>x.trim()).filter(Boolean)){const m=part.match(/^([a-z]+)\s*=\s*(.+)$/);if(!m||!keys.includes(m[1]))throw new Error('Use key=curve with key one of '+keys.join(', '));parseCurve(m[2]);out[m[1]]=m[2].trim();}return out;}
export const formatAutoText=a=>Object.entries(a||{}).map(([k,v])=>`${k}=${v}`).join('; ');

// --- Recipe → composition -----------------------------------------------------
function chordFor(tonic,scale,degree,r,extended){
 const i=degree-1,at=k=>scale[(i+k)%7]+12*Math.floor((i+k)/7),root=scale[i];
 let midi=36+((tonic+root)%12);if(midi>45)midi-=12;
 const third=at(2)-root,fifth=at(4)-root,seventh=at(6)-root;
 return [midi,0,third,fifth,extended&&r()<.5?14:seventh];
}
function generateMelody(r,sparse,stepsPerBar){
 const pool=[12,14,15,17,19,21,22,24,26],out=[];let last=4;
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
const sectionShape={
 none:[[.24,['pad','air','bass']],[.42,['pad','air','bass','lead']],[.62,['pad','air','bass','lead','arp']],[.34,['pad','air','bass']],[.72,['pad','air','bass','lead','arp']],[.2,['pad','air']]],
 beat:[[.30,['pad','air','lead']],[.58,['bass','pad','arp','drums','air']],[.82,['bass','pad','lead','arp','air','drums']],[.42,['pad','lead','air']],[.95,['bass','pad','lead','arp','air','drums']],[.24,['pad','lead','air']]]
};

export function compositionFromRecipe(input){
 const recipe=recipeFromPrompt(input.prompt||'',input),r=rng(recipe.seed||1);
 const key=parseKey(recipe.key)||{pc:9,mode:'minor'},scale=modes[key.mode];
 const meter=recipe.meter||[4,4],stepsPerBar=Math.round(meter[0]*16/meter[1]),bpm=num(recipe.bpm,80,30,200);
 const rhythm=rhythms.includes(recipe.rhythm)?recipe.rhythm:'none',ambient=rhythm==='none';
 const progression=recipe.chords?.length?recipe.chords:progressions[key.mode][Math.floor(r()*progressions[key.mode].length)];
 const harmony=recipe.harmony?.length?recipe.harmony:progression.map(d=>chordFor(key.pc,scale,d,r,ambient));
 const melody=recipe.melody?.some(v=>v!=null)?recipe.melody:generateMelody(r,ambient,stepsPerBar);
 const bass=recipe.bass?.some(v=>v!=null)?recipe.bass:generateBass(r,stepsPerBar);
 const barSeconds=meter[0]*4/meter[1]*60/bpm,minutes=num(recipe.minutes,ambient?4:3,.5,20);
 const shape=sectionShape[ambient?'none':'beat'],names=recipe.names?.length?recipe.names:DEFAULT_NAMES;
 const per=Math.max(2,Math.round(minutes*60/barSeconds/shape.length/2)*2);
 let start=0;const sections=shape.map(([energy,roles],i)=>{const s={name:names[i%names.length]+(i>=names.length?' '+(i+1):''),start,bars:per,energy,roles};start+=per;return s;});
 const used=new Map(),tracks=[];let slots=0;
 for(const s of (recipe.sounds||[]).slice(0,MAX_SOUNDS)){
  const preset=s.id?soundById[s.id]:null,base=preset||{id:s.pattern,label:patterns[s.pattern]?.label||s.pattern,pattern:s.pattern,role:s.role,level:.3,colour:.4,life:1.2,pan:0,send:.3};
  if(!base.pattern||!patterns[base.pattern])continue;
  const n=(used.get(base.id)||0)+1;used.set(base.id,n);
  const {category,about,companion,...t}=base;
  const track={...t,id:n>1?`${base.id}${n}`:base.id,label:n>1?`${base.label} ${n}`:base.label,level:s.level??base.level,sound:preset?.id||null};
  if(recipe.automate?.[track.id])track.automate=recipe.automate[track.id];
  if(s.pair){if(slots+2>MAX_TRACKS)continue;track.pair={width:num(s.pair.width,.75,0,1),delay:num(s.pair.delay,.023,0,2)};}
  slots+=s.pair?2:1;if(slots>MAX_TRACKS)break;
  // Transmissions come and go: leave the opening and the quietest movement to the room.
  if(track.role==='speechVowel'||track.role==='speechConsonant')track.excludeSections=[sections[0].name,sections[3].name];
  tracks.push(track);
 }
 const speechNeeded=tracks.some(t=>t.role==='speechVowel'||t.role==='speechConsonant');
 const syllables=speechNeeded?syllablesFor(recipe.say||'this is diddums do you read'):[];
 const phraseSteps=syllables.length?syllables[syllables.length-1].at+4:0;
 const id='url-'+hash(recipeToParams(recipe).toString()).toString(36);
 return {
  id,title:recipe.title||'Untitled',subtitle:'Shared track',tag:(recipe.prompt?'From a prompt':'Shared recipe')+' / '+(ambient?'ambient':rhythm),bpm,meter,key:keyName(key.pc,key.mode),rhythm,swing:rhythm==='brush'||rhythm==='shuffle'?.08:0,
  seed:recipe.seed||1,description:recipe.prompt?`Made from the prompt “${recipe.prompt}”. Every sound is a preset over an existing hash-matched LeanDSP instrument.`:'Made from a shared URL recipe.',
  harmony,melody,bass,tracks,
  ...(speechNeeded&&syllables.length?{speech:{text:recipe.say||'',everyBars:Math.max(2,Math.ceil(phraseSteps/stepsPerBar)+1),leadMs:45,syllables}}:{}),
  space:{room:num(recipe.room,.7,0,1),damp:.55,wet:.18+num(recipe.room,.7,0,1)*.32,echo:ambient?.16:.18,delayBeats:ambient?1.5:.75},
  ...(recipe.automate?.['*']?{automate:recipe.automate['*']}:{}),
  sections,bars:start,recipe,shared:true
 };
}

// Best-effort inverse: describe an existing composition as a recipe so it can be remixed and shared.
export function recipeFromComposition(c){
 const k=parseKey(c.key);
 return {prompt:'',title:c.title+(c.shared?'':' (remix)'),bpm:c.bpm,key:k?keyName(k.pc,k.mode):undefined,meter:c.meter,rhythm:rhythms.includes(c.rhythm)?c.rhythm:'broken',room:c.space?.room,
  harmony:c.harmony,melody:c.melody,bass:c.bass||null,say:c.speech?.text||undefined,names:c.sections.map(s=>s.name).slice(0,9),seed:c.seed%100000,
  sounds:c.tracks.map(t=>{const preset=t.sound&&soundById[t.sound]||sounds.find(s=>s.pattern===t.pattern&&s.role===t.role)||(t.role==='timeline'?sounds.find(s=>s.pattern===t.pattern):null);return preset?{id:preset.id,level:t.level}:{pattern:t.pattern,role:t.role,level:t.level};})};
}
