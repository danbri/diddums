// Adaptive music demo: a small stealth/collect game whose live state drives an endless Diddums score.
// Arrangement changes land on the next bar line; game events answer within a 16th note, in key.
// Characters follow Heider and Simmel's 1944 animation: a small circle (you), big triangles (hunters),
// a small triangle (your companion) and a house with a door.
import {startAdaptive} from './adaptive.js';
import {compositionFromSong} from './song.js';

const $=s=>document.querySelector(s);
const song={title:'Adaptive night',bpm:100,meter:'4/4',key:'A minor',rhythm:'none',seconds:600,room:.6,chords:[1,6,3,7],
 tracks:[
  {id:'drone',sound:'voidDrone',label:'Low drone'},{id:'wind',sound:'wind',label:'Wind',level:.2},
  {id:'sub',sound:'subBass',label:'Sub bass'},{id:'pad',sound:'nebulaPad',label:'Pad'},{id:'bells',sound:'bells',label:'Bell melody'},
  {id:'acid',sound:'acidLine',label:'Acid bass'},{id:'stabs',sound:'brassStabs',label:'Brass stabs'},{id:'arp',sound:'arpeggiator',label:'Arpeggio'},
  {id:'saw',sound:'chromeLead',label:'Saw lead'},{id:'heart',sound:'heartbeat',label:'Heartbeat',level:1},
  {id:'iso',sound:'koto',role:'ostinato',hits:5,cycle:7,label:'Koto isorhythm',level:.4},{id:'phase',sound:'marimba',role:'phase',label:'Phasing marimba',level:.35},
  {id:'cloud',sound:'starfield',role:'cloud',label:'Bell cloud',level:.3},
  // Event voices: never in the arrangement, only played by music.hit().
  {id:'chime',sound:'celesta',label:'Pickup chime',level:.55,role:'timeline',seq:'.'},{id:'alarm',sound:'sonarBlup',label:'Alarm',level:.5,role:'timeline',seq:'.'},
  {id:'boom',sound:'timpani',label:'Impact',level:.9,role:'timeline',seq:'.'}]};
const composition=compositionFromSong(song);
const LABEL=Object.fromEntries(song.tracks.map(t=>[t.id,t.label]));
const MUSIC_TRACKS=song.tracks.filter(t=>t.role!=='timeline').map(t=>t.id);

// Each level brings a different musical idiom, not just a new key: scale, chord progressions, drum
// patterns, a characteristic process layer, and melodies written in scale degrees.
const STYLES=[
 {name:'Night synth',key:'A minor',ch:{calm:[1,6,3,7],chase:[1,7,6,7],hero:[1,6,7,1],dread:[1,2,1,7]},drums:['ritual','broken','postpunk','factory'],extra:null},
 {name:'Hijaz',key:'D hijaz',ch:{calm:[1,2,1,7],chase:[1,4,2,1],hero:[1,7,1,4],dread:[1,2,2,1]},drums:['none','clave','clave','dembow'],extra:'iso'},
 {name:'Pentatonic phase',key:'E yo',ch:{calm:[1],chase:[1,4],hero:[1,3,4,1],dread:[1,2]},drums:['none','bembe','bembe','amen'],extra:'phase'},
 {name:'Octatonic',key:'F octatonic',ch:{calm:[1,5],chase:[1,3,5,7],hero:[1,3],dread:[1,2,1,2]},drums:['ritual','euclid','amen','amen'],extra:'iso'},
 {name:'Whole-tone',key:'C wholetone',ch:{calm:[1,2],chase:[1,2,3,4],hero:[1,3,5],dread:[1,4]},drums:['none','halftime','broken','factory'],extra:'cloud'},
 {name:'Pelog',key:'G pelog',ch:{calm:[1,4],chase:[1,4,5,1],hero:[1,5,4,1],dread:[1,2,1,2]},drums:['none','bembe','bembe','seven'],extra:'phase'}];
