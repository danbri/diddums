// Adaptive music demo: a small stealth/collect game whose live state drives an endless Diddums score.
// Each level plays a piece from Labs, looped and re-arranged from game state at the next bar line;
// characters (you, your companion, a friendly animal) have their own motifs over it; events answer
// within a 16th note on the chords actually sounding. Characters follow Heider and Simmel's 1944
// animation: a small circle (you), big triangles (hunters), a small triangle (your companion) and a
// house with a door.
import {startAdaptive} from './adaptive.js';
import {compositionFromSong,parseKey,modes} from './song.js';
import {GENRES,CHARTS} from './songbook.js';

const $=s=>document.querySelector(s);
const SONGS=Object.fromEntries(GENRES.map(s=>[s.title,s]));

// ---- Levels: a piece, a place, and what is in it ----
// food: collect (counts towards clearing) · treasure: bonus · good: heals · risk: hurts on touch
// (moving if it is a creature) · mystery: good or bad, dramatically · trees: cover · animal: wanders;
// an ally animal follows you once touched and scares hunters off · exit: 'clear' (all food, then the
// chest) or an open edge.
const LEVELS=[
 {name:'Meadow',song:'Folk · Over the Hill',bg:[20,44,30],food:['🍓','🍎'],treasure:'💎',good:'🍯',risk:'🐝',riskMoves:true,mystery:'🎁',trees:['🌳','🌻'],animal:'🐑',ally:false,exit:'clear',chest:'🧺',hero:'blownWhistlePureHigh'},
 {name:'Beach',song:'Reggae · Sunday Yard',bg:[24,40,54],food:['🍍','🥥'],treasure:'🐚',good:'🍹',risk:'🦀',riskMoves:true,mystery:'🍾',trees:['🌴'],animal:'🐢',ally:true,exit:'right',hero:'modalVibeBarMediumRing'},
 {name:'Graveyard',song:'Goth · Velvet Crypt',bg:[22,16,34],food:['🍬','🍭'],treasure:'🕯️',good:'🧄',risk:'🕳️',riskMoves:false,mystery:'🔮',trees:['🥀','🌳'],animal:'🐈‍⬛',ally:false,exit:'clear',chest:'⚰️',hero:'modalGlassBarSoftRing'},
 {name:'Warehouse party',song:'House · Warehouse Sunrise',bg:[30,18,40],food:['🍕','🍩'],treasure:'💿',good:'🥤',risk:'⚡',riskMoves:false,mystery:'🎲',trees:['🪴'],animal:'🐕',ally:true,exit:'top',hero:'chipPulse25NotePlain'},
 {name:'Harbour',song:'Sea Shanty · Haul Away, Sally',bg:[16,34,52],food:['🐟','🦐'],treasure:'🪙',good:'🛟',risk:'🦈',riskMoves:true,mystery:'📦',trees:['⚓','🪸'],animal:'🦭',ally:false,exit:'bottom',hero:'reedAccordionSoftStill'},
 {name:'Mountain',song:'Bluegrass · Mountain Switchback',bg:[34,38,30],food:['🫐','🌰'],treasure:'⛏️',good:'🥧',risk:'🐍',riskMoves:true,mystery:'🍄',trees:['🌲','🪨'],animal:'🐐',ally:true,exit:'left',hero:'pluckMandolinBrightDark'},
 {name:'Neon city',song:'Synthwave · Neon Coastline',bg:[14,16,38],food:['🍜','🍙'],treasure:'💾',good:'🔋',risk:'🔥',riskMoves:false,mystery:'📼',trees:['🌃','🏙️'],animal:'🦝',ally:false,exit:'clear',chest:'🚀',hero:'subSquareLeadHp'}];
const lv=n=>LEVELS[n%LEVELS.length];
const LEAD=new Set(['fiddle','whistle','melodica','voice','call','crew','lead','sax','flute','glock']);
const roleOf=id=>/bass|sub/.test(id)?'bass':LEAD.has(id)?'lead':'accomp';

// One composition per level: the piece's own parts plus the game's voices.
function levelMusic(L){
 const song=SONGS[L.song],[n,d]=song.meter.split('/').map(Number),barSec=n*4/d*60/song.bpm,loopBars=Math.round((song.seconds-2)/barSec);
 const tracks=[...song.tracks,
  {id:'hero',sound:L.hero,role:'lead',label:'You',level:.5,send:.3},{id:'buddy',sound:'celesta',role:'lead',label:'Companion',level:.45,send:.4},
  {id:'animal',sound:'blownOcarinaPureLow',role:'sparse',label:'Animal',level:.6,send:.4},
  {id:'drone',sound:'voidDrone',label:'Dread drone',level:.4},{id:'heart',sound:'heartbeat',label:'Heartbeat',level:1},
  {id:'chime',sound:'celesta',label:'Pickup chime',level:.55,role:'timeline',seq:'.'},{id:'alarm',sound:'sonarBlup',label:'Alarm',level:.5,role:'timeline',seq:'.'},
  {id:'boom',sound:'timpani',label:'Impact',level:.9,role:'timeline',seq:'.'}];
 const composition={...compositionFromSong({...song,seconds:600,tracks}),loopBars};
 const chart=CHARTS[L.song],harmony=Array.from({length:Math.ceil(loopBars/2)},(_,i)=>chart[(2*i)%chart.length]);
 const k=parseKey(song.key)||{mode:'major'},parts=song.tracks.map(t=>t.id);
 return {song,composition,harmony,chordAt:b=>chart[b%loopBars],scale:modes[k.mode]||modes.major,mode:k.mode,
  lead:parts.filter(id=>roleOf(id)==='lead'),bass:parts.filter(id=>roleOf(id)==='bass'),accomp:parts.filter(id=>roleOf(id)==='accomp')};
}

