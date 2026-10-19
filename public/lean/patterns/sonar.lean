import LeanDSP.Syntax
open LeanDSP

dsp SonarBlup where
  param freq : Hz @control := 1200.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 1.80 range 0.03 8.0
  state t : F32 := 10.0
  state previous : F32 := 0.0
  state env : F32 := 0.0
  state phase : F32 := 0.0
  state over : F32 := 0.0
  state tone : F32 := 0.0
  buffer echo : F32[24000]
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let time := select(trigger, 0.0, min(t + 1.0 / sr, 10.0))
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    set t := time
    let attack := min(time / 0.004, 1.0)
    let rise := 1.0 - (0.18 + colour * 0.42) * expneg(time / 0.030)
    let f := freq * rise
    let ping := sinpi(phase * 2.0)
    let brass := softsign(ping * (1.0 + colour * 4.0)) * colour * 0.55 + sinpi(over * 2.0) * colour * 0.16
    let dry := (ping * (1.0 - colour * 0.4) + brass) * amplitude * attack
    let delayTime := min(23990.0, sr * (0.12 + (1.0 - colour) * 0.20))
    let back := taplin(echo, delayTime)
    let damped := tone + 0.45 * (back - tone)
    push echo := dry + damped * 0.46
    set tone := damped
    set phase := fract(phase + f / sr)
    set over := fract(over + f * 2.01 / sr)
    return (dry + damped * 0.55) * 0.42
