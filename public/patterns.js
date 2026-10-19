import {GENERATED} from './families.js';
// JigDAW pattern library. Original, inspectable LeanDSP source.
// These declarations are mirrored in the pinned native Lean 4 build; the active runtime executes only hash-matched native-build artifacts. Lean proofs are produced offline, not re-run by the browser.
const voiceHead=(name,life=1)=>`dsp ${name} where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := ${life.toFixed(2)} range 0.03 8.0`;
const strikeState=`  state env : F32 := 0.0
  state previous : F32 := 0.0`;
const strike=`    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude`;
const sustain=(attack=.025)=>`    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (${attack} * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude`;
const bank={};
function add(id,label,family,about,source,tags=[]){bank[id]={id,label,family,about,source,tags,implementation:'LeanDSP native Lean build → typed Wasm subset → Wasm',certification:'CertifiedProgram recorded by the pinned native Lean build; browser runtime verifies catalog/source/WAT/Wasm hashes and WebAssembly validity, not the Lean proofs'};}
add('roundBass','Velvet sub','Bass','A sine fundamental with a restrained second harmonic; sample-rate-aware attack/release and saturation.',`${voiceHead('VelvetSub',.55)}
  state phase : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
${sustain(.006)}
    let fundamental := sinpi(phase * 2.0)
    let harmonic := sinpi(phase * 4.0) * colour * 0.22
    let body := softsign((fundamental + harmonic) * 1.4) * amplitude
    set phase := fract(phase + freq / sr)
    return body * 0.72`,['phase','AR envelope','saturation']);
add('acidBass','Amber ladder','Bass','Band-limited saw and sub into a moving two-integrator filter. The envelope opens the cutoff on each note.',`${voiceHead('AmberLadder',.45)}
  state phase : F32 := 0.0
  state env : F32 := 0.0
  state ic1 : F32 := 0.0
  state ic2 : F32 := 0.0
  sample x =>
${sustain(.004)}
    let dt := min(freq / sr, 0.4)
    let t0 := phase / dt
    let t1 := (phase - 1.0) / dt
    let correction := select(lt(phase, dt), t0 + t0 - t0 * t0 - 1.0, select(gt(phase, 1.0 - dt), t1 * t1 + t1 + t1 + 1.0, 0.0))
    let saw := phase * 2.0 - 1.0 - correction
    let raw := (saw * 0.65 + sinpi(phase * 2.0) * 0.35) * amplitude
    let g := tanpi(min(0.18, (130.0 + colour * 2400.0 * amplitude) / sr))
    let k := 1.35 - colour * 0.55
    let a := 1.0 / (1.0 + g * (g + k))
    let v1 := a * (ic1 + g * (raw - ic2))
    let v2 := ic2 + g * v1
    set ic1 := 2.0 * v1 - ic1
    set ic2 := 2.0 * v2 - ic2
    set phase := fract(phase + dt)
    return softsign(v2 * 1.65) * 0.8`,['polyBLEP','TPT filter','nonlinearity']);
add('tine','Velvet tines','Keys','Decaying frequency modulation with a soft fundamental: electric-piano-like attacks without sampled recordings.',`${voiceHead('VelvetTines',2.4)}
  state phase : F32 := 0.0
  state modphase : F32 := 0.0
${strikeState}
  sample x =>
${strike}
    let modulator := sinpi(modphase * 2.0) * (0.06 + colour * 0.22) * amplitude
    let tine := sinpi((phase + modulator) * 2.0)
    let body := sinpi(phase * 2.0)
    let y := (tine * 0.68 + body * 0.32) * amplitude
    set phase := fract(phase + freq / sr)
    set modphase := fract(modphase + freq * 2.003 / sr)
    return y * 0.52`,['FM','strike envelope','inharmonicity']);
add('glass','Prismatic bell','Mallet','An inharmonic FM bell with a second shimmering partial. Brightness falls with the strike envelope.',`${voiceHead('PrismaticBell',2.5)}
  state phase : F32 := 0.0
  state modphase : F32 := 0.0
  state highphase : F32 := 0.0
${strikeState}
  sample x =>
${strike}
    let modulator := sinpi(modphase * 2.0) * colour * 0.24 * amplitude
    let bell := sinpi((phase + modulator) * 2.0)
    let shimmer := sinpi(highphase * 2.0) * amplitude * 0.13
    set phase := fract(phase + freq / sr)
    set modphase := fract(modphase + freq * 2.718 / sr)
    set highphase := fract(highphase + freq * 4.01 / sr)
    return (bell + shimmer) * amplitude * 0.40`,['inharmonic FM','additive partial','strike']);
