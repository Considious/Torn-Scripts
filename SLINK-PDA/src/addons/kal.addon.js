(function startKalPda(global) {
  'use strict';
  if(global.__SLINK_KAL_PDA_STARTED__)return;
  global.__SLINK_KAL_PDA_STARTED__=true;
  const api=global.SLINK_PDA_PLUGIN_API,channel=global.__SLINK_PDA_STORAGE_BRIDGE__?.channel;
  if(!api||!channel)return;
  const eventName=channel+':kal';let sequence=0;const pending=new Map();
  document.addEventListener(eventName+':ack',event=>{let result;try{result=JSON.parse(event.detail);}catch{return;}const entry=pending.get(result.id);if(!entry)return;pending.delete(result.id);clearTimeout(entry.timer);result.ok?entry.resolve(result.value):entry.reject(new Error(result.error));});
  function call(payload){return new Promise((resolve,reject)=>{const id='kal-'+Date.now()+'-'+(++sequence);const timer=setTimeout(()=>{pending.delete(id);reject(new Error('KAL platform request timed out. Reload before retrying a credential change.'));},15000);pending.set(id,{resolve,reject,timer});document.dispatchEvent(new CustomEvent(eventName,{detail:JSON.stringify({...payload,id})}));});}
  const client=global.SLINK_KAL.create({
    storage:{get:name=>call({action:'get',name}),set:(name,value)=>call({action:'set',name,value}),remove:name=>call({action:'remove',name})},
    cache:global.SLINK_KAL.openCache(global.indexedDB,'slink-pda-kal-cache'),request:(url,options)=>call({action:'request',url,options})
  });
  global.SLINK_KAL_PDA=Object.freeze({mount:root=>global.SLINK_KAL_UI.mountSettings(root,client),disconnect:()=>client.disconnect()});
  const mount=()=>{const root=api.root('access')?.querySelector('[data-kal-settings]');if(root)global.SLINK_KAL_PDA.mount(root);};
  const access=api.root('access');if(access){new MutationObserver(mount).observe(access,{childList:true,subtree:true});mount();}
  if(global.location.pathname!=='/profiles.php')return;
  const panel=global.SLINK_KAL_UI.mountPage({client}),themeHost=document.getElementById('slink-pda-dashboard-host');
  if(panel&&themeHost){const theme=()=>{const css=getComputedStyle(themeHost);for(const key of ['--s-panel','--s-text','--s-border'])panel.root.style.setProperty(key,css.getPropertyValue(key));};new MutationObserver(theme).observe(themeHost,{attributes:true});theme();}
})(globalThis);
