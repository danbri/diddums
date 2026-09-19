import Lean
set_option linter.unusedSimpArgs false

namespace LeanDSP

/-- The arithmetic vocabulary is closed. No IO, callbacks, recursion or allocation. -/
inductive Unary where
  | neg | abs | floor | nearest | softsign | fract | wrap | fold | sinpi | tanpi | expneg | noise1
  deriving Repr, BEq, DecidableEq, Inhabited
inductive Binary where
  | add | sub | mul | div | min | max | quant
  deriving Repr, BEq, DecidableEq, Inhabited
inductive Compare where
  | lt | le | gt | ge
  deriving Repr, BEq, DecidableEq, Inhabited
inductive Ty where
  | scalar | boolean
  deriving Repr, BEq, DecidableEq, Inhabited
inductive Value (α : Type) where
  | scalar : α → Value α
  | boolean : Bool → Value α
  deriving Repr

/-- The compiler theorem is uniform in the scalar semantics, including an IEEE-word
    interpretation. It does not assume associativity or real-number identities. -/
structure ScalarOps (α : Type) where
  literal : String → α
  unary : Unary → α → α
  binary : Binary → α → α → α
  compare : Compare → α → α → Bool

structure MemoryOps (α β : Type) where
  tap : β → String → α → Option α
  push : β → String → α → β

structure Store (α β : Type) where
  vars : String → Option (Value α)
  memory : β

def Store.assign (s : Store α β) (name : String) (v : Value α) : Store α β :=
  { s with vars := fun k => if k == name then some v else s.vars k }

inductive Expr where
  | literal : String → Expr
  | variable : String → Expr
  | unary : Unary → Expr → Expr
  | binary : Binary → Expr → Expr → Expr
  | compare : Compare → Expr → Expr → Expr
  | select : Expr → Expr → Expr → Expr
  | tap : String → Expr → Expr
  deriving Repr, BEq, Inhabited

def applyUnary (o : ScalarOps α) (op : Unary) : Value α → Option (Value α)
  | .scalar x => some (.scalar (o.unary op x))
  | _ => none

def applyBinary (o : ScalarOps α) (op : Binary) : Value α → Value α → Option (Value α)
  | .scalar x, .scalar y => some (.scalar (o.binary op x y))
  | _, _ => none

def applyCompare (o : ScalarOps α) (op : Compare) : Value α → Value α → Option (Value α)
  | .scalar x, .scalar y => some (.boolean (o.compare op x y))
  | _, _ => none

def applySelect : Value α → Value α → Value α → Option (Value α)
  | .boolean c, .scalar x, .scalar y => some (.scalar (if c then x else y))
  | _, _, _ => none

def applyTap (m : MemoryOps α β) (s : Store α β) (name : String) : Value α → Option (Value α)
  | .scalar d => (m.tap s.memory name d).map Value.scalar
  | _ => none

/-- Source semantics. Select is eager, as in WebAssembly select. -/
def evalExpr (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β) : Expr → Option (Value α)
  | .literal v => some (.scalar (o.literal v))
  | .variable n => s.vars n
  | .unary op a => do applyUnary o op (← evalExpr o m s a)
  | .binary op a b => do applyBinary o op (← evalExpr o m s a) (← evalExpr o m s b)
  | .compare op a b => do applyCompare o op (← evalExpr o m s a) (← evalExpr o m s b)
  | .select c a b => do
      let av ← evalExpr o m s a
      let bv ← evalExpr o m s b
      let cv ← evalExpr o m s c
      applySelect cv av bv
  | .tap n d => do applyTap m s n (← evalExpr o m s d)

/-- A deliberately small stack IR. Each operation is emitted by the WAT backend. -/
inductive Instr where
  | literal : String → Instr
  | load : String → Instr
  | unary : Unary → Instr
  | binary : Binary → Instr
  | compare : Compare → Instr
  | select
  | tap : String → Instr
  deriving Repr, BEq, Inhabited

def stepInstr (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β)
    : Instr → List (Value α) → Option (List (Value α))
  | .literal n, stack => some (.scalar (o.literal n) :: stack)
  | .load n, stack => (s.vars n).map (· :: stack)
  | .unary op, a :: stack => (applyUnary o op a).map (· :: stack)
  | .binary op, b :: a :: stack => (applyBinary o op a b).map (· :: stack)
  | .compare op, b :: a :: stack => (applyCompare o op a b).map (· :: stack)
  | .select, c :: b :: a :: stack => (applySelect c a b).map (· :: stack)
  | .tap n, d :: stack => (applyTap m s n d).map (· :: stack)
  | _, _ => none

def runCode (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β)
    : List Instr → List (Value α) → Option (List (Value α))
  | [], stack => some stack
  | i :: is, stack => do runCode o m s is (← stepInstr o m s i stack)

def compileExpr : Expr → List Instr
  | .literal v => [.literal v]
  | .variable n => [.load n]
  | .unary op a => compileExpr a ++ [.unary op]
  | .binary op a b => compileExpr a ++ compileExpr b ++ [.binary op]
  | .compare op a b => compileExpr a ++ compileExpr b ++ [.compare op]
  | .select c a b => compileExpr a ++ compileExpr b ++ compileExpr c ++ [.select]
  | .tap n d => compileExpr d ++ [.tap n]

theorem runCode_append (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β)
    (a b : List Instr) (stack : List (Value α)) :
    runCode o m s (a ++ b) stack = (runCode o m s a stack).bind (runCode o m s b) := by
  induction a generalizing stack with
  | nil => rfl
  | cons i is ih => simp [runCode, ih, Option.bind_assoc]

/-- Verified expression compilation, for every environment, scalar semantics,
    buffer interpretation, parameter valuation and incoming stack. -/
theorem compileExpr_correct (o : ScalarOps α) (m : MemoryOps α β)
    (s : Store α β) (e : Expr) (stack : List (Value α)) :
    runCode o m s (compileExpr e) stack = (evalExpr o m s e).map (· :: stack) := by
  induction e generalizing stack with
  | literal v => rfl
  | «variable» n => simp [compileExpr, runCode, stepInstr, evalExpr]
  | unary op a ih =>
      simp only [compileExpr, runCode_append, ih, evalExpr]
      cases ha : evalExpr o m s a <;> simp [ha, runCode, stepInstr]
  | binary op a b iha ihb =>
      simp only [compileExpr, runCode_append, iha, evalExpr]
      cases ha : evalExpr o m s a <;> cases hb : evalExpr o m s b <;> simp [ha, hb, runCode_append, ihb, runCode, stepInstr]
  | compare op a b iha ihb =>
      simp only [compileExpr, runCode_append, iha, evalExpr]
      cases ha : evalExpr o m s a <;> cases hb : evalExpr o m s b <;> simp [ha, hb, runCode_append, ihb, runCode, stepInstr]
  | select c a b ihc iha ihb =>
      simp only [compileExpr, runCode_append, iha, evalExpr]
      cases ha : evalExpr o m s a <;> cases hb : evalExpr o m s b <;> cases hc : evalExpr o m s c <;> simp [ha, hb, hc, runCode_append, ihb, ihc, runCode, stepInstr]
  | tap n d ih =>
      simp only [compileExpr, runCode_append, ih, evalExpr]
      cases hd : evalExpr o m s d <;> simp [hd, runCode, stepInstr]

inductive Block where
  | output : Expr → Block
  | bind : String → Expr → Block → Block
  | store : String → Expr → Block → Block
  | push : String → Expr → Block → Block
  deriving Repr, Inhabited

inductive IRBlock where
  | output : List Instr → IRBlock
  | bind : String → List Instr → IRBlock → IRBlock
  | store : String → List Instr → IRBlock → IRBlock
  | push : String → List Instr → IRBlock → IRBlock
  deriving Repr, Inhabited

def evalBlock (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β)
    : Block → Option (Value α × Store α β)
  | .output e => do return (← evalExpr o m s e, s)
  | .bind n e rest | .store n e rest => do
      let v ← evalExpr o m s e
      evalBlock o m (s.assign n v) rest
  | .push n e rest => do
      let v ← evalExpr o m s e
      match v with
      | .scalar x => evalBlock o m {s with memory := m.push s.memory n x} rest
      | _ => none