add('pluck','Orchard string','String','A genuinely stateful plucked delay loop: noise excitation, fractional-length string and damped feedback, not a pluck-shaped oscillator.',`${voiceHead('OrchardString',1.8)}
  state previous : F32 := 0.0
  state burst : F32 := 0.0
  state seed : F32 := 0.123
  buffer string : F32[4096]
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let excitation := select(trigger, gate, burst * 0.90)
    let noise := noise1(seed * 8191.0)
    let length := min(4093.0, sr / max(24.0, freq) - 0.5)
    let a := taplin(string, length)
    let b := taplin(string, length + 1.0)
    let damping := 0.22 + colour * 0.28
    let wave := a * (1.0 - damping) + b * damping
    let feedback := min(0.9998, expneg(5.0 / (max(24.0, freq) * life)))
    let driven := clip(wave * feedback + noise * excitation * 0.45, -1.5, 1.5)
    push string := driven
    set previous := gate
    set burst := excitation
    set seed := fract(seed + 0.75487767)
    return wave * 0.8`,['fractional delay','excitation','causal feedback']);
add('felt','Felt mallet','Mallet','Three slowly detuned modal partials, with a rounded transient and a deliberately quieter upper resonance.',`${voiceHead('FeltMallet',1.6)}
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state soft : F32 := 0.0
${strikeState}
  sample x =>
${strike}
    let strikeBody := sinpi(phase * 2.0) + sinpi(p2 * 2.0) * colour * amplitude * 0.26 + sinpi(p3 * 2.0) * amplitude * 0.07
    let rounded := soft + 0.12 * (amplitude - soft)
    set soft := rounded
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 2.756 / sr)
    set p3 := fract(p3 + freq * 5.404 / sr)
    return strikeBody * rounded * 0.55`,['modal partials','rounded attack','decay']);
add('silk','Silk ensemble','Pad','Each note is a slow detuned three-oscillator voice. Chords are separate runtime voices with independent state.',`${voiceHead('SilkEnsemble',2.6)}
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state lfo : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
${sustain(.32)}
    let drift := sinpi(lfo * 2.0) * 0.0018
    let a := sinpi(phase * 2.0)
    let b := sinpi(p2 * 2.0)
    let c := sinpi(p3 * 2.0)
    let sheen := sinpi(phase * 4.0) * colour * 0.17
    set phase := fract(phase + freq * (0.998 + drift) / sr)
    set p2 := fract(p2 + freq * 1.0025 / sr)
    set p3 := fract(p3 + freq / sr)
    set lfo := fract(lfo + 0.17 / sr)
    return (a * 0.32 + b * 0.31 + c * 0.28 + sheen) * amplitude * 0.40`,['detuned voices','slow AR','phase LFO']);
add('choir','Distant vowels','Pad','A synthetic vowel-like partial cluster, slowly changing between warm and hollow spectra. No voice samples.',`${voiceHead('DistantVowels',3.0)}
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state lfo : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
${sustain(.65)}
    let breath := 0.78 + 0.22 * sinpi(lfo * 2.0)
    let fundamental := sinpi(phase * 2.0) * 0.65
    let formantA := sinpi(phase * 6.0) * (0.15 + colour * 0.17)
    let formantB := sinpi(p2 * 10.0) * (0.22 - colour * 0.14)
    let upper := sinpi(p2 * 14.0) * 0.06
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 1.0015 / sr)
    set lfo := fract(lfo + 0.071 / sr)
    return (fundamental + formantA + formantB + upper) * amplitude * breath * 0.30`,['formant-like partials','breath LFO','slow envelope']);
add('organ','Nocturnal drawbars','Keys','Harmonic drawbar synthesis with subtle tremolo. Clean sustained chords and gentle key clicks.',`${voiceHead('NocturnalDrawbars',.8)}
  state phase : F32 := 0.0
  state env : F32 := 0.0
  state lfo : F32 := 0.0
  sample x =>
${sustain(.013)}
    let tone := sinpi(phase * 2.0) * 0.55 + sinpi(phase * 4.0) * 0.22 + sinpi(phase * 6.0) * colour * 0.28 + sinpi(phase * 8.0) * 0.08
    let tremolo := 0.9 + 0.1 * sinpi(lfo * 2.0)
    set phase := fract(phase + freq / sr)
    set lfo := fract(lfo + 4.8 / sr)
    return tone * amplitude * tremolo * 0.45`,['harmonic bank','tremolo','sustain']);
