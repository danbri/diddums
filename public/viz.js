// Live visualiser drawn from an AnalyserNode on the master output. 'ring' = radial spectrum + waveform,
// 'line' = compact waveform. Idles with a slow breathing shape; stops drawing when off-screen or hidden.
export function attachViz(canvas,getAnalyser,{mode='ring'}={}){
 const g=canvas.getContext('2d');let raf=0,visible=true,t0=performance.now(),freq=null,wave=null;
 const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
 const size=()=>{const dpr=Math.min(2,window.devicePixelRatio||1),r=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}return {w,h,dpr};};
 function frame(now){
  raf=0;if(!visible||document.hidden)return;
  const {w,h,dpr}=size(),a=getAnalyser(),mint=css('--mint')||'#7ce3dd',violet=css('--violet')||'#ba96f0';
  g.clearRect(0,0,w,h);
  let level=0;
  if(a){if(!freq||freq.length!==a.frequencyBinCount){freq=new Uint8Array(a.frequencyBinCount);wave=new Uint8Array(a.fftSize);}a.getByteFrequencyData(freq);a.getByteTimeDomainData(wave);for(let i=0;i<wave.length;i+=4){const v=(wave[i]-128)/128;level+=v*v;}level=Math.sqrt(level/(wave.length/4));}
  const idle=level<.002,time=(now-t0)/1000;
  if(mode==='line'){
   g.lineWidth=2*dpr;g.strokeStyle=mint;g.beginPath();
   const n=96;for(let i=0;i<=n;i++){const x=i/n*w,v=a&&!idle?(wave[Math.floor(i/n*(wave.length-1))]-128)/128:Math.sin(i/n*Math.PI*4+time*1.6)*.08;const y=h/2+v*h*.45;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();
  }else{
   const cx=w/2,cy=h/2,R=Math.min(w,h)*.30,bins=72;
   for(let i=0;i<bins;i++){
    const ang=i/bins*Math.PI*2-Math.PI/2,src=a&&!idle?freq[Math.floor(Math.pow(i/bins,1.7)*freq.length*.6)]/255:.12+.08*Math.sin(time*1.3+i*.35);
    const len=R*(.08+src*.85),x1=cx+Math.cos(ang)*R,y1=cy+Math.sin(ang)*R,x2=cx+Math.cos(ang)*(R+len),y2=cy+Math.sin(ang)*(R+len);
    g.strokeStyle=i%2?mint:violet;g.globalAlpha=.35+src*.65;g.lineWidth=Math.max(2,R*.045);g.lineCap='round';g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
   }
   g.globalAlpha=1;g.beginPath();
   const pts=128;for(let i=0;i<=pts;i++){const ang=i/pts*Math.PI*2,v=a&&!idle?(wave[Math.floor(i/pts*(wave.length-1))]-128)/128:Math.sin(time*2+i*.2)*.03;const r=R*.82+v*R*.5,x=cx+Math.cos(ang)*r,y=cy+Math.sin(ang)*r;i?g.lineTo(x,y):g.moveTo(x,y);}
   g.closePath();g.strokeStyle=mint;g.lineWidth=1.6*dpr;g.stroke();
   g.beginPath();g.arc(cx,cy,R*(.32+Math.min(.4,level*2.2)+(idle?.03*Math.sin(time*1.4):0)),0,Math.PI*2);g.fillStyle=violet;g.globalAlpha=.25+Math.min(.5,level*3);g.fill();g.globalAlpha=1;
  }
  // Full frame rate only while sound is moving; a slow idle animation is enough otherwise (battery).
  if(idle)raf=setTimeout(()=>{raf=requestAnimationFrame(frame);},66);else raf=requestAnimationFrame(frame);
 }
 const kick=()=>{if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(frame);};
 if('IntersectionObserver' in window)new IntersectionObserver(es=>{visible=es.some(e=>e.isIntersecting);kick();}).observe(canvas);
 document.addEventListener('visibilitychange',kick);kick();
 return {kick};
}
