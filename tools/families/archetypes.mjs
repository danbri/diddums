// Generates LeanDSP instrument families from synthesis archetypes. Each family is a complete `dsp`
// program with the standard interface (freq, gate, colour, life); variants differ in structure and
// constants, not just in preset settings. Output is screened (screen.mjs) before any native Lean build.
const L=x=>{const v=Number(x);if(!Number.isFinite(v))throw new Error('bad literal');const s=Math.abs(v)<1e-6?'0.0':v.toFixed(6).replace(/0+$/,'').replace(/\.$/,'.0');return v<0?`(0.0 - ${s.slice(1)})`:s;};
const cap=s=>s[0].toUpperCase()+s.slice(1);
const head=(name,life=1.2,extra='')=>`dsp ${name} where
  param freq : Hz @control := 220.0 range 24.0 12000.0
  param gate : Unit @control := 0.0 range 0.0 1.0
  param colour : Unit @control := 0.5 range 0.0 1.0
  param life : Seconds @control := ${L(life)} range 0.03 8.0
  state previous : F32 := 0.0
${extra}`;
const st=(names,v=0)=>names.map(n=>`  state ${n} : F32 := ${L(v)}`).join('\n')+'\n';
// Envelope helpers (lines inside `sample x =>`).
const trig='    let trigger := gt(gate, previous + 0.001)\n';
const percEnv=(env='env',scale=1)=>`    let ${env}A := select(trigger, gate, ${env} * expneg(5.0 / (life * ${L(scale)} * sr)))\n    set ${env} := ${env}A\n`;
const susEnv=(att,env='env')=>`    let ${env}C := select(gt(gate, ${env}), 1.0 - expneg(1.0 / (${L(att)} * sr)), 1.0 - expneg(5.0 / (life * sr)))\n    let ${env}A := ${env} + ${env}C * (gate - ${env})\n    set ${env} := ${env}A\n`;
const svf=(tag,input,cut,res)=>`    let g${tag} := tanpi(min(0.45, max(10.0, ${cut}) / sr))
    let k${tag} := ${res}
    let a${tag} := 1.0 / (1.0 + g${tag} * (g${tag} + k${tag}))
    let v1${tag} := a${tag} * (i1${tag} + g${tag} * (${input} - i2${tag}))
    let v2${tag} := i2${tag} + g${tag} * v1${tag}
    set i1${tag} := 2.0 * v1${tag} - i1${tag}
    set i2${tag} := 2.0 * v2${tag} - i2${tag}
`;// low-pass = v2, band-pass = v1, high-pass = input - k*v1 - v2
const svfState=tag=>st([`i1${tag}`,`i2${tag}`]);
// White noise from a sample counter, hashed twice: noise1 alone on a counter has strong spectral lines
// (spectral flatness 0.35); hashing its output again with the counter scaled by the golden ratio measures
// 0.99 (white = 1). The counter restarts with each note and wraps long before F32 loses integer precision.
// (An earlier version hashed a seed stepped by a constant fraction, which repeats every ~80 samples and
// sounds as a fixed ~600 Hz buzz.)
const noise='    let nz := noise1(noise1(counter) * 437.5453 + counter * 0.6180339)\n    set counter := select(gt(counter, 1000000.0), 1.0, counter + 1.0)\n';
const seedState='  state counter : F32 := 1.0\n';
const fin=(expr,gain=1)=>`    set previous := gate\n    return softsign((${expr}) * ${L(gain)})\n`;
// Same ending with a DC blocker, for models whose excitation carries a steady offset (breath, reed pressure, folding).
const dcFin=(expr,gain=1)=>`    let pre := (${expr}) * ${L(gain)}\n    let hp := pre - dcx + 0.995 * dcs\n    set dcx := pre\n    set dcs := hp\n    set previous := gate\n    return softsign(hp)\n`;
const dcState=st(['dcx','dcs']);
const out=[];
const add=(id,label,category,archetype,body,meta={})=>out.push({id,label,category,archetype,source:body(`Gen${cap(id)}`),...meta});

// 1. Modal: struck bars, bells, plates and membranes as banks of decaying partials.
const MODAL={
 woodBar:[[1,1],[3.93,.45],[10.4,.18],[19.8,.07]],marimbaBar:[[1,1],[4,.5],[10,.2]],vibeBar:[[1,1],[3.98,.35],[9.94,.12]],
 glassBar:[[1,1],[2.756,.5],[5.404,.28],[8.933,.12]],steelBar:[[1,1],[2.756,.7],[5.404,.45],[8.933,.3],[13.34,.15]],
 churchBell:[[.5,.6],[1,1],[1.2,.6],[1.5,.4],[2,.35],[2.5,.2]],handBell:[[1,1],[2.4,.5],[3.9,.35],[5.6,.2]],
 tubularBell:[[1,1],[2.76,.6],[5.4,.4],[8.93,.25],[13.3,.12]],plate:[[1,1],[1.59,.7],[2.13,.6],[2.65,.5],[2.92,.4],[3.5,.3]],
 membrane:[[1,1],[1.59,.6],[2.14,.45],[2.3,.35],[2.65,.25],[2.92,.2]],gong:[[1,1],[1.34,.7],[1.79,.6],[2.27,.5],[2.86,.4],[3.37,.3]],
 kalimba:[[1,1],[5.95,.3],[12.6,.08]],steelPan:[[1,1],[2,.6],[3,.35],[4.02,.2],[5.03,.12]],crystal:[[1,1],[3.1,.5],[6.9,.3],[11.4,.15]],
 tine:[[1,1],[6.27,.25],[17.55,.08]],cowbell:[[1,1],[1.48,.8],[2.66,.4]],woodBlock:[[1,1],[2.6,.6],[4.9,.25]],singingBowl:[[1,1],[2.71,.6],[5.13,.4],[8.27,.2]]};
