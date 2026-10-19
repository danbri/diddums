// Adaptive music demo: a small stealth/collect game whose live state drives an endless Diddums score.
// Arrangement changes land on the next bar line; game events answer within a 16th note, in key.
import {startAdaptive} from './adaptive.js';
import {compositionFromSong} from './song.js';

const $=s=>document.querySelector(s);
const song={title:'Adaptive night',bpm:100,meter:'4/4',key:'A minor',rhythm:'none',seconds:600,room:.6,chords:[1,6,3,7],
 melody:[12,null,15,null,19,null,17,15,12,null,10,null,7,null,10,null],
 bass:[0,null,0,null,7,null,0,3,0,null,0,null,10,null,7,null],
 tracks:[
  {id:'drone',sound:'voidDrone',label:'Low drone'},{id:'wind',sound:'wind',label:'Wind',level:.2},{id:'koto',sound:'koto',label:'Sparse plucks'},
  {id:'sub',sound:'subBass',label:'Sub bass'},{id:'pad',sound:'nebulaPad',label:'Pad'},{id:'bells',sound:'bells',label:'Bell melody'},
  {id:'acid',sound:'acidLine',label:'Acid bass'},{id:'stabs',sound:'brassStabs',label:'Brass stabs'},{id:'arp',sound:'arpeggiator',label:'Arpeggio'},
  {id:'saw',sound:'chromeLead',label:'Saw lead'},{id:'heart',sound:'heartbeat',label:'Heartbeat',level:1},
  // Event voices: never in the arrangement, only played by music.hit().
  {id:'chime',sound:'celesta',label:'Pickup chime',level:.55,role:'timeline',seq:'.'},{id:'alarm',sound:'sonarBlup',label:'Alarm',level:.5,role:'timeline',seq:'.'},
  {id:'boom',sound:'timpani',label:'Impact',level:.9,role:'timeline',seq:'.'},{id:'zap',sound:'sputnikBeacon',label:'Zap',level:.45,role:'timeline',seq:'.'}]};
const composition=compositionFromSong(song);
const harmonyOf=chords=>compositionFromSong({...song,chords}).harmony;
const H={calm:harmonyOf([1,6,3,7]),chase:harmonyOf([1,7,6,7]),hero:harmonyOf([1,6,7,1]),dread:harmonyOf([1,2,1,7])};
const KEY_SHIFT=[0,3,-2,5,1,-4],KEY_NAME=['A minor','C minor','G minor','D minor','B♭ minor','F minor'];
const shift=(h,s)=>h.map(c=>[c[0]+s,...c.slice(1)]);
const M={
 calm:[12,null,15,null,19,null,17,15,12,null,10,null,7,null,10,null],
 chase:[12,15,19,15,12,15,19,22,24,22,19,15,17,15,12,10],
 hero:[12,null,19,null,24,null,22,19,24,null,26,24,19,null,22,null],
 dread:[12,null,null,13,12,null,null,null,10,null,null,7,null,null,8,null]};
const B={calm:[0,null,0,null,7,null,0,3,0,null,0,null,10,null,7,null],drive:[0,0,12,0,0,0,10,0,0,0,12,0,7,0,10,0],dread:[0,null,null,null,1,null,null,null,0,null,null,null,null,null,1,null]};
const LABEL=Object.fromEntries(song.tracks.map(t=>[t.id,t.label]));
const MUSIC_TRACKS=song.tracks.filter(t=>!['chime','alarm','boom','zap'].includes(t.id)).map(t=>t.id);