add('pulse','Chrome sequence','Sequence','Band-limited saw shaped by a short strike envelope and a colour-dependent low-pass; suitable for long evolving arpeggios.',`${voiceHead('ChromeSequence',.36)}
  state phase : F32 := 0.0
  state lp : F32 := 0.0
${strikeState}
  sample x =>
${strike}
    let dt := min(freq / sr, 0.4)
    let ta := phase / dt
    let tb := (phase - 1.0) / dt
    let correction := select(lt(phase, dt), ta + ta - ta * ta - 1.0, select(gt(phase, 1.0 - dt), tb * tb + tb + tb + 1.0, 0.0))
    let saw := (phase * 2.0 - 1.0 - correction) * amplitude
    let a := 1.0 - expneg(6.283185 * (250.0 + colour * 4800.0 * amplitude) / sr)
    let filtered := lp + a * (saw - lp)
    set phase := fract(phase + dt)
    set lp := filtered
    return softsign(filtered * 1.4) * 0.55`,['polyBLEP','decaying filter','strike']);
add('rain','Breathing rain','Texture','Bounded deterministic hash noise through two smoothing stages; a pitched air overtone gives the texture harmonic context.',`${voiceHead('BreathingRain',2.8)}
  state seed : F32 := 0.31
  state lo : F32 := 0.0
  state hi : F32 := 0.0
  state env : F32 := 0.0
  state phase : F32 := 0.0
  state lfo : F32 := 0.0
  sample x =>
${sustain(.4)}
    let noise := noise1(seed * 7919.0)
    let low := lo + 0.012 * (noise - lo)
    let high := hi + (0.045 + colour * 0.15) * (noise - hi)
    let breath := 0.6 + sinpi(lfo * 2.0) * 0.4
    let air := (high - low) * 0.50 + sinpi(phase * 2.0) * 0.055
    set lo := low
    set hi := high
    set seed := fract(seed + 0.61803399)
    set phase := fract(phase + freq * 2.0 / sr)
    set lfo := fract(lfo + 0.11 / sr)
    return air * amplitude * breath * 0.5`,['bounded PRNG','noise bands','slow modulation']);
add('shepard','Impossible ascent','Psychoacoustic','A continuously rising Shepard/Risset-style stack: five octave bands climb forever while sine-shaped amplitude windows hide each octave wrap.',`${voiceHead('ImpossibleAscent',3.5)}
  state rise : F32 := 0.0
  state p0 : F32 := 0.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state p4 : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
${sustain(.08)}
    let base := min(110.0, max(24.0, freq * 0.25))
    let speed := 0.015 + colour * 0.055
    let q0 := fract(rise)
    let q1 := fract(rise + 0.2)
    let q2 := fract(rise + 0.4)
    let q3 := fract(rise + 0.6)
    let q4 := fract(rise + 0.8)
    let r0 := 1.0 / expneg(q0 * 0.693147)
    let r1 := 1.0 / expneg(q1 * 0.693147)
    let r2 := 1.0 / expneg(q2 * 0.693147)
    let r3 := 1.0 / expneg(q3 * 0.693147)
    let r4 := 1.0 / expneg(q4 * 0.693147)
    let a0 := sinpi(q0)
    let a1 := sinpi(q1)
    let a2 := sinpi(q2)
    let a3 := sinpi(q3)
    let a4 := sinpi(q4)
    let y := (sinpi(p0 * 2.0) * a0 + sinpi(p1 * 2.0) * a1 + sinpi(p2 * 2.0) * a2 + sinpi(p3 * 2.0) * a3 + sinpi(p4 * 2.0) * a4) * amplitude
    set p0 := fract(p0 + base * r0 / sr)
    set p1 := fract(p1 + base * 2.0 * r1 / sr)
    set p2 := fract(p2 + base * 4.0 * r2 / sr)
    set p3 := fract(p3 + base * 8.0 * r3 / sr)
    set p4 := fract(p4 + base * 16.0 * r4 / sr)
    set rise := fract(rise + speed / sr)
    return softsign(y * 0.48) * 0.72`,['Shepard illusion','octave wrap','psychoacoustic']);

