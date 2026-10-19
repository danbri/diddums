// Sound library: named, ready-to-use track presets.
// Every preset plays one of the existing hash-matched native-Lean instrument families; a preset only chooses
// the family, the score role (what it plays), register and the family's existing colour/life/level/pan/send controls.
// No new DSP is introduced here, so the proof boundary of the pinned catalog is unchanged.
const P=(id,label,category,pattern,role,level,colour,life,extra={})=>({id,label,category,pattern,role,level,colour,life,pan:0,send:.3,transpose:0,...extra});
export const soundCategories=['Held tones','Low end','Struck & plucked','Pulses & blips','Hits & thumps','Noise & air','Voices','Beating & illusions'];
// Categories describe how a sound behaves (held, struck, pulsed, noisy…); `scene` keeps the older use-case grouping for search.
export const sounds=[
 // Held tones
 P('nebulaPad','Nebula pad','Held tones','silk','pad',.30,.18,5.6,{scene:'Space & sci-fi',send:.66,about:'Slow, wide detuned chord wash.'}),
 P('vowelChoir','Vowel choir','Held tones','choir','pad',.34,.5,4.6,{scene:'Radio & voices',send:.62,about:'Synthetic vowel-like chord voices.'}),
 P('vaultedChoir','Vaulted choir','Held tones','choir','pad',.42,.6,5.2,{scene:'Cinematic',send:.68,about:'Large slow choir chords in a big room.'}),
 P('stringEnsemble','String ensemble','Held tones','silk','pad',.34,.62,3.0,{scene:'Cinematic',send:.42,about:'Detuned ensemble chords.'}),
 P('hornCall','Horn call','Held tones','organ','lead',.26,.66,1.6,{scene:'Cinematic',pan:.16,send:.4,about:'Sustained drawbar melody line.'}),
 P('cathedralOrgan','Cathedral organ','Held tones','organ','long',.26,.30,3.2,{scene:'Cinematic',pan:-.2,send:.62,about:'Held organ chords.'}),
 P('drawbarOrgan','Drawbar organ','Held tones','organ','pad',.30,.4,1.6,{scene:'Keys & mallets',send:.35,about:'Sustained drawbar chords.'}),
 // Low end
 P('voidDrone','Void drone','Low end','phantomRoot','drone',.24,.32,4.6,{scene:'Space & sci-fi',send:.42,about:'Missing-fundamental low drone: the root is implied, not played.'}),
 P('hullHum','Hull hum','Low end','roundBass','drone',.30,.06,5.0,{scene:'Space & sci-fi',transpose:-12,send:.12,about:'Very low sine hum that follows the chord root.'}),
 P('epicSub','Epic sub','Low end','roundBass','bass',.52,.30,.9,{scene:'Cinematic',send:.06,about:'Round sub-bass line.'}),
 P('pluckBass','Pluck bass','Low end','pluck','bass',.65,.4,1.1,{scene:'Strings & plucks',send:.12,about:'Plucked bass line.'}),
 P('subBass','Sub bass','Low end','roundBass','bass',.60,.2,.55,{scene:'Bass',send:.04,about:'Sine sub-bass line.'}),
 P('acidLine','Acid line','Low end','acidBass','bass',.50,.6,.35,{scene:'Bass',send:.06,about:'Resonant filtered saw bass.'}),
 P('darkDrone','Dark drone bass','Low end','acidBass','drone',.30,.12,3.4,{scene:'Bass',send:.2,about:'Held, filtered saw on the chord root.'}),
 // Struck & plucked
 P('starfield','Starfield','Struck & plucked','glass','sparse',.20,.34,3.6,{scene:'Space & sci-fi',transpose:12,pan:-.32,send:.78,about:'High inharmonic bell glints with long tails.'}),
 P('sonarPing','Sonar ping','Struck & plucked','glass','answer',.18,.08,4.4,{scene:'Space & sci-fi',transpose:-12,pan:.28,send:.82,about:'Dark, slow bell pings answering the melody.'}),
 P('electricPiano','Electric piano','Struck & plucked','tine','keys',.46,.34,2.4,{scene:'Keys & mallets',send:.32,about:'FM tine chords on a syncopated keys rhythm.'}),
 P('bells','Bells','Struck & plucked','glass','lead',.30,.42,1.9,{scene:'Keys & mallets',pan:.22,send:.5,about:'Inharmonic bell melody.'}),
 P('celesta','Celesta','Struck & plucked','glass','arp',.20,.20,1.2,{scene:'Keys & mallets',transpose:12,pan:-.24,send:.44,about:'Soft high arpeggio.'}),
 P('marimba','Marimba','Struck & plucked','felt','arp',.36,.5,.9,{scene:'Keys & mallets',pan:-.18,send:.3,about:'Wooden-sounding arpeggio.'}),
 P('musicBox','Music box','Struck & plucked','felt','sparse',.30,.2,1.5,{scene:'Keys & mallets',transpose:24,pan:.3,send:.5,about:'Tiny, high mallet notes.'}),
 P('feltPiano','Felt piano','Struck & plucked','felt','lead',.42,.30,2.0,{scene:'Keys & mallets',send:.42,about:'Soft mallet melody.'}),
 P('harp','Harp','Struck & plucked','pluck','arp',.55,.3,2.2,{scene:'Strings & plucks',pan:-.28,send:.46,about:'Plucked-string arpeggio.'}),
 P('nylonGuitar','Nylon guitar','Struck & plucked','pluck','lead',.60,.55,1.3,{scene:'Strings & plucks',pan:.2,send:.36,about:'Plucked melody.'}),
 P('koto','Koto','Struck & plucked','pluck','sparse',.55,.72,1.8,{scene:'Strings & plucks',transpose:12,pan:.3,send:.44,about:'Bright, sparse high plucks.'}),
 P('birdCalls','Bird calls','Struck & plucked','glass','answer',.14,.55,.35,{scene:'Nature & texture',transpose:24,pan:.4,send:.5,about:'Short high chirps answering the melody.'}),
 P('waterDrops','Water drops','Struck & plucked','felt','sparse',.20,.1,.4,{scene:'Nature & texture',transpose:24,pan:-.36,send:.6,about:'Brief high droplets.'}),
 // Pulses & blips
 P('commsBeeps','Comms beeps','Pulses & blips','pulse','sparse',.22,.5,.14,{scene:'Space & sci-fi',transpose:12,pan:.38,send:.22,about:'Short high console beeps.'}),
 P('telemetry','Telemetry','Pulses & blips','pulse','sequence',.18,.20,.14,{scene:'Space & sci-fi',pan:-.36,send:.18,octave:24,gate:.08,humanize:false,sequence:[12,null,null,19,null,12,null,null,24,null,null,null,19,null,null,null],about:'Sparse computer-style data sequence.'}),
 P('sputnikBeacon','Sputnik beacon','Pulses & blips','orbitBlip','sequence',.42,.55,.04,{scene:'Space & sci-fi',pan:.2,send:.22,octave:24,gate:1,humanize:false,sequence:[12,null,12,null,12,null,12,null],about:'Driven radio beacon tone, on/off like Sputnik 1 (native-Lean OrbitBlip family).'}),
 P('sonarBlup','Sonar blup','Pulses & blips','sonar','sparse',.55,.6,1.6,{scene:'Space & sci-fi',send:.3,about:'Sonar ping with an upward blup and built-in echo (native-Lean SonarBlup family).'}),
 P('brassStabs','Brass stabs','Pulses & blips','organ','stabs',.28,.82,.7,{scene:'Cinematic',pan:.12,send:.24,about:'Bright off-beat chord stabs.'}),
 P('arpeggiator','Arpeggiator','Pulses & blips','pulse','arp',.24,.4,.3,{scene:'Synth',pan:-.3,send:.28,about:'Classic filtered saw arpeggio.'}),
 P('stepSequencer','Step sequencer','Pulses & blips','pulse','sequence',.22,.24,.28,{scene:'Synth',pan:-.2,send:.1,octave:12,gate:.25,humanize:false,sequence:[12,null,19,12,15,null,22,null,12,17,null,24,19,null,15,null],about:'Two-octave hardware-style sequence.'}),
 P('chromeLead','Chrome lead','Pulses & blips','pulse','lead',.26,.6,.5,{scene:'Synth',pan:.1,send:.32,about:'Bright saw melody.'}),
 // Hits & thumps
 P('timpani','Timpani','Hits & thumps','tom','sparse',.36,.28,1.1,{scene:'Cinematic',transpose:-24,pan:-.1,send:.36,about:'Low tuned drum hits on the downbeats.'}),
 P('heartbeat','Heartbeat','Hits & thumps','heartbeat','sparse',.85,.42,.5,{scene:'Pulse & percussion',transpose:-36,send:.05,about:'Human lub-dub heartbeat on the downbeats (native-Lean HumanHeart family).'}),
 P('clockTicks','Clock ticks','Hits & thumps','hat','arp',.20,.3,.05,{scene:'Pulse & percussion',transpose:36,pan:.24,send:.08,about:'Light metallic ticks.'}),
 P('woodBlocks','Wood blocks','Hits & thumps','tom','arp',.20,.8,.12,{scene:'Pulse & percussion',transpose:12,pan:-.3,send:.18,about:'Tuned rim/block pattern.'}),
 // Noise & air
 P('solarWind','Solar wind','Noise & air','rain','air',.22,.82,4.2,{scene:'Space & sci-fi',send:.46,about:'Bright noise breathing in long swells.'}),
 P('radioSnow','Radio snow','Noise & air','radioSnow','air',.55,.5,3.0,{scene:'Radio & voices',send:.2,about:'Shortwave static with crackle and slow fading (native-Lean RadioSnow family).'}),
 P('squelch','Squelch bursts','Noise & air','rain','sparse',.32,.97,.22,{scene:'Radio & voices',transpose:24,pan:-.2,send:.06,about:'Short bursts of bright noise between transmissions.'}),
 P('rain','Rain','Noise & air','rain','air',.24,.25,3.0,{scene:'Nature & texture',send:.3,about:'Soft hash-noise rain.'}),
 P('wind','Wind','Noise & air','rain','air',.26,.04,5.0,{scene:'Nature & texture',transpose:-12,send:.5,about:'Dark, slow noise swells.'}),
 P('tapeAir','Tape air','Noise & air','rain','air',.16,.5,3.0,{scene:'Nature & texture',send:.24,about:'Faint hiss bed.'}),
 // Voices
 P('radioChatter','Radio chatter','Voices','sineVox','speechVowel',.34,.5,.6,{scene:'Radio & voices',pan:-.22,send:.08,companion:'radioConsonants',about:'Sine-wave speech transmissions. Words come from the "say" text.'}),
 P('radioConsonants','Radio consonants','Voices','speechGesture','speechConsonant',.24,.4,.12,{scene:'Radio & voices',pan:-.18,send:.05,about:'Consonant clicks and hiss that make sine-wave speech intelligible.'}),
 P('secondOperator','Second operator','Voices','sineVox','speechVowel',.22,.5,.7,{scene:'Radio & voices',pan:.34,send:.14,speechOffsetSteps:6,about:'A second voice repeating the transmission a beat and a half later.'}),
 P('whistleChoir','Whistle choir','Voices','sineChoir','speechVowel',.20,.5,1.3,{scene:'Radio & voices',pan:.18,send:.5,about:'Six-sine chorus singing the "say" text.'}),
 // Beating & illusions
 P('engineThrob','Engine throb','Beating & illusions','ghostBeat','drone',.16,.72,4.2,{scene:'Space & sci-fi',pan:.12,send:.3,about:'Two near-identical tones beating slowly against each other.'}),
 P('warpAscent','Warp ascent','Beating & illusions','shepard','continuous',.16,.55,6.0,{scene:'Space & sci-fi',send:.5,about:'Endlessly rising Shepard/Risset tone for the whole track.'}),
 P('impossibleAscent','Impossible ascent','Beating & illusions','shepard','continuous',.30,.66,5.2,{scene:'Illusions',send:.34,about:'A tone that seems to rise forever.'}),
 P('phantomRoot','Phantom root','Beating & illusions','phantomRoot','sparse',.30,.42,1.8,{scene:'Illusions',pan:-.28,send:.24,about:'Harmonics only; the ear supplies the fundamental.'}),
 P('ghostPulse','Ghost pulse','Beating & illusions','ghostBeat','air',.18,.58,3.2,{scene:'Illusions',pan:.28,send:.4,about:'Slow acoustic beating.'})
];
export const soundById=Object.fromEntries(sounds.map(s=>[s.id,s]));

