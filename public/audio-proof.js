import {compileLeanDSP} from './leandsp.js';
import {siteUrl} from './site-url.js';

const enc=new TextEncoder(),dec=new TextDecoder();
export const PROOF_SCHEMA='diddums-audio-provenance/1';
export const COMPOSITION_PROOF_SCHEMA='diddums-composition-audio/1';
export const ENVELOPE_SCHEMA='diddums-proof-envelope/1';

export function canonicalJson(x){
  if(x===null||typeof x==='boolean'||typeof x==='number'||typeof x==='string')return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(canonicalJson).join(',')+']';
  if(typeof x==='object')return '{'+Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonicalJson(x[k])).join(',')+'}';
  throw new Error('Unsupported certificate value');
}
export async function sha256Bytes(bytes){
  const v=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  const d=new Uint8Array(await crypto.subtle.digest('SHA-256',v));
  return [...d].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function sha256Text(s){return sha256Bytes(enc.encode(s));}
export function float32le(samples){
  const out=new Uint8Array(samples.length*4),v=new DataView(out.buffer);
  for(let i=0;i<samples.length;i++)v.setFloat32(i*4,samples[i],true);
  return out;
}
export function interleavedFloat32le(channels){
  if(!Array.isArray(channels)||!channels.length)throw new Error('At least one PCM channel is required');
  const frames=channels[0].length;if(!channels.every(c=>c instanceof Float32Array&&c.length===frames))throw new Error('PCM channel lengths differ');
  const out=new Uint8Array(frames*channels.length*4),v=new DataView(out.buffer);let o=0;
  for(let i=0;i<frames;i++)for(const c of channels){v.setFloat32(o,c[i],true);o+=4;}return out;
}
export function trajectoryBytes(analysis){
  const fs=analysis.frames||[],out=new Uint8Array(fs.length*32),v=new DataView(out.buffer);
  fs.forEach((f,i)=>{let o=i*32;v.setUint32(o,Number(f.at)>>>0,true);o+=4;v.setFloat32(o,Number(f.energy)||0,true);o+=4;for(let k=0;k<3;k++,o+=4)v.setFloat32(o,Number(f.f?.[k])||0,true);for(let k=0;k<3;k++,o+=4)v.setFloat32(o,Number(f.a?.[k])||0,true);});
  return out;
}
export function decodeTrajectory(bytes,meta){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),frames=[];
  for(let o=0;o+31<bytes.length;o+=32){let p=o;const at=v.getUint32(p,true);p+=4,energy=v.getFloat32(p,true);p+=4,f=[],a=[];for(let k=0;k<3;k++,p+=4)f.push(v.getFloat32(p,true));for(let k=0;k<3;k++,p+=4)a.push(v.getFloat32(p,true));frames.push({at,energy,f,a});}
  return{frames,N:meta.N,hop:meta.hop,sampleRate:meta.sampleRate,bands:meta.bands,method:meta.method};
}
export function bytesToBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000)));return btoa(s);}
export function base64ToBytes(s){const b=atob(s),out=new Uint8Array(b.length);for(let i=0;i<b.length;i++)out[i]=b.charCodeAt(i);return out;}

