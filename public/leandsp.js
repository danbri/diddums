export const leanExamples = {
  gain: {
    label: 'Clean gain',
    source: `dsp CleanGain where
  param gain : F32 := 0.34 range 0.0 1.5
  sample x => x * gain`
  },
  fold: {
    label: 'Wavefold furnace',
    source: `dsp FoldFurnace where
  param drive : F32 := 3.8 range 0.1 12.0
  param mix : F32 := 0.92 range 0.0 1.0
  sample x => mix * fold(x * drive) + (1.0 - mix) * x`
  },
  hornets: {
    label: 'Digital hornets',
    source: `dsp DigitalHornets where
  param steps : F32 := 19.0 range 2.0 96.0
  param mix : F32 := 0.88 range 0.0 1.0
  sample x => mix * wrap(quant(x * 5.0, steps)) + (1.0 - mix) * x`
  },
  diode: {
    label: 'Broken diode',
    source: `dsp BrokenDiode where
  param drive : F32 := 5.2 range 0.1 16.0
  param level : F32 := 0.82 range 0.0 1.5
  sample x => level * softsign((abs(x) * 2.0 - 0.55) * drive)`
  },
  shred: {
    label: 'Spectral shredder-ish',
    source: `dsp Shredder where
  param drive : F32 := 7.0 range 0.1 20.0
  param steps : F32 := 11.0 range 2.0 64.0
  sample x => clip(quant(fold(wrap(x * drive) * 2.5), steps), -1.0, 1.0)`
  },
  stateLP: {
    label: 'Stateful one-pole',
    source: `dsp StatefulOnePole where
  param alpha : F32 := 0.08 range 0.001 0.95
  state z : F32 := 0.0
  sample x =>
    let y := z + alpha * (x - z)
    set z := y
    return y`
  },
  phaseOsc: {
    label: 'Stateful oscillator',
    source: `dsp StatefulOsc where
  param freq : F32 := 110.0 range 20.0 4000.0
  state phase : F32 := 0.0
  sample x =>
    let y := sinpi(phase * 2.0)
    set phase := fract(phase + freq / sr)
    return y`
  },
  decayEnv: {
    label: 'Gate envelope',
    source: `dsp GateEnvelope where
  param decayMs : F32 := 120.0 range 5.0 3000.0
  state env : F32 := 0.0
  sample x =>
    let k := expneg(1000.0 / (decayMs * sr))
    let next := select(gt(x, 0.5), 1.0, env * k)
    set env := next
    return next`
  },
  neonArp: {
    label: 'Neon glass arpeggio',
    source: `dsp NeonGlass where
  param rate : F32 := 1.55 range 0.3 4.0
  param echo : F32 := 0.42 range 0.0 0.78
  param tone : F32 := 0.58 range 0.1 1.0
  state clock : F32 := 0.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state lp : F32 := 0.0
  buffer delay : F32[24000]
  sample x =>
    let step := fract(clock * 4.0)
    let freq := select(lt(step, 0.25), 110.0, select(lt(step, 0.5), 130.81, select(lt(step, 0.75), 164.81, 196.0)))
    let saw := fract(p1) * 2.0 - 1.0
    let sine := sinpi(p2 * 2.0)
    let gate := 1.0 - fract(clock * 4.0)
    let raw := (saw * 0.34 + sine * 0.38) * gate
    let filtered := lp + tone * 0.18 * (raw - lp)
    let delayed := taplin(delay, 9000.0)
    let y := filtered * 0.74 + delayed * echo
    push delay := filtered + delayed * 0.48
    set lp := filtered
    set p1 := fract(p1 + freq / sr)
    set p2 := fract(p2 + freq * 1.003 / sr)
    set clock := clock + rate / sr
    return y`
  },
  halogenPad: {
    label: 'Halogen bloom pad',
    source: `dsp HalogenBloom where
  param bloom : F32 := 0.62 range 0.1 1.0
  param drift : F32 := 0.18 range 0.0 0.8
  param echo : F32 := 0.46 range 0.0 0.78
  param air : F32 := 0.42 range 0.0 1.0
  state t : F32 := 0.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state p4 : F32 := 0.0
  buffer hazeA : F32[32000]
  buffer hazeB : F32[40000]
  sample x =>
    let lfo := sinpi(t * 0.14)
    let a := sinpi(p1 * 2.0)
    let b := sinpi(p2 * 2.0)
    let c := sinpi(p3 * 2.0)
    let d := sinpi(p4 * 2.0)
    let chord := (a + b * 0.82 + c * 0.74 + d * air * 0.52) * 0.24
    let da := taplin(hazeA, 10500.0 + lfo * 520.0)
    let db := taplin(hazeB, 17300.0 - lfo * 690.0)
    let y := chord * bloom + da * echo * 0.56 + db * echo * 0.46
    push hazeA := chord + da * 0.54
    push hazeB := chord * 0.82 + db * 0.49
    set p1 := fract(p1 + 110.0 * (1.0 + lfo * drift * 0.002) / sr)
    set p2 := fract(p2 + 130.81 / sr)
    set p3 := fract(p3 + 164.81 * (1.0 - lfo * drift * 0.0015) / sr)
    set p4 := fract(p4 + 246.94 / sr)
    set t := t + 1.0 / sr
    return y`
  },
  tripDust: {
    label: 'Low-light trip-hop',
    source: `dsp LowLightDust where
  param pulse : F32 := 0.72 range 0.1 1.0
  param dust : F32 := 0.055 range 0.0 0.22
  param echo : F32 := 0.32 range 0.0 0.72
  param drive : F32 := 1.8 range 0.5 5.0
  state clock : F32 := 0.0
  state phase : F32 := 0.0
  state counter : F32 := 1.0
  state lp : F32 := 0.0
  buffer shadow : F32[36000]
  sample x =>
    let step := fract(clock * 2.0)
    let freq := select(lt(step, 0.25), 55.0, select(lt(step, 0.5), 65.41, select(lt(step, 0.75), 82.41, 73.42)))
    let saw := fract(phase) * 2.0 - 1.0
    let gate := select(lt(fract(clock * 4.0), 0.36), 1.0, 0.18)
    let grit := noise1(counter) * dust
    let raw := softsign((saw * gate + grit) * drive)
    let filtered := lp + 0.055 * (raw - lp)
    let delayed := taplin(shadow, 15000.0)
    let y := filtered * pulse + delayed * echo
    push shadow := filtered + delayed * 0.43
    set lp := filtered
    set phase := fract(phase + freq / sr)
    set counter := counter + 1.0
    set clock := clock + 0.72 / sr
    return y`
  },
  motorPulse: {
    label: 'Motorik pulse line',
    source: `dsp MotorikPulse where
  param rate : F32 := 2.05 range 0.5 5.0
  param width : F32 := 0.38 range 0.1 0.9
  param echo : F32 := 0.34 range 0.0 0.7
  param grit : F32 := 1.35 range 0.6 4.0
  state clock : F32 := 0.0
  state phase : F32 := 0.0
  buffer echoLine : F32[20000]
  sample x =>
    let step := fract(clock * 4.0)
    let freq := select(lt(step, 0.25), 82.41, select(lt(step, 0.5), 98.0, select(lt(step, 0.75), 110.0, 123.47)))
    let pulseWave := select(lt(fract(phase), width), 0.72, -0.72)
    let accent := select(lt(fract(clock * 8.0), 0.22), 1.0, 0.34)
    let dry := softsign(pulseWave * accent * grit)
    let delayed := taplin(echoLine, 7200.0)
    push echoLine := dry + delayed * 0.46
    set phase := fract(phase + freq / sr)
    set clock := clock + rate / sr
    return dry * 0.72 + delayed * echo`
  },
  chromeBells: {
    label: 'Chrome bell air',
    source: `dsp ChromeBellAir where
  param motion : F32 := 0.7 range 0.15 2.5
  param glass : F32 := 0.48 range 0.0 1.0
  param echo : F32 := 0.44 range 0.0 0.78
  state clock : F32 := 0.0
  state carrier : F32 := 0.0
  state modulator : F32 := 0.0
  buffer shine : F32[30000]
  sample x =>
    let step := fract(clock * 3.0)
    let freq := select(lt(step, 0.333), 220.0, select(lt(step, 0.666), 329.63, 493.88))
    let modv := sinpi(modulator * 2.0) * glass * 0.19
    let bell := sinpi((carrier + modv) * 2.0)
    let env := 1.0 - fract(clock * 3.0)
    let dry := bell * env * 0.52
    let delayed := taplin(shine, 11800.0)
    push shine := dry + delayed * 0.51
    set carrier := fract(carrier + freq / sr)
    set modulator := fract(modulator + freq * 2.73 / sr)
    set clock := clock + motion / sr
    return dry + delayed * echo`
  },
  dubShadow: {
    label: 'Dub shadow chords',
    source: `dsp DubShadow where
  param rate : F32 := 0.74 range 0.25 2.0
  param space : F32 := 0.58 range 0.0 0.82
  param dark : F32 := 0.42 range 0.08 0.9
  param drive : F32 := 1.3 range 0.6 3.5
  state clock : F32 := 0.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state lp : F32 := 0.0
  buffer dub : F32[48000]
  sample x =>
    let beat := fract(clock)
    let gate := select(lt(beat, 0.18), 1.0 - beat / 0.18, 0.0)
    let chord := (sinpi(p1 * 2.0) + sinpi(p2 * 2.0) * 0.78 + sinpi(p3 * 2.0) * 0.66) * 0.3 * gate
    let saturated := softsign(chord * drive)
    let filtered := lp + dark * 0.12 * (saturated - lp)
    let delayed := taplin(dub, 18000.0)
    let y := filtered + delayed * space
    push dub := filtered + delayed * 0.63
    set lp := filtered
    set p1 := fract(p1 + 110.0 / sr)
    set p2 := fract(p2 + 130.81 / sr)
    set p3 := fract(p3 + 164.81 / sr)
    set clock := clock + rate / sr
    return y`
  },
  midnightRelay: {
    label: 'Midnight relay',
    source: `dsp MidnightRelay where
  param rate : F32 := 1.28 range 0.4 3.5
  param bite : F32 := 1.7 range 0.7 4.5
  param chorus : F32 := 0.36 range 0.0 0.75
  param width : F32 := 0.42 range 0.12 0.88
  state clock : F32 := 0.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state lp : F32 := 0.0
  buffer chorusLine : F32[26000]
  sample x =>
    let step := fract(clock * 4.0)
    let freq := select(lt(step, 0.25), 73.42, select(lt(step, 0.5), 82.41, select(lt(step, 0.75), 110.0, 98.0)))
    let pulse := select(lt(fract(p1), width), 0.78, -0.78)
    let sine := sinpi(p2 * 2.0) * 0.24
    let gate := select(lt(fract(clock * 8.0), 0.45), 1.0, 0.26)
    let raw := softsign((pulse + sine) * gate * bite)
    let filtered := lp + 0.11 * (raw - lp)
    let delayed := taplin(chorusLine, 420.0 + sinpi(clock * 0.23) * 75.0)
    push chorusLine := filtered
    set lp := filtered
    set p1 := fract(p1 + freq / sr)
    set p2 := fract(p2 + freq * 1.002 / sr)
    set clock := clock + rate / sr
    return filtered * 0.76 + delayed * chorus`
  },
  orbitalReactor: {
    label: 'Orbital reactor',
    source: `dsp OrbitalReactor where
  param rate : F32 := 1.92 range 0.4 4.5
  param foldAmt : F32 := 2.6 range 0.5 7.0
  param motion : F32 := 0.58 range 0.0 1.0
  param space : F32 := 0.29 range 0.0 0.72
  state clock : F32 := 0.0
  state phase : F32 := 0.0
  state lp : F32 := 0.0
  buffer orbit : F32[30000]
  sample x =>
    let step := fract(clock * 3.0)
    let freq := select(lt(step, 0.333), 65.41, select(lt(step, 0.666), 98.0, 130.81))
    let saw := fract(phase) * 2.0 - 1.0
    let folded := fold(saw * foldAmt)
    let env := 1.0 - fract(clock * 6.0)
    let lfo := 0.03 + motion * 0.16 * (0.5 + 0.5 * sinpi(clock * 0.37))
    let filtered := lp + lfo * (folded * env - lp)
    let delayed := taplin(orbit, 9600.0)
    push orbit := filtered + delayed * 0.37
    set lp := filtered
    set phase := fract(phase + freq / sr)
    set clock := clock + rate / sr
    return filtered * 0.82 + delayed * space`
  },
  blackChoir: {
    label: 'Black glass choir',
    source: `dsp BlackGlassChoir where
  param dark : F32 := 0.28 range 0.04 0.8
  param grit : F32 := 0.12 range 0.0 0.35
  param drift : F32 := 0.21 range 0.0 0.8
  param space : F32 := 0.34 range 0.0 0.72
  state t : F32 := 0.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state counter : F32 := 1.0
  state lp : F32 := 0.0
  buffer vault : F32[42000]
  sample x =>
    let lfo := sinpi(t * 0.11)
    let a := sinpi(p1 * 2.0)
    let b := select(lt(fract(p2), 0.48), 0.52, -0.52)
    let c := sinpi(p3 * 2.0) * 0.31
    let noise := noise1(counter) * grit
    let raw := (a * 0.5 + b * 0.36 + c + noise) * 0.7
    let filtered := lp + dark * 0.11 * (raw - lp)
    let delayed := taplin(vault, 14500.0 + lfo * 900.0)
    push vault := filtered + delayed * 0.48
    set lp := filtered
    set p1 := fract(p1 + 82.41 * (1.0 + lfo * drift * 0.002) / sr)
    set p2 := fract(p2 + 123.47 / sr)
    set p3 := fract(p3 + 164.81 * (1.0 - lfo * drift * 0.0015) / sr)
    set counter := counter + 1.0
    set t := t + 1.0 / sr
    return filtered + delayed * space`
  },
  ultravioletRain: {
    label: 'Ultraviolet rain',
    source: `dsp UltravioletRain where
  param lift : F32 := 0.66 range 0.15 1.0
  param motion : F32 := 0.36 range 0.0 0.8
  param echo : F32 := 0.47 range 0.0 0.78
  param shimmer : F32 := 0.42 range 0.0 1.0
  state t : F32 := 0.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state p4 : F32 := 0.0
  buffer rainA : F32[36000]
  buffer rainB : F32[44000]
  sample x =>
    let lfo := sinpi(t * 0.09)
    let chord := (sinpi(p1 * 2.0) + sinpi(p2 * 2.0) * 0.82 + sinpi(p3 * 2.0) * 0.72 + sinpi(p4 * 2.0) * shimmer * 0.45) * 0.25
    let pulse := 0.62 + 0.38 * sinpi(t * 0.47)
    let dry := chord * pulse * lift
    let da := taplin(rainA, 12300.0 + lfo * 620.0)
    let db := taplin(rainB, 19400.0 - lfo * 850.0)
    push rainA := dry + da * 0.51
    push rainB := dry * 0.78 + db * 0.46
    set p1 := fract(p1 + 110.0 * (1.0 + lfo * motion * 0.0018) / sr)
    set p2 := fract(p2 + 164.81 / sr)
    set p3 := fract(p3 + 220.0 * (1.0 - lfo * motion * 0.0012) / sr)
    set p4 := fract(p4 + 329.63 / sr)
    set t := t + 1.0 / sr
    return dry + da * echo * 0.52 + db * echo * 0.44`
  },
  songBass: {
    label: 'Long-form bass voice',
    source: `dsp LongFormBass where
  param freq : Hz @control := 55.0 range 24.0 220.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param tone : Unit @control := 0.32 range 0.04 0.95
  param drive : Gain @control := 1.8 range 0.5 5.0
  state phase : F32 := 0.0
  state subphase : F32 := 0.0
  state env : F32 := 0.0
  state lp : F32 := 0.0
  sample x =>
    let target := select(gt(gate, 0.5), 1.0, 0.0)
    let coeff := select(gt(target, env), 0.028, 0.0016)
    let nextEnv := env + coeff * (target - env)
    let saw := fract(phase) * 2.0 - 1.0
    let sub := sinpi(subphase * 2.0)
    let raw := softsign((saw * 0.72 + sub * 0.38) * drive) * nextEnv
    let cutoff := 0.018 + tone * 0.16
    let filtered := lp + cutoff * (raw - lp)
    set env := nextEnv
    set lp := filtered
    set phase := fract(phase + freq / sr)
    set subphase := fract(subphase + freq * 0.5 / sr)
    return filtered * 0.86`
  },
  songPad: {
    label: 'Long-form chord voice',
    source: `dsp LongFormPad where
  param root : Hz @control := 110.0 range 40.0 440.0
  param gate : Unit @control := 1.0 range 0.0 1.0
  param colour : Unit @control := 0.48 range 0.0 1.0
  param motion : Unit @control := 0.35 range 0.0 1.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state p4 : F32 := 0.0
  state env : F32 := 0.0
  state t : F32 := 0.0
  buffer hazeA : F32[30000]
  buffer hazeB : F32[42000]
  sample x =>
    let target := select(gt(gate, 0.5), 1.0, 0.0)
    let coeff := select(gt(target, env), 0.00032, 0.00008)
    let nextEnv := env + coeff * (target - env)
    let drift := sinpi(t * 0.071) * motion * 0.0022
    let a := sinpi(p1 * 2.0)
    let b := sinpi(p2 * 2.0)
    let c := sinpi(p3 * 2.0)
    let d := sinpi(p4 * 2.0)
    let chord := (a * 0.38 + b * 0.31 + c * 0.27 + d * 0.20 * colour) * nextEnv
    let da := taplin(hazeA, 12700.0 + sinpi(t * 0.11) * 480.0)
    let db := taplin(hazeB, 21100.0 - sinpi(t * 0.083) * 730.0)
    let wet := chord * 0.66 + da * 0.27 + db * 0.22
    push hazeA := chord + da * 0.47
    push hazeB := chord * 0.82 + db * 0.43
    set env := nextEnv
    set p1 := fract(p1 + root * (1.0 + drift) / sr)
    set p2 := fract(p2 + root * 1.189207 / sr)
    set p3 := fract(p3 + root * 1.498307 * (1.0 - drift) / sr)
    set p4 := fract(p4 + root * 2.0 / sr)
    set t := t + 1.0 / sr
    return wet * 0.72`
  },
  songLead: {
    label: 'Long-form lead voice',
    source: `dsp LongFormLead where
  param freq : Hz @control := 220.0 range 55.0 1760.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param glass : Unit @control := 0.52 range 0.0 1.0
  param echo : Unit @control := 0.36 range 0.0 0.78
  state phase : F32 := 0.0
  state modphase : F32 := 0.0
  state env : F32 := 0.0
  state t : F32 := 0.0
  buffer trail : F32[36000]
  sample x =>
    let target := select(gt(gate, 0.5), 1.0, 0.0)
    let coeff := select(gt(target, env), 0.06, 0.0022)
    let nextEnv := env + coeff * (target - env)
    let modv := sinpi(modphase * 2.0) * glass * 0.11
    let carrier := sinpi((phase + modv) * 2.0)
    let edge := fold((fract(phase) * 2.0 - 1.0) * (1.0 + glass * 1.7))
    let dry := (carrier * 0.72 + edge * 0.20) * nextEnv
    let delayed := taplin(trail, 13700.0 + sinpi(t * 0.17) * 320.0)
    push trail := dry + delayed * 0.41
    set env := nextEnv
    set phase := fract(phase + freq / sr)
    set modphase := fract(modphase + freq * 2.013 / sr)
    set t := t + 1.0 / sr
    return dry * 0.68 + delayed * echo`
  },
  songTexture: {
    label: 'Long-form texture voice',
    source: `dsp LongFormTexture where
  param density : Unit @control := 0.24 range 0.0 1.0
  param colour : Unit @control := 0.5 range 0.0 1.0
  param motion : Unit @control := 0.4 range 0.0 1.0
  param level : Unit @control := 0.3 range 0.0 1.0
  state counter : F32 := 1.0
  state lp : F32 := 0.0
  state t : F32 := 0.0
  buffer air : F32[28000]
  sample x =>
    let n := noise1(counter)
    let slow := 0.5 + 0.5 * sinpi(t * (0.031 + motion * 0.08))
    let grains := select(gt(noise1(counter * 0.071), 0.88 - density * 0.35), n, n * 0.08)
    let coeff := 0.003 + colour * 0.08
    let filtered := lp + coeff * (grains - lp)
    let delayed := taplin(air, 9600.0 + slow * 4200.0)
    let y := (filtered * 0.64 + delayed * 0.36) * level * (0.42 + slow * 0.58)
    push air := filtered + delayed * 0.52
    set lp := filtered
    set counter := counter + 1.0
    set t := t + 1.0 / sr
    return y`
  }
};

