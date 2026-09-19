import LeanDSP.Syntax
open LeanDSP

dsp VelvetTines where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 2.40 range 0.03 8.0
  state phase : F32 := 0.0
  state modphase : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let modulator := sinpi(modphase * 2.0) * (0.06 + colour * 0.22) * amplitude
    let tine := sinpi((phase + modulator) * 2.0)
    let body := sinpi(phase * 2.0)
    let y := (tine * 0.68 + body * 0.32) * amplitude
    set phase := fract(phase + freq / sr)
    set modphase := fract(modphase + freq * 2.003 / sr)
    return y * 0.52