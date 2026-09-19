import {readRdf,termKey,RDF_ENGINE} from './rdf.js';
import {verifySignedProfile,resolvePublishedMultikey} from './jigdaw-signing.js';
const NS={jig:'http://purl.org/stuff/jigdaw/',trn:'http://purl.org/stuff/transmissions/',lv2:'http://lv2plug.in/ns/lv2core#',units:'http://lv2plug.in/ns/extensions/units#',rdf:'http://www.w3.org/1999/02/22-rdf-syntax-ns#',rdfs:'http://www.w3.org/2000/01/rdf-schema#'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function parseJigProfile(ttl,fetchUrl){
 const rdf=await readRdf(ttl,{baseIRI:fetchUrl,format:'turtle'});
 const roots=[...new Map(rdf.triples.filter(r=>r.p.value===NS.rdf+'type'&&r.o.value===NS.jig+'WebPlugin').map(r=>[termKey(r.s),r.s])).values()];
 const root=roots.find(r=>r.value===fetchUrl)||(roots.length===1?roots[0]:null);if(!root)throw new Error('Expected one unambiguous jig:WebPlugin profile');
 const objs=(s,p)=>rdf.objects(s,p),one=(s,p,required=false)=>{const vs=objs(s,p);if(vs.length>1)throw new Error('Ambiguous profile property '+p);if(required&&!vs.length)throw new Error('Missing profile property '+p);return vs[0];};
 const str=(s,p,def='',required=false)=>{const t=one(s,p,required);return t?.value??def;};
 const num=(s,p,def,min,max)=>{const t=one(s,p),v=t?Number(t.value):def;if(!Number.isFinite(v)||v<min||v>max)throw new Error('Invalid numeric profile property '+p);return v;};
 const has=(s,p,v)=>objs(s,p).some(t=>t.value===v);
 const moduleNode=one(root,NS.jig+'module',true),processorNode=one(root,NS.jig+'processor',true);
 const resource=s=>{const t=one(s,NS.jig+'location',true);if(t.type!=='uri')throw new Error('Resource location must be an IRI');const u=new URL(t.value);if(u.protocol!=='https:')throw new Error('Executable resources require HTTPS');return {url:u.href,integrity:str(s,NS.jig+'integrity','',true)};};
 const ports=objs(root,NS.lv2+'port').filter(p=>has(p,NS.rdf+'type',NS.lv2+'ControlPort')).map(p=>{
  const minimum=num(p,NS.lv2+'minimum',0,-1e9,1e9),maximum=num(p,NS.lv2+'maximum',1,minimum,1e9),defaultValue=num(p,NS.lv2+'default',0,minimum,maximum);
  const points=objs(p,NS.lv2+'scalePoint').map(sp=>({label:str(sp,NS.rdfs+'label','',true),value:num(sp,NS.rdf+'value',NaN,minimum,maximum)})).sort((a,b)=>a.value-b.value);
  return {id:p.value,symbol:str(p,NS.lv2+'symbol','',true),name:str(p,NS.lv2+'name',str(p,NS.lv2+'symbol')),defaultValue,minimum,maximum,paramIndex:num(p,NS.jig+'paramIndex',NaN,0,65535),toggled:has(p,NS.lv2+'portProperty',NS.lv2+'toggled'),enumeration:has(p,NS.lv2+'portProperty',NS.lv2+'enumeration'),scalePoints:points,unit:str(p,NS.units+'unit').replace(NS.units,'')};
 }).sort((a,b)=>a.paramIndex-b.paramIndex);
 if(new Set(ports.map(p=>p.symbol)).size!==ports.length||new Set(ports.map(p=>p.paramIndex)).size!==ports.length||ports.some(p=>!Number.isInteger(p.paramIndex)))throw new Error('Duplicate or invalid parameter identity');
 const integers={audioInputs:num(root,NS.jig+'audioInputs',0,0,8),inputChannels:num(root,NS.jig+'inputChannels',1,1,32),audioOutputs:num(root,NS.jig+'audioOutputs',1,1,8),outputChannels:num(root,NS.jig+'outputChannels',2,1,32),renderQuantum:num(root,NS.jig+'renderQuantum',128,128,128)};
 if(Object.values(integers).some(x=>!Number.isInteger(x)))throw new Error('Channel and quantum values must be integers');
 return {fetchUrl,base:root.value,label:str(root,NS.rdfs+'label','Unnamed plugin'),ttl,rdfEngine:RDF_ENGINE,triples:rdf.triples.length,...integers,acceptsMidi:has(root,NS.trn+'accepts',NS.trn+'Midi'),abi:str(moduleNode,NS.jig+'abi').replace(NS.jig,''),module:resource(moduleNode),processor:{...resource(processorNode),registeredName:str(processorNode,NS.jig+'registeredName','',true)},ports};
}

function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000)));return btoa(s)}
async function verify(bytes,sri){
  const m=String(sri||'').match(/^(sha(?:256|384|512))-(.+)$/i);if(!m)throw new Error('missing/unsupported integrity');
  const algo=m[1].toUpperCase().replace('SHA','SHA-');const got=new Uint8Array(await crypto.subtle.digest(algo,bytes));
  if(b64(got)!==m[2])throw new Error(`${algo} integrity mismatch`);return true;
}
async function fetchBytes(url,sri){const r=await fetch(url);if(!r.ok)throw new Error(`${url} returned ${r.status}`);const bytes=new Uint8Array(await r.arrayBuffer());await verify(bytes,sri);return bytes}