// Game state → arrangement. The piece's parts enter one threat threshold at a time; danger, being
// trapped, hurt or powered-up each have their own arrangement, tempo and transition.
function makePlan(M){
 return function plan({threat=0,health=1,power=false,safe=false,hidden=false,trapped=false,calmUntil=false}){
  const q=x=>Math.round(x*10)/10,T=safe||calmUntil?0:q(threat),low=health<=.3,bpm=M.song.bpm,L=new Set(['heart']);
  if(trapped){for(const id of M.bass)L.add(id);L.add('drone');return {name:'Trapped',layers:[...L],rhythm:M.song.rhythm==='none'?'halftime':M.song.rhythm,energy:1,harmony:M.harmony,tempo:Math.round(bpm*1.12),transition:{type:'cut',beats:1}};}
  if(low&&T>=.3){for(const id of M.bass)L.add(id);L.add('drone');if(M.accomp[0])L.add(M.accomp[0]);return {name:'Desperate',layers:[...L],rhythm:'halftime',energy:.6,harmony:M.harmony,tempo:Math.round(bpm*.92)};}
  if(power){for(const id of [...M.lead,...M.bass,...M.accomp])L.add(id);return {name:'Power',layers:[...L],rhythm:M.song.rhythm==='none'?'house':M.song.rhythm,energy:1,harmony:M.harmony,tempo:Math.round(bpm*1.06),transition:{type:'fill',beats:2}};}
  if(M.accomp[0])L.add(M.accomp[0]);if(!hidden)for(const id of M.lead)L.add(id);
  if(T>=.2||!safe)for(const id of M.accomp)L.add(id);if(T>=.3)for(const id of M.bass)L.add(id);
  const rhythm=T>=.45?M.song.rhythm:'none';
  return {name:safe?'Sheltered':hidden?'Hidden':T>=.7?'Hunted':T>=.3?'Watched':'Exploring',layers:[...L],rhythm,energy:q(Math.min(1,.4+.6*T)),harmony:M.harmony,tempo:bpm,
   transition:T>=.45?{type:'fill',beats:1}:{type:'crossfade',beats:2}};
 };
}

// ---- Field ----
const narrow=innerWidth<720,W=1,BASE_H=narrow?1.15:.62,cv=$('#arena'),g=cv.getContext('2d');let Hgt=BASE_H;
cv.style.aspectRatio=`${W} / ${Hgt}`;
const rnd=(a,b)=>a+Math.random()*(b-a),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),pick=a=>a[Math.floor(Math.random()*a.length)],clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const HOUSE={x:.06,y:Hgt-.28,w:.24,h:.22,door:.09};// open door on the right wall
// The field takes the screen's shape in full screen; everything on it is rescaled in place.
function relayout(h){
 const f=h/Hgt,dy=h-Hgt;if(f===1)return;
 const all=game?[game.player,game.buddy,game.buddy.goal,game.animal,...game.trees,...game.items,...game.risks,...game.enemies,game.chest,game.fruit,...game.flash].filter(Boolean):[];
 const inside=new Set(all.filter(inHouse));// the house stays at the bottom; what is inside moves with it
 Hgt=h;HOUSE.y=Hgt-.28;cv.style.aspectRatio=`${W} / ${Hgt}`;
 for(const o of all)o.y=inside.has(o)?o.y+dy:Math.min(o.y*f,Hgt-.03);
 for(const o of all)if(!inside.has(o)&&inHouse(o))o.y=HOUSE.y-.04;
}
const inHouse=p=>p.x>HOUSE.x&&p.x<HOUSE.x+HOUSE.w&&p.y>HOUSE.y&&p.y<HOUSE.y+HOUSE.h;
// Wall segments: the house (with a door gap; `closed` adds a door for hunters) and the field edges.
function houseWalls(closed){const {x,y,w,h,door}=HOUSE,dy=y+h/2;return [[x,y,x+w,y],[x,y,x,y+h],[x,y+h,x+w,y+h],[x+w,y,x+w,dy-door/2],[x+w,dy+door/2,x+w,y+h],...(closed?[[x+w,dy-door/2,x+w,dy+door/2]]:[])];}
function collide(o,r,segs){
 for(const [x1,y1,x2,y2] of segs){const dx=x2-x1,dy=y2-y1,t=clamp(((o.x-x1)*dx+(o.y-y1)*dy)/(dx*dx+dy*dy),0,1),cx=x1+t*dx,cy=y1+t*dy,ex=o.x-cx,ey=o.y-cy,d=Math.hypot(ex,ey);
  if(d<r&&d>1e-9){const nx=ex/d,ny=ey/d;o.x=cx+nx*r;o.y=cy+ny*r;const v=o.v;if(v){const vn=v.x*nx+v.y*ny;if(vn<0){v.x-=1.4*vn*nx;v.y-=1.4*vn*ny;}}}}
}
// Field edges: walls except the level's exit edge (open for the player only).
function edges(o,r,open){let out=null;
 if(o.x<r){if(open==='left')out=o.x<-.01?'left':null;else{o.x=r;if(o.v)o.v.x=Math.abs(o.v.x)*.4;}}
 if(o.x>W-r){if(open==='right')out=o.x>W+.01?'right':null;else{o.x=W-r;if(o.v)o.v.x=-Math.abs(o.v.x)*.4;}}
 if(o.y<r){if(open==='top')out=o.y<-.01?'top':null;else{o.y=r;if(o.v)o.v.y=Math.abs(o.v.y)*.4;}}
 if(o.y>Hgt-r){if(open==='bottom')out=o.y>Hgt+.01?'bottom':null;else{o.y=Hgt-r;if(o.v)o.v.y=-Math.abs(o.v.y)*.4;}}
 return out;}
function free(r=.05,avoid=[]){for(let i=0;i<80;i++){const p={x:rnd(.07,.93),y:rnd(.08,Hgt-.07)};if([{x:p.x+r,y:p.y},p,{x:p.x-r,y:p.y},{x:p.x,y:p.y-r},{x:p.x,y:p.y+r}].some(inHouse))continue;if(avoid.some(a=>dist(a,p)<r+.04))continue;return p;}return {x:.6,y:.3};}

