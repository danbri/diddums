import LeanDSP.Syntax
open LeanDSP

dsp OrchardString where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 1.80 range 0.03 8.0
  state previous : F32 := 0.0
  state burst : F32 := 0.0
  state seed : F32 := 0.123
  buffer string : F32[4096]
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let excitation := select(trigger, gate, burst * 0.90)
    let noise := noise1(seed * 8191.0)
    let length := min(4093.0, sr / max(24.0, freq) - 0.5)
    let a := taplin(string, length)
    let b := taplin(string, length + 1.0)
    let damping := 0.22 + colour * 0.28
    let wave := a * (1.0 - damping) + b * damping
    let feedback := min(0.9998, expneg(5.0 / (max(24.0, freq) * life)))
    let driven := clip(wave * feedback + noise * excitation * 0.45, -1.5, 1.5)
    push string := driven
    set previous := gate
    set burst := excitation
    set seed := fract(seed + 0.75487767)
    return wave * 0.8