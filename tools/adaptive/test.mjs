#!/usr/bin/env node
// Tests for the seven adaptive-expression additions (public/research/adaptive-expression-plan.md).
// Each renders through the real worklet and native kernels offline. Run: node tools/adaptive/test.mjs
import assert from 'node:assert/strict';
import {offline,compositionFromSong,planEvents,rms,centroid,pitch} from './offline.mjs';
import {transformDegrees,toMelody,transform,characterOps} from '../../public/motif.js';

let failed=0;const results=[];
async function test(name,fn){try{await fn();results.push(['ok',name]);}catch(e){failed++;results.push(['FAIL',name+': '+e.message]);}}
const SR=48000,BPM=120,BAR=4*60/BPM*SR;
const song={title:'Test scene',bpm:BPM,key:'A minor',chords:[1,6,3,7],seconds:600,tracks:[
 {id:'pad',sound:'nebulaPad',label:'Pad'},{id:'bass',sound:'subBass',label:'Bass'},{id:'arp',sound:'arpeggiator',label:'Arp'},{id:'lead',sound:'chromeLead',role:'lead',label:'Lead'},
 {id:'mentor',sound:'feltPiano',role:'lead',label:'Mentor'},{id:'rival',sound:'brassStabs',role:'lead',label:'Rival'},
 {id:'hold',sound:'subBass',role:'drone',label:'Held tone'},{id:'air',sound:'radioSnow',role:'drone',label:'Noise band'}]};
const comp=compositionFromSong(song);
const MOTIF=[0,null,2,null,4,null,3,2,0,null,-1,null,-3,null,-1,null];
const characters={mentor:{track:'mentor',motif:MOTIF},rival:{track:'rival',motif:[0,1,0,null,4,null,3,null,0,null,null,null,-2,null,null,null]}};
const scene=s=>({name:s.mood||'calm',layers:s.layers||['pad','bass','arp'],rhythm:s.drums||'none',energy:.6,...(s.tempo?{tempo:s.tempo}:{}),...(s.harmony?{harmony:s.harmony}:{})});
const key=e=>`${e.track}|${e.frame}|${e.note}|${e.velocity.toFixed(4)}|${e.duration}`;
const sceneOnly=list=>list.filter(e=>!['mentor','rival'].includes(e.track));
const barsOf=(list,track)=>new Set(list.filter(e=>e.track===track).map(e=>e.bar));

// ---- 1. Character layers ----
await test('1 characters enter and leave on bar lines; scene unchanged note for note',()=>{
 const a=offline({composition:comp,plan:scene,characters});a.render(BAR*10/SR);
 const b=offline({composition:comp,plan:scene,characters});b.render(1.1);
 const enterBar=b.core.bar+1;b.core.enter('mentor');b.render(2.5);b.core.enter('rival');const rivalBar=b.core.bar+1;b.render(3);
 const leaveBar=b.core.bar+1;b.core.leave('mentor');b.render(BAR*10/SR-6.6);
 assert.deepEqual(sceneOnly(b.events()).filter(e=>e.bar<9).map(key),sceneOnly(a.events()).filter(e=>e.bar<9).map(key),'scene events differ');
 const m=barsOf(b.events(),'mentor'),r=barsOf(b.events(),'rival');
 assert.equal(Math.min(...m),enterBar,'mentor starts at the next bar');assert.equal(Math.max(...m),leaveBar-1,'mentor stops at the next bar');
 assert.equal(Math.min(...r),rivalBar);assert.ok(Math.max(...r)>=8,'rival still playing');
 assert.equal(a.events('mentor').length,0);
});
await test('1 setCharacter changes only that character, from the next bar',()=>{
 const o=offline({composition:comp,plan:scene,characters:{...characters,mentor:{...characters.mentor,present:true},rival:{...characters.rival,present:true}}});o.render(2.2);
 const from=o.core.bar+1,before=o.events('rival').filter(e=>e.bar<from+2).map(key);o.core.setCharacter('mentor',{power:.1});o.render(4);
 assert.deepEqual(o.events('rival').filter(e=>e.bar<from+2).map(key),before);
 const m=o.events('mentor');assert.ok(m.filter(e=>e.bar>=from).length<m.filter(e=>e.bar<from).length*2,'powerless mentor thins out');
});

