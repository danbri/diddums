// Render a LeanDSP kernel offline (Node) through the same ABI the worklet uses: process(in=0, out=4096, n, freq, gate, colour, life).
export function renderKernel(bytes,{sr=48000,seconds=2,freq=220,gateOn=.5,colour=.5,life=1.2,velocity=.9}={}){
 const inst=new WebAssembly.Instance(new WebAssembly.Module(bytes),{});inst.exports.prepare(sr);inst.exports.reset();
 const out=new Float32Array(inst.exports.memory.buffer,4096,128),n=Math.ceil(seconds*sr/128)*128,y=new Float32Array(n);
 for(let i=0;i<n;i+=128){const gate=i<gateOn*sr?velocity:0;inst.exports.process(0,4096,128,freq,gate,colour,life);y.set(out,i);}
 return y;
}
import wabtFactory from 'wabt';
let wabt=null;
export async function watToBytes(wat,name='k'){wabt??=await wabtFactory();const m=wabt.parseWat(name+'.wat',wat,{bulk_memory:true,multi_value:true});m.resolveNames();m.validate();return new Uint8Array(m.toBinary({}).buffer);}
