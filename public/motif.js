// Leitmotif treatments as plain functions on a motif written in scale degrees (0 = the chord root,
// 1 = the next scale note…, null = rest, one entry per 16th step). transform() applies the named
// operations; toMelody() turns degrees into the semitone melody the score rules play over each chord.
// characterOps() maps a character's state to operations and live controls through an editable table.
import {modes} from './song.js';

const hashUnit=(i,salt)=>{let h=Math.imul(i+1,2654435761)^Math.imul(salt+7,40503);h^=h>>>15;h=Math.imul(h,2246822519);h^=h>>>13;return (h>>>0)/4294967296;};
const notes=m=>m.map((d,i)=>[d,i]).filter(([d])=>d!=null);
const MAX=64;

// Each operation is applied in this fixed order so results do not depend on key order in `ops`.
// transpose: scale steps · invert: mirror around the first note · retrograde: reverse ·
// augment: stretch time (2 = twice as slow, 0.5 = twice as fast) · fragment: keep the first n notes ·
// displace: rotate by n steps · drop: remove that fraction of notes (never the first), deterministically.
export function transformDegrees(motif,ops={}){
 let m=motif.slice(0,MAX);
 if(ops.transpose)m=m.map(d=>d==null?null:d+ops.transpose);
 if(ops.invert){const pivot=notes(m)[0]?.[0]??0;m=m.map(d=>d==null?null:2*pivot-d);}
 if(ops.retrograde){const ns=notes(m);if(ns.length){const span=ns[ns.length-1][1];const out=Array(m.length).fill(null);for(const [d,i] of ns)out[span-i]=d;m=out;}}
 if(ops.augment&&ops.augment!==1){const f=ops.augment,len=Math.max(1,Math.min(MAX,Math.round(m.length*f))),out=Array(len).fill(null);for(const [d,i] of notes(m)){const at=Math.floor(i*f);if(at<len&&out[at]==null)out[at]=d;}m=out;}
 if(ops.fragment!=null){let k=0;m=m.map(d=>d==null?null:k++<ops.fragment?d:null);}
 if(ops.displace){const n=m.length,r=((ops.displace%n)+n)%n;m=m.map((_,i)=>m[(i-r+n)%n]);}
 if(ops.drop>0){let k=0;m=m.map((d,i)=>d==null?null:k++===0?d:hashUnit(i,ops.dropSeed||1)<ops.drop?null:d);}
 return m;
}

// Degrees → semitones over the chord root (the melody format of score.js), in `scale` (an array of
// semitones or a mode name), raised or lowered by whole octaves.
export function toMelody(degrees,scale='minor',octave=0){
 const s=Array.isArray(scale)?scale:modes[scale]||modes.minor;
 return degrees.map(d=>d==null?null:12+12*octave+s[((d%s.length)+s.length)%s.length]+12*Math.floor(d/s.length));
}
export function transform(motif,ops={},scale='minor'){return toMelody(transformDegrees(motif,ops),ops.mode||scale,ops.octave||0);}

// The darker relative of a mode, for sadness: same tonic, lowered third (and sixth and seventh).
export const DARKER={major:'minor',lydian:'dorian',mixolydian:'dorian',acoustic:'dorian',dorian:'minor',minor:'phrygian',harmonic:'phrygian',phrygian:'locrian',pentatonic:'hirajoshi',yo:'hirajoshi'};
export const BRIGHTER={minor:'major',phrygian:'minor',locrian:'phrygian',dorian:'mixolydian',harmonic:'major',hirajoshi:'yo',mixolydian:'major',major:'lydian'};

// State → treatment. State values: power 0..1 (.6 = ordinary), health and stability 0..1 (1 = full),
// mood -1 (sad) .. 1 (happy).
// Each row is a condition and what it contributes; numeric contributions scale with how far past the
// threshold the state is. Edit or replace this table to change the mapping.
export const STATE_OPS=[
 {when:'mood',below:-.3,does:(x,base)=>({mode:x>.6?DARKER[DARKER[base]||base]||DARKER[base]:DARKER[base],augment:2,rubato:.35*x,invertRising:true,level:1-.15*x})},
 {when:'mood',above:.3,does:(x,base)=>({mode:BRIGHTER[base],octave:x>.6?1:0,swing:.06*x,level:1+.1*x})},
 {when:'power',below:.5,does:x=>({fragment:x>.6?2:3,octave:1,drop:.35*x,level:1-.5*x,role:'sparse'})},
 {when:'power',above:.85,does:()=>({octave:-1,level:1.15,accents:[1.25,.8,.9,.8]})},
 {when:'stability',below:.75,does:x=>({wobble:{depth:.15+.6*x,rate:.4+2.2*x},drift:.5*x,looseness:70*x,displace:x>.6?1:0,accents:'random'})},
 {when:'health',below:.6,does:x=>({muffle:.2+.7*x,drop:.3*x,wobble:{depth:.1*x,rate:.3},level:1-.3*x})}
];
export const NEUTRAL={power:.6,mood:0,stability:1,health:1};

// Combine every matching row: numbers add (level multiplies), objects merge, later rows win otherwise.
export function characterOps(state={},baseMode='minor',table=STATE_OPS){
 const s={...NEUTRAL,...state},out={};
 for(const row of table){
  const v=Number(s[row.when]);if(!Number.isFinite(v))continue;
  // x: how far past the threshold, 0..1 of the way to the end of the range (-1 for mood, 0 otherwise; 1 above).
  let x=null;if(row.below!=null&&v<row.below)x=(row.below-v)/(row.below-(row.when==='mood'?-1:0));else if(row.above!=null&&v>row.above)x=(v-row.above)/(1-row.above);
  if(x==null)continue;x=Math.max(0,Math.min(1,x));
  for(const [k,val] of Object.entries(row.does(x,baseMode))){
   if(val==null)continue;
   if(k==='level')out[k]=(out[k]??1)*val;
   else if(k==='wobble'&&out.wobble)out.wobble={depth:out.wobble.depth+val.depth,rate:Math.max(out.wobble.rate,val.rate)};
   else if(['drop','drift','muffle','looseness','rubato','swing'].includes(k))out[k]=Math.min(k==='looseness'?120:1,(out[k]??0)+val);
   else out[k]=val;
  }
 }
 return out;
}
