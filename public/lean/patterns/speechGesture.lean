import LeanDSP.Syntax
open LeanDSP

dsp SpeechGestures where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.16 range 0.03 8.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.37
  state lp : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.0025 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let n := noise1(seed * 8111.0)
    let noiseCoefficient := 0.04 + colour * 0.22
    let filtered := lp + noiseCoefficient * (n - lp)
    let burst := n - filtered
    let nasal := sinpi(p1 * 2.0) * 0.62 + sinpi(p2 * 2.0) * 0.22
    let glide := sinpi(p2 * 2.0) * 0.55 + sinpi(p1 * 2.0) * 0.18
    let gesture := select(lt(colour, 0.34), burst * (0.55 + colour), select(lt(colour, 0.64), nasal, glide))
    set p1 := fract(p1 + (160.0 + colour * 260.0) / sr)
    set p2 := fract(p2 + (520.0 + colour * 1180.0) / sr)
    set seed := fract(seed + 0.75487767)
    set lp := filtered
    return gesture * amplitude * 0.42