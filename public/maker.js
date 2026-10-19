// URL recipes and the offline "quick sketch". A recipe is small, readable data in a query string
// (?prompt=…&bpm=…&key=…&sounds=…). It becomes a Song (song.js), which expands into a composition.
// The prompt → recipe step here is a plain keyword table: it is a no-network fallback, not the AI composer (ai.js).
import {soundById} from './sounds.js';
import {patterns} from './patterns.js';
import {AUTOMATABLE,GLOBAL_AUTOMATABLE,parseCurve} from './timeline.js';
import {MAX_TRACKS,rhythms,modes,ROLES,DEFAULT_NAMES,clamp,num,hash,rng,parseKey,keyName,compositionFromSong} from './song.js';
export {MAX_TRACKS,rhythms,modes,parseKey,keyName};

export const RECIPE_SCHEMA='diddums-recipe/1';
export const MAX_SOUNDS=12;

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

// --- Recipe → Song → composition ------------------------------------------------
export function songFromRecipe(input){
 const r=recipeFromPrompt(input.prompt||'',input),ids=trackIds(r.sounds);
 return {prompt:r.prompt||undefined,title:r.title,bpm:r.bpm,key:r.key,meter:(r.meter||[4,4]).join('/'),rhythm:r.rhythm,room:r.room,minutes:r.minutes,say:r.say,seed:r.seed,
  chords:r.chords,harmony:r.harmony,melody:r.melody,bass:r.bass||undefined,names:r.names,
  tracks:(r.sounds||[]).map((s,i)=>({sound:s.id||s.pattern,...(s.id?{}:{role:s.role}),...(s.level!=null?{level:s.level}:{}),...(s.pair?{pair:s.pair}:{}),...(r.automate?.[ids[i]]?{automate:r.automate[ids[i]]}:{})})),
  ...(r.automate?.['*']?{automate:r.automate['*']}:{})};
}
export function compositionFromRecipe(input){const song=songFromRecipe(input);return {...compositionFromSong(song),id:'url-'+hash(JSON.stringify(song)).toString(36),subtitle:'Shared track'};}

// A Song is URL-recipe compatible when every track is a plain sound with optional level, pair and automation.
export function recipeFromSong(song){
 const plain=(song.tracks||[]).every(t=>Object.keys(t).every(k=>['sound','level','pair','automate','role'].includes(k))&&(soundById[t.sound]?!t.role:t.role&&patterns[t.sound]))&&!song.sections&&!song.seconds;
 if(!plain)return null;
 const sounds=(song.tracks||[]).map(t=>({...(soundById[t.sound]?{id:t.sound}:{pattern:t.sound,role:t.role}),...(t.level!=null?{level:t.level}:{}),...(t.pair?{pair:t.pair}:{})}));
 const ids=trackIds(sounds),automate={};(song.tracks||[]).forEach((t,i)=>{if(t.automate)automate[ids[i]]=t.automate;});if(song.automate)automate['*']=song.automate;
 return {prompt:song.prompt||'',title:song.title,bpm:song.bpm,key:song.key,meter:song.meter?String(song.meter).split('/').map(Number):undefined,rhythm:song.rhythm,room:song.room,minutes:song.minutes,say:song.say,seed:song.seed,
  chords:song.chords,harmony:song.harmony,melody:song.melody,bass:song.bass,names:song.names,sounds,...(Object.keys(automate).length?{automate}:{})};
}
