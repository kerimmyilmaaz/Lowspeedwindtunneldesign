/* Smokeline · closed-circuit icing wind tunnel · finned-tube coil designer (engine part)
   Rates a two-stage plate-fin / round-tube cooling coil that fills the heat-exchanger section of the circuit:
   air-side film coefficient, fin efficiency, tube-side film coefficient, UA, counter-flow ε-NTU, the secondary-fluid
   inlet temperature the load needs, both pressure drops, metal mass, and leading-edge ice blockage in a spray run.

   Status of the relations (kept visible on the page and in the PDF):
   [VDI] air side, Nu_d = C Re_d^0.6 (A/A_t0)^-0.15 Pr^1/3, C = 0.22 in-line / 0.38 staggered (>= 4 rows), 0.20 in-line
         below 4 rows, 0.33 / 0.36 staggered with 2 / 3 rows. Checked against the open-source `ht` library
         (h_Ganguli_VDI, citing VDI Heat Atlas 2nd ed. and Ganguli, Tung & Taborek 1985). It was fitted to bundles of
         individually finned tubes; using it for continuous plate fins is an approximation.
   [SCH] fin efficiency, Schmidt (1949): eta = tanh(m r phi)/(m r phi), phi = (Re/r - 1)(1 + 0.35 ln(Re/r)),
         Re/r = 1.28 psi sqrt(beta - 0.2) for a rectangular fin cell (in-line), 1.27 psi sqrt(beta - 0.3) hexagonal
         (staggered). Form checked against ASHRAE Fundamentals and the ACHP documentation.
   [GN]  tube side, turbulent: Gnielinski (1976) with the Petukhov friction factor; laminar: Hausen thermal entry
         length relation; linear blend for 2300 < Re < 4000. Textbook forms (Incropera), not re-read in the originals.
   [JK]  air-side pressure-drop cross-check: Jakob (1938) bare tube-bank friction as given by Holman, plus smooth
         parallel-plate friction in the fin channels. NOT verified against the primary source; a cross-check only.
   [FIN] collection efficiency of a cylinder, Finstad, Lozowski & Gates (1988); coefficients verified from
         Finstad's 1986 thesis (Eq. II.1-II.2, Table II.6).
   [MS]  rime density, Makkonen & Stallabrass (1984): rho = 378 + 425 log R - 82.3 (log R)^2, R = -r V0 / Ts.
   [T]   leading-edge horn blockage: the project's own model. c rho_ice ~ 540 kg/m3 and n_e ~ 1.1-1.4 were fitted to
         a single observation in NASA TM-100116 (about 4 mm horn width after 39 corrected minutes) on a different
         coil (0.78 mm galvanised fins, 8.5 mm pitch). A hypothesis, not a design value, until it is fitted to
         measurements on the actual coil. Growth assumes collection efficiency 1, which overestimates the rate as
         the horn widens.
   Cross-flow effectiveness (both fluids unmixed) for circuits with fewer than four passes: the usual approximation
   eps = 1 - exp[(NTU^0.22/Cr)(exp(-Cr NTU^0.78) - 1)] as given by Incropera. Textbook form.
   Fluid side: the stages are in series (main-stage outlet header piped to the front-stage inlet header), so every
   circuit runs through all rows; staggered rows keep the same tube count and are offset by +/- a quarter pitch. */