// ---- 2. Motif transformations ----
await test('2 operations on a known motif',()=>{
 const m=[0,null,2,4];
 assert.deepEqual(transformDegrees(m,{transpose:1}),[1,null,3,5]);
 assert.deepEqual(transformDegrees(m,{invert:true}),[0,null,-2,-4]);
 assert.deepEqual(transformDegrees(m,{retrograde:true}),[4,2,null,0]);
 assert.deepEqual(transformDegrees(m,{augment:2}),[0,null,null,null,2,null,4,null]);
 assert.deepEqual(transformDegrees([0,null,2,null,4,null,5,null],{augment:.5}),[0,2,4,5]);
 assert.deepEqual(transformDegrees(m,{fragment:2}),[0,null,2,null]);
 assert.deepEqual(transformDegrees(m,{displace:1}),[4,0,null,2]);
 const dropped=transformDegrees([0,1,2,3,4,5,6,7],{drop:.5});assert.equal(dropped[0],0);assert.ok(dropped.filter(d=>d!=null).length<8&&dropped.filter(d=>d!=null).length>1);
 assert.deepEqual(toMelody([0,2,4,7,-1],'minor'),[12,15,19,24,10]);
 assert.deepEqual(transform([0,2,4],{mode:'major',octave:1},'minor'),[24,28,31]);
});
await test('2 states change the rendered layer as the table says',()=>{
 const run=st=>{const o=offline({composition:comp,plan:scene,characters:{mentor:{...characters.mentor,present:true,state:st}}});o.render(BAR*4/SR);return o.events('mentor');};
 const neutral=run({}),weak=run({power:.1}),sad=run({mood:-1}),strong=run({power:1});
 const mean=l=>l.reduce((s,e)=>s+e.note,0)/l.length;
 assert.ok(weak.length<neutral.length/2,`powerless: fewer notes (${weak.length} vs ${neutral.length})`);
 assert.ok(mean(weak)>mean(neutral)+6,'powerless: higher register');
 assert.ok(sad.length<neutral.length,'sad: slower (augmented)');
 assert.ok(mean(strong)<mean(neutral)-6,'powerful: lower register');
 const ops=characterOps({mood:-1,stability:.2,health:.3},'minor');
 assert.equal(ops.mode,'locrian');assert.ok(ops.wobble.depth>.5&&ops.muffle>.3&&ops.looseness>40&&ops.augment===2);
 // Sadness darkens the mode one step, or two when very sad.
 assert.equal(characterOps({mood:-.5},'minor').mode,'phrygian');assert.equal(characterOps({mood:-.5},'major').mode,'minor');
});

// ---- 3. Pitch instability ----
function heldNote(controls=[],id='hold'){
 const o=offline({composition:comp,plan:()=>({name:'hold',layers:[id],rhythm:'none',energy:.6})});
 for(const [k,v] of controls)o.core.control(id,k,v);o.solo(id);
 o.post({type:'control',id:'room',key:'wet',value:0});o.post({type:'control',id:'echo',key:'echo',value:0});
 return o.render(4);
}
await test('3 zero wobble and drift reproduce the output exactly',()=>{
 const a=heldNote(),b=heldNote([['wobble',{depth:0,rate:2}],['drift',0]]);
 assert.equal(a.L.length,b.L.length);for(let i=0;i<a.L.length;i++)if(a.L[i]!==b.L[i])throw new Error('sample '+i+' differs');
});
await test('3 wobble follows the requested depth and rate',()=>{
 const o=heldNote([['wobble',{depth:1,rate:1}]]),plain=heldNote();
 const f0=pitch(plain.L,SR*1.5,SR*3.5),track=[];for(let t=1.2;t<3.8;t+=.05){const f=pitch(o.L,t*SR,(t+.1)*SR);track.push(12*Math.log2(f/f0));}
 const max=Math.max(...track),min=Math.min(...track);
 assert.ok(max>.6&&max<1.4&&min<-.6&&min>-1.4,`depth ±1 semitone (got ${min.toFixed(2)}..${max.toFixed(2)})`);
 let crossings=0;for(let i=1;i<track.length;i++)if(Math.sign(track[i])!==Math.sign(track[i-1]))crossings++;
 assert.ok(crossings>=3&&crossings<=7,`about 1 Hz over 2.6 s (${crossings} zero crossings)`);
 const d=heldNote([['drift',.5]]),dev=[];for(let t=1.2;t<3.8;t+=.1){const f=pitch(d.L,t*SR,(t+.1)*SR);dev.push(12*Math.log2(f/f0));}
 assert.ok(Math.max(...dev.map(Math.abs))>.1&&Math.max(...dev.map(Math.abs))<1.5,'drift wanders within range');
});