const MODAL_LIFE={woodBar:.7,marimbaBar:1.2,vibeBar:3,glassBar:2,steelBar:2.5,churchBell:5,handBell:2.5,tubularBell:4,plate:3,membrane:.6,gong:6,kalimba:1.4,steelPan:1.6,crystal:3.5,tine:2.2,cowbell:.5,woodBlock:.25,singingBowl:7};
const HARD={soft:[.03,.5],medium:[.012,.8],hard:[.004,1.2]};// click length (s), click level
for(const [set,modes] of Object.entries(MODAL))for(const [h,[clickLen,clickAmp]] of Object.entries(HARD))for(const tilt of [.6,1.4]){
 const id=`modal${cap(set)}${cap(h)}${tilt<1?'Short':'Ring'}`;
 add(id,`${set.replace(/([A-Z])/g,' $1').toLowerCase()} · ${h} strike, ${tilt<1?'damped':'ringing'} highs`,'Mallets & bells','modal',name=>{
  const n=modes.length,ph=modes.map((_,i)=>`p${i}`),ev=modes.map((_,i)=>`e${i}`);
  let s=head(name,MODAL_LIFE[set],st([...ph,...ev,'click'])+seedState)+'  sample x =>\n'+trig+noise;
  modes.forEach(([r,a],i)=>{const decay=Math.pow(1/(1+i*.6),tilt);s+=`    let e${i}A := select(trigger, gate * ${L(a)} * (1.0 + colour * ${L(i*.35)}), e${i} * expneg(5.0 / (life * ${L(decay)} * sr)))\n    set e${i} := e${i}A\n    set p${i} := fract(p${i} + min(0.45, freq * ${L(r)} / sr))\n`;});
  s+=`    let clickA := select(trigger, gate * ${L(clickAmp)}, click * expneg(1.0 / (${L(clickLen)} * sr)))\n    set click := clickA\n    let lpA := nz * clickA * (0.3 + colour * 0.5)\n`;
  s+=fin(modes.map((_,i)=>`sinpi(p${i} * 2.0) * e${i}A`).join(' + ')+' + lpA * 0.5',.55/Math.sqrt(n));return s;});
}

// 2. Plucked waveguide strings (Karplus-Strong) with pick brightness, damping and body.
const BODIES={none:null,mandolin:[[240,.5],[700,.4]],oud:[[110,.6],[280,.4]],dulcimer:[[330,.5],[990,.4]],ukulele:[[220,.5],[520,.4]],guitar:[[98,.6],[204,.5],[390,.3]],harp:[[150,.3],[520,.2]],banjo:[[260,.7],[880,.5]],sitar:[[180,.4],[1200,.3]],koto:[[300,.4],[700,.3]],lute:[[120,.5],[300,.4]],clav:[[600,.5],[1800,.4]]};
for(const [body,res] of Object.entries(BODIES))for(const pick of ['soft','bright'])for(const damp of ['dark','open','metal']){
 const id=`pluck${cap(body)}${cap(pick)}${cap(damp)}`;
 add(id,`plucked string · ${body==='none'?'bare':body+' body'}, ${pick} pick, ${damp} decay`,'Plucked strings','pluck',name=>{
  const d={dark:[.42,.2],open:[.28,.25],metal:[.12,.2]}[damp];// the noise burst lasts about a period of the note (Karplus-Strong)
  let s=head(name,{dark:1.2,open:2,metal:3.5}[damp],st(['burst','lp'])+dcState+seedState+(res?svfState('b1')+(res[1]?svfState('b2'):''):'')+'  buffer string : F32[4096]\n')+'  sample x =>\n'+trig+noise;
  s+=`    let burstA := select(trigger, gate, burst * expneg(${pick==='soft'?'2.5':'4.0'} * max(24.0, freq) / sr))\n    set burst := burstA\n    let lpA := lp + ${pick==='soft'?'0.35':'0.85'} * (nz * burstA - lp)\n    set lp := lpA\n`;
  s+=`    let length := min(4093.0, sr / max(24.0, freq) - 0.5)\n    let a := taplin(string, length)\n    let b := taplin(string, length + 1.0)\n    let damping := ${L(d[0])} + (1.0 - colour) * ${L(d[1])}\n    let wave := a * (1.0 - damping) + b * damping\n    let fb := min(0.9998, expneg(5.0 / (max(24.0, freq) * life)))\n`;
  s+=body==='sitar'?`    let driven := clip((wave + (softsign(wave * 4.0) * 0.25 - wave) * 0.15) * fb + lpA * 2.0, -1.5, 1.5)\n`:`    let driven := clip(wave * fb + lpA * 2.0, -1.5, 1.5)\n`;
  s+='    push string := driven\n';
  let outE='wave';
  if(res){s+=svf('b1','wave',L(res[0][0]),'0.7');outE+=` + v1b1 * ${L(res[0][1])}`;if(res[1]){s+=svf('b2','wave',L(res[1][0]),'0.9');outE+=` + v1b2 * ${L(res[1][1])}`;}}
  s+=dcFin(outE,.9);return s;});
}

// 3–5. Bowed strings, winds and reeds: oscillators in tune by construction (a phase accumulator), shaped
// by harmonic mixes, filters and body resonances, with breath or bow noise and delayed vibrato. (The first
// versions were self-oscillating waveguides that did not lock to the requested pitch.)
const vibrato=(rate,depth,delay)=>`    set vib := fract(vib + ${L(rate)} / sr)\n    let veA := ve + (envA - ve) * (1.0 - expneg(1.0 / (${L(delay)} * sr)))\n    set ve := veA\n`;
const phase=(fexpr)=>`    let f := ${fexpr}\n    let phA := fract(ph + f / sr)\n    set ph := phA\n`;

// 3. Bowed strings: a sawtooth (the Helmholtz motion of a bowed string) through two body resonances,
// bow noise, a bowed attack and vibrato that arrives after the note starts.
const BODY={violin:[450,2900],viola:[350,2200],cello:[210,1500],bass:[110,900],fiddle:[520,2600]};
for(const reg of ['violin','viola','cello','bass','fiddle'])for(const bow of ['smooth','airy','gritty'])for(const vib of ['still','warm','wide']){
 const id=`bowed${cap(reg)}${cap(bow)}${cap(vib)}`;
 add(id,`bowed ${reg} · ${bow} bow, ${vib} vibrato`,'Bowed strings','bowed',name=>{
  const [rate,depth]={still:[5,.0008],warm:[5.2,.0045],wide:[6.2,.009]}[vib],grit={smooth:.04,airy:.14,gritty:.09}[bow],edge={smooth:.5,airy:.45,gritty:.9}[bow],[b1,b2]=BODY[reg];
  let s=head(name,.6,st(['env','ph','vib','ve','i1l','i2l','i1a','i2a','i1b','i2b'])+seedState)+'  sample x =>\n'+trig+noise+susEnv({violin:.09,viola:.1,cello:.12,bass:.16,fiddle:.05}[reg]);
  s+=vibrato(rate,depth,.35)+phase(`max(24.0, freq) * (1.0 + sinpi(vib * 2.0) * ${L(depth)} * veA)`);
  s+=`    let saw := phA * 2.0 - 1.0\n    let bowNoise := nz * envA * ${L(grit)} * (1.0 + 2.0 * max(0.0, 0.6 - envA))\n    let drive := saw * envA + bowNoise\n`;
  s+=svf('l','drive',`f * ${L(3+5*edge)} * (0.6 + colour)`,'1.0');
  s+=svf('a','v2l',L(b1),'0.9')+svf('b','v2l',L(b2),'1.4');
  s+=fin('v2l * 0.6 + v1a * 0.5 + v1b * 0.35',1.6);return s;});
}

