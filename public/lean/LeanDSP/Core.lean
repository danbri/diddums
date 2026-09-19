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