add('phantomRoot','Phantom root','Psychoacoustic','The fundamental is absent: only harmonics 2, 3, 4 and 5 are generated, yet the ear tends to hear the missing root pitch.',`${voiceHead('PhantomRoot',1.8)}
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state p4 : F32 := 0.0
  state p5 : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
${sustain(.018)}
    let h2 := sinpi(p2 * 2.0) * 0.44
    let h3 := sinpi(p3 * 2.0) * (0.34 + colour * 0.10)
    let h4 := sinpi(p4 * 2.0) * 0.24
    let h5 := sinpi(p5 * 2.0) * (0.12 + colour * 0.12)
    set p2 := fract(p2 + freq * 2.0 / sr)
    set p3 := fract(p3 + freq * 3.0 / sr)
    set p4 := fract(p4 + freq * 4.0 / sr)
    set p5 := fract(p5 + freq * 5.0 / sr)
    return softsign((h2 + h3 + h4 + h5) * amplitude * 1.2) * 0.60`,['missing fundamental','harmonic stack','psychoacoustic']);

add('ghostBeat','Ghost beating','Psychoacoustic','Two almost coincident tones create a slow interference pulse. There is no tremolo oscillator: the amplitude motion is the acoustic beat itself.',`${voiceHead('GhostBeating',2.4)}
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
${sustain(.025)}
    let detune := 0.0007 + colour * 0.0042
    let a := sinpi(p1 * 2.0)
    let b := sinpi(p2 * 2.0)
    set p1 := fract(p1 + freq / sr)
    set p2 := fract(p2 + freq * (1.0 + detune) / sr)
    return (a + b) * amplitude * 0.30`,['acoustic beating','detune','interference']);
add('sineVox','Three-sine voice','Vocal','A sine-wave-speech vowel source: three pure tones trace a five-vowel F1/F2/F3 space. No vocal sample, pulse train or formant filter is used.',`${voiceHead('ThreeSineVoice',.65)}
  state f1phase : F32 := 0.0
  state f2phase : F32 := 0.0
  state f3phase : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
${sustain(.012)}
    let vowel := min(3.999, colour * 4.0)
    let morph := fract(vowel)
    let f1a := select(lt(vowel, 1.0), 800.0, select(lt(vowel, 2.0), 500.0, select(lt(vowel, 3.0), 300.0, 500.0)))
    let f1b := select(lt(vowel, 1.0), 500.0, select(lt(vowel, 2.0), 300.0, select(lt(vowel, 3.0), 500.0, 350.0)))
    let f2a := select(lt(vowel, 1.0), 1200.0, select(lt(vowel, 2.0), 1900.0, select(lt(vowel, 3.0), 2300.0, 900.0)))
    let f2b := select(lt(vowel, 1.0), 1900.0, select(lt(vowel, 2.0), 2300.0, select(lt(vowel, 3.0), 900.0, 800.0)))
    let f3a := select(lt(vowel, 1.0), 2500.0, select(lt(vowel, 2.0), 2600.0, select(lt(vowel, 3.0), 3000.0, 2400.0)))
    let f3b := select(lt(vowel, 1.0), 2600.0, select(lt(vowel, 2.0), 3000.0, select(lt(vowel, 3.0), 2400.0, 2200.0)))
    let f1 := f1a + (f1b - f1a) * morph
    let f2 := f2a + (f2b - f2a) * morph
    let f3 := f3a + (f3b - f3a) * morph
    let y := sinpi(f1phase * 2.0) * 0.58 + sinpi(f2phase * 2.0) * 0.43 + sinpi(f3phase * 2.0) * 0.25
    set f1phase := fract(f1phase + f1 / sr)
    set f2phase := fract(f2phase + f2 / sr)
    set f3phase := fract(f3phase + f3 / sr)
    return y * amplitude * 0.46`,['sine-wave speech','F1/F2/F3','five-vowel morph']);