// Game state → arrangement. Continuous inputs (threat, health) cross thresholds track by track, so the
// music moves through many intermediate states rather than switching between a few.
function plan({threat=0,health=1,power=false,level=0}){
 const q=x=>Math.round(x*10)/10,T=q(threat),Hh=Math.round(health*4)/4,low=Hh<=.25,hurt=Hh<=.5;
 const L=new Set(['wind','heart']);
 if(T<.3&&!power)L.add('drone');if(T<.4&&!power)L.add('koto');
 if(!low)L.add('pad');else L.add('drone');
 if(T>=.2&&T<.6)L.add('sub');if(T>=.6||power)L.add('acid');
 if(T<.5&&!hurt&&!power)L.add('bells');
 if(T>=.4)L.add('arp');
 if((T>=.7&&!hurt)||power)L.add('stabs');
 if(power||(T>=.6&&!hurt))L.add('saw');
 const mood=power?'hero':low&&T>=.3?'dread':T>=.5?'chase':'calm';
 const rhythm=power?'house':low&&T>=.3?'halftime':T<.15?'none':T<.35?'ritual':T<.55?'broken':T<.75?'postpunk':'factory';
 return {name:power?'Power':mood==='dread'?'Desperate':T>=.5?'Hunted':T>=.2?'Watched':'Unseen',rhythm,
  energy:q(Math.min(1,.25+.7*T+(power?.15:0))*(low?.8:1)),harmony:shift(H[mood],KEY_SHIFT[level%KEY_SHIFT.length]),melody:M[mood],
  bass:mood==='dread'?B.dread:T>=.5||power?B.drive:B.calm,layers:[...L]};
}

// ---- Game ----
const W=1,Hgt=.75,cv=$('#arena'),g=cv.getContext('2d');
const rnd=(a,b)=>a+Math.random()*(b-a),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
let lastLevels={},game,music=null,lastPlan=null,keys={},target=null,last=performance.now();
function newLevel(level,keepScore=0,health=1){
 const n=6+level*2;
 game={level,score:keepScore,health,power:0,combo:0,comboAt:0,invuln:0,over:0,player:{x:.5,y:Hgt-.06},
  orbs:Array.from({length:n},()=>({x:rnd(.06,.94),y:rnd(.06,Hgt-.15)})),powerOrb:{x:rnd(.1,.9),y:rnd(.1,Hgt-.2)},
  enemies:Array.from({length:2+level},()=>spawnEnemy()),flash:[]};
}
function spawnEnemy(){const e={x:rnd(.05,.95),y:rnd(.05,.3),a:rnd(0,6.28),alert:0,dead:0};return e;}
function threat(){
 const p=game.player;let t=0,near=9;
 for(const e of game.enemies){if(e.dead)continue;if(e.alert>0)t+=.25;near=Math.min(near,dist(p,e));}
 return Math.min(1,t+Math.max(0,(.3-near)/.3)*.35);
}
function say(text){const l=$('#log');l.innerHTML=(text+'\n'+l.innerHTML).split('\n').slice(0,40).join('\n');}
const hit=(track,opts)=>music?.hit(track,opts);

