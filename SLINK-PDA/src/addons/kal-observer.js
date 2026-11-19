(function observeKal(global){
  'use strict';
  if(global.__SLINK_KAL_OBSERVER__)return;
  global.__SLINK_KAL_OBSERVER__=true;
  const K=global.SLINK_KAL_CAPTURE;
  if(!K)return;
  const url=new URL(global.location.href);
  if(url.pathname!=='/page.php'||url.searchParams.get('sid')!=='attack')return;
  const target=Number(url.searchParams.get('user2ID'));
  if(!Number.isSafeInteger(target)||target<=0||[23,100,101,102,103,104,777].includes(target))return;
  let enabled=false,finalizing=false,captured=false;
  document.addEventListener('slink:kal:collector-state',event=>{try{enabled=JSON.parse(event.detail).enabled===true;}catch{enabled=false;}});
  const original=global.fetch;
  if(typeof original!=='function')return;
  // Upstream observation semantics: successful attackData, focused page, clone only,
  // one eligible capture per attack view. Never rewrite Torn or replace other wrappers.
  global.fetch=function(...args){const result=Reflect.apply(original,this,args);if(!K.isAttackDataRequest(args[0]))return result;
    return result.then(response=>{
      if(!response.ok||!enabled||captured||finalizing||!document.hasFocus())return response;
      const receivedAt=new Date(K.tornNow()).toISOString(),rewritten=K.isRewrittenResponse(response);
      let copy;try{copy=response.clone();}catch{return response;}
      void copy.text().then(async text=>{
        if(!enabled||captured||finalizing)return;
        let data;try{data=JSON.parse(text);}catch{return;}
        const capture=K.buildAttackCapture(data,{expectedTargetId:target,capturedAt:receivedAt,payloadSource:rewritten?'rewritten':'native'});
        if(!capture)return;
        finalizing=true;
        try{capture.capture_id=await K.captureId(data,capture);if(!enabled)return;captured=true;document.dispatchEvent(new CustomEvent('slink:kal:observation',{detail:JSON.stringify(capture)}));}finally{finalizing=false;}
      }).catch(()=>{});
      return response;
    });
  };
})(globalThis);
