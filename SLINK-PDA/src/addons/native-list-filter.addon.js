(function(){
  'use strict';
  if(location.pathname!=='/factions.php')return;
  const hostSelector='.faction-info-wrap .members-list';
  const key='slink-native-list-filter:faction-members:v1';
  const read=()=>{try{return JSON.parse(localStorage.getItem(key))||{};}catch{return {};}};
  const normalize=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
  const make=(tag,label)=>{const n=document.createElement(tag);if(label)n.textContent=label;return n;};
  const button=(label,fn)=>{const n=make('button',label);n.type='button';n.onclick=fn;return n;};
  const marker='data-slink-faction-filtered';
  let mounted,queued=false;
  const sheet=make('style');
  sheet.textContent=`${hostSelector} [${marker}="hide"]{display:none!important}${hostSelector} [${marker}="mask"]{visibility:hidden!important;pointer-events:none!important}`;
  function mount(host){
    const saved=read();
    let active=saved.active===true, listObserver, frame=0, previous=new Set();
    const box=make('div');box.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 0';
    const controls=make('div');controls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px';
    const search=make('input');search.type='search';search.placeholder='Name or player ID';search.maxLength=60;search.setAttribute('aria-label','Filter faction members by name or ID');
    const role=make('select');role.setAttribute('aria-label','Faction role');
    const status=make('span');status.setAttribute('role','status');
    search.value=typeof saved.query==='string'?saved.query.slice(0,60):'';
    let selected=typeof saved.role==='string'?saved.role.slice(0,100):'';
    const toggle=button('',()=>{active=!active;configure();});
    const reset=button('Reset',()=>{search.value='';selected='';schedule();});
    const preset=button('Save preset',()=>{
      try{localStorage.setItem(key,JSON.stringify({active,query:search.value,role:selected}));status.textContent='Preset saved. '+status.textContent.replace(/^Preset saved\. /,'');}
      catch{status.textContent='Could not save the preset on this device.';}
    });
    search.addEventListener('input',schedule);
    role.addEventListener('change',()=>{selected=role.value;schedule();});
    controls.append(search,role,reset,preset,status);box.append(toggle,controls);host.before(box);
    function clear(){for(const row of previous)row.removeAttribute(marker);previous.clear();}
    function render(){
      frame=0;if(!active)return;
      const body=host.querySelector('.table-body');
      const rows=Array.from(body?.children||[]).filter(row=>row.matches('li')&&row.querySelector('a[href*="profiles.php?XID="]'));
      const entries=rows.map(row=>{
        const a=row.querySelector('a[href*="profiles.php?XID="]');
        const id=new URL(a.href,location.href).searchParams.get('XID')||'';
        const name=Array.from(row.querySelectorAll('a[href*="profiles.php?XID="]')).find(link=>link.textContent.trim())?.textContent||a.title;
        const position=row.querySelector('.position .ellipsis,.position')?.textContent.trim()||'';
        return {row,id,name,position};
      });
      const roles=[...new Set(entries.map(e=>e.position).filter(Boolean).concat(selected||[]))].sort((a,b)=>a.localeCompare(b));
      const options=['',...roles];
      if(options.length!==role.options.length||options.some((v,i)=>role.options[i].value!==v)){
        role.replaceChildren(...options.map(value=>{const o=make('option',value||'All roles');o.value=value;return o;}));
      }
      role.value=selected;
      const query=normalize(search.value), idQuery=query.replace(/^\[|\]$/g,'');
      const virtual=body?.matches('[class*="virtual"],[data-virtualized="true"]');
      const next=new Set();
      let shown=0;
      for(const e of entries){
        const match=(!query||(/^\d+$/.test(idQuery)?e.id===idQuery:normalize(e.name).includes(query)))&&(!selected||selected===e.position);
        if(match){shown++;e.row.removeAttribute(marker);}
        else{e.row.setAttribute(marker,virtual||e.row.matches('[class*="virtual"],[style*="position: absolute"]')?'mask':'hide');next.add(e.row);}
      }
      for(const row of previous)if(!next.has(row))row.removeAttribute(marker);
      previous=next;
      const message=!rows.length?'No loaded members to filter.':shown===0?`No matches among ${rows.length} loaded members.`:`${shown} of ${rows.length} loaded members`;
      if(status.textContent!==message)status.textContent=message;
    }
    function schedule(){if(active&&!frame)frame=requestAnimationFrame(render);}
    function stop(){listObserver?.disconnect();cancelAnimationFrame(frame);frame=0;clear();}
    function configure(){
      stop();
      controls.hidden=!active;controls.style.display=active?'flex':'none';
      toggle.textContent=active?'Hide member filter':'Filter members';toggle.setAttribute('aria-expanded',String(active));
      if(!active){try{localStorage.setItem(key,JSON.stringify({...read(),active:false}));}catch{}return;}
      if(!sheet.isConnected)document.head.append(sheet);
      listObserver=new MutationObserver(schedule);listObserver.observe(host,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['href']});
      schedule();
    }
    configure();
    return {host,box,dispose(){stop();box.remove();}};
  }
  function sync(){
    queued=false;
    if(document.hidden)return;
    const host=document.querySelector(hostSelector);
    if(mounted?.host===host&&mounted.box.isConnected)return;
    mounted?.dispose();mounted=host?mount(host):null;
  }
  function scheduleMount(){if(!queued&&!document.hidden){queued=true;requestAnimationFrame(sync);}}
  const start=()=>{
    const root=document.querySelector('#mainContainer')||document.querySelector('#mainwrap')||document.body;
    new MutationObserver(()=>{if(!mounted?.host.isConnected||!mounted.box.isConnected)scheduleMount();}).observe(root,{childList:true,subtree:true});
    document.addEventListener('visibilitychange',scheduleMount);sync();
  };
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
