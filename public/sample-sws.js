import {compileLeanDSP} from './leandsp.js';
import {openInBrowserLean,browserLeanEvidence} from './browser-lean.js';
import {makeSwsProof,downloadBytes,downloadText,canonicalJson} from './audio-proof.js';
const BASE='https://danbri.github.io/glitchcan-minigam/magpie/splatweb/media/critter-voices/';
export const TRACKED_SINE_SOURCE=`dsp TrackedSine where
  param freq : Hz @control := 440.0 range 40.0 8000.0
  param amp : Gain @control := 0.10 range 0.0 1.0
  state phase : F32 := 0.0
  sample x =>
    let next := fract(phase + freq / sr)
    let y := sinpi(next * 2.0) * amp
    set phase := next
    return y`;
let trackedKernelPromise=null;
const MANIFEST=BASE+'manifest.json';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rms=a=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*a[i];return Math.sqrt(s/Math.max(1,a.length));};
const peak=a=>{let p=0;for(let i=0;i<a.length;i++)p=Math.max(p,Math.abs(a[i]));return p;};
const hex=buf=>[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sha256(bytes){const b=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);return hex(await crypto.subtle.digest('SHA-256',b));}
export function mono(buffer){const n=buffer.length,out=new Float32Array(n);for(let ch=0;ch<buffer.numberOfChannels;ch++){const a=buffer.getChannelData(ch);for(let i=0;i<n;i++)out[i]+=a[i]/buffer.numberOfChannels;}return out;}
function normalise(a,target=.105,maxGain=8,peakCeil=.88){const inRms=rms(a),inPeak=peak(a),g=inRms>1e-8?Math.min(maxGain,target/inRms,peakCeil/Math.max(inPeak,1e-8)):1,out=new Float32Array(a.length);for(let i=0;i<a.length;i++)out[i]=a[i]*g;return{data:out,gain:g,inputRms:inRms,inputPeak:inPeak,outputRms:rms(out),peak:peak(out)};}
function median(xs){if(!xs.length)return 0;const a=xs.slice().sort((x,y)=>x-y),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function candidates(lo,hi,step){const a=[];for(let f=lo;f<=hi;f+=step)a.push(f);return a;}
const BANDS=[candidates(220,1050,35),candidates(700,2550,55),candidates(1700,4050,85)];
export function analyseRidges(samples,sr){
 const N=384,hop=192,win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=.5-.5*Math.cos(2*Math.PI*i/(N-1));
 const defs=BANDS.map(fs=>fs.map(f=>({f,coeff:2*Math.cos(2*Math.PI*f/sr)}))),frames=[],prev=[500,1500,2600],ampSmooth=[0,0,0];
 const temp=new Float32Array(N);
 for(let start=0;start<samples.length;start+=hop){
   let e=0;
   for(let n=0;n<N;n++){const i=start+n,x=i<samples.length?samples[i]:0,x0=x-.96*(i>0?samples[i-1]:0),v=x0*win[n];temp[n]=v;e+=v*v;}
   e=Math.sqrt(e/N);
   const f=[],a=[];
   for(let band=0;band<defs.length;band++){
     let best=null,bestScore=-Infinity,bestPow=0;
     for(const d of defs[band]){
       let s1=0,s2=0;
       for(let n=0;n<N;n++){const s0=temp[n]+d.coeff*s1-s2;s2=s1;s1=s0;}
       const power=Math.max(0,s1*s1+s2*s2-d.coeff*s1*s2);
       const continuity=Math.abs(Math.log2(d.f/prev[band]));
       const score=Math.log(power+1e-12)-continuity*.42;
       if(score>bestScore){bestScore=score;best=d.f;bestPow=power;}
     }
     const raw=best||prev[band],freq=e<.00035?prev[band]:prev[band]*.58+raw*.42;
     prev[band]=freq;
     const rawAmp=e<.00018?0:Math.sqrt(bestPow)/N;
     ampSmooth[band]=ampSmooth[band]*.54+rawAmp*.46;
     f.push(freq);a.push(ampSmooth[band]);
   }
   frames.push({at:start,f,a,energy:e});
 }
 return{frames,N,hop,sampleRate:sr,method:'three smoothed Goertzel spectral ridges with pre-emphasis',bands:[[220,1050],[700,2550],[1700,4050]]};
}
function synthesizeReference(analysis,length){const {frames,hop,sampleRate:sr}=analysis,out=new Float32Array(length),phase=[0,0,0];if(!frames.length)return out;for(let i=0;i<length;i++){const q=i/hop,j=Math.min(frames.length-1,Math.floor(q)),k=Math.min(frames.length-1,j+1),u=clamp(q-j,0,1),A=frames[j],B=frames[k];let y=0;for(let b=0;b<3;b++){const f=A.f[b]+(B.f[b]-A.f[b])*u,a=A.a[b]+(B.a[b]-A.a[b])*u;phase[b]+=2*Math.PI*f/sr;if(phase[b]>2*Math.PI)phase[b]-=2*Math.PI;y+=Math.sin(phase[b])*a;}out[i]=y;}const fade=Math.max(1,Math.round(sr*.008));for(let i=0;i<Math.min(fade,out.length);i++){const g=i/fade;out[i]*=g;out[out.length-1-i]*=g;}return out;}
function similarity(a,b){const n=Math.min(a.length,b.length);let ab=0,aa=0,bb=0,err=0;for(let i=0;i<n;i++){ab+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];const d=a[i]-b[i];err+=d*d;}return{correlation:ab/Math.sqrt(Math.max(1e-20,aa*bb)),rmsError:Math.sqrt(err/Math.max(1,n)),referenceRms:Math.sqrt(bb/Math.max(1,n))};}
async function trackedKernel(){if(trackedKernelPromise)return trackedKernelPromise;trackedKernelPromise=(async()=>{if(typeof globalThis.WabtModule!=='function')throw new Error('WABT assembler unavailable');const checked=compileLeanDSP(TRACKED_SINE_SOURCE,{debug:true}),wabt=await globalThis.WabtModule(),mod=wabt.parseWat('TrackedSine.wat',checked.wat,{multi_value:true,bulk_memory:true,simd:true});mod.resolveNames();mod.validate();const{buffer}=mod.toBinary({log:false,write_debug_names:true});mod.destroy?.();const bytes=new Uint8Array(buffer);new WebAssembly.Module(bytes);return{checked,bytes,module:new WebAssembly.Module(bytes),hash:await sha256(bytes)};})();return trackedKernelPromise;}
async function synthesizeLeanDSP(analysis,length){
 const kernel=await trackedKernel(),{frames,hop,sampleRate:sr}=analysis,out=new Float32Array(length);if(!frames.length)return{data:out,kernel};
 const voices=Array.from({length:3},()=>{const inst=new WebAssembly.Instance(kernel.module,{});inst.exports.prepare(sr);inst.exports.reset();return{inst,out:new Float32Array(inst.exports.memory.buffer,4096,128)};});
 const block=4;
 for(let at=0;at<length;at+=block){const n=Math.min(block,length-at),q=(at+n*.5)/hop,j=Math.min(frames.length-1,Math.floor(q)),k=Math.min(frames.length-1,j+1),u=clamp(q-j,0,1),A=frames[j],B=frames[k];
   for(let b=0;b<3;b++){const freq=A.f[b]+(B.f[b]-A.f[b])*u,amp=clamp(A.a[b]+(B.a[b]-A.a[b])*u,0,1),v=voices[b];v.inst.exports.process(0,4096,n,freq,amp,0,0);for(let i=0;i<n;i++)out[at+i]+=v.out[i];}
 }
 const fade=Math.max(1,Math.round(sr*.008));for(let i=0;i<Math.min(fade,out.length);i++){const g=i/fade;out[i]*=g;out[out.length-1-i]*=g;}
 return{data:out,kernel};
}
function waveform(canvas,a,stroke='#7ce3dd'){
 const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(120,canvas.clientWidth),h=canvas.clientHeight||56;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.strokeStyle='#223b4f';c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();if(!a?.length)return;c.strokeStyle=stroke;c.lineWidth=1.4;c.beginPath();const step=Math.max(1,Math.floor(a.length/w));for(let x=0;x<w;x++){let lo=1,hi=-1;for(let i=x*step;i<Math.min(a.length,(x+1)*step);i++){lo=Math.min(lo,a[i]);hi=Math.max(hi,a[i]);}const y1=h/2-hi*h*.46,y2=h/2-lo*h*.46;c.moveTo(x,y1);c.lineTo(x,y2);}c.stroke();
}
function utterances(m){return[
 ...m.lines.map((text,i)=>({kind:'l',i,text,group:'Chatter'})),
 ...m.throws.map((text,i)=>({kind:'t',i,text,group:'Thrown'})),
 ...m.lands.map((text,i)=>({kind:'d',i,text,group:'Landing'})),
 ...m.toki.map((text,i)=>({kind:'k',i,text,group:'Toki Pona'}))
];}
export class SampleSwsLab{
 constructor(host,{getAudioContext,onStatus,getLevel}={}){Object.assign(this,{host,getAudioContext,onStatus,getLevel});this.manifest=null;this.sourceNode=null;this.gain=null;this.raf=0;this.prepared=null;this.load();}
 async load(){this.host.innerHTML='<section class="sample-sws-card"><div class="sample-sws-heading"><span class="eyebrow">SAMPLE-DRIVEN SINE-WAVE SPEECH</span><h2>Hear it twice.</h2><p>Bar 2 is a sine-only transformation. Bar 3 reveals the original speech. Bar 4 replays the <b>same SWS samples</b>, not a regenerated approximation.</p></div><p class="sample-sws-status">Loading the critter voice corpus…</p></section>';try{const r=await fetch(MANIFEST,{mode:'cors'});if(!r.ok)throw new Error('Voice manifest HTTP '+r.status);this.manifest=await r.json();this.render();}catch(e){this.host.querySelector('.sample-sws-status').textContent='Corpus unavailable: '+e.message;this.onStatus?.('Sample SWS corpus unavailable: '+e.message,true);}}
 render(){const m=this.manifest,uts=utterances(m),defaultU=Math.max(0,uts.findIndex(u=>u.kind==='l'&&u.i===2));this.host.innerHTML=`
 <section class="sample-sws-card">
  <div class="sample-sws-heading"><span class="eyebrow">SAMPLE-DRIVEN SINE-WAVE SPEECH</span><h2>SWS Priming Track</h2><p><b>SWS → original → identical SWS.</b> This isolates perceptual priming. The second sine rendering is byte-for-byte the same Float32 buffer as the first; only the listener has heard the clear source in between.</p></div>
  <div class="sample-sws-controls">
   <label>Voice <select data-sws-voice>${m.voices.map((v,i)=>`<option value="${i}">${esc(v)}</option>`).join('')}</select></label>
   <label>Utterance <select data-sws-utterance>${uts.map((u,i)=>`<option value="${i}"${i===defaultU?' selected':''}>${esc(u.group+' · '+u.text)}</option>`).join('')}</select></label>
   <label>Renderer <select data-sws-renderer><option value="lean">LeanDSP TrackedSine</option><option value="reference">JS reference · validated sound</option></select></label>
   <label class="sample-sws-loop"><input type="checkbox" data-sws-loop checked> Loop track</label>
   <button class="primary" data-sws-play>Analyse + play</button><button data-sws-stop>Stop</button><button data-sws-proof disabled>Export proof WAV</button><a class="sample-sws-verify" href="proof-verifier.html" target="_blank" rel="noopener">Verify proof ↗</a><button data-sws-lean>TrackedSine in Lean/Wasm ↗</button>
  </div>
  <div class="sample-sws-bars" aria-label="Four-bar sine-wave speech priming track">
   <article data-sws-bar="0"><b>1 · ready</b><span>silence</span><canvas></canvas></article>
   <article data-sws-bar="1"><b>2 · cryptic</b><span>sine-wave transform</span><canvas></canvas></article>
   <article data-sws-bar="2"><b>3 · reveal</b><span>original speech</span><canvas></canvas></article>
   <article data-sws-bar="3"><b>4 · hear again</b><span>identical sine buffer</span><canvas></canvas></article>
  </div>
  <div class="sample-sws-evidence"><p data-sws-status>Choose a sample and press Analyse + play.</p><dl><div><dt>Source</dt><dd data-sws-source>—</dd></div><div><dt>SWS buffer SHA-256</dt><dd data-sws-hash>—</dd></div><div><dt>Analysis</dt><dd data-sws-analysis>—</dd></div><div><dt>TrackedSine kernel</dt><dd data-sws-kernel>not compiled yet</dd></div><div><dt>LeanDSP ↔ reference</dt><dd data-sws-compare>not rendered yet</dd></div><div><dt>Levels</dt><dd data-sws-level>—</dd></div></dl></div>
  <p class="sample-sws-boundary"><b>Trust boundary:</b> each of the three sinusoidal ridges is now rendered by the <code>TrackedSine</code> LeanDSP source above, dynamically lowered in-browser to WAT/Wasm and hash-recorded. <b>That dynamic lowering is still the legacy JS draft compiler, not the pinned Lean proof path.</b> “Open in Lean/Wasm” sends the exact JigDAW <code>Build.lean</code> plus this declaration to a real client-side Lean 4 kernel (currently 4.33-pre), but the release certificate remains the pinned native Lean 4.34 build. MP3 decoding and ridge extraction remain host analysis outside LeanDSP.</p>
 </section>`;
 this.voice=this.host.querySelector('[data-sws-voice]');this.utt=this.host.querySelector('[data-sws-utterance]');this.renderer=this.host.querySelector('[data-sws-renderer]');this.loop=this.host.querySelector('[data-sws-loop]');this.status=this.host.querySelector('[data-sws-status]');this.host.querySelector('[data-sws-play]').onclick=()=>this.prepareAndPlay().catch(e=>{this.status.textContent=e.message;this.onStatus?.(e.message,true);});this.host.querySelector('[data-sws-stop]').onclick=()=>this.stop();this.host.querySelector('[data-sws-proof]').onclick=()=>this.exportProof().catch(e=>this.onStatus?.(e.message,true));this.host.querySelector('[data-sws-lean]').onclick=async()=>{try{await openInBrowserLean(TRACKED_SINE_SOURCE,{name:'TrackedSine'});this.onStatus?.('Opened TrackedSine inside the client-side Lean/Wasm build · '+browserLeanEvidence.reportedLean+' dynamic checker; pinned release remains Lean 4.34.0.');}catch(e){this.onStatus?.(e.message,true);}};this.loop.onchange=()=>{if(this.sourceNode)this.sourceNode.loop=this.loop.checked;};
 }
 selected(){const u=utterances(this.manifest)[Number(this.utt.value)||0],vi=Number(this.voice.value)||0;return{...u,vi,voice:this.manifest.voices[vi],url:BASE+`v${vi}-${u.kind}${u.i}.mp3`};}
 async prepareAndPlay(){this.stop();const sel=this.selected(),renderer=this.renderer?.value||'lean';this.status.textContent='Fetching and analysing “'+sel.text+'”…';this.onStatus?.('Analysing sample-driven sine-wave speech…');const ctx=await this.getAudioContext?.();if(!ctx)throw new Error('AudioContext unavailable');const resp=await fetch(sel.url,{mode:'cors'});if(!resp.ok)throw new Error('Voice clip HTTP '+resp.status);const bytes=await resp.arrayBuffer(),sourceHash=await sha256(bytes),decoded=await ctx.decodeAudioData(bytes.slice(0)),src=mono(decoded),analysis=analyseRidges(src,decoded.sampleRate),rendered=await synthesizeLeanDSP(analysis,src.length),referenceRaw=synthesizeReference(analysis,src.length),sourceNorm=normalise(src,.095,8),leanNorm=normalise(rendered.data,sourceNorm.outputRms,96),referenceNorm=normalise(referenceRaw,sourceNorm.outputRms,96),comparison=similarity(leanNorm.data,referenceNorm.data),sws=renderer==='reference'?referenceNorm.data:leanNorm.data,chosenNorm=renderer==='reference'?referenceNorm:leanNorm,clear=sourceNorm.data,swsHash=await sha256(new Uint8Array(sws.buffer)),leanHash=await sha256(new Uint8Array(leanNorm.data.buffer)),referenceHash=await sha256(new Uint8Array(referenceNorm.data.buffer));const pad=Math.round(decoded.sampleRate*.14),barFrames=Math.max(src.length+pad,Math.round(decoded.sampleRate*.75)),total=barFrames*4,composite=ctx.createBuffer(1,total,decoded.sampleRate),dst=composite.getChannelData(0);dst.set(sws,barFrames);dst.set(clear,barFrames*2);dst.set(sws,barFrames*3);
 this.prepared={sel,renderer,sourceHash,swsHash,leanHash,referenceHash,comparison,decoded,decodedMono:src,source:clear,sws,analysis,barFrames,total,sampleRate:decoded.sampleRate,composite,sourceRms:sourceNorm.outputRms,swsRms:chosenNorm.outputRms,sourceGain:sourceNorm.gain,swsGain:chosenNorm.gain,kernel:{source:TRACKED_SINE_SOURCE,wasmSha256:rendered.kernel.hash,compiler:'LeanDSP JS draft lowering → WABT → Wasm',browserLean:browserLeanEvidence}};this.renderEvidence();this.host.querySelector('[data-sws-proof]').disabled=false;this.start(ctx); }
 start(ctx){if(!this.prepared)return;this.stop();const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=this.prepared.composite;s.loop=!!this.loop.checked;g.gain.value=clamp(Number(this.getLevel?.()??.58),0,1);s.connect(g).connect(ctx.destination);s.onended=()=>{if(this.sourceNode===s){this.sourceNode=null;this.paintBar(-1);}};this.sourceNode=s;this.gain=g;this.startedAt=ctx.currentTime;s.start();this.status.textContent='Playing · bar 2 and bar 4 share SHA-256 '+this.prepared.swsHash.slice(0,12)+'…';this.onStatus?.('Sample SWS priming loop playing');const tick=()=>{if(this.sourceNode!==s)return;const elapsed=(ctx.currentTime-this.startedAt)*this.prepared.sampleRate,frame=s.loop?elapsed%this.prepared.total:elapsed,bar=frame>=this.prepared.total?-1:Math.floor(frame/this.prepared.barFrames);this.paintBar(bar);this.raf=requestAnimationFrame(tick);};tick();}
 stop(){if(this.sourceNode){try{this.sourceNode.stop()}catch{}try{this.sourceNode.disconnect()}catch{}this.sourceNode=null;}if(this.gain){try{this.gain.disconnect()}catch{}this.gain=null;}if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.paintBar(-1);}
 setLevel(v){if(this.gain)this.gain.gain.value=clamp(Number(v)||0,0,1);}
 async exportProof(){if(!this.prepared)throw new Error('Analyse a sample before exporting proof.');this.status.textContent='Building proof certificate…';const proof=await makeSwsProof(this.prepared,{masterGain:Number(this.getLevel?.()??1)}),base=proof.filename+'-diddums';downloadBytes(base+'.proof.wav',proof.wav,'audio/wav');downloadText(base+'.diddums-proof.json',canonicalJson(proof.envelope),'application/json');this.status.textContent='Proof WAV + sidecar exported · '+proof.envelope.payloadSha256.slice(0,16)+'…';this.onStatus?.('Proof-carrying WAV exported · certificate '+proof.envelope.payloadSha256.slice(0,16)+'…');}
 paintBar(n){for(const e of this.host.querySelectorAll?.('[data-sws-bar]')||[])e.classList.toggle('active',Number(e.dataset.swsBar)===n);}
 renderEvidence(){const p=this.prepared;if(!p)return;const fs=p.analysis.frames,med=[0,1,2].map(i=>median(fs.filter(f=>f.energy>.0003).map(f=>f.f[i])));this.host.querySelector('[data-sws-source]').innerHTML=`<a href="${esc(p.sel.url)}" target="_blank" rel="noopener">${esc(p.sel.voice+' · '+p.sel.text)}</a><small> MP3 SHA-256 ${p.sourceHash.slice(0,16)}…</small>`;this.host.querySelector('[data-sws-hash]').textContent=p.swsHash+' · bars 2 and 4';this.host.querySelector('[data-sws-analysis]').textContent=`${p.analysis.method} · median ridges ${med.map(x=>Math.round(x)+' Hz').join(' / ')} · ${fs.length} frames`;this.host.querySelector('[data-sws-kernel]').textContent=`TrackedSine · Wasm SHA-256 ${p.kernel.wasmSha256} · ${p.kernel.compiler}`;this.host.querySelector('[data-sws-compare]').textContent=`${p.renderer==='lean'?'playing LeanDSP':'playing JS reference'} · corr ${p.comparison.correlation.toFixed(5)} · RMS error ${p.comparison.rmsError.toFixed(5)} · Lean ${p.leanHash.slice(0,12)}… / ref ${p.referenceHash.slice(0,12)}…`;this.host.querySelector('[data-sws-level]').textContent=`source RMS ${p.sourceRms.toFixed(3)} ×${p.sourceGain.toFixed(2)} · SWS RMS ${p.swsRms.toFixed(3)} ×${p.swsGain.toFixed(2)}`;const bars=[null,p.sws,p.source,p.sws];this.host.querySelectorAll('[data-sws-bar]').forEach((e,i)=>{const c=e.querySelector('canvas');waveform(c,bars[i],i===2?'#edbc74':'#7ce3dd');if(i===1||i===3){e.dataset.bufferHash=p.swsHash;e.title='Identical SWS Float32 buffer SHA-256 '+p.swsHash;}});}
 diagnostics(){const p=this.prepared;return{schema:'diddums-sample-sws/1',playing:!!this.sourceNode,loop:!!this.loop?.checked,selection:p?{voice:p.sel.voice,text:p.sel.text,url:p.sel.url}:null,renderer:p?.renderer||this.renderer?.value||'lean',sourceSha256:p?.sourceHash||null,swsSha256:p?.swsHash||null,leanSwsSha256:p?.leanHash||null,referenceSwsSha256:p?.referenceHash||null,renderComparison:p?.comparison||null,bars2And4Identical:!!p,analysis:p?{method:p.analysis.method,frames:p.analysis.frames.length,bands:p.analysis.bands}:null,kernel:p?.kernel||{source:TRACKED_SINE_SOURCE,wasmSha256:null,compiler:'not compiled yet',browserLean:browserLeanEvidence},proofBoundary:'TrackedSine source is LeanDSP; hot lowering is JS/WABT draft path; optional client-side Lean/Wasm 4.33-pre check is not the pinned native Lean 4.34 release certificate; ridge extraction remains host code'};}
}