// Melody contours in scale degrees (null = rest); converted per scale so every idiom stays in its own notes.
const CONTOUR={calm:[0,null,2,null,4,null,3,2,0,null,-1,null,-3,null,-1,null],chase:[0,2,4,2,0,2,4,6,7,6,4,2,3,2,0,-1],
 hero:[0,null,4,null,7,null,6,4,7,null,8,7,4,null,6,null],dread:[0,null,null,1,0,null,null,null,-1,null,null,-3,null,null,-2,null]};
const SCALES={minor:[0,2,3,5,7,8,10],hijaz:[0,1,4,5,7,8,10],yo:[0,2,5,7,9],octatonic:[0,2,3,5,6,8,9,11],wholetone:[0,2,4,6,8,10],pelog:[0,1,3,7,8]};
const degree=(scale,d)=>d==null?null:12+scale[((d%scale.length)+scale.length)%scale.length]+12*Math.floor(d/scale.length);
const STYLE_DATA=STYLES.map(s=>{const scale=SCALES[s.key.split(' ')[1]],h={},m={};for(const k in s.ch){h[k]=compositionFromSong({...song,key:s.key,chords:s.ch[k]}).harmony;m[k]=CONTOUR[k].map(d=>degree(scale,d));}return {...s,scale,h,m};});
// The notes you collect become the tune: k notes spread evenly over the bar (doubled an octave up when hunted).
function motifMelody(scale,motif,busy){const k=motif.length,out=Array(16).fill(null);motif.forEach((d,i)=>{out[Math.floor(i*16/k)]=degree(scale,d);});if(busy)motif.forEach((d,i)=>{const at=Math.floor(i*16/k+8/k);if(at<16&&out[at]==null)out[at]=degree(scale,d+7);});return out;}
const B={calm:[0,null,0,null,7,null,0,3,0,null,0,null,10,null,7,null],drive:[0,0,12,0,0,0,10,0,0,0,12,0,7,0,10,0],dread:[0,null,null,null,1,null,null,null,0,null,null,null,null,null,1,null]};

// Game state → arrangement. Continuous inputs cross thresholds track by track.
function plan({threat=0,health=1,power=false,level=0,safe=false,progress=0,motif=[]}){
 const st=STYLE_DATA[level%STYLE_DATA.length],q=x=>Math.round(x*10)/10,T=safe?0:q(threat),Hh=Math.round(health*4)/4,low=Hh<=.25,hurt=Hh<=.5;
 const L=new Set(['wind','heart']);
 if(T<.3&&!power)L.add('drone');if(st.extra&&T<.6)L.add(st.extra);else if(T<.4&&!power)L.add('iso');
 if(!low)L.add('pad');else L.add('drone');
 if(T>=.2&&T<.6)L.add('sub');if(T>=.6||power)L.add('acid');
 if(T<.5&&!hurt&&!power)L.add('bells');
 if(T>=.4)L.add('arp');
 if((T>=.7&&!hurt)||power)L.add('stabs');
 if(power||(T>=.6&&!hurt))L.add('saw');
 // Progress through the level: your motif joins as a phasing marimba at half way, a bell shimmer at three quarters.
 if(progress>=.5&&T<.6)L.add('phase');if(progress>=.75&&T<.6)L.add('cloud');
 const mood=power?'hero':low&&T>=.3?'dread':T>=.5?'chase':'calm';
 const rhythm=power?'house':low&&T>=.3?'halftime':T<.15?'none':st.drums[T<.35?0:T<.55?1:T<.75?2:3];
 return {name:`${safe?'Sheltered':power?'Power':mood==='dread'?'Desperate':T>=.5?'Hunted':T>=.2?'Watched':'Unseen'} · ${st.name}`,rhythm,
  energy:q(Math.min(1,.25+.7*T+.2*progress+(power?.15:0))*(low?.8:1)),harmony:st.h[mood],melody:motif.length>=2&&(mood==='calm'||mood==='chase')?motifMelody(st.scale,motif.slice(-8),mood==='chase'):st.m[mood],
  bass:mood==='dread'?B.dread:T>=.5||power?B.drive:B.calm,layers:[...L]};
}