def runExprCode (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β)
    (code : List Instr) : Option (Value α) := do
  match ← runCode o m s code [] with
  | [v] => some v
  | _ => none

def runBlock (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β)
    : IRBlock → Option (Value α × Store α β)
  | .output code => do return (← runExprCode o m s code, s)
  | .bind n code rest | .store n code rest => do
      let v ← runExprCode o m s code
      runBlock o m (s.assign n v) rest
  | .push n code rest => do
      let v ← runExprCode o m s code
      match v with
      | .scalar x => runBlock o m {s with memory := m.push s.memory n x} rest
      | _ => none

def compileBlock : Block → IRBlock
  | .output e => .output (compileExpr e)
  | .bind n e rest => .bind n (compileExpr e) (compileBlock rest)
  | .store n e rest => .store n (compileExpr e) (compileBlock rest)
  | .push n e rest => .push n (compileExpr e) (compileBlock rest)

theorem runExprCode_compile (o : ScalarOps α) (m : MemoryOps α β)
    (s : Store α β) (e : Expr) :
    runExprCode o m s (compileExpr e) = evalExpr o m s e := by
  simp only [runExprCode, compileExpr_correct]
  cases evalExpr o m s e <;> rfl

/-- Whole sample-step preservation. Ordered local/state writes and buffer pushes
    are part of the theorem, not erased before verification. -/
theorem compile_correct (o : ScalarOps α) (m : MemoryOps α β)
    (b : Block) (s : Store α β) :
    runBlock o m s (compileBlock b) = evalBlock o m s b := by
  induction b generalizing s with
  | output e => simp [compileBlock, runBlock, evalBlock, runExprCode_compile]
  | bind n e rest ih => simp [compileBlock, runBlock, evalBlock, runExprCode_compile, ih]
  | store n e rest ih => simp [compileBlock, runBlock, evalBlock, runExprCode_compile, ih]
  | push n e rest ih =>
      simp only [compileBlock, runBlock, runExprCode_compile, evalBlock]
      cases he : evalExpr o m s e with
      | none => rfl
      | some v => cases v <;> simp [ih]

/-- No value-dependent execution length: compilation emits a fixed instruction
    count, and select never introduces a data-dependent loop. -/
def Expr.cost : Expr → Nat
  | .literal _ | .variable _ => 1
  | .unary _ e | .tap _ e => e.cost + 1
  | .binary _ a b | .compare _ a b => a.cost + b.cost + 1
  | .select c a b => a.cost + b.cost + c.cost + 1

theorem compileExpr_length (e : Expr) : (compileExpr e).length = e.cost := by
  induction e <;> simp_all [compileExpr, Expr.cost, List.length_append, Nat.add_assoc]

/-- The ring indices used by the emitter are bounded for every cursor/delay. -/
theorem ring_index_lt (cursor offset len : Nat) (h : 0 < len) :
    (cursor + offset) % len < len := Nat.mod_lt _ h

/-- A parameter-family certificate: structural compilation correctness does not
    depend on a particular UI slider setting or input signal. -/
theorem all_instantiations (o : ScalarOps α) (m : MemoryOps α β) (b : Block)
    (instantiate : π → Store α β) :
    ∀ settings : π, runBlock o m (instantiate settings) (compileBlock b) =
      evalBlock o m (instantiate settings) b := by
  intro settings
  exact compile_correct o m b (instantiate settings)

/-- Supply new input/parameter values before each step, retaining persistent state. -/
def evalTrace (o : ScalarOps α) (m : MemoryOps α β) (b : Block)
    (supply : π → Store α β → Store α β) : List π → Store α β → Option (List (Value α) × Store α β)
  | [], s => some ([],s)
  | x::xs, s => do
      let (y,next) ← evalBlock o m (supply x s) b
      let (ys,last) ← evalTrace o m b supply xs next
      some (y::ys,last)

def runTrace (o : ScalarOps α) (m : MemoryOps α β) (b : IRBlock)
    (supply : π → Store α β → Store α β) : List π → Store α β → Option (List (Value α) × Store α β)
  | [], s => some ([],s)
  | x::xs, s => do
      let (y,next) ← runBlock o m (supply x s) b
      let (ys,last) ← runTrace o m b supply xs next
      some (y::ys,last)

/-- Parameter automation and arbitrary-length sample traces preserve meaning too:
    this is not restricted to a constant slider setting or reset state. -/
theorem compile_trace_correct (o : ScalarOps α) (m : MemoryOps α β) (b : Block)
    (supply : π → Store α β → Store α β) (inputs : List π) (s : Store α β) :
    runTrace o m (compileBlock b) supply inputs s = evalTrace o m b supply inputs s := by
  induction inputs generalizing s with
  | nil => rfl
  | cons x xs ih => simp [runTrace, evalTrace, compile_correct, ih]


end LeanDSP


namespace LeanDSP

structure Param where
  name : String
  unit : String
  rate : String
  initial : String
  low : String
  high : String
  deriving Repr, Inhabited
structure StateDecl where
  name : String
  initial : String
  deriving Repr, Inhabited
structure BufferDecl where
  name : String
  length : Nat
  deriving Repr, Inhabited
structure Program where
  name : String
  params : List Param
  states : List StateDecl
  buffers : List BufferDecl
  body : Block
  deriving Repr, Inhabited

/-- Exact decimal checking at build time: no floating-point oracle in proofs. -/
private def decimalDigits : List Char → Nat → Nat → Bool → Nat → Option (Nat × Nat)
  | [], value, places, _, count => if count == 0 then none else some (value, places)
  | '.' :: cs, value, places, false, count => decimalDigits cs value places true count
  | ch :: cs, value, places, fraction, count =>
    let n := ch.toNat
    if n < 48 || n > 57 || count ≥ 24 || places ≥ 12 then none
    else decimalDigits cs (value * 10 + (n - 48)) (if fraction then places + 1 else places) fraction (count + 1)

def decimal? (s : String) : Option Rat := do
  let (negative, chars) := match s.toList with
    | '-' :: rest => (true, rest)
    | rest => (false, rest)
  let (value, places) ← decimalDigits chars 0 0 false 0
  some (Rat.divInt (if negative then -(Int.ofNat value) else Int.ofNat value) (Int.ofNat (10 ^ places)))

def Param.valid (p : Param) : Bool :=
  match decimal? p.low, decimal? p.initial, decimal? p.high with
  | some lo, some d, some hi =>
    let semantic := if p.unit == "Unit" || p.unit == "UnitInterval" then decide (0 ≤ lo ∧ hi ≤ 1)
      else if p.unit == "Bipolar" then decide (-1 ≤ lo ∧ hi ≤ 1)
      else if p.unit == "Hz" || p.unit == "Seconds" || p.unit == "Milliseconds" then decide (0 < lo)
      else true
    decide (lo ≤ d ∧ d ≤ hi ∧ -1000000000 ≤ lo ∧ hi ≤ 1000000000) && semantic &&
      ["F32", "Unit", "UnitInterval", "Bipolar", "Hz", "Seconds", "Milliseconds", "Gain", "MidiNote"].contains p.unit &&
      ["audio", "control", "event"].contains p.rate
  | _, _, _ => false

def lookupType (env : List (String × Ty)) (name : String) : Option Ty :=
  (env.find? (fun e => e.1 == name)).map Prod.snd

def infer (env : List (String × Ty)) (buffers : List String) : Expr → Option Ty
  | .literal s => if (decimal? s).isSome then some .scalar else none
  | .variable name => lookupType env name
  | .unary _ a | .tap _ a => if infer env buffers a == some .scalar then some .scalar else none
  | .binary _ a b => if infer env buffers a == some .scalar && infer env buffers b == some .scalar then some .scalar else none
  | .compare _ a b => if infer env buffers a == some .scalar && infer env buffers b == some .scalar then some .boolean else none
  | .select c a b => if infer env buffers c == some .boolean && infer env buffers a == some .scalar && infer env buffers b == some .scalar then some .scalar else none

/-- Buffer identity is checked separately from expression value types. -/
def buffersKnown (buffers : List String) : Expr → Bool
  | .literal _ | .variable _ => true
  | .unary _ a => buffersKnown buffers a
  | .tap name a => buffers.contains name && buffersKnown buffers a
  | .binary _ a b | .compare _ a b => buffersKnown buffers a && buffersKnown buffers b
  | .select c a b => buffersKnown buffers c && buffersKnown buffers a && buffersKnown buffers b

