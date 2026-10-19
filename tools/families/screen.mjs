#!/usr/bin/env node
// Screens generated families before the native Lean build: compiles each with the JS draft compiler
// (bit-identical output to the native kernels on the existing families), renders notes, rejects
// silent, unstable, stuck or DC-heavy programs, sets a common loudness, removes near-duplicates and
// describes each from measured features. Writes out/screened.json.
import fs from 'node:fs';
import {families} from './archetypes.mjs';
import {compileLeanDSP} from '../../public/leandsp.js';
import {renderKernel,watToBytes} from './render.mjs';
const SR=48000;
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let j=0;j<len/2;j++){const ur=re[i+j],ui=im[i+j],vr=re[i+j+len/2]*cr-im[i+j+len/2]*ci,vi=re[i+j+len/2]*ci+im[i+j+len/2]*cr;re[i+j]=ur+vr;im[i+j]=ui+vi;re[i+j+len/2]=ur-vr;im[i+j+len/2]=ui-vi;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t;}}}}
const BANDS=24,EDGES=[...Array(BANDS+1)].map((_,i)=>40*Math.pow(16000/40,i/BANDS));
function spectrum(y,at){const N=4096,re=new Float64Array(N),im=new Float64Array(N);for(let i=0;i<N;i++){const w=.5-.5*Math.cos(2*Math.PI*i/N);re[i]=(y[at+i]||0)*w;}fft(re,im);
 const mag=new Float64Array(N/2);for(let k=0;k<N/2;k++)mag[k]=Math.hypot(re[k],im[k]);
 const bands=new Float64Array(BANDS);let tot=0,cen=0,logSum=0,lin=0,cnt=0;
 for(let k=1;k<N/2;k++){const hz=k*SR/N,m=mag[k]*mag[k];tot+=m;cen+=m*hz;if(hz>60&&hz<12000){logSum+=Math.log(m+1e-12);lin+=m;cnt++;}const b=EDGES.findIndex((e,i)=>hz>=e&&hz<EDGES[i+1]);if(b>=0)bands[b]+=m;}
 const fp=[...bands].map(v=>Math.log10(v+1e-9));const mx=Math.max(...fp);
 return {centroid:tot?cen/tot:0,flatness:cnt?Math.exp(logSum/cnt)/(lin/cnt+1e-12):0,fp:fp.map(v=>Math.max(-6,v-mx))};}
function frames(y,hop=480){const out=[];for(let i=0;i+hop<=y.length;i+=hop){let s=0;for(let j=0;j<hop;j++)s+=y[i+j]*y[i+j];out.push(Math.sqrt(s/hop));}return out;}
function analyse(bytes,opts){
 const y=renderKernel(bytes,{sr:SR,seconds:2.4,gateOn:.6,velocity:.9,...opts});// opts may override length, gate and velocity
 let peak=0,sum=0,bad=false;for(const v of y){if(!Number.isFinite(v)){bad=true;break;}peak=Math.max(peak,Math.abs(v));sum+=v;}
 if(bad)return {bad:'non-finite output'};
 const fr=frames(y),mx=Math.max(...fr),iMax=fr.indexOf(mx),dc=Math.abs(sum/y.length);
 const attack=fr.findIndex(v=>v>=mx*.9)*.01,last=fr.findLastIndex(v=>v>mx*.01),decay=(last-iMax)*.01,sustain=(fr[50]||0)/(mx||1),tail=Math.max(...fr.slice(200))/(mx||1);
 const sp=spectrum(y,Math.max(0,iMax*480-1024));
 return {peak,maxRms:mx,dc,attack,decay,sustain,tail,...sp};}
const kept=[],rejected={};const reject=(f,why)=>{(rejected[why]??=[]).push(f.id);};
let done=0;
for(const f of families){
 if(++done%100===0)console.error(done,'/',families.length);
 let bytes;try{bytes=await watToBytes((await compileLeanDSP(f.source)).wat,f.id);}catch(e){reject(f,'compile');continue;}
 const mid=analyse(bytes,{freq:262,colour:.5});if(mid.bad){reject(f,mid.bad);continue;}
 if(mid.maxRms<.002){reject(f,'silent');continue;}
 if(mid.dc>mid.maxRms*.35){reject(f,'DC offset');continue;}
 if(mid.tail>.2){reject(f,'note does not end');continue;}
 const lo=analyse(bytes,{freq:110,colour:.5}),hi=analyse(bytes,{freq:660,colour:.5}),dark=analyse(bytes,{freq:262,colour:.1}),bright=analyse(bytes,{freq:262,colour:.9});
 if([lo,hi,dark,bright].some(a=>a.bad||a.tail>.2)){reject(f,'unstable at other settings');continue;}
 // Loudness from short and long held notes (slow-attack sounds are still rising after 0.6 s), and
 // whether the program still speaks at an ordinary playing strength (some reed models need high pressure).
 const held=analyse(bytes,{freq:262,colour:.5,seconds:4.6,gateOn:4}),soft=analyse(bytes,{freq:262,colour:.5,velocity:.6});
 const level=Math.min(3,Math.max(.15,.2/Math.max(mid.maxRms,lo.maxRms,hi.maxRms,held.maxRms||0)),.95/Math.max(mid.peak,lo.peak,hi.peak,bright.peak,held.peak||0));
 const quiet=(soft.maxRms||0)/mid.maxRms<.3;
 kept.push({...f,level,quiet,features:{attack:mid.attack,decay:mid.decay,sustain:mid.sustain,centroid:mid.centroid,flatness:mid.flatness,colourRange:bright.centroid/(dark.centroid||1)},fp:[...lo.fp,...mid.fp,...hi.fp,mid.attack*20,Math.log(1+mid.decay)*4,mid.sustain*4]});
}
// Near-duplicates: greedy, in generation order, by distance between fingerprints.
const dist=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=(a[i]-b[i])**2;return Math.sqrt(s/a.length);};
const THRESH=Number(process.env.DEDUPE||.12),unique=[];
for(const k of kept){const near=unique.find(u=>dist(u.fp,k.fp)<THRESH);if(near){(rejected['near-duplicate']??=[]).push(k.id+'≈'+near.id);continue;}unique.push(k);}
// Plain description from the measurements.
function describe({attack,decay,sustain,centroid,flatness}){
 const env=sustain>.35?(attack>.12?'Slow swell, held':'Held'):attack>.08?'Swelling, decaying':decay<.15?'Very short hit':decay<.6?'Short, decaying':'Struck or plucked, ringing';
 const pitch=flatness>.35?'noisy':flatness>.12?'pitched with noise':'pitched';
 const tone=centroid<700?'dark':centroid<1600?'warm':centroid<3500?'bright':'very bright';
 return `${env} · ${pitch} · ${tone}${sustain<=.35?` · fades in about ${decay<1?decay.toFixed(1):decay.toFixed(1)} s`:''}`;}
const outFams=unique.map(({fp,...k})=>({...k,sounds:describe(k.features),source:k.source.replace(/(\n    return softsign\(.*\))\n$/,(_,r)=>`${r} * ${k.level.toFixed(4)}\n`)}));
fs.mkdirSync(new URL('./out/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('./out/screened.json',import.meta.url),JSON.stringify(outFams));
const byCat={};for(const f of outFams)byCat[f.category]=(byCat[f.category]||0)+1;
console.log('candidates',families.length,'kept',outFams.length);console.log(byCat);
for(const [why,list] of Object.entries(rejected))console.log('rejected:',why,list.length,list.slice(0,4).join(' '));
