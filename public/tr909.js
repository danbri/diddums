// TR-909 model translated from danja/valis examples/909.ttl.
// Keeps the named circuit structure explicit; selected leaf implementations can be LeanDSP/Wasm.
const N=(id,type,group,props={},impl='builtin')=>({id,type,group,props,impl});
const E=(from,fp,to,tp,kind='audio')=>({from,fromPort:fp,to,toPort:tp,kind});
const P=(symbol,label,section,target,property,min,max,value,unit='')=>({symbol,label,section,target,property,min,max,value,unit});

export const tr909Nodes=[
  // Bass drum
  N('bdGate','NoteGate','Bass Drum',{note:36}),
  N('bdOsc','Oscillator','Bass Drum',{shape:'triangle',frequency:55}),
  N('bdPitchEnv','Envelope','Bass Drum',{attack:.2,decay:20,sustain:0,release:2}),
  N('bdPitchScale','Scale','Bass Drum',{min:55,max:210}),
  N('bdAmpEnv','Envelope','Bass Drum',{attack:1,decay:500,sustain:0,release:100}),
  N('bdSat','AsymClip','Bass Drum',{drive:3,posVf:.25,negVf:.55},'LeanDSP/Wasm'),
  N('bdVca','VCA','Bass Drum'), N('bdLevel','Gain','Bass Drum',{gain:0}), N('bdPan','Pan','Bass Drum',{pan:0}),

  // Snare
  N('sdGate','NoteGate','Snare',{note:38}),
  N('sdOsc1','Oscillator','Snare',{shape:'sine',frequency:180}), N('sdOsc2','Oscillator','Snare',{shape:'sine',frequency:200}),
  N('sdOscMix','Mixer','Snare'), N('sdNoise','Noise','Snare',{colour:'white'}),
  N('sdBpf','StateVariable','Snare',{cutoff:2000,resonance:.5,mode:'bp'},'LeanDSP/Wasm'),
  N('sdToneEnv','Envelope','Snare',{attack:.2,decay:250,sustain:0,release:10}), N('sdToneVca','VCA','Snare'),
  N('sdNoiseEnv','Envelope','Snare',{attack:.1,decay:80,sustain:0,release:5}), N('sdNoiseVca','VCA','Snare'),
  N('sdMix','Mixer','Snare'), N('sdLevel','Gain','Snare',{gain:-6}), N('sdPan','Pan','Snare',{pan:0}),

  // Rim
  N('rsGate','NoteGate','Rim Shot',{note:37}), N('rsNoise','Noise','Rim Shot',{colour:'white'}),
  N('rsHpf','OnePole','Rim Shot',{cutoff:1200,mode:'highpass'},'LeanDSP/Wasm'), N('rsEnv','Envelope','Rim Shot',{attack:.1,decay:20,sustain:0,release:3}),
  N('rsVca','VCA','Rim Shot'), N('rsLevel','Gain','Rim Shot',{gain:-6}), N('rsPan','Pan','Rim Shot',{pan:-.3}),

  // Clap
  N('cpGate','NoteGate','Hand Clap',{note:39}), N('cpNoise','Noise','Hand Clap',{colour:'white'}),
  N('cpBpf','StateVariable','Hand Clap',{cutoff:1200,resonance:1.2,mode:'bp'},'LeanDSP/Wasm'), N('cpEnv','Envelope','Hand Clap',{attack:.1,decay:80,sustain:0,release:8}),
  N('cpVca','VCA','Hand Clap'), N('cpLevel','Gain','Hand Clap',{gain:-6}), N('cpPan','Pan','Hand Clap',{pan:.3}),

  // Toms
  N('ltGate','NoteGate','Low Tom',{note:41}), N('ltOsc','TwinTBridge','Low Tom',{frequency:70,decay:500}), N('ltPitchEnv','Envelope','Low Tom',{attack:.2,decay:20,sustain:0,release:2}), N('ltPitchScale','Scale','Low Tom',{min:70,max:200}), N('ltAmpEnv','Envelope','Low Tom',{attack:1,decay:500,sustain:0,release:800}), N('ltVca','VCA','Low Tom'), N('ltLevel','Gain','Low Tom',{gain:-3}), N('ltPan','Pan','Low Tom',{pan:-.5}),
  N('mtGate','NoteGate','Mid Tom',{note:43}), N('mtOsc','TwinTBridge','Mid Tom',{frequency:110,decay:350}), N('mtPitchEnv','Envelope','Mid Tom',{attack:.2,decay:18,sustain:0,release:2}), N('mtPitchScale','Scale','Mid Tom',{min:110,max:300}), N('mtAmpEnv','Envelope','Mid Tom',{attack:1,decay:350,sustain:0,release:600}), N('mtVca','VCA','Mid Tom'), N('mtLevel','Gain','Mid Tom',{gain:-3}), N('mtPan','Pan','Mid Tom',{pan:0}),
  N('htGate','NoteGate','High Tom',{note:50}), N('htOsc','TwinTBridge','High Tom',{frequency:160,decay:250}), N('htPitchEnv','Envelope','High Tom',{attack:.2,decay:15,sustain:0,release:2}), N('htPitchScale','Scale','High Tom',{min:160,max:420}), N('htAmpEnv','Envelope','High Tom',{attack:1,decay:250,sustain:0,release:400}), N('htVca','VCA','High Tom'), N('htLevel','Gain','High Tom',{gain:-3}), N('htPan','Pan','High Tom',{pan:.5}),

  // Closed hat
  N('chGate','NoteGate','Closed HH',{note:42}),
  ...[562,834,1124,1395,1668,1995].map((f,i)=>N(`chOsc${i+1}`,'Oscillator','Closed HH',{shape:'square',frequency:f})),
  N('chMix','Mixer','Closed HH'), N('chHpf','StateVariable','Closed HH',{cutoff:7000,resonance:.4,mode:'hp'},'LeanDSP/Wasm'),
  N('chEnv','Envelope','Closed HH',{attack:.1,decay:45,sustain:0,release:5}), N('chVca','VCA','Closed HH'), N('chLevel','Gain','Closed HH',{gain:-9}), N('chPan','Pan','Closed HH',{pan:-.2}),

  // Open hat
  N('ohGate','NoteGate','Open HH',{note:46}),
  ...[562,834,1124,1395,1668,1995].map((f,i)=>N(`ohOsc${i+1}`,'Oscillator','Open HH',{shape:'square',frequency:f})),
  N('ohMix','Mixer','Open HH'), N('ohHpf','StateVariable','Open HH',{cutoff:7000,resonance:.4,mode:'hp'},'LeanDSP/Wasm'),
  N('ohEnv','Envelope','Open HH',{attack:.1,decay:500,sustain:0,release:40}), N('ohVca','VCA','Open HH'), N('ohLevel','Gain','Open HH',{gain:-9}), N('ohPan','Pan','Open HH',{pan:.2}), N('ohChoke','Choke','Open HH'),

  N('mix','StereoMixer','Output'), N('out','Output','Output')
];

