// Adaptive music demo: a tiny top-down game whose state drives an endless Diddums score.
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
  {id:'saw',sound:'chromeLead',label:'Saw lead'},{id:'heart',sound:'heartbeat',label:'Heartbeat',level:1}]};
const composition=compositionFromSong(song);
const fightHarmony=compositionFromSong({...song,chords:[1,7,6,7]}).harmony;
const LABEL=Object.fromEntries(song.tracks.map(t=>[t.id,t.label]));

// Game state → arrangement. Everything here is a plain musical decision a composer could tune.
function plan({mode='explore',enemies=0}){
 const e=enemies,r=x=>Math.round(x*100)/100;
 if(mode==='sneak')return {name:'Sneak',rhythm:e>=5?'ritual':'none',energy:r(.2+.03*e),layers:['drone','wind','koto',...(e>=3?['sub']:[]),...(e>=6?['pad']:[]),'heart']};
 if(mode==='fight')return {name:'Fight',rhythm:e>=6?'factory':'postpunk',energy:r(Math.min(1,.62+.035*e)),harmony:fightHarmony,layers:['acid','stabs','arp','saw','pad','heart']};
 return {name:'Explore',rhythm:e>=2?'broken':'none',energy:r(.4+.035*e),layers:['pad','wind','bells','sub',...(e>=4?['arp']:[]),'heart']};
}

const state={mode:'explore',enemies:2,health:100};
let music=null,lastPlan=null;
const logLine=html=>{const l=$('#log');l.innerHTML=(html+'\n'+l.innerHTML).split('\n').slice(0,40).join('\n');};
function setUI(){
 for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',b.dataset.mode===state.mode);
 $('#enemies').value=state.enemies;$('#enemiesOut').textContent=state.enemies;$('#health').value=Math.round(state.health);$('#healthOut').textContent=Math.round(state.health);
}
function apply(){
 setUI();if(!music)return;
 music.set({mode:state.mode,enemies:state.enemies});
 // Mix changes act immediately: the heartbeat rises as health falls, and everything brightens in a fight.
 music.control('heart','level',state.health<60?Math.min(1.3,(60-state.health)/60*1.4):0);
 music.control('energy','level',state.mode==='fight'?1.3:state.mode==='sneak'?.75:1);
}
function renderLayers(p){
 const on=new Set(p.layers);
 $('#layers').innerHTML=song.tracks.map(t=>`<span data-id="${t.id}" class="${on.has(t.id)&&(t.id!=='heart'||state.health<60)?'on':''}">${LABEL[t.id]}<i></i></span>`).join('')+`<span data-id="drums" class="${p.rhythm!=='none'?'on':''}">Drums · ${p.rhythm}<i></i></span>`;
}

$('#start').onclick=async()=>{
 const b=$('#start');
 if(music){if(music.ctx.state==='running'&&!b.dataset.paused){music.pause();b.dataset.paused='1';b.textContent='▶ Resume music';}else{music.resume();delete b.dataset.paused;b.textContent='❚❚ Pause music';}return;}
 b.disabled=true;b.textContent='Loading instruments…';
 try{
  music=await startAdaptive({composition,plan,state:{mode:state.mode,enemies:state.enemies},
   onBar:(bar,p)=>{const changed=JSON.stringify(p)!==JSON.stringify(lastPlan);$('#status').innerHTML=`Bar <b>${bar+1}</b> · <b>${p.name}</b> · energy ${p.energy} · drums ${p.rhythm}`;if(changed){lastPlan=p;renderLayers(p);logLine(`bar ${bar+1}: <b>${p.name}</b>, ${state.enemies} enemies, energy ${p.energy} → ${p.layers.filter(l=>l!=='heart').map(l=>LABEL[l]).join(', ')}${p.rhythm!=='none'?', '+p.rhythm+' drums':''}`);}},
   onLevels:m=>{for(const s of document.querySelectorAll('#layers span')){const v=m[s.dataset.id]?.rms||0,w=v>0?Math.max(0,Math.min(1,(20*Math.log10(v)+60)/60)):0;s.querySelector('i').style.width=(w*100).toFixed(0)+'%';}}});
  apply();b.textContent='❚❚ Pause music';
 }catch(e){b.textContent='Could not start: '+e.message;console.error(e);}finally{b.disabled=false;}
};
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{$('#auto').checked=false;state.mode=b.dataset.mode;apply();};
$('#enemies').oninput=()=>{$('#auto').checked=false;state.enemies=+$('#enemies').value;apply();};
let healthHeld=false;$('#health').oninput=()=>{$('#auto').checked=false;healthHeld=true;state.health=+$('#health').value;apply();};$('#health').onchange=()=>{healthHeld=false;};

