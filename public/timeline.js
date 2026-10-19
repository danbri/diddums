// Time-based score helpers: compact automation curves, seconds-timed step sequences and paired stereo tracks.
//
// Curve:     "0@0 1@2.5 1@14.8 0@15"   value@time, linear between points; two points at one time = a jump.
//            Times are seconds; suffix b for bars ("1@4b"). Before the first / after the last point the end value holds.
// Sequence:  "x . . x@.6 .*7 | A2:2 _"  one token per step. x = the track's note, . _ - = rest,
//            a note name (C4 = 60) or MIDI number, @velocity, :length-in-steps, *repeat.
// Pair:      {width:.8, seqR:'…', delay:.12, transposeR:7, noteR:'E5'} → two tracks <id>L / <id>R at ∓width;
//            the right track's events are delayed by `delay` seconds whatever its role.
export const AUTOMATABLE=['level','pan','send','colour','life','tune'];
export const GLOBAL_AUTOMATABLE=['master','room','damp','wet','echo'];
const NOTE={c:0,d:2,e:4,f:5,g:7,a:9,b:11};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function parseNote(token,fallback=60){
 if(token==null||token==='')return fallback;
 if(typeof token==='number')return clamp(Math.round(token),0,127);
 const n=Number(token);if(Number.isFinite(n))return clamp(Math.round(n),0,127);
 const m=String(token).trim().match(/^([a-gA-G])(#|b)?(-?\d)$/);if(!m)return fallback;
 return clamp(12*(Number(m[3])+1)+NOTE[m[1].toLowerCase()]+(m[2]==='#'?1:m[2]==='b'?-1:0),0,127);
}

export function parseCurve(text,secondsPerBar=2){
 if(Array.isArray(text))return text.map(([t,v])=>[Number(t),Number(v)]).filter(p=>p.every(Number.isFinite)).sort((a,b)=>a[0]-b[0]);
 if(typeof text==='number')return [[0,text]];
 const points=[];
 for(const tok of String(text||'').split(/[\s,]+/).filter(Boolean).slice(0,256)){
  const m=tok.match(/^(-?[\d.]+)@(-?[\d.]+)(s|b)?$/);if(!m)throw new Error('Bad curve point "'+tok+'" (expected value@time)');
  points.push([Number(m[2])*(m[3]==='b'?secondsPerBar:1),Number(m[1])]);
 }
 return points.sort((a,b)=>a[0]-b[0]);
}
export function curveAt(points,t){
 if(!points.length)return 0;if(t<=points[0][0])return points[0][1];
 for(let i=1;i<points.length;i++){const [t1,v1]=points[i];if(t<t1){const [t0,v0]=points[i-1];return v0+(v1-v0)*(t-t0)/Math.max(1e-9,t1-t0);}}
 return points[points.length-1][1];
}

export function parseSequence(text,defaultNote=60){
 if(Array.isArray(text))return text;
 const steps=[];
 for(const raw of String(text||'').split(/[\s,|]+/).filter(Boolean)){
  const m=raw.match(/^([^@:*]+)(?:@([\d.]+))?(?::([\d.]+))?(?:\*(\d+))?$/);if(!m)throw new Error('Bad sequence token "'+raw+'"');
  const rest=/^[._-]$/.test(m[1]),step=rest?null:{note:m[1]==='x'?defaultNote:parseNote(m[1],defaultNote),velocity:m[2]!=null?clamp(Number(m[2]),0,1):null,length:m[3]!=null?clamp(Number(m[3]),.05,64):null};
  for(let i=0;i<clamp(Number(m[4]??1),1,256);i++)steps.push(step);
  if(steps.length>4096)throw new Error('Sequence too long');
 }
 return steps;
}

// One composition track with `pair` becomes two mirrored tracks. Pan automation on a pair means width.
export function expandPairs(tracks){
 const out=[];
 for(const t of tracks){
  if(!t.pair){out.push(t);continue;}
  const {pair,...base}=t,width=clamp(Number(pair.width??.75),0,1);
  out.push({...base,id:t.id+'L',label:t.label+' · L',pan:-width,pairOf:t.id,pairSide:'L'});
  out.push({...base,id:t.id+'R',label:t.label+' · R',pan:width,pairOf:t.id,pairSide:'R',
   seq:pair.seqR??base.seq,note:pair.noteR??base.note,pairDelay:clamp(Number(pair.delay)||0,0,2),
   transpose:(Number(base.transpose)||0)+(Number(pair.transposeR)||0),...(pair.colourR!=null?{colour:pair.colourR}:{})});
 }
 return out;
}

// Seconds-timed notes for role:'timeline'. `step` may be a number or a curve (seconds per step over time).
export function timelineNotes(t,endSeconds,secondsPerBar){
 const seq=parseSequence(t.seq,parseNote(t.note,60));if(!seq.length)return [];
 const stepCurve=parseCurve(t.step??.25,secondsPerBar),from=Math.max(0,Number(t.from)||0),to=Math.min(endSeconds,t.to!=null?Number(t.to):endSeconds);
 const gate=clamp(Number(t.gate??.5),.02,64),loop=t.loop!==false,notes=[];
 let time=from,i=0;
 while(time<to&&notes.length<4096){
  if(!loop&&i>=seq.length)break;
  const step=clamp(curveAt(stepCurve,time),.01,30),s=seq[i%seq.length];
  if(s)notes.push({time,note:s.note,velocity:s.velocity??Number(t.velocity??.85),seconds:Math.min(to-time,step*(s.length??gate)),index:i%seq.length});
  time+=step;i++;
 }
 return notes;
}

// Automation compiles to flat [frame,value,…] arrays the AudioWorklet can read without parsing.
export function compileAutomation(spec,keys,sr,secondsPerBar,mirrorPan=false){
 if(!spec)return null;const out={};
 for(const [k,v] of Object.entries(spec)){
  if(!keys.includes(k))throw new Error('Cannot automate "'+k+'"; choose from '+keys.join(', '));
  const pts=parseCurve(v,secondsPerBar);if(!pts.length)continue;
  out[k]=pts.flatMap(([t,val])=>[Math.round(t*sr),mirrorPan&&k==='pan'?-val:val]);
 }
 return Object.keys(out).length?out:null;
}
