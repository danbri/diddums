// Sound library: named, ready-to-use track presets.
// Every preset plays one of the existing hash-matched native-Lean instrument families; a preset only chooses
// the family, the score role (what it plays), register and the family's existing colour/life/level/pan/send controls.
// No new DSP is introduced here, so the proof boundary of the pinned catalog is unchanged.
const P=(id,label,category,pattern,role,level,colour,life,extra={})=>({id,label,category,pattern,role,level,colour,life,pan:0,send:.3,transpose:0,...extra});
export const soundCategories=['Space & sci-fi','Radio & voices','Cinematic','Keys & mallets','Strings & plucks','Bass','Synth','Nature & texture','Pulse & percussion','Illusions'];
export const sounds=[
 // Space & sci-fi
 P('voidDrone','Void drone','Space & sci-fi','phantomRoot','drone',.24,.32,4.6,{send:.42,about:'Missing-fundamental low drone: the root is implied, not played.'}),
 P('hullHum','Hull hum','Space & sci-fi','roundBass','drone',.30,.06,5.0,{transpose:-12,send:.12,about:'Very low sine hum that follows the chord root.'}),
 P('engineThrob','Engine throb','Space & sci-fi','ghostBeat','drone',.16,.72,4.2,{pan:.12,send:.3,about:'Two near-identical tones beating slowly against each other.'}),
 P('starfield','Starfield','Space & sci-fi','glass','sparse',.20,.34,3.6,{transpose:12,pan:-.32,send:.78,about:'High inharmonic bell glints with long tails.'}),
 P('nebulaPad','Nebula pad','Space & sci-fi','silk','pad',.30,.18,5.6,{send:.66,about:'Slow, wide detuned chord wash.'}),
 P('warpAscent','Warp ascent','Space & sci-fi','shepard','continuous',.16,.55,6.0,{send:.5,about:'Endlessly rising Shepard/Risset tone for the whole track.'}),
 P('commsBeeps','Comms beeps','Space & sci-fi','pulse','sparse',.22,.5,.14,{transpose:12,pan:.38,send:.22,about:'Short high console beeps.'}),
 P('telemetry','Telemetry','Space & sci-fi','pulse','sequence',.18,.20,.14,{pan:-.36,send:.18,octave:24,gate:.08,humanize:false,sequence:[12,null,null,19,null,12,null,null,24,null,null,null,19,null,null,null],about:'Sparse computer-style data sequence.'}),
 P('sonarPing','Sonar ping','Space & sci-fi','glass','answer',.18,.08,4.4,{transpose:-12,pan:.28,send:.82,about:'Dark, slow bell pings answering the melody.'}),
 P('solarWind','Solar wind','Space & sci-fi','rain','air',.22,.82,4.2,{send:.46,about:'Bright noise breathing in long swells.'}),
 // Radio & voices
 P('radioChatter','Radio chatter','Radio & voices','sineVox','speechVowel',.34,.5,.6,{pan:-.22,send:.08,companion:'radioConsonants',about:'Sine-wave speech transmissions. Words come from the "say" text.'}),
 P('radioConsonants','Radio consonants','Radio & voices','speechGesture','speechConsonant',.24,.4,.12,{pan:-.18,send:.05,about:'Consonant clicks and hiss that make sine-wave speech intelligible.'}),
 P('secondOperator','Second operator','Radio & voices','sineVox','speechVowel',.22,.5,.7,{pan:.34,send:.14,speechOffsetSteps:6,about:'A second voice repeating the transmission a beat and a half later.'}),
 P('squelch','Squelch bursts','Radio & voices','rain','sparse',.32,.97,.22,{transpose:24,pan:-.2,send:.06,about:'Short bursts of bright noise between transmissions.'}),
 P('whistleChoir','Whistle choir','Radio & voices','sineChoir','speechVowel',.20,.5,1.3,{pan:.18,send:.5,about:'Six-sine chorus singing the "say" text.'}),
 P('vowelChoir','Vowel choir','Radio & voices','choir','pad',.34,.5,4.6,{send:.62,about:'Synthetic vowel-like chord voices.'}),
 // Cinematic
 P('vaultedChoir','Vaulted choir','Cinematic','choir','pad',.42,.6,5.2,{send:.68,about:'Large slow choir chords in a big room.'}),
 P('stringEnsemble','String ensemble','Cinematic','silk','pad',.34,.62,3.0,{send:.42,about:'Detuned ensemble chords.'}),
 P('brassStabs','Brass stabs','Cinematic','organ','stabs',.28,.82,.7,{pan:.12,send:.24,about:'Bright off-beat chord stabs.'}),
 P('hornCall','Horn call','Cinematic','organ','lead',.26,.66,1.6,{pan:.16,send:.4,about:'Sustained drawbar melody line.'}),
 P('timpani','Timpani','Cinematic','tom','sparse',.36,.28,1.1,{transpose:-24,pan:-.1,send:.36,about:'Low tuned drum hits on the downbeats.'}),
 P('cathedralOrgan','Cathedral organ','Cinematic','organ','long',.26,.30,3.2,{pan:-.2,send:.62,about:'Held organ chords.'}),
 P('epicSub','Epic sub','Cinematic','roundBass','bass',.52,.30,.9,{send:.06,about:'Round sub-bass line.'}),
 // Keys & mallets
 P('electricPiano','Electric piano','Keys & mallets','tine','keys',.46,.34,2.4,{send:.32,about:'FM tine chords on a syncopated keys rhythm.'}),
 P('bells','Bells','Keys & mallets','glass','lead',.30,.42,1.9,{pan:.22,send:.5,about:'Inharmonic bell melody.'}),
 P('celesta','Celesta','Keys & mallets','glass','arp',.20,.20,1.2,{transpose:12,pan:-.24,send:.44,about:'Soft high arpeggio.'}),
 P('marimba','Marimba','Keys & mallets','felt','arp',.36,.5,.9,{pan:-.18,send:.3,about:'Wooden-sounding arpeggio.'}),
 P('musicBox','Music box','Keys & mallets','felt','sparse',.30,.2,1.5,{transpose:24,pan:.3,send:.5,about:'Tiny, high mallet notes.'}),
 P('feltPiano','Felt piano','Keys & mallets','felt','lead',.42,.30,2.0,{send:.42,about:'Soft mallet melody.'}),
 P('drawbarOrgan','Drawbar organ','Keys & mallets','organ','pad',.30,.4,1.6,{send:.35,about:'Sustained drawbar chords.'}),
 // Strings & plucks
 P('harp','Harp','Strings & plucks','pluck','arp',.55,.3,2.2,{pan:-.28,send:.46,about:'Plucked-string arpeggio.'}),
 P('nylonGuitar','Nylon guitar','Strings & plucks','pluck','lead',.60,.55,1.3,{pan:.2,send:.36,about:'Plucked melody.'}),
 P('koto','Koto','Strings & plucks','pluck','sparse',.55,.72,1.8,{transpose:12,pan:.3,send:.44,about:'Bright, sparse high plucks.'}),
 P('pluckBass','Pluck bass','Strings & plucks','pluck','bass',.65,.4,1.1,{send:.12,about:'Plucked bass line.'}),
 // Bass
 P('subBass','Sub bass','Bass','roundBass','bass',.60,.2,.55,{send:.04,about:'Sine sub-bass line.'}),
 P('acidLine','Acid line','Bass','acidBass','bass',.50,.6,.35,{send:.06,about:'Resonant filtered saw bass.'}),
 P('darkDrone','Dark drone bass','Bass','acidBass','drone',.30,.12,3.4,{send:.2,about:'Held, filtered saw on the chord root.'}),
 // Synth
 P('arpeggiator','Arpeggiator','Synth','pulse','arp',.24,.4,.3,{pan:-.3,send:.28,about:'Classic filtered saw arpeggio.'}),
 P('stepSequencer','Step sequencer','Synth','pulse','sequence',.22,.24,.28,{pan:-.2,send:.1,octave:12,gate:.25,humanize:false,sequence:[12,null,19,12,15,null,22,null,12,17,null,24,19,null,15,null],about:'Two-octave hardware-style sequence.'}),
 P('chromeLead','Chrome lead','Synth','pulse','lead',.26,.6,.5,{pan:.1,send:.32,about:'Bright saw melody.'}),
 // Nature & texture
 P('rain','Rain','Nature & texture','rain','air',.24,.25,3.0,{send:.3,about:'Soft hash-noise rain.'}),
 P('wind','Wind','Nature & texture','rain','air',.26,.04,5.0,{transpose:-12,send:.5,about:'Dark, slow noise swells.'}),
 P('birdCalls','Bird calls','Nature & texture','glass','answer',.14,.55,.35,{transpose:24,pan:.4,send:.5,about:'Short high chirps answering the melody.'}),
 P('waterDrops','Water drops','Nature & texture','felt','sparse',.20,.1,.4,{transpose:24,pan:-.36,send:.6,about:'Brief high droplets.'}),
 P('tapeAir','Tape air','Nature & texture','rain','air',.16,.5,3.0,{send:.24,about:'Faint hiss bed.'}),
 // Pulse & percussion
 P('heartbeat','Heartbeat','Pulse & percussion','kick','sparse',.40,.3,.4,{transpose:-12,send:.05,about:'Soft low thud on the downbeats.'}),
 P('clockTicks','Clock ticks','Pulse & percussion','hat','arp',.20,.3,.05,{transpose:36,pan:.24,send:.08,about:'Light metallic ticks.'}),
 P('woodBlocks','Wood blocks','Pulse & percussion','tom','arp',.20,.8,.12,{transpose:12,pan:-.3,send:.18,about:'Tuned rim/block pattern.'}),
 // Illusions
 P('impossibleAscent','Impossible ascent','Illusions','shepard','continuous',.30,.66,5.2,{send:.34,about:'A tone that seems to rise forever.'}),
 P('phantomRoot','Phantom root','Illusions','phantomRoot','sparse',.30,.42,1.8,{pan:-.28,send:.24,about:'Harmonics only; the ear supplies the fundamental.'}),
 P('ghostPulse','Ghost pulse','Illusions','ghostBeat','air',.18,.58,3.2,{pan:.28,send:.4,about:'Slow acoustic beating.'})
];
export const soundById=Object.fromEntries(sounds.map(s=>[s.id,s]));