// 4. Blown: a sine with a little 2nd and 3rd harmonic (more for recorders and fifes), breath noise
// band-passed around the note, a chiff at the start, and vibrato; shakuhachi bends up into the note.
const BLOWN={flute:[.12,.05,0],recorder:[.22,.12,0],pan:[.06,.02,0],shakuhachi:[.1,.06,.04],ocarina:[.03,.01,0],bottle:[.02,.0,0],whistle:[.08,.04,0],fife:[.25,.15,0]};
for(const kind of ['flute','recorder','pan','shakuhachi','ocarina','bottle','whistle','fife'])for(const breath of ['pure','breathy','windy'])for(const reg of ['low','high']){
 const id=`blown${cap(kind)}${cap(breath)}${cap(reg)}`;
 add(id,`${kind} · ${breath}, ${reg} register`,'Winds','blown',name=>{
  const n={pure:.05,breathy:.16,windy:.35}[breath],[h2,h3,bend]=BLOWN[kind],oct=reg==='high'?2:1;
  let s=head(name,.4,st(['env','ph','vib','ve','chiff','i1b','i2b'])+seedState)+'  sample x =>\n'+trig+noise+susEnv(kind==='shakuhachi'?.12:kind==='pan'?.07:.05);
  s+=`    let chiffA := select(trigger, gate, chiff * expneg(1.0 / (0.05 * sr)))\n    set chiff := chiffA\n`+vibrato(kind==='ocarina'?5.5:4.8,.004,.4);
  s+=phase(`max(24.0, freq * ${L(oct)}) * (1.0 + sinpi(vib * 2.0) * 0.004 * veA - chiffA * ${L(bend)})`);
  s+=`    let bright := 0.5 + colour\n    let tone := sinpi(phA * 2.0) + sinpi(phA * 4.0) * ${L(h2)} * bright + sinpi(phA * 6.0) * ${L(h3)} * bright\n`;
  s+=svf('b','nz','f * 2.0','1.4');
  s+=fin(`tone * envA * 0.55 + v1b * envA * ${L(n)} * 3.0 + v1b * chiffA * 0.6`,1.2);return s;});
}

// 5. Reeds. Clarinet and chalumeau: a sine driven into a soft clip (odd harmonics, brighter when
// louder). Oboe, sax, bassoon (conical bores): a sawtooth through a low-pass, with a nasal formant for
// the oboe. Harmonium, accordion, melodica (free reeds): pulse waves, two or three slightly detuned
// for the accordion's beating; all through a low-pass that opens with the breath.
const FORMANT={clarinet:[0,0],chalumeau:[0,0],oboe:[1400,.6],sax:[900,.4],bassoon:[500,.5],harmonium:[1200,.15],accordion:[1500,.2],melodica:[1100,.25]};
for(const kind of ['clarinet','chalumeau','oboe','sax','bassoon','harmonium','accordion','melodica'])for(const reed of ['soft','reedy','brassy'])for(const vib of ['still','vibrato']){
 const id=`reed${cap(kind)}${cap(reed)}${cap(vib)}`;
 add(id,`${kind} · ${reed} reed, ${vib}`,'Reeds','reed',name=>{
  const edge={soft:.5,reedy:.8,brassy:1.2}[reed],odd=kind==='clarinet'||kind==='chalumeau',free=['harmonium','accordion','melodica'].includes(kind),[fm,fa]=FORMANT[kind];
  const detune=kind==='accordion'?.004:kind==='harmonium'?.0015:0;
  let s=head(name,.3,st(['env','ph','ph2','vib','ve','i1l','i2l','i1f','i2f'])+(free?dcState:'')+seedState)+'  sample x =>\n'+trig+noise+susEnv(free?.03:.04);
  s+=vibrato(5.4,vib==='vibrato'?.005:0,.35)+phase(`max(24.0, freq) * (1.0 + sinpi(vib * 2.0) * ${L(vib==='vibrato'?.005:0)} * veA)`);
  s+=`    let ph2A := fract(ph2 + f * ${L(1+detune)} / sr)\n    set ph2 := ph2A\n`;
  const wave=odd?`softsign(sinpi(phA * 2.0) * (1.0 + ${L(edge*4)} * envA * (0.4 + colour)))`:free?`(select(lt(phA, 0.42), 1.0, 0.0 - 1.0) + 0.16) * 0.6 + (select(lt(ph2A, 0.42), 1.0, 0.0 - 1.0) + 0.16) * ${detune?'0.6':'0.0'}`:`(phA * 2.0 - 1.0)`;
  s+=`    let src := (${wave}) * envA + nz * envA * 0.015\n`;
  s+=svf('l','src',`f * ${L(odd?6:4)} * (0.5 + colour) * (0.4 + 0.8 * envA) * ${L(.6+edge*.6)}`,'0.9');
  const end=free?dcFin:fin;// free reeds: soft-clipping an asymmetric pulse leaves an offset
  s+=fa?svf('f','v2l',L(fm),'1.2')+end(`v2l + v1f * ${L(fa)}`,1.3):end('v2l',1.3);return s;});
}

// 6. Two-operator FM with index envelope, feedback and fixed or ratio modulators.
const FM2=[[1,1],[1,2],[1,3],[1,3.5],[2,1],[1,1.414],[1,4],[1,5],[1,7],[1,.5],[3,1],[1,2.756],[1,6.1],[1,1.5],[1,8],[1,11]];
for(const [c,m] of FM2)for(const shape of ['pluck','keys','pad','bass','bell'])for(const fb of [0,.35]){
 if(shape==='bass'&&m>4)continue;
 const id=`fm${String(c).replace('.','p')}x${String(m).replace('.','p')}${cap(shape)}${fb?'Fb':''}`;
 add(id,`FM ${c}:${m} · ${shape}${fb?', feedback':''}`,'FM tones','fm2',name=>{
  const sustain=shape==='pad';let s=head(name,{pluck:.8,keys:1.6,pad:2.5,bass:.6,bell:4}[shape],st(['env','ienv','pc','pm','last']))+'  sample x =>\n'+trig;
  s+=sustain?susEnv(.25):percEnv();
  s+=`    let ienvA := select(trigger, gate, ienv * expneg(5.0 / (life * ${shape==='pad'?'1.5':'0.35'} * sr)))\n    set ienv := ienvA\n`;
  s+=`    let f := max(24.0, freq)${shape==='bass'?' * 0.5':''}\n    set pm := fract(pm + min(0.45, f * ${L(m)} / sr))\n    let mod := sinpi(pm * 2.0 + last * ${L(fb)}) * (0.2 + colour * 2.2) * ${sustain?'(0.4 + ienvA * 0.6)':'ienvA'}\n    set last := sinpi(pm * 2.0)\n`;
  s+=`    set pc := fract(pc + min(0.45, f * ${L(c)} / sr))\n`+fin(`sinpi(pc * 2.0 + mod) * envA`,.7);return s;});
}