async function verifyBundleSigning(ttl,profile,responseUrl){
  let provenanceText='',provenanceUrl=null,lookup='not-needed',status=await verifySignedProfile({profileText:ttl,profileIri:profile.base});
  if(status.declared==null&&!status.signed){provenanceUrl=new URL('provenance.ttl',responseUrl).href;try{const r=await fetch(provenanceUrl,{headers:{Accept:'text/turtle'},cache:'no-store'});lookup='HTTP '+r.status;if(r.ok){provenanceText=await r.text();status=await verifySignedProfile({profileText:ttl,provenanceText,profileIri:profile.base,resolveKey:resolvePublishedMultikey});}}catch(e){lookup='unavailable: '+e.message;}}
  else if(status.signed){status=await verifySignedProfile({profileText:ttl,profileIri:profile.base,resolveKey:resolvePublishedMultikey});lookup='inline provenance/proof';}
  if(status.digestMatches===false)throw new Error('JigDAW canonical profile digest mismatch');
  if(status.signed&&!status.valid)throw new Error('JigDAW signature verification failed: '+status.proofs.map(p=>p.reason||'invalid proof').join('; '));
  return {provenanceUrl,provenanceLookup:lookup,digest:status.digest,declaredDigest:status.declared,canonicalDigest:status.declared==null?'not-present':'verified',signature:status.signed?'valid':'unsigned',proofs:status.proofs||[],engine:{name:status.engine.engine,runtimeVersion:status.engine.runtimeVersion,wasmSha256:status.engine.build.wasmSha256,leanToolchain:status.engine.build.leanToolchain}};
}

