/* Smokeline · closed-circuit icing wind tunnel · 1D engine
   Port of kapali_devre_1D.m v1.6 (K. Yılmaz, 2026-11-06): component loss coefficients referred to the
   test-section dynamic pressure, fan power and thermal budget, with
   · v1.5: equivalent cone angle tan θe = (√A2 − √A1)/(√π L) [B p.75/80, E p.xi] for every diffuser,
     shape-dependent K_e (square, round, square↔round), local flat-wall and diagonal angles of the
     square↔round fan transitions, Barlow Fig. 3.9 check of the wide-angle diffuser, Barlow p.101 model allowance;
   · v1.4b: single round fan with hub fairing + straightener and hub closure cone;
   · v1.6: two scenarios (S1, S2), iced loss coefficients from literature factors, brand-independent fan
     requirement with an icing margin λ_fan, and the operating cycle (lumped thermal mass: cool-down, run time,
     de-icing, drain, daily test count).
   On top of that: icing-cloud parameters (Langmuir & Blodgett / Anderson), and the literature design audit shown
   on the page and in the PDF. Lengths are SI (m) inside this file; the page converts its cm / mm inputs. */
(function(){
'use strict';
const D2R=Math.PI/180, tand=d=>Math.tan(d*D2R), atand=x=>Math.atan(x)/D2R;

/* ---------------- references ---------------- */
const REFS={
  B:  {k:'B',  t:'Barlow, J. B., Rae, W. H., Pope, A. (1999). Low-Speed Wind Tunnel Testing, 3rd ed. Wiley. Ch. 3.'},
  E:  {k:'E',  t:'Eckert, W. T., Mort, K. W., Jope, J. (1976). Aerodynamic design guidelines and computer program for estimation of subsonic wind tunnel performance. NASA TN D-8243, App. B.'},
  MB: {k:'MB', t:'Mehta, R. D., Bradshaw, P. (1979). Design rules for small low speed wind tunnels. Aeronautical Journal 83(827), 443–449.'},
  BM: {k:'BM', t:'Bell, J. H., Mehta, R. D. (1988). Contraction design for small low-speed wind tunnels. NASA CR-182747.'},
  BS: {k:'BS', t:'Bansmer, S. E. et al. (2018). Design, construction and commissioning of the Braunschweig Icing Wind Tunnel. Atmos. Meas. Tech. 11, 3221–3249.'},
  O:  {k:'O',  t:'Özkanaktı (2023). PhD thesis, Middle East Technical University (icing wind tunnel design).'},
  LB: {k:'LB', t:'Langmuir, I., Blodgett, K. B. (1946). A mathematical investigation of water droplet trajectories. AAF Tech. Rep. 5418.'},
  AN: {k:'AN', t:'Anderson, D. N. (2004). Manual of Scaling Methods. NASA/CR-2004-212875.'},
  FAA:{k:'FAA',t:'14 CFR Part 25, Appendix C (continuous/intermittent maximum icing) and Appendix O (supercooled large drops).'},
  MG: {k:'MG', t:'Alduchov, O. A., Eskridge, R. E. (1996). Improved Magnus form approximation of saturation vapor pressure. J. Appl. Meteor. 35, 601–609.'},
  NA2:{k:'NA2',t:'Olsen, W., Van Fossen, J., Nussle, R. (1987). Heat exchanger performance in the NASA Icing Research Tunnel under icing. NASA TM-100116.'},
  NO: {k:'NO', t:'Newton, J. E., Olsen, W. (1986). Study of ice accretion on icing wind tunnel components. NASA TM-87095.'}
};

/* ---------------- air ---------------- */
function air(Tc,p){
  const T=Tc+273.15;
  return {T,p,rho:p/(287.058*T),mu:1.716e-5*Math.pow(T/273.15,1.5)*(273.15+110.4)/(T+110.4),
    a:Math.sqrt(1.4*287.058*T),k:0.0241*Math.pow(T/273.15,0.81),cp:1005};
}
/* [B] Eq. 3.14: 1/sqrt(f) = 2 log10(Re sqrt(f)) - 0.8 */
function fPr(Re){ if(Re<2300) return 64/Math.max(Re,1); let f=0.02; for(let k=0;k<30;k++) f=Math.pow(2*Math.log10(Re*Math.sqrt(f))-0.8,-2); return f; }
/* [E] B4-B6 (circular) and B7-B9 (square, original coefficients); p = 2 theta_e [deg] */
function KeDaire(p){
  if(p<3) return 1.033395e-1-1.19465e-2*p;
  if(p<=10) return 1.70925e-1-5.84932e-2*p+8.14936e-3*p*p+1.34777e-4*p**3-5.67258e-5*p**4-4.15879e-7*p**5+2.10219e-7*p**6;
  return -9.66135e-2+2.336135e-2*p;
}
function KeKare(p){
  if(p<3) return 9.62274e-2-2.07582e-3*p;
  if(p<=10) return 1.22156e-1-2.29480e-2*p+5.50704e-3*p*p-4.08644e-4*p**3-3.84056e-5*p**4+8.74969e-6*p**5-3.65217e-7*p**6;
  return -1.321685e-1+2.93315e-2*p;
}
/* Ke_sekil: square ↔ round transitions change both sides at once, [E] B14 with δs = 1 -> mean of the two */
function KeSekil(p,sekil){ return sekil==='daire'?KeDaire(p):sekil==='gecis'?0.5*(KeKare(p)+KeDaire(p)):KeKare(p); }
/* cevre_hesap: wetted perimeter (transitions taken as square, enough for the wall area) */
const perim=(A,sekil)=>sekil==='daire'?Math.PI*Math.sqrt(4*A/Math.PI):4*Math.sqrt(A);
const SQPI=Math.sqrt(Math.PI);
/* sekil39_ARmax: Barlow Fig. 3.9 upper chart (Mehta & Bradshaw 1979), largest area ratio of a wide-angle
   diffuser with n elements (screens) for steady attached flow; digitised from the page, ±0.05. */
const F39X=[16,18,20,22,25,28,30,32,35,38,40,42,45,50,55,65,70];
const F39=[[3.87,2.63,2.19,1.91,1.62,1.41,1.31,1.23,1.14,1.11,1.10,1.10,1.10,1.10,1.10,1.10,1.10],
  [7.0,7.0,7.0,6.06,4.80,3.60,3.12,2.84,2.53,2.32,2.21,2.13,2.04,2.00,2.00,2.00,2.00],
  [7.0,7.0,7.0,7.0,7.0,7.0,7.0,7.0,7.0,6.21,5.44,4.69,4.05,3.51,3.19,2.91,2.90],
  [7.0,7.0,7.0,7.0,7.0,7.0,7.0,7.0,7.0,7.0,7.0,6.22,5.22,4.19,3.72,3.29,3.25]];
function fig39(n,th2){
  const E=F39[Math.min(Math.max(Math.round(n),0),3)], t=Math.min(Math.max(th2,F39X[0]),F39X[F39X.length-1]);
  let i=0; while(i<F39X.length-2&&t>F39X[i+1]) i++;
  return E[i]+(E[i+1]-E[i])*(t-F39X[i])/(F39X[i+1]-F39X[i]);
}
function trapz(x,y){ let s=0; for(let i=1;i<x.length;i++) s+=(x[i]-x[i-1])*(y[i]+y[i-1])/2; return s; }

/* ---------------- circuit (devre_hesapla) ---------------- */
function comp(id,name,key,tip,A1,A2,Dh1,Dh2,L,sekil){ return {id,name,key,tip,A1,A2,Dh1,Dh2,L,sekil:sekil||'kare',par:{},A_q:A1,V:NaN,q:NaN,Re:NaN,K_lok:0,K_ref:0,dp:0}; }
function circuit(G,V,yer,h){
  const rho=h.rho, mu=h.mu, a=G.a, A_TS=a*a, Dh_TS=a, Q=V*A_TS, q_TS=0.5*rho*V*V;
  const s_dn=a*Math.sqrt(G.CR), F=G.fan;
  /* fan section: one round fan of diameter D, carried as the square of equal area (G.fan.w = G.fan.h) */
  const A_fan=F.w*F.h, Dh_fan=2*F.w*F.h/(F.w+F.h), A_fanlar=F.N*Math.PI*F.D*F.D/4;
  /* lengths from the equivalent cone angle, tan θe = (√A2 − √A1)/(√π L)  [B p.75/80, E p.xi] */
  const AR1=G.s12*G.s12/A_TS, L_D1=(G.s12-a)/(SQPI*tand(G.th1));
  const AR3=G.s34*G.s34/A_fan;
  let L_D3=0, L_D3_es=0, L_D3_kos=0;
  if(AR3>1.02){
    L_D3_es=(G.s34-Math.sqrt(A_fan))/(SQPI*tand(G.th3));
    /* round (D) -> square (s34): along the diagonal the radius grows D/2 -> s34/√2; keep that wall ≤ duvar_max */
    L_D3_kos=Math.max(G.s34/Math.SQRT2-F.D/2,G.s34/2-F.D/2)/tand(G.duvar);
    L_D3=Math.max(L_D3_es,L_D3_kos);
  }
  const L_GAD=(s_dn-G.s34)/(SQPI*tand(G.gad2th/2));
  const L_C12=G.H-G.s12, L_C34=G.H-G.s34;
  const L_kap=F.kap?F.L_kap:0, L_kapn=F.kap?F.L_kapn:0;
  const X=G.s34/2+L_GAD+G.L_dn+G.L_c+G.L_TS+L_D1+G.s12/2;
  const L_ust_raw=X-(G.s12/2+G.L_gecis+G.L_fan+L_kap+L_kapn+L_D3+G.s34/2), L_ust=Math.max(0,L_ust_raw);
  const gap=G.H-s_dn/2-Math.max(G.s34,F.w)/2-2*G.ins.t;

  const B=[], add=(...x)=>{ const c=comp(...x); B.push(c); return c; };
  let c;
  add('ts','Test section','test','sabit',A_TS,A_TS,Dh_TS,Dh_TS,G.L_TS);
  c=add('model','Model (2D airfoil)','model','model',A_TS,A_TS,Dh_TS,Dh_TS,0); c.par.S=G.mdl.c*G.mdl.b; c.par.Cd=G.mdl.Cd;
  c=add('d1','First diffuser','diff','difuzor',A_TS,G.s12**2,Dh_TS,G.s12,L_D1); c.lim=3.0;
  c=add('c1','Corner 1','corner','kose',G.s12**2,G.s12**2,G.s12,G.s12,G.s12); c.par.buz=G.buz1;
  add('l12','Duct, corner 1–2','duct','sabit',G.s12**2,G.s12**2,G.s12,G.s12,L_C12);
  if(G.safety){ c=add('safe','Safety screen','set','elek',G.s12**2,G.s12**2,G.s12,G.s12,0); c.par={N:1,dw:1.5e-3,wm:12e-3,Kmesh:1.3}; }
  c=add('c2','Corner 2','corner','kose',G.s12**2,G.s12**2,G.s12,G.s12,G.s12); c.par.buz=1;
  c=add('gec','Fan transition (square → round)','diff','gecis',G.s12**2,A_fan,G.s12,Dh_fan,G.L_gecis,'gecis'); c.lim=3.5;
  c=add('fan','Fan section (single fan, mounting)','fan','fan',A_fan,A_fan,Dh_fan,Dh_fan,G.L_fan); c.par.K=F.K;
  if(F.kap){
    const A_an=A_fan*(1-F.nuk*F.nuk), Dh_an=F.D*(1-F.nuk);
    c=add('kap','Hub fairing + straightener','fan','fan',A_an,A_an,Dh_an,Dh_an,F.L_kap,'daire'); c.par.K=F.Kduz; c.par.A_an=A_an;
    c=add('kapn','Hub closure cone','fan','difuzor',A_an,A_fan,Math.sqrt(4*A_an/Math.PI),F.D,F.L_kapn,'daire'); c.lim=5.0;
  }
  /* fan exit sudden expansion (Borda–Carnot) vanishes: one fan fills its own round duct (A_fanlar = A_fan) */
  if(Math.abs(A_fanlar/A_fan-1)>0.02){ c=add('borda','Fan exit sudden expansion','fan','borda',A_fan,A_fan,Dh_fan,Dh_fan,0); c.par.Af=A_fanlar; }
  if(!(Math.abs(AR3-1)<0.02&&L_D3===0)){ c=add('d3',AR3>1.02?'Return diffuser (round → square)':'Post-fan contraction','diff','difuzor',A_fan,G.s34**2,Dh_fan,G.s34,L_D3,'gecis'); c.lim=3.5; }
  add('ust','Upper return duct','duct','sabit',G.s34**2,G.s34**2,G.s34,G.s34,L_ust);
  c=add('c3','Corner 3','corner','kose',G.s34**2,G.s34**2,G.s34,G.s34,G.s34); c.par.buz=1;
  add('l34','Duct, corner 3–4','duct','sabit',G.s34**2,G.s34**2,G.s34,G.s34,L_C34);
  const A_hx_b=s_dn*s_dn;
  if(yer==='ayri'){ c=add('hx','Heat exchanger','hx','esanjor',G.s34**2,G.s34**2,G.s34,G.s34,0); c.par.der=G.hx.der>0?G.hx.der:A_hx_b/G.s34**2; }
  c=add('c4','Corner 4','corner','kose',G.s34**2,G.s34**2,G.s34,G.s34,G.s34); c.par.buz=1;
  add('gad','Wide-angle diffuser','diff','gad',G.s34**2,s_dn**2,G.s34,s_dn,L_GAD);
  if(yer==='ayri'){
    for(let k=1;k<=G.gel.N;k++){ const xk=k/(G.gel.N+1), sk=G.s34+(s_dn-G.s34)*xk;
      c=add('gs'+k,'WAD screen '+k,'set','elek',sk*sk,sk*sk,sk,sk,0); c.par=Object.assign({},G.gel,{N:1,gad:true}); c.par.xk=xk; }
  } else { c=add('hx','Heat exchanger','hx','esanjor',A_hx_b,A_hx_b,s_dn,s_dn,0); c.par.der=1; c.par.gad=true; }
  add('dn','Settling chamber','set','sabit',A_hx_b,A_hx_b,s_dn,s_dn,G.L_dn);
  c=add('hc','Honeycomb','set','balpetegi',A_hx_b,A_hx_b,s_dn,s_dn,0); c.par=Object.assign({},G.hc);
  for(let k=1;k<=G.el.N;k++){ c=add('sc'+k,'Turbulence screen '+k,'set','elek',A_hx_b,A_hx_b,s_dn,s_dn,0); c.par=Object.assign({},G.el,{N:1}); }
  c=add('sp','Spray bars','spray','sprey',A_hx_b,A_hx_b,s_dn,s_dn,0); c.par=Object.assign({},G.sp,{s:s_dn});
  add('noz','Contraction','noz','daralma',A_hx_b,A_TS,s_dn,Dh_TS,G.L_c);

  let A_duvar=0, hacim=0, Ksum_gad=0;
  const hx={V:NaN,dp:NaN,Kref:0,der:1};
  for(const b of B){
    const V1=Q/b.A1, q1=0.5*rho*V1*V1, Re1=rho*V1*b.Dh1/mu;
    b.V=V1; b.q=q1; b.Re=Re1; b.A_q=b.A1;
    switch(b.tip){
      case 'sabit': b.K_lok=fPr(Re1)*b.L/b.Dh1; break;
      case 'model': {
        const K2=b.par.Cd*b.par.S/b.A1; b.par.K_2D=K2; b.K_lok=K2;
        if(G.mdl.barlow){ /* [B] p.101 model allowance: span 0.8 × tunnel, AR 5, C_D 1.0 */
          const bB=0.8*Math.sqrt(b.A1), KB=1.0*(bB*bB/5)/b.A1; b.par.K_B=KB; b.K_lok=Math.max(K2,KB); }
        break; }
      case 'difuzor': case 'gecis': case 'gad': {
        const AR=b.A2/b.A1;
        if(AR<1.02){
          const Dm=0.5*(b.Dh1+b.Dh2), Am=0.5*(b.A1+b.A2), Vm=Q/Am, f=fPr(rho*Vm*Dm/mu);
          b.A_q=b.A2; b.K_lok=b.L>0?f*b.L/Dm*(b.A2/Am)**2:0; b.par.AR=AR;
        } else {
          const th=Math.atan((Math.sqrt(b.A2)-Math.sqrt(b.A1))/(SQPI*b.L)), f=fPr(Re1);
          const Kf=(1-1/AR**2)*f/(8*Math.sin(th)), Kex=KeSekil(2*th/D2R,b.sekil)*((AR-1)/AR)**2;
          b.K_lok=Kf+Kex; b.par.theta=th/D2R; b.par.AR=AR; b.par.Kf=Kf; b.par.Kex=Kex;
        }
        break; }
      case 'kose': {
        const ch=G.vane_c*b.Dh1, Rec=rho*V1*ch/mu;
        b.K_lok=(0.10+4.55/Math.pow(Math.log10(Rec),2.58))*b.par.buz;
        b.par.c=ch; b.par.Rec=Rec; b.par.n=Math.ceil(Math.SQRT2*b.Dh1/(G.vane_hc*ch))-1;
        break; }
      case 'elek': {
        const p=b.par, beta=(1-p.dw/p.wm)**2, sig=1-beta, Rew=rho*V1*p.dw/mu;
        const KRn=0.785*Math.pow(Rew/241+1,-4)+1.01;                 /* [B] 3.40 */
        b.K_lok=p.Kmesh*KRn*sig+sig*sig/(beta*beta);                 /* [B] 3.37 */
        p.beta=beta; p.Rew=Rew;
        if(p.gad) Ksum_gad+=b.K_lok;
        break; }
      case 'balpetegi': {
        const p=b.par, ReD=rho*V1*p.Delta/mu;
        const lam=ReD<=275?0.375*Math.pow(p.Delta/p.Dh,0.4)*Math.pow(ReD,-0.1):0.214*Math.pow(p.Delta/p.Dh,0.4);
        b.K_lok=lam*(p.L/p.Dh+3)*(1/p.beta)**2+(1/p.beta-1)**2;        /* [B] 3.43 */
        break; }
      case 'esanjor': {
        const dp=G.hx.dp_ref*Math.pow(V1/G.hx.V_ref,G.hx.n)*G.hx.frost*b.par.der;
        b.K_lok=dp/q1; hx.V=V1; hx.dp=dp; hx.der=b.par.der;
        if(b.par.gad) Ksum_gad+=b.K_lok;
        break; }
      case 'sprey': b.par.sig=b.par.N*b.par.d/b.par.s; b.K_lok=b.par.Cd*b.par.sig; break;
      case 'fan': b.K_lok=b.par.K; break;
      case 'borda': b.K_lok=(b.A1/b.par.Af-1)**2; break;
      case 'daralma': {
        const f1=fPr(Re1), f2=fPr(rho*(Q/b.A2)*b.Dh2/mu);
        b.A_q=b.A2; b.K_lok=0.32*0.5*(f1+f2)*b.L/b.Dh2;              /* [B] Wattendorf */
        break; }
    }
    b.K_ref=b.K_lok*(A_TS/b.A_q)**2; b.dp=b.K_ref*q_TS;
    if(b.L>0){ A_duvar+=0.5*(perim(b.A1,b.sekil)+perim(b.A2,b.sekil))*b.L; hacim+=0.5*(b.A1+b.A2)*b.L; }
    if(b.tip==='esanjor') hx.Kref=b.K_ref;
  }
  const K_ham=B.reduce((s,b)=>s+b.K_ref,0), K_top=K_ham*G.leak, dp_top=K_top*q_TS;
  const P_hava=dp_top*Q, P_mil=P_hava/G.eta_fan, P_elek=P_mil/G.eta_m, P_jet=0.5*rho*V**3*A_TS;
  /* wide-angle diffuser: [MB]/[B] 3.42 resistance, and Barlow Fig. 3.9 element count (2θ: the larger of the
     equivalent and the flat-wall angle, conservative for a square section) */
  const AR_gad=s_dn*s_dn/(G.s34*G.s34), nG=yer==='ayri'?G.gel.N:1;
  const th2_duv=2*atand((s_dn-G.s34)/2/L_GAD), th2=Math.max(G.gad2th,th2_duv);
  const gad={Kgerek:(AR_gad-1)/1.14,Ksum:Ksum_gad,AR:AR_gad,n:nG,th2_es:G.gad2th,th2_duv,th2,ARmax:fig39(nG,th2)};
  const AR_klasik=(G.s12**2/A_TS)*(G.s34**2/A_fan)*(A_fan/G.s12**2);
  /* local wall angles of the square <-> round transitions: flat wall s/2 <-> D/2, diagonal s/√2 <-> D/2 */
  const rD=F.D/2;
  const fanAng={gec_duz:atand((rD-G.s12/2)/G.L_gecis),gec_kos:atand((rD-G.s12/Math.SQRT2)/G.L_gecis),
    d3_duz:L_D3>0?atand((G.s34/2-rD)/L_D3):NaN,d3_kos:L_D3>0?atand((G.s34/Math.SQRT2-rD)/L_D3):NaN,
    L_D3_es,L_D3_kos,d3_byWall:L_D3_kos>L_D3_es};

  /* contraction profile, 5th-order polynomial ([O] Eq. 138), and spray -> leading-edge travel time */
  const xs=[], yc=[], inv=[];
  for(let i=0;i<=100;i++){ const x=G.L_c*i/100, s=x/G.L_c, y=s_dn/2-(s_dn/2-a/2)*(6*s**5-15*s**4+10*s**3); xs.push(x); yc.push(y); inv.push(((2*y)**2)/Q); }
  const t_kalis=trapz(xs,inv)+G.mdl.x/V;

  /* fan sizing estimate (pressure coefficient ψ, margin included) */
  const V_fc=Q/A_fanlar, U_uc=Math.sqrt(2*dp_top*G.marg/(rho*F.psi));
  const fan={ncol:1,nrow:1,q_tek:Q/F.N,V_cikis:V_fc,V_sec:Q/A_fan,oran:A_fanlar/A_fan,
    U_uc,n_rpm:60*U_uc/(Math.PI*F.D),c_ax:(Q/F.N)/(Math.PI/4*F.D*F.D*(1-F.nu*F.nu))};
  fan.phi=fan.c_ax/U_uc; fan.M_uc=U_uc/h.a;
  const kb=B.find(b=>b.id==='kap'); if(kb) fan.V_an=kb.V;

  const geo={a,s12:G.s12,s34:G.s34,s_dn,fan_w:F.w,fan_h:F.h,fan_N:F.N,fan_D:F.D,fan_ncol:1,fan_nrow:1,
    L_TS:G.L_TS,L_D1,L_C12,L_gecis:G.L_gecis,L_fan:G.L_fan,L_kap,L_kapn,L_D3,L_ust,L_ust_raw,L_C34,L_GAD,L_dn:G.L_dn,L_c:G.L_c,
    H:G.H,X_alt:X,yer,gap,AR1,AR3};
  geo.boy=X+G.s34/2+G.s12/2; geo.en=G.H+s_dn/2+Math.max(G.s34,F.w)/2;
  return {V,Q,q_TS,A_TS,rho,mu,h,bil:B,K_ham,K_top,dp_top,P_hava,P_mil,P_elek,P_jet,ER:P_jet/P_hava,lambda:P_mil/P_jet,
    yer,hx,gad,AR_klasik,fanAng,A_duvar,hacim,prof:{x:xs,y:yc},t_kalis,fan,geo,M:V/h.a,mdot:rho*Q,
    Re:rho*V*a/mu};
}

/* ---------------- thermal budget (isil_butce) ---------------- */
function thermal(R,G,LWC,h){
  const T=h.T-273.15, o={};
  o.fan=R.P_mil;
  o.motor=G.motorIn?R.P_mil*(1/G.eta_m-1):0;
  o.U=1/(1/G.ins.hi+G.ins.t/G.ins.k+1/G.ins.ho);
  o.duvar=o.U*R.A_duvar*(G.Tlab-T);
  const m_su=LWC*1e-3*R.Q;
  o.m_su=m_su;
  o.sprey=m_su*(4183*(G.sp.Tw-0)+334e3+2050*(0-T));
  o.top=o.fan+o.motor+o.duvar+o.sprey; o.sec=o.top*G.tmarg;
  return o;
}

/* ---------------- icing cloud + surface checks (web additions) ---------------- */
function icing(R,G,h){
  const T=h.T-273.15, V=R.V, o={};
  o.Tstag=T+V*V/(2*h.cp);
  o.water_Lh=G.LWC*1e-3*V*R.A_TS*3600;                 /* kg/h = L/h */
  o.perNoz=o.water_Lh/G.sp.Nn;
  /* Langmuir & Blodgett modified inertia parameter at the stagnation line, with Anderson's
     leading-edge-diameter length scale (NACA 00xx, r_LE = 1.1019 (t/c)^2 c, t/c = 0.12 assumed) */
  const tc=0.12, dLE=2*1.1019*tc*tc*G.mdl.c, d=G.MVD*1e-6;
  const K=1000*d*d*V/(18*dLE*h.mu), Red=h.rho*V*d/h.mu, ll=1/(0.8388+0.001483*Red+0.1847*Math.sqrt(Red));
  const K0=0.125+ll*(K-0.125), k8=Math.max(0,K0-0.125), b0=1.40*Math.pow(k8,0.84)/(1+1.40*Math.pow(k8,0.84));
  Object.assign(o,{dLE,K,Red,ll,K0,beta0:b0});
  o.rate=b0*G.LWC*1e-3*V/917;                           /* rime, freezing fraction 1 [m/s] */
  o.rate_mm_min=o.rate*1000*60;
  o.regime=T>0?'none':o.Tstag>0?'none':o.Tstag>-10?'glaze':'rime';
  /* droplet thermal relaxation, Nu = 2 (kapali_devre_1D.m §7) */
  const tau=dm=>1000*4183*(dm*1e-6)**2/(6*h.k*2);
  o.drops=[15,20,30,50,100].concat(G.MVD).filter((v,i,a)=>a.indexOf(v)===i).sort((x,y)=>x-y)
    .map(dm=>({d:dm,tau:tau(dm),r:R.t_kalis/tau(dm),rem:Math.exp(-R.t_kalis/tau(dm))}));
  o.rem50=Math.exp(-R.t_kalis/tau(50)); o.remMVD=Math.exp(-R.t_kalis/tau(G.MVD));
  /* outer skin vs lab dew point (Magnus, Alduchov & Eskridge) */
  const U=1/(1/G.ins.hi+G.ins.t/G.ins.k+1/G.ins.ho), qf=U*(G.Tlab-T);
  o.Tskin=G.Tlab-qf/G.ins.ho; o.qwall=qf;
  const gm=Math.log(Math.max(1e-6,G.RH/100))+17.625*G.Tlab/(243.04+G.Tlab);
  o.Tdew=243.04*gm/(17.625-gm);
  o.Tevap=T-G.ops.dTy;                                 /* secondary fluid ([BS]: air −20, fluid −32 °C) */
  return o;
}

/* ---------------- monotone cubic (pchip) for fan curves ---------------- */
function pchip(x,y){
  const n=x.length, h=[], d=[], m=new Array(n).fill(0);
  for(let i=0;i<n-1;i++){ h[i]=x[i+1]-x[i]; d[i]=(y[i+1]-y[i])/h[i]; }
  if(n===2){ m[0]=m[1]=d[0]; }
  else {
    for(let i=1;i<n-1;i++){ if(d[i-1]*d[i]<=0) m[i]=0; else { const w1=2*h[i]+h[i-1], w2=h[i]+2*h[i-1]; m[i]=(w1+w2)/(w1/d[i-1]+w2/d[i]); } }
    const end=(h0,h1,d0,d1)=>{ let v=((2*h0+h1)*d0-h0*d1)/(h0+h1); if(Math.sign(v)!==Math.sign(d0)) v=0; else if(Math.sign(d0)!==Math.sign(d1)&&Math.abs(v)>Math.abs(3*d0)) v=3*d0; return v; };
    m[0]=end(h[0],h[1],d[0],d[1]); m[n-1]=end(h[n-2],h[n-3],d[n-2],d[n-3]);
  }
  return t=>{
    let i=0; while(i<n-2&&t>x[i+1]) i++;
    const s=(t-x[i])/h[i], s2=s*s, s3=s2*s;
    return (2*s3-3*s2+1)*y[i]+(s3-2*s2+s)*h[i]*m[i]+(-2*s3+3*s2)*y[i+1]+(s3-s2)*h[i]*m[i+1];
  };
}
/* fan_rapor: operating point of N identical fans in parallel on dp = k Q^2 */
function fanPoint(R,G,curve){
  if(!curve||curve.Q.length<2) return null;
  const f=pchip(curve.Q,curve.dp), qmax=Math.max(...curve.Q), sc=R.rho/curve.rho, n=4001, k=R.dp_top/(R.Q*R.Q);
  const Qt=[], dpf=[]; let idx=-1;
  for(let i=0;i<n;i++){ const qf=qmax*i/(n-1), dp=f(qf)*sc, Q=G.fan.N*qf/3600; Qt.push(Q); dpf.push(dp); if(idx<0&&dp-k*Q*Q<=0) idx=i; }
  if(idx<0) idx=n-1;
  const o={Q:Qt,dp:dpf,Q_cn:Qt[idx],dp_cn:dpf[idx],q_fan:qmax*idx/(n-1),V_cn:Qt[idx]/R.A_TS};
  const need=R.dp_top*G.marg; o.need=need; o.maxdp=Math.max(...dpf);
  if(o.maxdp>=need){ let j=0; while(j<n-1&&dpf[j]>need) j++; o.q_need=qmax*j/(n-1); o.nEq=3600*R.Q/Math.max(1e-9,o.q_need); }
  return o;
}

/* ---------------- datasheet geometry table (veri_sayfasi) ---------------- */
function geometryTable(R){
  const g=R.geo, Q=R.Q;
  const d3=g.L_D3>0&&(g.s34**2>g.fan_w*g.fan_h*1.02)?'Return diffuser':'Post-fan contraction';
  const T=[
    ['Test section',[g.a,g.a],[g.a,g.a],g.L_TS,'Lower (test) leg','ts'],
    ['First diffuser',[g.a,g.a],[g.s12,g.s12],g.L_D1,'Lower (test) leg','d1'],
    ['Corner 1 (90°)',[g.s12,g.s12],[g.s12,g.s12],g.s12,'Corner','c1'],
    ['Duct, corner 1–2',[g.s12,g.s12],[g.s12,g.s12],g.L_C12,'Right short leg','l12'],
    ['Corner 2 (90°)',[g.s12,g.s12],[g.s12,g.s12],g.s12,'Corner','c2'],
    ['Fan transition (square → round)',[g.s12,g.s12],[g.fan_w,g.fan_h],g.L_gecis,'Upper (return) leg','gec'],
    ['Fan section (Ø'+(g.fan_D*100).toFixed(0)+' cm round)',[g.fan_w,g.fan_h],[g.fan_w,g.fan_h],g.L_fan,'Upper (return) leg','fan'],
    ['Hub fairing + straightener',[g.fan_w,g.fan_h],[g.fan_w,g.fan_h],g.L_kap,'Upper (return) leg','kap'],
    ['Hub closure cone',[g.fan_w,g.fan_h],[g.fan_w,g.fan_h],g.L_kapn,'Upper (return) leg','kapn'],
    [d3+(d3==='Return diffuser'?' (round → square)':''),[g.fan_w,g.fan_h],[g.s34,g.s34],g.L_D3,'Upper (return) leg','d3'],
    ['Upper return duct',[g.s34,g.s34],[g.s34,g.s34],g.L_ust,'Upper (return) leg','ust'],
    ['Corner 3 (90°)',[g.s34,g.s34],[g.s34,g.s34],g.s34,'Corner','c3'],
    ['Duct, corner 3–4',[g.s34,g.s34],[g.s34,g.s34],g.L_C34,'Left short leg','l34'],
    ['Corner 4 (90°)',[g.s34,g.s34],[g.s34,g.s34],g.s34,'Corner','c4'],
    ['Wide-angle diffuser',[g.s34,g.s34],[g.s_dn,g.s_dn],g.L_GAD,'Lower (test) leg','gad'],
    ['Settling chamber',[g.s_dn,g.s_dn],[g.s_dn,g.s_dn],g.L_dn,'Lower (test) leg','dn'],
    ['Contraction (nozzle)',[g.s_dn,g.s_dn],[g.a,g.a],g.L_c,'Lower (test) leg','noz']
  ].filter(r=>!(r[3]===0&&!/Corner/.test(r[0])&&r[1][0]===r[2][0]&&r[1][1]===r[2][1]));
  /* distance from the axis to the flat wall and to the diagonal edge of a section end; the round fan end
     (carried as the equal-area square g.fan_w) is taken with its true diameter (yaricap_uc) */
  const rad=W=>Math.abs(W-g.fan_w)<1e-9?[g.fan_D/2,g.fan_D/2]:[W/2,W/Math.SQRT2];
  let xx=0;
  return T.map((r,i)=>{
    const [W1,H1]=r[1], [W2,H2]=r[2], L=r[3], A1=W1*H1, A2=W2*H2, AR=A2/A1, Dh1=2*A1/(W1+H1), Dh2=2*A2/(W2+H2);
    let thE=NaN, thY=NaN, thD=NaN;
    if(L>0&&!/Corner/.test(r[0])){ const r1=rad(W1), r2=rad(W2); thY=atand((r2[0]-r1[0])/L); thD=atand((r2[1]-r1[1])/L);
      if(AR>1.02) thE=atand((Math.sqrt(A2)-Math.sqrt(A1))/(SQPI*L)); }
    const o={no:i+1,name:r[0],leg:r[4],id:r[5],W1,H1,W2,H2,A1,A2,AR,L,Dh1,Dh2,thE,thY,thD,V1:Q/A1,V2:Q/A2,x0:xx};
    xx+=L; o.x1=xx; return o;
  });
}

/* ---------------- speed sweep ---------------- */
function sweep(G,yer,h,Vmax){
  const out=[];
  for(let V=5;V<=Vmax+1e-9;V+=5){ const r=circuit(G,V,yer,h); out.push({V,Q:r.Q,K:r.K_top,dp:r.dp_top,Pm:r.P_mil,Pe:r.P_elek,ER:r.ER,r}); }
  return out;
}

/* ================ v1.6: scenarios, iced K, fan requirement, operating cycle ================ */
/* scenario list: S1 = second point (G.Vs), S2 = design point (V); both at the static temperature T */
function scenarios(G,V,yer,h,R){
  const s1={id:'S1',name:'S1 · '+(+G.Vs.toFixed(1))+' m/s',V:G.Vs,Tc:G.Tc,h,yer,R:circuit(G,G.Vs,yer,h)};
  const s2={id:'S2',name:'S2 · '+(+V.toFixed(1))+' m/s',V,Tc:G.Tc,h,yer,R:R||circuit(G,V,yer,h)};
  return [s1,s2];
}
/* buz_durumlari: circuit loss once ice has built up, from literature factors.
   [NO] NASA TM-87095 corner-1 vanes K ×1.5 after 10 min spray, ×5.4 severe; [NA2] NASA TM-100116 IRT coil Δp
   "nearly tripled"; [B] p.101 diffuser stall behind a 2D model: up to 150% more power. λ = Δp / Δp_design. */
function iced(G,s){
  const Z=G.buz, R0=s.R, f=x=>+x.toFixed(2);
  const S=[
    {id:'dry',name:'Dry, fully clean circuit',hx:1,c1:1,ls:1,refs:[]},
    {id:'design',name:'Design (corner 1 ×'+f(G.buz1)+', clean coil)',hx:1,c1:G.buz1,ls:1,refs:['NO']},
    {id:'hx',name:'Coil Δp ×'+f(Z.hx),hx:Z.hx,c1:G.buz1,ls:1,refs:['NA2']},
    {id:'c1',name:'Corner 1 K ×'+f(Z.c1),hx:1,c1:Z.c1,ls:1,refs:['NO']},
    {id:'both',name:'Coil ×'+f(Z.hx)+' + corner 1 ×'+f(Z.c1),hx:Z.hx,c1:Z.c1,ls:1,refs:['NA2','NO']},
    {id:'stall',name:'2D model, diffuser stall: power ×'+f(Z.stall),hx:1,c1:G.buz1,ls:Z.stall,refs:['B']}];
  return S.map(o=>{
    const Gs=Object.assign({},G,{buz1:o.c1,hx:Object.assign({},G.hx,{frost:G.hx.frost*o.hx})}), r=circuit(Gs,s.V,s.yer,s.h);
    const K=r.K_top*o.ls, dp=r.dp_top*o.ls, lam=dp/R0.dp_top;
    return Object.assign(o,{K,dp,lam,Khx:r.hx.Kref,P:dp*r.Q/G.eta_fan,ok:lam<=Z.lamF+1e-9});
  });
}
/* fan_gereksinim: brand-independent fan requirement, the sheet to send to vendors */
function fanReq(G,SN){
  return SN.map(s=>{ const R=s.R, Pm0=R.dp_top*R.Q/G.eta_fan, PmL=G.buz.lamF*Pm0;
    return {id:s.id,name:s.name,V:s.V,Tc:s.Tc,rho:R.rho,Q:R.Q,dp0:R.dp_top,dpL:G.buz.lamF*R.dp_top,Pm0,PmL,motor:1.15*PmL,PeL:PmL/G.eta_m,
      Vfan:R.Q/(G.fan.w*G.fan.h),pf:PmL/R.P_jet}; });
}
/* isletme_cevrimi helpers. Lumped thermal mass C dT/dt = −Q_cool(T) + P_fan + UA (T_lab − T) + Q_spray,
   Q_cool(T) = min(Q_cap, Q_cap (T − T_fluid)/ΔT_y), T_fluid = T_target − ΔT_y. */
function sogut(T0,Th,Qk,Pf,UA,C,dTy,tol,Tlab,rec){
  const Ta=Th-dTy, dt=5, te=[0], Te=[T0]; let t=0, T=T0;
  if(Qk<=Pf+UA*(Tlab-(Th+tol))) return {t:Infinity,ok:false,te,Te};
  while(T>Th+tol){
    const Qs=Math.min(Qk,Qk*(T-Ta)/dTy), Qn=Qs-Pf-UA*(Tlab-T);
    if(Qn<=0||t>48*3600) return {t:Infinity,ok:false,te,Te};
    T-=Qn*dt/C; t+=dt; if(rec&&Math.round(t/dt)%24===0){ te.push(t); Te.push(T); }
  }
  te.push(t); Te.push(T); return {t,ok:true,te,Te};
}
/* isit: C dT/dt = P_in + UA (T_lab − T), T0 -> T1 (closed form) */
function isit(T0,T1,C,Pin,UA,Tlab){ const a=UA/C, Teq=Tlab+Pin/UA; if(T1>=Teq) return Infinity; return -Math.log((Teq-T1)/(Teq-T0))/a; }
/* dren: gravity drain (Torricelli, C_d 0.6, constant head) + run-off allowance [s] */
function dren(m,O){ const Qd=O.n_drain*0.6*(Math.PI/4*O.d_drain**2)*Math.sqrt(2*9.81*O.h_drain); return (m/1000)/Qd+O.t_suz*60; }
/* deney_sim: one spray run. The coil blocks as ice builds up on its first rows:
   b(t) = 2 δ(t)/(pitch − t_fin), Δp_hx = Δp_hx,0/(1 − b)^n  ->  K(t) = K_0 + K_hx,0 [(1 − b)^−n − 1].
   The run ends at λ ≥ λ_fan (fan cannot hold the speed), b ≥ b_max, a temperature drift ≥ ΔT_allow, or t_max. */
function deney(G,s,LWC,f,kose,Qk,C,UA,fm){
  const O=G.ops, Th=s.Tc, Rk=circuit(Object.assign({},G,{buz1:kose}),s.V,s.yer,s.h);
  const K0=s.R.K_top, Kc=Rk.K_top, Khx=Rk.hx.Kref*G.leak, sd=Rk.geo.s_dn, A_y=2*(sd/O.hatve)*sd*O.L_buz;
  const md=LWC*1e-3*s.V*Rk.A_TS, db=2*f*md/(O.rho_buz*A_y)/(O.hatve-O.t_kanat);
  const qQ=Rk.q_TS*Rk.Q, Qsp=md*(4183*G.sp.Tw+334e3+2050*(0-Th)), dt=10;
  let t=0, T=Th, Et=O.E_tampon, why='', b=0, lam=1;
  const ts=[], lams=[], Ts=[];
  for(;;){
    b=db*t; lam=(Kc+Khx*(Math.pow(1-b,-O.n_tik)-1))/K0;
    if(Math.round(t/dt)%3===0){ ts.push(t); lams.push(lam); Ts.push(T); }
    if(lam>=G.buz.lamF){ why='lamF'; break; }
    if(b>=O.b_max){ why='bmax'; break; }
    if(T-Th>=O.dT_izin){ why='dT'; break; }
    if(t>=O.t_max*60){ why='tmax'; break; }
    const K=lam*K0, Pf=K*qQ/G.eta_fan*fm; let fz=Pf+UA*(G.Tlab-T)+Qsp-Qk;
    if(fz>0&&Et>0){ const d=Math.min(Et,fz*dt); Et-=d; fz-=d/dt; }
    T=fz>0?T+fz*dt/C:Math.max(Th,T+fz*dt/C); t+=dt;
  }
  const Kf=tt=>{ const bb=db*tt; return bb>=0.98?NaN:Kc+Khx*(Math.pow(1-bb,-O.n_tik)-1); };
  return {t,why,lam,b,K0,Kc,Kf,ts,lams,Ts,db};
}
const WHY={lamF:'fan margin λ_fan used up',bmax:'coil blocked (b_max)',dT:'temperature drift (cooling too small)',tmax:'table limit'};
function ops(G,SN){
  const O=G.ops, Z=O.coz, U=1/(1/G.ins.hi+G.ins.t/G.ins.k+1/G.ins.ho), R1=SN[0].R, UA=U*R1.A_duvar;
  const Cb={shell:O.rho_ic*O.t_ic*R1.A_duvar*O.c_ic, ins:O.f_yal*G.ins.t*R1.A_duvar*O.rho_yal*O.c_yal,
    hx:O.m_hx*O.c_hx+O.V_sivi*O.rho_sivi*O.c_sivi, inner:O.m_ic*O.c_icd, air:R1.hacim*SN[0].h.rho*1005};
  const C=Cb.shell+Cb.ins+Cb.hx+Cb.inner+Cb.air, fm=G.motorIn?1/G.eta_m:1, Qk=O.Q_sec;
  /* 1) steady refrigeration load at the target temperature */
  const load=SN.map(s=>{ const R=s.R, Pf0=R.P_mil*fm, PfL=G.buz.lamF*Pf0, Qd=UA*(G.Tlab-s.Tc);
    return [0].concat(O.LWC).map(L=>{ const md=L*1e-3*R.Q, Qsp=md*(4183*G.sp.Tw+334e3+2050*(0-s.Tc)); return {LWC:L,Pf0,PfL,Qd,Qsp,tot:Pf0+Qd+Qsp,totL:PfL+Qd+Qsp}; }); });
  /* 2) initial cool-down from the lab temperature; the moisture of the loop air freezes out on the coil once */
  const E_nem=(R1.hacim*1.2*O.w0)*(2.501e6+334e3);
  const cool=SN.map(s=>{ const Pf=circuit(G,O.V_sog,s.yer,s.h).P_mil*fm, Ceff=C+E_nem/(G.Tlab-s.Tc);
    return O.Q_kap.map(q=>Object.assign({Qk:q},sogut(G.Tlab,s.Tc,q,Pf,UA,Ceff,O.dTy,O.tol,G.Tlab,true))); });
  /* 3) run time with the spray on: nominal (coil holds f_nom of the water, corner 1 design factor) and
        worst (coil holds all of it, corner 1 severe factor from the start) */
  const run=SN.map(s=>O.LWC.map(L=>({LWC:L,nom:deney(G,s,L,O.f_su[0],G.buz1,Qk,C,UA,fm),worst:deney(G,s,L,O.f_su[1],G.buz.c1,Qk,C,UA,fm)})));
  /* 4) de-icing + drain + re-cooling, and the number of runs in a working day.
        A: whole tunnel warmed to T_end by an air heater (+ fan, walls). B: coil defrost only (corner/wall ice stays). */
  const t_sp=10*60;
  const cyc=SN.map((s,j)=>{
    const Th=s.Tc, Pf_sog=circuit(G,O.V_sog,s.yer,s.h).P_mil*fm, Pf_coz=circuit(G,Z.V_fan,s.yer,s.h).P_mil*fm;
    const ilk=sogut(G.Tlab,Th,Qk,Pf_sog,UA,C,O.dTy,O.tol,G.Tlab);
    return run[j].map(rr=>{
      const tsp=Math.min(rr.nom.t,t_sp), m_su=rr.LWC*1e-3*s.R.Q*tsp, m_hx=O.f_su[0]*m_su;
      const Pin=Z.P_isit+Pf_coz;
      const t1=isit(Th,0,C+m_su*2050,Pin,UA,G.Tlab), t2=m_su*334e3/(Pin+UA*(G.Tlab-0)), t3=isit(0,Z.T_son,C+m_su*4183,Pin,UA,G.Tlab);
      const tA=t1+t2+t3, tdA=dren(m_su,Z), sA=sogut(Z.T_son,Th,Qk,Pf_sog,UA,C,O.dTy,O.tol,G.Tlab);
      const Chx=Cb.hx, Cr=C-Chx, EB=Chx*(Z.T_son-Th)+m_hx*(2050*(0-Th)+334e3+4183*Z.T_son), tB=EB/(Z.eta_def*Z.P_def);
      const dTr=((1-Z.eta_def)*EB+UA*(G.Tlab-Th)*tB)/Cr, tdB=dren(m_hx,Z), Qn=Qk-Pf_sog-UA*(G.Tlab-Th);
      const tsB=Qn>0?(Chx*(Z.T_son-Th)+Cr*dTr)/Qn:Infinity;
      const AT=sA.ok?(tA+tdA+sA.t)/60:Infinity, BT=(tB+tdB+tsB)/60;
      let cA=NaN, cB=NaN, nA=0, nB=0;
      if(ilk.ok){ const kalan=O.t_gun*60-ilk.t/60; cA=tsp/60+AT+Z.t_hazir; cB=tsp/60+BT+Z.t_hazir;
        nA=isFinite(cA)?Math.max(0,Math.floor((kalan+sA.t/60)/cA)):0; nB=isFinite(cB)?Math.max(0,Math.floor((kalan+tsB/60)/cB)):0; }
      return {LWC:rr.LWC,tsp,m_su,m_hx,A:{coz:tA,dren:tdA,sog:sA.t,tot:AT},B:{coz:tB,dren:tdB,sog:tsB,tot:BT,dT:dTr},ilk:ilk.t,ilkOk:ilk.ok,cA,nA,cB,nB};
    });
  });
  return {C,Cb,UA,E_nem,fm,Qk,load,cool,run,cyc};
}

/* ---------------- design audit ----------------
   Every check: {id, sev: ok|info|warn|bad, cat, title, where (path id), val, lim, msg, fix, refs[], fields[], gauge}
   gauge: {v, lo, hi, zones:[[from,to,sev],...], fmt} drawn as a scale with the current value marked. */
function audit(R,G,h,IC){
  /* IC: icing() output; v1.6 icing margin and cooling checks below compute what they need from R, G, h */
  const C=[], g=R.geo, B=R.bil, by=id=>B.find(b=>b.id===id);
  const nf=(x,d)=>isFinite(x)?x.toFixed(d):'—';
  const add=o=>{ C.push(Object.assign({refs:[],fields:[],cat:'Flow'},o)); };

  /* ---- separation: diffusers ---- */
  const d1=by('d1');
  if(d1&&d1.par.theta!=null){ const t=d1.par.theta;
    add({id:'d1',cat:'Separation',where:'d1',sev:t<=3+1e-9?'ok':t<=5?'warn':'bad',title:'First diffuser cone angle',
      val:'θe = '+nf(t,2)+'°',lim:'≤ 3.0°',
      msg:t<=3+1e-9?'Equivalent cone half-angle within the attached-flow limit; AR = '+nf(d1.par.AR,2)+', L = '+nf(d1.L,2)+' m.'
        :t<=5?'Above 3° the boundary layer in a conical diffuser is close to separation; losses rise steeply and the flow into corner 1 becomes unsteady.'
        :'Beyond ~5° the diffuser is in transitory stall: the core flow detaches from one wall, corner 1 sees a skewed, pulsating inflow.',
      fix:'Lower θe or the corner-1 size s₁₂; the diffuser length follows from θe automatically.',
      refs:['B','E'],fields:['th1','s12'],gauge:{v:t,lo:0,hi:7,zones:[[0,3,'ok'],[3,5,'warn'],[5,7,'bad']],u:'°'}});
  }
  const gec=by('gec');
  if(gec&&gec.par.theta!=null){ const t=gec.par.theta;
    add({id:'gec',cat:'Separation',where:'gec',sev:t<=3.5+1e-9?'ok':t<=5?'warn':'bad',title:'Fan transition: equivalent cone angle',
      val:'θe = '+nf(t,2)+'°',lim:'≤ 3.5°',
      msg:'Square '+nf(g.s12*100,0)+' cm → round Ø'+nf(g.fan_D*100,0)+' cm over '+nf(g.L_gecis,2)+' m (AR '+nf(gec.par.AR,2)+'). The fan must see attached, uniform inflow.',
      fix:'Lengthen the transition or bring the fan diameter closer to the corner-2 size.',
      refs:['B','E'],fields:['Lgec','fD','s12'],gauge:{v:t,lo:0,hi:7,zones:[[0,3.5,'ok'],[3.5,5,'warn'],[5,7,'bad']],u:'°'}});
  }
  { const A=R.fanAng, w=Math.max(A.gec_duz,A.gec_kos), lim=G.duvar;
    add({id:'gecw',cat:'Separation',where:'gec',sev:w<=lim+1e-9?'ok':w<=lim+2?'warn':'bad',title:'Fan transition: local wall angles',
      val:'flat wall '+nf(A.gec_duz,1)+'°, diagonal '+nf(A.gec_kos,1)+'°',lim:'≤ '+nf(lim,1)+'° each',
      msg:w<=lim+1e-9?'Square to round: the flat walls open from s/2 to D/2 while the corners close in from s/√2 to D/2. Both stay gentle. An equivalent cone angle alone hides this difference.'
        :'One wall of the square-to-round transition opens faster than the limit; a 2D CFD study for this project separated at 2θ = 12.8°, and Barlow notes 10–12° effective expansion separates behind a hub.',
      fix:'Lengthen the fan transition.',refs:['B'],fields:['Lgec','fD','duvar'],gauge:{v:w,lo:0,hi:10,zones:[[0,lim,'ok'],[lim,lim+2,'warn'],[lim+2,10,'bad']],u:'°'}});
  }
  const kn=by('kapn');
  if(kn&&kn.par.theta!=null){ const t=kn.par.theta;
    add({id:'kapn',cat:'Separation',where:'kapn',sev:t<=5+1e-9?'ok':t<=7?'warn':'bad',title:'Hub closure cone',val:'θe = '+nf(t,2)+'°',lim:'≤ 5°',
      msg:'Behind the straightener the enlarged hub ('+nf(G.fan.nuk,2)+' D) closes over '+nf(kn.L,2)+' m and the annulus opens back to the full Ø'+nf(g.fan_D*100,0)+' cm. Barlow keeps this tail at an equivalent angle of about 5° or less.',
      fix:'Lengthen the hub closure or reduce the fairing hub ratio.',refs:['B'],fields:['Lkapn','nuk'],gauge:{v:t,lo:0,hi:9,zones:[[0,5,'ok'],[5,7,'warn'],[7,9,'bad']],u:'°'}});
  }
  const d3=by('d3');
  if(d3&&d3.par.theta!=null){ const t=d3.par.theta, A=R.fanAng;
    add({id:'d3',cat:'Separation',where:'d3',sev:t<=3.5+1e-9?'ok':t<=5?'warn':'bad',title:'Return diffuser cone angle',val:'θe = '+nf(t,2)+'°',lim:'≤ 3.5°',
      msg:'Round Ø'+nf(g.fan_D*100,0)+' → square '+nf(g.s34*100,0)+' cm over '+nf(d3.L,2)+' m. The length is the larger of the θ₃ value ('+nf(A.L_D3_es,2)+' m) and the one that keeps the diagonal wall at '+nf(G.duvar,1)+'° ('+nf(A.L_D3_kos,2)+' m)'+(A.d3_byWall?'; here the diagonal sets it.':'.'),
      fix:'Reduce θ₃ or s₃₄.',refs:['B','E'],fields:['th3','s34','duvar'],gauge:{v:t,lo:0,hi:7,zones:[[0,3.5,'ok'],[3.5,5,'warn'],[5,7,'bad']],u:'°'}});
  }
  add({id:'arc',cat:'Separation',where:'gec',sev:R.AR_klasik<=6?'ok':'warn',title:'Total area ratio of conventional diffusers',val:'AR = '+nf(R.AR_klasik,2),lim:'≤ 5–6',
    msg:R.AR_klasik<=6?'The first and return diffusers together stay within the usual budget; the rest of the expansion is left to the wide-angle diffuser.'
      :'Asking the conventional diffusers for more than 5–6× expansion makes them long or steep; a wide-angle diffuser with screens should take part of it.',
    fix:'Shift expansion to the wide-angle diffuser (smaller s₃₄) or reduce s₁₂.',refs:['B'],fields:['s12','s34','fD'],
    gauge:{v:R.AR_klasik,lo:1,hi:8,zones:[[1,6,'ok'],[6,8,'warn']],u:''}});

  /* ---- wide-angle diffuser ---- */
  { const s=R.gad, ok=s.Ksum>s.Kgerek;
    add({id:'gad',cat:'Separation',where:'gad',sev:ok?'ok':'bad',title:'Wide-angle diffuser: screen resistance',
      val:'ΣK = '+nf(s.Ksum,2),lim:'> (AR−1)/1.14 = '+nf(s.Kgerek,2),
      msg:ok?'The pressure drop of the elements in/at the wide-angle diffuser ('+(R.yer==='ayri'?'WAD screens':'heat exchanger')+') is enough to keep the flow attached across a '+nf(G.gad2th,0)+'° total angle.'
        :'Not enough resistance in the wide-angle diffuser: the flow will separate from the walls and enter the settling chamber as a jet. Screens downstream cannot fully repair this.',
      fix:R.yer==='ayri'?'Add WAD screens or use finer mesh (lower open area).':'Raise the heat exchanger resistance, add a screen, or reduce the WAD area ratio (lower CR or larger s₃₄).',
      refs:['MB','B'],fields:['yer','gN','gdw','gwm','hxdp','CR','s34'],
      gauge:{v:s.Ksum/Math.max(1e-9,s.Kgerek),lo:0,hi:3,zones:[[0,1,'bad'],[1,3,'ok']],u:'× required',fmtv:x=>nf(x,2)+'×'}});
    const ok39=s.AR<=s.ARmax+1e-9;
    add({id:'gadg',cat:'Separation',where:'gad',sev:ok39?'ok':'warn',title:'Wide-angle diffuser: Barlow Fig. 3.9',val:'AR '+nf(s.AR,2)+' vs limit '+nf(s.ARmax,2),lim:s.n+' element'+(s.n===1?'':'s')+' at 2θ '+nf(s.th2,1)+'°',
      msg:(ok39?'Inside the successful region of the design chart':'Outside the successful region of the design chart')+' for '+s.n+' element'+(s.n===1?'':'s')+' ('+(R.yer==='ayri'?'WAD screens':'the heat exchanger')+'). 2θ is taken as the larger of the equivalent angle ('+nf(s.th2_es,1)+'°) and the flat-wall angle ('+nf(s.th2_duv,1)+'°).',
      fix:'Reduce 2θ, or add a screen about a third of the way along the wide-angle diffuser.',refs:['B','MB'],fields:['gad2th','CR','s34','gN'],
      gauge:{v:s.AR/Math.max(1e-9,s.ARmax),lo:0,hi:1.6,zones:[[0,1,'ok'],[1,1.6,'warn']],u:'',fmtv:x=>nf(x*100,0)+'% of limit'}});
  }

  /* ---- contraction ---- */
  { const CR=G.CR;
    add({id:'cr',cat:'Flow quality',where:'noz',sev:CR<6?'warn':CR<=10?'ok':'info',title:'Contraction ratio',val:'CR = '+nf(CR,2),lim:'6–10 typical',
      msg:CR<6?'Low CR: less damping of turbulence and spatial non-uniformity from the heat exchanger and spray bars, which in an icing tunnel directly shows up as LWC non-uniformity.'
        :CR<=10?'Within the usual range for closed-circuit tunnels.':'Large CR: very good flow quality, but a big settling chamber, more cold volume and a long contraction.',
      fix:'Adjust CR; the settling-chamber size follows.',refs:['B','MB'],fields:['CR'],gauge:{v:CR,lo:2,hi:14,zones:[[2,6,'warn'],[6,10,'ok'],[10,14,'info']],u:''}});
    const LD=G.L_c/g.s_dn;
    add({id:'cl',cat:'Separation',where:'noz',sev:LD<0.75?'warn':LD<=1.25?'ok':'info',title:'Contraction length',val:'L/H_in = '+nf(LD,2),lim:'≈ 0.9–1.25',
      msg:LD<0.75?'A short contraction has strong adverse pressure gradients at the inlet and exit corners; separation there feeds unsteadiness into the test section.'
        :LD<=1.25?'Length is in the range found optimal for 5th-order wall profiles.':'Longer than needed: thicker boundary layer at the test-section entry and more cold volume.',
      fix:'Change the contraction length L_c.',refs:['BM','MB'],fields:['Lc','CR'],gauge:{v:LD,lo:0.4,hi:1.8,zones:[[0.4,0.75,'warn'],[0.75,1.25,'ok'],[1.25,1.8,'info']],u:''}});
  }

  /* ---- settling chamber ---- */
  { const hc=G.hc, LD=hc.L/hc.Dh;
    add({id:'hc',cat:'Flow quality',where:'dn',sev:(LD<6||LD>8||hc.beta<0.8)?'warn':'ok',title:'Honeycomb proportions',val:'L/D = '+nf(LD,1)+', β = '+nf(hc.beta,2),lim:'L/D 6–8, β ≥ 0.8',
      msg:(LD<6||LD>8||hc.beta<0.8)?'Outside the recommended proportions: too short does not remove swirl, too long or too solid adds loss and its own turbulence.':'Removes lateral velocity components and swirl left by corner 4 and the heat exchanger.',
      fix:'Change honeycomb depth or cell size.',refs:['MB'],fields:['hcL','hcD','hcB'],gauge:{v:LD,lo:2,hi:12,zones:[[2,6,'warn'],[6,8,'ok'],[8,12,'warn']],u:''}});
    const scr=B.filter(b=>b.tip==='elek'), low=scr.filter(b=>b.par.beta<0.57);
    if(scr.length){ const mn=Math.min(...scr.map(b=>b.par.beta));
      add({id:'beta',cat:'Flow quality',where:low.length?low[0].id:'dn',sev:low.length?'warn':'ok',title:'Screen open-area ratio',val:'β min = '+nf(mn,2),lim:'β ≥ 0.57',
        msg:low.length?low.map(b=>b.name).join(', ')+': below 0.57 the jets through the mesh coalesce randomly and leave streaky, non-uniform flow.':'All screens open enough to avoid jet coalescence.',
        fix:'Use a finer wire for the same mesh, or a coarser mesh.',refs:['B','MB'],fields:['eldw','elwm','gdw','gwm'],gauge:{v:mn,lo:0.3,hi:0.9,zones:[[0.3,0.57,'warn'],[0.57,0.9,'ok']],u:''}});
    }
    if(G.el.N>1){ const need=500*G.el.dw;
      add({id:'scsp',cat:'Flow quality',where:'dn',sev:G.el.dx>=need?'ok':'warn',title:'Screen spacing',val:nf(G.el.dx*100,1)+' cm',lim:'≥ 500 d_w = '+nf(need*100,1)+' cm',
        msg:G.el.dx>=need?'Wakes from one screen decay before the next.':'Screens too close: the next screen sees the previous one\'s wakes and the turbulence reduction is lower than the sum of the parts.',
        fix:'Increase screen spacing.',refs:['B'],fields:['del','eldw']});
    }
    const xl=G.dn.x_el[G.dn.x_el.length-1]||G.dn.x_hc, toC=G.L_dn-xl, needC=0.2*g.s_dn;
    add({id:'sctc',cat:'Flow quality',where:'dn',sev:toC>=needC?'ok':'warn',title:'Last screen to contraction entry',val:nf(toC*100,0)+' cm',lim:'≥ 0.2 H_sc = '+nf(needC*100,0)+' cm',
      msg:toC>=needC?'Enough settling length for the screen wakes to mix out before the contraction.':'Screen wakes reach the contraction before they decay and are stretched into streamwise vortices.',
      fix:'Move screens upstream or lengthen the settling chamber.',refs:['MB'],fields:['xel','del','Ldn']});
    /* layout order: HX -> honeycomb -> screens -> spray bars, all inside the chamber */
    const dn=G.dn, issues=[];
    if(R.yer==='birlikte'&&dn.x_hx+dn.t_hx>dn.x_hc) issues.push('honeycomb overlaps the heat exchanger');
    if(dn.x_hc+G.hc.L>(dn.x_el[0]??Infinity)) issues.push('first screen sits inside the honeycomb');
    if(dn.x_el.length&&dn.x_el[dn.x_el.length-1]>=dn.x_sp) issues.push('spray bars are not downstream of the screens');
    if(dn.x_sp>G.L_dn) issues.push('spray bars are outside the settling chamber');
    add({id:'lay',cat:'Layout',where:'dn',sev:issues.length?'bad':'ok',title:'Settling-chamber layout',val:issues.length?issues.length+' conflict'+(issues.length>1?'s':''):'fits',lim:'HX → honeycomb → screens → spray',
      msg:issues.length?'Positions conflict: '+issues.join('; ')+'.':'Heat exchanger, honeycomb, '+G.el.N+' screens and spray bars fit in '+nf(G.L_dn*100,0)+' cm in the right order.',
      fix:'Adjust positions or the settling-chamber length.',refs:['B','BS'],fields:['Ldn','xhc','xel','del','xsp','thx']});
  }

  /* ---- heat exchanger ---- */
  { const v=R.hx.V;
    add({id:'hxv',cat:'Thermal',where:'hx',sev:v>5?'warn':'ok',title:'Heat exchanger face velocity',val:nf(v,2)+' m/s',lim:'≤ 5 m/s',
      msg:v>5?'High for a finned-tube coil: pressure drop grows ~V^1.8, frost blocks faster and water can be carried off the fins.':'Low face velocity keeps the coil pressure drop and frost growth moderate; it is '+nf(R.hx.dp,0)+' Pa including the frost factor.',
      fix:R.yer==='ayri'?'Place the coil at the WAD exit (combined layout) where the area is larger.':'Increase CR or the coil face area.',refs:['BS'],fields:['yer','hxV','hxdp','CR'],
      gauge:{v,lo:0,hi:10,zones:[[0,5,'ok'],[5,10,'warn']],u:'m/s'}});
    const hxB=R.bil.find(b=>b.id==='hx'), sh=hxB?hxB.K_ref/R.K_ham:0;
    if(sh>0.2) add({id:'hxs',cat:'Thermal',where:'hx',sev:'info',title:'Heat exchanger dominates the loss',val:nf(sh*100,0)+'% of circuit Δp',lim:'—',
      msg:'The coil is the largest single loss. Its vendor data (Δp at reference velocity, exponent, frosted condition) controls the fan selection more than any duct dimension.',
      fix:'Replace the estimated coil data with vendor values as soon as available.',refs:['BS'],fields:['hxdp','hxV','hxn','hxf']});
  }

  /* ---- corners ---- */
  { const hc=G.vane_hc;
    add({id:'vane',cat:'Separation',where:'c1',sev:(hc<0.2||hc>0.4)?'warn':'ok',title:'Turning-vane gap/chord',val:'h/c = '+nf(hc,2),lim:'≈ 0.25 (0.2–0.4)',
      msg:(hc<0.2||hc>0.4)?'Off the usual gap-to-chord ratio: too wide lets the flow separate from the vane suction side, too narrow adds friction and blockage.':'Vane cascade spacing as recommended; corner losses follow the vane chord Reynolds number.',
      fix:'Set the vane spacing near 1:4.',refs:['B'],fields:['vhc','vc'],gauge:{v:hc,lo:0,hi:0.6,zones:[[0,0.2,'warn'],[0.2,0.4,'ok'],[0.4,0.6,'warn']],u:''}});
    const c1=by('c1');
    add({id:'c1ice',cat:'Icing',where:'c1',sev:G.LWC>0?'info':'ok',title:'Corner-1 vanes collect ice',val:'K × '+nf(G.buz1,2),lim:'—',
      msg:'Droplets that pass the model are caught by the first set of turning vanes. Their loss is multiplied by '+nf(G.buz1,2)+' here (Δp '+nf(c1?c1.dp:NaN,0)+' Pa); in operation it grows with run time until de-iced.',
      fix:'Plan heated vanes or a de-icing interval for corner 1.',refs:['BS'],fields:['buz1']});
  }

  /* ---- fan ---- */
  { const f=R.fan;
    add({id:'ftip',cat:'Fan',where:'fan',sev:f.M_uc>0.4?'warn':'ok',title:'Fan tip speed (sizing estimate)',val:'U = '+nf(f.U_uc,0)+' m/s, M = '+nf(f.M_uc,2),lim:'M_tip ≲ 0.4 (rule of thumb)',
      msg:f.M_uc>0.4?'High tip Mach number: noise and blade loading increase quickly; at '+nf(G.Tc,0)+' °C the speed of sound is lower too.':'Moderate tip speed for the pressure needed (ψ = '+nf(G.fan.psi,2)+', '+nf(f.n_rpm,0)+' rpm on Ø'+nf(G.fan.D*100,0)+' cm).',
      fix:'A larger fan, or a higher-pressure blade design.',refs:[],fields:['psi','fD']});
    /* v1.6: the fan holds the speed until the circuit loss reaches λ_fan × design; literature icing cases */
    const ICE=iced(G,{V:R.V,yer:R.yer,h,R}), lit=ICE.filter(x=>x.id!=='stall'), worst=lit.reduce((a,b)=>b.lam>a.lam?b:a), st=ICE.find(x=>x.id==='stall');
    add({id:'lamf',cat:'Icing',where:'fan',sev:worst.lam>G.buz.lamF+1e-9?'warn':'ok',title:'Fan icing margin λ_fan',val:'worst λ = '+nf(worst.lam,2)+' vs λ_fan '+nf(G.buz.lamF,2),lim:'iced Δp ≤ λ_fan × design',
      msg:(worst.lam>G.buz.lamF+1e-9?'“'+worst.name+'” needs more pressure than the fan is specified for: the test speed drops during the run.':'Every literature icing case (coil and corner-1 ice, alone and together) stays inside the fan margin; the worst is “'+worst.name+'”.')+
        ' A stalled diffuser behind a large 2D model (λ = '+nf(st.lam,2)+') '+(st.ok?'is covered as well.':'is not covered; it is avoided by limiting model size and angle of attack.'),
      fix:'Raise λ_fan in the fan specification, or lower the coil resistance.',refs:['NA2','NO','B','BS'],fields:['lamF','bzHx','bzC1'],
      gauge:{v:worst.lam,lo:1,hi:3,zones:[[1,G.buz.lamF,'ok'],[G.buz.lamF,3,'warn']],u:''}});
    const er=R.ER;
    add({id:'er',cat:'Fan',where:'fan',sev:er<1.5?'bad':er<3?'warn':er<=7?'ok':'info',title:'Energy ratio',val:'ER = '+nf(er,2),lim:'3–7 for closed circuits',
      msg:er<3?'The circuit loses a large share of the jet power. In an icing tunnel the heat exchanger and frosted vanes are the usual causes ('+nf(R.lambda,2)+' kW shaft per kW jet).':er<=7?'A well-balanced closed circuit.':'Very efficient on paper: check the loss assumptions (heat exchanger, model drag).',
      fix:'Attack the largest items in the loss budget first.',refs:['B','BS'],fields:[],gauge:{v:er,lo:0,hi:9,zones:[[0,1.5,'bad'],[1.5,3,'warn'],[3,7,'ok'],[7,9,'info']],u:''}});
    add({id:'fmarg',cat:'Fan',where:'fan',sev:G.marg<1.3?'warn':'ok',title:'Fan pressure margin',val:'× '+nf(G.marg,2),lim:'ONERA used +55%',
      msg:G.marg<1.3?'A thin margin leaves nothing for frost growth on the coil and vanes, leakage and model blockage at high angle of attack.':'Margin covers frost build-up and uncertainty in the estimated losses.',
      fix:'Select the fan for Δp × margin.',refs:['O'],fields:['marg']});
  }

  /* ---- geometry closure ---- */
  add({id:'close',cat:'Layout',where:'ust',sev:g.L_ust_raw<0?'bad':'ok',title:'Circuit closes',val:g.L_ust_raw<0?'upper leg '+nf(-g.L_ust_raw,2)+' m too long':'upper duct '+nf(g.L_ust,2)+' m',lim:'upper duct ≥ 0',
    msg:g.L_ust_raw<0?'Fan transition, fan and return diffuser are longer than the lower leg: the loop does not close. The upper straight duct was set to zero.':'Upper straight duct length follows from matching the two long legs.',
    fix:'Lengthen the lower leg (settling chamber, contraction) or shorten the fan transition.',refs:[],fields:['Lgec','Lfan','Ldn','Lc']});
  add({id:'gap',cat:'Layout',where:'l34',sev:g.gap<0.05?'bad':g.gap<0.3?'info':'ok',title:'Clearance between legs',val:nf(g.gap*100,0)+' cm',lim:'> 5 cm (incl. insulation)',
    msg:g.gap<0.05?'The settling chamber and the return leg overlap once insulation is added.':'Space left between the outer insulation of the two long legs.',
    fix:'Increase the circuit width H.',refs:[],fields:['H','CR','it']});

  /* ---- test section & model ---- */
  { const cs=G.mdl.c/g.a;
    add({id:'mch',cat:'Test section',where:'model',sev:cs>0.35?'warn':'ok',title:'Model chord / test-section height',val:'c/h = '+nf(cs,2),lim:'≤ 0.35',
      msg:cs>0.35?'Wall corrections (streamline curvature, solid and wake blockage) grow with (c/h)² and become hard to apply reliably; the ice shape itself is affected by the walls.':'Wall interference small enough for standard 2D corrections.',
      fix:'Smaller chord or larger test section.',refs:['B'],fields:['mc','a'],gauge:{v:cs,lo:0,hi:0.6,zones:[[0,0.35,'ok'],[0.35,0.6,'warn']],u:''}});
    const end=G.mdl.x+G.mdl.c;
    add({id:'mfit',cat:'Test section',where:'model',sev:end>G.L_TS?'bad':end>G.L_TS-0.5*G.mdl.c?'warn':'ok',title:'Model position in the test section',val:'TE at '+nf(end*100,0)+' of '+nf(G.L_TS*100,0)+' cm',lim:'wake inside the section',
      msg:end>G.L_TS?'The model extends into the diffuser.':'Leading edge '+nf(G.mdl.x*100,0)+' cm downstream of the contraction exit.',fix:'Move the model upstream or lengthen the test section.',refs:[],fields:['mx','mc','LTS']});
    const M=R.M;
    add({id:'mach',cat:'Test section',where:'ts',sev:M<0.3?'ok':'warn',title:'Compressibility',val:'M = '+nf(M,3),lim:'< 0.3',
      msg:M<0.3?'Incompressible relations used for all losses are valid.':'Mach above 0.3: the incompressible K referral underestimates losses and q.',fix:'—',refs:['B'],fields:['V','T'],
      gauge:{v:M,lo:0,hi:0.4,zones:[[0,0.3,'ok'],[0.3,0.4,'warn']],u:''}});
  }

  /* ---- icing physics ---- */
  { const T=G.Tc;
    add({id:'tst',cat:'Icing',where:'model',sev:T>0?'bad':IC.Tstag>0?'warn':'ok',title:'Accretion possible',val:'T = '+nf(T,1)+' °C, T₀ = '+nf(IC.Tstag,1)+' °C',lim:'T₀ < 0 °C',
      msg:T>0?'Static temperature above freezing: no ice will form.':IC.Tstag>0?'Stagnation temperature above 0 °C: the leading edge warms by V²/2c_p and water runs back instead of freezing.':'Expected regime: '+(IC.regime==='rime'?'rime (dry growth, opaque, streamlined shape)':'glaze / mixed (wet growth, horns likely)')+'. Regime boundary here is a rule of thumb on T₀; the freezing fraction decides it.',
      fix:'Lower the static temperature.',refs:['AN'],fields:['T','V']});
    add({id:'lwc',cat:'Icing',where:'sp',sev:G.LWC>3?'warn':G.LWC<0.05?'info':'ok',title:'Liquid water content',val:nf(G.LWC,2)+' g/m³',lim:'Appendix C ≲ 3 g/m³',
      msg:G.LWC>3?'Above the certification envelope; also demands '+nf(IC.water_Lh,1)+' L/h of spray water that the cooling must freeze.':'Spray water '+nf(IC.water_Lh,1)+' L/h, '+nf(IC.perNoz,2)+' L/h per nozzle.',
      fix:'—',refs:['FAA'],fields:['LWC']});
    add({id:'mvd',cat:'Icing',where:'sp',sev:G.MVD>50?'warn':G.MVD<15?'info':'ok',title:'Droplet size (MVD)',val:nf(G.MVD,0)+' µm',lim:'15–50 µm (App. C)',
      msg:G.MVD>50?'Supercooled large drops (Appendix O): they splash, impinge far aft, and need more distance to cool. Check nozzle capability.':'Within the Appendix C range; stagnation collection efficiency β₀ ≈ '+nf(IC.beta0,2)+'.',
      fix:'—',refs:['FAA','LB'],fields:['MVD']});
    const r=IC.rem50;
    add({id:'drop',cat:'Icing',where:'noz',sev:r>0.05?'warn':'ok',title:'Droplet supercooling before the model',val:'50 µm: '+nf(r*100,1)+'% of ΔT left',lim:'< 5%',
      msg:r>0.05?'Large droplets reach the model before they cool to air temperature, so the cloud is warmer than the air reading.':'Travel time spray → leading edge '+nf(R.t_kalis*1000,0)+' ms is several thermal time constants even for 50 µm drops.',
      fix:'Move the spray bars upstream, or lower the water temperature.',refs:['BS'],fields:['xsp','Lc','spT'],gauge:{v:r*100,lo:0,hi:20,zones:[[0,5,'ok'],[5,20,'warn']],u:'%'}});
    const sig=(by('sp')||{par:{}}).par.sig||0;
    add({id:'spb',cat:'Flow quality',where:'sp',sev:sig>0.2?'warn':'ok',title:'Spray bar blockage',val:nf(sig*100,1)+'%',lim:'≲ 20% (rule of thumb)',
      msg:sig>0.2?'The bars act like a coarse grid: their wakes add turbulence that the contraction cannot fully suppress.':'Bar wakes small; they are the last disturbance before the contraction.',fix:'Thinner bars or fewer bars.',refs:['B'],fields:['spN','spd']});
  }

  /* ---- thermal envelope ---- */
  { const s=IC.Tskin<IC.Tdew;
    add({id:'cond',cat:'Thermal',where:'ust',sev:s?'warn':'ok',title:'Outer-skin condensation',val:'skin '+nf(IC.Tskin,1)+' °C vs dew point '+nf(IC.Tdew,1)+' °C',lim:'skin > dew point',
      msg:s?'The outside of the insulated duct is colder than the lab dew point: water will condense (and drip) on it.':'Insulation keeps the outer skin above the lab dew point ('+nf(G.RH,0)+'% RH).',
      fix:'Thicker or better insulation.',refs:['MG'],fields:['it','ik','RH','Tlab']});
    const deep=IC.Tevap<-40;
    add({id:'evap',cat:'Thermal',where:'hx',sev:deep?'warn':'info',title:'Refrigeration at low temperature',val:'secondary fluid ≈ '+nf(IC.Tevap,0)+' °C',lim:deep?'single stage ≳ −40 °C':'—',
      msg:'For air at '+nf(G.Tc,0)+' °C the secondary fluid runs about '+nf(G.ops.dTy,0)+' K colder, near '+nf(IC.Tevap,0)+' °C, and the refrigerant evaporates lower still.'+(deep?' A single-stage unit does not reach this: a two-stage or cascade unit (e.g. with CO₂) is needed, and its capacity must be quoted at this temperature.':' Catalogue capacities are quoted much warmer and drop substantially here.'),
      fix:'Ask the vendor for capacity at the actual evaporating temperature.',refs:['BS'],fields:['T','dTy','Qk']});
    const TB=thermal(R,G,G.LWC,h), TL=TB.top+(G.buz.lamF-1)*(TB.fan+TB.motor), Qk=G.ops.Q_sec;
    add({id:'qcap',cat:'Thermal',where:'hx',sev:Qk>=TL?'ok':Qk>=TB.top?'warn':'bad',title:'Refrigeration capacity, spray on',val:nf(Qk/1000,0)+' kW vs '+nf(TB.top/1000,1)+'–'+nf(TL/1000,1)+' kW',lim:'≥ load at λ_fan',
      msg:Qk>=TL?'The unit holds '+nf(G.Tc,0)+' °C at '+nf(R.V,0)+' m/s and '+nf(G.LWC,2)+' g/m³ even with the iced-circuit fan power (λ_fan).'
        :Qk>=TB.top?'Enough for the clean circuit, but as ice raises the fan power towards λ_fan the air warms up: runs end on the temperature-drift limit.'
        :'Below the steady load with the spray on: the air temperature cannot be held at this speed and LWC.',
      fix:'Increase the refrigeration capacity, or test at lower speed / LWC.',refs:['BS'],fields:['Qk','LWC','V']});
  }
  add({id:'leak',cat:'Fan',where:'fan',sev:'info',title:'Leakage and joints allowance',val:'× '+nf(G.leak,2),lim:'—',
    msg:'Total K is multiplied by '+nf(G.leak,2)+' for leakage and joints; this typically lowers ER by about 10%.',fix:'—',refs:['B'],fields:['leak']});

  const order={bad:0,warn:1,info:2,ok:3};
  C.sort((a,b)=>order[a.sev]-order[b.sev]);
  return C;
}

window.IcingEngine={REFS,WHY,air,fPr,KeKare,KeDaire,KeSekil,fig39,circuit,thermal,icing,pchip,fanPoint,geometryTable,sweep,scenarios,iced,fanReq,ops,audit};
})();