// 7. Three-operator FM: stacked (3→2→1) and branched (2+3→1) algorithms.
for(const [r2,r3] of [[1,1],[2,1],[1,3],[3,7],[2,5],[1.41,2.82],[.5,1],[4,1],[1,14],[3.5,1.5]])for(const alg of ['stack','branch'])for(const env of ['strike','swell','organ']){
 const id=`fm3${alg}${String(r2).replace('.','p')}x${String(r3).replace('.','p')}${cap(env)}`;
 add(id,`3-operator FM · ${alg}, ratios 1:${r2}:${r3}, ${env}`,'FM tones','fm3',name=>{
  let s=head(name,env==='organ'?1.2:2,st(['env','ienv','p1','p2','p3']))+'  sample x =>\n'+trig+(env==='strike'?percEnv():susEnv(env==='swell'?.4:.01));
  s+=`    let ienvA := select(trigger, gate, ienv * expneg(5.0 / (life * 0.5 * sr)))\n    set ienv := ienvA\n    let depth := (0.3 + colour * 1.8) * ${env==='organ'?'0.5':'(0.3 + ienvA * 0.7)'}\n`;
  s+=`    let f := max(24.0, freq)\n    set p1 := fract(p1 + min(0.45, f / sr))\n    set p2 := fract(p2 + min(0.45, f * ${L(r2)} / sr))\n    set p3 := fract(p3 + min(0.45, f * ${L(r3)} / sr))\n`;
  s+=alg==='stack'?`    let m3 := sinpi(p3 * 2.0) * depth\n    let m2 := sinpi(p2 * 2.0 + m3) * depth\n`:`    let m2 := sinpi(p2 * 2.0) * depth + sinpi(p3 * 2.0) * depth * 0.6\n`;
  s+=fin('sinpi(p1 * 2.0 + m2) * envA',.7);return s;});
}

// 8. Subtractive: band-limited saw/pulse/triangle oscillators (with unison) through a resonant filter with its own envelope.
const SHAPES=['saw','square','pulse','tri','sync'];
for(const shape of SHAPES)for(const voice of ['bass','lead','pad','pluck','brass'])for(const filt of ['lp','bp','hp']){
 if(filt==='hp'&&voice==='bass')continue;if(filt==='bp'&&voice==='pad'&&shape==='tri')continue;
 const id=`sub${cap(shape)}${cap(voice)}${cap(filt)}`;
 add(id,`subtractive ${shape} · ${voice}, ${filt==='lp'?'low-pass':filt==='bp'?'band-pass':'high-pass'}`,'Synths','sub',name=>{
  const unison=voice==='pad'?(shape==='saw'||shape==='tri'||shape==='sync'?3:2):voice==='brass'?2:1,att={bass:.003,lead:.01,pad:.6,pluck:.002,brass:.08}[voice],res={bass:1.1,lead:.9,pad:1.3,pluck:.7,brass:1.2}[voice];
  const ph=[...Array(unison).keys()].map(i=>`ph${i}`);
  let s=head(name,{bass:.5,lead:1,pad:3,pluck:.5,brass:1}[voice],st([...ph,'env','fenv','sp'])+svfState('f'))+'  sample x =>\n'+trig+(voice==='pluck'?percEnv():susEnv(att));
  s+=`    let fenvA := select(trigger, gate, fenv * expneg(5.0 / (life * ${voice==='pad'?'1.2':'0.25'} * sr)))\n    set fenv := fenvA\n    let f := max(24.0, freq)${voice==='bass'?' * 0.5':''}\n`;
  let sum=[];
  ph.forEach((p,i)=>{const det=unison>1?1+(i-(unison-1)/2)*.006:1;s+=`    let dt${i} := min(0.4, f * ${L(det)} / sr)\n`;
   const blep=`select(lt(${p}, dt${i}), (${p} / dt${i}) * 2.0 - (${p} / dt${i}) * (${p} / dt${i}) - 1.0, select(gt(${p}, 1.0 - dt${i}), ((${p} - 1.0) / dt${i}) * ((${p} - 1.0) / dt${i}) + ((${p} - 1.0) / dt${i}) * 2.0 + 1.0, 0.0))`;
   const saw=`(${p} * 2.0 - 1.0 - ${blep})`;
   if(shape==='saw')sum.push(saw);
   else if(shape==='tri')sum.push(`(1.0 - abs(${p} * 4.0 - 2.0))`);
   else if(shape==='sync')sum.push(`sinpi(${p} * 2.0 * (1.5 + colour * 3.0))`);
   else{const w=shape==='square'?.5:.18;s+=`    let q${i} := fract(${p} + ${L(w)})\n`;sum.push(`(${saw} - (q${i} * 2.0 - 1.0))`);}
   s+=`    set ${p} := fract(${p} + dt${i})\n`;});
  s+=`    let raw := (${sum.join(' + ')}) * ${L(1/unison)} * envA\n`;
  s+=svf('f','raw',`(${voice==='pad'?'300.0':'120.0'} + (colour * 0.6 + fenvA * ${voice==='pad'?'0.3':'0.7'}) * ${voice==='bass'?'1800.0':'5200.0'})`,L(res));
  s+=fin(filt==='lp'?'v2f':filt==='bp'?'v1f * 1.6':`raw - ${L(res)} * v1f - v2f`,.9);return s;});
}