// ---- Game state ----
let steer=null,dash=null,lastLevels={},game,music=null,M=null,lastPlan=null,keys={},target=null,last=performance.now(),ctx=null,loading=false;
function newLevel(level,keepScore=0,health=1){
 const L=lv(level),n=5+Math.min(6,level),placed=[];const put=(r,o)=>{const p={...free(r,placed),...o};placed.push(p);return p;};
 const trees=Array.from({length:4},()=>put(.08,{r:.05,kind:pick(L.trees)}));
 game={level,L,got:[],motif:[],score:keepScore,health,power:0,combo:0,comboAt:0,invuln:0,over:0,calm:0,hurt:0,
  player:{x:HOUSE.x+HOUSE.w/2,y:HOUSE.y+HOUSE.h/2,v:{x:0,y:0}},
  buddy:{x:HOUSE.x+.05,y:HOUSE.y+.05,a:0,v:{x:0,y:0},mode:'near',wanderIn:rnd(18,30)},
  animal:{...put(.05),v:{x:0,y:0},a:rnd(0,6.28),friend:false},
  trees,items:[...Array.from({length:n},()=>put(.05,{kind:pick(L.food),food:true})),...Array.from({length:2},()=>put(.05,{kind:L.treasure,treasure:true})),
   put(.05,{kind:L.good,good:true}),put(.05,{kind:L.mystery,mystery:true}),put(.05,{kind:'⭐',star:true})],
  risks:Array.from({length:2+Math.min(3,level)},()=>put(.06,{kind:L.risk,a:rnd(0,6.28),v:{x:0,y:0}})),
  chest:null,enemies:[],flash:[],toast:{text:L.exit==='clear'?`${L.name}: collect every ${L.food.join(' ')}`:`${L.name}: find the way out ${({right:'→',left:'←',top:'↑',bottom:'↓'})[L.exit]}`,t:3.5}};
 game.enemies=Array.from({length:2+Math.min(4,level)},()=>spawnEnemy());
}
function spawnEnemy(){const p=free(.05,[game.player]);return {x:p.x,y:Math.min(p.y,Hgt*.55),a:rnd(0,6.28),v:{x:0,y:0},alert:0,dead:0};}
const hidden=()=>inHouse(game.player)||game.trees.some(t=>dist(game.player,t)<t.r);
function threat(){
 if(inHouse(game.player))return 0;const p=game.player;let t=0,near=9;
 for(const e of game.enemies){if(e.dead)continue;if(e.alert>0)t+=.25;near=Math.min(near,dist(p,e));}
 return Math.min(1,t+Math.max(0,(.3-near)/.3)*.35);
}
// Trapped: hunters closing in and most ways out blocked by walls, edges, hazards or hunters.
function trapped(){
 const p=game.player;if(inHouse(p)||game.power>0)return false;const close=game.enemies.filter(e=>!e.dead&&e.alert>0&&dist(p,e)<.28);if(!close.length)return false;
 let blocked=0;for(let i=0;i<8;i++){const a=i*Math.PI/4,q={x:p.x+Math.cos(a)*.11,y:p.y+Math.sin(a)*.11};
  if(q.x<0||q.x>W||q.y<0||q.y>Hgt||[...close,...game.risks].some(e=>dist(q,e)<.07)||(inHouse(q)!==inHouse(p)&&!(q.x>HOUSE.x+HOUSE.w-.02&&Math.abs(q.y-HOUSE.y-HOUSE.h/2)<HOUSE.door/2)))blocked++;}
 return blocked>=5;
}
function say(text){const l=$('#log');l.innerHTML=(text+'\n'+l.innerHTML).split('\n').slice(0,40).join('\n');}
const hit=(track,opts)=>music?.hit(track,opts);
const deg=k=>[0,2,4,6][((k%4)+4)%4]+7*Math.floor(k/4);

// ---- Music per level ----
let wantLevel=null;
async function startMusic(level){
 if(loading){wantLevel=level;return;}loading=true;const old=music;
 try{
  M=levelMusic(lv(level));
  if(old){old.hit('chime',{tones:[0,1,2,4,5,6],octave:1,velocity:.85});await new Promise(r=>setTimeout(r,900));old.stop({keepContext:true});if(music===old)music=null;}
  const m=await startAdaptive({composition:M.composition,plan:makePlan(M),ctx,chordAt:M.chordAt,state:musicState(),
   characters:{hero:{track:'hero',motif:[0,null,null,null,2,null,null,null],scale:M.mode},buddy:{track:'buddy',motif:[4,null,2,null,null,null,0,null,null,null,null,null,1,null,null,null],scale:M.mode,present:true},animal:{track:'animal',motif:[0,null,null,4,null,null,null,null],scale:M.mode}},
   onBar:(bar,p)=>{$('#status').innerHTML=`Bar <b>${bar+1}</b> · <b>${p.name}</b> · ${Math.round(music?.tempo??p.tempo)} bpm · ${M.song.title}`;if(JSON.stringify(p)!==JSON.stringify(lastPlan)){lastPlan=p;renderLayers(p);say(`bar ${bar+1}: <b>${p.name}</b>`);}},
   onLevels:m=>{lastLevels=m;for(const s of document.querySelectorAll('#layers span')){const v=m[s.dataset.id]?.rms||0,w=v>0?clamp((20*Math.log10(v)+60)/60,0,1):0;s.querySelector('i').style.width=(w*100).toFixed(0)+'%';s.classList.toggle('on',w>.05);}}});
  ctx=m.ctx;music=m;sent={};
  if(game.motif.length)music.enter('hero',{motif:heroMotif()});if(game.animal.friend)music.enter('animal');
  say(`<b>Level ${level+1} · ${lv(level).name}</b>: ${M.song.title}`);
 }catch(e){console.error(e);$('#start').textContent='Could not start: '+e.message;}finally{loading=false;}
 if(wantLevel!=null&&wantLevel!==level){const n=wantLevel;wantLevel=null;startMusic(n);}else wantLevel=null;
}
function renderLayers(p){
 const on=new Set(p.layers),labels={hero:'You',buddy:'Companion',animal:'Animal',drone:'Dread drone',heart:'Heartbeat'};
 $('#layers').innerHTML=[...M.composition.tracks.filter(t=>t.role!=='timeline'||String(t.seq).trim()!=='.').map(t=>t.id)].map(id=>`<span data-id="${id}" class="${on.has(id)?'on':''}">${labels[id]||M.composition.tracks.find(t=>t.id===id).label}<i></i></span>`).join('')+`<span data-id="drums">Drums · ${p.rhythm}<i></i></span>`;
}
// Your motif is the food you have eaten: each item adds a scale degree, by where it was on the field.
const heroMotif=()=>{const k=game.motif.slice(-8),out=Array(16).fill(null);k.forEach((d,i)=>{out[Math.floor(i*16/k.length)]=d;});return out;};
function musicState(){
 const t=game?threat():0;return {threat:t,health:game?.health??1,power:(game?.power||0)>0,safe:game?inHouse(game.player):true,hidden:game?hidden():false,trapped:game?trapped():false,calmUntil:(game?.calm||0)>0};
}

