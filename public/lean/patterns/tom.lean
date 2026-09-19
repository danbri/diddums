import LeanDSP.Syntax
open LeanDSP

dsp CeramicResonator where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.44 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let body := sinpi(phase * 2.0)
    let pitchBend := 0.025 + colour * 0.09
    let rim := sinpi(p2 * 2.0) * amplitude * colour * colour * 0.40
    set phase := fract(phase + freq * (1.0 + amplitude * pitchBend) / sr)
    set p2 := fract(p2 + freq * 2.73 / sr)
    return (body + rim) * amplitude * 0.66