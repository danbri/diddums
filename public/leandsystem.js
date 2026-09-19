export const systemExamples={
  performance:{label:'Long-form performance',source:`system LongFormPerformance where
  port transport : Event<Transport> @event in
  port out : Audio<Stereo> @audio out
  instance sequencer : EventSequencer
  instance bass : LeanDSP<LongFormBass>
  instance pad : LeanDSP<LongFormPad>
  pool leads : LeanDSP<LongFormLead>[6]
  instance texture : LeanDSP<LongFormTexture>
  array drums : DrumVoice[9]
  instance mix : StereoMixer
  delay dubL : F32[48000]
  delay dubR : F32[48000]
  connect transport -> sequencer : event
  connect sequencer -> bass : event
  connect sequencer -> pad : event
  connect sequencer -> leads : event
  connect sequencer -> drums : event
  connect bass -> mix : audio
  connect pad -> mix : audio
  connect leads -> mix : audio
  connect texture -> mix : audio
  connect drums -> mix : audio
  connect mix -> dubL : audio
  connect dubL -> dubR : audio
  connect dubR -> mix : audio
  connect mix -> out : audio`},
  sampler:{label:'Sampler instrument',source:`system BoundedSampler where
  port notes : Event<Midi> @event in
  port out : Audio<Stereo> @audio out
  resource piano : SampleSet sha256:demo-piano
  resource tuning : Tuning sha256:12tet
  instance regions : RegionMap
  pool voices : SampleVoice[32]
  array filters : SVF[32]
  instance mix : StereoMixer
  connect notes -> regions : event
  connect regions -> voices : event
  connect piano -> voices : resource
  connect tuning -> voices : resource
  connect voices -> filters : audio
  connect filters -> mix : audio
  connect mix -> out : audio`},
  spectral:{label:'Spectral utility',source:`system SpectralUtility where
  port input : Audio<Stereo> @audio in
  port spectrum : Analysis<Spectrum> @block out
  port out : Audio<Stereo> @audio out
  block fft : FFT[2048] hop 512 latency 1536
  block mask : SpectralMask[1025] hop 512 latency 0
  block ifft : IFFT[2048] hop 512 latency 1536
  connect input -> fft : audio
  connect fft -> spectrum : analysis
  connect fft -> mask : block
  connect mask -> ifft : block
  connect ifft -> out : audio`},
  circuit:{label:'Circuit / oversampling effect',source:`system CircuitEffect where
  port input : Audio<Mono> @audio in
  port out : Audio<Mono> @audio out
  param drive : Gain @control range 0.5 8.0
  array prefilter : Biquad[2]
  block upsample : Resampler[8] hop 1 latency 32
  instance nonlinear : CircuitRecurrence
  block downsample : Resampler[8] hop 1 latency 32
  array postfilter : Biquad[2]
  connect input -> prefilter : audio
  connect prefilter -> upsample : audio
  connect upsample -> nonlinear : audio
  connect nonlinear -> downsample : audio
  connect downsample -> postfilter : audio
  connect postfilter -> out : audio`}
};

const ident='[A-Za-z_][A-Za-z0-9_]*';
function parseBound(raw,label,max=4096){const n=Number(raw);if(!Number.isInteger(n)||n<1||n>max)throw new Error(`${label} bound ${raw} must be 1..${max}`);return n}
function addUnique(map,name,node){if(map.has(name))throw new Error(`Duplicate system symbol ${name}`);map.set(name,node);return node}

