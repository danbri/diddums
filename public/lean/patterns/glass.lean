import LeanDSP.Syntax
open LeanDSP

dsp PrismaticBell where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 2.50 range 0.03 8.0
  state phase : F32 := 0.0
  state modphase : F32 := 0.0
  state highphase : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let modulator := sinpi(modphase * 2.0) * colour * 0.24 * amplitude
    let bell := sinpi((phase + modulator) * 2.0)
    let shimmer := sinpi(highphase * 2.0) * amplitude * 0.13
    set phase := fract(phase + freq / sr)
    set modphase := fract(modphase + freq * 2.718 / sr)
    set highphase := fract(highphase + freq * 4.01 / sr)
    return (bell + shimmer) * amplitude * 0.40