// ---- Game ----
const narrow=innerWidth<720,W=1,Hgt=narrow?1.05:.62,cv=$('#arena'),g=cv.getContext('2d');
cv.style.aspectRatio=`${W} / ${Hgt}`;
const FRUIT=['🍒','🍓','🍊','🍋','🍑','🍍','🍉','🍇'];
const rnd=(a,b)=>a+Math.random()*(b-a),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
let steer=null,dash=null,lastLevels={},game,music=null,lastPlan=null,keys={},target=null,last=performance.now();
const HOUSE={x:.06,y:Hgt-.26,w:.22,h:.2,door:.07};// open door on the right wall
const inHouse=p=>p.x>HOUSE.x&&p.x<HOUSE.x+HOUSE.w&&p.y>HOUSE.y&&p.y<HOUSE.y+HOUSE.h;
function free(r=.05){for(let i=0;i<50;i++){const p={x:rnd(.06,.94),y:rnd(.06,Hgt-.06)};if(!inHouse({x:p.x+r,y:p.y})&&!inHouse(p)&&!inHouse({x:p.x-r,y:p.y}))return p;}return {x:.6,y:.3};}
function newLevel(level,keepScore=0,health=1){
 const n=6+level*2;
 game={got:[],total:n+2,level,score:keepScore,health,power:0,combo:0,comboAt:0,invuln:0,over:0,player:{x:HOUSE.x+HOUSE.w/2,y:HOUSE.y+HOUSE.h/2},ally:{x:HOUSE.x+.05,y:HOUSE.y+.05,a:0},
  items:[...Array.from({length:n},()=>({...free(),kind:'🍄'})),...Array.from({length:2},()=>({...free(),kind:'💎'})),{...free(),kind:'⭐'}],chest:null,
  trees:Array.from({length:4},()=>({...free(.1),r:.05})),enemies:Array.from({length:2+level},()=>spawnEnemy()),flash:[]};
}
function spawnEnemy(){const p=free();return {x:p.x,y:Math.min(p.y,Hgt*.5),a:rnd(0,6.28),vx:0,vy:0,alert:0,dead:0};}
const hidden=()=>inHouse(game.player)||game.trees.some(t=>dist(game.player,t)<t.r);
function threat(){
 if(inHouse(game.player))return 0;const p=game.player;let t=0,near=9;
 for(const e of game.enemies){if(e.dead)continue;if(e.alert>0)t+=.25;near=Math.min(near,dist(p,e));}
 return Math.min(1,t+Math.max(0,(.3-near)/.3)*.35);
}
function say(text){const l=$('#log');l.innerHTML=(text+'\n'+l.innerHTML).split('\n').slice(0,40).join('\n');}
const hit=(track,opts)=>music?.hit(track,opts);
function wallBlock(o,r){// keep hunters out of the house: push them out through the nearest wall
 if(o.x>HOUSE.x-r&&o.x<HOUSE.x+HOUSE.w+r&&o.y>HOUSE.y-r&&o.y<HOUSE.y+HOUSE.h+r){
  const dl=o.x-(HOUSE.x-r),dr=HOUSE.x+HOUSE.w+r-o.x,dt=o.y-(HOUSE.y-r),db=HOUSE.y+HOUSE.h+r-o.y,m=Math.min(dl,dr,dt,db);
  if(m===dl)o.x=HOUSE.x-r;else if(m===dr)o.x=HOUSE.x+HOUSE.w+r;else if(m===dt)o.y=HOUSE.y-r;else o.y=HOUSE.y+HOUSE.h+r;}}

