import LeanDSP.Syntax
open LeanDSP

dsp PhantomRoot where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 1.80 range 0.03 8.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state p4 : F32 := 0.0
  state p5 : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.018 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let h2 := sinpi(p2 * 2.0) * 0.44
    let h3 := sinpi(p3 * 2.0) * (0.34 + colour * 0.10)
    let h4 := sinpi(p4 * 2.0) * 0.24
    let h5 := sinpi(p5 * 2.0) * (0.12 + colour * 0.12)
    set p2 := fract(p2 + freq * 2.0 / sr)
    set p3 := fract(p3 + freq * 3.0 / sr)
    set p4 := fract(p4 + freq * 4.0 / sr)
    set p5 := fract(p5 + freq * 5.0 / sr)
    return softsign((h2 + h3 + h4 + h5) * amplitude * 1.2) * 0.60