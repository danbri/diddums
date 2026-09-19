import LeanDSP.Syntax
open LeanDSP

dsp FeltMallet where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 1.60 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state soft : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let strikeBody := sinpi(phase * 2.0) + sinpi(p2 * 2.0) * colour * amplitude * 0.26 + sinpi(p3 * 2.0) * amplitude * 0.07
    let rounded := soft + 0.12 * (amplitude - soft)
    set soft := rounded
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 2.756 / sr)
    set p3 := fract(p3 + freq * 5.404 / sr)
    return strikeBody * rounded * 0.55