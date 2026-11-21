/* Smokeline · Coil & Chiller page: requirements console, worker-driven design, 3D coil, spec sheet,
   cooling load, alternatives, ice and method. All numbers come from coil/hxcore.js. */
(function(){
'use strict';
const H=window.HXCore, $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const MINUS='−', esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f=(x,d)=>{ if(x===null||x===undefined||!isFinite(x)) return x===Infinity?'∞':x===-Infinity?MINUS+'∞':'—'; const s=Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); return (x<0&&s.replace(/[0.,]/g,'')!==''?MINUS:'')+s; };
const kW=w=>f(w/1e3,1), tmin=t=>!isFinite(t)?'—':t>999?'> 999':f(t,1);
const deep=o=>structuredClone(o);
const FLC=['#1D4ED8','#C2410C','#1C7A51','#6E4FC0','#9AA8B5','#AD1F55','#56677A','#B0600A'];
const SCN={mevcut:'As built',k12:'Corners 1–2 heated',hepsi:'All corners heated'};

/* ---------------- state ---------------- */
const BASE=H.defaults();
let ist=deep(BASE), T=null, sel=null, busy=false, reqId=0, view=null, iceCase='gov', xSweep='V', mxSel=null;
const PRESETS=[
  {k:'s2',l:'S2 · 40 m/s',v:{T:-35,V:40,LWC:1,MVD:20,t_target:30}},
  {k:'s1',l:'S1 · 25 m/s',v:{T:-35,V:25,LWC:1,MVD:20,t_target:30}},
  {k:'glaze',l:'Glaze · −10 °C',v:{T:-10,V:40,LWC:2,MVD:30,t_target:20}}
];
/* field: [id, label, path, unit, scale, min, max, step, slider] ; path into ist */
const get=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
const set=(o,p,v)=>{ const k=p.split('.'), l=k.pop(); k.reduce((a,x)=>a[x],o)[l]=v; };
const GROUPS=[
  {id:'g1',t:'Test point',i:'what the tunnel must do',open:true,f:[
    ['T','Static temperature','T','°C',1,-40,0,0.5,1],['V','Test-section speed','V','m/s',1,10,60,1,1],
    ['LWC','Liquid water content','LWC','g/m³',1,0.1,3,0.05,1],['MVD','Median volume diameter','MVD','µm',1,10,50,1,1],
    ['dist','Droplet sizes','dist','seg',[['tek','Single size'],['langmuirD','Langmuir D']]],
    ['tt','Spray run to last','t_target','min',1,5,60,1,1]]},
  {id:'g2',t:'Tunnel and heat loads',i:'from the closed-circuit sheet',f:[
    ['tsw','Test section width','G.TS.w','cm',100,20,150,1],['tsh','Test section height','G.TS.h','cm',100,20,150,1],
    ['cw','Coil face width','G.hx.W','m',1,0.5,3,0.05],['ch','Coil face height','G.hx.H','m',1,0.5,3,0.05],
    ['kt','Circuit loss K<sub>top</sub>','load.K_top','',1,0.1,2,0.0005],['lam','Fan margin λ<sub>fan</sub>','G.lam_fan','×',1,1,4,0.1],['mj','Refrigeration margin (on the iced load)','load.marj','×',1,1,2,0.05],
    ['ef','Fan efficiency','load.eta_fan','',1,0.3,0.95,0.01],['em','Motor efficiency','load.eta_motor','',1,0.5,1,0.01],
    ['uw','Wall U','load.U_wall','W/m²K',1,0.05,5,0.001],['aw','Cold wall area','load.A_wall','m²',1,5,500,0.01],
    ['tl','Lab temperature','load.T_lab','°C',1,0,40,1],['tw','Spray water','load.T_w','°C',1,0,60,1],
    ['qx','Extra load (atomising air, bridges)','load.Q_extra','kW',1e-3,0,50,0.1,0,1]]},
  {id:'g3',t:'Coil limits',i:'rules of thumb, editable',f:[
    ['dpa','Air Δp budget','lim.dp_air_max','Pa',1,30,400,1],['dep','Max coil depth','lim.depth_max','mm',1e3,150,1000,5],
    ['dpf','Fluid Δp, both stages','lim.dp_f_max','kPa',1e-3,20,400,1],['vm','Max tube velocity','lim.v_max','m/s',1,0.5,4,0.1],
    ['ncm','Max circuits per stage','lim.Nc_max','',1,4,200,1],['fpm','Min front fin pitch','front.fp_min','mm',1e3,7,12,1],
    ['trn','Laminar–turbulent transition','lim.no_transition','seg',[[true,'Avoid'],[false,'Allow']]],
    ['env','Size the front fins for','ice.sizing','seg',[['b','As built + 1–2 heated'],['a','+ all heated'],['m','As built']]],
    ['mg','Margin on ice growth','ice.margin','×',1,1,2,0.05],
    ['wc','Wire-coil inserts (main stage)','wire.on','seg',[[false,'None'],[true,'Nu × 2']]],
    ['pat','Main-stage tube patterns','main.codes','pats']]},
  {id:'g4',t:'Fluid, pump and chiller',i:'datasheet fluids',f:[
    ['fl','Secondary fluids to try','fluids','fluids'],
    ['nf','Flammable fluids','nonflam_pref','seg',[[true,'Penalise'],[false,'Treat equally']]],['pen','Penalty','flam_penalty','K',1,0,10,0.5],
    ['ps','Pump loop Δp outside coil','pump.dp_sys','kPa',1e-3,0,400,5],['pe','Pump + motor efficiency','pump.eta','',1,0.2,0.9,0.01],
    ['de1','Evaporator approach, min','chiller.dT_evap.0','K',1,1,15,0.5],['de2','Evaporator approach, max','chiller.dT_evap.1','K',1,1,20,0.5],
    ['fm','Freeze margin at evaporator','lim.freeze_margin','K',1,0,15,0.5],['te','Lowest evaporating temperature','lim.T_evap_min','°C',1,-80,-10,0.5]]}
];
const ENV={b:['mevcut','k12'],a:['mevcut','k12','hepsi'],m:['mevcut']};
const envKey=()=>{ const s=ist.ice.sizing.join(','); return s==='mevcut,k12,hepsi'?'a':s==='mevcut'?'m':'b'; };

/* ---------------- console ---------------- */
function fieldHTML(d){
  const [id,label,path,unit]=d;
  if(unit==='seg'){ const v=path==='ice.sizing'?envKey():get(ist,path);
    return '<div class="f w2"><label>'+label+'</label><div class="seg" role="group" data-seg="'+id+'">'+d[4].map(([val,l])=>'<button type="button" data-val="'+String(val)+'" aria-pressed="'+(String(val)===String(v))+'">'+l+'</button>').join('')+'</div></div>'; }
  if(unit==='pats') return '<div class="f w2"><label>'+label+'</label><div class="checks">'+H.PATTERNS.filter(p=>p.stage==='main').map(p=>'<label title="'+esc(p.note)+'"><input type="checkbox" data-pat="'+p.code+'"'+(ist.main.codes.indexOf(p.code)>=0?' checked':'')+'> '+p.code+' · '+esc(p.name.split(' (')[0])+'</label>').join('')+'</div></div>';
  if(unit==='fluids') return '<div class="f w2"><label>'+label+'</label><div class="checks">'+H.FLUIDS.filter(x=>x.name!=='Placeholder'&&x.name!=='HC-50 (2 points)').map(x=>'<label title="'+esc(x.note)+'"><input type="checkbox" data-fl="'+esc(x.name)+'"'+(ist.fluids.indexOf(x.name)>=0?' checked':'')+'> '+esc(x.name)+(x.flam?' <span class="fl">flammable</span>':'')+'</label>').join('')+'</div></div>';
  const [, , , , sc,mn,mx,st,sl,w2]=d, v=get(ist,path)*sc;
  return '<div class="f'+(sl||w2?' w2':'')+'"><label for="i_'+id+'">'+label+'</label><div class="inp"><input id="i_'+id+'" type="number" inputmode="decimal" data-id="'+id+'" min="'+mn+'" max="'+mx+'" step="'+st+'" value="'+(+v.toFixed(6))+'">'+(unit?'<span>'+unit+'</span>':'')+'</div>'+
    (sl?'<input type="range" data-r="'+id+'" min="'+mn+'" max="'+mx+'" step="'+st+'" value="'+v+'" aria-label="'+label+'">':'')+'</div>';
}
function renderConsole(){
  const pre=PRESETS.find(p=>Object.keys(p.v).every(k=>get(ist,k)===p.v[k]));
  $('#console').innerHTML='<h2>Requirements <span>auto-run</span></h2><div class="presets">'+PRESETS.map(p=>'<button type="button" class="chip" data-pre="'+p.k+'" aria-pressed="'+(pre===p)+'">'+p.l+'</button>').join('')+'</div>'+
    GROUPS.map(g=>'<details class="grp" id="'+g.id+'"'+(g.open||openG.has(g.id)?' open':'')+'><summary>'+g.t+'<i>'+g.i+'</i></summary><div class="fields">'+g.f.map(fieldHTML).join('')+'</div></details>').join('')+
    '<div class="runrow"><button type="button" class="btn cold" id="bRun">Design again</button><button type="button" class="btn ghost" id="bReset">Reset</button><span class="note" id="runNote"></span></div>';
}
const openG=new Set(['g1']);
const FIELDS={}; GROUPS.forEach(g=>g.f.forEach(d=>FIELDS[d[0]]=d));
function onInput(e){
  const t=e.target;
  if(t.dataset.id||t.dataset.r){ const id=t.dataset.id||t.dataset.r, d=FIELDS[id], v=parseFloat(t.value); if(!isFinite(v)) return;
    const cl=Math.min(d[6],Math.max(d[5],v)); set(ist,d[2],cl/d[4]);
    const other=t.dataset.id?$('[data-r="'+id+'"]'):$('#i_'+id); if(other&&other!==t) other.value=cl;
    if(e.type==='change'&&t.dataset.id&&cl!==v) t.value=cl; changed(); return; }
  if(t.dataset.pat!==undefined){ const c=$$('[data-pat]').filter(x=>x.checked).map(x=>x.dataset.pat); if(!c.length){ t.checked=true; return; } ist.main.codes=c; changed(); return; }
  if(t.dataset.fl!==undefined){ const c=$$('[data-fl]').filter(x=>x.checked).map(x=>x.dataset.fl); if(!c.length){ t.checked=true; return; } ist.fluids=c; changed(); return; }
}
$('#console').addEventListener('input',onInput);
$('#console').addEventListener('change',onInput);
$('#console').addEventListener('toggle',e=>{ const d=e.target; if(d.tagName==='DETAILS'){ if(d.open) openG.add(d.id); else openG.delete(d.id); } },true);
$('#console').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.pre){ const p=PRESETS.find(x=>x.k===b.dataset.pre); Object.keys(p.v).forEach(k=>set(ist,k,p.v[k])); renderConsole(); changed(); return; }
  const sg=b.closest('[data-seg]'); if(sg){ const d=FIELDS[sg.dataset.seg]; let v=b.dataset.val; if(v==='true') v=true; else if(v==='false') v=false;
    if(d[2]==='ice.sizing') ist.ice.sizing=ENV[v].slice(); else set(ist,d[2],v);
    sg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); changed(); return; }
  if(b.id==='bRun'){ run(); return; }
  if(b.id==='bReset'){ ist=deep(BASE); renderConsole(); changed(); }
});
let tmr=0;
function changed(){ $$('[data-pre]').forEach(x=>{ const p=PRESETS.find(q=>q.k===x.dataset.pre); x.setAttribute('aria-pressed',String(Object.keys(p.v).every(k=>get(ist,k)===p.v[k]))); });
  renderLoad(); renderKPI(); clearTimeout(tmr); tmr=setTimeout(run,450); }

