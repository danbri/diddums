import {inspectLeanDSP} from './leandsp.js';

const saved=new WeakMap();
const CATS=['io','param','state','fn','bind','op','write'];
const catOf=n=>n.type==='input'||n.type==='output'?'io':n.type==='param'?'param':n.type==='state'||n.type==='buffer'?'state':n.type==='fn'?'fn':n.type==='let'?'bind':n.type==='op'?'op':n.type==='write'?'write':'op';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fmt=x=>Number.isFinite(x)?(Math.abs(x)>=100?x.toFixed(1):Math.abs(x)>=1?x.toFixed(3):Math.abs(x)>=.001?x.toFixed(5):x.toExponential(2)):'—';
const qtile=(xs,q)=>{if(!xs.length)return 0;const a=[...xs].filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const p=(a.length-1)*q,i=Math.floor(p),f=p-i;return a[i]*(1-f)+(a[Math.min(a.length-1,i+1)]??a[i])*f};

function condensed(graph,visible){
  const out=new Map(graph.nodes.map(n=>[n.id,[]]));for(const e of graph.edges)(out.get(e.from)||[]).push(e);
  const edges=[],seen=new Set();
  for(const n of graph.nodes){if(!visible.has(n.id))continue;for(const e of out.get(n.id)||[]){const stack=[{id:e.to,kind:e.kind}],walked=new Set();while(stack.length){const q=stack.pop();if(walked.has(q.id))continue;walked.add(q.id);if(visible.has(q.id)){const k=`${n.id}>${q.id}>${q.kind}`;if(n.id!==q.id&&!seen.has(k)){seen.add(k);edges.push({from:n.id,to:q.id,kind:q.kind,bypassed:q.id!==e.to})}continue}for(const z of out.get(q.id)||[])stack.push({id:z.to,kind:q.kind==='state'||z.kind==='state'?'state':z.kind||q.kind});}}}
  return edges;
}

function layout(nodes,edges,overview){
  const ids=new Set(nodes.map(n=>n.id)),inc=Object.fromEntries(nodes.map(n=>[n.id,0])),next=Object.fromEntries(nodes.map(n=>[n.id,[]]));
  for(const e of edges)if(ids.has(e.from)&&ids.has(e.to)){inc[e.to]++;next[e.from].push(e.to)}
  const q=nodes.filter(n=>inc[n.id]===0).map(n=>n.id),depth=Object.fromEntries(nodes.map(n=>[n.id,0])),order=[];
  while(q.length){const id=q.shift();order.push(id);for(const to of next[id]||[]){depth[to]=Math.max(depth[to],depth[id]+1);if(--inc[to]===0)q.push(to)}}
  for(const n of nodes)if(!order.includes(n.id))order.push(n.id);
  const groups={};for(const id of order)(groups[depth[id]]??=[]).push(id);
  const nodeW=overview?150:136,col=overview?205:180,row=overview?64:78,pos={};
  for(const [d,ids2] of Object.entries(groups))ids2.forEach((id,i)=>pos[id]={x:24+Number(d)*col,y:22+i*row});
  const width=Math.max(680,70+(Math.max(0,...Object.values(depth))+1)*col),height=Math.max(360,70+Math.max(...Object.values(groups).map(x=>x.length),1)*row);
  return{pos,width,height,nodeW};
}

function replaceParam(src,name,value){return src.replace(new RegExp(`(param\\s+${name}\\s*:\\s*(?:F32|Unit|Bipolar|Hz|Seconds|Milliseconds|Gain|MidiNote)(?:\\s+@(audio|control|event))?\\s*:=\\s*)-?\\d+(?:\\.\\d+)?`),`$1${value}`)}
function replaceState(src,name,value){return src.replace(new RegExp(`(state\\s+${name}\\s*:\\s*F32\\s*:=\\s*)-?\\d+(?:\\.\\d+)?`),`$1${value}`)}
function replaceLet(src,name,expr){return src.replace(new RegExp(`(let\\s+${name}\\s*:=\\s*)([^\\n]+)`),`$1${expr}`)}