function step(dt){
 const p=game.player;
 if(game.over>0){game.over-=dt;if(game.over<=0){newLevel(0);say('<b>New game</b>');}return;}
 let vx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),vy=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);
 let gain=1;
 if($('#auto').checked){const a=autopilot();vx=a.x;vy=a.y;}
 else if(steer&&!vx&&!vy){vx=steer.x;vy=steer.y;gain=Math.min(1,Math.hypot(vx,vy));}
 else if(target&&!vx&&!vy){vx=target.x-p.x;vy=target.y-p.y;if(Math.hypot(vx,vy)<.01)vx=vy=0;}
 // Inertia: input sets a target velocity; the player accelerates towards it and coasts when let go.
 // A flick is an impulse added to the velocity, not a jump, so it carries the player's weight.
 const m=Math.hypot(vx,vy)||1,sp=.3*gain,moving=vx||vy?1:0,pv=p.v||(p.v={x:0,y:0});
 const want={x:vx/m*sp*moving,y:vy/m*sp*moving},k=1-Math.exp(-dt*(moving?3.2:1.8));
 pv.x+=(want.x-pv.x)*k;pv.y+=(want.y-pv.y)*k;
 if(dash){pv.x+=dash.x*.5;pv.y+=dash.y*.5;dash=null;}
 const top=.62,s=Math.hypot(pv.x,pv.y);if(s>top){pv.x*=top/s;pv.y*=top/s;}
 p.x+=pv.x*dt;p.y+=pv.y*dt;
 if(p.x<.02||p.x>W-.02){pv.x*=-.35;p.x=Math.max(.02,Math.min(W-.02,p.x));}// soft bounce off the edges
 if(p.y<.02||p.y>Hgt-.02){pv.y*=-.35;p.y=Math.max(.02,Math.min(Hgt-.02,p.y));}
 game.power=Math.max(0,game.power-dt);game.invuln=Math.max(0,game.invuln-dt);
 if(game.power>0&&game.power<dt*1.01)hit('chime',{tones:[2,1,0],spread:2,velocity:.5});
 // Companion: circles you and stays close, like the small triangle in the film.
 const al=game.ally;al.a+=dt*2.2;const tx=p.x+Math.cos(al.a)*.05,ty=p.y+Math.sin(al.a)*.05;al.x+=(tx-al.x)*Math.min(1,dt*4);al.y+=(ty-al.y)*Math.min(1,dt*4);
 for(const it of [...game.items])if(dist(p,it)<.04){game.items.splice(game.items.indexOf(it),1);
  if(it.kind==='⭐'){game.power=7;hit('chime',{tones:[0,1,2,4],octave:1});hit('boom',{tones:[0],octave:-1});say('<b>Star</b>: the hunters can be knocked out for 7 s');}
  else{game.combo=performance.now()-game.comboAt<1800?game.combo+1:0;game.comboAt=performance.now();const gem=it.kind==='💎';game.score+=(gem?50:10)*(1+game.combo);
   // Each pickup plays a chord tone and keeps it, as a scale degree, for the motif the music is built from.
   // The field is a keyboard: a mushroom's note rises from left to right; quick runs climb from the last note.
   const k=game.combo>0?Math.min(7,(game.lastK??0)+1):Math.round(it.x*5);game.lastK=k;const deg=x=>[0,2,4,6][x%4]+7*Math.floor(x/4);
   hit('chime',gem?{tones:[k,k+2],octave:1,spread:1}:{tones:[k],octave:1,velocity:.7+.04*Math.min(6,game.combo)});game.got.push(deg(k));if(gem)game.got.push(deg(k+2));}
  game.flash.push({x:it.x,y:it.y,t:.4,c:'#7ce3dd'});}
 if(!game.chest&&!game.items.some(i=>i.kind==='🍄')){game.chest={...free(),kind:'💰'};hit('chime',{tones:[0,2,4],octave:1,grid:4,velocity:.6});say('A <b>treasure chest</b> has appeared');}
 if(game.chest&&dist(p,game.chest)<.045){hit('chime',{tones:[0,1,2,4,5,6],octave:1,velocity:.85});hit('boom',{tones:[0,0],octave:-1,spread:4});game.score+=200;
  const next=STYLES[(game.level+1)%STYLES.length];say(`<b>Level ${game.level+2}</b>: ${next.name} (${next.key}), one more hunter`);newLevel(game.level+1,game.score,game.health);return;}
 // Bonus fruit, as in Pac-Man: appears now and then for eight seconds, worth more each level.
 game.fruitIn=(game.fruitIn??rnd(10,18))-dt;
 if(!game.fruit&&game.fruitIn<=0){game.fruit={...free(),kind:FRUIT[game.level%FRUIT.length],life:8};game.fruitIn=rnd(16,26);}
 if(game.fruit){game.fruit.life-=dt;if(game.fruit.life<=0)game.fruit=null;
  else if(dist(p,game.fruit)<.045){const v=100*(game.level+1);game.score+=v;hit('chime',{tones:[0,2,4,6,7],octave:1,velocity:.75});hit('boom',{tones:[0],velocity:.5});game.flash.push({x:game.fruit.x,y:game.fruit.y,t:.5,c:'#f6e27a'});say(`${game.fruit.kind} +${v}`);game.fruit=null;}}
 const isHidden=hidden();
 for(const e of game.enemies){
  if(e.dead){e.dead-=dt;if(e.dead<=0)Object.assign(e,spawnEnemy());continue;}
  const d=dist(p,e),sight=.2+.015*game.level;
  if(d<sight&&!isHidden&&game.power<=0){if(e.alert<=0){hit('alarm',{tones:[0],octave:1,grid:2,velocity:.7});game.flash.push({x:e.x,y:e.y,t:.5,c:'#edbc74'});}e.alert=2.2;}else e.alert=Math.max(0,e.alert-dt);
  let ax,ay,spd;
  if(game.power>0){ax=e.x-p.x;ay=e.y-p.y;spd=.15;}
  else if(e.alert>0&&!inHouse(p)){ax=p.x-e.x;ay=p.y-e.y;spd=(.15+.012*game.level)*(1+.6*Math.max(0,Math.sin(performance.now()/180)));}// lunging
  else{e.a+=rnd(-2,2)*dt;ax=Math.cos(e.a);ay=Math.sin(e.a);spd=.06;}
  const am=Math.hypot(ax,ay)||1;e.vx=ax/am*spd;e.vy=ay/am*spd;e.x+=e.vx*dt;e.y+=e.vy*dt;
  if(e.x<.03||e.x>W-.03)e.a=Math.PI-e.a;if(e.y<.03||e.y>Hgt-.03)e.a=-e.a;e.x=Math.max(.03,Math.min(W-.03,e.x));e.y=Math.max(.03,Math.min(Hgt-.03,e.y));wallBlock(e,.03);
  if(d<.045){
   if(game.power>0){e.dead=6;e.alert=0;game.score+=50;hit('boom',{tones:[2],velocity:.6});hit('chime',{tones:[4,6],octave:1,spread:1,velocity:.6});game.flash.push({x:e.x,y:e.y,t:.5,c:'#ba96f0'});}
   else if(game.invuln<=0){game.health=Math.max(0,game.health-.15);game.invuln=1.5;hit('boom',{tones:[0],octave:-1,velocity:1});const k=d||1;p.v=p.v||{x:0,y:0};p.v.x+=(p.x-e.x)/k*.5;p.v.y+=(p.y-e.y)/k*.5;game.flash.push({x:p.x,y:p.y,t:.5,c:'#ff7a7a'});
    if(game.health<=0){game.over=4;hit('boom',{tones:[0,-1,-2,-4],octave:-1,spread:3,velocity:1});hit('chime',{tones:[3,2,1,0],spread:3,velocity:.6});say(`<b>Caught</b> on level ${game.level+1} with ${game.score} points`);}}
  }
 }
 if(inHouse(p))game.health=Math.min(1,game.health+dt*.12);else if(!game.enemies.some(e=>e.alert>0&&!e.dead))game.health=Math.min(1,game.health+dt*.04);
 for(const f of game.flash)f.t-=dt;game.flash=game.flash.filter(f=>f.t>0);
}
// Autopilot: shelter when badly hurt, use the star when hunted, otherwise collect, steering clear of hunters.
function autopilot(){
 const p=game.player,hunters=game.enemies.filter(e=>!e.dead&&(e.alert>0||dist(p,e)<.15)),star=game.items.find(i=>i.kind==='⭐');
 let goal;
 if(game.health<.35&&game.power<=0)goal=inHouse(p)?{x:p.x,y:p.y}:{x:HOUSE.x+HOUSE.w+.02,y:HOUSE.y+HOUSE.h/2,door:true};
 else if(game.power>0)goal=game.enemies.filter(e=>!e.dead).sort((a,b)=>dist(p,a)-dist(p,b))[0];
 else if(hunters.length&&star)goal=star;
 else goal=game.chest||game.items.filter(i=>i.kind!=='⭐').sort((a,b)=>dist(p,a)-dist(p,b))[0];
 if(goal?.door&&Math.abs(p.y-goal.y)<.03&&p.x<HOUSE.x+HOUSE.w+.04)goal={x:HOUSE.x+HOUSE.w/2,y:goal.y};
 if(!goal)return {x:0,y:0};let x=goal.x-p.x,y=goal.y-p.y;const m=Math.hypot(x,y)||1;x/=m;y/=m;
 if(game.power<=0)for(const e of hunters){const d=dist(p,e)||1,w=.1/(d*d);x+=(p.x-e.x)/d*w;y+=(p.y-e.y)/d*w;}
 return {x,y};
}

