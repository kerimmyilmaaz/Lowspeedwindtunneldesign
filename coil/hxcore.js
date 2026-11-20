/* Smokeline · Coil & Chiller · scientific core
   Line-by-line port of the ASTRAL MATLAB tool matlab_v2 (K. Yılmaz, 14–15 Nov 2026):
     yuk_modeli.m      → load()        heat the coil must remove: fan + walls + spray (+ extra), clean and iced
     akiskan_vt.m      → FLUIDS        secondary fluids from the manufacturers' datasheets
     akiskan_ozellik.m → props()       ρ, c_p, k linear in T, μ log-linear
     boru_katalog.m    → PATTERNS      tube / fin patterns
     esanjor.m         → rate()        two-stage plate-fin / round-tube coil: air side, fins, tube side, UA, ε-NTU,
                                       pumped fluid, pump heat, Hausen length band
     esanjor_referans_hx.m → refX()    old single-stage reference coil (only for the scaled air Δp)
     damla_gecit.m, finstad.m          droplet paths through a turning-vane passage, cylinder collection efficiency
     astral_buz.m      → circuitIce()  water budget model → corners → fan → coil, ice growth, blockage, λ(t)
     buz_on_hatve.m    → iceMatrix()   MVD × corner-heating matrix → water reaching the coil → front-stage fin pitch
     esanjor_tasarim.m → design()      requirements → scan → ranking → recommended coil → ice run with that coil
   Same equations, same constants, same search order and tie-breaks, so the page and MATLAB give the same design.
   Units SI inside (m, m/s, °C, Pa, W, kg/s). Runs in a Web Worker (coil/worker.js) and in Node for the tests. */