function step(dt){
 const p=game.player;
 if(game.over>0){game.over-=dt;if(game.over<=0){newLevel(0);say('<b>New game</b>');}return;}
 // Movement: keyboard, finger/mouse target, or autopilot.
 let vx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),vy=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);
 if($('#auto').checked){const a=autopilot();vx=a.x;vy=a.y;}
 else if(target&&!vx&&!vy){vx=target.x-p.x;vy=target.y-p.y;if(Math.hypot(vx,vy)<.01)vx=vy=0;}
 const m=Math.hypot(vx,vy)||1,sp=.32;p.x=Math.max(.02,Math.min(W-.02,p.x+vx/m*sp*dt*(vx||vy?1:0)));p.y=Math.max(.02,Math.min(Hgt-.02,p.y+vy/m*sp*dt*(vx||vy?1:0)));
 game.power=Math.max(0,game.power-dt);game.invuln=Math.max(0,game.invuln-dt);
 if(game.power>0&&game.power<dt*1.01)hit('zap',{tones:[2,1,0],spread:2,velocity:.6});
 // Orbs: each pickup is the next chord tone up; quick pickups climb an arpeggio.
 for(const o of [...game.orbs])if(dist(p,o)<.035){game.orbs.splice(game.orbs.indexOf(o),1);game.combo=performance.now()-game.comboAt<1800?game.combo+1:0;game.comboAt=performance.now();game.score+=10*(1+game.combo);
  hit('chime',{tones:[game.combo%8],octave:1,velocity:.7+.04*Math.min(6,game.combo)});game.flash.push({x:o.x,y:o.y,t:.4,c:'#7ce3dd'});}
 if(game.powerOrb&&dist(p,game.powerOrb)<.04){game.powerOrb=null;game.power=7;hit('chime',{tones:[0,1,2,4],octave:1,spread:1});hit('boom',{tones:[0],octave:-1});say('<b>Power</b>: the patrols can be knocked out for 7 s');}
 // Enemies: patrol, notice you inside their sight radius, chase, give up after a while.
 for(const e of game.enemies){
  if(e.dead){e.dead-=dt;if(e.dead<=0){Object.assign(e,spawnEnemy());}continue;}
  const d=dist(p,e),sight=.18+.02*game.level;
  if(d<sight&&game.power<=0){if(e.alert<=0){hit('alarm',{tones:[0],octave:1,grid:2,velocity:.7});game.flash.push({x:e.x,y:e.y,t:.5,c:'#edbc74'});}e.alert=2.2;}else e.alert=Math.max(0,e.alert-dt);
  let ax,ay,spd;
  if(game.power>0){ax=e.x-p.x;ay=e.y-p.y;spd=.16;}else if(e.alert>0){ax=p.x-e.x;ay=p.y-e.y;spd=.16+.012*game.level;}else{e.a+=rnd(-2,2)*dt;ax=Math.cos(e.a);ay=Math.sin(e.a);spd=.07;}
  const am=Math.hypot(ax,ay)||1;e.x+=ax/am*spd*dt;e.y+=ay/am*spd*dt;
  if(e.x<.03||e.x>W-.03)e.a=Math.PI-e.a;if(e.y<.03||e.y>Hgt-.03)e.a=-e.a;e.x=Math.max(.03,Math.min(W-.03,e.x));e.y=Math.max(.03,Math.min(Hgt-.03,e.y));
  if(d<.04){
   if(game.power>0){e.dead=6;e.alert=0;game.score+=50;hit('zap',{tones:[2,4],spread:1,velocity:.8});game.flash.push({x:e.x,y:e.y,t:.5,c:'#ba96f0'});}
   else if(game.invuln<=0){game.health=Math.max(0,game.health-.15);game.invuln=1.5;hit('boom',{tones:[0],octave:-1,velocity:1});const k=Math.hypot(p.x-e.x,p.y-e.y)||1;p.x+=(p.x-e.x)/k*.06;p.y+=(p.y-e.y)/k*.06;game.flash.push({x:p.x,y:p.y,t:.5,c:'#ff7a7a'});
    if(game.health<=0){game.over=4;hit('boom',{tones:[0,-1,-2,-4],octave:-1,spread:3,velocity:1});hit('chime',{tones:[3,2,1,0],spread:3,velocity:.6});say(`<b>Caught</b> on level ${game.level+1} with ${game.score} points`);}}
  }
 }
 if(!game.enemies.some(e=>e.alert>0&&!e.dead))game.health=Math.min(1,game.health+dt*.05);
 if(!game.orbs.length){hit('chime',{tones:[0,1,2,4,5,6],octave:1,spread:1,velocity:.85});hit('boom',{tones:[0,0],octave:-1,spread:4});say(`<b>Level ${game.level+2}</b>: key change to ${KEY_NAME[(game.level+1)%KEY_NAME.length]}, more patrols`);newLevel(game.level+1,game.score,game.health);}
 for(const f of game.flash)f.t-=dt;game.flash=game.flash.filter(f=>f.t>0);
}
// Autopilot: head for the nearest orb (or the power orb when chased), steering away from hunters.
function autopilot(){
 const p=game.player,hunters=game.enemies.filter(e=>!e.dead&&(e.alert>0||dist(p,e)<.15));
 const goal=game.power>0?game.enemies.filter(e=>!e.dead).sort((a,b)=>dist(p,a)-dist(p,b))[0]:(hunters.length&&game.powerOrb)?game.powerOrb:game.orbs.slice().sort((a,b)=>dist(p,a)-dist(p,b))[0];
 if(!goal)return {x:0,y:0};let x=goal.x-p.x,y=goal.y-p.y;const m=Math.hypot(x,y)||1;x/=m;y/=m;
 if(game.power<=0)for(const e of hunters){const d=dist(p,e)||1,w=.12/(d*d);x+=(p.x-e.x)/d*w;y+=(p.y-e.y)/d*w;}
 return {x,y};
}

