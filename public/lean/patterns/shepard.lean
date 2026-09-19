import LeanDSP.Syntax
open LeanDSP

dsp ImpossibleAscent where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 3.50 range 0.03 8.0
  state rise : F32 := 0.0
  state p0 : F32 := 0.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state p4 : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.08 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let base := min(110.0, max(24.0, freq * 0.25))
    let speed := 0.015 + colour * 0.055
    let q0 := fract(rise)
    let q1 := fract(rise + 0.2)
    let q2 := fract(rise + 0.4)
    let q3 := fract(rise + 0.6)
    let q4 := fract(rise + 0.8)
    let r0 := 1.0 / expneg(q0 * 0.693147)
    let r1 := 1.0 / expneg(q1 * 0.693147)
    let r2 := 1.0 / expneg(q2 * 0.693147)
    let r3 := 1.0 / expneg(q3 * 0.693147)
    let r4 := 1.0 / expneg(q4 * 0.693147)
    let a0 := sinpi(q0)
    let a1 := sinpi(q1)
    let a2 := sinpi(q2)
    let a3 := sinpi(q3)
    let a4 := sinpi(q4)
    let y := (sinpi(p0 * 2.0) * a0 + sinpi(p1 * 2.0) * a1 + sinpi(p2 * 2.0) * a2 + sinpi(p3 * 2.0) * a3 + sinpi(p4 * 2.0) * a4) * amplitude
    set p0 := fract(p0 + base * r0 / sr)
    set p1 := fract(p1 + base * 2.0 * r1 / sr)
    set p2 := fract(p2 + base * 4.0 * r2 / sr)
    set p3 := fract(p3 + base * 8.0 * r3 / sr)
    set p4 := fract(p4 + base * 16.0 * r4 / sr)
    set rise := fract(rise + speed / sr)
    return softsign(y * 0.48) * 0.72