function tri(x,y,a,r,fill,stroke){g.beginPath();for(let i=0;i<3;i++){const k=a+(i===0?0:i===1?2.5:-2.5),rr=i===0?r*1.4:r;g.lineTo(x+Math.cos(k)*rr,y+Math.sin(k)*rr);}g.closePath();g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}
function draw(){
 const dpr=Math.min(2,devicePixelRatio||1),r=cv.getBoundingClientRect(),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(cv.width!==w)cv.width=w;if(cv.height!==h)cv.height=h;
 const S=w/W,X=v=>v*S,t=performance.now()/1000,th=threat();
 g.fillStyle=game.power>0?'#1f1838':`rgb(${12+40*th},${24-8*th},${36-14*th})`;g.fillRect(0,0,w,h);
 // House: an open box with a door, as in the film.
 const hx=X(HOUSE.x),hy=X(HOUSE.y),hw=X(HOUSE.w),hh=X(HOUSE.h),door=X(HOUSE.door);
 g.fillStyle=inHouse(game.player)?'#7ce3dd18':'#ffffff08';g.fillRect(hx,hy,hw,hh);g.strokeStyle='#d8e6ee';g.lineWidth=3*dpr;g.beginPath();
 g.moveTo(hx+hw,hy+hh/2-door/2);g.lineTo(hx+hw,hy);g.lineTo(hx,hy);g.lineTo(hx,hy+hh);g.lineTo(hx+hw,hy+hh);g.lineTo(hx+hw,hy+hh/2+door/2);g.stroke();
 g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ffffff';
 const E=narrow?1.25:1;
 for(const tr of game.trees){g.font=`${X(.09*E)}px serif`;g.fillText('🌲',X(tr.x),X(tr.y));}
 if(game.fruit&&(game.fruit.life>2||Math.floor(t*6)%2)){g.font=`${X(.065*E)}px serif`;g.fillText(game.fruit.kind,X(game.fruit.x),X(game.fruit.y));}
 for(const it of [...game.items,...(game.chest?[game.chest]:[])]){const s=(it.kind==='🍄'?.05:it.kind==='💰'?.07:.055)*E;g.font=`${X(s)*(1+.08*Math.sin(t*4+it.x*20))}px serif`;g.fillText(it.kind,X(it.x),X(it.y));}
 for(const e of game.enemies){if(e.dead)continue;const sight=.2+.015*game.level;
  g.fillStyle=e.alert>0?'#ff7a7a14':'#ffffff07';g.beginPath();g.arc(X(e.x),X(e.y),X(sight),0,6.28);g.fill();
  tri(X(e.x),X(e.y),Math.atan2(e.vy,e.vx),X(.035),game.power>0?'#5b4e86':e.alert>0?'#c84a4a':'#2a3f52',game.power>0?'#b8a6f0':e.alert>0?'#ffb0b0':'#d8e6ee');}
 for(const f of game.flash){g.strokeStyle=f.c;g.globalAlpha=f.t*2;g.lineWidth=3*dpr;g.beginPath();g.arc(X(f.x),X(f.y),X(.03+(.5-f.t)*.15),0,6.28);g.stroke();}g.globalAlpha=1;
 const al=game.ally;tri(X(al.x),X(al.y),al.a+1.6,X(.018),'#2a3f52','#91dfd4');
 const p=game.player,beat=music?1+.15*Math.max(0,Math.cos(t*Math.PI*2*100/60)):1,hid=hidden();
 g.beginPath();g.arc(X(p.x),X(p.y),X(.022)*beat,0,6.28);g.fillStyle=game.invuln>0&&Math.floor(t*12)%2?'#ffffff33':game.power>0?'#f6e27a':hid?'#7ce3dd66':'#7ce3dd';g.fill();g.strokeStyle='#e5f0f5';g.lineWidth=2*dpr;g.stroke();
 g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle='#e5f0f5';g.font=`${13*dpr}px ui-monospace,monospace`;
 g.fillText(`LEVEL ${game.level+1} · ${STYLES[game.level%STYLES.length].name}   ${game.score} pts   🍄 ${game.items.filter(i=>i.kind==='🍄').length}`,10*dpr,20*dpr);
 g.fillStyle='#ffffff22';g.fillRect(10*dpr,28*dpr,w*.3,7*dpr);g.fillStyle=game.health<.3?'#ff7a7a':'#91dfd4';g.fillRect(10*dpr,28*dpr,w*.3*game.health,7*dpr);
 if(game.power>0){g.fillStyle='#f6e27a';g.fillRect(10*dpr,38*dpr,w*.3*game.power/7,4*dpr);}
 if(hid&&!inHouse(p)){g.fillStyle='#7ce3dd';g.fillText('hidden',10*dpr,56*dpr);}
 if(game.over>0){g.fillStyle='#000a';g.fillRect(0,0,w,h);g.fillStyle='#ffd0d0';g.font=`${28*dpr}px system-ui,sans-serif`;g.textAlign='center';g.fillText('Caught',w/2,h/2);g.textAlign='left';}
}

