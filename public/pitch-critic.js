const SR=22050,MODEL='https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json',MODULE='https://esm.sh/@spotify/basic-pitch@1.0.1';
let libraryPromise=null,modelPromise=null;
const hz=n=>440*Math.pow(2,(n-69)/12);
async function library(){return libraryPromise??=(import(MODULE));}
async function model(onStatus=()=>{}){if(!modelPromise)modelPromise=(async()=>{onStatus('Loading Spotify Basic Pitch model…');const {BasicPitch}=await library();return new BasicPitch(MODEL);})();return modelPromise;}
function renderProbe(kernel,{notes=[48,60,69],onSeconds=1.0,offSeconds=.3,colour=.4,life=.9}={}){
 const ex=new WebAssembly.Instance(new WebAssembly.Module(kernel.bytes),{}).exports;ex.prepare(SR);ex.reset();
 const onFrames=Math.round(onSeconds*SR),offFrames=Math.round(offSeconds*SR),segment=onFrames+offFrames,total=segment*notes.length,out=new Float32Array(total),block=new Float32Array(ex.memory.buffer,4096,128);
 let cursor=0;
 for(const note of notes){ex.reset();for(let j=0;j<segment;){const n=Math.min(128,segment-j),gate=j<onFrames?.86:0;ex.process(0,4096,n,hz(note),gate,colour,life);out.set(block.subarray(0,n),cursor+j);j+=n;}cursor+=segment;}
 let peak=0,sum=0;for(const x of out){peak=Math.max(peak,Math.abs(x));sum+=x*x;}const rms=Math.sqrt(sum/out.length),gain=peak>1e-5?Math.min(12,.82/peak):1;if(gain!==1)for(let i=0;i<out.length;i++)out[i]*=gain;
 return{audio:out,expected:notes.map((note,i)=>({note,start:i*segment/SR,end:(i*segment+onFrames)/SR})),render:{sampleRate:SR,seconds:out.length/SR,rawPeak:peak,rawRms:rms,normalizationGain:gain}};
}
function estimateFundamental(audio,e){
 const expectedHz=hz(e.note),start=Math.max(0,Math.round((e.start+.18)*SR)),available=Math.max(0,Math.round((e.end-.04)*SR)-start),N=Math.min(12000,available);
 if(N<1024)return{note:e.note,expectedHz,detectedHz:null,errorCents:null,correlation:0,confidence:'insufficient'};
 const lo=Math.max(2,Math.floor(SR/(expectedHz*1.16))),hi=Math.ceil(SR/(expectedHz*.86)),corr=[];
 for(let lag=lo;lag<=hi;lag++){let ab=0,aa=0,bb=0;for(let i=0;i<N-lag;i++){const x=audio[start+i],y=audio[start+i+lag];ab+=x*y;aa+=x*x;bb+=y*y;}corr.push(ab/Math.sqrt(aa*bb+1e-30));}
 let j=0;for(let i=1;i<corr.length;i++)if(corr[i]>corr[j])j=i;
 const lag0=lo+j,y1=corr[j-1]??corr[j],y2=corr[j],y3=corr[j+1]??corr[j],den=y1-2*y2+y3,delta=den?Math.max(-.5,Math.min(.5,.5*(y1-y3)/den)):0,lag=lag0+delta,detectedHz=SR/lag,errorCents=1200*Math.log2(detectedHz/expectedHz);
 return{note:e.note,expectedHz,detectedHz,errorCents,correlation:y2,confidence:y2>.92?'high':y2>.72?'medium':'low'};
}
function tuningFrom(rendered){
 const rows=rendered.expected.map(e=>estimateFundamental(rendered.audio,e)),usable=rows.filter(r=>r.errorCents!=null&&r.confidence!=='low'),errs=usable.map(r=>Math.abs(r.errorCents));
 return{method:'narrow-band normalized autocorrelation with parabolic lag interpolation',rows,meanAbsoluteCents:errs.length?errs.reduce((a,b)=>a+b,0)/errs.length:null,maxAbsoluteCents:errs.length?Math.max(...errs):null,lowConfidence:rows.filter(r=>r.confidence==='low'||r.confidence==='insufficient').length};
}
export function runTuningAudit(kernel,options={}){
 if(!kernel?.bytes)throw new Error('Loaded hash-matched native-build kernel is required');const rendered=renderProbe(kernel,options),tuning=tuningFrom(rendered);
 return{schema:'diddums-tuning-audit/1',kernel:{id:kernel.id,hash:kernel.hash},render:rendered.render,expected:rendered.expected,tuning,interpretation:tuning.lowConfidence?'At least one probe lacks a stable autocorrelation peak; treat its pitch estimate as uncertain.':tuning.maxAbsoluteCents<=8?'All stable probe fundamentals are within 8 cents of the requested MIDI frequency.':tuning.maxAbsoluteCents<=25?'At least one stable fundamental is noticeably offset but within a quarter tone.':'At least one stable fundamental differs by more than a quarter tone; inspect the DSP or intended inharmonicity.'};
}
function harmonicRelation(rootMidi,pitchMidi){
 const ratio=2**((pitchMidi-rootMidi)/12),harmonic=Math.round(ratio);if(harmonic<2||harmonic>16)return null;
 const errorCents=1200*Math.log2(ratio/harmonic);return Math.abs(errorCents)<=45?{harmonic,errorCents}:null;
}
function compare(expected,detected){
 const rows=expected.map(e=>{const candidates=detected.filter(n=>n.startTimeSeconds<e.end+.18&&n.startTimeSeconds+n.durationSeconds>e.start+.08).sort((a,b)=>(b.amplitude||0)-(a.amplitude||0));const d=candidates[0]||null;return{expected:e.note,detected:d?.pitchMidi??null,errorSemitones:d?d.pitchMidi-e.note:null,amplitude:d?.amplitude??null,start:d?.startTimeSeconds??null,duration:d?.durationSeconds??null};});
 const errors=rows.filter(x=>x.errorSemitones!=null).map(x=>Math.abs(x.errorSemitones)),missed=rows.filter(x=>x.detected==null).length,primary=new Set(rows.map(x=>x.detected).filter(x=>x!=null));
 const extras=detected.filter(n=>!primary.has(n.pitchMidi)&&n.amplitude>.25).map(n=>{let best=null;for(const e of expected){const relation=harmonicRelation(e.note,n.pitchMidi);if(relation&&(!best||Math.abs(relation.errorCents)<Math.abs(best.errorCents)))best={root:e.note,...relation};}return{...n,harmonicRelation:best};});
 return{rows,meanAbsoluteSemitones:errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null,maxAbsoluteSemitones:errors.length?Math.max(...errors):null,missed,extraStrongNotes:extras.length,harmonicExtras:extras.filter(x=>x.harmonicRelation).length,nonHarmonicExtras:extras.filter(x=>!x.harmonicRelation).length,extras};
}
export async function runPitchCritic(kernel,{onStatus=()=>{},...options}={}){
 if(!kernel?.bytes)throw new Error('Loaded hash-matched native-build kernel is required');
 const rendered=renderProbe(kernel,{notes:[60],...options}),tuning=tuningFrom(rendered),{BasicPitch,outputToNotesPoly,noteFramesToTime}=await library(),bp=await model(onStatus),frames=[],onsets=[],contours=[];
 onStatus('Running Basic Pitch locally…');
 await bp.evaluateModel(rendered.audio,(f,o,c)=>{frames.push(...f);onsets.push(...o);contours.push(...c);},p=>onStatus('Basic Pitch '+Math.round(p*100)+'%'));
 onStatus('Decoding inferred notes…');
 const raw=outputToNotesPoly(frames,onsets,.25,.25,5,true,null,null,false,11),detected=noteFramesToTime(raw).map(n=>({pitchMidi:n.pitchMidi,startTimeSeconds:n.startTimeSeconds,durationSeconds:n.durationSeconds,amplitude:n.amplitude}));
 const comparison=compare(rendered.expected,detected),interpretation=comparison.missed?'At least one intended note was not confidently recovered.':comparison.maxAbsoluteSemitones===0&&comparison.extraStrongNotes&&comparison.nonHarmonicExtras===0?'The intended probe pitch was recovered exactly; the additional strong detections align with its harmonic series.':comparison.maxAbsoluteSemitones===0?'The intended probe pitch was recovered exactly at MIDI-note resolution.':comparison.maxAbsoluteSemitones<=1?'The strongest detections stay within one semitone of the intended notes.':'The strongest inferred pitches diverge materially from the intended probe notes.',result={schema:'diddums-basic-pitch-critic/1',model:{name:'Spotify Basic Pitch',package:'@spotify/basic-pitch',version:'1.0.1',modelUrl:MODEL,license:'Apache-2.0'},kernel:{id:kernel.id,hash:kernel.hash},render:rendered.render,expected:rendered.expected,detected,comparison,tuning,interpretation};
 onStatus('Pitch check complete');return result;
}