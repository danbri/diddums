const $=s=>document.querySelector(s);
const enc=new TextEncoder();

function hex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function sha256(bytes){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));}
function u16(v,o,x){v.setUint16(o,x,true)} function u32(v,o,x){v.setUint32(o,x>>>0,true)}
const crcTable=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);t[i]=c>>>0;}return t})();
function crc32(bytes){let c=0xffffffff;for(const x of bytes)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function zipStore(entries){
  const locals=[],centrals=[];let offset=0;
  for(const e of entries){
    const name=enc.encode(e.name),body=e.bytes,crc=crc32(body),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
    u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x800);u16(lv,8,0);u16(lv,10,0);u16(lv,12,0x21);u32(lv,14,crc);u32(lv,18,body.length);u32(lv,22,body.length);u16(lv,26,name.length);u16(lv,28,0);local.set(name,30);
    locals.push(local,body);
    const cd=new Uint8Array(46+name.length),cv=new DataView(cd.buffer);
    u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x800);u16(cv,10,0);u16(cv,12,0);u16(cv,14,0x21);u32(cv,16,crc);u32(cv,20,body.length);u32(cv,24,body.length);u16(cv,28,name.length);u16(cv,30,0);u16(cv,32,0);u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);cd.set(name,46);centrals.push(cd);
    offset+=local.length+body.length;
  }
  const centralSize=centrals.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
  u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);u16(ev,8,entries.length);u16(ev,10,entries.length);u32(ev,12,centralSize);u32(ev,16,offset);u16(ev,20,0);
  const total=offset+centralSize+end.length,out=new Uint8Array(total);let p=0;for(const x of [...locals,...centrals,end]){out.set(x,p);p+=x.length;}return out;
}
async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let next=0;
  async function worker(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i);}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out;
}
async function build(){
  const btn=$('#build'),status=$('#status'),log=$('#log'),progress=$('#progress');btn.disabled=true;log.textContent='';
  try{
    const [mr,or]=await Promise.all([fetch('project-export-v75.json',{cache:'no-store'}),fetch('project-export-v75-overrides.json',{cache:'no-store'})]);if(!mr.ok)throw new Error('Manifest HTTP '+mr.status);if(!or.ok)throw new Error('Overrides HTTP '+or.status);const manifest=await mr.json(),overrides=(await or.json()).files||{};
    const files=manifest.files;let done=0,total=files.reduce((n,x)=>n+x.size,0),read=0;
    status.textContent='Fetching and verifying '+files.length+' v75 files…';progress.max=files.length;progress.value=0;
    const entries=await mapLimit(files,6,async rec=>{
      let bytes;const ov=overrides[rec.path];if(ov){if(ov.sha256!==rec.sha256)throw new Error(rec.path+' override hash does not match frozen manifest');bytes=enc.encode(ov.text);}else{const url=new URL(rec.path.replace(/^public\//,''),document.baseURI).href;const r=await fetch(url,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error(rec.path+' HTTP '+r.status);bytes=new Uint8Array(await r.arrayBuffer());}const h=await sha256(bytes.buffer);if(h!==rec.sha256)throw new Error(rec.path+' SHA-256 mismatch: expected '+rec.sha256+' got '+h);if(bytes.length!==rec.size)throw new Error(rec.path+' size mismatch: expected '+rec.size+' got '+bytes.length);
      done++;read+=bytes.length;progress.value=done;status.textContent='Verified '+done+' / '+files.length+' · '+(read/1048576).toFixed(1)+' / '+(total/1048576).toFixed(1)+' MiB';return{name:rec.path,bytes};
    });
    const exportManifest=enc.encode(JSON.stringify({...manifest,exported_at:new Date().toISOString(),zip_entry_count:files.length+2},null,2));
    const readme=enc.encode([
      'JigDAW / Audio Circuit Wasm — complete Hatchable deployment v75',
      '',
      'This ZIP contains all '+files.length+' deployed project files from Hatchable deployment v75, byte-for-byte verified against the frozen deployment SHA-256 manifest.',
      'Project: proj_lc2wvinjxetn / audio-circuit-wasm',
      'Original deployed payload: '+total+' bytes',
      '',
      'Paths are preserved as project-relative paths (public/...).',
      'There were no API functions/pages/migrations in v75.',
      'AGENTS.md is a Hatchable-generated virtual guidance file, not a stored/deployed project file, so it is not part of the v75 deployment payload.',
      '',
      'Additional archive metadata:',
      '  PROJECT-EXPORT-MANIFEST.json — frozen v75 file hashes/sizes',
      '  README-EXPORT.txt — this file',
      '',
      'Proof-audio material included:',
      '  public/audio-proof.js',
      '  public/proof-verifier.html / .js',
      '  public/proof-renderers/*',
      '  public/proof-evidence/factorymonday-v74.json',
      '  public/lean/* including JigScore.lean and native LeanDSP evidence/catalog',
      '',
      'The ZIP itself uses STORE (no compression) so the archived bytes are not transformed.',
      ''
    ].join('\n'));
    entries.push({name:'PROJECT-EXPORT-MANIFEST.json',bytes:exportManifest},{name:'README-EXPORT.txt',bytes:readme});
    status.textContent='Writing deterministic ZIP…';const zip=zipStore(entries),zipHash=await sha256(zip.buffer);
    log.textContent='ZIP SHA-256  '+zipHash+'\nZIP bytes    '+zip.length.toLocaleString()+'\nEntries      '+entries.length+'\nVerified     '+files.length+' / '+files.length;
    const url=URL.createObjectURL(new Blob([zip],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download='jigdaw-audio-circuit-wasm-v75-complete.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='Complete ZIP built and download started.';btn.textContent='Build again';
  }catch(e){status.textContent='Export failed';log.textContent=e.message;throw e;}finally{btn.disabled=false;}
}
$('#build').onclick=()=>build().catch(console.error);if(new URLSearchParams(location.search).get('download')==='1')setTimeout(()=>build().catch(console.error),120);