const fnArities = {
  abs:1,min:2,max:2,clip:3,softsign:1,quant:2,fract:1,wrap:1,fold:1,
  select:3,lt:2,le:2,gt:2,ge:2,sinpi:1,tanpi:1,expneg:1,noise1:1,asymclip:4,taplin:2
};

function tokenize(s){
  const out=[]; let i=0;
  while(i<s.length){
    const c=s[i]; if(/\s/.test(c)){i++;continue}
    const num=s.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if(num){out.push({t:'num',v:Number(num[0])});i+=num[0].length;continue}
    const id=s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if(id){out.push({t:'id',v:id[0]});i+=id[0].length;continue}
    if('()+-*/,'.includes(c)){out.push({t:c,v:c});i++;continue}
    throw new Error(`Unexpected token '${c}' in expression`);
  }
  out.push({t:'eof'}); return out;
}

function parseExpr(text,names){
  const ts=tokenize(text);let p=0;const peek=()=>ts[p],take=()=>ts[p++];
  const prec={'+':10,'-':10,'*':20,'/':20};
  function primary(){
    const t=take();
    if(t.t==='num')return{k:'num',v:t.v};
    if(t.t==='-')return{k:'neg',a:primary()};
    if(t.t==='('){const e=expr(0);if(take().t!==')')throw new Error('Missing )');return e}
    if(t.t==='id'){
      if(peek().t==='('){
        take();const args=[];
        if(peek().t!==')'){while(true){args.push(expr(0));if(peek().t===','){take();continue}break}}
        if(take().t!==')')throw new Error('Missing ) after function call');
        if(!(t.v in fnArities))throw new Error(`Function ${t.v} is not in LeanDSP/0.2`);
        if(args.length!==fnArities[t.v])throw new Error(`${t.v} expects ${fnArities[t.v]} argument(s)`);
        return{k:'call',fn:t.v,args};
      }
      if(!names.has(t.v))throw new Error(`Unknown identifier ${t.v}`);
      return{k:'var',v:t.v};
    }
    throw new Error(`Expected expression, got ${t.t}`);
  }
  function expr(min){let left=primary();while(prec[peek().t]>=min){const op=take().t,right=expr(prec[op]+1);left={k:'bin',op,a:left,b:right}}return left}
  const ast=expr(0);if(peek().t!=='eof')throw new Error('Unexpected trailing expression text');return ast;
}