// 9. Additive organs: drawbar registrations, with optional percussion and tremolo.
const DRAWBARS={full:[8,8,8,8,8,8,8,8,8],jazz:[8,8,8,0,0,0,0,0,0],gospel:[8,8,8,8,0,0,0,0,8],flute:[0,8,0,0,0,0,0,0,0],reed:[0,0,8,8,8,0,0,0,0],theatre:[8,6,8,4,0,0,2,0,4],mellow:[0,0,8,6,0,0,0,0,0],bright:[0,0,6,8,8,6,6,6,8],church:[8,0,8,0,4,0,2,0,2],bass:[8,8,0,0,0,0,0,0,0]};
const HARM=[.5,1.5,1,2,3,4,5,6,8];
for(const [reg,bars] of Object.entries(DRAWBARS))for(const perc of ['plain','perc'])for(const trem of ['still','tremolo','chorale']){
 const id=`organ${cap(reg)}${cap(perc)}${cap(trem)}`;
 add(id,`drawbar organ · ${reg} registration${perc==='perc'?', percussion':''}${trem==='still'?'':', '+trem}`,'Organs','organ',name=>{
  const used=bars.map((b,i)=>[b,HARM[i],i]).filter(([b])=>b>0);
  let s=head(name,1,st([...used.map(([,,i])=>`h${i}`),'env','pe','lfo']))+'  sample x =>\n'+trig+susEnv(.006);
  s+=`    let peA := select(trigger, gate, pe * expneg(5.0 / (0.3 * sr)))\n    set pe := peA\n    set lfo := fract(lfo + ${trem==='tremolo'?'6.7':trem==='chorale'?'0.8':'0.0'} / sr)\n    let f := max(24.0, freq)\n`;
  used.forEach(([,r,i])=>{s+=`    set h${i} := fract(h${i} + min(0.45, f * ${L(r)} / sr))\n`;});
  const sum=used.map(([b,,i])=>`sinpi(h${i} * 2.0) * ${L(b/8)}`).join(' + ');
  s+=`    let tone := (${sum}) * ${L(1/Math.sqrt(used.length))} * envA${perc==='perc'?' + sinpi(h4 * 2.0) * peA * 0.4':''}\n`;
  if(perc==='perc'&&!used.some(([,,i])=>i===4))s=s.replace(`    let f := max(24.0, freq)\n`,`    let f := max(24.0, freq)\n    set h4 := fract(h4 + min(0.45, f * 3.0 / sr))\n`).replace('state env :','state h4 : F32 := 0.0\n  state env :');
  s+=fin(`tone * (1.0 - ${trem==='still'?'0.0':'0.25'} * (0.5 + 0.5 * sinpi(lfo * 2.0))) * (0.7 + colour * 0.3)`,.8);return s;});
}

// 10. Wavefolders (west-coast): sine or triangle folded by an enveloped index.
for(const src of ['sine','tri'])for(const env of ['pluck','swell','gong','bass'])for(const folds of [2,4,7])for(const sym of ['even','odd']){
 const id=`fold${cap(src)}${cap(env)}${folds}${cap(sym)}`;
 add(id,`wavefolder · ${src}, ${env}, ${folds}× fold${sym==='odd'?', offset':''}`,'Wavefolders','fold',name=>{
  let s=head(name,{pluck:.8,swell:2,gong:3,bass:.6}[env],st(['env','ienv','ph'])+dcState)+'  sample x =>\n'+trig+(env==='swell'?susEnv(.3):percEnv());
  s+=`    let ienvA := select(trigger, gate, ienv * expneg(5.0 / (life * ${env==='gong'?'0.8':'0.3'} * sr)))\n    set ienv := ienvA\n    set ph := fract(ph + min(0.45, max(24.0, freq)${env==='bass'?' * 0.5':''} / sr))\n`;
  s+=`    let base := ${src==='sine'?'sinpi(ph * 2.0)':'(1.0 - abs(ph * 4.0 - 2.0))'}\n    let idx := 1.0 + (colour * ${L(folds)} + ${L(folds*.5)}) * ${env==='swell'?'envA':'ienvA'}\n`;
  s+=dcFin(`fold(base * idx${sym==='odd'?' + 0.3':''}) * envA`,.8);return s;});
}

// 11. Formant voices: a glottal pulse through three resonant band-passes at vowel formants.
const VOWELS={a:[800,1150,2900],e:[400,1600,2700],i:[270,2140,2950],o:[450,800,2830],u:[325,700,2530],aa:[650,1080,2650],ee:[300,2300,3000]};
for(const [v,[f1,f2,f3]] of Object.entries(VOWELS))for(const who of ['bass','tenor','alto','soprano','child'])for(const tone of ['clean','breathy']){
 const id=`voice${cap(v)}${cap(who)}${cap(tone)}`;
 add(id,`sung “${v}” · ${who}, ${tone}`,'Voices','formant',name=>{
  const shift={bass:.85,tenor:1,alto:1.12,soprano:1.2,child:1.3}[who];
  let s=head(name,1.5,st(['env','ph','vib'])+seedState+svfState('a')+svfState('b')+svfState('c'))+'  sample x =>\n'+trig+noise+susEnv(.08);
  s+=`    set vib := fract(vib + 5.3 / sr)\n    set ph := fract(ph + min(0.45, max(24.0, freq) * (1.0 + sinpi(vib * 2.0) * 0.006) / sr))\n    let glottal := (ph * 2.0 - 1.0) * envA + nz * envA * ${tone==='breathy'?'0.35':'0.04'}\n`;
  s+=svf('a','glottal',`${L(f1*shift)} * (0.9 + colour * 0.2)`,'0.12')+svf('b','glottal',L(f2*shift),'0.1')+svf('c','glottal',L(f3*shift),'0.08');
  s+=fin('v1a + v1b * 0.6 + v1c * 0.3',.9);return s;});
}

