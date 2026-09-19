// All RDF parsing, queries, conversion and canonicalization use the pinned npm package.
import {toRdf, query, canonicalize} from '@factoidal/core';
export const RDF_ENGINE={package:'@factoidal/core',version:'0.7.1',entry:'browser.mjs'};
let queue=Promise.resolve();
function exclusive(fn){const job=queue.then(fn);queue=job.catch(()=>{});return job;}
export const termKey=t=>t?`${t.type}:${t.value}`:'';
export function readRdf(text,{baseIRI='',format='turtle'}={}){
 if(typeof text!=='string'||text.length>2_000_000)throw new Error('RDF document is missing or exceeds the 2 MB profile limit');
 return exclusive(async()=>{
  const nq=await toRdf(text,{format,baseIRI});
  const result=await query(nq,'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 20001',{dataFormat:'nquads'});
  const rows=result?.results?.bindings;if(!Array.isArray(rows))throw new Error('Factoidal did not return RDF bindings');
  if(rows.length>20000)throw new Error('RDF profile exceeds the triple limit');
  const bySubject=new Map();for(const row of rows){const k=termKey(row.s);let ps=bySubject.get(k);if(!ps){ps=new Map();bySubject.set(k,ps);}const a=ps.get(row.p.value)||[];a.push(row.o);ps.set(row.p.value,a);}
  return {nquads:nq,triples:rows,engine:RDF_ENGINE,objects:(s,p)=>bySubject.get(termKey(s))?.get(p)||[]};
 });
}
export function rdfFromJsonLd(doc){return exclusive(()=>toRdf(JSON.stringify(doc),{format:'jsonld'}));}
export function canonicalRdf(text,options={}){return exclusive(()=>canonicalize(text,{format:'nquads',...options}));}