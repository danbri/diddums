const enc=new TextEncoder();

export const JIGSCORE_SCHEMA='jigscore-program/1';
export const JIGSCORE_EVENT_SCHEMA='jigscore-event-plan/1';

export function canonicalJson(x){
  if(x===null||typeof x==='boolean'||typeof x==='number'||typeof x==='string')return JSON.stringify(x);
  if(Array.isArray(x))return '['+x.map(canonicalJson).join(',')+']';
  if(typeof x==='object')return '{'+Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonicalJson(x[k])).join(',')+'}';
  throw new Error('Unsupported JigScore value');
}

export async function sha256Text(text){
  const d=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(text)));
  return [...d].map(b=>b.toString(16).padStart(2,'0')).join('');
}

const pickTrack=t=>({
  id:t.id,label:t.label,pattern:t.pattern,role:t.role,
  level:t.level,colour:t.colour,life:t.life,pan:t.pan,send:t.send,
  onlySections:t.onlySections||null,excludeSections:t.excludeSections||null,
  speechOffsetSteps:t.speechOffsetSteps||0,humanize:t.humanize??null,
  gate:t.gate??null,octave:t.octave??null,
  sequence:Array.isArray(t.sequence)?t.sequence:null
});

export function programRecord(c){
  return {
    schema:JIGSCORE_SCHEMA,id:c.id,title:c.title,
    transport:{bpm:c.bpm,meter:c.meter,swing:c.swing||0,bars:c.bars,seed:c.seed},
    rhythm:c.rhythm,
    harmony:c.harmony,
    melody:c.melody||null,
    bass:c.bass||null,
    speech:c.speech||null,
    drumKit:c.drumKit||null,
    tracks:c.tracks.map(pickTrack),
    space:c.space,
    sections:c.sections.map(s=>({name:s.name,start:s.start,bars:s.bars,energy:s.energy,roles:s.roles}))
  };
}

export function eventPlanRecord(session){
  return {
    schema:JIGSCORE_EVENT_SCHEMA,
    composition:session.id,
    transport:{bpm:session.bpm,meter:session.meter,bars:session.bars,seed:session.seed},
    events:session.events.map(e=>({
      id:e.id,track:e.track,bar:e.bar,step:e.step,note:e.note,
      nominalBeat:e.nominalBeat,humanizeBeats:e.humanizeBeats,effectiveBeat:e.nominalBeat+e.humanizeBeats,
      velocity:e.velocity,durationBeats:e.durationBeats,
      colour:e.colour,life:e.life,
      sequenceIndex:e.sequenceIndex??null,
      speechPart:e.speechPart??null,
      syllable:e.syllable??null,
      trajectory:e.trajectory??null,
      colourPath:e.colourPath??null,
      localPattern:!!e.localPattern
    })).sort((a,b)=>a.effectiveBeat-b.effectiveBeat||a.track.localeCompare(b.track)||a.id.localeCompare(b.id))
  };
}

export async function scoreEvidence(composition,session){
  const program=programRecord(composition),eventPlan=eventPlanRecord(session);
  const programCanonical=canonicalJson(program),eventCanonical=canonicalJson(eventPlan);
  return {
    schema:'jigscore-evidence/1',
    programSha256:await sha256Text(programCanonical),
    eventPlanSha256:await sha256Text(eventCanonical),
    programBytes:enc.encode(programCanonical).length,
    eventPlanBytes:enc.encode(eventCanonical).length,
    eventCount:eventPlan.events.length,
    sampleRateIndependent:true,
    planner:'public/score.js',
    leanModel:'/lean/JigScore.lean',
    leanStatus:'draft model; not part of the pinned native Lean release certificate'
  };
}