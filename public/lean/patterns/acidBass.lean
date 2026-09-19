import LeanDSP.Syntax
open LeanDSP

dsp AmberLadder where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.45 range 0.03 8.0
  state phase : F32 := 0.0
  state env : F32 := 0.0
  state ic1 : F32 := 0.0
  state ic2 : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.004 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let dt := min(freq / sr, 0.4)
    let t0 := phase / dt
    let t1 := (phase - 1.0) / dt
    let correction := select(lt(phase, dt), t0 + t0 - t0 * t0 - 1.0, select(gt(phase, 1.0 - dt), t1 * t1 + t1 + t1 + 1.0, 0.0))
    let saw := phase * 2.0 - 1.0 - correction
    let raw := (saw * 0.65 + sinpi(phase * 2.0) * 0.35) * amplitude
    let g := tanpi(min(0.18, (130.0 + colour * 2400.0 * amplitude) / sr))
    let k := 1.35 - colour * 0.55
    let a := 1.0 / (1.0 + g * (g + k))
    let v1 := a * (ic1 + g * (raw - ic2))
    let v2 := ic2 + g * v1
    set ic1 := 2.0 * v1 - ic1
    set ic2 := 2.0 * v2 - ic2
    set phase := fract(phase + dt)
    return softsign(v2 * 1.65) * 0.8