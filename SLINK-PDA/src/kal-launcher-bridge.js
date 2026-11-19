function installKalLauncherBridge(options) {
  'use strict';
  const {channel,nativeStorage}=options,eventName=channel+':kal',keys=new Set(['credentials','settings','backoff']);
  if(document.documentElement?.getAttribute('data-slink-kal-bridge')===channel)return;
  document.documentElement?.setAttribute('data-slink-kal-bridge',channel);
  let queue=Promise.resolve();
  document.addEventListener(eventName,event=>{
    let payload;try{payload=JSON.parse(event.detail);}catch{return;}
    if(!payload||typeof payload.id!=='string')return;
    const respond=(ok,value)=>document.dispatchEvent(new CustomEvent(eventName+':ack',{detail:JSON.stringify({id:payload.id,ok,...ok?{value}:{error:'KAL platform request failed. Check connection and storage, then retry.'}})}));
    async function run(){
      if(payload.action==='request') {
        const url=new URL(payload.url);
        if((payload.options?.method||'GET')!=='GET'||url.origin!=='https://api.kalends.dev'||url.searchParams.has('key')||!/^\/(check-key|user\/[1-9]\d*\/loadout)$/.test(url.pathname))throw Error('Invalid KAL read request.');
        if(url.pathname!=='/check-key'&&(globalThis.location?.pathname!=='/profiles.php'||Number(new URL(globalThis.location.href).searchParams.get('XID'))!==Number(url.pathname.split('/')[2])))throw Error('KAL equipment is available only on the selected player profile.');
        const headers={Accept:'application/json',Authorization:payload.options?.headers?.Authorization};
        if(typeof headers.Authorization!=='string'||!/^ApiKey [a-zA-Z0-9]{16}$/.test(headers.Authorization))throw Error('Invalid KAL authentication.');
        if(typeof PDA_httpGet==='function'){
          const response=await PDA_httpGet(url.href,headers);if(!response)throw Error('No native HTTP response.');
          const raw=response.data??response.responseText??response.body,responseHeaders=response.responseHeaders??response.headers??{};
          const retryAfter=typeof responseHeaders==='string'?responseHeaders.match(/^retry-after:\s*(.+)$/im)?.[1]:Object.entries(responseHeaders).find(([name])=>name.toLowerCase()==='retry-after')?.[1];
          return{status:Number(response.status??response.statusCode)||0,text:typeof raw==='string'?raw:JSON.stringify(raw),retryAfter};
        }
        if(typeof GM_xmlhttpRequest!=='function')throw Error('KAL HTTP transport unavailable.');
        return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url:url.href,headers,timeout:12000,onload:r=>resolve({status:r.status,text:r.responseText,retryAfter:r.responseHeaders?.match(/^retry-after:\s*(.+)$/im)?.[1]}),onerror:reject,ontimeout:reject}));
      }
      if(!keys.has(payload.name)||!['get','set','remove'].includes(payload.action))throw Error('Invalid KAL storage operation.');
      const name='slink-pda-kal:'+payload.name+':v1',store=nativeStorage();
      if(payload.action==='get'){if(store)return await store.get(name,null);if(typeof GM_getValue!=='function')throw Error('KAL storage unavailable.');return await GM_getValue(name,null);}
      if(payload.action==='remove'){if(store){if(typeof store.delete!=='function')throw Error('KAL storage delete unavailable.');await store.delete(name);}else{if(typeof GM_deleteValue!=='function')throw Error('KAL storage delete unavailable.');await GM_deleteValue(name);}return null;}
      if(!payload.value||payload.value.schema!==1)throw Error('Invalid KAL schema.');
      if(store)await store.set(name,payload.value);else{if(typeof GM_setValue!=='function'||typeof GM_getValue!=='function')throw Error('KAL storage unavailable.');await GM_setValue(name,payload.value);if(JSON.stringify(await GM_getValue(name,null))!==JSON.stringify(payload.value))throw Error('KAL storage was not retained.');}
      return null;
    }
    if(payload.action==='request')Promise.resolve().then(run).then(value=>respond(true,value),()=>respond(false));
    else{const next=queue.catch(()=>{}).then(run);queue=next;next.then(value=>respond(true,value),()=>respond(false));}
  });
}
