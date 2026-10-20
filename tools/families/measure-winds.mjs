// Tuning audit of published kernels: cents from the requested pitch at four notes (±1200 is octave ambiguity),
// periodicity, held-note sustain and level. node measure-winds.mjs [id filter]
// Autocorrelation can lock onto two or three periods: ±1200 is an octave (high-register variants sound an
// octave up by design) and about -700 is three periods of a note an octave up; confirm with peaks.mjs.
// Measures wind/reed kernels: pitch accuracy, sustain while held, noise, at several notes.
import fs from 'node:fs';
import {renderKernel} from './render.mjs';
const pub='../../public',index=JSON.parse(fs.readFileSync(pub+'/lean/families/index.json','utf8')),cache={};
export const kernelBytes=id=>{const f=index.families[id];cache[f]??=JSON.parse(fs.readFileSync(pub+'/lean/families/'+f,'utf8'));return Buffer.from(cache[f].patterns[id].wasmBase64,'base64');};
const SR=48000;
export function analyse(y,freq,from,to){
 // fundamental by normalised autocorrelation in [freq/2.2, freq*2.2]
 const a=Math.round(from*SR),N=4096;let best=-1,lag=0;
 for(let L=Math.floor(SR/(freq*2.2));L<=Math.ceil(SR/(freq/2.2));L++){let s=0,e1=0,e2=0;for(let i=0;i<N;i++){s+=y[a+i]*y[a+i+L];e1+=y[a+i]**2;e2+=y[a+i+L]**2;}const c=s/Math.sqrt(e1*e2+1e-12);if(c>best){best=c;lag=L;}}
 const rms=(p,q)=>{let s=0;for(let i=Math.round(p*SR);i<Math.round(q*SR);i++)s+=y[i]*y[i];return Math.sqrt(s/((q-p)*SR));};
 const f0=lag?SR/lag:0;return {cents:f0?1200*Math.log2(f0/freq):NaN,periodicity:best,early:rms(.15,.35),late:rms(to-.3,to)};
}
export function report(id,bytes){
 const rows=[];for(const note of [57,64,69,76]){const freq=440*2**((note-69)/12),y=renderKernel(bytes,{freq,seconds:2.4,gateOn:2,velocity:.75,colour:.5,life:1});const r=analyse(y,freq,1,2);rows.push(r);}
 const c=rows.map(r=>r.cents),bad=rows.filter(r=>!(Math.abs(r.cents)<25)).length;
 return `${id.padEnd(30)} cents ${c.map(x=>Number.isFinite(x)?x.toFixed(0).padStart(5):'  nan').join('')} | periodic ${rows.map(r=>r.periodicity.toFixed(2)).join(' ')} | held late/early ${rows.map(r=>(r.late/(r.early||1e-9)).toFixed(2)).join(' ')} | rms ${rows[2].late.toFixed(3)}${bad?'  OUT OF TUNE x'+bad:''}`;
}
if(process.argv[1]?.endsWith('measure-winds.mjs')){
 const ids=Object.keys(index.families).filter(id=>/^(blown|reed)/.test(id)&&(!process.argv[2]||id.includes(process.argv[2])));
 for(const id of ids.filter((_,i)=>i%3===0))console.log(report(id,kernelBytes(id)));
}
