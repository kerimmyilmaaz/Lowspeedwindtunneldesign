/* Smokeline · tunnel sound.
   Synthesised with Web Audio, no audio files: pink noise low-passed by the flow speed (the rush of air),
   a low duct rumble, the fan blade-pass tone with slightly detuned copies for a fan array (they beat like
   real fans), the motor hum, and in the icing tab a thin spray hiss. Each tab feeds its own numbers via
   SL_sound.set('open'|'closed', {...}); the tab on screen is the one heard.
   Off by default. The choice is remembered; after a reload it resumes on the first tap or key press,
   because browsers only start audio from a user gesture. */
(function(){
'use strict';
const KEY='smokeline.sound', ROOT=document.documentElement, BLADES=9, MAXF=4, TC=0.25;
let on=false, ctx=null, N=null, idle=0;
try{ on=localStorage.getItem(KEY)==='1'; }catch(_){}
const want={open:{V:0,Vmax:80,shaft:0,fans:1,spray:0},closed:{V:0,Vmax:60,shaft:0,fans:4,spray:0}};
const src=()=>ROOT.classList.contains('is-closed')?'closed':'open';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function noise(c,sec,pink){
  const n=Math.floor(c.sampleRate*sec), b=c.createBuffer(1,n,c.sampleRate), d=b.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for(let i=0;i<n;i++){ const w=Math.random()*2-1;
    if(!pink){ d[i]=w*0.5; continue; }
    /* Paul Kellet's pink filter */
    b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759; b2=0.969*b2+w*0.153852; b3=0.8665*b3+w*0.3104856;
    b4=0.55*b4+w*0.5329522; b5=-0.7616*b5-w*0.016898; d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926; }
  /* short fade at the seam so the loop does not click */
  const f=Math.min(2048,n>>3); for(let i=0;i<f;i++){ const k=i/f; d[n-f+i]=d[n-f+i]*(1-k)+d[i]*k; }
  return b;
}
function build(){
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return false;
  ctx=new AC(); const c=ctx, g=v=>{ const x=c.createGain(); x.gain.value=v; return x; };
  const master=g(0), comp=c.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=3;
  master.connect(comp); comp.connect(c.destination);
  const pink=c.createBufferSource(); pink.buffer=noise(c,5,true); pink.loop=true;
  const white=c.createBufferSource(); white.buffer=noise(c,3,false); white.loop=true;
  /* flow rush */
  const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=0.4; const gFlow=g(0);
  pink.connect(lp); lp.connect(gFlow); gFlow.connect(master);
  /* duct body */
  const lpB=c.createBiquadFilter(); lpB.type='lowpass'; lpB.frequency.value=110; lpB.Q.value=0.9; const gBody=g(0);
  pink.connect(lpB); lpB.connect(gBody); gBody.connect(master);
  /* spray hiss */
  const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3200; const gSpray=g(0);
  white.connect(hp); hp.connect(gSpray); gSpray.connect(master);
  /* fan blade-pass: soft harmonic series, one oscillator per fan (up to four), slightly detuned */
  const wave=c.createPeriodicWave(new Float32Array([0,0,0,0,0,0]),new Float32Array([0,1,0.45,0.2,0.09,0.04]));
  const fanLP=c.createBiquadFilter(); fanLP.type='lowpass'; fanLP.Q.value=0.7; const gFan=g(0);
  fanLP.connect(gFan); gFan.connect(master);
  const osc=[], og=[];
  for(let i=0;i<MAXF;i++){ const o=c.createOscillator(); o.setPeriodicWave(wave); o.frequency.value=100; const x=g(0); o.connect(x); x.connect(fanLP); o.start(); osc.push(o); og.push(x); }
  /* slow wobble on the fan level, like a real rotor in turbulent inflow */
  const lfo=c.createOscillator(); lfo.frequency.value=0.23; const lfoG=g(0); lfo.connect(lfoG); lfoG.connect(gFan.gain); lfo.start();
  /* shaft hum */
  const sh=c.createOscillator(); sh.type='sine'; const gSh=g(0); sh.connect(gSh); gSh.connect(master); sh.start();
  pink.start(); white.start();
  N={master,lp,gFlow,gBody,gSpray,fanLP,gFan,osc,og,lfoG,sh,gSh};
  return true;
}
function apply(){
  if(!N) return;
  const p=want[src()], t=ctx.currentTime, set=(a,v)=>a.setTargetAtTime(v,t,TC);
  const x=clamp(p.V/p.Vmax,0,1), live=on&&!document.hidden&&p.V>0;
  set(N.master.gain,live?0.9:0);
  set(N.gFlow.gain,0.55*Math.pow(x,1.3)); set(N.lp.frequency,160+2600*x*x);
  set(N.gBody.gain,0.5*x);
  set(N.gSpray.gain,0.05*clamp(p.spray,0,3)*x);
  const bpf=p.shaft*BLADES, k=clamp(Math.round(p.fans)||1,1,MAXF);
  N.osc.forEach((o,i)=>{ const det=k>1?(i-(k-1)/2)*0.007:0; set(o.frequency,Math.max(20,bpf*(1+det))); set(N.og[i].gain,i<k?1/k:0); });
  set(N.fanLP.frequency,Math.max(200,bpf*3));
  const fan=bpf>0?0.06+0.08*x:0; set(N.gFan.gain,fan); set(N.lfoG.gain,fan*0.25);
  /* motor hum: 100 Hz (twice the 50 Hz mains), louder as the load rises */
  set(N.sh.frequency,100); set(N.gSh.gain,p.shaft>0?0.05+0.07*x:0);
  /* park the audio thread once it has faded out */
  clearTimeout(idle);
  if(live){ if(ctx.state==='suspended') ctx.resume(); }
  else idle=setTimeout(()=>{ if(ctx&&!(on&&!document.hidden)) ctx.suspend(); },900);
}
function start(){ if(!ctx&&!build()) return; if(ctx.state==='suspended') ctx.resume(); apply(); }
function sync(){
  document.querySelectorAll('.snd').forEach(b=>{ b.setAttribute('aria-pressed',String(on)); b.title=on?'Mute tunnel sound':'Play tunnel sound'; b.setAttribute('aria-label',b.title); });
}
function toggle(){
  on=!on; try{ localStorage.setItem(KEY,on?'1':'0'); }catch(_){}
  sync(); if(on) start(); else apply();
}
window.SL_sound={
  set(which,p){ Object.assign(want[which],p); if(N) apply(); },
  toggle, get on(){ return on; }
};
function init(){
  document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('.snd'); if(b){ e.preventDefault(); toggle(); } });
  sync();
  if(on){ const go=()=>{ start(); ['pointerdown','keydown'].forEach(t=>removeEventListener(t,go,true)); };
    ['pointerdown','keydown'].forEach(t=>addEventListener(t,go,true)); }
  document.addEventListener('visibilitychange',()=>{ if(N){ if(!document.hidden&&on&&ctx.state==='suspended') ctx.resume(); apply(); } });
  new MutationObserver(()=>{ if(N) apply(); }).observe(ROOT,{attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