def checkBlock (env : List (String × Ty)) (states buffers pushed : List String) : Block → Bool
  | .output e => infer env buffers e == some .scalar && buffersKnown buffers e
  | .bind name e rest =>
    !((env.map Prod.fst ++ buffers).contains name) && buffersKnown buffers e &&
    match infer env buffers e with
    | some ty => checkBlock ((name, ty) :: env) states buffers pushed rest
    | none => false
  | .store name e rest => states.contains name && infer env buffers e == some .scalar &&
      buffersKnown buffers e && checkBlock env states buffers pushed rest
  | .push name e rest => buffers.contains name && !(pushed.contains name) &&
      infer env buffers e == some .scalar && buffersKnown buffers e &&
      checkBlock env states buffers (name :: pushed) rest

def Block.cost : Block → Nat
  | .output e => e.cost
  | .bind _ e rest | .store _ e rest | .push _ e rest => e.cost + rest.cost

def Block.bindings : Block → List String
  | .output _ => []
  | .bind name _ rest => name :: rest.bindings
  | .store _ _ rest | .push _ _ rest => rest.bindings

def Program.probeCount (p : Program) : Nat :=
  3 + p.params.length + p.states.length + p.body.bindings.length

def Program.footprint (p : Program) : Nat :=
  8192 + (p.buffers.map (fun b => b.length * 4)).sum + p.probeCount * 256 * 4

def Program.pages (p : Program) : Nat := (p.footprint + 65535) / 65536

private def nameStart (c : Char) : Bool :=
  let n := c.toNat
  (65 ≤ n && n ≤ 90) || (97 ≤ n && n ≤ 122) || c == '_'

def safeName (n : String) : Bool := match n.toList with
  | [] => false
  | x::xs => nameStart x && xs.all (fun c => nameStart c || (48 ≤ c.toNat && c.toNat ≤ 57))

def Program.check (p : Program) : Bool :=
  let names := ["x", "sr"] ++ p.params.map Param.name ++ p.states.map StateDecl.name ++ p.buffers.map BufferDecl.name
  let env := (["x", "sr"] ++ p.params.map Param.name ++ p.states.map StateDecl.name).map (fun n => (n, Ty.scalar))
  safeName p.name && names.all safeName && p.body.bindings.all safeName &&
  p.params.length ≤ 4 && p.states.length ≤ 16 && p.buffers.length ≤ 16 &&
  p.params.all Param.valid && p.states.all (fun s => (decimal? s.initial).isSome) &&
  p.buffers.all (fun b => 2 ≤ b.length && b.length ≤ 120000) &&
  names.length == names.eraseDups.length && p.body.cost ≤ 1024 && p.body.bindings.length ≤ 128 &&
  p.pages ≤ 8 && p.footprint ≤ p.pages * 65536 &&
  checkBlock env (p.states.map StateDecl.name) (p.buffers.map BufferDecl.name) [] p.body

/-- An actual Lean value plus a kernel-checked proof, not a Boolean badge. -/
structure CertifiedProgram where
  program : Program
  checked : program.check = true

/-- Compile a certified family. Runtime input and parameter values are not baked
    into this proof and may vary at every sample. -/
def lower (p : CertifiedProgram) : IRBlock := compileBlock p.program.body

theorem lower_correct (p : CertifiedProgram) (o : ScalarOps α) (m : MemoryOps α β)
    (s : Store α β) :
    runBlock o m s (lower p) = evalBlock o m s p.program.body :=
  compile_correct o m p.program.body s

theorem io_region_safe (n i : Nat) (hn : n ≤ 128) (hi : i < n) :
    4 * i + 4 ≤ 512 ∧ 4096 + 4 * i + 4 ≤ 8192 := by omega

theorem buffer_region_safe (base len index memoryBytes : Nat)
    (hi : index < len) (h : base + 4 * len ≤ memoryBytes) :
    base + 4 * index + 4 ≤ memoryBytes := by omega

/-- Parameter variation cannot alter a compiled family's static memory layout. -/
def instanceFootprint (p : CertifiedProgram) (_settings : π) : Nat := p.program.footprint

theorem instance_memory_invariant (p : CertifiedProgram) (a b : π) :
    instanceFootprint p a = instanceFootprint p b := rfl

end LeanDSP


namespace LeanDSP.WasmSubset
open LeanDSP

/-- Typed references used by the Wasm-oriented lowering. The String is the logical
    LeanDSP binding name; Emitter.lean alone decides its textual Wasm identifier. -/
inductive Ref where
  | local : String → Ref
  | global : String → Ref
  deriving Repr, BEq, DecidableEq, Inhabited

/-- The expression-level WebAssembly subset generated by LeanDSP.
    Helpers are explicit calls; no arbitrary Wasm instruction can appear here. -/
inductive Instr where
  | f32Const : String → Instr
  | get : Ref → Instr
  | unary : Unary → Instr
  | binary : Binary → Instr
  | compare : Compare → Instr
  | select
  | tap : String → Instr
  deriving Repr, BEq, Inhabited

/-- Names with persistent/sample-rate storage lower to globals; everything else
    lowers to a local. This mirrors the production WAT identifier policy. -/
def resolveRef (p : Program) (n : String) : Ref :=
  if n == "sr" || (p.states.map StateDecl.name).contains n then .global n else .local n

def lowerInstr (p : Program) : LeanDSP.Instr → Instr
  | .literal n => .f32Const n
  | .load n => .get (resolveRef p n)
  | .unary op => .unary op
  | .binary op => .binary op
  | .compare op => .compare op
  | .select => .select
  | .tap n => .tap n

def lowerCode (p : Program) (code : List LeanDSP.Instr) : List Instr :=
  code.map (lowerInstr p)

/-- Semantic lookup intentionally uses logical LeanDSP names. The textual printer
    may rename them to $p0/$s_name/etc.; that spelling is a separate boundary. -/
def lookupRef (s : Store α β) : Ref → Option (Value α)
  | .local n | .global n => s.vars n

def step (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β)
    : Instr → List (Value α) → Option (List (Value α))
  | .f32Const n, stack => some (.scalar (o.literal n) :: stack)
  | .get r, stack => (lookupRef s r).map (· :: stack)
  | .unary op, a :: stack => (applyUnary o op a).map (· :: stack)
  | .binary op, b :: a :: stack => (applyBinary o op a b).map (· :: stack)
  | .compare op, b :: a :: stack => (applyCompare o op a b).map (· :: stack)
  | .select, c :: b :: a :: stack => (applySelect c a b).map (· :: stack)
  | .tap n, d :: stack => (applyTap m s n d).map (· :: stack)
  | _, _ => none

def run (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β)
    : List Instr → List (Value α) → Option (List (Value α))
  | [], stack => some stack
  | i :: is, stack => do run o m s is (← step o m s i stack)

@[simp] theorem lookup_resolve (p : Program) (s : Store α β) (n : String) :
    lookupRef s (resolveRef p n) = s.vars n := by
  unfold resolveRef
  split <;> rfl

theorem step_lower (p : Program) (o : ScalarOps α) (m : MemoryOps α β)
    (s : Store α β) (i : LeanDSP.Instr) (stack : List (Value α)) :
    step o m s (lowerInstr p i) stack = stepInstr o m s i stack := by
  cases i with
  | literal n => rfl
  | load n => simp [lowerInstr, step, stepInstr, lookup_resolve]
  | unary op =>
      cases stack with
      | nil => rfl
      | cons a rest => rfl
  | binary op =>
      cases stack with
      | nil => rfl
      | cons b rest =>
          cases rest with
          | nil => rfl
          | cons a tail => rfl
  | compare op =>
      cases stack with
      | nil => rfl
      | cons b rest =>
          cases rest with
          | nil => rfl
          | cons a tail => rfl
  | select =>
      cases stack with
      | nil => rfl
      | cons c rest =>
          cases rest with
          | nil => rfl
          | cons b rest2 =>
              cases rest2 with
              | nil => rfl
              | cons a tail => rfl
  | tap n =>
      cases stack with
      | nil => rfl
      | cons d rest => rfl

/-- Instruction selection from the verified LeanDSP stack IR to the typed
    Wasm subset preserves execution for every scalar and memory semantics. -/
