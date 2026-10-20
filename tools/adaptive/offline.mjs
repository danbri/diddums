// Offline renderer for adaptive music: runs public/studio-worklet.js in Node with the pinned native
// Lean kernels (catalog and family shards), driven by adaptiveCore exactly as in the browser, so tests
// can measure the rendered audio and the scheduled events.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const pub=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','..','public');
const SR=48000;
let Processor=null;
globalThis.sampleRate=SR;globalThis.currentFrame=0;
globalThis.AudioWorkletProcessor=class{constructor(){this.port={postMessage:m=>this.port.sent?.(m),onmessage:null};}};
globalThis.registerProcessor=(name,cls)=>{Processor=cls;};
await import(pathToFileURL(path.join(pub,'studio-worklet.js')).href);
export const {adaptiveCore,adaptiveSession,planEvents}=await import(pathToFileURL(path.join(pub,'adaptive.js')).href);
export const {compositionFromSong}=await import(pathToFileURL(path.join(pub,'song.js')).href);
const {drumKit}=await import(pathToFileURL(path.join(pub,'patterns.js')).href);

const catalog=JSON.parse(fs.readFileSync(path.join(pub,'lean','catalog.json'),'utf8'));
const index=JSON.parse(fs.readFileSync(path.join(pub,'lean','families','index.json'),'utf8'));
const shards=new Map();
function kernel(id){
 let p=catalog.patterns[id];
 if(!p){const file=index.families[id];if(!file)throw new Error('No kernel for '+id);if(!shards.has(file))shards.set(file,JSON.parse(fs.readFileSync(path.join(pub,'lean','families',file),'utf8')));p=shards.get(file).patterns[id];}
 return {id,bytes:Buffer.from(p.wasmBase64,'base64'),hash:p.wasmHash,debug:p.debug};
}

// Start an offline session. Returns the core (set, enter, hit…), the processor, and render(seconds)
// which advances audio and returns {L, R, start} for that stretch.
export function offline({composition,plan,state={},characters={},feel={},transitions=null,lookahead=2}){
 const proc=new Processor(),messages=[],scheduled=new Map(),controls=[];proc.port.sent=m=>messages.push(m);
 // `scheduled` mirrors what the worklet will play: each score message replaces every event not yet
 // reached (frame >= position) with the message's own. Control messages are kept in order.
 const post=m=>{if(m.type==='score'){const P=proc.position;for(const [id,e] of scheduled)if(e.frame>=P)scheduled.delete(id);for(const e of m.events)if(e.frame>=P)scheduled.set(e.id,e);}if(m.type==='control')controls.push({...m,at:proc.position});proc.port.onmessage({data:m});};
 const core=adaptiveCore({composition,plan,state,characters,feel,transitions,lookahead,sr:SR,post,clock:()=>proc.position});
 const needed=[...new Set([...composition.tracks.map(t=>t.pattern),...drumKit.map(d=>d.pattern),'chamber'])];
 post({type:'load',session:adaptiveSession(composition,core,SR),modules:needed.map(kernel),generation:1,play:true});
 post({type:'control',id:'out',key:'level',value:.7});
 core.tick(0);
 const errors=()=>messages.filter(m=>m.type==='error');
 function render(seconds,{every=128}={}){
  const n=Math.round(seconds*SR),L=new Float32Array(n),R=new Float32Array(n),start=proc.position;
  for(let f=0;f<n;f+=128){const k=Math.min(128,n-f),out=[[new Float32Array(128),new Float32Array(128)]];proc.process([],out);L.set(out[0][0].subarray(0,k),f);R.set(out[0][1].subarray(0,k),f);globalThis.currentFrame+=128;if(f%(every*8)===0)core.tick(proc.position);}
  if(errors().length)throw new Error('worklet: '+errors().map(e=>e.message).join('; '));
  return {L,R,start};
 }
 // Render one track on its own: every other track and the effects sends muted by solo.
 return {core,proc,render,messages,scheduled,controls,SR,
  events(track){return [...scheduled.values()].filter(e=>!track||e.track===track).sort((a,b)=>a.frame-b.frame);},
  solo(id){post({type:'control',id,key:'solo',value:true});},
  post};
}
export const rms=(x,a=0,b=x.length)=>{let s=0;for(let i=a;i<b;i++)s+=x[i]*x[i];return Math.sqrt(s/Math.max(1,b-a));};
// Spectral centroid in Hz of a 2048-sample window centred in [a, b) (Hann window, plain DFT).
export function centroid(x,a,b,sr=SR){const N=2048,start=Math.max(0,Math.floor((a+b)/2-N/2)),v=new Float64Array(N);for(let i=0;i<N;i++)v[i]=(x[start+i]||0)*(.5-.5*Math.cos(2*Math.PI*i/N));
 let num=0,den=0;for(let k=1;k<N/2;k++){let re=0,im=0;const w=2*Math.PI*k/N;for(let i=0;i<N;i++){re+=v[i]*Math.cos(w*i);im-=v[i]*Math.sin(w*i);}const m=re*re+im*im;num+=m*k*sr/N;den+=m;}return den?num/den:0;}
// Frequency of a near-sinusoidal signal over [a, b) from interpolated upward zero crossings.
// `lowpass` (Hz) first isolates the fundamental with four one-pole stages run from 0.1 s before `a`.
export function pitch(x,a,b,sr=SR,lowpass=0){a=Math.round(a);b=Math.round(b);let y=x;if(lowpass){const from=Math.max(0,a-Math.round(sr*.1)),k=1-Math.exp(-2*Math.PI*lowpass/sr),s=[0,0,0,0];y=new Float64Array(b);for(let i=from;i<b;i++){s[0]+=k*(x[i]-s[0]);s[1]+=k*(s[0]-s[1]);s[2]+=k*(s[1]-s[2]);s[3]+=k*(s[2]-s[3]);y[i]=s[3];}}
 let first=null,last=null,n=0;for(let i=a+1;i<b;i++)if(y[i-1]<0&&y[i]>=0){const t=i-1+(-y[i-1])/(y[i]-y[i-1]);if(first==null)first=t;last=t;n++;}return n>1?(n-1)*sr/(last-first):0;}