add('sineChoir','Six-sine choir','Vocal','A choral extension of the three-sine voice: two slightly detuned copies of each formant trajectory create a small synthetic chorus with no sampled or pulse-train voice source.',`${voiceHead('SixSineChoir',1.2)}
  state f1a : F32 := 0.0
  state f1b : F32 := 0.0
  state f2a : F32 := 0.0
  state f2b : F32 := 0.0
  state f3a : F32 := 0.0
  state f3b : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
${sustain(.035)}
    let vowel := min(3.999, colour * 4.0)
    let morph := fract(vowel)
    let x1 := select(lt(vowel, 1.0), 800.0, select(lt(vowel, 2.0), 500.0, select(lt(vowel, 3.0), 300.0, 500.0)))
    let y1 := select(lt(vowel, 1.0), 500.0, select(lt(vowel, 2.0), 300.0, select(lt(vowel, 3.0), 500.0, 350.0)))
    let x2 := select(lt(vowel, 1.0), 1200.0, select(lt(vowel, 2.0), 1900.0, select(lt(vowel, 3.0), 2300.0, 900.0)))
    let y2 := select(lt(vowel, 1.0), 1900.0, select(lt(vowel, 2.0), 2300.0, select(lt(vowel, 3.0), 900.0, 800.0)))
    let x3 := select(lt(vowel, 1.0), 2500.0, select(lt(vowel, 2.0), 2600.0, select(lt(vowel, 3.0), 3000.0, 2400.0)))
    let y3 := select(lt(vowel, 1.0), 2600.0, select(lt(vowel, 2.0), 3000.0, select(lt(vowel, 3.0), 2400.0, 2200.0)))
    let form1 := x1 + (y1 - x1) * morph
    let form2 := x2 + (y2 - x2) * morph
    let form3 := x3 + (y3 - x3) * morph
    let spread := 0.0017
    let tone1 := sinpi(f1a * 2.0) + sinpi(f1b * 2.0)
    let tone2 := sinpi(f2a * 2.0) + sinpi(f2b * 2.0)
    let tone3 := sinpi(f3a * 2.0) + sinpi(f3b * 2.0)
    set f1a := fract(f1a + form1 * (1.0 - spread) / sr)
    set f1b := fract(f1b + form1 * (1.0 + spread) / sr)
    set f2a := fract(f2a + form2 * (1.0 - spread) / sr)
    set f2b := fract(f2b + form2 * (1.0 + spread) / sr)
    set f3a := fract(f3a + form3 * (1.0 - spread) / sr)
    set f3b := fract(f3b + form3 * (1.0 + spread) / sr)
    return (tone1 * 0.28 + tone2 * 0.20 + tone3 * 0.12) * amplitude * 0.48`,['sine-wave speech','chorus beating','six formant tones']);
add('speechGesture','Speech gestures','Vocal','A compact companion for sine-wave vowels: brief stop-like noise, nasal tones and approximant whistles selected by the event colour.',`${voiceHead('SpeechGestures',.16)}
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.37
  state lp : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
${sustain(.0025)}
    let n := noise1(seed * 8111.0)
    let noiseCoefficient := 0.04 + colour * 0.22
    let filtered := lp + noiseCoefficient * (n - lp)
    let burst := n - filtered
    let nasal := sinpi(p1 * 2.0) * 0.62 + sinpi(p2 * 2.0) * 0.22
    let glide := sinpi(p2 * 2.0) * 0.55 + sinpi(p1 * 2.0) * 0.18
    let gesture := select(lt(colour, 0.34), burst * (0.55 + colour), select(lt(colour, 0.64), nasal, glide))
    set p1 := fract(p1 + (160.0 + colour * 260.0) / sr)
    set p2 := fract(p2 + (520.0 + colour * 1180.0) / sr)
    set seed := fract(seed + 0.75487767)
    set lp := filtered
    return gesture * amplitude * 0.42`,['consonant gesture','noise burst','nasal/approximant']);
add('kick','Round membrane','Drums','Pitch-swept sine membrane with a separate short transient and a decay in seconds.',`${voiceHead('RoundMembrane',.48)}
  state phase : F32 := 0.0
  state snap : F32 := 0.0
${strikeState}
  sample x =>
${strike}
    let pitchEnv := select(trigger, 1.0, snap * expneg(1.0 / (0.018 * sr)))
    let tone := sinpi(phase * 2.0)
    let transient := sinpi(phase * 8.0) * pitchEnv * colour * 0.16
    set snap := pitchEnv
    set phase := fract(phase + (freq + pitchEnv * (90.0 + colour * 110.0)) / sr)
    return softsign((tone + transient) * amplitude * 1.5) * 0.85`,['pitch envelope','membrane','strike']);
add('snare','Paper snare','Drums','Two body resonances and high-passed noise. The noise and body have different decay shapes.',`${voiceHead('PaperSnare',.25)}
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.43
  state low : F32 := 0.0
${strikeState}
  sample x =>
${strike}
    let noise := noise1(seed * 8171.0)
    let lp := low + 0.13 * (noise - low)
    let wire := (noise - lp) * (0.26 + colour * 0.46) * amplitude * amplitude
    let body := (sinpi(phase * 2.0) + sinpi(p2 * 2.0) * 0.6) * amplitude * 0.26
    set low := lp
    set seed := fract(seed + 0.75487767)
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 1.37 / sr)
    return (wire + body) * 0.58`,['noise + resonances','high-pass','dual decay']);
