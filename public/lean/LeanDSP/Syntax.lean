import LeanDSP.Checker

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

