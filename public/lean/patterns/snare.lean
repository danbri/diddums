import LeanDSP.Syntax
open LeanDSP

dsp PaperSnare where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.25 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.43
  state low : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let noise := noise1(seed * 8171.0)
    let lp := low + 0.13 * (noise - low)
    let wire := (noise - lp) * (0.26 + colour * 0.46) * amplitude * amplitude
    let body := (sinpi(phase * 2.0) + sinpi(p2 * 2.0) * 0.6) * amplitude * 0.26
    set low := lp
    set seed := fract(seed + 0.75487767)
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 1.37 / sr)
    return (wire + body) * 0.58