// ---- Step ----
function step(dt){
 const p=game.player,L=game.L;
 if(game.toast)game.toast.t-=dt;
 if(game.over>0){game.over-=dt;if(game.over<=0){newLevel(0);say('<b>New game</b>');if(music)startMusic(0);}return;}
 let vx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),vy=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);
 let gain=1,boost=1;
 if($('#auto').checked){const a=autopilot();vx=a.x;vy=a.y;}
 else if(steer&&!vx&&!vy){vx=steer.x;vy=steer.y;gain=Math.min(1,Math.hypot(vx,vy));boost=steer.boost||1;}
 else if(target&&!vx&&!vy){vx=target.x-p.x;vy=target.y-p.y;if(Math.hypot(vx,vy)<.01)vx=vy=0;}
 // Inertia: input sets a target velocity; the player accelerates towards it and coasts when let go.
 // A flick adds an impulse that grows with both the swipe's speed and its length (multiplied).
 const m=Math.hypot(vx,vy)||1,sp=.34*gain*boost*(game.hurt>0?.6:1),moving=vx||vy?1:0,pv=p.v;
 const want={x:vx/m*sp*moving,y:vy/m*sp*moving},k=1-Math.exp(-dt*(moving?3.4:1.6));
 pv.x+=(want.x-pv.x)*k;pv.y+=(want.y-pv.y)*k;
 if(dash){pv.x+=dash.x*dash.power;pv.y+=dash.y*dash.power;dash=null;}
 const top=1.4,s=Math.hypot(pv.x,pv.y);if(s>top){pv.x*=top/s;pv.y*=top/s;}
 p.x+=pv.x*dt;p.y+=pv.y*dt;
 collide(p,.022,houseWalls(false));
 const out=edges(p,.022,L.exit==='clear'?null:L.exit);if(out){levelUp(`left by the ${out} edge`,100);return;}
 game.power=Math.max(0,game.power-dt);game.invuln=Math.max(0,game.invuln-dt);game.calm=Math.max(0,game.calm-dt);game.hurt=Math.max(0,game.hurt-dt);
 if(game.power>0&&game.power<dt*1.01)hit('chime',{tones:[2,1,0],spread:2,velocity:.5});
 if(game.calm>0&&game.calm<dt*1.01){for(let i=0;i<3;i++)game.enemies.push(spawnEnemy());say('The hunters are back');hit('alarm',{tones:[0,0],octave:1,grid:4});}
 stepBuddy(dt);stepAnimal(dt);
 // Pickups.
 for(const it of [...game.items])if(dist(p,it)<.045){game.items.splice(game.items.indexOf(it),1);pickup(it);}
 if(L.exit==='clear'&&!game.chest&&!game.items.some(i=>i.food)){game.chest={...free(.05,[p]),kind:L.chest||'💰'};hit('chime',{tones:[0,2,4],octave:1,grid:4,velocity:.6});say(`The ${game.chest.kind} has appeared`);}
 if(game.chest&&dist(p,game.chest)<.05){levelUp('opened the '+game.chest.kind,200);return;}
 // Hazards: some drift about.
 for(const r of game.risks){
  if(L.riskMoves){r.a+=rnd(-1.5,1.5)*dt;r.v.x=Math.cos(r.a)*.05;r.v.y=Math.sin(r.a)*.05;r.x+=r.v.x*dt;r.y+=r.v.y*dt;edges(r,.04,null);collide(r,.04,houseWalls(true));}
  if(dist(p,r)<.045&&game.invuln<=0){hurt(.12,r,`${r.kind} hurt you`);game.hurt=1.5;}
 }
 // Bonus fruit, as in Pac-Man: now and then, for eight seconds.
 game.fruitIn=(game.fruitIn??rnd(10,18))-dt;
 if(!game.fruit&&game.fruitIn<=0){game.fruit={...free(.05,[p]),kind:pick(['🍒','🍓','🍊','🍋','🍑','🍉','🍇']),life:8};game.fruitIn=rnd(16,26);}
 if(game.fruit){game.fruit.life-=dt;if(game.fruit.life<=0)game.fruit=null;
  else if(dist(p,game.fruit)<.045){const v=100*(game.level+1);game.score+=v;hit('chime',{tones:[0,2,4,6,7],octave:1,velocity:.75});game.flash.push({x:game.fruit.x,y:game.fruit.y,t:.5,c:'#f6e27a'});say(`${game.fruit.kind} +${v}`);game.fruit=null;}}
 // Hunters.
 const isHidden=hidden(),walls=houseWalls(true);
 for(const e of game.enemies){
  if(e.dead){e.dead-=dt;if(e.dead<=0)Object.assign(e,spawnEnemy());continue;}
  const d=dist(p,e),sight=.2+.012*game.level,b=game.buddy,prey=b.mode!=='near'&&dist(b,e)<.18?b:p;
  if(d<sight&&!isHidden&&game.power<=0){if(e.alert<=0){hit('alarm',{tones:[0],octave:1,grid:2,velocity:.7});game.flash.push({x:e.x,y:e.y,t:.5,c:'#edbc74'});}e.alert=2.2;}else e.alert=Math.max(0,e.alert-dt);
  let ax,ay,spd;
  if(game.power>0){ax=e.x-p.x;ay=e.y-p.y;spd=.15;}
  else if(game.animal.friend&&dist(e,game.animal)<.12){ax=e.x-game.animal.x;ay=e.y-game.animal.y;spd=.2;}
  else if(prey===b&&b.mode!=='taken'){ax=b.x-e.x;ay=b.y-e.y;spd=.12;}
  else if(e.alert>0&&!inHouse(p)){ax=p.x-e.x;ay=p.y-e.y;spd=(.15+.01*game.level)*(1+.6*Math.max(0,Math.sin(performance.now()/180)));}// lunging
  else{e.a+=rnd(-2,2)*dt;ax=Math.cos(e.a);ay=Math.sin(e.a);spd=.06;}
  const am=Math.hypot(ax,ay)||1;e.v.x=ax/am*spd;e.v.y=ay/am*spd;e.x+=e.v.x*dt;e.y+=e.v.y*dt;
  if(e.x<.03||e.x>W-.03)e.a=Math.PI-e.a;if(e.y<.03||e.y>Hgt-.03)e.a=-e.a;edges(e,.03,null);collide(e,.03,walls);
  if(prey===b&&b.mode!=='taken'&&dist(b,e)<.035){b.mode='taken';b.by=e;hit('boom',{tones:[0,1],octave:-1,velocity:.9});hit('alarm',{tones:[3,2],spread:2});say('Your <b>companion</b> has been taken. Reach it to free it.');music?.setCharacter('buddy',{mood:-1,stability:.15,power:.15});}
  if(d<.045){
   if(game.power>0){e.dead=6;e.alert=0;game.score+=50;hit('boom',{tones:[2],velocity:.6});hit('chime',{tones:[4,6],octave:1,spread:1,velocity:.6});game.flash.push({x:e.x,y:e.y,t:.5,c:'#ba96f0'});}
   else if(game.invuln<=0)hurt(.15,e,null);
  }
 }
 if(inHouse(p))game.health=Math.min(1,game.health+dt*.12);else if(!game.enemies.some(e=>e.alert>0&&!e.dead))game.health=Math.min(1,game.health+dt*.03);
 for(const f of game.flash)f.t-=dt;game.flash=game.flash.filter(f=>f.t>0);
}
function hurt(amount,from,text){
 const p=game.player;game.health=Math.max(0,game.health-amount);game.invuln=1.5;hit('boom',{tones:[0],octave:-1,velocity:1});hit('alarm',{tones:[1,0],octave:-1,spread:1,velocity:.6});
 const d=dist(p,from)||1;p.v.x+=(p.x-from.x)/d*.6;p.v.y+=(p.y-from.y)/d*.6;game.flash.push({x:p.x,y:p.y,t:.5,c:'#ff7a7a'});if(text)say(text);
 music?.setCharacter('hero',{health:game.health,stability:.4});setTimeout(()=>music?.setCharacter('hero',{stability:1}),3000);
 if(game.health<=0){game.over=4;hit('boom',{tones:[0,-1,-2,-4],octave:-1,spread:3,velocity:1});hit('chime',{tones:[3,2,1,0],spread:3,velocity:.6});say(`<b>Caught</b> on level ${game.level+1} with ${game.score} points`);}
}
function pickup(it){
 const p=game.player;
 if(it.star){game.power=7;hit('chime',{tones:[0,1,2,4],octave:1});hit('boom',{tones:[0],octave:-1});say('<b>Star</b>: the hunters can be knocked out for 7 s');music?.setCharacter('hero',{power:1});setTimeout(()=>music?.setCharacter('hero',{power:.6}),7000);}
 else if(it.good){game.health=Math.min(1,game.health+.4);hit('chime',{tones:[0,1,2,3,4],octave:1,spread:1,velocity:.7});say(`${it.kind} healed you`);music?.setCharacter('hero',{health:game.health,mood:.6});setTimeout(()=>music?.setCharacter('hero',{mood:0}),6000);}
 else if(it.mystery)mystery(it);
 else{game.combo=performance.now()-game.comboAt<1800?game.combo+1:0;game.comboAt=performance.now();game.score+=(it.treasure?50:10)*(1+game.combo);
  // The field is a keyboard: an item's note rises from left to right; quick runs climb from the last note.
  const k=game.combo>0?Math.min(9,(game.lastK??0)+1):Math.round(it.x*6);game.lastK=k;
  hit('chime',it.treasure?{tones:[k,k+2],octave:1,spread:1}:{tones:[k],octave:1,velocity:.7+.04*Math.min(6,game.combo)});
  game.motif.push(deg(k));if(it.treasure)game.motif.push(deg(k+2));music?.enter('hero',{motif:heroMotif()});}
 game.flash.push({x:it.x,y:it.y,t:.4,c:'#7ce3dd'});
}
// Mystery: a drum roll, then something big, good or bad.
function mystery(it){
 const roll=Math.random(),g0=game;hit('alarm',{tones:[0,0,0,0,1,2],spread:1,velocity:.5});
 setTimeout(()=>{if(game!==g0)return;
  if(roll<.25){game.health=1;game.power=5;game.score+=300;hit('chime',{tones:[0,2,4,7,9,11],octave:1,velocity:.9});say(`${it.kind} <b>Feast</b>: full health, power and 300 points`);music?.set(musicState(),{transition:'pickup',beats:2});}
  else if(roll<.5){hurt(.4,{x:it.x+.01,y:it.y},`${it.kind} <b>Curse</b>: lost 40% health`);}
  else if(roll<.75){for(let i=0;i<3;i++){const e=spawnEnemy();e.alert=3;game.enemies.push(e);}hit('boom',{tones:[0,0,0],octave:-1,spread:2});say(`${it.kind} <b>Ambush</b>: three more hunters`);music?.set(musicState(),{transition:'cut',beats:1});}
  else{const n=game.enemies.length;game.enemies=[];game.calm=12;hit('chime',{tones:[4,2,0],octave:1,spread:3,velocity:.6});say(`${it.kind} <b>Peace</b>: all ${n} hunters gone for 12 s`);music?.set(musicState(),{transition:'crossfade',beats:4});}
 },700);
}
// Companion: circles you, but now and then wanders off. Hunters go for it when it is alone.
function stepBuddy(dt){
 const b=game.buddy,p=game.player;b.a+=dt*2;
 if(b.mode==='near'){b.wanderIn-=dt;const tx=p.x+Math.cos(b.a)*.07,ty=p.y+Math.sin(b.a)*.07;b.x+=(tx-b.x)*Math.min(1,dt*4);b.y+=(ty-b.y)*Math.min(1,dt*4);
  if(b.wanderIn<=0&&!inHouse(p)){b.mode='away';b.goal=free(.05);hit('buddy',{tones:[2,0],spread:2,velocity:.5});say('Your <b>companion</b> has wandered off');}}
 else if(b.mode==='away'){const d=dist(b,b.goal);if(d>.01){b.x+=(b.goal.x-b.x)/d*.07*dt;b.y+=(b.goal.y-b.y)/d*.07*dt;}
  const risk=game.enemies.some(e=>!e.dead&&dist(e,b)<.18);if(risk!==b.risk){b.risk=risk;music?.setCharacter('buddy',risk?{stability:.25,power:.3,mood:-.4}:{stability:1,power:.6,mood:0});if(risk){hit('alarm',{tones:[2],octave:1,grid:2,velocity:.6});say('Your companion is <b>in danger</b>');}}
  if(dist(b,p)<.08)rejoin('came back');}
 else if(b.mode==='taken'){const e=b.by;if(!e||e.dead){rejoin('was freed');}else{b.x+=(e.x-b.x)*Math.min(1,dt*6);b.y+=(e.y-b.y)*Math.min(1,dt*6);if(dist(b,p)<.05){e.dead=4;rejoin('was rescued');game.score+=150;}}}
 collide(b,.015,houseWalls(false));edges(b,.015,null);
}
function rejoin(how){const b=game.buddy;b.mode='near';b.risk=false;b.by=null;b.wanderIn=rnd(25,45);hit('buddy',{tones:[0,1,2,4],spread:1,velocity:.7});say(`Your companion ${how}`);music?.setCharacter('buddy',{stability:1,power:.6,mood:.5});setTimeout(()=>music?.setCharacter('buddy',{mood:0}),5000);}
// Animal: wanders and keeps its distance; an ally follows you once touched and scares hunters off.
function stepAnimal(dt){
 const a=game.animal,p=game.player;
 if(a.friend){const d=dist(a,p);if(d>.09){a.x+=(p.x-a.x)/d*.22*dt;a.y+=(p.y-a.y)/d*.22*dt;}}
 else{a.a+=rnd(-1.2,1.2)*dt;let ax=Math.cos(a.a),ay=Math.sin(a.a);const d=dist(a,p);if(d<.15&&!game.L.ally){ax+=(a.x-p.x)/d*2;ay+=(a.y-p.y)/d*2;}const m=Math.hypot(ax,ay)||1;a.x+=ax/m*.05*dt;a.y+=ay/m*.05*dt;
  if(game.L.ally&&d<.05){a.friend=true;hit('animal',{tones:[0,2,4],spread:2,velocity:.7});say(`The ${a.kind||game.L.animal} is your <b>friend</b> now: it scares hunters off`);music?.enter('animal');}}
 collide(a,.035,houseWalls(true));if(edges(a,.035,null))a.a+=Math.PI;
}
function levelUp(how,bonus){
 game.score+=bonus;const next=game.level+1,L=lv(next);say(`<b>Level ${next+1}</b>: ${L.name} (${how})`);
 newLevel(next,game.score,Math.max(game.health,.6));if(music)startMusic(next);
}
// Autopilot: shelter when badly hurt, use the star when hunted, rescue the companion, otherwise collect or leave.
function autopilot(){
 const p=game.player,hunters=game.enemies.filter(e=>!e.dead&&(e.alert>0||dist(p,e)<.15)),star=game.items.find(i=>i.star),L=game.L;
 let goal;
 if(game.health<.35&&game.power<=0)goal=inHouse(p)?{x:p.x,y:p.y}:{x:HOUSE.x+HOUSE.w+.03,y:HOUSE.y+HOUSE.h/2,door:true};
 else if(game.power>0)goal=game.enemies.filter(e=>!e.dead).sort((a,b)=>dist(p,a)-dist(p,b))[0];
 else if(hunters.length&&star)goal=star;
 else if(game.buddy.mode!=='near')goal=game.buddy;
 else goal=game.chest||game.items.filter(i=>i.food||i.treasure||i.good&&game.health<.8).sort((a,b)=>dist(p,a)-dist(p,b))[0];
 if(!goal&&L.exit!=='clear')goal={right:{x:W+.1,y:p.y},left:{x:-.1,y:p.y},top:{x:p.x,y:-.1},bottom:{x:p.x,y:Hgt+.1}}[L.exit];
 // Through the door, not the walls: line up with it first, from inside or outside.
 const doorY=HOUSE.y+HOUSE.h/2,lined=Math.abs(p.y-doorY)<.025;
 if(goal&&inHouse(p)&&!goal.door)goal=lined?{x:HOUSE.x+HOUSE.w+.08,y:doorY}:{x:HOUSE.x+HOUSE.w-.05,y:doorY};
 else if(goal?.door)goal=lined&&p.x<HOUSE.x+HOUSE.w+.07?{x:HOUSE.x+HOUSE.w/2,y:doorY}:{x:HOUSE.x+HOUSE.w+.06,y:doorY};
 if(!goal)return {x:0,y:0};let x=goal.x-p.x,y=goal.y-p.y;const m=Math.hypot(x,y)||1;x/=m;y/=m;
 if(game.power<=0)for(const e of [...hunters,...game.risks]){const d=dist(p,e)||1,w=.06/(d*d);x+=(p.x-e.x)/d*w;y+=(p.y-e.y)/d*w;}
 return {x,y};
}

