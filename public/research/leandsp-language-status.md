# LeanDSP language and verification status — Studio 0.5

## Status

The active Studio runtime no longer treats the JavaScript Lean-shaped parser/compiler as a verification authority.

LeanDSP is now an **embedded Lean 4 DSL**. The source form

```lean
dsp AmberLadder where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  ...
  sample x =>
    ...
```

is parsed by Lean syntax extensions and elaborates to a `LeanDSP.CertifiedProgram`. Each published pattern contains a kernel-checked proof that its structural checker returned true.

The browser loads only a hash-pinned native-Lean artifact catalog. Browser source edits are drafts until the native build is rerun successfully.

## Native build

Pinned toolchain: Lean 4.34.0.

The downloadable project is under `/lean/` and includes the semantic core, checker, syntax elaborator, WAT emitter, all 17 pattern declarations, `Build.lean`, pinned toolchain metadata, and a Node/WABT release driver.

Initial Studio 0.5 artifacts were elaborated and kernel-checked through the native Lean 4.34 server used by Lean4web. The project also contains a reproducible native `lake env lean` build path; this conversation did not claim to have executed local Lake on Hatchable.

## Proved properties

The core proves:

- `compileExpr_correct`: compiling an expression to the stack IR preserves its value and incoming stack.
- `compile_correct`: one sample step preserves output plus ordered local/state writes and buffer pushes.
- `compile_trace_correct`: the same refinement holds for arbitrary finite input/parameter traces, so automation is not a new proof obligation per slider setting.
- `all_instantiations`: structural compiler correctness is uniform over runtime settings.
- `compileExpr_length`: generated IR instruction count is fixed by source.
- ring-index and memory-region lemmas with explicit size premises.
- static memory footprint is independent of runtime parameter settings.
- `WasmSubset.lowerCode_correct`: stack-IR instruction selection into the typed Wasm subset preserves execution.
- `WasmSubset.compileExpr_toWasm_correct`: source expressions refine through that typed subset.
- `WasmSubset.lowerBlock_correct`: ordered `let`/state-store/buffer-push/output structure is preserved in a typed Wasm block.
- `WasmSubset.compileBlock_toWasm_correct`: end-to-end refinement for the currently proved source → typed-Wasm-subset portion.

The typed-Wasm proof upgrade rebuilt all 17 patterns and produced identical WAT text to the already-pinned catalog, so the proof boundary moved without changing DSP bytes. See `/lean/wasm-subset-report.json`.

Axiom auditing for the release found only ordinary Lean foundations used by these proofs (`propext`, `Classical.choice`, `Quot.sound`, depending on theorem). No `sorryAx` was accepted.

Seven deliberately invalid programs were checked and rejected: unknown variable, Boolean/scalar mismatch, invalid parameter range, undeclared state write, repeated buffer push, oversized buffer, and non-positive Hz domain.

## Pattern families

All 17 current Studio patterns elaborate as native Lean declarations and produce certified artifacts. Regression tests assembled their Lean-emitted WAT and compared the resulting Wasm against the previous implementation at 44.1 kHz and 48 kHz over repeated render blocks. The sampled outputs were bit-identical in those tests, with no non-finite samples.

This is regression evidence, not a universal audio theorem.

## Trust boundary

The current theorem chain connects LeanDSP source semantics through the stack IR to a **typed Wasm-oriented instruction/block subset**. The production emitter consumes that typed subset.

It does **not** yet prove:

- typed Wasm subset → textual WAT pretty-printing or the helper WAT bodies;
- WABT;
- a WebAssembly engine;
- the JavaScript host scheduler, mixer, echo or voice allocator;
- that approximations such as `sinpi` equal mathematical real sine;
- general numerical stability or bounded output for every DSP family;
- a complete dimensional type system for unit annotations.

Those boundaries are exposed rather than folded into the word “verified”.

## Browser source inspector

`public/leandsp.js` still contains the older parser/compiler because the archived laboratory uses it and the active Studio uses its source-graph inspection routines. The active Studio does **not** call that compiler to produce executable DSP kernels.

The executable path is:

```
Lean dsp declaration
  -> CertifiedProgram
  -> proved source-to-stack-IR lowering
  -> proved typed WasmSubset lowering
  -> Lean textual WAT emitter
  -> WABT
  -> hash-pinned Wasm catalog
  -> AudioWorklet runtime
```

## RDF

Active Studio RDF parsing/query/conversion uses the pinned npm `@factoidal/core` 0.7.1 browser module. The current Cascade profile test parsed 90 triples and recovered its five ordered control ports through that path. The previous ad-hoc Turtle parser is no longer used by the active foreign-plugin loader.