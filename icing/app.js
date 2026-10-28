/* Smokeline · closed-circuit icing wind tunnel tab (UI).
   Layout mirrors the open-circuit page: a WebGL hero where smoke filaments now run round a closed loop,
   a pinned close-up that follows the spray cloud to the model, then the instrument bench (audit, loss loop,
   geometry, thermal, fan, sweep, datasheet). The physics lives in engine.js, the PDF in sheet.js (lazy). */
(function(){
'use strict';
const E=window.IcingEngine, APP=document.getElementById('appClosed');
if(!E||!APP) return;
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const RM=matchMedia('(prefers-reduced-motion: reduce)'), FINE=matchMedia('(pointer: fine)');
const ROOT=document.documentElement;

/* ================= formatting ================= */
const loc='en-US';
const nf=(x,d)=>isFinite(x)?x.toLocaleString(loc,{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const ni=x=>isFinite(x)?Math.round(x).toLocaleString(loc):'—';
const SUP={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
const ne=(x,d)=>{ if(!isFinite(x)) return '—'; if(x===0) return '0'; const e=Math.floor(Math.log10(Math.abs(x))); return nf(x/Math.pow(10,e),d==null?2:d)+'×10'+String(e).split('').map(c=>SUP[c]).join(''); };
const ns=(x,sig)=>{ sig=sig||4; if(!isFinite(x)) return '—'; const ax=Math.abs(x); if(ax===0) return '0'; if(ax>=1e5) return ni(x); if(ax<1e-3) return ne(x,2);
  const d=Math.max(0,Math.min(6,sig-1-Math.floor(Math.log10(ax)))); return nf(x,d); };
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const kW=w=>w<1000?{v:nf(w,0),u:'W'}:{v:nf(w/1000,w<1e4?2:1),u:'kW'};
const pad2=n=>String(n).padStart(2,'0');
const KC=k=>'var(--k-'+k+')';

/* ================= inputs ================= */
const GROUPS=[
 {g:'op', name:'Operating point · icing cloud',color:'var(--accent)',ref:'G.V_tasarim · G.T_statik_C'},
 {g:'ts', name:'Test section · model',color:KC('test'),ref:'G.a_TS · G.mdl'},
 {g:'d1', name:'First diffuser · circuit width',color:KC('diff'),ref:'G.s12 · G.H'},
 {g:'cor',name:'Corners · turning vanes',color:KC('corner'),ref:'G.vane_*'},
 {g:'fan',name:'Fan section',color:KC('fan'),ref:'G.fan'},
 {g:'ret',name:'Return leg',color:KC('duct'),ref:'G.s34'},
 {g:'wad',name:'Wide-angle diffuser · heat exchanger',color:KC('hx'),ref:'G.CR · G.hx'},
 {g:'set',name:'Settling chamber',color:KC('set'),ref:'G.dn · G.hc · G.el · G.sp'},
 {g:'noz',name:'Contraction',color:KC('noz'),ref:'G.L_daralma'},
 {g:'th', name:'Thermal budget · margins',color:KC('duct'),ref:'G.yal · G.sizinti'}
];
const F=(k,g,label,unit,def,m,o)=>Object.assign({k,g,label,unit,def,m},o||{});
const FIELDS=[
 F('V','op','Design test speed','m/s',40,'G.V_tasarim'),
 F('T','op','Static temperature','°C',-20,'G.T_statik_C',{neg:true}),
 F('p','op','Static pressure','Pa',101325,'G.p_statik'),
 F('LWC','op','Liquid water content','g/m³',1.0,'G.LWC_tasarim',{zero:true}),
 F('MVD','op','Median volume diameter','µm',20,'web: icing cloud'),
 F('Tlab','op','Laboratory temperature','°C',20,'G.T_lab_C',{neg:true}),
 F('RH','op','Laboratory relative humidity','%',50,'web: condensation check'),
 F('a','ts','Test section side (square)','cm',50,'G.a_TS'),
 F('LTS','ts','Test section length','cm',100,'G.L_TS'),
 F('mc','ts','Model chord','cm',20,'G.mdl.c'),
 F('mCd','ts','Model drag coefficient (iced)','–',0.10,'G.mdl.Cd',{zero:true}),
 F('mx','ts','Leading edge from TS inlet','cm',35,'G.mdl.x_HK',{zero:true}),
 F('s12','d1','Corner 1–2 side','cm',75,'G.s12'),
 F('th1','d1','Equivalent cone half-angle θe','°',3.0,'G.thetaD1_der'),
 F('H','d1','Circuit width (leg axes)','cm',320,'G.H'),
 F('safety','d1','Safety screen before corner 2','',false,'G.guvenlik_elegi',{kind:'bool'}),
 F('vc','cor','Vane chord / corner side','–',0.25,'G.vane_c_oran'),
 F('vhc','cor','Vane gap / chord','–',0.25,'G.vane_h_c'),
 F('buz1','cor','Corner 1 icing factor','×',1.5,'G.buz_kose1'),
 F('fw','fan','Fan section width','cm',100,'G.fan.w'),
 F('fh','fan','Fan section height','cm',100,'G.fan.h'),
 F('fN','fan','Number of fans','pcs',4,'G.fan.N',{int:true}),
 F('fD','fan','Fan diameter','cm',45,'G.fan.D'),
 F('fsplit','fan','Splitter plates in transition','pcs',0,'G.fan.ayirici',{int:true,zero:true}),
 F('Lgec','fan','Fan transition length','cm',205,'G.L_gecis'),
 F('Lfan','fan','Fan module length','cm',60,'G.L_fan'),
 F('Lfd','fan','Post-fan contraction length','cm',0,'G.L_fan_daralma',{zero:true}),
 F('fveri','fan','Fan data basis','',"statik",'G.fan.veri',{kind:'seg',opts:[['statik','Static'],['toplam','Total + exit']]}),
 F('fK','fan','Fan module mounting loss K','–',0.05,'G.fan.K_birim',{zero:true}),
 F('etaf','fan','Fan efficiency η','–',0.70,'G.eta_fan'),
 F('etam','fan','Motor efficiency η_m','–',0.88,'G.eta_motor'),
 F('motorIn','fan','Motors inside the airstream','',true,'G.motor_icerde',{kind:'bool'}),
 F('psi','fan','Pressure coefficient ψ (sizing)','–',0.35,'G.fan.psi'),
 F('nu','fan','Hub / tip ratio','–',0.45,'G.fan.nu',{zero:true}),
 F('marg','fan','Fan selection margin','×',1.5,'G.marj_fan'),
 F('s34','ret','Corner 3–4 side','cm',100,'G.s34'),
 F('th3','ret','Return diffuser θe','°',3.5,'G.thetaD3_der'),
 F('CR','wad','Contraction ratio CR','–',9.0,'G.CR'),
 F('gad2th','wad','WAD total wall angle 2θ','°',40,'G.GAD_2theta'),
 F('yer','wad','Heat exchanger position','',"birlikte",'G.yerlesim',{kind:'seg',opts:[['birlikte','At WAD exit'],['ayri','In leg 3–4']]}),
 F('hxdp','wad','Coil Δp at reference velocity','Pa',100,'G.hx.dp_ref'),
 F('hxV','wad','Coil reference face velocity','m/s',4.5,'G.hx.V_ref'),
 F('hxn','wad','Velocity exponent n','–',1.8,'G.hx.n_us'),
 F('hxf','wad','Frost factor','×',1.3,'G.hx.karlanma'),
 F('thx','wad','Coil depth','cm',10,'G.dn.t_hx'),
 F('gN','wad','WAD screens (leg 3–4 layout)','pcs',2,'G.gad_el.N',{int:true,zero:true}),
 F('gdw','wad','WAD screen wire d','mm',0.5,'G.gad_el.dw'),
 F('gwm','wad','WAD screen mesh w','mm',3.0,'G.gad_el.wm'),
 F('Ldn','set','Settling chamber length','cm',120,'G.L_dinlenme'),
 F('hcD','set','Honeycomb cell D_h','mm',10,'G.hc.Dh'),
 F('hcL','set','Honeycomb depth','mm',80,'G.hc.L'),
 F('hcB','set','Honeycomb porosity β','–',0.80,'G.hc.beta'),
 F('xhc','set','Honeycomb position','cm',25,'G.dn.x_hc',{zero:true}),
 F('elN','set','Turbulence screens','pcs',2,'G.el.N',{int:true,zero:true}),
 F('eldw','set','Screen wire d','mm',0.20,'G.el.dw'),
 F('elwm','set','Screen mesh w','mm',1.00,'G.el.wm'),
 F('elK','set','Mesh loss factor','–',1.3,'G.el.Kmesh'),
 F('xel','set','First screen position','cm',50,'G.dn.x_el(1)',{zero:true}),
 F('del','set','Screen spacing','cm',15,'diff(G.dn.x_el)',{zero:true}),
 F('xsp','set','Spray bar position','cm',105,'G.dn.x_sp',{zero:true}),
 F('spN','set','Spray bars','pcs',5,'G.sp.N_cubuk',{int:true,zero:true}),
 F('spd','set','Spray bar diameter','mm',25,'G.sp.d'),
 F('spCd','set','Spray bar C_d','–',1.2,'G.sp.Cd',{zero:true}),
 F('spNn','set','Nozzles (total)','pcs',25,'G.sp.N_nozul',{int:true}),
 F('spT','set','Water temperature at nozzle','°C',20,'G.sp.T_su_C',{neg:true}),
 F('Lc','noz','Contraction length','cm',170,'G.L_daralma'),
 F('it','th','Insulation thickness','mm',80,'G.yal.t'),
 F('ik','th','Insulation conductivity','W/mK',0.025,'G.yal.k'),
 F('ihi','th','Inner film coefficient','W/m²K',30,'G.yal.h_ic'),
 F('iho','th','Outer film coefficient','W/m²K',8,'G.yal.h_dis'),
 F('tmarg','th','Refrigeration selection margin','×',1.3,'G.isil_marj'),
 F('Vs','th','Continuous cooling point speed','m/s',30,'G.V_surekli'),
 F('LWCs','th','Continuous cooling point LWC','g/m³',1.0,'G.LWC_surekli',{zero:true}),
 F('leak','th','Leakage and joints factor','×',1.10,'G.sizinti')
];
const FK={}; FIELDS.forEach(f=>FK[f.k]=f);
const EXTRA={fcQ:'',fcdp:'',fcrho:1.394,fcname:''};
function defaults(){ const p={}; FIELDS.forEach(f=>p[f.k]=f.def); return Object.assign(p,EXTRA); }

function validate(p){
  const e=[], num=k=>typeof p[k]==='number'&&isFinite(p[k]);
  FIELDS.forEach(f=>{
    if(f.kind) return;
    if(!num(f.k)){ e.push(f.label+' must be a number.'); return; }
    const v=p[f.k];
    if(f.int&&!Number.isInteger(v)) e.push(f.label+' must be a whole number.');
    if(!f.neg&&(f.zero?v<0:v<=0)) e.push(f.label+' must be '+(f.zero?'zero or positive':'positive')+'.');
  });
  if(e.length) return e;
  if(p.T<=-273.15) e.push('Temperature must be above −273.15 °C.');
  ['etaf','etam','hcB'].forEach(k=>{ if(p[k]>1) e.push(FK[k].label+' must not exceed 1.'); });
  if(p.nu>=1) e.push('Hub / tip ratio must be below 1.');
  if(p.RH>100) e.push('Relative humidity must not exceed 100%.');
  if(p.fN<1) e.push('At least one fan is needed.');
  if(p.spNn<1) e.push('At least one nozzle is needed.');
  if(p.s12<=p.a) e.push('Corner 1–2 side must exceed the test-section side (first diffuser needs AR > 1).');
  if(p.H<=Math.max(p.s12,p.s34)) e.push('Circuit width H must exceed both corner sizes.');
  if(p.a*Math.sqrt(p.CR)<=p.s34) e.push('Settling chamber (a·√CR = '+nf(p.a*Math.sqrt(p.CR),0)+' cm) must be larger than corner 3–4 ('+p.s34+' cm) for the wide-angle diffuser.');
  if(p.eldw>=p.elwm) e.push('Screen wire diameter must be smaller than the mesh width.');
  if(p.gdw>=p.gwm) e.push('WAD screen wire diameter must be smaller than its mesh width.');
  if(p.th1>=45||p.th3>=45) e.push('Diffuser angles must be below 45°.');
  if(p.gad2th>=170) e.push('WAD angle must be below 170°.');
  if(p.leak<1) e.push('Leakage factor cannot be below 1.');
  return e;
}

/* ================= state ================= */
const LS='smokeline.icing.v1';
let P=defaults();
try{ const s=JSON.parse(localStorage.getItem(LS)||'null'); if(s&&typeof s==='object') for(const k in P) if(k in s) P[k]=s[k]; }catch(_){}
function save(){ try{ localStorage.setItem(LS,JSON.stringify(P)); }catch(_){} }
/* share link: #icing?V=45,T=-15 (only values that differ from the project defaults) */
function encodeState(){
  const D=defaults(), out=[];
  FIELDS.forEach(f=>{ if(P[f.k]!==D[f.k]) out.push(f.k+'='+(typeof P[f.k]==='boolean'?(P[f.k]?1:0):P[f.k])); });
  return out.join(',');
}
function decodeState(str){
  const D=defaults(); let n=0;
  str.split(',').forEach(kv=>{ const i=kv.indexOf('='); if(i<1) return; const k=kv.slice(0,i), v=decodeURIComponent(kv.slice(i+1)), f=FK[k]; if(!f) return;
    if(f.kind==='bool') P[k]=v==='1'; else if(f.kind==='seg'){ if(f.opts.some(o=>o[0]===v)) P[k]=v; } else { const x=Number(v); if(isFinite(x)) P[k]=x; } n++; });
  FIELDS.forEach(f=>{ if(!str.split(',').some(kv=>kv.split('=')[0]===f.k)) P[f.k]=D[f.k]; });
  return n;
}
function shareURL(){ const s=encodeState(); return location.origin+location.pathname+'#icing'+(s?'?'+s:''); }
function designId(){
  const s=JSON.stringify(FIELDS.map(f=>P[f.k])); let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return 'IWT-'+nf(P.a,0)+'-'+nf(P.V,0)+'-'+((h>>>0).toString(16).toUpperCase().padStart(8,'0').slice(0,4));
}

function buildG(p){
  const cm=0.01, mm=1e-3, xel=[];
  for(let k=0;k<p.elN;k++) xel.push(p.xel*cm+k*p.del*cm);
  return {Tc:p.T,p:p.p,Tlab:p.Tlab,RH:p.RH,LWC:p.LWC,MVD:p.MVD,
    a:p.a*cm,L_TS:p.LTS*cm,s12:p.s12*cm,th1:p.th1,H:p.H*cm,
    fan:{w:p.fw*cm,h:p.fh*cm,N:p.fN,D:p.fD*cm,veri:p.fveri,K:p.fK,psi:p.psi,nu:p.nu,split:p.fsplit},
    L_gecis:p.Lgec*cm,L_fan:p.Lfan*cm,L_fd:p.Lfd*cm,eta_fan:p.etaf,eta_m:p.etam,motorIn:p.motorIn,
    s34:p.s34*cm,th3:p.th3,CR:p.CR,gad2th:p.gad2th,L_dn:p.Ldn*cm,L_c:p.Lc*cm,
    dn:{x_hx:0,t_hx:p.thx*cm,x_hc:p.xhc*cm,x_el:xel,x_sp:p.xsp*cm},
    vane_c:p.vc,vane_hc:p.vhc,buz1:p.buz1,safety:p.safety,
    hc:{Dh:p.hcD*mm,L:p.hcL*mm,beta:p.hcB,Delta:1e-5},
    el:{N:p.elN,dw:p.eldw*mm,wm:p.elwm*mm,Kmesh:p.elK,dx:p.del*cm},
    gel:{N:p.gN,dw:p.gdw*mm,wm:p.gwm*mm,Kmesh:1.3},
    hx:{dp_ref:p.hxdp,V_ref:p.hxV,n:p.hxn,frost:p.hxf,der:0},
    sp:{N:p.spN,d:p.spd*mm,Cd:p.spCd,Nn:p.spNn,Tw:p.spT},
    mdl:{c:p.mc*cm,b:p.a*cm,Cd:p.mCd,x:p.mx*cm},
    ins:{t:p.it*mm,k:p.ik,hi:p.ihi,ho:p.iho},
    leak:p.leak,marg:p.marg,tmarg:p.tmarg,Vs:p.Vs,LWCs:p.LWCs};
}
function parseList(s){ return String(s||'').split(/[\s;,]+/).map(x=>x.trim()).filter(Boolean).map(Number).filter(isFinite); }
function curve(){
  const Q=parseList(P.fcQ), dp=parseList(P.fcdp);
  if(Q.length<2||Q.length!==dp.length) return null;
  for(let i=1;i<Q.length;i++) if(!(Q[i]>Q[i-1])) return null;
  return {Q,dp,rho:+P.fcrho||1.394,name:P.fcname||'fan curve'};
}

/* ================= compute ================= */
let S=null;   // current state bundle
function compute(){
  const h=E.air(P.T,P.p), G=buildG(P);
  const R=E.circuit(G,P.V,P.yer,h);
  const TB=E.thermal(R,G,P.LWC,h), Rs=E.circuit(G,P.Vs,P.yer,h), TBs=E.thermal(Rs,G,P.LWCs,h);
  const IC=E.icing(R,G,h), AU=E.audit(R,G,h,IC), GT=E.geometryTable(R), FC=E.fanPoint(R,G,curve());
  const Ralt=E.circuit(G,P.V,P.yer==='ayri'?'birlikte':'ayri',h);
  const Vmax=Math.max(50,Math.ceil(P.V*1.25/5)*5), SW=E.sweep(G,P.yer,h,Vmax);
  return {h,G,R,TB,Rs,TBs,IC,AU,GT,FC,Ralt,SW,id:designId()};
}

/* ================= path geometry (plan view, metres) =================
   Centre line starts at the test-section inlet and runs counter-clockwise: lower leg → corner 1 → right leg →
   corner 2 → upper (return) leg → corner 3 → left leg → corner 4 → WAD → settling chamber → contraction. */
const nL=d=>[-d[1],d[0]];
function buildPath(R,G){
  const g=R.geo, X=g.X_alt, H=g.H, a=g.a, s12=g.s12, s34=g.s34, sdn=g.s_dn, fw=g.fan_w, fh=g.fan_h;
  const segs=[]; let s=0;
  const St=(id,key,p,d,L,w0,w1,h0,h1,prof)=>{ if(!(L>1e-6)) return; segs.push({t:'S',id,key,p,d,L,w0,w1,h0,h1,prof,s0:s,s1:s+L}); s+=L; };
  const Cn=(id,c,din,dout,sz)=>{ const L=Math.PI/2*sz/2, n0=nL(din), r=sz/2; segs.push({t:'C',id,key:'corner',c,din,dout,sz,L,s0:s,s1:s+L,
      I:[c[0]+r*(n0[0]-din[0]),c[1]+r*(n0[1]-din[1])],O:[c[0]+r*(din[0]-n0[0]),c[1]+r*(din[1]-n0[1])]}); s+=L; };
  const x0=s34/2+g.L_GAD+g.L_dn+g.L_c;
  St('ts','test',[x0,0],[1,0],g.L_TS,a,a,a,a);
  St('d1','diff',[x0+g.L_TS,0],[1,0],g.L_D1,a,s12,a,s12);
  Cn('c1',[X,0],[1,0],[0,1],s12);
  St('l12','duct',[X,s12/2],[0,1],g.L_C12,s12,s12,s12,s12);
  Cn('c2',[X,H],[0,1],[-1,0],s12);
  let xu=X-s12/2;
  St('gec','diff',[xu,H],[-1,0],g.L_gecis,s12,fw,s12,fh); xu-=g.L_gecis;
  St('fan','fan',[xu,H],[-1,0],g.L_fan,fw,fw,fh,fh); xu-=g.L_fan;
  St('d3','diff',[xu,H],[-1,0],g.L_D3,fw,s34,fh,s34); xu-=g.L_D3;
  St('ust','duct',[xu,H],[-1,0],g.L_ust,s34,s34,s34,s34);
  Cn('c3',[0,H],[-1,0],[0,-1],s34);
  St('l34','duct',[0,H-s34/2],[0,-1],g.L_C34,s34,s34,s34,s34);
  Cn('c4',[0,0],[0,-1],[1,0],s34);
  St('gad','diff',[s34/2,0],[1,0],g.L_GAD,s34,sdn,s34,sdn);
  St('dn','set',[s34/2+g.L_GAD,0],[1,0],g.L_dn,sdn,sdn,sdn,sdn);
  St('noz','noz',[s34/2+g.L_GAD+g.L_dn,0],[1,0],g.L_c,sdn,a,sdn,a,'poly');
  const byId={}; segs.forEach(q=>byId[q.id]=q);
  const P={segs,L:s,byId,x0,sLE:G.mdl.x,c:G.mdl.c,A_TS:a*a};
  P.ext={x0:-Math.max(s34,fw)/2,x1:X+s12/2,y0:-sdn/2,y1:H+Math.max(s34,fw,fh>fw?fw:fw)/2};
  P.ext.y1=H+Math.max(s34,fw)/2;
  /* locations of elements that are not path segments */
  const dn=byId.dn, l34=byId.l34;
  P.at_hx=G&&R.yer==='ayri'?(l34?l34.s0+l34.L*0.5:0):(dn?dn.s0+G.dn.x_hx:0);
  P.at_sp=dn?dn.s0+G.dn.x_sp:0;
  return P;
}
function segAt(sg,u){
  if(sg.t==='S'){
    const f=clamp(u/sg.L,0,1), k=sg.prof==='poly'?6*f**5-15*f**4+10*f**3:f;
    const w=sg.w0+(sg.w1-sg.w0)*k, h=sg.h0+(sg.h1-sg.h0)*k, n=nL(sg.d);
    return {x:sg.p[0]+sg.d[0]*u,y:sg.p[1]+sg.d[1]*u,tx:sg.d[0],ty:sg.d[1],nx:n[0],ny:n[1],w,A:w*h};
  }
  const r=sg.sz/2, n0=nL(sg.din), ph=clamp(u/r,0,Math.PI/2), c=Math.cos(ph), s=Math.sin(ph);
  const tx=sg.din[0]*c+n0[0]*s, ty=sg.din[1]*c+n0[1]*s, n=nL([tx,ty]);
  return {x:sg.I[0]+r*(-n0[0]*c+sg.din[0]*s),y:sg.I[1]+r*(-n0[1]*c+sg.din[1]*s),tx,ty,nx:n[0],ny:n[1],w:sg.sz,A:sg.sz*sg.sz};
}
function pathAt(PT,s){
  s=((s%PT.L)+PT.L)%PT.L;
  let sg=PT.segs[PT.segs.length-1];
  for(const q of PT.segs) if(s<q.s1){ sg=q; break; }
  const o=segAt(sg,s-sg.s0); o.seg=sg; return o;
}
function ythk(xc,t){ if(xc<0||xc>1) return 0; return 5*t*(0.2969*Math.sqrt(xc)-0.1260*xc-0.3516*xc*xc+0.2843*xc**3-0.1015*xc**4); }
const TC=0.12;
/* lateral position of a lane, displaced by the airfoil (vertical span, so the plan view shows its section) */
function laneLat(PT,s,eta,w,k){
  const hh=w/2, y=eta*hh; if(s<PT.sLE||s>PT.sLE+PT.c) return y;
  const ht=ythk((s-PT.sLE)/PT.c,TC)*PT.c*(k==null?1:k), ay=Math.abs(y);
  return (y>=0?1:-1)*(ht+ay*(1-ht/hh));
}
/* heat picked up between fan and heat exchanger (visual tint only) */
function heatAt(PT,s){
  const f=PT.byId.fan; if(!f) return 0;
  const a=f.s0+f.L*0.5, b=PT.at_hx;
  if(s>=a&&s<=b) return sstep(a,a+0.6,s);
  if(s>b&&s<b+0.5) return 1-sstep(b,b+0.5,s);
  return 0;
}

/* ================= WebGL closed-loop smoke =================
   Same visual grammar as the open-circuit hero: thin filaments along streamlines, lit by puffs that travel at the
   local speed. Each lane is a triangle strip; puff phase uses tau(s) = ∫A/A_TS ds (metres travelled at test speed). */
const VSRC=`attribute vec2 aP;attribute vec2 aN;attribute vec4 aD;attribute float aS;
uniform vec3 uCam;uniform vec2 uRes;uniform float uW;varying vec4 vD;varying float vS;
void main(){vec2 px=vec2(uCam.x+aP.x*uCam.z,uCam.y-aP.y*uCam.z);vec2 n=normalize(vec2(aN.x,-aN.y));px+=n*aS*uW;
gl_Position=vec4(px.x/uRes.x*2.0-1.0,1.0-px.y/uRes.y*2.0,0.0,1.0);vD=aD;vS=aS;}`;
const FSRC=`uniform float uT,uP;uniform vec3 uCa,uCb,uCh;varying vec4 vD;varying float vS;
void main(){float ph=fract((uT-vD.x)/uP);float puff=exp(-ph*2.2);
float edge=1.0-smoothstep(0.35,1.0,abs(vS));
float I=(0.30+0.70*puff)*(1.0-0.3*abs(vD.w))*edge;
vec3 col=mix(uCa,uCb,smoothstep(0.08,1.0,vD.y));col=mix(col,uCh,vD.z*0.6);
gl_FragColor=vec4(col,clamp(I,0.0,1.0));}`;
function hex2rgb(h){ h=String(h).trim().replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); const n=parseInt(h,16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; }
function makeGL(cv){
  let gl=null; try{ gl=cv.getContext('webgl',{premultipliedAlpha:false,alpha:true,antialias:true}); }catch(_){}
  if(!gl) return null;
  const hp=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT), prec=(hp&&hp.precision>0)?'precision highp float;\n':'precision mediump float;\n';
  const sh=(t,src)=>{ const s=gl.createShader(t); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
  const v=sh(gl.VERTEX_SHADER,prec+VSRC), f=sh(gl.FRAGMENT_SHADER,prec+FSRC); if(!v||!f) return null;
  const pr=gl.createProgram(); gl.attachShader(pr,v); gl.attachShader(pr,f); gl.linkProgram(pr); if(!gl.getProgramParameter(pr,gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const A={}; ['aP','aN','aD','aS'].forEach(n=>A[n]=gl.getAttribLocation(pr,n));
  const U={}; ['uCam','uRes','uW','uT','uP','uCa','uCb','uCh'].forEach(n=>U[n]=gl.getUniformLocation(pr,n));
  const buf=gl.createBuffer(); let lanes=0, per=0, lost=false;
  cv.addEventListener('webglcontextlost',e=>{ e.preventDefault(); lost=true; });
  return {
    upload(L){ gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,L.data,gl.STATIC_DRAW); lanes=L.lanes; per=L.per;
      const st=9*4; gl.enableVertexAttribArray(A.aP); gl.vertexAttribPointer(A.aP,2,gl.FLOAT,false,st,0);
      gl.enableVertexAttribArray(A.aN); gl.vertexAttribPointer(A.aN,2,gl.FLOAT,false,st,8);
      gl.enableVertexAttribArray(A.aD); gl.vertexAttribPointer(A.aD,4,gl.FLOAT,false,st,16);
      gl.enableVertexAttribArray(A.aS); gl.vertexAttribPointer(A.aS,1,gl.FLOAT,false,st,32); },
    draw(cam,W,H,dpr,t,Pp,col){
      if(lost||!lanes) return;
      gl.viewport(0,0,cv.width,cv.height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
      gl.uniform3f(U.uCam,cam.ox,cam.oy,cam.k); gl.uniform2f(U.uRes,W,H); gl.uniform1f(U.uW,cam.lw||0.9);
      gl.uniform1f(U.uT,t); gl.uniform1f(U.uP,Pp);
      gl.uniform3fv(U.uCa,col.a); gl.uniform3fv(U.uCb,col.b); gl.uniform3fv(U.uCh,col.h);
      for(let j=0;j<lanes;j++) gl.drawArrays(gl.TRIANGLE_STRIP,j*per,per);
    }
  };
}
let LANES=null, PT=null, PUFF=0.6;
function buildLanes(PT,N){
  const L=PT.L, base=1500, grid=[];
  for(let i=0;i<=base;i++) grid.push(L*i/base);
  for(let i=0;i<=80;i++){ const xc=(1-Math.cos(Math.PI*i/80))/2; grid.push(PT.sLE+xc*PT.c); }
  PT.segs.forEach(q=>{ grid.push(q.s0+1e-5,q.s1-1e-5); if(q.t==='C') for(let i=1;i<24;i++) grid.push(q.s0+q.L*i/24); });
  grid.sort((a,b)=>a-b);
  const S=[]; grid.forEach(s=>{ if(s>=0&&s<=L&&(!S.length||s-S[S.length-1]>1e-5)) S.push(s); });
  const M=S.length, pts=S.map(s=>pathAt(PT,Math.min(s,L-1e-7)));
  const tau=new Float64Array(M); for(let i=1;i<M;i++){ const a=PT.A_TS; tau[i]=tau[i-1]+(S[i]-S[i-1])*0.5*(pts[i].A/a+pts[i-1].A/a); }
  const tmax=tau[M-1]; PUFF=tmax/Math.max(1,Math.round(tmax/1.1));
  const data=new Float32Array(N*M*2*9); let o=0;
  for(let j=0;j<N;j++){
    const eta=-0.93+1.86*j/(N-1);
    for(let i=0;i<M;i++){
      const q=pts[i], lat=laneLat(PT,S[i],eta,q.w), x=q.x+q.nx*lat, y=q.y+q.ny*lat;
      /* normal of the displaced lane: finite difference in s */
      const ia=Math.max(0,i-1), ib=Math.min(M-1,i+1);
      const qa=pts[ia], qb=pts[ib], la=laneLat(PT,S[ia],eta,qa.w), lb=laneLat(PT,S[ib],eta,qb.w);
      let dx=(qb.x+qb.nx*lb)-(qa.x+qa.nx*la), dy=(qb.y+qb.ny*lb)-(qa.y+qa.ny*la); const dl=Math.hypot(dx,dy)||1; dx/=dl; dy/=dl;
      const ur=PT.A_TS/q.A, ht=heatAt(PT,S[i]);
      for(const side of [-1,1]){ data[o++]=x; data[o++]=y; data[o++]=-dy; data[o++]=dx; data[o++]=tau[i]; data[o++]=ur; data[o++]=ht; data[o++]=eta; data[o++]=side; }
    }
  }
  return {data,lanes:N,per:M*2,tmax,S,pts,tau};
}

/* ================= views ================= */
let HV=null, ZV=null;
function makeView(root,mode){
  const q=s=>root.querySelector(s);
  const v={root,mode,cvB:q('.cvB'),cvG:q('.cvG'),cvT:q('.cvT'),cam:{ox:0,oy:0,k:1},W:0,H:0,dpr:1,visible:true};
  v.ctxB=v.cvB.getContext('2d'); v.ctxT=v.cvT.getContext('2d');
  v.gl=makeGL(v.cvG); if(!v.gl) v.cvG.hidden=true;
  if('IntersectionObserver' in window) new IntersectionObserver(es=>{ v.visible=es[0].isIntersecting; },{rootMargin:'80px'}).observe(root);
  return v;
}
function sizeView(v,W,H,cap){
  const dpr=Math.min(cap,window.devicePixelRatio||1); v.dpr=dpr; v.W=W; v.H=H;
  [v.cvB,v.cvG,v.cvT].forEach(c=>{ c.width=Math.round(W*dpr); c.height=Math.round(H*dpr); });
  v.ctxB.setTransform(dpr,0,0,dpr,0,0); v.ctxT.setTransform(dpr,0,0,dpr,0,0);
}
const SX=(v,x)=>v.cam.ox+x*v.cam.k, SY=(v,y)=>v.cam.oy-y*v.cam.k;
let TH={};
function readTheme(){ const cs=getComputedStyle(ROOT); ['h-bg','h-ink','h-muted','h-line','h-fill','h-wall','h-accent','h-smoke-a','h-smoke-b','h-heat','h-ice','h-surface'].forEach(k=>TH[k]=cs.getPropertyValue('--'+k).trim());
  const lab=getComputedStyle($('#itop')); ['test','model','diff','corner','duct','fan','hx','set','spray','noz'].forEach(k=>TH['k-'+k]=lab.getPropertyValue('--k-'+k).trim()); }

/* walls: inner side of the loop = left normal, outer side = right normal; corners have a sharp inner point and a square outer corner */
function wallPts(v,side){
  const out=[];
  PT.segs.forEach(q=>{
    if(q.t==='C'){ const p=side>0?q.I:q.O; out.push([SX(v,p[0]),SY(v,p[1])]); return; }
    const n=q.prof==='poly'?40:(Math.abs(q.w1-q.w0)>1e-6?6:1);
    for(let i=0;i<=n;i++){ const o=segAt(q,q.L*i/n); out.push([SX(v,o.x+side*o.nx*o.w/2),SY(v,o.y+side*o.ny*o.w/2)]); }
  });
  return out;
}
function poly(c,pts,close){ c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])); if(close) c.closePath(); }
function crossLine(v,s,frac){ const o=pathAt(PT,s), f=frac==null?0.5:frac*0.5; return [[SX(v,o.x+o.nx*o.w*f),SY(v,o.y+o.ny*o.w*f)],[SX(v,o.x-o.nx*o.w*f),SY(v,o.y-o.ny*o.w*f)]]; }
function band(v,s0,s1,minPx){
  let a=pathAt(PT,s0), b=pathAt(PT,s1);
  const len=Math.hypot(b.x-a.x,b.y-a.y)*v.cam.k; if(minPx&&len<minPx){ const ex=(minPx/v.cam.k-Math.hypot(b.x-a.x,b.y-a.y)); b=pathAt(PT,s1+ex); }
  return [[SX(v,a.x+a.nx*a.w/2),SY(v,a.y+a.ny*a.w/2)],[SX(v,b.x+b.nx*b.w/2),SY(v,b.y+b.ny*b.w/2)],[SX(v,b.x-b.nx*b.w/2),SY(v,b.y-b.ny*b.w/2)],[SX(v,a.x-a.nx*a.w/2),SY(v,a.y-a.ny*a.w/2)]];
}
function vanes(q){
  /* turning vanes: quarter-circle arcs of radius c/√2 centred on the corner diagonal */
  const b=S.R.bil.find(x=>x.id===q.id); if(!b) return [];
  const n=clamp(b.par.n,1,40), rv=b.par.c/Math.SQRT2, n1=nL(q.din), n2=nL(q.dout), out=[];
  for(let i=0;i<n;i++){
    const t=(i+1)/(n+1), M=[q.I[0]+(q.O[0]-q.I[0])*t,q.I[1]+(q.O[1]-q.I[1])*t];
    const C=[M[0]+rv*(n1[0]+n2[0])/Math.SQRT2,M[1]+rv*(n1[1]+n2[1])/Math.SQRT2];
    const a0=Math.atan2(-n1[1],-n1[0]), pts=[];
    for(let k=0;k<=10;k++){ const a=a0+Math.PI/2*k/10; pts.push([C[0]+rv*Math.cos(a),C[1]+rv*Math.sin(a)]); }
    out.push(pts);
  }
  return out;
}
function drawBase(v){
  const c=v.ctxB; c.clearRect(0,0,v.W,v.H); if(!PT) return;
  const inn=wallPts(v,1), outr=wallPts(v,-1);
  c.beginPath(); outr.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])); c.closePath();
  inn.slice().reverse().forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])); c.closePath();
  c.fillStyle=TH['h-fill']; c.fill('evenodd');
  /* component colour strips along the outer wall */
  PT.segs.forEach(q=>{ const col=TH['k-'+q.key]; if(!col) return; const n=q.t==='C'?10:(q.prof==='poly'?30:4); c.beginPath();
    for(let i=0;i<=n;i++){ const o=segAt(q,q.L*i/n), off=q.t==='C'?0:o.w/2; const px=SX(v,o.x-o.nx*off), py=SY(v,o.y-o.ny*off);
      const ox=-o.nx*3, oy=o.ny*3; i?c.lineTo(px+ox,py+oy):c.moveTo(px+ox,py+oy); }
    c.strokeStyle=col; c.globalAlpha=q.t==='C'?0.0:0.9; c.lineWidth=2.5; c.stroke(); c.globalAlpha=1; });
  /* heat exchanger */
  const G=S.G, dn=PT.byId.dn, k=v.cam.k;
  const hxS=PT.at_hx, hxT=Math.max(G.dn.t_hx,0.04);
  poly(c,band(v,hxS,hxS+hxT,3),true); c.fillStyle=TH['k-hx']; c.globalAlpha=.32; c.fill(); c.globalAlpha=.9; c.strokeStyle=TH['k-hx']; c.lineWidth=1; c.stroke(); c.globalAlpha=1;
  if(k>140){ const bb=band(v,hxS,hxS+hxT); c.save(); poly(c,bb,true); c.clip(); c.strokeStyle=TH['h-ice']; c.globalAlpha=.25; c.lineWidth=1;
    for(let i=-20;i<60;i++){ c.beginPath(); c.moveTo(bb[0][0]+i*6,bb[0][1]-10); c.lineTo(bb[0][0]+i*6-40,bb[3][1]+10); c.stroke(); } c.restore(); c.globalAlpha=1; }
  if(dn){
    /* honeycomb */
    const hs=dn.s0+G.dn.x_hc; const hb=band(v,hs,hs+G.hc.L,4); poly(c,hb,true); c.strokeStyle=TH['h-muted']; c.lineWidth=1; c.globalAlpha=.8; c.stroke();
    c.save(); poly(c,hb,true); c.clip(); c.globalAlpha=.45; const step=Math.max(3,G.hc.Dh*k*1.2);
    for(let y=Math.min(hb[0][1],hb[3][1])-2;y<Math.max(hb[0][1],hb[3][1])+2;y+=step){ c.beginPath(); c.moveTo(hb[0][0]-2,y); c.lineTo(hb[1][0]+2,y); c.stroke(); } c.restore(); c.globalAlpha=1;
    /* screens */
    c.setLineDash([2,3]); c.strokeStyle=TH['h-muted']; c.lineWidth=1.2;
    G.dn.x_el.forEach(x=>{ const l=crossLine(v,dn.s0+x,1); poly(c,l); c.stroke(); });
    c.setLineDash([]);
    /* spray bars: nozzle row */
    const per=Math.max(1,Math.round(G.sp.Nn/Math.max(1,G.sp.N))), o=pathAt(PT,PT.at_sp);
    c.fillStyle=TH['k-spray']; for(let i=0;i<per;i++){ const lat=(-1+(2*i+1)/per)*o.w/2*0.9; c.beginPath(); c.arc(SX(v,o.x+o.nx*lat),SY(v,o.y+o.ny*lat),Math.max(1.6,Math.min(4,G.sp.d*k*0.5)),0,Math.PI*2); c.fill(); }
    const sl=crossLine(v,PT.at_sp,0.98); poly(c,sl); c.strokeStyle=TH['k-spray']; c.globalAlpha=.5; c.lineWidth=1; c.stroke(); c.globalAlpha=1;
  }
  if(S.R.yer==='ayri'){ const gq=PT.byId.gad; if(gq){ c.setLineDash([2,3]); c.strokeStyle=TH['h-muted']; for(let i=1;i<=G.gel.N;i++){ poly(c,crossLine(v,gq.s0+gq.L*i/(G.gel.N+1),1)); c.stroke(); } c.setLineDash([]); } }
  /* turning vanes */
  c.strokeStyle=TH['h-muted']; c.lineWidth=k>160?1.4:1; c.globalAlpha=.85;
  PT.segs.filter(q=>q.t==='C').forEach(q=>vanes(q).forEach(pts=>{ c.beginPath(); pts.forEach((p,i)=>{ const X=SX(v,p[0]), Y=SY(v,p[1]); i?c.lineTo(X,Y):c.moveTo(X,Y); }); c.stroke(); }));
  c.globalAlpha=1;
  /* test-section frame */
  const ts=PT.byId.ts; if(ts){ const b=band(v,ts.s0,ts.s1); c.strokeStyle=TH['k-test']; c.globalAlpha=.45; c.lineWidth=1; c.strokeRect(Math.min(b[0][0],b[1][0])+3,Math.min(b[0][1],b[3][1])+3,Math.abs(b[1][0]-b[0][0])-6,Math.abs(b[3][1]-b[0][1])-6); c.globalAlpha=1; }
  /* walls */
  c.strokeStyle=TH['h-wall']; c.lineWidth=v.mode==='hero'?1.6:2; c.lineJoin='round';
  poly(c,inn,true); c.stroke(); poly(c,outr,true); c.stroke();
  if(v.mode==='hero') drawLabels(v);
}
function drawLabels(v){
  const c=v.ctxB, small=v.W<700, R=S.R, g=R.geo, G=S.G;
  c.textBaseline='middle'; c.font='600 '+(small?10.5:12)+'px "IBM Plex Sans",system-ui,sans-serif';
  const yb=SY(v,-g.s_dn/2)+14, yt=SY(v,PT.ext.y1)-14;
  const fN='600 '+(small?10.5:12)+'px "IBM Plex Sans",system-ui,sans-serif', fS='400 10.5px "IBM Plex Mono",monospace', rowH=small?17:34;
  /* labels go on the first row where they do not collide with a neighbour (two rows are reserved in the layout) */
  const placed=[];
  const lab=(s,name,sub,col,up)=>{ const o=pathAt(PT,s), X=SX(v,o.x); if(small) sub='';
    c.font=fN; const w1=c.measureText(name).width; c.font=fS; const w2=sub?c.measureText(sub).width:0, hw=Math.max(w1,w2)/2+8;
    let r=0; while(placed.some(p=>p.up===!!up&&p.r===r&&Math.abs(p.x-X)<p.hw+hw)) r++;
    r=Math.min(r,1); placed.push({x:X,hw,r,up:!!up});
    const y=up?yt-r*rowH:yb+r*rowH, tx=clamp(X,hw,v.W-hw);
    c.strokeStyle=col; c.globalAlpha=.6; c.lineWidth=1; c.beginPath(); c.moveTo(X,SY(v,o.y+(up?1:-1)*o.w/2)+(up?-4:4)); c.lineTo(X,y+(up?6:-6)); c.stroke(); c.globalAlpha=1;
    c.textAlign='center'; c.font=fN; c.fillStyle=TH['h-ink']; c.fillText(name,tx,y+(up?-2:4));
    if(sub){ c.font=fS; c.fillStyle=TH['h-muted']; c.fillText(sub,tx,y+(up?-16:18)); } };
  const B=PT.byId;
  if(B.ts) lab(B.ts.s0+B.ts.L*0.5,'Test section',nf(P.a,0)+'×'+nf(P.a,0)+' cm · '+nf(P.V,0)+' m/s',TH['k-test']);
  if(B.dn) lab(B.dn.s0+B.dn.L*0.5,small?'Settling':'Settling chamber','HX · honeycomb · screens · spray',TH['k-set']);
  if(B.noz) lab(B.noz.s0+B.noz.L*0.55,small?'Nozzle':'Contraction','CR '+nf(P.CR,1),TH['k-noz']);
  if(B.d1&&!small) lab(B.d1.s0+B.d1.L*0.5,'Diffuser 1','θe '+nf(P.th1,1)+'°',TH['k-diff']);
  if(B.gad&&!small) lab(B.gad.s0+B.gad.L*0.5,'Wide-angle diffuser','2θ '+nf(P.gad2th,0)+'°',TH['k-diff']);
  if(B.fan) lab(B.fan.s0+B.fan.L*0.5,'Fans ×'+P.fN,'Ø'+nf(P.fD,0)+' cm · '+kW(R.P_mil).v+' '+kW(R.P_mil).u+' shaft',TH['k-fan'],true);
  if(B.gec&&!small) lab(B.gec.s0+B.gec.L*0.5,'Fan transition','',TH['k-diff'],true);
  if(B.ust&&B.ust.L>0.3&&!small) lab(B.ust.s0+B.ust.L*0.5,'Return duct','',TH['k-duct'],true);
  c.font=fN;
  if(R.yer==='ayri'&&B.l34){ const o=pathAt(PT,PT.at_hx); c.fillStyle=TH['k-hx']; c.textAlign='left'; c.fillText('HX',SX(v,o.x+o.w/2)+8,SY(v,o.y)); }
  /* corner numbers */
  if(small) return;
  c.font='700 '+(small?10:11)+'px "IBM Plex Mono",monospace'; c.textAlign='center';
  PT.segs.filter(q=>q.t==='C').forEach(q=>{ const X=SX(v,q.O[0]), Y=SY(v,q.O[1]); const dx=Math.sign(q.O[0]-q.I[0]), dy=-Math.sign(q.O[1]-q.I[1]);
    c.fillStyle=TH['h-bg']; c.strokeStyle=TH['k-corner']; c.lineWidth=1.2; c.beginPath(); c.arc(X+dx*12,Y+dy*12,9,0,Math.PI*2); c.fill(); c.stroke();
    c.fillStyle=TH['h-ink']; c.fillText(q.id.slice(1),X+dx*12,Y+dy*12+0.5); });
}

