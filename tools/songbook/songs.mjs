// The Labs songbook: Kids, Arty and Genres pieces written as chord charts, patterns and melodies.
// Melodies are original except the traditional nursery rhymes and Brahms' Wiegenlied (public domain).
// Steps: with sub 2 a step is an eighth note (quarter = 2); with sub 4 a sixteenth; sub 3 = swung triplets.
import {song,up} from './lib.mjs';

const TWINKLE_A='C5/2 C5/2 G5/2 G5/2 | A5/2 A5/2 G5/4 | F5/2 F5/2 E5/2 E5/2 | D5/2 D5/2 C5/4';
const TWINKLE_B='G5/2 G5/2 F5/2 F5/2 | E5/2 E5/2 D5/4 | G5/2 G5/2 F5/2 F5/2 | E5/2 E5/2 D5/4';
const TWINKLE=`${TWINKLE_A} | ${TWINKLE_B} | ${TWINKLE_A}`,TWINKLE_BARS='C F,C F,C G,C | C,F C,G C,F C,G | C F,C F,C G,C';

export const KIDS=[
song({title:'Nursery Rhyme Medley',description:'Six traditional nursery rhymes in a row, each on its own instrument: Twinkle Twinkle (music box), Mary Had a Little Lamb (marimba), London Bridge (glockenspiel), Hot Cross Buns (recorder), Old MacDonald (accordion), and Twinkle again with everyone.',
 key:'C major',bpm:104,rhythm:'brush',room:.35,
 form:[
  {name:'Twinkle Twinkle',bars:TWINKLE_BARS,energy:.4,drums:false,parts:{box:TWINKLE}},
  {name:'Mary Had a Little Lamb',bars:'C C G C | C C G C',energy:.55,parts:{marimba:'E5/2 D5/2 C5/2 D5/2 | E5/2 E5/2 E5/4 | D5/2 D5/2 D5/4 | E5/2 G5/2 G5/4 | E5/2 D5/2 C5/2 D5/2 | E5/2 E5/2 E5/2 E5/2 | D5/2 D5/2 E5/2 D5/2 | C5/8'}},
  {name:'London Bridge',bars:'C C G C | C C G C',energy:.6,parts:{glock:'G5/3 A5/1 G5/2 F5/2 | E5/2 F5/2 G5/4 | D5/2 E5/2 F5/4 | E5/2 F5/2 G5/4 | G5/3 A5/1 G5/2 F5/2 | E5/2 F5/2 G5/4 | D5/4 G5/4 | E5/2 C5/6'}},
  {name:'Hot Cross Buns',bars:'C C C,G C',x:2,energy:.5,parts:{recorder:'E5/2 D5/2 C5/4 | E5/2 D5/2 C5/4 | C5 C5 C5 C5 D5 D5 D5 D5 | E5/2 D5/2 C5/4'}},
  {name:'Old MacDonald',bars:'C F,C C,G C | C F,C C,G C',energy:.7,parts:{accordion:'C5/2 C5/2 C5/2 G4/2 | A4/2 A4/2 G4/4 | E5/2 E5/2 D5/2 D5/2 | C5/6 G4/2 | C5/2 C5/2 C5/2 G4/2 | A4/2 A4/2 G4/4 | E5/2 E5/2 D5/2 D5/2 | C5/8'}},
  {name:'Twinkle, all together',bars:TWINKLE_BARS,energy:.75,parts:{box:TWINKLE,bells:up(TWINKLE,-12)}}],
 tracks:{
  box:{sound:'musicBox',label:'Music box',level:.55,send:.35},
  marimba:{sound:'marimba',label:'Marimba',level:.6},
  glock:{sound:'modalGlassBarMediumShort',label:'Glockenspiel',level:.5,send:.3},
  recorder:{sound:'blownRecorderPureHigh',label:'Recorder',level:1.1},
  accordion:{sound:'reedAccordionSoftStill',label:'Accordion',level:1.1},
  bells:{sound:'celesta',label:'Celesta',level:.4},
  harp:{sound:'pluckHarpSoftDark',label:'Harp',pattern:'arp',lo:55,level:.32},
  bass:{sound:'bowedBassAiryWarm',label:'Bass',pattern:'rootfifth',level:.6}}}),

song({title:"Brahms' Lullaby",description:"Brahms' Wiegenlied (1868) in F: felt piano melody over harp, a low string drone and soft strings, then the melody again on celesta an octave up.",
 key:'F major',bpm:84,meter:'3/4',room:.6,
 form:[
  {name:'Intro',bars:'C C',energy:.3,parts:{piano:'r/6',celesta:'r/6'}},
  {name:'Lullaby',bars:'C C C F | G7 G7 G7 G7 | C F C F | C F C G7 | C',energy:.45,parts:{piano:'E5/1 E5/1 G5/4 | E5/1 E5/1 G5/4 | E5/1 G5/1 C6/2 B5/2 | A5/2 A5/2 G5/2 | D5/1 E5/1 F5/2 D5/2 | D5/1 E5/1 F5/4 | D5/1 F5/1 B5/3 A5/1 | G5/2 B5/2 C6/2 | C6/6 | C5/1 C5/1 C6/4 | A5/1 F5/1 G5/4 | E5/1 C5/1 F5/2 G5/2 | A5/2 G5/4 | C5/1 C5/1 C6/4 | A5/1 F5/1 G5/4 | E5/1 C5/1 F5/2 E5/1 D5/1 | C5/6',celesta:'r/6'}},
  {name:'Again, higher',bars:'C C C F | G7 G7 G7 G7 | C F C F | C F C G7 | C',energy:.5,parts:{celesta:'E6/1 E6/1 G6/4 | E6/1 E6/1 G6/4 | E6/1 G6/1 C7/2 B6/2 | A6/2 A6/2 G6/2 | D6/1 E6/1 F6/2 D6/2 | D6/1 E6/1 F6/4 | D6/1 F6/1 B6/3 A6/1 | G6/2 B6/2 C7/2 | C7/6 | C6/1 C6/1 C7/4 | A6/1 F6/1 G6/4 | E6/1 C6/1 F6/2 G6/2 | A6/2 G6/4 | C6/1 C6/1 C7/4 | A6/1 F6/1 G6/4 | E6/1 C6/1 F6/2 E6/1 D6/1 | C6/6',piano:'r/6'}},
  {name:'Close',bars:'C C',energy:.25,parts:{piano:'C5/6 | C5+E5+G5/6',celesta:'r/6'}}],
 tracks:{
  piano:{sound:'feltPiano',label:'Felt piano',level:.6,send:.4,transpose:5},
  celesta:{sound:'celesta',label:'Celesta',level:.4,send:.5,transpose:5},
  harp:{sound:'pluckHarpSoftDark',label:'Harp',pattern:'waltz',lo:52,level:.3,transpose:5},
  strings:{sound:'stringEnsemble',label:'Strings',pattern:'block',lo:48,level:.18,transpose:5},
  cello:{sound:'bowedCelloSmoothWarm',label:'Cello',pattern:'whole',level:.3,transpose:5}}}),

song({title:'Twinkle, Slowly',description:'Twinkle Twinkle as a lullaby: music box at a sleepy tempo, harp arpeggios and a warm pad, with suspended chords at the ends of phrases.',
 key:'C major',bpm:66,room:.65,
 form:[{name:'Verse',bars:'C F,C Fsus2,C Gsus4,C | Csus2,F C,G C,F Csus4,G | C F,C F,C Gsus4,C',energy:.4,parts:{box:TWINKLE}},
  {name:'Hum',bars:'C F,C F,C G,C | C,F C,G C,F C,G | C F,C F,C Gsus4,C',energy:.35,parts:{hum:up(TWINKLE,-12),box:'r/8'}},
  {name:'End',bars:'Fmaj7 C',energy:.2,parts:{box:'C6/16',hum:'r/16'}}],
 tracks:{box:{sound:'musicBox',label:'Music box',level:.55,send:.5},hum:{sound:'voiceUAltoBreathy',label:'Humming',level:.35,send:.4},
  harp:{sound:'pluckHarpSoftDark',label:'Harp',pattern:'arp',lo:52,level:.28},pad:{sound:'nebulaPad',label:'Warm pad',pattern:'block',lo:48,level:.16}}}),

song({title:'Little Boat',description:'An original rocking lullaby in 6/8: humming over harp and cello, the tune passing to an ocarina the second time.',
 key:'G major',bpm:120,meter:'6/8',room:.6,
 form:[{name:'Rocking',bars:'G C G D | G C D G',energy:.4,parts:{hum:'B4/2 D5/1 G5/3 | E5/2 D5/1 C5/3 | B4/2 A4/1 G4/2 B4/1 | A4/6 | B4/2 D5/1 G5/3 | G5/2 E5/1 C5/3 | B4/2 C5/1 A4/2 F#4/1 | G4/6',ocarina:'r/6'}},
  {name:'Ocarina',bars:'G C G D | G C D G',energy:.45,parts:{ocarina:'B5/2 D6/1 G6/3 | E6/2 D6/1 C6/3 | B5/2 A5/1 G5/2 B5/1 | A5/6 | B5/2 D6/1 G6/3 | G6/2 E6/1 C6/3 | B5/2 C6/1 A5/2 F#5/1 | G5/6',hum:'r/6'}},
  {name:'Asleep',bars:'C G',energy:.25,parts:{hum:'G4/12',ocarina:'r/6'}}],
 tracks:{hum:{sound:'voiceOAltoBreathy',label:'Humming',level:.4,send:.4},ocarina:{sound:'blownOcarinaPureLow',label:'Ocarina',level:1,send:.45},
  harp:{sound:'pluckHarpSoftDark',label:'Harp',pattern:'sixeightstrum',lo:55,level:.28},cello:{sound:'bowedCelloSmoothWarm',label:'Cello',pattern:'sixeight',level:.28}}}),

song({title:'Moon over the Cot',description:'An original waltz lullaby in F: music box, then a child-like hum, over harp and a slow string pad.',
 key:'F major',bpm:72,meter:'3/4',room:.6,
 form:[{name:'Verse',bars:'F Bb F C | Dm Bb C F',x:2,energy:.4,parts:{box:'A5/4 G5/1 F5/1 | D5/4 F5/2 | C5/2 F5/2 A5/2 | G5/6 | A5/3 G5/1 F5/2 | D5/2 F5/2 Bb5/2 | A5/2 G5/2 E5/2 | F5/6'}},
  {name:'Hum',bars:'F Bb F C | Dm Bb C F',energy:.35,parts:{box:'r/6',hum:'A4/4 G4/1 F4/1 | D4/4 F4/2 | C4/2 F4/2 A4/2 | G4/6 | A4/3 G4/1 F4/2 | D4/2 F4/2 Bb4/2 | A4/2 G4/2 E4/2 | F4/6'}}],
 tracks:{box:{sound:'musicBox',label:'Music box',level:.55,send:.45},hum:{sound:'voiceUChildBreathy',label:'Hum',level:.4,send:.4},
  harp:{sound:'pluckHarpSoftDark',label:'Harp',pattern:'waltz',lo:53,level:.5},pad:{sound:'stringEnsemble',label:'Strings',pattern:'block',lo:48,level:.15},bass:{sound:'bowedBassSmoothWide',label:'Bass',pattern:'waltzbass',level:.3}}})
];