// 12. Drums and percussion.
for(const [pitch,sweep] of [[45,4],[50,6],[55,3],[60,8],[40,10],[35,5],[70,3]])for(const click of ['soft','punchy','clicky'])for(const tail of ['tight','boomy']){
 const id=`kick${pitch}s${sweep}${cap(click)}${cap(tail)}`;
 add(id,`kick drum · ${pitch} Hz, ${sweep}× sweep, ${click}, ${tail}`,'Drums & percussion','kick',name=>{
  let s=head(name,tail==='tight'?.35:.9,st(['env','pe','ce','ph','lp'])+seedState)+'  sample x =>\n'+trig+noise+percEnv();
  s+=`    let peA := select(trigger, gate, pe * expneg(1.0 / (0.025 * sr)))\n    set pe := peA\n    let ceA := select(trigger, gate * ${click==='soft'?'0.2':click==='punchy'?'0.5':'0.9'}, ce * expneg(1.0 / (0.003 * sr)))\n    set ce := ceA\n`;
  s+=`    set ph := fract(ph + min(0.45, ${L(pitch)} * (0.7 + colour * 0.6) * (1.0 + peA * ${L(sweep)}) / sr))\n    let lpA := lp + 0.5 * (nz - lp)\n    set lp := lpA\n`+fin('sinpi(ph * 2.0) * envA + lpA * ceA',1.2);return s;});
}
for(const body of [150,190,240])for(const snap of ['dry','crisp','loose'])for(const rim of ['plain','rim']){
 const id=`snare${body}${cap(snap)}${cap(rim)}`;
 add(id,`snare · ${body} Hz shell, ${snap} wires${rim==='rim'?', rim':''}`,'Drums & percussion','snare',name=>{
  let s=head(name,{dry:.18,crisp:.25,loose:.4}[snap],st(['env','ne','p1','p2'])+seedState+svfState('n'))+'  sample x =>\n'+trig+noise+percEnv('env',.6);
  s+=`    let neA := select(trigger, gate, ne * expneg(5.0 / (life * sr)))\n    set ne := neA\n    set p1 := fract(p1 + ${L(body)} / sr)\n    set p2 := fract(p2 + ${L(body*1.47)} / sr)\n`;
  s+=svf('n','nz',`(${snap==='dry'?'2500.0':snap==='crisp'?'4500.0':'1800.0'} + colour * 3000.0)`,'0.8');
  s+=fin(`(sinpi(p1 * 2.0) + sinpi(p2 * 2.0) * 0.5) * envA * ${rim==='rim'?'0.8':'0.5'} + (nz - 0.8 * v1n - v2n) * neA * 0.6`,1);return s;});
}
// TR-808-style metal: six square oscillators at inharmonic ratios, band-passed then high-passed.
const METAL=[205.3,304.4,369.6,522.7,540,800];
for(const kind of ['closedHat','openHat','ride','crash','cowbell','shaker'])for(const tone of ['dark','bright','trashy']){
 const id=`metal${cap(kind)}${cap(tone)}`;
 add(id,`metallic ${kind.replace(/([A-Z])/g,' $1').toLowerCase()} · ${tone}`,'Drums & percussion','metal',name=>{
  const isBell=kind==='cowbell',isShaker=kind==='shaker',life={closedHat:.06,openHat:.4,ride:1.6,crash:2.2,cowbell:.35,shaker:.12}[kind];
  const f=isBell?[540,800]:METAL;let s=head(name,life,st([...f.map((_,i)=>`q${i}`),'env'])+seedState+svfState('m'))+'  sample x =>\n'+trig+noise+percEnv();
  f.forEach((hz,i)=>{s+=`    set q${i} := fract(q${i} + ${L(hz*{dark:.8,bright:1.2,trashy:1.5}[tone])} * (0.8 + colour * 0.4) / sr)\n`;});
  const sq=f.map((_,i)=>`select(lt(q${i}, 0.5), 1.0, (0.0 - 1.0))`).join(' + ');
  s+=`    let src := ${isShaker?'nz':`(${sq}) * ${L(1/f.length)}${tone==='trashy'?' + nz * 0.4':''}`}\n`;
  s+=svf('m','src',isBell?'800.0':isShaker?'6500.0':'(7000.0 + colour * 3000.0)',isBell?'0.4':'1.0');
  s+=fin(isBell?'v1m * envA * 1.5':'(src - v1m - v2m) * envA',isBell?1:.8);return s;});
}
for(const kind of ['conga','bongo','tabla','talkingDrum','djembe','tom','timbale','frameDrum','cajon','udu','slitDrum'])for(const hit of ['open','muted','slap']){
 const id=`hand${cap(kind)}${cap(hit)}`;
 add(id,`${kind.replace(/([A-Z])/g,' $1').toLowerCase()} · ${hit} hit`,'Drums & percussion','hand',name=>{
  const bend={tabla:.25,talkingDrum:.4}[kind]||.06,life={open:.5,muted:.15,slap:.25}[hit];
  let s=head(name,life,st(['env','be','p1','p2','p3','ce'])+seedState)+'  sample x =>\n'+trig+noise+percEnv();
  s+=`    let beA := select(trigger, gate, be * expneg(1.0 / (0.08 * sr)))\n    set be := beA\n    let ceA := select(trigger, gate * ${hit==='slap'?'0.8':'0.25'}, ce * expneg(1.0 / (0.004 * sr)))\n    set ce := ceA\n    let f := max(24.0, freq) * (1.0 + beA * ${L(bend)})\n`;
  s+=`    set p1 := fract(p1 + min(0.45, f / sr))\n    set p2 := fract(p2 + min(0.45, f * 1.59 / sr))\n    set p3 := fract(p3 + min(0.45, f * 2.14 / sr))\n`;
  s+=fin(`(sinpi(p1 * 2.0) + sinpi(p2 * 2.0) * ${hit==='muted'?'0.15':'0.45'} * (0.5 + colour) + sinpi(p3 * 2.0) * 0.25) * envA + nz * ceA`,.7);return s;});
}
for(const kind of ['clap','snap','rimshot','click','stick','woodClick'])for(const room of ['dry','room']){
 const id=`hit${cap(kind)}${cap(room)}`;
 add(id,`${kind.replace(/([A-Z])/g,' $1').toLowerCase()} · ${room}`,'Drums & percussion','hit',name=>{
  const cf={clap:1200,snap:2500,rimshot:1700,click:4000,stick:3000,woodClick:1500}[kind],bursts=kind==='clap'?3:1;
  let s=head(name,room==='room'?.35:.12,st(['env','tick'])+seedState+svfState('h'))+'  sample x =>\n'+trig+noise+percEnv();
  s+=`    let tickA := select(trigger, 0.0, tick + 1.0 / sr)\n    set tick := tickA\n    let pulses := ${bursts>1?'select(lt(fract(tickA * 90.0), 0.35), 1.0, 0.4) * select(lt(tickA, 0.035), 1.0, 0.6)':'1.0'}\n`;
  s+=svf('h','nz',`(${L(cf)} * (0.7 + colour * 0.6))`,kind==='woodClick'||kind==='stick'?'0.15':'0.6');
  s+=fin(`v1h * envA * pulses`,1.6);return s;});
}

