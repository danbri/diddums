import {loadL4} from './vendor/factoidal-lean-0.8.0/l4factoidal.js';

export const CRYPTOSUITE='jigdaw-eddsa-2026';
export const SPEC_COMMIT='07ae9f7f22aa9bd566a82d745418d84e628655d0';
export const FACTOIDAL_COMMIT='30154c0467ee529b7a056bb9c2ac61f144578619';
const JIG='http://purl.org/stuff/jigdaw/', RDF='http://www.w3.org/1999/02/22-rdf-syntax-ns#', PROV='http://www.w3.org/ns/prov#', SEC='https://w3id.org/security#', DCT='http://purl.org/dc/terms/', XSD='http://www.w3.org/2001/XMLSchema#';
const I={
  rdfType:RDF+'type', bundle:JIG+'Bundle', location:JIG+'location', canonicalDigest:JIG+'canonicalDigest',
  proof:SEC+'proof', proofValue:SEC+'proofValue', cryptosuite:SEC+'cryptosuite', verificationMethod:SEC+'verificationMethod',
  publicKeyMultibase:SEC+'publicKeyMultibase', wasGeneratedBy:PROV+'wasGeneratedBy'
};
const enc=new TextEncoder();
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', INDEX=new Map([...ALPHABET].map((c,i)=>[c,i]));
const ED25519_PREFIX=[0xed,0x01];
let engPromise=null, versionPromise=null;

function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+0x8000)));return btoa(s);}
function unquote(term){const m=/^"((?:[^"\\]|\\.)*)"(?:\^\^<[^>]+>|@[A-Za-z0-9-]+)?$/.exec(term);if(!m)return null;return JSON.parse('"'+m[1]+'"');}
function iri(term){const m=/^<([^>]*)>$/.exec(term);return m?m[1]:null;}
function parseLine(line){
  const m=/^(<[^>]*>|_:[^\s]+)\s+(<[^>]*>)\s+(.+)\s+\.$/.exec(line.trim());if(!m)throw new Error('Unsupported canonical N-Quads line: '+line);
  return {line:line.trim(),s:iri(m[1]),sTerm:m[1],p:iri(m[2]),oTerm:m[3],oIri:iri(m[3]),oLiteral:unquote(m[3])};
}
function codePointSort(a,b){const A=[...a],B=[...b];for(let i=0;i<Math.min(A.length,B.length);i++){const d=A[i].codePointAt(0)-B[i].codePointAt(0);if(d)return d;}return A.length-B.length;}
function linesText(lines){return [...new Set(lines)].sort(codePointSort).join('\n')+'\n';}
function hasBlank(lines){return lines.some(l=>/(^|\s)_:[A-Za-z0-9]/.test(l));}
function one(rows,s,p){return rows.find(x=>x.s===s&&x.p===p)||null;}

export function base58Encode(bytes){const input=[...bytes];let zeros=0;while(zeros<input.length&&input[zeros]===0)zeros++;const digits=[];for(const byte of input.slice(zeros)){let carry=byte;for(let i=0;i<digits.length;i++){carry+=digits[i]<<8;digits[i]=carry%58;carry=(carry/58)|0;}while(carry>0){digits.push(carry%58);carry=(carry/58)|0;}}return ALPHABET[0].repeat(zeros)+digits.reverse().map(d=>ALPHABET[d]).join('');}
export function base58Decode(text){let zeros=0;while(zeros<text.length&&text[zeros]===ALPHABET[0])zeros++;const bytes=[];for(const ch of text.slice(zeros)){const value=INDEX.get(ch);if(value===undefined)throw new Error('Invalid base58btc character '+JSON.stringify(ch));let carry=value;for(let i=0;i<bytes.length;i++){carry+=bytes[i]*58;bytes[i]=carry&255;carry>>=8;}while(carry>0){bytes.push(carry&255);carry>>=8;}}return new Uint8Array([...new Array(zeros).fill(0),...bytes.reverse()]);}
export const multibaseEncode=bytes=>'z'+base58Encode(bytes);
export function multibaseDecode(text){if(typeof text!=='string'||text[0]!=='z')throw new Error('Expected multibase base58btc string');return base58Decode(text.slice(1));}
export function encodeMultikey(raw){const b=new Uint8Array(raw);if(b.length!==32)throw new Error('Ed25519 public key must be 32 bytes');return multibaseEncode(new Uint8Array([...ED25519_PREFIX,...b]));}
export function decodeMultikey(text){const b=multibaseDecode(text);if(b[0]!==0xed||b[1]!==0x01)throw new Error('Not an Ed25519 public Multikey');const k=b.slice(2);if(k.length!==32)throw new Error('Ed25519 public key must be 32 bytes');return k;}