/* ================= droplets + ice (2D overlay) ================= */
const SLOW=1/40, TLAPSE=30, ICE_MAX=0.012;
let simT=0, ramp=0, rampStart=0, iceT=0, iceClock=0, frost1=0, drops=[], splats=[];
function spawnDrop(){
  const G=S.G, per=Math.max(1,Math.round(G.sp.Nn/Math.max(1,G.sp.N))), j=Math.floor(Math.random()*per);
  const e0=(-1+(2*j+1)/per)*0.9, e=clamp(e0+(Math.random()-0.5)*1.6/per,-0.95,0.95);
  return {s:PT.at_sp+Math.random()*0.02,e,life:0,hit:false,gone:false};
}
function stepDrops(dtau,dt){
  if(!PT||!S) return;
  const want=S.G.LWC>0?Math.round(clamp(40+S.G.LWC*60,40,160)):0;
  while(drops.length<want) drops.push(spawnDrop());
  if(drops.length>want) drops.length=want;
  const sLE=PT.sLE, c=PT.c, IC=S.IC, ycap=0.06*c*(0.35+0.65*IC.beta0), c1=PT.byId.c1;
  for(let i=0;i<drops.length;i++){
    const d=drops[i]; const o=pathAt(PT,d.s); const ur=PT.A_TS/o.A;
    const ns=d.s+ur*dtau*(1+0.04*Math.sin(i));
    const latTS=d.e*S.R.geo.a/2;
    if(d.s<sLE&&ns>=sLE&&Math.abs(latTS)<ycap&&S.G.Tc<=0){
      splats.push({x:PT.x0+sLE+leX(latTS)-iceShape(latTS),y:latTS,t:0}); drops[i]=spawnDrop(); continue;
    }
    if(c1&&d.s<c1.s0+c1.L*0.5&&ns>=c1.s0+c1.L*0.5){ if(Math.random()<0.9){ frost1=Math.min(1,frost1+0.012); drops[i]=spawnDrop(); continue; } }
    d.s=ns; d.life+=dt;
    if(d.s>PT.L) d.s-=PT.L;
    if(d.s>PT.at_hx&&d.s<PT.at_hx+0.2&&d.s<PT.at_sp) { drops[i]=spawnDrop(); continue; }
    if(d.life>60) drops[i]=spawnDrop();
  }
  for(let i=splats.length-1;i>=0;i--){ splats[i].t+=dt; if(splats[i].t>0.5) splats.splice(i,1); }
  if(S.G.LWC>0&&S.G.Tc<=0&&S.IC.Tstag<=0){ iceT+=S.IC.rate*dt*TLAPSE*ramp; iceClock+=dt*TLAPSE*ramp; }
  if(iceT>ICE_MAX){ iceT=0; iceClock=0; }
  frost1=Math.max(0,frost1-dt*0.004);
}
/* ice thickness profile in front of the leading edge, lateral y [m] → upstream offset [m] */
function iceShape(y){
  if(!S||iceT<=0) return 0;
  const ye=0.07*PT.c*(0.45+0.55*S.IC.beta0), r=Math.abs(y)/ye; if(r>=1) return 0;
  if(S.IC.regime==='glaze'){ const hrn=Math.exp(-(((r-0.62)/0.2)**2)), core=0.45*(1-r*r); return iceT*(core+0.9*hrn); }
  return iceT*Math.pow(1-r*r,1.3);
}
function leX(y){ /* surface x (from LE) at lateral |y| */
  const c=PT.c, ay=Math.abs(y); let lo=0, hi=0.3; if(ythk(hi,TC)*c<ay) return hi*c;
  for(let i=0;i<24;i++){ const m=(lo+hi)/2; if(ythk(m,TC)*c<ay) lo=m; else hi=m; } return hi*c;
}
function drawTop(v,now){
  const c=v.ctxT; c.clearRect(0,0,v.W,v.H); if(!PT||!S) return;
  const k=v.cam.k, G=S.G;
  /* fans: blade-passing shimmer along each rotor line */
  const fq=PT.byId.fan;
  if(fq){ const o=segAt(fq,fq.L*0.5), nc=S.R.fan.ncol, D=G.fan.D;
    for(let i=0;i<nc;i++){ const lat=(-1+(2*i+1)/nc)*o.w/2, cx=o.x+o.nx*lat, cy=o.y+o.ny*lat;
      const x1=SX(v,cx+o.nx*D/2), y1=SY(v,cy+o.ny*D/2), x2=SX(v,cx-o.nx*D/2), y2=SY(v,cy-o.ny*D/2);
      c.strokeStyle=TH['k-fan']; c.lineWidth=k>150?4:2.5; c.lineCap='round'; c.globalAlpha=.9; c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
      const ph=RM.matches?0.3:((now/1000)*S.R.fan.n_rpm/60*0.25+(i%2?0.5:0))%1;
      for(let b=0;b<3;b++){ const t=(ph+b/3)%1, tt=i%2?1-t:t; c.fillStyle=TH['h-ice']; c.globalAlpha=0.35+0.65*Math.sin(Math.PI*tt);
        c.beginPath(); c.arc(x1+(x2-x1)*tt,y1+(y2-y1)*tt,k>150?2.4:1.5,0,Math.PI*2); c.fill(); }
      c.globalAlpha=1; }
    const glow=c.createRadialGradient(SX(v,o.x),SY(v,o.y),0,SX(v,o.x),SY(v,o.y),o.w*k*0.9);
    glow.addColorStop(0,'rgba(255,154,92,0.16)'); glow.addColorStop(1,'rgba(255,154,92,0)'); c.fillStyle=glow; c.fillRect(SX(v,o.x)-o.w*k,SY(v,o.y)-o.w*k,o.w*k*2,o.w*k*2);
  }
  /* corner 1 frost on the vanes */
  const c1=PT.byId.c1;
  if(c1&&frost1>0.01){ c.strokeStyle=TH['h-ice']; c.lineWidth=k>160?2.6:1.6; c.globalAlpha=Math.min(0.9,frost1*1.2); c.shadowColor='rgba(200,245,255,.9)'; c.shadowBlur=8;
    vanes(c1).forEach(pts=>{ c.beginPath(); pts.forEach((p,i)=>{ const X=SX(v,p[0]), Y=SY(v,p[1]); i?c.lineTo(X,Y):c.moveTo(X,Y); }); c.stroke(); });
    c.shadowBlur=0; c.globalAlpha=1; }
  /* model + ice */
  const x0=PT.x0+PT.sLE, cc=PT.c, m=48;
  c.beginPath();
  for(let i=0;i<=m;i++){ const xc=(1-Math.cos(Math.PI*i/m))/2; const X=SX(v,x0+xc*cc), Y=SY(v,ythk(xc,TC)*cc); i?c.lineTo(X,Y):c.moveTo(X,Y); }
  for(let i=m;i>=0;i--){ const xc=(1-Math.cos(Math.PI*i/m))/2; c.lineTo(SX(v,x0+xc*cc),SY(v,-ythk(xc,TC)*cc)); }
  c.closePath(); c.fillStyle=TH['k-model']; c.fill();
  if(iceT>0&&k*iceT>0.6){
    const ye=0.07*cc*(0.45+0.55*S.IC.beta0), n=40, pts=[];
    for(let i=0;i<=n;i++){ const y=-ye+2*ye*i/n, d=iceShape(y)*(1+0.06*Math.sin(i*2.7)); pts.push([SX(v,x0+leX(y)-d),SY(v,y)]); }
    for(let i=n;i>=0;i--){ const y=-ye+2*ye*i/n; pts.push([SX(v,x0+leX(y)),SY(v,y)]); }
    c.shadowColor='rgba(210,248,255,.9)'; c.shadowBlur=k>800?14:6; poly(c,pts,true); c.fillStyle=TH['h-ice']; c.globalAlpha=.92; c.fill(); c.shadowBlur=0; c.globalAlpha=1;
  }
  /* droplets */
  const rr=k>600?2.2:k>150?1.6:1.1;
  c.fillStyle=TH['h-ice'];
  for(const d of drops){
    const o=pathAt(PT,d.s); if(o.seg.id==='c2'||o.seg.id==='gec') continue;
    const lat=laneLat(PT,d.s,d.e,o.w,0.7), X=SX(v,o.x+o.nx*lat), Y=SY(v,o.y+o.ny*lat);
    if(X<-10||Y<-10||X>v.W+10||Y>v.H+10) continue;
    const ur=PT.A_TS/o.A, tl=Math.min(26,ur*k*0.035);
    c.globalAlpha=.85; c.beginPath(); c.arc(X,Y,rr,0,Math.PI*2); c.fill();
    if(tl>2){ c.globalAlpha=.3; c.strokeStyle=TH['h-ice']; c.lineWidth=rr; c.beginPath(); c.moveTo(X,Y); c.lineTo(X-o.tx*tl,Y+o.ty*tl); c.stroke(); }
  }
  c.globalAlpha=1;
  for(const s of splats){ const X=SX(v,s.x), Y=SY(v,s.y), r=(2+s.t*30)*(k>600?1.6:1); c.strokeStyle=TH['h-ice']; c.globalAlpha=Math.max(0,0.8-s.t*1.6); c.lineWidth=1; c.beginPath(); c.arc(X,Y,r,0,Math.PI*2); c.stroke(); }
  c.globalAlpha=1;
  if(v.hot){ const o=v.hot; c.strokeStyle=TH['h-accent']; c.globalAlpha=.9; c.lineWidth=1.5; c.setLineDash([3,3]); poly(c,band(v,o.s0,o.s1),true); c.stroke(); c.setLineDash([]); c.globalAlpha=1; }
}
function drawGL(v){
  if(!v.gl||!LANES) return;
  const col={a:hex2rgb(TH['h-smoke-a']),b:hex2rgb(TH['h-smoke-b']),h:hex2rgb(TH['h-heat'])};
  v.gl.draw(v.cam,v.W,v.H,v.dpr,simT,PUFF,col);
}
function drawFallback(v){
  /* no WebGL: static filaments on the base canvas */
  if(v.gl||!LANES) return;
  const c=v.ctxB, M=LANES.per/2; c.strokeStyle=TH['h-smoke-a']; c.globalAlpha=.5; c.lineWidth=1;
  for(let j=0;j<LANES.lanes;j++){ c.beginPath(); for(let i=0;i<M;i+=2){ const o=(j*M+i)*2*9, X=SX(v,LANES.data[o]), Y=SY(v,LANES.data[o+1]); i?c.lineTo(X,Y):c.moveTo(X,Y); } c.stroke(); }
  c.globalAlpha=1;
}