theorem lowerCode_correct (p : Program) (o : ScalarOps α) (m : MemoryOps α β)
    (s : Store α β) (code : List LeanDSP.Instr) (stack : List (Value α)) :
    run o m s (lowerCode p code) stack = runCode o m s code stack := by
  induction code generalizing stack with
  | nil => rfl
  | cons i rest ih =>
      simp only [lowerCode, List.map_cons, run, runCode]
      rw [step_lower]
      cases h : stepInstr o m s i stack with
      | none => rfl
      | some next => exact ih next

/-- Source expressions therefore refine all the way to the typed Wasm subset. -/
theorem compileExpr_toWasm_correct (p : Program) (o : ScalarOps α) (m : MemoryOps α β)
    (s : Store α β) (e : Expr) (stack : List (Value α)) :
    run o m s (lowerCode p (compileExpr e)) stack =
      (evalExpr o m s e).map (· :: stack) := by
  rw [lowerCode_correct]
  exact compileExpr_correct o m s e stack

theorem lowerCode_length (p : Program) (code : List LeanDSP.Instr) :
    (lowerCode p code).length = code.length := by
  simp [lowerCode]

/-- Typed Wasm-oriented form of a complete sample block. State mutation and
    buffer writes remain explicit; textual WAT has not entered the story yet. -/
inductive WasmBlock where
  | output : List Instr → WasmBlock
  | bind : String → List Instr → WasmBlock → WasmBlock
  | store : String → List Instr → WasmBlock → WasmBlock
  | push : String → List Instr → WasmBlock → WasmBlock
  deriving Repr, Inhabited

def lowerBlock (p : Program) : LeanDSP.IRBlock → WasmBlock
  | .output code => .output (lowerCode p code)
  | .bind n code rest => .bind n (lowerCode p code) (lowerBlock p rest)
  | .store n code rest => .store n (lowerCode p code) (lowerBlock p rest)
  | .push n code rest => .push n (lowerCode p code) (lowerBlock p rest)

def runExpr (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β)
    (code : List Instr) : Option (Value α) := do
  match ← run o m s code [] with
  | [v] => some v
  | _ => none

def runBlock (o : ScalarOps α) (m : MemoryOps α β) (s : Store α β)
    : WasmBlock → Option (Value α × Store α β)
  | .output code => do return (← runExpr o m s code, s)
  | .bind n code rest | .store n code rest => do
      let v ← runExpr o m s code
      runBlock o m (s.assign n v) rest
  | .push n code rest => do
      let v ← runExpr o m s code
      match v with
      | .scalar x => runBlock o m {s with memory := m.push s.memory n x} rest
      | _ => none

theorem runExpr_lowerCode (p : Program) (o : ScalarOps α) (m : MemoryOps α β)
    (s : Store α β) (code : List LeanDSP.Instr) :
    runExpr o m s (lowerCode p code) = LeanDSP.runExprCode o m s code := by
  simp only [runExpr, LeanDSP.runExprCode, lowerCode_correct]

/-- Ordered local/state writes and buffer pushes survive lowering to the typed
    Wasm subset exactly, for arbitrary scalar and memory semantics. -/
theorem lowerBlock_correct (p : Program) (o : ScalarOps α) (m : MemoryOps α β)
    (s : Store α β) (b : LeanDSP.IRBlock) :
    runBlock o m s (lowerBlock p b) = LeanDSP.runBlock o m s b := by
  induction b generalizing s with
  | output code => simp [lowerBlock, runBlock, LeanDSP.runBlock, runExpr_lowerCode]
  | bind n code rest ih =>
      simp [lowerBlock, runBlock, LeanDSP.runBlock, runExpr_lowerCode, ih]
  | store n code rest ih =>
      simp [lowerBlock, runBlock, LeanDSP.runBlock, runExpr_lowerCode, ih]
  | push n code rest ih =>
      simp only [lowerBlock, runBlock, LeanDSP.runBlock, runExpr_lowerCode]
      cases h : LeanDSP.runExprCode o m s code with
      | none => rfl
      | some v => cases v <;> simp [ih]

/-- End-to-end theorem for the proved portion of the current compiler:
    source sample block → stack IR → typed Wasm subset. -/
theorem compileBlock_toWasm_correct (p : Program) (o : ScalarOps α) (m : MemoryOps α β)
    (s : Store α β) (b : LeanDSP.Block) :
    runBlock o m s (lowerBlock p (LeanDSP.compileBlock b)) =
      LeanDSP.evalBlock o m s b := by
  rw [lowerBlock_correct]
  exact LeanDSP.compile_correct o m b s

end LeanDSP.WasmSubset


namespace LeanDSP
open Lean

declare_syntax_cat dspNumber
syntax num : dspNumber
syntax scientific : dspNumber
syntax "-" num : dspNumber
syntax "-" scientific : dspNumber

declare_syntax_cat dspExpr
syntax num : dspExpr
syntax scientific : dspExpr
syntax ident : dspExpr
syntax "(" dspExpr ")" : dspExpr
syntax:80 "-" dspExpr:80 : dspExpr
syntax:65 dspExpr:65 " + " dspExpr:66 : dspExpr
syntax:65 dspExpr:65 " - " dspExpr:66 : dspExpr
syntax:70 dspExpr:70 " * " dspExpr:71 : dspExpr
syntax:70 dspExpr:70 " / " dspExpr:71 : dspExpr
syntax ident "(" dspExpr,* ")" : dspExpr

declare_syntax_cat dspDecl
syntax "param " ident " : " ident " @" ident " := " dspNumber " range " dspNumber dspNumber : dspDecl
syntax "param " ident " : " ident " := " dspNumber " range " dspNumber dspNumber : dspDecl
syntax "state " ident " : " "F32" " := " dspNumber : dspDecl
syntax "buffer " ident " : " "F32" "[" num "]" : dspDecl

declare_syntax_cat dspStmt
syntax "let " ident " := " dspExpr : dspStmt
syntax "set " ident " := " dspExpr : dspStmt
syntax "push " ident " := " dspExpr : dspStmt
syntax "return " dspExpr : dspStmt

syntax (name := dspCommand) "dsp " ident " where" ppLine (colGt dspDecl)* ppLine
  colGt "sample " ident " =>" ppLine (colGt dspStmt)+ : command

private def numText (s : Syntax) : String :=
  ((s.reprint.getD "").trimAscii.toString).replace " " ""

private def identText (s : Syntax) : String := s.getId.toString

