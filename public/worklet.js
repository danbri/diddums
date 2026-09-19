function topo(g){
  const inc=Object.fromEntries(g.nodes.map(n=>[n.id,0])),next=Object.fromEntries(g.nodes.map(n=>[n.id,[]]));
  g.edges.forEach(e=>{inc[e.to]++;(next[e.from]??=[]).push(e.to)});const q=g.nodes.filter(n=>inc[n.id]===0).map(n=>n.id),out=[];
  while(q.length){const id=q.shift();out.push(id);for(const to of next[id]||[])if(--inc[to]===0)q.push(to)}return out;
}
const db=x=>Math.pow(10,x/20),clamp=(x,a=-1,b=1)=>Math.max(a,Math.min(b,x));
const TAU=Math.PI*2;
const rmsBlock=a=>{let s=0;for(let i=0;i<a.length;i++){const v=a[i]||0;s+=v*v}return Math.sqrt(s/Math.max(1,a.length))};
const rmsStereo=(a,b)=>{let s=0,n=Math.max(a.length,b.length,1);for(let i=0;i<n;i++){const x=a[i]||0,y=b[i]||0;s+=(x*x+y*y)*.5}return Math.sqrt(s/n)};
const SONGS={
  lowlight:{title:'Low-Light / Long Form',bpm:92,bars:48,roots:[36,36,39,34,36,43,39,34],sections:[['ARRIVAL',0,8,.30],['MACHINERY',8,16,.52],['BLOOM',16,24,.72],['EMPTY ROOM',24,32,.46],['NIGHT DRIVE',32,40,.90],['DISSOLVE',40,48,.28]],bass:[0,null,0,null,3,null,5,null,0,null,7,null,5,null,3,null],motif:[12,null,15,null,19,null,17,null,12,null,22,null,19,null,15,null]},
  glass:{title:'Glass Transit',bpm:118,bars:40,roots:[45,48,52,43,45,55,52,48],sections:[['IGNITION',0,8,.38],['GRID',8,16,.66],['OPEN SKY',16,24,.82],['HALF LIGHT',24,32,.58],['RETURN',32,40,.88]],bass:[0,null,7,0,null,3,null,5,0,null,10,null,7,null,5,null],motif:[12,19,24,null,22,19,15,null,12,15,19,22,24,null,19,null]},
  dub:{title:'Dub Nocturne',bpm:78,bars:44,roots:[34,34,41,39,34,46,41,39],sections:[['FOG',0,8,.24],['BASSLINE',8,16,.50],['SPACE',16,24,.70],['CUT',24,28,.34],['PRESSURE',28,36,.82],['FADE',36,44,.25]],bass:[0,null,null,0,null,5,null,null,0,null,7,null,null,3,null,null],motif:[12,null,null,null,15,null,19,null,null,null,17,null,15,null,null,null]}
};
const midiHz=n=>440*Math.pow(2,(n-69)/12);
class CircuitEngine extends AudioWorkletProcessor{
  constructor(opts){
    super();this.graph=opts.processorOptions.graph;this.states=new Map();this.tick=0;this.wasmBank=new Map();this.mode='graph';this.debugSchemas=new Map();this.debugSelected=new Map();this.debugAliases=new Map();this.debugEnergy=new Map();this.debugCounters=new Map();
    this.install(opts.processorOptions.wasmBytes,'','main');
    this.d909={playing:false,bpm:124,step:0,frame:0,nextStep:0,pattern:{},params:{},voices:{}};
    this.song={playing:false,id:'lowlight',frame:0,nextStep:0,step:0,bar:0,bassFreq:55,bassGate:0,padRoot:110,padGate:1,leadFreq:220,leadGate:0,texture:[.2,.5,.4,.25],energy:1,eventPulse:0,pool:Array.from({length:6},(_,i)=>({freq:220,gate:0,hold:0,age:i}))};
    this.songFx={dl:new Float32Array(48000),dr:new Float32Array(48000),idx:0,duck:0};
    this.zeroBlock=new Float32Array(128);
    this.pseq={playing:false,bpm:118,swing:0,depth:.78,step:0,frame:0,nextStep:0,level:1,env:1,pattern:[2,0,1,0,1,0,1,0,2,0,1,0,1,0,1,0]};
    this.port.onmessage=({data})=>{
      if(data.type==='graph')this.graph=data.graph;
      if(data.type==='param'){const n=this.graph?.nodes?.find(x=>x.id===data.node);if(n)n.props[data.key]=data.value;}
      if(data.type==='wasm')this.install(data.bytes,data.hash,data.key||'main');
      if(data.type==='debug-schema'){this.debugSchemas.set(data.key||'main',data.schema||null);if(data.schema?.probes?.length&&!this.debugSelected.get(data.key||'main'))this.debugSelected.set(data.key||'main',data.schema.probes.find(p=>p.name==='out')?.name||data.schema.probes[0].name);}
      if(data.type==='debug-select')this.debugSelected.set(data.key||'main',data.name||'out');
      if(data.type==='mode')this.mode=data.mode||'graph';
      if(data.type==='909-config'){Object.assign(this.d909,{bpm:data.bpm||this.d909.bpm,pattern:data.pattern||this.d909.pattern,playing:data.playing??this.d909.playing});this.d909.params={...this.d909.params,...(data.params||{})};}
      if(data.type==='909-param')this.d909.params[data.symbol]=Number(data.value);
      if(data.type==='909-play'){this.d909.playing=!!data.playing;if(data.reset){this.d909.step=0;this.d909.frame=0;this.d909.nextStep=0;}}
      if(data.type==='909-trigger')this.trigger909(data.voice,Number(data.velocity||1));
      if(data.type==='song-config'){
        if(data.id&&SONGS[data.id])this.song.id=data.id;
        if(Number.isFinite(data.energy))this.song.energy=Math.max(.2,Math.min(1.4,Number(data.energy)));
        if(data.reset){this.song.frame=0;this.song.nextStep=0;this.song.step=0;this.song.bar=0;this.song.eventPulse=0;for(const v of this.song.pool){v.gate=0;v.hold=0;v.age=0}this.songFx.idx=0;this.songFx.duck=0;this.songFx.dl.fill(0);this.songFx.dr.fill(0);}
        if(data.playing!=null)this.song.playing=!!data.playing;
      }
      if(data.type==='song-play'){this.song.playing=!!data.playing;if(data.reset){this.song.frame=0;this.song.nextStep=0;this.song.step=0;this.song.bar=0;}}
    };
    this.port.postMessage({type:'ready',nodes:this.graph?.nodes?.length||0,wasm:this.wasmBank.has('main')});
  }
  install(bytes,hash='',key='main'){
    if(!bytes)return;
    try{
      const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),mod=new WebAssembly.Module(view),inst=new WebAssembly.Instance(mod,{});
      if(!(inst.exports.memory instanceof WebAssembly.Memory))throw new Error('module must export memory');if(typeof inst.exports.process!=='function')throw new Error('module must export process');
      if(typeof inst.exports.prepare==='function')inst.exports.prepare(sampleRate);if(typeof inst.exports.reset==='function')inst.exports.reset();
      this.wasmBank.set(key,{inst,hash});this.port.postMessage({type:'wasm-installed',hash,key});
    }catch(e){this.port.postMessage({type:'error',message:'Wasm install failed: '+e.message});}
  }
  wasmProcess(key,x,p0=0,p1=0,p2=0,p3=0){
    const w=this.wasmBank.get(key);if(!w)return x;const n=x.length,b=new Float32Array(n),mem=w.inst.exports.memory,inPtr=0,outPtr=4096;
    new Float32Array(mem.buffer,inPtr,n).set(x);w.inst.exports.process(inPtr,outPtr,n,p0,p1,p2,p3);b.set(new Float32Array(mem.buffer,outPtr,n));this.maybeDebug(key,mem,n,[p0,p1,p2,p3]);return b;
  }
  maybeDebug(key,mem,n,params=[]){
    const logicalKey=/^songLead\d+$/.test(key)?'songLead':(this.debugAliases.get(key)||key),schema=this.debugSchemas.get(key)||this.debugSchemas.get(logicalKey);if(!schema?.probes?.length)return;
    if(logicalKey==='songLead'&&Number(params[1]||0)<=0.0001)return;
    const ctr=(this.debugCounters.get(key)||0)+1;this.debugCounters.set(key,ctr);if((ctr%6)!==0)return;
    const count=Math.min(n,schema.stride||256),values=[];let selectedTrace=null,selectedName=this.debugSelected.get(logicalKey)||this.debugSelected.get(key)||'out';
    for(const p of schema.probes){
      const base=schema.base+p.index*schema.stride*4,trace=new Float32Array(mem.buffer,base,count);let sum=0,peak=0,min=Infinity,max=-Infinity,last=trace[count-1]||0;
      for(let i=0;i<count;i++){const v=trace[i];sum+=v*v;const a=Math.abs(v);if(a>peak)peak=a;if(v<min)min=v;if(v>max)max=v}
      if(!Number.isFinite(min)){min=0;max=0}
      const rms=Math.sqrt(sum/Math.max(1,count)),ek=`${key}:${p.name}`,prev=this.debugEnergy.get(ek)??rms,beat=rms>Math.max(.000001,prev*1.8);this.debugEnergy.set(ek,prev*.92+rms*.08);
      values.push({name:p.name,type:p.type,last,rms,peak,min,max,beat});if(p.name===selectedName)selectedTrace=new Float32Array(trace);
    }
    const msg={type:'debug-values',key:logicalKey,instance:key,frame:currentFrame,values,selected:selectedName,trace:selectedTrace};if(selectedTrace)this.port.postMessage(msg,[selectedTrace.buffer]);else this.port.postMessage(msg);
  }
  inputsFor(id,buffers,n){const ins=this.graph.edges.filter(e=>e.to===id),x=new Float32Array(n);for(const e of ins){const b=buffers.get(e.from);if(b)for(let i=0;i<n;i++)x[i]+=b[i]}return x;}
  processGraph(outputs){
    const out=outputs[0];if(!out?.length)return true;const n=out[0].length,buffers=new Map(),byId=Object.fromEntries(this.graph.nodes.map(x=>[x.id,x]));
    for(const id of topo(this.graph)){
      const node=byId[id],p=node.props||{};let b;
      if(node.type==='Oscillator'){
        b=new Float32Array(n);let st=this.states.get(id)||{phase:0};const f=Number(p.frequency||110),step=TAU*f/sampleRate;
        for(let i=0;i<n;i++){b[i]=Math.sin(st.phase);st.phase+=step;if(st.phase>=TAU)st.phase-=TAU}this.states.set(id,st);
      }else if(node.type==='WasmFX'){
        b=this.wasmProcess('main',this.inputsFor(id,buffers,n),Number(p.param0??1),Number(p.param1??0),Number(p.param2??0),Number(p.param3??0));
      }else if(node.type==='Lowpass'){
        const x=this.inputsFor(id,buffers,n);b=new Float32Array(n);let st=this.states.get(id)||{z:0};const fc=Math.max(10,Math.min(sampleRate*.45,Number(p.cutoff||1000))),a=1-Math.exp(-TAU*fc/sampleRate);
        for(let i=0;i<n;i++){st.z+=a*(x[i]-st.z);b[i]=st.z}this.states.set(id,st);
      }else if(node.type==='Mixer'||node.type==='Output')b=this.inputsFor(id,buffers,n);else b=new Float32Array(n);buffers.set(id,b);
    }
    const outNode=this.graph.nodes.find(x=>x.type==='Output'),final=outNode?buffers.get(outNode.id):new Float32Array(n);let sum=0;
    for(let i=0;i<n;i++){const v=final?.[i]||0;sum+=v*v;for(const ch of out)ch[i]=v}if((++this.tick%10)===0)this.port.postMessage({type:'meter',rms:Math.sqrt(sum/n)});return true;
  }
  voice(name){
    return this.d909.voices[name]??={active:false,age:0,vel:1,phase:0,p2:0,hatPhases:new Float64Array(6),seed:(0x91e10da5^name.length*2654435761)>>>0,filters:{},choked:false,chokeAge:0};
  }
  resetVoiceState(s){s.age=0;s.phase=0;s.p2=0;s.hatPhases.fill(0);s.filters={};s.choked=false;s.chokeAge=0;}
  trigger909(name,vel=1){
    const s=this.voice(name);s.active=true;s.vel=vel;this.resetVoiceState(s);
    if(name==='ch'){const oh=this.voice('oh');if(oh.active){oh.choked=true;oh.chokeAge=0;}}
  }
  noise(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return(s.seed/2147483648)-1;}
  onePole(x,s,key,fc){const a=1-Math.exp(-TAU*Math.min(sampleRate*.45,Math.max(1,fc))/sampleRate),z=s.filters[key]??0,y=z+a*(x-z);s.filters[key]=y;return y;}
  onePoleHP(x,s,key,fc){return x-this.onePole(x,s,key,fc);}
  svf(x,s,key,fc,res){
    const q=Math.max(.08,Number(res)||.5),k=1/q,g=Math.tan(Math.PI*Math.min(sampleRate*.45,Math.max(5,fc))/sampleRate),a1=1/(1+g*(g+k)),a2=g*a1,a3=g*a2;
    const st=s.filters[key]??={ic1:0,ic2:0},v3=x-st.ic2,v1=a1*st.ic1+a2*v3,v2=st.ic2+a2*st.ic1+a3*v3;
    st.ic1=2*v1-st.ic1;st.ic2=2*v2-st.ic2;s.filters[key]=st;return{lp:v2,bp:v1,hp:x-k*v1-v2};
  }
  ad(t,attackMs,decayMs){const a=Math.max(0,attackMs)/1000,d=Math.max(.0001,decayMs/1000);if(a>0&&t<a)return t/a;return Math.exp(-(t-a)/d);}
  tri(phase){const p=phase/TAU-Math.floor(phase/TAU);return 1-4*Math.abs(p-.5);}
  advance(s,key,f){let p=s[key]||0;p+=TAU*f/sampleRate;if(p>=TAU)p-=TAU;s[key]=p;return p;}
  render909Voice(name,n){
    const b=new Float32Array(n),s=this.voice(name),p=this.d909.params;if(!s.active)return b;
    const dec=(sym,def)=>Math.max(1,Number(p[sym]??def));
    if(name==='bd'){
      for(let i=0;i<n;i++){const t=s.age+i/sampleRate,tune=Number(p.bd_tune??55),pitchEnv=this.ad(t,.2,20),freq=tune+(210-tune)*pitchEnv,amp=this.ad(t,1,dec('bd_decay',500));b[i]=this.tri(s.phase)*amp*s.vel;this.advance(s,'phase',freq);}
    }else if(name==='sd'){
      const noiseIn=new Float32Array(n),noiseEnv=new Float32Array(n);
      for(let i=0;i<n;i++){const t=s.age+i/sampleRate,toneEnv=this.ad(t,.2,dec('sd_tone_decay',250));b[i]=(Math.sin(s.phase)+Math.sin(s.p2))*.34*toneEnv*s.vel;this.advance(s,'phase',180);this.advance(s,'p2',200);noiseIn[i]=this.noise(s);noiseEnv[i]=this.ad(t,.1,dec('sd_snappy',80))*.72*s.vel;}
      const filtered=this.wasmBank.has('sdBpf')?this.wasmProcess('sdBpf',noiseIn,Number(p.sd_tone??2000),.5):noiseIn.map?.((x,i)=>this.svf(x,s,'sdBpf',Number(p.sd_tone??2000),.5).bp)??noiseIn;
      for(let i=0;i<n;i++)b[i]+=filtered[i]*noiseEnv[i];
    }else if(name==='rs'){
      const raw=new Float32Array(n),env=new Float32Array(n);for(let i=0;i<n;i++){const t=s.age+i/sampleRate;raw[i]=this.noise(s);env[i]=this.ad(t,.1,dec('rs_decay',20))*.7*s.vel;}
      const filtered=this.wasmBank.has('rsHpf')?this.wasmProcess('rsHpf',raw,1200):raw;for(let i=0;i<n;i++)b[i]=(filtered[i]??raw[i])*env[i];
    }else if(name==='cp'){
      const raw=new Float32Array(n),env=new Float32Array(n);for(let i=0;i<n;i++){const t=s.age+i/sampleRate;raw[i]=this.noise(s);env[i]=this.ad(t,.1,dec('cp_decay',80))*.8*s.vel;}
      const filtered=this.wasmBank.has('cpBpf')?this.wasmProcess('cpBpf',raw,1200,1.2):raw;for(let i=0;i<n;i++)b[i]=(filtered[i]??raw[i])*env[i];
    }else if(name==='lt'||name==='mt'||name==='ht'){
      for(let i=0;i<n;i++){const t=s.age+i/sampleRate,base=name==='lt'?70:name==='mt'?110:160,peak=name==='lt'?200:name==='mt'?300:420,pd=name==='lt'?20:name==='mt'?18:15,ringMs=name==='lt'?500:name==='mt'?350:250,freq=base+(peak-base)*this.ad(t,.2,pd),ring=Math.exp(-t/(ringMs/1000)),amp=this.ad(t,1,dec(`${name}_decay`,ringMs));b[i]=Math.sin(s.phase)*ring*amp*.9*s.vel;this.advance(s,'phase',freq);}
    }else if(name==='ch'||name==='oh'){
      const raw=new Float32Array(n),env=new Float32Array(n),fs=[562,834,1124,1395,1668,1995];
      for(let i=0;i<n;i++){const t=s.age+i/sampleRate;let z=0;for(let k=0;k<6;k++){let ph=s.hatPhases[k];z+=(Math.sin(ph)>=0?1:-1)/6;ph+=TAU*fs[k]/sampleRate;if(ph>=TAU)ph-=TAU;s.hatPhases[k]=ph;}raw[i]=z;let e=this.ad(t,.1,name==='ch'?dec('ch_decay',45):dec('oh_decay',500));if(name==='oh'&&s.choked){const ct=s.chokeAge+i/sampleRate;e*=Math.exp(-ct/.040);}env[i]=e*.78*s.vel;}
      const cutoff=name==='oh'?Number(p.oh_bright??7000):7000,key=name==='oh'?'ohHpf':'chHpf',filtered=this.wasmBank.has(key)?this.wasmProcess(key,raw,cutoff,.4):raw;for(let i=0;i<n;i++)b[i]=(filtered[i]??raw[i])*env[i];
    }
    s.age+=n/sampleRate;if(s.choked)s.chokeAge+=n/sampleRate;
    const maxD=name==='oh'?Math.max(.1,dec('oh_decay',500)/1000):name==='bd'?Math.max(.1,dec('bd_decay',500)/1000):name==='sd'?Math.max(.1,dec('sd_tone_decay',250)/1000):name==='cp'?Math.max(.05,dec('cp_decay',80)/1000):name==='rs'?Math.max(.02,dec('rs_decay',20)/1000):.8;
    if(s.age>Math.max(1,maxD*10)||(s.choked&&s.chokeAge>.35))s.active=false;return b;
  }
  mix909Voice(name,b,L,R){
    const p=this.d909.params,lev=Number(p[`${name}_level`]??(name==='bd'?0:name==='ch'||name==='oh'?-9:name.startsWith('l')||name.startsWith('m')||name.startsWith('h')?-3:-6)),pan=clamp(Number(p[`${name}_pan`]??0),-1,1),g=db(lev),gl=Math.sqrt((1-pan)*.5)*g,gr=Math.sqrt((1+pan)*.5)*g;
    for(let i=0;i<b.length;i++){L[i]+=b[i]*gl;R[i]+=b[i]*gr;}
  }
  process909(outputs){
    const out=outputs[0];if(!out?.length)return true;const n=out[0].length,L=new Float32Array(n),R=new Float32Array(n),d=this.d909;
    if(d.playing){
      const stepFrames=sampleRate*60/Math.max(20,d.bpm)/4;
      for(let off=0;off<n;off++)if(d.frame+off>=d.nextStep){for(const[voice,steps]of Object.entries(d.pattern||{}))if((steps||[]).includes(d.step))this.trigger909(voice,1);this.port.postMessage({type:'909-step',step:d.step});d.step=(d.step+1)%16;d.nextStep+=stepFrames;}
      d.frame+=n;
    }
    for(const name of['bd','sd','rs','cp','lt','mt','ht','ch','oh']){
      let b=this.render909Voice(name,n);
      if(name==='bd')b=this.wasmProcess('bdSat',b,Number(d.params.bd_drive??3),Number(d.params.bd_posVf??.25),Number(d.params.bd_negVf??.55),0);
      this.mix909Voice(name,b,L,R);
    }
    let sum=0;for(let i=0;i<n;i++){const l=L[i],r=R[i];out[0][i]=l;(out[1]||out[0])[i]=r;sum+=(l*l+r*r)*.5;}
    if((++this.tick%10)===0)this.port.postMessage({type:'meter',rms:Math.sqrt(sum/n)});return true;
  }
  songSection(spec,bar){
    return spec.sections.find(s=>bar>=s[1]&&bar<s[2])||spec.sections[spec.sections.length-1];
  }
  triggerSongVoice(freq,hold=2){
    const pool=this.song.pool;let v=pool.find(x=>x.gate===0&&x.hold<=0);
    if(!v)v=pool.reduce((a,b)=>a.age>b.age?a:b);
    for(const x of pool)x.age++;
    v.freq=freq;v.gate=1;v.hold=Math.max(1,hold);v.age=0;
  }
  triggerSongStep(spec,bar,step){
    const s=this.song,section=this.songSection(spec,bar),intensity=Math.max(.1,Math.min(1,section[3]*s.energy)),root=spec.roots[bar%spec.roots.length];s.eventPulse=5;
    const bassInt=spec.bass[step];
    s.bassGate=bassInt==null?0:1;
    if(bassInt!=null)s.bassFreq=midiHz(root+bassInt);
    s.padRoot=midiHz(root+12);
    s.padGate=(section[0]==='EMPTY ROOM'||section[0]==='CUT')?0.42:1;
    for(const v of s.pool)if(v.hold>0){v.hold--;if(v.hold<=0)v.gate=0}
    const leadInt=spec.motif[step],leadAllowed=intensity>.44&&((bar%4)!==0||step>=8);
    s.leadGate=leadInt==null||!leadAllowed?0:1;
    if(leadInt!=null){s.leadFreq=midiHz(root+leadInt);if(leadAllowed){this.triggerSongVoice(s.leadFreq,s.id==='dub'?3:2);if(intensity>.76&&step%8===2){this.triggerSongVoice(midiHz(root+leadInt+7),2);if(s.id==='glass')this.triggerSongVoice(midiHz(root+leadInt+12),1)}}}
    s.texture=[Math.max(.06,intensity*.42),.32+intensity*.46,.18+intensity*.62,.12+intensity*.34];
    const sparse=intensity<.42,fill=bar%8===7;
    let kick=false;
    if(s.id==='dub')kick=[0,7,10].includes(step)||(intensity>.7&&step===14);
    else if(s.id==='glass')kick=[0,4,8,11,12].includes(step)&&(intensity>.5||step===0||step===8);
    else kick=[0,8,11].includes(step)||(intensity>.7&&step===14);
    if(sparse)kick=[0,8].includes(step);
    if(kick){this.trigger909('bd',.82+.18*intensity);this.songFx.duck=1;}
    if(intensity>.34&&[4,12].includes(step))this.trigger909('sd',.68+.2*intensity);
    if(intensity>.58&&step===12&&bar%2===1)this.trigger909('cp',.55+.25*intensity);
    if(intensity>.36&&step%2===0)this.trigger909('ch',.35+.32*intensity);
    if(intensity>.66&&step===14&&bar%4===3)this.trigger909('oh',.48+.25*intensity);
    if(fill&&intensity>.55&&step>=12){const tom=step===12?'lt':step===13?'mt':'ht';this.trigger909(tom,.5+.3*intensity);}
    this.port.postMessage({type:'song-position',id:s.id,title:spec.title,bar,step,section:section[0],intensity,progress:(bar+step/16)/spec.bars,bars:spec.bars,bpm:spec.bpm});
  }
  processSong(outputs){
    const out=outputs[0];if(!out?.length)return true;const n=out[0].length,s=this.song,spec=SONGS[s.id]||SONGS.lowlight;
    if(s.playing){
      const stepFrames=sampleRate*60/spec.bpm/4;let guard=0;
      while(s.frame+n>=s.nextStep&&guard++<8){
        this.triggerSongStep(spec,s.bar,s.step);
        s.step++;if(s.step>=16){s.step=0;s.bar++;if(s.bar>=spec.bars){s.bar=0;this.port.postMessage({type:'song-cycle',id:s.id});}}
        s.nextStep+=stepFrames;
      }
      s.frame+=n;
    }else{s.bassGate=0;s.leadGate=0;s.padGate=0;for(const v of s.pool)v.gate=0;}
    const zero=n===this.zeroBlock.length?this.zeroBlock:new Float32Array(n);
    const bass=this.wasmProcess('songBass',zero,s.bassFreq,s.bassGate,.30+.28*s.energy,1.45+.65*s.energy);
    const pad=this.wasmProcess('songPad',zero,s.padRoot,s.padGate,.38+.32*s.energy,.24+.38*s.energy);
    const leadVoices=s.pool.map((v,i)=>this.wasmProcess(`songLead${i}`,zero,v.freq,v.gate,.36+.34*s.energy,.26+.22*s.energy));
    const texture=this.wasmProcess('songTexture',zero,...s.texture);
    const L=new Float32Array(n),R=new Float32Array(n);
    const drumsL=new Float32Array(n),drumsR=new Float32Array(n);
    for(const name of['bd','sd','rs','cp','lt','mt','ht','ch','oh'])this.mix909Voice(name,this.render909Voice(name,n),drumsL,drumsR);
    const fx=this.songFx,len=fx.dl.length;let sum=0,delaySum=0;
    for(let i=0;i<n;i++){
      fx.duck*=.99972;const duck=1-.30*fx.duck;
      let leadL=0,leadR=0;for(let v=0;v<leadVoices.length;v++){const pan=.16+.68*(v/Math.max(1,leadVoices.length-1)),gl=Math.sqrt(1-pan),gr=Math.sqrt(pan),lv=leadVoices[v][i]||0;leadL+=lv*gl;leadR+=lv*gr}
      let l=bass[i]*.82*duck+pad[i]*.50+leadL*.34+texture[i]*.32+drumsL[i]*.68;
      let r=bass[i]*.82*duck+pad[i]*.56+leadR*.34+texture[i]*.38+drumsR[i]*.68;
      const tapL=fx.dr[(fx.idx+len-13300)%len],tapR=fx.dl[(fx.idx+len-17700)%len];delaySum+=(tapL*tapL+tapR*tapR)*.5;
      fx.dl[fx.idx]=l+tapL*.32;fx.dr[fx.idx]=r+tapR*.29;fx.idx=(fx.idx+1)%len;
      l=l*.88+tapL*.18;r=r*.88+tapR*.18;
      l=l/(1+Math.abs(l));r=r/(1+Math.abs(r));
      out[0][i]=l;(out[1]||out[0])[i]=r;sum+=(l*l+r*r)*.5;
    }
    const tick=++this.tick;if((tick%8)===0){const mixRms=Math.sqrt(sum/n),section=this.songSection(spec,s.bar),leadRms=Math.sqrt(leadVoices.reduce((acc,a)=>{for(let i=0;i<a.length;i++){const v=a[i]||0;acc+=v*v}return acc},0)/Math.max(1,n*leadVoices.length)),active=s.pool.filter(v=>v.gate>0).length;this.port.postMessage({type:'meter',rms:mixRms});this.port.postMessage({type:'song-metrics',metrics:{transport:{bpm:spec.bpm,bar:s.bar,step:s.step,pulse:s.eventPulse>0},arranger:{section:section[0],energy:Math.max(.1,Math.min(1,section[3]*s.energy)),pulse:s.eventPulse>0},bass:{rms:rmsBlock(bass),freq:s.bassFreq,gate:s.bassGate},pad:{rms:rmsBlock(pad),freq:s.padRoot,gate:s.padGate},leadPool:{rms:leadRms,active,capacity:s.pool.length},texture:{rms:rmsBlock(texture)},drums:{rms:rmsStereo(drumsL,drumsR)},mix:{rms:mixRms},delay:{rms:Math.sqrt(delaySum/n)},out:{rms:mixRms}}});}if(s.eventPulse>0)s.eventPulse--;return true;
  }
  process(_inputs,outputs){return this.mode==='909'?this.process909(outputs):this.mode==='song'?this.processSong(outputs):this.processGraph(outputs);}
}
registerProcessor('circuit-engine',CircuitEngine);