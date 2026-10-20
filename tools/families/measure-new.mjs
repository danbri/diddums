// The same audit on draft-compiled (not yet built) families: node measure-new.mjs <id regex> [every n-th]
import {families} from './archetypes.mjs';
import {compileLeanDSP} from '../../public/leandsp.js';
import {watToBytes} from './render.mjs';
import {report} from './measure-winds.mjs';
const pat=new RegExp(process.argv[2]||'^(bowed|blown|reed)'),every=Number(process.argv[3]||1);
const list=families.filter(f=>pat.test(f.id)).filter((_,i)=>i%every===0);
for(const f of list){const bytes=await watToBytes((await compileLeanDSP(f.source)).wat,f.id);console.log(report(f.id,bytes));}