add('hat','Metallic hat','Drums','Inharmonic oscillators blended with bright noise; closed and open hats share the source but not state or decay.',`${voiceHead('MetallicHat',.09)}
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.731
  state low : F32 := 0.0
${strikeState}
  sample x =>
${strike}
    let noise := noise1(seed * 8117.0)
    let metal := sinpi(phase * 2.0) * sinpi(p2 * 2.0)
    let raw := noise * 0.66 + metal * colour * 0.34
    let lp := low + 0.35 * (raw - low)
    set low := lp
    set seed := fract(seed + 0.5698403)
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 1.483 / sr)
    return (raw - lp) * amplitude * 0.42`,['inharmonic metal','noise','shared component']);
add('clap','Room hands','Drums','A three-burst exciter feeding a filtered-noise tail; independent state per handclap voice.',`${voiceHead('RoomHands',.26)}
  state age : F32 := 8.0
  state seed : F32 := 0.173
  state low : F32 := 0.0
${strikeState}
  sample x =>
${strike}
    let t := select(trigger, 0.0, min(8.0, age + 1.0 / sr))
    let bursts := select(lt(t, 0.031), select(lt(fract(t * 100.0), 0.4), 1.0, 0.15), amplitude)
    let n := noise1(seed * 8153.0)
    let filtered := low + (0.08 + colour * 0.14) * (n - low)
    set low := filtered
    set age := t
    set seed := fract(seed + 0.75487767)
    return (n - filtered) * bursts * amplitude * 0.42`,['burst train','noise','envelope']);
add('tom','Ceramic resonator','Drums','A damped sine with an intentional downward pitch envelope plus a weak non-harmonic rim resonance; shared by three toms and the rim voice.',`${voiceHead('CeramicResonator',.44)}
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
${strikeState}
  sample x =>
${strike}
    let body := sinpi(phase * 2.0)
    let pitchBend := 0.025 + colour * 0.09
    let rim := sinpi(p2 * 2.0) * amplitude * colour * colour * 0.40
    set phase := fract(phase + freq * (1.0 + amplitude * pitchBend) / sr)
    set p2 := fract(p2 + freq * 2.73 / sr)
    return (body + rim) * amplitude * 0.66`,['modal pitch','downward pitch envelope','shared tuning']);
add('chamber','Diffuse chamber','Space','Four damped feedback combs followed by a short allpass. The feedback is explicit in the source and separate from musical note voices.',`dsp DiffuseChamber where
  param room : Unit @control := 0.62 range 0.0 1.0
  param damp : Unit @control := 0.45 range 0.0 1.0
  param spread : Unit @control := 0.3 range 0.0 1.0
  param wet : Unit @control := 1.0 range 0.0 1.0
  state z1 : F32 := 0.0
  state z2 : F32 := 0.0
  state z3 : F32 := 0.0
  state z4 : F32 := 0.0
  buffer combA : F32[8192]
  buffer combB : F32[8192]
  buffer combC : F32[8192]
  buffer combD : F32[8192]
  buffer diffuser : F32[4096]
  sample x =>
    let a := taplin(combA, min(8190.0, sr * (0.0311 + spread * 0.0011)))
    let b := taplin(combB, min(8190.0, sr * (0.0373 + spread * 0.0017)))
    let c := taplin(combC, min(8190.0, sr * (0.0419 + spread * 0.0013)))
    let d := taplin(combD, min(8190.0, sr * (0.0479 + spread * 0.0019)))
    let coefficient := 0.55 - damp * 0.42
    let fa := z1 + coefficient * (a - z1)
    let fb := z2 + coefficient * (b - z2)
    let fc := z3 + coefficient * (c - z3)
    let fd := z4 + coefficient * (d - z4)
    let feedback := 0.66 + room * 0.29
    push combA := x * 0.23 + fa * feedback
    push combB := x * 0.21 + fb * feedback
    push combC := x * 0.19 + fc * feedback
    push combD := x * 0.17 + fd * feedback
    let sum := (a + b + c + d) * 0.30
    let delayed := taplin(diffuser, min(4094.0, sr * 0.0047))
    let output := delayed - sum * 0.5
    push diffuser := sum + output * 0.5
    set z1 := fa
    set z2 := fb
    set z3 := fc
    set z4 := fd
    return output * wet`,['comb array pattern','allpass','damping','delay']);
