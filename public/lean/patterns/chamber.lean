import LeanDSP.Syntax
open LeanDSP

dsp DiffuseChamber where
  param room : Unit @control := 0.62 range 0.0 1.0
  param damp : Unit @control := 0.45 range 0.0 1.0
  param spread : Unit @control := 0.3 range 0.0 1.0
  param wet : Unit @control := 1.0 range 0.0 1.0
  state z1 : F32 := 0.0
  state z2 : F32 := 0.0
  state z3 : F32 := 0.0
  state z4 : F32 := 0.0
  buffer combA : F32[8192]
  buffer combB : F32[8192]
  buffer combC : F32[8192]
  buffer combD : F32[8192]
  buffer diffuser : F32[4096]
  sample x =>
    let a := taplin(combA, min(8190.0, sr * (0.0311 + spread * 0.0011)))
    let b := taplin(combB, min(8190.0, sr * (0.0373 + spread * 0.0017)))
    let c := taplin(combC, min(8190.0, sr * (0.0419 + spread * 0.0013)))
    let d := taplin(combD, min(8190.0, sr * (0.0479 + spread * 0.0019)))
    let coefficient := 0.55 - damp * 0.42
    let fa := z1 + coefficient * (a - z1)
    let fb := z2 + coefficient * (b - z2)
    let fc := z3 + coefficient * (c - z3)
    let fd := z4 + coefficient * (d - z4)
    let feedback := 0.66 + room * 0.29
    push combA := x * 0.23 + fa * feedback
    push combB := x * 0.21 + fb * feedback
    push combC := x * 0.19 + fc * feedback
    push combD := x * 0.17 + fd * feedback
    let sum := (a + b + c + d) * 0.30
    let delayed := taplin(diffuser, min(4094.0, sr * 0.0047))
    let output := delayed - sum * 0.5
    push diffuser := sum + output * 0.5
    set z1 := fa
    set z2 := fb
    set z3 := fc
    set z4 := fd
    return output * wet