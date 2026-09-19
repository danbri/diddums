import LeanDSP.Syntax
open LeanDSP

dsp GhostBeating where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 2.40 range 0.03 8.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.025 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let detune := 0.0007 + colour * 0.0042
    let a := sinpi(p1 * 2.0)
    let b := sinpi(p2 * 2.0)
    set p1 := fract(p1 + freq / sr)
    set p2 := fract(p2 + freq * (1.0 + detune) / sr)
    return (a + b) * amplitude * 0.30