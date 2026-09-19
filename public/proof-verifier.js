import {
  COMPOSITION_PROOF_SCHEMA,parseProofWav,verifyEnvelope,verifyCompositionCertificate,
  replayCompositionFromCertificate,replaySwsFromCertificate,sha256Bytes,float32le,
  trajectoryBytes,base64ToBytes
} from './audio-proof.js';
import {mono,analyseRidges} from './sample-sws.js';
import {siteUrl} from './site-url.js';

const $=s=>document.querySelector(s),file=$('#proofFile'),checks=$('#checks'),summary=$('#summary'),replayBtn=$('#replay'),sourcesBtn=$('#checkSources');
let envelope=null,wav=null;
const hexShort=s=>s?String(s).slice(0,16)+'…':'—';
function row(kind,title,detail){const e=document.createElement('div');e.className='check '+kind;e.innerHTML='<i>'+(kind==='ok'?'✓':kind==='fail'?'✕':'!')+'</i><div><b></b><small></small></div>';e.querySelector('b').textContent=title;e.querySelector('small').textContent=detail||'';checks.append(e);}
function reset(){checks.replaceChildren();summary.textContent='No proof loaded.';envelope=null;wav=null;replayBtn.disabled=true;sourcesBtn.disabled=true;replayBtn.textContent='Replay full derivation';}
function isComposition(){return envelope?.payload?.schema===COMPOSITION_PROOF_SCHEMA;}

async function inspectComposition(p){
  const structural=await verifyCompositionCertificate(envelope);
  row(structural.ok?'ok':'fail','Composition derivation structure',structural.ok?'JigScore, embedded host renderer and '+(p.dsp.modules?.length||0)+' Wasm modules hash correctly.':structural.errors.join('; '));
  row(structural.programHash===p.composition.programSha256?'ok':'fail','JigScore program',hexShort(structural.programHash)+' · '+p.composition.title);
  row(structural.eventPlanHash===p.composition.eventPlanSha256?'ok':'fail','JigScore event plan',p.composition.eventPlan.events.length.toLocaleString()+' events · '+hexShort(structural.eventPlanHash));
  row(p.composition.authoredOnly?'ok':'warn','Score provenance',p.composition.authoredOnly?'Authored composition only; no local-pattern events.':'Certificate contains local/user score events.');
  if(p.releaseReference)row(p.releaseReference.compatible&&p.releaseReference.pcmMatch?'ok':'warn','Pinned release PCM',p.releaseReference.compatible?(p.releaseReference.pcmMatch?'Matches '+hexShort(p.releaseReference.expectedPcmSha256):'Compatible reference but PCM does not match'):'Reference exists but settings/artifacts do not match this render.');
  row('ok','Host renderer pinned','worklet '+hexShort(p.renderer.workletSha256)+' · worker '+hexShort(p.renderer.workerSha256));
  row('ok','LeanDSP module set',(p.dsp.modules||[]).map(m=>m.id+' '+hexShort(m.wasmHash)).join(' · '));
  row(p.leanEvidence?.nativeRelease?.toolchainIdentityComplete?'ok':'warn','Native Lean identity',p.leanEvidence?.nativeRelease?.toolchainIdentityComplete?'Exact compiler identity recorded.':'Lean '+(p.leanEvidence?.nativeRelease?.leanVersion||'—')+' build evidence is bound, but exact compiler commit is still absent.');
  row(p.leanEvidence?.jigScore?.status==='native-certified'?'ok':'warn','JigScore proof status',p.leanEvidence?.jigScore?.status||'unknown');
  for(const n of structural.notes||[])row('warn','Certificate limitation',n);
  summary.textContent=p.claim.title+' · '+p.output.sampleRate+' Hz stereo · '+p.output.frames.toLocaleString()+' frames · cert '+envelope.payloadSha256;
  replayBtn.textContent='Replay exact composition';
}