async function engine(){if(!engPromise)engPromise=loadL4();return engPromise;}
export async function leanFactoidalStatus(){
  const [e,v]=await Promise.all([engine(),versionPromise||(versionPromise=fetch('./vendor/factoidal-lean-0.8.0/version.json').then(r=>r.json()))]);
  const ops=e.call('ops',[]);return {engine:'Lean-generated Factoidal Wasm',runtimeVersion:e.version(),ops:ops.ops||[],abiVersion:ops.abiVersion,build:v,required:['parseToDatasetJson','canonicalizeToNQuads'],ready:['parseToDatasetJson','canonicalizeToNQuads'].every(x=>(ops.ops||[]).includes(x)),vcCryptoExposed:(ops.ops||[]).some(x=>/^vc/i.test(x))};
}
async function canonicalRows(text,baseIRI=''){
  const e=await engine(),parsed=e.call('parseToDatasetJson',[text,'turtle',baseIRI]),nq=parsed.nquads;if(typeof nq!=='string')throw new Error('Lean parser returned no N-Quads');
  const raw=nq.split(/\r?\n/).filter(Boolean);if(hasBlank(raw))throw new Error('Danny JigDAW signing refuses blank nodes; skolemise them before signing.');
  const can=e.call('canonicalizeToNQuads',[nq]);const lines=can.nquads.split(/\r?\n/).filter(Boolean);if(hasBlank(lines))throw new Error('Blank node remained after canonicalization');
  return lines.map(parseLine);
}
function graphParts(rows,profileIri){
  const proofIris=rows.filter(x=>x.s===profileIri&&x.p===I.proof&&x.oIri).map(x=>x.oIri);
  const proofSubjects=new Set(proofIris);
  for(const p of proofIris){const vm=one(rows,p,I.verificationMethod)?.oIri;if(vm)proofSubjects.add(vm);}
  const bundleSubjects=new Set();
  for(const r of rows)if(r.p===I.rdfType&&r.oIri===I.bundle){bundleSubjects.add(r.s);const activity=one(rows,r.s,I.wasGeneratedBy)?.oIri;if(activity)bundleSubjects.add(activity);}
  const common=r=>r.p!==I.location&&r.p!==I.proof;
  const profile=linesText(rows.filter(r=>common(r)&&!bundleSubjects.has(r.s)&&!proofSubjects.has(r.s)).map(r=>r.line));
  const document=linesText(rows.filter(r=>common(r)&&!proofSubjects.has(r.s)).map(r=>r.line));
  return {proofIris,proofSubjects,bundleSubjects,profile,document};
}
async function rawDigest(text){return new Uint8Array(await crypto.subtle.digest('SHA-384',enc.encode(text)));}
export async function canonicalDigest(profileText,profileIri){
  const rows=await canonicalRows(profileText,profileIri),parts=graphParts(rows,profileIri),h=await rawDigest(parts.profile);return 'sha384-'+base64(h);
}
async function forms(profileText,provenanceText,profileIri,proofIri){
  const rows=await canonicalRows(profileText+'\n'+(provenanceText||''),profileIri),parts=graphParts(rows,profileIri);
  if(!parts.proofIris.includes(proofIri))throw new Error('Proof '+proofIri+' is not attached to '+profileIri);
  const config=linesText(rows.filter(r=>r.s===proofIri&&r.p!==I.location&&r.p!==I.proof&&r.p!==I.proofValue).map(r=>r.line));
  return {rows,...parts,config};
}
export async function signingInput(profileText,provenanceText,profileIri,proofIri){const f=await forms(profileText,provenanceText,profileIri,proofIri),a=await rawDigest(f.config),b=await rawDigest(f.document),out=new Uint8Array(96);out.set(a);out.set(b,48);return{input:out,forms:f};}
const originOf=iri=>{try{return new URL(iri).origin}catch{return null}};
export async function resolvePublishedMultikey(verificationMethod){
  const r=await fetch(verificationMethod,{headers:{Accept:'text/turtle, application/n-triples;q=0.9'},cache:'no-store'});if(!r.ok)throw new Error('verificationMethod HTTP '+r.status);const text=await r.text(),rows=await canonicalRows(text,verificationMethod),mb=one(rows,verificationMethod,I.publicKeyMultibase)?.oLiteral||null;if(!mb)throw new Error('Published verification method has no sec:publicKeyMultibase');return mb;
}
export async function verifySignedProfile({profileText,provenanceText='',profileIri,resolveKey=null}){
  const rows=await canonicalRows(profileText+'\n'+provenanceText,profileIri),parts=graphParts(rows,profileIri),digest='sha384-'+base64(await rawDigest(parts.profile));
  const bundle=[...parts.bundleSubjects].find(s=>one(rows,s,I.canonicalDigest)),declared=bundle?one(rows,bundle,I.canonicalDigest)?.oLiteral:null,proofs=[];
  for(const proofIri of parts.proofIris){const cryptosuite=one(rows,proofIri,I.cryptosuite)?.oLiteral||null,verificationMethod=one(rows,proofIri,I.verificationMethod)?.oIri||null,proofValue=one(rows,proofIri,I.proofValue)?.oLiteral||null;const proof={iri:proofIri,cryptosuite,verificationMethod,proofValue,keySource:'inline',sameAuthority:!!verificationMethod&&originOf(verificationMethod)!==null&&originOf(verificationMethod)===originOf(profileIri),valid:false,reason:null};
    try{if(cryptosuite!==CRYPTOSUITE)throw new Error('Unknown cryptosuite '+JSON.stringify(cryptosuite));if(!verificationMethod)throw new Error('No sec:verificationMethod');if(!proofValue)throw new Error('No sec:proofValue');
      let mb=one(rows,verificationMethod,I.publicKeyMultibase)?.oLiteral||null;proof.keyCheck=resolveKey?'not-checked':'not-requested';if(resolveKey){let fetched=null;try{fetched=await resolveKey(verificationMethod);}catch(e){proof.keyCheck='unavailable';proof.keyCheckError=e.message;}if(fetched){if(mb&&mb!==fetched)throw new Error('Inline key disagrees with published key');mb=fetched;proof.keySource='dereferenced';proof.keyCheck='matched';}}if(!mb)throw new Error('No sec:publicKeyMultibase');
      const key=await crypto.subtle.importKey('raw',decodeMultikey(mb),'Ed25519',false,['verify']),si=await signingInput(profileText,provenanceText,profileIri,proofIri);proof.valid=await crypto.subtle.verify('Ed25519',key,multibaseDecode(proofValue),si.input);if(!proof.valid)proof.reason='Signature does not match canonical JigDAW graph';
    }catch(e){proof.reason=e.message;}proofs.push(proof);
  }
  return {engine:(await leanFactoidalStatus()),digest,declared,digestMatches:declared==null?null:declared===digest,signed:proofs.length>0,valid:proofs.length>0&&proofs.every(p=>p.valid),proofs};
}
export async function generateKeyFile(verificationMethod){
  if(!verificationMethod)throw new Error('Verification method IRI required');const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),raw=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey)),pkcs8=new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey));
  return {jigdawKey:1,verificationMethod,publicKeyMultibase:encodeMultikey(raw),privateKeyMultibase:multibaseEncode(pkcs8)};
}
async function importPrivate(text){return crypto.subtle.importKey('pkcs8',multibaseDecode(text),'Ed25519',false,['sign']);}
export async function signProfile({profileText,provenanceText,profileIri,proofIri,keyFile}){
  if(keyFile.verificationMethod&&!provenanceText.includes('<'+keyFile.verificationMethod+'>'))throw new Error('Provenance does not contain the key file verification method');
  const key=await importPrivate(keyFile.privateKeyMultibase),si=await signingInput(profileText,provenanceText,profileIri,proofIri),sig=new Uint8Array(await crypto.subtle.sign('Ed25519',key,si.input));return multibaseEncode(sig);
}
export function injectProofValue(provenanceText,proofIri,proofValue){
  if(!provenanceText.includes('<'+proofIri+'>'))throw new Error('Proof node not found');
  if(provenanceText.includes('<'+proofIri+'> <'+SEC+'proofValue>'))throw new Error('Proof already has an explicit proofValue triple');
  return provenanceText.replace(/\s*$/,'')+'\n\n<'+proofIri+'> <'+SEC+'proofValue> '+JSON.stringify(proofValue)+' .\n';
}
export async function referenceInteropCheck(){
  const [profile,prov]=await Promise.all([fetch('./vendor/danja-jigdaw-signing-2026-09-18/reference-profile.ttl').then(r=>r.text()),fetch('./vendor/danja-jigdaw-signing-2026-09-18/reference-provenance.ttl').then(r=>r.text())]);
  const profileIri='https://example.org/plugins/reference/',expected=/jig:canonicalDigest\s+"([^"]+)"/.exec(prov)?.[1]||null,actual=await canonicalDigest(profile,profileIri);
  return {ok:actual===expected,expected,actual,specCommit:SPEC_COMMIT,factoidalCommit:FACTOIDAL_COMMIT,engine:await leanFactoidalStatus()};
}