/* ---- hero layout ---- */
function layoutHero(){
  const v=HV, W=v.root.clientWidth; if(!W||!PT) return;
  const small=W<700, ex=PT.ext, wW=ex.x1-ex.x0, wH=ex.y1-ex.y0;
  const top=small?44:84, bot=small?46:84, k=Math.min((W-(small?16:40))/wW,(Math.max(340,innerHeight*0.62)-top-bot)/wH), H=Math.round(wH*k+top+bot);
  v.root.style.height=H+'px'; sizeView(v,W,H,2);
  v.cam={ox:(W-wW*k)/2-ex.x0*k,oy:top+ex.y1*k,k,lw:small?0.7:0.85};
  $('#itHint').textContent='plan view · true scale · smoke slowed 1:40 · ice time-lapse ×'+TLAPSE;
  drawBase(v); drawFallback(v);
}
/* ---- close-up (pinned) ---- */
let ZKF=[], zActive=-1;
const ZST=[
  {id:'sp',name:'Spray bars',key:'spray'},{id:'noz',name:'Contraction',key:'noz'},{id:'model',name:'Ice on the model',key:'model'},
  {id:'c1',name:'Corner 1',key:'corner'},{id:'fan',name:'Fan array',key:'fan'},{id:'hx',name:'Heat exchanger',key:'hx'}
];
function layoutZoom(){
  const v=ZV, W=v.root.clientWidth, H=v.root.clientHeight; if(!W||!H||!PT) return;
  sizeView(v,W,H,1.5);
  const small=W<720, sb=v.root.getBoundingClientRect(), hb=$('#izoom .fly-head').getBoundingClientRect(), fb=$('#izCards').getBoundingClientRect();
  const headB=hb.bottom-sb.top-10, dockH=$('#idock').offsetHeight;
  const bottom=small?Math.max(headB+140,fb.top-sb.top-$('#izHint').offsetHeight-20):H-dockH-16;
  const cy=(headB+bottom)/2, Hav=Math.max(100,(bottom-headB)*0.86), Wav=W*(small?0.92:0.62);
  const g=S.R.geo, G=S.G, B=PT.byId;
  const pt=s=>pathAt(PT,s);
  const kf=(p,hW,hH)=>({x:p[0],y:p[1],k:Math.min(Wav/hW,Hav/hH)});
  const sp=pt(PT.at_sp), nz=B.noz?pt(B.noz.s0+B.noz.L*0.5):sp, fn=B.fan?pt(B.fan.s0+B.fan.L*0.5):sp, hx=pt(PT.at_hx+0.05);
  ZKF=[
    kf([sp.x-0.25,0],1.6,g.s_dn*1.25),
    kf([nz.x,0],G.L_c*1.15,g.s_dn*1.15),
    kf([PT.x0+PT.sLE+PT.c*0.25,0],PT.c*1.7,PT.c*0.55),
    kf([g.X_alt,0],g.s12*2.0,g.s12*1.6),
    kf([fn.x,fn.y],g.fan_w*2.4,g.fan_w*1.5),
    kf([hx.x,hx.y],Math.max(g.s_dn,g.s34)*1.7,Math.max(g.s_dn,g.s34)*1.3)
  ];
  v.base={W,H,cx:small?W*0.5:W*0.6,cy,small};
  buildZoomMap();
}
function zoomProgress(){ const sec=$('#izoom'), sr=sec.getBoundingClientRect(), total=sec.offsetHeight-ZV.root.clientHeight;
  return {p:clamp(-sr.top/Math.max(1,total),0,1),inView:sr.top<innerHeight&&sr.bottom>0}; }
