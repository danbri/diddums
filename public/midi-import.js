// Standard MIDI File → Diddums Song. Each channel/instrument becomes a timed-note track on a 16th-note
// grid; General MIDI programs map to the nearest Diddums sound and channel 10 drums to the kit
// instruments. Diddums has no samples, so "piano" means the felt-mallet synth, and so on.
import {MAX_TRACKS,checkSong} from './song.js';

// General MIDI program families (8 programs each) → Diddums sound ids, with a few individual overrides.
const GM_FAMILY=['feltPiano','celesta','drawbarOrgan','nylonGuitar','subBass','stringEnsemble','stringEnsemble','hornCall',
 'hornCall','hornCall','chromeLead','nebulaPad','starfield','koto','woodBlocks','rain'];
const GM_PROGRAM={4:'electricPiano',5:'electricPiano',8:'celesta',9:'bells',10:'musicBox',11:'bells',12:'marimba',13:'marimba',14:'bells',19:'cathedralOrgan',
 33:'pluckBass',34:'pluckBass',35:'pluckBass',36:'pluckBass',37:'pluckBass',38:'acidLine',39:'acidLine',45:'harp',46:'harp',47:'timpani',
 52:'vowelChoir',53:'vowelChoir',54:'vowelChoir',55:'brassStabs',61:'brassStabs',62:'brassStabs',63:'brassStabs',
 80:'chromeLead',81:'chromeLead',89:'nebulaPad',91:'vaultedChoir',94:'vaultedChoir',96:'solarWind',98:'celesta',99:'starfield',100:'starfield',
 112:'bells',113:'woodBlocks',114:'timpani',115:'woodBlocks',116:'timpani',117:'timpani',118:'tom',120:'radioSnow',121:'wind',122:'rain',123:'birdCalls',125:'sonarPing',126:'rain',127:'radioSnow'};
const GM_NAME=['Piano','Chromatic percussion','Organ','Guitar','Bass','Strings','Ensemble','Brass','Reed','Pipe','Synth lead','Synth pad','Synth effects','Ethnic','Percussive','Sound effects'];
export const gmSound=program=>GM_PROGRAM[program]||GM_FAMILY[program>>3];
// Channel 10: GM drum note → kit instrument and the note it is played at.
function gmDrum(n){
 if(n===35||n===36)return ['kick','Kick',40];
 if([37,38,40].includes(n))return ['snare','Snare',55];
 if(n===39)return ['clap','Clap',60];
 if([41,43,45,47,48,50].includes(n))return ['tom','Toms',n+12];
 return ['hat','Hats & cymbals',[42,44].includes(n)?84:[46,49,51,52,55,57,59].includes(n)?72:90];
}

export function parseMidi(buf){
 const b=new Uint8Array(buf);let p=0;
 const str=n=>{let s='';for(let i=0;i<n;i++)s+=String.fromCharCode(b[p++]);return s;},u32=()=>(b[p++]<<24|b[p++]<<16|b[p++]<<8|b[p++])>>>0,u16=()=>b[p++]<<8|b[p++];
 const vlq=()=>{let v=0,c;do{c=b[p++];v=v*128+(c&127);}while(c&128&&p<b.length);return v;};
 if(str(4)!=='MThd')throw new Error('Not a Standard MIDI File');
 const hl=u32(),format=u16(),ntracks=u16(),division=u16();p+=hl-6;
 if(division&0x8000)throw new Error('SMPTE-timed MIDI files are not supported');
 const tracks=[];
 for(let t=0;t<ntracks&&p<b.length;t++){
  while(p<b.length&&str(4)!=='MTrk'){p+=u32()-0;}
  const len=u32(),end=p+len,ev=[];let tick=0,status=0,name='';
  while(p<end){
   tick+=vlq();let s=b[p];if(s&128){status=s;p++;}else s=status;
   const type=status&0xf0,ch=status&15;
   if(status===0xff){const meta=b[p++],l=vlq(),start=p;
    if(meta===0x51)ev.push({tick,type:'tempo',us:b[p]<<16|b[p+1]<<8|b[p+2]});
    else if(meta===0x58)ev.push({tick,type:'meter',num:b[p],den:2**b[p+1]});
    else if(meta===0x03){p=start;name=str(l);}
    p=start+l;}
   else if(status===0xf0||status===0xf7){p+=vlq();}
   else if(type===0x90||type===0x80){const note=b[p++],vel=b[p++];ev.push({tick,type:type===0x90&&vel>0?'on':'off',ch,note,vel});}
   else if(type===0xc0){ev.push({tick,type:'program',ch,program:b[p++]});}
   else if(type===0xd0){p+=1;}
   else p+=2;
  }
  p=end;tracks.push({name,events:ev});
 }
 return {format,division,tracks};
}