function count(ast){if(!ast)return 0;if(ast.k==='num'||ast.k==='var')return 1;if(ast.k==='neg')return 1+count(ast.a);if(ast.k==='bin')return 1+count(ast.a)+count(ast.b);if(ast.k==='call')return 1+ast.args.reduce((n,a)=>n+count(a),0);return 9999}
function depth(ast){if(ast.k==='num'||ast.k==='var')return 1;if(ast.k==='neg')return 1+depth(ast.a);if(ast.k==='bin')return 1+Math.max(depth(ast.a),depth(ast.b));if(ast.k==='call')return 1+Math.max(...ast.args.map(depth));return 9999}
function f32(n){if(!Number.isFinite(n))throw new Error('Non-finite numeric literal');return `(f32.const ${Object.is(n,-0)?'-0':n})`}
const soft=a=>`(f32.div ${a} (f32.add (f32.const 1) (f32.abs ${a})))`;
function sinpiExpr(a){
  // Fast bounded sine approximation. Reduce cycles to r∈[-1,1), then parabolic sine + correction.
  const r=`(f32.sub ${a} (f32.mul (f32.floor (f32.mul (f32.add ${a} (f32.const 1)) (f32.const 0.5))) (f32.const 2)))`;
  const y=`(f32.mul (f32.const 4) (f32.mul ${r} (f32.sub (f32.const 1) (f32.abs ${r}))))`;
  return `(f32.add ${y} (f32.mul (f32.const 0.225) (f32.sub (f32.mul ${y} (f32.abs ${y})) ${y})))`;
}
function expnegExpr(a){
  // 1/(1+x+0.48x²+0.235x³), stable monotone approximation for x>=0.
  const x=`(f32.max (f32.const 0) ${a})`,x2=`(f32.mul ${x} ${x})`,x3=`(f32.mul ${x2} ${x})`;
  return `(f32.div (f32.const 1) (f32.add (f32.const 1) (f32.add ${x} (f32.add (f32.mul (f32.const 0.48) ${x2}) (f32.mul (f32.const 0.235) ${x3})))))`;
}
function noiseExpr(a){
  // Stateless deterministic hash-noise in [-1,1], useful with a monotonically increasing state counter.
  const q=`(f32.add (f32.mul ${a} (f32.const 0.1031)) (f32.const 0.11369))`;
  const fr=`(f32.sub ${q} (f32.floor ${q}))`;
  const mix=`(f32.mul ${fr} (f32.add ${fr} (f32.const 19.19)))`;
  const fr2=`(f32.sub ${mix} (f32.floor ${mix}))`;
  return `(f32.sub (f32.mul ${fr2} (f32.const 2)) (f32.const 1))`;
}