function draw(){
 const dpr=Math.min(2,devicePixelRatio||1),r=cv.getBoundingClientRect(),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(cv.width!==w)cv.width=w;if(cv.height!==h)cv.height=h;
 const S=w/W,X=v=>v*S,t=performance.now()/1000,th=threat();
 g.fillStyle=game.power>0?'#1f1838':`rgb(${10+40*th},${22-8*th},${34-14*th})`;g.fillRect(0,0,w,h);
 g.strokeStyle='#ffffff0d';for(let i=1;i<10;i++){g.beginPath();g.moveTo(i*w/10,0);g.lineTo(i*w/10,h);g.stroke();}for(let i=1;i<8;i++){g.beginPath();g.moveTo(0,i*h/8);g.lineTo(w,i*h/8);g.stroke();}
 for(const o of game.orbs){g.fillStyle='#7ce3dd';g.globalAlpha=.6+.4*Math.sin(t*4+o.x*20);g.beginPath();g.arc(X(o.x),X(o.y),X(.012),0,6.28);g.fill();}g.globalAlpha=1;
 if(game.powerOrb){g.fillStyle='#edbc74';g.beginPath();g.arc(X(game.powerOrb.x),X(game.powerOrb.y),X(.02+.004*Math.sin(t*6)),0,6.28);g.fill();}
 for(const e of game.enemies){if(e.dead)continue;const sight=.18+.02*game.level;
  g.fillStyle=e.alert>0?'#ff7a7a12':'#edbc740c';g.beginPath();g.arc(X(e.x),X(e.y),X(sight),0,6.28);g.fill();
  g.fillStyle=game.power>0?'#8a7ab8':e.alert>0?'#ff7a7a':'#edbc74';g.beginPath();g.arc(X(e.x),X(e.y),X(.022),0,6.28);g.fill();}
 for(const f of game.flash){g.strokeStyle=f.c;g.globalAlpha=f.t*2;g.lineWidth=3*dpr;g.beginPath();g.arc(X(f.x),X(f.y),X(.03+(.5-f.t)*.15),0,6.28);g.stroke();}g.globalAlpha=1;
 const p=game.player,beat=music?1+.18*Math.max(0,Math.cos(t*Math.PI*2*100/60)):1;
 g.fillStyle=game.invuln>0&&Math.floor(t*12)%2?'#ffffff55':game.power>0?'#f6e27a':'#7ce3dd';g.beginPath();g.arc(X(p.x),X(p.y),X(.024)*beat,0,6.28);g.fill();
 g.fillStyle='#e5f0f5';g.font=`${13*dpr}px ui-monospace,monospace`;g.fillText(`LEVEL ${game.level+1}   ${game.score} pts   ${game.orbs.length} orbs left`,10*dpr,20*dpr);
 g.fillStyle='#ffffff22';g.fillRect(10*dpr,28*dpr,w*.3,7*dpr);g.fillStyle=game.health<.3?'#ff7a7a':'#91dfd4';g.fillRect(10*dpr,28*dpr,w*.3*game.health,7*dpr);
 if(game.power>0){g.fillStyle='#f6e27a';g.fillRect(10*dpr,38*dpr,w*.3*game.power/7,4*dpr);}
 if(game.over>0){g.fillStyle='#000a';g.fillRect(0,0,w,h);g.fillStyle='#ffd0d0';g.font=`${28*dpr}px system-ui,sans-serif`;g.textAlign='center';g.fillText('Caught',w/2,h/2);g.textAlign='left';}
}

