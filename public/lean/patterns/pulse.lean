import LeanDSP.Syntax
open LeanDSP

dsp ChromeSequence where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.36 range 0.03 8.0
  state phase : F32 := 0.0
  state lp : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let dt := min(freq / sr, 0.4)
    let ta := phase / dt
    let tb := (phase - 1.0) / dt
    let correction := select(lt(phase, dt), ta + ta - ta * ta - 1.0, select(gt(phase, 1.0 - dt), tb * tb + tb + tb + 1.0, 0.0))
    let saw := (phase * 2.0 - 1.0 - correction) * amplitude
    let a := 1.0 - expneg(6.283185 * (250.0 + colour * 4800.0 * amplitude) / sr)
    let filtered := lp + a * (saw - lp)
    set phase := fract(phase + dt)
    set lp := filtered
    return softsign(filtered * 1.4) * 0.55