// Make & share pane: prompt → recipe → composition, with the sound library one click away.
import {sounds,soundById,soundCategories} from './sounds.js';
import {patterns} from './patterns.js';
import {MAX_SOUNDS,recipeFromPrompt,recipeFromComposition,compositionFromRecipe,shareUrl,parseKey,keyName,modes,rhythms} from './maker.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const EXAMPLES=['epic space opera ambiance with radio chatter','rainy night city focus','underwater sonar dream','cathedral choir drone','factory machine techno','forest dawn with birds','eerie haunted heartbeat','retro synthwave drive'];
const TONICS=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const METERS=['4/4','3/4','5/4','6/8','7/8'];

export function mountMaker(root,hooks){
 let recipe=hooks.initial?structuredClone(hooks.initial):recipeFromPrompt(EXAMPLES[0]),filter='',category='';
 root.innerHTML=`<div class="section-heading"><div><span class="eyebrow">MAKE &amp; SHARE</span><h1>Describe a track. Pick sounds. Share the link.</h1><p>Type what you want to hear, or build it from the sound library. Everything below is encoded in the page URL, so a link plays the same track for anyone who opens it.</p></div></div>
 <div class="maker-prompt"><input id="mkPrompt" type="search" placeholder="e.g. epic space opera ambiance with radio chatter" aria-label="Describe the track"><button id="mkGenerate" class="primary">Generate</button></div>
 <div class="maker-examples" id="mkExamples">${EXAMPLES.map(e=>`<button data-example="${esc(e)}">${esc(e)}</button>`).join('')}</div>
 <div class="maker-grid">
  <section class="maker-card"><h2>Track</h2>
   <div class="maker-settings">
    <label>Title <input id="mkTitle" type="text" maxlength="80"></label>
    <label>Tempo <input id="mkBpm" type="number" min="30" max="200" step="1"></label>
    <label>Key <span class="maker-pair"><select id="mkTonic">${TONICS.map(t=>`<option>${t}</option>`).join('')}</select><select id="mkMode">${Object.keys(modes).map(m=>`<option>${m}</option>`).join('')}</select></span></label>
    <label>Meter <select id="mkMeter">${METERS.map(m=>`<option>${m}</option>`).join('')}</select></label>
    <label>Beat <select id="mkRhythm">${rhythms.map(r=>`<option value="${r}">${r==='none'?'none (ambient)':r}</option>`).join('')}</select></label>
    <label>Length (min) <input id="mkMinutes" type="number" min="0.5" max="20" step="0.5"></label>
    <label class="wide">Room <input id="mkRoom" type="range" min="0" max="1" step="0.01"></label>
    <label class="wide">Words for voices <input id="mkSay" type="text" maxlength="160" placeholder="used by Radio chatter, Whistle choir…"></label>
   </div>
   <h2>Sounds <small id="mkCount"></small></h2>
   <ol id="mkTracks" class="maker-tracks"></ol>
   <p class="maker-hint">Add sounds from the library. Each one is a preset over an existing hash-matched LeanDSP instrument; its role decides what it plays (bass line, chords, melody, drone, speech…).</p>
  </section>
  <section class="maker-card maker-library"><h2>Sound library <small>${sounds.length} sounds · up to ${MAX_SOUNDS} per track</small></h2>
   <div class="maker-filter"><input id="mkSearch" type="search" placeholder="Find a sound…" aria-label="Find a sound"><select id="mkCategory" aria-label="Category"><option value="">All categories</option>${soundCategories.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div>
   <div id="mkLibrary" class="maker-chips"></div>
  </section>
 </div>
 <div class="maker-actions"><button id="mkPlay" class="play-button">▶ Play this track</button><button id="mkCopy">Copy share link</button><button id="mkFromCurrent">Remix the current piece</button><input id="mkLink" type="text" readonly aria-label="Share link"></div>
 <details class="maker-card maker-reference"><summary>URL parameters</summary><p>Any Diddums URL with these query parameters opens straight into the described track. Only <code>prompt</code> or <code>sounds</code> is needed; anything left out is derived from the prompt.</p>
 <table><tbody>
 <tr><th>prompt</th><td>Free text. Keywords choose sounds, key, tempo, beat and section names (space, radio, epic, ambient, rain, ocean, city, forest, cathedral, machine, dance, retro, dark, dream…).</td></tr>
 <tr><th>sounds</th><td>Comma list of sound ids, each optionally <code>:level</code> (0–1.2). A raw <code>pattern.role</code> pair also works, e.g. <code>tine.keys:0.5</code>.</td></tr>
 <tr><th>title, bpm, key, meter, rhythm</th><td><code>key=F# lydian</code>, <code>meter=7/8</code>, <code>rhythm=none|brush|house|motorik|…</code></td></tr>
 <tr><th>minutes, room, seed</th><td>Approximate length, reverb size (0–1), and the seed for generated melody/bass.</td></tr>
 <tr><th>say</th><td>Words spoken by the sine-wave speech voices.</td></tr>
 <tr><th>chords, melody, bass</th><td><code>chords=1,6,3,7</code> (scale degrees); <code>melody</code>/<code>bass</code> are 16th-note steps in semitones, <code>_</code> for rest.</td></tr>
 <tr><th>harmony, names</th><td>Raw chords <code>36.0.3.7.10,…</code> (root MIDI then intervals); section names separated by <code>|</code>.</td></tr>
 </tbody></table>
 <p>Sound ids: ${sounds.map(s=>`<code>${s.id}</code>`).join(' ')}</p></details>`;
 const $=s=>root.querySelector(s);
 const link=()=>shareUrl(recipe);
 function syncForm(){
  $('#mkPrompt').value=recipe.prompt||'';$('#mkTitle').value=recipe.title||'';$('#mkBpm').value=recipe.bpm;
  const k=parseKey(recipe.key)||{pc:9,mode:'minor'};$('#mkTonic').value=TONICS[k.pc];$('#mkMode').value=k.mode;
  $('#mkMeter').value=(recipe.meter||[4,4]).join('/');$('#mkRhythm').value=recipe.rhythm;$('#mkMinutes').value=recipe.minutes??'';$('#mkRoom').value=recipe.room??.7;$('#mkSay').value=recipe.say||'';
  renderTracks();
 }
 function update(){$('#mkLink').value=link();}
 function renderTracks(){
  const list=recipe.sounds||[];$('#mkCount').textContent=`${list.length} / ${MAX_SOUNDS}`;
  $('#mkTracks').innerHTML=list.map((s,i)=>{
   const preset=s.id&&soundById[s.id],role=preset?.role||s.role,pattern=preset?.pattern||s.pattern,level=s.level??preset?.level??.3;
   const options=soundCategories.map(c=>`<optgroup label="${esc(c)}">${sounds.filter(x=>x.category===c).map(x=>`<option value="${x.id}" ${x.id===s.id?'selected':''}>${esc(x.label)}</option>`).join('')}</optgroup>`).join('')+(preset?'':`<option value="" selected>${esc(patterns[pattern]?.label||pattern)} · ${esc(role)}</option>`);
   return `<li><select data-swap="${i}" aria-label="Sound ${i+1}">${options}</select><span class="maker-role">${esc(role)} · ${esc(patterns[pattern]?.label||pattern)}</span><input type="range" min="0" max="1" step="0.01" value="${level}" data-level="${i}" aria-label="Level"><button data-remove="${i}" aria-label="Remove sound">✕</button></li>`;
  }).join('')||'<li class="empty">No sounds yet. Pick some from the library.</li>';
  for(const el of root.querySelectorAll('[data-swap]'))el.onchange=()=>{const i=+el.dataset.swap;if(el.value)recipe.sounds[i]={id:el.value};renderTracks();renderLibrary();};
  for(const el of root.querySelectorAll('[data-level]'))el.oninput=()=>{recipe.sounds[+el.dataset.level].level=+el.value;update();};
  for(const el of root.querySelectorAll('[data-remove]'))el.onclick=()=>{recipe.sounds.splice(+el.dataset.remove,1);renderTracks();renderLibrary();};
  update();
 }
 function renderLibrary(){
  const q=filter.toLowerCase(),inUse=new Set((recipe.sounds||[]).map(s=>s.id)),full=(recipe.sounds||[]).length>=MAX_SOUNDS;
  const shown=sounds.filter(s=>(!category||s.category===category)&&(!q||[s.label,s.id,s.category,s.about,s.pattern,s.role].join(' ').toLowerCase().includes(q)));
  $('#mkLibrary').innerHTML=soundCategories.filter(c=>shown.some(s=>s.category===c)).map(c=>`<h3>${esc(c)}</h3><div>${shown.filter(s=>s.category===c).map(s=>`<button data-add="${s.id}" class="${inUse.has(s.id)?'in-use':''}" title="${esc(s.about)}" ${full?'disabled':''}><b>${esc(s.label)}</b><small>${esc(s.role)} · ${esc(patterns[s.pattern].label)}</small></button>`).join('')}</div>`).join('')||'<p>No matching sounds.</p>';
  for(const b of root.querySelectorAll('[data-add]'))b.onclick=()=>{
   recipe.sounds=recipe.sounds||[];if(recipe.sounds.length>=MAX_SOUNDS)return;
   recipe.sounds.push({id:b.dataset.add});
   const companion=soundById[b.dataset.add].companion;if(companion&&!recipe.sounds.some(s=>s.id===companion)&&recipe.sounds.length<MAX_SOUNDS)recipe.sounds.push({id:companion});
   renderTracks();renderLibrary();
  };
 }
 const field=(sel,key,parse=v=>v)=>{$(sel).oninput=()=>{const v=$(sel).value;recipe[key]=v===''?undefined:parse(v);update();};};
 field('#mkTitle','title');field('#mkBpm','bpm',Number);field('#mkMinutes','minutes',Number);field('#mkRoom','room',Number);field('#mkSay','say');
 $('#mkRhythm').onchange=()=>{recipe.rhythm=$('#mkRhythm').value;update();};
 $('#mkMeter').onchange=()=>{recipe.meter=$('#mkMeter').value.split('/').map(Number);update();};
 $('#mkTonic').onchange=$('#mkMode').onchange=()=>{recipe.key=keyName(TONICS.indexOf($('#mkTonic').value),$('#mkMode').value);delete recipe.harmony;delete recipe.chords;update();};
 const generate=()=>{recipe=recipeFromPrompt($('#mkPrompt').value.trim());syncForm();renderLibrary();};
 $('#mkGenerate').onclick=generate;$('#mkPrompt').onkeydown=e=>{if(e.key==='Enter')generate();};
 for(const b of root.querySelectorAll('[data-example]'))b.onclick=()=>{$('#mkPrompt').value=b.dataset.example;generate();};
 $('#mkSearch').oninput=()=>{filter=$('#mkSearch').value;renderLibrary();};
 $('#mkCategory').onchange=()=>{category=$('#mkCategory').value;renderLibrary();};
 $('#mkPlay').onclick=()=>{if(!recipe.sounds?.length)return;hooks.play(compositionFromRecipe(recipe));};
 $('#mkCopy').onclick=async()=>{const url=link();try{await navigator.clipboard.writeText(url);$('#mkCopy').textContent='Link copied';}catch{$('#mkLink').select();$('#mkCopy').textContent='Select and copy the link';}setTimeout(()=>{$('#mkCopy').textContent='Copy share link';},1800);};
 $('#mkFromCurrent').onclick=()=>{recipe=structuredClone(hooks.current().recipe||recipeFromComposition(hooks.current()));syncForm();renderLibrary();};
 syncForm();renderLibrary();
}
