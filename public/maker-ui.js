// Labs: an AI assistant (any) writes a Song → play, tweak by touch, share. Experimental; mobile first.
import {sounds,soundById,soundCategories,familySound} from './sounds.js';
import {patterns} from './patterns.js';
import {AUTOMATABLE,GLOBAL_AUTOMATABLE,parseCurve} from './timeline.js';
import {compositionFromSong,checkSong,songLink,parseKey,keyName,modes,rhythms,MAX_TRACKS,resolveSound} from './song.js';
import {recipeFromPrompt,songFromRecipe,recipeFromSong,shareUrl} from './maker.js';
import {MODELS,composeWithClaude,chatPrompt,songFromReply,exampleSong} from './ai.js';
import {attachViz} from './viz.js';
import {formatDuration} from './collection.js';
import {SHOWCASE} from './showcase.js';
import {siteUrl} from './site-url.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch{}}};
const IDEAS=['A heartbeat that becomes a Sputnik beacon, then silence, then sonar locking on to something fast','Epic space opera ambience with radio chatter','Rain on a tin roof while a music box plays far away','Night ferry: engine hum, foghorn swells, a lonely melody','Underwater cathedral: slow choir, sonar, deep drones','Factory at dawn: a clanking rhythm that turns into techno','A lullaby for a robot that is learning to sing','Haunted radio: static, a whisper, a heartbeat, then nothing'];
const TONICS=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'],METERS=['4/4','3/4','5/4','6/8','7/8'];
const RANGE={level:[0,1.2],pan:[-1,1],send:[0,1],colour:[0,1],life:[.03,6],tune:[-12,12],master:[0,1.2],room:[0,.94],damp:[0,.94],wet:[0,.94],echo:[0,.94]};
const KEY_LABEL={level:'Volume',pan:'Pan',send:'Space',colour:'Tone',life:'Decay',tune:'Pitch',master:'Master',room:'Room size',damp:'Damping',wet:'Reverb',echo:'Echo'};
const roleLabel={bass:'bass line',drone:'drone',pad:'chords',long:'held chords',keys:'chord rhythm',stabs:'stabs',arp:'arpeggio',sequence:'step sequence',lead:'melody',sparse:'sparse melody',answer:'answers',air:'texture',continuous:'endless tone',speechVowel:'voice',speechConsonant:'consonants',timeline:'timed notes'};
const NOTE_FOR={roundBass:'C2',acidBass:'C2',heartbeat:'A1',orbitBlip:'B5',sonar:'C5',phantomRoot:'E2',kick:'C1',tom:'C2',hat:'C7'};