export const ARTY=[
song({title:'Glass Harbour',description:'Night water in D minor: glass-bar arpeggios over a slow cello line, a violin taking the tune an octave up, and a wide sea texture.',
 key:'D minor',bpm:70,room:.75,
 form:[{name:'Water',bars:'Dm9 Dm9 Bbmaj7 Bbmaj7 Gm7 Gm7 A7 A7',energy:.35,parts:{cello:'r/8',violin:'r/8'}},
  {name:'Cello',bars:'Dm9 Dm9 Bbmaj7 Bbmaj7 Gm7 Gm7 A7 A7',energy:.5,parts:{cello:'A3/6 C4/2 | D4/8 | D4/6 F4/2 | A3/8 | Bb3/4 D4/4 | G4/8 | E4/4 C#4/4 | A3/8',violin:'r/8'}},
  {name:'Violin',bars:'Dm9 Dm9 Bbmaj7 Bbmaj7 Gm7 Gm7 A7 A7',energy:.6,parts:{violin:'A5/6 C6/2 | D6/8 | D6/6 F6/2 | A5/8 | Bb5/4 D6/4 | G6/8 | E6/4 C#6/4 | A5/8',cello:'D3/16 | Bb2/16 | G2/16 | A2/16'}},
  {name:'Still',bars:'Dm9 Dm9',energy:.3,parts:{violin:'r/8',cello:'D3/16'}}],
 tracks:{glass:{sound:'modalGlassBarSoftRing',label:'Glass bars',pattern:'arp',lo:62,level:.35,send:.55},cello:{sound:'bowedCelloSmoothWarm',label:'Cello',level:.55,send:.4},
  violin:{sound:'bowedViolinSmoothWarm',label:'Violin',level:.4,send:.5},bass:{sound:'bowedBassSmoothStill',label:'Bass',pattern:'whole',level:.3},
  sea:{sound:'noiseSeaStillWide',label:'Sea',pattern:'whole',level:.12,send:.3}}}),

song({title:'Paper Lanterns',description:'A slow procession in E hijaz (Phrygian with a raised third): oud melody, tabla, a long string pad and a drone.',
 key:'E hijaz',bpm:84,room:.55,
 form:[{name:'Procession',bars:'E E Dm E | E E F E',x:2,energy:.55,parts:{oud:'E5/2 F5/2 G#5/2 A5/2 | B5/4 A5/2 G#5/2 | A5/2 G#5/2 F5/2 E5/2 | F5/4 E5/4 | B5/2 C6/2 B5/2 A5/2 | G#5/4 B5/4 | C6/2 B5/2 A5/2 G#5/2 | E5/8'}},
  {name:'Lanterns out',bars:'E Dm E E',energy:.35,parts:{oud:'B5/8 | A5/4 F5/4 | G#5/4 F5/4 | E5/8'}}],
 tracks:{oud:{sound:'pluckOudSoftDark',label:'Oud',level:.9,send:.35},tabla:{sound:'handTablaMuted',label:'Tabla',pattern:'quarters',lo:48,level:.3},
  pad:{sound:'stringEnsemble',label:'Strings',pattern:'block',lo:52,level:.15},drone:{sound:'bowedCelloAiryStill',label:'Drone',pattern:'whole',level:.25}}}),

song({title:'Fog Choir',description:'Voices in C minor moving slowly through Ab, F minor and G, ending on a C major chord (a Picardy third).',
 key:'C minor',bpm:60,room:.85,
 form:[{name:'Choir',bars:'Cm Ab Fm G | Cm Eb Fm,G C',energy:.45,parts:{soprano:'G5/8 | Ab5/8 | Ab5/4 F5/4 | G5/4 F5/2 D5/2 | Eb5/8 | G5/4 Bb5/4 | C6/4 B5/4 | C6/8'}},
  {name:'Again',bars:'Cm Ab Fm G | Cm Eb Fm,G C',energy:.4,parts:{soprano:'G5/8 | Ab5/8 | Ab5/4 F5/4 | G5/4 F5/2 D5/2 | Eb5/8 | G5/4 Bb5/4 | C6/4 B5/4 | C6/8'}}],
 tracks:{soprano:{sound:'voiceISopranoBreathy',label:'Soprano',level:.4,send:.5},choir:{sound:'voiceAaAltoBreathy',label:'Choir',pattern:'block',lo:55,level:.3,send:.55},
  low:{sound:'voiceOBassClean',label:'Bass voices',pattern:'whole',level:.35,send:.4}}}),

song({title:'Copper Leaves',description:'An autumn waltz in D minor: clarinet over harp, with glockenspiel answering in the second half.',
 key:'D minor',bpm:90,meter:'3/4',room:.55,
 form:[{name:'Waltz',bars:'Dm Dm Bb Bb | Gm Gm A A',energy:.5,parts:{clarinet:'A5/4 G5/1 F5/1 | E5/2 F5/2 D5/2 | D5/4 C5/1 Bb4/1 | F5/6 | G5/4 F5/1 E5/1 | D5/2 G5/2 Bb5/2 | C#5/4 E5/2 | A5/6',glock:'r/6'}},
  {name:'Second half',bars:'Dm Dm Bb Bb | Gm A Dm Dm',energy:.6,parts:{clarinet:'A5/4 G5/1 F5/1 | E5/2 F5/2 D5/2 | D5/4 C5/1 Bb4/1 | F5/6 | G5/2 Bb5/2 D6/2 | C#6/3 E6/1 A5/2 | D6/6 | D5/6',glock:'r/6 | r/6 | r/6 | F6/2 A6/2 C7/2 | r/6 | r/6 | F6/2 A6/2 D7/2 | r/6'}},
  {name:'Waltz again',bars:'Dm Dm Bb Bb | Gm A Dm Dm',energy:.45,parts:{clarinet:'A5/4 G5/1 F5/1 | E5/2 F5/2 D5/2 | D5/4 C5/1 Bb4/1 | F5/6 | G5/2 Bb5/2 D6/2 | C#6/3 E6/1 A5/2 | D6/6 | D5/6',glock:'r/6'}}],
 tracks:{clarinet:{sound:'reedClarinetSoftVibrato',label:'Clarinet',level:1.3,send:.35},glock:{sound:'modalGlassBarMediumShort',label:'Glockenspiel',level:.55,send:.4},
  harp:{sound:'pluckHarpSoftDark',label:'Harp',pattern:'waltz',lo:53,level:.5},bass:{sound:'bowedBassAiryWarm',label:'Bass',pattern:'waltzbass',level:.55}}})
];

