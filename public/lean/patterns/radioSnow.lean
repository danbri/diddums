import LeanDSP.Syntax
open LeanDSP

dsp RadioSnow where
  param freq : Hz @control := 700.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 3.00 range 0.03 8.0
  state env : F32 := 0.0
  state seed : F32 := 0.419
  state low : F32 := 0.0
  state high : F32 := 0.0
  state crackle : F32 := 0.0
  state fadeA : F32 := 0.0
  state fadeB : F32 := 0.31
  state whistle : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.35 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let noise := noise1(seed * 7919.0)
    let pick := noise1(seed * 3571.0 + 0.5)
    let lp := low + (1.0 - expneg((2200.0 + colour * 3800.0) * 6.2831853 / sr)) * (noise - low)
    let hp := high + (1.0 - expneg(1900.0 / sr)) * (lp - high)
    let band := lp - hp
    let spark := select(gt(pick, 0.9992 - colour * 0.0016), noise * 3.0, crackle * expneg(1.0 / (0.0009 * sr)))
    let fading := 0.42 + 0.33 * sinpi(fadeA * 2.0) * sinpi(fadeB * 2.0) + 0.25 * sinpi(fadeB * 2.0)
    let tone := sinpi(whistle * 2.0) * 0.035
    set low := lp
    set high := hp
    set crackle := spark
    set seed := fract(seed + 0.61803399)
    set fadeA := fract(fadeA + 0.13 / sr)
    set fadeB := fract(fadeB + 0.037 / sr)
    set whistle := fract(whistle + freq / sr)
    return softsign((band * 1.6 * fading + spark * colour + tone * fading) * amplitude) * 0.55