function putAscii(v,o,s){for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));}
export function proofWavChannels(channels,sampleRate,envelope){
  const pcm=interleavedFloat32le(channels),cert=enc.encode(canonicalJson(envelope)),certPad=cert.length&1,dataPad=pcm.length&1,nch=channels.length,blockAlign=nch*4,byteRate=sampleRate*blockAlign;
  const total=12+8+16+8+cert.length+certPad+8+pcm.length+dataPad,out=new Uint8Array(total),v=new DataView(out.buffer);
  putAscii(v,0,'RIFF');v.setUint32(4,total-8,true);putAscii(v,8,'WAVE');
  let o=12;putAscii(v,o,'fmt ');v.setUint32(o+4,16,true);v.setUint16(o+8,3,true);v.setUint16(o+10,nch,true);v.setUint32(o+12,sampleRate,true);v.setUint32(o+16,byteRate,true);v.setUint16(o+20,blockAlign,true);v.setUint16(o+22,32,true);o+=24;
  putAscii(v,o,'JIGP');v.setUint32(o+4,cert.length,true);out.set(cert,o+8);o+=8+cert.length+certPad;
  putAscii(v,o,'data');v.setUint32(o+4,pcm.length,true);out.set(pcm,o+8);
  return out;
}
export function proofWav(samples,sampleRate,envelope){return proofWavChannels([samples],sampleRate,envelope);}
export function parseProofWav(bytes){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length<44||String.fromCharCode(...bytes.subarray(0,4))!=='RIFF'||String.fromCharCode(...bytes.subarray(8,12))!=='WAVE')throw new Error('Not a RIFF/WAVE file');
  let o=12,fmt=null,cert=null,data=null;
  while(o+8<=bytes.length){const id=String.fromCharCode(...bytes.subarray(o,o+4)),n=v.getUint32(o+4,true),start=o+8,end=start+n;if(end>bytes.length)throw new Error('Truncated RIFF chunk '+id);if(id==='fmt ')fmt={format:v.getUint16(start,true),channels:v.getUint16(start+2,true),sampleRate:v.getUint32(start+4,true),bits:v.getUint16(start+14,true)};else if(id==='JIGP')cert=JSON.parse(dec.decode(bytes.subarray(start,end)));else if(id==='data')data=bytes.subarray(start,end);o=end+(n&1);}
  if(!fmt||!cert||!data)throw new Error('WAV lacks fmt/JIGP/data');return{fmt,envelope:cert,pcmBytes:data};
}
function safeName(s){return String(s||'diddums').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'diddums';}
export function downloadBytes(name,bytes,type='application/octet-stream'){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export function downloadText(name,text,type='application/json'){downloadBytes(name,enc.encode(text),type);}

async function fetchHash(path){const url=siteUrl(path),r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Could not hash '+path);const bytes=new Uint8Array(await r.arrayBuffer());return{url:path,sha256:await sha256Bytes(bytes),bytes:bytes.length};}
async function fetchEmbeddedSource(path){const r=await fetch(siteUrl(path),{cache:'no-store'});if(!r.ok)throw new Error('Could not embed '+path);const bytes=new Uint8Array(await r.arrayBuffer());return{url:path,sha256:await sha256Bytes(bytes),bytes:bytes.length,sourceBase64:bytesToBase64(bytes)};}
function sliceHashInput(samples,start,count){return float32le(samples.subarray(start,start+count));}

export async function makeSwsProof(prepared,{masterGain=1}={}){
  if(!prepared?.composite||!prepared?.analysis||!prepared?.kernel)throw new Error('No prepared SWS render');
  const pcm=prepared.composite.getChannelData(0),pcmBytes=float32le(pcm),traj=trajectoryBytes(prepared.analysis),barFrames=prepared.barFrames;
  const [pcmSha,trajSha,decodedSha,kernelSourceSha,procedures,buildReportRaw]=await Promise.all([
    sha256Bytes(pcmBytes),sha256Bytes(traj),sha256Bytes(float32le(prepared.decodedMono||prepared.sourceBeforeNormalise||prepared.source)),
    sha256Text(prepared.kernel.source),
    Promise.all(['/sample-sws.js','/leandsp.js','/vendor/wabt-1.0.39.js','/lean/Build.lean','/lean/build-report.json'].map(fetchHash)),
    fetch(siteUrl('lean/build-report.json'),{cache:'no-store'}).then(r=>r.json())
  ]);
  const bar2=await sha256Bytes(sliceHashInput(pcm,barFrames,barFrames)),bar4=await sha256Bytes(sliceHashInput(pcm,barFrames*3,barFrames));
  const sourceNorm={targetRms:.095,maxGain:8,peakCeil:.88},swsNorm={targetRms:prepared.sourceRms,maxGain:96,peakCeil:.88};
  const payload={
    schema:PROOF_SCHEMA,product:'Diddums',compatibility:['JigDAW'],createdAt:new Date().toISOString(),
    claim:{kind:'deterministic-digital-audio-provenance',title:'Diddums SWS priming track',statement:'Bars 2 and 4 are the same rendered SWS artifact; the certificate binds input bytes, derived trajectory, DSP source/Wasm and output PCM by SHA-256.'},
    input:{kind:'audio/mpeg',url:prepared.sel.url,voice:prepared.sel.voice,text:prepared.sel.text,sha256:prepared.sourceHash,decodedMonoFloat32leSha256:decodedSha,decodeOperation:'WebAudio.decodeAudioData → channel mean',decodeProof:'host trust boundary'},
    analysis:{id:'diddums-three-ridge-goertzel/1',method:prepared.analysis.method,N:prepared.analysis.N,hop:prepared.analysis.hop,sampleRate:prepared.analysis.sampleRate,bands:prepared.analysis.bands,frameCount:prepared.analysis.frames.length,trajectoryEncoding:'u32 at; f32 energy; f32[3] freq; f32[3] amp, little-endian',trajectorySha256:trajSha,trajectoryBase64:bytesToBase64(traj),proof:'replayable algorithm; not Lean-certified'},
    dsp:{language:'LeanDSP',declaration:'TrackedSine',source:prepared.kernel.source,sourceSha256:kernelSourceSha,wasmSha256:prepared.kernel.wasmSha256,hotCompiler:prepared.kernel.compiler,blockFrames:4,normalization:swsNorm,renderer:prepared.renderer,swsFrames:prepared.sws.length,leanSwsSha256:prepared.leanHash,referenceSwsSha256:prepared.referenceHash,referenceComparison:prepared.comparison},
    composition:{layout:['silence','sws','source','sws'],barFrames,sampleRate:prepared.sampleRate,channels:1,sourceNormalization:sourceNorm,masterPlaybackGain:Number(masterGain),bars2And4SameArtifact:bar2===bar4,bar2PcmSha256:bar2,bar4PcmSha256:bar4},
    output:{encoding:'f32le',sampleRate:prepared.sampleRate,channels:1,frames:pcm.length,pcmSha256:pcmSha,container:'RIFF/WAVE IEEE_FLOAT32 with JIGP certificate chunk'},
    procedures:Object.fromEntries(procedures.map(x=>[x.url,{sha256:x.sha256,bytes:x.bytes}])),
    leanEvidence:{nativeRelease:{leanVersion:buildReportRaw.leanVersion,toolchainCommit:buildReportRaw.toolchainCommit||null,toolchainIdentityComplete:!!buildReportRaw.toolchainCommit,buildSourceSha256:buildReportRaw.buildHash,catalogSha256:buildReportRaw.catalogHash,compilerTheorem:buildReportRaw.verification?.compilerTheorem,traceTheorem:buildReportRaw.verification?.traceTheorem,sorryAxAccepted:buildReportRaw.sorryAxAccepted,trackedSineInCatalog:false},browserDynamic:prepared.kernel.browserLean,releaseEquivalentGate:false,releaseEquivalentTarget:{tag:'v4.34.0',commit:'293d5d0c0c3f3dded4688b3ccd6a33939ac5102b'},releaseEquivalentReason:'blocked: native release evidence does not record the exact Lean compiler commit, and the current browser checker is '+prepared.kernel.browserLean.reportedLean+' rather than final v4.34.0; no release-equivalent hot swap is claimed'},
    assurance:{artifactHashChain:true,trajectoryToSwsReplayable:true,inputDecodeAndRidgeAnalysisReproducibleButHostDependent:true,trackedSineReleaseLeanCertified:false,executionEnvironmentAttested:false},
    limitations:['This certifies digital artifacts and a reproducible derivation claim, not acoustic sound after DAC/speakers.','Hashes prove artifact identity, not that a trusted machine actually executed the claimed steps. Hardware/remote attestation would be a separate layer.','MP3 decoding is a host/browser trust boundary and can vary across implementations.','TrackedSine is dynamically generated LeanDSP but is not yet in the pinned native Lean 4.34 catalog.']
  };
  const payloadSha256=await sha256Text(canonicalJson(payload)),envelope={schema:ENVELOPE_SCHEMA,canonicalization:'RFC8785-style canonical JSON for JSON primitives/arrays/objects',hash:'SHA-256',payloadSha256,payload};
  return{envelope,pcm,wav:proofWav(pcm,prepared.sampleRate,envelope),filename:safeName(prepared.sel.text)};
}

export async function makeCompositionProof({composition,session,modules,master=.58,left,right,rendererUrl,workerUrl}){
  if(!composition||!session||!(left instanceof Float32Array)||!(right instanceof Float32Array))throw new Error('Incomplete composition render');
  if(left.length!==right.length)throw new Error('Stereo render channel lengths differ');
  const [{programRecord,eventPlanRecord,canonicalJson:scoreCanonical},catalog,buildReport,rendererRec,workerRec]=await Promise.all([
    import('./jigscore.js'),
    fetch(siteUrl('lean/catalog.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Lean catalog unavailable');return r.json();}),
    fetch(siteUrl('lean/build-report.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Lean build report unavailable');return r.json();}),
    fetchEmbeddedSource(rendererUrl),fetchEmbeddedSource(workerUrl)
  ]);
  const program=programRecord(composition),eventPlan=eventPlanRecord(session),programSha256=await sha256Text(scoreCanonical(program)),eventPlanSha256=await sha256Text(scoreCanonical(eventPlan));
  const moduleRecords=[];
  for(const m of modules){const p=catalog.patterns?.[m.id];if(!p)throw new Error('Module '+m.id+' absent from native Lean catalog');const bytes=m.bytes instanceof Uint8Array?m.bytes:new Uint8Array(m.bytes),h=await sha256Bytes(bytes);if(h!==p.wasmHash||h!==m.hash)throw new Error('Module hash mismatch for '+m.id);moduleRecords.push({id:m.id,name:p.name,sourcePath:p.sourcePath,sourceHash:p.sourceHash,watHash:p.watHash,wasmHash:p.wasmHash,wasmBase64:bytesToBase64(bytes),proofSymbols:p.proofSymbols||[]});}
  moduleRecords.sort((a,b)=>a.id.localeCompare(b.id));
  const pcm=interleavedFloat32le([left,right]),pcmSha256=await sha256Bytes(pcm),procedurePaths=['/score.js','/jigscore.js','/lean/catalog.json','/lean/build-report.json'];
  let releaseReference=null;
  if(composition.proofReference){const rr=await fetch(siteUrl(composition.proofReference),{cache:'no-store'});if(!rr.ok)throw new Error('Release proof reference unavailable');const bytes=new Uint8Array(await rr.arrayBuffer()),record=JSON.parse(dec.decode(bytes)),recordSha256=await sha256Bytes(bytes),expectedModules=new Map((record.leanDSP?.modules||[]).map(m=>[m.id,m.wasmSha256])),compatible=record.composition===composition.id&&record.render?.sampleRate===session.sampleRate&&record.render?.master===Number(master)&&record.render?.frames===left.length&&record.jigScore?.programSha256===programSha256&&record.jigScore?.eventPlanSha256===eventPlanSha256&&record.renderer?.workletSha256===rendererRec.sha256&&record.renderer?.workerSha256===workerRec.sha256&&moduleRecords.length===expectedModules.size&&moduleRecords.every(m=>expectedModules.get(m.id)===m.wasmHash),pcmMatch=record.render?.pcmSha256===pcmSha256;releaseReference={url:composition.proofReference,recordSha256,expectedPcmSha256:record.render?.pcmSha256||null,compatible,pcmMatch};if(compatible&&!pcmMatch)throw new Error('Rendered PCM does not match the pinned release reference');procedurePaths.push(composition.proofReference);}
  const procedures=await Promise.all(procedurePaths.map(fetchHash));
  const payload={
    schema:COMPOSITION_PROOF_SCHEMA,product:'Diddums',compatibility:['JigDAW'],createdAt:new Date().toISOString(),
    claim:{kind:'deterministic-composition-audio-provenance',title:composition.title,statement:'This certificate binds an authored JigScore program and event plan, native-Lean-built DSP modules, an immutable host renderer, and the resulting stereo Float32 PCM by SHA-256.'},
    composition:{id:composition.id,title:composition.title,program,programSha256,eventPlan,eventPlanSha256,authoredOnly:!eventPlan.events.some(e=>e.localPattern)},
    render:{sampleRate:session.sampleRate,master:Number(master),session:JSON.parse(JSON.stringify(session))},
    renderer:{kind:'archived AudioWorklet audio path executed under deterministic Worker shim',workletUrlHint:rendererRec.url,workletSha256:rendererRec.sha256,workletSourceBase64:rendererRec.sourceBase64,workerUrlHint:workerRec.url,workerSha256:workerRec.sha256,workerSourceBase64:workerRec.sourceBase64,blockFrames:128,observabilityDisabled:['capture','captureTrace','probe','sendTelemetry','logEvent','flushEventLog'],observabilityClaim:'These methods update measurement/event-log state only and are not inputs to audio state; proof-runner equivalence is regression-tested by PCM hash.'},
    dsp:{catalogSchema:catalog.schema,catalogSha256:(await fetchHash('/lean/catalog.json')).sha256,leanVersion:catalog.leanVersion,buildHash:catalog.buildHash,compilerTheorem:catalog.compilerTheorem,traceTheorem:catalog.traceTheorem,proofClaim:catalog.verification?.claim,modules:moduleRecords},
    output:{encoding:'f32le-interleaved',sampleRate:session.sampleRate,channels:2,frames:left.length,pcmSha256,container:'RIFF/WAVE IEEE_FLOAT32 stereo with JIGP certificate chunk'},
    releaseReference,
    procedures:Object.fromEntries(procedures.map(x=>[x.url,{sha256:x.sha256,bytes:x.bytes}])),
    leanEvidence:{nativeRelease:{leanVersion:buildReport.leanVersion,toolchainCommit:buildReport.toolchainCommit||null,toolchainIdentityComplete:!!buildReport.toolchainCommit,buildSourceSha256:buildReport.buildHash,catalogSha256:buildReport.catalogHash,compilerTheorem:buildReport.verification?.compilerTheorem,traceTheorem:buildReport.verification?.traceTheorem,sorryAxAccepted:buildReport.sorryAxAccepted},jigScore:{model:'/lean/JigScore.lean',status:'draft / hash-bound but not native-certified',programSha256,eventPlanSha256},releaseEquivalentTarget:{tag:'v4.34.0',commit:'293d5d0c0c3f3dded4688b3ccd6a33939ac5102b'}},
    assurance:{artifactHashChain:true,scoreProgramHashBound:true,eventPlanHashBound:true,nativeLeanDspCatalogBound:true,exactHostRendererHashBound:true,fullRenderReplayable:true,hostSchedulerFormallyProved:false,jigScoreFormallyCertified:false,executionEnvironmentAttested:false},
    limitations:['This establishes a checkable digital derivation chain and deterministic replay claim; it does not attest which physical machine originally executed the render.','The LeanDSP proof covers source semantics through the typed Wasm subset; WAT printing/helpers, WABT, WebAssembly floating-point execution and the host scheduler/mixer/effects remain explicit trust boundaries.','JigScore hashes bind the score program/event plan, but /lean/JigScore.lean is not yet part of the pinned native release certificate.','The existing native Lean release record names Lean 4.34.0 but does not record the exact compiler commit, so exact toolchain identity remains fail-closed.']
  };
  const payloadSha256=await sha256Text(canonicalJson(payload)),envelope={schema:ENVELOPE_SCHEMA,canonicalization:'RFC8785-style canonical JSON for JSON primitives/arrays/objects',hash:'SHA-256',payloadSha256,payload};
  return{envelope,wav:proofWavChannels([left,right],session.sampleRate,envelope),filename:safeName(composition.title),pcmSha256};
}