/* ---------------- worker ---------------- */
let worker=null;
function mkWorker(){ try{ worker=new Worker('coil/worker.js'); worker.onmessage=onMsg; worker.onerror=()=>{ worker=null; }; }catch(e){ worker=null; } }
function onMsg(ev){ const m=ev.data; if(m.id!==reqId) return;
  if(m.progress){ showBusy(m.progress); return; }
  busy=false; inflight=false; showBusy(null);
  if(m.error){ msgsErr(m.error); return; }
  T=m.result; sel=T.rec.ia!=null?T.rec.ia:null; mxSel=null; renderAll(); }
function run(){
  clearTimeout(tmr); const id=++reqId, payload=deep(ist); busy=true; showBusy({stage:'ice',f:0}); renderKPI();
  if(worker&&inflight){ worker.terminate(); worker=null; }
  if(!worker) mkWorker();
  if(worker){ inflight=true; worker.postMessage({id,ist:payload}); }
  else setTimeout(()=>{ try{ const r=H.design(payload); r.cand.pts=r.cand.rows.map(x=>[x.ia,x.ic,x.Tch,x.P,x.dp_air,x.N2,x.flow]); delete r.cand.rows; onMsg({data:{id,result:r}}); }catch(e){ onMsg({data:{id,error:String(e.message||e)}}); } },30);
}
let inflight=false;
const STAGE={ice:'Running the spray through the loop',scan:'Searching coils',verify:'Checking ice with the chosen coil',done:'Done'};
function showBusy(p){
  const el=$('#busy'); if(!p){ el.classList.remove('on'); $('#runNote').textContent=T?'last run '+f(T.ms/1000,1)+' s':''; return; }
  el.classList.add('on'); const tot=p.stage==='ice'?p.f*0.2:p.stage==='scan'?0.2+p.f*0.65:p.stage==='verify'?0.85+p.f*0.15:1;
  $('#ringFg').setAttribute('stroke-dashoffset',String(100.5*(1-tot))); $('#busyT').textContent=STAGE[p.stage]||'Designing';
  $('#busyS').textContent=p.stage==='scan'?'fluids × tube patterns × rows × circuits × flow':p.stage==='ice'?'droplet paths through the corner vanes':'every droplet size and corner case';
  $('#runNote').textContent='running…';
}

/* ---------------- helpers on the selected design ---------------- */
const cur=()=>{ if(!T||sel==null) return null; const a=T.fluids[sel]; return a&&a.best?a:null; };
const isRec=()=>T&&sel===T.rec.ia;
function GofIst(){ const G=deep(ist.G); Object.assign(G,{V:ist.V,T:ist.T,p:ist.p,LWC:ist.LWC,MVD:ist.MVD,dist:ist.dist,load:ist.load}); return G; }

/* ---------------- KPI hero ---------------- */
function renderKPI(){
  const Y=H.load(GofIst()), a=cur(), e=a&&a.best, stale=busy;
  const Q=e?e.chiller.Q_sel:Y.Q_sel;
  $('#kpi').innerHTML=
    '<div class="k-big'+(stale?' busy':'')+'"><div class="k-l">Chiller capacity to specify</div><div class="k-v">'+kW(Q)+'<small>kW</small></div><div class="k-s">'+(e?f(e.chiller.marj,2)+' × iced load + '+kW(e.R.P_shaft)+' kW pump · iced point without margin '+kW(e.chiller.Q)+' kW':f(Y.marj,2)+' × iced load · pump heat after the coil search')+'</div></div>'+
    '<div class="'+(stale?'busy':'')+'"><div class="k-l">Fluid leaves chiller</div><div class="k-v">'+(e?f(e.T_ch,1):'—')+'<small>°C</small></div><div class="k-s">'+(e?'optimistic '+f(e.T_ch_opt,1)+' °C':'&nbsp;')+'</div></div>'+
    '<div class="'+(stale?'busy':'')+'"><div class="k-l">Coil</div><div class="k-v">'+(e?(ist.G.hx.W.toFixed(2)+'×'+ist.G.hx.H.toFixed(2)):'—')+'<small>m</small></div><div class="k-s">'+(e?(e.R.g.st.map(s=>s.rows).join(' + ')+' rows · '+f(e.R.g.depth*1e3,0)+' mm deep'):'&nbsp;')+'</div></div>';
}

