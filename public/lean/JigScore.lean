import Lean

namespace JigScore

/-- A score event before sample-rate mapping. index is an exact score-step index. -/
structure Event where
  index : Nat
  note : Nat
  deriving Repr, BEq, DecidableEq

/-- Total lookup. Empty patterns produce no note; non-empty patterns repeat. -/
def noteAt (pattern : List (Option Nat)) (i : Nat) : Option Nat :=
  (pattern.get? (i % pattern.length)).join

/-- Emit at most one event per score step. This is deliberately smaller than
    Diddums' complete scheduler: no audio frames, mixer state or DSP semantics. -/
def emitPattern (pattern : List (Option Nat)) : Nat → Nat → List Event
  | 0, _ => []
  | fuel + 1, cursor =>
      let rest := emitPattern pattern fuel (cursor + 1)
      match noteAt pattern cursor with
      | none => rest
      | some note => { index := cursor, note := note } :: rest

/-- A minimal repeating step-sequencer program. -/
structure Program where
  bars : Nat
  stepsPerBar : Nat
  pattern : List (Option Nat)
  deriving Repr, BEq, DecidableEq

def Program.totalSteps (p : Program) : Nat := p.bars * p.stepsPerBar

def Program.events (p : Program) : List Event :=
  emitPattern p.pattern p.totalSteps 0

/-- The event generator cannot exceed its score-step budget. -/
theorem emitPattern_length_le (pattern : List (Option Nat)) (fuel cursor : Nat) :
    (emitPattern pattern fuel cursor).length ≤ fuel := by
  induction fuel generalizing cursor with
  | zero =>
      simp [emitPattern]
  | succ fuel ih =>
      cases h : noteAt pattern cursor with
      | none =>
          simpa [emitPattern, h] using
            Nat.le_trans (ih (cursor := cursor + 1)) (Nat.le_succ fuel)
      | some note =>
          simpa [emitPattern, h] using
            Nat.succ_le_succ (ih (cursor := cursor + 1))

theorem Program.events_length_le (p : Program) :
    p.events.length ≤ p.totalSteps := by
  exact emitPattern_length_le p.pattern p.totalSteps 0

/-- Factory Monday's built-in 32-step sequence is original Diddums score data.
    These are relative scale/chord intervals, not audio frequencies. -/
def factoryMondaySequence : List (Option Nat) :=
  [some 12, none, some 19, some 12, some 15, none, some 22, none,
   some 12, some 17, none, some 24, some 19, none, some 15, none,
   some 12, none, some 22, some 19, some 15, none, some 17, some 24,
   some 12, none, some 19, none, some 22, some 17, none, some 15]

def factoryMondayBass : List (Option Nat) :=
  [some 0, none, some 0, some 7, some 0, none, some 10, some 7,
   some 0, some 3, none, some 5, some 7, none, some 3, some 5]

/-- Roadmap boundary:
    JS currently expands harmony, sections, drums, speech and role-specific
    scheduling. The next formal milestone is a parity model whose canonical
    event-plan hash matches public/jigscore.js for the supported subset. -/
end JigScore