export async function verifyCompositionCertificate(envelope){
  const errors=[],notes=[],p=envelope?.payload;if(p?.schema!==COMPOSITION_PROOF_SCHEMA)return{ok:false,errors:['Not a composition-audio certificate'],notes};
  const rendererBytes=base64ToBytes(p.renderer.workletSourceBase64||''),workerBytes=base64ToBytes(p.renderer.workerSourceBase64||'');
  const programHash=await sha256Text(canonicalJson(p.composition.program)),eventHash=await sha256Text(canonicalJson(p.composition.eventPlan));if(programHash!==p.composition.programSha256)errors.push('JigScore program hash mismatch');if(eventHash!==p.composition.eventPlanSha256)errors.push('JigScore event-plan hash mismatch');
  if(await sha256Bytes(rendererBytes)!==p.renderer.workletSha256)errors.push('Embedded worklet hash mismatch');if(await sha256Bytes(workerBytes)!==p.renderer.workerSha256)errors.push('Embedded proof-worker hash mismatch');
  for(const m of p.dsp.modules||[]){const bytes=base64ToBytes(m.wasmBase64),h=await sha256Bytes(bytes);if(h!==m.wasmHash)errors.push('Embedded Wasm hash mismatch: '+m.id);if(!WebAssembly.validate(bytes))errors.push('Embedded Wasm rejected: '+m.id);}
  if(p.releaseReference?.compatible&&(p.releaseReference.pcmMatch!==true||p.releaseReference.expectedPcmSha256!==p.output.pcmSha256))errors.push('Pinned release-reference PCM mismatch');
  if(!p.leanEvidence?.nativeRelease?.toolchainIdentityComplete)notes.push('Native Lean release evidence still lacks an exact compiler commit.');if(p.leanEvidence?.jigScore?.status!=='native-certified')notes.push('JigScore model is hash-bound but not yet native-certified.');return{ok:errors.length===0,errors,notes,programHash,eventPlanHash:eventHash};
}

