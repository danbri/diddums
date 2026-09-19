import LeanDSP.Syntax
open LeanDSP

dsp ThreeSineVoice where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.65 range 0.03 8.0
  state f1phase : F32 := 0.0
  state f2phase : F32 := 0.0
  state f3phase : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.012 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let vowel := min(3.999, colour * 4.0)
    let morph := fract(vowel)
    let f1a := select(lt(vowel, 1.0), 800.0, select(lt(vowel, 2.0), 500.0, select(lt(vowel, 3.0), 300.0, 500.0)))
    let f1b := select(lt(vowel, 1.0), 500.0, select(lt(vowel, 2.0), 300.0, select(lt(vowel, 3.0), 500.0, 350.0)))
    let f2a := select(lt(vowel, 1.0), 1200.0, select(lt(vowel, 2.0), 1900.0, select(lt(vowel, 3.0), 2300.0, 900.0)))
    let f2b := select(lt(vowel, 1.0), 1900.0, select(lt(vowel, 2.0), 2300.0, select(lt(vowel, 3.0), 900.0, 800.0)))
    let f3a := select(lt(vowel, 1.0), 2500.0, select(lt(vowel, 2.0), 2600.0, select(lt(vowel, 3.0), 3000.0, 2400.0)))
    let f3b := select(lt(vowel, 1.0), 2600.0, select(lt(vowel, 2.0), 3000.0, select(lt(vowel, 3.0), 2400.0, 2200.0)))
    let f1 := f1a + (f1b - f1a) * morph
    let f2 := f2a + (f2b - f2a) * morph
    let f3 := f3a + (f3b - f3a) * morph
    let y := sinpi(f1phase * 2.0) * 0.58 + sinpi(f2phase * 2.0) * 0.43 + sinpi(f3phase * 2.0) * 0.25
    set f1phase := fract(f1phase + f1 / sr)
    set f2phase := fract(f2phase + f2 / sr)
    set f3phase := fract(f3phase + f3 / sr)
    return y * amplitude * 0.46