const edges=[];
const add=(...xs)=>edges.push(...xs);
add(
 E('bdGate','gate','bdPitchEnv','gate','gate'),E('bdGate','gate','bdAmpEnv','gate','gate'),E('bdPitchEnv','out','bdPitchScale','in','control'),E('bdPitchScale','out','bdOsc','frequency','control'),E('bdOsc','out','bdSat','in'),E('bdSat','out','bdVca','in'),E('bdAmpEnv','out','bdVca','cv','control'),E('bdVca','out','bdLevel','in'),E('bdLevel','out','bdPan','in'),E('bdPan','left','mix','left'),E('bdPan','right','mix','right'),
 E('sdGate','velocity','sdToneEnv','gate','gate'),E('sdGate','velocity','sdNoiseEnv','gate','gate'),E('sdOsc1','out','sdOscMix','in'),E('sdOsc2','out','sdOscMix','in'),E('sdOscMix','out','sdToneVca','in'),E('sdToneEnv','out','sdToneVca','cv','control'),E('sdNoise','out','sdBpf','in'),E('sdBpf','bp','sdNoiseVca','in'),E('sdNoiseEnv','out','sdNoiseVca','cv','control'),E('sdToneVca','out','sdMix','in'),E('sdNoiseVca','out','sdMix','in'),E('sdMix','out','sdLevel','in'),E('sdLevel','out','sdPan','in'),E('sdPan','left','mix','left'),E('sdPan','right','mix','right'),
 E('rsGate','velocity','rsEnv','gate','gate'),E('rsNoise','out','rsHpf','in'),E('rsHpf','out','rsVca','in'),E('rsEnv','out','rsVca','cv','control'),E('rsVca','out','rsLevel','in'),E('rsLevel','out','rsPan','in'),E('rsPan','left','mix','left'),E('rsPan','right','mix','right'),
 E('cpGate','velocity','cpEnv','gate','gate'),E('cpNoise','out','cpBpf','in'),E('cpBpf','bp','cpVca','in'),E('cpEnv','out','cpVca','cv','control'),E('cpVca','out','cpLevel','in'),E('cpLevel','out','cpPan','in'),E('cpPan','left','mix','left'),E('cpPan','right','mix','right')
);
for(const p of ['lt','mt','ht']) add(
 E(`${p}Gate`,'velocity',`${p}PitchEnv`,'gate','gate'),E(`${p}Gate`,'velocity',`${p}AmpEnv`,'gate','gate'),E(`${p}Gate`,'velocity',`${p}Osc`,'trigger','gate'),E(`${p}PitchEnv`,'out',`${p}PitchScale`,'in','control'),E(`${p}PitchScale`,'out',`${p}Osc`,'frequency','control'),E(`${p}Osc`,'out',`${p}Vca`,'in'),E(`${p}AmpEnv`,'out',`${p}Vca`,'cv','control'),E(`${p}Vca`,'out',`${p}Level`,'in'),E(`${p}Level`,'out',`${p}Pan`,'in'),E(`${p}Pan`,'left','mix','left'),E(`${p}Pan`,'right','mix','right')
);
for(const p of ['ch','oh']){
  if(p==='ch') add(E('chGate','velocity','chEnv','gate','gate'));
  else add(E('ohGate','velocity','ohChoke','gate','gate'),E('chGate','velocity','ohChoke','choke','gate'),E('ohChoke','out','ohEnv','gate','gate'));
  for(let i=1;i<=6;i++) add(E(`${p}Osc${i}`,'out',`${p}Mix`,'in'));
  add(E(`${p}Mix`,'out',`${p}Hpf`,'in'),E(`${p}Hpf`,'hp',`${p}Vca`,'in'),E(`${p}Env`,'out',`${p}Vca`,'cv','control'),E(`${p}Vca`,'out',`${p}Level`,'in'),E(`${p}Level`,'out',`${p}Pan`,'in'),E(`${p}Pan`,'left','mix','left'),E(`${p}Pan`,'right','mix','right'));
}
add(E('mix','left','out','left'),E('mix','right','out','right'));
export const tr909Edges=edges;

