# Adaptive expression: seven additions

Status: plan. Goal: a busy conflict scene into which characters enter in different states (powerless, sad, unstable, ill, or several at once), each audible as such while the scene music continues. Each step lists what it adds, how, the API, and how it is tested. Steps 1–3 and 6 fit the current engine; 4, 5 and 7 need scheduler work.

## 1. Character layers

**Adds:** music per entity, mixed over the scene. A character has a motif (melody pattern), an instrument and a part (role), and enters, leaves or changes on bar lines.

**How:** `plan()` keeps returning the scene arrangement; `startAdaptive` also takes `characters`, each compiled into its own track(s) and event stream, generated with the same bar-ahead scheduler and merged into the score.

**API:** `music.enter('mentor', {motif, sound, role})`, `music.leave('mentor')`, `music.setCharacter('mentor', {power, mood, stability, health})`.

**Test:** a scene with two characters; entering and leaving changes only those tracks, at the next bar; scene tracks are note-for-note unchanged.

## 2. Motif transformations as named operations

**Adds:** the classic leitmotif treatments as parameters: transpose, mode change (major/minor/modal), inversion, retrograde, augmentation and diminution, fragmentation (keep the first n notes), register shift, rhythmic displacement, and note dropping.

**How:** pure functions on the melody array (scale-degree form, as the game already uses), applied in the character's plan before events are generated. A mapping table turns state values into operations (sad → minor, augmented, falling; powerless → high register, fragmented, quiet; and so on).

**API:** `transform(motif, {mode, invert, retrograde, augment, fragment, octave, displace, drop})`; the state → operation table is data the composer can edit.

**Test:** unit tests per operation on known motifs; for each state, the rendered character layer differs from the neutral one in the expected way (note count, register, intervals).

## 3. Live pitch instability

**Adds:** wobble and detune per track as live controls, for illness, drunkenness, damage or unease.

**How:** the worklet already applies `tune` (semitones) per track; add `wobble` (depth and rate of a slow pitch LFO) and `drift` (random walk) as track controls updated per 128-sample block, not per note.

**API:** `music.control(track, 'wobble', {depth: 0.3, rate: 0.7})`, `music.control(track, 'drift', 0.2)`.

**Test:** rendered pitch of a held note follows the requested depth and rate (pitch tracking on the output); zero values reproduce the current output exactly.

## 4. Tempo changes and rubato

**Adds:** slowing for sadness, lurching for instability, accelerating chases.

**How:** the bar-ahead scheduler converts beats to frames with a tempo map (piecewise-constant tempo per bar, plus per-bar timing offsets for rubato) instead of a fixed bpm. Events are already generated per bar, so the change is in the beat-to-frame conversion and the position-to-bar lookup used by `hit()` and telemetry.

**API:** `music.set({tempo: 84})` (from the next bar, with an optional ramp over n bars); per-character `rubato` amount.

**Test:** bar boundaries in the rendered event stream match the tempo map; `hit()` still lands on the next 16th after a tempo change; a constant tempo reproduces today's frames.

## 5. Per-layer timing looseness and accents

**Adds:** uneven, displaced or heavy-handed playing for one layer while the rest stays tight (an unstable character, a struggling musician).

**How:** per-track timing jitter, swing amount and accent pattern applied in event generation (the score already supports global swing and small humanisation).

**API:** track or character fields `looseness` (ms of jitter), `swing`, `accents` (a repeating pattern of velocity multipliers, or `"random"`).

**Test:** onset deviations and velocity patterns of the affected track match the settings; other tracks unchanged.

## 6. Ducking and muffling

**Adds:** the scene making room for a character (or a voice), and sound heard through a wall, underwater or by a dazed character.

**How:** a per-track low-pass in the mix stage (a one-pole or state-variable filter in the worklet's track output), and side-chain ducking: a track or group lowers others' levels by an amount following its own envelope.

**API:** `music.control(track, 'muffle', 0..1)`; `music.duck({by: 'mentor', groups: ['scene'], amount: 0.5, release: 0.3})`.

**Test:** measured spectra and levels change as specified; with both at zero the output is unchanged.

## 7. Transitions

**Adds:** fills, pickups, crossfades and stingers between states, so a change of state sounds composed rather than switched.

**How:** when the plan changes, the scheduler can insert a one-bar transition (a drum fill pattern, a rising or falling pickup on chord tones, a cymbal swell, or a cut to silence) before the new arrangement, or crossfade layers over n beats. Uses the existing drum patterns, `hit()` phrases and level automation.

**API:** `music.set(state, {transition: 'fill' | 'pickup' | 'crossfade' | 'cut', beats: 4})`, with defaults per state pair in the plan.

**Test:** the bar before a change contains the transition material; crossfades produce continuous level curves; no transition reproduces today's behaviour.

## Order

1 → 2 → 3 → 6 (character layers with transformations, instability and room in the mix: the core of the scenario), then 4 → 5 → 7 (scheduler work). A demo scene follows step 3 and is extended with each later step.
