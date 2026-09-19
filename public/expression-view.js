// Read-only source slices are derived from the compiler's parsed program. They
// preserve state-write order and never algebraically inline or simplify F32 math.
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const primitiveNotes={
 abs:['abs(x)','Absolute value, lowered to f32.abs.'],
 min:['min(a, b)','WebAssembly f32.min. Not a proof that either argument is finite.'],
 max:['max(a, b)','WebAssembly f32.max. Not a proof that either argument is finite.'],
 clip:['clip(x, lo, hi)','max(lo, min(hi, x)); bounds must be meaningful for the intended signal.'],
 softsign:['softsign(x)','x / (1 + abs(x)). Arithmetic is F32; no stability theorem is attached.'],
 fract:['fract(x)','x - floor(x). Used for wrapped oscillator phase.'],
 select:['select(condition, yes, no)','Lowered to Wasm select: both value operands are evaluated. This is not a short-circuit if expression.'],
 lt:['lt(a, b)','F32 less-than comparison producing an i32 condition.'],
 le:['le(a, b)','F32 less-than-or-equal comparison producing an i32 condition.'],
 gt:['gt(a, b)','F32 greater-than comparison producing an i32 condition.'],
 ge:['ge(a, b)','F32 greater-than-or-equal comparison producing an i32 condition.'],
 sinpi:['sinpi(x)','Approximation of sin(πx), not a library transcendental or a proved exact function.', 'r = x - 2 * floor((x + 1) * 0.5)\ny = 4 * r * (1 - abs(r))\ny + 0.225 * (y * abs(y) - y)'],
 tanpi:['tanpi(x)','Ratio of the same sine approximations: sinpi(x) / sinpi(x + 0.5). No automatic pole avoidance or error-bound proof.'],
 expneg:['expneg(x)','Rational approximation intended for nonnegative exponential decay; the input is clamped below at zero.', 'z = max(0, x)\nz2 = z * z\nz3 = z2 * z\n1 / (1 + (z + (0.48 * z2 + 0.235 * z3)))'],
 taplin:['taplin(buffer, delaySamples)','Read a fractional delay with linear interpolation. Delay is clamped to 1…length−1; the buffer has explicit persistent state.'],
 noise1:['noise1(counter)','Deterministic floating-point hash noise. The arithmetic is implemented in the compiler; it is not an imported random service.'],
 quant:['quant(x, steps)','nearest(x * steps) / steps, with F32 arithmetic. No automatic guard against steps = 0.'],
 wrap:['wrap(x)','Periodic wrapping through fractional phase, returning a bipolar value for ordinary finite inputs.'],
 fold:['fold(x)','Periodic triangular folding through fractional phase and absolute value.'],
 asymclip:['asymclip(x, drive, posVf, negVf)','Select a positive/negative softsign scaling, with each denominator clamped to at least 0.0001.']
};
export function sourceSlice(graph,id){
 const byId=new Map(graph.nodes.map(n=>[n.id,n])),selected=byId.get(id);
 if(!selected)return{owner:null,lines:[],text:'',inputs:[],builtins:[]};
 const owner=byId.get(selected.ownerId)||selected,visited=new Set(),lines=[];
 function visit(n){if(!n||visited.has(n.id))return;visited.add(n.id);for(const d of n.codeInputs||[])visit(byId.get(d.nodeId));if(n.storageId)visit(byId.get(n.storageId));if(n.previousStorageId)visit(byId.get(n.previousStorageId));if(n.sourceCode&&n.sourceKind)lines.push(n);}
 visit(owner);lines.sort((a,b)=>(a.sourceLine||0)-(b.sourceLine||0)||(a.statementIndex??-1)-(b.statementIndex??-1));
 const inputs=(owner.codeInputs||[]).map(d=>({...d,node:byId.get(d.nodeId)}));
 return{owner,lines,text:lines.map(n=>n.sourceCode).join('\n'),inputs,builtins:[...new Set(lines.flatMap(n=>n.builtinNames||[]))]};
}
export function replaceSourceExpression(source,node,expression){
 const expr=expression.trim();if(!expr||/[\r\n]/.test(expr))throw new Error('Use one expression on one line; line wrapping in the viewer is visual only.');
 if(!['let','set','push','return'].includes(node.sourceKind))throw new Error('Select an enclosing expression statement to edit.');
 const lines=source.split(/\r?\n/),index=node.sourceLine-1,line=lines[index];
 if(typeof line!=='string')throw new Error('Source location changed. Select the expression again.');
 const text=line.trim(),prefix=text.startsWith('sample ')?/^(\s*sample\s+x\s*=>\s*).+$/:node.sourceKind==='return'?/^(\s*return\s+).+$/:/^(\s*(?:let|set|push)\s+[A-Za-z_][A-Za-z0-9_]*\s*:=\s*).+$/;
 if(!prefix.test(line))throw new Error('Source statement changed. Select the expression again.');
 if(!text.startsWith('sample ')&&text!==node.sourceCode)throw new Error('Source has changed since this view was built. Select it again before editing.');
 lines[index]=line.replace(prefix,(_,p)=>p+expr);return lines.join('\n');
}
function paintCode(element,text){
 const parts=text.split(/(\b(?:dsp|where|param|state|buffer|sample|let|set|push|return|range)\b|\b[A-Za-z_]\w*(?=\()|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g);
 element.innerHTML=parts.map(s=>/^(dsp|where|param|state|buffer|sample|let|set|push|return|range)$/.test(s)?'<span class="code-keyword">'+esc(s)+'</span>':/^\d/.test(s)?'<span class="code-number">'+esc(s)+'</span>':esc(s)).join('');
}
export class ExpressionView{
 constructor(host,{onSelect,onEdit,onSource,onMessage}={}){this.host=host;this.mode='expression';this.hooks={onSelect,onEdit,onSource,onMessage};this.graph=null;this.node=null;}
 clear(){this.host.hidden=true;this.host.replaceChildren();this.graph=null;this.node=null;}
 show(graph,node,{patternLabel='',live=false}={}){this.graph=graph;this.node=node;this.patternLabel=patternLabel;this.live=live;this.host.hidden=false;this.render();}
 render(){
  const g=this.graph,n=this.node;if(!g||!n)return this.clear();
  const slice=sourceSlice(g,n.id),owner=slice.owner;if(!owner)return this.clear();
  const h=this.host;h.replaceChildren();h.className='expression-panel';h.dataset.sourceNode=n.id;
  const header=document.createElement('div');header.className='expression-heading';const title=document.createElement('h3');title.textContent='Expression & inputs';const loc=document.createElement('span');loc.textContent=owner.sourceLine?'Source line '+owner.sourceLine:'Host input';header.append(title,loc);h.append(header);
  const label=document.createElement('label');label.className='expression-picker';label.append(document.createTextNode('Statement '));const pick=document.createElement('select');pick.setAttribute('aria-label','Choose a source statement');pick.dataset.expressionStatement='';
  for(const st of g.nodes.filter(x=>['let','set','push','return'].includes(x.sourceKind))){const opt=document.createElement('option');opt.value=st.id;opt.textContent=(st.sourceKind==='return'?'return / audio out':st.sourceKind==='let'?st.name:st.label)+' · line '+st.sourceLine;pick.append(opt);}
  if([...pick.options].some(o=>o.value===owner.id))pick.value=owner.id;else{const opt=document.createElement('option');opt.value=owner.id;opt.textContent=owner.label+' · '+owner.type;pick.prepend(opt);pick.value=owner.id;}
  pick.onchange=()=>this.hooks.onSelect?.(pick.value);label.append(pick);h.append(label);
  const tabs=document.createElement('div');tabs.className='expression-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Source code view');
  const addButton=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;tabs.append(b);return b;};
  for(const [id,text]of [['expression','This statement'],['dependencies','With dependencies']]){const b=addButton(text,()=>{this.mode=id;this.render()});b.dataset.codeMode=id;b.classList.toggle('active',this.mode===id);b.setAttribute('aria-pressed',String(this.mode===id));}
  const currentCode=this.mode==='dependencies'?slice.text:owner.sourceCode||n.expression||n.label;
  addButton('Copy',async()=>{try{await navigator.clipboard.writeText(currentCode);this.hooks.onMessage?.('Source copied');}catch{this.hooks.onMessage?.('Copy unavailable here; select the source text to copy it.');}});h.append(tabs);
  if(owner.id!==n.id&&n.expression){const caption=document.createElement('small');caption.className='expression-caption';caption.textContent='Selected part of '+(owner.sourceKind==='let'?owner.name:owner.label);h.append(caption);const part=document.createElement('pre');part.className='expression-code selected-expression';part.dataset.selectedExpression='';paintCode(part,n.expression);h.append(part);}
  const pre=document.createElement('pre');pre.className='expression-code';pre.dataset.expressionCode='';pre.setAttribute('aria-label',this.mode==='dependencies'?'Source with upstream dependencies':'Enclosing source statement');paintCode(pre,currentCode);h.append(pre);
  const note=document.createElement('p');note.className='expression-note';note.textContent=this.mode==='dependencies'?'Dependency slice in source order, not a standalone program. State/buffer declarations mark persistent values at entry; initializers are not re-run. Parameter defaults are not current runtime values.':'Original enclosing statement. Atomic-node expressions are printed from the parsed tree with explicit grouping, without algebraic simplification.';h.append(note);if(n.measurementNote){const m=document.createElement('p');m.className='expression-note';m.textContent=n.measurementNote;h.append(m);}
  if(owner.codeInputs?.length){const deps=document.createElement('div');deps.className='expression-inputs';const caption=document.createElement('small');caption.textContent='Statement inputs';deps.append(caption);for(const d of slice.inputs){if(!d.node)continue;const b=document.createElement('button');b.type='button';b.dataset.codeInput=d.node.id;b.textContent=d.name+' · '+(d.node.sourceKind||d.node.type);b.title=d.node.sourceCode||d.node.detail;b.onclick=()=>this.hooks.onSelect?.(d.node.id);deps.append(b);}h.append(deps);}
  const calls=this.mode==='dependencies'?slice.builtins:owner.builtinNames||[];
  if(calls.length){const details=document.createElement('details');details.className='expression-intrinsics';const summary=document.createElement('summary');summary.textContent='Primitive meanings · '+calls.join(', ');details.append(summary);const caveat=document.createElement('p');caveat.textContent='Implementation notes, not proved identities. All arithmetic lowers to F32. Workbench contains the actual generated WAT.';details.append(caveat);for(const fn of calls){const d=primitiveNotes[fn]||[fn,'See the generated WAT in Workbench.'],name=document.createElement('code'),p=document.createElement('p');name.textContent=d[0];p.textContent=d[1];details.append(name,p);if(d[2]){const formula=document.createElement('pre');formula.className='expression-code';formula.textContent=d[2];details.append(formula);}}h.append(details);}
  const actions=document.createElement('div');actions.className='button-row expression-actions';
  if(['let','set','push','return'].includes(owner.sourceKind)){const b=document.createElement('button');b.type='button';b.textContent=owner.id===n.id?'Edit this statement':'Edit enclosing statement';b.dataset.editExpression='';b.onclick=()=>this.hooks.onEdit?.(owner);actions.append(b);}
  const full=document.createElement('button');full.type='button';full.textContent='Full pattern source';full.onclick=()=>this.hooks.onSource?.();actions.append(full);h.append(actions);
  const evidence=document.createElement('small');evidence.className='expression-evidence';evidence.textContent='Custom DSP DSL · JavaScript checker → Wasm · not Lean-kernel verified';h.append(evidence);
 }
}