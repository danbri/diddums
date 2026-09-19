import LeanDSP.Core

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