(function(){
'use strict';
const E=window.IcingEngine; if(!E) return;
const CP=1005, RA=287.058;
Object.assign(E.REFS,{
  VDI:{k:'VDI',t:'VDI Heat Atlas, 2nd ed. (2010). Springer. Finned tube bundles in cross-flow; Ganguli, A., Tung, S. S., Taborek, J. (1985). Parametric study of air-cooled heat exchanger finned tube geometry. AIChE Symp. Ser. 81, 122–128.'},
  SCH:{k:'SCH',t:'Schmidt, T. E. (1949). Heat transfer calculations for extended surfaces. Refrigerating Engineering 57, 351–357.'},
  GN: {k:'GN', t:'Gnielinski, V. (1976). New equations for heat and mass transfer in turbulent pipe and channel flow. Int. Chem. Eng. 16, 359–368; Hausen, H. (1943) thermal entry length relation (laminar).'},
  JK: {k:'JK', t:'Jakob, M. (1938). Heat transfer and flow resistance in cross flow of gases over tube banks. Trans. ASME 60, 384–386 (as given by Holman, Heat Transfer). Cross-check only, not verified against the original.'},
  FIN:{k:'FIN',t:'Finstad, K. J., Lozowski, E. P., Gates, E. M. (1988). A computational investigation of water droplet trajectories. J. Atmos. Oceanic Technol. 5, 160–170.'},
  MS: {k:'MS', t:'Makkonen, L., Stallabrass, J. R. (1984). Ice accretion on cylinders and wires. NRC Canada TR-LT-005.'}
});

/* [FIN] overall collection efficiency of a cylinder of diameter D for droplets of diameter d */
function finstad(d,D,V,rho,mu){
  const K=1000*d*d*V/(9*mu*D), Re=rho*d*V/mu, phi=Re*Re/K;
  if(K<=0.17) return {K,phi,E:0};
  const A=1.066*Math.pow(K,-0.00616)*Math.exp(-1.103*Math.pow(K,-0.688));
  const B=3.641*Math.pow(K,-0.498)*Math.exp(-1.497*Math.pow(K,-0.694));
  const C=phi>100?0.00637*Math.pow(phi-100,0.381):0;
  return {K,phi,E:Math.max(0,Math.min(1,A-0.028-C*(B-0.045)))};
}
/* [MS] rime density [kg/m3]; r in µm, V0 impact speed m/s, Ts surface temperature °C (< 0) */
function rimeDensity(d_um,V0,Ts){
  if(!(Ts<0)) return {R:NaN,rho:917};
  const R=(d_um/2)*V0/(-Ts), L=Math.log10(Math.max(R,0.2));
  return {R,rho:Math.max(100,Math.min(917,378+425*L-82.3*L*L))};
}
/* [GN] tube-side Nusselt number and Darcy friction factor */
function tubeSide(Re,Pr,D,L){
  const lam=()=>{ const Gz=Re*Pr*D/L; return 3.66+0.0668*Gz/(1+0.04*Math.pow(Gz,2/3)); };
  const tur=R=>{ const f=Math.pow(0.79*Math.log(R)-1.64,-2); return (f/8)*(R-1000)*Pr/(1+12.7*Math.sqrt(f/8)*(Math.pow(Pr,2/3)-1)); };
  const fl=64/Math.max(Re,1), ft=R=>Math.pow(0.79*Math.log(R)-1.64,-2);
  if(Re<2300) return {Nu:lam(),f:fl,regime:'laminar'};
  if(Re>4000) return {Nu:tur(Re),f:ft(Re),regime:'turbulent'};
  const w=(Re-2300)/1700;
  return {Nu:(1-w)*lam()+w*tur(4000),f:(1-w)*64/2300+w*ft(4000),regime:'transitional'};
}

/* geometry that does not depend on the operating point */
function geometry(G,R){
  const c=G.coil, side=R.yer==='ayri'?R.geo.s34:R.geo.s_dn, W=side, H=side;
  const Di=c.Do-2*c.tw, Nt=Math.max(1,Math.floor(H/c.Pt+1e-9)), stag=c.arr==='stag';
  const Pd=Math.sqrt(c.Pt*c.Pt/4+c.Pl*c.Pl), gapT=c.Pt-c.Do, gapD=2*(Pd-c.Do);
  const stages=[{id:'front',name:'Front stage',rows:c.N1,fp:c.fp1},{id:'main',name:'Main stage',rows:c.N2,fp:c.fp2}].filter(s=>s.rows>0).map(s=>{
    const nfin=Math.max(1,Math.round(W/s.fp)), cell=H*c.Pl-Nt*Math.PI*c.Do*c.Do/4;
    const A_fin=s.rows*nfin*2*cell, A_t0=s.rows*Nt*Math.PI*c.Do*W, A_tube=A_t0*(1-c.tf/s.fp), A_o=A_fin+A_tube;
    const sig=(stag?Math.min(gapT,gapD):gapT)/c.Pt*(1-c.tf/s.fp);
    return Object.assign(s,{nfin,A_fin,A_t0,A_tube,A_o,sig,depth:s.rows*c.Pl,A_i:s.rows*Nt*Math.PI*Di*W,
      m_fin:nfin*s.rows*cell*c.tf*c.rho_fin});
  });
  const rows=stages.reduce((a,s)=>a+s.rows,0), tubes=rows*Nt, want=c.Ncirc>0?Math.min(c.Ncirc,tubes):Nt;
  let Ncirc=1; for(let d=1;d<=tubes;d++) if(tubes%d===0&&Math.abs(d-want)<Math.abs(Ncirc-want)) Ncirc=d;   /* whole passes only */
  const passes=tubes/Ncirc, L_circ=passes*W, depth=stages.reduce((a,s)=>a+s.depth,0)+(stages.length>1?c.gap:0);
  const m_tube=tubes*W*Math.PI/4*(c.Do*c.Do-Di*Di)*c.rho_tube, m_fin=stages.reduce((a,s)=>a+s.m_fin,0);
  const V_fluid=tubes*W*Math.PI/4*Di*Di;
  return {W,H,A_face:W*H,Di,Nt,stag,Pd,stages,rows,tubes,Ncirc,Nwant:want,passes,L_circ,depth,m_tube,m_fin,m_metal:m_tube+m_fin,V_fluid,
    A_o:stages.reduce((a,s)=>a+s.A_o,0),A_i:stages.reduce((a,s)=>a+s.A_i,0),nfin:stages.reduce((a,s)=>a+s.nfin,0)};
}

/* air side of one stage; dIce = equivalent uniform ice layer on that stage [m] */
function airSide(G,g,s,air,Vf,dIce){
  const c=G.coil, Vmax=Vf/s.sig, Re=air.rho*Vmax*c.Do/air.mu, Pr=air.mu*CP/air.k;
  const C=g.stag?(s.rows>=4?0.38:s.rows===3?0.36:s.rows===2?0.33:0.20):(s.rows>=4?0.22:0.20);
  const Nu=C*Math.pow(Re,0.6)*Math.pow(s.A_o/s.A_t0,-0.15)*Math.pow(Pr,1/3), h=Nu*air.k/c.Do;
  const he=1/(1/h+(dIce||0)/c.k_ice);
  const r=c.Do/2, M=Math.min(c.Pt/2,g.stag?g.Pd/2:c.Pl/2), Lh=Math.max(c.Pt/2,g.stag?g.Pd/2:c.Pl/2), psi=M/r, beta=Lh/M;
  const Rq=g.stag?1.27*psi*Math.sqrt(Math.max(beta-0.3,0.05)):1.28*psi*Math.sqrt(Math.max(beta-0.2,0.05));
  const phi=(Rq-1)*(1+0.35*Math.log(Math.max(Rq,1.0001))), m=Math.sqrt(2*he/(c.k_fin*c.tf)), x=m*r*phi;
  const eta=x>1e-9?Math.tanh(x)/x:1, eo=1-s.A_fin/s.A_o*(1-eta);
  /* [JK] cross-check Δp: bare bank + fin channels (hydraulic diameter 2 × gap), entry + exit 0.5 velocity heads */
  const a=c.Pt/c.Do, b=c.Pl/c.Do;
  const fj=g.stag?(0.25+0.118/Math.pow(a-1,1.08))*Math.pow(Re,-0.16):(0.044+0.08*b/Math.pow(a-1,0.43+1.13/b))*Math.pow(Re,-0.15);
  const dp_bank=2*fj*air.rho*Vmax*Vmax*s.rows;
  const sgap=s.fp-c.tf, Vch=Vf/(1-c.tf/s.fp), Dh=2*sgap, Rech=air.rho*Vch*Dh/air.mu, fch=Rech<2300?96/Math.max(Rech,1):0.316*Math.pow(Rech,-0.25);
  const dp_fin=(fch*s.depth/Dh+0.5)*0.5*air.rho*Vch*Vch;
  return {Vmax,Re,Nu,h,he,eta,eo,UA:eo*he*s.A_o,dp:dp_bank+dp_fin,dp_bank,dp_fin,C};
}

/* one thermal case: load Q [W] removed by the coil, mdot air, uniform ice layer on the front stage */
function rate(G,g,air,mdot,Tout,Q,dIceFront){
  const c=G.coil, Vf=mdot/(air.rho*g.A_face);
  const st=g.stages.map((s,ix)=>Object.assign({id:s.id,name:s.name},airSide(G,g,s,air,Vf,ix===0?dIceFront:0)));
  const UA_air=st.reduce((a,s)=>a+s.UA,0), dp_air=st.reduce((a,s)=>a+s.dp,0);
  const mf=Q/(c.f_cp*c.dTf), Ai1=Math.PI/4*g.Di*g.Di, v=mf/(g.Ncirc*c.f_rho*Ai1), Re=c.f_rho*v*g.Di/c.f_mu, Pr=c.f_mu*c.f_cp/c.f_k;
  const ts=tubeSide(Re,Pr,g.Di,g.L_circ), hi=ts.Nu*c.f_k/g.Di, UA_i=hi*g.A_i;
  const R_w=Math.log(c.Do/g.Di)/(2*Math.PI*c.k_tube*g.tubes*g.W);
  const UA=1/(1/UA_air+R_w+1/UA_i);
  const Ca=mdot*CP, Cf=mf*c.f_cp, Cmin=Math.min(Ca,Cf), Cr=Cmin/Math.max(Ca,Cf), NTU=UA/Cmin;
  const counter=g.passes>=4;
  const eps=counter?(Math.abs(1-Cr)<1e-6?NTU/(1+NTU):(1-Math.exp(-NTU*(1-Cr)))/(1-Cr*Math.exp(-NTU*(1-Cr)))):
    1-Math.exp(Math.pow(NTU,0.22)/Cr*(Math.exp(-Cr*Math.pow(NTU,0.78))-1));
  const Tin=Tout+Q/Ca, Tf_in=Tin-Q/(eps*Cmin), Tf_out=Tf_in+c.dTf;
  const nb=Math.max(0,g.passes-1), dp_f=(ts.f*g.L_circ/g.Di+c.K_bend*nb+1.5)*0.5*c.f_rho*v*v, Vdot=mf/c.f_rho;
  return {Q,Vf,st,UA_air,UA_i,R_w,UA,NTU,eps,counter,Cr,Tin,Tout,dT_air:Q/Ca,mf,Vdot,v,Re,Pr,regime:ts.regime,Nu_i:ts.Nu,hi,Tf_in,Tf_out,
    dp_air,dp_f,P_pump:dp_f*Vdot,share:{air:(1/UA_air)*UA,wall:R_w*UA,tube:(1/UA_i)*UA}};
}

/* steady heat load at the target temperature, same terms as E.ops: fan (+ motor), walls, spray water */
function coilLoad(G,R,Tc,LWC){
  const fm=G.motorIn?1/G.eta_m:1, U=1/(1/G.ins.hi+G.ins.t/G.ins.k+1/G.ins.ho), Pf0=R.P_mil*fm, md=LWC*1e-3*R.Q;
  return {Pf0,PfL:G.buz.lamF*Pf0,Qd:U*R.A_duvar*(G.Tlab-Tc),Qsp:md*(4183*G.sp.Tw+334e3+2050*(0-Tc)),Qx:(LWC>0?G.coil.Q_at:0)+G.coil.Q_oth};
}
/* full result for a scenario s = {V, Tc, h, R} at the cloud LWC [g/m3] */
function coil(G,s,LWC){
  const c=G.coil, R=s.R, g=geometry(G,R), h=s.h, load=coilLoad(G,R,s.Tc,LWC);
  const T0=s.Tc+s.V*s.V/(2*CP), air=Object.assign(E.air(T0,h.p),{});       /* settling-chamber air ≈ total temperature */
  const mdot=R.mdot, extra=load.Qx;
  const Qc=load.Pf0+load.Qd+load.Qsp+extra, Qi=load.PfL+load.Qd+load.Qsp+extra;
  /* leading-edge ice: flux on the face, horn width w(t) on the front-stage fin edges [T] */
  const fp=g.stages[0].fp, q_w=c.f_w*LWC*1e-3*s.V*R.A_TS/g.A_face, dwdt=q_w/(2*c.crho), span=fp-c.tf;
  const bAt=t=>Math.min(0.999,dwdt*t/span), tB=b=>dwdt>0?b*span/dwdt:Infinity;
  const hxB=R.bil.find(x=>x.id==='hx'), Khx=(hxB?hxB.K_ref:0)*G.leak, K0=R.K_top;
  const lamAt=t=>{ const b=bAt(t); return (K0+Khx*(Math.pow(1-b,-c.n_e)-1))/K0; };
  const bLam=Khx>0?1-Math.pow(1+(G.buz.lamF-1)*K0/Khx,-1/c.n_e):1, t_lam=tB(bLam), t_def=tB(c.b_def);
  const t_end=Math.min(t_lam,t_def), iceMass=t=>q_w*g.A_face*t, dIce=t=>iceMass(t)/(c.rho_ice*g.stages[0].A_o);
  const tRef=isFinite(t_end)?t_end:3600;
  const clean=rate(G,g,air,mdot,T0,Qc,0), iced=rate(G,g,air,mdot,T0,Qi,dIce(tRef)), UA_loss=1-iced.UA/rate(G,g,air,mdot,T0,Qi,0).UA;
  /* droplet capture on the bare fin edge, a 4 mm iced edge and the first tube row [FIN] */
  const d=G.MVD*1e-6, Vf=clean.Vf, cap={edge:finstad(d,c.tf,Vf,air.rho,air.mu),edge4:finstad(d,4e-3,Vf,air.rho,air.mu),tube:finstad(d,c.Do,Vf,air.rho,air.mu)};
  const Ts=clean.Tf_in+0.5*c.dTf+0.5*(T0-clean.Tf_in), ms=rimeDensity(G.MVD,Vf,Math.min(-0.5,Ts));
  /* λ(t) curve for the chart */
  const tmax=Math.min(isFinite(t_end)&&t_end>60?t_end*1.25:7200,4*3600), ts=[], lams=[], bs=[];
  for(let i=0;i<=60;i++){ const t=tmax*i/60; ts.push(t); bs.push(bAt(t)); lams.push(bAt(t)>=0.995?NaN:lamAt(t)); }
  const dp_in=R.hx.dp, T_assumed=s.Tc-G.ops.dTy;
  return {g,T0,air,mdot,extra,load,Qc,Qi,clean,iced,UA_loss,T_assumed,dp_in,q_w,dwdt,bAt,lamAt,t_lam,t_def,t_end,bLam,iceMass,dIce,cap,ms,
    curve:{ts,lams,bs},wAt:t=>c.tf+dwdt*t,LWC};
}

/* audit cards for the coil; same shape as E.audit items */
function coilAudit(C,G,P){
  const out=[], add=o=>out.push(Object.assign({cat:'Coil',where:'hx',refs:[],fields:[],msg:'',fix:''},o));
  const n=(x,d)=>isFinite(x)?x.toFixed(d):'—', c=G.coil, k=C.clean, i=C.iced;
  /* placeholder fluid: at least three of the four properties still at their defaults */
  const ph=!!P&&[P.cMu===15,P.cRho===1300,P.cCp===2700,P.cKfl===0.45].filter(Boolean).length>=3;
  const cap=s=>ph&&(s==='bad'||s==='warn')?'info':s, phNote=ph?' Rated with placeholder fluid properties, so this is shown as a note; with the datasheet values it becomes a decisive check.':'';
  { const d=C.T_assumed-i.Tf_in, raw=d>3?'bad':d>0.5?'warn':'ok', sev=cap(raw);
    add({id:'coilT',sev,title:'Fluid temperature the coil needs',val:n(i.Tf_in,1)+' °C at the iced load',lim:'≥ '+n(C.T_assumed,1)+' °C assumed (air − ΔT approach)',
      msg:raw==='ok'?'With this surface and tube-side film the coil removes '+n(i.Q/1000,1)+' kW with the fluid entering at '+n(i.Tf_in,1)+' °C; the approach assumed in the operating cycle holds.':
        'To remove '+n(i.Q/1000,1)+' kW this coil needs the fluid '+n(d,1)+' K colder than the operating cycle assumes. The refrigeration unit would have to be rated at the lower temperature, where its capacity drops.'+phNote,
      fix:'Add rows or fin surface, raise the tube-side film (fewer parallel circuits, lower-viscosity fluid), or raise the approach ΔT in the operating cycle and rate the chiller there.',
      refs:['VDI','SCH','GN'],fields:['cN2','cFp2','cNc','cMu','dTy']}); }
  { const raw=i.regime==='laminar'?'warn':i.regime==='transitional'?'info':'ok', sev=cap(raw);
    add({id:'coilRe',sev,title:'Tube-side flow regime',val:'Re '+n(i.Re,0)+' · '+i.regime,lim:'turbulent, Re > 4000',
      msg:raw==='ok'?'Turbulent flow in the tubes: film coefficient '+n(i.hi,0)+' W/m²K, '+n(i.share.tube*100,0)+'% of the total resistance.':
        'At this temperature the fluid is viscous and the tube flow is '+i.regime+': film coefficient only '+n(i.hi,0)+' W/m²K, '+n(i.share.tube*100,0)+'% of the total resistance sits inside the tubes.'+phNote,
      fix:'Use fewer parallel circuits (higher velocity, at the cost of pump head), a smaller fluid temperature rise, or a fluid with lower viscosity at this temperature.',
      refs:['GN'],fields:['cNc','cdTf','cMu']}); }
  { const kPa=i.dp_f/1000, sev=(kPa>300||i.v>4)?'bad':(kPa>150||i.v>2.5)?'warn':'ok';
    add({id:'coilDpf',sev,title:'Tube-side pressure drop and velocity',val:n(kPa,0)+' kPa · '+n(i.v,2)+' m/s',lim:'≤ 150 kPa and ≤ 2.5 m/s (rule of thumb)',
      msg:sev==='ok'?'Tube velocity and pressure drop are in the usual range for a pumped secondary circuit. The limits are a rule of thumb, not a literature value; the pump and the manufacturer decide.':
        'Each circuit carries too much flow: '+n(i.v,2)+' m/s and '+n(kPa,0)+' kPa across the coil ('+n(i.P_pump/1000,2)+' kW hydraulic). The limits are a rule of thumb, not a literature value, but a pump for this is impractical.',
      fix:'More parallel circuits or a larger fluid temperature rise.',refs:['GN'],fields:['cNc','cdTf']}); }
  if(!i.counter) add({id:'coilPass',sev:'warn',title:'Too few passes for counter-flow',val:n(C.g.passes,0)+' pass'+(C.g.passes>1?'es':'')+' per circuit',lim:'≥ 4 passes',
    msg:'With fewer than four passes a circuit does not cross the air stream often enough to behave as counter-flow. The rating switches to the cross-flow effectiveness, which needs a colder fluid.',
    fix:'Fewer parallel circuits, so that each one serpentines through at least four rows.',refs:[],fields:['cNc']});
  { const e=Math.min(...k.st.map(s=>s.eta)), sev=e<0.5?'warn':'ok';
    add({id:'coilFin',sev,title:'Fin efficiency',val:n(e,2),lim:'≥ 0.5',
      msg:e<0.5?'More than half of the fin surface is not working: the fin is too thin or the tubes are too far apart for this film coefficient.':'The fins conduct well enough for the tube spacing.',
      fix:'Thicker fins, closer tube pitch or a more conductive fin material.',refs:['SCH'],fields:['cTf','cPt','cPl','cKf']}); }
  { const r=k.dp_air/Math.max(1,C.dp_in), sev=(r>1.5||r<0.67)?'info':'ok';
    add({id:'coilDp',sev,title:'Coil Δp input vs geometry estimate',val:n(C.dp_in,0)+' Pa input · '+n(k.dp_air,0)+' Pa estimated',lim:'within ×1.5',
      msg:'The circuit loss uses the coil Δp you entered. A cross-check from this geometry (tube-bank friction plus fin-channel friction) gives '+n(k.dp_air,0)+' Pa. The cross-check relation is not verified against its primary source; the vendor value decides.',
      fix:'Ask the vendor for the clean air-side Δp at this face velocity and enter it as the coil Δp.',refs:['JK'],fields:['hxdp','hxV']}); }
  { const t=C.t_end/60, sev=t<10?'warn':t<20?'info':'ok';
    add({id:'coilIce',sev,title:'Spray time to the defrost trigger',val:isFinite(t)?n(t,0)+' min at '+n(C.LWC,1)+' g/m³':'not reached',lim:'≥ 10 min spray run',
      msg:'Ice grows as horns on the leading edges of the front-stage fins and closes the '+n((C.g.stages[0].fp-c.tf)*1000,1)+' mm gap. The run ends at blockage '+n(c.b_def,2)+' or when the circuit loss reaches λ_fan, whichever comes first. This is the project\'s own preliminary model: its two constants were fitted to one observation in NASA TM-100116 on a different coil, and growth assumes every droplet in the path of the edge sticks. Fit it to your own coil once it runs.',
      fix:'Open the front-stage fin pitch, or enlarge the coil face area.',refs:['NA2'],fields:['cFp1','fsu','CR']}); }
  if(c.Q_at+c.Q_oth<=0) add({id:'coilLoad',sev:'info',title:'Loads not yet in the budget',val:'0 kW entered',lim:'—',
    msg:'Atomising air of the spray nozzles and thermal bridges (flanges, windows, doors) are not in the thermal budget yet. Their size is not known until the nozzles and the structure are chosen. Secondary-pump heat does not reach the tunnel air; add it to the chiller load, not here.',
    fix:'Enter the atomising-air load from the nozzle datasheet (air mass flow × c_p × temperature difference) and the other loads to the air once known.',refs:[],fields:['cQat','cQot']});
  if(ph) add({id:'coilFluid',sev:'info',title:'Secondary fluid properties are placeholders',val:'ρ, c_p, μ, k not from a datasheet',lim:'—',
    msg:'The fluid properties are round placeholder numbers. Viscosity at the operating temperature decides the tube-side regime and with it the fluid temperature the coil needs.',
    fix:'Enter density, specific heat, viscosity and conductivity from the supplier datasheet at the fluid inlet temperature.',refs:[],fields:['cRho','cCp','cMu','cKfl']});
  return out;
}

Object.assign(E,{finstad,rimeDensity,tubeSide,coilGeometry:geometry,coilLoad,coil,coilAudit});
})();