// ---- The little game ----
const cv=$('#arena'),g=cv.getContext('2d'),player={x:.5,y:.8},enemies=[];let target=null,t0=performance.now(),scriptT=0;
const rnd=(a,b)=>a+Math.random()*(b-a);
function syncEnemies(){while(enemies.length<state.enemies)enemies.push({x:rnd(.05,.95),y:rnd(.05,.4),vx:rnd(-1,1),vy:rnd(-1,1),seen:0});enemies.length=state.enemies;}
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);$('#auto').checked=false;move(e);});
cv.addEventListener('pointermove',e=>{if(e.buttons)move(e);});
function move(e){const r=cv.getBoundingClientRect();target={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
// Autopilot: explore, get spotted while sneaking, a fight that hurts, victory, recovery. Roughly a minute per loop.
const SCRIPT=[[0,'explore',2],[10,'explore',4],[18,'sneak',3],[26,'sneak',6],[34,'fight',7],[44,'fight',10],[54,'fight',4],[60,'explore',1],[68,'explore',0]];
function autopilot(dt){
 scriptT=(scriptT+dt)%76;let step=SCRIPT[0];for(const s of SCRIPT)if(scriptT>=s[0])step=s;
 const [,mode,n]=step;if(mode!==state.mode||n!==state.enemies){state.mode=mode;state.enemies=n;apply();}
 const a=performance.now()/1600;target={x:.5+.3*Math.cos(a),y:.62+.22*Math.sin(a*1.3)};
}
function frame(now){
 const dt=Math.min(.1,(now-t0)/1000);t0=now;
 if($('#auto').checked)autopilot(dt);
 syncEnemies();
 if(target){player.x+=(target.x-player.x)*Math.min(1,dt*3);player.y+=(target.y-player.y)*Math.min(1,dt*3);}
 let hurt=false;
 for(const e of enemies){
  const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1;
  const chase=state.mode==='fight'||(state.mode==='explore'&&d<.25);
  if(chase){e.vx+=dx/d*dt*1.6;e.vy+=dy/d*dt*1.6;}else{e.vx+=rnd(-1,1)*dt;e.vy+=rnd(-1,1)*dt;}
  const sp=Math.hypot(e.vx,e.vy),max=chase?.28:.12;if(sp>max){e.vx*=max/sp;e.vy*=max/sp;}
  e.x+=e.vx*dt;e.y+=e.vy*dt;if(e.x<.03||e.x>.97)e.vx*=-1;if(e.y<.03||e.y>.97)e.vy*=-1;e.x=Math.max(.03,Math.min(.97,e.x));e.y=Math.max(.03,Math.min(.97,e.y));
  if(state.mode==='fight'&&d<.06)hurt=true;
 }
 if(hurt){state.health=Math.max(0,state.health-dt*14);apply();}
 else if(state.mode!=='fight'&&state.health<100&&!healthHeld){state.health=Math.min(100,state.health+dt*5);apply();}
 draw();requestAnimationFrame(frame);
}
function draw(){
 const dpr=Math.min(2,devicePixelRatio||1),r=cv.getBoundingClientRect(),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(cv.width!==w)cv.width=w;if(cv.height!==h)cv.height=h;
 g.clearRect(0,0,w,h);
 const tint=state.mode==='fight'?'#3a1a22':state.mode==='sneak'?'#0b1a2a':'#0d2030';g.fillStyle=tint;g.fillRect(0,0,w,h);
 g.strokeStyle='#ffffff10';for(let i=1;i<8;i++){g.beginPath();g.moveTo(i*w/8,0);g.lineTo(i*w/8,h);g.stroke();g.beginPath();g.moveTo(0,i*h/8);g.lineTo(w,i*h/8);g.stroke();}
 const R=Math.min(w,h);
 if(state.mode==='sneak'){g.fillStyle='#7ce3dd14';g.beginPath();g.arc(player.x*w,player.y*h,R*.25,0,Math.PI*2);g.fill();}
 for(const e of enemies){g.fillStyle=state.mode==='fight'?'#ff7a7a':'#edbc74';g.beginPath();g.arc(e.x*w,e.y*h,R*.022,0,Math.PI*2);g.fill();}
 const pulse=music?1+.15*Math.sin(performance.now()/1000*Math.PI*2*(100/60)):1;
 g.fillStyle='#7ce3dd';g.beginPath();g.arc(player.x*w,player.y*h,R*.03*pulse,0,Math.PI*2);g.fill();
 g.fillStyle='#ffffff22';g.fillRect(12*dpr,12*dpr,w*.3,8*dpr);g.fillStyle=state.health<30?'#ff7a7a':'#91dfd4';g.fillRect(12*dpr,12*dpr,w*.3*state.health/100,8*dpr);
}
setUI();requestAnimationFrame(frame);