function rawRecent(st,name,trace=null){
  const rs=st.ranges.get(name)||[],lows=rs.map(r=>r.min),highs=rs.map(r=>r.max);
  if(trace?.length){let lo=Infinity,hi=-Infinity;for(const v of trace){if(v<lo)lo=v;if(v>hi)hi=v}if(Number.isFinite(lo)){lows.push(lo);highs.push(hi)}}
  if(!lows.length)return{lo:-1e-6,hi:1e-6};
  return{lo:qtile(lows,.08),hi:qtile(highs,.92)};
}
function viewRange(st,name,mode,trace=null){
  if(mode==='unit')return{lo:0,hi:1,mode};
  if(mode==='raw')return{lo:-1,hi:1,mode};
  const r=rawRecent(st,name,trace);
  if(mode==='sym'){let m=Math.max(Math.abs(r.lo),Math.abs(r.hi),1e-9)*1.12;return{lo:-m,hi:m,mode}}
  let lo=r.lo,hi=r.hi,span=hi-lo;if(!(span>1e-12)){const p=Math.max(Math.abs(lo)*.08,1e-6);lo-=p;hi+=p;span=hi-lo}else{const p=span*.09;lo-=p;hi+=p}return{lo,hi,mode:'auto'};
}
function drawTrace(canvas,data,kind='wave',range={lo:-1,hi:1}){
  if(!canvas)return;const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(180,canvas.clientWidth||300),h=Math.max(64,canvas.clientHeight||78);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);if(!data?.length)return;
  if(kind==='fft'){
    const n=data.length,bins=Math.min(36,Math.floor(n/2)),mags=[];let max=1e-9;for(let k=0;k<bins;k++){let re=0,im=0;for(let i=0;i<n;i++){const a=2*Math.PI*k*i/n,v=data[i];re+=v*Math.cos(a);im-=v*Math.sin(a)}const m=Math.sqrt(re*re+im*im);mags.push(m);max=Math.max(max,m)}for(let k=0;k<bins;k++){const bh=(mags[k]/max)*(h-10),bw=w/bins;c.fillStyle=k<4?'#ffbd4b':'#5f88ff';c.fillRect(k*bw,h-bh,Math.max(1,bw-1),bh)}c.fillStyle='#58758c';c.font='8px ui-monospace,monospace';c.fillText('RELATIVE / FRAME-NORMALIZED',5,9);return;
  }
  const lo=range.lo,hi=range.hi,span=Math.max(1e-15,hi-lo),pad=8,mapY=v=>pad+(hi-v)/span*(h-pad*2);
  c.strokeStyle='#15354b';c.lineWidth=1;if(lo<=0&&hi>=0){const y=mapY(0);c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
  c.fillStyle='#58758c';c.font='8px ui-monospace,monospace';c.fillText(fmt(hi),4,9);c.fillText(fmt(lo),4,h-2);
  if(kind==='wave'){c.strokeStyle='#55e9ff';c.lineWidth=1.5;c.beginPath();for(let i=0;i<data.length;i++){const x=i/Math.max(1,data.length-1)*w,y=clamp(mapY(data[i]),pad,h-pad);i?c.lineTo(x,y):c.moveTo(x,y)}c.stroke();return}
  const vals=data;let prev=null;c.strokeStyle='#a56cff';c.lineWidth=1.4;c.beginPath();for(let i=0;i<vals.length;i++){const x=i/Math.max(1,vals.length-1)*w,y=clamp(mapY(vals[i].v),pad,h-pad);if(prev)c.lineTo(x,y);else c.moveTo(x,y);prev={x,y};if(vals[i].beat){c.save();c.strokeStyle='#ffbd4b';c.globalAlpha=.65;c.beginPath();c.moveTo(x,4);c.lineTo(x,h-4);c.stroke();c.restore()}}c.stroke();
}

