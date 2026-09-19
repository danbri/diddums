import LeanDSP.Syntax
open LeanDSP

dsp BreathingRain where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 2.80 range 0.03 8.0
  state seed : F32 := 0.31
  state lo : F32 := 0.0
  state hi : F32 := 0.0
  state env : F32 := 0.0
  state phase : F32 := 0.0
  state lfo : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.4 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let noise := noise1(seed * 7919.0)
    let low := lo + 0.012 * (noise - lo)
    let high := hi + (0.045 + colour * 0.15) * (noise - hi)
    let breath := 0.6 + sinpi(lfo * 2.0) * 0.4
    let air := (high - low) * 0.50 + sinpi(phase * 2.0) * 0.055
    set lo := low
    set hi := high
    set seed := fract(seed + 0.61803399)
    set phase := fract(phase + freq * 2.0 / sr)
    set lfo := fract(lfo + 0.11 / sr)
    return air * amplitude * breath * 0.5