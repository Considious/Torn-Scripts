(function(g){
  'use strict';
  const LIMIT=1000;
  const playerId=v=>/^[1-9]\d{0,9}$/.test(String(v??''))?String(v):null;
  const clean=v=>typeof v==='string'?v.trim().slice(0,LIMIT):'';
  g.SLINK_PROFILE_NOTES=Object.freeze({playerId,clean});
  if(!g.document||location.pathname!=='/profiles.php')return;
  const ext=g.SLINK_EXTENSION,pda=g.SLINK_PDA_PLUGIN_API;
  if(!ext&&!pda)return;
  const id=()=>playerId(new URLSearchParams(location.search).get('XID'));
  const owner=async()=>{
    if(pda)return playerId(pda.accountId?.());
    const s=await ext.core.storage.get('access.session.v1',null);
    return s?.token&&s.expiresAt>Date.now()?playerId(s.userId):null;
  };
  const key=(account,target)=>'profile-note.local.v1:'+account+':'+target;
  const get=async(account,target)=>pda?clean(pda.settings('profileNotes',{})[account]?.[target]):clean(await ext.core.storage.get(key(account,target),''));
  async function save(account,target,text){
    if(await owner()!==account||id()!==target)throw Error('The profile or signed-in account changed. Reopen the note before saving.');
    if(!pda){await ext.core.storage.set(key(account,target),text);return;}
    const prefs=pda.settings('profileNotes',{}), previous=prefs[account], notes={...previous};
    if(text)notes[target]=text;else delete notes[target];
    prefs[account]=notes;
    try{await pda.save();}catch(e){const current=pda.settings('profileNotes',{});if(current[account]===notes){if(previous===undefined)delete current[account];else current[account]=previous;}throw e;}
  }
  const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  let panel=null,queued=false,revision=0;
  function sync(){
    queued=false;
    if(document.visibilityState==='hidden')return;
    const target=id(), host=document.querySelector('#mainContainer')||document.querySelector('.content-wrapper[role="main"]')||document.querySelector('#mainwrap');
    if(panel?.target===target&&panel.node.parentNode===host)return;
    panel?.node.remove();panel=null;
    const seq=++revision;if(!target||!host)return;
    const node=el('details');node.style.cssText='margin:.5rem 0;padding:.55rem;border:1px solid currentColor;border-radius:.4rem';
    const title=el('summary','SLINK · Private profile note');
    const label=el('label','Note for player #'+target);
    const field=el('textarea');field.rows=4;field.maxLength=LIMIT;field.disabled=true;field.style.cssText='display:block;width:100%;box-sizing:border-box;margin:.35rem 0;resize:vertical';
    label.append(field);
    const button=el('button','Save note');button.type='button';button.disabled=true;
    const status=el('p','Loading…');status.setAttribute('role','status');
    node.append(title,el('p','Only saved on this device. Clear the text and save to remove your note.'),label,button,status);
    const instance={target,node,account:null};panel=instance;host.prepend(node);
    let account=null,saved='';
    const current=()=>seq===revision&&node.isConnected&&id()===target;
    void (async()=>{
      try{
        account=await owner();
        if(!account){if(current())status.textContent='Verify Access in SLINK to use private profile notes.';return;}
        const value=await get(account,target);
        if(!current()||await owner()!==account||!current())return;
        instance.account=account;saved=value;field.value=value;field.disabled=false;button.disabled=false;status.textContent='';
      }catch{if(current())status.textContent='Could not load the saved note.';}
    })();
    field.addEventListener('input',()=>{status.textContent=clean(field.value)===saved?'':'Unsaved changes';});
    button.addEventListener('click',async()=>{
      if(!current()||button.disabled||!account)return;
      const text=clean(field.value);
      field.disabled=button.disabled=true;status.textContent='Saving…';
      try{await save(account,target,text);if(current()){saved=text;field.value=text;status.textContent=text?'Note saved.':'Note cleared.';}}
      catch(e){if(current())status.textContent=e.message||'Could not save the note.';}
      finally{if(current())field.disabled=button.disabled=false;}
    });
  }
  function schedule(){if(!queued&&document.visibilityState!=='hidden'){queued=true;requestAnimationFrame(sync);}}
  function reset(){panel?.node.remove();panel=null;revision++;schedule();}
  function start(){
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    g.addEventListener('popstate',schedule);
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden')return;
      const current=panel;
      if(!current){schedule();return;}
      void owner().then(account=>{if(panel===current&&account!==current.account)reset();else schedule();}).catch(reset);
    });
    if(ext)g.chrome?.storage?.onChanged?.addListener(changes=>{if(Object.hasOwn(changes,ext.core.storage.fullKey('access.session.v1')))reset();});
    sync();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
