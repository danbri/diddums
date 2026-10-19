import LeanDSP.Syntax
open LeanDSP

dsp OrbitBlip where
  param freq : Hz @control := 880.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.06 range 0.03 8.0
  state phase : F32 := 0.0
  state beat : F32 := 0.0
  state env : F32 := 0.0
  state seed : F32 := 0.137
  state hiss : F32 := 0.0
  state smooth : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.0025 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let drive := 1.0 + colour * 11.0
    let carrier := softsign(sinpi(phase * 2.0) * drive)
    let wobble := sinpi(beat * 2.0) * 0.18
    let noise := noise1(seed * 6151.0)
    let band := hiss + 0.35 * (noise - hiss)
    let signal := (carrier + wobble) * amplitude + band * (0.04 + colour * 0.05) * (0.25 + amplitude)
    let receiver := smooth + (1.0 - expneg(19000.0 / sr)) * (signal - smooth)
    set hiss := band
    set smooth := receiver
    set seed := fract(seed + 0.75487767)
    set phase := fract(phase + freq / sr)
    set beat := fract(beat + freq * 1.0031 / sr)
    return receiver * 0.34