export async function replayCompositionFromCertificate(envelope,{onProgress}={}){
  const p=envelope?.payload;if(p?.schema!==COMPOSITION_PROOF_SCHEMA)throw new Error('Not a composition-audio certificate');const basic=await verifyCompositionCertificate(envelope);if(!basic.ok)throw new Error(basic.errors.join('; '));
  const modules=p.dsp.modules.map(m=>({id:m.id,hash:m.wasmHash,bytes:base64ToBytes(m.wasmBase64),debug:null})),workletUrl=URL.createObjectURL(new Blob([base64ToBytes(p.renderer.workletSourceBase64)],{type:'text/javascript'})),workerUrl=URL.createObjectURL(new Blob([base64ToBytes(p.renderer.workerSourceBase64)],{type:'text/javascript'})),worker=new Worker(workerUrl);try{return await new Promise((resolve,reject)=>{worker.onmessage=async({data:d})=>{if(d?.type==='progress'){onProgress?.(d.percent);return;}if(d?.type==='error'){reject(new Error(d.message));return;}if(d?.type==='done'){try{const left=new Float32Array(d.left),right=new Float32Array(d.right),pcmSha256=await sha256Bytes(interleavedFloat32le([left,right]));resolve({left,right,pcmSha256,frames:d.frames,sampleRate:d.sampleRate,nonFinite:d.nonFinite,elapsedMs:d.elapsedMs,match:pcmSha256===p.output.pcmSha256});}catch(e){reject(e);}}};worker.onerror=e=>reject(new Error(e.message||'Proof render worker failed'));worker.postMessage({type:'render',rendererUrl:workletUrl,session:p.render.session,modules,master:p.render.master,sampleRate:p.output.sampleRate});});}finally{worker.terminate();URL.revokeObjectURL(workerUrl);URL.revokeObjectURL(workletUrl);}
}

