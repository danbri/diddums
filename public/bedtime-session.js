import {patterns} from './patterns.js';
import {loadLeanKernel} from './lean-client.js';
import {siteUrl} from './site-url.js';

const $=id=>document.getElementById(id), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const schema='diddums.performance-notes/1', ids=['accompaniment','melody'];
$('provenance').style.overflowWrap='anywhere';
let data=null, original=null, session=null, ctx=null, node=null, modules=null, runtime=null;
let playing=false, loaded=false, generation=0, position=0, latest=null, loadedMessage=null, windowStart=0;
const errors=[], eventLog=[];
const clock=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error);}
function fail(e){const s=e?.message||String(e);errors.push(s);status(s,true);playing=false;$('play').textContent='Play';if(ctx?.state==='running')ctx.suspend().catch(()=>{});}
window.addEventListener('error',e=>fail(e.error||e.message));
window.addEventListener('unhandledrejection',e=>fail(e.reason));

export function validatePerformance(p){
 if(!p||p.schema!==schema||p.time_unit!=='seconds'||!Array.isArray(p.notes)||!p.notes.length||p.notes.length>32768)throw new Error('Expected a non-empty diddums.performance-notes/1 file, using seconds (maximum 32768 notes).');
 const rows=p.notes.map((r,i)=>{
  if(!Array.isArray(r)||r.length<5)throw new Error(`Invalid note row ${i+1}`);
  const [t,d,n,v,part]=r;
  if(![t,d,n,v,part].every(Number.isFinite)||t<0||t>3600||d<=0||d>600||!Number.isInteger(n)||n<0||n>127||!Number.isInteger(v)||v<1||v>127||![0,1].includes(part))throw new Error(`Out-of-range note row ${i+1}`);
  return [t,d,n,v,part,String(r[5]||'').slice(0,40)];
 }).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
 const end=rows.reduce((m,r)=>Math.max(m,r[0]+r[1]),0),duration=Math.max(Number(p.source_duration_s)||0,end+1);
 if(duration>4200)throw new Error('Performance exceeds this page\'s 70-minute bound.');
 return {...p,source_duration_s:duration,note_count:rows.length,parts:ids,notes:rows};
}

export function toSession(p,sr){
 if(!Number.isFinite(sr)||sr<8000||sr>192000)throw new Error('Unsupported sample rate');
 // One reference bar = one second. This is a transport mapping, NOT a meter estimate.
 const bars=Math.ceil(p.source_duration_s),tracks=ids.map((id,i)=>({id,label:i?'Melody':'Accompaniment',pattern:'tine',role:'keys',level:i?.65:.58,pan:i?.10:-.10,send:.13,colour:.23,life:1.25,pool:1,poolRequired:1}));
 const events=p.notes.map((r,i)=>({id:`bedtime/${i}`,frame:Math.round(r[0]*sr),track:ids[r[4]],note:r[2],bar:Math.floor(r[0]),step:(r[0]%1)*4,nominalBeat:r[0],humanizeBeats:0,velocity:r[3]/127,durationBeats:r[1],duration:Math.max(32,Math.round(r[1]*sr)),colour:.23,life:1.25,review:r[5],imported:true}));
 for(const t of tracks){const points=[];for(const e of events)if(e.track===t.id){points.push([e.frame,1],[e.frame+e.duration+Math.ceil(sr*e.life*1.7),-1]);}points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let active=0,peak=0;for(const [,d]of points){active+=d;peak=Math.max(peak,active);}if(peak>24)throw new Error(`${t.label} requires ${peak} voices; Diddums' bound is 24 per track.`);t.pool=t.poolRequired=Math.max(1,peak);}
 return {id:'nearly-bedtime',title:p.title,key:'Not inferred',sampleRate:sr,meter:[1,4],bpm:60,bars,beats:1,steps:4,seed:1,tracks,kit:[],space:{room:.35,damp:.55,wet:.16,echo:0,delayBeats:.3,feedback:0},sections:[{name:'Imported performance (seconds)',start:0,bars,roles:['pad'],energy:.7}],harmony:[[48,0,4,7]],events,grids:Array.from({length:bars},()=>({})),durationFrames:Math.round(p.source_duration_s*sr),tailFrames:Math.round(3*sr),maxEvents:32768,timeBasis:'seconds; reference meter and 60 BPM are not musical estimates'};
}