/* ---------------- 3D ---------------- */
let v3=null, v3fail=false;
function ensureView(){
  if(v3||v3fail) return Promise.resolve(v3);
  return CoilView.load().then(()=>{ v3=CoilView.mount($('#v3')); if(!v3){ v3fail=true; $('#v3').innerHTML='<div class="noweb">WebGL is not available in this browser, so the 3D model is off. Everything else on the page works.</div>'; } return v3; })
    .catch(()=>{ v3fail=true; $('#v3').innerHTML='<div class="noweb">The 3D library could not be loaded.</div>'; return null; });
}
function iceCell(){
  const B=T&&(T.ice2||T.ice); if(!B) return null;
  if(iceCase==='gov') return B.cells[B.gov];
  return B.cells.find(c=>c.MVD===ist.MVD&&c.scen===iceCase)||B.cells[B.gov];
}
function model(){
  const a=cur(), e=a.best, R=e.R, X=e.X, g=R.g;
  const st=g.st.map(s=>({name:s.name,rows:s.rows,Nt:s.Nt,Do:s.Do,Pt:s.Pt,Pl:s.Pl,stag:s.stag,fp:s.fp,Ncirc:s.Ncirc,passes:s.passes}));
  const c=iceCell(), M={W:g.W,H:g.H,gap:X.gap,tf:X.tf,depth:g.depth,stages:st,ice:{dwdt:c?c.dwdt:0}};
  const fr=st[0], mn=st[st.length-1], tc=(s,i)=>s;
  M.labels=[
    {t:'Air in · '+f(R.Tin,1)+' °C',s:f(R.Vf,2)+' m/s face',cls:'warm',face:-1,at:()=>new THREE.Vector3(-g.W*0.22,g.H*0.1,-g.depth/2-0.12)},
    {t:'Air out · '+f(R.Tout,1)+' °C',s:'to settling chamber',face:1,at:()=>new THREE.Vector3(-g.W*0.22,-g.H*0.1,g.depth/2+0.12)},
    {t:'Front stage',s:fr.rows+' rows · '+f(fr.fp*1e3,0)+' mm fins · takes the ice',at:()=>new THREE.Vector3(g.W*0.05,-g.H/2,(fr.z0+fr.z1)/2||-g.depth/2)},
    {t:'Main stage',s:mn.rows+' rows · '+f(mn.fp*1e3,0)+' mm fins · '+(mn.stag?'staggered':'in-line'),at:()=>new THREE.Vector3(-g.W*0.25,g.H/2,(mn.z0+mn.z1)/2||0)},
    {t:'Supply · '+f(e.R.Tf_in,1)+' °C',s:a.name+' · '+f(R.flow_m3h,0)+' m³/h',cls:'cold',at:()=>M._sup||null},
    {t:'Return · '+f(R.Tf_out,1)+' °C',s:'back to chiller',cls:'ret',at:()=>M._ret||null}
  ];
  void tc; return M;
}
function render3D(){
  const a=cur(); if(!a) return;
  ensureView().then(v=>{ if(!v) return; v.set(model()); scrubSetup(); });
}
function scrubSetup(){
  const c=iceCell(), tend=Math.max(45,Math.ceil(1.5*ist.t_target)), inp=$('#iceT'), tr=$('#scrubTr');
  tr.querySelectorAll('.mk').forEach(x=>x.remove());
  let nmk=0; const mk=(t,l)=>{ if(!isFinite(t)||t>tend) return; const d=document.createElement('i'); d.className='mk'+(nmk++%2?' lo':'')+(t/tend>0.6?' r':''); d.dataset.l=l; d.style.left=(100*t/tend)+'%'; tr.appendChild(d); };
  mk(ist.t_target,'target '+ist.t_target);
  if(c) mk(c.t_clog,'front closes');
  inp.dataset.tend=tend; upScrub();
}
function upScrub(){
  const inp=$('#iceT'), tend=+inp.dataset.tend||45, t=tend*inp.value/1000, c=iceCell();
  $('#iceOut').textContent=f(t,0)+' min · '+(c?SCN[c.scen].toLowerCase()+', '+c.MVD+' µm':'');
  if(v3) v3.setIce(t);
}
$('#iceT').addEventListener('input',upScrub);
$('#iceOut').addEventListener('click',()=>{ const o=['gov','mevcut','k12','hepsi']; iceCase=o[(o.indexOf(iceCase)+1)%o.length]; if(cur()) render3D(); });
$('#iceOut').title='Click to change the ice case shown (worst sizing case, as built, 1–2 heated, all heated)';
$('#views').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; $$('#views button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); if(v3) v3.view(b.dataset.v); });
$('#togs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const on=b.getAttribute('aria-pressed')!=='true'; b.setAttribute('aria-pressed',String(on)); if(v3) v3.toggle(b.dataset.t,on); });

/* ---------------- HUD, strip, messages ---------------- */
function regimeTag(q){ return q.regime==='turbulent'?'ok':q.regime==='laminar'?'':'warn'; }
function renderHUD(){
  const a=cur(); if(!a){ $('#hudId').innerHTML='<b>No design</b>'; $('#hudT').innerHTML=''; return; }
  const e=a.best, R=e.R, st=R.g.st, X=e.X;
  const pat=s=>f(s.Do*1e3,1)+' '+(s.stag?'staggered':'in-line');
  $('#hudId').innerHTML='<b>'+(isRec()?'Recommended':'Alternative')+' · '+esc(a.name)+'</b>'+
    'FRONT '+st[0].rows+' × '+pat(st[0])+' · '+f(st[0].fp*1e3,0)+' MM &nbsp;|&nbsp; MAIN '+st[st.length-1].rows+' × '+pat(st[st.length-1])+' · '+f(st[st.length-1].fp*1e3,0)+' MM'+
    '<div class="tags">'+R.ic.map((q,k)=>'<span class="tag '+regimeTag(q)+'">'+(k?'main':'front')+' Re '+f(q.Re,0)+' '+q.regime+'</span>').join('')+
    '<span class="tag '+(e.dp_scaled>ist.lim.dp_air_max?'warn':'ok')+'">air Δp '+f(R.dp_air,0)+'–'+f(e.dp_scaled,0)+' Pa</span>'+
    (isFinite(e.freeze_margin)?'<span class="tag '+(e.freeze_margin<ist.lim.freeze_margin?'bad':'ok')+'">freeze margin '+f(e.freeze_margin,1)+' K</span>':'')+
    (a.vt.flam?'<span class="tag warn">flammable · flash '+a.vt.Tflash+' °C</span>':'<span class="tag ok">non-flammable</span>')+'</div>';
  $('#hudT').innerHTML='<div class="s">FLUID FROM CHILLER</div><div class="v">'+f(e.T_ch,1)+'<small>°C</small></div><div class="s">optimistic '+f(e.T_ch_opt,1)+' · clean load '+f(e.T_ch_clean,1)+'</div>';
}
function renderStrip(){
  const a=cur(); if(!a){ $('#strip').innerHTML=''; return; } const e=a.best, R=e.R, g=R.g;
  const it=(l,v,u,s)=>'<div><div class="l">'+l+'</div><div class="v">'+v+(u?'<small>'+u+'</small>':'')+'</div><div class="s">'+(s||'&nbsp;')+'</div></div>';
  $('#strip').innerHTML=
    it('Air side',f(R.Vf,2),'m/s','Δp '+f(R.dp_air,0)+' Jakob · '+f(e.dp_scaled,0)+' scaled')+
    it('Fluid flow',f(R.flow_m3h,0),'m³/h','ΔT '+f(R.dT_f,2)+' K · '+f(R.mf,2)+' kg/s')+
    it('Tube Re',R.ic.map(q=>f(q.Re,0)).join(' / '),'','front / main · v '+R.ic.map(q=>f(q.v,2)).join(' / ')+' m/s')+
    it('Pump',f(R.P_shaft/1e3,2),'kW','fluid Δp '+f(R.dp_f/1e3,0)+' kPa in the coil')+
    it('UA',f(R.UA,0),'W/K',f(100*R.share_tube,0)+' % of resistance in tubes')+
    it('Coil',f(g.m_tube+g.m_fin,0),'kg','A<sub>o</sub> '+f(g.A_o,0)+' m² · '+f(g.V_liq*1e3,0)+' L fluid');
}
function msgsErr(s){ $('#msgs').innerHTML='<div class="msg bad">The design run failed: '+esc(s)+'</div>'; }
function renderMsgs(){
  if(!T) return; const a=cur(), out=[], seen=new Set(), add=(t,c)=>{ if(seen.has(t)) return; seen.add(t); out.push('<div class="msg '+(c||'')+'">'+t+'</div>'); };
  if(!a){ add('No fluid gives a coil that meets the limits. Relax the air Δp budget, the depth or the fluid limits, or lower the load.','bad'); }
  else { const e=a.best;
    if(isRec()&&T.rec.conditional) add('Conditional: no fluid meets every limit; this is the best one with full datasheet data.','bad');
    if(!isRec()) add('You are looking at an alternative. The recommendation is '+esc(T.rec.fluid||'none')+'.','warn');
    e.why.forEach(w=>add(esc(w).replace(/^note: /,''),/note|uyarı/.test(w)?'warn':'bad')); }
  (T.ice2?T.ice2.warn:T.warn).forEach(w=>add(esc(w),/ends the run|not met|closes in/.test(w)?'warn':''));
  if(T.S&&T.S.t_first<ist.t_target) add('With the corners as built, '+esc(T.S.first)+' closes after '+tmin(T.S.t_first)+' min, before the '+ist.t_target+' min target. Heat the first corner vanes or shorten the run.','warn');
  $('#msgs').innerHTML=out.slice(0,7).join('');
}

/* ---------------- spec sheet ---------------- */
function sheetData(){
  const a=cur(); if(!a) return null; const e=a.best, R=e.R, Rc=e.R_clean, g=R.g, X=e.X, P=T.point, B=T.ice2||T.ice, gov=B?B.cells[B.gov]:null, vt=a.vt;
  const today=new Date().toISOString().slice(0,10);
  const did=(a.name+'-'+e.code+'-'+g.st.map(s=>s.rows+'r'+Math.round(s.fp*1e3)+'x'+s.Ncirc).join('-')+'-'+e.row.flow).replace(/\s+/g,'');
  const mat=['Tubes: seamless copper; fins: aluminium, '+f(X.tf*1e3,2)+' mm, flat (no louvres: louvres clog with ice).',
    'Headers copper or stainless steel, not carbon steel; casing stainless or aluminium; low-temperature gaskets.',
    'Rated for repeated cycling between −50 °C and +30 °C (defrost); state the design and test pressure and the pressure-equipment class.',
    'Headers outside the air stream; vent and drain on every circuit; counter-flow connection (supply at the downstream row).',
    'Header Δp below 10 % of the circuit Δp, reverse-return headers, equal circuit lengths: laminar parallel circuits mal-distribute easily.',
    'Insulated, heated, sloped drain pan in stainless steel; trapped and heated drain line.',
    'Front stage removable or with inspection access; 0.3–0.5 m access space upstream.'];
  if(!vt.flam) mat.push('Fluid compatibility ('+vt.name+'): '+vt.note.replace(/^[^.]*\.\s*/,'')); else mat.push('Flammable fluid ('+vt.name+', flash '+vt.Tflash+' °C): nitrogen blanket, sealless pump (magnetic or canned), drip tray, leak detection, ATEX / fire assessment.');
  const ask=['Re-rate this geometry with your own program at both duty points and give the air Δp clean and with 0.5 mm ice on the front stage.',
    'Which tube dies and fin pitches can you make? This proposal assumes '+g.st.map((s,k)=>(k?e.pattern.name:H.pattern('ON').name)+' at '+f(s.fp*1e3,0)+' mm').join(' and ')+'.',
    'Offer your own pattern as an alternative if it meets the supply temperature with lower air Δp.',
    'Capacity tolerance you guarantee, delivery time, and price for the coil with headers, casing and drain pan.'];
  return {a,e,R,Rc,g,X,P,B,gov,vt,today,did,mat,ask};
}
function renderSheet(){
  const S=sheetData(), el=$('#sheet'); if(!S){ el.innerHTML='<div class="cpad">No design to show.</div>'; return; }
  const {a,e,R,Rc,g,X,P,gov,vt,today,did,mat,ask}=S, kv=rows=>'<dl class="kv">'+rows.map(r=>'<dt>'+r[0]+'</dt><dd'+(r[2]?' class="big"':'')+'>'+r[1]+'</dd>').join('')+'</dl>';
  const st=g.st, cols=st.map((s,k)=>k?'Main stage':'Front stage');
  const trow=(l,fn)=>'<tr><td>'+l+'</td>'+st.map((s,k)=>'<td>'+fn(s,k)+'</td>').join('')+'</tr>';
  el.innerHTML=
   '<div class="tb"><div><div class="l">Smokeline · cooling coil specification</div><div class="ttl">Two-stage finned-tube air cooler</div></div>'+
   '<div><div class="l">Design point</div><div class="v">'+f(ist.T,1)+' °C · '+f(ist.V,0)+' m/s · LWC '+f(ist.LWC,2)+' · MVD '+ist.MVD+' µm</div></div>'+
   '<div><div class="l">Design ID</div><div class="v mono" style="font-size:12px">'+esc(did)+'</div></div>'+
   '<div><div class="l">Issued · status</div><div class="v">'+today+' · '+(isRec()?(T.rec.conditional?'conditional':'recommended'):'alternative')+'</div></div></div>'+
   '<div class="body">'+
   '<div class="blk"><h4>A · <b>Duty</b></h4>'+kv([
      ['Air mass flow',f(P.mdot,2)+' kg/s'],['Air volume at coil',f(P.mdot/R.air.rho,2)+' m³/s'],
      ['Air leaving coil (total temperature)',f(P.T0,2)+' °C'],['Air entering coil, iced / clean',f(R.Tin,2)+' / '+f(Rc.Tin,2)+' °C'],
      ['Heat removed from air, iced (sizing)',kW(R.Q)+' kW',1],['Heat removed from air, clean',kW(Rc.Q)+' kW'],
      ['Chiller load at the iced point, incl. pump heat',kW(e.chiller.Q)+' kW'],
      ['Chiller capacity to specify ('+f(e.chiller.marj,2)+' × iced load + pump)',kW(e.chiller.Q_sel)+' kW',1]])+'</div>'+
   '<div class="blk"><h4>B · <b>Fluid side</b></h4>'+kv([
      ['Secondary fluid',esc(vt.name)+(vt.flam?' (flammable)':' (non-flammable)')],['Volume flow',f(R.flow_m3h,1)+' m³/h ('+f(R.mf,2)+' kg/s)'],
      ['Supply to coil, iced, conservative',f(R.Tf_in,2)+' °C',1],['Supply to coil, iced, optimistic',f(e.R_opt.Tf_in,2)+' °C'],
      ['Fluid temperature rise',f(R.dT_f,2)+' K'],['Coil fluid Δp (both stages)',f(R.dp_f/1e3,1)+' kPa'],
      ['Tube Re front / main',R.ic.map(q=>f(q.Re,0)+' '+q.regime).join(' / ')],['Pump shaft power (estimate)',f(R.P_shaft/1e3,2)+' kW']])+'</div>'+
   '<div class="blk full"><h4>C · <b>Coil geometry</b> <span class="note" style="text-transform:none;letter-spacing:0">face '+f(g.W,2)+' × '+f(g.H,2)+' m · depth '+f(g.depth*1e3,0)+' mm incl. '+f(X.gap*1e3,0)+' mm gap · air first through the front stage</span></h4>'+
     '<div class="tscroll"><table class="stg"><thead><tr><th></th>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+
     trow('Tube OD × wall',s=>f(s.Do*1e3,2)+' × '+f(s.tw*1e3,2)+' mm')+trow('Pitch across × along flow',s=>f(s.Pt*1e3,2)+' × '+f(s.Pl*1e3,2)+' mm')+
     trow('Arrangement',s=>s.stag?'staggered':'in-line')+trow('Rows × tubes per row',s=>s.rows+' × '+s.Nt+' = '+s.tubes)+
     trow('Fin pitch / thickness',s=>f(s.fp*1e3,1)+' / '+f(X.tf*1e3,2)+' mm')+trow('Circuits × passes',s=>s.Ncirc+' × '+s.passes)+
     trow('Circuit length',s=>f(s.L_circ,1)+' m')+trow('Outside surface',s=>f(s.A_o,1)+' m²')+
     trow('Tube velocity, iced',(s,k)=>f(R.ic[k].v,2)+' m/s')+trow('Fluid Δp',(s,k)=>f(R.ic[k].dp/1e3,1)+' kPa')+'</tbody></table></div>'+
     '<p class="note" style="margin:10px 0 0">Fluid path: chiller → main-stage inlet header (downstream row) → main stage → jumper → front stage → return. Total outside surface '+f(g.A_o,1)+' m², inside '+f(g.A_i,2)+' m², metal ≈ '+f(g.m_tube+g.m_fin,0)+' kg, fluid in tubes ≈ '+f(g.V_liq*1e3,0)+' L.</p></div>'+
   '<div class="blk"><h4>D · <b>Air side</b></h4>'+kv([
      ['Face velocity',f(R.Vf,2)+' m/s'],['Clean air Δp, Jakob (unverified)',f(R.dp_air,0)+' Pa'],['Clean air Δp, scaled to reference curve',f(e.dp_scaled,0)+' Pa'],
      ['Air Δp budget of the fan',f(ist.lim.dp_air_max,0)+' Pa'],['Air-side UA front / main',R.ic.map(q=>f(q.UA_air,0)).join(' / ')+' W/K']])+
     '<p class="note" style="margin:8px 0 0">The NASA IRT experience: vendor air Δp came out about 70 % low. Ask for measured or program Δp.</p></div>'+
   '<div class="blk"><h4>E · <b>Icing service</b></h4>'+kv(gov?[
      ['Spray water in the loop',f(T.ice.m_w*1e3,1)+' g/s'],['Worst sizing case',SCN[gov.scen]+', MVD '+gov.MVD+' µm'],['Water reaching the coil there',f(100*gov.f_hx,1)+' %'],
      ['Leading-edge horn growth',f(gov.dwdt*6e4,3)+' mm/min'],['Front stage closes (b = '+f(T.ice.b_lim,1)+')',tmin(gov.t_clog)+' min'],['Required spray run',ist.t_target+' min']]:[['Ice matrix','off']])+
     '<p class="note" style="margin:8px 0 0">Defrost by warm fluid through the same tubes is simplest. Ice grows as horns on the front fin edges; the main stage should stay almost clean.</p></div>'+
   '<div class="blk"><h4>F · <b>Construction</b></h4><ul>'+mat.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul></div>'+
   '<div class="blk"><h4>G · <b>Please quote and confirm</b></h4><ul>'+ask.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul></div>'+
   '</div>';
}
function sheetText(md){
  const S=sheetData(); if(!S) return ''; const {a,e,R,Rc,g,X,P,gov,vt,today,did,mat,ask}=S, L=[];
  const h=t=>L.push(md?'\n## '+t:'\n'+t.toUpperCase()), r=(k,v)=>L.push(md?'- '+k+': '+v:'  '+k+': '+v);
  L.push(md?'# Cooling coil specification (Smokeline)':'COOLING COIL SPECIFICATION (Smokeline)');
  L.push((md?'':'')+'Design point: '+ist.T+' °C, '+ist.V+' m/s, LWC '+ist.LWC+' g/m³, MVD '+ist.MVD+' µm, spray run '+ist.t_target+' min. Design ID '+did+'. Issued '+today+'.');
  h('A. Duty'); r('Air mass flow',f(P.mdot,2)+' kg/s'); r('Air leaving coil (total temperature)',f(P.T0,2)+' °C'); r('Air entering coil, iced / clean',f(R.Tin,2)+' / '+f(Rc.Tin,2)+' °C');
  r('Heat removed from air, iced (sizing) / clean',kW(R.Q)+' / '+kW(Rc.Q)+' kW'); r('Chiller load at the iced point, incl. pump heat',kW(e.chiller.Q)+' kW'); r('Chiller capacity to specify ('+f(e.chiller.marj,2)+' × iced load + pump)',kW(e.chiller.Q_sel)+' kW');
  h('B. Fluid side'); r('Secondary fluid',vt.name+(vt.flam?' (flammable, flash '+vt.Tflash+' °C)':' (non-flammable)')); r('Volume flow',f(R.flow_m3h,1)+' m³/h');
  r('Supply to coil, iced, conservative / optimistic',f(R.Tf_in,2)+' / '+f(e.R_opt.Tf_in,2)+' °C'); r('Fluid temperature rise',f(R.dT_f,2)+' K'); r('Coil fluid Δp',f(R.dp_f/1e3,1)+' kPa');
  r('Tube Re front / main',R.ic.map(q=>f(q.Re,0)+' '+q.regime).join(' / '));
  h('C. Coil geometry'); r('Face',f(g.W,2)+' × '+f(g.H,2)+' m, depth '+f(g.depth*1e3,0)+' mm incl. '+f(X.gap*1e3,0)+' mm gap');
  g.st.forEach((s,k)=>r(k?'Main stage':'Front stage',f(s.Do*1e3,2)+' × '+f(s.tw*1e3,2)+' mm tube, '+(s.stag?'staggered':'in-line')+' '+f(s.Pt*1e3,2)+' × '+f(s.Pl*1e3,2)+' mm, '+s.rows+' rows × '+s.Nt+' tubes, fin pitch '+f(s.fp*1e3,1)+' mm × '+f(X.tf*1e3,2)+' mm, '+s.Ncirc+' circuits × '+s.passes+' passes, A_o '+f(s.A_o,1)+' m²'));
  r('Fluid path','chiller → main stage (supply at downstream row) → jumper → front stage → return');
  h('D. Air side'); r('Face velocity',f(R.Vf,2)+' m/s'); r('Clean air Δp (Jakob, unverified / scaled)',f(R.dp_air,0)+' / '+f(e.dp_scaled,0)+' Pa; budget '+ist.lim.dp_air_max+' Pa');
  if(gov){ h('E. Icing service'); r('Worst sizing case',SCN[gov.scen]+', MVD '+gov.MVD+' µm, '+f(100*gov.f_hx,1)+' % of the spray reaches the coil'); r('Front stage closes after',tmin(gov.t_clog)+' min (required '+ist.t_target+' min)'); }
  h('F. Construction'); mat.forEach(m=>L.push((md?'- ':'  - ')+m));
  h('G. Please quote and confirm'); ask.forEach(m=>L.push((md?'- ':'  - ')+m));
  L.push('\nModel values from the Smokeline coil designer (port of matlab_v2/esanjor_tasarim.m). The manufacturer\'s rating replaces them.');
  return L.join('\n');
}
function matlabHX(){
  const a=cur(); if(!a) return ''; const X=a.best.X, s1=a.best.R.g.st[0], q=v=>'\''+v+'\'', n=v=>(+v.toPrecision(12)).toString();
  const L=['function X = esanjor_onerilen()','% ESANJOR_ONERILEN  Coil from the Smokeline Coil & Chiller page ('+new Date().toISOString().slice(0,10)+').',
    '%   G = astral_buz_girdi(); G.hx = esanjor_onerilen(); S = astral_buz(G);',
    '% Design point: '+ist.T+' degC, '+ist.V+' m/s, LWC '+ist.LWC+', MVD '+ist.MVD+' um, '+ist.t_target+' min.'];
  const kv=[['genislik',X.W],['yukseklik',X.H],['bosluk',X.gap],['tf',X.tf],['k_fin',X.k_fin],['k_tube',X.k_tube],['K_dirsek',X.K_bend],
    ['Do',X.Do],['tw',X.tw],['Pt',X.Pt],['Pl',X.Pl],['dizilim',X.stag?'sasirtmali':'sirali'],['N1',X.N1],['fp1',X.fp1],
    ['N2',X.N2],['fp2',X.fp2],['Do2',X.Do2],['tw2',X.tw2],['Pt2',X.Pt2],['Pl2',X.Pl2],['dizilim2',X.stag2?'sasirtmali':'sirali'],
    ['Ncirc',0],['Ncirc1',X.Ncirc1],['Ncirc2',X.Ncirc2],['L_mod','devre'],['akis','oto'],['art_Nu',X.art_Nu],['art_f',X.art_f],['art_Re_min',X.art_Re_min],
    ['akiskan',a.name],['debi_m3h',X.flow_m3h],['pompa.mod',X.pump.mode],['pompa.dp_sistem',X.pump.dp_sys],['pompa.eta',X.pump.eta],
    ['dTf',X.dTf],['f_rho',X.f_rho],['f_cp',X.f_cp],['f_mu',X.f_mu],['f_k',X.f_k],['Q_temiz',NaN],['Q_buzlu',NaN],
    ['dp_kaynak','jakob'],['dp_ref',X.dp_ref],['V_ref',X.V_ref],['n_us',X.n_us],['k_buz',X.k_ice],['crho',X.crho],['n_e',X.n_e],['yakalama',X.capture]];
  kv.forEach(([k,v])=>L.push('X.'+k+' = '+(typeof v==='string'?q(v):Array.isArray(v)?'['+v.map(n).join(' ')+']':isNaN(v)?'NaN':n(v))+';'));
  void s1; L.push('end',''); return L.join('\n');
}
function dl(name,text,type){ const b=new Blob([text],{type:type||'text/plain'}), u=URL.createObjectURL(b), a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),2000); }
const note=t=>{ const n=$('#actNote'); n.textContent=t; clearTimeout(note._t); note._t=setTimeout(()=>n.textContent='',3000); };
$('#bCopy').addEventListener('click',()=>{ const t=sheetText(false); (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>note('Copied.')).catch(()=>{ dl('coil_spec.txt',t); note('Clipboard blocked: downloaded as a file.'); }); });
$('#bMd').addEventListener('click',()=>{ dl('coil_spec.md',sheetText(true),'text/markdown'); note('Downloaded coil_spec.md'); });
$('#bM').addEventListener('click',()=>{ dl('esanjor_onerilen.m',matlabHX()); note('Downloaded esanjor_onerilen.m (G.hx format of astral_buz_girdi.m)'); });
$('#bPng').addEventListener('click',()=>{ if(!v3){ note('3D view not available.'); return; } const a=document.createElement('a'); a.href=v3.snapshot(); a.download='coil_3d.png'; a.click(); });
$('#bPrint').addEventListener('click',()=>window.print());

