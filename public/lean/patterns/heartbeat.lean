import LeanDSP.Syntax
open LeanDSP

dsp HumanHeart where
  param freq : Hz @control := 46.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.50 range 0.03 8.0
  state t : F32 := 10.0
  state previous : F32 := 0.0
  state level : F32 := 0.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.271
  state body : F32 := 0.0
  state chest : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let time := select(trigger, 0.0, min(t + 1.0 / sr, 10.0))
    let strength := select(trigger, gate, level)
    set previous := gate
    set level := strength
    set t := time
    let gap := 0.12 + life * 0.36
    let u1 := time / 0.030
    let b1 := u1 * expneg(u1 - 1.0)
    let lub := b1 * b1
    let late := max(time - gap, 0.0)
    let u2 := late / 0.020
    let b2 := u2 * expneg(u2 - 1.0)
    let dub := b2 * b2 * select(gt(time, gap), 0.72, 0.0)
    let f1 := freq * (1.0 + 0.55 * expneg(time / 0.035))
    let f2 := freq * 1.55 * (1.0 + 0.35 * expneg(late / 0.025))
    let tone := sinpi(p1 * 2.0) * lub + sinpi(p2 * 2.0) * dub
    let noise := noise1(seed * 7919.0)
    let thud := body + (1.0 - expneg(980.0 / sr)) * (noise - body)
    let muffled := chest + (1.0 - expneg(1400.0 / sr)) * (tone + thud * colour * 3.2 * (lub + dub) - chest)
    set body := thud
    set chest := muffled
    set p1 := fract(p1 + f1 / sr)
    set p2 := fract(p2 + f2 / sr)
    set seed := fract(seed + 0.61803399)
    return softsign(muffled * strength * 1.9) * 0.9