const sent={};function ctl(id,key,v){const k=id+key;if(Math.abs((sent[k]??-9)-v)<.02)return;sent[k]=v;music.control(id,key,v);}
function frame(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;
 step(dt);draw();
 if(music){const progress=Math.round(Math.min(1,game.got.length/game.total)*100)/100,s={threat:threat(),health:game.health,power:game.power>0,level:game.level,safe:inHouse(game.player),progress,motif:game.got.slice(-8)};music.set(s);
  ctl('pad','colour',.25+.55*progress);
  ctl('heart','level',game.health<.6?Math.min(1.3,(.6-game.health)/.6*1.5):0);
  ctl('energy','level',.8+.6*s.threat);
  $('#meters').innerHTML=`Threat <b>${Math.round(s.threat*100)}%</b> · Health <b>${Math.round(game.health*100)}%</b>${s.power?' · <b>Power</b>':''}${s.safe?' · <b>Sheltered</b>':''} · <b>${STYLES[game.level%STYLES.length].name}</b> (${STYLES[game.level%STYLES.length].key})`;}
 requestAnimationFrame(frame);
}
function renderLayers(p){
 const on=new Set(p.layers);
 $('#layers').innerHTML=MUSIC_TRACKS.map(id=>`<span data-id="${id}" class="${on.has(id)&&id!=='heart'?'on':''}">${LABEL[id]}<i></i></span>`).join('')+`<span data-id="drums" class="${p.rhythm!=='none'?'on':''}">Drums · ${p.rhythm}<i></i></span>`;
}