function wasm(ast,env){
  const w=a=>wasm(a,env);
  if(ast.k==='num')return f32(ast.v);
  if(ast.k==='var'){
    if(ast.v==='x')return'(local.get $x)';
    if(ast.v==='sr')return'(global.get $sr)';
    const e=env.get(ast.v);if(!e)throw new Error(`Unknown lowered name ${ast.v}`);
    if(e.kind==='buffer')throw new Error(`Buffer ${ast.v} may only be used through taplin()`);
    return e.kind==='state'?`(global.get $s_${ast.v})`:e.kind==='param'?`(local.get $p${e.index})`:`(local.get $l_${ast.v})`;
  }
  if(ast.k==='neg')return`(f32.neg ${w(ast.a)})`;
  if(ast.k==='bin')return`(${({'+':'f32.add','-':'f32.sub','*':'f32.mul','/':'f32.div'})[ast.op]} ${w(ast.a)} ${w(ast.b)})`;
  if(ast.fn==='taplin'){
    const b=ast.args[0];if(b?.k!=='var'||env.get(b.v)?.kind!=='buffer')throw new Error('taplin first argument must be a declared buffer');
    return `(call $tap_${b.v} ${w(ast.args[1])})`;
  }
  const A=ast.args.map(w);
  switch(ast.fn){
    case'abs':return`(f32.abs ${A[0]})`;
    case'min':return`(f32.min ${A[0]} ${A[1]})`;
    case'max':return`(f32.max ${A[0]} ${A[1]})`;
    case'clip':return`(f32.max ${A[1]} (f32.min ${A[2]} ${A[0]}))`;
    case'softsign':return soft(A[0]);
    case'quant':return`(f32.div (f32.nearest (f32.mul ${A[0]} ${A[1]})) ${A[1]})`;
    case'fract':return`(f32.sub ${A[0]} (f32.floor ${A[0]}))`;
    case'wrap':{const y=`(f32.mul (f32.add ${A[0]} (f32.const 1)) (f32.const 0.5))`;return`(f32.sub (f32.mul (f32.sub ${y} (f32.floor ${y})) (f32.const 2)) (f32.const 1))`;}
    case'fold':{const y=`(f32.mul (f32.add ${A[0]} (f32.const 1)) (f32.const 0.25))`,fr=`(f32.sub ${y} (f32.floor ${y}))`;return`(f32.sub (f32.abs (f32.sub (f32.mul ${fr} (f32.const 4)) (f32.const 2))) (f32.const 1))`;}
    case'lt':return`(f32.lt ${A[0]} ${A[1]})`;case'le':return`(f32.le ${A[0]} ${A[1]})`;case'gt':return`(f32.gt ${A[0]} ${A[1]})`;case'ge':return`(f32.ge ${A[0]} ${A[1]})`;
    case'select':return`(select ${A[1]} ${A[2]} ${A[0]})`;
    case'sinpi':return sinpiExpr(A[0]);
    case'tanpi':{const s=sinpiExpr(A[0]),c=sinpiExpr(`(f32.add ${A[0]} (f32.const 0.5))`);return`(f32.div ${s} ${c})`;}
    case'expneg':return expnegExpr(A[0]);
    case'noise1':return noiseExpr(A[0]);
    case'asymclip':{
      const y=`(f32.mul ${A[0]} ${A[1]})`,pos=soft(`(f32.div ${y} (f32.max (f32.const 0.0001) ${A[2]}))`),neg=soft(`(f32.div ${y} (f32.max (f32.const 0.0001) ${A[3]}))`);
      return`(select ${pos} ${neg} (f32.gt ${y} (f32.const 0)))`;
    }
  }
  throw new Error(`Unsupported function ${ast.fn}`);
}

