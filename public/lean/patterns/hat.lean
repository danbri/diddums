import LeanDSP.Syntax
open LeanDSP

dsp MetallicHat where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.09 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.731
  state low : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let noise := noise1(seed * 8117.0)
    let metal := sinpi(phase * 2.0) * sinpi(p2 * 2.0)
    let raw := noise * 0.66 + metal * colour * 0.34
    let lp := low + 0.35 * (raw - low)
    set low := lp
    set seed := fract(seed + 0.5698403)
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 1.483 / sr)
    return (raw - lp) * amplitude * 0.42