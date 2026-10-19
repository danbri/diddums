// Native-build artifact loader. There is intentionally no JavaScript DSP compiler fallback.
import {siteUrl} from './site-url.js';
const EXPECTED_CATALOG='2ea408c7d6122cb8e94362703011a66a5d40a19f61b6a6cbfd5d121450760460';
const normalized=s=>String(s).replace(/\r\n/g,'\n').trim();
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
const textHash=s=>sha(new TextEncoder().encode(s));
let catalogPromise=null;
export function leanCatalog(){
 if(!catalogPromise)catalogPromise=(async()=>{const r=await fetch(siteUrl('lean/catalog.json'));if(!r.ok)throw new Error('Native Lean catalog unavailable: '+r.status);const bytes=await r.arrayBuffer();if(await sha(bytes)!==EXPECTED_CATALOG)throw new Error('Native catalog integrity mismatch; reload after the release finishes.');const c=JSON.parse(new TextDecoder().decode(bytes));if(c.schema!=='leandsp-native-catalog/1'||c.leanVersion!=='4.34.0')throw new Error('Unsupported native Lean build');return c;})().catch(e=>{catalogPromise=null;throw e;});
 return catalogPromise;
}
export async function loadLeanKernel(id,source){
 const catalog=await leanCatalog(),p=catalog.patterns[id];if(!p)throw new Error('No Lean-built family for '+id);
 const sourceHash=await textHash(normalized(source));if(sourceHash!==p.sourceHash){const e=new Error('This source differs from the pinned native-Lean build. Export the Lean project and run its native build; the last hash-matched sound is unchanged.');e.requiresLeanBuild=true;throw e;}
 const bytes=Uint8Array.from(atob(p.wasmBase64),c=>c.charCodeAt(0));
 if(await sha(bytes)!==p.wasmHash||await textHash(p.wat)!==p.watHash)throw new Error('Native artifact integrity failed for '+id);
 if(!WebAssembly.validate(bytes))throw new Error('Native Wasm rejected by this browser');
 const checked={...p,version:'LeanDSP/1.0-native',checks:[
  'Offline native-build record: Lean 4.34.0 dsp declaration → CertifiedProgram',
  'Offline kernel-checked certificate: scoped names, scalar/Boolean expressions, parameter ranges and bounded state/buffers',
  'Offline theorem record: LeanDSP.lower_correct — source evaluation = compiled stack-IR evaluation',
  'Offline theorem record: LeanDSP.compile_trace_correct — arbitrary finite input/parameter traces preserve output and state',
  'Offline theorem record: LeanDSP.compileExpr_length — static IR instruction count',
  'Recorded build property: memory layout is independent of runtime parameter values; fixed Wasm memory, 128-frame ABI guard',
  'Recorded audit result: no sorryAx, native_decide or custom axioms in the pinned release',
  'Browser checks in this session: pinned catalog SHA-256, source SHA-256, WAT SHA-256, Wasm SHA-256 and WebAssembly.validate',
  'Lean proofs are NOT re-run in this browser; their evidence is the pinned native-build report/catalog',
  'Trust boundary: native Lean toolchain/build record, WAT serializer, WABT, WebAssembly engine, floating-point semantics and host scheduler/mixer; not a universal numerical-stability proof'
 ]};
 return {id,source:normalized(source),bytes,hash:p.wasmHash,debug:p.debug,checked,nativeLean:{version:catalog.leanVersion,buildHash:catalog.buildHash,sourceHash:p.sourceHash,proofs:p.proofSymbols,scope:catalog.verification.claim}};
}
export async function kernelRdf(id){
 const catalog=await leanCatalog(),p=catalog.patterns[id];if(!p)throw new Error('Unknown family');
 const {rdfFromJsonLd}=await import('./rdf.js');
 return rdfFromJsonLd({'@context':{ldsp:'urn:leandsp:',dct:'http://purl.org/dc/terms/'},'@id':'urn:sha256:'+p.wasmHash,'@type':'ldsp:WasmKernel','dct:title':p.name,'ldsp:source':{'@id':'urn:sha256:'+p.sourceHash},'ldsp:build':{'@id':'urn:sha256:'+catalog.buildHash},'ldsp:leanVersion':catalog.leanVersion,'ldsp:compilerTheorem':catalog.compilerTheorem,'ldsp:traceTheorem':catalog.traceTheorem,'ldsp:proofScope':catalog.verification.claim,'ldsp:wasmBytes':atob(p.wasmBase64).length});
}
function saveFile(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export async function downloadLeanSource(id,source){const catalog=await leanCatalog();if(!catalog.patterns[id])throw new Error('Unknown source');saveFile(id+'.lean','import LeanDSP.Syntax\nopen LeanDSP\n\n'+normalized(source)+'\n','text/plain');}
export function zipFiles(files){
 const enc=new TextEncoder(),table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);table[i]=c>>>0;}
 const crc=b=>{let c=0xffffffff;for(const x of b)c=table[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
 const chunks=[],central=[];let offset=0,count=0;
 for(const [name,source]of Object.entries(files)){if(name.startsWith('/')||name.split('/').includes('..'))throw new Error('Unsafe archive path');const filename=enc.encode(name),body=typeof source==='string'?enc.encode(source):source,hash=crc(body);const local=new Uint8Array(30+filename.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,hash,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,filename.length,true);local.set(filename,30);chunks.push(local,body);const cd=new Uint8Array(46+filename.length),d=new DataView(cd.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);d.setUint32(16,hash,true);d.setUint32(20,body.length,true);d.setUint32(24,body.length,true);d.setUint16(28,filename.length,true);d.setUint32(42,offset,true);cd.set(filename,46);central.push(cd);offset+=local.length+body.length;count++;}
 const centralSize=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,count,true);v.setUint16(10,count,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);const result=new Uint8Array(offset+centralSize+22);let pos=0;for(const c of [...chunks,...central,end]){result.set(c,pos);pos+=c.length;}return result;
}
export async function downloadLeanProject(drafts={}){
 const r=await fetch(siteUrl('lean/project-files.json'));if(!r.ok)throw new Error('Lean source project unavailable');const bundle=await r.json(),files={...bundle.files};
 for(const [id,source]of Object.entries(drafts)){if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(id)||!files['patterns/'+id+'.lean'])throw new Error('Unknown draft pattern');files['patterns/'+id+'.lean']='import LeanDSP.Syntax\nopen LeanDSP\n\n'+normalized(source)+'\n';}
 saveFile('jigdaw-native-lean.zip',zipFiles(files),'application/zip');
}