/* ---------------- cooling load ---------------- */
const LC={fan:'#3A5C8F',fanx:'#6E4FC0',wall:'#56677A',sens:'#0A779E',lat:'#1E9BE0',ice:'#4DC2E8',extra:'#B0600A',pump:'#C2410C'};
function renderLoad(){
  const G=GofIst(), Y=H.load(G), a=cur(), e=a&&a.best&&!busy?a.best:null;
  const pc=e?e.R_clean.P_shaft:0, pi=e?e.R.P_shaft:0, sp=Y.spray_parts;
  const parts=[['fan','Fan + motor',Y.Q_fan,Y.Q_fan],['fanx','Fan, iced margin',0,(Y.lam-1)*Y.Q_fan],['wall','Walls',Y.Q_wall,Y.Q_wall],
    ['sens','Spray water to 0 °C',sp.sens,sp.sens],['lat','Freezing',sp.latent,sp.latent],['ice','Ice to air temperature',sp.ice,sp.ice],
    ['extra','Extra',Y.Q_extra,Y.Q_extra],['pump','Pump heat',pc,pi]];
  const tc=parts.reduce((s,p)=>s+p[2],0), ti=parts.reduce((s,p)=>s+p[3],0), mx=Math.max(ti,tc,1);
  const bar=(k)=>'<div class="lbar" style="width:'+(100*(k===2?tc:ti)/mx)+'%">'+parts.map(p=>{ const v=p[k], w=100*v/(k===2?tc:ti||1); return v>0?'<i style="width:'+w+'%;background:'+LC[p[0]]+'" title="'+p[1]+': '+kW(v)+' kW">'+(w>9?'<span>'+kW(v)+'</span>':'')+'</i>':''; }).join('')+'</div>';
  requestAnimationFrame(fitL); setTimeout(fitL,500);
  $('#lPoint').textContent=f(ist.T,0)+' °C · '+f(ist.V,0)+' m/s · LWC '+f(ist.LWC,2);
  $('#lbars').innerHTML='<div class="lrow"><span class="nm">Clean</span>'+bar(2)+'<span class="tt">'+kW(tc)+' kW</span></div>'+
    '<div class="lrow"><span class="nm">Iced · λ '+f(Y.lam,1)+'</span>'+bar(3)+'<span class="tt">'+kW(ti)+' kW</span></div>'+
    '<div class="legend">'+parts.filter(p=>p[3]>0||p[2]>0).map(p=>'<span><i style="background:'+LC[p[0]]+'"></i>'+p[1]+'</span>').join('')+'</div>'+
    '<p class="note" style="margin:12px 0 0">Fan shaft power '+kW(Y.P_fan)+' kW = K<sub>top</sub> · ½ρV² · Q / η<sub>fan</sub>, all of it heat in a closed loop (motor in the air stream). Spray '+f(Y.m_w*1e3,1)+' g/s cooled, frozen and taken to '+f(ist.T,0)+' °C. '+(e?'Pump heat from the coil search goes to the chiller, not the air.':(busy?'Pump heat appears when the coil search finishes.':''))+'</p>';
  const Q=e?e.chiller.Q_sel:Y.Q_sel;
  let ch='<div class="l">Rate the chiller for</div><div class="big">'+kW(Q)+'<small>kW</small></div>';
  if(e){ const lo=Math.min(-60,e.chiller.T_evap_min-4), hi=Math.max(-20,e.T_ch_opt+4), x=t=>(100*(t-lo)/(hi-lo)).toFixed(2)+'%';
    ch+='<p>= '+f(e.chiller.marj,2)+' × '+kW(Y.Q_iced)+' kW iced load + '+kW(e.R.P_shaft)+' kW pump heat, with the fluid leaving it at <b>'+f(e.T_ch,1)+' °C</b> (optimistic '+f(e.T_ch_opt,1)+' °C). The margin is applied to the iced load, as for the fan motor (1.15 × iced shaft power). Ask the supplier for capacity at that temperature: catalogue figures are quoted much warmer.</p>'+
      '<div class="row"><div><div class="v">'+f(e.chiller.T_evap[0],1)+' … '+f(e.chiller.T_evap[1],1)+' °C</div><div class="s">evaporating, '+ist.chiller.dT_evap.join('–')+' K below supply</div></div>'+
      '<div><div class="v">'+kW(e.chiller.Q)+' / '+kW(e.chiller.Q_clean)+' kW</div><div class="s">iced / clean running without margin, incl. pump</div></div>'+
      '<div><div class="v">'+f(e.chiller.CO2_margin,1)+' K</div><div class="s">above the CO₂ triple point (cascade)</div></div>'+
      '<div><div class="v">'+(isFinite(e.freeze_margin)?f(e.freeze_margin,1)+' K':'—')+'</div><div class="s">fluid freeze margin at the evaporator wall</div></div></div>'+
      '<div class="thermo" aria-hidden="true"><div class="ax"></div><div class="band" style="left:'+x(e.chiller.T_evap_min)+';width:calc('+x(e.T_ch_opt)+' - '+x(e.chiller.T_evap_min)+')"><span style="left:50%">evaporator → supply</span></div>'+
      '<div class="lim" style="left:'+x(-56.6)+'"><span>CO₂ −56.6</span></div><div class="lim l2" style="left:'+x(ist.lim.T_evap_min)+'"><span>evap. limit '+f(ist.lim.T_evap_min,0)+'</span></div>'+
      (isFinite(a.vt.Tmin)?'<div class="lim l3" style="left:'+x(a.vt.Tmin)+';background:#8FB0FF"><span style="color:#8FB0FF">fluid min use '+a.vt.Tmin+'</span></div>':'')+'</div>';
  } else ch+='<p>'+f(Y.marj,2)+' × '+kW(Y.Q_iced)+' kW iced load. '+(busy?'Searching coils: pump heat and the supply temperature follow.':'Load only, no coil found for these limits.')+'</p>';
  $('#chiller').innerHTML=ch;
  renderSweep(Y);
}
function sweep(x){
  const G=GofIst(), pts=[]; const rng=x==='V'?[10,60,1]:x==='T'?[-40,-5,1]:[0,3,0.1];
  for(let v=rng[0];v<=rng[1]+1e-9;v+=rng[2]){ const g=deep(G); g[x]=+v.toFixed(3); const Y=H.load(g); pts.push([g[x],Y.Q_clean/1e3,Y.Q_iced/1e3]); }
  return pts;
}
function renderSweep(Y){
  const pts=sweep(xSweep), cx=xSweep==='V'?ist.V:xSweep==='T'?ist.T:ist.LWC, lab=xSweep==='V'?'test-section speed, m/s':xSweep==='T'?'static temperature, °C':'LWC, g/m³';
  lineChart($('#lChart .ch'),{x:pts.map(p=>p[0]),series:[{n:'iced (λ_fan)',y:pts.map(p=>p[2]),c:'#1D4ED8',w:2.4},{n:'clean',y:pts.map(p=>p[1]),c:'#0A779E',w:1.6,dash:'5 4'}],
    xl:lab,yl:'kW',vx:[{x:cx,l:'now'}]});
  $('#lChartNote').textContent='Fan heat grows with V³, so speed dominates: at '+f(ist.V,0)+' m/s the iced load is '+kW(Y.Q_iced)+' kW without pump heat. Other inputs held at the current values.';
}
$('#lChart').addEventListener('click',e=>{ const b=e.target.closest('[data-x]'); if(!b) return; xSweep=b.dataset.x; $$('#lChart [data-x]').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); renderSweep(H.load(GofIst())); });
function renderK(){
  const D=T&&T.sensK||[]; if(!D.length){ $('#kTab').innerHTML=''; $('#kNote').textContent=''; return; }
  $('#kTab').innerHTML='<tr><th>K<sub>top</sub></th><th>case</th><th class="n">Q clean kW</th><th class="n">Q iced kW</th><th class="n">supply iced °C</th><th class="n">supply clean °C</th><th class="n">Re front / main</th></tr>'+
    D.map(q=>'<tr'+(q.label==='default'?' class="sel"':'')+'><td class="mono">'+f(q.K_top,4)+'</td><td>'+q.label+'</td><td class="n">'+kW(q.Q_clean)+'</td><td class="n">'+kW(q.Q_iced)+'</td><td class="n">'+f(q.T_ch,2)+'</td><td class="n">'+f(q.T_ch_clean,2)+'</td><td class="n">'+q.Re.map(r=>f(r,0)).join(' / ')+(q.trans?' ⚠':'')+'</td></tr>').join('');
  $('#kNote').innerHTML='The fan heat is the largest item and scales with K<sub>top</sub>, which carries no design margin. Braunschweig sized its fan with P<sub>fan</sub>/P<sub>jet</sub> = 2.3 (Bansmer et al. 2018); our clean equivalent K<sub>top</sub>/η<sub>fan</sub> = '+f(ist.load.K_top/ist.load.eta_fan,2)+'.';
}

