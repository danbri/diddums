// Strongest spectral peaks (Hz) of draft-compiled families at 220 and 440 Hz: node peaks.mjs <id> …
import {families} from './archetypes.mjs';
import {compileLeanDSP} from '../../public/leandsp.js';
import {watToBytes,renderKernel} from './render.mjs';
const SR=48000;
function peaks(y,a){const N=8192,mags=[];for(let k=1;k<N/2;k++){const f=k*SR/N;if(f>4000)break;let r=0,i2=0;for(let i=0;i<N;i++){const w=.5-.5*Math.cos(2*Math.PI*i/N),v=y[a+i]*w;r+=v*Math.cos(2*Math.PI*k*i/N);i2+=v*Math.sin(2*Math.PI*k*i/N);}mags.push([f,Math.hypot(r,i2)]);}
 return mags.filter((m,i)=>i>0&&i<mags.length-1&&m[1]>mags[i-1][1]&&m[1]>mags[i+1][1]).sort((a,b)=>b[1]-a[1]).slice(0,3).map(m=>m[0].toFixed(0)).join(',');}
for(const id of process.argv.slice(2)){const f=families.find(f=>f.id===id),b=await watToBytes((await compileLeanDSP(f.source)).wat,id);for(const fr of [220,440]){const y=renderKernel(b,{freq:fr,seconds:2,gateOn:2,velocity:.75});console.log(id,fr,'peaks',peaks(y,48000));}}