const sent={};function ctl(id,key,v){const k=id+key;if(Math.abs((sent[k]??-9)-v)<.02)return;sent[k]=v;music.control(id,key,v);}
function frame(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;
 step(dt);draw();
 if(music){const s={threat:threat(),health:game.health,power:game.power>0,level:game.level};music.set(s);
  ctl('heart','level',game.health<.6?Math.min(1.3,(.6-game.health)/.6*1.5):0);
  ctl('energy','level',.8+.6*s.threat);
  $('#meters').innerHTML=`Threat <b>${Math.round(s.threat*100)}%</b> · Health <b>${Math.round(game.health*100)}%</b>${s.power?' · <b>Power</b>':''} · Key <b>${KEY_NAME[game.level%KEY_NAME.length]}</b>`;}
 requestAnimationFrame(frame);
}
function renderLayers(p){
 const on=new Set(p.layers);
 $('#layers').innerHTML=MUSIC_TRACKS.map(id=>`<span data-id="${id}" class="${on.has(id)&&(id!=='heart'||game.health<.6)?'on':''}">${LABEL[id]}<i></i></span>`).join('')+`<span data-id="drums" class="${p.rhythm!=='none'?'on':''}">Drums · ${p.rhythm}<i></i></span>`;
}

$('#start').onclick=async()=>{
 const b=$('#start');
 if(music){if(!b.dataset.paused){music.pause();b.dataset.paused='1';b.textContent='▶ Resume music';}else{music.resume();delete b.dataset.paused;b.textContent='❚❚ Pause music';}return;}
 b.disabled=true;b.textContent='Loading instruments…';
 try{
  music=await startAdaptive({composition,plan,state:{threat:0,health:1,power:false,level:0},
   onBar:(bar,p)=>{$('#status').innerHTML=`Bar <b>${bar+1}</b> · <b>${p.name}</b> · energy ${p.energy} · drums ${p.rhythm}`;if(JSON.stringify(p)!==JSON.stringify(lastPlan)){lastPlan=p;renderLayers(p);say(`bar ${bar+1}: <b>${p.name}</b> → ${p.layers.filter(l=>l!=='heart'&&l!=='wind').map(l=>LABEL[l]).join(', ')}${p.rhythm!=='none'?', '+p.rhythm+' drums':''}`);}},
   onLevels:m=>{lastLevels=m;for(const s of document.querySelectorAll('#layers span')){const v=m[s.dataset.id]?.rms||0,w=v>0?Math.max(0,Math.min(1,(20*Math.log10(v)+60)/60)):0;s.querySelector('i').style.width=(w*100).toFixed(0)+'%';s.classList.toggle('on',w>.05||(lastPlan?.layers.includes(s.dataset.id)&&s.dataset.id!=='heart')||(s.dataset.id==='drums'&&lastPlan?.rhythm!=='none'));}}});
  b.textContent='❚❚ Pause music';
 }catch(e){b.textContent='Could not start: '+e.message;console.error(e);}finally{b.disabled=false;}
};
addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')||'wasd'.includes(e.key)){keys[e.key]=true;$('#auto').checked=false;if(e.key.startsWith('Arrow'))e.preventDefault();}});
addEventListener('keyup',e=>{keys[e.key]=false;});
const toField=e=>{const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*Hgt};};
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);$('#auto').checked=false;target=toField(e);});
cv.addEventListener('pointermove',e=>{if(e.buttons)target=toField(e);});
cv.addEventListener('pointerup',()=>{target=null;});
newLevel(0);requestAnimationFrame(frame);
window.adaptiveDemo={get levels(){return lastLevels;},get game(){return game;},get music(){return music;},plan};
