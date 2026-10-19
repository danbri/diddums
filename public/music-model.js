// The musical view reads the same frame-stamped score the AudioWorklet consumes.
export const PPQ=960;
export const drumMidi={bd:36,sd:38,rs:37,cp:39,lt:45,mt:47,ht:50,ch:42,oh:46};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const beatFrames=s=>s.sampleRate*60/s.bpm;
export const allTracks=s=>[...s.tracks,...s.kit.map(t=>({...t,id:'d:'+t.id}))];
export function noteName(n){if(!Number.isFinite(n))return '—';const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];return names[((n%12)+12)%12]+(Math.floor(n/12)-1);}
export const exportNote=e=>e.track.startsWith('d:')?(drumMidi[e.track.slice(2)]??37):e.note;
export function applyNoteEdits(session,edits={}){
 const bf=beatFrames(session),valid=new Set(allTracks(session).map(t=>t.id));
 const transform=(e,p)=>{
  const n={...e};if(p){if(p.startBeat!=null){n.frame=Math.round(p.startBeat*bf);n.bar=Math.floor(p.startBeat/session.beats);n.step=(p.startBeat-n.bar*session.beats)*4;n.nominalBeat=p.startBeat;n.humanizeBeats=0;}if(p.durationBeat!=null)n.duration=Math.round(p.durationBeat*bf);for(const k of ['note','velocity','colour','life'])if(p[k]!=null)n[k]=p[k];}
  if(!valid.has(n.track)||!Number.isFinite(n.frame)||!Number.isFinite(n.duration)||!Number.isFinite(n.note)||!Number.isFinite(n.velocity))throw new Error('Invalid note data');
  n.frame=Math.round(clamp(n.frame,0,session.durationFrames-1));n.duration=Math.max(1,Math.min(Math.round(n.duration),session.durationFrames-n.frame));n.note=Math.round(clamp(n.note,0,127));n.velocity=clamp(n.velocity,1/127,1);return n;
 };
 const result=[];for(const e of session.events){const p=edits[e.id];if(!p?.deleted)result.push(p?transform(e,p):e);}
 for(const [id,p]of Object.entries(edits))if(p.add&&!p.deleted){const t=allTracks(session).find(t=>t.id===p.track);if(!t)throw new Error('Unknown note track');result.push(transform({id,track:t.id,note:p.note??60,frame:0,bar:0,step:0,nominalBeat:0,humanizeBeats:0,duration:bf*.5,velocity:p.velocity??.7,colour:t.colour,life:t.life},p));}
 if(result.length>32768)throw new Error('The score is limited to 32,768 note events');
 result.sort((a,b)=>a.frame-b.frame||a.track.localeCompare(b.track));return result;
}
// General MIDI program (0-based) closest to each instrument family, so other software picks a sensible
// instrument and midi-import.js maps it back to the same family.
const GM_PROGRAM_OF={roundBass:32,acidBass:38,tine:4,glass:14,pluck:24,felt:12,silk:48,choir:52,organ:16,pulse:81,rain:122,shepard:95,phantomRoot:16,ghostBeat:89,sineVox:54,sineChoir:54,speechGesture:121,heartbeat:116,orbitBlip:80,sonar:125,radioSnow:127,tom:117,kick:118,snare:118,hat:118,clap:118};
// Format-1 Standard MIDI File, with a conductor track and a track per instrument.
// This exports the planned score, NOT the DSP or a capture of allocator/choke behaviour.
export function midiFile(s){
 const text=new TextEncoder(),be16=n=>[(n>>>8)&255,n&255],be32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
 const vlq=n=>{if(!Number.isSafeInteger(n)||n<0||n>0x0fffffff)throw new Error('MIDI delta time out of range');const b=[n&127];while(n>>>=7)b.unshift((n&127)|128);return b;};
 const meta=(type,bytes)=>[255,type,...vlq(bytes.length),...bytes];
 const named=name=>meta(3,[...text.encode(name)]);
 const chunk=items=>{items.sort((a,b)=>a.tick-b.tick||a.order-b.order);const bytes=[];let prev=0;for(const e of items){bytes.push(...vlq(e.tick-prev),...e.data);prev=e.tick;}bytes.push(0,255,47,0);return [...text.encode('MTrk'),...be32(bytes.length),...bytes];};
 const us=Math.round(60000000/s.bpm),den=Math.log2(s.meter[1]);if(!Number.isInteger(den)||us<1||us>0xffffff)throw new Error('Unsupported MIDI tempo/meter');
 const conductor=[{tick:0,order:0,data:named(s.title)},{tick:0,order:1,data:meta(81,[(us>>16)&255,(us>>8)&255,us&255])},{tick:0,order:2,data:meta(88,[s.meter[0],den,24,8])}];
 for(const section of s.sections)conductor.push({tick:Math.round(section.start*s.beats*PPQ),order:3,data:meta(6,[...text.encode(section.name)])});
 const chunks=[chunk(conductor)],bf=beatFrames(s);
 const groups=s.tracks.map((t,i)=>({id:t.id,name:t.label,channel:i<9?i:i+1,program:GM_PROGRAM_OF[t.pattern],events:s.events.filter(e=>e.track===t.id)}));
 const percussion=s.events.filter(e=>e.track.startsWith('d:'));if(percussion.length)groups.push({id:'drums',name:'Percussion (GM note mapping)',channel:9,events:percussion});
 for(const g of groups){const events=[{tick:0,order:0,data:named(g.name)}];if(g.program!=null&&g.channel!==9)events.push({tick:0,order:0,data:[0xc0|g.channel,g.program]});for(const e of g.events){const start=Math.round(e.frame/bf*PPQ),end=Math.max(start+1,Math.round((e.frame+e.duration)/bf*PPQ)),n=exportNote(e),v=clamp(Math.round(e.velocity*127),1,127);events.push({tick:start,order:2,data:[0x90|g.channel,n,v]},{tick:end,order:1,data:[0x80|g.channel,n,0]});}chunks.push(chunk(events));}
 const header=[...text.encode('MThd'),0,0,0,6,0,1,...be16(chunks.length),...be16(PPQ)],size=header.length+chunks.reduce((n,b)=>n+b.length,0),out=new Uint8Array(size);out.set(header);let offset=header.length;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;
}
// Every chromatic note carries its accidental in the time-proportional stave.
export function spellPitch(note,preferFlats=false){
 const sharp=[['C',0],['C',1],['D',0],['D',1],['E',0],['F',0],['F',1],['G',0],['G',1],['A',0],['A',1],['B',0]];
 const flat=[['C',0],['D',-1],['D',0],['E',-1],['E',0],['F',0],['G',-1],['G',0],['A',-1],['A',0],['B',-1],['B',0]];
 const [letter,alter]=(preferFlats?flat:sharp)[note%12],octave=Math.floor(note/12)-1;return {letter,alter,octave,diatonic:octave*7+'CDEFGAB'.indexOf(letter),name:letter+(alter<0?'♭':alter>0?'♯':'')+octave};
}