(function(root){
'use strict';
const CP=1005, RA=287.058, LN10=Math.LN10;
const sind=d=>Math.sin(d*Math.PI/180);
const clone=o=>structuredClone(o);
const num=(v,d)=>(v===undefined||v===null||(typeof v==='number'&&isNaN(v)))?d:v;

/* ---------------- secondary fluids (akiskan_vt.m) ---------------- */
function rec(name,T,rho,cp,k,mu,Tfreeze,flam,Tflash,data,tag,src,note,Tmin,ok){
  return {name,T,rho,cp,k,mu,Tfreeze,flam,Tflash,data,tag,src,note,Tmin,ok};
}
const FLUIDS=[
  rec('HC-50 (2 points)',[-50,-40],[1378,1373],[2563,2580],[0.435,0.445],[38.4e-3,20.4e-3],NaN,false,NaN,'full','V',
    'Dynalene HC Series Technical Data Sheet (HC-50, −40 and −50 °C)','Regression table of the Python scripts, kept unchanged.',-50,false),
  rec('HC-50',[-50,-40,-30,-20,-10,0,10,20],[1378,1373,1367,1362,1356,1351,1345,1340],[2563,2583,2602,2622,2642,2661,2681,2701],
    [0.435,0.445,0.455,0.465,0.475,0.485,0.495,0.505],[38.4e-3,20.4e-3,12.5e-3,8.40e-3,5.99e-3,4.70e-3,3.80e-3,3.20e-3],-55,false,NaN,'full','V',
    'Dynalene HC Engineering Guide (2014) Tables 1 and 5a; Properties of Dynalene HC (May 2020)',
    'Potassium formate brine. Freezing “< −55 °C” (−55 taken); lowest use in a closed system −50 °C. Not flammable. Not allowed: magnesium, zinc, zinc plating, galvanised parts; ask the supplier about aluminium.',-50,true),
  rec('Dowtherm J',[-80,-60,-40,-20,0],[931.3,921.0,907.0,892.9,878.5],[1584,1616,1663,1714,1769],[0.1485,0.1453,0.1411,0.1368,0.1326],
    [8.43e-3,5.12e-3,2.88e-3,1.80e-3,1.23e-3],-81,true,57,'full','V','Dow DOWTHERM J product technical data, Form 176-01465-1101 (Nov 2001), SI table',
    'Alkylated aromatic. Freezing < −81 °C. Flash point 57 °C closed cup: flammable (Cat. 3), needs a nitrogen blanket.',-80,true),
  rec('Therminol LT',[-73,-70,-60,-50,-40,-30,-20,-10,0,10,20],[938,936,928,920,913,905,897,890,882,874,866],
    [1440,1450,1490,1530,1570,1610,1650,1690,1730,1760,1800],
    [0.1426,0.1420,0.1401,0.1382,0.1362,0.1343,0.1324,0.1305,0.1285,0.1266,0.1246],
    [10.1e-3,8.53e-3,5.51e-3,3.84e-3,2.84e-3,2.19e-3,1.75e-3,1.43e-3,1.20e-3,1.03e-3,0.889e-3],-75,true,57,'full','V',
    'Eastman Therminol LT bulletin TF-8426A (Aug 2020); selection guide TF-10871D (2023)','Alkyl-substituted aromatic. Crystallises at −75 °C. Flash point 57 °C: flammable.',-75,true),
  rec('Syltherm XLT',[-100,-90,-80,-70,-60,-50,-40,-30,-20,-10,0,10,20],
    [978.5,968.3,958.0,947.7,937.4,927.2,916.9,906.7,896.4,886.1,875.8,865.5,855.3],
    [1520,1541,1562,1583,1604,1625,1646,1667,1688,1709,1730,1751,1772],
    [0.1341,0.1324,0.1306,0.1288,0.1269,0.1251,0.1231,0.1212,0.1192,0.1171,0.1150,0.1129,0.1108],
    [78.6e-3,33.7e-3,20.0e-3,13.3e-3,9.4e-3,6.9e-3,5.2e-3,4.0e-3,3.1e-3,2.5e-3,2.0e-3,1.7e-3,1.4e-3],-111,true,47,'full','V',
    'Dow Corning SYLTHERM XLT brochure Form 176-01434-298 (1998) Table 5; Form 176-01468-1203 (2003)',
    'Silicone fluid. Freezing −111 °C. Flash point 47 °C closed cup: flammable. c_p at −30 °C to be confirmed.',-100,true),
  rec('Syltherm XLT (CERN 1997)',[-73.3,-62.2,-51.1,-40.0,-28.9,-17.8,-6.7,4.4,15.6],[925.2,915.8,906.3,896.9,887.3,877.8,868.2,858.6,848.8],
    [1411,1440,1470,1495,1524,1553,1583,1612,1637],[0.129,0.127,0.125,0.123,0.121,0.119,0.116,0.114,0.112],
    [12.6e-3,8.8e-3,6.4e-3,4.8e-3,3.7e-3,2.9e-3,2.3e-3,1.9e-3,1.6e-3],-111,true,47,'full','K',
    'P. Bonneau, CERN detector cooling, Table 01 – Properties of SYLTHERM XLT (1997)','Old table that contradicts Dow (ρ ≈ −20 kg/m³, c_p ≈ −9 %). Shown for sensitivity only, never recommended.',-100,false),
  rec('Tyfoxit F50',[-50,-40,-30,-20,-15,-10,0,10,20],[1386,1382,1378,1374,1372,1370,1366,1362,1358],
    [2550,2560,2570,2580,2585,2590,2600,2610,2620],[0.379,0.392,0.405,0.418,0.425,0.431,0.443,0.455,0.468],
    [76.17e-3,33.43e-3,17.89e-3,11.09e-3,8.77e-3,7.26e-3,5.29e-3,3.98e-3,3.20e-3],-50,false,NaN,'full','V',
    'TYFOROP Chemie, TYFOXIT F15–F50 technical information (2020)',
    'Potassium formate brine. Freezing and lowest use −50 °C (ASTM D1177). Not flammable. Not allowed: galvanised pipe or tank, leaded soft solder, chloride flux.',-50,true),
  rec('Placeholder',[-60,-20],[1300,1300],[2700,2700],[0.45,0.45],[15e-3,15e-3],NaN,false,NaN,'full','T',
    'Old placeholder values of the first coil designer','Not a real fluid; regression only.',NaN,false)
];
function fluid(name){
  if(name&&typeof name==='object') return name;
  const f=FLUIDS.find(x=>x.name.toLowerCase()===String(name).toLowerCase());
  if(!f) throw new Error('Unknown fluid: '+name);
  return f;
}
/* akiskan_ozellik.m: ρ, c_p, k linear and constant outside the table; μ log-linear, extrapolated with the end slope */
function lin(x,y,T){ const n=x.length; if(T<=x[0]) return y[0]; if(T>=x[n-1]) return y[n-1];
  let j=0; for(let i=0;i<n;i++) if(x[i]<=T) j=i; return y[j]+(T-x[j])*(y[j+1]-y[j])/(x[j+1]-x[j]); }
function props(ak,T){
  ak=fluid(ak);
  const idx=ak.T.map((t,i)=>i).sort((a,b)=>ak.T[a]-ak.T[b]);
  const Tt=idx.map(i=>ak.T[i]), R=idx.map(i=>ak.rho[i]), C=idx.map(i=>ak.cp[i]), K=idx.map(i=>ak.k[i]), M=idx.map(i=>ak.mu[i]), n=Tt.length;
  if(n===1) return {rho:R[0],cp:C[0],k:K[0],mu:M[0],out:T!==Tt[0]};
  const y=M.map(Math.log); let mu;
  if(T<Tt[0]) mu=Math.exp(y[0]+(y[1]-y[0])/(Tt[1]-Tt[0])*(T-Tt[0]));
  else if(T>Tt[n-1]) mu=Math.exp(y[n-1]+(y[n-1]-y[n-2])/(Tt[n-1]-Tt[n-2])*(T-Tt[n-1]));
  else mu=Math.exp(lin(Tt,y,T));
  return {rho:lin(Tt,R,T),cp:lin(Tt,C,T),k:lin(Tt,K,T),mu,out:T<Tt[0]||T>Tt[n-1]};
}

/* ---------------- tube / fin patterns (boru_katalog.m) ---------------- */
const PATTERNS=[
  {code:'ON',name:'Ø15.9 × 1.0 in-line 50 × 50 (front stage)',Do:0.0159,tw:0.0010,Pt:0.050,Pl:0.050,stag:false,fp:[0.007,0.010,0.012],stage:'front',tag:'S',
   note:'Front stage that takes the ice. Same tube as the reference coil. Fin pitches from the Friterm GCS list 4/7/10/12 mm (not checked against the catalogue); 4 mm is too narrow for ice.'},
  {code:'A',name:'Ø15.9 × 1.0 in-line 50 × 50 (reference)',Do:0.0159,tw:0.0010,Pt:0.050,Pl:0.050,stag:false,fp:[0.008],stage:'main',tag:'S',note:'Reference main stage of the first coil proposal.'},
  {code:'B',name:'Ø15.88 × 0.8 staggered 38.1 × 33',Do:0.01588,tw:0.0008,Pt:0.0381,Pl:0.033,stag:true,fp:[0.008],stage:'main',tag:'K',note:'5/8″ tube, assumed common staggered die; not checked with a manufacturer.'},
  {code:'C',name:'Ø12.7 × 0.4 staggered 31.75 × 27.5',Do:0.0127,tw:0.0004,Pt:0.03175,Pl:0.0275,stag:true,fp:[0.008],stage:'main',tag:'K',note:'1/2″ tube, assumed common staggered die. Ask the manufacturer for 8 mm fin pitch on this die.'},
  {code:'D',name:'Ø9.52 × 0.35 staggered 25.4 × 22',Do:0.00952,tw:0.00035,Pt:0.0254,Pl:0.022,stag:true,fp:[0.006],stage:'main',tag:'K',note:'3/8″ tube. Typical fin pitch of this die is 1.6–4.2 mm; 6 mm may be outside it, so it is not in the default search.'}
];
const pattern=code=>{ const p=PATTERNS.find(x=>x.code.toLowerCase()===String(code).toLowerCase()); if(!p) throw new Error('Unknown pattern '+code); return p; };

/* ---------------- air (esanjor.m hava_ozellik, astral_buz.m hava) ---------------- */
function air(Tc,p){ const T=Tc+273.15; return {T,rho:p/(RA*T),mu:1.716e-5*Math.pow(T/273.15,1.5)*(273.15+110.4)/(T+110.4),k:0.0241*Math.pow(T/273.15,0.81),cp:CP}; }

/* ---------------- default inputs (astral_buz_girdi.m + esanjor_tasarim_girdi.m) ---------------- */
function defaultX(){ return {
  W:1.5,H:1.5,gap:0.10,tf:0.0003,k_fin:200,k_tube:390,K_bend:0.5,
  Do:0.0159,tw:0.0010,Pt:0.050,Pl:0.050,stag:false,N1:2,fp1:0.010,
  N2:6,fp2:0.008,Do2:0.0127,tw2:0.0004,Pt2:0.03175,Pl2:0.0275,stag2:true,
  Ncirc:0,Ncirc1:30,Ncirc2:47,L_mod:'devre',flow:'oto',art_Nu:[1,1],art_f:[1,1],art_Re_min:600,
  fluid:'HC-50',flow_m3h:28,pump:{mode:'chiller',dp_sys:100e3,eta:0.5},
  dTf:3,f_rho:1300,f_cp:2700,f_mu:0.015,f_k:0.45,Q_clean:NaN,Q_iced:NaN,
  dp_src:'jakob',dp_ref:100,V_ref:4.5,n_us:1.8,k_ice:0.3,crho:540,n_e:1.25,capture:1 }; }
function defaultG(){
  const corner=(name,w,h,c)=>({name,w,h,n:22,chord:c,turn:90,le:0.003,gap:0,U:0,K0:NaN,heated:false});
  return { V:40,T:-35,p:101325,LWC:1.0,MVD:20,dist:'tek',t_end:45,
    TS:{w:0.5,h:0.5}, model:{on:true,c:0.20,tc:0.12,alpha:4,capture:NaN},
    corners:[corner('Corner 1',0.75,0.75,0.1875),corner('Corner 2',0.75,0.75,0.1875),corner('Corner 3',1.0,1.0,0.25),corner('Corner 4',1.0,1.0,0.25)],
    fan:{after:2,capture:0}, hx:defaultX(),
    rho_ice:400,m_loss:2,b_lim:0.6,K_other:0.2961,leak:1.1,lam_fan:2.0,
    num:{nr:160,steps:3000,nbin:18,stokes:false,dt_min:1/6} };
}
function defaults(){ return {
  T:-35,V:40,p:101325,LWC:1.0,MVD:20,dist:'tek',t_target:30,
  G:defaultG(),
  load:{K_top:0.5267,eta_fan:0.75,eta_motor:0.91,U_wall:0.298,A_wall:81.73,T_lab:20,T_w:20,Q_extra:0,marj:1.30},
  lim:{dp_f_max:150e3,v_max:2.5,v_min:0.3,dp_air_max:130,depth_max:0.50,Nc_max:60,freeze_margin:3,T_evap_min:-53,no_transition:true},
  fluids:['HC-50','Dowtherm J','Therminol LT','Syltherm XLT','Syltherm XLT (CERN 1997)','Tyfoxit F50'],
  nonflam_pref:true, flam_penalty:2,
  front:{code:'ON',N1:2,fp_min:0.010,fp1:NaN},
  main:{codes:['A','B','C'],N2:[4,5,6,7,8,9,10]},
  flows:Array.from({length:26},(_,i)=>10+2*i),
  pump:{mode:'chiller',dp_sys:100e3,eta:0.5},
  wire:{on:false,Nu:2,f:1.4},
  ice:{MVDs:[15,20,30,40],scen:['mevcut','k12','hepsi'],sizing:['mevcut','k12'],margin:1.25,f_floor:0,run:true},
  chiller:{dT_evap:[4,8]},
  run_circuit:true }; }

/* ---------------- load (yuk_modeli.m) ---------------- */
function load(G){
  const y=G.load||{}, K_top=num(y.K_top,0.5267), eta_fan=num(y.eta_fan,0.75), eta_motor=num(y.eta_motor,0.91),
    U=num(y.U_wall,0.298), A=num(y.A_wall,81.73), T_lab=num(y.T_lab,20), T_w=num(y.T_w,20),
    c_w=num(y.c_w,4183), L_f=num(y.L_f,334000), c_i=num(y.c_i,2050), Q_extra=num(y.Q_extra,0), lam=num(G.lam_fan,2.0), marj=num(y.marj,1.30);
  const Y={}, warn=[], A_TS=G.TS.w*G.TS.h;
  Y.rho=G.p/(RA*(G.T+273.15)); Y.Q_air=G.V*A_TS; Y.mdot=Y.rho*Y.Q_air; Y.q_TS=0.5*Y.rho*G.V*G.V;
  Y.T0=G.T+G.V*G.V/(2*CP);
  Y.P_fan=K_top*Y.q_TS*Y.Q_air/eta_fan; Y.Q_fan=Y.P_fan/eta_motor;
  Y.Q_wall=U*A*(T_lab-G.T); Y.m_w=G.LWC*1e-3*Y.Q_air;
  if(G.T<0){ Y.Q_spray=Y.m_w*(c_w*(T_w-0)+L_f+c_i*(0-G.T)); Y.spray_parts={sens:Y.m_w*c_w*T_w,latent:Y.m_w*L_f,ice:Y.m_w*c_i*(0-G.T)}; }
  else { Y.Q_spray=Y.m_w*c_w*(T_w-G.T); Y.spray_parts={sens:Y.Q_spray,latent:0,ice:0}; warn.push('T ≥ 0 °C: the spray water does not freeze, only sensible heat is counted (not an icing condition).'); }
  Y.Q_extra=Q_extra; Y.Q_clean=Y.Q_fan+Y.Q_wall+Y.Q_spray+Q_extra; Y.Q_iced=lam*Y.Q_fan+Y.Q_wall+Y.Q_spray+Q_extra; Y.lam=lam;
  /* refrigeration selection, air side (kapali_devre_1D.m v1.8, yuk_modeli.m): margin on the larger of the two loads */
  Y.marj=marj; Y.Q_sel=marj*Math.max(Y.Q_clean,Y.Q_iced);
  Y.par={K_top,eta_fan,eta_motor,U_wall:U,A_wall:A,T_lab,T_w,c_w,L_f,c_i,Q_extra,marj};
  warn.push('K_top = '+K_top.toFixed(4)+' is taken independent of speed (Reynolds effect neglected).');
  warn.push('Atomising air of the nozzles (≈ 1.4–2.8 kW, no nozzle data yet) is not included unless entered as an extra load.');
  warn.push('Thermal bridges (flanges, supports, doors) are not included.');
  warn.push('Frost (moisture of the air depositing on the coil) is not modelled.');
  Y.warn=warn; return Y;
}

/* ---------------- coil rating (esanjor.m) ---------------- */
function tubeGeo(Do,tw,Pt,Pl,stag,H){ const Pd=Math.sqrt(Pt*Pt/4+Pl*Pl);
  return {Do,tw,Pt,Pl,Di:Do-2*tw,Nt:Math.max(1,Math.floor(H/Pt+1e-9)),stag,Pd,gapT:Pt-Do,gapD:2*(Pd-Do)}; }
function pickCirc(tubes,want){ const w=Math.min(want,tubes); let best=1,bd=Infinity;
  for(let d=1;d<=tubes;d++) if(tubes%d===0){ const e=Math.abs(d-w); if(e<bd){bd=e;best=d;} } return {Nc:best,rounded:best!==want}; }
function geometry(X,two){
  const warn=[], W=X.W, H=X.H, g={W,H,A_face:W*H};
  const b=[tubeGeo(X.Do,X.tw,X.Pt,X.Pl,X.stag,H),
           tubeGeo(num(X.Do2,X.Do),num(X.tw2,X.tw),num(X.Pt2,X.Pt),num(X.Pl2,X.Pl),X.stag2===undefined?X.stag:X.stag2,H)];
  if(!two&&(b[0].Do!==b[1].Do||b[0].tw!==b[1].tw||b[0].Pt!==b[1].Pt||b[0].Pl!==b[1].Pl||b[0].stag!==b[1].stag))
    throw new Error('Different tube geometry per stage needs separate circuits per stage.');
  const rows=[X.N1,X.N2], fps=[X.fp1,X.fp2], names=['Front stage','Main stage'], st=[];
  for(let k=0;k<2;k++){ if(rows[k]<=0) continue; const t=b[k], s={name:names[k],rows:rows[k],fp:fps[k],no:k+1};
    s.nfin=Math.max(1,Math.round(W/s.fp)); const cell=H*t.Pl-t.Nt*Math.PI*t.Do*t.Do/4;
    s.A_fin=s.rows*s.nfin*2*cell; s.A_t0=s.rows*t.Nt*Math.PI*t.Do*W; s.A_tube=s.A_t0*(1-X.tf/s.fp); s.A_o=s.A_fin+s.A_tube;
    const gp=t.stag?Math.min(t.gapT,t.gapD):t.gapT; s.sig=gp/t.Pt*(1-X.tf/s.fp); s.depth=s.rows*t.Pl;
    s.A_i=s.rows*t.Nt*Math.PI*t.Di*W; s.m_fin=s.nfin*s.rows*cell*X.tf*2700;
    Object.assign(s,{Do:t.Do,tw:t.tw,Di:t.Di,Pt:t.Pt,Pl:t.Pl,Pd:t.Pd,stag:t.stag,Nt:t.Nt,tubes:s.rows*t.Nt,Ncirc:NaN,passes:NaN,L_circ:NaN});
    s.m_tube=s.tubes*W*Math.PI/4*(t.Do*t.Do-t.Di*t.Di)*8960; s.V_liq=s.tubes*W*Math.PI/4*t.Di*t.Di;
    const ratio=s.A_o/s.A_t0; if(ratio<5||ratio>30) warn.push(s.name+': A_o/A_t0 = '+ratio.toFixed(2)+', outside the VDI/Ganguli range [5, 30].');
    st.push(s); }
  if(!st.length) throw new Error('No tube rows in the coil.');
  g.Di=st[0].Di; g.Nt=st[0].Nt; g.stag=st[0].stag; g.Pd=st[0].Pd;
  if(two){ const want=[X.Ncirc1,X.Ncirc2];
    st.forEach(s=>{ let w=want[s.no-1]; if(w<=0) w=s.Nt; const r=pickCirc(s.tubes,w);
      if(r.rounded) warn.push(s.name+': '+w+' circuits do not divide '+s.tubes+' tubes; nearest divisor '+r.Nc+' taken.');
      s.Ncirc=r.Nc; s.passes=s.tubes/r.Nc; s.L_circ=s.passes*W; });
    g.rows=st.reduce((a,s)=>a+s.rows,0); g.tubes=st.reduce((a,s)=>a+s.tubes,0);
    const L=st[st.length-1]; g.Ncirc=L.Ncirc; g.passes=L.passes; g.L_circ=L.L_circ;
    g.depth=st.reduce((a,s)=>a+s.depth,0)+(st.length>1?X.gap:0); g.m_tube=st.reduce((a,s)=>a+s.m_tube,0);
    g.V_liq=st.reduce((a,s)=>a+s.V_liq,0); g.L_total=st.reduce((a,s)=>a+s.L_circ,0);
  } else {
    g.rows=st.reduce((a,s)=>a+s.rows,0); g.tubes=g.rows*g.Nt; let w=X.Ncirc; if(w<=0) w=g.Nt;
    const r=pickCirc(g.tubes,w); if(r.rounded) warn.push(w+' circuits do not divide '+g.tubes+' tubes; nearest divisor '+r.Nc+' taken.');
    g.Ncirc=r.Nc; g.passes=g.tubes/g.Ncirc; g.L_circ=g.passes*W;
    st.forEach(s=>{ s.Ncirc=g.Ncirc; s.passes=s.tubes/g.Ncirc; s.L_circ=g.L_circ; });
    g.depth=st.reduce((a,s)=>a+s.depth,0)+(st.length>1?X.gap:0);
    g.m_tube=g.tubes*W*Math.PI/4*(X.Do*X.Do-g.Di*g.Di)*8960; g.V_liq=g.tubes*W*Math.PI/4*g.Di*g.Di; g.L_total=g.L_circ;
  }
  g.st=st; g.m_fin=st.reduce((a,s)=>a+s.m_fin,0); g.A_o=st.reduce((a,s)=>a+s.A_o,0); g.A_i=st.reduce((a,s)=>a+s.A_i,0); g.two=two;
  return {g,warn};
}
function airSide(X,s,a,Vf,dIce){
  const Vmax=Vf/s.sig, Re=a.rho*Vmax*s.Do/a.mu, Pr=a.mu*a.cp/a.k;
  const C=s.stag?(s.rows>=4?0.38:s.rows===3?0.36:s.rows===2?0.33:0.20):(s.rows>=4?0.22:0.20);
  const Nu=C*Math.pow(Re,0.6)*Math.pow(s.A_o/s.A_t0,-0.15)*Math.pow(Pr,1/3), h=Nu*a.k/s.Do, he=1/(1/h+dIce/X.k_ice);
  const r=s.Do/2; let M,L; if(s.stag){M=Math.min(s.Pt/2,s.Pd/2);L=Math.max(s.Pt/2,s.Pd/2);}else{M=Math.min(s.Pt/2,s.Pl/2);L=Math.max(s.Pt/2,s.Pl/2);}
  const psi=M/r, beta=L/M, Rq=s.stag?1.27*psi*Math.sqrt(Math.max(beta-0.3,0.05)):1.28*psi*Math.sqrt(Math.max(beta-0.2,0.05));
  const phi=(Rq-1)*(1+0.35*Math.log(Math.max(Rq,1.0001))), m=Math.sqrt(2*he/(X.k_fin*X.tf)), x=m*r*phi;
  const eta=x>1e-9?Math.tanh(x)/x:1, eo=1-s.A_fin/s.A_o*(1-eta);
  const aa=s.Pt/s.Do, bb=s.Pl/s.Do;
  const fj=s.stag?(0.25+0.118/Math.pow(aa-1,1.08))*Math.pow(Re,-0.16):(0.044+0.08*bb/Math.pow(aa-1,0.43+1.13/bb))*Math.pow(Re,-0.15);
  const dp_bank=2*fj*a.rho*Vmax*Vmax*s.rows;
  const gp=s.fp-X.tf, Vch=Vf/(1-X.tf/s.fp), Dh=2*gp, Rech=a.rho*Vch*Dh/a.mu, fch=Rech<2300?96/Math.max(Rech,1):0.316*Math.pow(Rech,-0.25);
  const dp_fin=(fch*s.depth/Dh+0.5)*0.5*a.rho*Vch*Vch;
  return {Vmax,Re,Nu,h,he,eta,eo,UA:eo*he*s.A_o,dp:dp_bank+dp_fin,dp_bank,dp_fin,C,Pr};
}
function tubeIn(Re,Pr,D,L,aN,aF,ReMin){
  let cut=false; if((aN!==1||aF!==1)&&Re<ReMin){aN=1;aF=1;cut=true;}
  const haus=()=>{ const Gz=Re*Pr*D/L; return 3.66+0.0668*Gz/(1+0.04*Math.pow(Gz,2/3)); };
  if(Re<2300) return {Nu:haus()*aN,f:64/Math.max(Re,1)*aF,regime:'laminar',cut};
  if(Re>4000){ const ft=Math.pow(0.79*Math.log(Re)-1.64,-2);
    return {Nu:(ft/8)*(Re-1000)*Pr/(1+12.7*Math.sqrt(ft/8)*(Math.pow(Pr,2/3)-1)),f:ft,regime:'turbulent',cut}; }
  const w=(Re-2300)/1700, lam=haus(), f4=Math.pow(0.79*Math.log(4000)-1.64,-2), t4=(f4/8)*3000*Pr/(1+12.7*Math.sqrt(f4/8)*(Math.pow(Pr,2/3)-1));
  return {Nu:(1-w)*lam*aN+w*t4,f:(1-w)*64/2300*aF+w*f4,regime:'transitional',cut};
}
function epsNTU(NTU,Cr,counter){
  if(counter){ if(Math.abs(1-Cr)<1e-6) return NTU/(1+NTU); return (1-Math.exp(-NTU*(1-Cr)))/(1-Cr*Math.exp(-NTU*(1-Cr))); }
  return 1-Math.exp(Math.pow(NTU,0.22)/Cr*(Math.exp(-Cr*Math.pow(NTU,0.78))-1));
}
function rate(X,Tair,p,mdot,Q,dIce){
  dIce=dIce||0;
  const two=X.Ncirc1!=null&&X.Ncirc2!=null&&!isNaN(X.Ncirc1)&&!isNaN(X.Ncirc2);
  const GG=geometry(X,two), g=GG.g, warn=GG.warn.slice(), a=air(Tair,p), Vf=mdot/(a.rho*g.A_face);
  let UA_air=0, dp_air=0; const st=g.st.map((s,k)=>{ const r=airSide(X,s,a,Vf,k===0?dIce:0); UA_air+=r.UA; dp_air+=r.dp;
    if(r.Re<1e3||r.Re>1e5) warn.push(s.name+': air Re = '+r.Re.toFixed(0)+', outside the VDI/Ganguli range [10³, 10⁵].'); return r; });
  const c={Q,Ca:mdot*a.cp,Tout:Tair,K_bend:X.K_bend};
  let ak=X.fluid; c.tab=!!ak;
  if(c.tab){ ak=fluid(ak); c.ak=ak; c.name=ak.name; } else { c.name='constant properties'; c.f=[X.f_rho,X.f_cp,X.f_k,X.f_mu]; }
  c.flow=(X.flow_m3h==null||isNaN(X.flow_m3h))?null:X.flow_m3h; c.dTf=c.flow==null?X.dTf:NaN;
  const pm=X.pump||{}; c.pmode=(pm.mode||'yok').toLowerCase(); c.dp_sys=num(pm.dp_sys,100e3); c.eta=num(pm.eta,0.5);
  const fl=(X.flow||'oto').toLowerCase(); c.counter=fl==='oto'?(two||g.passes>=4):fl==='ters';
  const Lmode=(X.L_mod||(two?'devre':'toplam')).toLowerCase();
  let aN=X.art_Nu||[1,1], aF=X.art_f||[1,1]; if(!Array.isArray(aN)) aN=[aN,aN]; if(!Array.isArray(aF)) aF=[aF,aF];
  c.ReMin=num(X.art_Re_min,600);
  let grp;
  if(two) grp=g.st.map((s,k)=>({name:s.name,no:s.no,Di:s.Di,Ai1:Math.PI/4*s.Di*s.Di,A_i:s.A_i,Ncirc:s.Ncirc,passes:s.passes,L_circ:s.L_circ,
      L_H:Lmode==='toplam'?g.L_total:Lmode==='devre'?s.L_circ:g.W,UA_air:st[k].UA,R_w:Math.log(s.Do/s.Di)/(2*Math.PI*X.k_tube*s.tubes*g.W),aN:aN[s.no-1],aF:aF[s.no-1]}));
  else grp=[{name:'Whole coil (one circuit set)',no:0,Di:g.Di,Ai1:Math.PI/4*g.Di*g.Di,A_i:g.A_i,Ncirc:g.Ncirc,passes:g.passes,L_circ:g.L_circ,
      L_H:Lmode==='gecis'?g.W:g.L_circ,UA_air:UA_air,R_w:Math.log(X.Do/g.Di)/(2*Math.PI*X.k_tube*g.tubes*g.W),aN:aN[0],aF:aF[0]}];
  const getP=T=>c.tab?props(c.ak,T):{rho:c.f[0],cp:c.f[1],k:c.f[2],mu:c.f[3],out:false};
  const pumpP=(Vd,dp)=>c.pmode==='yok'?[0,0]:[Vd*(dp+c.dp_sys),Vd*(dp+c.dp_sys)/c.eta];
  const groups=(P,mf)=>{ let UA=0,UA_i=0,dp=0; const ic=grp.map(G=>{ const v=mf/(G.Ncirc*P.rho*G.Ai1), Re=P.rho*v*G.Di/P.mu, Pr=P.mu*P.cp/P.k;
      const t=tubeIn(Re,Pr,G.Di,G.L_H,G.aN,G.aF,c.ReMin), hi=t.Nu*P.k/G.Di, UAi=hi*G.A_i, UAk=1/(1/G.UA_air+G.R_w+1/UAi);
      const nb=Math.max(0,G.passes-1), dpk=(t.f*G.L_circ/G.Di+c.K_bend*nb+1.5)*0.5*P.rho*v*v;
      UA+=UAk; UA_i+=UAi; dp+=dpk;
      return {name:G.name,stage:G.no,Ncirc:G.Ncirc,passes:G.passes,L_circ:G.L_circ,L_H:G.L_H,v,Re,Pr,Nu:t.Nu,f:t.f,regime:t.regime,hi,UA_i:UAi,R_w:G.R_w,UA_air:G.UA_air,UA:UAk,dp:dpk,cut:t.cut}; });
    return {ic,UA,UA_i,dp}; };
  const step=Tm=>{ const P=getP(Tm); let mf,r,ph,Qhx;
    if(c.flow!=null){ mf=c.flow/3600*P.rho; r=groups(P,mf); ph=pumpP(mf/P.rho,r.dp); Qhx=c.pmode==='esanjor'?c.Q+ph[1]:c.Q; }
    else { Qhx=c.Q; for(let it=0;it<100;it++){ mf=Qhx/(P.cp*c.dTf); r=groups(P,mf); ph=pumpP(mf/P.rho,r.dp); if(c.pmode!=='esanjor') break;
        const Qn=c.Q+ph[1]; if(Math.abs(Qn-Qhx)<=1e-13*Math.abs(c.Q)) break; Qhx=Qn; } }
    const Cf=mf*P.cp, Cmin=Math.min(c.Ca,Cf), Cr=Cmin/Math.max(c.Ca,Cf), NTU=r.UA/Cmin, ep=epsNTU(NTU,Cr,c.counter);
    const Tin=c.Tout+Qhx/c.Ca, Tf_in=Tin-Qhx/(ep*Cmin), dT=Qhx/Cf;
    return {Tm,P,mf,ic:r.ic,UA:r.UA,UA_i:r.UA_i,dp:r.dp,P_hyd:ph[0],P_shaft:ph[1],Qhx,Cf,NTU,eps:ep,Tin,Tf_in,dT,Tm_new:Tf_in+dT/2}; };
  let runaway=false, x0=Tair-6, e=step(x0);
  if(c.tab){
    if(e.Tm_new<-75) runaway=true;
    else { let F0=e.Tm_new, xa=x0, x1=0.5*x0+0.5*F0; e=step(x1); let F1=e.Tm_new;
      for(let it=0;it<300;it++){ if(F1<-75){runaway=true;break;} const G1=F1-x1; if(Math.abs(G1)<1e-6) break;
        const G0=F0-xa; let xs=0.5*x1+0.5*F1;
        if(G1!==G0){ const xt=x1-G1*(x1-xa)/(G1-G0); if(isFinite(xt)&&Math.abs(xt-x1)<=5*Math.abs(G1)+1) xs=xt; }
        xa=x1; F0=F1; x1=xs; e=step(x1); F1=e.Tm_new; } }
  }
  const ic=e.ic, last=ic[ic.length-1], R={};
  Object.assign(R,{Q,Vf,stages:st,UA_air,UA_i:e.UA_i,R_w:1/grp.reduce((s,G)=>s+1/G.R_w,0),UA:e.UA,NTU:e.NTU,eps:e.eps,counter:c.counter,
    Tin:e.Tin,Tout:Tair,mf:e.mf,v:last.v,Re:last.Re,Pr:last.Pr,regime:last.regime,hi:last.hi,Tf_in:e.Tf_in,Tf_out:e.Tf_in+e.dT,dp_air,dp_f:e.dp,ic});
  R.share_tube=two?ic.reduce((s,q)=>s+q.UA*(q.UA/q.UA_i),0)/ic.reduce((s,q)=>s+q.UA,0):(1/e.UA_i)*e.UA;
  R.Tm=e.Tm_new; R.dT_f=e.dT; R.flow_m3h=e.mf/e.P.rho*3600; R.P_hyd=e.P_hyd; R.P_shaft=e.P_shaft; R.Q_hx=e.Qhx; R.Q_chiller=Q+e.P_shaft;
  R.T_chiller=c.pmode==='chiller'?e.Tf_in-e.P_shaft/e.Cf:e.Tf_in; R.Cf=e.Cf;
  R.fluid=c.name; R.prop={rho:e.P.rho,cp:e.P.cp,k:e.P.k,mu:e.P.mu,out:e.P.out}; R.runaway=runaway; R.mode=two?'two':'old'; R.pmode=c.pmode; R.L_mod=Lmode;
  if(e.P.out&&c.tab) warn.push('Fluid “'+c.name+'”: mean temperature '+R.Tm.toFixed(2)+' °C outside its table ['+Math.min(...c.ak.T)+', '+Math.max(...c.ak.T)+'] °C (extrapolated).');
  ic.forEach(q=>{ if(q.Re>2300&&q.Re<4000) warn.push(q.name+': tube Re = '+q.Re.toFixed(0)+' in the transition range (linear blend).');
    if(q.cut) warn.push(q.name+': Re = '+q.Re.toFixed(0)+' < '+c.ReMin+', turbulator factor not applied.'); });
  if(runaway){ warn.push('Viscosity runaway: mean fluid temperature below −75 °C, no solution (fluid too viscous or coil too small).'); R.Tf_in=R.Tf_out=R.T_chiller=R.Tm=NaN; }
  R.warn=warn; R.g=g; R.air=a;
  return R;
}
function refX(){ return {W:1.5,H:1.5,Do:0.0159,tw:0.0010,Pt:0.050,Pl:0.050,stag:false,N1:2,fp1:0.012,N2:6,fp2:0.008,gap:0.10,tf:0.0003,
  k_fin:200,k_tube:390,Ncirc:0,K_bend:0.5,dTf:3,f_rho:1300,f_cp:2700,f_mu:0.015,f_k:0.45,Q_clean:25015,Q_iced:42575,
  dp_src:'referans',dp_ref:100,V_ref:4.5,n_us:1.8,k_ice:0.3,crho:540,n_e:1.25,capture:1}; }

/* ---------------- droplets (finstad.m, damla_gecit.m) ---------------- */
function finstad(d,D,V,rho,mu){
  const K=1000*d*d*V/(9*mu*D), phi=Math.pow(rho*d*V/mu,2)/K; if(K<=0.17) return 0;
  const A=1.066*Math.pow(K,-0.00616)*Math.exp(-1.103*Math.pow(K,-0.688)), B=3.641*Math.pow(K,-0.498)*Math.exp(-1.497*Math.pow(K,-0.694));
  const C=phi>100?0.00637*Math.pow(phi-100,0.381):0; return Math.max(0,Math.min(1,A-0.028-C*(B-0.045)));
}
const _gate=new Map();
function gate(d,U,R,g,th,rho,mu,N){
  const key=[d,U,R,g,th,rho,mu,N.nr,N.steps,N.nbin,N.stokes].join('|'); if(_gate.has(key)) return _gate.get(key);
  const Ri=R-g/2, Ro=R+g/2, C=U*g/Math.log(Ro/Ri), tau=1000*d*d/(18*mu), nr=N.nr, nb=N.nbin;
  const x=new Float64Array(nr), y=new Float64Array(nr), vx=new Float64Array(nr), vy=new Float64Array(nr), wt=new Float64Array(nr), act=new Uint8Array(nr);
  let ws=0; for(let i=0;i<nr;i++){ const r0=Ri+g*((i+1)-0.5)/nr; x[i]=r0; vy[i]=C/r0; wt[i]=C/r0; ws+=wt[i]; act[i]=1; }
  for(let i=0;i<nr;i++) wt[i]/=ws;
  const dt=(R*th/U)/N.steps, hits=new Float64Array(nb); let cap=0;
  for(let s=0;s<20*N.steps;s++){
    let any=false;
    for(let i=0;i<nr;i++){ if(!act[i]) continue; const r=Math.hypot(x[i],y[i]), ph=Math.atan2(y[i],x[i]);
      if(r>=Ro&&ph<th){ let k=Math.min(nb,Math.floor(ph/th*nb)+1); k=Math.max(k,1); hits[k-1]+=wt[i]; cap+=wt[i]; act[i]=0; continue; }
      if(ph>=th||r<=Ri){ act[i]=0; continue; }
      any=true; }
    if(!any) break;
    for(let i=0;i<nr;i++){ if(!act[i]) continue; const r=Math.hypot(x[i],y[i]), ph=Math.atan2(y[i],x[i]);
      const ux=-C/r*Math.sin(ph), uy=C/r*Math.cos(ph);
      let fD=1; if(!N.stokes){ const Re=rho*Math.hypot(ux-vx[i],uy-vy[i])*d/mu; fD=1+0.197*Math.pow(Re,0.63)+2.6e-4*Math.pow(Re,1.38); }
      const a=Math.exp(-fD*dt/tau); vx[i]=ux+(vx[i]-ux)*a; vy[i]=uy+(vy[i]-uy)*a; x[i]+=vx[i]*dt; y[i]+=vy[i]*dt; }
  }
  const out={cap,hits:Array.from(hits)}; _gate.set(key,out); return out;
}

/* ---------------- ice through the circuit (astral_buz.m) ---------------- */
function firstTime(t,y,lim){ for(let i=0;i<y.length;i++) if(y[i]>=lim) return t[i]/60; return Infinity; }
function waterAndCorners(G){
  const a=air(G.T,G.p), rho=a.rho, mu=a.mu, A_TS=G.TS.w*G.TS.h, Q=G.V*A_TS, m_w=G.LWC*1e-3*Q;
  let f,w; if(G.dist==='tek'){f=[1];w=[1];} else {f=[0.31,0.52,0.71,1.00,1.37,1.74,2.22]; w=[0.05,0.10,0.20,0.30,0.20,0.10,0.05];}
  const d=f.map(x=>G.MVD*1e-6*x); let left=w.slice();
  let cm=d.map(()=>0);
  if(G.model.on){ if(!isNaN(G.model.capture)) cm=d.map(()=>G.model.capture);
    else { const h=G.model.c*(G.model.tc+sind(Math.abs(G.model.alpha))); cm=d.map(di=>Math.min(1,finstad(di,h,G.V,rho,mu)*h/G.TS.h)); } }
  const budget=[{name:'Model',share:left.reduce((s,x,i)=>s+x*cm[i],0)}]; left=left.map((x,i)=>x*(1-cm[i]));
  const nb=G.num.nbin, K=[];
  G.corners.forEach((c,j)=>{
    const A_c=c.w*c.h, U=c.U>0?c.U:Q/A_c, g=c.gap>0?c.gap:c.w/(c.n+1), th=c.turn*Math.PI/180, R=c.chord/(2*Math.sin(th/2));
    let K0=c.K0; if(isNaN(K0)){ const Rec=rho*U*c.chord/mu; K0=0.10+4.55/Math.pow(Math.log10(Rec),2.58); }
    const fLE=Math.min(1,c.n*c.le/c.w), inn=left.slice(), le=d.map(()=>0), pa=d.map(()=>0); let hits=new Array(nb).fill(0);
    d.forEach((di,i)=>{ const E=finstad(di,c.le,U,rho,mu), gp=gate(di,U,R,g,th,rho,mu,G.num); le[i]=fLE*E; pa[i]=(1-fLE)*gp.cap;
      hits=hits.map((h,b)=>h+inn[i]*(1-fLE)*gp.hits[b]); });
    let held; if(c.heated){ held=d.map(()=>0); hits=hits.map(()=>0); le.fill(0); pa.fill(0); } else held=inn.map((x,i)=>x*(le[i]+pa[i]));
    left=inn.map((x,i)=>x-held[i]);
    const sh=held.reduce((s,x)=>s+x,0), si=inn.reduce((s,x)=>s+x,0);
    K.push({name:c.name,U,g,R,th,K0,K0_ref:K0*Math.pow(U/G.V,2),A_c,inn,share:sh,share_LE:inn.reduce((s,x,i)=>s+x*le[i],0),share_gate:inn.reduce((s,x,i)=>s+x*pa[i],0),
      eff:sh/Math.max(si,2.2e-16),hits,stk_mvd:1000*Math.pow(G.MVD*1e-6,2)/(18*mu)*U/g,c});
    budget.push({name:c.name,share:sh});
    if(j+1===G.fan.after){ const fy=G.fan.capture; budget.push({name:'Fan',share:left.reduce((s,x)=>s+x,0)*fy}); left=left.map(x=>x*(1-fy)); }
  });
  const f_hx=left.reduce((s,x)=>s+x,0); budget.push({name:'Coil (rest)',share:f_hx});
  const nt=Math.round(G.t_end/G.num.dt_min), dtt=G.num.dt_min*60, t=[]; for(let i=0;i<=nt;i++) t.push(i*G.num.dt_min*60);
  K.forEach(k=>{ const c=k.c, dphi=k.th/nb;
    const qb=k.hits.map(h=>m_w*h/((c.n+1)*c.h)), raw=qb.map(q=>q/(G.rho_ice*k.R*dphi)), pad=[raw[0]].concat(raw,[raw[nb-1]]);
    const rate=raw.map((_,i)=>(pad[i]+pad[i+1]+pad[i+2])/3);
    let hmax=-Infinity, im=0; rate.forEach((v,i)=>{ if(v>hmax){hmax=v;im=i;} });
    k.rate=rate; k.peak=hmax; k.peak_angle=(im+0.5)*dphi*180/Math.PI;
    const b_lo=t.map(tt=>hmax*tt/k.g); let D=c.le; const bLE=[], Phi=k.inn.map(x=>m_w*x/k.A_c);
    for(let s=0;s<t.length;s++){ bLE.push((D-c.le)/k.g); if(c.heated) continue; let E=0; d.forEach((di,i)=>{ E+=Phi[i]*finstad(di,D,k.U,rho,mu); }); D+=2*E/(Math.PI*G.rho_ice)*dtt; }
    k.b_lo=b_lo; k.b_hi=b_lo.map((v,i)=>Math.max(v,bLE[i])); k.t_lo=firstTime(t,k.b_lo,G.b_lim); k.t_hi=firstTime(t,k.b_hi,G.b_lim);
    k.ice_kg=m_w*k.share*t[t.length-1]; delete k.c; k.heated=c.heated; k.chord=c.chord; k.n=c.n; k.w=c.w; });
  return {rho,mu,Q,m_w,d,f_hx,t,budget,K};
}
function keyNoHx(G){ const o=Object.assign({},G); delete o.hx; delete o.load; return JSON.stringify(o); }
function dpScaled(dp_jk,T0,p,mdot,Q){ const XR=refX(), HR=rate(XR,T0,p,mdot,XR.Q_iced,0), Vr=Q/(XR.W*XR.H);
  const curve=XR.dp_ref*Math.pow(Vr/XR.V_ref,XR.n_us); return {dp:dp_jk*curve/HR.dp_air,curve,ref:HR.dp_air}; }
const _wc=new Map();
function circuitIce(G,P){
  if(!P){ const key=keyNoHx(G); P=_wc.get(key); if(!P){ P=waterAndCorners(G); _wc.set(key,P); if(_wc.size>80) _wc.delete(_wc.keys().next().value); } }
  const {rho,Q,m_w,t,f_hx}=P, K=P.K, X=G.hx, q_TS=0.5*rho*G.V*G.V, T0=G.T+G.V*G.V/(2*CP), mdot=rho*Q, Y=load(G);
  let Qc=num(X.Q_clean,NaN), Qi=num(X.Q_iced,NaN); const src=(isNaN(Qc)||isNaN(Qi))?'load model':'entered';
  if(isNaN(Qc)) Qc=Y.Q_clean; if(isNaN(Qi)) Qi=Y.Q_iced;
  const HXt=rate(X,T0,G.p,mdot,Qc,0), g=HXt.g, V_hx=Q/g.A_face;
  const dp_curve=num(X.dp_ref,100)*Math.pow(V_hx/num(X.V_ref,4.5),num(X.n_us,1.8)), dp_jk=HXt.dp_air, sc=dpScaled(dp_jk,T0,G.p,mdot,Q);
  const srcDp=(X.dp_src||'referans').toLowerCase(), dp_hx=srcDp==='jakob'?dp_jk:srcDp==='olcekli'?sc.dp:dp_curve;
  const K_hx=dp_hx/q_TS, q_w=f_hx*X.capture*m_w/g.A_face, dwdt=q_w/(2*X.crho), open=g.st[0].fp-X.tf;
  const b_hx=t.map(tt=>Math.min(0.999,dwdt*tt/open)), t_hx=firstTime(t,b_hx,G.b_lim), t_ref=Math.min(t_hx,G.t_end)*60;
  const m_ice=q_w*g.A_face*t_ref, dIce=m_ice/(G.rho_ice*g.st[0].A_o);
  const HXb=rate(X,T0,G.p,mdot,Qi,dIce), HXb0=rate(X,T0,G.p,mdot,Qi,0);
  const Kk=K.reduce((s,k)=>s+k.K0_ref,0), K_clean=G.leak*(G.K_other+Kk+K_hx);
  const lam_lo=[], lam_hi=[];
  for(let i=0;i<t.length;i++){ let lo=K_hx*(Math.pow(1-Math.min(b_hx[i],0.95),-X.n_e)-1), hi=lo;
    K.forEach(k=>{ lo+=k.K0_ref*(Math.pow(1-Math.min(k.b_lo[i],0.95),-G.m_loss)-1); hi+=k.K0_ref*(Math.pow(1-Math.min(k.b_hi[i],0.95),-G.m_loss)-1); });
    lam_lo.push((K_clean+G.leak*lo)/K_clean); lam_hi.push((K_clean+G.leak*hi)/K_clean); }
  const times=K.map(k=>k.t_hi).concat([t_hx]), names=K.map(k=>k.name).concat(['Coil']);
  let tmin=Infinity, jmin=-1; times.forEach((v,j)=>{ if(v<tmin){tmin=v;jmin=j;} });
  return {G,rho,m_w,t_min:t.map(x=>x/60),budget:P.budget,corners:K,
    hx:{share:f_hx,b:b_hx,dwdt,t:t_hx,clean:HXt,iced:HXb,iced_noice:HXb0,dIce,t_ref:t_ref/60,K:K_hx,dp:dp_hx,dp_curve,dp_jakob:dp_jk,dp_scaled:sc.dp,V:V_hx,T0,m_ice,Q_clean:Qc,Q_iced:Qi,mdot},
    load:Y,load_src:src,K_clean,K_corners:Kk,q_TS,lam_lo,lam_hi,t_lam:[firstTime(t,lam_lo,G.lam_fan),firstTime(t,lam_hi,G.lam_fan)],
    first:isFinite(tmin)?names[jmin]:'',t_first:tmin,pre:P};
}

/* ---------------- ice matrix → front-stage fin pitch (buz_on_hatve.m) ---------------- */
function Gfrom(ist){ const G=clone(ist.G); Object.assign(G,{V:ist.V,T:ist.T,p:ist.p,LWC:ist.LWC,MVD:ist.MVD,dist:ist.dist});
  G.t_end=Math.max(G.t_end,Math.ceil(1.5*ist.t_target)); G.load=clone(ist.load); return G; }
const SCEN={mevcut:'Corners as built',k12:'Corners 1–2 heated',hepsi:'All four corners heated'};
function cornerScen(G,s){ if(s==='k12') G.corners.slice(0,2).forEach(c=>c.heated=true); else if(s==='hepsi') G.corners.forEach(c=>c.heated=true); return G; }
const tstr=t=>!isFinite(t)?'—':t>999?'> 999':t.toFixed(1);
function iceMatrix(ist,X,progress){
  const G0=Gfrom(ist); let Xb=G0.hx, Xh, withX=false;
  if(!X){ Xh=refX(); Xh.Q_clean=NaN; Xh.Q_iced=NaN; } else { Xh=X; Xb=X; withX=true; }
  G0.hx=Xh;
  const MVDs=Array.from(new Set(ist.ice.MVDs.concat([ist.MVD]))).sort((a,b)=>a-b);
  let sc=ist.ice.scen.slice(); if(sc.indexOf('mevcut')<0) sc=['mevcut'].concat(sc);
  const sizing=ist.ice.sizing, margin=ist.ice.margin, f_floor=ist.ice.f_floor;
  const A_face=Xb.W*Xb.H, crho=Xb.crho, cap=Xb.capture, tf=Xb.tf, b_lim=G0.b_lim, t_h=ist.t_target*60, m_w=ist.LWC*1e-3*ist.V*G0.TS.w*G0.TS.h;
  const cells=[]; let S_nom=null, n=0;
  MVDs.forEach(mvd=>sc.forEach(s=>{
    const Gc=cornerScen(clone(G0),s); Gc.MVD=mvd;
    const S=circuitIce(Gc); n++; if(progress) progress(n/(MVDs.length*sc.length));
    const h={MVD:mvd,scen:s,f_hx:S.hx.share,budget:S.budget,corner_names:S.corners.map(k=>k.name),corner_t_hi:S.corners.map(k=>k.t_hi),corner_t_lo:S.corners.map(k=>k.t_lo),
      corner_heated:S.corners.map(k=>k.heated)};
    h.dwdt=Math.max(h.f_hx,f_floor)*cap*m_w/(A_face*2*crho); h.fp_need=tf+margin*h.dwdt*t_h/b_lim;
    h.t_hx_S=S.hx.t; h.t_lam=S.t_lam; h.first=S.first; h.t_first=S.t_first; h.sizing=sizing.indexOf(s)>=0;
    h.Tf_in_iced=withX?S.hx.iced.Tf_in:NaN;
    cells.push(h); if(mvd===ist.MVD&&s==='mevcut') S_nom=S; }));
  const warn=[]; let ib=cells.map((c,i)=>c.sizing?i:-1).filter(i=>i>=0); if(!ib.length) ib=cells.map((c,i)=>i);
  let fpNeed=-Infinity, gov=ib[0]; ib.forEach(i=>{ if(cells[i].fp_need>fpNeed){fpNeed=cells[i].fp_need;gov=i;} });
  const list=pattern(ist.front.code).fp.slice().sort((a,b)=>a-b);
  let fixed=num(ist.front.fp1,NaN); if(withX) fixed=X.fp1;
  const target=Math.max(fpNeed,ist.front.fp_min); let fp1, short=false;
  if(!isNaN(fixed)){ fp1=fixed; if(fp1<fpNeed-1e-12) short=true; }
  else { const c=list.filter(x=>x>=target-1e-12); if(!c.length){fp1=list[list.length-1];short=true;} else fp1=c[0]; }
  const dwl=cells[gov].dwdt, t_reach=dwl>0?b_lim*(fp1-tf)/(margin*dwl)/60:Infinity;
  if(short) warn.push('The target run time is not met: in the governing case ('+SCEN[cells[gov].scen]+', MVD '+cells[gov].MVD+' µm) the fin pitch needed is '+(1e3*fpNeed).toFixed(1)+' mm; with '+(1e3*fp1).toFixed(1)+' mm (margin '+margin.toFixed(2)+' included) the run lasts '+t_reach.toFixed(1)+' min < '+ist.t_target+' min.');
  cells.forEach(c=>{ c.t_clog=c.dwdt>0?b_lim*(fp1-tf)/c.dwdt/60:Infinity; });
  const inom=cells.findIndex(c=>c.MVD===ist.MVD&&c.scen==='mevcut'), hn=cells[inom];
  const tk=hn.corner_t_hi.map((v,i)=>hn.corner_heated[i]?Infinity:v); let tkmin=Infinity, jk=0; tk.forEach((v,i)=>{ if(v<tkmin){tkmin=v;jk=i;} });
  if(isFinite(tkmin)&&tkmin<hn.t_clog) warn.push('With the corners as built, '+hn.corner_names[jk]+' ends the run, not the coil ('+ist.V+' m/s, MVD '+ist.MVD+' µm: '+tkmin.toFixed(1)+' min; coil '+tstr(hn.t_clog)+' min).');
  const hm=cells.filter(c=>c.scen==='mevcut'); let a1=hm[0]; hm.forEach(c=>{ if(c.f_hx>a1.f_hx) a1=c; });
  let a2=hm[0], k2=Infinity; hm.forEach(c=>{ const m=Math.min(...c.corner_t_hi); if(m<k2){k2=m;a2=c;} });
  warn.push('With the corners as built the worst case for the coil is a small droplet (most water at MVD '+a1.MVD+' µm, '+(100*a1.f_hx).toFixed(1)+' %), for the corners a large droplet (shortest corner time at MVD '+a2.MVD+' µm, '+tstr(k2)+' min).');
  const ih=cells.filter(c=>c.scen==='hepsi'); if(ih.length){ let hh=ih[0]; ih.forEach(c=>{ if(c.t_clog<hh.t_clog) hh=c; });
    warn.push('Extreme case (all four corners heated, MVD '+hh.MVD+' µm): '+(100*hh.f_hx).toFixed(1)+' % of the water reaches the coil; with '+(1e3*fp1).toFixed(1)+' mm the front stage closes in '+tstr(hh.t_clog)+' min.'); }
  warn.push('Frost from the air moisture between the fins is not modelled; the real run can be shorter.');
  warn.push('c·ρ = 540 kg/m³ and b_lim = 0.6 are project estimates fitted to one observation in NASA TM-100116.');
  const f_size=Math.max(cells[gov].f_hx,f_floor);
  return {MVDs,scen:sc,sizing,cells,gov,fpNeed,fp1,list,t_reach,short,f_size,m_w,A_face,crho,b_lim,margin,tf,
    m_ice_target:f_size*cap*m_w*t_h,rho_ice:G0.rho_ice,inom,warn,withX,S_nom};
}

/* ---------------- design tool (esanjor_tasarim.m) ---------------- */
function buildX(Xb,fr,N1,fp1,mn,N2,fp2,Nc1,Nc2,flow,ak,Lm,ist){
  const X=clone(Xb);
  Object.assign(X,{Do:fr.Do,tw:fr.tw,Pt:fr.Pt,Pl:fr.Pl,stag:fr.stag,N1,fp1,N2,fp2,Do2:mn.Do,tw2:mn.tw,Pt2:mn.Pt,Pl2:mn.Pl,stag2:mn.stag,
    Ncirc:0,Ncirc1:Nc1,Ncirc2:Nc2,fluid:ak,flow_m3h:flow,L_mod:Lm,flow:'oto'});
  X.art_Nu=ist.wire.on?[1,ist.wire.Nu]:[1,1]; X.art_f=ist.wire.on?[1,ist.wire.f]:[1,1]; if(X.art_Re_min==null) X.art_Re_min=600;
  X.pump={mode:ist.pump.mode,dp_sys:ist.pump.dp_sys,eta:ist.pump.eta}; X.Q_clean=NaN; X.Q_iced=NaN; X.dp_src='jakob';
  return X;
}
function circList(tubes,Nmax){ const L=[]; for(let d=1;d<=tubes;d++) if(tubes%d===0){ const g=tubes/d; if(g>=2&&g%2===0&&d<=Nmax) L.push(d); } return L; }
const hasTransition=R=>R.ic.some(q=>q.Re>2300&&q.Re<4000);
function violations(R,K,T0){
  let Tch=R.T_chiller; if(!isFinite(Tch)) Tch=R.Tf_in; const v=R.ic.map(q=>q.v), vmx=Math.max(...v);
  let n=0; n+=R.dp_f>K.dp_f_max?1:0; n+=(vmx>K.v_max+1e-12?1:0)+(Math.min(...v)<K.v_min-1e-12?1:0);
  n+=R.dp_air>K.dp_air_max?1:0; n+=R.g.depth>K.depth_max+1e-9?1:0; n+=Math.max(...R.ic.map(q=>q.Ncirc))>K.Nc_max?1:0; n+=(R.Tf_in<T0)?0:1;
  if(K.no_transition) n+=hasTransition(R)?1:0; return {n,Tch,vmx};
}
function Tch_floor(ak,K,ist){ const dmax=Math.max(...ist.chiller.dT_evap); const a=[ak.Tmin,K.T_evap_min+dmax,ak.Tfreeze+dmax+K.freeze_margin].filter(x=>isFinite(x));
  return a.length?Math.max(...a):-Infinity; }
const tch=R=>isFinite(R.T_chiller)?R.T_chiller:R.Tf_in;
function design(ist,progress){
  const t0=Date.now(), P=progress||(()=>{});
  ist=Object.assign(defaults(),ist||{}); const warn=[];
  const G=Gfrom(ist), Y=load(G), T0=Y.T0, mdot=Y.mdot, Qi=Y.Q_iced, Qc=Y.Q_clean, p=ist.p;
  const fr=pattern(ist.front.code); let B=null, fp1;
  P('ice',0);
  if(ist.ice.run){ B=iceMatrix(ist,null,f=>P('ice',f)); fp1=B.fp1; } else { fp1=ist.front.fp1; if(isNaN(fp1)) throw new Error('Front-stage fin pitch must be given when the ice matrix is off.'); }
  const Xb=ist.G.hx;
  const Xon=buildX(Xb,fr,ist.front.N1,fp1,fr,2,fp1,30,30,20,'HC-50','devre',ist), R0=rate(Xon,T0,p,mdot,Qi,0), A_o1=R0.g.st[0].A_o;
  const dIce=B?B.m_ice_target/(B.rho_ice*A_o1):0;
  const XR=refX(), RR=rate(XR,T0,p,mdot,XR.Q_iced,0), V_hx=Y.Q_air/(Xb.W*Xb.H), dp_curve=XR.dp_ref*Math.pow(V_hx/XR.V_ref,XR.n_us), scale=dp_curve/RR.dp_air;
  const K=ist.lim, codes=ist.main.codes, names=ist.fluids;
  let n_eval=0, n_valid=0, n_trans=0; const all=[], FL=[];
  const total=names.length*codes.length; let done=0;
  names.forEach((nm,ia)=>{
    const vt=fluid(nm), a={name:vt.name,vt,status:'',patterns:[],best:null,T_ch_top:NaN,recommendable:false,suitable:false,why:[],key:-Infinity};
    let rows=[], least=null; const T_alt=Tch_floor(vt,K,ist);
    codes.forEach((code,ic)=>{
      const mn=pattern(code), Nt1=Math.floor(Xb.H/fr.Pt+1e-9), tubes1=ist.front.N1*Nt1, Nt2=Math.floor(Xb.H/mn.Pt+1e-9);
      const Di1=fr.Do-2*fr.tw, Di2=mn.Do-2*mn.tw, Nc1L=circList(tubes1,K.Nc_max), sat=[];
      ist.main.N2.forEach(N2=>{
        const dep=ist.front.N1*fr.Pl+Xb.gap+N2*mn.Pl; if(dep>K.depth_max+1e-9) return;
        const Nc2L=circList(N2*Nt2,K.Nc_max);
        mn.fp.forEach(fp2=>Nc1L.forEach(Nc1=>Nc2L.forEach(Nc2=>ist.flows.forEach(flow=>{
          const Vd=flow/3600, v1=Vd/(Nc1*Math.PI/4*Di1*Di1), v2=Vd/(Nc2*Math.PI/4*Di2*Di2);
          if(Math.max(v1,v2)>K.v_max||Math.min(v1,v2)<K.v_min) return;
          const X=buildX(Xb,fr,ist.front.N1,fp1,mn,N2,fp2,Nc1,Nc2,flow,vt,'devre',ist); n_eval++;
          let R; try{ R=rate(X,T0,p,mdot,Qi,dIce); }catch(e){ return; }
          if(R.runaway) return;
          const V=violations(R,K,T0); if(K.no_transition&&hasTransition(R)) n_trans++;
          const row={ia,ic,code,N2,fp2,Nc1,Nc2,flow,Tch:V.Tch,Tf_in:R.Tf_in,P:R.P_shaft||0,dp_f:R.dp_f,dp_air:R.dp_air,vmx:V.vmx,Nc:Nc1+Nc2,depth:R.g.depth,nv:V.n};
          if(V.n===0) sat.push(row); else if(!least||V.n<least.nv||(V.n===least.nv&&V.Tch>least.Tch)) least=row;
        })))); });
      n_valid+=sat.length; rows=rows.concat(sat);
      const s=pickRow(sat,ist,fr,fp1,vt,Xb,T0,p,mdot,Qc,T_alt);
      a.patterns.push({code,pick:s.row,top:s.top,n_valid:sat.length});
      done++; P('scan',done/total);
    });
    all.push(...rows);
    const s=pickRow(rows,ist,fr,fp1,vt,Xb,T0,p,mdot,Qc,T_alt); a.T_alt=T_alt;
    if(!s.row){ a.status='no feasible design'; a.least=least; if(least) a.why.push('No geometry meets every constraint; the closest one breaks '+least.nv+'.'); FL.push(a); return; }
    a.T_ch_top=s.top; a.best=detail(s.row,ist,fr,fp1,vt,Xb,T0,p,mdot,Qi,Qc,dIce,scale,K); a.status='rated';
    const e=a.best; a.why=e.why.slice(); a.suitable=e.suitable;
    if(!s.floor_ok) a.why.push('no geometry meets the fluid limits (supply ≥ '+T_alt.toFixed(1)+' °C); the best one is shown');
    a.recommendable=vt.data==='full'&&vt.ok;
    if(!vt.ok) a.why.push('the data record is marked not recommendable (old / conflicting, or regression only).');
    a.penalty=(ist.nonflam_pref&&vt.flam)?ist.flam_penalty:0; a.key=e.T_ch-a.penalty; FL.push(a);
  });
  const order=FL.map((a,i)=>i).filter(i=>FL[i].best).sort((i,j)=>FL[j].key-FL[i].key);
  let rec=order.find(i=>FL[i].recommendable&&FL[i].suitable), fallback=false;
  if(rec===undefined){ rec=order.find(i=>FL[i].recommendable); fallback=true;
    if(rec===undefined) warn.push('No fluid gives a design that meets the constraints; nothing is recommended.');
    else warn.push('No fluid meets every constraint; the best fluid with full data ('+FL[rec].name+') is recommended conditionally. Reasons in the table.'); }
  const O=rec!==undefined?{fluid:FL[rec].name,ia:rec,X:FL[rec].best.X,e:FL[rec].best,conditional:fallback}:{fluid:'',X:null,conditional:true};
  /* K_top sensitivity */
  const DK=[];
  if(O.X){ const Kt=Y.par.K_top; [[0.5175,'matlab_v2 (50 m/s K)'],[Kt,'default'],[0.8*Kt,'−20 %'],[1.2*Kt,'+20 %']].forEach(([kv,lab])=>{
    const Gk=clone(G); Gk.load.K_top=kv; const Yk=load(Gk), q={label:lab,K_top:kv,Q_clean:Yk.Q_clean,Q_iced:Yk.Q_iced,T_ch:NaN,T_ch_clean:NaN,Re:[NaN,NaN],trans:false,P:NaN};
    try{ const Rk=rate(O.X,T0,p,mdot,Yk.Q_iced,dIce), Rt=rate(O.X,T0,p,mdot,Yk.Q_clean,0); q.T_ch=tch(Rk); q.T_ch_clean=tch(Rt); q.Re=Rk.ic.map(x=>x.Re); q.P=Rk.P_shaft; q.trans=hasTransition(Rk)||hasTransition(Rt); }catch(e){}
    DK.push(q); }); }
  /* ice run with the recommended coil */
  let S=null, B2=null;
  if(O.X&&ist.run_circuit){ P('verify',0); if(ist.ice.run) B2=iceMatrix(ist,O.X,f=>P('verify',f)); const Gn=clone(G); Gn.hx=O.X; S=circuitIce(Gn,B2?B2.S_nom.pre:null); }
  if(B) warn.push(...B.warn);
  P('done',1);
  return {ist,load:Y,point:{T0,mdot,Q_iced:Qi,Q_clean:Qc,p},ice:B,ice2:B2,fp1,dIce,A_o1,scale,dp_curve,
    cand:{rows:all,n_eval,n_valid,n_trans},fluids:FL,order,rec:O,sensK:DK,S,warn,ms:Date.now()-t0};
}
function pickRow(rows,ist,fr,fp1,ak,Xb,T0,p,mdot,Qc,T_alt){
  let floor_ok=true; if(!rows.length) return {row:null,top:NaN,floor_ok};
  if(rows.some(r=>r.Tch>=T_alt)) rows=rows.filter(r=>r.Tch>=T_alt); else floor_ok=false;
  rows=rows.slice().sort((a,b)=>b.Tch-a.Tch);
  const ok=new Array(rows.length).fill(null); let top=NaN;
  for(let i=0;i<rows.length;i++){ ok[i]=cleanSolves(rows[i],ist,fr,fp1,ak,Xb,T0,p,mdot,Qc); if(ok[i]){top=rows[i].Tch;break;} }
  if(isNaN(top)) return {row:null,top,floor_ok};
  const c=[]; rows.forEach((r,i)=>{ if(r.Tch>=top-0.3){ if(ok[i]===null) ok[i]=cleanSolves(r,ist,fr,fp1,ak,Xb,T0,p,mdot,Qc); if(ok[i]) c.push(r); } });
  c.sort((a,b)=>(a.P-b.P)||(a.N2-b.N2)||(a.Nc-b.Nc)||(a.dp_air-b.dp_air));
  return {row:c[0],top,floor_ok};
}
function cleanSolves(r,ist,fr,fp1,ak,Xb,T0,p,mdot,Qc){
  const X=buildX(Xb,fr,ist.front.N1,fp1,pattern(r.code),r.N2,r.fp2,r.Nc1,r.Nc2,r.flow,ak,'devre',ist);
  try{ const R=rate(X,T0,p,mdot,Qc,0); let ok=!R.runaway; if(ok&&ist.lim.no_transition&&hasTransition(R)) ok=false; return ok; }catch(e){ return false; }
}
function detail(r,ist,fr,fp1,ak,Xb,T0,p,mdot,Qi,Qc,dIce,scale,K){
  const mn=pattern(r.code), X=buildX(Xb,fr,ist.front.N1,fp1,mn,r.N2,r.fp2,r.Nc1,r.Nc2,r.flow,ak,'devre',ist), e={row:r,code:mn.code,pattern:mn};
  const Xi=Object.assign(clone(X),{L_mod:'gecis'});
  e.R=rate(X,T0,p,mdot,Qi,dIce); e.R_opt=rate(Xi,T0,p,mdot,Qi,dIce); e.R_clean=rate(X,T0,p,mdot,Qc,0); e.R_clean_opt=rate(Xi,T0,p,mdot,Qc,0);
  e.R_hxmode=rate(Object.assign(clone(X),{pump:Object.assign({},X.pump,{mode:'esanjor'})}),T0,p,mdot,Qi,dIce);
  e.R_cross=rate(Object.assign(clone(X),{flow:'capraz'}),T0,p,mdot,Qi,dIce);
  e.T_ch=tch(e.R); e.T_ch_opt=tch(e.R_opt); e.T_ch_clean=tch(e.R_clean); e.T_ch_clean_opt=tch(e.R_clean_opt); e.dp_scaled=e.R.dp_air*scale;
  X.fluid=ak.name; e.X=X;
  const R=e.R, mu_m=props(ak,R.Tm).mu, D=props('Dowtherm J',R.Tm), cp_m=R.prop.cp;
  e.need={stages:R.ic.map((q,k)=>{ const s=R.g.st[k], md=R.mf/q.Ncirc; return {stage:k+1,Di:s.Di,m_circ:md,mu_max:[2300,4000,6000].map(Re=>4*md/(Math.PI*s.Di*Re)),mu:mu_m}; }),
    merit:(D.mu*D.cp)/(mu_m*cp_m),mu:mu_m,cp:cp_m,Tm:R.Tm};
  const dT=ist.chiller.dT_evap, dmax=Math.max(...dT);
  e.need.T_freeze_max=e.T_ch-dmax-K.freeze_margin;
  e.chiller={T_supply:e.T_ch,T_evap:dT.map(x=>e.T_ch-x),T_evap_min:e.T_ch-dmax,CO2_triple:-56.6,CO2_margin:e.T_ch-dmax+56.6,Q:R.Q_chiller,Q_clean:e.R_clean.Q_chiller};
  /* capacity to specify (esanjor_tasarim.m e.chiller.Q_secim): margin on the iced load, pump heat as computed */
  e.chiller.marj=num((ist.load||{}).marj,1.30); e.chiller.Q_sel=e.chiller.marj*Math.max(Qi,Qc)+num(R.P_shaft,0);
  e.why=[]; e.suitable=true; e.Tmin=ak.Tmin; e.Tmin_margin=e.T_ch-ak.Tmin;
  if(isFinite(ak.Tmin)&&e.T_ch<ak.Tmin){ e.suitable=false; e.why.push('supply '+e.T_ch.toFixed(1)+' °C below the lowest use temperature '+ak.Tmin+' °C'); }
  e.trans=hasTransition(e.R)||hasTransition(e.R_clean);
  if(e.trans&&K.no_transition){ e.suitable=false; e.why.push('a stage is in the transition range (2300 < Re < 4000)'); }
  if(e.chiller.T_evap_min<K.T_evap_min){ e.suitable=false; e.why.push('evaporating '+e.chiller.T_evap_min.toFixed(1)+' °C below the limit '+K.T_evap_min.toFixed(1)+' °C'); }
  if(isNaN(ak.Tfreeze)){ e.freeze_margin=NaN; e.why.push('freezing point unknown: freeze margin not checked'); }
  else { e.freeze_margin=e.chiller.T_evap_min-ak.Tfreeze; if(e.freeze_margin<K.freeze_margin){ e.suitable=false; e.why.push('freeze margin '+e.freeze_margin.toFixed(1)+' K < '+K.freeze_margin.toFixed(1)+' K'); } }
  if(e.R_clean.runaway){ e.suitable=false; e.why.push('no solution at the clean load (viscosity runaway)'); }
  if(e.dp_scaled>K.dp_air_max) e.why.push('note: scaled air Δp '+e.dp_scaled.toFixed(0)+' Pa > '+K.dp_air_max.toFixed(0)+' Pa (Jakob '+e.R.dp_air.toFixed(0)+' Pa)');
  return e;
}

const API={CP,FLUIDS,fluid,props,PATTERNS,pattern,air,defaults,defaultG,defaultX,load,rate,refX,finstad,gate,waterAndCorners,circuitIce,iceMatrix,design,SCEN,epsNTU,tubeIn};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.HXCore=API;
})(typeof self!=='undefined'?self:this);
