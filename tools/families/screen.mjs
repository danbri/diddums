#!/usr/bin/env node
// Screens generated families before the native Lean build: compiles each with the JS draft compiler
// (bit-identical output to the native kernels on the existing families), renders notes, rejects
// silent, unstable, stuck or DC-heavy programs, sets a common loudness, removes near-duplicates and
// describes each from measured features. Writes out/screened.json.
import fs from 'node:fs';
import {families} from './archetypes.mjs';
import {compileLeanDSP} from '../../public/leandsp.js';
import {watToBytes} from './render.mjs';
import {measureKernel,describe,withLevel} from './screen-core.mjs';
const kept=[],rejected={};const reject=(f,why)=>{(rejected[why]??=[]).push(f.id);};
let done=0;
for(const f of families){
 if(++done%100===0)console.error(done,'/',families.length);
 let bytes;try{bytes=await watToBytes((await compileLeanDSP(f.source)).wat,f.id);}catch(e){reject(f,'compile');continue;}
 const m=measureKernel(bytes);if(m.reject){reject(f,m.reject);continue;}
 kept.push({...f,...m});
}
// Near-duplicates: greedy, in generation order, by distance between fingerprints.
const dist=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=(a[i]-b[i])**2;return Math.sqrt(s/a.length);};
const THRESH=Number(process.env.DEDUPE||.12),unique=[];
for(const k of kept){const near=unique.find(u=>dist(u.fp,k.fp)<THRESH);if(near){(rejected['near-duplicate']??=[]).push(k.id+'≈'+near.id);continue;}unique.push(k);}
const outFams=unique.map(({fp,...k})=>({...k,sounds:describe(k.features),source:withLevel(k.source,k.level)}));
fs.mkdirSync(new URL('./out/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('./out/screened.json',import.meta.url),JSON.stringify(outFams));
const byCat={};for(const f of outFams)byCat[f.category]=(byCat[f.category]||0)+1;
console.log('candidates',families.length,'kept',outFams.length);console.log(byCat);
for(const [why,list] of Object.entries(rejected))console.log('rejected:',why,list.length,list.slice(0,4).join(' '));
