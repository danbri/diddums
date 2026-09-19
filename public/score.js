import {drumKit} from './patterns.js';
export const MAX_EVENTS=32768;
export const MAX_TRACK_VOICES=24;
export const framesPerBar=(c,sr)=>Math.round(c.meter[0]*4/c.meter[1]*60/c.bpm*sr);
export function sectionAt(c,bar){return c.sections.find(s=>bar>=s.start&&bar<s.start+s.bars)||c.sections[c.sections.length-1];}
function random(seed){let s=seed|0;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296};}
const group=role=>['keys','stabs','long'].includes(role)?'pad':role==='sequence'?'arp':role==='drone'?'bass':role==='continuous'?'air':['speechVowel','speechConsonant'].includes(role)?'lead':['sparse','answer'].includes(role)?'lead':role;
const trackActive=(track,section)=>(!track.onlySections||track.onlySections.includes(section.name))&&(!track.excludeSections||!track.excludeSections.includes(section.name));
const VOWEL_COLOUR={a:0,e:.25,i:.5,o:.75,u:.999};
const CONSONANT_COLOUR={p:.05,b:.08,t:.14,d:.17,k:.25,g:.28,h:.31,f:.32,v:.33,m:.43,n:.52,l:.76,r:.80,j:.84,w:.91,s:.98};
function tune(interval,chord){const octave=Math.floor(interval/12)*12,pc=((interval%12)+12)%12;return octave+([3,4].includes(pc)?chord[2]:[10,11].includes(pc)?(chord[4]===14?10:chord[4]):pc);}
export function drumSteps(c,bar){
 const steps=Math.round(c.meter[0]*16/c.meter[1]),sec=sectionAt(c,bar),p=Object.fromEntries(drumKit.map(d=>[d.id,[]]));
 if(c.rhythm==='none'||!sec.roles.includes('drums'))return p;
 const E=sec.energy,add=(id,xs)=>{p[id].push(...xs.filter(i=>i>=0&&i<steps))};
 if(['house','motorik'].includes(c.rhythm)){for(let i=0;i<steps;i+=4)add('bd',[i]);add('sd',[4,12]);add('cp',E>.7?[12]:[]);for(let i=2;i<steps;i+=4)add('ch',[i]);if(E>.65)add('oh',[steps-2]);}
 else if(c.rhythm==='ritual'){if(bar%2===0)add('bd',[0]);if(bar%4===3)add('lt',[steps-3]);if(bar%4===1)add('rs',[Math.floor(steps/2)]);}
 else if(c.rhythm==='seven'){add('bd',[0,6,10]);add('sd',[4,11]);add('rs',[9]);add('ch',[0,3,6,8,11,13]);if(bar%4===3)add('ht',[12]);}
 else if(c.rhythm==='euclid'){add('bd',[0,7,14]);add('rs',[4,11,18]);add('ch',[0,3,6,9,12,15,18]);if(bar%2===1)add('lt',[17]);}
 else if(c.rhythm==='brush'){add('bd',steps===12?[0,6]:[0,9]);add('rs',steps===12?[3,9]:[4,12]);add('ch',steps===12?[2,5,8,11]:[2,6,10,14]);if(E>.6&&bar%2===1)add('sd',[steps-4]);}
 else if(c.rhythm==='halftime'){add('bd',[0,7,10]);add('sd',[8]);add('rs',[6,14]);add('ch',[2,6,10,14]);if(E>.65)add('oh',[15]);}
 else if(c.rhythm==='postpunk'){add('bd',[0,6,8,11]);add('sd',[4,12]);for(let i=0;i<steps;i+=2)add('ch',[i]);if(bar%4===3)add('mt',[15]);}
 else if(c.rhythm==='factory'){add('bd',[0,3,8,11]);add('sd',[4,12]);if(E>.68)add('cp',[4,12]);add('ch',[2,6,10,14]);if(E>.58)add('ch',[0,4,8,12]);if(E>.72)add('oh',[6,14]);if(bar%2===1)add('rs',[7,15]);if(bar%8===7){add('lt',[9]);add('mt',[12]);add('ht',[15]);}}
 else if(c.rhythm==='shuffle'){add('bd',[0,7,10]);add('sd',[4,12]);add('ch',[0,2,5,6,8,10,13,14]);if(bar%2===1)add('rs',[15]);}
 else if(c.rhythm==='suite'){
  const room=Math.floor(bar/8);add('bd',room<2?[0,8]:room===4?[0]:room===5?[0,7,10]:[0,4,8,12]);
  if(room>=1&&room!==4)add('sd',[4,12]);if(room>=2)for(let i=0;i<steps;i+=2)add('ch',[i]);if(room>=3)add('cp',[room%2?12:4]);
  if(room>=4){add('lt',[3,11]);add('mt',[6,13]);add('ht',[7,15]);}if(room===2||room===6)add('oh',[6,14]);add('rs',room<3?[5,13]:[2,10]);
 }else{add('bd',[0,8,11]);add('sd',[4,12]);add('ch',[0,2,6,8,10,14]);if(bar%2)add('rs',[15]);}
 if(E<.5){p.cp=[];p.oh=[];p.ch=p.ch.filter((_,i)=>i%2===0)}
 if(bar%8===7&&E>.5){add('mt',[steps-3]);add('ht',[steps-1]);p.ch=p.ch.filter(i=>i<steps-2)}
 return p;
}
export function makeSession(c,sr,overrides={}){
 if(!(sr>=8000&&sr<=192000))throw new Error('Unsupported sample rate');
 const beatFrames=sr*60/c.bpm,beats=c.meter[0]*4/c.meter[1],steps=Math.round(beats*4),rand=random(c.seed),events=[],grids=[];
 const tracks=c.tracks.map(t=>({...t,pool:1,poolRequired:1})),kit=drumKit.map(d=>({...d,...(c.drumKit?.[d.id]||{})}));
 const eventIds=new Map();
 const emit=(track,bar,step,note,velocity,length,colour,life,meta={})=>{
  const swing=(Math.floor(step)%2===1?c.swing:0),jitter=track.startsWith('d:')||meta.speechPart||meta.humanize===false?0:(rand()-.5)*.012;
  const nominalBeat=bar*beats+step/4+swing,frame=Math.max(0,Math.round((nominalBeat+jitter)*beatFrames));
  const base=track+'/'+bar+'/'+step+'/'+note,ordinal=eventIds.get(base)||0;eventIds.set(base,ordinal+1);
  events.push({id:base+'/'+ordinal,frame,track,note,bar,step,nominalBeat,humanizeBeats:jitter,velocity:Math.max(.05,Math.min(1,velocity)),durationBeats:length,duration:Math.max(32,Math.round(length*beatFrames)),colour,life,...meta});
 };
 for(let bar=0;bar<c.bars;bar++){
  const sec=sectionAt(c,bar),E=sec.energy,chord=c.harmony[Math.floor(bar/2)%c.harmony.length],root=chord[0],last=bar>=c.bars-2;
  const grid=drumSteps(c,bar);grids.push(grid);
  for(const d of kit){const hits=sec.roles.includes('drums')?(overrides['d:'+d.id]||grid[d.id]):[];for(const step of hits){const accent=step%4===0?1:.7;emit('d:'+d.id,bar,step,0,(c.rhythm==='brush'?.45:.75)*accent*(.7+E*.3),.035,d.colour,d.life);}}
  for(const t of tracks){
   if(!sec.roles.includes(group(t.role))||!trackActive(t,sec))continue;
   const vel=(.58+.25*E),colour=Math.min(1,t.colour*(.72+.35*E));
   if(overrides[t.id]){const ov=overrides[t.id];if(Array.isArray(ov)){for(const [i,n] of ov.entries())if(n!==null)emit(t.id,bar,i,n,vel,.25,colour,t.life);}else if(ov?.type==='patternCode'&&Array.isArray(ov.notes)&&ov.notes.length){for(let step=0;step<steps;step++){const raw=ov.notes[(bar*steps+step)%ov.notes.length];if(raw===null||raw===undefined)continue;const note=typeof raw==='object'?Number(raw.note):Number(raw),gain=typeof raw==='object'?Math.max(.05,Math.min(1.5,Number(raw.velocity??1))):1;if(Number.isFinite(note))emit(t.id,bar,step,Math.max(0,Math.min(127,note)),vel*gain,.25,colour,t.life,{humanize:false,localPattern:true,patternIndex:(bar*steps+step)%ov.notes.length});}}continue;}
   if(t.role==='continuous'){
    if(bar===0)emit(t.id,0,0,root+12,vel,c.bars*beats-.12,colour,t.life);
   }else if(t.role==='speechVowel'||t.role==='speechConsonant'){
    const syllables=c.speech?.syllables||[],cadence=Math.max(1,Math.round(Number(c.speech?.everyBars??4))),leadMs=Math.max(0,Math.min(160,Number(c.speech?.leadMs??50))),leadSteps=leadMs*c.bpm/15000,offset=Math.max(-steps/2,Math.min(steps/2,Number(t.speechOffsetSteps)||0));
    if(bar%cadence===0)for(const syl of syllables){const stress=syl.stress?1:.82,at=syl.at+offset,label=syl.label||((syl.c||'')+syl.v),baseColour=Number.isFinite(Number(syl.colour))?Math.max(0,Math.min(1,Number(syl.colour))):VOWEL_COLOUR[syl.v],duration=Math.max(.08,Math.min(1.6,Number(syl.duration??(syl.stress?.44:.34)))),rawPath=Array.isArray(syl.path)?syl.path.slice(0,12):[],colourPath=rawPath.map(p=>[Math.max(0,Math.min(1,Number(p?.[0])||0)),Math.max(0,Math.min(1,Number(p?.[1])||0))]).sort((a,b)=>a[0]-b[0]),meta={syllable:label,word:syl.word||null,speechText:c.speech?.text||'',stress:!!syl.stress,vowel:syl.v,consonant:syl.c||null,coda:syl.coda||null,speechLeadMs:leadMs,speechOffsetSteps:offset,trajectory:colourPath.length>1?'coupled-vowel-path':null,colourPath:colourPath.length>1?colourPath:null};if(t.role==='speechVowel'&&baseColour!=null)emit(t.id,bar,at+leadSteps,60,vel*stress,duration,baseColour,.58,{...meta,speechPart:'vowel'});if(t.role==='speechConsonant'&&syl.c&&CONSONANT_COLOUR[syl.c]!=null)emit(t.id,bar,at,60,vel*(syl.stress?.95:.75),.09,CONSONANT_COLOUR[syl.c],.12,{...meta,trajectory:null,colourPath:null,speechPart:'consonant'});if(t.role==='speechConsonant'&&syl.coda&&CONSONANT_COLOUR[syl.coda]!=null){const codaLeadMs=Math.max(15,Math.min(100,Number(syl.codaLeadMs??45))),codaLeadSteps=codaLeadMs*c.bpm/15000,codaAt=at+leadSteps+duration*4-codaLeadSteps;emit(t.id,bar,codaAt,60,vel*(syl.stress?.78:.64),.075,CONSONANT_COLOUR[syl.coda],.12,{...meta,trajectory:null,colourPath:null,syllable:label+'·'+syl.coda,consonant:syl.coda,speechPart:'coda'});}}
   }else if(['pad','drone','air','long'].includes(t.role)){
    if(bar%2===0){const notes=t.role==='pad'||t.role==='long'?chord.slice(1).map(v=>root+24+v):[root+(t.role==='air'?24:0)];for(const n of notes)emit(t.id,bar,0,n,vel*(t.role==='pad'?.82:1),beats*2-.12,colour,t.life);}
   }else if(t.role==='keys'||t.role==='stabs'){
    const rhythm=t.role==='keys'?(bar%2===0?[0,7,11]:[2,8,14]):[2,6,10,14];
    for(const step of rhythm.filter(n=>n<steps))for(const n of chord.slice(1))emit(t.id,bar,step,root+24+n,vel*.80,t.role==='keys'?.65:.23,colour,t.life);
   }else if(t.role==='bass'){
    const pat=c.bass||[0,null,null,0,null,7,null,null,0,null,3,null,7,null,5,null];
    for(let step=0;step<steps;step++){const v=pat[(step+((bar%4===3)?2:0))%pat.length];if(v===null||last&&step>steps/2)continue;emit(t.id,bar,step,root+tune(v,chord),vel,(c.rhythm==='halftime'?.45:.29),colour,t.life,{humanize:t.humanize});}
   }else if(t.role==='sequence'){
    const seq=Array.isArray(t.sequence)&&t.sequence.length?t.sequence:[0,null,7,null],gate=Math.max(.05,Math.min(2,Number(t.gate??.18))),oct=Number(t.octave??12);for(let step=0;step<steps;step++){const raw=seq[(bar*steps+step)%seq.length];if(raw===null||raw===undefined||last&&step>steps/2)continue;const interval=typeof raw==='object'?Number(raw.note):Number(raw),accent=typeof raw==='object'?Math.max(.2,Math.min(1.4,Number(raw.velocity??1))):1;if(!Number.isFinite(interval))continue;emit(t.id,bar,step,root+oct+tune(interval,chord),vel*accent,gate,colour,t.life,{sequenceIndex:(bar*steps+step)%seq.length,humanize:t.humanize});}
   }else if(t.role==='arp'){
    const stride=['amber','violet'].includes(c.id)?1:c.id==='porcelain'?2:2;
    const order=[0,2,1,3,2,0,3,1];for(let step=0;step<steps;step+=stride){if(E<.5&&step%4!==0||last&&step>steps/2)continue;const j=(Math.floor(step/stride)+bar%4)%order.length;const degree=chord[1+order[j]%Math.max(1,chord.length-1)];const oct=(bar%4===2&&j>4)?12:0;emit(t.id,bar,step,root+24+degree+oct,vel*(step%4===0?1:.75),.16+stride*.10,colour,t.life);}
   }else{
    const sparse=t.role==='sparse'||t.role==='answer';for(let step=0;step<steps;step++){
     if(sparse&&step%4!==((t.role==='answer')?2:0))continue;
     if(t.role==='answer'&&bar%2===0||t.role==='sparse'&&bar%4===2)continue;
     let interval=c.melody[(step+(bar%4===1?4:0))%c.melody.length];if(interval===null)continue;
     if(E<.4&&!sparse&&step%4!==0||last&&step>steps/2)continue;
     if(bar%8===7&&step>steps-5)interval=[12,14,12,7][step%4];
     if(bar%8>=4&&step%5===0)interval+=12;
     emit(t.id,bar,step,root+12+tune(interval,chord),vel*(.72+.24*rand()),sparse?1.15:.33,colour,t.life);
    }
   }
  }
 }
 // Optional score treatment used by the focused A/B lab. It changes gate time only;
 // synthesis release tails and effects remain untouched.
 const boundaryTreatment=c.scoreTreatment?.harmonyBoundary;
 if(boundaryTreatment?.mode==='clean'){
  const roles=new Set(boundaryTreatment.roles||['keys','stabs']),margin=Math.max(0,Math.min(.25,Number(boundaryTreatment.marginBeats??.03))),trackMap=new Map(tracks.map(t=>[t.id,t]));
  for(const e of events){const t=trackMap.get(e.track);if(!t||!roles.has(t.role))continue;const nextBoundary=(Math.floor(e.bar/2)+1)*2*beats,maxEnd=nextBoundary-margin,currentEnd=e.nominalBeat+e.duration/beatFrames;if(e.nominalBeat<maxEnd&&currentEnd>maxEnd){e.durationBeforeTreatment=e.duration;e.duration=Math.max(32,Math.round((maxEnd-e.nominalBeat)*beatFrames));e.scoreTreatment='clean-harmony-boundary';}}
 }
 events.sort((a,b)=>a.frame-b.frame||a.track.localeCompare(b.track));
 if(events.length>MAX_EVENTS)throw new Error(`Score exceeds the ${MAX_EVENTS} event budget`);
 // Size each state-isolated voice pool from this score's actual gate+release lifetime.
 // End points sort before starts at the same frame, so a slot can be reused exactly on a boundary.
 for(const t of tracks){const points=[];for(const e of events)if(e.track===t.id){const end=e.frame+e.duration+Math.ceil(sr*Math.max(.08,e.life*1.7));points.push([e.frame,1],[end,-1]);}points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let active=0,peak=0;for(const [,d] of points){active+=d;peak=Math.max(peak,active);}t.poolRequired=Math.max(1,peak);if(t.poolRequired>MAX_TRACK_VOICES)throw new Error(`${t.label} needs ${t.poolRequired} voices; bounded pool limit is ${MAX_TRACK_VOICES}`);t.pool=t.poolRequired;}
 const durationFrames=Math.round(c.bars*beats*beatFrames);
 return {id:c.id,title:c.title,key:c.key,sampleRate:sr,meter:c.meter,bpm:c.bpm,bars:c.bars,steps,beats,seed:c.seed,tracks,kit,space:{...c.space},sections:c.sections,harmony:c.harmony,events,grids,durationFrames,tailFrames:Math.round(sr*6),maxEvents:MAX_EVENTS};
}
export function runtimeGraph(session){
 const nodes=[{id:'clock',label:'Transport',type:'event',detail:`${session.bpm} BPM · ${session.meter.join('/')}`,backend:'host',open:'arrangement'},
 {id:'score',label:'Arrangement',type:'event',detail:`${session.sections.length} movements · ${session.bars} bars`,backend:'host',open:'arrangement'},
 ...session.tracks.map(t=>({id:t.id,label:t.label,type:'component',pattern:t.pattern,detail:`${t.pattern} · ${t.pool} voices`,backend:'wasm',open:'pool'})),
 {id:'drums',label:'Percussion',type:'group',detail:'9 independent voices',backend:'wasm',open:'drums'},
 {id:'mix',label:'Stereo mixer',type:'bus',detail:'Dry + auxiliary sends',backend:'host',open:'mixer'},
 {id:'echo',label:'Cross echo',type:'effect',detail:`${session.space.delayBeats} beat · feedback`,backend:'host'},
 {id:'room',label:'Diffuse chamber',type:'component',pattern:'chamber',detail:'2 channels · combs + allpass',backend:'wasm',open:'leaf'},
 {id:'out',label:'Output',type:'output',detail:'Stereo · soft ceiling',backend:'host'}];
 const edges=[{from:'clock',to:'score',kind:'event'}];
 for(const t of [...session.tracks,{id:'drums'}]){edges.push({from:'score',to:t.id,kind:'event'},{from:t.id,to:'mix',kind:'audio'});}
 edges.push({from:'mix',to:'echo',kind:'audio',port:'send'},{from:'mix',to:'room',kind:'audio',port:'send'},{from:'mix',to:'out',kind:'audio',port:'dry'},{from:'echo',to:'out',kind:'audio'},{from:'room',to:'out',kind:'audio'});
 return {name:session.title,nodes,edges};
}