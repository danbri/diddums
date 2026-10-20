// Characters in a scene: a conflict scene whose arrangement follows one intensity value, with
// characters entering in different states over it. Uses adaptive.js (character layers, motif
// treatments, wobble/drift, muffle, ducking, tempo, per-layer feel and transitions).
import {startAdaptive} from './adaptive.js';
import {compositionFromSong} from './song.js';

const $=s=>document.querySelector(s);
const song={title:'Conflict scene',bpm:112,meter:'4/4',key:'D minor',rhythm:'none',seconds:600,room:.5,chords:[1,6,3,7],
 tracks:[
  {id:'drone',sound:'voidDrone',label:'Drone',level:.35},{id:'pad',sound:'nebulaPad',label:'Pad',level:.35},
  {id:'bass',sound:'subBass',label:'Bass',level:.5},{id:'acid',sound:'acidLine',label:'Acid bass',level:.4},
  {id:'arp',sound:'arpeggiator',label:'Arpeggio',level:.25},{id:'stabs',sound:'brassStabs',label:'Brass stabs',level:.3},
  {id:'iso',sound:'koto',role:'ostinato',hits:5,cycle:7,label:'Koto',level:.3},
  // Character voices: played only by their characters.
  {id:'mentor',sound:'feltPiano',role:'lead',label:'Mentor',level:.7},
  {id:'rival',sound:'chromeLead',role:'lead',label:'Rival',level:.45},
  {id:'child',sound:'celesta',role:'lead',label:'Child',level:.6}]};
const composition=compositionFromSong(song);
const harmonyOf=chords=>compositionFromSong({...song,chords}).harmony;
const H={standoff:harmonyOf([1,6,1,7]),skirmish:harmonyOf([1,6,3,7]),battle:harmonyOf([1,7,6,7])};

// Scene plan: one intensity value → arrangement, drums, harmony and tempo.
function plan({intensity=.4,slow=false}){
 const x=Math.round(intensity*10)/10,stage=x<.3?'standoff':x<.7?'skirmish':'battle';
 const layers={standoff:['drone','pad','iso'],skirmish:['pad','bass','arp','iso'],battle:['acid','arp','stabs','pad']}[stage];
 const rhythm={standoff:x<.15?'none':'ritual',skirmish:'broken',battle:x<.9?'postpunk':'factory'}[stage];
 return {name:stage[0].toUpperCase()+stage.slice(1),layers,rhythm,energy:Math.min(1,.35+.65*x),harmony:H[stage],tempo:slow?72:Math.round(100+28*x),tempoRamp:slow?2:1};
}
const ORDER={Standoff:0,Skirmish:1,Battle:2};
const transitions=(prev,next)=>ORDER[next.name]>ORDER[prev.name]?{type:'fill',beats:2}:ORDER[next.name]<ORDER[prev.name]?{type:'crossfade',beats:4}:null;

const CHARACTERS={
 mentor:{track:'mentor',motif:[0,null,null,2,4,null,null,null,3,null,2,null,0,null,null,null],label:'Mentor',about:'Felt piano'},
 rival:{track:'rival',motif:[0,0,null,1,0,null,-2,null,0,null,3,null,2,1,0,null],label:'Rival',about:'Saw lead'},
 child:{track:'child',motif:[4,null,5,null,7,null,5,4,2,null,null,null,4,null,null,null],label:'Child',about:'Celesta'}};
const PRESETS={Ordinary:{power:.6,mood:0,stability:1,health:1},Powerless:{power:.1},Sad:{mood:-.9},Unstable:{stability:.2},Ill:{health:.2},'Sad and ill':{mood:-.8,health:.25},Triumphant:{power:1,mood:.8}};
const SLIDERS=[['power','Power',0,1],['mood','Mood',-1,1],['stability','Stability',0,1],['health','Health',0,1]];
const state=Object.fromEntries(Object.keys(CHARACTERS).map(k=>[k,{power:.6,mood:0,stability:1,health:1}]));
let music=null,levels={},spotlight=null,scene={intensity:.4,slow:false};

$('#chars').innerHTML=Object.entries(CHARACTERS).map(([id,c])=>`<section class="sc-card sc-char" data-char="${id}">
 <h2><i></i>${c.label} <small class="muted">${c.about}</small></h2>
 <div class="sc-buttons"><button type="button" data-enter="${id}">Enter</button><button type="button" data-spot="${id}" aria-pressed="false">Spotlight</button></div>
 ${SLIDERS.map(([k,l,a,b])=>`<div class="sc-row"><span>${l}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="0.05" value="${state[id][k]}"><output>${state[id][k]}</output></div>`).join('')}
 <div class="sc-buttons">${Object.keys(PRESETS).map(p=>`<button type="button" data-preset="${p}">${p}</button>`).join('')}</div>
 <div class="sc-meter" aria-hidden="true"><span data-meter="${id}"></span></div>
 <div class="sc-ops" data-ops="${id}"></div></section>`).join('');