function message({data:d}){
 if(d.type==='error'){fail(new Error(d.message));return;}
 if(d.generation!==generation)return;
 if(d.type==='loaded'){loadedMessage=d;status(`Diddums runtime loaded: ${d.events} notes · ${d.voices} voices · ${d.kernels} verified Wasm kernels`);}
 if(d.type==='event-log'){eventLog.push(...d.records);if(eventLog.length>2000)eventLog.splice(0,eventLog.length-2000);}
 if(d.type==='telemetry'){latest=d;position=d.position/d.sampleRate;$('seek').value=String(Math.min(position,data.source_duration_s));updateTime();draw();}
 if(d.type==='ended'){playing=false;position=0;loaded=false;$('play').textContent='Play';status('Performance ended.');ctx.suspend().catch(fail);}
}
async function ensureRuntime(){
 if(runtime)return runtime;
 runtime=(async()=>{
  status('Checking the pinned native-Lean instrument artifacts…');
  if(!window.AudioContext||!window.AudioWorkletNode)throw new Error('This browser does not support the required Web Audio worklet runtime.');
  ctx=new AudioContext({latencyHint:'interactive'});await ctx.resume();
  modules=await Promise.all(['tine','chamber'].map(id=>loadLeanKernel(id,patterns[id].source)));
  await ctx.audioWorklet.addModule(siteUrl('studio-worklet.js'));
  node=new AudioWorkletNode(ctx,'diddums-studio',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
  node.connect(ctx.destination);node.port.onmessage=message;node.onprocessorerror=()=>fail(new Error('Diddums audio processor stopped. Reload the page to reset it.'));
 })().catch(async e=>{runtime=null;node=null;if(ctx)await ctx.close().catch(()=>{});ctx=null;throw e;});
 return runtime;
}
function controlParts(){for(const [i,id]of ids.entries())node?.port.postMessage({type:'control',id,key:'mute',value:!$(i?'melody':'accomp').checked});}
async function play(){
 if(!data)return;
 $('play').disabled=true;
 try{
  if(playing){node.port.postMessage({type:'play',value:false});playing=false;await ctx.suspend();$('play').textContent='Play';status('Paused.');return;}
  await ensureRuntime();await ctx.resume();
  if(!loaded){session=toSession(data,ctx.sampleRate);generation++;eventLog.length=0;latest=null;loadedMessage=null;node.port.postMessage({type:'load',session,modules:modules.map(m=>({id:m.id,bytes:m.bytes,hash:m.hash,debug:m.debug})),generation,play:false});loaded=true;}
  // The stock worklet seeks to integral reference bars, here deliberately one second each.
  if(!playing&&position>0&&!latest)node.port.postMessage({type:'seek',bar:Math.round(position)});
  node.port.postMessage({type:'control',id:'out',key:'level',value:Number($('volume').value)});controlParts();node.port.postMessage({type:'play',value:true});playing=true;$('play').textContent='Pause';status('Playing through Diddums.');
 }catch(e){fail(e);}finally{$('play').disabled=false;}
}
async function stop(){playing=false;node?.port.postMessage({type:'play',value:false});if(ctx?.state==='running')await ctx.suspend();loaded=false;position=0;latest=null;windowStart=0;$('seek').value='0';$('play').textContent='Play';status('Stopped.');updateTime();draw();}
function seek(seconds){position=clamp(Math.round(Number(seconds)||0),0,Math.floor(data.source_duration_s));node?.port.postMessage({type:'seek',bar:position});latest=null;$('seek').value=String(position);updateTime();draw();}
function updateTime(){$('time').textContent=`${clock(position)} / ${clock(data?.source_duration_s||0)}`;}
function textOf(p){return ['# NOTE-EVENTS 1','# Times and durations are seconds; MIDI 60=C4. Draft transcription.', '# Durations and velocities are estimates; no recovered pedal events.', '# 60 BPM in MIDI is a seconds-based container, not inferred musical tempo.', '# part_index: 0=accompaniment, 1=melody; review=check flags uncertain rows.', 'start_s\tduration_s\tmidi_note\tvelocity\tpart_index\treview',...p.notes.map(r=>[r[0].toFixed(3),r[1].toFixed(3),...r.slice(2)].join('\t'))].join('\n')+'\n';}
function parseText(text){return text.split(/\r?\n/).map(l=>l.trimEnd()).filter(l=>l.trim()&&!l.trimStart().startsWith('#')&&!l.startsWith('start_s')).map((l,i)=>{let a=l.includes('\t')?l.split('\t'):l.trim().split(/\s+/);if(a.length>=7&&/^[A-G][#b]?\d+$/.test(a[3]))a=[a[0],a[1],a[2],a[4],a[5]==='melody'?'1':a[5]==='accompaniment'?'0':a[5],a[6]];if(a.length<5)throw new Error(`Too few columns in row ${i+1}`);return [...a.slice(0,5).map(Number),a[5]||''];});}
async function accept(p){const next=validatePerformance(p);toSession(next,48000);await stop();data=next;session=toSession(data,48000);$('editor').value=textOf(data);$('seek').max=String(Math.floor(data.source_duration_s));$('summary').textContent=`${data.notes.length} note events · ${data.notes.filter(r=>r[5]).length} review flags · ${clock(data.source_duration_s)} source recording`;$('provenance').textContent=`Source: ${data.source_filename||'imported note file'} · SHA-256 ${data.source_sha256||'not supplied'}`;for(const id of ['play','stop','textExport','midiExport','jsonExport'])$(id).disabled=false;status('Ready. Press Play to start audio.');updateTime();draw();}
function save(name,bytes,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function midiBytes(p){
 const enc=new TextEncoder(),str=s=>Array.from(enc.encode(s)),be=(n,len)=>Array.from({length:len},(_,i)=>(n>>>((len-1-i)*8))&255);
 const vlq=n=>{let b=[n&127];while((n=Math.floor(n/128))>0)b.unshift((n&127)|128);return b;};
 const chunk=(id,b)=>[...str(id),...be(b.length,4),...b],trackName=s=>[0,255,3,...vlq(str(s).length),...str(s)];
 const conductor=chunk('MTrk',[...trackName('Seconds-based draft, not musical tempo'),0,255,81,3,15,66,64,0,255,47,0]);
 const tracks=ids.map((id,part)=>{
  const events=[];for(const [s,d,n,v,pi]of p.notes)if(pi===part){events.push([Math.round(s*1000),1,n,v],[Math.round((s+d)*1000),0,n,0]);}
  events.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);let tick=0;const bytes=[...trackName(id),0,192+part,0];
  for(const [at,on,n,v]of events){bytes.push(...vlq(at-tick),(on?144:128)+part,n,v);tick=at;}bytes.push(0,255,47,0);return chunk('MTrk',bytes);
 });return new Uint8Array([...str('MThd'),0,0,0,6,0,1,0,3,3,232,...conductor,...tracks.flat()]);
}
function draw(){
 if(!data)return;const c=$('roll'),rect=c.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(devicePixelRatio||1,2);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
 const span=w<600?14:28,left=36,top=25,bottom=12,lo=Math.min(47,...data.notes.map(r=>r[2])),hi=Math.max(82,...data.notes.map(r=>r[2]));
 if($('follow').checked)windowStart=Math.max(0,Math.floor(position/span)*span);
 const x=t=>left+(t-windowStart)/span*(w-left),y=n=>top+(hi-n)/(hi-lo+1)*(h-top-bottom),rh=(h-top-bottom)/(hi-lo+1);
 g.font='10px system-ui';for(let n=lo;n<=hi;n++){g.fillStyle=[1,3,6,8,10].includes(n%12)?'#0a1521':'#101f30';g.fillRect(left,y(n),w-left,rh);if(n%12===0){g.fillStyle='#aabed0';g.fillText('C'+(Math.floor(n/12)-1),3,y(n)+8);}}
 for(let t=Math.ceil(windowStart/2)*2;t<windowStart+span;t+=2){g.fillStyle='#7e97ad';g.fillText(t+'s',x(t)+3,15);g.strokeStyle='#26384a';g.beginPath();g.moveTo(x(t),top);g.lineTo(x(t),h-bottom);g.stroke();}
 g.save();g.beginPath();g.rect(left,top,w-left,h-top-bottom);g.clip();for(const [t,d,n,v,part,flag]of data.notes){if(t+d<windowStart||t>windowStart+span)continue;g.globalAlpha=.45+.55*v/127;g.fillStyle=part?'#c5b2ef':'#9acbee';const width=Math.max(2,d/span*(w-left));g.fillRect(x(t),y(n)+1,width,Math.max(2,rh-1));if(flag){g.globalAlpha=1;g.strokeStyle='#ffd89b';g.strokeRect(x(t),y(n)+1,width,Math.max(2,rh-1));}}
 g.globalAlpha=1;g.strokeStyle='#fff';g.beginPath();g.moveTo(x(position),top);g.lineTo(x(position),h);g.stroke();g.restore();
}
$('play').onclick=play;$('stop').onclick=()=>stop().catch(fail);$('seek').oninput=e=>seek(e.target.value);$('volume').oninput=e=>node?.port.postMessage({type:'control',id:'out',key:'level',value:Number(e.target.value)});$('accomp').onchange=controlParts;$('melody').onchange=controlParts;$('follow').onchange=draw;
$('roll').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();seek(windowStart+clamp((e.clientX-r.left-36)/(r.width-36),0,1)*(r.width<600?14:28));};
$('apply').onclick=async()=>{try{await accept({...data,notes:parseText($('editor').value),status:'locally edited draft transcription'});}catch(e){fail(e);}};
$('reset').onclick=()=>accept(structuredClone(original)).catch(fail);
$('import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>4*1024*1024)throw new Error('JSON import is limited to 4 MB.');await accept(JSON.parse(await f.text()));}catch(e){fail(e);}};
$('textExport').onclick=()=>save('nearly-bedtime.notes.txt',textOf(data),'text/plain;charset=utf-8');$('jsonExport').onclick=()=>save('nearly-bedtime.performance.json',JSON.stringify(data,null,2)+'\n','application/json');$('midiExport').onclick=()=>save('nearly-bedtime.mid',midiBytes(data),'audio/midi');
new ResizeObserver(draw).observe($('roll'));
window.bedtime={get data(){return data;},get session(){return session;},get modules(){return modules;},get context(){return ctx;},get node(){return node;},get diagnostics(){return {ready:!!data,playing,loaded,position,noteCount:data?.notes.length||0,reviewCount:data?.notes.filter(r=>r[5]).length||0,sampleRate:ctx?.sampleRate||null,loadedMessage,telemetry:latest?.telemetry||null,rms:latest?.measurements?.out?.rms||0,peak:latest?.measurements?.out?.peak||0,nonFinite:latest?.nonFinite||0,eventCount:eventLog.length,errors:[...errors]};},get eventLog(){return eventLog;},play,stop,seek,toSession,validatePerformance,midiBytes,textOf};
(async()=>{try{const r=await fetch('./performances/nearly-bedtime.json');if(!r.ok)throw new Error('Performance file unavailable: '+r.status);original=validatePerformance(await r.json());await accept(structuredClone(original));}catch(e){fail(e);}})();
