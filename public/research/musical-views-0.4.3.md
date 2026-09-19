# Diddums 0.4.3 — the musical layer

The composition workspace now has Graph, Piano roll, Stave and Event log modes. These are views of the same composition, not separate synthesizer demos. Instrument inspectors have Notes / sequencer, Stave and Event log shortcuts; Open instrument returns from a musical track to its actual graph node. Track choices identify both the score's track name and the reusable pattern name.

## Score and editing

`score.js` already generated frame-stamped note events with pitch, velocity, duration, colour and life. It now also assigns a stable source identity based on track/bar/step/pitch/occurrence. The identity is retained when a particular occurrence is edited.

`music-model.js` applies per-occurrence note edits to that generated score. Timing edits are stored in quarter-note beats and converted at the session sample rate. Untouched note events retain their original timing. The piano-roll form can change pitch, onset, duration and velocity, add/delete notes, undo and restore note edits. It does not change every recurrence of the source pattern. Unchanged fields are omitted from a patch so a pitch-only edit does not accidentally quantize the displayed microtiming or velocity.

The same resulting event array is sent to the existing AudioWorklet scheduler. Changing the score does not retroactively alter already sounding voices; rewind or use Play here to hear an edited earlier occurrence. Composition JSON export includes the note-edit layer. The older drum step override remains a distinct arrangement-wide operation.

The playhead uses the runtime's reported score position. It is not advanced by an independent visual metronome. Follow can be turned off for editing; selecting a note turns it off automatically. The display offers one, two or four bars, with horizontal/vertical scrolling inside the score rather than page-wide overflow.

## What the stave is—and is not

This release uses a **time-proportional stave**. Pitches are drawn on treble/bass staves with ledger lines and explicit accidentals. Horizontal duration lines represent gate lengths, at the actual score onset positions. Selected notes use the same editing form as the piano roll.

This is deliberately not claimed as conventional engraved notation: no inferred rhythmic spelling, full rest filling, voice separation, beaming or ties. The source score includes swing, timing jitter and gate lengths that do not directly constitute notated rhythmic values. Percussion uses named hit lanes, not invented pitched notes. Note-off releases a gate; it need not be the end of the audible decay or reverb tail.

## Runtime event log

`studio-worklet.js` records actions at their actual execution points: note-on, duration note-off, voice-steal/tail-cut, hat choke, audition, seek-resume and transport pause/resume/end. Records include the concrete voice, original score identity when one exists, note/velocity, synthesis frequency, score position and absolute audio frame. Score time and AudioContext stream time have different origins.

A preallocated 256-record ring bounds producer storage. Overflow is counted. The interface retains the newest 512 records, reports older-record eviction, and draws at most 160 filtered rows at once. Export log JSON preserves the retained records and provenance.

This is **internal note dispatch**, not external MIDI input, not a fabricated packet stream and not a complete recording of every host control change. No MIDI device connection or permission request is performed. Inspecting a static score produces no runtime log entries.

## MIDI export

MIDI download writes a format-1 Standard MIDI File at 960 ticks per quarter note, with tempo, meter, movement markers, instrument track names and note-on/off events. Percussion is projected to conventional General MIDI notes on channel 10. Pitch, duration and velocity come from the current edited score; frame timing is rounded to MIDI ticks.

This exports the **planned musical events**, not the LeanDSP instrument definitions, automation, envelope/reverb tails, plugin state or runtime voice-allocation/choke outcomes. It does not promise that another synthesizer will reproduce our sounds. It is not a recording of the Event log.

Primary format reference: https://midi.org/standard-midi-files

## Checks performed

On the deployed candidate at a 390 × 844 Chromium viewport:

- Switched between all four workspace modes without horizontal page overflow.
- Selected a real Nocturnal keys event, edited C4 to D4 and velocity, then exercised undo, addition and deletion.
- Confirmed that the stave contained 12 note targets/heads for that track's first bar.
- Confirmed that the event log remained empty until actual audio execution.
- Started the edited score and observed D4 / MIDI 62 on `pad#0` in the AudioWorklet dispatch log, with its subsequent duration note-off.
- Exercised voice stealing and open/closed-hat choke and observed the actual dispatch records (including the concrete `d:oh#0` voice).
- Returned through the ordinary graph to Velvet tines / Voice 1, with the expression view and Code shortcut still present.
- Paused the AudioContext; no page errors or non-finite audio samples were reported during these checks.

All 14 composition exports were decoded by a separate small SMF reader in the test harness. Track counts, chunk lengths and note-on/off counts matched the complete source scores. This is a format-level test, not a test in every native DAW. Audio tests were short functional checks, not full-length listening tests; the viewport test was not a physical iPhone/Safari test.

The DSP leaf compiler and pattern equations were not changed in this release. The language remains a JavaScript-implemented, Lean-inspired DSL, not a Lean subset or Lean-verified parser/compiler. See [language status](leandsp-language-status.md).