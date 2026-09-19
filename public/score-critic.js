import {allTracks,beatFrames,noteName} from './music-model.js';

const pc=n=>((n%12)+12)%12;
const round=(n,d=3)=>Number(n.toFixed(d));

function intendedBar(e,session){
 if(Number.isFinite(e.bar))return e.bar;
 if(Number.isFinite(e.nominalBeat))return Math.floor(e.nominalBeat/session.beats);
 return Math.floor(e.frame/(beatFrames(session)*session.beats));
}
function intendedBeat(e,session){
 return Number.isFinite(e.nominalBeat)?e.nominalBeat:e.frame/beatFrames(session);
}
function chordAt(composition,bar){
 return composition.harmony[Math.floor(bar/2)%composition.harmony.length];
}
function chordPcs(chord){return new Set(chord.slice(1).map(i=>pc(chord[0]+i)));}

export function auditScore(composition,session){
 const bf=beatFrames(session),tracks=allTracks(session),trackBy=new Map(tracks.map(t=>[t.id,t])),pitched=session.events.filter(e=>!e.track.startsWith('d:'));
 const trackStats=new Map(session.tracks.map(t=>[t.id,{id:t.id,label:t.label,pattern:t.pattern,role:t.role,pool:t.pool,poolRequired:t.poolRequired??t.pool,events:0,chordTones:0,longNonChord:0,boundaryCross:0,maxBoundaryBeats:0,tensionPairs:0}]));
 const examples=[],summary={events:pitched.length,chordTones:0,longNonChord:0,boundaryCross:0,tensionPairs:0,maxBoundaryBeats:0};
 for(const e of pitched){
   const t=trackStats.get(e.track),bar=intendedBar(e,session),start=intendedBeat(e,session),duration=e.duration/bf,chord=chordAt(composition,bar),isChord=chordPcs(chord).has(pc(e.note));
   if(t)t.events++;if(isChord){summary.chordTones++;if(t)t.chordTones++;}
   if(!isChord&&duration>=.75){summary.longNonChord++;if(t)t.longNonChord++;if(examples.length<24)examples.push({kind:'long-non-chord',track:t?.label||e.track,note:e.note,noteName:noteName(e.note),bar:bar+1,step:e.step,durationBeats:round(duration),chordRoot:chord[0]});}
   const nextBoundary=(Math.floor(bar/2)+1)*2*session.beats,over=start+duration-nextBoundary;
   if(start<nextBoundary&&over>.05){summary.boundaryCross++;summary.maxBoundaryBeats=Math.max(summary.maxBoundaryBeats,over);if(t){t.boundaryCross++;t.maxBoundaryBeats=Math.max(t.maxBoundaryBeats,over);}if(examples.length<24)examples.push({kind:'harmony-boundary-overlap',track:t?.label||e.track,note:e.note,noteName:noteName(e.note),bar:bar+1,step:e.step,overBeats:round(over),nextHarmonyBar:Math.floor(nextBoundary/session.beats)+1});}
 }
 const groups=new Map();
 for(const e of pitched){const k=Math.round(intendedBeat(e,session)/.03);(groups.get(k)||groups.set(k,[]).get(k)).push(e);}
 for(const es of groups.values())for(let i=0;i<es.length;i++)for(let j=i+1;j<es.length;j++){
   const a=es[i],b=es[j];if(a.track===b.track)continue;const raw=Math.abs(a.note-b.note)%12,interval=Math.min(raw,12-raw);
   if(interval!==1&&interval!==6)continue;
   summary.tensionPairs++;const ta=trackStats.get(a.track),tb=trackStats.get(b.track);if(ta)ta.tensionPairs++;if(tb)tb.tensionPairs++;
   if(examples.length<24)examples.push({kind:'onset-tension',tracks:[ta?.label||a.track,tb?.label||b.track],notes:[noteName(a.note),noteName(b.note)],intervalClass:interval===1?'minor-second':'tritone',bar:intendedBar(a,session)+1});
 }
 const trackRows=[...trackStats.values()].map(t=>({...t,chordToneRatio:t.events?t.chordTones/t.events:1,maxBoundaryBeats:round(t.maxBoundaryBeats),poolHeadroom:(t.pool??0)-(t.poolRequired??t.pool??0)}));
 const worst=trackRows.slice().sort((a,b)=>b.boundaryCross-a.boundaryCross||b.longNonChord-a.longNonChord||b.tensionPairs-a.tensionPairs);
 const nonChordLeader=trackRows.slice().sort((a,b)=>b.longNonChord-a.longNonChord)[0];
 return{
   schema:'diddums-score-audit/1',composition:composition.id,title:composition.title,bpm:composition.bpm,meter:composition.meter,
   summary:{...summary,chordToneRatio:summary.events?summary.chordTones/summary.events:1,maxBoundaryBeats:round(summary.maxBoundaryBeats)},
   tracks:trackRows,examples,
   observations:{
     boundaryLeader:worst[0]?.boundaryCross?{track:worst[0].label,count:worst[0].boundaryCross,maxBeats:worst[0].maxBoundaryBeats}:null,
     longNonChordLeader:nonChordLeader?.longNonChord?nonChordLeader.label:null,
     note:'Counts are descriptive musical facts, not error scores. Suspensions, passing notes, tritones and gate overlap may be intentional.'
   }
 };
}

export function auditCollection(compositions,makeSession,sampleRate=48000){
 return compositions.map(c=>auditScore(c,makeSession(c,sampleRate))).sort((a,b)=>b.summary.boundaryCross-a.summary.boundaryCross||b.summary.longNonChord-a.summary.longNonChord||b.summary.tensionPairs-a.summary.tensionPairs);
}

export function cleanHarmonyBoundaries(composition,{marginBeats=.03,roles=['keys','stabs']}={}){
 return{...composition,scoreTreatment:{...(composition.scoreTreatment||{}),harmonyBoundary:{mode:'clean',marginBeats,roles}}};
}

export function boundaryLabel(composition){
 const h=composition.scoreTreatment?.harmonyBoundary;
 return h?.mode==='clean'?'clean '+h.roles.join('/')+' · '+h.marginBeats+' beat margin':'original legato gates';
}