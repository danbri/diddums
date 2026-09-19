import LeanDSP.Syntax
open LeanDSP

dsp RoomHands where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.26 range 0.03 8.0
  state age : F32 := 8.0
  state seed : F32 := 0.173
  state low : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let t := select(trigger, 0.0, min(8.0, age + 1.0 / sr))
    let bursts := select(lt(t, 0.031), select(lt(fract(t * 100.0), 0.4), 1.0, 0.15), amplitude)
    let n := noise1(seed * 8153.0)
    let filtered := low + (0.08 + colour * 0.14) * (n - low)
    set low := filtered
    set age := t
    set seed := fract(seed + 0.75487767)
    return (n - filtered) * bursts * amplitude * 0.42