function parseSource(source){
  const raw=source.split(/\r?\n/),lines=raw.map(x=>x.trim()).filter(x=>x&&!x.startsWith('--'));
  if(!lines.length)throw new Error('Empty LeanDSP source');
  const head=lines[0].match(/^dsp\s+([A-Za-z_][A-Za-z0-9_]*)\s+where$/);if(!head)throw new Error('Expected: dsp Name where');
  const params=[],states=[],buffers=[],statements=[];let sampleArg=null,inlineReturn=null,inBlock=false;
  for(const line of lines.slice(1)){
    let m=line.match(/^param\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(F32|Unit|Bipolar|Hz|Seconds|Milliseconds|Gain|MidiNote)(?:\s+@(audio|control|event))?\s*:=\s*(-?\d+(?:\.\d+)?)\s+range\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/);
    if(m){if(inBlock)throw new Error('param declarations must precede sample');if(params.length>=4)throw new Error('LeanDSP/0.3 leaf ABI supports at most four host parameters');const[,name,type,rate0,d,lo,hi]=m;if(params.some(p=>p.name===name)||states.some(s=>s.name===name)||buffers.some(b=>b.name===name))throw new Error(`Duplicate name ${name}`);const p={name,type,rate:rate0||'control',def:Number(d),lo:Number(lo),hi:Number(hi)};if(!(p.lo<=p.def&&p.def<=p.hi))throw new Error(`${name}: default must be inside declared range`);params.push(p);continue}
    m=line.match(/^state\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*F32\s*:=\s*(-?\d+(?:\.\d+)?)$/);
    if(m){if(inBlock)throw new Error('state declarations must precede sample');const s={name:m[1],init:Number(m[2])};if(params.some(p=>p.name===s.name)||states.some(x=>x.name===s.name)||buffers.some(b=>b.name===s.name))throw new Error(`Duplicate name ${s.name}`);states.push(s);if(states.length>16)throw new Error('LeanDSP/0.2 supports at most 16 F32 state cells');continue}
    m=line.match(/^buffer\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*F32\[(\d+)\]$/);
    if(m){if(inBlock)throw new Error('buffer declarations must precede sample');const b={name:m[1],len:Number(m[2])};if(b.len<2||b.len>120000)throw new Error(`${b.name}: buffer length must be 2..120000 samples`);if(params.some(p=>p.name===b.name)||states.some(s=>s.name===b.name)||buffers.some(x=>x.name===b.name))throw new Error(`Duplicate name ${b.name}`);buffers.push(b);continue}
    m=line.match(/^sample\s+([A-Za-z_][A-Za-z0-9_]*)\s*=>\s*(.*)$/);
    if(m){if(sampleArg)throw new Error('Only one sample definition is allowed');sampleArg=m[1];inBlock=true;if(m[2].trim())inlineReturn=m[2].trim();continue}
    if(!inBlock)throw new Error(`Unsupported declaration: ${line}`);
    m=line.match(/^let\s+([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*(.+)$/);if(m){statements.push({k:'let',name:m[1],text:m[2]});continue}
    m=line.match(/^set\s+([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*(.+)$/);if(m){statements.push({k:'set',name:m[1],text:m[2]});continue}
    m=line.match(/^push\s+([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*(.+)$/);if(m){statements.push({k:'push',name:m[1],text:m[2]});continue}
    m=line.match(/^return\s+(.+)$/);if(m){statements.push({k:'return',text:m[1]});continue}
    throw new Error(`Unsupported sample statement: ${line}`);
  }
  if(!sampleArg)throw new Error('Missing sample x => expression/block');if(sampleArg!=='x')throw new Error('LeanDSP sample argument must be x');
  if(inlineReturn)statements.push({k:'return',text:inlineReturn});if(!statements.some(s=>s.k==='return'))throw new Error('Sample block needs return expression');
  return{name:head[1],params,states,buffers,statements};
}

// Source inspection uses the same parser as compilation. Added parentheses preserve
// AST grouping; this printer does not simplify, inline, or reassociate F32 operations.
function sourceExpression(ast){
  if(ast.k==='num')return Object.is(ast.v,-0)?'-0':String(ast.v);
  if(ast.k==='var')return ast.v;
  if(ast.k==='neg')return `(-${sourceExpression(ast.a)})`;
  if(ast.k==='bin')return `(${sourceExpression(ast.a)} ${ast.op} ${sourceExpression(ast.b)})`;
  if(ast.k==='call')return `${ast.fn}(${ast.args.map(sourceExpression).join(', ')})`;
  throw new Error('Unknown expression in source inspector');
}
function expressionReferences(ast,refs=new Set(),calls=new Set()){
  if(ast.k==='var')refs.add(ast.v);
  if(ast.k==='call'){calls.add(ast.fn);for(const a of ast.args)expressionReferences(a,refs,calls);}
  if(ast.a)expressionReferences(ast.a,refs,calls);
  if(ast.b)expressionReferences(ast.b,refs,calls);
  return{refs:[...refs],calls:[...calls]};
}
export function inspectLeanDSP(source){
  const parsed=parseSource(source),nodes=[],edges=[],nameNode=new Map(),storageNode=new Map();let uid=0;
  const sourceLines=source.split(/\r?\n/).map((text,i)=>({sourceCode:text.trim(),sourceLine:i+1}));
  const declaration=(kind,name)=>sourceLines.find(l=>new RegExp('^'+kind+'\\s+'+name+'\\s*:').test(l.sourceCode))||{};
  const bodyLines=sourceLines.filter(l=>/^(let|set|push|return)\s/.test(l.sourceCode)||/^sample\s+x\s*=>\s*\S/.test(l.sourceCode));
  const add=(type,label,stage=0,detail='',meta={})=>{const id=`i${uid++}`;nodes.push({id,type,label,stage,detail,codeInputs:[],builtinNames:[],...meta});return id};
  const link=(from,to,kind='data')=>{if(from&&to)edges.push({from,to,kind})};
  const input=add('input','audio x',0,'sample input',{sourceKind:'input',sourceCode:'-- x: input sample supplied by the host',sourceLine:0});nameNode.set('x',input);
  const sr=add('input','sample rate',0,'sr',{sourceKind:'input',sourceCode:'-- sr: sample rate supplied by prepare(sampleRate)',sourceLine:0});nameNode.set('sr',sr);
  for(const p of parsed.params){const id=add('param',p.name,0,`${p.type||'F32'} @${p.rate||'control'} · ${p.def} · ${p.lo}…${p.hi}`,{edit:'param',name:p.name,def:p.def,lo:p.lo,hi:p.hi,semanticType:p.type||'F32',rate:p.rate||'control',sourceKind:'param',...declaration('param',p.name)});nameNode.set(p.name,id)}
  for(const s of parsed.states){const id=add('state',s.name,0,`state · init ${s.init}`,{edit:'state',name:s.name,init:s.init,probeName:s.name,sourceKind:'state',...declaration('state',s.name),measurementNote:'The state probe is stored after set; a source dependency stops at the state value on entry unless an earlier write is included.'});nameNode.set(s.name,id);storageNode.set(s.name,id)}
  for(const b of parsed.buffers){const id=add('buffer',b.name,0,`delay · ${b.len} samples`,{name:b.name,len:b.len,sourceKind:'buffer',...declaration('buffer',b.name)});nameNode.set(b.name,id);storageNode.set(b.name,id)}
  const names=new Set(['x','sr',...parsed.params.map(p=>p.name),...parsed.states.map(s=>s.name),...parsed.buffers.map(b=>b.name)]);
  const metaFor=(ast,location)=>{const r=expressionReferences(ast);return{expression:sourceExpression(ast),codeInputs:r.refs.map(name=>({name,nodeId:nameNode.get(name)})).filter(r=>r.nodeId),builtinNames:r.calls,...location};};
  const walk=(ast,stage,location)=>{
    if(ast.k==='num')return null;
    if(ast.k==='var')return nameNode.get(ast.v)||null;
    const meta=metaFor(ast,location);
    if(ast.k==='neg'){const id=add('op','neg',stage,'subexpression',meta);link(walk(ast.a,stage,location),id);return id}
    if(ast.k==='bin'){const id=add('op',ast.op,stage,'subexpression',meta);link(walk(ast.a,stage,location),id);link(walk(ast.b,stage,location),id);return id}
    if(ast.k==='call'){const id=add('fn',ast.fn,stage,'intrinsic call',meta);for(const a of ast.args)link(walk(a,stage,location),id);return id}
    return null;
  };
  let stage=1;
  for(const st of parsed.statements){
    const line=bodyLines[stage-1]||{},statement=st.k==='return'?'return '+st.text:`${st.k} ${st.name} := ${st.text}`;
    const location={sourceLine:line.sourceLine||0,sourceCode:statement,statementIndex:stage-1};
    const ast=parseExpr(st.text,names),first=nodes.length,root=walk(ast,stage,location),meta=metaFor(ast,location);let id;
    if(st.k==='let'){
      id=add('let',st.name,stage,st.text,{...meta,expression:st.text,edit:'let',name:st.name,text:st.text,probeName:st.name,sourceKind:'let'});link(root,id);nameNode.set(st.name,id);names.add(st.name);
    }else if(st.k==='set'){
      id=add('write',`set ${st.name}`,stage,'persistent state',{...meta,expression:st.text,sourceKind:'set',storageId:storageNode.get(st.name)});link(root,id);link(nameNode.get(st.name),id,'state');nameNode.set(st.name,id);
    }else if(st.k==='push'){
      id=add('write',`push ${st.name}`,stage,'delay write',{...meta,expression:st.text,sourceKind:'push',storageId:storageNode.get(st.name),previousStorageId:nameNode.get(st.name)});link(root,id);link(nameNode.get(st.name),id,'state');nameNode.set(st.name,id);
    }else if(st.k==='return'){
      id=add('output','audio out',stage,'return',{...meta,expression:st.text,probeName:'out',sourceKind:'return'});link(root,id);
    }
    for(let j=first;j<nodes.length;j++)nodes[j].ownerId=id;
    stage++;
  }
  return{name:parsed.name,nodes,edges,params:parsed.params,states:parsed.states,buffers:parsed.buffers};
}

export function compileLeanDSP(source,options={}){
  const debug=!!options.debug;
  const parsed=parseSource(source),env=new Map(),names=new Set(['x','sr']);
  parsed.params.forEach((p,i)=>{env.set(p.name,{kind:'param',index:i});names.add(p.name)});
  parsed.states.forEach(s=>{env.set(s.name,{kind:'state'});names.add(s.name)});
  parsed.buffers.forEach(b=>{env.set(b.name,{kind:'buffer'});names.add(b.name)});
  const lowered=[];let totalOps=0,maxDepth=0,seenReturn=false;
  for(const st of parsed.statements){
    if(seenReturn)throw new Error('No statements are allowed after return');
    if(st.k==='let'){
      if(names.has(st.name))throw new Error(`Duplicate/local shadowing name ${st.name}`);
      const ast=parseExpr(st.text,names);totalOps+=count(ast);maxDepth=Math.max(maxDepth,depth(ast));const scalarType=(ast.k==='call'&&['lt','le','gt','ge'].includes(ast.fn))?'i32':(ast.k==='var'?(env.get(ast.v)?.scalarType||'f32'):'f32');lowered.push({...st,ast,scalarType});env.set(st.name,{kind:'local',scalarType});names.add(st.name);
    }else if(st.k==='set'){
      if(!parsed.states.some(s=>s.name===st.name))throw new Error(`set target ${st.name} is not declared state`);
      const ast=parseExpr(st.text,names);totalOps+=count(ast);maxDepth=Math.max(maxDepth,depth(ast));lowered.push({...st,ast});
    }else if(st.k==='push'){
      if(!parsed.buffers.some(b=>b.name===st.name))throw new Error(`push target ${st.name} is not a declared buffer`);
      const ast=parseExpr(st.text,names);totalOps+=count(ast);maxDepth=Math.max(maxDepth,depth(ast));lowered.push({...st,ast});
    }else if(st.k==='return'){
      const ast=parseExpr(st.text,names);totalOps+=count(ast);maxDepth=Math.max(maxDepth,depth(ast));lowered.push({...st,ast});seenReturn=true;
    }
  }
  if(totalOps>320)throw new Error(`Program too large (${totalOps} AST nodes; max 320)`);if(maxDepth>48)throw new Error(`Expression too deep (${maxDepth}; max 48)`);
  const lets=lowered.filter(s=>s.k==='let');
  for(const b of parsed.buffers){if(lowered.filter(s=>s.k==='push'&&s.name===b.name).length>1)throw new Error(`Buffer ${b.name} may be pushed at most once per sample`)}
  const debugProbes=[];
  if(debug){
    for(const p of [{name:'x',type:'input'},{name:'sr',type:'input'},...parsed.params.map(p=>({name:p.name,type:'param'}))])debugProbes.push({...p,index:debugProbes.length});
    const seen=new Set(debugProbes.map(p=>p.name));
    for(const st of lowered){
      const name=st.k==='let'?st.name:st.k==='set'?st.name:st.k==='return'?'out':null;
      if(name&&!seen.has(name)){seen.add(name);debugProbes.push({name,type:st.k==='set'?'state':st.k==='return'?'output':'let',index:debugProbes.length})}
    }
  }
  let cursor=8192;const buffers=parsed.buffers.map(b=>{const x={...b,base:cursor,bytes:b.len*4};cursor+=x.bytes;return x});
  const debugStride=256,debugBase=cursor,debugBytes=debugProbes.length*debugStride*4;cursor+=debugBytes;
  const pages=Math.max(1,Math.ceil(cursor/65536));if(pages>8)throw new Error(`Fixed memory requirement ${pages} pages exceeds LeanDSP/0.2 limit of 8`);
  for(const b of buffers)env.set(b.name,{kind:'buffer',...b});
  const stateGlobals=parsed.states.map(s=>`  (global $s_${s.name} (mut f32) ${f32(s.init)})`).join('\n');
  const bufferGlobals=buffers.map(b=>`  (global $b_${b.name}_idx (mut i32) (i32.const 0))`).join('\n');
  const globals=[stateGlobals,bufferGlobals].filter(Boolean).join('\n');
  const stateReset=parsed.states.map(s=>`    (global.set $s_${s.name} ${f32(s.init)})`).join('\n');
  const bufferReset=buffers.map(b=>`    (global.set $b_${b.name}_idx (i32.const 0))\n    (memory.fill (i32.const ${b.base}) (i32.const 0) (i32.const ${b.bytes}))`).join('\n');
  const debugReset=debugBytes?`    (memory.fill (i32.const ${debugBase}) (i32.const 0) (i32.const ${debugBytes}))`:'';
  const reset=[stateReset,bufferReset,debugReset].filter(Boolean).join('\n');
  const locals=lets.map(s=>` (local $l_${s.name} ${s.scalarType||'f32'})`).join('')+(debug?' (local $l___out f32)':'');
  const tapHelpers=buffers.map(b=>`  (func $tap_${b.name} (param $d f32) (result f32)\n    (local $di i32) (local $frac f32) (local $i0 i32) (local $i1 i32)\n    (local.set $d (f32.max (f32.const 1) (f32.min (f32.const ${b.len-1}) (local.get $d))))\n    (local.set $di (i32.trunc_f32_s (f32.floor (local.get $d))))\n    (local.set $frac (f32.sub (local.get $d) (f32.convert_i32_s (local.get $di))))\n    (local.set $i0 (i32.rem_u (i32.add (i32.sub (global.get $b_${b.name}_idx) (local.get $di)) (i32.const ${b.len})) (i32.const ${b.len})))\n    (local.set $i1 (i32.rem_u (i32.add (i32.sub (local.get $i0) (i32.const 1)) (i32.const ${b.len})) (i32.const ${b.len})))\n    (f32.add\n      (f32.mul (f32.load (i32.add (i32.const ${b.base}) (i32.shl (local.get $i0) (i32.const 2)))) (f32.sub (f32.const 1) (local.get $frac)))\n      (f32.mul (f32.load (i32.add (i32.const ${b.base}) (i32.shl (local.get $i1) (i32.const 2)))) (local.get $frac)))\n  )`).join('\n');
  const probeSlot=new Map(debugProbes.map(p=>[p.name,p.index]));
  const dbgStore=(name,value)=>{if(!debug||!probeSlot.has(name))return'';const slot=probeSlot.get(name),base=debugBase+slot*debugStride*4;return`\n        (if (i32.lt_u (local.get $i) (i32.const ${debugStride})) (then (f32.store (i32.add (i32.const ${base}) (i32.shl (local.get $i) (i32.const 2))) ${value})))`};
  const pushCode=st=>{const b=buffers.find(x=>x.name===st.name);return`        (f32.store (i32.add (i32.const ${b.base}) (i32.shl (global.get $b_${b.name}_idx) (i32.const 2))) ${wasm(st.ast,env)})\n        (global.set $b_${b.name}_idx (i32.rem_u (i32.add (global.get $b_${b.name}_idx) (i32.const 1)) (i32.const ${b.len})))`};
  const inputProbes=debug?(dbgStore('x','(local.get $x)')+dbgStore('sr','(global.get $sr)')+parsed.params.map((p,i)=>dbgStore(p.name,`(local.get $p${i})`)).join('')+'\n'):'';
  const body=inputProbes+lowered.map(st=>{
    if(st.k==='let')return`        (local.set $l_${st.name} ${wasm(st.ast,env)})${dbgStore(st.name,st.scalarType==='i32'?`(f32.convert_i32_s (local.get $l_${st.name}))`:`(local.get $l_${st.name})`)}`;
    if(st.k==='set')return`        (global.set $s_${st.name} ${wasm(st.ast,env)})${dbgStore(st.name,`(global.get $s_${st.name})`)}`;
    if(st.k==='push')return pushCode(st);
    if(debug)return`        (local.set $l___out ${wasm(st.ast,env)})\n        (f32.store (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2))) (local.get $l___out))${dbgStore('out','(local.get $l___out)')}`;
    return`        (f32.store (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2))) ${wasm(st.ast,env)})`;
  }).join('\n');
  const wat=`(module\n  (memory (export "memory") ${pages} ${pages})\n  (global $sr (mut f32) (f32.const 48000))\n${globals}${globals?'\n':''}${tapHelpers}${tapHelpers?'\n':''}  (func (export "prepare") (param $rate f32) (global.set $sr (local.get $rate)))\n  (func (export "reset")\n${reset||'    nop'}\n  )\n  (func (export "process") (param $in i32) (param $out i32) (param $n i32) (param $p0 f32) (param $p1 f32) (param $p2 f32) (param $p3 f32)\n    (local $i i32) (local $x f32)${locals}\n    (block $done\n      (loop $loop\n        (br_if $done (i32.ge_u (local.get $i) (local.get $n)))\n        (local.set $x (f32.load (i32.add (local.get $in) (i32.shl (local.get $i) (i32.const 2)))))\n${body}\n        (local.set $i (i32.add (local.get $i) (i32.const 1)))\n        (br $loop))))\n)`;
  const padded=[...parsed.params];while(padded.length<4)padded.push({name:`spare${padded.length}`,def:0,lo:0,hi:1});
  const bufferSamples=buffers.reduce((n,b)=>n+b.len,0);
  return{
    version:'LeanDSP/0.3',name:parsed.name,wat,params:padded,states:parsed.states,buffers,pages,astNodes:totalOps,depth:maxDepth,
    debug:debug?{base:debugBase,stride:debugStride,probes:debugProbes}:null,
    checks:[
      '✓ parsed into closed LeanDSP/0.3 leaf program',
      '✓ semantic scalar parameters lower to F32 with explicit finite ranges/rates',
      `✓ structurally bounded: ${totalOps} AST nodes, max expression depth ${maxDepth}`,
      `✓ persistent scalar state bounded statically: ${parsed.states.length} / 16 cells`,
      `✓ delay buffers statically bounded: ${bufferSamples} samples across ${buffers.length} buffer(s), ${pages} fixed Wasm page(s)`,
      '✓ no user loops, recursion, allocation, imports, filesystem or network',
      '✓ only generated render loop; bound is exactly host-supplied frame count',
      '✓ fixed linear memory; generated module contains no memory.grow',
      '✓ sample-rate supplied explicitly through prepare(rate)',
      '✓ deterministic state/buffer reset exported; source/noise nodes can be reproducible'
    ]
  };
}