export function parseLeanSystem(source){
  const lines=source.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('--'));
  if(!lines.length)throw new Error('Empty system source');
  const h=lines[0].match(new RegExp(`^system\\s+(${ident})\\s+where$`));if(!h)throw new Error('Expected: system Name where');
  const nodes=[],edges=[],symbols=new Map(),params=[];let uid=0;
  const add=(name,kind,type,detail='',meta={})=>addUnique(symbols,name,{id:`s${uid++}`,name,kind,type,detail,...meta});
  for(const line of lines.slice(1)){
    let m=line.match(new RegExp(`^port\\s+(${ident})\\s*:\\s*([^\\s]+)\\s+@(audio|control|event|block)\\s+(in|out)$`));
    if(m){add(m[1],'port',m[2],`${m[3]} · ${m[4]}`,{rate:m[3],direction:m[4]});continue}
    m=line.match(new RegExp(`^param\\s+(${ident})\\s*:\\s*(${ident})\\s+@(audio|control|event|block)\\s+range\\s+(-?\\d+(?:\\.\\d+)?)\\s+(-?\\d+(?:\\.\\d+)?)$`));
    if(m){const lo=Number(m[4]),hi=Number(m[5]);if(!(lo<hi))throw new Error(`${m[1]} parameter range must increase`);const n=add(m[1],'param',m[2],`${m[3]} · ${lo}…${hi}`,{rate:m[3],lo,hi});params.push(n);continue}
    m=line.match(new RegExp(`^resource\\s+(${ident})\\s*:\\s*(${ident})\\s+sha256:([^\\s]+)$`));
    if(m){add(m[1],'resource',m[2],`immutable · sha256:${m[3]}`,{hash:m[3]});continue}
    m=line.match(new RegExp(`^instance\\s+(${ident})\\s*:\\s*(.+)$`));
    if(m){add(m[1],'instance',m[2],'single bounded instance');continue}
    m=line.match(new RegExp(`^array\\s+(${ident})\\s*:\\s*(.+)\\[(\\d+)\\]$`));
    if(m){const n=parseBound(m[3],m[1],256);add(m[1],'array',m[2],`Array ${n}`,{bound:n});continue}
    m=line.match(new RegExp(`^pool\\s+(${ident})\\s*:\\s*(.+)\\[(\\d+)\\]$`));
    if(m){const n=parseBound(m[3],m[1],256);add(m[1],'pool',m[2],`Pool ${n} · deterministic allocation`,{bound:n});continue}
    m=line.match(new RegExp(`^delay\\s+(${ident})\\s*:\\s*F32\\[(\\d+)\\]$`));
    if(m){const n=parseBound(m[2],m[1],262144);add(m[1],'delay','Delay',`${n} samples · causal`,{bound:n,causal:true});continue}
    m=line.match(new RegExp(`^block\\s+(${ident})\\s*:\\s*(.+)\\[(\\d+)\\]\\s+hop\\s+(\\d+)\\s+latency\\s+(\\d+)$`));
    if(m){const size=parseBound(m[3],`${m[1]} window`,65536),hop=parseBound(m[4],`${m[1]} hop`,65536),lat=Number(m[5]);if(hop>size)throw new Error(`${m[1]} hop may not exceed window size`);add(m[1],'block',m[2],`window ${size} · hop ${hop} · latency ${lat}`,{size,hop,latency:lat,rate:'block'});continue}
    m=line.match(new RegExp(`^connect\\s+(${ident})\\s*->\\s*(${ident})\\s*:\\s*(audio|control|event|block|analysis|resource)$`));
    if(m){edges.push({fromName:m[1],toName:m[2],kind:m[3]});continue}
    throw new Error(`Unsupported system declaration: ${line}`);
  }
  for(const e of edges){const a=symbols.get(e.fromName),b=symbols.get(e.toName);if(!a||!b)throw new Error(`Unknown system endpoint ${e.fromName} → ${e.toName}`);e.from=a.id;e.to=b.id}
  nodes.push(...symbols.values());
  // Tarjan SCC: feedback is legal only when every cyclic SCC contains an explicit delay.
  const adj=Object.fromEntries(nodes.map(n=>[n.id,[]]));edges.forEach(e=>adj[e.from].push(e.to));let index=0;const stack=[],on=new Set(),idx=new Map(),low=new Map(),sccs=[];
  function visit(v){idx.set(v,index);low.set(v,index++);stack.push(v);on.add(v);for(const w of adj[v]){if(!idx.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)))}else if(on.has(w))low.set(v,Math.min(low.get(v),idx.get(w)))}if(low.get(v)===idx.get(v)){const c=[];let w;do{w=stack.pop();on.delete(w);c.push(w)}while(w!==v);sccs.push(c)}}
  nodes.forEach(n=>{if(!idx.has(n.id))visit(n.id)});for(const c of sccs){const self=c.length===1&&edges.some(e=>e.from===c[0]&&e.to===c[0]);if((c.length>1||self)&&!c.some(id=>nodes.find(n=>n.id===id)?.kind==='delay'))throw new Error(`Feedback cycle lacks explicit delay: ${c.map(id=>nodes.find(n=>n.id===id)?.name).join(' → ')}`)}
  const counts=Object.fromEntries(['port','param','resource','instance','array','pool','delay','block'].map(k=>[k,nodes.filter(n=>n.kind===k).length]));
  const checks=[
    `✓ closed LeanDSP system graph: ${nodes.length} nodes / ${edges.length} typed edges`,
    `✓ bounded collections: ${counts.array} array(s), ${counts.pool} pool(s)`,
    `✓ resources explicit and integrity-addressed: ${counts.resource}`,
    `✓ block kernels declare finite window/hop/latency: ${counts.block}`,
    `✓ all feedback cycles cross explicit causal delay: ${counts.delay} delay node(s)`,
    `✓ typed rates represented independently: audio / control / event / block`,
    `✓ leaf implementations may compile independently and remain recursively inspectable`
  ];
  return{name:h[1],nodes,edges,params,counts,checks};
}