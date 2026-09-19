import LeanDSP.Syntax
open LeanDSP

dsp NocturnalDrawbars where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.80 range 0.03 8.0
  state phase : F32 := 0.0
  state env : F32 := 0.0
  state lfo : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.013 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let tone := sinpi(phase * 2.0) * 0.55 + sinpi(phase * 4.0) * 0.22 + sinpi(phase * 6.0) * colour * 0.28 + sinpi(phase * 8.0) * 0.08
    let tremolo := 0.9 + 0.1 * sinpi(lfo * 2.0)
    set phase := fract(phase + freq / sr)
    set lfo := fract(lfo + 4.8 / sr)
    return tone * amplitude * tremolo * 0.45