// 13. Noise textures: filtered, slowly moving noise beds.
for(const kind of ['wind','sea','rain','steam','fire','hiss','storm','rumble'])for(const motion of ['still','slow','gusty'])for(const width of ['narrow','wide']){
 const id=`noise${cap(kind)}${cap(motion)}${cap(width)}`;
 add(id,`${kind} · ${motion}, ${width} band`,'Textures','noise',name=>{
  const cf={wind:600,sea:400,rain:5000,steam:7000,fire:1500,hiss:9000,storm:300,rumble:90}[kind],rate={still:0,slow:.13,gusty:.6}[motion];
  let s=head(name,2,st(['env','lfo','crack'])+seedState+svfState('w'))+'  sample x =>\n'+trig+noise+susEnv(.8);
  s+=`    set lfo := fract(lfo + ${L(rate)} / sr)\n    let move := 1.0 + sinpi(lfo * 2.0) * ${motion==='still'?'0.0':'0.45'} + sinpi(lfo * 5.3) * ${motion==='gusty'?'0.25':'0.0'}\n`;
  s+=kind==='fire'?`    let crackA := select(gt(nz, 0.996), 1.0, crack * 0.97)\n    set crack := crackA\n`:'    let crackA := 0.0\n';
  s+=svf('w','nz',`(${L(cf)} * move * (0.6 + colour * 0.8))`,width==='narrow'?'0.25':'1.4');
  s+=fin(`(v1w * ${width==='narrow'?'0.7':'1.0'} + crackA * nz * 0.6) * envA * move`,1.2);return s;});
}

// 14. Chip sounds: duty-cycle pulses, stepped triangles and pitched noise, with optional vibrato and slides.
for(const wave of ['pulse12','pulse25','pulse50','triangle4bit','noiseShort','noiseLong'])for(const env of ['blip','note','swell'])for(const fx of ['plain','vibrato','slideUp','slideDown']){
 const id=`chip${cap(wave)}${cap(env)}${cap(fx)}`;
 add(id,`chip ${wave.replace(/(\d+)/,' $1').replace('bit','-bit')} · ${env}${fx==='plain'?'':', '+fx.replace(/([A-Z])/g,' $1').toLowerCase()}`,'Chip','chip',name=>{
  let s=head(name,{blip:.15,note:.8,swell:1.5}[env],st(['env','ph','vib','sl','held'])+seedState)+'  sample x =>\n'+trig+(env==='swell'?susEnv(.25):env==='blip'?percEnv():susEnv(.002));
  s+=`    let slA := select(trigger, 1.0, sl * expneg(1.0 / (0.08 * sr)))\n    set sl := slA\n    set vib := fract(vib + 6.0 / sr)\n`;
  s+=`    let bend := ${fx==='slideUp'?'1.0 - slA * 0.5':fx==='slideDown'?'1.0 + slA * 1.0':'1.0'} + sinpi(vib * 2.0) * ${fx==='vibrato'?'0.012':'0.0'}\n    set ph := fract(ph + min(0.45, max(24.0, freq) * bend / sr))\n`;
  if(wave.startsWith('pulse'))s+=`    let w := select(lt(ph, ${L(Number(wave.slice(5))/100)} + colour * 0.1), 1.0, (0.0 - 1.0))\n`;
  else if(wave.startsWith('tri'))s+=`    let w := quant(1.0 - abs(ph * 4.0 - 2.0), 8.0)\n`;
  else s+=`    let heldA := select(lt(ph, ${L(wave==='noiseShort'?.07:.5)}), noise1(noise1(counter) * 437.5453 + counter * 0.6180339), held)\n    set held := heldA\n    set counter := select(gt(counter, 1000000.0), 1.0, counter + 1.0)\n    let w := heldA\n`;
  s+=fin('w * envA * 0.5',1);return s;});
}

// 15. Beating drones and pairs: two or three close tones whose interference is the movement.
for(const spread of [.3,1,2.5,6])for(const voices of [2,3])for(const wave of ['sine','soft','reed'])for(const oct of ['unison','octave']){
 const id=`beat${String(spread).replace('.','p')}${voices}${cap(wave)}${cap(oct)}`;
 add(id,`beating drone · ${voices} tones ${spread} Hz apart, ${wave}${oct==='octave'?', with octave':''}`,'Drones','beat',name=>{
  const ph=[...Array(voices).keys()].map(i=>`b${i}`);
  let s=head(name,3,st([...ph,'env','o']))+'  sample x =>\n'+trig+susEnv(.8);
  const sh=p=>wave==='sine'?`sinpi(${p} * 2.0)`:wave==='soft'?`softsign(sinpi(${p} * 2.0) * (1.0 + colour * 3.0))`:`fold(sinpi(${p} * 2.0) * (1.0 + colour * 2.0))`;
  ph.forEach((p,i)=>{s+=`    set ${p} := fract(${p} + min(0.45, (max(24.0, freq) + ${L((i-(voices-1)/2)*spread)}) / sr))\n`;});
  s+=`    set o := fract(o + min(0.45, max(24.0, freq) * 2.0 / sr))\n`;
  s+=fin(`(${ph.map(sh).join(' + ')}${oct==='octave'?' + sinpi(o * 2.0) * 0.4':''}) * ${L(1/voices)} * envA`,.9);return s;});
}

// 16. Ring modulation: a carrier multiplied by a modulator at a ratio or a fixed frequency.
for(const [mode,val] of [['ratio',1.5],['ratio',2.01],['ratio',3.7],['ratio',.51],['ratio',7.3],['fixed',30],['fixed',110],['fixed',440],['fixed',1300]])for(const env of ['strike','held','swell'])for(const src of ['sine','tri']){
 const id=`ring${cap(mode)}${String(val).replace('.','p')}${cap(env)}${cap(src)}`;
 add(id,`ring modulator · ${mode==='ratio'?val+'× carrier':val+' Hz'}, ${env}, ${src}`,'Ring & metallic','ring',name=>{
  let s=head(name,{strike:1.2,held:1.5,swell:2.5}[env],st(['env','pc','pm']))+'  sample x =>\n'+trig+(env==='strike'?percEnv():susEnv(env==='swell'?.5:.01));
  s+=`    set pc := fract(pc + min(0.45, max(24.0, freq) / sr))\n    set pm := fract(pm + min(0.45, ${mode==='ratio'?`max(24.0, freq) * ${L(val)}`:L(val)} / sr))\n`;
  const sh=p=>src==='sine'?`sinpi(${p} * 2.0)`:`(1.0 - abs(${p} * 4.0 - 2.0))`;
  s+=fin(`${sh('pc')} * (1.0 - colour * 0.8 + colour * 0.8 * ${sh('pm')}) * envA`,.9);return s;});
}