// ---- Finger-drawn automation: draw on the canvas, the curve becomes compact "value@seconds" text. ----
function simplify(points,eps){
 if(points.length<3)return points;
 let max=0,idx=0;const a=points[0],b=points.at(-1);
 for(let i=1;i<points.length-1;i++){const p=points[i],t=(p[0]-a[0])/Math.max(1e-9,b[0]-a[0]),d=Math.abs(p[1]-(a[1]+(b[1]-a[1])*t));if(d>max){max=d;idx=i;}}
 return max>eps?[...simplify(points.slice(0,idx+1),eps).slice(0,-1),...simplify(points.slice(idx),eps)]:[a,b];
}
const fmt=v=>String(Math.round(v*100)/100);
function curveEditor(host,{key,text,duration,marks=[],onChange}){
 const [lo,hi]=RANGE[key];
 host.innerHTML=`<canvas class="mk-curve" aria-label="Draw ${KEY_LABEL[key]} over time"></canvas><div class="mk-curve-row"><input type="text" spellcheck="false" autocapitalize="off" value="${esc(text||'')}" aria-label="${KEY_LABEL[key]} curve as value@seconds"><button type="button" data-clear>Clear</button></div><p class="mk-hint">Draw with your finger: left to right is time (0–${Math.round(duration)} s), up is more ${KEY_LABEL[key].toLowerCase()}. Or type points like <code>0@0 1@2.5</code>.</p>`;
 const cv=host.querySelector('canvas'),input=host.querySelector('input'),g=cv.getContext('2d');let drawing=null;
 const pts=()=>{try{return parseCurve(input.value);}catch{return [];}};
 function draw(){
  const dpr=Math.min(2,devicePixelRatio||1),r=cv.getBoundingClientRect();cv.width=Math.max(1,Math.round(r.width*dpr));cv.height=Math.max(1,Math.round(r.height*dpr));const w=cv.width,h=cv.height;
  const X=t=>t/duration*w,Y=v=>h-(v-lo)/(hi-lo)*h;g.clearRect(0,0,w,h);
  g.strokeStyle='#29495c';g.lineWidth=1;for(let i=1;i<4;i++){g.beginPath();g.moveTo(0,h*i/4);g.lineTo(w,h*i/4);g.stroke();}
  g.strokeStyle='#5d4f7a';g.setLineDash([4*dpr,4*dpr]);for(const m of marks){g.beginPath();g.moveTo(X(m),0);g.lineTo(X(m),h);g.stroke();}g.setLineDash([]);
  if(lo<0){g.strokeStyle='#3d6270';g.beginPath();g.moveTo(0,Y(0));g.lineTo(w,Y(0));g.stroke();}
  const p=drawing||pts();if(!p.length)return;
  g.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--amber').trim()||'#edbc74';g.lineWidth=2.5*dpr;g.beginPath();
  g.moveTo(0,Y(p[0][1]));for(const [t,v] of p)g.lineTo(X(t),Y(v));g.lineTo(w,Y(p.at(-1)[1]));g.stroke();
  if(!drawing){g.fillStyle=g.strokeStyle;for(const [t,v] of p){g.beginPath();g.arc(X(t),Y(v),3.5*dpr,0,Math.PI*2);g.fill();}}
 }
 const at=e=>{const r=cv.getBoundingClientRect();return [Math.max(0,Math.min(duration,(e.clientX-r.left)/r.width*duration)),Math.max(lo,Math.min(hi,hi-(e.clientY-r.top)/r.height*(hi-lo)))];};
 cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);drawing=[at(e)];draw();};
 cv.onpointermove=e=>{if(!drawing)return;const p=at(e);if(p[0]>=drawing.at(-1)[0])drawing.push(p);draw();};
 cv.onpointerup=cv.onpointercancel=()=>{if(!drawing)return;let eps=(hi-lo)*.015,s=simplify(drawing,eps);while(s.length>24){eps*=1.5;s=simplify(drawing,eps);}
  if(s.at(-1)[0]-s[0][0]<duration*.01)s=[s[0]];
  input.value=s.map(([t,v])=>`${fmt(v)}@${fmt(t)}`).join(' ');drawing=null;draw();onChange(input.value);};
 input.oninput=()=>{try{parseCurve(input.value);input.classList.remove('invalid');draw();onChange(input.value);}catch{input.classList.add('invalid');}};
 host.querySelector('[data-clear]').onclick=()=>{input.value='';draw();onChange('');};
 requestAnimationFrame(draw);
}