function zoomCam(p){
  const n=ZKF.length, t=p*(n-1), i=Math.min(n-2,Math.floor(t)), f=t-i, fe=sstep(0.15,0.85,f), a=ZKF[i], b=ZKF[i+1];
  const k=Math.exp(Math.log(a.k)+(Math.log(b.k)-Math.log(a.k))*fe);
  /* travel with an arc so long moves zoom out a little in between */
  const dist=Math.hypot(b.x-a.x,b.y-a.y), dip=1+Math.min(2.5,dist*0.35)*Math.sin(Math.PI*fe);
  return {x:a.x+(b.x-a.x)*fe,y:a.y+(b.y-a.y)*fe,k:k/dip,t};
}
function renderZoom(now){
  const v=ZV; if(!ZKF.length||!S) return;
  const {p}=zoomProgress(), cam=zoomCam(p), B=v.base;
  v.cam={ox:B.cx-cam.x*cam.k,oy:B.cy+cam.y*cam.k,k:cam.k,lw:1.0};
  drawBase(v); drawFallback(v); drawGL(v); drawTop(v,now);
  const act=clamp(Math.round(cam.t),0,ZST.length-1); if(act!==zActive) setZoomActive(act);
  const win=$('#izWin'); if(win){ const L=PT.L, s=[PT.at_sp,PT.byId.noz?PT.byId.noz.s0:0,PT.sLE,PT.byId.c1?PT.byId.c1.s0:0,PT.byId.fan?PT.byId.fan.s0:0,PT.at_hx][act]; win.setAttribute('x',((s/L)*1000-12).toFixed(1)); }
  $('#izHint').classList.toggle('gone',p>0.04);
}
function setZoomActive(i){ zActive=i;
  $$('#izCards .fc').forEach((c,k)=>{ c.classList.toggle('on',k===i); c.classList.toggle('past',k<i); c.setAttribute('aria-hidden',String(k!==i)); });
  $$('#izDots button').forEach((b,k)=>b.classList.toggle('on',k===i)); }
function buildZoomMap(){ $('#izMap').innerHTML=unrolledSVG(30,26)+'<rect class="win" id="izWin" x="0" y="0" width="24" height="30" vector-effect="non-scaling-stroke"/>'; }
function unrolledSVG(h,amp){
  const L=PT.L, n=160, wmax=Math.max(S.R.geo.s_dn,S.R.geo.fan_w); let tp='',bt='';
  for(let i=0;i<=n;i++){ const s=L*i/n, o=pathAt(PT,Math.min(s,L-1e-6)), w=o.w/wmax*amp/2; tp+=(i?'L':'M')+(s/L*1000).toFixed(1)+','+(h/2-w).toFixed(2); bt+=(i?'L':'M')+(s/L*1000).toFixed(1)+','+(h/2+w).toFixed(2); }
  return '<path d="'+tp+'" fill="none" stroke="#7E97A4" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="'+bt+'" fill="none" stroke="#7E97A4" stroke-width="1" vector-effect="non-scaling-stroke"/>';
}
function renderZoomCards(){
  const R=S.R, IC=S.IC, G=S.G, TB=S.TB, by=id=>R.bil.find(b=>b.id===id)||{dp:0,K_ref:0};
  const fan=R.fan, mins=Math.floor(iceClock/60);
  const C=[
    {k:'spray',st:[['Water',nf(IC.water_Lh,1),'L/h'],['Per nozzle',nf(IC.perNoz,2),'L/h'],['Local V',nf(R.Q/(R.geo.s_dn**2),2),'m/s']],
      note:P.spNn+' nozzles on '+P.spN+' bars inject '+nf(P.LWC,2)+' g/m³ at '+nf(P.MVD,0)+' µm MVD. The bars sit in the slow settling-chamber flow, so their own loss is tiny (K = '+nf(by('sp').K_ref,4)+'), but their wakes are the last disturbance before the contraction.'},
    {k:'noz',st:[['CR',nf(P.CR,1),''],['Travel time',nf(R.t_kalis*1000,0),'ms'],['50 µm ΔT left',nf(IC.rem50*100,1),'%']],
      note:'The contraction accelerates the cloud '+nf(P.CR,1)+'×. Droplets leave the nozzles at '+nf(P.spT,0)+' °C and must shed that heat on the way; with a thermal time constant of '+nf(IC.drops.find(d=>d.d===50).tau*1000,0)+' ms for 50 µm drops they arrive supercooled.'},
    {k:'model',st:[['β₀',nf(IC.beta0,2),''],['Growth',nf(IC.rate_mm_min,2),'mm/min'],['T₀',nf(IC.Tstag,1),'°C']],
      note:'Droplets near the stagnation line cannot follow the streamlines and hit the leading edge (Langmuir inertia K₀ = '+nf(IC.K0,2)+'). Expected regime: '+(IC.regime==='none'?'no accretion':IC.regime)+'. Ice grows here in time-lapse ×'+TLAPSE+'.'},
    {k:'corner',st:[['V',nf(by('c1').V,1),'m/s'],['K × icing',nf(P.buz1,2),''],['Δp',nf(by('c1').dp,0),'Pa']],
      note:'Whatever passes the model is caught by the first turning vanes. They frost up during a run, which is why their loss is multiplied by '+nf(P.buz1,2)+' and why heated vanes are worth planning.'},
    {k:'fan',st:[['Δp needed',ni(R.dp_top*G.marg),'Pa'],['Shaft',kW(R.P_mil).v,kW(R.P_mil).u],['Heat in',kW(TB.fan+TB.motor).v,kW(TB.fan+TB.motor).u]],
      note:P.fN+' fans in a '+fan.ncol+'×'+fan.nrow+' array restore the '+nf(R.dp_top,0)+' Pa lost round the loop. Every watt of shaft power ends up as heat in the air'+(P.motorIn?', plus the motor losses since the motors sit in the stream':'')+'.'},
    {k:'hx',st:[['Face V',nf(R.hx.V,2),'m/s'],['Δp',nf(R.hx.dp,0),'Pa'],['Cooling',kW(TB.sec).v,kW(TB.sec).u]],
      note:'The coil removes fan heat, wall heat and the latent heat of the spray water: '+kW(TB.top).v+' '+kW(TB.top).u+' at the design point, '+kW(TB.sec).v+' '+kW(TB.sec).u+' with the selection margin. It is also the largest single loss in the circuit.'}
  ];
  $('#izCards').innerHTML=C.map((s,i)=>'<article class="fc" aria-hidden="true"><div class="fc-top"><span>'+pad2(i+1)+' / 06</span><span>'+ZST[i].name+'</span></div>'+
    '<h3><i style="background:'+KC(s.k)+'"></i>'+ZST[i].name+'</h3><dl class="fc-st">'+s.st.map(x=>'<div><dt>'+x[0]+'</dt><dd>'+x[1]+(x[2]?'<small>'+x[2]+'</small>':'')+'</dd></div>').join('')+'</dl>'+
    '<p>'+s.note+'</p><button class="fc-go" type="button" data-igo="'+(i===2?'itherm':i===4?'ifan':i===5?'itherm':'iloss')+'">'+(i===2||i===5?'Thermal & icing':i===4?'Fan array':'Loss loop')+' →</button></article>').join('');
  if(!$('#izDots').children.length){
    $('#izDots').innerHTML=ZST.map((s,i)=>'<li><button type="button" data-zi="'+i+'">'+s.name+'<i></i></button></li>').join('');
    $$('#izDots button').forEach(b=>b.addEventListener('click',()=>{ const sec=$('#izoom'), total=sec.offsetHeight-ZV.root.clientHeight, top=sec.getBoundingClientRect().top+scrollY;
      window.scrollTo({top:top+total*(+b.dataset.zi)/(ZST.length-1)+2,behavior:RM.matches?'auto':'smooth'}); }));
  }
  const a=zActive; zActive=-1; setZoomActive(a<0?0:a);
}
function renderIceMeter(){
  const mm=iceT*1000, mins=Math.floor(iceClock/60), secs=Math.floor(iceClock%60);
  $('#izIce').textContent=nf(mm,1)+' mm';
  $('#izClockT').textContent=mins+':'+pad2(secs)+' min';
  $('#izBar').style.width=(iceT/ICE_MAX*100).toFixed(1)+'%';
}

/* ================= probe (hover the hero) ================= */
const SEG_COMP={ts:['ts','model'],d1:['d1'],c1:['c1'],l12:['l12','safe'],c2:['c2'],gec:['gec'],fan:['fan','borda'],d3:['d3'],ust:['ust'],c3:['c3'],l34:['l34'],c4:['c4'],gad:[],dn:[],noz:['noz']};
const SEG_NAME={ts:'Test section',d1:'First diffuser',c1:'Corner 1',l12:'Duct 1–2',c2:'Corner 2',gec:'Fan transition',fan:'Fan section',d3:'Return diffuser',ust:'Return duct',c3:'Corner 3',l34:'Duct 3–4',c4:'Corner 4',gad:'Wide-angle diffuser',dn:'Settling chamber',noz:'Contraction'};
function segComps(id){
  const R=S.R;
  if(id==='gad') return R.bil.filter(b=>b.id==='gad'||/^gs/.test(b.id)||(b.id==='hx'&&R.yer==='birlikte'));
  if(id==='dn') return R.bil.filter(b=>['dn','hc','sp'].includes(b.id)||/^sc/.test(b.id));
  if(id==='l34') return R.bil.filter(b=>b.id==='l34'||(b.id==='hx'&&R.yer==='ayri'));
  return R.bil.filter(b=>(SEG_COMP[id]||[]).includes(b.id));
}
function probe(v,cx,cy){
  if(!PT||!LANES) return null;
  const bb=v.cvT.getBoundingClientRect(), px=cx-bb.left, py=cy-bb.top, x=(px-v.cam.ox)/v.cam.k, y=(v.cam.oy-py)/v.cam.k;
  let best=null, bd=1e9;
  for(let i=0;i<LANES.pts.length;i+=3){ const o=LANES.pts[i], d=Math.hypot(o.x-x,o.y-y); if(d<bd){ bd=d; best=i; } }
  if(best==null) return null;
  const o=LANES.pts[best], s=LANES.S[best]; if(bd>o.w*0.55) return null;
  const sg=pathAt(PT,s).seg, comps=segComps(sg.id), K=comps.reduce((a,b)=>a+b.K_ref,0), dp=comps.reduce((a,b)=>a+b.dp,0);
  return {seg:sg,s,px,py,u:S.R.Q/o.A,K,dp,comps,name:SEG_NAME[sg.id]||sg.id};
}

/* ================= render: hero text ================= */
function renderHero(){
  const R=S.R, TB=S.TB, IC=S.IC, AU=S.AU, pm=kW(R.P_mil), pc=kW(TB.sec);
  const items=[['Test speed',nf(R.V,1),'m/s · M '+nf(R.M,3)],['Static temperature',nf(P.T,1),'°C · T₀ '+nf(IC.Tstag,1)+' °C'],['Flow rate Q',ni(R.Q*3600),'m³/h · '+nf(R.Q,2)+' m³/s'],
    ['Mass flow ṁ',nf(R.mdot,2),'kg/s · ρ '+nf(R.rho,3)],['Fan shaft power',pm.v,pm.u+' · Δp '+ni(R.dp_top)+' Pa'],['Cooling load',pc.v,pc.u+' · ×'+nf(P.tmarg,2)+' margin']];
  $('#ireadouts').innerHTML=items.map(i=>'<div class="ro"><div class="l">'+i[0]+'</div><div class="v">'+i[1]+'</div><div class="u">'+i[2]+'</div></div>').join('');
  const cnt=sevCount(AU), bad=AU.filter(c=>c.sev==='bad'||c.sev==='warn');
  let h='<li class="chip '+(cnt.bad?'bad':cnt.warn?'warn':'ok')+'"><button type="button" data-igo="iaudit">Design audit · '+(cnt.bad?cnt.bad+' critical · ':'')+cnt.warn+' warning'+(cnt.warn===1?'':'s')+' · '+cnt.ok+' passed</button></li>';
  bad.slice(0,4).forEach(c=>{ h+='<li class="chip '+c.sev+'"><button type="button" data-audit="'+c.id+'">'+esc(c.title)+' · '+esc(c.val)+'</button></li>'; });
  const okSome=AU.filter(c=>c.sev==='ok').slice(0,Math.max(0,3-Math.max(0,bad.length-1)));
  okSome.forEach(c=>{ h+='<li class="chip ok"><button type="button" data-audit="'+c.id+'">'+esc(c.title)+' · '+esc(c.val)+'</button></li>'; });
  $('#ichecks').innerHTML=h;
  const tk=['Re<sub>a</sub> <b>'+ni(R.Re)+'</b>','Mach <b>'+nf(R.M,3)+'</b>','q <b>'+nf(R.q_TS,0)+' Pa</b>','Q <b>'+ni(R.Q*3600)+' m³/h</b>','ṁ <b>'+nf(R.mdot,2)+' kg/s</b>','CR <b>'+nf(P.CR,1)+'</b>',
    'ER <b>'+nf(R.ER,2)+'</b>','K<sub>total</sub> <b>'+nf(R.K_top,4)+'</b>','Δp <b>'+nf(R.dp_top,0)+' Pa</b>','P<sub>shaft</sub> <b>'+pm.v+' '+pm.u+'</b>','P<sub>el</sub> <b>'+kW(R.P_elek).v+' '+kW(R.P_elek).u+'</b>',
    'cooling <b>'+pc.v+' '+pc.u+'</b>','LWC <b>'+nf(P.LWC,2)+' g/m³</b>','MVD <b>'+nf(P.MVD,0)+' µm</b>','β₀ <b>'+nf(IC.beta0,2)+'</b>','ice <b>'+nf(IC.rate_mm_min,2)+' mm/min</b>',
    'water <b>'+nf(IC.water_Lh,1)+' L/h</b>','footprint <b>'+nf(R.geo.boy,2)+' × '+nf(R.geo.en,2)+' m</b>','volume <b>'+nf(R.hacim,1)+' m³</b>'];
  const one=tk.map(t=>'<span>'+t+'</span>').join(''); $('#iticker').innerHTML=one+one;
  $('#idDp').textContent=ni(R.dp_top)+' Pa'; $('#idP').textContent=pm.v+' '+pm.u; $('#idQ').textContent=pc.v+' '+pc.u;
  const b=$('#idAudit'); b.style.setProperty('--c',cnt.bad?'var(--bad)':cnt.warn?'var(--warn)':'var(--ok)'); b.innerHTML='<i></i>'+(cnt.bad+cnt.warn)+' flag'+((cnt.bad+cnt.warn)===1?'':'s');
}
function sevCount(AU){ const c={bad:0,warn:0,info:0,ok:0}; AU.forEach(x=>c[x.sev]++); return c; }

