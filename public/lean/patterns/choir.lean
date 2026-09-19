import LeanDSP.Syntax
open LeanDSP

dsp DistantVowels where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 3.00 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state lfo : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.65 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let breath := 0.78 + 0.22 * sinpi(lfo * 2.0)
    let fundamental := sinpi(phase * 2.0) * 0.65
    let formantA := sinpi(phase * 6.0) * (0.15 + colour * 0.17)
    let formantB := sinpi(p2 * 10.0) * (0.22 - colour * 0.14)
    let upper := sinpi(p2 * 14.0) * 0.06
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 1.0015 / sr)
    set lfo := fract(lfo + 0.071 / sr)
    return (fundamental + formantA + formantB + upper) * amplitude * breath * 0.30