async function inspectSws(p){
  if(wav){
    const pcmHash=await sha256Bytes(wav.pcmBytes),fmt=wav.fmt;
    row(pcmHash===p.output.pcmSha256?'ok':'fail','Embedded PCM',fmt.sampleRate+' Hz · '+fmt.channels+'ch · f'+fmt.bits+' · SHA-256 '+hexShort(pcmHash));
    const barBytes=p.composition.barFrames*4,b2=wav.pcmBytes.subarray(barBytes,barBytes*2),b4=wav.pcmBytes.subarray(barBytes*3,barBytes*4),h2=await sha256Bytes(b2),h4=await sha256Bytes(b4);
    row(h2===h4&&h2===p.composition.bar2PcmSha256&&h4===p.composition.bar4PcmSha256?'ok':'fail','Bars 2 and 4 identical','bar2 '+hexShort(h2)+' · bar4 '+hexShort(h4));
  }
  const trajHash=await sha256Bytes(base64ToBytes(p.analysis.trajectoryBase64));
  row(trajHash===p.analysis.trajectorySha256?'ok':'fail','Embedded analysis trajectory',p.analysis.frameCount+' frames · SHA-256 '+hexShort(trajHash));
  row(p.leanEvidence?.nativeRelease?.trackedSineInCatalog?'ok':'warn','Lean proof status',p.leanEvidence?.nativeRelease?.trackedSineInCatalog?'TrackedSine is in the pinned native catalog.':'TrackedSine is not yet in the pinned native catalog; provenance is checkable, but release-level Lean certification is not claimed.');
  summary.textContent=p.claim.title+' · cert '+envelope.payloadSha256+' · '+p.input.text;replayBtn.textContent='Replay full derivation';
}

async function inspectLoaded(bytes,name){
  checks.replaceChildren();let data;
  if(/\.wav$/i.test(name)||String.fromCharCode(...bytes.subarray(0,4))==='RIFF'){wav=parseProofWav(bytes);data=wav.envelope;}else{data=JSON.parse(new TextDecoder().decode(bytes));wav=null;}
  envelope=data;const basic=await verifyEnvelope(envelope),p=envelope.payload;
  row(basic.ok?'ok':'fail','Certificate envelope',basic.ok?'Canonical payload SHA-256 '+hexShort(envelope.payloadSha256):basic.errors.join('; '));
  if(wav){const pcmHash=await sha256Bytes(wav.pcmBytes),fmt=wav.fmt;row(pcmHash===p.output.pcmSha256?'ok':'fail','Embedded WAV PCM',fmt.sampleRate+' Hz · '+fmt.channels+'ch · f'+fmt.bits+' · '+hexShort(pcmHash));}
  else row('warn','Audio container not supplied','Load the .proof.wav to verify that the certificate is embedded beside the claimed PCM.');
  if(p.schema===COMPOSITION_PROOF_SCHEMA)await inspectComposition(p);else await inspectSws(p);
  replayBtn.disabled=false;sourcesBtn.disabled=false;
}
file.onchange=async()=>{reset();const f=file.files?.[0];if(!f)return;try{await inspectLoaded(new Uint8Array(await f.arrayBuffer()),f.name);}catch(e){row('fail','Could not read proof',e.message);}};

sourcesBtn.onclick=async()=>{if(!envelope)return;const p=envelope.payload;sourcesBtn.disabled=true;try{for(const [url,rec] of Object.entries(p.procedures||{})){try{const r=await fetch(siteUrl(url),{cache:'no-store'}),bytes=new Uint8Array(await r.arrayBuffer()),h=await sha256Bytes(bytes);row(h===rec.sha256?'ok':'warn','Current procedure '+url,h===rec.sha256?'Still matches certificate '+hexShort(h):'Current deployment differs; proof replay uses certificate-embedded/pinned artifacts where applicable. expected '+hexShort(rec.sha256)+' got '+hexShort(h));}catch(e){row('warn','Current procedure '+url,'Could not fetch: '+e.message);}}}finally{sourcesBtn.disabled=false;}};

function normalise(a,target,maxGain,peakCeil){let sum=0,pk=0;for(const x of a){sum+=x*x;pk=Math.max(pk,Math.abs(x));}const r=Math.sqrt(sum/Math.max(1,a.length)),g=r>1e-8?Math.min(maxGain,target/r,peakCeil/Math.max(pk,1e-8)):1,out=new Float32Array(a.length);for(let i=0;i<a.length;i++)out[i]=a[i]*g;return out;}
function referenceSws(envelope){const p=envelope.payload,b=base64ToBytes(p.analysis.trajectoryBase64),v=new DataView(b.buffer,b.byteOffset,b.byteLength),frames=[];for(let o=0;o+31<b.length;o+=32){let q=o;const at=v.getUint32(q,true);q+=4,energy=v.getFloat32(q,true);q+=4,f=[],a=[];for(let k=0;k<3;k++,q+=4)f.push(v.getFloat32(q,true));for(let k=0;k<3;k++,q+=4)a.push(v.getFloat32(q,true));frames.push({at,energy,f,a});}const hop=p.analysis.hop,sr=p.analysis.sampleRate,out=new Float32Array(p.dsp.swsFrames),phase=[0,0,0];for(let i=0;i<out.length;i++){const q=i/hop,j=Math.min(frames.length-1,Math.floor(q)),k=Math.min(frames.length-1,j+1),u=Math.max(0,Math.min(1,q-j)),A=frames[j],B=frames[k];let y=0;for(let n=0;n<3;n++){const f=A.f[n]+(B.f[n]-A.f[n])*u,a=A.a[n]+(B.a[n]-A.a[n])*u;phase[n]+=2*Math.PI*f/sr;if(phase[n]>2*Math.PI)phase[n]-=2*Math.PI;y+=Math.sin(phase[n])*a;}out[i]=y;}const fade=Math.max(1,Math.round(sr*.008));for(let i=0;i<Math.min(fade,out.length);i++){const g=i/fade;out[i]*=g;out[out.length-1-i]*=g;}const n=p.dsp.normalization;return normalise(out,n.targetRms,n.maxGain,n.peakCeil);}