/* ================= render: audit ================= */
let auFilter='issues', auHot=null;
const SEVN={bad:'Critical',warn:'Warning',info:'Note',ok:'Pass'};
function auditWhere(id){
  const B=PT.byId;
  if(B[id]) return pathAt(PT,B[id].s0+B[id].L*0.5);
  if(id==='model') return pathAt(PT,PT.sLE);
  if(id==='hx') return pathAt(PT,PT.at_hx);
  if(id==='sp') return pathAt(PT,PT.at_sp);
  if(/^(sc|hc)/.test(id)) return pathAt(PT,B.dn?B.dn.s0+B.dn.L*0.5:0);
  if(/^gs/.test(id)) return pathAt(PT,B.gad?B.gad.s0+B.gad.L*0.5:0);
  if(id==='safe') return pathAt(PT,B.l12?B.l12.s0+B.l12.L*0.5:0);
  if(id==='borda') return pathAt(PT,B.fan?B.fan.s1:0);
  return pathAt(PT,0);
}
function renderAudit(){
  const AU=S.AU, cnt=sevCount(AU);
  const tops=[['bad','Critical',cnt.bad],['warn','Warnings',cnt.warn],['info','Notes',cnt.info],['ok','Passed',cnt.ok]];
  $('#iauTop').innerHTML=tops.map(t=>'<button class="au-n sev-'+t[0]+'" type="button" data-f="'+t[0]+'" aria-pressed="'+(auFilter===t[0])+'"><div class="v">'+t[2]+'</div><div class="l">'+t[1]+'</div></button>').join('')+
    '<div class="au-all"><div class="iseg" role="group" aria-label="Filter"><button type="button" data-f="issues" aria-pressed="'+(auFilter==='issues')+'">Issues</button><button type="button" data-f="all" aria-pressed="'+(auFilter==='all')+'">All '+AU.length+'</button></div></div>';
  const list=AU.filter(c=>auFilter==='all'?true:auFilter==='issues'?c.sev!=='ok':c.sev===auFilter);
  const open=new Set($$('#iauList details[open]').map(d=>d.dataset.id));
  $('#iauList').innerHTML=list.length?list.map((c,i)=>{
    const g=c.gauge; let gh='';
    if(g){ const span=g.hi-g.lo, pos=clamp((g.v-g.lo)/span,0,1)*100;
      gh='<div class="gauge" aria-hidden="true"><div class="tr">'+g.zones.map(z=>'<span style="width:'+((Math.min(z[1],g.hi)-Math.max(z[0],g.lo))/span*100)+'%;background:var(--'+z[2]+');opacity:.55"></span>').join('')+'</div>'+
        '<div class="mk"><i style="left:'+pos+'%"></i></div><div class="ax"><span>'+ns(g.lo,3)+'</span><span>'+(g.fmtv?g.fmtv(g.v):ns(g.v,3))+(g.u&&!g.fmtv?' '+g.u:'')+'</span><span>'+ns(g.hi,3)+'</span></div></div>'; }
    const refs=c.refs.map(r=>'<span class="au-ref" title="'+esc(E.REFS[r]?E.REFS[r].t:r)+'">['+r+']</span>').join('');
    return '<details class="au-c sev-'+c.sev+'" data-id="'+c.id+'"'+(open.has(c.id)?' open':'')+'><summary><span class="no">'+pad2(AU.indexOf(c)+1)+'</span><span class="tt">'+esc(c.title)+'<small>'+SEVN[c.sev]+' · '+c.cat+' · limit '+esc(c.lim)+'</small></span><span class="vv">'+esc(c.val)+'</span><span class="chev" aria-hidden="true"></span></summary>'+
      '<div class="au-b">'+gh+'<p>'+esc(c.msg)+'</p>'+(c.fix&&c.fix!=='—'?'<p class="fix"><b>What to change:</b> '+esc(c.fix)+'</p>':'')+
      '<div class="au-meta">'+refs+(c.fields.length?'<button class="au-go" type="button" data-field="'+c.fields[0]+'">Edit '+esc(FK[c.fields[0]]?FK[c.fields[0]].label.toLowerCase():c.fields[0])+' →</button>':'')+'</div></div></details>';
  }).join(''):'<div class="au-empty">Nothing in this category.</div>';
  renderAuditMap(list);
}
function renderAuditMap(list){
  const ex=PT.ext, W=1000, pad=40, k=(W-2*pad)/(ex.x1-ex.x0), H=(ex.y1-ex.y0)*k+2*pad;
  const X=x=>pad+(x-ex.x0)*k, Y=y=>pad+(ex.y1-y)*k, v={cam:{ox:pad-ex.x0*k,oy:pad+ex.y1*k,k}};
  const f=n=>n.toFixed(1), toD=pts=>pts.map((p,i)=>(i?'L':'M')+f(p[0])+','+f(p[1])).join('')+'Z';
  let o='<path class="duct" fill-rule="evenodd" d="'+toD(wallPts(v,-1))+toD(wallPts(v,1))+'"/>';
  PT.segs.forEach(q=>{ o+='<path class="ausg" data-seg="'+q.id+'" d="'+toD(band(v,q.s0,q.s1))+'"/>'; });
  const pins={}; list.filter(c=>c.sev!=='ok').forEach(c=>{ const p=auditWhere(c.where), key=c.where; pins[key]=(pins[key]||0)+1;
    const n=pins[key]-1, X0=X(p.x)+n*38, Y0=Y(p.y), no=S.AU.indexOf(c)+1;
    o+='<g class="pin sev-'+c.sev+'" data-id="'+c.id+'" transform="translate('+f(X0)+','+f(Y0)+')"><circle class="halo" r="18"/><circle r="18" style="fill:var(--c)"/><text text-anchor="middle" y="6">'+no+'</text></g>'; });
  o+='<text class="lbl" x="'+f(X(PT.x0+PT.byId.ts.L/2))+'" y="'+f(Y(-S.R.geo.s_dn/2)+30)+'" text-anchor="middle">test section</text>';
  if(PT.byId.fan){ const p=pathAt(PT,PT.byId.fan.s0); o+='<text class="lbl" x="'+f(X(p.x))+'" y="'+f(Y(ex.y1)-12)+'" text-anchor="middle">fans</text>'; }
  $('#iauMap').innerHTML='<svg viewBox="0 0 '+W+' '+f(H)+'" role="img" aria-label="Plan of the circuit with the location of each flagged check">'+o+'</svg>';
}
function setAuHot(id){
  auHot=id; const c=S.AU.find(x=>x.id===id);
  $$('#iauList .au-c').forEach(d=>d.classList.toggle('hot',d.dataset.id===id));
  $$('#iauMap .pin').forEach(p=>p.classList.toggle('hot',p.dataset.id===id));
  $$('#iauMap .ausg').forEach(p=>{ const on=!!c&&p.dataset.seg===(PT.byId[c.where]?c.where:auditWhere(c.where).seg.id); p.classList.toggle('hot',on); if(on) p.style.setProperty('--c','var(--'+c.sev+')'); });
}

/* ================= render: loss loop ================= */
function renderLoss(){
  const R=S.R, B=R.bil, fi=B.findIndex(b=>b.id==='borda')>=0?B.findIndex(b=>b.id==='borda'):B.findIndex(b=>b.id==='fan');
  const seq=B.slice(fi+1).concat(B.slice(0,fi+1));
  const box=$('#illChart'), W=Math.max(320,box.clientWidth-28||900), H=W<600?300:340, m={l:52,r:14,t:16,b:40};
  const iw=W-m.l-m.r, ih=H-m.t-m.b, rho=R.rho, Q=R.Q;
  const Lsum=seq.reduce((a,b)=>a+Math.max(b.L,0),0)+0.6*(seq.filter(b=>b.L===0).length+1);
  let x=0, pt=R.dp_top; const pts=[], stc=[], segs=[];
  const q=A=>0.5*rho*(Q/A)**2;
  seq.forEach(b=>{ const L=b.L>0?b.L:0.6, x0=x, p0=pt; x+=L; pt-=b.dp;
    segs.push({b,x0,x1:x,p0,p1:pt}); pts.push([x0,p0],[x,pt]); stc.push([x0,p0-q(b.A1)],[x,pt-q(b.A2)]); });
  const leak=R.dp_top-R.K_ham*R.q_TS; segs.push({b:{id:'leak',name:'Leakage & joints (×'+nf(P.leak,2)+')',key:'duct',dp:leak,K_ref:R.K_top-R.K_ham},x0:x,x1:x+0.6,p0:pt,p1:pt-leak}); pts.push([x,pt],[x+0.6,pt-leak]); x+=0.6;
  const ymin=Math.min(0,...stc.map(p=>p[1])), ymax=R.dp_top*1.08, yr=ymax-ymin;
  const X=v=>m.l+v/x*iw, Y=v=>m.t+ih-(v-ymin)/yr*ih, f=n=>n.toFixed(1);
  let s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Total and static pressure round the circuit">';
  const tk=niceTicks(ymax,5).concat(ymin<0?niceTicks(-ymin,3).slice(1).map(v=>-v):[]).filter(v=>v>=ymin-1e-9&&v<=ymax+1e-9);
  tk.forEach(v=>{ s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+f(Y(v))+'" y2="'+f(Y(v))+'" style="stroke:var(--line)" stroke-width="'+(v===0?1.4:1)+'"/><text x="'+(m.l-8)+'" y="'+f(Y(v)+4)+'" text-anchor="end" style="fill:var(--muted);font:11px var(--f-mono)">'+ns(v,3)+'</text>'; });
  segs.forEach((g,i)=>{ const col=KC(g.b.key);
    s+='<g class="llsg" data-id="'+g.b.id+'"><rect class="hit" x="'+f(X(g.x0))+'" y="'+m.t+'" width="'+f(Math.max(2,X(g.x1)-X(g.x0)))+'" height="'+ih+'" fill="transparent"/>'+
      '<path d="M'+f(X(g.x0))+','+f(Y(g.p0))+'L'+f(X(g.x1))+','+f(Y(g.p1))+'L'+f(X(g.x1))+','+f(Y(0))+'L'+f(X(g.x0))+','+f(Y(0))+'Z" style="fill:'+col+';fill-opacity:.13"/>'+
      '<path d="M'+f(X(g.x0))+','+f(Y(g.p0))+'L'+f(X(g.x1))+','+f(Y(g.p1))+'" style="stroke:'+col+'" stroke-width="2.6" fill="none"/></g>'; });
  s+='<path d="M'+stc.map(p=>f(X(p[0]))+','+f(Y(p[1]))).join('L')+'" style="stroke:var(--muted)" stroke-width="1.3" stroke-dasharray="4 3" fill="none"/>';
  s+='<path d="M'+f(X(x))+','+f(Y(0))+'V'+f(Y(R.dp_top))+'" style="stroke:var(--k-fan)" stroke-width="3"/><path d="M'+f(X(x)-5)+','+f(Y(R.dp_top)+9)+'l5,-9l5,9" style="stroke:var(--k-fan);fill:none" stroke-width="2"/>';
  s+='<text x="'+f(X(x)-8)+'" y="'+f(Y(R.dp_top*0.5))+'" text-anchor="end" style="fill:var(--k-fan);font:600 11px var(--f-mono)">fan +'+ni(R.dp_top)+' Pa</text>';
  /* leg labels along the x axis */
  const legs=[['Return leg',['d3','ust','c3','l34']],['WAD · settling',['c4','gad','hx','dn','noz']],['Test leg',['ts','model','d1','c1']],['To the fan',['l12','c2','gec','fan']]];
  legs.forEach(L=>{ const gs=segs.filter(g=>L[1].includes(g.b.id)); if(!gs.length) return; const a=Math.min(...gs.map(g=>g.x0)), b=Math.max(...gs.map(g=>g.x1));
    s+='<text x="'+f((X(a)+X(b))/2)+'" y="'+(H-m.b+18)+'" text-anchor="middle" style="fill:var(--muted);font:11px var(--f-body)">'+L[0]+'</text><path d="M'+f(X(a)+2)+','+(H-m.b+6)+'H'+f(X(b)-2)+'" style="stroke:var(--line)" stroke-width="1"/>'; });
  s+='<text x="'+(m.l)+'" y="'+(H-4)+'" style="fill:var(--muted);font:11px var(--f-body)">flow direction → (from fan exit, one lap; zero-length elements drawn 0.6 m wide)</text></svg>';
  box.innerHTML=s+'<div class="ctip" hidden></div>';
  const tip=box.querySelector('.ctip');
  box.querySelectorAll('.llsg').forEach(g=>{
    const sg=segs.find(z=>z.b.id===g.dataset.id); if(!sg) return;
    const show=ev=>{ const b=sg.b; tip.innerHTML='<b>'+esc(b.name)+'</b><div class="num"><span>Δp</span><span>'+nf(b.dp,1)+' Pa</span></div><div class="num"><span>K (ref. q_TS)</span><span>'+nf(b.K_ref,4)+'</span></div>'+(isFinite(b.V)?'<div class="num"><span>V inlet</span><span>'+nf(b.V,2)+' m/s</span></div>':'')+'<div class="num"><span>p₀ after</span><span>'+nf(sg.p1,0)+' Pa</span></div>';
      tip.hidden=false; const bb=box.getBoundingClientRect(); let l=ev.clientX-bb.left+12; if(l+tip.offsetWidth>bb.width) l=ev.clientX-bb.left-tip.offsetWidth-12; tip.style.left=Math.max(0,l)+'px'; tip.style.top='10px'; };
    g.addEventListener('pointermove',show); g.addEventListener('pointerdown',show);
    g.addEventListener('pointerleave',()=>tip.hidden=true);
    g.addEventListener('click',()=>flashRow(sg.b.id));
  });
  $('#illLeg').innerHTML='<span><i></i>total pressure p₀ (coloured by component)</span><span><i class="d"></i>static pressure p = p₀ − ½ρV²</span><span>Pa, relative to p₀ at the fan inlet</span>';
  /* table */
  const mx=Math.max(...B.map(b=>b.dp));
  let tb='<thead><tr><th>Component</th><th>V [m/s]</th><th>Re</th><th>K local</th><th>K ref</th><th>Δp [Pa]</th><th>%</th></tr></thead><tbody>';
  B.forEach(b=>{ tb+='<tr class="row" data-row="'+b.id+'"><td><span class="sw" style="background:'+KC(b.key)+'"></span>'+esc(b.name)+'</td><td>'+nf(b.V,2)+'</td><td>'+ne(b.Re,2)+'</td><td>'+nf(b.K_lok,4)+'</td><td>'+nf(b.K_ref,4)+'</td><td>'+nf(b.dp,1)+
    '<span class="bar" style="width:'+(mx>0?Math.max(2,b.dp/mx*70):0)+'px;background:'+KC(b.key)+'"></span></td><td>'+nf(b.K_ref/R.K_ham*100,1)+'</td></tr>'; });
  tb+='</tbody><tfoot><tr><td>Sum of components</td><td></td><td></td><td></td><td>'+nf(R.K_ham,4)+'</td><td>'+nf(R.K_ham*R.q_TS,1)+'</td><td>100</td></tr>'+
    '<tr><td>Circuit total · leakage ×'+nf(P.leak,2)+'</td><td></td><td></td><td></td><td>'+nf(R.K_top,4)+'</td><td>'+nf(R.dp_top,1)+'</td><td></td></tr></tfoot>';
  $('#iktab').innerHTML=tb;
  const pm=kW(R.P_mil), pe=kW(R.P_elek), ph=kW(R.P_hava), pj=kW(R.P_jet);
  $('#ifanTiles').innerHTML=
    '<div class="hl"><div class="l">Fan Δp, duct to duct</div><div class="v">'+nf(R.dp_top,0)+'<small>Pa</small></div></div>'+
    '<div class="hl"><div class="l">Selection (×'+nf(P.marg,2)+')</div><div class="v">'+nf(R.dp_top*P.marg,0)+'<small>Pa</small></div></div>'+
    '<div><div class="l">Air power Δp·Q</div><div class="v">'+ph.v+'<small>'+ph.u+'</small></div></div>'+
    '<div><div class="l">Shaft (η '+nf(P.etaf*100,0)+'%)</div><div class="v">'+pm.v+'<small>'+pm.u+'</small></div></div>'+
    '<div><div class="l">Electrical (η_m '+nf(P.etam*100,0)+'%)</div><div class="v">'+pe.v+'<small>'+pe.u+'</small></div></div>'+
    '<div><div class="l">Jet power ½ρV³A</div><div class="v">'+pj.v+'<small>'+pj.u+'</small></div></div>'+
    '<div><div class="l">Energy ratio ER</div><div class="v">'+nf(R.ER,2)+'<small>P_jet/P_air</small></div></div>'+
    '<div><div class="l">Heat exchanger layout</div><div class="v" style="font-size:16px">'+(P.yer==='birlikte'?'At WAD exit':'In leg 3–4')+'<small>alt.: '+nf(S.Ralt.dp_top,0)+' Pa</small></div></div>';
}
function flashRow(id){
  const tr=$('#iktab tr[data-row="'+id+'"]'); if(!tr) return;
  tr.scrollIntoView({block:'center',behavior:RM.matches?'auto':'smooth'}); tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash');
}
function niceTicks(max,n){ n=n||5; if(!(max>0)) return [0,1]; const raw=max/n, mag=Math.pow(10,Math.floor(Math.log10(raw))), nm=raw/mag;
  const st=(nm<1.5?1:nm<3?2:nm<7?5:10)*mag; const t=[]; for(let v=0;v<max-1e-9;v+=st) t.push(+v.toFixed(10)); t.push(+(t[t.length-1]+st).toFixed(10)); return t; }

