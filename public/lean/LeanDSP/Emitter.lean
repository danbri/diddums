import LeanDSP.WasmSubset

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
