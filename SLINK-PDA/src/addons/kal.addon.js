(function startKalPda(global) {
  'use strict';
  if(global.__SLINK_KAL_PDA_STARTED__)return;
  global.__SLINK_KAL_PDA_STARTED__=true;
  const api=global.SLINK_PDA_PLUGIN_API, channel=global.__SLINK_PDA_STORAGE_BRIDGE__?.channel;
  if(!api||!channel)return;
  const eventName=channel+':kal';let sequence=0;
  const pending=new Map();
  document.addEventListener(eventName+':ack',event=>{let result;try{result=JSON.parse(event.detail);}catch{return;}const entry=pending.get(result.id);if(!entry)return;pending.delete(result.id);clearTimeout(entry.timer);result.ok?entry.resolve(result.value):entry.reject(new Error(result.error));});
  function call(payload){return new Promise((resolve,reject)=>{const id='kal-'+Date.now()+'-'+(++sequence);const timer=setTimeout(()=>{pending.delete(id);reject(new Error('KAL platform request timed out. Reload before retrying a credential change.'));},15000);pending.set(id,{resolve,reject,timer});document.dispatchEvent(new CustomEvent(eventName,{detail:JSON.stringify({...payload,id})}));});}
  const client=global.SLINK_KAL.create({
    storage:{get:name=>call({action:'get',name}),set:(name,value)=>call({action:'set',name,value}),remove:name=>call({action:'remove',name})},
    cache:global.SLINK_KAL.openCache(global.indexedDB,'slink-pda-kal-cache'),request:(url,options)=>call({action:'request',url,options})
  });
  const collector=global.SLINK_KAL_CONTRIBUTIONS.create({
    store:{get:()=>call({action:'get',name:'pending'}),set:value=>call({action:'set',name:'pending',value})},
    auth:async()=>{const[c,s]=await Promise.all([call({action:'get',name:'credentials'}),call({action:'get',name:'settings'})]);return c?.schema===1?{...c,enabled:s?.enabled===true&&s.collectionEnabled===true}:null;},
    request:(url,options)=>call({action:'request',url,options}),
    lock:work=>global.navigator?.locks?.request?global.navigator.locks.request('slink-pda-kal-contributions',work):Promise.reject(new Error('This PDA WebView cannot coordinate KAL submissions safely.')),
    schedule:at=>setTimeout(()=>void collector.drain().catch(()=>{}),Math.max(0,at-Date.now()))
  });
  async function collectorState(){const state=await client.status();document.dispatchEvent(new CustomEvent('slink:kal:collector-state',{detail:JSON.stringify({enabled:state.collectorEnabled&&!!global.navigator?.locks?.request})}));}
  const presentation={...client,connect:async(key,consent)=>{await client.connect(key,consent);await collectorState();return presentation.status();},status:async()=>{const state={...await client.status(),...await collector.status()};if(!global.navigator?.locks?.request){state.collectorEnabled=false;state.collectorReason='This PDA WebView cannot coordinate KAL submissions safely. Collection is unavailable.';}return state;},configure:async value=>{await client.configure(value);await collectorState();void collector.drain().catch(()=>{});return presentation.status();},disconnect:async()=>{await client.disconnect();await collectorState();return presentation.status();}};
  document.addEventListener('slink:kal:observation',event=>{let capture;try{capture=JSON.parse(event.detail);}catch{return;}void collector.enqueue(capture).catch(()=>{});});
  void collectorState().catch(()=>{});void collector.drain().catch(()=>{});
  global.SLINK_KAL_PDA=Object.freeze({mount:root=>global.SLINK_KAL_UI.mountSettings(root,presentation),disconnect:()=>presentation.disconnect()});
  const mount=()=>{const root=api.root('access')?.querySelector('[data-kal-settings]');if(root)global.SLINK_KAL_PDA.mount(root);};
  // Access rendering replaces its own form. Observe only that module, never the entire Torn tree.
  const access=api.root('access');if(access){const observer=new MutationObserver(mount);observer.observe(access,{childList:true,subtree:true});mount();}
  const panel=global.SLINK_KAL_UI.mountPage({client:presentation}),themeHost=document.getElementById('slink-pda-dashboard-host');
  if(panel&&themeHost){const theme=()=>{const css=getComputedStyle(themeHost);for(const key of ['--s-panel','--s-text','--s-border'])panel.root.style.setProperty(key,css.getPropertyValue(key));};new MutationObserver(theme).observe(themeHost,{attributes:true});theme();}
})(globalThis);