// Studio 0.7 sound-design families (native Lean rebuild; see lean/build-report-0.7.json).
add('heartbeat','Human heartbeat','Body',"A single trigger produces the lub (S1) and, after a gap set by life, the softer and higher dub (S2): squared gamma-shaped thumps with a downward pitch settle, low-passed chest noise and soft saturation.",`dsp HumanHeart where
  param freq : Hz @control := 46.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.50 range 0.03 8.0
  state t : F32 := 10.0
  state previous : F32 := 0.0
  state level : F32 := 0.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.271
  state body : F32 := 0.0
  state chest : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let time := select(trigger, 0.0, min(t + 1.0 / sr, 10.0))
    let strength := select(trigger, gate, level)
    set previous := gate
    set level := strength
    set t := time
    let gap := 0.12 + life * 0.36
    let u1 := time / 0.030
    let b1 := u1 * expneg(u1 - 1.0)
    let lub := b1 * b1
    let late := max(time - gap, 0.0)
    let u2 := late / 0.020
    let b2 := u2 * expneg(u2 - 1.0)
    let dub := b2 * b2 * select(gt(time, gap), 0.72, 0.0)
    let f1 := freq * (1.0 + 0.55 * expneg(time / 0.035))
    let f2 := freq * 1.55 * (1.0 + 0.35 * expneg(late / 0.025))
    let tone := sinpi(p1 * 2.0) * lub + sinpi(p2 * 2.0) * dub
    let noise := noise1(seed * 7919.0)
    let thud := body + (1.0 - expneg(980.0 / sr)) * (noise - body)
    let muffled := chest + (1.0 - expneg(1400.0 / sr)) * (tone + thud * colour * 3.2 * (lub + dub) - chest)
    set body := thud
    set chest := muffled
    set p1 := fract(p1 + f1 / sr)
    set p2 := fract(p2 + f2 / sr)
    set seed := fract(seed + 0.61803399)
    return softsign(muffled * strength * 1.9) * 0.9`,['two-sound envelope', 'pitch settle', 'low-pass body']);
add('orbitBlip','Orbit beacon','Signal',"A Sputnik-style radio beacon tone: driven sine into a square-ish carrier, a slightly detuned beating partial, receiver hiss and a fast click-free gate.",`dsp OrbitBlip where
  param freq : Hz @control := 880.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.06 range 0.03 8.0
  state phase : F32 := 0.0
  state beat : F32 := 0.0
  state env : F32 := 0.0
  state seed : F32 := 0.137
  state hiss : F32 := 0.0
  state smooth : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.0025 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let drive := 1.0 + colour * 11.0
    let carrier := softsign(sinpi(phase * 2.0) * drive)
    let wobble := sinpi(beat * 2.0) * 0.18
    let noise := noise1(seed * 6151.0)
    let band := hiss + 0.35 * (noise - hiss)
    let signal := (carrier + wobble) * amplitude + band * (0.04 + colour * 0.05) * (0.25 + amplitude)
    let receiver := smooth + (1.0 - expneg(19000.0 / sr)) * (signal - smooth)
    set hiss := band
    set smooth := receiver
    set seed := fract(seed + 0.75487767)
    set phase := fract(phase + freq / sr)
    set beat := fract(beat + freq * 1.0031 / sr)
    return receiver * 0.34`,['beacon', 'drive', 'receiver hiss']);
add('sonar','Sonar blup','Signal',"Sonar ping with an upward pitch “blup” at the attack, colour-driven brass harmonics, and an internal damped echo whose return time shortens as colour rises.",`dsp SonarBlup where
  param freq : Hz @control := 1200.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 1.80 range 0.03 8.0
  state t : F32 := 10.0
  state previous : F32 := 0.0
  state env : F32 := 0.0
  state phase : F32 := 0.0
  state over : F32 := 0.0
  state tone : F32 := 0.0
  buffer echo : F32[24000]
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let time := select(trigger, 0.0, min(t + 1.0 / sr, 10.0))
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    set t := time
    let attack := min(time / 0.004, 1.0)
    let rise := 1.0 - (0.18 + colour * 0.42) * expneg(time / 0.030)
    let f := freq * rise
    let ping := sinpi(phase * 2.0)
    let brass := softsign(ping * (1.0 + colour * 4.0)) * colour * 0.55 + sinpi(over * 2.0) * colour * 0.16
    let dry := (ping * (1.0 - colour * 0.4) + brass) * amplitude * attack
    let delayTime := min(23990.0, sr * (0.12 + (1.0 - colour) * 0.20))
    let back := taplin(echo, delayTime)
    let damped := tone + 0.45 * (back - tone)
    push echo := dry + damped * 0.46
    set tone := damped
    set phase := fract(phase + f / sr)
    set over := fract(over + f * 2.01 / sr)
    return (dry + damped * 0.55) * 0.42`,['chirp', 'echo buffer', 'strike']);
