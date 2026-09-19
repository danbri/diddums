import {siteUrl} from './site-url.js';
const PLAYGROUND='https://lean.cau.li/?variant=full';
async function gzipWorkspace(files,active){
 const raw=new TextEncoder().encode(JSON.stringify({files,active}));
 const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
function base64url(bytes){let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function declarationName(source){return /^\s*dsp\s+([A-Za-z_][A-Za-z0-9_]*)\s+where/m.exec(source)?.[1]||null;}
export async function browserLeanUrl(source,{originalSource=null,name=null}={}){
 const r=await fetch(siteUrl('lean/Build.lean'));if(!r.ok)throw new Error('Could not load JigDAW Lean build source');
 let build=await r.text(),decl=name||declarationName(source);if(!decl)throw new Error('Draft has no dsp declaration');
 if(originalSource&&build.includes(originalSource))build=build.replace(originalSource,source);
 else{
  const marker='#print axioms LeanDSP.compileExpr_correct';
  if(!build.includes(marker))throw new Error('Lean build insertion point missing');
  build=build.replace(marker,source+'\n\n#print axioms '+decl+'\n\n'+marker);
 }
 const bytes=await gzipWorkspace([{name:'Main.lean',content:build}],'Main.lean');
 return PLAYGROUND+'#s='+base64url(bytes);
}
export async function openInBrowserLean(source,opts={}){
 const url=await browserLeanUrl(source,opts),w=window.open(url,'_blank','noopener,noreferrer');if(!w)throw new Error('Browser blocked the Lean/Wasm tab');return url;
}
export const browserLeanEvidence={runtime:'cauli/lean4-wasm-in-browser',mode:'full',reportedLean:'4.33.0-pre',forkCommit:'62b6a2291302d4bbeace37642a066b7510d0145c',upstreamBaseCommit:'ecf55de08b9d855e749f80c491c6f294dd307e60',targetRelease:{tag:'v4.34.0',commit:'293d5d0c0c3f3dded4688b3ccd6a33939ac5102b'},execution:'client-side WebAssembly Worker',releaseCompatibility:'dynamic checking only; release-equivalent browser runtime must be rebuilt from Lean v4.34.0 final (293d5d0…) and match the native release identity'};
export async function releaseEquivalenceGate(){const r=await fetch(siteUrl('lean/build-report.json'),{cache:'no-store'});if(!r.ok)throw new Error('Could not read native Lean build report');const native=await r.json(),nativeCommit=native.toolchainCommit||null,targetCommit=browserLeanEvidence.targetRelease.commit,versionMatch=native.leanVersion==='4.34.0'&&browserLeanEvidence.reportedLean==='4.34.0',commitMatch=!!nativeCommit&&nativeCommit.startsWith(targetCommit)&&browserLeanEvidence.upstreamBaseCommit.startsWith(targetCommit),exact=versionMatch&&commitMatch;return{schema:'jigdaw-lean-toolchain-gate/1',exact,native:{version:native.leanVersion,commit:nativeCommit,buildHash:native.buildHash,catalogHash:native.catalogHash},browser:{...browserLeanEvidence},checks:{nativeCommitRecorded:!!nativeCommit,versionMatch,commitMatch},reason:exact?'Exact native/browser Lean identity matches.':'Fail closed: release-equivalent hot swap requires the exact native Lean commit and matching browser runtime; the current evidence does not establish both.'};}