export async function verifyEnvelope(envelope){
  const errors=[],notes=[];if(envelope?.schema!==ENVELOPE_SCHEMA)errors.push('Unknown envelope schema');
  const actual=await sha256Text(canonicalJson(envelope.payload));if(actual!==envelope.payloadSha256)errors.push('Certificate payload hash mismatch');
  const p=envelope.payload;if(p?.analysis?.trajectoryBase64){const h=await sha256Bytes(base64ToBytes(p.analysis.trajectoryBase64));if(h!==p.analysis.trajectorySha256)errors.push('Trajectory hash mismatch');}
  if(p?.leanEvidence?.nativeRelease?.toolchainIdentityComplete!==true)notes.push('Exact native Lean compiler commit is not recorded; release-equivalent browser proof is fail-closed.');
  return{ok:errors.length===0,errors,notes,payloadHash:actual};
}

export async function replaySwsFromCertificate(envelope){
  const p=envelope.payload,bytes=base64ToBytes(p.analysis.trajectoryBase64),analysis=decodeTrajectory(bytes,p.analysis);
  if(typeof globalThis.WabtModule!=='function')throw new Error('WABT unavailable');
  const checked=compileLeanDSP(p.dsp.source,{debug:false}),wabt=await globalThis.WabtModule(),mod=wabt.parseWat('proof-TrackedSine.wat',checked.wat,{multi_value:true,bulk_memory:true,simd:true});mod.resolveNames();mod.validate();const{buffer}=mod.toBinary({log:false,write_debug_names:true});mod.destroy?.();const wasm=new Uint8Array(buffer),wasmHash=await sha256Bytes(wasm),module=new WebAssembly.Module(wasm);
  const frames=analysis.frames,hop=analysis.hop,sr=analysis.sampleRate,length=p.dsp.swsFrames,out=new Float32Array(length),voices=Array.from({length:3},()=>{const inst=new WebAssembly.Instance(module,{});inst.exports.prepare(sr);inst.exports.reset();return{inst,out:new Float32Array(inst.exports.memory.buffer,4096,128)};});
  const block=p.dsp.blockFrames||4;for(let at=0;at<length;at+=block){const n=Math.min(block,length-at),q=(at+n*.5)/hop,j=Math.min(frames.length-1,Math.floor(q)),k=Math.min(frames.length-1,j+1),u=Math.max(0,Math.min(1,q-j)),A=frames[j],B=frames[k];for(let b=0;b<3;b++){const freq=A.f[b]+(B.f[b]-A.f[b])*u,amp=Math.max(0,Math.min(1,A.a[b]+(B.a[b]-A.a[b])*u)),v=voices[b];v.inst.exports.process(0,4096,n,freq,amp,0,0);for(let i=0;i<n;i++)out[at+i]+=v.out[i];}}
  const fade=Math.max(1,Math.round(sr*.008));for(let i=0;i<Math.min(fade,out.length);i++){const g=i/fade;out[i]*=g;out[out.length-1-i]*=g;}
  const norm=p.dsp.normalization,inRms=Math.sqrt(out.reduce((s,x)=>s+x*x,0)/Math.max(1,out.length)),inPeak=out.reduce((m,x)=>Math.max(m,Math.abs(x)),0),gain=inRms>1e-8?Math.min(norm.maxGain,norm.targetRms/inRms,norm.peakCeil/Math.max(inPeak,1e-8)):1,normalized=new Float32Array(out.length);for(let i=0;i<out.length;i++)normalized[i]=out[i]*gain;
  return{wasmHash,swsSha256:await sha256Bytes(float32le(normalized)),samples:normalized};
}