$('#start').onclick=async()=>{
 const b=$('#start');
 if(music){if(!b.dataset.paused){music.pause();b.dataset.paused='1';b.textContent='▶ Resume music';}else{music.resume();delete b.dataset.paused;b.textContent='❚❚ Pause music';}return;}
 b.disabled=true;b.textContent='Loading instruments…';if(narrow)$('#play').scrollIntoView({behavior:'smooth',block:'start'});
 try{
  music=await startAdaptive({composition,plan,state:{threat:0,health:1,power:false,level:0,safe:true},
   onBar:(bar,p)=>{$('#status').innerHTML=`Bar <b>${bar+1}</b> · <b>${p.name}</b> · energy ${p.energy} · drums ${p.rhythm}`;if(JSON.stringify(p)!==JSON.stringify(lastPlan)){lastPlan=p;renderLayers(p);say(`bar ${bar+1}: <b>${p.name}</b> → ${p.layers.filter(l=>l!=='heart'&&l!=='wind').map(l=>LABEL[l]).join(', ')}${p.rhythm!=='none'?', '+p.rhythm+' drums':''}`);}},
   onLevels:m=>{lastLevels=m;for(const s of document.querySelectorAll('#layers span')){const v=m[s.dataset.id]?.rms||0,w=v>0?Math.max(0,Math.min(1,(20*Math.log10(v)+60)/60)):0;s.querySelector('i').style.width=(w*100).toFixed(0)+'%';s.classList.toggle('on',w>.05||(lastPlan?.layers.includes(s.dataset.id)&&s.dataset.id!=='heart')||(s.dataset.id==='drums'&&lastPlan?.rhythm!=='none'));}}});
  b.textContent='❚❚ Pause music';
 }catch(e){b.textContent='Could not start: '+e.message;console.error(e);}finally{b.disabled=false;}
};
addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')||'wasd'.includes(e.key)){keys[e.key]=true;$('#auto').checked=false;if(e.key.startsWith('Arrow'))e.preventDefault();}});
addEventListener('keyup',e=>{keys[e.key]=false;});
// Mouse: hold where you want to go. Touch: a virtual trackpad anywhere on the play area (including the pad
// below the field), so a thumb brushes in a direction instead of covering the view; a quick swipe dashes.
const toField=e=>{const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*Hgt};};
const play=$('#play');let touch=null;
play.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,label'))return;try{play.setPointerCapture(e.pointerId);}catch{}$('#auto').checked=false;
 if(e.pointerType==='mouse'){if(e.target===cv)target=toField(e);return;}
 touch={id:e.pointerId,ox:e.clientX,oy:e.clientY,sx:e.clientX,sy:e.clientY,t:performance.now()};e.preventDefault();});
