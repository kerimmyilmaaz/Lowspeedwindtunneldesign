/* Smokeline · Coil & Chiller · design runs off the main thread */
importScripts('hxcore.js');
self.onmessage=ev=>{
  const {id,ist}=ev.data;
  let last=0;
  try{
    const T=HXCore.design(ist,(stage,f)=>{ const now=Date.now(); if(now-last>60||f>=1){ last=now; self.postMessage({id,progress:{stage,f}}); } });
    T.cand.pts=T.cand.rows.map(r=>[r.ia,r.ic,r.Tch,r.P,r.dp_air,r.N2,r.flow]);   /* compact list for the design-space scatter */
    delete T.cand.rows;
    self.postMessage({id,result:T});
  }catch(e){ self.postMessage({id,error:String(e&&e.message||e)}); }
};