export function renderLeanGraph(source,{panel,meta,nodesLayer,wireSvg,open=true,onEdit,onProbe,debugKey='main'}={}){
  if(!panel||!meta||!nodesLayer||!wireSvg)return null;if(open)panel.hidden=false;
  const wrap=panel.querySelector('#innerGraphWrap')||nodesLayer.parentElement,canvas=panel.querySelector('#innerCanvas')||nodesLayer.parentElement,toolbar=panel.querySelector('#insideToolbar'),inspector=panel.querySelector('#insideInspector');
  let st=saved.get(panel);if(!st){st={filters:new Set(CATS),zoom:1,overview:false,selected:null,live:new Map(),history:new Map(),ranges:new Map(),scaleModes:new Map(),trace:null,source:null};saved.set(panel,st)}const sourceChanged=st.source!==source;st.source=source;
  let graph;try{graph=inspectLeanDSP(source)}catch(e){meta.textContent=e.message;nodesLayer.innerHTML='';wireSvg.innerHTML='';return null}st.graph=graph;st.debugKey=debugKey;
  const forwards=new Map(graph.nodes.map(n=>[n.id,[]]));for(const e of graph.edges)(forwards.get(e.from)||[]).push(e.to);
  const probeNamesFor=new Map();for(const n of graph.nodes){const found=[],seen=new Set(),q=[n.id];while(q.length&&found.length<6){const id=q.shift();if(seen.has(id))continue;seen.add(id);const x=graph.nodes.find(z=>z.id===id);if(x?.probeName&&!found.includes(x.probeName))found.push(x.probeName);for(const to of forwards.get(id)||[])q.push(to)}probeNamesFor.set(n.id,found)}
  const probeFor=n=>n?.probeName||(probeNamesFor.get(n?.id)||[])[0]||null;
  if(sourceChanged||!graph.nodes.some(n=>n.id===st.selected)){const auto=graph.nodes.find(n=>n.probeName==='out')||graph.nodes.find(n=>n.probeName);st.selected=auto?.id||null;st.trace=null}

  const renderToolbar=()=>{
    if(!toolbar)return;toolbar.innerHTML=`<div class="itools-group"><button data-act="declutter">DECLUTTER</button><button data-act="all">ALL</button><button data-act="fit">FIT</button><button data-act="overview" class="${st.overview?'on':''}">OVERVIEW</button></div><div class="itools-group cats">${CATS.map(c=>`<button data-cat="${c}" class="${st.filters.has(c)?'on':''}">${c.toUpperCase()}</button>`).join('')}</div><label class="izoom">ZOOM <input type="range" min="0.25" max="1" step="0.05" value="${st.zoom}"><span>${Math.round(st.zoom*100)}%</span></label>`;
    toolbar.querySelector('[data-act="declutter"]').onclick=()=>{st.filters=new Set(['io','param','state','fn','bind','write']);renderAll();fit()};
    toolbar.querySelector('[data-act="all"]').onclick=()=>{st.filters=new Set(CATS);renderAll()};
    toolbar.querySelector('[data-act="fit"]').onclick=fit;
    toolbar.querySelector('[data-act="overview"]').onclick=()=>{st.overview=!st.overview;renderAll();fit()};
    toolbar.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{const c=b.dataset.cat;st.filters.has(c)?st.filters.delete(c):st.filters.add(c);renderAll()});
    const zr=toolbar.querySelector('input[type=range]');zr.oninput=()=>{st.zoom=Number(zr.value);applyZoom();toolbar.querySelector('.izoom span').textContent=Math.round(st.zoom*100)+'%'};
  };

  let dims=null,visibleNodes=[],visibleEdges=[];
  const applyZoom=()=>{if(!dims||!canvas)return;canvas.style.width=(dims.width*st.zoom)+'px';canvas.style.height=(dims.height*st.zoom)+'px';const content=panel.querySelector('#innerContent')||canvas;content.style.width=dims.width+'px';content.style.height=dims.height+'px';content.style.transformOrigin='0 0';content.style.transform=`scale(${st.zoom})`};
  const fit=()=>{if(!dims||!wrap)return;st.zoom=clamp(Math.min((wrap.clientWidth-12)/dims.width,(wrap.clientHeight-12)/dims.height,1),.25,1);applyZoom();const z=toolbar?.querySelector('input[type=range]');if(z){z.value=st.zoom;toolbar.querySelector('.izoom span').textContent=Math.round(st.zoom*100)+'%'}};

  const renderInspector=()=>{
    if(!inspector)return;const n=graph.nodes.find(x=>x.id===st.selected);if(!n){inspector.innerHTML='<div class="empty">Select an internal node to inspect values or edit a binding.</div>';return}
    const probeName=probeFor(n),live=probeName?st.live.get(probeName):null,beat=live?.beat?' <span class="ibeat">BEAT</span>':'',mode=probeName?(st.scaleModes.get(probeName)||'auto'):'auto';
    let edit='';if(n.edit==='param')edit=`<div class="iedit"><label>${n.name} <input data-edit="param" type="range" min="${n.lo}" max="${n.hi}" step="${Math.max((n.hi-n.lo)/400,.0001)}" value="${n.def}"></label><input data-num type="number" value="${n.def}" step="any"></div>`;
    if(n.edit==='state')edit=`<div class="iedit"><label>initial state</label><input data-state type="number" value="${n.init}" step="any"><button data-apply-state>APPLY</button></div>`;
    if(n.edit==='let')edit=`<div class="iedit"><label>expression for <b>${n.name}</b></label><textarea data-let>${n.text}</textarea><button data-apply-let>APPLY + RECOMPILE</button></div>`;
    const scaleCtl=probeName?`<div class="iscale"><label>VIS SCALE <select data-scale><option value="auto" ${mode==='auto'?'selected':''}>AUTO · recent min/max</option><option value="sym" ${mode==='sym'?'selected':''}>± RECENT PEAK</option><option value="unit" ${mode==='unit'?'selected':''}>OBJECTIVE 0…1</option><option value="raw" ${mode==='raw'?'selected':''}>RAW · fixed ±1</option></select></label><span data-range>range —</span></div>`:'';
    inspector.innerHTML=`<div class="inspect-top"><div><b>${n.label}</b><span>${n.type}</span></div><div class="ivalue"><strong data-live>${live?fmt(live.last):'—'}</strong>${beat}<small>rms ${live?fmt(live.rms):'—'} · peak ${live?fmt(live.peak):'—'}</small></div></div>${edit}${scaleCtl}<div class="scope-grid"><figure><figcaption>TRACE</figcaption><canvas data-scope="wave"></canvas></figure><figure><figcaption>TIMELINE / BEATS</figcaption><canvas data-scope="history"></canvas></figure><figure><figcaption>FFT · RELATIVE</figcaption><canvas data-scope="fft"></canvas></figure></div><div class="inspect-note">${n.detail||'derived internal node'}${probeName?' · live view '+probeName+(n.probeName?'':' · nearest downstream binding'):''}<span data-provenance></span></div>`;
    if(n.edit==='param'){const r=inspector.querySelector('[data-edit=param]'),num=inspector.querySelector('[data-num]');const apply=v=>{v=clamp(Number(v),n.lo,n.hi);r.value=v;num.value=v;st.source=replaceParam(st.source,n.name,Number(v.toFixed(6)));onEdit?.(st.source,{kind:'param',name:n.name,value:v})};r.oninput=()=>{num.value=r.value;apply(r.value)};num.onchange=()=>apply(num.value)}
    if(n.edit==='state')inspector.querySelector('[data-apply-state]').onclick=()=>{const v=Number(inspector.querySelector('[data-state]').value);if(Number.isFinite(v)){st.source=replaceState(st.source,n.name,v);onEdit?.(st.source,{kind:'state',name:n.name,value:v})}};
    if(n.edit==='let')inspector.querySelector('[data-apply-let]').onclick=()=>{const expr=inspector.querySelector('[data-let]').value.trim();if(expr){st.source=replaceLet(st.source,n.name,expr);onEdit?.(st.source,{kind:'let',name:n.name,expr})}};
    const sc=inspector.querySelector('[data-scale]');if(sc&&probeName)sc.onchange=()=>{st.scaleModes.set(probeName,sc.value);drawSelected();applyLive()};
    drawSelected();
  };

  const drawSelected=()=>{if(!inspector)return;const n=graph.nodes.find(x=>x.id===st.selected),name=probeFor(n);if(!name)return;const live=st.live.get(name),v=inspector.querySelector('[data-live]');if(v)v.textContent=live?fmt(live.last):'—';const mode=st.scaleModes.get(name)||'auto',vr=viewRange(st,name,mode,st.trace),raw=rawRecent(st,name,st.trace),rl=inspector.querySelector('[data-range]');if(rl)rl.textContent=`raw ${fmt(raw.lo)}…${fmt(raw.hi)} · view ${fmt(vr.lo)}…${fmt(vr.hi)}`;const pv=inspector.querySelector('[data-provenance]');if(pv&&st.lastInstance)pv.textContent=` · instance ${st.lastInstance}${Number.isFinite(st.lastFrame)?' · frame '+st.lastFrame:''}`;drawTrace(inspector.querySelector('[data-scope=wave]'),st.trace,'wave',vr);drawTrace(inspector.querySelector('[data-scope=history]'),st.history.get(name)||[],'history',vr);drawTrace(inspector.querySelector('[data-scope=fft]'),st.trace,'fft',vr)};

  const select=id=>{st.selected=id;const n=graph.nodes.find(x=>x.id===id),name=probeFor(n);nodesLayer.querySelectorAll('.inode').forEach(el=>el.classList.toggle('selected',el.dataset.id===id));if(name)onProbe?.(name);renderInspector()};

  const nodeLive=n=>{const names=n?.probeName?[n.probeName]:(probeNamesFor.get(n?.id)||[]),vals=names.map(name=>({name,v:st.live.get(name)})).filter(x=>x.v);if(!vals.length)return null;return vals.reduce((a,b)=>b.v.rms>a.v.rms?b:a)};
  const applyLive=()=>{for(const el of nodesLayer.querySelectorAll('.inode')){const n=graph.nodes.find(x=>x.id===el.dataset.id),lv=nodeLive(n),v=lv?.v,lab=el.querySelector('.livev');if(lab)lab.textContent=n?.probeName&&v?fmt(v.last):'';if(v){const r=viewRange(st,lv.name,'sym'),den=Math.max(Math.abs(r.lo),Math.abs(r.hi),1e-12),heat=clamp((v.rms/den)*1.7,0,1);el.style.boxShadow=`0 7px 18px #0008,0 0 ${5+28*heat}px rgba(20,231,255,${.10+.48*heat})`;el.style.opacity=String(.64+.36*heat);el.style.filter=`brightness(${1+.32*heat})`;el.classList.toggle('beat',!!v.beat)}else{el.style.boxShadow='';el.style.opacity='';el.style.filter='';el.classList.remove('beat')}}for(const p of wireSvg.querySelectorAll('.iwire')){const n=graph.nodes.find(x=>x.id===p.dataset.to),lv=nodeLive(n),v=lv?.v;if(v){const r=viewRange(st,lv.name,'sym'),den=Math.max(Math.abs(r.lo),Math.abs(r.hi),1e-12),heat=clamp((v.rms/den)*1.5,0,1);p.style.opacity=String(.28+.72*heat);p.style.strokeWidth=String(1.2+2.2*heat);p.classList.toggle('hot',heat>.35)}else{p.style.opacity='';p.style.strokeWidth='';p.classList.remove('hot')}}};

  const renderAll=()=>{
    renderToolbar();visibleNodes=graph.nodes.filter(n=>st.filters.has(catOf(n)));const vis=new Set(visibleNodes.map(n=>n.id));visibleEdges=condensed(graph,vis);dims=layout(visibleNodes,visibleEdges,st.overview);nodesLayer.innerHTML='';wireSvg.innerHTML='';wireSvg.setAttribute('viewBox',`0 0 ${dims.width} ${dims.height}`);wireSvg.style.width=dims.width+'px';wireSvg.style.height=dims.height+'px';
    for(const e of visibleEdges){const a=dims.pos[e.from],b=dims.pos[e.to];if(!a||!b)continue;const x1=a.x+dims.nodeW,y1=a.y+(st.overview?25:29),x2=b.x,y2=b.y+(st.overview?25:29),mid=(x1+x2)/2,p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);p.setAttribute('class','iwire'+(e.kind==='state'?' state':'')+(e.bypassed?' bypass':''));p.dataset.from=e.from;p.dataset.to=e.to;wireSvg.appendChild(p)}
    for(const n of visibleNodes){const p=dims.pos[n.id],el=document.createElement('button');el.type='button';el.dataset.id=n.id;el.className=`inode ${n.type}${st.selected===n.id?' selected':''}${st.overview?' overview':''}`;el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.width=dims.nodeW+'px';el.innerHTML=`<div class="it">${n.label}<span class="livev"></span></div><div class="idetail">${st.overview?n.type:(n.type+(n.detail?' · '+n.detail:''))}</div>`;el.onclick=()=>select(n.id);nodesLayer.appendChild(el)}
    applyZoom();applyLive();meta.textContent=`${graph.name} · ${visibleNodes.length}/${graph.nodes.length} shown · ${graph.states.length} state · ${graph.buffers.length} buffer${graph.buffers.length===1?'':'s'}`;renderInspector();
  };

  const controller={
    updateDebug(data){if(data?.key&&data.key!==st.debugKey)return;st.lastInstance=data?.instance||data?.key||st.debugKey;st.lastFrame=Number.isFinite(data?.frame)?data.frame:st.lastFrame;for(const v of data?.values||[]){st.live.set(v.name,v);const h=st.history.get(v.name)||[];h.push({v:v.last,beat:v.beat});if(h.length>160)h.splice(0,h.length-160);st.history.set(v.name,h);const r=st.ranges.get(v.name)||[];r.push({min:Number.isFinite(v.min)?v.min:v.last,max:Number.isFinite(v.max)?v.max:v.last,peak:v.peak,rms:v.rms});if(r.length>80)r.splice(0,r.length-80);st.ranges.set(v.name,r)}if(data?.trace){st.trace=data.trace instanceof Float32Array?data.trace:new Float32Array(data.trace)}applyLive();drawSelected()},
    refresh(newSource){st.source=newSource;return renderLeanGraph(newSource,{panel,meta,nodesLayer,wireSvg,open:false,onEdit,onProbe,debugKey:st.debugKey})},
    selectProbe(name){const n=graph.nodes.find(x=>x.probeName===name);if(n)select(n.id)},
    fit,select
  };
  renderAll();const initial=graph.nodes.find(x=>x.id===st.selected),initialProbe=probeFor(initial);if(initialProbe)onProbe?.(initialProbe);return controller;
}