export const tr909Params=[
 P('bd_decay','Decay','Bass Drum','bdAmpEnv','decay',50,2000,500,'ms'),P('bd_tune','Tune','Bass Drum','bdPitchScale','min',30,120,55,'Hz'),P('bd_drive','Drive','Bass Drum','bdSat','drive',.5,10,3),P('bd_level','Level','Bass Drum','bdLevel','gain',-60,12,0,'dB'),P('bd_pan','Pan','Bass Drum','bdPan','pan',-1,1,0),
 P('sd_tone_decay','Tone Decay','Snare','sdToneEnv','decay',20,1000,250,'ms'),P('sd_snappy','Snappy','Snare','sdNoiseEnv','decay',10,300,80,'ms'),P('sd_tone','Tone','Snare','sdBpf','cutoff',500,6000,2000,'Hz'),P('sd_level','Level','Snare','sdLevel','gain',-60,12,-6,'dB'),P('sd_pan','Pan','Snare','sdPan','pan',-1,1,0),
 P('rs_decay','Decay','Rim Shot','rsEnv','decay',5,100,20,'ms'),P('rs_level','Level','Rim Shot','rsLevel','gain',-60,12,-6,'dB'),P('rs_pan','Pan','Rim Shot','rsPan','pan',-1,1,-.3),
 P('cp_decay','Decay','Hand Clap','cpEnv','decay',10,300,80,'ms'),P('cp_level','Level','Hand Clap','cpLevel','gain',-60,12,-6,'dB'),P('cp_pan','Pan','Hand Clap','cpPan','pan',-1,1,.3),
 P('lt_decay','Decay','Low Tom','ltAmpEnv','decay',50,2000,500,'ms'),P('lt_level','Level','Low Tom','ltLevel','gain',-60,12,-3,'dB'),P('lt_pan','Pan','Low Tom','ltPan','pan',-1,1,-.5),
 P('mt_decay','Decay','Mid Tom','mtAmpEnv','decay',50,2000,350,'ms'),P('mt_level','Level','Mid Tom','mtLevel','gain',-60,12,-3,'dB'),P('mt_pan','Pan','Mid Tom','mtPan','pan',-1,1,0),
 P('ht_decay','Decay','High Tom','htAmpEnv','decay',30,1000,250,'ms'),P('ht_level','Level','High Tom','htLevel','gain',-60,12,-3,'dB'),P('ht_pan','Pan','High Tom','htPan','pan',-1,1,.5),
 P('ch_decay','Decay','Closed HH','chEnv','decay',5,200,45,'ms'),P('ch_level','Level','Closed HH','chLevel','gain',-60,12,-9,'dB'),P('ch_pan','Pan','Closed HH','chPan','pan',-1,1,-.2),
 P('oh_decay','Decay','Open HH','ohEnv','decay',100,3000,500,'ms'),P('oh_bright','Brightness','Open HH','ohHpf','cutoff',2000,14000,7000,'Hz'),P('oh_level','Level','Open HH','ohLevel','gain',-60,12,-9,'dB'),P('oh_pan','Pan','Open HH','ohPan','pan',-1,1,.2)
];