/* ---------------- alternatives ---------------- */
function renderLadder(){
  if(!T){ $('#ladder').innerHTML=''; return; }
  const A=T.fluids.map((a,i)=>({a,i})).filter(x=>x.a.best), all=A.flatMap(x=>[x.a.best.T_ch,x.a.best.T_ch_opt,x.a.best.T_ch_clean]);
  if(!A.length){ $('#ladder').innerHTML='<p class="note">No fluid gives a feasible coil.</p>'; return; }
  const lo=Math.floor(Math.min(...all,-45)-1), hi=Math.ceil(Math.max(...all)+1), x=t=>(100*(t-lo)/(hi-lo));
  const ticks=[]; for(let t=Math.ceil(lo);t<=hi;t+=(hi-lo>12?2:1)) ticks.push(t);
  const ord=T.order.concat(T.fluids.map((a,i)=>i).filter(i=>!T.fluids[i].best));
  $('#ladder').innerHTML='<div class="axis">'+ticks.map(t=>'<span style="left:'+x(t)+'%">'+f(t,0)+'</span>').join('')+'</div>'+
    ord.map(i=>{ const a=T.fluids[i], e=a.best;
      if(!e) return '<div class="lad"><div class="nm"><b>'+esc(a.name)+'</b><span>'+esc(a.status)+'</span></div><div class="trk"></div><div class="act"><span class="xs bad">no coil</span></div>'+(a.why.length?'<div class="why">'+a.why.map(w=>'<span class="xs">'+esc(w)+'</span>').join('')+'</div>':'')+'</div>';
      const l=Math.min(e.T_ch,e.T_ch_opt), r=Math.max(e.T_ch,e.T_ch_opt), rec=i===T.rec.ia, flo=a.T_alt;
      const chips=[rec?'<span class="xs ok">recommended</span>':'', a.suitable?'<span class="xs ok">meets fluid limits</span>':'<span class="xs bad">fails a limit</span>',
        a.vt.flam?'<span class="xs warn">flammable · penalty '+f(a.penalty,1)+' K</span>':'<span class="xs info">non-flammable</span>',
        !a.vt.ok?'<span class="xs bad">not recommendable data</span>':''].join('')+a.why.filter(w=>!/^note/.test(w)).map(w=>'<span class="xs">'+esc(w)+'</span>').join('');
      return '<div class="lad'+(rec?' rec':'')+'"><div class="nm"><b>'+esc(a.name)+'</b><span>'+e.code+' · '+e.row.N2+' rows · '+e.row.Nc1+'/'+e.row.Nc2+' circ. · '+e.row.flow+' m³/h · '+e.R.ic.map(q=>q.regime.slice(0,4)).join('/')+'</span></div>'+
        '<div class="trk" title="supply '+f(e.T_ch,2)+' (conservative) to '+f(e.T_ch_opt,2)+' °C (optimistic); clean '+f(e.T_ch_clean,2)+' °C">'+
        (isFinite(flo)&&flo>lo?'<i class="ln" style="left:'+x(flo)+'%" title="fluid floor '+f(flo,1)+' °C"></i>':'')+
        '<i class="bd" style="left:'+x(l)+'%;width:max(4px,'+(x(r)-x(l))+'%)"></i><i class="cl" style="left:'+x(e.T_ch_clean)+'%"></i></div>'+
        '<div class="act"><span class="v">'+f(e.T_ch,1)+' °C</span><button type="button" class="btn" data-sel="'+i+'"'+(i===sel?' disabled':'')+'>'+(i===sel?'In 3D':'Show in 3D')+'</button></div>'+
        '<div class="why">'+chips+'</div></div>'; }).join('')+
    '<p class="note" style="margin:12px 0 0">Dashed line: the fluid\'s own floor (lowest use temperature, '+f(ist.lim.T_evap_min,0)+' °C evaporating limit or freeze margin, whichever is warmest). Ranking key: conservative supply temperature minus the flammability penalty.</p>';
}
$('#ladder').addEventListener('click',e=>{ const b=e.target.closest('[data-sel]'); if(!b) return; sel=+b.dataset.sel; renderSel(); document.getElementById('studio').scrollIntoView({behavior:'smooth'}); });
function renderScatter(){
  const host=$('#scatter .ch'); if(!T||!T.cand.pts){ host.innerHTML=''; return; }
  const P=T.cand.pts, W=host.clientWidth||900, Hh=340, pad={l:52,r:16,t:12,b:38}, dpr=Math.min(devicePixelRatio||1,2);
  host.innerHTML='<canvas style="width:100%;height:'+Hh+'px;display:block"></canvas><div class="legend" id="scLeg"></div>';
  const c=host.querySelector('canvas'); c.width=W*dpr; c.height=Hh*dpr; const g=c.getContext('2d'); g.scale(dpr,dpr);
  const xs=P.map(p=>p[3]/1e3), ys=P.map(p=>p[2]), x0=0, x1=Math.max(...xs)*1.04, y0=Math.min(...ys)-0.4, y1=Math.max(...ys)+0.4;
  const X=v=>pad.l+(W-pad.l-pad.r)*(v-x0)/(x1-x0), Y=v=>pad.t+(Hh-pad.t-pad.b)*(1-(v-y0)/(y1-y0));
  g.font='11px IBM Plex Mono, monospace'; g.fillStyle='#526170'; g.strokeStyle='#C2CBD3'; g.lineWidth=1;
  const nt=(a,b,n)=>{ const s=Math.pow(10,Math.floor(Math.log10((b-a)/n))), m=[1,2,5,10].find(k=>(b-a)/(s*k)<=n)*s; const o=[]; for(let v=Math.ceil(a/m)*m;v<=b+1e-9;v+=m) o.push(+v.toFixed(6)); return o; };
  nt(y0,y1,6).forEach(v=>{ g.beginPath(); g.moveTo(pad.l,Y(v)); g.lineTo(W-pad.r,Y(v)); g.stroke(); g.fillText(f(v,0),8,Y(v)+4); });
  nt(x0,x1,8).forEach(v=>{ g.fillText(f(v,1),X(v)-8,Hh-pad.b+16); });
  g.fillText('pump shaft power, kW',W/2-60,Hh-6); g.fillText('supply °C',pad.l+4,pad.t+10);
  const order=P.map((p,i)=>i).sort((a,b)=>(P[a][0]===sel)-(P[b][0]===sel));
  order.forEach(i=>{ const p=P[i]; g.globalAlpha=p[0]===sel?0.85:0.32; g.fillStyle=FLC[p[0]%FLC.length]; g.beginPath(); g.arc(X(p[3]/1e3),Y(p[2]),p[0]===sel?2.6:2,0,6.2832); g.fill(); });
  g.globalAlpha=1; const a=cur();
  if(a){ const e=a.best; g.strokeStyle='#101A23'; g.lineWidth=2; g.beginPath(); g.arc(X(e.row.P/1e3),Y(e.row.Tch),8,0,6.2832); g.stroke(); }
  $('#scLeg').innerHTML=T.fluids.map((f2,i)=>'<span><i style="background:'+FLC[i%FLC.length]+'"></i>'+esc(f2.name)+'</span>').join('');
  $('#scN').textContent=f(P.length,0)+' feasible of '+f(T.cand.n_eval,0)+' rated';
}