play.addEventListener('pointermove',e=>{
 if(e.pointerType==='mouse'){if(e.buttons&&e.target===cv)target=toField(e);return;}
 if(!touch||e.pointerId!==touch.id)return;let dx=e.clientX-touch.ox,dy=e.clientY-touch.oy;const len=Math.hypot(dx,dy);
 if(len>60){touch.ox=e.clientX-dx*60/len;touch.oy=e.clientY-dy*60/len;dx*=60/len;dy*=60/len;}// the origin follows the thumb, so reversing is quick
 steer=len<5?null:{x:dx/60,y:dy/60};e.preventDefault();});
const endTouch=e=>{if(e.pointerType==='mouse'){target=null;return;}if(!touch||e.pointerId!==touch.id)return;
 const dx=e.clientX-touch.sx,dy=e.clientY-touch.sy,dt=performance.now()-touch.t,len=Math.hypot(dx,dy);
 if(dt<220&&len>24){dash={x:dx/len,y:dy/len};}touch=null;steer=null;};
play.addEventListener('pointerup',endTouch);play.addEventListener('pointercancel',endTouch);
// Keep the page itself still while playing: no scrolling, zooming, text selection or long-press menus.
for(const ev of ['touchmove','gesturestart','dblclick','contextmenu','selectstart'])play.addEventListener(ev,e=>e.preventDefault(),{passive:false});
newLevel(0);requestAnimationFrame(frame);
window.adaptiveDemo={get levels(){return lastLevels;},get game(){return game;},get music(){return music;},plan,STYLES};