export function mountMaker(root,hooks){
 let song=hooks.initial?structuredClone(hooks.initial):(()=>{try{return JSON.parse(store.get('diddums.make.song'));}catch{return null;}})()||exampleSong(hooks.example());
 let composition=null,problems=[],open={},replacing=null,abort=null,undo=null,cat='',lastChat='';
 const settings={key:store.get('diddums.ai.key')||'',model:store.get('diddums.ai.model')||MODELS[0].id,remember:!!store.get('diddums.ai.key')};
 root.innerHTML=`
 <section class="mk-hero">
  <span class="eyebrow">LABS · EXPERIMENTAL</span>
  <h1>Sketch a piece with an AI assistant.</h1>
  <p>Describe what you want. An AI assistant of your choice writes a Diddums Song (a JSON score), which plays here and can be edited and shared as a link. The rest of Diddums does not use or need any AI service.</p>
  <div class="mk-ask">
   <textarea id="mkPrompt" rows="3" placeholder="${esc(IDEAS[0])}…" aria-label="Describe the music"></textarea>
   <div class="mk-ask-row"><label class="mk-check"><input type="checkbox" id="mkRefine"> Change the current track</label><button type="button" id="mkSettings" class="mk-icon" aria-label="AI settings" title="AI settings">⚙</button></div>
   <button type="button" id="mkViaApp" class="mk-primary">Copy prompt for any AI assistant</button>
   <div class="mk-alt"><button type="button" id="mkCompose">Use an Anthropic API key</button><button type="button" id="mkSketch">Quick sketch, no AI</button></div>
   <div id="mkStatus" class="mk-status" role="status" hidden><span class="mk-spinner" aria-hidden="true"></span><span id="mkStatusText"></span><button type="button" id="mkStop">Stop</button></div>
   <div id="mkApp" class="mk-app" hidden>
    <ol><li><b>The prompt is copied.</b> It describes the Diddums Song format and your request.</li><li><b>Paste it into the AI assistant you use</b> and send.</li><li><b>Copy the reply</b>, come back, and paste it below.</li></ol>
    <div class="mk-row"><button type="button" id="mkShareText" class="mk-btn">Share prompt…</button><button type="button" id="mkCopyAgain" class="mk-btn">Copy again</button></div>
    <textarea id="mkReply" rows="3" placeholder="Paste the assistant's reply here" aria-label="The assistant's reply"></textarea>
    <div class="mk-row"><button type="button" id="mkFromClipboard" class="mk-btn">Paste from clipboard</button><button type="button" id="mkUseReply" class="mk-btn primary">Use this song</button></div>
   </div>
  </div>
  <div class="mk-ideas" id="mkIdeas">${IDEAS.map(i=>`<button type="button" data-idea="${esc(i)}">${esc(i)}</button>`).join('')}</div>
 </section>
 <section class="mk-showcase" aria-label="Example pieces">
  <h2>Example pieces</h2>
  <p class="mk-hint">Each one is a complete Song carried in its link. Share sends that link as-is.</p>
  <ul id="mkShowcase" class="mk-showcase-list">${SHOWCASE.map((s,i)=>`<li class="mk-piece"><div class="mk-showcase-head"><b>${esc(s.title)}</b><small>${formatDuration(s.seconds||60)}</small></div>${s.description?`<p class="mk-hint">${esc(s.description)}</p>`:''}<div class="mk-row"><button type="button" class="mk-btn primary" data-play="${i}">▶ Play</button><button type="button" class="mk-btn" data-edit="${i}">Edit</button><button type="button" class="mk-btn" data-share="${i}">Share</button></div></li>`).join('')}</ul>
 </section>
 <section class="mk-song" aria-label="Your track">
  <div class="mk-bar">
   <canvas id="mkViz" class="mk-viz" aria-hidden="true"></canvas>
   <div class="mk-bar-title"><input id="mkTitle" aria-label="Title" maxlength="80"><small id="mkMeta"></small></div>
   <button type="button" id="mkPlay" class="mk-play" aria-label="Play this track">▶</button>
   <button type="button" id="mkShare" class="mk-share">Share</button>
  </div>
  <div id="mkProblems" class="mk-problems" hidden></div>
  <ol id="mkTracks" class="mk-tracks"></ol>
  <button type="button" id="mkAdd" class="mk-add">+ Add a sound</button>
  <details class="mk-details" id="mkDetailsBox"><summary>Tempo, key, length, words and whole-mix automation</summary><div id="mkDetails"></div></details>
  <div class="mk-more"><button type="button" id="mkRemix">Load the piece from Compose</button><button type="button" id="mkCopyJson">Copy song JSON</button><button type="button" id="mkNew">Start empty</button></div>
 </section>
 <dialog id="mkLibrary" class="mk-sheet" aria-label="Sound library">
  <div class="mk-sheet-head"><b id="mkLibTitle">Add a sound</b><button type="button" class="mk-icon" data-close aria-label="Close">✕</button></div>
  <input id="mkLibSearch" type="search" placeholder="Search ${sounds.length} sounds…" aria-label="Search sounds">
  <div class="mk-cats" id="mkCats"><button type="button" data-cat="" class="on">All</button>${soundCategories.map(c=>`<button type="button" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <div id="mkLibList" class="mk-lib"></div>
 </dialog>
 <dialog id="mkSettingsDialog" class="mk-sheet" aria-label="AI settings">
  <div class="mk-sheet-head"><b>Anthropic API key (optional)</b><button type="button" class="mk-icon" data-close aria-label="Close">✕</button></div>
  <p>Diddums calls the Claude API directly from this browser with your own Anthropic API key. The key is sent only to <code>api.anthropic.com</code>, and usage is billed to your Anthropic account. Get a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>.</p>
  <label class="mk-field">API key <input id="mkKey" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…"></label>
  <label class="mk-check"><input type="checkbox" id="mkRemember"> Remember the key on this device</label>
  <label class="mk-field">Model <select id="mkModel">${MODELS.map(m=>`<option value="${m.id}">${esc(m.label)}</option>`).join('')}</select></label>
  <div class="mk-row"><button type="button" id="mkSaveKey" class="mk-btn primary">Save</button><button type="button" id="mkForget" class="mk-btn">Forget key</button></div>
  <p class="mk-hint">No key needed otherwise: “Copy prompt for any AI assistant” works with whichever assistant you use.</p>
 </dialog>`;
 const $=s=>root.querySelector(s);
 const toast=(m,e)=>hooks.notify(m,e);
 const save=()=>store.set('diddums.make.song',JSON.stringify(song));
 const viz=attachViz($('#mkViz'),hooks.analyser,{mode:'line'});

 function rebuild(){
  const r=checkSong(song);composition=r.composition;problems=r.problems;
  const box=$('#mkProblems');box.hidden=!problems.length;box.innerHTML=problems.length?`<b>Some parts cannot play yet</b><ul>${problems.slice(0,6).map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:'';
  const voices=composition?composition.tracks.reduce((n,t)=>n+(t.pair?2:1),0):0;
  $('#mkMeta').textContent=composition?`${formatDuration(composition.seconds)} · ${composition.key} · ${composition.bpm} BPM · ${voices}/${MAX_TRACKS} voices`:'';
  $('#mkAdd').disabled=voices>=MAX_TRACKS;
  save();
 }
 const dur=()=>Math.max(4,composition?.seconds||60);
 const marks=()=>composition?composition.sections.slice(1).map(s=>s.start*composition.meter[0]*4/composition.meter[1]*60/composition.bpm):[];
 function trackKind(t){const r=resolveSound(t.sound),role=t.seq?'timeline':t.role||r?.preset?.role||'lead';return {r,role,name:t.label||r?.preset?.label||patterns[r?.family]?.label||t.sound};}

 function renderTracks(){
  const list=song.tracks||[];
  $('#mkTracks').innerHTML=list.map((t,i)=>{
   const {r,role,name}=trackKind(t),o=open[i]||'',lvl=t.level??r?.preset?.level??.4,auto=Object.keys(t.automate||{}).length;
   return `<li class="mk-card${r?'':' bad'}" data-i="${i}">
    <div class="mk-card-head">
     <button type="button" class="mk-sound" data-act="swap" aria-label="Change sound for ${esc(name)}"><b>${esc(name)}</b><small>${esc(roleLabel[role]||role)} · ${esc(patterns[r?.family]?.label||'unknown sound')}</small></button>
     <button type="button" class="mk-icon" data-act="preview" aria-label="Preview ${esc(name)}">▶</button>
     <button type="button" class="mk-icon" data-act="remove" aria-label="Remove ${esc(name)}">✕</button>
    </div>
    <input type="range" min="0" max="1.2" step="0.01" value="${lvl}" data-act="level" aria-label="Volume of ${esc(name)}">
    <div class="mk-chips">
     <button type="button" data-act="pair" aria-pressed="${!!t.pair}">Stereo</button>
     <button type="button" data-open="animate" aria-expanded="${o==='animate'}">Animate${auto?` · ${auto}`:''}</button>
     <button type="button" data-open="notes" aria-expanded="${o==='notes'}">${t.seq?'Notes':'Write notes'}</button>
     <button type="button" data-open="tone" aria-expanded="${o==='tone'}">Tone</button>
    </div>
    <div class="mk-panel" data-panel></div>
   </li>`;}).join('')||'<li class="mk-empty">No sounds yet. Paste a song from an AI assistant above, or add a sound.</li>';
  for(const li of root.querySelectorAll('.mk-card'))renderPanel(li,+li.dataset.i);
 }
 function renderPanel(li,i){
  const t=song.tracks[i],host=li.querySelector('[data-panel]'),which=open[i];host.hidden=!which;if(!which){host.innerHTML='';return;}
  if(which==='animate'){
   const key=open['k'+i]||Object.keys(t.automate||{})[0]||'level';
   host.innerHTML=`<div class="mk-keys">${AUTOMATABLE.map(k=>`<button type="button" data-key="${k}" aria-pressed="${k===key}">${KEY_LABEL[k]}${t.automate?.[k]?' •':''}</button>`).join('')}</div><div data-curve></div>`;
   host.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{open['k'+i]=b.dataset.key;renderPanel(li,i);});
   curveEditor(host.querySelector('[data-curve]'),{key,text:t.automate?.[key],duration:dur(),marks:marks(),onChange:v=>{
    t.automate=t.automate||{};if(v)t.automate[key]=v;else delete t.automate[key];if(!Object.keys(t.automate).length)delete t.automate;rebuild();
    li.querySelector('[data-open=animate]').textContent='Animate'+(t.automate?` · ${Object.keys(t.automate).length}`:'');host.querySelector(`[data-key=${key}]`).textContent=KEY_LABEL[key]+(t.automate?.[key]?' •':'');}});
  }else if(which==='notes'){
   host.innerHTML=t.seq?`<label class="mk-field">Steps <textarea data-f="seq" rows="2" spellcheck="false" autocapitalize="off">${esc(t.seq)}</textarea></label>
    <div class="mk-grid"><label class="mk-field">Note <input data-f="note" value="${esc(t.note??'')}" placeholder="C4" autocapitalize="characters"></label><label class="mk-field">Step (s) <input data-f="step" value="${esc(t.step??'0.25')}"></label><label class="mk-field">From (s) <input data-f="from" inputmode="decimal" value="${esc(t.from??'')}" placeholder="0"></label><label class="mk-field">To (s) <input data-f="to" inputmode="decimal" value="${esc(t.to??'')}" placeholder="end"></label></div>
    <p class="mk-hint"><code>x</code> = the note, <code>.</code> = rest, <code>C4+E4+G4</code> chord, <code>@.5</code> softer, <code>:4</code> hold 4 steps, <code>.*8</code> repeat. The step can speed up: <code>0.8@0 0.2@20</code>.</p>
    <button type="button" class="mk-btn" data-act="unseq">Let it play its part instead</button>`
   :`<p class="mk-hint">This sound plays its ${esc(roleLabel[trackKind(t).role]||'part')} from the song's harmony. Write notes to place them yourself, at exact times.</p><button type="button" class="mk-btn" data-act="seq">Write notes</button>`;
   host.querySelectorAll('[data-f]').forEach(el=>el.oninput=()=>{const f=el.dataset.f,v=el.value.trim();if(v==='')delete t[f];else t[f]=['from','to'].includes(f)?Number(v):f==='step'&&/^[\d.]+$/.test(v)?Number(v):v;rebuild();el.classList.toggle('invalid',problems.some(p=>p.startsWith(`track ${i+1} `)));});
  }else if(which==='tone'){
   const r=trackKind(t).r?.preset||{},row=(f,label,lo,hi,step,val)=>`<label class="mk-slider">${label}<input type="range" data-f="${f}" min="${lo}" max="${hi}" step="${step}" value="${val}"><output>${val}</output></label>`;
   host.innerHTML=row('pan','Pan',-1,1,.01,t.pan??r.pan??0)+row('send','Space',0,1,.01,t.send??r.send??.3)+row('colour','Tone',0,1,.01,t.colour??r.colour??.4)+row('life','Decay',.03,8,.01,t.life??r.life??1.2)+row('transpose','Pitch',-24,24,1,t.transpose??r.transpose??0)
    +(t.pair?row('pairWidth','Stereo width',0,1,.01,t.pair.width??.75)+row('pairDelay','Right delay (s)',0,.6,.005,t.pair.delay??.023):'');
   host.querySelectorAll('input[type=range]').forEach(el=>el.oninput=()=>{const f=el.dataset.f,v=Number(el.value);el.nextElementSibling.textContent=v;if(f==='pairWidth')t.pair.width=v;else if(f==='pairDelay')t.pair.delay=v;else t[f]=v;rebuild();});
  }
 }
 $('#mkTracks').addEventListener('click',e=>{
  const li=e.target.closest('.mk-card');if(!li)return;const i=+li.dataset.i,t=song.tracks[i],act=e.target.closest('[data-act]')?.dataset.act,op=e.target.closest('[data-open]')?.dataset.open;
  if(op){open[i]=open[i]===op?null:op;renderTracks();return;}
  if(act==='swap'){replacing=i;openLibrary();}
  else if(act==='preview'){hooks.unlock();preview(t);}
  else if(act==='remove'){undo={i,t:song.tracks.splice(i,1)[0]};open={};rebuild();renderTracks();showUndo(trackKind(undo.t).name);}
  else if(act==='pair'){if(t.pair)delete t.pair;else t.pair={width:.75,delay:.023};rebuild();renderTracks();}
  else if(act==='seq'){t.seq='x . . . x . . . x . x . . . . .';t.note=NOTE_FOR[trackKind(t).r?.family]||'C4';t.step=.25;open[i]='notes';rebuild();renderTracks();}
  else if(act==='unseq'){for(const f of ['seq','note','step','from','to','gate','loop'])delete t[f];rebuild();renderTracks();}
 });
 $('#mkTracks').addEventListener('input',e=>{if(e.target.dataset.act!=='level')return;song.tracks[+e.target.closest('.mk-card').dataset.i].level=Number(e.target.value);rebuild();});
 function showUndo(name){root.querySelector('.mk-undo')?.remove();const b=document.createElement('button');b.type='button';b.className='mk-undo';b.textContent=`Removed ${name} · Undo`;b.onclick=()=>{if(undo){song.tracks.splice(undo.i,0,undo.t);undo=null;rebuild();renderTracks();}b.remove();};$('#mkTracks').before(b);setTimeout(()=>b.remove(),8000);}

 function renderDetails(){
  const k=parseKey(song.key)||{pc:9,mode:'minor'},gkey=open.g||Object.keys(song.automate||{})[0]||'master';
  $('#mkDetails').innerHTML=`<div class="mk-grid">
   <label class="mk-field">Tempo <input data-g="bpm" type="number" inputmode="numeric" min="30" max="200" value="${esc(song.bpm??80)}"></label>
   <label class="mk-field">Length (s) <input data-g="seconds" type="number" inputmode="numeric" min="5" max="600" value="${esc(Math.round(composition?.seconds||song.seconds||60))}"></label>
   <label class="mk-field">Key <select data-g="tonic">${TONICS.map((t,i)=>`<option ${i===k.pc?'selected':''}>${t}</option>`).join('')}</select></label>
   <label class="mk-field">Mode <select data-g="mode">${Object.keys(modes).map(m=>`<option ${m===k.mode?'selected':''}>${m}</option>`).join('')}</select></label>
   <label class="mk-field">Meter <select data-g="meter">${METERS.map(m=>`<option ${m===(song.meter||'4/4')?'selected':''}>${m}</option>`).join('')}</select></label>
   <label class="mk-field">Drums <select data-g="rhythm">${rhythms.map(r=>`<option value="${r}" ${r===(song.rhythm||'none')?'selected':''}>${r}</option>`).join('')}</select></label>
  </div>
  <label class="mk-slider">Room<input type="range" data-g="room" min="0" max="1" step="0.01" value="${song.room??.7}"><output>${song.room??.7}</output></label>
  <label class="mk-field">Words for the voices <input data-g="say" value="${esc(song.say||'')}" placeholder="used by Radio chatter, Whistle choir…"></label>
  <div class="mk-keys">${GLOBAL_AUTOMATABLE.map(x=>`<button type="button" data-gkey="${x}" aria-pressed="${x===gkey}">${KEY_LABEL[x]}${song.automate?.[x]?' •':''}</button>`).join('')}</div><div id="mkGlobalCurve"></div>`;
  const D=$('#mkDetails');
  D.querySelectorAll('[data-g]').forEach(el=>el.oninput=el.onchange=()=>{const g=el.dataset.g,v=el.value;
   if(g==='tonic'||g==='mode'){song.key=keyName(TONICS.indexOf(D.querySelector('[data-g=tonic]').value),D.querySelector('[data-g=mode]').value);delete song.harmony;delete song.chords;}
   else if(g==='seconds'){const old=composition?.seconds,next=Number(v);if(!(next>=5))return;song.seconds=next;if(song.sections&&old){const f=next/old;song.sections=song.sections.map(s=>({...s,start:Math.round(s.start*f*100)/100}));}}
   else if(g==='bpm'||g==='room'){song[g]=Number(v);if(el.nextElementSibling?.tagName==='OUTPUT')el.nextElementSibling.textContent=v;}
   else song[g]=v||undefined;
   rebuild();});
  D.querySelectorAll('[data-gkey]').forEach(b=>b.onclick=()=>{open.g=b.dataset.gkey;renderDetails();});
  curveEditor($('#mkGlobalCurve'),{key:gkey,text:song.automate?.[gkey],duration:dur(),marks:marks(),onChange:v=>{song.automate=song.automate||{};if(v)song.automate[gkey]=v;else delete song.automate[gkey];if(!Object.keys(song.automate).length)delete song.automate;rebuild();}});
 }
 $('#mkDetailsBox').ontoggle=()=>{if($('#mkDetailsBox').open)renderDetails();};

 // ---- Sound library sheet ----
 function openLibrary(){$('#mkLibTitle').textContent=replacing!=null?'Change sound':'Add a sound';renderLibrary();$('#mkLibrary').showModal();}
 function renderLibrary(){
  const q=$('#mkLibSearch').value.toLowerCase(),list=sounds.filter(s=>(!cat||s.category===cat)&&(!q||[s.label,s.id,s.category,s.scene,s.about,patterns[s.pattern].label,familySound[s.pattern]].join(' ').toLowerCase().includes(q)));
  $('#mkLibList').innerHTML=list.map(s=>`<div class="mk-tile"><button type="button" class="mk-tile-add" data-sound="${s.id}"><b>${esc(s.label)}</b><small>${esc(s.about)}</small></button><button type="button" class="mk-icon" data-hear="${s.id}" aria-label="Preview ${esc(s.label)}">▶</button><p class="mk-tile-src"><b>${esc(patterns[s.pattern].label)}</b> · ${esc(familySound[s.pattern]||'')} · <a href="lean/patterns/${s.pattern}.lean" target="_blank" rel="noopener">LeanDSP source</a> · <a href="?pattern=${s.pattern}" target="_blank" rel="noopener">definition</a></p></div>`).join('')||'<p>No matching sounds.</p>';
 }
 $('#mkLibSearch').oninput=renderLibrary;
 $('#mkCats').onclick=e=>{const b=e.target.closest('[data-cat]');if(!b)return;cat=b.dataset.cat;$('#mkCats').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderLibrary();};
 $('#mkLibList').onclick=e=>{
  const hear=e.target.closest('[data-hear]');if(hear){hooks.unlock();preview({sound:hear.dataset.hear});return;}
  const add=e.target.closest('[data-sound]');if(!add)return;const id=add.dataset.sound;
  if(replacing!=null){const t=song.tracks[replacing];t.sound=id;delete t.label;delete t.role;replacing=null;}
  else{song.tracks=song.tracks||[];song.tracks.push({sound:id});const comp=soundById[id]?.companion;if(comp&&!song.tracks.some(t=>t.sound===comp))song.tracks.push({sound:comp});}
  $('#mkLibrary').close();rebuild();renderTracks();toast('Added '+soundById[id].label);
 };
 $('#mkAdd').onclick=()=>{replacing=null;openLibrary();};
 root.querySelectorAll('dialog [data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 root.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));

 // A few seconds of one sound, in the song's key, without leaving the Make tab.
 function preview(t){
  const one=structuredClone(t);delete one.automate;
  if(one.seq){const len=Math.max(4,Math.min(8,(one.to??dur())-(one.from??0)));one.from=0;one.to=len;}
  const c=compositionFromSong({title:'Preview · '+trackKind(t).name,key:song.key,bpm:song.bpm||90,rhythm:'none',seconds:7,sections:[{name:'Preview',start:0}],say:song.say||'hello from diddums',room:song.room,tracks:[one]});
  if(!c.tracks.length){toast('This sound cannot be previewed',true);return;}
  hooks.play({...c,id:'preview-'+c.id},{stay:true});viz.kick();
 }

 // ---- Play / share ----
 $('#mkTitle').oninput=()=>{song.title=$('#mkTitle').value;rebuild();};
 $('#mkPlay').onclick=()=>{hooks.unlock();rebuild();if(!composition?.tracks.length){toast('Add a sound first',true);return;}hooks.play(composition,{stay:true});viz.kick();};
 async function link(){const r=recipeFromSong(song);return r?shareUrl(r):songLink(song);}
 $('#mkShare').onclick=async()=>{
  try{const url=await link(),data={title:song.title||'Diddums',text:(song.title||'A Diddums track')+' · made with Diddums',url};
   if(navigator.share&&(!navigator.canShare||navigator.canShare(data))){try{await navigator.share(data);return;}catch(e){if(e.name==='AbortError')return;}}
   await navigator.clipboard.writeText(url);toast('Link copied');
  }catch(e){toast('Could not share: '+e.message,true);}
 };
 // Example pieces: readable link form, ?song=<percent-encoded Song JSON>, same as the skill page produces.
 const songUrl=s=>siteUrl('')+'?song='+encodeURIComponent(JSON.stringify(s));
 async function shareLink(title,url){
  const data={title,text:title+' · made with Diddums',url};
  if(navigator.share&&(!navigator.canShare||navigator.canShare(data))){try{await navigator.share(data);return;}catch(e){if(e.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(url);toast('Link copied');}catch(e){toast('Could not share: '+e.message,true);}
 }
 $('#mkShowcase').onclick=e=>{
  const b=e.target.closest('button');if(!b)return;const s=SHOWCASE[b.dataset.play??b.dataset.edit??b.dataset.share];if(!s)return;
  if(b.dataset.share!=null){shareLink(s.title||'Diddums',songUrl(s));return;}
  hooks.unlock();
  if(b.dataset.edit!=null){load(structuredClone(s),'Loaded “'+s.title+'” for editing');$('.mk-song').scrollIntoView({behavior:'smooth'});return;}
  const r=checkSong(s);if(!r.composition?.tracks.length){toast(r.problems[0]||'This piece cannot play',true);return;}
  hooks.play({...r.composition,id:'showcase-'+b.dataset.play},{stay:true});viz.kick();toast('Playing “'+s.title+'”');
 };
 $('#mkCopyJson').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(song,null,1));toast('Song JSON copied');}catch{toast('Copy failed',true);}};
 $('#mkRemix').onclick=()=>load(hooks.songOfCurrent(),'Loaded the piece from Compose');
 $('#mkNew').onclick=()=>load({title:'Untitled',bpm:80,key:'A minor',rhythm:'none',seconds:60,tracks:[]},'Started an empty track');

 // ---- Compose ----
 const status=(text,busy=true)=>{$('#mkStatus').hidden=!text;$('#mkStatusText').textContent=text||'';$('#mkStatus').classList.toggle('busy',busy);$('#mkStop').hidden=!busy;$('#mkCompose').disabled=busy&&!!text;};
 function load(next,msg){song=next;open={};$('#mkTitle').value=song.title||'';rebuild();renderTracks();if($('#mkDetailsBox').open)renderDetails();if(msg)toast(msg);}
 function promptText(){const p=$('#mkPrompt').value.trim();if(!p){$('#mkPrompt').focus();toast('Describe the music first',true);return null;}return p;}
 $('#mkCompose').onclick=async()=>{
  hooks.unlock();const p=promptText();if(!p)return;
  if(!settings.key){openSettings();return;}
  abort=new AbortController();const base=$('#mkRefine').checked?song:null;
  try{
   status('Starting Claude…');
   const r=await composeWithClaude({apiKey:settings.key,model:settings.model,prompt:p,base,example:exampleSong(hooks.example()),signal:abort.signal,
    onProgress:({phase,chars})=>status(phase==='loading'?'Loading the Claude SDK…':`${phase==='repairing'?'Fixing details':'Claude is composing'}… ${chars?chars.toLocaleString()+' characters':'thinking'}`)});
   r.song.prompt=p;load(r.song);status(r.problems.length?'Composed, with a few parts Diddums could not use (listed below).':'',false);
   if(composition?.tracks.length)hooks.play(composition,{stay:true});
  }catch(e){status(e.message,false);}
  finally{abort=null;}
 };
 $('#mkStop').onclick=()=>abort?.abort();
 $('#mkSketch').onclick=()=>{hooks.unlock();const p=promptText();if(!p)return;const s=songFromRecipe(recipeFromPrompt(p));s.description=`Offline keyword sketch of “${p}”.`;load(s,'Quick sketch made without AI');if(composition?.tracks.length)hooks.play(composition,{stay:true});};
 $('#mkViaApp').onclick=async()=>{
  const p=promptText();if(!p)return;lastChat=chatPrompt(p,$('#mkRefine').checked?song:null,exampleSong(hooks.example()));
  $('#mkApp').hidden=false;$('#mkShareText').hidden=!navigator.share;
  try{await navigator.clipboard.writeText(lastChat);toast('Prompt copied. Paste it into your AI assistant.');}catch{toast('Tap “Copy again” to copy the prompt',true);}
  $('#mkApp').scrollIntoView({behavior:'smooth',block:'nearest'});
 };
 $('#mkCopyAgain').onclick=async()=>{try{await navigator.clipboard.writeText(lastChat);toast('Prompt copied');}catch{toast('Copy failed',true);}};
 $('#mkShareText').onclick=async()=>{try{await navigator.share({text:lastChat});}catch{}};
 $('#mkFromClipboard').onclick=async()=>{try{$('#mkReply').value=await navigator.clipboard.readText();}catch{toast('Long-press the box and choose Paste',true);}};
 $('#mkUseReply').onclick=()=>{hooks.unlock();try{const r=songFromReply($('#mkReply').value);r.song.prompt=r.song.prompt||$('#mkPrompt').value.trim()||undefined;load(r.song,r.problems.length?'Loaded, with a few problems listed below':'Loaded the song');$('#mkApp').hidden=true;$('#mkReply').value='';if(composition?.tracks.length)hooks.play(composition,{stay:true});}catch(e){toast(e.message,true);}};
 $('#mkIdeas').onclick=e=>{const b=e.target.closest('[data-idea]');if(!b)return;$('#mkPrompt').value=b.dataset.idea;$('#mkRefine').checked=false;$('#mkPrompt').focus();};

 // ---- Settings ----
 function openSettings(){$('#mkKey').value=settings.key;$('#mkRemember').checked=settings.remember;$('#mkModel').value=settings.model;$('#mkSettingsDialog').showModal();}
 $('#mkSettings').onclick=openSettings;
 $('#mkSaveKey').onclick=()=>{settings.key=$('#mkKey').value.trim();settings.remember=$('#mkRemember').checked;settings.model=$('#mkModel').value;store.set('diddums.ai.key',settings.remember&&settings.key?settings.key:null);store.set('diddums.ai.model',settings.model);$('#mkSettingsDialog').close();toast(settings.key?'Ready to compose with Claude':'No key saved');};
 $('#mkForget').onclick=()=>{settings.key='';store.set('diddums.ai.key',null);$('#mkKey').value='';toast('Key removed from this device');};

 $('#mkTitle').value=song.title||'';rebuild();renderTracks();
 return {load:(s,msg)=>load(structuredClone(s),msg),get song(){return song;}};
}