// ---- Drawing ----
function tri(x,y,a,r,fill,stroke){g.beginPath();for(let i=0;i<3;i++){const k=a+(i===0?0:i===1?2.5:-2.5),rr=i===0?r*1.4:r;g.lineTo(x+Math.cos(k)*rr,y+Math.sin(k)*rr);}g.closePath();g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}
function emoji(ch,x,y,size){g.font=`${size}px serif`;g.fillText(ch,x,y);}
function fit(){// In full screen the field is scaled to fit the screen, keeping its shape.
 if(!document.body.classList.contains('gm-full')){cv.style.width='';cv.style.height='';return;}
 const aw=innerWidth,ah=innerHeight-(matchMedia('(pointer:coarse)').matches?0:0),s=Math.min(aw/W,ah/Hgt);cv.style.width=Math.floor(W*s)+'px';cv.style.height=Math.floor(Hgt*s)+'px';}
function draw(){
 fit();const dpr=Math.min(2,devicePixelRatio||1),r=cv.getBoundingClientRect(),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(cv.width!==w)cv.width=w;if(cv.height!==h)cv.height=h;
 const S=w/W,X=v=>v*S,t=performance.now()/1000,th=threat(),L=game.L,[br,bg,bb]=L.bg,trap=trapped();
 g.fillStyle=game.power>0?'#1f1838':trap?`rgb(${60+30*Math.sin(t*8)},12,18)`:`rgb(${br+40*th},${bg-8*th},${bb-10*th})`;g.fillRect(0,0,w,h);
 // Field walls on blocked edges; the exit edge glows.
 g.lineWidth=6*dpr;for(const [edge,x1,y1,x2,y2] of [['top',0,0,W,0],['bottom',0,Hgt,W,Hgt],['left',0,0,0,Hgt],['right',W,0,W,Hgt]]){
  const open=L.exit===edge;g.strokeStyle=open?`rgba(124,227,221,${.5+.4*Math.sin(t*4)})`:'#8a6a52';g.setLineDash(open?[10*dpr,8*dpr]:[]);g.beginPath();g.moveTo(X(x1),X(y1));g.lineTo(X(x2),X(y2));g.stroke();}
 g.setLineDash([]);
 g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ffffff';
 if(L.exit!=='clear'){const a={right:[W-.04,Hgt/2,'➡️'],left:[.04,Hgt/2,'⬅️'],top:[W/2,.04,'⬆️'],bottom:[W/2,Hgt-.04,'⬇️']}[L.exit];emoji(a[2],X(a[0]),X(a[1]),X(.05));}
 // House: walls with a door gap, as in the film.
 g.fillStyle=inHouse(game.player)?'#7ce3dd18':'#ffffff08';g.fillRect(X(HOUSE.x),X(HOUSE.y),X(HOUSE.w),X(HOUSE.h));g.strokeStyle='#d8e6ee';g.lineWidth=4*dpr;
 for(const [x1,y1,x2,y2] of houseWalls(false)){g.beginPath();g.moveTo(X(x1),X(y1));g.lineTo(X(x2),X(y2));g.stroke();}
 g.fillStyle='#ffffff';const E=narrow?1.25:1;
 for(const tr of game.trees)emoji(tr.kind,X(tr.x),X(tr.y),X(.09*E));
 for(const r of game.risks)emoji(r.kind,X(r.x),X(r.y),X(.055*E));
 if(game.fruit&&(game.fruit.life>2||Math.floor(t*6)%2))emoji(game.fruit.kind,X(game.fruit.x),X(game.fruit.y),X(.06*E));
 for(const it of [...game.items,...(game.chest?[game.chest]:[])]){const s=(it.mystery?.06:it===game.chest?.075:.05)*E;emoji(it.kind,X(it.x),X(it.y),X(s)*(1+.08*Math.sin(t*4+it.x*20)));}
 const a=game.animal;emoji(L.animal,X(a.x),X(a.y),X(.06*E));if(a.friend){g.strokeStyle='#7ce3dd88';g.lineWidth=2*dpr;g.beginPath();g.arc(X(a.x),X(a.y),X(.04),0,6.28);g.stroke();}
 for(const e of game.enemies){if(e.dead)continue;const sight=.2+.012*game.level;
  g.fillStyle=e.alert>0?'#ff7a7a14':'#ffffff07';g.beginPath();g.arc(X(e.x),X(e.y),X(sight),0,6.28);g.fill();
  tri(X(e.x),X(e.y),Math.atan2(e.v.y,e.v.x),X(.035),game.power>0?'#5b4e86':e.alert>0?'#c84a4a':'#2a3f52',game.power>0?'#b8a6f0':e.alert>0?'#ffb0b0':'#d8e6ee');}
 for(const f of game.flash){g.strokeStyle=f.c;g.globalAlpha=f.t*2;g.lineWidth=3*dpr;g.beginPath();g.arc(X(f.x),X(f.y),X(.03+(.5-f.t)*.15),0,6.28);g.stroke();}g.globalAlpha=1;
 const b=game.buddy;tri(X(b.x),X(b.y),b.a+1.6,X(.018),b.mode==='taken'?'#6b2a2a':'#2a3f52',b.risk||b.mode==='taken'?'#ff9a9a':'#91dfd4');
 const p=game.player,beat=music?1+.15*Math.max(0,Math.cos(t*Math.PI*2*(music.tempo||100)/60)):1,hid=hidden();
 g.beginPath();g.arc(X(p.x),X(p.y),X(.022)*beat,0,6.28);g.fillStyle=game.invuln>0&&Math.floor(t*12)%2?'#ffffff33':game.power>0?'#f6e27a':hid?'#7ce3dd66':'#7ce3dd';g.fill();g.strokeStyle='#e5f0f5';g.lineWidth=2*dpr;g.stroke();
 // Heads-up display.
 g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle='#e5f0f5';g.font=`${13*dpr}px ui-monospace,monospace`;
 const food=game.items.filter(i=>i.food).length;
 g.fillText(`L${game.level+1} ${L.name}  ${game.score} pts  ${L.exit==='clear'?(food?`${L.food[0]} ${food}`:`${L.chest||'💰'} open`):`exit ${({right:'→',left:'←',top:'↑',bottom:'↓'})[L.exit]}`}`,14*dpr,24*dpr);
 g.fillStyle='#ffffff22';g.fillRect(14*dpr,32*dpr,w*.3,7*dpr);g.fillStyle=game.health<.3?'#ff7a7a':'#91dfd4';g.fillRect(14*dpr,32*dpr,w*.3*game.health,7*dpr);
 if(game.power>0){g.fillStyle='#f6e27a';g.fillRect(14*dpr,42*dpr,w*.3*game.power/7,4*dpr);}
 const notes=[hid&&!inHouse(p)?'hidden':'',trap?'TRAPPED':'',game.buddy.mode==='taken'?'companion taken':game.buddy.risk?'companion in danger':game.buddy.mode==='away'?'companion wandered':'',game.calm>0?`peace ${Math.ceil(game.calm)} s`:''].filter(Boolean);
 if(notes.length){g.fillStyle=trap?'#ff9a9a':'#7ce3dd';g.fillText(notes.join(' · '),14*dpr,62*dpr);}
 if(game.toast?.t>0){g.globalAlpha=Math.min(1,game.toast.t);g.textAlign='center';g.font=`${16*dpr}px system-ui,sans-serif`;g.fillStyle='#000a';const tw=g.measureText(game.toast.text).width+24*dpr;g.fillRect(w/2-tw/2,h*.42-22*dpr,tw,34*dpr);g.fillStyle='#fff';g.fillText(game.toast.text,w/2,h*.42);g.globalAlpha=1;g.textAlign='left';}
 if(game.over>0){g.fillStyle='#000a';g.fillRect(0,0,w,h);g.fillStyle='#ffd0d0';g.font=`${28*dpr}px system-ui,sans-serif`;g.textAlign='center';g.fillText('Caught',w/2,h/2);g.textAlign='left';}
 if(loading){g.fillStyle='#e5f0f5';g.font=`${12*dpr}px ui-monospace,monospace`;g.fillText('loading music…',14*dpr,h-12*dpr);}
}