export async function loadJigPlugin(profileUrl,context){
  const rp=await fetch(profileUrl,{headers:{Accept:'text/turtle'}});if(!rp.ok)throw new Error(`profile returned ${rp.status}`);const ttl=await rp.text();
  const profile=await parseJigProfile(ttl,rp.url||profileUrl);if(!profile.processor.registeredName)throw new Error('profile has no jig:registeredName');
  const signing=await verifyBundleSigning(ttl,profile,rp.url||profileUrl);
  const [processorBytes,moduleBytes]=await Promise.all([fetchBytes(profile.processor.url,profile.processor.integrity),fetchBytes(profile.module.url,profile.module.integrity)]);
  if(!WebAssembly.validate(moduleBytes))throw new Error('module failed WebAssembly.validate');
  const processorBlob=new Blob([processorBytes],{type:'text/javascript'}),processorUrl=URL.createObjectURL(processorBlob);
  try{await context.audioWorklet.addModule(processorUrl)}finally{setTimeout(()=>URL.revokeObjectURL(processorUrl),2000)}
  const opts={numberOfInputs:profile.audioInputs,numberOfOutputs:profile.audioOutputs,processorOptions:{capabilities:[],sampleRate:context.sampleRate,quantum:profile.renderQuantum}};
  if(profile.audioOutputs>0)opts.outputChannelCount=Array(profile.audioOutputs).fill(profile.outputChannels);
  const node=new AudioWorkletNode(context,profile.processor.registeredName,opts);
  for(const p of profile.ports)if(node.parameters.has(p.symbol))node.parameters.get(p.symbol).value=p.defaultValue;
  const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`${esc(profile.label)} ready timeout`)),10000);const prior=node.port.onmessage;node.port.onmessage=e=>{prior?.(e);if(e.data?.type==='ready'){clearTimeout(timer);resolve(e.data)}else if(e.data?.type==='error'){clearTimeout(timer);reject(new Error(`${e.data.phase||'plugin'}: ${e.data.message}`))}}});
  const ab=moduleBytes.buffer.slice(moduleBytes.byteOffset,moduleBytes.byteOffset+moduleBytes.byteLength);
  node.port.postMessage({type:'init',module:ab,capabilities:[],sampleRate:context.sampleRate,quantum:profile.renderQuantum},[ab]);
  await ready;return{profile:{...profile,verification:{resources:'verified',canonicalDigest:signing.canonicalDigest,signature:signing.signature,proofs:signing.proofs,provenanceLookup:signing.provenanceLookup,signingEngine:signing.engine}},node};
}

export function renderProfileControls(host,loaded){
  if(!host||!loaded)return;const {profile,node}=loaded;
  host.innerHTML=`<div class="foreign-meta"><b>${esc(profile.label)}</b><span>${profile.abi||'processor-private ABI'} · ${profile.ports.length} params · files ${profile.verification?.resources||'unchecked'} · profile ${profile.verification?.canonicalDigest||'unchecked'} · ${profile.verification?.signature||'unsigned'}</span></div>`+profile.ports.map(p=>{
    if(p.enumeration&&p.scalePoints.length)return `<label class="foreign-control"><span>${esc(p.name)}</span><select data-p="${esc(p.symbol)}">${p.scalePoints.map(x=>`<option value="${x.value}"${x.value===p.defaultValue?' selected':''}>${esc(x.label)}</option>`).join('')}</select><i>${esc(p.symbol)}</i></label>`;
    if(p.toggled)return `<label class="foreign-control"><span>${esc(p.name)}</span><input data-p="${esc(p.symbol)}" type="checkbox" ${p.defaultValue?'checked':''}><i>${esc(p.symbol)}</i></label>`;
    const step=Math.max((p.maximum-p.minimum)/300,0.0001);return `<label class="foreign-control"><span>${esc(p.name)}</span><input data-p="${esc(p.symbol)}" type="range" min="${p.minimum}" max="${p.maximum}" step="${step}" value="${p.defaultValue}"><output>${p.defaultValue}${p.unit?' '+p.unit:''}</output></label>`;
  }).join('');
  host.querySelectorAll('[data-p]').forEach(el=>{const apply=()=>{let v=el.type==='checkbox'?(el.checked?1:0):Number(el.value);const ap=node.parameters.get(el.dataset.p);if(ap)ap.setValueAtTime(v,node.context.currentTime);const o=el.parentElement.querySelector('output');if(o)o.textContent=Number(v.toFixed?.(3)??v)+(profile.ports.find(p=>p.symbol===el.dataset.p)?.unit?' '+profile.ports.find(p=>p.symbol===el.dataset.p).unit:'')};el.addEventListener(el.tagName==='SELECT'?'change':'input',apply)});
}

export function sendPulsePhrase(loaded,context){
  const node=loaded?.node;if(!node)return;const base=Math.ceil(context.currentTime*context.sampleRate)+256,beat=Math.round(context.sampleRate*60/108/2);const notes=[36,43,48,51,43,55,48,39],events=[];
  notes.forEach((n,i)=>{const at=base+i*beat;events.push({frame:at,bytes:[0x90,n,92]},{frame:at+Math.floor(beat*.72),bytes:[0x80,n,0]})});events.sort((a,b)=>a.frame-b.frame);node.port.postMessage({type:'events',events});
}