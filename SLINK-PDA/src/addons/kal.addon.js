(function(global){
 'use strict';
 const api=global.SLINK_PDA_PLUGIN_API,K=global.SLINK_KAL;if(!api?.kal||!K||global.SLINK_PDA_KAL)return;
 const raw=K.create({storage:api.kal.storage,cache:K.openCache(global.indexedDB,'slink-kal-pda-cache'),request:api.kal.request});
 let panel=null,themeObserver=null,revision=0;
 async function sync(){
  const run=++revision,state=await raw.status();if(run!==revision)return;
  if(!api.kal.enabled()||!state.enabled){panel?.destroy();panel=null;themeObserver?.disconnect();themeObserver=null;return;}
  if(!panel){panel=global.SLINK_KAL_UI.mountPage({client,openAccess:api.kal.openAccess});if(panel){const apply=()=>{for(const [key,value]of Object.entries(api.kal.theme()))panel?.root.style.setProperty(key,value);};apply();const host=api.kal.host();if(host){themeObserver=new MutationObserver(apply);themeObserver.observe(host,{attributes:true,attributeFilter:['data-theme','class','style']});}}}
  else await panel.refresh();
 }
 async function configure(value){
  const previous=await raw.status();const result=await raw.configure(value);
  try{await api.kal.monitor(result.enabled);}catch(error){await raw.configure({enabled:previous.enabled,display:previous.display});throw error;}
  await sync();api.kal.renderAccess();return result;
 }
 const client={
  status:async()=>{const state=await raw.status();return {...state,enabled:state.enabled&&api.kal.enabled()};},
  load:(id,cursor)=>{if(!api.kal.enabled())throw Error('KAL is disabled in SLINK Access.');return raw.load(id,cursor);},
  connect:async(key,consent)=>{const state=await raw.connect(key,consent);try{await api.kal.monitor(true);}catch(error){await raw.configure({enabled:false});throw error;}await sync();api.kal.renderAccess();return state;},
  configure,
  disconnect:async()=>{const state=await raw.disconnect();await api.kal.monitor(false);await sync();api.kal.renderAccess();return state;}
 };
 function renderAccess(root){const target=root?.querySelector('[data-kal-settings]');if(target)global.SLINK_KAL_UI.mountSettings(target,client,{keyRoot:root.querySelector('[data-kal-key-field]')||target});}
 const plugin={id:'kal',title:'KAL equipment',accessOnly:true,render:()=>renderAccess(api.root('access')),start:()=>void sync().catch(report),stop(){revision++;panel?.destroy();panel=null;themeObserver?.disconnect();themeObserver=null;void raw.configure({enabled:false}).catch(report);},async setEnabled(enabled){return configure({enabled});}};
 function report(error){const status=api.root('access')?.querySelector('[data-kal-module-status]');if(status)status.textContent=error.message||'KAL settings could not be loaded. Reopen Access to retry.';}
 global.SLINK_PDA_KAL=Object.freeze({renderAccess});api.register(plugin);
})(globalThis);
