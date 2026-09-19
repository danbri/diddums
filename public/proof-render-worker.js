let RegisteredProcessor=null;
let workletMessages=[];
class ShimPort{
  constructor(){this.onmessage=null;}
  postMessage(message){if(message?.type==='error')workletMessages.push({type:'error',message:message.message,stack:message.stack||''});}
}
self.AudioWorkletProcessor=class{constructor(){this.port=new ShimPort();}};
self.registerProcessor=(name,ctor)=>{if(name!=='jigdaw-studio')throw new Error('Unexpected processor '+name);RegisteredProcessor=ctor;};

function copyBlock(dst,offset,src,n){dst.set(src.subarray(0,n),offset);}

self.onmessage=async({data})=>{
  if(data?.type!=='render')return;
  const started=performance.now();
  try{
    const sr=Number(data.sampleRate)||48000;
    if(!(sr>=8000&&sr<=192000))throw new Error('Invalid proof-render sample rate');
    self.sampleRate=sr;
    self.currentFrame=0;
    workletMessages=[];
    importScripts(data.rendererUrl);
    if(!RegisteredProcessor)throw new Error('Archived renderer did not register jigdaw-studio');
    const p=new RegisteredProcessor();
    const session=data.session;
    const modules=(data.modules||[]).map(m=>({...m,bytes:m.bytes instanceof Uint8Array?m.bytes:new Uint8Array(m.bytes)}));
    p.port.onmessage({data:{type:'load',session,modules,generation:1,play:true}});
    // These methods are observational only: they update UI telemetry/event logs and never feed audio state.
    // Headless proof rendering disables them for speed; the audio scheduler/mixer/effects and Wasm DSP are unchanged.
    p.capture=()=>{};p.captureTrace=()=>{};p.probe=()=>{};p.sendTelemetry=()=>{};p.logEvent=()=>{};p.flushEventLog=()=>{};
    if(Number.isFinite(Number(data.master)))p.port.onmessage({data:{type:'control',id:'out',key:'level',value:Number(data.master)}});
    const frames=Math.max(1,Math.floor(session.durationFrames+session.tailFrames));
    const left=new Float32Array(frames),right=new Float32Array(frames);
    let at=0,lastProgress=-1;
    while(at<frames){
      const n=Math.min(128,frames-at);
      self.currentFrame=at;
      const l=new Float32Array(128),r=new Float32Array(128);
      const ok=p.process([],[[l,r]]);
      if(ok!==true)throw new Error('Renderer returned false');
      copyBlock(left,at,l,n);copyBlock(right,at,r,n);
      at+=n;
      const pct=Math.floor(at/frames*100);
      if(pct>=lastProgress+5){lastProgress=pct;self.postMessage({type:'progress',percent:pct});}
    }
    const errors=workletMessages.filter(x=>x.type==='error');
    if(errors.length)throw new Error('Renderer error: '+errors.map(e=>e.message).join('; '));
    self.postMessage({type:'done',frames,sampleRate:sr,nonFinite:p.nonFinite||0,elapsedMs:Math.round(performance.now()-started),left:left.buffer,right:right.buffer},[left.buffer,right.buffer]);
  }catch(e){
    self.postMessage({type:'error',message:e?.message||String(e),stack:String(e?.stack||'')});
  }
};