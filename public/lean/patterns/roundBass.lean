import LeanDSP.Syntax
open LeanDSP

dsp VelvetSub where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.55 range 0.03 8.0
  state phase : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.006 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let fundamental := sinpi(phase * 2.0)
    let harmonic := sinpi(phase * 4.0) * colour * 0.22
    let body := softsign((fundamental + harmonic) * 1.4) * amplitude
    set phase := fract(phase + freq / sr)
    return body * 0.72