// 17. Karplus-Strong drums (Strong 1983): a noise-filled loop whose sign flips at random, blended by b.
for(const b of [.1,.3,.5,.7,.9])for(const tone of ['dark','bright'])for(const tail of ['tight','long']){
 const id=`ksDrum${String(b).replace('.','p')}${cap(tone)}${cap(tail)}`;
 add(id,`Karplus-Strong drum · blend ${b}, ${tone}, ${tail}`,'Drums & percussion','ksdrum',name=>{
  let s=head(name,tail==='tight'?.3:1,st(['burst','lp'])+dcState+seedState+'  buffer loop : F32[4096]\n')+'  sample x =>\n'+trig+noise;
  s+=`    let burstA := select(trigger, gate, burst * 0.9)\n    set burst := burstA\n    let length := min(4093.0, sr / max(24.0, freq) - 0.5)\n    let a := taplin(loop, length)\n    let b := taplin(loop, length + 1.0)\n`;
  s+=`    let avg := (a + b) * 0.5\n    let flip := select(lt(nz, ${L(b)}), 1.0, (0.0 - 1.0))\n    let fb := min(0.9995, expneg(5.0 / (max(24.0, freq) * life)))\n`;
  s+=`    push loop := clip(avg * flip * fb + nz * burstA, -1.5, 1.5)\n    let lpA := lp + ${tone==='dark'?'0.3':'0.8'} * (avg - lp) * (0.6 + colour * 0.4)\n    set lp := lpA\n`+dcFin('lpA',1.2);return s;});
}

// 18. Sample-and-hold note generators: one held note hops through a scale at its own rate.
const SH_SCALES={pentatonic:[0,3,5,7,10],major:[0,2,4,7,9],whole:[0,2,4,6,8,10],minor:[0,2,3,7,8],octaves:[0,12],fifths:[0,7]};
for(const [sc,steps] of Object.entries(SH_SCALES))for(const rate of [4,8,13])for(const wave of ['sine','pluck']){
 const id=`hop${cap(sc)}${rate}${cap(wave)}`;
 add(id,`note hopper · ${sc} steps, ${rate} hops per second, ${wave}`,'Generative','hop',name=>{
  let s=head(name,1.5,st(['env','ph','clk','step','pe'])+seedState)+'  sample x =>\n'+trig+noise+susEnv(.01);
  s+=`    let clkA := fract(clk + ${L(rate)} * (0.5 + colour) / sr)\n    let tick := lt(clkA, clk)\n    set clk := clkA\n`;
  s+=`    let stepA := select(tick, (nz * ${L(steps.length)} * 0.999 - fract(nz * ${L(steps.length)} * 0.999)), step)\n    set step := stepA\n`;
  // map step index to semitones with nested selects
  let sel=L(steps[steps.length-1]);for(let i=steps.length-2;i>=0;i--)sel=`select(lt(stepA, ${L(i+.5)}), ${L(steps[i])}, ${sel})`;
  s+=`    let semis := ${sel}\n    let ratio := expneg(semis * (0.0 - 0.05776227))\n    set ph := fract(ph + min(0.45, max(24.0, freq) * ratio / sr))\n`;
  s+=`    let peA := select(tick, 1.0, pe * expneg(5.0 / (${wave==='pluck'?L(.6/rate):L(2/rate)} * sr)))\n    set pe := peA\n`;
  s+=fin(`sinpi(ph * 2.0) * envA * ${wave==='pluck'?'peA':'(0.6 + peA * 0.4)'}`,.8);return s;});
}

// 19. Comb resonators: noise driving a tuned feedback comb, so the noise takes the note's pitch. The
// feedback drops a little when the note is released, so even the longest combs end.
for(const fb of [.9,.97,.995])for(const src of ['hiss','crackle','rumble'])for(const env of ['held','swell','strike']){
 const id=`comb${String(fb).replace('.','p')}${cap(src)}${cap(env)}`;
 add(id,`comb resonator · feedback ${fb}, ${src}, ${env}`,'Resonators','comb',name=>{
  let s=head(name,env==='strike'?1:2,st(['env','lp','crack'])+dcState+seedState+'  buffer comb : F32[4096]\n')+'  sample x =>\n'+trig+noise+(env==='strike'?percEnv():susEnv(env==='swell'?.6:.02));
  s+=src==='crackle'?`    let crackA := select(gt(nz, 0.97), nz, crack * 0.6)\n    set crack := crackA\n    let exc := crackA\n`:src==='rumble'?`    let crackA := crack + 0.02 * (nz - crack)\n    set crack := crackA\n    let exc := crackA * 4.0\n`:'    let exc := nz\n';
  s+=`    let length := min(4093.0, sr / max(24.0, freq) - 0.5)\n    let a := taplin(comb, length)\n    let lpA := lp + (0.3 + colour * 0.6) * (a - lp)\n    set lp := lpA\n    push comb := clip(exc * envA * 0.3 + lpA * ${L(fb)} * select(gt(gate, 0.001), 1.0, 0.97), -1.5, 1.5)\n`;
  s+=dcFin('lpA',1);return s;});
}

// 20. Seeded inharmonic bells: partial ratios drawn from a fixed pseudo-random sequence per seed.
const rngSeq=seed=>{let x=seed*9301+49297;return()=>{x=(x*9301+49297)%233280;return x/233280;};};
for(let seed=1;seed<=60;seed++){
 const r=rngSeq(seed),n=3+Math.floor(r()*3),ratios=[1,...Array(n-1).fill(0).map(()=>Math.round((1.2+r()*7)*1000)/1000)].sort((a,b)=>a-b),life=.8+r()*5;
 const id=`bell${String(seed).padStart(2,'0')}`;
 add(id,`seeded bell ${seed} · partials ${ratios.join(', ')}`,'Mallets & bells','seedbell',name=>{
  const ph=ratios.map((_,i)=>`p${i}`),ev=ratios.map((_,i)=>`e${i}`);
  let s=head(name,life,st([...ph,...ev]))+'  sample x =>\n'+trig;
  ratios.forEach((q,i)=>{s+=`    let e${i}A := select(trigger, gate * ${L(1/(1+i*.5))} * (1.0 + colour * ${L(i*.3)}), e${i} * expneg(5.0 / (life * ${L(1/(1+i*.4))} * sr)))\n    set e${i} := e${i}A\n    set p${i} := fract(p${i} + min(0.45, freq * ${L(q)} / sr))\n`;});
  s+=fin(ratios.map((_,i)=>`sinpi(p${i} * 2.0) * e${i}A`).join(' + '),.5/Math.sqrt(ratios.length));return s;});
}

export const families=out;