add('radioSnow','Radio snow','Texture',"Shortwave static: band-limited noise, sparse crackle impulses, slow two-rate fading and a faint heterodyne whistle at the note frequency.",`dsp RadioSnow where
  param freq : Hz @control := 700.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 3.00 range 0.03 8.0
  state env : F32 := 0.0
  state seed : F32 := 0.419
  state low : F32 := 0.0
  state high : F32 := 0.0
  state crackle : F32 := 0.0
  state fadeA : F32 := 0.0
  state fadeB : F32 := 0.31
  state whistle : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.35 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let noise := noise1(seed * 7919.0)
    let pick := noise1(seed * 3571.0 + 0.5)
    let lp := low + (1.0 - expneg((2200.0 + colour * 3800.0) * 6.2831853 / sr)) * (noise - low)
    let hp := high + (1.0 - expneg(1900.0 / sr)) * (lp - high)
    let band := lp - hp
    let spark := select(gt(pick, 0.9992 - colour * 0.0016), noise * 3.0, crackle * expneg(1.0 / (0.0009 * sr)))
    let fading := 0.42 + 0.33 * sinpi(fadeA * 2.0) * sinpi(fadeB * 2.0) + 0.25 * sinpi(fadeB * 2.0)
    let tone := sinpi(whistle * 2.0) * 0.035
    set low := lp
    set high := hp
    set crackle := spark
    set seed := fract(seed + 0.61803399)
    set fadeA := fract(fadeA + 0.13 / sr)
    set fadeB := fract(fadeB + 0.037 / sr)
    set whistle := fract(whistle + freq / sr)
    return softsign((band * 1.6 * fading + spark * colour + tone * fading) * amplitude) * 0.55`,['band-pass noise', 'crackle', 'fading']);
// Generated families (tools/families): built by the same native Lean toolchain, loaded from catalog
// shards on first use. They are non-enumerable, so lists of the core patterns (the Patterns tab, the
// Workbench menu, the AI guide) stay as they are while any song can use them by id.
for(const [id,label,category,sounds,role] of GENERATED)Object.defineProperty(bank,id,{enumerable:false,value:{id,label:label[0].toUpperCase()+label.slice(1),family:category,about:`Generated LeanDSP instrument. ${sounds}.`,sounds,role,source:null,tags:[category],generated:true,implementation:'LeanDSP native Lean build (generated family) → typed Wasm subset → Wasm',certification:'CertifiedProgram recorded by the pinned native Lean build of its catalog shard; the browser verifies the shard index, shard, source, WAT and Wasm hashes'}});
export const patterns=bank;
export const drumKit=[
  {id:'bd',label:'Kick',pattern:'kick',freq:52,colour:.35,life:.5,level:.80,pan:0},
  {id:'sd',label:'Snare',pattern:'snare',freq:182,colour:.44,life:.25,level:.63,pan:.04},
  {id:'rs',label:'Rim',pattern:'tom',freq:720,colour:.8,life:.075,level:.30,pan:-.26},
  {id:'cp',label:'Clap',pattern:'clap',freq:1000,colour:.5,life:.24,level:.41,pan:.12},
  {id:'lt',label:'Low tom',pattern:'tom',freq:88,colour:.3,life:.5,level:.55,pan:-.45},
  {id:'mt',label:'Mid tom',pattern:'tom',freq:130,colour:.4,life:.36,level:.48,pan:0},
  {id:'ht',label:'High tom',pattern:'tom',freq:190,colour:.5,life:.26,level:.42,pan:.45},
  {id:'ch',label:'Closed hat',pattern:'hat',freq:5800,colour:.48,life:.07,level:.35,pan:-.22},
  {id:'oh',label:'Open hat',pattern:'hat',freq:5800,colour:.58,life:.5,level:.23,pan:.30}
];