// Eurovision chorus, then the same a semitone up.
const EURO='G#5/2 G#5/2 G#5/1 F#5/1 E5/2 | E5/2 C#5/2 E5/4 | B5/3 G#5/1 E5/2 G#5/2 | F#5/8 | G#5/2 G#5/2 B5/2 C#6/2 | C#6/2 B5/2 A5/4 | G#5/2 E5/2 B5/2 E6/2 | D#6/4 B5/4';
const BLUES='E5/2 G5/1 A5/3 G5/2 E5/1 r/3 | F#5/2 A5/1 C6/3 A5/3 r/3 | E5/2 G5/1 A5/2 C5/1 D5/2 D#5/1 E5/3 | C5/2 A4/1 A4/6 r/3 | D5/2 F#5/1 A5/3 C6/2 A5/1 r/3 | A5/2 F#5/1 D5/6 r/3 | E5/2 G5/1 A5/3 G5/2 E5/1 C5/3 | A4/9 r/3 | B5/3 G#5/2 E5/1 B4/3 r/3 | A5/3 F#5/2 D5/1 C5/3 r/3 | E5/2 C5/1 A4/3 r/2 C5/1 D5/2 D#5/1 | E5/3 D5/2 B4/1 G#4/3 r/3';

export const GENRES=[
song({title:'Ska · Rudie Walk',description:'Ska at 152 bpm: off-beat guitar and organ skank, a walking bass, and a sax and brass section playing the tune in octaves.',
 key:'C major',bpm:152,rhythm:'ska',room:.3,
 form:[{name:'Intro',bars:'C Am F G',energy:.6,parts:{sax:'r/8',brass:'r/8'}},
  {name:'Horns',bars:'C Am F G | C Am F G',x:2,energy:.85,parts:{sax:'E5/2 G5/2 r/1 G5/1 A5/2 | C6/3 A5/1 G5/4 | F5/2 A5/2 C6/2 A5/2 | G5/6 r/2 | E5/2 G5/2 r/1 G5/1 A5/2 | C6/3 E6/1 D6/4 | C6/2 A5/2 F5/2 A5/2 | G5/2 B5/2 D6/4'}},
  {name:'Out',bars:'C Am F G,C',energy:.7,parts:{sax:'E5/2 G5/2 r/1 G5/1 A5/2 | C6/3 A5/1 G5/4 | F5/2 A5/2 C6/2 A5/2 | G5/4 C6/4'}}],
 tracks:{sax:{sound:'reedSaxReedyStill',label:'Sax',level:1.5,pan:-.2,send:.25},brass:{sound:'subSawBrassBp',label:'Brass',level:.3,pan:.2,transpose:-12,double:'sax'},
  guitar:{sound:'pluckGuitarBrightDark',label:'Skank guitar',pattern:'offbeat',lo:60,level:.35,pan:.35},organ:{sound:'organJazzPercStill',label:'Organ bubble',pattern:'offbeat',lo:55,level:.22,pan:-.35},
  bass:{sound:'subSquareBassLp',label:'Walking bass',pattern:'ska',level:.5}},extra:{}}),

song({title:'Glam Rock · Silver Platform Boots',description:'A glam stomp in A: four-on-the-floor kick with handclaps, chugging fuzz chords, octave bass and a chanted tune doubled on sax.',
 key:'A major',bpm:124,rhythm:'glam',room:.3,
 form:[{name:'Stomp',bars:'A A D D',energy:.6,parts:{voice:'r/8',sax:'r/8'}},
  {name:'Chant',bars:'A A D A | E D A A',x:2,energy:.85,parts:{voice:'A4/2 r/2 A4/2 C#5/2 | E5/4 r/2 C#5/2 | D5/2 r/2 D5/2 F#5/2 | A5/4 r/4 | E5/2 E5/2 F#5/2 E5/2 | D5/2 C#5/2 B4/4 | A4/2 C#5/2 E5/2 C#5/2 | A4/6 r/2'}},
  {name:'Sax break',bars:'A A D A | E D A A',energy:1,parts:{voice:'r/8',sax:'E5/2 r/2 E5/2 A5/2 | C#6/4 r/2 A5/2 | F#5/2 r/2 F#5/2 A5/2 | E6/4 r/4 | B5/2 B5/2 C#6/2 B5/2 | A5/2 F#5/2 D5/4 | C#5/2 E5/2 A5/2 E5/2 | A5/6 r/2'}}],
 tracks:{voice:{sound:'voiceAaTenorClean',label:'Chant',level:.5,send:.3},sax:{sound:'reedSaxReedyVibrato',label:'Sax',level:1.3,send:.3},
  fuzz:{sound:'subSyncBrassBp',label:'Fuzz chords',pattern:'power',lo:45,level:.3,life:.2},bass:{sound:'subSawBassLp',label:'Bass',pattern:'octave',level:.45}}}),

song({title:'Heavy Metal · Iron Weather',description:'Galloping power chords in E with a Phrygian F, double kick at full energy, a 16th-note bass pedal and a sync lead solo.',
 key:'E phrygian',bpm:150,sub:4,rhythm:'metal',room:.25,
 form:[{name:'Riff',bars:'E5 E5 C5,D5 E5 | E5 E5 G5,F#5 F5',energy:.7,parts:{lead:'r/16'}},
  {name:'Full',bars:'E5 E5 C5,D5 E5 | E5 E5 G5,F#5 F5',energy:1,parts:{lead:'r/16'}},
  {name:'Solo',bars:'E5 E5 C5,D5 E5 | E5 E5 G5,F#5 F5',energy:1,parts:{lead:'E5/4 G5/4 B5/4 E6/4 | D6/2 B5/2 G5/4 F#5/8 | G5/4 E5/4 A5/4 F#5/4 | E5/16 | B5/2 C6/2 B5/2 A5/2 G5/4 B5/4 | E6/8 D6/8 | B5/4 G5/4 B5/4 A#5/4 | A5/4 F5/4 E5/8'}},
  {name:'Riff out',bars:'E5 E5 C5,D5 E5,F5 E5',energy:1,parts:{lead:'r/16'}}],
 tracks:{rhythm:{sound:'subSyncPluckBp',label:'Rhythm guitar',pattern:'chug',lo:40,level:1,pan:-.3,life:.15},rhythm2:{sound:'subSawBrassBp',label:'Second guitar',pattern:'power',lo:40,level:.25,pan:.3,life:.15},
  bass:{sound:'subSawBassLp',label:'Bass',pattern:'pedal',level:.45},lead:{sound:'subSyncLeadBp',label:'Lead',level:.4,send:.3}}}),

song({title:'Folk · Over the Hill',description:'An original jig in D (6/8): fiddle with a tin whistle joining for the B part, guitar strumming and a bodhrán-style stomp.',
 key:'D major',bpm:150,meter:'6/8',rhythm:'stomp',room:.35,
 form:[{name:'A part',bars:'D G D A | D G A D',x:2,energy:.6,parts:{fiddle:'F#5/2 E5/1 D5/2 F#5/1 | G5/2 B5/1 B5/2 A5/1 | F#5/2 A5/1 D6/2 A5/1 | E5/2 F#5/1 E5/2 C#5/1 | F#5/2 E5/1 D5/2 F#5/1 | G5/2 B5/1 D6/2 B5/1 | A5/2 F#5/1 E5/2 C#5/1 | D5/3 D5/3',whistle:'r/6'}},
  {name:'B part',bars:'D Bm G A | D Bm Em,A D',x:2,energy:.85,parts:{fiddle:'A5/2 B5/1 A5/2 F#5/1 | B5/2 D6/1 F#6/2 D6/1 | B5/2 A5/1 G5/2 B5/1 | A5/2 C#6/1 E6/2 C#6/1 | A5/2 F#5/1 D5/2 F#5/1 | F#5/2 B5/1 D6/2 B5/1 | G5/2 E5/1 A5/2 C#5/1 | D5/6',whistle:'A6/2 B6/1 A6/2 F#6/1 | B6/2 D7/1 F#7/2 D7/1 | B6/2 A6/1 G6/2 B6/1 | A6/2 C#7/1 E7/2 C#7/1 | A6/2 F#6/1 D6/2 F#6/1 | F#6/2 B6/1 D7/2 B6/1 | G6/2 E6/1 A6/2 C#6/1 | D6/6'}},
  {name:'A again',bars:'D G D A | D G A D',energy:.9,parts:{fiddle:'F#5/2 E5/1 D5/2 F#5/1 | G5/2 B5/1 B5/2 A5/1 | F#5/2 A5/1 D6/2 A5/1 | E5/2 F#5/1 E5/2 C#5/1 | F#5/2 E5/1 D5/2 F#5/1 | G5/2 B5/1 D6/2 B5/1 | A5/2 F#5/1 E5/2 C#5/1 | D5/6',whistle:'F#6/2 E6/1 D6/2 F#6/1 | G6/2 B6/1 B6/2 A6/1 | F#6/2 A6/1 D7/2 A6/1 | E6/2 F#6/1 E6/2 C#6/1 | F#6/2 E6/1 D6/2 F#6/1 | G6/2 B6/1 D7/2 B6/1 | A6/2 F#6/1 E6/2 C#6/1 | D6/6'}}],
 tracks:{fiddle:{sound:'bowedFiddleSmoothWarm',label:'Fiddle',level:.5,pan:-.15,send:.3},whistle:{sound:'blownWhistlePureHigh',label:'Tin whistle',level:.9,pan:.2,send:.3},
  guitar:{sound:'pluckGuitarSoftDark',label:'Guitar',pattern:'sixeightstrum',lo:52,level:.32,pan:.3},bass:{sound:'bowedBassAiryWarm',label:'Bass',pattern:'sixeight',level:.7}}}),

song({title:'Blues · Long Road Shuffle',description:'Two choruses of a 12-bar shuffle in A, swung in triplets: boogie bass, electric piano comping and a sax answering itself.',
 key:'A mixolydian',bpm:92,sub:3,rhythm:'shuffle',room:.4,
 form:[{name:'First chorus',bars:'A7 D7 A7 A7 | D7 D7 A7 A7 | E7 D7 A7 E7',energy:.65,parts:{sax:BLUES,organ:'r/12'}},
  {name:'Second chorus',bars:'A7 D7 A7 A7 | D7 D7 A7 A7 | E7 D7 A7 E7',energy:.85,parts:{sax:BLUES}},
  {name:'Tag',bars:'A7',energy:.6,parts:{sax:'A4/12',keys:'block'}}],
 tracks:{sax:{sound:'reedSaxReedyVibrato',label:'Sax',level:1.4,send:.3},keys:{sound:'electricPiano',label:'Electric piano',pattern:'shuffle',lo:55,level:.25,life:.35},
  organ:{sound:'organJazzPlainTremolo',label:'Organ',pattern:'block',lo:55,level:.18},bass:{sound:'subSquareBassLp',label:'Boogie bass',pattern:'boogie',level:.5}}}),

song({title:'Sea Shanty · Haul Away, Sally',description:'An original shanty in D minor: a solo voice calls and a low crew answers, over accordion, fiddle and a stamping beat.',
 key:'D minor',bpm:100,rhythm:'stomp',room:.4,
 form:[{name:'Verse',bars:'Dm Dm C Dm | Dm C A7 Dm',x:2,energy:.6,parts:{fiddle:'r/8'}},
  {name:'All hands',bars:'Dm Dm C Dm | Dm C A7 Dm',x:2,energy:.9,parts:{fiddle:'A5/2 D6/2 D6/2 E6/2 | F6/3 E6/1 D6/4 | C6/2 C6/2 E6/2 C6/2 | D6/8 | A5/2 D6/2 F6/2 A6/2 | G6/3 F6/1 E6/4 | D6/2 E6/2 F6/2 E6/2 | D6/8'}}],
 tracks:{call:{sound:'voiceOTenorClean',label:'Shantyman',pattern:'A4/2 D5/2 D5/2 E5/2 | F5/3 E5/1 D5/4 | r/16 | A4/2 D5/2 F5/2 A5/2 | G5/3 F5/1 E5/4 | r/16',level:.5,send:.3},
  crew:{sound:'voiceAaBassClean',label:'Crew',pattern:'r/16 | C4/2 C4/2 E4/2 C4/2 | D4/8 | r/16 | D4/2 E4/2 F4/2 E4/2 | D4/8',level:.55,send:.35},
  fiddle:{sound:'bowedFiddleGrittyWarm',label:'Fiddle',level:.35,send:.3},accordion:{sound:'reedAccordionBrassyStill',label:'Accordion',pattern:'backbeat',lo:53,level:.3},
  bass:{sound:'bowedBassGrittyWarm',label:'Bass',pattern:'rootfifth',level:.4}}}),

song({title:'House · Warehouse Sunrise',description:'Deep house in F minor at 124: syncopated bass, piano chord pushes, strings, and a sung hook that climbs through the progression.',
 key:'F minor',bpm:124,sub:4,rhythm:'house',room:.4,
 form:[{name:'Groove',bars:'Fm7 Fm7 Dbmaj7 Dbmaj7 Bbm7 Bbm7 C7 C7',energy:.6,parts:{voice:'r/16'}},
  {name:'Hook',bars:'Fm7 Fm7 Dbmaj7 Dbmaj7 Bbm7 Bbm7 C7 C7',x:2,energy:.9,parts:{voice:'C6/4 r/2 Ab5/2 C6/4 Eb6/4 | C6/6 Ab5/2 F5/8 | F6/4 r/2 Db6/2 F6/4 Ab6/4 | F6/6 Db6/2 C6/8 | F6/4 r/2 Db6/2 F6/4 Ab6/4 | F6/6 Db6/2 Bb5/8 | E6/4 r/2 C6/2 E6/4 G6/4 | E6/6 C6/2 Bb5/8'}},
  {name:'Breakdown',bars:'Fm7 Fm7 Dbmaj7 C7',energy:.4,drums:false,parts:{voice:'C6/16 | r/16 | F6/16 | E6/16',bass:'rest'}}],
 tracks:{voice:{sound:'voiceAaSopranoClean',label:'Vocal hook',level:.4,send:.4},piano:{sound:'electricPiano',label:'Piano',pattern:'push',lo:57,level:.4,life:.35},
  strings:{sound:'stringEnsemble',label:'Strings',pattern:'block',lo:60,level:.15},bass:{sound:'subSquareBassLp',label:'Bass',pattern:'synco',level:.5}}}),

song({title:'Eurovision · Douze Points Forever',description:'Every trick at once: a disco beat, octave bass, a pumping string section, a bouzouki-style mandolin, and the last chorus a semitone up after a drum hit.',
 key:'E major',bpm:128,rhythm:'disco',room:.4,
 form:[{name:'Verse',bars:'C#m A E B',x:2,energy:.6,parts:{lead:'C#5/2 C#5/2 E5/2 C#5/2 | A4/4 C#5/4 | B4/2 E5/2 G#5/2 E5/2 | F#5/8',voice:'r/8'}},
  {name:'Chorus',bars:'C#m A E B | C#m A E B',energy:.9,parts:{lead:EURO,voice:EURO}},
  {name:'Key change',bars:'Dm Bb F C | Dm Bb F C',energy:1,parts:{lead:up(EURO,1),voice:up(EURO,1)}},
  {name:'Big finish',bars:'Dm Bb F,C F',energy:1,parts:{lead:'A5/2 A5/2 A5/1 G5/1 F5/2 | F5/2 D5/2 F5/4 | C6/4 A5/4 | F5/8',voice:'A5/2 A5/2 A5/1 G5/1 F5/2 | F5/2 D5/2 F5/4 | C6/4 A5/4 | F5/8'}}],
 tracks:{lead:{sound:'subSawLeadLp',label:'Synth lead',level:.4,send:.3},voice:{sound:'voiceAaSopranoClean',label:'Diva',level:.4,send:.4},
  strings:{sound:'stringEnsemble',label:'Strings',pattern:'pump',lo:60,level:.45,life:.25},mandolin:{sound:'pluckMandolinBrightMetal',label:'Bouzouki',pattern:'arp',lo:62,level:.25},
  bass:{sound:'subPulseBassLp',label:'Octave bass',pattern:'octave',level:.45}}}),

song({title:'Indie · Bicycle Summer',description:'Jangly indie pop in G: a chiming 16th-note guitar, eighth-note bass, and the tune on glockenspiel then voice.',
 key:'G major',bpm:140,rhythm:'rock',room:.35,
 form:[{name:'Verse',bars:'G D Em C',x:2,energy:.6,parts:{glock:'B4/2 D5/2 D5/2 B4/2 | A4/2 F#4/2 A4/4 | G4/2 B4/2 E5/3 D5/1 | C5/4 E5/4',voice:'r/8'}},
  {name:'Chorus',bars:'G D Em C',x:2,energy:.85,parts:{voice:'D5/2 G5/2 G5/2 F#5/2 | F#5/2 E5/2 D5/4 | B4/2 E5/2 G5/3 F#5/1 | E5/4 G5/4',glock:'D6/2 G6/2 G6/2 F#6/2 | F#6/2 E6/2 D6/4 | B5/2 E6/2 G6/3 F#6/1 | E6/4 G6/4'}},
  {name:'End',bars:'G D C G',energy:.6,parts:{glock:'B5/2 D6/2 D6/2 B5/2 | A5/2 F#5/2 A5/4 | G5/2 E5/2 C5/4 | B4/8',voice:'r/8'}}],
 tracks:{glock:{sound:'modalGlassBarMediumShort',label:'Glockenspiel',level:.4,send:.3},voice:{sound:'voiceOTenorClean',label:'Voice',level:.45,send:.3},
  jangle:{sound:'pluckGuitarBrightMetal',label:'Jangle guitar',pattern:'arp16',lo:59,level:.25,pan:.3},rhythm:{sound:'pluckGuitarSoftDark',label:'Rhythm guitar',pattern:'pump',lo:52,level:.4,pan:-.3,life:.2},
  bass:{sound:'subPulseBassLp',label:'Bass',pattern:'eighth',level:.45}}}),

song({title:'Goth · Velvet Crypt',description:'Post-punk gloom in D minor: a melodic bass high up the neck, chorused guitar arpeggios drenched in echo, and a deep voice.',
 key:'D minor',bpm:132,rhythm:'postpunk',room:.6,
 form:[{name:'Bass',bars:'Dm Dm Bb Bb | C C Am Am',energy:.6,parts:{voice:'r/8',guitar:'rest'}},
  {name:'Verse',bars:'Dm Dm Bb Bb | C C Am Am',x:2,energy:.8,parts:{voice:'A4/8 | F4/8 | F4/6 G4/2 | D4/8 | E4/8 | G4/8 | E4/4 C4/4 | A3/8'}},
  {name:'Fade',bars:'Dm Bb C Dm',energy:.5,parts:{voice:'D4/16 | E4/8 | D4/8',bass:'eighth'}}],
 tracks:{bass:{sound:'subSawBassBp',label:'Melodic bass',pattern:'D3/2 D4/2 A3/2 F3/2 | D3/2 A3/2 C4/2 A3/2 | Bb2/2 Bb3/2 F3/2 D3/2 | Bb2/2 F3/2 A3/2 F3/2 | C3/2 C4/2 G3/2 E3/2 | C3/2 G3/2 Bb3/2 G3/2 | A2/2 A3/2 E3/2 C3/2 | A2/2 E3/2 G3/2 E3/2',level:.5},
  guitar:{sound:'pluckGuitarSoftMetal',label:'Chorus guitar',pattern:'arp',lo:62,level:.25,send:.7},voice:{sound:'voiceOBassClean',label:'Voice',level:.5,send:.5},
  pad:{sound:'organMellowPlainChorale',label:'Organ',pattern:'block',lo:50,level:.12}}}),

song({title:'Britpop · Seaside Weekend',description:'A sing-along in A: strummed acoustic, eighth-note electric chords, organ, and a chorus melody built to be shouted back.',
 key:'A major',bpm:120,rhythm:'rock',room:.35,
 form:[{name:'Verse',bars:'A E F#m D | A E D E',energy:.6,parts:{voice:'C#5/2 E5/2 A5/2 E5/2 | B4/2 E5/2 G#5/4 | A5/2 F#5/2 C#5/2 A4/2 | D5/4 F#5/2 E5/2 | C#5/2 E5/2 A5/2 E5/2 | G#5/3 F#5/1 E5/4 | D5/2 F#5/2 A5/2 F#5/2 | E5/8'}},
  {name:'Chorus',bars:'D A E F#m | D A E E',x:2,energy:.9,parts:{voice:'F#5/4 A5/4 | A5/2 G#5/2 E5/4 | E5/2 G#5/2 B5/2 G#5/2 | A5/4 C#6/4 | F#5/2 A5/2 D6/2 C#6/2 | C#6/2 B5/2 A5/4 | G#5/2 B5/2 E6/2 D6/2 | B5/8'}}],
 tracks:{voice:{sound:'voiceAaTenorClean',label:'Voice',level:.5,send:.3},acoustic:{sound:'pluckGuitarSoftDark',label:'Acoustic',pattern:'strum',lo:52,level:.3,pan:-.3},
  electric:{sound:'subSawPluckLp',label:'Electric',pattern:'pump',lo:57,level:.22,pan:.3,life:.2},organ:{sound:'organFullPlainStill',label:'Organ',pattern:'block',lo:57,level:.15},
  bass:{sound:'subPulseBassLp',label:'Bass',pattern:'eighth',level:.45}}}),

song({title:'Northern Soul · All-Nighter',description:'A Motown-style stomp in C: snare on every beat, pounding piano, walking bass, strings and brass pushes under a soul vocal line.',
 key:'C major',bpm:118,rhythm:'motown',room:.35,
 form:[{name:'Verse',bars:'C Em F G | C Em Dm7 G',x:2,energy:.75,parts:{voice:'E5/3 G5/1 G5/2 E5/2 | D5/2 B4/2 G4/4 | A4/2 C5/2 F5/3 E5/1 | D5/4 G5/4 | E5/3 G5/1 C6/2 G5/2 | B5/2 G5/2 E5/4 | D5/2 F5/2 A5/2 F5/2 | G5/8'}},
  {name:'Strings up',bars:'F G Em Am | Dm7 G C C',energy:.95,parts:{voice:'A5/4 C6/4 | B5/2 G5/2 D5/4 | G5/2 B5/2 E6/4 | C6/8 | A5/2 F5/2 D5/2 F5/2 | G5/4 B5/4 | C6/8 | r/8'}}],
 tracks:{voice:{sound:'voiceAAltoClean',label:'Vocal',level:.5,send:.3},piano:{sound:'feltPiano',label:'Piano',pattern:'quarters',lo:55,level:.35,life:.35},
  strings:{sound:'stringEnsemble',label:'Strings',pattern:'block',lo:60,level:.18},brass:{sound:'subSawBrassBp',label:'Brass',pattern:'push',lo:57,level:.22},
  bass:{sound:'subSquareBassLp',label:'Walking bass',pattern:'walk',level:.5}}}),

song({title:'Krautrock · Motorway Blue',description:'One chord for a long time: a motorik beat, a pulsing eighth-note bass, 16th-note guitar and a slow synth line that moves only between chords.',
 key:'A minor',bpm:132,sub:4,rhythm:'motorik',room:.4,
 form:[{name:'Drive',bars:'Am7 Am7 Am7 Am7',energy:.6,parts:{lead:'r/16'}},
  {name:'Line',bars:'Am7 Am7 Fmaj7 G | Am7 Am7 Fmaj7 G',x:2,energy:.8,parts:{lead:'E5/8 G5/8 | A5/16 | E5/8 C5/8 | B4/16 | E5/8 G5/8 | A5/8 C6/8 | A5/16 | B5/16'}},
  {name:'Horizon',bars:'Am7 Am7 Am7 Am7',energy:.9,parts:{lead:'E6/64'}}],
 tracks:{lead:{sound:'subSquareLeadLp',label:'Synth line',level:.35,send:.45},guitar:{sound:'pluckGuitarSoftMetal',label:'Guitar',pattern:'arp16',lo:57,level:.2,pan:.3},
  organ:{sound:'organReedPlainStill',label:'Organ drone',pattern:'block',lo:52,level:.12,pan:-.3},bass:{sound:'subPulseBassLp',label:'Bass',pattern:'eighth',level:.45}}}),

song({title:'Reggae · Sunday Yard',description:'Roots reggae in G at 76: one-drop drums, guitar skank on 2 and 4, organ bubble, a heavy bass and a melodica tune.',
 key:'G major',bpm:76,rhythm:'reggae',room:.45,
 form:[{name:'Riddim',bars:'G C G D',energy:.6,parts:{melodica:'r/8'}},
  {name:'Melodica',bars:'G C G D | G C D G',x:2,energy:.75,parts:{melodica:'B4/3 D5/1 D5/4 | E5/2 G5/2 E5/4 | D5/3 B4/1 A4/2 G4/2 | A4/8 | B4/3 D5/1 G5/4 | E5/2 C5/2 E5/2 G5/2 | D5/2 B4/2 A4/2 F#4/2 | G4/8'}}],
 tracks:{melodica:{sound:'reedMelodicaSoftVibrato',label:'Melodica',level:1.3,send:.45},skank:{sound:'pluckGuitarBrightDark',label:'Skank',pattern:'backbeat',lo:60,level:.6,pan:.3},
  organ:{sound:'organJazzPercStill',label:'Organ bubble',pattern:'offbeat',lo:55,level:.2,pan:-.3},bass:{sound:'subBass',label:'Bass',pattern:'reggae',level:.6}}}),

song({title:'Disco · Mirrorball Heart',description:'Disco in A minor: octave bass, clavinet 16ths, string swells and a soprano line over a hi-hat that opens on every off-beat.',
 key:'A minor',bpm:120,sub:4,rhythm:'disco',room:.4,
 form:[{name:'Verse',bars:'Am7 Dm7 G7 Cmaj7 | Fmaj7 Dm7 E7 E7',x:2,energy:.8,parts:{voice:'E5/4 A5/4 G5/4 E5/4 | F5/4 A5/4 C6/8 | B5/4 G5/4 D5/4 F5/4 | E5/16 | E5/4 A5/4 C6/4 A5/4 | C6/4 A5/4 F5/8 | G#5/8 B5/8 | E6/16'}},
  {name:'Strings',bars:'Am7 Dm7 G7 Cmaj7 | Fmaj7 Dm7 E7 E7',energy:1,parts:{voice:'r/16',strings:'E6/16 | F6/16 | D6/16 | E6/16 | A6/16 | F6/16 | G#6/16 | B6/16'}}],
 tracks:{voice:{sound:'voiceAaSopranoClean',label:'Soprano',level:.4,send:.4},strings:{sound:'stringEnsemble',label:'Strings',pattern:'block',lo:62,level:.2,send:.4},
  clav:{sound:'pluckClavBrightDark',label:'Clavinet',pattern:'arp16',lo:57,level:.22},bass:{sound:'subPulseBassLp',label:'Octave bass',pattern:'octave',level:.5}}}),

song({title:'Punk · Three Chords Short',description:'Punk in E at 180: eighth-note power chords, eighth-note bass and a shouted tune. Under a minute.',
 key:'E major',bpm:180,rhythm:'punk',room:.2,
 form:[{name:'Count in',bars:'E5',energy:.7,parts:{voice:'r/8'}},
  {name:'Verse',bars:'E5 A5 B5 A5 | E5 A5 B5 E5',x:2,energy:.95,parts:{voice:'E5/2 E5/2 E5/2 E5/2 | E5/2 C#5/2 A4/4 | B4/2 B4/2 D#5/2 F#5/2 | E5/2 C#5/2 A4/4 | E5/2 E5/2 G#5/2 B5/2 | A5/2 E5/2 C#5/4 | B4/2 D#5/2 F#5/2 B5/2 | E5/8'}},
  {name:'Stop',bars:'B5 E5',energy:1,parts:{voice:'B4/8 | E5/4 r/4'}}],
 tracks:{voice:{sound:'voiceAaTenorBreathy',label:'Shout',level:.5},guitar:{sound:'subSyncBrassBp',label:'Guitar',pattern:'power',lo:40,level:.35,life:.15},bass:{sound:'subSawBassLp',label:'Bass',pattern:'eighth',level:.45}}}),

song({title:'Bossa Nova · Late Café',description:'Bossa nova in D: nylon guitar in the syncopated bossa rhythm, root–fifth bass, and a breathy flute melody over ii–V turns.',
 key:'D major',bpm:132,rhythm:'bossa',room:.4,
 form:[{name:'Theme',bars:'Dmaj7 B7 Em7 A7 | F#m7 B7 Em7 A7',x:2,energy:.6,parts:{flute:'F#5/3 E5/1 F#5/2 A5/2 | D#5/4 F#5/4 | G5/3 F#5/1 E5/2 B4/2 | C#5/4 E5/4 | A5/3 G#5/1 F#5/2 C#5/2 | D#5/4 A5/4 | G5/2 E5/2 B4/2 D5/2 | C#5/4 r/4'}},
  {name:'Turnaround',bars:'Em7 A7 Dmaj7 Dmaj7',energy:.5,parts:{flute:'G5/2 B5/2 D6/2 B5/2 | A5/4 G5/4 | F#5/8 | r/8'}}],
 tracks:{flute:{sound:'blownFluteBreathyLow',label:'Flute',level:.75,send:.4},guitar:{sound:'pluckGuitarSoftDark',label:'Nylon guitar',pattern:'push',lo:55,level:.35},
  bass:{sound:'bowedBassAiryWarm',label:'Bass',pattern:'rootfifth',level:.75},pad:{sound:'stringEnsemble',label:'Strings',pattern:'block',lo:60,level:.1}}}),

song({title:'Drum and Bass · Night Bus 174',description:'Liquid drum and bass at 174: two-step breaks, a long sub bass, piano arpeggios and a breathy voice holding the top note of each chord.',
 key:'F minor',bpm:174,sub:4,rhythm:'dnb',room:.5,
 form:[{name:'Intro',bars:'Fm9 Ebmaj7 Dbmaj7 C7',energy:.5,drums:false,parts:{voice:'r/16'}},
  {name:'Drop',bars:'Fm9 Ebmaj7 Dbmaj7 C7',x:3,energy:.9,parts:{voice:'C6/16 | Bb5/16 | Ab5/16 | G5/8 E5/8'}},
  {name:'Out',bars:'Fm9 Fm9',energy:.6,parts:{voice:'C6/32'}}],
 tracks:{voice:{sound:'voiceUSopranoBreathy',label:'Voice',level:.35,send:.5},piano:{sound:'feltPiano',label:'Piano',pattern:'arp',lo:60,level:.3,send:.35},
  pad:{sound:'stringEnsemble',label:'Pad',pattern:'block',lo:55,level:.15},sub:{sound:'subBass',label:'Sub bass',pattern:'whole',level:.55}}}),

song({title:'Funk · Bubble Up',description:'Funk in E minor: clavinet 16ths, syncopated bass, ghost-note drums and a horn line that answers itself.',
 key:'E dorian',bpm:104,sub:4,rhythm:'funk',room:.3,
 form:[{name:'Groove',bars:'Em7 Em7 A7 A7',energy:.7,parts:{horns:'r/16'}},
  {name:'Horns',bars:'Em7 Em7 A7 A7',x:3,energy:.9,parts:{horns:'r/4 G5/2 A5/2 B5/2 r/2 D6/2 r/2 | E6/2 D6/2 B5/4 r/8 | r/4 C#6/2 E6/2 G6/2 r/2 E6/2 r/2 | A6/2 G6/2 E6/4 r/8'}}],
 tracks:{horns:{sound:'subSawBrassHp',label:'Horns',level:.35,send:.25},sax:{sound:'reedSaxReedyStill',label:'Sax',level:1,transpose:-12,double:'horns'},
  clav:{sound:'pluckClavBrightMetal',label:'Clavinet',pattern:'arp16',lo:55,level:.28},bass:{sound:'subSquareBassBp',label:'Bass',pattern:'synco',level:.55}}}),

song({title:'Bluegrass · Mountain Switchback',description:'Bluegrass in G with a train beat: banjo rolls, mandolin chop on the backbeat, guitar strum, bowed bass and a fiddle tune.',
 key:'G major',bpm:140,sub:4,rhythm:'train',room:.3,
 form:[{name:'Tune',bars:'G G C G | G G D D | G G C G | D D G G',x:2,energy:.8,parts:{fiddle:'G5/4 B5/4 D6/4 B5/4 | A5/2 G5/2 E5/4 D5/8 | E5/4 G5/4 C6/4 E6/4 | D6/8 B5/8 | G5/4 B5/4 D6/4 G6/4 | F#6/4 E6/4 D6/8 | A5/4 F#5/4 D5/4 F#5/4 | A5/16 | G5/4 B5/4 D6/4 B5/4 | A5/2 G5/2 E5/4 D5/8 | E5/4 G5/4 C6/4 E6/4 | D6/8 B5/8 | A5/4 B5/4 C6/4 A5/4 | F#5/8 A5/8 | G5/16 | r/16'}}],
 tracks:{fiddle:{sound:'bowedFiddleGrittyWarm',label:'Fiddle',level:.45,send:.25},banjo:{sound:'pluckBanjoBrightMetal',label:'Banjo',pattern:'arp16',lo:55,level:.25,pan:.3},
  mandolin:{sound:'pluckMandolinBrightDark',label:'Mandolin chop',pattern:'backbeat',lo:60,level:.25,pan:-.3},guitar:{sound:'pluckGuitarBrightDark',label:'Guitar',pattern:'strum',lo:50,level:.25},
  bass:{sound:'bowedBassAiryWarm',label:'Bass',pattern:'rootfifth',level:.45}}}),

song({title:'Synthwave · Neon Coastline',description:'Synthwave in A minor: saw arpeggios, octave bass, a wide pad and a square-wave lead over a steady rock beat.',
 key:'A minor',bpm:100,rhythm:'rock',room:.55,
 form:[{name:'Drive',bars:'Am F C G',energy:.6,parts:{lead:'r/8'}},
  {name:'Lead',bars:'Am F C G',x:3,energy:.85,parts:{lead:'E5/2 A5/2 C6/3 B5/1 | A5/2 F5/2 C6/4 | G5/2 E5/2 C5/3 D5/1 | B4/4 D5/4'}},
  {name:'Fade',bars:'Am F C G Am',energy:.5,parts:{lead:'A5/40'}}],
 tracks:{lead:{sound:'subSquareLeadLp',label:'Square lead',level:.35,send:.45},arp:{sound:'subSawPluckLp',label:'Saw arpeggio',pattern:'arp',lo:57,level:.25,send:.4},
  pad:{sound:'subSawPadLp',label:'Pad',pattern:'block',lo:52,level:.15},bass:{sound:'subSawBassLp',label:'Octave bass',pattern:'octave',level:.45}}}),

song({title:'Chiptune · Pixel Picnic',description:'A game-console tune in C: two pulse waves and a 4-bit triangle bass, with noise-channel drums.',
 key:'C major',bpm:150,room:.15,
 form:[{name:'Level 1',bars:'C Am F G',x:2,energy:.8,parts:{lead:'E5/1 G5/1 C6/2 G5/2 E5/2 | A5/1 C6/1 E6/2 C6/2 A5/2 | F5/1 A5/1 C6/2 A5/2 F5/2 | G5/1 B5/1 D6/2 B5/2 G5/2'}},
  {name:'Level 2',bars:'F G Em Am | F G C C',energy:.9,parts:{lead:'A5/2 C6/2 F6/4 | B5/2 D6/2 G6/4 | G5/2 B5/2 E6/4 | A5/2 C6/2 E6/4 | F6/2 E6/2 D6/2 C6/2 | D6/2 B5/2 G5/4 | C6/8 | r/8'}}],
 tracks:{lead:{sound:'chipPulse25NotePlain',label:'Pulse lead',level:.3},harmony:{sound:'chipPulse12BlipPlain',label:'Pulse arpeggio',pattern:'arp',lo:60,level:.15},
  bass:{sound:'chipTriangle4bitNotePlain',label:'Triangle bass',pattern:'octave',level:.4},noise:{sound:'chipNoiseShortBlipPlain',label:'Noise drums',pattern:'C6/1 r/1 C7/1@.6 r/1 C6/1 r/1 C7/1@.6 C7/1@.5',level:.2}}})
];
