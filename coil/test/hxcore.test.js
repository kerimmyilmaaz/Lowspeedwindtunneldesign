/* Regression test: coil/hxcore.js against the MATLAB reports of matlab_v2 (esanjor_tasarim.m, MATLAB R2025b).
   Run: node coil/test/hxcore.test.js */
const H=require('../hxcore.js');
let fail=0; const eq=(name,got,want,tol)=>{ const ok=Math.abs(got-want)<=tol; if(!ok) fail++; console.log((ok?'ok  ':'FAIL')+' '+name+': '+got+' (MATLAB '+want+')'); };
/* tasarim_raporu_varsayilan.md: 40 m/s, −35 °C, LWC 1, MVD 20, 30 min */
let T=H.design({}); const e=T.rec.e;
eq('Q_clean W',T.load.Q_clean,15224,1); eq('Q_iced W',T.load.Q_iced,24215,1);
eq('fp1 needed mm',T.ice.fpNeed*1e3,8.88,0.01); eq('fp1 mm',T.fp1*1e3,10,0); eq('f_hx 15 µm k12 %',100*T.ice.cells[1].f_hx,55.6,0.05);
eq('recommended = HC-50',T.rec.fluid==='HC-50'?1:0,1,0); eq('Nc2',e.row.Nc2,47,0); eq('flow m3/h',e.row.flow,28,0);
eq('T_chiller iced cons °C',e.T_ch,-39.77,0.005); eq('T_chiller iced opt °C',e.T_ch_opt,-38.20,0.005); eq('T_chiller clean °C',e.T_ch_clean,-37.71,0.005);
eq('Q_chiller W',e.R.Q_chiller,27111,1); eq('UA W/K',e.R.UA,4157,1); eq('scaled air dp Pa',e.dp_scaled,146,0.5);
const dj=T.fluids.find(a=>a.name==='Dowtherm J').best; eq('Dowtherm J T_ch',dj.T_ch,-37.88,0.005);
eq('first part (Corner 1) min',T.S.t_first,19.5,0.01); eq('K_clean',T.S.K_clean,0.5231,0.00005);
/* tasarim_raporu_ornek_25ms.md */
const d=H.defaults(); Object.assign(d,{V:25,T:-20,LWC:2,MVD:30,t_target:20}); T=H.design(d);
eq('25 m/s: T_chiller',T.rec.e.T_ch,-20.65,0.005); eq('25 m/s: N2',T.rec.e.row.N2,8,0); eq('25 m/s: valid candidates',T.cand.n_valid,1727,0);
console.log(fail?fail+' failed':'all passed'); process.exit(fail?1:0);