/* bar labels: shorten or hide a label that does not fit its segment (re-run on resize) */
function fitL(){ document.querySelectorAll('#lbars .lbar i span').forEach(sp=>{ sp.style.visibility=''; sp.style.visibility=sp.offsetWidth+10>sp.parentElement.offsetWidth?'hidden':''; }); }
function fitF(){ document.querySelectorAll('#flowbar i span').forEach(sp=>{ const nm=sp.querySelector('b'), room=sp.parentElement.offsetWidth-8; sp.style.visibility=''; nm.style.display=''; nm.textContent=nm.dataset.f||(nm.dataset.f=nm.textContent);
    if(sp.offsetWidth>room) nm.textContent=sp.dataset.s; if(sp.offsetWidth>room) nm.style.display='none'; if(sp.offsetWidth>room) sp.style.visibility='hidden'; }); }
let fitT; window.addEventListener('resize',()=>{ clearTimeout(fitT); fitT=setTimeout(()=>{ fitL(); fitF(); },150); });

/* ---------------- ice ---------------- */
function renderIce(){
  const B=T&&(T.ice2||T.ice); if(!B){ $('#flowbar').innerHTML=''; $('#mx').innerHTML=''; return; }
  const c=mxSel!=null?B.cells[mxSel]:B.cells[B.inom], cols=['#AD1F55','#6E4FC0','#3A5C8F','#9AA8B5','#0A779E','#1C7A51','#1E9BE0'];
  $('#fbLab').textContent=SCN[c.scen]+' · MVD '+c.MVD+' µm · '+(ist.dist==='tek'?'single size':'Langmuir D');
  $('#flowbar').innerHTML=c.budget.map((b,i)=>{ const w=100*b.share; return w>0.05?'<i style="width:'+w+'%;background:'+(b.name==='Coil (rest)'?'#C2410C':cols[i%cols.length])+'" title="'+esc(b.name)+': '+f(w,1)+' %">'+(w>6?'<span data-s="'+esc(b.name.replace(' (rest)','').replace(/^Corner (\d)/,'C$1'))+'"><b>'+esc(b.name.replace(' (rest)',''))+'</b><em>'+f(w,1)+' %</em></span>':'')+'</i>':''; }).join('');
  requestAnimationFrame(fitF); setTimeout(fitF,550);
  $('#fbNote').innerHTML='Of '+f(B.m_w*1e3,1)+' g/s sprayed, '+f(100*c.f_hx,1)+' % reaches the coil. Heated corners catch nothing; the fan is taken as transparent (not modelled). Click a cell of the matrix to see its budget.';
  const sc=B.scen, mv=B.MVDs;
  $('#mx').style.gridTemplateColumns='64px repeat('+sc.length+',1fr)';
  const col=t=>{ const r=Math.min(1.6,(isFinite(t)?t:99)/ist.t_target); return r>=1?'hsl('+(168+40*Math.min(0.6,r-1))+' 55% '+(30+8*(r-1))+'%)':'hsl('+(8+30*r)+' 70% '+(38+6*r)+'%)'; };
  $('#mx').innerHTML='<div></div>'+sc.map(s=>'<div class="h">'+SCN[s]+'</div>').join('')+mv.map(m=>'<div class="rh">'+m+' µm</div>'+sc.map(s=>{ const i=B.cells.findIndex(x=>x.MVD===m&&x.scen===s), x=B.cells[i];
      const tf=Math.min(x.t_first,x.t_clog), who=x.t_first<=x.t_clog?x.first:'Coil';
      return '<div class="c'+(i===B.gov?' gov':'')+(i===mxSel?' sel':'')+'" data-cell="'+i+'" style="background:'+col(tf)+'" title="front stage closes at '+tmin(x.t_clog)+' min; first part '+esc(x.first||'none')+'">'+(x.sizing?'<span class="sz">SIZING</span>':'')+'<b>'+tmin(tf)+'</b>'+(isFinite(tf)?esc(who):'nothing closes')+'<br><span style="opacity:.85">coil '+f(100*x.f_hx,0)+' % water</span></div>'; }).join('')).join('');
  $('#mxNote').innerHTML='Number: minutes until the first part closes (b = '+f(B.b_lim,1)+') with this coil; corners on the '+f(Math.max(45,Math.ceil(1.5*ist.t_target)),0)+'-minute grid. Teal: lasts the '+ist.t_target+'-minute target; red: ends earlier. The outlined cell set the front fin pitch ('+f(B.fpNeed*1e3,2)+' mm needed → '+f(B.fp1*1e3,0)+' mm).';
  renderBlock();
}
$('#mx').addEventListener('click',e=>{ const c=e.target.closest('[data-cell]'); if(!c) return; mxSel=+c.dataset.cell; renderIce(); });
function renderBlock(){
  const S=T&&T.S, host=$('#bChart .ch'); if(!S){ host.innerHTML=''; return; }
  const t=S.t_min, ser=S.corners.filter(k=>!k.heated).map((k,i)=>({n:k.name,y:k.b_hi,c:['#AD1F55','#6E4FC0','#3A5C8F','#56677A'][i%4],w:1.6}));
  ser.push({n:'Coil front stage',y:S.hx.b,c:'#C2410C',w:2.4});
  host.innerHTML='<div class="c1"></div><div class="c2"></div>';
  lineChart(host.querySelector('.c1'),{x:t,series:ser,xl:'spray time, min',yl:'b',ymin:0,ymax:1,hy:[{y:ist.G.b_lim,l:'b_lim'}],vx:[{x:ist.t_target,l:'target'}],h:220});
  lineChart(host.querySelector('.c2'),{x:t,series:[{n:'λ upper',y:S.lam_hi,c:'#1D4ED8',w:2},{n:'λ lower',y:S.lam_lo,c:'#1D4ED8',w:1.2,dash:'4 4'}],xl:'spray time, min',yl:'λ',ymin:1,ymax:Math.max(2.4,ist.G.lam_fan+0.3),hy:[{y:ist.G.lam_fan,l:'λ_fan'}],vx:[{x:ist.t_target,l:'target'}],h:170});
  $('#bLab').textContent='as built · '+ist.MVD+' µm · first: '+(S.first||'none')+' '+tmin(S.t_first)+' min';
}