// What the state table does to this character, in words.
function describe(ops){
 const parts=[];if(ops.mode)parts.push(`mode ${ops.mode}`);if(ops.augment)parts.push(`${ops.augment}× slower`);if(ops.fragment!=null)parts.push(`first ${ops.fragment} notes`);
 if(ops.octave)parts.push(`${ops.octave>0?'+':''}${ops.octave} octave`);if(ops.drop)parts.push(`drops ${Math.round(ops.drop*100)}%`);if(ops.role)parts.push(`role ${ops.role}`);
 if(ops.wobble?.depth)parts.push(`wobble ${ops.wobble.depth.toFixed(2)} st at ${ops.wobble.rate.toFixed(1)} Hz`);if(ops.drift)parts.push(`drift ${ops.drift.toFixed(2)} st`);
 if(ops.muffle)parts.push(`muffle ${ops.muffle.toFixed(2)}`);if(ops.looseness)parts.push(`±${Math.round(ops.looseness)} ms`);if(ops.rubato)parts.push(`rubato ${ops.rubato.toFixed(2)}`);
 if(ops.level&&Math.abs(ops.level-1)>.01)parts.push(`level ×${ops.level.toFixed(2)}`);return parts.join(' · ')||'plays its motif as written';
}
function refresh(id){
 const card=$(`[data-char="${id}"]`),present=music?.characters.includes(id);card.classList.toggle('present',!!present);
 card.querySelector('[data-enter]').textContent=present?'Leave':'Enter';
 for(const input of card.querySelectorAll('input[data-k]')){input.value=state[id][input.dataset.k];input.nextElementSibling.textContent=Number(input.value).toFixed(2);}
 card.querySelector('[data-ops]').textContent=music?describe(music.character(id).ops):'';
}
function applyState(id){if(music){music.setCharacter(id,state[id]);}refresh(id);}

$('#chars').addEventListener('input',e=>{const input=e.target.closest('input[data-k]');if(!input)return;const id=input.closest('[data-char]').dataset.char;state[id][input.dataset.k]=Number(input.value);applyState(id);});
$('#chars').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;const id=b.closest('[data-char]').dataset.char;
 if(!music){$('#status').textContent='Start the scene first.';return;}
 if(b.dataset.enter){if(music.characters.includes(id)){music.leave(id);if(spotlight===id)setSpot(null);}else music.enter(id,{state:state[id]});refresh(id);}
 else if(b.dataset.spot)setSpot(spotlight===id?null:id);
 else if(b.dataset.preset){state[id]={power:.6,mood:0,stability:1,health:1,...PRESETS[b.dataset.preset]};applyState(id);}
});
function setSpot(id){
 if(spotlight)music.duck({by:spotlight,targets:'scene',amount:0});spotlight=id;
 if(id)music.duck({by:id,targets:['scene','characters'],amount:.6,release:.4});
 for(const b of document.querySelectorAll('[data-spot]'))b.setAttribute('aria-pressed',String(b.dataset.spot===id));
}

$('#intensity').addEventListener('input',e=>{scene.intensity=Number(e.target.value);$('#intensityOut').textContent=scene.intensity.toFixed(2);music?.set(scene);});
$('#ambush').onclick=()=>{scene.intensity=1;$('#intensity').value=1;$('#intensityOut').textContent='1.00';music?.set(scene,{transition:'cut',beats:2});};
$('#wall').onclick=e=>{const on=e.target.getAttribute('aria-pressed')!=='true';e.target.setAttribute('aria-pressed',String(on));music?.control('scene','muffle',on?.85:0);};
$('#slow').onclick=e=>{scene.slow=e.target.getAttribute('aria-pressed')!=='true';e.target.setAttribute('aria-pressed',String(scene.slow));music?.set(scene);};

$('#start').onclick=async()=>{
 const b=$('#start');
 if(music){if(!b.dataset.paused){music.pause();b.dataset.paused='1';b.textContent='▶ Resume';}else{music.resume();delete b.dataset.paused;b.textContent='❚❚ Pause';}return;}
 b.disabled=true;b.textContent='Loading instruments…';
 try{
  music=await startAdaptive({composition,plan,state:scene,characters:CHARACTERS,transitions,
   onBar:(bar,p)=>{$('#status').innerHTML=`Bar <b>${bar+1}</b> · <b>${p.name}</b> · ${Math.round(music?.tempo??p.tempo)} bpm · drums ${p.rhythm}${music?.characters.length?' · on stage: '+music.characters.map(c=>CHARACTERS[c].label).join(', '):''}`;},
   onLevels:m=>{levels=m;const w=v=>v>0?Math.max(0,Math.min(1,(20*Math.log10(v)+60)/60)):0;$('#sceneMeter').style.width=(w(m.mix?.rms||0)*100).toFixed(0)+'%';for(const id of Object.keys(CHARACTERS)){const el=document.querySelector(`[data-meter="${id}"]`);if(el)el.style.width=(w(m[id]?.rms||0)*100).toFixed(0)+'%';}}});
  b.textContent='❚❚ Pause';for(const id of Object.keys(CHARACTERS))refresh(id);
 }catch(e){b.textContent='Could not start: '+e.message;console.error(e);}finally{b.disabled=false;}
};
window.sceneDemo={get music(){return music;},get levels(){return levels;},plan,state,scene};
