# LeanDSP native build

LeanDSP is an embedded Lean 4 DSL. A declaration such as:

```lean
dsp AmberLadder where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  ...
  sample x =>
    ...
```

is parsed by Lean syntax extensions and elaborates to a `CertifiedProgram`. The published browser kernels come from a pinned native-Lean artifact catalog; browser edits are drafts until a native build succeeds.

## Toolchain

The project pins **Lean 4.34.0**.

```sh
npm install
node build.mjs
```

The release driver runs `lake env lean`, audits theorem axioms, emits WAT from Lean, assembles it with WABT, validates fixed-memory Wasm, and writes `out/catalog.json`.

## Proved compiler path

The current proved path is:

```
LeanDSP source semantics
       ↓  compile_correct
LeanDSP stack IR
       ↓  WasmSubset.lowerBlock_correct
typed WasmSubset block/instructions
       ↓  [remaining compiler trust boundary]
textual WAT
       ↓
WABT → Wasm → browser engine
```

Key theorems:

- `compileExpr_correct` — expression compilation preserves evaluation.
- `compile_correct` — a complete ordered sample step preserves output, local/state writes and buffer pushes.
- `compile_trace_correct` — arbitrary finite input/parameter traces preserve meaning.
- `all_instantiations` — runtime parameter values do not require a new compiler proof.
- `compileExpr_length` — emitted stack-IR instruction count is fixed by source.
- `WasmSubset.lowerCode_correct` — stack-IR instruction selection into the typed Wasm subset preserves execution.
- `WasmSubset.compileExpr_toWasm_correct` — source expressions refine through the typed Wasm subset.
- `WasmSubset.lowerBlock_correct` — ordered bind/store/push/output structure is preserved into the typed Wasm block.
- `WasmSubset.compileBlock_toWasm_correct` — end-to-end theorem for the currently proved source → typed-Wasm-subset portion.

The typed subset is intentionally small: constants, logical local/global references, arithmetic/comparison/select, buffer taps, ordered bindings/state stores/buffer pushes, and output.

## Evidence

The initial Studio 0.5 native build and the subsequent typed-Wasm proof upgrade were checked with Lean 4.34.0. The proof-upgrade regression rebuilt all 17 patterns and produced **identical WAT text** to the catalog at that point, so the proof-boundary change itself altered no DSP bytes.

A later, intentional sound-design revision changed only `CeramicResonator` / `tom`. That revision was rebuilt through the same native Lean path, audited with no `sorryAx`, and is recorded in the release lineage.

The current Studio 0.6 catalog contains **23 certified families**. Six are additive psychoacoustic/vocal families — `ImpossibleAscent`, `PhantomRoot`, `GhostBeating`, `ThreeSineVoice`, `SpeechGestures`, and `SixSineChoir`. The first five extended the original 17-family catalog; the later choir release left all previous 22 WAT programs unchanged and added only `SixSineChoir`.

See:

- `build-report.json` — current 22-family native-build audit, runtime guards and psychoacoustic mechanism diagnostics.
- `wasm-subset-report.json` — typed-Wasm lowering proof audit, the 17-pattern identity check performed at proof upgrade, and catalog lineage.

No `sorryAx` is accepted in the release evidence. The new typed-Wasm theorems depend only on ordinary Lean foundations recorded by `#print axioms` (notably `propext` and, for block/source refinement, `Quot.sound`).

## Trust boundary

Still outside the theorem:

- typed Wasm subset → textual WAT pretty-printing;
- helper WAT bodies such as the sine/exp approximations;
- WABT;
- a WebAssembly engine;
- the JavaScript scheduler, mixer, effects routing and voice allocator;
- universal numerical stability / finite-output claims;
- complete dimensional typing for unit annotations.

The scalar semantics are deliberately parametric. The proofs do not smuggle in real-number algebra or assert that approximate DSP helpers equal their mathematical real-valued counterparts.

## Browser authoring

The browser never treats its old JavaScript parser/compiler as a proof authority. It uses that legacy code only for source inspection/graph visualization and the archived laboratory.

Editing a pattern in the Workbench stages a draft. Export **Lean project ↓**, run the native build, and publish the newly checked catalog through the release process before the runtime will execute the changed family.

## JigScore roadmap

Composition generation is being separated into a deterministic **JigScore** layer before sample-rate timestamping and LeanDSP rendering. `public/jigscore.js` now hashes both the authored composition program and a sample-rate-independent event plan. `public/lean/JigScore.lean` is a **draft** formal model of bounded step-pattern emission; it is not part of the current native release certificate and must not be described as proved until the exact Lean 4.34 release toolchain checks it.

The intended refinement path is:

```
composition data
       ↓
JigScore program / event plan
       ↓  [future Lean parity + event-plan hash gate]
checked score event stream
       ↓
sample-rate timestamp mapping
       ↓
LeanDSP/Wasm voices
```

See `research/jigscore-roadmap.md` for the parity plan and current trust boundary.

## RDF

Active RDF work uses the pinned npm **`@factoidal/core` 0.7.1** path. The foreign-plugin host no longer uses its former ad-hoc Turtle parser.