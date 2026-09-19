import LeanDSP.Syntax
open LeanDSP

dsp SixSineChoir where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 1.20 range 0.03 8.0
  state f1a : F32 := 0.0
  state f1b : F32 := 0.0
  state f2a : F32 := 0.0
  state f2b : F32 := 0.0
  state f3a : F32 := 0.0
  state f3b : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.035 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let vowel := min(3.999, colour * 4.0)
    let morph := fract(vowel)
    let x1 := select(lt(vowel, 1.0), 800.0, select(lt(vowel, 2.0), 500.0, select(lt(vowel, 3.0), 300.0, 500.0)))
    let y1 := select(lt(vowel, 1.0), 500.0, select(lt(vowel, 2.0), 300.0, select(lt(vowel, 3.0), 500.0, 350.0)))
    let x2 := select(lt(vowel, 1.0), 1200.0, select(lt(vowel, 2.0), 1900.0, select(lt(vowel, 3.0), 2300.0, 900.0)))
    let y2 := select(lt(vowel, 1.0), 1900.0, select(lt(vowel, 2.0), 2300.0, select(lt(vowel, 3.0), 900.0, 800.0)))
    let x3 := select(lt(vowel, 1.0), 2500.0, select(lt(vowel, 2.0), 2600.0, select(lt(vowel, 3.0), 3000.0, 2400.0)))
    let y3 := select(lt(vowel, 1.0), 2600.0, select(lt(vowel, 2.0), 3000.0, select(lt(vowel, 3.0), 2400.0, 2200.0)))
    let form1 := x1 + (y1 - x1) * morph
    let form2 := x2 + (y2 - x2) * morph
    let form3 := x3 + (y3 - x3) * morph
    let spread := 0.0017
    let tone1 := sinpi(f1a * 2.0) + sinpi(f1b * 2.0)
    let tone2 := sinpi(f2a * 2.0) + sinpi(f2b * 2.0)
    let tone3 := sinpi(f3a * 2.0) + sinpi(f3b * 2.0)
    set f1a := fract(f1a + form1 * (1.0 - spread) / sr)
    set f1b := fract(f1b + form1 * (1.0 + spread) / sr)
    set f2a := fract(f2a + form2 * (1.0 - spread) / sr)
    set f2b := fract(f2b + form2 * (1.0 + spread) / sr)
    set f3a := fract(f3a + form3 * (1.0 - spread) / sr)
    set f3b := fract(f3b + form3 * (1.0 + spread) / sr)
    return (tone1 * 0.28 + tone2 * 0.20 + tone3 * 0.12) * amplitude * 0.48