/* ---------------- generic SVG line chart ---------------- */
function lineChart(host,o){
  const W=Math.max(320,host.clientWidth||640), Hh=o.h||260, p={l:46,r:14,t:14,b:34};
  const xs=o.x, x0=Math.min(...xs), x1=Math.max(...xs), all=o.series.flatMap(s=>s.y).filter(isFinite);
  let y0=o.ymin!=null?o.ymin:Math.min(0,...all), y1=o.ymax!=null?o.ymax:Math.max(...all)*1.08; if(y1<=y0) y1=y0+1;
  const X=v=>p.l+(W-p.l-p.r)*(v-x0)/(x1-x0||1), Y=v=>p.t+(Hh-p.t-p.b)*(1-(Math.min(Math.max(v,y0),y1)-y0)/(y1-y0));
  const nt=(a,b,n)=>{ const s=Math.pow(10,Math.floor(Math.log10((b-a)/n||1))), m=[1,2,2.5,5,10].find(k=>(b-a)/(s*k)<=n)*s; const r=[]; for(let v=Math.ceil(a/m)*m;v<=b+1e-9;v+=m) r.push(+v.toFixed(6)); return r; };
  let s='<svg viewBox="0 0 '+W+' '+Hh+'" role="img" aria-label="'+esc(o.yl+' against '+o.xl)+'">';
  nt(y0,y1,5).forEach(v=>{ s+='<line class="gl" x1="'+p.l+'" x2="'+(W-p.r)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text x="'+(p.l-6)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+f(v,v%1?1:0)+'</text>'; });
  nt(x0,x1,8).forEach(v=>{ s+='<text x="'+X(v)+'" y="'+(Hh-p.b+16)+'" text-anchor="middle">'+f(v,v%1?1:0)+'</text>'; });
  s+='<text x="'+(W-p.r)+'" y="'+(Hh-4)+'" text-anchor="end">'+esc(o.xl)+'</text><text x="'+(p.l)+'" y="'+(p.t-3)+'">'+esc(o.yl)+'</text>';
  (o.hy||[]).forEach(h=>{ s+='<line x1="'+p.l+'" x2="'+(W-p.r)+'" y1="'+Y(h.y)+'" y2="'+Y(h.y)+'" stroke="#9A5A00" stroke-dasharray="3 3"/><text x="'+(W-p.r-4)+'" y="'+(Y(h.y)-4)+'" text-anchor="end" style="fill:#9A5A00">'+esc(h.l)+'</text>'; });
  (o.vx||[]).forEach(h=>{ if(h.x<x0||h.x>x1) return; s+='<line x1="'+X(h.x)+'" x2="'+X(h.x)+'" y1="'+p.t+'" y2="'+(Hh-p.b)+'" stroke="#101A23" stroke-dasharray="2 3"/><text x="'+(X(h.x)+4)+'" y="'+(p.t+10)+'" style="fill:#101A23">'+esc(h.l)+'</text>'; });
  o.series.forEach(se=>{ let d='', pen=false; se.y.forEach((v,i)=>{ if(!isFinite(v)){pen=false;return;} d+=(pen?'L':'M')+X(xs[i]).toFixed(1)+' '+Y(v).toFixed(1); pen=true; });
    s+='<path d="'+d+'" fill="none" stroke="'+se.c+'" stroke-width="'+(se.w||1.6)+'"'+(se.dash?' stroke-dasharray="'+se.dash+'"':'')+' stroke-linejoin="round"/>'; });
  s+='</svg><div class="legend" style="margin-top:4px">'+o.series.map(se=>'<span><i style="background:'+se.c+'"></i>'+esc(se.n)+'</span>').join('')+'</div>';
  host.innerHTML=s;
}

/* ---------------- method ---------------- */
const fr=(a,b)=>'<span class="frac"><span>'+a+'</span><span>'+b+'</span></span>';
function renderMethod(){
  const a=cur(); if(!a){ $('#chain').innerHTML=''; $('#searchTxt').innerHTML=''; return; } const e=a.best, R=e.R, g=R.g, P=T.point, Y=T.load, air=R.air;
  const li=(eq,r)=>'<li><span class="eq">'+eq+'</span><span class="r">'+r+'</span></li>';
  const st=g.st;
  $('#chain').innerHTML=
    li('<i>Q</i><sub>iced</sub> = λ<sub>fan</sub> <i>Q</i><sub>fan</sub> + <i>Q</i><sub>wall</sub> + <i>Q</i><sub>spray</sub> + <i>Q</i><sub>extra</sub>', f(Y.lam,1)+' × '+kW(Y.Q_fan)+' + '+kW(Y.Q_wall)+' + '+kW(Y.Q_spray)+' + '+kW(Y.Q_extra)+' = '+kW(Y.Q_iced)+' kW')+
    li('<i>Q</i><sub>chiller,spec</sub> = <i>m</i> · max(<i>Q</i><sub>clean</sub>, <i>Q</i><sub>iced</sub>) + <i>P</i><sub>pump</sub>', f(e.chiller.marj,2)+' × '+kW(Math.max(Y.Q_clean,Y.Q_iced))+' + '+kW(R.P_shaft)+' = '+kW(e.chiller.Q_sel)+' kW (margin on the iced load, as for the fan motor)')+
    li('<i>T</i><sub>0</sub> = <i>T</i> + '+fr('<i>V</i><sup>2</sup>','2<i>c</i><sub>p</sub>'), 'air leaves the coil at '+f(P.T0,2)+' °C; ρ = '+f(air.rho,4)+' kg/m³, μ = '+(air.mu*1e5).toFixed(3)+'·10⁻⁵ Pa·s')+
    li('<i>V</i><sub>face</sub> = '+fr('<i>ṁ</i>','ρ <i>A</i><sub>face</sub>'), f(P.mdot,3)+' kg/s over '+f(g.A_face,2)+' m² → '+f(R.Vf,3)+' m/s')+
    st.map((s,k)=>{ const r=R.stages[k]; return li((k?'Main':'Front')+' stage: <i>Nu</i> = <i>C</i> <i>Re</i><sup>0.6</sup> ('+fr('<i>A</i><sub>o</sub>','<i>A</i><sub>t0</sub>')+')<sup>−0.15</sup> <i>Pr</i><sup>1/3</sup>, &nbsp;η<sub>o</sub> = 1 − '+fr('<i>A</i><sub>fin</sub>','<i>A</i><sub>o</sub>')+'(1 − η<sub>fin</sub>)',
      'Re '+f(r.Re,0)+', C '+r.C+', Nu '+f(r.Nu,1)+', h '+f(r.h,2)+' W/m²K'+(k===0&&T.dIce>0?' (with '+f(T.dIce*1e3,2)+' mm ice: '+f(r.he,2)+')':'')+', η<sub>fin</sub> '+f(r.eta,3)+', η<sub>o</sub> '+f(r.eo,3)+', UA<sub>air</sub> '+f(r.UA,0)+' W/K'); }).join('')+
    li('Fluid properties at <i>T</i><sub>m</sub> = <i>T</i><sub>f,in</sub> + ½Δ<i>T</i><sub>f</sub>', esc(a.name)+' at '+f(R.Tm,2)+' °C: ρ '+f(R.prop.rho,1)+', c<sub>p</sub> '+f(R.prop.cp,0)+', k '+f(R.prop.k,3)+', μ '+f(R.prop.mu*1e3,2)+' mPa·s (datasheet table)')+
    R.ic.map((q,k)=>li((k?'Main':'Front')+' stage tubes: <i>Re</i> = '+fr('ρ <i>v</i> <i>D</i><sub>i</sub>','μ')+', &nbsp;'+(q.regime==='laminar'?'<i>Nu</i> = 3.66 + '+fr('0.0668 <i>Gz</i>','1 + 0.04 <i>Gz</i><sup>2/3</sup>'):'Gnielinski'),
      'v '+f(q.v,3)+' m/s, Re '+f(q.Re,0)+' ('+q.regime+'), Pr '+f(q.Pr,1)+', L '+f(q.L_H,1)+' m, Nu '+f(q.Nu,2)+', h<sub>i</sub> '+f(q.hi,0)+' W/m²K, Δp '+f(q.dp/1e3,1)+' kPa')).join('')+
    li(fr('1','<i>UA</i><sub>stage</sub>')+' = '+fr('1','<i>UA</i><sub>air</sub>')+' + <i>R</i><sub>w</sub> + '+fr('1','<i>h</i><sub>i</sub> <i>A</i><sub>i</sub>')+', &nbsp; <i>UA</i> = Σ <i>UA</i><sub>stage</sub>', R.ic.map((q,k)=>(k?'main ':'front ')+f(q.UA,0)).join(', ')+' → UA '+f(R.UA,0)+' W/K; '+f(100*R.share_tube,0)+' % of the resistance is inside the tubes')+
    li('ε = '+fr('1 − e<sup>−NTU(1−<i>C</i><sub>r</sub>)</sup>','1 − <i>C</i><sub>r</sub> e<sup>−NTU(1−<i>C</i><sub>r</sub>)</sup>')+', &nbsp; NTU = '+fr('<i>UA</i>','<i>C</i><sub>min</sub>'), 'C<sub>air</sub> '+f(P.mdot*1005,0)+', C<sub>f</sub> '+f(R.Cf,0)+' W/K, NTU '+f(R.NTU,4)+', ε '+f(R.eps,4)+' (counter-flow)')+
    li('<i>T</i><sub>f,in</sub> = <i>T</i><sub>air,in</sub> − '+fr('<i>Q</i>','ε <i>C</i><sub>min</sub>')+', &nbsp; <i>T</i><sub>chiller</sub> = <i>T</i><sub>f,in</sub> − '+fr('<i>P</i><sub>pump</sub>','<i>C</i><sub>f</sub>'), 'air in '+f(R.Tin,3)+' °C → fluid in '+f(R.Tf_in,3)+' °C; pump '+f(R.P_shaft,0)+' W → chiller '+f(R.T_chiller,3)+' °C')+
    li('Approach limit: <i>T</i><sub>f,in</sub> &lt; <i>T</i><sub>0</sub>', 'remaining approach '+f(P.T0-R.Tf_in,2)+' K; cross-flow instead of counter-flow: '+f(e.R_cross.Tf_in,2)+' °C');
  const K=ist.lim;
  $('#searchTxt').innerHTML='<p style="margin-top:0">'+f(T.cand.n_eval,0)+' coils rated, '+f(T.cand.n_valid,0)+' met every limit, '+f(T.cand.n_trans,0)+' rejected for a stage in the transition range. Run time '+f(T.ms/1000,2)+' s in your browser.</p>'+
    '<ol style="padding-left:18px;margin:0;font-size:14px"><li>Ice matrix: MVD '+T.ice.MVDs.join(', ')+' µm × '+T.ice.scen.map(s=>SCN[s].toLowerCase()).join(', ')+' → water reaching the coil → front fin pitch '+f(T.fp1*1e3,0)+' mm.</li>'+
    '<li>Front stage fixed: '+H.pattern(ist.front.code).name+', '+ist.front.N1+' rows. Main stage: patterns '+ist.main.codes.join(', ')+', '+ist.main.N2[0]+'–'+ist.main.N2[ist.main.N2.length-1]+' rows, every circuit count that divides the tubes into an even number of passes, flow 10–60 m³/h.</li>'+
    '<li>Limits: fluid Δp ≤ '+f(K.dp_f_max/1e3,0)+' kPa, '+K.v_min+' ≤ v ≤ '+K.v_max+' m/s, air Δp ≤ '+K.dp_air_max+' Pa, depth ≤ '+f(K.depth_max*1e3,0)+' mm, ≤ '+K.Nc_max+' circuits'+(K.no_transition?', no stage in 2300 < Re < 4000':'')+', and a solution at the clean load too.</li>'+
    '<li>Objective: the warmest chiller supply at the iced load with the conservative Hausen length. Ties within 0.3 K: lowest pump power, fewest rows, fewest circuits, lowest air Δp.</li>'+
    '<li>Fluids ranked by supply temperature minus the flammability penalty; the first with full datasheet data that meets its own limits is recommended.</li></ol>'+
    '<h4 style="font:600 13px var(--f-body);margin:18px 0 6px">Best coil per fluid and tube pattern <span class="note">(supply °C; rows · circuits front/main · m³/h)</span></h4><div class="tscroll"><table class="t"><tr><th>fluid</th>'+ist.main.codes.map(c=>'<th class="n">'+c+'</th>').join('')+'</tr>'+T.fluids.map(a2=>'<tr'+(a2===a?' class="sel"':'')+'><td>'+esc(a2.name)+'</td>'+ist.main.codes.map(c=>{ const p=(a2.patterns||[]).find(q=>q.code===c); return '<td class="n">'+(p&&p.pick?f(p.pick.Tch,2)+'<br><span class="note" style="font-size:11px">'+p.pick.N2+' r · '+p.pick.Nc1+'/'+p.pick.Nc2+' · '+p.pick.flow+'</span>':'—')+'</td>'; }).join('')+'</tr>').join('')+'</table></div>';
}
function renderVT(){
  const lab={ok:['ok','checked'],part:['info','partly'],no:['bad','not checked'],conflict:['warn','sources disagree'],tb:['','textbook form'],est:['warn','estimate'],rule:['','rule of thumb'],site:['','earlier result']};
  $('#vt').innerHTML='<tr><th>#</th><th>Relation or value</th><th>Status</th><th>Source</th><th>Note</th></tr>'+HXSources.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td><td><span class="xs '+lab[r[2]][0]+'">'+lab[r[2]][1]+'</span></td><td>'+r[3]+'</td><td>'+r[4]+'</td></tr>').join('');
}

/* ---------------- orchestration ---------------- */
function renderSel(){ renderHUD(); renderStrip(); renderMsgs(); renderSheet(); renderKPI(); renderLoad(); renderLadder(); renderScatter(); render3D(); renderMethod(); }
function renderAll(){ renderSel(); renderK(); renderIce(); }
const ro=new ResizeObserver(()=>{ if(T){ renderScatter(); renderBlock(); renderSweep(H.load(GofIst())); } });
ro.observe($('#scatter'));
/* section highlight in the bar */
const navIO=new IntersectionObserver(es=>es.forEach(x=>{ if(x.isIntersecting){ $$('.cnav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+x.target.id)); } }),{rootMargin:'-40% 0px -55% 0px'});
['studio','spec','load','alts','ice','method'].forEach(id=>navIO.observe(document.getElementById(id)));

renderConsole(); renderVT(); renderLoad(); renderKPI(); run();
})();
