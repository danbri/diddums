import LeanDSP.Syntax
open LeanDSP

dsp SilkEnsemble where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 2.60 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state lfo : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.32 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let drift := sinpi(lfo * 2.0) * 0.0018
    let a := sinpi(phase * 2.0)
    let b := sinpi(p2 * 2.0)
    let c := sinpi(p3 * 2.0)
    let sheen := sinpi(phase * 4.0) * colour * 0.17
    set phase := fract(phase + freq * (0.998 + drift) / sr)
    set p2 := fract(p2 + freq * 1.0025 / sr)
    set p3 := fract(p3 + freq / sr)
    set lfo := fract(lfo + 0.17 / sr)
    return (a * 0.32 + b * 0.31 + c * 0.28 + sheen) * amplitude * 0.40