// How each instrument family sounds, in plain words (the pattern `about` text says how it is synthesised).
// Envelope · pitch · register · tone. The DSP source of each is public/lean/patterns/<id>.lean.
export const familySound={
 roundBass:'Held · pitched · sub to low · smooth, pure and round, no buzz',
 acidBass:'Held or short · pitched · low · buzzy, squelchy filter sweep on each note',
 tine:'Struck, decaying · pitched · mid · electric-piano bell attack, mellow tail',
 glass:'Struck, long ring · pitched but slightly out of tune with itself · mid to high · bell-like, shimmering',
 pluck:'Plucked, decaying · pitched · low to high · guitar/harp-like string',
 felt:'Struck, short · pitched · mid to high · soft wooden mallet, warm',
 silk:'Slow swell, held · pitched · mid · soft detuned string/synth pad',
 choir:'Slow swell, held · pitched · mid · breathy “ah/oo” vowel cluster',
 organ:'Instant, held · pitched · mid · clean drawbar organ with light tremolo',
 pulse:'Short · pitched · mid to high · bright buzzy synth blips',
 rain:'Continuous · unpitched noise with a faint tone · wide · hiss, rain, wind',
 shepard:'Continuous · pitched, endlessly rising · wide · uncanny glide',
 phantomRoot:'Held · pitched (the root is implied) · low to mid · hollow, organ-like',
 ghostBeat:'Held · pitched · low to mid · slow wah-wah throb from two close tones',
 sineVox:'Speech-shaped · whistled formants · mid to high · thin robotic voice',
 sineChoir:'Speech-shaped · whistled formants, doubled · mid to high · small whistling chorus',
 speechGesture:'Very short · unpitched clicks, hiss and hums · consonants for the voices',
 kick:'Thump · low · round bass drum',
 snare:'Hit · noise plus body · mid · papery snare',
 hat:'Tick · metallic noise · high · closed/open hi-hat',
 clap:'Hit · noise bursts · mid · handclap with a short room',
 tom:'Hit, falling pitch · pitched · low to mid · ceramic tom, block or timpani',
 heartbeat:'Double thump (lub-dub) · low · soft, bodily',
 orbitBlip:'Short on/off tone · pitched · high · square-ish radio beacon with hiss',
 sonar:'Ping with upward “blup” and echo · pitched · mid · underwater sonar',
 radioSnow:'Continuous · noise with crackle and a faint whistle · wide · shortwave static',
 chamber:'Effect, not an instrument · the shared reverb room'
};