/* ================= render: geometry + inputs ================= */
let HOTK=null;
function buildInputs(){
  const host=$('#igeoGroups'); host.innerHTML='';
  GROUPS.forEach((G,gi)=>{
    const el=document.createElement('div'); el.className='grp igrp'+(gi<2?' open':''); el.dataset.g=G.g;
    let h='<header><button type="button" aria-expanded="'+(gi<2)+'"><h3><i style="background:'+G.color+'"></i>'+G.name+'</h3></button><span class="cnt"><span class="bd"></span><span class="mref">'+G.ref+'</span><span class="chev" aria-hidden="true"></span></span></header><div class="gb"><div>';
    FIELDS.filter(f=>f.g===G.g).forEach(f=>{
      h+='<div class="fld" data-k="'+f.k+'"><label for="ii-'+f.k+'">'+f.label+(f.m?'<small>'+f.m+'</small>':'')+'</label>';
      if(f.kind==='seg') h+='<div class="iseg" role="group" aria-label="'+f.label+'">'+f.opts.map(o=>'<button type="button" id="'+(o===f.opts[0]?'ii-'+f.k:'')+'" data-k="'+f.k+'" data-v="'+o[0]+'">'+o[1]+'</button>').join('')+'</div>';
      else if(f.kind==='bool') h+='<button type="button" class="isw" role="switch" id="ii-'+f.k+'" data-k="'+f.k+'" aria-label="'+f.label+'"></button>';
      else h+='<div class="inp"><input id="ii-'+f.k+'" inputmode="decimal" autocomplete="off"><span>'+f.unit+'</span></div>';
      h+='</div>';
    });
    h+='</div></div>'; el.innerHTML=h; host.appendChild(el);
    el.querySelector('header').addEventListener('click',()=>{ const o=!el.classList.contains('open'); el.classList.toggle('open',o); el.querySelector('header button').setAttribute('aria-expanded',String(o)); });
  });
  FIELDS.forEach(f=>{
    if(f.kind==='seg'){ $$('#igeoGroups .iseg button[data-k="'+f.k+'"]').forEach(b=>b.addEventListener('click',()=>{ P[f.k]=b.dataset.v; syncInputs(); schedule(true); })); return; }
    const inp=$('#ii-'+f.k);
    if(f.kind==='bool'){ inp.addEventListener('click',()=>{ P[f.k]=!P[f.k]; syncInputs(); schedule(true); }); }
    else inp.addEventListener('input',()=>{ let v=parseNum(inp.value); if(f.int&&isFinite(v)&&v!=='') v=Math.round(v); if(v==='') v=NaN; P[f.k]=v; inp.parentNode.classList.toggle('bad',!isFinite(v));
      if(f.k==='V'||f.k==='T') syncDock(); schedule(true); });
    inp.addEventListener('focus',()=>setHot(f.k)); inp.addEventListener('blur',()=>setHot(null));
    const fld=inp.closest('.fld');
    fld.addEventListener('pointerenter',()=>{ if(!document.activeElement||!document.activeElement.closest||!document.activeElement.closest('#igeoGroups .fld')) setHot(f.k); });
    fld.addEventListener('pointerleave',()=>{ if(!document.activeElement||!document.activeElement.closest||!document.activeElement.closest('#igeoGroups .fld')) setHot(null); });
  });
}
function parseNum(s){ s=String(s).trim().replace(/\s/g,''); if(s==='') return ''; if(s.indexOf(',')>-1&&s.indexOf('.')>-1) s=s.replace(/,/g,''); else s=s.replace(',','.'); const v=Number(s); return isFinite(v)?v:NaN; }
function syncInputs(){
  FIELDS.forEach(f=>{
    if(f.kind==='seg'){ $$('#igeoGroups .iseg button[data-k="'+f.k+'"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===P[f.k]))); return; }
    const inp=$('#ii-'+f.k); if(!inp) return;
    if(f.kind==='bool'){ inp.setAttribute('aria-checked',String(!!P[f.k])); return; }
    if(document.activeElement!==inp) inp.value=isFinite(P[f.k])?String(P[f.k]):'';
  });
  /* WAD screens only matter in the leg 3-4 layout */
  ['gN','gdw','gwm'].forEach(k=>{ const el=$('#igeoGroups .fld[data-k="'+k+'"]'); if(el) el.hidden=P.yer!=='ayri'; });
  syncDock();
  ['fcQ','fcdp','fcrho','fcname'].forEach(k=>{ const el=$('#'+k); if(el&&document.activeElement!==el) el.value=P[k]==null?'':P[k]; });
}
function setHot(k){
  HOTK=k; const bp=$('#ibp'); let any=false;
  bp.querySelectorAll('.an').forEach(g=>{ const on=!!k&&g.dataset.k.split(' ').indexOf(k)>-1; g.classList.toggle('hot',on); if(on) any=true; });
  bp.classList.toggle('focus',any);
}
function flagFields(){
  const worst={}, rank={bad:3,warn:2,info:1,ok:0};
  S.AU.forEach(c=>{ if(c.sev==='ok'||c.sev==='info') return; c.fields.forEach(k=>{ if(!worst[k]||rank[c.sev]>rank[worst[k]]) worst[k]=c.sev; }); });
  $$('#igeoGroups .fld').forEach(el=>{ const s=worst[el.dataset.k]; el.classList.toggle('flag',!!s); if(s) el.style.setProperty('--c','var(--'+s+')'); });
  $$('#igeoGroups .igrp').forEach(gr=>{ const ks=FIELDS.filter(f=>f.g===gr.dataset.g).map(f=>f.k), n={bad:0,warn:0}; ks.forEach(k=>{ if(worst[k]) n[worst[k]]++; });
    gr.querySelector('.bd').innerHTML=(n.bad?'<span class="bdg" style="--c:var(--bad)">'+n.bad+' critical</span>':'')+(n.warn?'<span class="bdg" style="--c:var(--warn)">'+n.warn+' warn</span>':''); });
}
function goField(k){
  const fld=$('#igeoGroups .fld[data-k="'+k+'"]'); if(!fld) return;
  const gr=fld.closest('.igrp'); if(!gr.classList.contains('open')){ gr.classList.add('open'); gr.querySelector('header button').setAttribute('aria-expanded','true'); }
  ctrans('Geometry','Field · '+FK[k].label,()=>{ jumpTo('igeo'); setTimeout(()=>{ fld.scrollIntoView({block:'center'}); const inp=$('#ii-'+k); if(inp) inp.focus({preventScroll:true}); fld.classList.remove('pulse'); void fld.offsetWidth; fld.classList.add('pulse'); },60); });
}
function blueprint(){
  if(!PT) return;
  const R=S.R, g=R.geo, G=S.G, VW=1000, wpx=$('#ibpSvg').clientWidth||600, K=clamp(VW/wpx,1,3.4), fs=11.5*K;
  const ex=PT.ext, mL=40+2.6*fs, mR=40+2.6*fs, top=26+2.6*fs, k=(VW-mL-mR)/(ex.x1-ex.x0);
  const v={cam:{ox:mL-ex.x0*k,oy:top+ex.y1*k,k}}, X=x=>v.cam.ox+x*k, Y=y=>v.cam.oy-y*k, f=n=>n.toFixed(1), toD=pts=>pts.map((p,i)=>(i?'L':'M')+f(p[0])+','+f(p[1])).join('')+'Z';
  const cmv=m=>nf(m*100,0);
  let o='<path class="fillp" fill-rule="evenodd" d="'+toD(wallPts(v,-1))+toD(wallPts(v,1))+'"/>';
  o+='<g class="an" data-k="a CR s12 s34 H fw fh Lc Ldn LTS"><path class="wall" d="'+toD(wallPts(v,-1))+'"/><path class="wall" d="'+toD(wallPts(v,1))+'"/></g>';
  const dimH=(xa,xb,y,txt,kk)=>'<g class="an" data-k="'+kk+'"><path class="dim" d="M'+f(xa)+','+f(y)+'H'+f(xb)+'M'+f(xa)+','+f(y-6)+'v12M'+f(xb)+','+f(y-6)+'v12"/><text class="dt" x="'+f((xa+xb)/2)+'" y="'+f(y-0.6*fs)+'" text-anchor="middle">'+txt+'</text></g>';
  const dimV=(x,ya,yb,txt,kk,anchor)=>'<g class="an" data-k="'+kk+'"><path class="dim" d="M'+f(x)+','+f(ya)+'V'+f(yb)+'M'+f(x-6)+','+f(ya)+'h12M'+f(x-6)+','+f(yb)+'h12"/><text class="dt" x="'+f(anchor==='end'?x-0.7*fs:x+0.7*fs)+'" y="'+f((ya+yb)/2+0.35*fs)+'" text-anchor="'+(anchor||'start')+'">'+txt+'</text></g>';
  /* components */
  const B=PT.byId;
  PT.segs.filter(q=>q.t==='C').forEach(q=>{ o+='<g class="an" data-k="vc vhc buz1"><path class="vane" d="'+vanes(q).map(arc=>arc.map((p,i)=>(i?'L':'M')+f(X(p[0]))+','+f(Y(p[1]))).join('')).join('')+'"/></g>'; });
  const hb=band(v,PT.at_hx,PT.at_hx+Math.max(G.dn.t_hx,0.04),3); o+='<g class="an" data-k="yer hxdp hxV hxn hxf thx"><path class="hxr" d="'+toD(hb)+'"/></g>';
  if(B.dn){ const hc=band(v,B.dn.s0+G.dn.x_hc,B.dn.s0+G.dn.x_hc+G.hc.L,3); o+='<g class="an" data-k="hcD hcL hcB xhc"><path class="hc" d="'+toD(hc)+'"/></g>';
    o+='<g class="an" data-k="elN eldw elwm elK xel del"><path class="hc" stroke-dasharray="3 3" d="'+G.dn.x_el.map(x=>{ const l=crossLine(v,B.dn.s0+x,1); return 'M'+f(l[0][0])+','+f(l[0][1])+'L'+f(l[1][0])+','+f(l[1][1]); }).join('')+'"/></g>';
    const sp=pathAt(PT,PT.at_sp), per=Math.max(1,Math.round(G.sp.Nn/Math.max(1,G.sp.N)));
    o+='<g class="an" data-k="xsp spN spd spCd spNn">'; for(let i=0;i<per;i++){ const lat=(-1+(2*i+1)/per)*sp.w/2*0.9; o+='<circle class="spd" cx="'+f(X(sp.x+sp.nx*lat))+'" cy="'+f(Y(sp.y+sp.ny*lat))+'" r="'+f(2.4*K)+'"/>'; } o+='</g>'; }
  if(B.fan){ const fo=segAt(B.fan,B.fan.L*0.5), nc=R.fan.ncol; o+='<g class="an" data-k="fN fD fw fh Lfan">'; for(let i=0;i<nc;i++){ const lat=(-1+(2*i+1)/nc)*fo.w/2, cx=fo.x+fo.nx*lat, cy=fo.y+fo.ny*lat;
    o+='<path class="fanl" d="M'+f(X(cx+fo.nx*G.fan.D/2))+','+f(Y(cy+fo.ny*G.fan.D/2))+'L'+f(X(cx-fo.nx*G.fan.D/2))+','+f(Y(cy-fo.ny*G.fan.D/2))+'"/>'; } o+='</g>'; }
  let fp=''; const x0=PT.x0+PT.sLE, cc=PT.c; for(let i=0;i<=40;i++){ const xc=(1-Math.cos(Math.PI*i/40))/2; fp+=(i?'L':'M')+f(X(x0+xc*cc))+','+f(Y(ythk(xc,TC)*cc)); }
  for(let i=40;i>=0;i--){ const xc=(1-Math.cos(Math.PI*i/40))/2; fp+='L'+f(X(x0+xc*cc))+','+f(Y(-ythk(xc,TC)*cc)); }
  o+='<g class="an" data-k="mc mx mCd"><path class="foil" d="'+fp+'Z"/></g>';
  /* dimensions: lower leg chain */
  const yd=Y(-g.s_dn/2)+2.4*fs, segsLow=[['gad','gad2th CR s34',g.L_GAD],['dn','Ldn',g.L_dn],['noz','Lc',g.L_c],['ts','LTS',g.L_TS],['d1','th1 s12',g.L_D1]];
  let ext='';
  segsLow.forEach(([id,kk,L])=>{ const q=B[id]; if(!q) return; const xa=X(q.p[0]), xb=X(q.p[0]+L); o+=dimH(xa,xb,yd,cmv(L),kk); ext+='M'+f(xa)+','+f(Y(-segAt(q,0).w/2))+'V'+f(yd+6)+'M'+f(xb)+','+f(Y(-segAt(q,q.L).w/2))+'V'+f(yd+6); });
  o+='<path class="ext" d="'+ext+'"/>';
  /* upper leg chain */
  const yu=Y(ex.y1)-1.6*fs; let extu='';
  [['gec','Lgec fw fh',g.L_gecis],['fan','Lfan fN fD',g.L_fan],['d3','th3 Lfd',g.L_D3],['ust','Lgec Lfan',g.L_ust]].forEach(([id,kk,L])=>{ const q=B[id]; if(!q||L<0.02) return; const xa=X(q.p[0]), xb=X(q.p[0]-L); o+=dimH(Math.min(xa,xb),Math.max(xa,xb),yu,cmv(L),kk); extu+='M'+f(xa)+','+f(Y(segAt(q,0).y+segAt(q,0).w/2))+'V'+f(yu-6)+'M'+f(xb)+','+f(Y(segAt(q,q.L).y+segAt(q,q.L).w/2))+'V'+f(yu-6); });
  o+='<path class="ext" d="'+extu+'"/>';
  /* overall + widths */
  const yo=yd+2.8*fs; o+=dimH(X(ex.x0),X(ex.x1),yo,'overall '+cmv(g.boy),'H Ldn Lc LTS');
  o+=dimV(X(ex.x1)+1.6*fs,Y(0),Y(g.H),'H '+cmv(g.H),'H','start');
  if(B.dn) o+=dimV(X(B.dn.p[0]+g.L_dn*0.35),Y(-g.s_dn/2),Y(g.s_dn/2),cmv(g.s_dn),'CR a','start');
  if(B.ts) o+=dimV(X(B.ts.p[0]+g.L_TS*0.85),Y(-g.a/2),Y(g.a/2),cmv(g.a),'a','start');
  o+=dimV(X(ex.x0)-1.2*fs,Y(g.H-g.s34/2),Y(g.H+g.s34/2),cmv(g.s34),'s34','end');
  o+=dimV(X(g.X_alt)-g.s12/2*k-0.9*fs,Y(-g.s12/2),Y(g.s12/2),cmv(g.s12),'s12','end');
  /* flow arrow + title block */
  if(B.ts){ const xa=X(g.s34/2+0.25); o+='<g class="an" data-k="V T p"><path class="dim" d="M'+f(xa)+','+f(Y(g.H/2))+'h'+f(3*fs)+'M'+f(xa+2.6*fs)+','+f(Y(g.H/2)-5)+'l6,5l-6,5"/><text class="dt" x="'+f(xa+3.6*fs)+'" y="'+f(Y(g.H/2)+0.35*fs)+'">V '+nf(P.V,1)+' m/s · '+nf(P.T,1)+' °C</text></g>'; }
  const rh=2.3*10.5*K, rows=['SMOKELINE · '+S.id,'PLAN · DIMENSIONS IN CM · TRUE SCALE','CR '+nf(P.CR,2)+' · ER '+nf(R.ER,2)+' · '+P.fN+' FANS','Δp '+nf(R.dp_top,0)+' Pa · '+kW(R.P_mil).v+' '+kW(R.P_mil).u+' @ '+nf(P.V,1)+' m/s'];
  const tbw=Math.min(VW-40,36*10.5*K*0.62), tbx=VW-mR-tbw+20, tby=yo+1.6*fs;
  o+='<rect class="tb" x="'+f(tbx)+'" y="'+f(tby)+'" width="'+f(tbw)+'" height="'+f(rh*rows.length)+'"/>';
  rows.forEach((t,i)=>{ if(i) o+='<path class="tb" d="M'+f(tbx)+','+f(tby+rh*i)+'h'+f(tbw)+'"/>'; o+='<text class="ttl" x="'+f(tbx+0.8*10.5*K)+'" y="'+f(tby+rh*i+rh*0.68)+'">'+esc(t)+'</text>'; });
  const VH=tby+rh*rows.length+10;
  $('#ibpSvg').innerHTML='<svg style="--k:'+K.toFixed(3)+'" viewBox="0 0 '+VW+' '+f(VH)+'" role="img" aria-label="Plan drawing of the closed circuit with dimensions">'+o+'</svg>';
  $$('#ibpSvg .an').forEach(gg=>gg.addEventListener('click',()=>{ const kk=gg.dataset.k.split(' ')[0]; const inp=$('#ii-'+kk); if(inp){ const gr=inp.closest('.igrp'); if(gr&&!gr.classList.contains('open')) gr.querySelector('header').click(); inp.focus({preventScroll:true}); inp.scrollIntoView({block:'center',behavior:RM.matches?'auto':'smooth'}); } }));
  $('#ibpCap').innerHTML='<span>Plan · dimensions in cm · footprint <b>'+nf(g.boy,2)+' × '+nf(g.en,2)+' m</b></span><span>centre line '+nf(S.GT.reduce((a,r)=>a+r.L,0),2)+' m · volume '+nf(R.hacim,1)+' m³</span>';
  if(HOTK) setHot(HOTK);
}
function vanesAll(){ return PT.segs.filter(q=>q.t==='C').map(q=>vanes(q)).flat(); }

/* ================= render: thermal ================= */
function renderThermal(){
  const R=S.R, TB=S.TB, TBs=S.TBs, IC=S.IC, mx=Math.max(TB.sec,TBs.sec);
  const parts=[['fan','Fan shaft','k-fan'],['motor','Motor losses','k-model'],['duvar','Walls','k-duct'],['sprey','Spray water','k-hx']];
  const row=(lab,sub,t)=>'<div class="th-row"><div class="l">'+lab+'<small>'+sub+'</small></div><div class="th-st">'+parts.map(p=>'<span title="'+p[1]+' '+kW(t[p[0]]).v+' '+kW(t[p[0]]).u+'" style="width:'+(t[p[0]]/mx*100).toFixed(2)+'%;background:var(--'+p[2]+')"></span>').join('')+
    '<span title="margin" style="width:'+((t.sec-t.top)/mx*100).toFixed(2)+'%;background:repeating-linear-gradient(135deg,var(--line) 0 4px,transparent 4px 8px)"></span></div><div class="v">'+kW(t.sec).v+'<small>'+kW(t.sec).u+'</small></div></div>';
  $('#ithBars').innerHTML=row('Design',nf(P.V,0)+' m/s · '+nf(P.LWC,1)+' g/m³',TB)+row('Continuous',nf(P.Vs,0)+' m/s · '+nf(P.LWCs,1)+' g/m³',TBs)+
    '<div class="th-leg">'+parts.map(p=>'<span><i style="background:var(--'+p[2]+')"></i>'+p[1]+' '+kW(TB[p[0]]).v+' '+kW(TB[p[0]]).u+'</span>').join('')+'<span><i style="background:repeating-linear-gradient(135deg,var(--muted) 0 2px,transparent 2px 4px)"></i>Selection margin ×'+nf(P.tmarg,2)+'</span></div>'+
    '<p class="note" style="margin:12px 0 0">Wall U = '+nf(TB.U,3)+' W/m²K over '+nf(R.A_duvar,1)+' m². Spray water is cooled from '+nf(P.spT,0)+' °C, frozen and sub-cooled to '+nf(P.T,0)+' °C: '+nf(TB.m_su*3600,1)+' kg/h. Air temperature rise through the fans '+nf((TB.fan+TB.motor)/(R.mdot*1005),2)+' K.</p>';
  const kv=(l,v,u)=>'<div><div class="l">'+l+'</div><div class="v">'+v+(u?'<small>'+u+'</small>':'')+'</div></div>';
  $('#iicCard').innerHTML='<h3>Icing cloud at the model<small>Langmuir–Blodgett · Anderson</small></h3><div class="ic-kv">'+
    kv('Spray water',nf(IC.water_Lh,1),'L/h')+kv('Per nozzle',nf(IC.perNoz,2),'L/h')+kv('Stagnation β₀',nf(IC.beta0,2),'')+kv('Modified inertia K₀',nf(IC.K0,2),'')+
    kv('Ice growth (rime)',nf(IC.rate_mm_min,2),'mm/min')+kv('Total temperature',nf(IC.Tstag,1),'°C')+kv('Regime',IC.regime==='none'?'no ice':IC.regime,'')+kv('Spray → LE time',nf(R.t_kalis*1000,0),'ms')+'</div>';
  $('#idrops').innerHTML='<h3>Droplet cooling before the model<small>Nu = 2, isothermal drop</small></h3><table class="dr-tab"><thead><tr><th>d [µm]</th><th>τ_T [ms]</th><th>t / τ</th><th>ΔT left</th></tr></thead><tbody>'+
    IC.drops.map(d=>'<tr'+(d.d===P.MVD?' class="mvd"':'')+'><td>'+d.d+(d.d===P.MVD?' · MVD':'')+'</td><td>'+nf(d.tau*1000,2)+'</td><td>'+nf(d.r,1)+'</td><td><span class="dr-bar" style="width:'+Math.max(1,d.rem*60).toFixed(1)+'px"></span>'+(d.rem<1e-3?ne(d.rem,1):nf(d.rem*100,1)+'%')+'</td></tr>').join('')+'</tbody></table>';
  const cond=IC.Tskin<IC.Tdew;
  $('#icond').innerHTML='<h3>Duct skin vs lab dew point<small>'+nf(P.RH,0)+'% RH at '+nf(P.Tlab,0)+' °C</small></h3><div class="ic-kv">'+kv('Outer skin',nf(IC.Tskin,1),'°C')+kv('Dew point',nf(IC.Tdew,1),'°C')+kv('Heat flux',nf(IC.qwall,1),'W/m²')+kv('Verdict','<span style="color:var(--'+(cond?'warn':'ok')+')">'+(cond?'condensation':'dry')+'</span>','')+'</div>';
}

/* ================= render: fan ================= */
function renderFan(){
  const R=S.R, f=R.fan, G=S.G, fw=G.fan.w, fh=G.fan.h, W=420, sc=(W-80)/Math.max(fw,fh), Hh=fh*sc+70, x0=40+(W-80-fw*sc)/2, y0=26, fx=v=>v.toFixed(1);
  let o='<rect x="'+fx(x0)+'" y="'+y0+'" width="'+fx(fw*sc)+'" height="'+fx(fh*sc)+'" style="fill:var(--accent);fill-opacity:.05;stroke:var(--ink)" stroke-width="1.4"/>';
  const cw=fw/f.ncol, ch=fh/f.nrow, spd=clamp(60/Math.max(1,f.n_rpm)*12,0.4,4);
  let i=0;
  for(let r=0;r<f.nrow;r++) for(let c=0;c<f.ncol;c++){ if(i>=G.fan.N) break; i++;
    const cx=x0+(c+0.5)*cw*sc, cy=y0+(r+0.5)*ch*sc, rr=G.fan.D/2*sc, hub=rr*G.fan.nu, ok=f.fits;
    o+='<rect x="'+fx(x0+c*cw*sc)+'" y="'+fx(y0+r*ch*sc)+'" width="'+fx(cw*sc)+'" height="'+fx(ch*sc)+'" style="fill:none;stroke:var(--line)" stroke-dasharray="3 3"/>';
    o+='<circle cx="'+fx(cx)+'" cy="'+fx(cy)+'" r="'+fx(rr)+'" style="fill:var(--k-fan);fill-opacity:.08;stroke:'+(ok?'var(--k-fan)':'var(--bad)')+'" stroke-width="1.6"/>';
    o+='<g class="rot'+((r+c)%2?' ccw':'')+'" style="--spd:'+spd.toFixed(2)+'s">';
    for(let b=0;b<7;b++){ const a=b/7*Math.PI*2; const p1=[cx+Math.cos(a)*hub,cy+Math.sin(a)*hub], p2=[cx+Math.cos(a+0.35)*rr*0.95,cy+Math.sin(a+0.35)*rr*0.95], p3=[cx+Math.cos(a+0.62)*rr*0.9,cy+Math.sin(a+0.62)*rr*0.9];
      o+='<path d="M'+fx(p1[0])+','+fx(p1[1])+'Q'+fx(p2[0])+','+fx(p2[1])+' '+fx(p3[0])+','+fx(p3[1])+'" style="stroke:var(--k-fan);fill:none" stroke-width="2.2" stroke-linecap="round"/>'; }
    o+='</g><circle cx="'+fx(cx)+'" cy="'+fx(cy)+'" r="'+fx(hub)+'" style="fill:var(--surface);stroke:var(--k-fan)" stroke-width="1.2"/>';
  }
  o+='<path d="M'+fx(x0)+','+fx(y0+fh*sc+16)+'h'+fx(fw*sc)+'M'+fx(x0)+','+fx(y0+fh*sc+10)+'v12M'+fx(x0+fw*sc)+','+fx(y0+fh*sc+10)+'v12" style="stroke:var(--muted)" fill="none"/><text x="'+fx(x0+fw*sc/2)+'" y="'+fx(y0+fh*sc+32)+'" text-anchor="middle" style="fill:var(--muted);font:500 12px var(--f-mono)">'+nf(P.fw,0)+' cm</text>';
  o+='<path d="M'+fx(x0-16)+','+fx(y0)+'v'+fx(fh*sc)+'M'+fx(x0-22)+','+fx(y0)+'h12M'+fx(x0-22)+','+fx(y0+fh*sc)+'h12" style="stroke:var(--muted)" fill="none"/><text x="'+fx(x0-26)+'" y="'+fx(y0+fh*sc/2)+'" text-anchor="end" style="fill:var(--muted);font:500 12px var(--f-mono)">'+nf(P.fh,0)+'</text>';
  o+='<text x="'+fx(x0+fw*sc/2)+'" y="16" text-anchor="middle" style="fill:var(--muted);font:500 11px var(--f-mono)">view from upstream · '+G.fan.N+' × Ø'+nf(P.fD,0)+' cm · counter-rotating pairs</text>';
  $('#ifanFace').innerHTML='<svg viewBox="0 0 '+W+' '+fx(Hh)+'" role="img" aria-label="Fan array seen from upstream">'+o+'</svg>';
  const t=(l,v,u,hl)=>'<div'+(hl?' class="hl"':'')+'><div class="l">'+l+'</div><div class="v">'+v+'<small>'+u+'</small></div></div>';
  $('#ifanTiles2').innerHTML=t('Per fan, flow',ni(3600*f.q_tek),'m³/h',true)+t(P.fveri==='statik'?'Static rise needed':'Total rise needed',ni(R.dp_top*P.marg),'Pa · ×'+nf(P.marg,2),true)+
    t('Shaft per fan',kW(R.P_mil*P.marg/G.fan.N).v,kW(R.P_mil*P.marg/G.fan.N).u+' with margin')+t('Estimated speed',ni(f.n_rpm),'rpm')+
    t('Tip speed',nf(f.U_uc,1),'m/s · M '+nf(f.M_uc,2))+t('Flow coefficient φ',nf(f.phi,2),'c_ax/U')+t('Outlet velocity',nf(f.V_cikis,1),'m/s')+t('Outlet coverage',nf(f.oran*100,0),'% of section');
  renderFanCurve();
}
function renderFanCurve(){
  const R=S.R, FC=S.FC, box=$('#fcChart'), out=$('#fcOut');
  const k=R.dp_top/(R.Q*R.Q), qmax=FC?Math.max(...FC.Q)*1.05:R.Q*1.6, xs=[]; for(let i=0;i<=60;i++) xs.push(qmax*i/60);
  const series=[{xs,ys:xs.map(q=>k*q*q),color:'var(--ink)',w:2,name:'system Δp = kQ²'},{xs,ys:xs.map(q=>k*q*q*P.marg),color:'var(--muted)',w:1.2,dash:'4 3',name:'×'+nf(P.marg,2)+' selection'}];
  if(FC) series.push({xs:FC.Q.filter((_,i)=>i%20===0),ys:FC.dp.filter((_,i)=>i%20===0),color:'var(--k-fan)',w:2.4,name:P.fN+' × '+(P.fcname||'fan')});
  const marks=[{x:R.Q,y:R.dp_top,c:'var(--accent)',l:'design',end:true}];
  if(FC) marks.push({x:FC.Q_cn,y:FC.dp_cn,c:'var(--k-fan)',l:'operating point'});
  lineChart(box,{series,marks,xl:'Q [m³/s]',yl:'Δp [Pa]',h:260});
  if(!FC){ out.innerHTML='<p class="note">Paste a manufacturer curve (per fan, Q in m³/h and static Δp in Pa, same number of points) to find the operating point of the '+P.fN+' fans in parallel on this circuit.</p>'; return; }
  const ok=FC.V_cn>=R.V;
  out.innerHTML='<p style="margin:0 0 6px"><b style="color:var(--'+(ok?'ok':'warn')+')">'+nf(FC.V_cn,1)+' m/s</b> reachable at full speed (target '+nf(R.V,0)+' m/s): '+ni(FC.q_fan)+' m³/h per fan, total '+nf(FC.Q_cn,2)+' m³/s at '+nf(FC.dp_cn,0)+' Pa (curve scaled to '+nf(R.rho,3)+' kg/m³).</p>'+
    '<p class="note" style="margin:0">'+(FC.maxdp<FC.need?'This fan cannot deliver the '+ni(FC.need)+' Pa selection pressure at all (max '+ni(FC.maxdp)+' Pa).':'At the selection pressure '+ni(FC.need)+' Pa one fan gives '+ni(FC.q_need)+' m³/h, so the target flow needs '+nf(FC.nEq,2)+' fan equivalents ('+P.fN+' installed).')+'</p>';
}
function lineChart(box,cfg){
  const W=Math.max(280,box.clientWidth||600), H=cfg.h||250, m={l:52,r:14,t:12,b:38}, iw=W-m.l-m.r, ih=H-m.t-m.b;
  const xmax=Math.max(...cfg.series.map(s=>Math.max(...s.xs))), xt=niceTicks(xmax,6), xM=xt[xt.length-1];
  const ymax=Math.max(...cfg.series.map(s=>Math.max(...s.ys)),...(cfg.marks||[]).map(mk=>mk.y))*1.05, yt=niceTicks(ymax,5), yM=yt[yt.length-1];
  const X=v=>m.l+v/xM*iw, Y=v=>m.t+ih-v/yM*ih, f=n=>n.toFixed(1);
  let s='<svg viewBox="0 0 '+W+' '+H+'" height="'+H+'" role="img" aria-label="'+(cfg.aria||'chart')+'">';
  yt.forEach(v=>{ s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+f(Y(v))+'" y2="'+f(Y(v))+'" style="stroke:var(--line)"/><text x="'+(m.l-8)+'" y="'+f(Y(v)+4)+'" text-anchor="end" style="fill:var(--muted);font:11px var(--f-mono)">'+ns(v,3)+'</text>'; });
  xt.forEach(v=>{ s+='<text x="'+f(X(v))+'" y="'+(H-m.b+16)+'" text-anchor="middle" style="fill:var(--muted);font:11px var(--f-mono)">'+(Number.isInteger(v)?ni(v):ns(v,3))+'</text>'; });
  s+='<text x="'+(m.l+iw/2)+'" y="'+(H-4)+'" text-anchor="middle" style="fill:var(--muted);font:11px var(--f-body)">'+cfg.xl+'</text><g class="plot">';
  cfg.series.forEach(se=>{ const pts=se.xs.map((x,i)=>[x,se.ys[i]]).filter(p=>p[1]<=yM*1.02&&p[1]>=0);
    if(pts.length>1) s+='<path d="M'+pts.map(p=>f(X(p[0]))+','+f(Y(p[1]))).join('L')+'" style="fill:none;stroke:'+se.color+'" stroke-width="'+(se.w||2)+'"'+(se.dash?' stroke-dasharray="'+se.dash+'"':'')+'/>'; });
  s+='</g>';
  (cfg.marks||[]).forEach(mk=>{ s+='<circle cx="'+f(X(mk.x))+'" cy="'+f(Y(mk.y))+'" r="5" style="fill:'+mk.c+';stroke:var(--surface)" stroke-width="2"/><text x="'+f(X(mk.x)+(mk.end?-8:8))+'" y="'+f(Y(mk.y)+(mk.end?16:-8))+'"'+(mk.end?' text-anchor="end"':'')+' style="fill:'+mk.c+';font:600 11px var(--f-mono)">'+mk.l+'</text>'; });
  if(cfg.vline!=null){ const vx=X(cfg.vline); s+='<line x1="'+f(vx)+'" x2="'+f(vx)+'" y1="'+m.t+'" y2="'+(m.t+ih)+'" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="4 3"/>'; }
  s+='<g class="xh" style="display:none"><line y1="'+m.t+'" y2="'+(m.t+ih)+'" style="stroke:var(--muted)"/></g><rect x="'+m.l+'" y="'+m.t+'" width="'+iw+'" height="'+ih+'" fill="transparent"/></svg>';
  const leg='<div class="legend" style="margin:6px 0 0">'+cfg.series.map(se=>'<span><i style="background:'+se.color+';height:3px;width:14px"></i>'+se.name+'</span>').join('')+'</div>';
  box.innerHTML=s+leg+'<div class="ctip" hidden></div>';
  if(cfg.tip){ const svg=box.querySelector('svg'), xh=svg.querySelector('.xh'), ln=xh.querySelector('line'), tip=box.querySelector('.ctip'), rect=svg.querySelector('rect:last-of-type');
    const mv=ev=>{ const bb=svg.getBoundingClientRect(), px=(ev.clientX-bb.left)*(W/bb.width), xv=clamp((px-m.l)/iw*xM,0,xM), r=cfg.tip(xv); if(!r) return;
      const xx=X(r.x); ln.setAttribute('x1',xx); ln.setAttribute('x2',xx); xh.style.display=''; tip.innerHTML=r.h; tip.hidden=false;
      let left=xx*(bb.width/W)+12; if(left+tip.offsetWidth>bb.width) left=xx*(bb.width/W)-tip.offsetWidth-12; tip.style.left=Math.max(0,left)+'px'; tip.style.top='8px'; };
    rect.addEventListener('pointermove',mv); rect.addEventListener('pointerdown',mv); rect.addEventListener('pointerleave',()=>{ xh.style.display='none'; tip.hidden=true; }); }
}

/* ================= render: sweep ================= */
let TSV=[];
function renderSweep(){
  const SW=S.SW, xs=SW.map(r=>r.V), near=V=>SW.reduce((a,b)=>Math.abs(b.V-V)<Math.abs(a.V-V)?b:a);
  const tipf=xv=>{ const r=near(xv); return {x:r.V,h:'<b>V = '+nf(r.V,0)+' m/s</b><div class="num"><span>Δp</span><span>'+nf(r.dp,0)+' Pa</span></div><div class="num"><span>Shaft</span><span>'+nf(r.Pm/1000,2)+' kW</span></div><div class="num"><span>Electrical</span><span>'+nf(r.Pe/1000,2)+' kW</span></div><div class="num"><span>ER</span><span>'+nf(r.ER,2)+'</span></div>'}; };
  lineChart($('#ichDp'),{series:[{xs,ys:SW.map(r=>r.dp),color:'var(--ink)',w:2.2,name:'circuit Δp'},{xs,ys:SW.map(r=>r.dp*P.marg),color:'var(--k-fan)',w:1.4,dash:'4 3',name:'fan selection ×'+nf(P.marg,2)}],
    marks:[{x:P.V,y:S.R.dp_top,c:'var(--accent)',l:'V = '+nf(P.V,1)}],xl:'V [m/s]',vline:P.V,tip:tipf,aria:'Circuit pressure loss versus speed'});
  lineChart($('#ichP'),{series:[{xs,ys:SW.map(r=>r.Pm/1000),color:'var(--k-fan)',w:2.2,name:'shaft kW'},{xs,ys:SW.map(r=>r.Pe/1000),color:'var(--ink)',w:1.4,dash:'4 3',name:'electrical kW'}],
    marks:[{x:P.V,y:S.R.P_mil/1000,c:'var(--accent)',l:nf(S.R.P_mil/1000,2)+' kW'}],xl:'V [m/s]',vline:P.V,tip:tipf,aria:'Fan power versus speed'});
  const head=['V [m/s]','Q [m³/s]','Q [m³/h]','K_total','Δp [Pa]','P_shaft [kW]','P_el [kW]','ER'];
  TSV=[head.join('\t')];
  let h='<thead><tr>'+head.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>';
  SW.forEach(r=>{ TSV.push([r.V,r.Q,r.Q*3600,r.K,r.dp,r.Pm/1000,r.Pe/1000,r.ER].map(n=>+n.toPrecision(6)).join('\t'));
    h+='<tr'+(Math.abs(r.V-P.V)<1e-9?' class="is-now"':'')+'><td>'+nf(r.V,0)+'</td><td>'+nf(r.Q,3)+'</td><td>'+ni(r.Q*3600)+'</td><td>'+nf(r.K,4)+'</td><td>'+nf(r.dp,1)+'</td><td>'+nf(r.Pm/1000,2)+'</td><td>'+nf(r.Pe/1000,2)+'</td><td>'+nf(r.ER,2)+'</td></tr>'; });
  $('#istab').innerHTML=h+'</tbody>';
}

/* ================= render: datasheet preview ================= */
function renderSheet(){
  const R=S.R, AU=S.AU, cnt=sevCount(AU), name=$('#dsName').value.trim()||'Icing wind tunnel';
  $('#dsId').innerHTML='Design ID <b>'+S.id+'</b>';
  const ex=PT.ext, W=300, k=(W-20)/(ex.x1-ex.x0), Hh=(ex.y1-ex.y0)*k+20, v={cam:{ox:10-ex.x0*k,oy:10+ex.y1*k,k}};
  const toD=pts=>pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join('')+'Z';
  let plan='<svg viewBox="0 0 '+W+' '+Hh.toFixed(1)+'"><path fill-rule="evenodd" d="'+toD(wallPts(v,-1))+toD(wallPts(v,1))+'" style="fill:rgba(11,127,160,.08);stroke:#0C1A21" stroke-width=".8"/>';
  PT.segs.forEach(q=>{ if(q.t==='C') return; const b=band(v,q.s0,q.s1); plan+='<path d="'+toD(b)+'" fill="none" stroke="'+(TH['k-'+q.key]||'#888')+'" stroke-width=".6" opacity=".9"/>'; });
  plan+='</svg>';
  const kg=[['Test section',nf(P.a,0)+'×'+nf(P.a,0)+' cm'],['Speed',nf(P.V,0)+' m/s'],['Static T',nf(P.T,0)+' °C'],['Δp',ni(R.dp_top)+' Pa'],['Shaft',kW(R.P_mil).v+' '+kW(R.P_mil).u],['Cooling',kW(S.TB.sec).v+' '+kW(S.TB.sec).u],['Q',nf(R.Q,2)+' m³/s'],['ER',nf(R.ER,2)]];
  const pg='<div class="pin"><div class="hd"><span>SMOKELINE · DATASHEET</span><span>REV '+esc($('#dsRev').value||'A')+'</span></div>'+
    '<div><div class="ttl">'+esc(name)+'</div><div class="sub">Closed-circuit icing wind tunnel · single return</div></div><div><span class="ser">'+S.id+'</span></div>'+
    '<div class="kg">'+kg.map(x=>'<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')+'</div><div class="plan">'+plan+'</div>'+
    '<div class="aud"><span><i style="background:#B42318"></i>'+cnt.bad+' critical</span><span><i style="background:#9A5A00"></i>'+cnt.warn+' warnings</span><span><i style="background:#1C7A51"></i>'+cnt.ok+' passed</span></div>'+
    '<div class="ft"><span>'+esc($('#dsBy').value||'')+'</span><span>p. 1</span></div></div>';
  $('#dsStack').innerHTML='<div class="ds-pg b3"></div><div class="ds-pg b2"></div><div class="ds-pg">'+pg+'</div>';
}
function sheetOpts(){
  return {name:$('#dsName').value.trim()||'Icing wind tunnel',by:$('#dsBy').value.trim(),org:$('#dsOrg').value.trim(),rev:$('#dsRev').value.trim()||'A',notes:$('#dsNotes').value.trim(),
    inc:Object.fromEntries($$('#dsInc input').map(i=>[i.value,i.checked])),url:shareURL()};
}
function loadScript(src){ return new Promise((res,rej)=>{ if([...document.scripts].some(s=>s.src===src)) return res(); const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=()=>rej(new Error('Could not load '+src)); document.head.appendChild(s); }); }
async function exportPDF(){
  const btn=$('#dsExport'), st=$('#dsStatus'), pr=$('#dsProg'), bar=pr.querySelector('span');
  btn.disabled=true; pr.classList.add('on'); st.textContent='Preparing…'; bar.style.width='8%';
  try{
    await loadScript(new URL('icing/sheet.js',location.href).href);
    await window.IcingSheet.export(Object.assign({},S,{P,FIELDS,GROUPS,PT,TH,helpers:{wallPts,band,pathAt,segAt,vanesAll,ythk,TC,kW,nf,ni,ne,ns}}),sheetOpts(),(f,msg)=>{ bar.style.width=(f*100).toFixed(0)+'%'; if(msg) st.textContent=msg; });
    st.textContent='Saved '+S.id+'.pdf';
  }catch(err){ console.error(err); st.textContent='Export failed: '+(err&&err.message?err.message:err); }
  finally{ btn.disabled=false; setTimeout(()=>{ pr.classList.remove('on'); bar.style.width='0'; },900); }
}

/* ================= toasts on new problems ================= */
let prevSev=null;
function diffAudit(fromEdit){
  const now={}; S.AU.forEach(c=>now[c.id]=c.sev);
  if(prevSev&&fromEdit){
    const rank={ok:0,info:1,warn:2,bad:3}, news=S.AU.filter(c=>(c.sev==='warn'||c.sev==='bad')&&rank[c.sev]>rank[prevSev[c.id]||'ok']);
    const fixed=S.AU.filter(c=>c.sev==='ok'&&prevSev[c.id]&&rank[prevSev[c.id]]>=2);
    news.slice(0,2).forEach(c=>toast(c.sev,c.title,c.val+' · limit '+c.lim,c.id));
    if(!news.length) fixed.slice(0,1).forEach(c=>toast('ok','Resolved: '+c.title,c.val,c.id));
  }
  prevSev=now;
}
function toast(sev,title,sub,id){
  const host=$('#itoasts'); while(host.children.length>=3) host.firstElementChild.remove();
  const el=document.createElement('div'); el.className='itoast sev-'+sev; el.setAttribute('role','status');
  el.innerHTML='<span class="d"></span><div><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></div><button type="button">View</button>';
  el.querySelector('button').addEventListener('click',()=>{ el.remove(); openAudit(id); });
  host.appendChild(el);
  let t=0; const arm=()=>{ t=setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),420); },8000); };
  el.addEventListener('pointerenter',()=>clearTimeout(t)); el.addEventListener('pointerleave',arm); arm();
}
function openAudit(id){
  const c=S.AU.find(x=>x.id===id); if(c&&c.sev==='ok'&&auFilter!=='all'&&auFilter!=='ok'){ auFilter='all'; renderAudit(); }
  if(c&&c.sev!=='ok'&&auFilter!=='issues'&&auFilter!=='all'&&auFilter!==c.sev){ auFilter='issues'; renderAudit(); }
  ctrans('Design audit',c?c.title:'',()=>{ jumpTo('iaudit'); const d=$('#iauList details[data-id="'+id+'"]'); if(d){ d.open=true; setTimeout(()=>{ d.scrollIntoView({block:'center'}); setAuHot(id); },40); } });
}