partial def expandExpr (s : Syntax) : MacroM (TSyntax `term) := do
  match s with
  | `(dspExpr| $n:num) => `(Expr.literal $(quote (numText n)))
  | `(dspExpr| $n:scientific) => `(Expr.literal $(quote (numText n)))
  | `(dspExpr| $n:ident) => `(Expr.variable $(quote (identText n)))
  | `(dspExpr| ($e:dspExpr)) => expandExpr e
  | `(dspExpr| - $e:dspExpr) => `(Expr.unary Unary.neg $(← expandExpr e))
  | `(dspExpr| $a:dspExpr + $b:dspExpr) => `(Expr.binary Binary.add $(← expandExpr a) $(← expandExpr b))
  | `(dspExpr| $a:dspExpr - $b:dspExpr) => `(Expr.binary Binary.sub $(← expandExpr a) $(← expandExpr b))
  | `(dspExpr| $a:dspExpr * $b:dspExpr) => `(Expr.binary Binary.mul $(← expandExpr a) $(← expandExpr b))
  | `(dspExpr| $a:dspExpr / $b:dspExpr) => `(Expr.binary Binary.div $(← expandExpr a) $(← expandExpr b))
  | `(dspExpr| $f:ident($args:dspExpr,*)) =>
    let name := identText f
    let as := args.getElems
    if name == "taplin" && as.size == 2 then
      match as[0]! with
      | `(dspExpr| $b:ident) => `(Expr.tap $(quote (identText b)) $(← expandExpr as[1]!))
      | _ => Macro.throwError "taplin requires a declared buffer identifier"
    else
      let es ← as.mapM (fun a => expandExpr a)
      if ["abs","softsign","fract","wrap","fold","sinpi","tanpi","expneg","noise1"].contains name && es.size == 1 then
        let c := mkIdent (Name.str `LeanDSP.Unary name)
        `(Expr.unary $c $(es[0]!))
      else if ["min","max","quant"].contains name && es.size == 2 then
        let c := mkIdent (Name.str `LeanDSP.Binary name)
        `(Expr.binary $c $(es[0]!) $(es[1]!))
      else if ["lt","le","gt","ge"].contains name && es.size == 2 then
        let c := mkIdent (Name.str `LeanDSP.Compare name)
        `(Expr.compare $c $(es[0]!) $(es[1]!))
      else if name == "select" && es.size == 3 then
        `(Expr.select $(es[0]!) $(es[1]!) $(es[2]!))
      else if name == "clip" && es.size == 3 then
        `(Expr.binary Binary.max $(es[1]!) (Expr.binary Binary.min $(es[2]!) $(es[0]!)))
      else Macro.throwError s!"Unknown DSP intrinsic or wrong arity: {name}/{es.size}"
  | _ => Macro.throwError s!"Unsupported expression {s}"

partial def expandBlock (ss : List Syntax) : MacroM (TSyntax `term) := do
  match ss with
  | [] => Macro.throwError "A sample block must end with return"
  | st :: rest =>
    match st with
    | `(dspStmt| return $e:dspExpr) =>
      if rest.isEmpty then `(Block.output $(← expandExpr e))
      else Macro.throwError "No statements may follow return"
    | `(dspStmt| let $n:ident := $e:dspExpr) =>
      `(Block.bind $(quote (identText n)) $(← expandExpr e) $(← expandBlock rest))
    | `(dspStmt| set $n:ident := $e:dspExpr) =>
      `(Block.store $(quote (identText n)) $(← expandExpr e) $(← expandBlock rest))
    | `(dspStmt| push $n:ident := $e:dspExpr) =>
      `(Block.push $(quote (identText n)) $(← expandExpr e) $(← expandBlock rest))
    | _ => Macro.throwError "Unsupported DSP statement"