// ---- 6. Ducking and muffling ----
await test('6 muffle lowers the spectrum; zero is exact',()=>{
 const a=heldNote([],'air'),b=heldNote([['muffle',.8]],'air'),z=heldNote([['muffle',0]],'air');
 const ca=centroid(a.L,SR*2,SR*2+8192),cb=centroid(b.L,SR*2,SR*2+8192);
 assert.ok(cb<ca*.6,`centroid ${ca.toFixed(0)} → ${cb.toFixed(0)} Hz`);
 for(let i=0;i<a.L.length;i++)if(a.L[i]!==z.L[i])throw new Error('muffle 0 differs at '+i);
});
await test('6 ducking lowers the scene while the character plays',()=>{
 const run=amount=>{const o=offline({composition:comp,plan:()=>({name:'d',layers:['pad'],rhythm:'none',energy:.6}),characters:{mentor:{...characters.mentor,present:true}}});if(amount!=null)o.core.duck({by:'mentor',targets:'scene',amount,release:.2});
  const levels=[];o.proc.port.sent=m=>{if(m.type==='telemetry')levels.push([m.position,m.measurements.pad?.rms||0,m.measurements.mentor?.rms||0]);};o.render(6);return levels;};
 const plain=run(),ducked=run(.7),zero=run(0);
 const padWhen=(L,on)=>{const xs=L.filter(([p,,m])=>p>SR*2&&(on?m>.002:m<.0002)).map(([, v])=>v);return xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);};
 assert.ok(padWhen(ducked,true)<padWhen(plain,true)*.6,`pad while mentor plays: ${padWhen(plain,true).toFixed(4)} → ${padWhen(ducked,true).toFixed(4)}`);
 assert.deepEqual(zero.map(x=>x[1].toFixed(6)),plain.map(x=>x[1].toFixed(6)),'amount 0 is unchanged');
});

// ---- 4. Tempo ----
await test('4 constant tempo reproduces today’s frames',()=>{
 const a=offline({composition:comp,plan:scene});a.render(8);
 const b=offline({composition:comp,plan:s=>({...scene(s),tempo:BPM})});b.render(1);b.core.set({x:1});b.render(7);
 assert.deepEqual(b.events().filter(e=>e.bar<4).map(key),a.events().filter(e=>e.bar<4).map(key));
});
await test('4 bar lines follow the tempo map; hit() stays on the 16th grid',()=>{
 const o=offline({composition:comp,plan:s=>({...scene(s),tempo:s.tempo??BPM}),state:{}});o.render(2.5);
 const from=o.core.bar+1;o.core.set({tempo:90});o.render(10);
 const s0=o.core.barStart(from),s1=o.core.barStart(from+1),s2=o.core.barStart(from+2);
 assert.ok(Math.abs(s1-s0-4*60/90*SR)<1&&Math.abs(s2-s1-4*60/90*SR)<1,'bars at 90 bpm after the change');
 assert.ok(Math.abs(s0-from*BAR)<1,'bars before the change at 120 bpm');
 const down=o.events().filter(e=>e.bar===from+1&&e.step===0);assert.ok(down.length&&down.every(e=>Math.abs(e.frame-s1)<SR*.01),'downbeat events on the new bar line');
 const now=o.proc.position,wait=o.core.hit('lead',{tones:[0]});const h=o.events('lead').find(e=>e.hit);const b=o.core.barAt(h.frame),step=(o.core.barStart(b+1)-o.core.barStart(b))/16;
 const k=(h.frame-o.core.barStart(b))/step;assert.ok(Math.abs(k-Math.round(k))<.01,'hit on a 16th');assert.ok(wait>0&&wait<.03+60/90/4+.01,'hit within one 16th');
 o.render(1);
});
await test('4 tempo ramp moves gradually',()=>{
 const o=offline({composition:comp,plan:scene});o.render(1);const from=o.core.bar+1;o.core.tempoTo(80,{ramp:4});o.render(12);
 const len=b=>o.core.barStart(b+1)-o.core.barStart(b),lens=[0,1,2,3,4].map(i=>len(from+i));
 for(let i=1;i<lens.length;i++)assert.ok(lens[i]>=lens[i-1]-1,'monotone slowing');assert.ok(Math.abs(lens[3]-4*60/80*SR)<2,'reaches 80 bpm after 4 bars');
});