async function replaySws(p){
  const sourceResp=await fetch(p.input.url,{mode:'cors',cache:'no-store'});if(!sourceResp.ok)throw new Error('Source fetch HTTP '+sourceResp.status);const sourceBytes=new Uint8Array(await sourceResp.arrayBuffer()),sourceHash=await sha256Bytes(sourceBytes);row(sourceHash===p.input.sha256?'ok':'fail','Input MP3 bytes','SHA-256 '+hexShort(sourceHash));
  const ac=new AudioContext(),decoded=await ac.decodeAudioData(sourceBytes.buffer.slice(0)),src=mono(decoded),decodedHash=await sha256Bytes(float32le(src));row(decodedHash===p.input.decodedMonoFloat32leSha256?'ok':'warn','Decoded mono PCM',decodedHash===p.input.decodedMonoFloat32leSha256?'Matches certificate '+hexShort(decodedHash):'Decoder differs: expected '+hexShort(p.input.decodedMonoFloat32leSha256)+' got '+hexShort(decodedHash));
  const analysis=analyseRidges(src,decoded.sampleRate),trajHash=await sha256Bytes(trajectoryBytes(analysis));row(trajHash===p.analysis.trajectorySha256?'ok':'warn','Recomputed ridge analysis',trajHash===p.analysis.trajectorySha256?'Trajectory matches '+hexShort(trajHash):'Trajectory differs; decoder/platform variance is possible.');
  const rr=await replaySwsFromCertificate(envelope);row(rr.wasmHash===p.dsp.wasmSha256?'ok':'fail','Recompiled TrackedSine Wasm','SHA-256 '+hexShort(rr.wasmHash));row(rr.swsSha256===p.dsp.leanSwsSha256?'ok':'fail','Replayed LeanDSP SWS','SHA-256 '+hexShort(rr.swsSha256));
  const ref=referenceSws(envelope),refHash=await sha256Bytes(float32le(ref));row(refHash===p.dsp.referenceSwsSha256?'ok':'fail','Replayed JS reference SWS','SHA-256 '+hexShort(refHash));const chosen=p.dsp.renderer==='reference'?ref:rr.samples;
  if(decoded.sampleRate===p.output.sampleRate){const srcNorm=normalise(src,p.composition.sourceNormalization.targetRms,p.composition.sourceNormalization.maxGain,p.composition.sourceNormalization.peakCeil),bar=p.composition.barFrames,total=bar*4,composite=new Float32Array(total);composite.set(chosen,bar);composite.set(srcNorm,bar*2);composite.set(chosen,bar*3);const h=await sha256Bytes(float32le(composite));row(h===p.output.pcmSha256?'ok':'warn','Full four-bar replay',h===p.output.pcmSha256?'PCM matches '+hexShort(h):'PCM differs: expected '+hexShort(p.output.pcmSha256)+' got '+hexShort(h));}
  await ac.close();
}

replayBtn.onclick=async()=>{if(!envelope)return;const p=envelope.payload;replayBtn.disabled=true;try{
  if(isComposition()){const rr=await replayCompositionFromCertificate(envelope,{onProgress:pct=>{replayBtn.textContent='Replaying '+pct+'%';}});row(rr.nonFinite===0?'ok':'fail','Renderer finite-output check',rr.nonFinite+' non-finite samples');row(rr.match?'ok':'fail','Exact stereo PCM replay',(rr.match?'MATCH ':'MISMATCH ') + hexShort(rr.pcmSha256)+' · '+rr.frames.toLocaleString()+' frames · '+rr.elapsedMs+' ms compute');}
  else await replaySws(p);
 }catch(e){row('fail','Replay failed',e.message);}finally{replayBtn.disabled=false;replayBtn.textContent=isComposition()?'Replay exact composition':'Replay full derivation';}};