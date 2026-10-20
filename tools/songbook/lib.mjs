// Songbook helpers: write a piece as a chord chart, accompaniment patterns and melodies, and get an
// ordinary Song (JSON) whose parts are seconds-timed note sequences. Harmony can change on any beat,
// which role-based tracks (chords every two bars) cannot do.
//
// form: [{name, bars: 'C . G . | Am F', x: 2, energy, drums: true, parts: {lead: 'E5/2 D5 C5/4 …'}}]
//   bars: one chord symbol per bar; '.' repeats the previous bar's chord; 'C,G' splits a bar in two.
//   parts: a melody per section (tokens note/steps, r/steps for rests, chords with +, @velocity),
//   repeated to fill the section. A part set to a pattern name instead uses that pattern on the chords.
// tracks: {id: {sound, pattern | 'melody', level, pan, send, octave, label…}}
const PC={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
const QUAL={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],dim:[0,3,6],dim7:[0,3,6,9],aug:[0,4,8],sus4:[0,5,7],sus2:[0,2,7],'6':[0,4,7,9],m6:[0,3,7,9],'9':[0,4,7,10,14],add9:[0,4,7,14],'5':[0,7],m7b5:[0,3,6,10],m9:[0,3,7,10,14]};
export function parseChord(sym){
 const m=String(sym).match(/^([A-G][b#]?)(m7b5|maj7|m7|m6|m9|dim7|dim|aug|sus4|sus2|add9|m|7|6|9|5)?(?:\/([A-G][b#]?))?$/);if(!m)throw new Error('Bad chord '+sym);
 return {root:PC[m[1]],ivs:QUAL[m[2]||''],bass:m[3]!=null?PC[m[3]]:PC[m[1]],quality:m[2]||''};
}
const NAMES=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
export const name=n=>NAMES[((n%12)+12)%12]+(Math.floor(n/12)-1);
export function midi(token){const m=String(token).match(/^([A-G][b#]?)(-?\d)$/);if(!m)throw new Error('Bad note '+token);return 12*(+m[2]+1)+PC[m[1]];}
// Chord tones placed in [lo, lo+12), sorted; power chords stack root, fifth, octave from lo.
export function voicing(ch,lo=55){if(ch.quality==='5'){let r=lo+((ch.root-lo)%12+12)%12;return [r,r+7,r+12];}return ch.ivs.map(i=>{const pc=(ch.root+i)%12;return lo+((pc-lo)%12+12)%12;}).sort((a,b)=>a-b);}
export const bassOf=(ch,lo=36)=>lo+((ch.bass-lo)%12+12)%12;

// One bar of a pattern: returns [{at (step), notes, len (steps), vel}] for steps = beats*sub.
// `next` is the following bar's first chord (for walking basses).
export const PATTERNS={
 // Bass
 whole:(c,{steps})=>[{at:0,notes:[bassOf(c)],len:steps}],
 half:(c,{steps})=>[{at:0,notes:[bassOf(c)],len:steps/2},{at:steps/2,notes:[bassOf(c)+(c.quality==='5'?0:7)],len:steps/2}],
 quarter:(c,{steps,sub})=>range(steps/sub).map(b=>({at:b*sub,notes:[bassOf(c)],len:sub*.9,vel:b%2?.8:1})),
 eighth:(c,{steps,sub})=>range(steps/(sub/2)).map(i=>({at:i*sub/2,notes:[bassOf(c)],len:sub/2*.8,vel:i%2?.75:1})),
 octave:(c,{steps,sub})=>range(steps/(sub/2)).map(i=>({at:i*sub/2,notes:[bassOf(c)+(i%2?12:0)],len:sub/2*.7,vel:i%2?.85:1})),
 rootfifth:(c,{steps,sub})=>range(steps/sub).map(b=>({at:b*sub,notes:[bassOf(c)+(b%2?7:0)],len:sub*.85})),
 walk:(c,{steps,sub,next})=>{const r=bassOf(c),n=next?bassOf(next):r,approach=n>r?n-1:n+1,third=r+(c.ivs.includes(3)?3:4),line=[r,third,r+7,approach];return range(steps/sub).map(b=>({at:b*sub,notes:[line[b%4]],len:sub*.9,vel:b%2?.8:1}));},
 boogie:(c,{steps,sub})=>{const r=bassOf(c),third=c.ivs.includes(3)?3:4,line=[0,third,7,9,10,9,7,third];const out=[];for(let b=0;b<steps/sub;b++){out.push({at:b*sub,notes:[r+line[(2*b)%8]],len:sub*.6,vel:1},{at:b*sub+2*sub/3,notes:[r+line[(2*b+1)%8]],len:sub/3*.9,vel:.75});}return out;},
 reggae:(c,{sub})=>{const r=bassOf(c);return [{at:0,notes:[r],len:sub*1.4},{at:sub*1.5,notes:[r],len:sub*.4,vel:.8},{at:sub*2.5,notes:[r+7],len:sub*.4,vel:.85},{at:sub*3,notes:[r+12],len:sub*.8,vel:.8}];},
 ska:(c,{steps,sub})=>{const r=bassOf(c),third=c.ivs.includes(3)?3:4,line=[0,third,7,9];return range(steps/sub).map(b=>({at:b*sub,notes:[r+line[b%4]],len:sub*.7,vel:b%2?.85:1}));},
 gallop:(c,{steps,sub})=>{const r=bassOf(c),out=[];for(let b=0;b<steps/sub;b++)out.push({at:b*sub,notes:[r],len:sub/2*.8,vel:1},{at:b*sub+sub/2,notes:[r],len:sub/4*.8,vel:.8},{at:b*sub+3*sub/4,notes:[r],len:sub/4*.8,vel:.8});return out;},
 chug:(c,{steps,sub,lo})=>{const v=voicing({...c,quality:'5'},lo),out=[];for(let b=0;b<steps/sub;b++)out.push({at:b*sub,notes:v,len:sub/2*.8,vel:1},{at:b*sub+sub/2,notes:[v[0]],len:sub/4*.7,vel:.7},{at:b*sub+3*sub/4,notes:[v[0]],len:sub/4*.7,vel:.7});return out;},
 pedal:(c,{steps,sub})=>range(steps/(sub/4)).map(i=>({at:i*sub/4,notes:[bassOf(c)],len:sub/4*.7,vel:i%4?.7:1})),
 synco:(c,{sub})=>{const r=bassOf(c);return [{at:0,notes:[r],len:sub*.7},{at:sub*1.5,notes:[r+12],len:sub*.4,vel:.8},{at:sub*2.5,notes:[r],len:sub*.4,vel:.9},{at:sub*3.5,notes:[r+7],len:sub*.4,vel:.8}];},
 waltzbass:(c,{sub})=>[{at:0,notes:[bassOf(c)],len:sub*.9}],
 sixeight:(c,{sub})=>[{at:0,notes:[bassOf(c)],len:sub*2.5},{at:sub*3,notes:[bassOf(c)+7],len:sub*2.5,vel:.85}],
 // Chords (keys, guitar, strings)
 block:(c,{steps,lo})=>[{at:0,notes:voicing(c,lo),len:steps*.98}],
 halves:(c,{steps,lo})=>[0,1].map(i=>({at:i*steps/2,notes:voicing(c,lo),len:steps/2*.9,vel:i?.8:1})),
 quarters:(c,{steps,sub,lo})=>range(steps/sub).map(b=>({at:b*sub,notes:voicing(c,lo),len:sub*.5,vel:b%2?.75:.9})),
 offbeat:(c,{steps,sub,lo})=>range(steps/sub).map(b=>({at:b*sub+sub/2,notes:voicing(c,lo),len:sub/2*.6,vel:.85})),
 backbeat:(c,{steps,sub,lo})=>range(steps/sub).filter(b=>b%2).map(b=>({at:b*sub,notes:voicing(c,lo),len:sub*.6})),
 pump:(c,{steps,sub,lo})=>range(steps/(sub/2)).map(i=>({at:i*sub/2,notes:voicing(c,lo),len:sub/2*.75,vel:i%2?.7:.95})),
 power:(c,{steps,sub,lo})=>range(steps/(sub/2)).map(i=>({at:i*sub/2,notes:voicing({...c,quality:'5'},lo),len:sub/2*.6,vel:i%4===0?1:.75})),
 arp:(c,{steps,sub,lo})=>{const v=voicing(c,lo),seq=[...v,v[0]+12,...v.slice(1).reverse()];return range(steps/(sub/2)).map(i=>({at:i*sub/2,notes:[seq[i%seq.length]],len:sub/2*1.6,vel:i%2?.7:.9}));},
 arp16:(c,{steps,sub,lo})=>{const v=voicing(c,lo),seq=[v[0],v[1],v[2],v[0]+12,v[2],v[1]];return range(steps/(sub/4)).map(i=>({at:i*sub/4,notes:[seq[i%seq.length]],len:sub/4*1.5,vel:i%4?.65:.9}));},
 waltz:(c,{sub,lo})=>[1,2].map(b=>({at:b*sub,notes:voicing(c,lo),len:sub*.6,vel:.75})),
 shuffle:(c,{steps,sub,lo})=>range(steps/sub).map(b=>({at:b*sub+(b%2?0:2*sub/3),notes:voicing(c,lo),len:sub/3*.9,vel:b%2?.95:.6})),
 push:(c,{sub,lo})=>[{at:0,notes:voicing(c,lo),len:sub*.4},{at:sub*1.5,notes:voicing(c,lo),len:sub*.4,vel:.8},{at:sub*3.5,notes:voicing(c,lo),len:sub*.4,vel:.85}],
 strum:(c,{sub,lo})=>[{at:0,notes:voicing(c,lo),len:sub*1.4},{at:sub*1.5,notes:voicing(c,lo),len:sub*.4,vel:.7},{at:sub*2.5,notes:voicing(c,lo),len:sub*.4,vel:.75},{at:sub*3,notes:voicing(c,lo),len:sub*.9,vel:.85}],
 sixeightstrum:(c,{sub,lo})=>[0,2,3,5].map((b,i)=>({at:b*sub,notes:voicing(c,lo),len:sub*(i%2?.9:1.8),vel:i%2?.7:.95})),
 rest:()=>[]
};
const range=n=>Array.from({length:Math.max(0,Math.round(n))},(_,i)=>i);

// Transpose every note in a melody string.
export const up=(text,n)=>String(text).replace(/([A-G][b#]?)(-?\d)/g,t=>name(midi(t)+n));

// Melody tokens → [{at, notes, len, vel}] on a step grid.
export function melody(text){
 const out=[];let at=0;
 for(const tok of String(text).split(/[\s|]+/).filter(Boolean)){
  const m=tok.match(/^([^/@]+)(?:\/([\d.]+))?(?:@([\d.]+))?$/);if(!m)throw new Error('Bad melody token '+tok);
  const len=Number(m[2]??1);if(m[1]!=='r')out.push({at,notes:m[1].split('+').map(midi),len:len*.92,vel:m[3]!=null?Number(m[3]):null});at+=len;
 }
 return {events:out,length:at};
}

// Events → sequence text: one token per step, runs of rests as .*n.
function seqText(events,total,transpose=0){
 const steps=Array(total).fill(null);
 for(const e of events){const i=Math.round(e.at);if(i<0||i>=total)continue;const prev=steps[i];const notes=[...(prev?.notes||[]),...e.notes.map(n=>n+transpose)];steps[i]={notes:[...new Set(notes)].slice(0,8),len:Math.max(prev?.len||0,e.len),vel:e.vel??prev?.vel??null};}
 const toks=[];let rests=0;const flush=()=>{if(rests){toks.push(rests>1?'.*'+rests:'.');rests=0;}};
 for(const s of steps){if(!s){rests++;continue;}flush();toks.push(s.notes.map(name).join('+')+(s.vel!=null&&Math.abs(s.vel-.85)>.01?'@'+(+s.vel.toFixed(2)):'')+':'+(+s.len.toFixed(2)));}
 flush();return toks.join(' ');
}

export const warnings=[];
export function song({title,description,key,bpm,meter='4/4',sub=2,rhythm='none',swing,room=.4,form,tracks,space,extra={}}){
 const [num,den]=meter.split('/').map(Number),beats=num*4/den,stepsPerBar=Math.round(beats*sub),barSec=beats*60/bpm,stepSec=60/bpm/sub;
 // Expand the form into bars with chords (each bar: [{chord, from, to}] in steps).
 const bars=[],sections=[];let prev=null;
 for(const sec of form){
  const list=String(sec.bars).split(/[\s|]+/).filter(Boolean),start=bars.length;
  for(let r=0;r<(sec.x||1);r++)for(const b of list){const syms=b==='.'?[prev]:b.split(',');prev=syms[syms.length-1];bars.push({sec,chords:syms.map((s,i)=>({chord:s==='-'?null:parseChord(s),from:Math.round(i*stepsPerBar/syms.length),to:Math.round((i+1)*stepsPerBar/syms.length)}))});}
  sections.push({name:sec.name,start:+(start*barSec).toFixed(3),energy:sec.energy??.7,roles:sec.drums===false?['bass','pad','lead','arp','air']:['drums','bass','pad','lead','arp','air']});
 }
 const total=bars.length*stepsPerBar,out=[];
 for(const [id,t] of Object.entries(tracks)){
  const events=[];let sectionStart=0;
  for(const sec of form){
   const secBars=bars.filter(b=>b.sec===sec),first=bars.indexOf(secBars[0]),src=t.double||id,part=sec.parts&&src in sec.parts?sec.parts[src]:t.pattern;
   sectionStart=first*stepsPerBar;
   if(part==null||part==='rest'||sec.mute?.includes(id))continue;
   if(PATTERNS[part]){secBars.forEach((b,k)=>{const nextBar=bars[first+k+1];for(const {chord,from,to} of b.chords){if(!chord)continue;const span=to-from,next=nextBar?.chords[0].chord;for(const e of PATTERNS[part](chord,{steps:span,sub,lo:t.lo??55,next}))if(e.at<span)events.push({...e,at:(first+k)*stepsPerBar+from+e.at,vel:(e.vel??.9)*(t.vel??1)});}});}
   else{const m=melody(part),len=secBars.length*stepsPerBar;if(len%m.length&&!(m.length%stepsPerBar===0&&m.length<len))warnings.push(`${title} · ${sec.name} · ${id}: melody ${m.length} steps for ${len}`);if(m.length%stepsPerBar)warnings.push(`${title} · ${sec.name} · ${id}: melody ${m.length} steps is not whole bars of ${stepsPerBar}`);for(let off=0;off<len;off+=m.length)for(const e of m.events)if(off+e.at<len)events.push({...e,at:sectionStart+off+e.at});}
  }
  const {sound,label,level=.5,pan=0,send=.3,colour,life,transpose=0}=t;
  out.push({id,sound,label:label||id,seq:seqText(events,total,transpose),step:+stepSec.toFixed(5),from:0,loop:false,level,pan,send,...(colour!=null?{colour}:{}),...(life!=null?{life}:{})});
 }
 return {title,description,bpm,meter,key,rhythm,...(swing?{swing}:{}),seconds:+(bars.length*barSec+2).toFixed(2),room,...(space?{space}:{}),sections,tracks:out,...extra};
}
