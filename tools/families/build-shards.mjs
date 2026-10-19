#!/usr/bin/env node
// Native Lean build of the screened families, in shards. Each shard is built exactly like the main
// catalog (public/lean/build.mjs): one `lake env lean --run` over the LeanDSP core plus the shard's
// declarations, kernel axiom audit of every declaration and the compiler theorems, WAT emitted by Lean,
// assembled and validated by WABT, fixed-memory check, and per-family source/WAT/Wasm hashes.
// Resumable: a shard whose sources are unchanged is not rebuilt. Writes public/lean/families/.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import wabtFactory from 'wabt';
const here=path.dirname(fileURLToPath(import.meta.url)),pub=path.join(here,'..','..','public'),work=path.join(here,'.lean-work'),outDir=path.join(pub,'lean','families');
const hash=s=>createHash('sha256').update(s).digest('hex'),normalize=s=>s.replace(/\r\n/g,'\n').trim();
const SHARD=Number(process.env.SHARD||40);
// Materialise the published Lean project (core, checker, emitter, toolchain pin) as the build root.
if(!fs.existsSync(path.join(work,'lakefile.toml'))){
 const bundle=JSON.parse(fs.readFileSync(path.join(pub,'lean','project-files.json'),'utf8'));
 for(const [rel,content] of Object.entries(bundle.files)){const p=path.join(work,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof content==='string'?content:content.content??content.text);}
}
const execute=args=>{const r=spawnSync('lake',['env','lean',...args],{cwd:work,encoding:'utf8',maxBuffer:256*1024*1024,timeout:1800000});if(r.error)throw r.error;if(r.status!==0)throw new Error((r.stdout+'\n'+r.stderr).slice(-4000));return r.stdout;};
const version=execute(['--version']);if(!/\b4\.34\.0\b/.test(version))throw new Error('This build pins Lean 4.34.0: '+version);
const checkedNames=['LeanDSP.compileExpr_correct','LeanDSP.compile_correct','LeanDSP.compile_trace_correct','LeanDSP.all_instantiations','LeanDSP.compileExpr_length','LeanDSP.ring_index_lt','LeanDSP.lower_correct'];
const allowed=new Set(['propext','Classical.choice','Quot.sound']);
let header='';for(const f of['Core','Checker','WasmSubset','Syntax','Emitter'])header+=fs.readFileSync(path.join(work,'LeanDSP',f+'.lean'),'utf8').replace(/^import LeanDSP\.[^\n]+\n/gm,'')+'\n';
const fams=JSON.parse(fs.readFileSync(path.join(here,'out','screened.json'),'utf8'));
fs.mkdirSync(outDir,{recursive:true});
const wabt=await wabtFactory(),index={schema:'leandsp-native-family-index/1',leanVersion:'4.34.0',shards:[],families:{}};
const failed=[];
const LIMIT=Number(process.env.LIMIT||1e9);
for(let s=0;s*SHARD<fams.length&&s<LIMIT;s++){
 const group=fams.slice(s*SHARD,(s+1)*SHARD),file=`shard-${String(s).padStart(3,'0')}.json`,target=path.join(outDir,file);
 const sources=Object.fromEntries(group.map(f=>{const source=normalize(f.source),m=source.match(/^dsp\s+([A-Za-z_][A-Za-z0-9_]*)\s+where/);if(!m)throw new Error(f.id+': invalid name');return [f.id,{source,name:m[1]}];}));
 const sourceKey=hash(JSON.stringify(Object.entries(sources).map(([id,v])=>[id,v.source])));
 let shard=null;
 if(fs.existsSync(target)){const old=JSON.parse(fs.readFileSync(target,'utf8'));if(old.sourceKey===sourceKey)shard=old;}
 if(!shard){
  const t0=Date.now(),ids=Object.keys(sources),symbols=[...checkedNames,...ids.map(id=>sources[id].name)];
  const program=header+'\nset_option maxRecDepth 8192\nset_option maxHeartbeats 4000000\nopen LeanDSP\n'+ids.map(id=>'\n'+sources[id].source+'\n').join('')+'\n'+symbols.map(n=>'#print axioms '+n).join('\n')+'\ndef main : IO Unit := IO.println ((Lean.Json.arr #['+ids.map(id=>'LeanDSP.artifact '+JSON.stringify(id)+' '+sources[id].name).join(',\n')+']).compress)\n';
  fs.writeFileSync(path.join(work,'GeneratedBuild.lean'),program);
  let output;try{output=execute(['--run','GeneratedBuild.lean']);}catch(e){console.error(`shard ${s} failed:`,String(e.message).slice(-1500));failed.push(s);continue;}
  const audits=[];for(const name of symbols){const esc=name.replaceAll('.','\\.'),hit=output.match(new RegExp("'"+esc+"' (?:depends on axioms:\\s*\\[([^\\]]*)\\]|does not depend on any axioms)"));if(!hit)throw new Error('Missing kernel axiom audit: '+name);const ax=hit[1]?hit[1].split(',').map(x=>x.trim()).filter(Boolean):[];for(const a of ax)if(!allowed.has(a))throw new Error('Unapproved axiom in '+name+': '+a);audits.push({name,axioms:ax});}
  const line=output.split('\n').findLast(l=>l.startsWith('[{'));if(!line)throw new Error('No native artifact JSON');const artifacts=JSON.parse(line);if(artifacts.length!==ids.length)throw new Error('Incomplete native output');
  shard={schema:'leandsp-native-catalog-shard/1',leanVersion:'4.34.0',buildHash:hash(program),sourceKey,compilerTheorem:'LeanDSP.lower_correct',traceTheorem:'LeanDSP.compile_trace_correct',axiomAudits:audits,patterns:{}};
  for(const a of artifacts){const parsed=wabt.parseWat(a.id+'.wat',a.wat,{bulk_memory:true,multi_value:true});let bytes;try{parsed.resolveNames();parsed.validate();bytes=new Uint8Array(parsed.toBinary({write_debug_names:true}).buffer);}finally{parsed.destroy();}
   if(!WebAssembly.validate(bytes))throw new Error('Invalid emitted Wasm: '+a.id);const inst=(await WebAssembly.instantiate(bytes)).instance.exports;inst.prepare(48000);let bounded=false;try{inst.memory.grow(1)}catch{bounded=true}if(!bounded)throw new Error('Wasm memory was not fixed');
   const source=sources[a.id].source;shard.patterns[a.id]={...a,source,sourceHash:hash(source),watHash:hash(a.wat),wasmHash:hash(bytes),wasmBase64:Buffer.from(bytes).toString('base64'),proofSymbols:checkedNames,params:a.params.map(p=>({...p,def:Number(p.def),lo:Number(p.lo),hi:Number(p.hi)})),states:a.states.map(x=>({...x,init:Number(x.init)}))};}
  fs.writeFileSync(target,JSON.stringify(shard));
  console.log(`shard ${s}: ${ids.length} families in ${Math.round((Date.now()-t0)/1000)} s`);
 }
 const text=fs.readFileSync(target,'utf8');index.shards.push({file,sha256:hash(text),ids:Object.keys(shard.patterns)});
 for(const id of Object.keys(shard.patterns))index.families[id]=file;
}
fs.writeFileSync(path.join(outDir,'index.json'),JSON.stringify(index));
console.log(`index: ${Object.keys(index.families).length} families in ${index.shards.length} shards; failed shards: ${failed.join(',')||'none'}`);
console.log('index sha256',hash(fs.readFileSync(path.join(outDir,'index.json'),'utf8')));