// ---- Loop ----
let sent={};function ctl(id,key,v){const k=id+key;if(Math.abs((sent[k]??-9)-v)<.02)return;sent[k]=v;music.control(id,key,v);}
function frame(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;
 step(dt);draw();
 if(music&&!loading){const s=musicState();music.set(s);
  ctl('heart','level',game.health<.6?Math.min(1.3,(.6-game.health)/.6*1.5):s.trapped?.9:0);
  ctl('energy','level',.8+.6*s.threat);
  ctl('scene','muffle',s.safe?.55:0);// heard through the house walls
  $('#meters').innerHTML=`Threat <b>${Math.round(s.threat*100)}%</b> · Health <b>${Math.round(game.health*100)}%</b>${s.power?' · <b>Power</b>':''}${s.safe?' · <b>Sheltered</b>':''}${s.trapped?' · <b>Trapped</b>':''} · <b>${game.L.name}</b>`;}
 requestAnimationFrame(frame);
}

$('#start').onclick=async()=>{
 const b=$('#start');
 if(music){if(!b.dataset.paused){music.pause();b.dataset.paused='1';b.textContent='▶ Resume music';}else{music.resume();delete b.dataset.paused;b.textContent='❚❚ Pause music';}return;}
 b.disabled=true;b.textContent='Loading instruments…';if(narrow&&!document.body.classList.contains('gm-full'))$('#play').scrollIntoView({behavior:'smooth',block:'start'});
 await startMusic(game.level);b.disabled=false;if(music)b.textContent='❚❚ Pause music';
};
// Full screen: the play area fills the screen; the page underneath cannot scroll or be selected.
function setFull(on){
 document.body.classList.toggle('gm-full',on);relayout(on?clamp(innerHeight/innerWidth,.5,1.9):BASE_H);$('#full').textContent=on?'✕ Exit full screen':'⛶ Full screen';
 if(on&&document.documentElement.requestFullscreen&&!document.fullscreenElement)document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{});
 if(!on&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});
}
$('#full').onclick=()=>setFull(!document.body.classList.contains('gm-full'));
$('#fullExit').onclick=()=>setFull(false);
$('#fullMusic').onclick=()=>$('#start').click();
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.body.classList.contains('gm-full'))setFull(false);});
addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')||'wasd'.includes(e.key)){keys[e.key]=true;$('#auto').checked=false;if(e.key.startsWith('Arrow'))e.preventDefault();}if(e.key==='f')setFull(!document.body.classList.contains('gm-full'));});
addEventListener('keyup',e=>{keys[e.key]=false;});
// Mouse: hold where you want to go. Touch: a relative trackpad anywhere on the play area, so a thumb
// brushes in a direction instead of covering the view. Faster finger movement raises top speed; on
// release, a swipe adds an impulse that is the product of its speed and its length.
const toField=e=>{const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*Hgt};};
const play=$('#play');let touch=null;
play.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,label'))return;try{play.setPointerCapture(e.pointerId);}catch{}$('#auto').checked=false;
 if(e.pointerType==='mouse'){if(e.target===cv)target=toField(e);return;}
 touch={id:e.pointerId,ox:e.clientX,oy:e.clientY,sx:e.clientX,sy:e.clientY,t:performance.now(),lx:e.clientX,ly:e.clientY,lt:performance.now(),speed:0};e.preventDefault();});
