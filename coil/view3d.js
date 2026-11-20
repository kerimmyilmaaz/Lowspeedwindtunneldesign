/* Smokeline · Coil & Chiller · 3D view of the recommended coil (three.js r128, vendored).
   Tubes, fins, U-bends, headers, the series jumper, casing and drain pan follow the design exactly
   (tube counts, pitches, pattern, rows, fin pitch, circuits × passes). The circuiting pattern drawn here is
   a representative serpentine; the manufacturer fixes the real one. Coordinates: x along the tubes (face width),
   y up, z in the air direction (front stage first). */
(function(root){
'use strict';
const SRC='coil/vendor/three.min.js';
let loading=null;
function load(){
  if(root.THREE) return Promise.resolve();
  if(!loading) loading=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=SRC; s.async=true;
    s.onload=()=>res(); s.onerror=()=>{ loading=null; rej(new Error('three.js could not be loaded')); }; document.head.appendChild(s); });
  return loading;
}
const VIEWS={iso:[0.72,0.36,1],air:[0.0001,0.03,0.92],headers:[Math.PI/2+0.42,0.2,0.72],top:[0.0001,1.45,0.95],section:[-Math.PI/2+0.001,0.02,0.55],out:[Math.PI,0.06,0.92]};

function mount(host,opts){
  opts=opts||{};
  const T=root.THREE, RM=matchMedia('(prefers-reduced-motion: reduce)');
  let renderer; try{ renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); }catch(e){ return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); renderer.setClearColor(0,0); renderer.localClippingEnabled=true;
  const cv=renderer.domElement; cv.className='v3-cv'; host.appendChild(cv);
  cv.setAttribute('role','img'); cv.setAttribute('aria-label','Three-dimensional model of the recommended two-stage cooling coil. Drag to rotate, scroll to zoom.');
  const labels=document.createElement('div'); labels.className='v3-labels'; host.appendChild(labels);
  const scene=new T.Scene(), cam=new T.PerspectiveCamera(30,1,0.02,80);
  scene.add(new T.HemisphereLight(0xdfefff,0x1a2430,0.65));
  const sun=new T.DirectionalLight(0xffffff,0.85); sun.position.set(-3,5,-4); scene.add(sun);
  const rim=new T.DirectionalLight(0x7fd4ff,0.55); rim.position.set(4,1,5); scene.add(rim);
  const clip=new T.Plane(new T.Vector3(0,-1,0),1e3);
  const S=(c,o)=>new T.MeshStandardMaterial(Object.assign({color:c,roughness:0.55,metalness:0.35},o||{}));
  const MAT={
    cu:S(0xC9793A,{roughness:0.38,metalness:0.75}),
    fin:S(0xC5D0D8,{roughness:0.45,metalness:0.55,clippingPlanes:[clip],side:T.DoubleSide}),
    finFront:S(0xAFC3D1,{roughness:0.45,metalness:0.55,clippingPlanes:[clip],side:T.DoubleSide}),
    steel:S(0x6F7F8B,{roughness:0.6,metalness:0.5,clippingPlanes:[clip]}),
    sheet:S(0x8FA3AE,{transparent:true,opacity:0.16,side:T.DoubleSide,depthWrite:false,clippingPlanes:[clip],metalness:0.2}),
    flange:S(0x55636F,{roughness:0.5,metalness:0.6,clippingPlanes:[clip]}),
    pan:S(0x7D8C97,{roughness:0.35,metalness:0.8}),
    supply:S(0x1E9BE0,{roughness:0.35,metalness:0.4,emissive:0x06263a}),
    mid:S(0x46B9E6,{roughness:0.35,metalness:0.4,emissive:0x082a38}),
    ret:S(0x8ED8F2,{roughness:0.35,metalness:0.4,emissive:0x0d2c36}),
    ice:new T.MeshStandardMaterial({color:0xF2FBFF,roughness:0.25,metalness:0,transparent:true,opacity:0.92,emissive:0x2b4a5a,clippingPlanes:[clip]})
  };
  const root3=new T.Group(); scene.add(root3);
  const gCore=new T.Group(), gFins=new T.Group(), gCase=new T.Group(), gIce=new T.Group(), gAir=new T.Group(), gTrace=new T.Group(), gFloor=new T.Group();
  root3.add(gCore,gFins,gCase,gIce,gAir,gTrace); scene.add(gFloor);
  const m4=new T.Matrix4(), q=new T.Quaternion(), v3=new T.Vector3(), one=new T.Vector3(1,1,1);
  const st={casing:true,fins:true,cut:false,explode:false,air:!RM.matches,trace:true,labels:true,ice:0};
  let M=null, rad=3, az=VIEWS.iso[0], el=VIEWS.iso[1], zf=1, taz=az, tel=el, tzf=zf, dirty=true, raf=0, vis=true, ex=0, tex=0, t0=performance.now();
  const disposeGroup=g=>{ while(g.children.length){ const o=g.children.pop(); o.traverse(x=>{ if(x.geometry) x.geometry.dispose(); if(x.isInstancedMesh) x.dispose&&x.dispose(); if(x.material&&x.userData.own){ (Array.isArray(x.material)?x.material:[x.material]).forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); }); } }); } };
  const inst=(geo,mat,n)=>{ const im=new T.InstancedMesh(geo,mat,Math.max(1,n)); im.frustumCulled=false; im.count=n; return im; };

  /* floor grid */
  (function(){ const g=new T.GridHelper(8,32,0x1f3a4d,0x132430); g.material.transparent=true; g.material.opacity=0.55; gFloor.add(g); })();

  /* ---- layout of rows and tubes ---- */
  function layout(M){
    const rows=[]; let z=-M.depth/2;
    M.stages.forEach((s,si)=>{ for(let r=0;r<s.rows;r++){ rows.push({si,r,z:z+(r+0.5)*s.Pl,off:s.stag?(r%2?1:-1)*s.Pt/4:0}); }
      s.z0=z; z+=s.rows*s.Pl; s.z1=z; if(si<M.stages.length-1) z+=M.gap; });
    const ys=(s,row)=>{ const out=[]; for(let j=0;j<s.Nt;j++) out.push(-M.H/2+(M.H-(s.Nt-1)*s.Pt)/2+j*s.Pt+row.off); return out; };
    return {rows,ys};
  }
  /* representative serpentine: every circuit enters at the downstream row of its stage (counter-flow) */
  function circuits(M,L){
    const out=[];
    M.stages.forEach((s,si)=>{
      const rs=L.rows.filter(x=>x.si===si), R=rs.length, tubes=R*s.Nt, P=s.passes, Nc=s.Ncirc;
      const at=(lev,rr)=>({lev,rr,z:rs[rr].z,y:L.ys(s,rs[rr])[lev]});
      const seq=[];
      if(P%R===0){ /* whole levels per circuit, start at the rear row of every circuit */
        const lv=P/R; for(let c=0;c<Nc;c++){ const path=[]; for(let k=0;k<lv;k++){ const lev=c*lv+k; const fwd=k%2===0; for(let i=0;i<R;i++) path.push(at(lev,fwd?R-1-i:i)); } seq.push(path); }
      } else { const all=[]; for(let lev=0;lev<s.Nt;lev++){ const fwd=lev%2===0; for(let i=0;i<R;i++) all.push(at(lev,fwd?R-1-i:i)); }
        for(let c=0;c<Nc;c++) seq.push(all.slice(c*P,(c+1)*P)); }
      void tubes; out.push(seq);
    });
    return out;
  }
  function build(){
    [gCore,gFins,gCase,gIce,gAir,gTrace].forEach(disposeGroup);
    const W=M.W, H=M.H, xt=W/2+0.03, L=layout(M); M._L=L; const C=circuits(M,L); M._C=C;
    /* tubes */
    M.stages.forEach((s,si)=>{ const r=s.Do/2, tg=new T.CylinderGeometry(r,r,2*xt,12,1); tg.rotateZ(Math.PI/2);
      const rs=L.rows.filter(x=>x.si===si), im=inst(tg,MAT.cu,rs.length*s.Nt); let k=0;
      rs.forEach(rw=>L.ys(s,rw).forEach(y=>{ m4.makeTranslation(0,y,rw.z); im.setMatrixAt(k++,m4); })); im.userData.stage=si; gCore.add(im); });
    /* U-bends, grouped by span */
    const bends=new Map(), stubs=[], heads=[];
    C.forEach((seq,si)=>{ const s=M.stages[si];
      seq.forEach(path=>{ for(let k=0;k<path.length-1;k++){ const a=path[k], b=path[k+1], side=k%2===0?-1:1;
          const dy=b.y-a.y, dz=b.z-a.z, span=Math.hypot(dy,dz), key=si+'|'+s.Do.toFixed(5)+'|'+span.toFixed(4);
          if(!bends.has(key)) bends.set(key,{r:s.Do/2,span,si,list:[]}); bends.get(key).list.push({x:side*xt,y:(a.y+b.y)/2,z:(a.z+b.z)/2,dy,dz,side,si}); }
        stubs.push({si,inl:path[0],out:path[path.length-1],r:s.Do/2}); }); });
    bends.forEach(B=>{ const tg=new T.TorusGeometry(B.span/2,B.r,8,14,Math.PI), im=inst(tg,MAT.cu,B.list.length);
      B.list.forEach((b,i)=>{ const ux=new T.Vector3(0,b.dy,b.dz).normalize(), uy=new T.Vector3(b.side,0,0), uz=new T.Vector3().crossVectors(ux,uy);
        const mb=new T.Matrix4().makeBasis(ux,uy,uz); mb.setPosition(b.x,b.y,b.z); im.setMatrixAt(i,mb); }); im.userData.stage=B.si; gCore.add(im); });
    /* headers: one per distinct inlet / outlet row of each stage, on the +x side */
    const hx=xt+0.06, HR=0.03, nStage=M.stages.length;
    M.stages.forEach((s,si)=>{ const ss=stubs.filter(x=>x.si===si);
      const groups=(key)=>{ const m=new Map(); ss.forEach(x=>{ const p=x[key]; const kz=p.z.toFixed(4); if(!m.has(kz)) m.set(kz,{z:p.z,ys:[]}); m.get(kz).ys.push(p.y); }); return [...m.values()]; };
      const inG=groups('inl'), outG=groups('out');
      const matIn=si===nStage-1?MAT.supply:MAT.mid, matOut=si===0?MAT.ret:MAT.mid;
      const mk=(G,mat,kind)=>G.forEach(g=>{ const y0=Math.min(...g.ys)-0.04, y1=Math.max(...g.ys)+0.04, h=new T.Mesh(new T.CylinderGeometry(HR,HR,y1-y0,16),mat);
        h.position.set(hx,(y0+y1)/2,g.z); h.userData.stage=si; gCore.add(h); heads.push({si,kind,z:g.z,y0,y1});
        const sg=new T.CylinderGeometry(s.Do*0.42,s.Do*0.42,hx-xt,6); sg.rotateZ(Math.PI/2); const im=inst(sg,mat,g.ys.length);
        g.ys.forEach((y,i)=>{ m4.makeTranslation((xt+hx)/2,y,g.z); im.setMatrixAt(i,m4); }); im.userData.stage=si; gCore.add(im); });
      mk(inG,matIn,'in'); mk(outG,matOut,'out'); });
    /* jumper: main-stage outlet header → front-stage inlet header (series), and the chiller nozzles */
    let tagS=-1; const tag=m=>{ if(tagS>=0) m.userData.stage=tagS; else m.userData.jump=true; gCore.add(m); };
    const pipe=(a,b,mat,r)=>{ const d=new T.Vector3().subVectors(b,a), len=d.length(); if(len<1e-6) return; const m=new T.Mesh(new T.CylinderGeometry(r||HR,r||HR,len,16),mat);
      m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()); tag(m); };
    const elbow=(p,mat)=>{ const m=new T.Mesh(new T.SphereGeometry(HR*1.05,14,10),mat); m.position.copy(p); tag(m); };
    const top=H/2+0.09, by=k=>heads.filter(h=>h.si===k[0]&&h.kind===k[1]);
    if(nStage>1){ const o=by([1,'out'])[0], i=by([0,'in'])[0];
      if(o&&i){ const a=new T.Vector3(hx,o.y1,o.z), a2=new T.Vector3(hx,top,o.z), b2=new T.Vector3(hx,top,i.z), b=new T.Vector3(hx,i.y1,i.z);
        pipe(a,a2,MAT.mid); pipe(a2,b2,MAT.mid); pipe(b2,b,MAT.mid); elbow(a2,MAT.mid); elbow(b2,MAT.mid); M._jump=[a2,b2]; } }
    const sup=by([nStage-1,'in'])[0], ret=by([0,'out'])[0], noz=0.28, fl=(p,mat)=>{ const f=new T.Mesh(new T.CylinderGeometry(0.06,0.06,0.018,22),mat); f.rotation.z=Math.PI/2; f.position.copy(p); tag(f); };
    tagS=nStage-1; if(sup){ const a=new T.Vector3(hx,sup.y0,sup.z), b=new T.Vector3(hx,-H/2-0.07,sup.z), c=new T.Vector3(hx+noz,-H/2-0.07,sup.z); pipe(a,b,MAT.supply); elbow(b,MAT.supply); pipe(b,c,MAT.supply); fl(c,MAT.supply); M._sup=c; }
    tagS=0; if(ret){ const a=new T.Vector3(hx,ret.y0,ret.z), b=new T.Vector3(hx,-H/2-0.15,ret.z), c=new T.Vector3(hx+noz,-H/2-0.15,ret.z); pipe(a,b,MAT.ret); elbow(b,MAT.ret); pipe(b,c,MAT.ret); fl(c,MAT.ret); M._ret=c; }
    /* fins: thin plates across the airflow, one block per stage */
    M.stages.forEach((s,si)=>{ const nf=Math.max(1,Math.round(W/s.fp)), d=s.z1-s.z0, th=Math.max(0.0012,M.tf*3);
      const fg=new T.BoxGeometry(th,H,d), im=inst(fg,si===0?MAT.finFront:MAT.fin,nf);
      for(let i=0;i<nf;i++){ m4.makeTranslation(-W/2+(i+0.5)*W/nf,0,(s.z0+s.z1)/2); im.setMatrixAt(i,m4); } im.userData.stage=si; gFins.add(im); });
    /* casing: tube sheets, top and bottom channels, flanges, drain pan */
    const zA=-M.depth/2-0.05, zB=M.depth/2+0.05, dep=zB-zA;
    const box=(w,h,d,x,y,z,mat)=>{ const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); gCase.add(m); return m; };
    [-1,1].forEach(sd=>box(0.004,H+0.06,dep,sd*(W/2+0.012),0,(zA+zB)/2,MAT.sheet));
    [-1,1].forEach(sd=>box(W+0.03,0.004,dep,0,sd*(H/2+0.03),(zA+zB)/2,MAT.sheet));
    [zA,zB].forEach(z=>{ const t=0.035, fw=W+0.11, fh=H+0.11;
      box(fw,t,0.012,0,fh/2-t/2,z,MAT.flange); box(fw,t,0.012,0,-fh/2+t/2,z,MAT.flange); box(t,fh,0.012,fw/2-t/2,0,z,MAT.flange); box(t,fh,0.012,-fw/2+t/2,0,z,MAT.flange); });
    const pan=new T.Mesh(new T.BoxGeometry(W+0.16,0.03,dep+0.06),MAT.pan); pan.position.set(0,-H/2-0.055,(zA+zB)/2); pan.rotation.x=0.012; gCase.add(pan);
    /* ice horns on the front-stage fin edges (instanced, scaled with spray time) */
    { const s=M.stages[0], nf=Math.max(1,Math.round(W/s.fp)), ig=new T.BoxGeometry(1,1,1), im=inst(ig,MAT.ice,nf); im.userData.ice=true; im.userData.n=nf; im.userData.s=s; gIce.add(im); }
    /* traced circuit (one per stage) with moving dashes */
    buildTrace();
    /* air streaks */
    buildAir();
    frame(); dirty=true;
  }
  function stripeTex(c1,c2){ const c=document.createElement('canvas'); c.width=64; c.height=4; const g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,64,0); gr.addColorStop(0,c1); gr.addColorStop(0.5,c2); gr.addColorStop(1,c1); g.fillStyle=gr; g.fillRect(0,0,64,4);
    const t=new T.CanvasTexture(c); t.wrapS=T.RepeatWrapping; t.wrapT=T.RepeatWrapping; return t; }
  let traceTex=[];
  function buildTrace(){
    disposeGroup(gTrace); traceTex=[];
    if(!M) return; const W=M.W, xt=W/2+0.03;
    M._C.forEach((seq,si)=>{ const s=M.stages[si], path=seq[Math.floor(seq.length*0.62)]||seq[0]; if(!path) return;
      const pts=[]; pts.push(new T.Vector3(xt+0.06,path[0].y,path[0].z));
      path.forEach((p,k)=>{ const sIn=k===0?1:(k%2===1?-1:1), sOut=-sIn;
        pts.push(new T.Vector3(sIn*xt,p.y,p.z)); pts.push(new T.Vector3(sOut*xt,p.y,p.z));
        const n=path[k+1]; if(n){ const r=Math.hypot(n.y-p.y,n.z-p.z)/2; pts.push(new T.Vector3(sOut*(xt+r*0.95),(p.y+n.y)/2,(p.z+n.z)/2)); } });
      const last=path[path.length-1]; pts.push(new T.Vector3(xt+0.06,last.y,last.z));
      const curve=new T.CatmullRomCurve3(pts,false,'catmullrom',0.08), tex=stripeTex(si===M.stages.length-1?'#0E6FB0':'#2AA6D8','#C9F3FF');
      tex.repeat.set(pts.length*1.6,1); traceTex.push(tex);
      const mat=new T.MeshBasicMaterial({map:tex,transparent:true,opacity:0.95,depthTest:true}), m=new T.Mesh(new T.TubeGeometry(curve,pts.length*14,s.Do*0.62,8,false),mat);
      m.userData.own=true; m.userData.stage=si; gTrace.add(m); });
    gTrace.visible=st.trace;
  }
  /* air: points flowing in +z, coloured from inlet to outlet temperature */
  let air=null;
  function buildAir(){
    disposeGroup(gAir); air=null; if(!M) return;
    const n=1400, pos=new Float32Array(n*3), col=new Float32Array(n*3), seed=new Float32Array(n*3);
    for(let i=0;i<n;i++){ seed[i*3]=(Math.random()-0.5)*M.W*0.96; seed[i*3+1]=(Math.random()-0.5)*M.H*0.96; seed[i*3+2]=Math.random(); }
    const g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(pos,3)); g.setAttribute('color',new T.BufferAttribute(col,3));
    const mat=new T.PointsMaterial({size:0.018,vertexColors:true,transparent:true,opacity:0.85,depthWrite:false,blending:T.AdditiveBlending});
    const p=new T.Points(g,mat); p.userData.own=true; p.frustumCulled=false; gAir.add(p); air={n,pos,col,seed,g}; gAir.visible=st.air;
  }
  const cWarm=new T.Color(0xFFB46B), cIn=new T.Color(0xA9CBFF), cOut=new T.Color(0x4DC2E8), ctmp=new T.Color();
  function stepAir(t){
    if(!air||!gAir.visible) return; const span=M.depth+1.6, z0=-M.depth/2-0.9, zc0=-M.depth/2, zc1=M.depth/2;
    for(let i=0;i<air.n;i++){ const f=(air.seed[i*3+2]+t*0.11)%1, z=z0+f*span; air.pos[i*3]=air.seed[i*3]; air.pos[i*3+1]=air.seed[i*3+1]; air.pos[i*3+2]=z;
      const k=Math.min(1,Math.max(0,(z-zc0)/(zc1-zc0))); ctmp.copy(cIn).lerp(cOut,k); if(z<zc0) ctmp.lerp(cWarm,Math.min(0.35,(zc0-z)*0.4));
      const fade=Math.min(1,f*6,(1-f)*6); air.col[i*3]=ctmp.r*fade; air.col[i*3+1]=ctmp.g*fade; air.col[i*3+2]=ctmp.b*fade; }
    air.g.attributes.position.needsUpdate=true; air.g.attributes.color.needsUpdate=true;
  }
  function frame(){ if(!M) return; const span=Math.max(M.W,M.H,M.depth)*1.0; rad=span*3.4; }
  function iceUpdate(){
    const im=gIce.children.find(x=>x.userData.ice); if(!im||!M) return; const s=im.userData.s, nf=im.userData.n, W=M.W, gap=s.fp-M.tf;
    const w=Math.min(gap*0.995,M.ice.dwdt*st.ice*60), vis=w>2e-5; im.visible=vis; if(!vis) return;
    const wv=Math.max(w,0.0006), dz=Math.max(0.002,w*0.7);
    for(let i=0;i<nf;i++){ m4.compose(v3.set(-W/2+(i+0.5)*W/nf,0,s.z0-dz/2+0.002),q.identity(),new T.Vector3(wv+M.tf,M.H*0.995,dz)); im.setMatrixAt(i,m4); }
    im.instanceMatrix.needsUpdate=true;
  }
  /* labels projected from 3D anchors */
  function labelSet(){
    labels.innerHTML=''; if(!M||!st.labels) return;
    const L=M.labels||[]; L.forEach(l=>{ const d=document.createElement('div'); d.className='v3-lab '+(l.cls||''); d.innerHTML='<b>'+l.t+'</b>'+(l.s?'<span>'+l.s+'</span>':''); labels.appendChild(d); l.el=d; });
  }
  function labelPos(w,h){
    if(!M||!st.labels||!M.labels) return; const tmp=new T.Vector3();
    M.labels.forEach(l=>{ if(!l.el) return; const a=l.at(); if(!a||(l.face&&Math.sign(cam.position.z)!==l.face)){ l.el.style.display='none'; return; } tmp.copy(a); root3.localToWorld(tmp); tmp.project(cam);
      const x=(tmp.x*0.5+0.5)*w, y=(-tmp.y*0.5+0.5)*h, on=tmp.z<1&&x>-40&&x<w+40&&y>-20&&y<h+20;
      l.el.style.display=on?'':'none'; l.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)'; });
  }
  /* interaction */
  let drag=null;
  cv.addEventListener('pointerdown',e=>{ drag={x:e.clientX,y:e.clientY,az:taz,el:tel}; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
  cv.addEventListener('pointermove',e=>{ if(!drag) return; taz=drag.az-(e.clientX-drag.x)*0.008; tel=Math.max(-0.2,Math.min(1.5,drag.el+(e.clientY-drag.y)*0.006)); dirty=true; });
  const end=()=>{ drag=null; cv.classList.remove('drag'); }; cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
  cv.addEventListener('wheel',e=>{ if(!e.ctrlKey&&!host.matches(':hover')) return; e.preventDefault(); tzf=Math.max(0.35,Math.min(2.2,tzf*(e.deltaY>0?1.08:0.926))); dirty=true; },{passive:false});
  function resize(){ const w=host.clientWidth, h=host.clientHeight; if(!w||!h) return; renderer.setSize(w,h,false); cv.style.width=w+'px'; cv.style.height=h+'px'; cam.aspect=w/h; cam.updateProjectionMatrix(); dirty=true; }
  const ro=new ResizeObserver(resize); ro.observe(host);
  const io=new IntersectionObserver(es=>{ vis=es[0].isIntersecting; if(vis) loop(); }); io.observe(host);
  function loop(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function tick(now){
      if(!vis) return; const t=(now-t0)/1000, k=RM.matches?1:0.12;
      az+=(taz-az)*k; el+=(tel-el)*k; zf+=(tzf-zf)*k; ex+=((st.explode?1:0)-ex)*k;
      const moving=Math.abs(taz-az)+Math.abs(tel-el)+Math.abs(tzf-zf)+Math.abs((st.explode?1:0)-ex)>1e-4;
      if(M){
        const r=rad*zf*(cam.aspect<1.25?Math.pow(1.25/cam.aspect,0.8):1), ce=Math.cos(el); cam.position.set(Math.sin(az)*ce*r,Math.sin(el)*r+0.1,-Math.cos(az)*ce*r); cam.lookAt(0,-0.16,0);
        /* explode: stages apart, casing up */
        gFins.children.forEach(m=>{ m.position.z=m.userData.stage===0?-0.45*ex:0.12*ex; });
        const zo=k=>k===0?-0.45*ex:0.12*ex; gCore.children.forEach(m=>{ if(m.userData.stage!==undefined){ if(m.userData.z0===undefined) m.userData.z0=m.position.z; m.position.z=m.userData.z0+zo(m.userData.stage); } if(m.userData.jump) m.visible=ex<0.04; });
        gTrace.children.forEach(m=>{ m.position.z=zo(m.userData.stage); });
        gCase.position.y=0.9*ex;
        gIce.position.z=-0.45*ex;
        clip.constant=st.cut?0:1e3;
        if(!RM.matches){ traceTex.forEach((tx,i)=>{ tx.offset.x=-(t*(i?0.55:0.45))%1; }); stepAir(t); }
        gFloor.position.y=-M.H/2-0.25;
        renderer.render(scene,cam); labelPos(host.clientWidth,host.clientHeight);
      }
      if(moving||dirty||!RM.matches){ dirty=false; raf=requestAnimationFrame(tick); }
    });
  }
  resize();
  const api={
    set(model){ M=model; build(); iceUpdate(); labelSet(); loop(); },
    view(n){ const v=VIEWS[n]; if(!v) return; taz=v[0]; tel=v[1]; tzf=v[2]; st.cut=n==='section'?st.cut:st.cut; loop(); },
    toggle(name,val){ st[name]=val; if(name==='casing') gCase.visible=val; if(name==='fins') gFins.visible=val; if(name==='air') gAir.visible=val; if(name==='trace') gTrace.visible=val; if(name==='labels') labelSet(); loop(); },
    setIce(tmin){ st.ice=tmin; iceUpdate(); loop(); },
    zoom(f){ tzf=Math.max(0.35,Math.min(2.2,tzf*f)); loop(); },
    snapshot(){ return cv.toDataURL('image/png'); },
    dispose(){ cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); [gCore,gFins,gCase,gIce,gAir,gTrace,gFloor].forEach(disposeGroup); renderer.dispose(); cv.remove(); labels.remove(); }
  };
  return api;
}
root.CoilView={load,mount};
})(window);