/* ================= chapters, rail, transitions ================= */
const CH=[{id:'itop',name:'Circuit'},{id:'izoom',name:'Icing close-up'},{id:'iaudit',name:'Design audit'},{id:'iloss',name:'Loss loop'},{id:'igeo',name:'Geometry'},{id:'itherm',name:'Thermal & icing'},{id:'ifan',name:'Fan array'},{id:'isweep',name:'Speed sweep'},{id:'isheet',name:'Datasheet'}];
const PAL={bg:'#03080C',a:'#2C7FAE',b:'#E9FCFF'};
function ctrans(name,eyebrow,action){ if(window.SL&&SL.gust) SL.gust(name,eyebrow,action,PAL); else action(); }
function railH(){ return $('#irail').offsetHeight||50; }
function jumpTo(id){ const el=document.getElementById(id); if(!el) return; const off=(id==='itop'||id==='izoom')?0:railH()+10; window.scrollTo(0,Math.max(0,el.getBoundingClientRect().top+scrollY-off)); }
function goChapter(id){ const i=CH.findIndex(c=>c.id===id); if(i<0) return; ctrans(CH[i].name,'Chapter '+pad2(i+1)+' / '+pad2(CH.length),()=>jumpTo(id)); }
let STX=[], railCh=-1;
function buildRail(){
  $('#irailSvg').innerHTML=unrolledSVG(32,24);
  STX=CH.map((_,i)=>4+92*i/(CH.length-1));
  const tr=$('#irailTrack'); tr.querySelectorAll('.irst').forEach(b=>b.remove());
  CH.forEach((c,i)=>{ const b=document.createElement('button'); b.className='irst'; b.type='button'; b.dataset.igo=c.id; b.style.left=STX[i]+'%'; b.setAttribute('aria-label',c.name); b.innerHTML='<span>'+c.name+'</span>'; tr.appendChild(b); });
}
function updateRail(){
  const y=scrollY+innerHeight*0.3, hero=$('#itop');
  $('#irail').classList.toggle('show',scrollY>hero.offsetHeight*0.55);
  const tops=CH.map(c=>document.getElementById(c.id).getBoundingClientRect().top+scrollY);
  let i=0; for(let k=0;k<tops.length;k++) if(y>=tops[k]) i=k;
  const end=i<tops.length-1?tops[i+1]:document.documentElement.scrollHeight-innerHeight*0.7, f=clamp((y-tops[i])/Math.max(1,end-tops[i]),0,1);
  const x=i<STX.length-1?STX[i]+(STX[i+1]-STX[i])*f:STX[i]+(100-STX[i])*f*0.5;
  $('#irailDot').style.left=x+'%';
  if(i!==railCh){ railCh=i; $('#irailCh').innerHTML='<b>'+pad2(i+1)+'</b> / '+CH[i].name; $$('.irst').forEach((b,k)=>b.classList.toggle('on',k===i)); }
}