macro_rules
  | `(dsp $name:ident where $decls:dspDecl* sample $x:ident => $ss:dspStmt*) => do
    if identText x != "x" then Macro.throwError "Sample input must be named x"
    let mut params : Array (TSyntax `term) := #[]
    let mut states : Array (TSyntax `term) := #[]
    let mut buffers : Array (TSyntax `term) := #[]
    for d in decls do
      match d with
      | `(dspDecl| param $n:ident : $u:ident @$r:ident := $v:dspNumber range $lo:dspNumber $hi:dspNumber) =>
        params := params.push (← `(({name := $(quote (identText n)), unit := $(quote (identText u)), rate := $(quote (identText r)), initial := $(quote (numText v)), low := $(quote (numText lo)), high := $(quote (numText hi))} : Param)))
      | `(dspDecl| param $n:ident : $u:ident := $v:dspNumber range $lo:dspNumber $hi:dspNumber) =>
        params := params.push (← `(({name := $(quote (identText n)), unit := $(quote (identText u)), rate := "control", initial := $(quote (numText v)), low := $(quote (numText lo)), high := $(quote (numText hi))} : Param)))
      | `(dspDecl| state $n:ident : F32 := $v:dspNumber) =>
        states := states.push (← `(({name := $(quote (identText n)), initial := $(quote (numText v))} : StateDecl)))
      | `(dspDecl| buffer $n:ident : F32[$len:num]) =>
        buffers := buffers.push (← `(({name := $(quote (identText n)), length := $len} : BufferDecl)))
      | _ => Macro.throwError "Unsupported DSP declaration"
    let body ← expandBlock (ss.toList.map TSyntax.raw)
    `(def $name : CertifiedProgram := {
      program := {name := $(quote (identText name)), params := [$params,*], states := [$states,*], buffers := [$buffers,*], body := $body}
      checked := by decide +kernel
    })

end LeanDSP



namespace LeanDSP
open Lean

/-- WAT serialization is kept deliberately small and separate from the proved
    stack-IR lowering. The serializer, WABT and engine are explicit trust boundaries. -/
def unaryName : Unary → String
  | .neg => "neg" | .abs => "abs" | .floor => "floor" | .nearest => "nearest"
  | .softsign => "softsign" | .fract => "fract" | .wrap => "wrap" | .fold => "fold"
  | .sinpi => "sinpi" | .tanpi => "tanpi" | .expneg => "expneg" | .noise1 => "noise1"
def binaryName : Binary → String
  | .add => "add" | .sub => "sub" | .mul => "mul" | .div => "div"
  | .min => "min" | .max => "max" | .quant => "quant"
def compareName : Compare → String
  | .lt => "lt" | .le => "le" | .gt => "gt" | .ge => "ge"

def mathHelpers : String := r#"
(func $u_softsign (param $a f32) (result f32)
 (f32.div (local.get $a) (f32.add (f32.const 1) (f32.abs (local.get $a)))))
(func $u_fract (param $a f32) (result f32)
 (f32.sub (local.get $a) (f32.floor (local.get $a))))
(func $u_sinpi (param $a f32) (result f32) (local $r f32) (local $y f32)
 (local.set $r (f32.sub (local.get $a) (f32.mul (f32.floor (f32.mul (f32.add (local.get $a) (f32.const 1)) (f32.const 0.5))) (f32.const 2))))
 (local.set $y (f32.mul (f32.const 4) (f32.mul (local.get $r) (f32.sub (f32.const 1) (f32.abs (local.get $r))))))
 (f32.add (local.get $y) (f32.mul (f32.const 0.225) (f32.sub (f32.mul (local.get $y) (f32.abs (local.get $y))) (local.get $y)))))
(func $u_tanpi (param $a f32) (result f32)
 (f32.div (call $u_sinpi (local.get $a)) (call $u_sinpi (f32.add (local.get $a) (f32.const 0.5)))))
(func $u_expneg (param $a f32) (result f32) (local $x f32) (local $x2 f32)
 (local.set $x (f32.max (f32.const 0) (local.get $a)))
 (local.set $x2 (f32.mul (local.get $x) (local.get $x)))
 (f32.div (f32.const 1) (f32.add (f32.const 1) (f32.add (local.get $x) (f32.add (f32.mul (f32.const 0.48) (local.get $x2)) (f32.mul (f32.const 0.235) (f32.mul (local.get $x2) (local.get $x))))))))
(func $u_noise1 (param $a f32) (result f32) (local $fr f32) (local $mix f32)
 (local.set $fr (call $u_fract (f32.add (f32.mul (local.get $a) (f32.const 0.1031)) (f32.const 0.11369))))
 (local.set $mix (f32.mul (local.get $fr) (f32.add (local.get $fr) (f32.const 19.19))))
 (f32.sub (f32.mul (call $u_fract (local.get $mix)) (f32.const 2)) (f32.const 1)))
(func $u_wrap (param $a f32) (result f32)
 (f32.sub (f32.mul (call $u_fract (f32.mul (f32.add (local.get $a) (f32.const 1)) (f32.const 0.5))) (f32.const 2)) (f32.const 1)))
(func $u_fold (param $a f32) (result f32)
 (f32.sub (f32.abs (f32.sub (f32.mul (call $u_fract (f32.mul (f32.add (local.get $a) (f32.const 1)) (f32.const 0.25))) (f32.const 4)) (f32.const 2))) (f32.const 1)))
(func $b_quant (param $a f32) (param $b f32) (result f32)
 (f32.div (f32.nearest (f32.mul (local.get $a) (local.get $b))) (local.get $b)))
"#

def inputEnv (p : Program) : List (String × Ty) :=
  (["x","sr"] ++ p.params.map Param.name ++ p.states.map StateDecl.name).map (fun n => (n, Ty.scalar))

def localsOf (env : List (String × Ty)) (buffers : List String) : Block → List (String × Ty)
  | .output _ => []
  | .bind n e rest => let ty := (infer env buffers e).getD .scalar
                      (n,ty) :: localsOf ((n,ty)::env) buffers rest
  | .store _ _ rest | .push _ _ rest => localsOf env buffers rest

def refName (p : Program) : WasmSubset.Ref → String
  | .local n =>
      if n == "x" then "local.get $x"
      else match p.params.zipIdx |>.find? (fun x => x.1.name == n) with
        | some (_,i) => "local.get $p" ++ toString i
        | none => "local.get $l_" ++ n
  | .global n => if n == "sr" then "global.get $sr" else "global.get $s_" ++ n

/-- The production textual emitter consumes only the proved typed Wasm subset.
    The remaining unproved boundary begins at this pretty-printer. -/
def emitInstr (p : Program) : WasmSubset.Instr → String
  | .f32Const n => "f32.const " ++ n
  | .get r => refName p r
  | .unary op => if [Unary.neg,.abs,.floor,.nearest].contains op then "f32." ++ unaryName op else "call $u_" ++ unaryName op
  | .binary op => if op == .quant then "call $b_quant" else "f32." ++ binaryName op
  | .compare op => "f32." ++ compareName op
  | .select => "select"
  | .tap n => "call $tap_" ++ n

def emitTypedCode (p : Program) (code : List WasmSubset.Instr) : String :=
  String.intercalate "\n" (code.map (emitInstr p))

def emitCode (p : Program) (code : List LeanDSP.Instr) : String :=
  emitTypedCode p (WasmSubset.lowerCode p code)

def bufferLayout (p : Program) : List (BufferDecl × Nat) :=
  (p.buffers.foldl (fun (acc : List (BufferDecl × Nat) × Nat) b => (acc.1 ++ [(b,acc.2)], acc.2 + 4*b.length)) ([],8192)).1

def probes (p : Program) : List (String × String) :=
  [("x","input"),("sr","input")] ++ p.params.map (fun x => (x.name,"param")) ++
  p.states.map (fun x => (x.name,"state")) ++ p.body.bindings.map (fun n => (n,"let")) ++ [("out","output")]

def debugBase (p : Program) := 8192 + (p.buffers.map (fun b => b.length*4)).sum

def probeStore (p : Program) (name value : String) : String :=
  match (probes p).zipIdx.find? (fun x => x.1.1 == name) with
  | none => ""
  | some (_,i) => "\n(f32.store (i32.add (i32.const " ++ toString (debugBase p + i*1024) ++ ") (i32.shl (local.get $i) (i32.const 2))) " ++ value ++ ")\n"

def localValue (locals : List (String × Ty)) (name : String) : String :=
  let get := "(local.get $l_" ++ name ++ ")"
  if lookupType locals name == some .boolean then "(f32.convert_i32_u " ++ get ++ ")" else get

def emitBlock (p : Program) (locals : List (String × Ty)) : WasmSubset.WasmBlock → String
  | .output code => emitTypedCode p code ++ "\nlocal.set $result\n" ++
      "(f32.store (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2))) (local.get $result))\n" ++ probeStore p "out" "(local.get $result)"
  | .bind n code rest => emitTypedCode p code ++ "\nlocal.set $l_" ++ n ++ "\n" ++ probeStore p n (localValue locals n) ++ emitBlock p locals rest
  | .store n code rest => emitTypedCode p code ++ "\nglobal.set $s_" ++ n ++ "\n" ++ probeStore p n ("(global.get $s_" ++ n ++ ")") ++ emitBlock p locals rest
  | .push n code rest =>
      let (b,base) := (bufferLayout p).find? (fun x => x.1.name == n) |>.getD ({name:=n,length:=2},8192)
      "(i32.add (i32.const " ++ toString base ++ ") (i32.shl (global.get $b_" ++ n ++ ") (i32.const 2)))\n" ++
      emitTypedCode p code ++ "\nf32.store\n(global.set $b_" ++ n ++ " (i32.rem_u (i32.add (global.get $b_" ++ n ++ ") (i32.const 1)) (i32.const " ++ toString b.length ++ ")))\n" ++ emitBlock p locals rest

def tapHelper (b : BufferDecl) (base : Nat) : String :=
  let n := b.name
  let l := toString b.length
  "(func $tap_" ++ n ++ " (param $d f32) (result f32) (local $di i32) (local $f f32) (local $i0 i32) (local $i1 i32)\n" ++
  "(if (f32.ne (local.get $d) (local.get $d)) (then (local.set $d (f32.const 1))))\n" ++
  "(local.set $d (f32.max (f32.const 1) (f32.min (f32.const " ++ toString (b.length-1) ++ ") (local.get $d))))\n" ++
  "(local.set $di (i32.trunc_f32_s (f32.floor (local.get $d))))\n(local.set $f (f32.sub (local.get $d) (f32.convert_i32_s (local.get $di))))\n" ++
  "(local.set $i0 (i32.rem_u (i32.add (i32.sub (global.get $b_" ++ n ++ ") (local.get $di)) (i32.const " ++ l ++ ")) (i32.const " ++ l ++ ")))\n" ++
  "(local.set $i1 (i32.rem_u (i32.add (i32.sub (local.get $i0) (i32.const 1)) (i32.const " ++ l ++ ")) (i32.const " ++ l ++ ")))\n" ++
  "(f32.add (f32.mul (f32.load (i32.add (i32.const " ++ toString base ++ ") (i32.shl (local.get $i0) (i32.const 2)))) (f32.sub (f32.const 1) (local.get $f)))\n" ++
  "(f32.mul (f32.load (i32.add (i32.const " ++ toString base ++ ") (i32.shl (local.get $i1) (i32.const 2)))) (local.get $f))))\n"

def emitWat (cert : CertifiedProgram) : String := Id.run do
  let p := cert.program
  let locals := localsOf (inputEnv p) (p.buffers.map BufferDecl.name) p.body
  let mut w := "(module\n(memory (export \"memory\") " ++ toString p.pages ++ " " ++ toString p.pages ++ ")\n(global $sr (mut f32) (f32.const 48000))\n"
  for st in p.states do w := w ++ "(global $s_" ++ st.name ++ " (mut f32) (f32.const " ++ st.initial ++ "))\n"
  for b in p.buffers do w := w ++ "(global $b_" ++ b.name ++ " (mut i32) (i32.const 0))\n"
  w := w ++ mathHelpers
  for (b,base) in bufferLayout p do w := w ++ tapHelper b base
  w := w ++ "(func (export \"prepare\") (param $rate f32)\n(if (i32.or (f32.ne (local.get $rate) (local.get $rate)) (i32.or (f32.lt (local.get $rate) (f32.const 8000)) (f32.gt (local.get $rate) (f32.const 192000)))) (then unreachable))\n(global.set $sr (local.get $rate)))\n"
  w := w ++ "(func (export \"reset\")\n"
  for st in p.states do w := w ++ "(global.set $s_" ++ st.name ++ " (f32.const " ++ st.initial ++ "))\n"
  for b in p.buffers do w := w ++ "(global.set $b_" ++ b.name ++ " (i32.const 0))\n"
  w := w ++ "(memory.fill (i32.const 8192) (i32.const 0) (i32.const " ++ toString (p.footprint-8192) ++ ")))\n"
  w := w ++ "(func (export \"process\") (param $in i32) (param $out i32) (param $n i32) (param $p0 f32) (param $p1 f32) (param $p2 f32) (param $p3 f32)\n(local $i i32) (local $x f32) (local $result f32)\n"
  for (n,ty) in locals do w := w ++ "(local $l_" ++ n ++ (if ty == .boolean then " i32)\n" else " f32)\n")
  w := w ++ "(if (i32.or (i32.gt_u (local.get $n) (i32.const 128)) (i32.or (i32.ne (local.get $in) (i32.const 0)) (i32.ne (local.get $out) (i32.const 4096)))) (then unreachable))\n"
  for (pa,i) in p.params.zipIdx do
    let r := "$p" ++ toString i
    w := w ++ "(if (f32.ne (local.get " ++ r ++ ") (local.get " ++ r ++ ")) (then (local.set " ++ r ++ " (f32.const " ++ pa.initial ++ "))))\n"
    w := w ++ "(local.set " ++ r ++ " (f32.max (f32.const " ++ pa.low ++ ") (f32.min (f32.const " ++ pa.high ++ ") (local.get " ++ r ++ "))))\n"
  w := w ++ "(block $done (loop $loop\n(br_if $done (i32.ge_u (local.get $i) (local.get $n)))\n"
  w := w ++ "(local.set $x (f32.load (i32.add (local.get $in) (i32.shl (local.get $i) (i32.const 2)))))\n"
  w := w ++ probeStore p "x" "(local.get $x)" ++ probeStore p "sr" "(global.get $sr)"
  for (pa,i) in p.params.zipIdx do w := w ++ probeStore p pa.name ("(local.get $p" ++ toString i ++ ")")
  for st in p.states do w := w ++ probeStore p st.name ("(global.get $s_" ++ st.name ++ ")")
  w := w ++ emitBlock p locals (WasmSubset.lowerBlock p (lower cert))
  w := w ++ "(local.set $i (i32.add (local.get $i) (i32.const 1)))\n(br $loop)))))\n"
  return w

def jstr := Json.str
def jnat (n : Nat) : Json := toJson n

def artifact (id : String) (cert : CertifiedProgram) : Json :=
  let p := cert.program
  Json.mkObj [
    ("id",jstr id),("name",jstr p.name),("wat",jstr (emitWat cert)),
    ("pages",jnat p.pages),("astNodes",jnat p.body.cost),("footprint",jnat p.footprint),
    ("params",toJson (p.params.map fun x => Json.mkObj [("name",jstr x.name),("type",jstr x.unit),("rate",jstr x.rate),("def",jstr x.initial),("lo",jstr x.low),("hi",jstr x.high)])),
    ("states",toJson (p.states.map fun x => Json.mkObj [("name",jstr x.name),("init",jstr x.initial)])),
    ("buffers",toJson ((bufferLayout p).map fun (b,base) => Json.mkObj [("name",jstr b.name),("len",jnat b.length),("base",jnat base)])),
    ("debug",Json.mkObj [("base",jnat (debugBase p)),("stride",jnat 256),("probes",toJson ((probes p).zipIdx.map fun ((name,ty),i) => Json.mkObj [("name",jstr name),("type",jstr ty),("index",jnat i)]))]),
    ("evidence",jstr "LeanDSP.compileBlock_toWasm_correct; typed Wasm subset; native Lean syntax; kernel-checked Program.check certificate")]

end LeanDSP

set_option maxRecDepth 8192
set_option maxHeartbeats 6500000
open LeanDSP

dsp VelvetSub where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.55 range 0.03 8.0
  state phase : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.006 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let fundamental := sinpi(phase * 2.0)
    let harmonic := sinpi(phase * 4.0) * colour * 0.22
    let body := softsign((fundamental + harmonic) * 1.4) * amplitude
    set phase := fract(phase + freq / sr)
    return body * 0.72

dsp AmberLadder where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.45 range 0.03 8.0
  state phase : F32 := 0.0
  state env : F32 := 0.0
  state ic1 : F32 := 0.0
  state ic2 : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.004 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let dt := min(freq / sr, 0.4)
    let t0 := phase / dt
    let t1 := (phase - 1.0) / dt
    let correction := select(lt(phase, dt), t0 + t0 - t0 * t0 - 1.0, select(gt(phase, 1.0 - dt), t1 * t1 + t1 + t1 + 1.0, 0.0))
    let saw := phase * 2.0 - 1.0 - correction
    let raw := (saw * 0.65 + sinpi(phase * 2.0) * 0.35) * amplitude
    let g := tanpi(min(0.18, (130.0 + colour * 2400.0 * amplitude) / sr))
    let k := 1.35 - colour * 0.55
    let a := 1.0 / (1.0 + g * (g + k))
    let v1 := a * (ic1 + g * (raw - ic2))
    let v2 := ic2 + g * v1
    set ic1 := 2.0 * v1 - ic1
    set ic2 := 2.0 * v2 - ic2
    set phase := fract(phase + dt)
    return softsign(v2 * 1.65) * 0.8

dsp VelvetTines where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 2.40 range 0.03 8.0
  state phase : F32 := 0.0
  state modphase : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let modulator := sinpi(modphase * 2.0) * (0.06 + colour * 0.22) * amplitude
    let tine := sinpi((phase + modulator) * 2.0)
    let body := sinpi(phase * 2.0)
    let y := (tine * 0.68 + body * 0.32) * amplitude
    set phase := fract(phase + freq / sr)
    set modphase := fract(modphase + freq * 2.003 / sr)
    return y * 0.52

dsp PrismaticBell where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 2.50 range 0.03 8.0
  state phase : F32 := 0.0
  state modphase : F32 := 0.0
  state highphase : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let modulator := sinpi(modphase * 2.0) * colour * 0.24 * amplitude
    let bell := sinpi((phase + modulator) * 2.0)
    let shimmer := sinpi(highphase * 2.0) * amplitude * 0.13
    set phase := fract(phase + freq / sr)
    set modphase := fract(modphase + freq * 2.718 / sr)
    set highphase := fract(highphase + freq * 4.01 / sr)
    return (bell + shimmer) * amplitude * 0.40

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

dsp FeltMallet where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 1.60 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state soft : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let strikeBody := sinpi(phase * 2.0) + sinpi(p2 * 2.0) * colour * amplitude * 0.26 + sinpi(p3 * 2.0) * amplitude * 0.07
    let rounded := soft + 0.12 * (amplitude - soft)
    set soft := rounded
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 2.756 / sr)
    set p3 := fract(p3 + freq * 5.404 / sr)
    return strikeBody * rounded * 0.55

dsp SilkEnsemble where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 2.60 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state lfo : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.32 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let drift := sinpi(lfo * 2.0) * 0.0018
    let a := sinpi(phase * 2.0)
    let b := sinpi(p2 * 2.0)
    let c := sinpi(p3 * 2.0)
    let sheen := sinpi(phase * 4.0) * colour * 0.17
    set phase := fract(phase + freq * (0.998 + drift) / sr)
    set p2 := fract(p2 + freq * 1.0025 / sr)
    set p3 := fract(p3 + freq / sr)
    set lfo := fract(lfo + 0.17 / sr)
    return (a * 0.32 + b * 0.31 + c * 0.28 + sheen) * amplitude * 0.40

dsp DistantVowels where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 3.00 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state lfo : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.65 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let breath := 0.78 + 0.22 * sinpi(lfo * 2.0)
    let fundamental := sinpi(phase * 2.0) * 0.65
    let formantA := sinpi(phase * 6.0) * (0.15 + colour * 0.17)
    let formantB := sinpi(p2 * 10.0) * (0.22 - colour * 0.14)
    let upper := sinpi(p2 * 14.0) * 0.06
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 1.0015 / sr)
    set lfo := fract(lfo + 0.071 / sr)
    return (fundamental + formantA + formantB + upper) * amplitude * breath * 0.30

dsp NocturnalDrawbars where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.80 range 0.03 8.0
  state phase : F32 := 0.0
  state env : F32 := 0.0
  state lfo : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.013 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let tone := sinpi(phase * 2.0) * 0.55 + sinpi(phase * 4.0) * 0.22 + sinpi(phase * 6.0) * colour * 0.28 + sinpi(phase * 8.0) * 0.08
    let tremolo := 0.9 + 0.1 * sinpi(lfo * 2.0)
    set phase := fract(phase + freq / sr)
    set lfo := fract(lfo + 4.8 / sr)
    return tone * amplitude * tremolo * 0.45

dsp ChromeSequence where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.36 range 0.03 8.0
  state phase : F32 := 0.0
  state lp : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let dt := min(freq / sr, 0.4)
    let ta := phase / dt
    let tb := (phase - 1.0) / dt
    let correction := select(lt(phase, dt), ta + ta - ta * ta - 1.0, select(gt(phase, 1.0 - dt), tb * tb + tb + tb + 1.0, 0.0))
    let saw := (phase * 2.0 - 1.0 - correction) * amplitude
    let a := 1.0 - expneg(6.283185 * (250.0 + colour * 4800.0 * amplitude) / sr)
    let filtered := lp + a * (saw - lp)
    set phase := fract(phase + dt)
    set lp := filtered
    return softsign(filtered * 1.4) * 0.55

dsp BreathingRain where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 2.80 range 0.03 8.0
  state seed : F32 := 0.31
  state lo : F32 := 0.0
  state hi : F32 := 0.0
  state env : F32 := 0.0
  state phase : F32 := 0.0
  state lfo : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.4 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let noise := noise1(seed * 7919.0)
    let low := lo + 0.012 * (noise - lo)
    let high := hi + (0.045 + colour * 0.15) * (noise - hi)
    let breath := 0.6 + sinpi(lfo * 2.0) * 0.4
    let air := (high - low) * 0.50 + sinpi(phase * 2.0) * 0.055
    set lo := low
    set hi := high
    set seed := fract(seed + 0.61803399)
    set phase := fract(phase + freq * 2.0 / sr)
    set lfo := fract(lfo + 0.11 / sr)
    return air * amplitude * breath * 0.5

dsp RoundMembrane where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.48 range 0.03 8.0
  state phase : F32 := 0.0
  state snap : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let pitchEnv := select(trigger, 1.0, snap * expneg(1.0 / (0.018 * sr)))
    let tone := sinpi(phase * 2.0)
    let transient := sinpi(phase * 8.0) * pitchEnv * colour * 0.16
    set snap := pitchEnv
    set phase := fract(phase + (freq + pitchEnv * (90.0 + colour * 110.0)) / sr)
    return softsign((tone + transient) * amplitude * 1.5) * 0.85

dsp PaperSnare where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.25 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.43
  state low : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let noise := noise1(seed * 8171.0)
    let lp := low + 0.13 * (noise - low)
    let wire := (noise - lp) * (0.26 + colour * 0.46) * amplitude * amplitude
    let body := (sinpi(phase * 2.0) + sinpi(p2 * 2.0) * 0.6) * amplitude * 0.26
    set low := lp
    set seed := fract(seed + 0.75487767)
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 1.37 / sr)
    return (wire + body) * 0.58

dsp MetallicHat where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.09 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.731
  state low : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let noise := noise1(seed * 8117.0)
    let metal := sinpi(phase * 2.0) * sinpi(p2 * 2.0)
    let raw := noise * 0.66 + metal * colour * 0.34
    let lp := low + 0.35 * (raw - low)
    set low := lp
    set seed := fract(seed + 0.5698403)
    set phase := fract(phase + freq / sr)
    set p2 := fract(p2 + freq * 1.483 / sr)
    return (raw - lp) * amplitude * 0.42

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

dsp CeramicResonator where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.44 range 0.03 8.0
  state phase : F32 := 0.0
  state p2 : F32 := 0.0
  state env : F32 := 0.0
  state previous : F32 := 0.0
  sample x =>
    let trigger := gt(gate, previous + 0.001)
    let amplitude := select(trigger, gate, env * expneg(5.0 / (life * sr)))
    set previous := gate
    set env := amplitude
    let body := sinpi(phase * 2.0)
    let pitchBend := 0.025 + colour * 0.09
    let rim := sinpi(p2 * 2.0) * amplitude * colour * colour * 0.40
    set phase := fract(phase + freq * (1.0 + amplitude * pitchBend) / sr)
    set p2 := fract(p2 + freq * 2.73 / sr)
    return (body + rim) * amplitude * 0.66

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

dsp PhantomRoot where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 1.80 range 0.03 8.0
  state p2 : F32 := 0.0
  state p3 : F32 := 0.0
  state p4 : F32 := 0.0
  state p5 : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.018 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let h2 := sinpi(p2 * 2.0) * 0.44
    let h3 := sinpi(p3 * 2.0) * (0.34 + colour * 0.10)
    let h4 := sinpi(p4 * 2.0) * 0.24
    let h5 := sinpi(p5 * 2.0) * (0.12 + colour * 0.12)
    set p2 := fract(p2 + freq * 2.0 / sr)
    set p3 := fract(p3 + freq * 3.0 / sr)
    set p4 := fract(p4 + freq * 4.0 / sr)
    set p5 := fract(p5 + freq * 5.0 / sr)
    return softsign((h2 + h3 + h4 + h5) * amplitude * 1.2) * 0.60

dsp GhostBeating where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 2.40 range 0.03 8.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.025 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let detune := 0.0007 + colour * 0.0042
    let a := sinpi(p1 * 2.0)
    let b := sinpi(p2 * 2.0)
    set p1 := fract(p1 + freq / sr)
    set p2 := fract(p2 + freq * (1.0 + detune) / sr)
    return (a + b) * amplitude * 0.30

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

dsp SpeechGestures where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.4 range 0.0 1.0
  param life : Seconds @control := 0.16 range 0.03 8.0
  state p1 : F32 := 0.0
  state p2 : F32 := 0.0
  state seed : F32 := 0.37
  state lp : F32 := 0.0
  state env : F32 := 0.0
  sample x =>
    let target := gate
    let coefficient := select(gt(target, env), 1.0 - expneg(1.0 / (0.0025 * sr)), 1.0 - expneg(5.0 / (life * sr)))
    let amplitude := env + coefficient * (target - env)
    set env := amplitude
    let n := noise1(seed * 8111.0)
    let noiseCoefficient := 0.04 + colour * 0.22
    let filtered := lp + noiseCoefficient * (n - lp)
    let burst := n - filtered
    let nasal := sinpi(p1 * 2.0) * 0.62 + sinpi(p2 * 2.0) * 0.22
    let glide := sinpi(p2 * 2.0) * 0.55 + sinpi(p1 * 2.0) * 0.18
    let gesture := select(lt(colour, 0.34), burst * (0.55 + colour), select(lt(colour, 0.64), nasal, glide))
    set p1 := fract(p1 + (160.0 + colour * 260.0) / sr)
    set p2 := fract(p2 + (520.0 + colour * 1180.0) / sr)
    set seed := fract(seed + 0.75487767)
    set lp := filtered
    return gesture * amplitude * 0.42

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

#print axioms LeanDSP.compileExpr_correct
#print axioms LeanDSP.compile_correct
#print axioms LeanDSP.compile_trace_correct
#print axioms LeanDSP.all_instantiations
#print axioms LeanDSP.compileExpr_length
#print axioms LeanDSP.ring_index_lt
#print axioms LeanDSP.lower_correct
#print axioms LeanDSP.io_region_safe
#print axioms LeanDSP.buffer_region_safe
#print axioms LeanDSP.instance_memory_invariant
#print axioms LeanDSP.WasmSubset.lowerCode_correct
#print axioms LeanDSP.WasmSubset.compileExpr_toWasm_correct
#print axioms LeanDSP.WasmSubset.lowerBlock_correct
#print axioms LeanDSP.WasmSubset.compileBlock_toWasm_correct
#print axioms VelvetSub
#print axioms AmberLadder
#print axioms VelvetTines
#print axioms PrismaticBell
#print axioms OrchardString
#print axioms FeltMallet
#print axioms SilkEnsemble
#print axioms DistantVowels
#print axioms NocturnalDrawbars
#print axioms ChromeSequence
#print axioms BreathingRain
#print axioms RoundMembrane
#print axioms PaperSnare
#print axioms MetallicHat
#print axioms RoomHands
#print axioms CeramicResonator
#print axioms DiffuseChamber
#print axioms ImpossibleAscent
#print axioms PhantomRoot
#print axioms GhostBeating
#print axioms ThreeSineVoice
#print axioms SpeechGestures
#print axioms SixSineChoir
def main : IO Unit := IO.println ((Lean.Json.arr #[LeanDSP.artifact "roundBass" VelvetSub,
LeanDSP.artifact "acidBass" AmberLadder,
LeanDSP.artifact "tine" VelvetTines,
LeanDSP.artifact "glass" PrismaticBell,
LeanDSP.artifact "pluck" OrchardString,
LeanDSP.artifact "felt" FeltMallet,
LeanDSP.artifact "silk" SilkEnsemble,
LeanDSP.artifact "choir" DistantVowels,
LeanDSP.artifact "organ" NocturnalDrawbars,
LeanDSP.artifact "pulse" ChromeSequence,
LeanDSP.artifact "rain" BreathingRain,
LeanDSP.artifact "kick" RoundMembrane,
LeanDSP.artifact "snare" PaperSnare,
LeanDSP.artifact "hat" MetallicHat,
LeanDSP.artifact "clap" RoomHands,
LeanDSP.artifact "tom" CeramicResonator,
LeanDSP.artifact "chamber" DiffuseChamber,
LeanDSP.artifact "shepard" ImpossibleAscent,
LeanDSP.artifact "phantomRoot" PhantomRoot,
LeanDSP.artifact "ghostBeat" GhostBeating,
LeanDSP.artifact "sineVox" ThreeSineVoice,
LeanDSP.artifact "speechGesture" SpeechGestures,
LeanDSP.artifact "sineChoir" SixSineChoir]).compress)