// ---- 5. Per-layer looseness and accents ----
await test('5 looseness and accents affect only that track',()=>{
 const a=offline({composition:comp,plan:scene});a.render(8);
 const b=offline({composition:comp,plan:scene,feel:{arp:{looseness:40,accents:[1,.5]}}});b.render(8);
 assert.deepEqual(b.events().filter(e=>e.track!=='arp'&&e.bar<4).map(key),a.events().filter(e=>e.track!=='arp'&&e.bar<4).map(key),'other tracks unchanged');
 const A=a.events('arp').filter(e=>e.bar<4),B=b.events('arp').filter(e=>e.bar<4);assert.equal(A.length,B.length);
 const dev=A.map((e,i)=>(B[i].frame-e.frame)/SR*1000),sd=Math.sqrt(dev.reduce((s,x)=>s+x*x,0)/dev.length);
 assert.ok(sd>10&&sd<40&&Math.max(...dev.map(Math.abs))<=41,`onset deviation sd ${sd.toFixed(1)} ms for ±40 ms`);
 for(let i=0;i<A.length;i++){const want=Math.min(1,A[i].velocity*[1,.5][Math.floor(A[i].step)%2]);assert.ok(Math.abs(B[i].velocity-Math.max(.05,want))<1e-9,'accent pattern');}
});

// ---- 7. Transitions ----
await test('7 fill and pickup land in the bar before the change',()=>{
 for(const kind of ['fill','pickup']){
  const o=offline({composition:comp,plan:scene});o.render(1);const b=o.core.bar;
  o.core.set({mood:'chase',drums:'house',layers:['pad','bass','arp','lead'],harmony:comp.harmony.slice(1)},{transition:kind,beats:2});o.render(8);
  const from=b+2,tr=o.events().filter(e=>e.transition===kind);
  assert.ok(tr.length>0,kind+' events');assert.ok(tr.filter(e=>e.bar===from-1).every(e=>e.frame>=o.core.barStart(from)-2*60/BPM*SR-1),kind+' in the last 2 beats');
  assert.ok(o.events('d:bd').filter(e=>e.bar>=from&&!e.transition).length>0,'new arrangement starts at '+from);
  assert.equal(o.events('d:bd').filter(e=>e.bar<from&&!e.transition).length,0,'old arrangement kept until the change');
 }
});
await test('7 crossfade gives a continuous level curve; cut silences then returns',()=>{
 const o=offline({composition:comp,plan:scene});o.render(2.2);const from=o.core.bar+1;
 const levels=[];o.proc.port.sent=m=>{if(m.type==='telemetry')levels.push([m.position,m.measurements.arp?.rms||0,m.measurements.lead?.rms||0]);};
 o.core.set({layers:['pad','bass','lead']},{transition:'crossfade',beats:4});o.render(6);
 const fades=o.controls.filter(c=>c.key==='fade');assert.ok(fades.some(c=>c.id==='arp'&&c.value.to===0)&&fades.some(c=>c.id==='lead'&&c.value.to===1));
 const g=o.proc.byId.get('arp');const s=o.core.barStart(from),gains=[];for(let f=s-SR*.2;f<s+1.98*SR;f+=SR*.05)gains.push(o.proc.autoAt(g.fade,f));
 for(let i=1;i<gains.length;i++)assert.ok(gains[i]<=gains[i-1]+1e-9&&gains[i-1]-gains[i]<.06,'smooth fall');
 assert.ok(gains[0]===1&&gains[gains.length-1]<.03,'1 → 0 over the 4 beats');
 assert.ok(o.events('arp').some(e=>e.bar===from&&e.transition==='crossfade'),'leaving layer keeps playing while fading');
 const c=offline({composition:comp,plan:scene});c.render(1);const cb=c.core.bar+2;c.core.set({drums:'house'},{transition:'cut',beats:1});const out=c.render(6);
 const cut=c.core.barStart(cb)-SR*.5,start=c.core.barStart(cb);
 assert.ok(rms(out.L,Math.round(cut+SR*.05-out.start),Math.round(start-SR*.02-out.start))<.002,'silent in the cut');
 assert.ok(rms(out.L,Math.round(start+SR*.05-out.start),Math.round(start+SR*.5-out.start))>.01,'returns at the change');
});
await test('7 no transition reproduces the plain next-bar change',()=>{
 const a=offline({composition:comp,plan:scene});a.render(1.5);const from=a.core.bar+1;a.core.set({drums:'house'});a.render(6);
 const want=planEvents(comp,scene({drums:'house'}),from,1,SR).map(key),got=a.events().filter(e=>e.bar===from).map(key);
 assert.deepEqual(got.sort(),want.sort());
});

for(const [s,n] of results)console.log(s.padEnd(4),n);
console.log(failed?`${failed} failed`:'all passed');process.exit(failed?1:0);
