/* Smokeline · closed-circuit icing tunnel · PDF datasheet (loaded on demand by app.js).
   Vector A4 pages drawn with jsPDF: cover with plan drawing and QR code, geometry, aerodynamics,
   thermal & icing, speed sweep, design audit, input record. Fonts: IBM Plex (same family as the site),
   falling back to the PDF base fonts if they cannot be fetched. */
(function(){
'use strict';
const JSPDF='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const QR='https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
const PLEX='https://cdn.jsdelivr.net/gh/IBM/plex@v6.4.0/';
const FONTS=[['IBM-Plex-Sans/fonts/complete/ttf/IBMPlexSans-Regular.ttf','Plex','normal'],['IBM-Plex-Sans/fonts/complete/ttf/IBMPlexSans-SemiBold.ttf','Plex','bold'],
  ['IBM-Plex-Mono/fonts/complete/ttf/IBMPlexMono-Regular.ttf','PlexMono','normal'],['IBM-Plex-Mono/fonts/complete/ttf/IBMPlexMono-Medium.ttf','PlexMono','bold'],
  ['IBM-Plex-Sans-Condensed/fonts/complete/ttf/IBMPlexSansCondensed-Bold.ttf','PlexCond','bold']];
const C={ink:'#0C1A21',muted:'#4D626E',line:'#C9D5DB',faint:'#E6EDF0',accent:'#0A7C9C',paper:'#FFFFFF',tint:'#F1F6F8',
  ok:'#1C7A51',warn:'#9A5A00',bad:'#B42318',info:'#3B6E8F',
  k:{test:'#B0600A',model:'#AD1F55',diff:'#1C7A51',corner:'#4652C9',duct:'#56677A',fan:'#C2410C',hx:'#0B86A8',set:'#6E4FC0',spray:'#0E8F7E',noz:'#1F6FB8'}};
const W=210, H=297, M=15;
let fontCache=null;

function load(src,test){ return new Promise((res,rej)=>{ if(test()) return res(); const s=document.createElement('script'); s.src=src; s.async=true; s.onload=()=>res(); s.onerror=()=>rej(new Error('Could not load '+src)); document.head.appendChild(s); }); }
function b64(buf){ let bin=''; const u=new Uint8Array(buf); for(let i=0;i<u.length;i+=0x8000) bin+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(bin); }
async function getFonts(){
  if(fontCache) return fontCache;
  try{ const bufs=await Promise.all(FONTS.map(f=>fetch(PLEX+f[0]).then(r=>{ if(!r.ok) throw new Error(r.status); return r.arrayBuffer(); })));
    fontCache=bufs.map((b,i)=>({file:FONTS[i][0].split('/').pop(),name:FONTS[i][1],style:FONTS[i][2],data:b64(b)})); }
  catch(_){ fontCache=[]; }
  return fontCache;
}
const TRANS={'Δ':'d','ρ':'rho','θ':'theta','η':'eta','β':'beta','µ':'u','ψ':'psi','φ':'phi','λ':'lambda','σ':'sigma','τ':'tau','₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','²':'2','³':'3','≥':'>=','≤':'<=','≈':'~','→':'->','√':'sqrt','−':'-','⁻':'-','⁰':'0','¹':'1','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};

async function exportSheet(ST,O,prog){
  prog(0.1,'Loading PDF engine…');
  await load(JSPDF,()=>window.jspdf&&window.jspdf.jsPDF);
  await load(QR,()=>typeof window.qrcode==='function').catch(()=>{});
  prog(0.25,'Loading IBM Plex…');
  const fonts=await getFonts();
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});
  fonts.forEach(f=>{ doc.addFileToVFS(f.file,f.data); doc.addFont(f.file,f.name,f.style); });
  const uni=fonts.length===FONTS.length;
  const FS=uni?'Plex':'helvetica', FM=uni?'PlexMono':'courier', FC=uni?'PlexCond':'helvetica';
  const tx=s=>{ s=String(s==null?'':s).replace(/ṁ/g,'m').replace(/≲/g,'≤').replace(/ /g,' ');
    return uni?s:s.replace(/[^\x00-\xFF]/g,c=>TRANS[c]!=null?TRANS[c]:'?'); };
  const {R,G,TB,TBs,IC,AU,GT,FC:FCv,SW,P,FIELDS,GROUPS,PT,id,helpers:Hh}=ST;
  const {nf,ni,ne,kW}=Hh;
  const date=new Date().toISOString().slice(0,10);
  const font=(f,st,sz,col)=>{ doc.setFont(f,st); doc.setFontSize(sz); doc.setTextColor(col||C.ink); };
  const T=(s,x,y,o)=>doc.text(tx(s),x,y,o||{});
  const line=(x1,y1,x2,y2,col,w)=>{ doc.setDrawColor(col||C.line); doc.setLineWidth(w||0.2); doc.line(x1,y1,x2,y2); };
  const alpha=a=>doc.setGState(new doc.GState({opacity:a,'stroke-opacity':a}));
  const poly=(pts,style,closed)=>{ if(pts.length<2) return; const d=[]; for(let i=1;i<pts.length;i++) d.push([pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]]); doc.lines(d,pts[0][0],pts[0][1],[1,1],style||'S',closed!==false); };
  let page=0, y=0;
  const total={n:0};

  /* ---------- page furniture ---------- */
  function head(title,no){
    if(page>0) doc.addPage(); page++;
    doc.setFillColor(C.paper); doc.rect(0,0,W,H,'F');
    /* faint diagonal wordmark behind every page: marks the sheet as produced with Smokeline */
    alpha(0.045); font(FC,'bold',118,C.accent); T('SMOKELINE',W/2-82,H/2+70,{angle:55}); alpha(1);
    font(FC,'bold',10.5,C.ink); T('SMOKE',M,11); const w=doc.getTextWidth('SMOKE'), wl=doc.getTextWidth('LINE'); doc.setTextColor(C.accent); T('LINE',M+w,11);
    font(FM,'normal',6.6,C.muted); T('ICING WIND TUNNEL · TECHNICAL DATASHEET',M+w+wl+4,11);
    T(id+'  ·  REV '+O.rev+'  ·  '+date,W-M,11,{align:'right'});
    line(M,13.5,W-M,13.5,C.ink,0.35);
    y=22;
    if(title){
      font(FC,'bold',30,C.line); doc.setDrawColor(C.muted); doc.setLineWidth(0.25); T(no,M,y+9,{renderingMode:'stroke'});
      font(FC,'bold',19,C.ink); T(title,M+(no.length*6.2)+5,y+8.2);
      y+=17;
    }
  }
  function foot(){
    const n=doc.getNumberOfPages();
    for(let i=1;i<=n;i++){ doc.setPage(i);
      line(M,H-12,W-M,H-12,C.line,0.2);
      font(FM,'normal',6.3,C.muted);
      T(O.name+(O.by?' · '+O.by:'')+(O.org?' · '+O.org:''),M,H-8);
      font(FS,'normal',5.6,C.muted); T('1D preliminary design estimate · not a substitute for detailed design, CFD or calibration · windtunnel-theta.vercel.app',M,H-5);
      font(FM,'normal',6.3,C.muted);
      T(i+' / '+n,W-M,H-8,{align:'right'}); }
  }
  function need(h,title,no){ if(y+h>H-18){ head(title?title+' (cont.)':'',no||''); } }
  function sub(t,sz){ need(12); font(FS,'bold',sz||9.5,C.ink); T(t,M,y); y+=1.8; line(M,y,W-M,y,C.ink,0.3); y+=4.2; }
  function para(t,sz,col,w){ font(FS,'normal',sz||7.6,col||C.muted); const ls=doc.splitTextToSize(tx(t),w||W-2*M); need(ls.length*3.3+1); doc.text(ls,M,y); y+=ls.length*(sz?sz*0.42:3.3)+1.5; }
  /* generic table: cols [{t,w,a:'l'|'r'|'c',m:mono}] rows [{c:[...],sw:color,bar:[colIndex,frac,color],b:bold,hl:true}] */
  function table(cols,rows,o){
    o=o||{}; const rh=o.rh||4.7, fs=o.fs||6.9, x0=o.x||M, wsum=cols.reduce((a,c)=>a+c.w,0);
    const header=()=>{ font(FS,'normal',6.1,C.muted); let x=x0; cols.forEach(c=>{ const tt=tx(c.t); if(c.a==='r') doc.text(tt,x+c.w-1,y,{align:'right'}); else if(c.a==='c') doc.text(tt,x+c.w/2,y,{align:'center'}); else doc.text(tt,x+(c.sw?3.2:0),y); x+=c.w; });
      y+=1.4; line(x0,y,x0+wsum,y,C.ink,0.25); y+=3.4; };
    header();
    rows.forEach((r,ri)=>{
      if(y+rh>H-18){ head(o.cont||'',''); header(); }
      if(r.hl){ doc.setFillColor(C.tint); doc.rect(x0,y-3.3,wsum,rh,'F'); }
      let x=x0;
      cols.forEach((c,ci)=>{
        const v=r.c[ci]; font(c.m?FM:FS,r.b?'bold':'normal',fs,r.col&&ci===0?r.col:C.ink);
        if(ci===0&&r.sw){ doc.setFillColor(r.sw); doc.rect(x,y-2.25,2,2,'F'); }
        if(r.bar&&r.bar[0]===ci){ doc.setFillColor(r.bar[2]); alpha(0.85); doc.rect(x+c.w-1-r.bar[1]*(c.w*0.55),y+0.4,r.bar[1]*(c.w*0.55),0.7,'F'); alpha(1); }
        const tt=tx(v==null?'':v);
        if(c.a==='r') doc.text(tt,x+c.w-1,y,{align:'right'}); else if(c.a==='c') doc.text(tt,x+c.w/2,y,{align:'center'}); else doc.text(tt,x+(ci===0&&r.sw?3.2:0),y,{maxWidth:c.w-1});
        x+=c.w; });
      y+=rh*0.35; line(x0,y,x0+wsum,y,C.faint,0.15); y+=rh*0.65;
    });
    y+=2;
  }
  function kvGrid(items,cols,o){
    o=o||{}; const cw=(W-2*M)/cols, ch=o.h||13.5, x0=M; need(Math.ceil(items.length/cols)*ch+2);
    items.forEach((it,i)=>{ const cx=x0+(i%cols)*cw, cy=y+Math.floor(i/cols)*ch;
      doc.setDrawColor(C.line); doc.setLineWidth(0.2); doc.setFillColor(it.hl?C.tint:C.paper); doc.rect(cx,cy,cw,ch,'FD');
      font(FS,'normal',5.9,C.muted); T(String(it[0]).replace(/[a-z]/g,ch=>ch.toUpperCase()),cx+2.4,cy+4.2,{charSpace:0.15});
      font(FC,'bold',o.big||13,C.ink); T(it[1],cx+2.4,cy+10.4); const vw=doc.getTextWidth(tx(it[1]));
      font(FS,'normal',6.3,C.muted); T(it[2]||'',cx+3.6+vw,cy+10.4); });
    y+=Math.ceil(items.length/cols)*ch+5;
  }
  function chart(x,yy,w,h,cfg){
    const xs=cfg.series.flatMap(s=>s.x), ys=cfg.series.flatMap(s=>s.y);
    const nice=(mx,n)=>{ const raw=mx/n, mag=Math.pow(10,Math.floor(Math.log10(raw))), nm=raw/mag, st=(nm<1.5?1:nm<3?2:nm<7?5:10)*mag; const t=[]; for(let v=0;v<mx-1e-9;v+=st) t.push(+v.toFixed(10)); t.push(+(t[t.length-1]+st).toFixed(10)); return t; };
    const xt=nice(Math.max(...xs),6), yt=nice(Math.max(...ys,...(cfg.marks||[]).map(m=>m.y))*1.04,5), xM=xt[xt.length-1], yM=yt[yt.length-1];
    const l=x+11, b=yy+h-7, iw=w-13, ih=h-11, X=v=>l+v/xM*iw, Y=v=>b-v/yM*ih;
    font(FS,'bold',7.3,C.ink); T(cfg.title,x,yy+2);
    yt.forEach(v=>{ line(l,Y(v),l+iw,Y(v),C.faint,0.15); font(FM,'normal',5.6,C.muted); T(Hh.ns(v,3),l-1.2,Y(v)+1,{align:'right'}); });
    xt.forEach(v=>{ font(FM,'normal',5.6,C.muted); T(Number.isInteger(v)?String(v):Hh.ns(v,3),X(v),b+3.4,{align:'center'}); });
    font(FS,'normal',5.8,C.muted); T(cfg.xl,l+iw/2,b+6.6,{align:'center'});
    line(l,b,l+iw,b,C.ink,0.25);
    cfg.series.forEach(s=>{ doc.setDrawColor(s.c); doc.setLineWidth(s.w||0.45); if(s.dash) doc.setLineDashPattern([1.2,0.9],0);
      const pts=s.x.map((v,i)=>[X(v),Y(s.y[i])]).filter(p=>p[1]>=b-ih-0.5); if(pts.length>1) poly(pts,'S',false); doc.setLineDashPattern([],0); });
    (cfg.marks||[]).forEach(m=>{ doc.setFillColor(m.c); doc.circle(X(m.x),Y(m.y),0.9,'F'); font(FM,'bold',5.8,m.c); T(m.l,X(m.x)+1.6,Y(m.y)-1.4); });
    let lx=l+2; cfg.series.forEach(s=>{ doc.setDrawColor(s.c); doc.setLineWidth(0.6); if(s.dash) doc.setLineDashPattern([1.2,0.9],0); doc.line(lx,yy+5.5,lx+4,yy+5.5); doc.setLineDashPattern([],0); font(FS,'normal',5.8,C.muted); T(s.n,lx+5,yy+6.4); lx+=7+doc.getTextWidth(tx(s.n)); });
  }
  /* plan drawing of the circuit into a box (mm) */
  function plan(x,yy,w,h,opts){
    opts=opts||{}; const ex=PT.ext, k=Math.min((w-12)/(ex.x1-ex.x0),(h-18)/(ex.y1-ex.y0)), pw=(ex.x1-ex.x0)*k, ph=(ex.y1-ex.y0)*k;
    const ox=x+(w-pw)/2-ex.x0*k, oy=yy+(h-ph)/2-3+ex.y1*k, v={cam:{ox,oy,k}}, X=a=>ox+a*k, Y=b=>oy-b*k;
    const outer=Hh.wallPts(v,-1), inner=Hh.wallPts(v,1);
    doc.setFillColor('#EAF3F6'); poly(outer,'F'); doc.setFillColor(C.paper); poly(inner,'F');
    /* component bands */
    PT.segs.forEach(q=>{ if(q.t==='C') return; const bb=Hh.band(v,q.s0,q.s1); doc.setFillColor(C.k[q.key]||C.muted); alpha(0.16); poly(bb,'F'); alpha(1); });
    /* elements */
    const dn=PT.byId.dn;
    const hb=Hh.band(v,PT.at_hx,PT.at_hx+Math.max(G.dn.t_hx,0.04)); doc.setFillColor(C.k.hx); alpha(0.55); poly(hb,'F'); alpha(1);
    if(dn){ doc.setDrawColor(C.muted); doc.setLineWidth(0.15); doc.setLineDashPattern([0.6,0.6],0);
      G.dn.x_el.forEach(xe=>{ const o=Hh.pathAt(PT,dn.s0+xe); doc.line(X(o.x),Y(o.y+o.w/2),X(o.x),Y(o.y-o.w/2)); });
      doc.setLineDashPattern([],0);
      const hc=Hh.band(v,dn.s0+G.dn.x_hc,dn.s0+G.dn.x_hc+Math.max(G.hc.L,0.03)); doc.setDrawColor(C.muted); poly(hc,'S');
      const sp=Hh.pathAt(PT,PT.at_sp), per=Math.max(1,Math.round(G.sp.Nn/Math.max(1,G.sp.N))); doc.setFillColor(C.k.spray);
      for(let i=0;i<per;i++){ const lat=(-1+(2*i+1)/per)*sp.w/2*0.9; doc.circle(X(sp.x+sp.nx*lat),Y(sp.y+sp.ny*lat),0.35,'F'); } }
    doc.setDrawColor(C.muted); doc.setLineWidth(0.12);
    Hh.vanesAll().forEach(a=>poly(a.map(p=>[X(p[0]),Y(p[1])]),'S',false));
    const fq=PT.byId.fan; if(fq){ const o=Hh.segAt(fq,fq.L*0.5), nc=R.fan.ncol; doc.setDrawColor(C.k.fan); doc.setLineWidth(0.7);
      for(let i=0;i<nc;i++){ const lat=(-1+(2*i+1)/nc)*o.w/2, cx=o.x+o.nx*lat, cy=o.y+o.ny*lat; doc.line(X(cx+o.nx*G.fan.D/2),Y(cy+o.ny*G.fan.D/2),X(cx-o.nx*G.fan.D/2),Y(cy-o.ny*G.fan.D/2)); } }
    const x0=PT.x0+PT.sLE, c=PT.c, fp=[]; for(let i=0;i<=30;i++){ const xc=(1-Math.cos(Math.PI*i/30))/2; fp.push([X(x0+xc*c),Y(Hh.ythk(xc,Hh.TC)*c)]); }
    for(let i=30;i>=0;i--){ const xc=(1-Math.cos(Math.PI*i/30))/2; fp.push([X(x0+xc*c),Y(-Hh.ythk(xc,Hh.TC)*c)]); }
    doc.setFillColor(C.k.model); poly(fp,'F');
    doc.setDrawColor(C.ink); doc.setLineWidth(0.35); poly(outer,'S'); poly(inner,'S');
    /* corners + flow arrows */
    PT.segs.filter(q=>q.t==='C').forEach(q=>{ const dx=Math.sign(q.O[0]-q.I[0]), dy=-Math.sign(q.O[1]-q.I[1]), cx=X(q.O[0])+dx*3, cy=Y(q.O[1])+dy*3;
      doc.setFillColor(C.paper); doc.setDrawColor(C.k.corner); doc.setLineWidth(0.25); doc.circle(cx,cy,1.9,'FD'); font(FM,'bold',5.6,C.ink); T(q.id.slice(1),cx,cy+0.95,{align:'center'}); });
    const arrow=(s,col)=>{ const o=Hh.pathAt(PT,s), ax=X(o.x), ay=Y(o.y), tx2=o.tx, ty2=-o.ty, L=4; doc.setDrawColor(col); doc.setLineWidth(0.4);
      doc.line(ax-tx2*L,ay-ty2*L,ax+tx2*L,ay+ty2*L); doc.line(ax+tx2*L,ay+ty2*L,ax+tx2*L-tx2*1.6-ty2*1.1,ay+ty2*L-ty2*1.6+tx2*1.1); doc.line(ax+tx2*L,ay+ty2*L,ax+tx2*L-tx2*1.6+ty2*1.1,ay+ty2*L-ty2*1.6-tx2*1.1); };
    ['ust','l34','l12'].forEach(id2=>{ const q=PT.byId[id2]; if(q&&q.L>0.4) arrow(q.s0+q.L/2,C.accent); });
    if(opts.dims){
      const g=R.geo; font(FM,'normal',5.6,C.muted); doc.setDrawColor(C.muted); doc.setLineWidth(0.15);
      const yb=Y(ex.y0)+5.5; doc.line(X(ex.x0),yb,X(ex.x1),yb); doc.line(X(ex.x0),yb-1,X(ex.x0),yb+1); doc.line(X(ex.x1),yb-1,X(ex.x1),yb+1); T(nf(g.boy,2)+' m',(X(ex.x0)+X(ex.x1))/2,yb+3,{align:'center'});
      const xr=X(ex.x1)+3.5; doc.line(xr,Y(ex.y0),xr,Y(ex.y1)); doc.line(xr-1,Y(ex.y0),xr+1,Y(ex.y0)); doc.line(xr-1,Y(ex.y1),xr+1,Y(ex.y1)); T(nf(g.en,2)+' m',xr+1.4,(Y(ex.y0)+Y(ex.y1))/2+1);
      font(FS,'normal',5.8,C.muted);
      const lbl=(s,t,up)=>{ const o=Hh.pathAt(PT,s); T(t,X(o.x),up?Y(ex.y1)-1.6:Y(ex.y0)+2.6,{align:'center'}); };
      const B=PT.byId; if(B.ts) lbl(B.ts.s0+B.ts.L/2,'test section'); if(B.dn) lbl(B.dn.s0+B.dn.L/2,'settling'); if(B.fan) lbl(B.fan.s0+B.fan.L/2,'fans',true);
    }
    return {k};
  }

  const sevC=s=>C[s]||C.muted, SEVN={bad:'Critical',warn:'Warning',info:'Note',ok:'Pass'};
  const cnt={bad:0,warn:0,info:0,ok:0}; AU.forEach(c=>cnt[c.sev]++);
  const by=k=>R.bil.find(b=>b.id===k);

  /* ================= 1. cover ================= */
  prog(0.4,'Drawing the cover…');
  head();
  font(FM,'normal',7,C.accent); T('TECHNICAL DATASHEET · CLOSED-CIRCUIT ICING WIND TUNNEL',M,y+2,{charSpace:0.25}); y+=11;
  font(FC,'bold',30,C.ink); const tl=doc.splitTextToSize(tx(O.name),W-2*M-52); doc.text(tl,M,y+2); y+=tl.length*11+1;
  font(FS,'normal',9,C.muted); { const sl=doc.splitTextToSize(tx('Single-return (Göttingen) circuit · '+nf(P.a,0)+' × '+nf(P.a,0)+' cm closed test section · '+P.fN+' fans · heat exchanger '+(P.yer==='birlikte'?'at the wide-angle diffuser exit':'in leg 3–4')),W-2*M-54); doc.text(sl,M,y); y+=sl.length*4+4; }
  /* serial plate */
  const plY=26, plX=W-M-48; doc.setDrawColor(C.ink); doc.setLineWidth(0.4); doc.rect(plX,plY,48,25);
  font(FS,'normal',5.6,C.muted); T('DESIGN ID',plX+3,plY+4.5,{charSpace:0.2}); font(FM,'bold',9.6,C.ink); T(id,plX+3,plY+10.5);
  line(plX,plY+13,plX+48,plY+13,C.ink,0.25);
  font(FM,'normal',6,C.muted); T('REV '+O.rev+'  ·  '+date,plX+3,plY+17.3); T((O.by||'—')+(O.org?' · '+O.org:''),plX+3,plY+21.6,{maxWidth:43});
  y=Math.max(y,plY+30);
  kvGrid([
    ['Test section',nf(P.a,0)+'×'+nf(P.a,0)+'×'+nf(P.LTS,0),'cm',true],['Design speed',nf(R.V,1),'m/s',true],['Static temperature',nf(P.T,1),'°C',true],['Mach · Re (side)',nf(R.M,3),'Re '+ne(R.Re,2),true],
    ['Volume flow Q',nf(R.Q,2),'m³/s · '+ni(R.Q*3600)+' m³/h'],['Mass flow',nf(R.mdot,2),'kg/s'],['Dynamic pressure q',nf(R.q_TS,0),'Pa'],['Air density ρ',nf(R.rho,3),'kg/m³'],
    ['Circuit Δp',nf(R.dp_top,0),'Pa · K '+nf(R.K_top,3)],['Fan selection Δp',nf(R.dp_top*P.marg,0),'Pa · ×'+nf(P.marg,2)],['Fan shaft power',kW(R.P_mil).v,kW(R.P_mil).u+' · el. '+kW(R.P_elek).v+' '+kW(R.P_elek).u],['Cooling (selected)',kW(TB.sec).v,kW(TB.sec).u+' · ×'+nf(P.tmarg,2)],
    ['Energy ratio ER',nf(R.ER,2),'P_jet/P_air'],['Contraction ratio',nf(P.CR,2),'settling '+nf(R.geo.s_dn*100,0)+' cm'],['Footprint',nf(R.geo.boy,2)+'×'+nf(R.geo.en,2),'m'],['Air volume',nf(R.hacim,1),'m³ · wall '+nf(R.A_duvar,0)+' m²']
  ],4);
  /* plan */
  font(FS,'bold',8,C.ink); T('Plan view · true scale',M,y); font(FM,'normal',6,C.muted); T('flow counter-clockwise · test leg at the bottom · corners numbered in flow order',W-M,y,{align:'right'}); y+=2;
  doc.setDrawColor(C.line); doc.setLineWidth(0.2); doc.rect(M,y,W-2*M,74);
  plan(M+2,y+2,W-2*M-10,70,{dims:true}); y+=80;
  /* audit summary + QR */
  const qy=y; font(FS,'bold',8,C.ink); T('Design audit',M,y); y+=4.5;
  [['bad','critical'],['warn','warnings'],['info','notes'],['ok','passed']].forEach((s,i)=>{ const x=M+i*28; doc.setFillColor(sevC(s[0])); doc.circle(x+1.4,y-1.1,1.3,'F'); font(FC,'bold',12,C.ink); T(String(cnt[s[0]]),x+4,y+0.3); const nw=doc.getTextWidth(String(cnt[s[0]])); font(FS,'normal',6.6,C.muted); T(s[1],x+5+nw,y); });
  y+=5;
  AU.filter(c=>c.sev==='bad'||c.sev==='warn').slice(0,6).forEach(c=>{ doc.setFillColor(sevC(c.sev)); doc.circle(M+1,y-1,0.8,'F'); font(FS,'normal',7,C.ink); T(c.title,M+3.5,y); font(FM,'normal',6.4,C.muted); T(c.val,M+80,y,{maxWidth:60}); y+=4.2; });
  if(!(cnt.bad+cnt.warn)){ font(FS,'normal',7,C.ok); T('No warnings: all separation, flow-quality and icing checks pass.',M,y); y+=4.2; }
  if(O.notes){ y+=2; font(FS,'bold',7,C.ink); T('Notes',M,y); y+=3.6; font(FS,'normal',7,C.muted); const nl=doc.splitTextToSize(tx(O.notes),W-2*M-46); doc.text(nl.slice(0,6),M,y); y+=nl.slice(0,6).length*3.2; }
  if(typeof window.qrcode==='function'){
    try{ const q=window.qrcode(0,'M'); q.addData(O.url); q.make(); const n=q.getModuleCount(), s=34/n, qx=W-M-34, qyy=qy-2;
      doc.setFillColor(C.ink); for(let r=0;r<n;r++) for(let cc=0;cc<n;cc++) if(q.isDark(r,cc)) doc.rect(qx+cc*s,qyy+r*s,s+0.02,s+0.02,'F');
      font(FS,'normal',5.8,C.muted); T('Scan to reopen this design',qx+17,qyy+38,{align:'center'}); }catch(_){ }
  }

  /* ================= 2. geometry ================= */
  if(O.inc.geo!==false){
    prog(0.5,'Geometry…');
    head('Geometry','02');
    para('Duct components along the centre line in flow direction, starting at the test-section inlet. Corner lengths are taken as the corner side. θe is the equivalent cone half-angle; wall angles are per wall in the horizontal (plan) and vertical planes.',7.2);
    const cm=v=>nf(v*100,0), ang=v=>isFinite(v)?nf(v,1):'–';
    table([{t:'#',w:8},{t:'Component',w:34},{t:'Leg',w:26},{t:'Inlet W×H [cm]',w:20,a:'r',m:1},{t:'Outlet W×H',w:19,a:'r',m:1},{t:'AR',w:10,a:'r',m:1},{t:'L [m]',w:11,a:'r',m:1},{t:'θe [°]',w:11,a:'r',m:1},{t:'plan/vert [°]',w:16,a:'r',m:1},{t:'V in/out [m/s]',w:22,a:'r',m:1},{t:'x [m]',w:8,a:'r',m:1}],
      GT.map(r=>({c:[r.no,r.name,r.leg,cm(r.W1)+'×'+cm(r.H1),cm(r.W2)+'×'+cm(r.H2),nf(r.AR,2),nf(r.L,2),ang(r.thE),ang(r.thY)+'/'+ang(r.thD),nf(r.V1,1)+' / '+nf(r.V2,1),nf(r.x0,1)],sw:C.k[(PT.byId[r.id]||{key:'duct'}).key]})),{cont:'Geometry'});
    sub('Corner turning vanes');
    const kb=R.bil.filter(b=>b.tip==='kose');
    table([{t:'Corner',w:26},{t:'Side [cm]',w:18,a:'r',m:1},{t:'Chord [cm]',w:18,a:'r',m:1},{t:'Gap [cm]',w:16,a:'r',m:1},{t:'Gap/chord',w:16,a:'r',m:1},{t:'Vanes',w:14,a:'r',m:1},{t:'Arc radius [cm]',w:22,a:'r',m:1},{t:'V [m/s]',w:16,a:'r',m:1},{t:'Re chord',w:18,a:'r',m:1},{t:'K local',w:16,a:'r',m:1}],
      kb.map(b=>({c:[b.name+(b.id==='c1'?' (icing ×'+nf(P.buz1,2)+')':''),cm(b.Dh1),nf(b.par.c*100,1),nf(P.vhc*b.par.c*100,1),nf(P.vhc,2),b.par.n,nf(b.par.c/Math.SQRT2*100,1),nf(b.V,1),ne(b.par.Rec,2),nf(b.K_lok,3)],sw:C.k.corner})));
    sub('Elements');
    const hx=by('hx'), hxs=P.yer==='ayri'?R.geo.s34:R.geo.s_dn;
    const E=[
      ['Heat exchanger','Position',P.yer==='ayri'?'Leg between corners 3 and 4':'Settling-chamber inlet (WAD exit)'],['','Face section / area',cm(hxs)+' × '+cm(hxs)+' cm · '+nf(hxs*hxs,3)+' m²'],['','Depth (estimate)',nf(G.dn.t_hx*100,0)+' cm'],
      ['','Face velocity / Δp (frosted)',nf(R.hx.V,2)+' m/s · '+nf(R.hx.dp,0)+' Pa'],
      ['Honeycomb','Position / cell D_h / depth',nf(P.xhc,0)+' cm · '+nf(P.hcD,0)+' mm · '+nf(P.hcL,0)+' mm (L/D '+nf(P.hcL/P.hcD,1)+')'],['','Porosity / cells (approx.)',nf(P.hcB,2)+' · '+ni((R.geo.s_dn/G.hc.Dh)**2)],
      ['Turbulence screens','Count / positions',P.elN+' · '+G.dn.x_el.map(v=>nf(v*100,0)).join(', ')+' cm'],['','Wire / mesh / open area',nf(P.eldw,2)+' / '+nf(P.elwm,2)+' mm · '+nf(25.4/P.elwm,0)+' mesh · β '+nf((1-P.eldw/P.elwm)**2,2)],
      ['Spray bars','Position / to contraction',nf(P.xsp,0)+' cm · '+nf(P.Ldn-P.xsp,0)+' cm'],['','Bars × Ø / pitch / nozzles',P.spN+' × '+nf(P.spd,0)+' mm · '+nf(R.geo.s_dn/Math.max(1,P.spN)*100,1)+' cm · '+P.spNn],
      ['Fan array','Count / layout / Ø',P.fN+' · '+R.fan.ncol+'×'+R.fan.nrow+' · '+nf(P.fD,0)+' cm'],['','Section / module length',nf(P.fw,0)+' × '+nf(P.fh,0)+' cm · '+nf(P.Lfan,0)+' cm'],
      ['Model','Chord × span / LE position',nf(P.mc,0)+' × '+nf(P.a,0)+' cm · '+nf(P.mx,0)+' cm from TS inlet'],
      ['Circuit','Width H / long-leg corner pitch',nf(R.geo.H,2)+' m · '+nf(R.geo.X_alt,2)+' m'],['','Insulation',nf(P.it,0)+' mm · k = '+nf(P.ik,3)+' W/mK']];
    table([{t:'Element',w:34},{t:'Property',w:52},{t:'Value',w:94}],E.map(e=>({c:e,b:false,col:C.ink})),{cont:'Geometry'});
    sub('Contraction wall profile (5th-order polynomial)');
    const pr=R.prof, idx=[0,10,20,30,40,50,60,70,80,90,100];
    table([{t:'x [m]',w:18,m:1}].concat(idx.map(i=>({t:nf(pr.x[i],2),w:14.7,a:'r',m:1}))),[{c:['side [cm]'].concat(idx.map(i=>nf(2*pr.y[i]*100,1)))},{c:['area [m²]'].concat(idx.map(i=>nf((2*pr.y[i])**2,3)))}]);
  }

  /* ================= 3. aerodynamics ================= */
  if(O.inc.loss!==false){
    prog(0.6,'Losses and fan…');
    head('Aerodynamics: losses and fan','03');
    para('Loss coefficients are computed per component in their local dynamic pressure and referred to the test section: K_ref = K_local (A_TS/A)². The fan must supply Δp = ΣK_ref · q_TS × leakage factor '+nf(P.leak,2)+'. Barlow, Rae & Pope (1999) Eq. 3.14, 3.24–3.43; Eckert et al. (1976) for diffusers.',7.2);
    const mx=Math.max(...R.bil.map(b=>b.dp));
    table([{t:'Component',w:50,sw:1},{t:'V in [m/s]',w:16,a:'r',m:1},{t:'Re',w:19,a:'r',m:1},{t:'K local',w:17,a:'r',m:1},{t:'K ref',w:17,a:'r',m:1},{t:'Δp [Pa]',w:34,a:'r',m:1},{t:'Share',w:14,a:'r',m:1},{t:'L [m]',w:13,a:'r',m:1}],
      R.bil.map(b=>({c:[b.name,nf(b.V,2),ne(b.Re,2),nf(b.K_lok,4),nf(b.K_ref,4),nf(b.dp,1),nf(b.K_ref/R.K_ham*100,1)+'%',nf(b.L,2)],sw:C.k[b.key],bar:[5,b.dp/mx,C.k[b.key]]}))
      .concat([{c:['Sum of components','','','',nf(R.K_ham,4),nf(R.K_ham*R.q_TS,1),'100%',''],b:true,hl:true},{c:['Circuit total, leakage ×'+nf(P.leak,2),'','','',nf(R.K_top,4),nf(R.dp_top,1),'',''],b:true,hl:true}]),{cont:'Aerodynamics'});
    sub('Fan duty and power');
    kvGrid([['Fan Δp, duct to duct',nf(R.dp_top,0),'Pa',true],['Selection (×'+nf(P.marg,2)+')',nf(R.dp_top*P.marg,0),'Pa',true],['Air power Δp·Q',kW(R.P_hava).v,kW(R.P_hava).u],['Shaft power',kW(R.P_mil).v,kW(R.P_mil).u+' · η '+nf(P.etaf,2)],
      ['Electrical power',kW(R.P_elek).v,kW(R.P_elek).u+' · η_m '+nf(P.etam,2)],['Jet power ½ρV³A',kW(R.P_jet).v,kW(R.P_jet).u],['Energy ratio',nf(R.ER,2),'λ = '+nf(R.lambda,2)],['Per-fan flow',ni(3600*R.fan.q_tek),'m³/h'],
      ['Est. speed',ni(R.fan.n_rpm),'rpm · ψ '+nf(P.psi,2)],['Tip speed',nf(R.fan.U_uc,1),'m/s · M '+nf(R.fan.M_uc,2)],['Outlet velocity',nf(R.fan.V_cikis,1),'m/s · '+nf(R.fan.oran*100,0)+'% cover'],['Alt. HX layout Δp',nf(ST.Ralt.dp_top,0),'Pa ('+(P.yer==='ayri'?'at WAD exit':'in leg 3–4')+')']],4,{h:12.5,big:11.5});
    if(FCv){ para('Manufacturer curve "'+(P.fcname||'fan')+'" ('+P.fN+' in parallel, scaled to '+nf(R.rho,3)+' kg/m³): operating point '+nf(FCv.Q_cn,2)+' m³/s at '+nf(FCv.dp_cn,0)+' Pa, i.e. '+nf(FCv.V_cn,1)+' m/s in the test section (target '+nf(R.V,0)+' m/s).',7.2,C.ink); }
    /* pressure loop chart */
    need(70);
    const fi=R.bil.findIndex(b=>b.id==='borda')>=0?R.bil.findIndex(b=>b.id==='borda'):R.bil.findIndex(b=>b.id==='fan'), seq=R.bil.slice(fi+1).concat(R.bil.slice(0,fi+1));
    let xx=0, pt=R.dp_top; const xs=[0], pts=[R.dp_top], st=[];
    seq.forEach(b=>{ const L=b.L>0?b.L:0.6; st.push([xx,pt-0.5*R.rho*(R.Q/b.A1)**2]); xx+=L; pt-=b.dp; xs.push(xx); pts.push(pt); st.push([xx,pt-0.5*R.rho*(R.Q/b.A2)**2]); });
    const cx=M, cy=y, cw=W-2*M, chh=62, ymin=Math.min(0,...st.map(p=>p[1])), ymax=R.dp_top*1.08, l=cx+12, b=cy+chh-8, iw=cw-14, ih=chh-12;
    const X=v=>l+v/xx*iw, Y=v=>b-(v-ymin)/(ymax-ymin)*ih;
    font(FS,'bold',7.3,C.ink); T('Total pressure round the loop, from the fan exit [Pa, relative to p₀ at the fan inlet]',cx,cy+2);
    [ymin,0,R.dp_top].forEach(v=>{ line(l,Y(v),l+iw,Y(v),v===0?C.muted:C.faint,0.15); font(FM,'normal',5.6,C.muted); T(nf(v,0),l-1.2,Y(v)+1,{align:'right'}); });
    let xc=0; seq.forEach((bq,i)=>{ const L=bq.L>0?bq.L:0.6; doc.setDrawColor(C.k[bq.key]); doc.setLineWidth(0.7); doc.line(X(xc),Y(pts[i]),X(xc+L),Y(pts[i+1])); xc+=L; });
    doc.setDrawColor(C.muted); doc.setLineWidth(0.25); doc.setLineDashPattern([1,0.8],0); poly(st.map(p=>[X(p[0]),Y(p[1])]),'S',false); doc.setLineDashPattern([],0);
    doc.setDrawColor(C.k.fan); doc.setLineWidth(0.8); doc.line(X(xx),Y(pts[pts.length-1]),X(xx),Y(R.dp_top)); font(FM,'bold',6,C.k.fan); T('fan +'+ni(R.dp_top)+' Pa',X(xx)-1.5,Y(R.dp_top*0.6),{align:'right'});
    font(FS,'normal',5.8,C.muted); T('solid: total pressure, coloured by component · dashed: static pressure p₀ − ½ρV²',l,b+4.5);
    y=cy+chh+3;
  }

  /* ================= 4. thermal & icing ================= */
  if(O.inc.therm!==false){
    prog(0.7,'Thermal and icing…');
    head('Thermal budget and icing cloud','04');
    para('In a closed loop all fan shaft power becomes heat in the air. Wall heat follows from U = 1/(1/h_i + t/k + 1/h_o) over the wetted wall area; the spray water is cooled from the nozzle temperature, frozen and sub-cooled to the air temperature. kapali_devre_1D.m §6–7.',7.2);
    const rw=(l,a,b)=>({c:[l,a,b]});
    table([{t:'Heat load',w:80},{t:nf(P.V,0)+' m/s · '+nf(P.LWC,1)+' g/m³',w:50,a:'r',m:1},{t:nf(P.Vs,0)+' m/s · '+nf(P.LWCs,1)+' g/m³ (continuous)',w:50,a:'r',m:1}],[
      rw('Fan shaft power',nf(TB.fan/1000,2)+' kW',nf(TBs.fan/1000,2)+' kW'),rw('Motor losses'+(P.motorIn?' (motors in the stream)':' (outside)'),nf(TB.motor/1000,2)+' kW',nf(TBs.motor/1000,2)+' kW'),
      rw('Wall heat gain (lab '+nf(P.Tlab,0)+' °C, U '+nf(TB.U,3)+' W/m²K, '+nf(R.A_duvar,1)+' m²)',nf(TB.duvar/1000,2)+' kW',nf(TBs.duvar/1000,2)+' kW'),
      rw('Spray water, sensible + latent ('+nf(TB.m_su*3600,1)+' kg/h)',nf(TB.sprey/1000,2)+' kW',nf(TBs.sprey/1000,2)+' kW'),
      Object.assign(rw('Total',nf(TB.top/1000,2)+' kW',nf(TBs.top/1000,2)+' kW'),{b:true}),Object.assign(rw('Refrigeration selection (×'+nf(P.tmarg,2)+')',nf(TB.sec/1000,2)+' kW',nf(TBs.sec/1000,2)+' kW'),{b:true,hl:true})]);
    /* stacked bar */
    need(14); const parts=[['fan',C.k.fan],['motor',C.k.model],['duvar',C.k.duct],['sprey',C.k.hx]], mx=Math.max(TB.sec,TBs.sec);
    [[TB,'design'],[TBs,'continuous']].forEach(([t,l])=>{ let x=M+24; font(FS,'normal',6.4,C.muted); T(l,M,y+2.6); parts.forEach(p=>{ const w=t[p[0]]/mx*(W-2*M-40); doc.setFillColor(p[1]); doc.rect(x,y,w,3.6,'F'); x+=w; }); doc.setDrawColor(C.muted); doc.setLineDashPattern([0.6,0.6],0); doc.rect(x,y,(t.sec-t.top)/mx*(W-2*M-40),3.6,'S'); doc.setLineDashPattern([],0); font(FM,'normal',6.4,C.ink); T(nf(t.sec/1000,2)+' kW',W-M,y+2.8,{align:'right'}); y+=5.6; });
    font(FS,'normal',5.8,C.muted); let lx=M+24; [['fan','fan shaft',C.k.fan],['motor','motor',C.k.model],['duvar','walls',C.k.duct],['sprey','spray water',C.k.hx]].forEach(p=>{ doc.setFillColor(p[2]); doc.rect(lx,y-2,2,2,'F'); T(p[1],lx+3,y-0.2); lx+=26; }); y+=5;
    para('Evaporating temperature for this duty is about '+nf(IC.Tevap,0)+' °C (Bansmer et al. 2018: −32 °C refrigerant for −20 °C air). Catalogue capacities are rated much warmer; ask for capacity at the actual evaporating temperature.',7);
    sub('Icing cloud at the model');
    kvGrid([['LWC · MVD',nf(P.LWC,2)+' · '+nf(P.MVD,0),'g/m³ · µm',true],['Spray water',nf(IC.water_Lh,1),'L/h · '+nf(IC.perNoz,2)+' per nozzle',true],['Stagnation β₀',nf(IC.beta0,2),'K₀ '+nf(IC.K0,2)],['Ice growth (rime)',nf(IC.rate_mm_min,2),'mm/min'],
      ['Total temperature',nf(IC.Tstag,1),'°C'],['Regime (rule of thumb)',IC.regime==='none'?'no ice':IC.regime,''],['Spray → LE time',nf(R.t_kalis*1000,0),'ms'],['LE diameter (t/c 0.12)',nf(IC.dLE*1000,1),'mm']],4,{h:12.5,big:11.5});
    para('β₀ from the Langmuir & Blodgett (1946) fit with the modified inertia parameter K₀ = 1/8 + (λ/λ_s)(K − 1/8), K = ρ_w d² V / (18 d_LE μ) using the leading-edge diameter as length scale (Anderson 2004). Growth rate assumes rime (freezing fraction 1): β₀ · LWC · V / ρ_ice.',6.8);
    const cols=[{t:'Droplet d [µm]',w:36,m:1},{t:'τ_T [ms]',w:36,a:'r',m:1},{t:'t / τ',w:36,a:'r',m:1},{t:'ΔT remaining',w:36,a:'r',m:1},{t:'',w:36,a:'r'}];
    sub('Droplet cooling before the model (Nu = 2, isothermal drop)');
    table(cols,IC.drops.map(d=>({c:[d.d+(d.d===P.MVD?' (MVD)':''),nf(d.tau*1000,2),nf(d.r,1),d.rem<1e-3?ne(d.rem,1):nf(d.rem*100,2)+'%',d.rem>0.05?'not supercooled':'ok'],hl:d.d===P.MVD})));
    sub('Spray water flow [L/h] for the '+nf(P.a,0)+' cm test section');
    const lw=[0.1,0.3,0.5,1,2,3];
    table([{t:'V [m/s] \\ LWC [g/m³]',w:36,m:1}].concat(lw.map(v=>({t:String(v),w:24,a:'r',m:1}))),[20,30,40].concat([P.V]).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b).map(V=>({c:[nf(V,0)].concat(lw.map(L=>nf(L*1e-3*V*R.A_TS*3600,2))),hl:V===P.V})));
    sub('Outer-skin condensation');
    para('Outer skin '+nf(IC.Tskin,1)+' °C against a lab dew point of '+nf(IC.Tdew,1)+' °C ('+nf(P.RH,0)+'% RH at '+nf(P.Tlab,0)+' °C, Magnus form after Alduchov & Eskridge 1996); wall heat flux '+nf(IC.qwall,1)+' W/m². '+(IC.Tskin<IC.Tdew?'Condensation expected on the outside of the duct.':'The skin stays dry.'),7.2,C.ink);
  }

  /* ================= 5. sweep ================= */
  if(O.inc.sweep!==false){
    prog(0.78,'Speed sweep…');
    head('Speed sweep','05');
    para('Fixed geometry, '+P.yer.replace('birlikte','combined').replace('ayri','separate')+' heat-exchanger layout, '+nf(P.T,0)+' °C. Loss coefficients fall slightly with Reynolds number, so Δp grows a little slower than V².',7.2);
    table([{t:'V [m/s]',w:20,a:'r',m:1},{t:'Q [m³/s]',w:22,a:'r',m:1},{t:'Q [m³/h]',w:24,a:'r',m:1},{t:'K total',w:22,a:'r',m:1},{t:'Δp [Pa]',w:22,a:'r',m:1},{t:'Shaft [kW]',w:24,a:'r',m:1},{t:'Electrical [kW]',w:26,a:'r',m:1},{t:'ER',w:20,a:'r',m:1}],
      SW.map(r=>({c:[nf(r.V,0),nf(r.Q,3),ni(r.Q*3600),nf(r.K,4),nf(r.dp,1),nf(r.Pm/1000,2),nf(r.Pe/1000,2),nf(r.ER,2)],hl:Math.abs(r.V-P.V)<1e-9})));
    need(66);
    const xs=SW.map(r=>r.V);
    chart(M,y,(W-2*M)/2-4,62,{title:'Circuit Δp [Pa]',xl:'V [m/s]',series:[{x:xs,y:SW.map(r=>r.dp),c:C.ink,n:'circuit'},{x:xs,y:SW.map(r=>r.dp*P.marg),c:C.k.fan,n:'×'+nf(P.marg,2)+' selection',dash:1}],marks:[{x:P.V,y:R.dp_top,c:C.accent,l:'design'}]});
    chart(M+(W-2*M)/2+4,y,(W-2*M)/2-4,62,{title:'Fan power [kW]',xl:'V [m/s]',series:[{x:xs,y:SW.map(r=>r.Pm/1000),c:C.k.fan,n:'shaft'},{x:xs,y:SW.map(r=>r.Pe/1000),c:C.ink,n:'electrical',dash:1}],marks:[{x:P.V,y:R.P_mil/1000,c:C.accent,l:nf(R.P_mil/1000,2)+' kW'}]});
    y+=68;
  }

  /* ================= 6. audit ================= */
  if(O.inc.audit!==false){
    prog(0.86,'Design audit…');
    head('Design audit','06');
    para('Each check compares this design against published design rules. Critical items should be resolved before detailed design; warnings indicate increased risk of flow separation, poor flow quality or an icing-cloud problem.',7.2);
    AU.forEach((c,i)=>{
      font(FS,'normal',7,C.ink); const ml=doc.splitTextToSize(tx(c.msg),W-2*M-14), fl=c.fix&&c.fix!=='—'?doc.splitTextToSize(tx('What to change: '+c.fix),W-2*M-14):[];
      const h=8+ml.length*3.1+fl.length*3.1+(c.refs.length?3.4:0);
      need(h,'Design audit','06');
      doc.setFillColor(sevC(c.sev)); doc.rect(M,y-3,0.9,h-2,'F');
      font(FM,'bold',6.6,sevC(c.sev)); T(String(i+1).padStart(2,'0'),M+3,y);
      font(FS,'bold',8,C.ink); T(c.title,M+10,y);
      font(FM,'normal',6.6,C.ink); T(c.val,W-M,y,{align:'right'});
      y+=3.4; font(FS,'normal',6.1,C.muted); T(SEVN[c.sev].toUpperCase()+'  ·  '+c.cat+'  ·  limit '+c.lim,M+10,y,{charSpace:0.1}); y+=3.6;
      font(FS,'normal',7,C.ink); doc.text(ml,M+10,y); y+=ml.length*3.1;
      if(fl.length){ font(FS,'normal',7,C.muted); doc.text(fl,M+10,y); y+=fl.length*3.1; }
      if(c.refs.length){ font(FM,'normal',6,C.accent); T(c.refs.map(r=>'['+r+']').join(' '),M+10,y); y+=3.4; }
      y+=2.2;
    });
    sub('References');
    const refs=window.IcingEngine.REFS;
    Object.values(refs).forEach(r=>{ font(FM,'bold',6.4,C.accent); need(8); T('['+r.k+']',M,y); font(FS,'normal',6.8,C.ink); const ls=doc.splitTextToSize(tx(r.t),W-2*M-12); doc.text(ls,M+12,y); y+=ls.length*3+1.4; });
  }

  /* ================= 7. inputs ================= */
  if(O.inc.inputs!==false){
    prog(0.93,'Input record…');
    head('Input record','07');
    para('Every value used for this datasheet, with the matching variable of kapali_devre_1D.m where one exists. The link below (and the QR code on the cover) reopens exactly this design in Smokeline.',7.2);
    font(FM,'normal',6.4,C.accent); const ul=doc.splitTextToSize(O.url,W-2*M); doc.text(ul,M,y); doc.link(M,y-3,W-2*M,ul.length*3,{url:O.url}); y+=ul.length*3+3;
    GROUPS.forEach(g=>{
      const rows=FIELDS.filter(f=>f.g===g.g).map(f=>{ let v=P[f.k]; if(f.kind==='bool') v=v?'yes':'no'; else if(f.kind==='seg') v=(f.opts.find(o=>o[0]===v)||[v,v])[1]; return {c:[f.label,String(v),f.unit||'',f.m||'']}; });
      need(10+rows.length*4.3); font(FS,'bold',7.6,C.ink); T(g.name,M,y); y+=4;
      table([{t:'Input',w:78},{t:'Value',w:26,a:'r',m:1},{t:'Unit',w:20,m:1},{t:'MATLAB / source',w:56,m:1}],rows,{rh:4.3,fs:6.7,cont:'Input record'});
    });
  }

  foot();
  prog(0.98,'Saving…');
  const safe=(O.name||'icing-tunnel').replace(/[^\w\-]+/g,'_').slice(0,40);
  doc.save(id+'_'+safe+'.pdf');
  prog(1,null);
}
window.IcingSheet={export:exportSheet};
})();
