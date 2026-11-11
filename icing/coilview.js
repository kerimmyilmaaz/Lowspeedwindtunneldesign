/* Smokeline · coil designer · 3D view of the finned-tube coil (three.js, loaded on demand).
   Schematic: tubes, fins, U-bends, headers, casing and drain pan follow the designer inputs; nozzle position,
   header size and the circuiting pattern are representative and are fixed by the manufacturer's design. */
(function(){
'use strict';
const SRC='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
let loading=null;
function load(){
  if(window.THREE) return Promise.resolve();
  if(!loading) loading=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=SRC; s.async=true; s.onload=()=>res(); s.onerror=()=>{ loading=null; rej(new Error('three.js could not be loaded')); }; document.head.appendChild(s); });
  return loading;
}
const VIEWS={iso:[-0.72,0.42],front:[0,0.02],back:[Math.PI,0.05],side:[Math.PI/2,0.05],top:[0.0001,1.52],fin:[-0.28,0.16]};

function mount(host,onState){
  const T=window.THREE, RM=matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  try{ renderer=new T.WebGLRenderer({antialias:true,alpha:true}); }catch(_){ return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); renderer.setClearColor(0,0); renderer.localClippingEnabled=true;
  const cv=renderer.domElement; cv.style.cssText='display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab'; host.appendChild(cv);
  cv.setAttribute('role','img'); cv.setAttribute('aria-label','Three-dimensional view of the finned-tube coil; drag to rotate');
  const scene=new T.Scene(), cam=new T.PerspectiveCamera(32,1,0.02,80);
  scene.add(new T.AmbientLight(0xffffff,0.62));
  const l1=new T.DirectionalLight(0xffffff,0.85); l1.position.set(-3,4,-4); scene.add(l1);
  const l2=new T.DirectionalLight(0x9fdcf0,0.45); l2.position.set(4,-1,3); scene.add(l2);
  const clip=new T.Plane(new T.Vector3(0,-1,0),1e3);
  const L=(c,o)=>new T.MeshLambertMaterial(Object.assign({color:c},o||{}));
  const MAT={cu:L(0xC77A2E),fin:L(0xB9C4CA,{clippingPlanes:[clip],side:T.DoubleSide}),steel:L(0x7C8B95,{clippingPlanes:[clip]}),
    sheet:L(0x8FA3AE,{transparent:true,opacity:0.22,side:T.DoubleSide,depthWrite:false,clippingPlanes:[clip]}),pan:L(0x56677A),
    cold:L(0x2FA8D5),mid:L(0x5FC0E4),ret:L(0x8FD9F2),ice:L(0xF3FDFF,{emissive:0x35505c}),flow:L(0x4FD8C2)};
  const root=new T.Group(), gCore=new T.Group(), gFins=new T.Group(), gCase=new T.Group(), gIce=new T.Group(), gFlow=new T.Group(); root.add(gCore,gFins,gCase,gIce,gFlow); scene.add(root);
  const m4=new T.Matrix4(), q=new T.Quaternion(), v3=new T.Vector3(), one=new T.Vector3(1,1,1), ex=new T.Euler();
  let M=null, R=3, az=VIEWS.iso[0], el=VIEWS.iso[1], taz=az, tel=el, dist=1, tdist=1, auto=!RM.matches, dirty=true, settle=0, vis=true, raf=0, st={casing:true,cut:false,ice:0,fins:true};
  const clear=g=>{ while(g.children.length){ const o=g.children.pop(); o.traverse(x=>{ if(x.geometry) x.geometry.dispose(); if(x.isInstancedMesh) x.dispose(); if(x.material&&x.userData.own) x.material.dispose(); }); } };
  const inst=(geo,mat,n)=>{ const im=new T.InstancedMesh(geo,mat,n); im.frustumCulled=false; return im; };

  function rowsOf(M){ const out=[]; let z=-M.depth/2; M.stages.forEach((s,si)=>{ for(let r=0;r<s.rows;r++) out.push({si,r,z:z+(r+0.5)*M.Pl,off:M.stag?(out.length%2?1:-1)*M.Pt/4:0}); z+=s.rows*M.Pl+(si<M.stages.length-1?M.gap:0); }); return out; }
  function tubeYs(M,row){ const ys=[], n=M.Nt; for(let j=0;j<n;j++) ys.push(-M.H/2+(M.H-(M.Nt-1)*M.Pt)/2+j*M.Pt+row.off); return ys; }
  function build(){
    clear(gCore); clear(gFins); clear(gCase); clear(gFlow);
    const W=M.W, H=M.H, r=M.Do/2, xt=W/2+0.035, rows=rowsOf(M); M._rows=rows;
    /* tubes */
    const tg=new T.CylinderGeometry(r,r,2*xt,10,1); tg.rotateZ(Math.PI/2);
    const nT=rows.reduce((a,rw)=>a+tubeYs(M,rw).length,0), tubes=inst(tg,MAT.cu,nT); let k=0;
    rows.forEach(rw=>tubeYs(M,rw).forEach(y=>{ m4.makeTranslation(0,y,rw.z); tubes.setMatrixAt(k++,m4); })); gCore.add(tubes);
    /* U-bends and headers, stage by stage (counter-flow serpentine, inlet at the rear row) */
    const bends=[], zs=si=>rows.filter(x=>x.si===si);
    M.stages.forEach((s,si)=>{ const rs=zs(si), n=rs.length;
      for(let j=0;j<n-1;j++){ const a=rs[n-1-j], b=rs[n-2-j], side=j%2===0?-1:1; tubeYs(M,a).forEach((y,i)=>{ const yb=tubeYs(M,b)[Math.min(i,tubeYs(M,b).length-1)]; bends.push([side*xt,y,a.z,yb,b.z]); }); }
      const hd=(row,mat,side,up,noz)=>{ const hg=new T.CylinderGeometry(0.028,0.028,H+0.06,14), h=new T.Mesh(hg,mat); h.position.set(side*(xt+0.045),0,row.z); gCore.add(h);
        const sg=new T.CylinderGeometry(r*0.8,r*0.8,0.05,6); sg.rotateZ(Math.PI/2); const ys=tubeYs(M,row), stubs=inst(sg,mat,ys.length); ys.forEach((y,i)=>{ m4.makeTranslation(side*(xt+0.02),y,row.z); stubs.setMatrixAt(i,m4); }); gCore.add(stubs);
        if(noz===false) return; const ng=new T.CylinderGeometry(0.028,0.028,0.2,14); ng.rotateZ(Math.PI/2); const nz=new T.Mesh(ng,mat); nz.position.set(side*(xt+0.15),(up?1:-1)*(H/2-0.06),row.z); gCore.add(nz);
        const fg=new T.CylinderGeometry(0.052,0.052,0.014,18); fg.rotateZ(Math.PI/2); const fl=new T.Mesh(fg,mat); fl.position.set(side*(xt+0.255),nz.position.y,row.z); gCore.add(fl); };
      const last=si===M.stages.length-1, first=si===0, so=n%2===0?1:-1;
      hd(rs[n-1],last?MAT.cold:MAT.mid,1,false,last); hd(rs[0],first?MAT.ret:MAT.mid,so,true,first);
      if(!first){ /* jumper: this stage's outlet header to the inlet header of the stage in front of it */
        const prev=zs(si-1), zb=prev[prev.length-1].z, za=rs[0].z, xa=so*(xt+0.045), xb=xt+0.045, yj=H/2+0.03;
        const p1=new T.Mesh(new T.CylinderGeometry(0.028,0.028,Math.abs(za-zb)+0.056,14),MAT.mid); p1.rotation.x=Math.PI/2; p1.position.set(xa,yj,(za+zb)/2); gCore.add(p1);
        if(xa!==xb){ const p2=new T.Mesh(new T.CylinderGeometry(0.028,0.028,Math.abs(xa-xb)+0.056,14),MAT.mid); p2.rotation.z=Math.PI/2; p2.position.set((xa+xb)/2,yj,zb); gCore.add(p2); } } });
    if(bends.length){ const dref=M.stag?Math.hypot(M.Pt/2,M.Pl):M.Pl, ug=new T.TorusGeometry(0.5,r/dref,6,12,Math.PI); const ub=inst(ug,MAT.cu,bends.length);
      bends.forEach((b,i)=>{ const dy=b[3]-b[1], dz=b[4]-b[2], d=Math.hypot(dy,dz), side=Math.sign(b[0]);
        /* torus arc lies in its local xy-plane, ends on the local x-axis: map local x → tube-to-tube direction, local y → ±x (outwards) */
        const u=new T.Vector3(0,dy/d,dz/d), o=new T.Vector3(side,0,0), w=new T.Vector3().crossVectors(u,o);
        m4.makeBasis(u.multiplyScalar(d),o.multiplyScalar(d),w.multiplyScalar(d)); m4.setPosition(b[0],(b[1]+b[3])/2,(b[2]+b[4])/2); ub.setMatrixAt(i,m4); });
      gCore.add(ub); }
    /* fins: every plate up to a cap, then thinned for drawing speed */
    let z=-M.depth/2; M.drawn=[];
    M.stages.forEach((s,si)=>{ const d=s.rows*M.Pl, n=Math.max(1,Math.round(W/s.fp)), stride=Math.ceil(n/420), cnt=Math.ceil(n/stride);
      const fg=new T.BoxGeometry(Math.max(M.tf,0.0006),H-0.004,d-0.004), fins=inst(fg,MAT.fin,cnt);
      for(let i=0;i<cnt;i++){ m4.makeTranslation(-W/2+(i*stride+0.5)*W/n,0,z+d/2); fins.setMatrixAt(i,m4); }
      gFins.add(fins); M.drawn.push({n,cnt,stride,z0:z,d,fp:W/n}); z+=d+(si<M.stages.length-1?M.gap:0); });
    /* casing, flanges, drain pan */
    const zc0=-M.depth/2-0.07, zc1=M.depth/2+0.07, Lc=zc1-zc0, e=0.02;
    [-1,1].forEach(sx=>{ const p=new T.Mesh(new T.BoxGeometry(0.004,H+2*e,Lc),MAT.sheet); p.position.set(sx*(W/2+e),0,0); gCase.add(p);
      const t=new T.Mesh(new T.BoxGeometry(W+2*e,0.004,Lc),MAT.sheet); t.position.set(0,sx*(H/2+e),0); gCase.add(t); });
    [zc0,zc1].forEach(zf=>{ const t=0.05, o=W/2+e+t, oy=H/2+e+t; [[2*o,t,0,oy-t/2],[2*o,t,0,-(oy-t/2)],[t,2*oy,o-t/2,0],[t,2*oy,-(o-t/2),0]].forEach(a=>{ const b=new T.Mesh(new T.BoxGeometry(a[0],a[1],0.01),MAT.steel); b.position.set(a[2],a[3],zf); gCase.add(b); }); });
    [-1,1].forEach(sx=>[-1,1].forEach(sy=>{ const b=new T.Mesh(new T.BoxGeometry(0.024,0.024,Lc),MAT.steel); b.position.set(sx*(W/2+e),sy*(H/2+e),0); gCase.add(b); }));
    const pn=new T.Mesh(new T.BoxGeometry(W+0.14,0.01,Lc+0.06),MAT.pan); pn.position.set(0,-H/2-0.11,0); pn.rotation.x=-0.02; gCore.add(pn);
    [[W+0.14,0.01,0,zc0-0.03],[W+0.14,0.01,0,zc1+0.03],[0.01,Lc+0.06,-(W/2+0.07),0],[0.01,Lc+0.06,W/2+0.07,0]].forEach(a=>{ const b=new T.Mesh(new T.BoxGeometry(a[0],0.05,a[1]),MAT.pan); b.position.set(a[2],-H/2-0.09,a[3]); gCore.add(b); });
    const dr=new T.Mesh(new T.CylinderGeometry(0.018,0.018,0.3,10),MAT.pan); dr.position.set(W/2-0.06,-H/2-0.27,zc1-0.03); gCore.add(dr);
    /* airflow arrows */
    [[-0.28,0.22],[0.28,-0.22]].forEach(a=>{ const ar=new T.ArrowHelper(new T.Vector3(0,0,1),new T.Vector3(a[0]*W,a[1]*H,zc0-0.42*W-0.1),0.36*W,0x4FD8C2,0.1*W,0.055*W); ar.line.userData.own=ar.cone.userData.own=true; gFlow.add(ar); });
    R=0.5*Math.hypot(W+0.6,H+0.4,M.depth+0.5); ice(); frame(); dirty=true; settle=40;
  }
  /* ice: horns on the leading edges of the first stage and caps on the first tube row; st.ice = horn width [m] */
  function ice(){
    clear(gIce); if(!M||!(st.ice>M.tf*1.02)) { dirty=true; return; }
    const d0=M.drawn[0], w=Math.min(st.ice,d0.fp*0.999), dep=Math.min(Math.max(w,0.002)*1.1,0.06), H=M.H;
    const hg=new T.BoxGeometry(w,H-0.004,dep), horns=inst(hg,MAT.ice,d0.cnt);
    for(let i=0;i<d0.cnt;i++){ m4.makeTranslation(-M.W/2+(i*d0.stride+0.5)*M.W/d0.n,0,d0.z0-dep/2+0.002); horns.setMatrixAt(i,m4); }
    gIce.add(horns);
    const row=M._rows[0], ys=tubeYs(M,row), rr=M.Do/2+Math.min(w*0.6,0.012), cg=new T.CylinderGeometry(rr,rr,M.W,10,1,true,Math.PI,Math.PI); cg.rotateZ(Math.PI/2);
    const caps=inst(cg,MAT.ice,ys.length); ys.forEach((y,i)=>{ m4.makeTranslation(0,y,row.z-0.001); caps.setMatrixAt(i,m4); }); gIce.add(caps); dirty=true;
  }
  function frame(){ const fov=cam.fov*Math.PI/180, a=Math.max(0.6,cam.aspect); tdist=R/Math.sin(Math.min(fov,2*Math.atan(Math.tan(fov/2)*a))/2)*1.02; if(dist===1) dist=tdist; }
  function size(){ const w=host.clientWidth||600, h=host.clientHeight||420; renderer.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); if(M) frame(); dirty=true; }
  function apply(){
    gCase.visible=st.casing; gFins.visible=st.fins; clip.constant=st.cut&&M?M.H*0.12:1e3; dirty=true;
  }
  function tick(){
    raf=requestAnimationFrame(tick); if(!vis||!M) return;
    if(auto){ taz+=0.0016; dirty=true; }
    if(settle>0){ settle--; dirty=true; }   /* redraw for a few frames after a rebuild, so a dropped frame cannot leave the view empty */
    const k=0.14, da=taz-az, de=tel-el, dd=tdist-dist;
    if(Math.abs(da)+Math.abs(de)+Math.abs(dd)/Math.max(dist,1e-3)>1e-4){ az+=da*k; el+=de*k; dist+=dd*k; dirty=true; }
    if(!dirty) return; dirty=false;
    const ce=Math.cos(el); cam.position.set(-Math.sin(az)*ce*dist,Math.sin(el)*dist,-Math.cos(az)*ce*dist); cam.up.set(0,1,0); cam.lookAt(0,-0.04*(M?M.H:1),0);
    renderer.render(scene,cam);
  }
  /* pointer orbit: drag rotates; touch keeps vertical page scrolling */
  let drag=null;
  cv.addEventListener('pointerdown',e=>{ drag={x:e.clientX,y:e.clientY,az:taz,el:tel,touch:e.pointerType==='touch'}; auto=false; cv.style.cursor='grabbing'; try{ cv.setPointerCapture(e.pointerId); }catch(_){} });
  cv.addEventListener('pointermove',e=>{ if(!drag) return; taz=drag.az-(e.clientX-drag.x)*0.008; if(!drag.touch) tel=Math.max(-0.5,Math.min(1.52,drag.el+(e.clientY-drag.y)*0.006)); });
  const end=()=>{ drag=null; cv.style.cursor='grab'; }; cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
  cv.addEventListener('wheel',e=>{ if(!e.ctrlKey&&!e.metaKey) return; e.preventDefault(); tdist=Math.max(R*0.5,Math.min(R*8,tdist*Math.exp(e.deltaY*0.0015))); auto=false; },{passive:false});
  cv.addEventListener('webglcontextlost',e=>e.preventDefault()); cv.addEventListener('webglcontextrestored',()=>{ settle=40; });
  const ro=new ResizeObserver(size); ro.observe(host);
  const io=new IntersectionObserver(es=>{ vis=es[0].isIntersecting; dirty=true; settle=10; }); io.observe(host);
  size(); tick();
  return {
    update(model){ const key=JSON.stringify(model); if(M&&M.key===key) return; M=Object.assign({},model,{key}); build(); apply(); },
    view(name){ const v=VIEWS[name]||VIEWS.iso; auto=false; const two=Math.PI*2; taz=v[0]+Math.round((az-v[0])/two)*two; tel=v[1]; frame(); if(name==='fin'&&M) tdist=Math.max(R*0.9,tdist*0.42); },
    zoom(f){ tdist=Math.max(R*0.5,Math.min(R*8,tdist*f)); auto=false; },
    set(k,v){ st[k]=v; if(k==='ice') ice(); else apply(); },
    get(k){ return st[k]; },
    drawn(){ return M?M.drawn:[]; },
    state(){ return {vis,dist,tdist,az,el,R,settle,calls:renderer.info.render.calls,tris:renderer.info.render.triangles,kids:[gCore,gFins,gCase,gIce,gFlow].map(g=>g.children.length),cam:cam.position.toArray(),clip:clip.constant}; },
    dispose(){ cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); cv.remove(); }
  };
}
window.CoilView={load,mount};
})();