/* ================= reveals ================= */
function splitWords(el){ const txt=el.textContent; el.setAttribute('aria-label',txt); el.innerHTML=txt.split(' ').map((w,j)=>'<span class="w" aria-hidden="true"><span class="wi" style="--j:'+j+'">'+w+'</span></span>').join(' '); }
function setupReveals(){
  $$('.isplit',APP).forEach(splitWords);
  const RV=$$('.irv',APP); if(RM.matches||!('IntersectionObserver' in window)) return;
  RV.forEach(el=>{ if(el.getBoundingClientRect().top>innerHeight*0.92) el.classList.add('pre'); });
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.remove('pre'); io.unobserve(e.target); } }),{rootMargin:'0px 0px -10% 0px'});
  RV.forEach(el=>{ if(el.classList.contains('pre')) io.observe(el); });
}

/* ================= dock ================= */
const dV=$('#idV'), dR=$('#idR'), dT=$('#idT');
function syncDock(){ if(document.activeElement!==dV) dV.value=isFinite(P.V)?String(P.V):''; if(isFinite(P.V)) dR.value=clamp(P.V,1,60); if(document.activeElement!==dT) dT.value=isFinite(P.T)?String(P.T):''; }
dR.addEventListener('input',()=>{ P.V=Number(dR.value); dV.value=String(P.V); const i=$('#ii-V'); if(i) i.value=String(P.V); schedule(true); });
dV.addEventListener('input',()=>{ const v=parseNum(dV.value); P.V=v===''?NaN:v; if(isFinite(P.V)) dR.value=clamp(P.V,1,60); const i=$('#ii-V'); if(i) i.value=dV.value; schedule(true); });
dT.addEventListener('input',()=>{ const v=parseNum(dT.value); P.T=v===''?NaN:v; const i=$('#ii-T'); if(i) i.value=dT.value; schedule(true); });
function measureDock(){ document.body.style.setProperty('--idock-h',$('#idock').offsetHeight+'px'); }

/* ================= update ================= */
let pend=false, pendEdit=false, slowT=0, active=false, booted=false;
function schedule(edit){ if(edit) pendEdit=true; if(pend) return; pend=true; requestAnimationFrame(()=>{ pend=false; const e=pendEdit; pendEdit=false; update(e); }); }
function update(fromEdit){
  const errs=validate(P), eh=$('#ierr');
  if(errs.length){ eh.innerHTML='<div class="errbox" role="alert"><b>Calculation paused. Fix the input:</b><ul>'+errs.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul></div>'; return; }
  eh.innerHTML=''; save();
  S=compute();
  const gk=JSON.stringify(FIELDS.filter(f=>!['V','T','p','LWC','MVD','Tlab','RH','etaf','etam','marg','tmarg','Vs','LWCs','leak','psi','nu','fK','mCd','hxdp','hxV','hxn','hxf','elK','spCd','spT','ik','ihi','iho','buz1','fveri'].includes(f.k)).map(f=>P[f.k]));
  if(gk!==update.gk){ update.gk=gk; PT=buildPath(S.R,S.G); LANES=buildLanes(PT,24); [HV,ZV].forEach(v=>{ if(v.gl) v.gl.upload(LANES); }); layoutHero(); layoutZoom(); buildRail(); drops=[]; }
  else { drawBase(HV); drawFallback(HV); }
  renderHero(); renderZoomCards(); renderAudit(); flagFields(); diffAudit(fromEdit);
  clearTimeout(slowT); slowT=setTimeout(()=>{ renderLoss(); blueprint(); renderThermal(); renderFan(); renderSweep(); renderSheet(); },110);
  lastScroll=-1;
}

/* ================= main loop ================= */
let lastT=0, lastScroll=-1, raf=0;
function loop(now){
  raf=0; if(!active) return;
  const dt=Math.min(0.05,(now-(lastT||now))/1000); lastT=now;
  if(S&&PT){
    if(!RM.matches){ if(!rampStart) rampStart=now; ramp=Math.min(1,Math.pow((now-rampStart)/1800,1.6)); simT=(simT+dt*S.R.V*SLOW*ramp)%(PUFF*4000); stepDrops(dt*S.R.V*SLOW*ramp,dt); }
    if(HV.visible&&HV.W&&!document.hidden){ drawGL(HV); drawTop(HV,now); }
    const zp=zoomProgress(); if(zp.inView&&ZV.W) { renderZoom(now); renderIceMeter(); }
  }
  if(scrollY!==lastScroll){ lastScroll=scrollY; updateRail();
    const hh=$('#itop').offsetHeight; if(!RM.matches&&scrollY<hh){ $('#iheroHead').style.transform='translate3d(0,'+(scrollY*0.22).toFixed(1)+'px,0)'; $('#iheroHead').style.opacity=String(clamp(1-scrollY/(hh*0.55),0,1)); } }
  raf=requestAnimationFrame(loop);
}

/* ================= events ================= */
APP.addEventListener('click',e=>{
  const g=e.target.closest('[data-igo]'); if(g){ e.preventDefault(); goChapter(g.dataset.igo); return; }
  const a=e.target.closest('[data-audit]'); if(a){ e.preventDefault(); openAudit(a.dataset.audit); return; }
  const fb=e.target.closest('[data-field]'); if(fb){ e.preventDefault(); goField(fb.dataset.field); return; }
  const fl=e.target.closest('#iauTop [data-f]'); if(fl){ auFilter=fl.dataset.f===auFilter&&['bad','warn','info','ok'].includes(fl.dataset.f)?'issues':fl.dataset.f; renderAudit(); return; }
  const pin=e.target.closest('#iauMap .pin'); if(pin){ const d=$('#iauList details[data-id="'+pin.dataset.id+'"]'); if(d){ d.open=true; d.scrollIntoView({block:'center',behavior:RM.matches?'auto':'smooth'}); setAuHot(pin.dataset.id); } return; }
});
$('#iauList').addEventListener('pointerover',e=>{ const d=e.target.closest('.au-c'); if(d&&d.dataset.id!==auHot) setAuHot(d.dataset.id); });
$('#iauMap').addEventListener('pointerover',e=>{ const p=e.target.closest('.pin'); if(p) setAuHot(p.dataset.id); });
$('#ibtnReset').addEventListener('click',()=>{ const keep={fcQ:P.fcQ,fcdp:P.fcdp,fcrho:P.fcrho,fcname:P.fcname}; P=Object.assign(defaults(),keep); syncInputs(); $$('#igeoGroups .inp').forEach(x=>x.classList.remove('bad')); schedule(true); });
function copyText(txt,el){ const done=()=>{ el.textContent='Copied'; setTimeout(()=>el.textContent='',2200); }; try{ navigator.clipboard.writeText(txt).then(done,()=>{ el.textContent=txt; }); }catch(_){ el.textContent=txt; } }
$('#ibtnShare').addEventListener('click',()=>copyText(shareURL(),$('#ishareStatus')));
$('#dsLink').addEventListener('click',()=>copyText(shareURL(),$('#dsStatus')));
$('#ibtnTsv').addEventListener('click',()=>copyText(TSV.join('\n'),$('#itsvStatus')));
$('#dsExport').addEventListener('click',exportPDF);
['dsName','dsBy','dsRev','dsOrg'].forEach(id=>$('#'+id).addEventListener('input',()=>{ if(S) renderSheet(); try{ localStorage.setItem('smokeline.icing.sheet',JSON.stringify(['dsName','dsBy','dsOrg','dsRev','dsNotes'].map(i=>$('#'+i).value))); }catch(_){} }));
try{ const v=JSON.parse(localStorage.getItem('smokeline.icing.sheet')||'null'); if(Array.isArray(v)) ['dsName','dsBy','dsOrg','dsRev','dsNotes'].forEach((i,k)=>{ if(v[k]) $('#'+i).value=v[k]; }); }catch(_){}
['fcQ','fcdp','fcrho','fcname'].forEach(k=>$('#'+k).addEventListener('input',e=>{ P[k]=k==='fcrho'?(parseNum(e.target.value)||1.394):e.target.value; schedule(false); }));
$('#fcEx').addEventListener('click',()=>{ P.fcQ='0 982 2371 4170 6050 7740 9134 10299 11319 12248 13130'; P.fcdp='1507 1323 1171 1077 1001 887 735 563 380 193 0'; P.fcrho=1.394; P.fcname='candidate curve'; syncInputs(); schedule(false); });
/* hero hover: tooltip + probe cursor via the shared cursor */
function heroMove(e){
  const tip=$('#itTip'); if(!S||!HV||e.target!==HV.cvT){ tip.hidden=true; if(HV&&HV.hot){ HV.hot=null; } return; }
  const h=probe(HV,e.clientX,e.clientY); if(!h){ tip.hidden=true; HV.hot=null; return; }
  HV.hot=h.seg;
  tip.innerHTML='<b>'+h.name+'</b><div class="num">local speed '+nf(h.u,2)+' m/s</div>'+(h.comps.length?'<div class="num">K = '+nf(h.K,4)+' · Δp = '+nf(h.dp,1)+' Pa</div>':'')+'<small>Click for its line in the loss table</small>';
  tip.hidden=false; const tw=tip.offsetWidth, th=tip.offsetHeight; let l=h.px+14; if(l+tw>HV.W) l=h.px-tw-14; let tt=h.py-th-12; if(tt<0) tt=h.py+14;
  tip.style.left=Math.max(0,l)+'px'; tip.style.top=tt+'px';
}
document.addEventListener('pointermove',e=>{ if(active) heroMove(e); });
window.SL_probe=function(t,x,y){
  if(!active||!S) return null;
  if(HV&&t===HV.cvT){ const h=probe(HV,x,y); if(h) return 'u '+nf(h.u,1)+' m/s · '+h.name; }
  if(ZV&&t===ZV.cvT){ const h=probe(ZV,x,y); if(h) return 'u '+nf(h.u,1)+' m/s · '+h.name; }
  return null;
};

/* ================= circuit switch (router) ================= */
const TITLES={open:document.title,closed:'Icing Wind Tunnel Design Calculator | Smokeline – Closed-Circuit Computation Sheet'};
function setSwitches(c){ $$('.cswitch').forEach(sw=>{ sw.dataset.on=c; sw.querySelectorAll('[data-circuit]').forEach(a=>a.setAttribute('aria-selected',String(a.dataset.circuit===c))); }); }
function activate(){
  if(!booted){
    booted=true;
    readTheme();
    HV=makeView($('#itunnel'),'hero'); ZV=makeView($('#izStage'),'zoom');
    HV.cvT.addEventListener('click',e=>{ const h=probe(HV,e.clientX,e.clientY); if(h){ const c=h.comps.slice().sort((a,b)=>b.dp-a.dp)[0]; if(c) ctrans('Loss loop',h.name,()=>{ jumpTo('iloss'); setTimeout(()=>flashRow(c.id),50); }); } });
    buildInputs(); syncInputs(); measureDock();
    update(false); setupReveals();
    new ResizeObserver(()=>{ if(!active) return; measureDock(); const w=innerWidth, h=innerHeight; if(w!==activate.w||Math.abs(h-activate.h)>120){ activate.w=w; activate.h=h; if(PT){ layoutHero(); layoutZoom(); } if(S){ renderLoss(); blueprint(); renderSweep(); renderFan(); } lastScroll=-1; } }).observe(document.body);
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ if(active&&PT){ measureDock(); layoutHero(); layoutZoom(); } });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{ if(active&&S){ readTheme(); renderSweep(); renderLoss(); } });
  } else { readTheme(); measureDock(); if(PT){ layoutHero(); layoutZoom(); } if(S){ renderLoss(); blueprint(); renderSweep(); renderFan(); renderSheet(); } }
  active=true; lastScroll=-1; lastT=0; if(!raf) raf=requestAnimationFrame(loop);
}
function deactivate(){ active=false; if(raf){ cancelAnimationFrame(raf); raf=0; } $('#itTip').hidden=true; }
function show(c,push,anim){
  const go=()=>{
    const was=ROOT.classList.contains('is-closed');
    ROOT.classList.toggle('is-closed',c==='closed'); setSwitches(c); document.title=TITLES[c];
    if(push) history.pushState({c},'',c==='closed'?'#icing':location.pathname+location.search);
    window.scrollTo(0,0);
    if(c==='closed') activate(); else { deactivate(); if(was&&window.SL&&SL.relayout) SL.relayout(); }
    $$('.cswitch').forEach(sw=>{ sw.classList.remove('flash'); void sw.offsetWidth; sw.classList.add('flash'); });
  };
  if(anim&&window.SL&&SL.gust) SL.gust(c==='closed'?'Closed circuit':'Open circuit',c==='closed'?'Icing wind tunnel · single return':'Smoke tunnel · open return',go,c==='closed'?PAL:null); else go();
}
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-circuit]'); if(!a) return;
  e.preventDefault(); const c=a.dataset.circuit, cur=ROOT.classList.contains('is-closed')?'closed':'open';
  if(c!==cur) show(c,true,true);
});
function fromHash(){
  const h=location.hash;
  if(/^#icing/.test(h)){ const q=h.indexOf('?'); if(q>-1){ decodeState(h.slice(q+1)); if(booted){ syncInputs(); schedule(false); } } return 'closed'; }
  return 'open';
}
addEventListener('popstate',()=>{ const c=fromHash(); const cur=ROOT.classList.contains('is-closed')?'closed':'open'; if(c!==cur) show(c,false,false); });
addEventListener('hashchange',()=>{ const c=fromHash(); const cur=ROOT.classList.contains('is-closed')?'closed':'open'; if(c!==cur) show(c,false,false); });
/* ---- boot ---- */
const first=fromHash(); setSwitches(first);
if(first==='closed'){ document.title=TITLES.closed; activate(); }
})();
