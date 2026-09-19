import LeanDSP.Syntax
open LeanDSP

dsp RoundMembrane where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.48 range 0.03 8.0
  state phase : F32 := 0.0
  state snap : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let pitchEnv := select(trigger, 1.0, snap * expneg(1.0 / (0.018 * sr)))
    let tone := sinpi(phase * 2.0)
    let transient := sinpi(phase * 8.0) * pitchEnv * colour * 0.16
    set snap := pitchEnv
    set phase := fract(phase + (freq + pitchEnv * (90.0 + colour * 110.0)) / sr)
    return softsign((tone + transient) * amplitude * 1.5) * 0.85