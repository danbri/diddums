#!/usr/bin/env node
// Regenerates the published families whose archetype source has changed, in place: same ids, same order,
// re-measured loudness and description. Use after fixing an archetype, then run build-shards.mjs (only
// shards whose sources changed are rebuilt) and publish.mjs. Writes out/screened.json (backup kept).
import fs from 'node:fs';
import {families} from './archetypes.mjs';
import {compileLeanDSP} from '../../public/leandsp.js';
import {watToBytes} from './render.mjs';
import {measureKernel,describe,withLevel} from './screen-core.mjs';
const file=new URL('./out/screened.json',import.meta.url),list=JSON.parse(fs.readFileSync(file,'utf8')),byId=new Map(families.map(f=>[f.id,f]));
const bare=src=>src.replace(/(\n    return softsign\(.*\)) \* [\d.]+\n$/,'$1\n');
let changed=0,problems=[];
for(const [i,e] of list.entries()){
 const f=byId.get(e.id);if(!f){problems.push(e.id+': no longer generated');continue;}
 if(bare(e.source).trim()===f.source.trim())continue;
 const bytes=await watToBytes((await compileLeanDSP(f.source)).wat,f.id),m=measureKernel(bytes);
 if(m.reject){problems.push(`${e.id}: ${m.reject}`);continue;}
 list[i]={...e,label:f.label,source:withLevel(f.source,m.level),level:m.level,quiet:m.quiet,features:m.features,sounds:describe(m.features)};changed++;
}
fs.copyFileSync(file,new URL('./out/screened.before-refresh.json',import.meta.url));fs.writeFileSync(file,JSON.stringify(list));
console.log(`refreshed ${changed} of ${list.length}; ${problems.length} problems`);for(const p of problems)console.log('  ',p);