play.addEventListener('pointermove',e=>{
 if(e.pointerType==='mouse'){if(e.buttons&&e.target===cv)target=toField(e);return;}
 if(!touch||e.pointerId!==touch.id)return;const now=performance.now(),inst=Math.hypot(e.clientX-touch.lx,e.clientY-touch.ly)/Math.max(1,now-touch.lt)*1000;
 touch.speed=touch.speed*.7+inst*.3;touch.lx=e.clientX;touch.ly=e.clientY;touch.lt=now;
 let dx=e.clientX-touch.ox,dy=e.clientY-touch.oy;const len=Math.hypot(dx,dy);
 if(len>60){touch.ox=e.clientX-dx*60/len;touch.oy=e.clientY-dy*60/len;dx*=60/len;dy*=60/len;}// the origin follows the thumb, so reversing is quick
 steer=len<5?null:{x:dx/60,y:dy/60,boost:1+Math.min(2,touch.speed/700)};e.preventDefault();});
const endTouch=e=>{if(e.pointerType==='mouse'){target=null;return;}if(!touch||e.pointerId!==touch.id)return;
 const dx=e.clientX-touch.sx,dy=e.clientY-touch.sy,dt=Math.max(16,performance.now()-touch.t),len=Math.hypot(dx,dy),speed=Math.max(touch.speed,len/dt*1000);
 if(len>20&&speed>250){const fl=clamp(len/90,.4,4),fs=clamp(speed/700,.4,4);dash={x:dx/len,y:dy/len,power:.22*fl*fs};}
 touch=null;steer=null;};
play.addEventListener('pointerup',endTouch);play.addEventListener('pointercancel',endTouch);
// Keep the page itself still while playing: no scrolling, zooming, text selection or long-press menus.
for(const ev of ['touchmove','gesturestart','dblclick','contextmenu','selectstart'])play.addEventListener(ev,e=>e.preventDefault(),{passive:false});
newLevel(0);requestAnimationFrame(frame);
window.adaptiveDemo={get levels(){return lastLevels;},get game(){return game;},get music(){return music;},LEVELS,levelMusic,makePlan,startMusic,setFull,
 jump(n){newLevel(n,game.score,game.health);if(music)startMusic(n);}};