export const tr909Groups=['Bass Drum','Snare','Rim Shot','Hand Clap','Low Tom','Mid Tom','High Tom','Closed HH','Open HH','Output'];
export const tr909Graph={version:'audio-circuit/909-port/0.2',label:'TR-909 — clean-room TTL graph port',nodes:tr909Nodes,edges:tr909Edges,parameters:tr909Params,source:'declarative danja/valis examples/909.ttl',target:'perceptual equivalence to documented graph'};

export const tr909Patterns={
  classic:{label:'Four floor',steps:16,voices:{bd:[0,4,8,12],sd:[4,12],ch:[0,2,4,6,8,10,12,14],oh:[6,14],cp:[],rs:[],lt:[],mt:[],ht:[]}},
  electro:{label:'Electro',steps:16,voices:{bd:[0,3,7,10,12],sd:[4,12],ch:[2,6,10,14],oh:[7,15],cp:[12],rs:[6],lt:[11],mt:[],ht:[]}},
  broken:{label:'Broken',steps:16,voices:{bd:[0,5,7,11,14],sd:[4,9,12],ch:[1,3,6,8,10,13,15],oh:[7],cp:[14],rs:[2,10],lt:[6],mt:[11],ht:[15]}}
};

export const tr909Lean={
  bdSat:`dsp BDAsymClip where
  param drive : F32 := 3.0 range 0.5 10.0
  param posVf : F32 := 0.25 range 0.05 1.0
  param negVf : F32 := 0.55 range 0.05 1.2
  sample x => asymclip(x, drive, posVf, negVf)`,
  master:`dsp DrumBusGlue where
  param drive : F32 := 1.25 range 0.5 4.0
  param mix : F32 := 0.18 range 0.0 1.0
  sample x => (1.0 - mix) * x + mix * softsign(x * drive)`,
  oscillator:`dsp ReferenceOscillator where
  param freq : F32 := 180.0 range 10.0 20000.0
  state phase : F32 := 0.0
  sample x =>
    let y := sinpi(phase * 2.0)
    set phase := fract(phase + freq / sr)
    return y`,
  envelope:`dsp ReferenceDecayEnvelope where
  param decayMs : F32 := 250.0 range 1.0 5000.0
  state env : F32 := 0.0
  sample x =>
    let k := expneg(1000.0 / (decayMs * sr))
    let next := select(gt(x, 0.5), 1.0, env * k)
    set env := next
    return next`,
  onePole:`dsp ReferenceOnePole where
  param alpha : F32 := 0.08 range 0.0001 0.999
  state z : F32 := 0.0
  sample x =>
    let y := z + alpha * (x - z)
    set z := y
    return y`,
  noise:`dsp DeterministicNoise where
  state counter : F32 := 1.0
  sample x =>
    let y := noise1(counter)
    set counter := counter + 1.0
    return y`,
  onePoleHP:`dsp OnePoleHP where
  param cutoff : F32 := 1200.0 range 20.0 20000.0
  state lp : F32 := 0.0
  sample x =>
    let a := 1.0 - expneg(6.2831853 * cutoff / sr)
    let next := lp + a * (x - lp)
    let y := x - next
    set lp := next
    return y`,
  svfBP:`dsp TPTBandpass where
  param cutoff : F32 := 2000.0 range 20.0 20000.0
  param resonance : F32 := 0.5 range 0.05 20.0
  state ic1 : F32 := 0.0
  state ic2 : F32 := 0.0
  sample x =>
    let g := tanpi(clip(cutoff / sr, 0.0001, 0.45))
    let k := 1.0 / max(resonance, 0.05)
    let a1 := 1.0 / (1.0 + g * (g + k))
    let a2 := g * a1
    let a3 := g * a2
    let v3 := x - ic2
    let v1 := a1 * ic1 + a2 * v3
    let v2 := ic2 + a2 * ic1 + a3 * v3
    set ic1 := 2.0 * v1 - ic1
    set ic2 := 2.0 * v2 - ic2
    return v1`,
  svfHP:`dsp TPTHighpass where
  param cutoff : F32 := 7000.0 range 20.0 20000.0
  param resonance : F32 := 0.4 range 0.05 20.0
  state ic1 : F32 := 0.0
  state ic2 : F32 := 0.0
  sample x =>
    let g := tanpi(clip(cutoff / sr, 0.0001, 0.45))
    let k := 1.0 / max(resonance, 0.05)
    let a1 := 1.0 / (1.0 + g * (g + k))
    let a2 := g * a1
    let a3 := g * a2
    let v3 := x - ic2
    let v1 := a1 * ic1 + a2 * v3
    let v2 := ic2 + a2 * ic1 + a3 * v3
    let hp := x - k * v1 - v2
    set ic1 := 2.0 * v1 - ic1
    set ic2 := 2.0 * v2 - ic2
    return hp`
};