export function songFromMidi(buf,title='Imported MIDI'){
 const midi=parseMidi(buf),all=midi.tracks.flatMap((t,ti)=>t.events.map(e=>({...e,ti})));
 all.sort((a,b)=>a.tick-b.tick);
 // Tempo map → seconds.
 const tempos=all.filter(e=>e.type==='tempo');if(!tempos.length||tempos[0].tick>0)tempos.unshift({tick:0,us:500000});
 const secAt=tick=>{let s=0,last=0,us=tempos[0].us;for(const t of tempos){if(t.tick>=tick)break;s+=(t.tick-last)/midi.division*us/1e6;last=t.tick;us=t.us;}return s+(tick-last)/midi.division*us/1e6;};
 const bpm=Math.max(30,Math.min(240,Math.round(60e6/tempos[0].us))),meter=all.find(e=>e.type==='meter'),step=60/bpm/4;
 // Pair note-ons with note-offs, tracking the program on each channel.
 const program=new Array(16).fill(0),open=new Map(),notes=[];
 for(const e of all){
  if(e.type==='program'){program[e.ch]=e.program;continue;}
  if(e.type!=='on'&&e.type!=='off')continue;const k=e.ch*128+e.note;
  if(e.type==='on'){if(!open.has(k))open.set(k,[]);open.get(k).push({...e,program:program[e.ch],start:secAt(e.tick)});}
  else{const q=open.get(k);const on=q?.shift();if(on)notes.push({...on,end:secAt(e.tick)});}
 }
 for(const q of open.values())for(const on of q)notes.push({...on,end:on.start+.25});
 if(!notes.length)throw new Error('This MIDI file has no notes');
 // Group into tracks: channel 10 by drum type, other channels by channel + program.
 const groups=new Map();
 for(const n of notes){
  let key,sound,label,note=n.note;
  if(n.ch===9){const [s,l,pitch]=gmDrum(n.note);key='d:'+s;sound=s;label=l;note=pitch;}
  else{key=n.ch+':'+n.program;sound=gmSound(n.program);label=`Ch ${n.ch+1} · ${GM_NAME[n.program>>3]} (GM ${n.program+1})`;}
  if(!groups.has(key))groups.set(key,{key,sound,label,notes:[]});groups.get(key).notes.push({...n,note});
 }
 let list=[...groups.values()].sort((a,b)=>b.notes.length-a.notes.length);
 const dropped=list.slice(MAX_TRACKS);list=list.slice(0,MAX_TRACKS);
 const seconds=Math.min(600,Math.ceil(Math.max(...notes.map(n=>n.end))+1));
 const tracks=list.map((g,i)=>{
  const cells=new Map();let lastIdx=0;
  for(const n of g.notes){const idx=Math.round(n.start/step);if(idx>=4096)continue;const len=Math.max(1,Math.min(64,Math.round((n.end-n.start)/step)));
   const c=cells.get(idx)||{notes:[],len:1,vel:0};if(c.notes.length<8&&!c.notes.includes(n.note))c.notes.push(n.note);c.len=Math.max(c.len,len);c.vel=Math.max(c.vel,n.vel/127);cells.set(idx,c);lastIdx=Math.max(lastIdx,idx);}
  const vels=[...cells.values()].map(c=>c.vel).sort((a,b)=>a-b),base=Math.round((vels[vels.length>>1]||.8)*100)/100;
  const out=[];let rest=0;const flush=()=>{if(rest){out.push(rest>1?'.*'+rest:'.');rest=0;}};
  for(let s=0;s<=lastIdx;s++){const c=cells.get(s);if(!c){rest++;continue;}flush();
   out.push(c.notes.join('+')+(Math.abs(c.vel-base)>.08?'@'+c.vel.toFixed(2):'')+(c.len!==1?':'+c.len:''));}
  return {id:'t'+(i+1),label:g.label,sound:g.sound,seq:out.join(' '),step,gate:1,velocity:base,loop:false,from:0,level:g.key.startsWith('d:')?.7:.55};
 });
 const song={title,description:`Imported from a MIDI file: ${notes.length} notes on ${tracks.length} tracks, quantised to 16th notes at ${bpm} bpm.${dropped.length?` ${dropped.length} smaller parts were left out (Diddums plays at most ${MAX_TRACKS} tracks).`:''}`,
  bpm,meter:meter?`${meter.num}/${meter.den}`:'4/4',key:'C major',rhythm:'none',seconds,room:.4,tracks};
 return {song,problems:checkSong(song).problems,dropped:dropped.map(d=>d.label)};
}
