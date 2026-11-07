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
  const sortMarker='data-slink-roster-sorted';
  const metrics={level:'Level',ff:'Fair Fight',stats:'Battle-stat estimate'};
  const activities=['Online','Idle','Offline'];
  const states=['Okay','Hospital','Jail','Abroad','Traveling','Unknown'];
  const specials=['Fedded','Fallen','New Player','In Company','Is Donator','Is Recruit'];
  const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
  // Torn's native status icon IDs, cross-checked against TornTools' selector reference.
  const flagIds=[[70],[77],[72],[21,22,23,24,25,26,27,73,83],[3,4],[81]];
  const pda=globalThis.SLINK_PDA_PLUGIN_API;
  const ext=globalThis.SLINK_EXTENSION;
  const lookup=ids=>pda?.factionMemberIntel?pda.factionMemberIntel(ids):ext?.core.messaging?.send('factionMembers.cachedIntel',{ids})||{};
  let mounted,queued=false;
  const sheet=make('style');
  sheet.textContent=`${hostSelector} [${marker}="hide"]{display:none!important}${hostSelector} [${marker}="mask"]{visibility:hidden!important;pointer-events:none!important}${hostSelector} .table-body[${sortMarker}]{display:flex!important;flex-direction:column;align-items:stretch}${hostSelector} .table-body[${sortMarker}] > li{order:var(--slink-roster-order,0)}`;
  function rowData(row){
    const level=numeric(row.querySelector('.lvl,.level,[data-label="level"]')?.textContent.trim());
    const state=normalize(row.querySelector('.status .ellipsis,.status')?.textContent);
    const activity=row.querySelector('[data-activity],[class*="userStatus"],.online,.idle,.offline,[title="Online" i],[title="Idle" i],[title="Offline" i],[aria-label="Online" i],[aria-label="Idle" i],[aria-label="Offline" i]');
    const desc=[activity?.dataset.activity,activity?.title,activity?.getAttribute('aria-label'),activity?.getAttribute('class')].join(' ');
    const icons=Array.from(row.querySelectorAll('.icons [title],.icons [aria-label],.user-icons [title],[data-icon][title]'),n=>normalize(n.title||n.getAttribute('aria-label')));
    const iconIds=new Set(Array.from(row.querySelectorAll('li[id^="icon"]'),n=>Number(/^icon(\d+)/.exec(n.id)?.[1])));
    return {level,activity:activities.find(v=>new RegExp('(?:^|[^a-z])'+v+'(?:[^a-z]|$)','i').test(desc))||'Unknown',
      state:/^okay\b/.test(state)?'Okay':/^hospital\b/.test(state)?'Hospital':/^jail\b/.test(state)?'Jail':/^travel/.test(state)?'Traveling':/^(abroad|in (?!hospital\b|jail\b))/.test(state)?'Abroad':'Unknown',
      flags:new Set(specials.filter((_,i)=>flagIds[i].some(id=>iconIds.has(id))||icons.some(icon=>[/fed(?:ded|eral jail)/,/fallen/,/new player/,/company/,/donator|subscriber/,/recruit/][i].test(icon))))};
  }
  function mount(host){
    const saved=read();
    let active=saved.active===true, listObserver, frame=0, previous=new Set(), requested='', intel={}, generation=0, sortedBody=null, sortedRows=new Set();
    const box=make('div');box.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 0';
    const controls=make('div');controls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px';
    const search=make('input');search.type='search';search.placeholder='Name or player ID';search.maxLength=60;search.setAttribute('aria-label','Filter faction members by name or ID');
    const role=make('select');role.setAttribute('aria-label','Faction role');
    const status=make('span');status.setAttribute('role','status');
    search.value=typeof saved.query==='string'?saved.query.slice(0,60):'';
    let selected=typeof saved.role==='string'?saved.role.slice(0,100):'';
    const fields={};
    const choose=(id,label,options)=>{
      const field=make('select');field.setAttribute('aria-label',label);
      for(const [value,caption] of options){const o=make('option',caption);o.value=value;field.append(o);}
      field.value=options.some(o=>o[0]===saved[id])?saved[id]:'';
      field.addEventListener('change',schedule);fields[id]=field;return field;
    };
    const activity=choose('activity','Activity',[['','Any activity'],...[...activities,'Unknown'].map(v=>[v,v])]);
    const state=choose('state','Status',[['','Any status'],...states.map(v=>[v,v])]);
    const sort=choose('sort','Sort members',[['','Torn order'],...Object.entries(metrics).flatMap(([id,v])=>[[id+'-desc',v+' ↓'],[id+'-asc',v+' ↑']])]);
    const ranges=Object.entries(metrics).map(([id,label])=>{
      const group=make('span',label+' ');
      for(const bound of ['min','max']){
        const field=make('input');field.type='number';field.min='0';field.step='any';field.placeholder=bound;field.style.width='6em';field.setAttribute('aria-label',label+' '+bound);
        const k=id+bound;field.value=numeric(saved[k])??'';field.addEventListener('input',schedule);fields[k]=field;group.append(field);
      }
      return group;
    });
    const special=make('details'), summary=make('summary','Special flags');
    special.append(summary,...specials.map(flag=>{
      const l=make('label',flag+' ');l.style.display='block';l.append(choose(flag,flag,[['','Either'],['yes','Yes'],['no','No']]));return l;
    }));
    const toggle=button('',()=>{active=!active;configure();});
    const reset=button('Reset',()=>{search.value='';selected='';Object.values(fields).forEach(f=>f.value='');schedule();});
    const preset=button('Save preset',()=>{
      try{localStorage.setItem(key,JSON.stringify({active,query:search.value,role:selected,...Object.fromEntries(Object.entries(fields).map(([k,f])=>[k,f.value]))}));status.textContent='Preset saved. '+status.textContent.replace(/^Preset saved\. /,'');}
      catch{status.textContent='Could not save the preset on this device.';}
    });
    search.addEventListener('input',schedule);
    role.addEventListener('change',()=>{selected=role.value;schedule();});
    controls.append(search,role,activity,state,sort,...ranges,special,reset,preset,status);box.append(toggle,controls);box.style.flexDirection='column';box.style.alignItems='start';host.before(box);
    function clear(){for(const row of previous)row.removeAttribute(marker);previous.clear();}
    function clearSort(){
      sortedBody?.removeAttribute(sortMarker);sortedBody=null;
      for(const row of sortedRows)row.style.removeProperty('--slink-roster-order');
      sortedRows.clear();
    }
    function render(){
      frame=0;if(!active)return;
      const body=host.querySelector('.table-body');
      const rows=Array.from(body?.children||[]).filter(row=>row.matches('li')&&row.querySelector('a[href*="profiles.php?XID="]'));
      const entries=rows.map(row=>{
        const a=row.querySelector('a[href*="profiles.php?XID="]');
        const id=new URL(a.href,location.href).searchParams.get('XID')||'';
        const name=Array.from(row.querySelectorAll('a[href*="profiles.php?XID="]')).find(link=>link.textContent.trim())?.textContent||a.title;
        const position=row.querySelector('.position .ellipsis,.position')?.textContent.trim()||'';
        return {row,id,name,position,...rowData(row),ff:numeric(intel[id]?.ff),stats:numeric(intel[id]?.stats)};
      });
      const [metric,dir]=sort.value.split('-');
      const range=Object.fromEntries(Object.keys(metrics).map(id=>[id,['min','max'].map(bound=>numeric(fields[id+bound].value))]));
      if(metric==='ff'||metric==='stats'||range.ff.some(v=>v!==null)||range.stats.some(v=>v!==null)){
        const ids=[...new Set(entries.map(e=>e.id).filter(id=>/^[1-9]\d{0,9}$/.test(id)))].slice(0,200), signature=ids.slice().sort().join(',');
        if(signature!==requested){
          requested=signature;
          const request=++generation;
          Promise.resolve().then(()=>lookup(ids)).then(data=>{if(active&&request===generation){intel=data||{};schedule();}},()=>{});
        }
      }
      const roles=[...new Set(entries.map(e=>e.position).filter(Boolean).concat(selected||[]))].sort((a,b)=>a.localeCompare(b));
      const options=['',...roles];
      if(options.length!==role.options.length||options.some((v,i)=>role.options[i].value!==v)){
        role.replaceChildren(...options.map(value=>{const o=make('option',value||'All roles');o.value=value;return o;}));
      }
      role.value=selected;
      const query=normalize(search.value), idQuery=query.replace(/^\[|\]$/g,'');
      const virtual=body?.matches('[class*="virtual"],[data-virtualized="true"]');
      const next=new Set();
      const matches=[];
      for(const e of entries){
        const match=(!query||(/^\d+$/.test(idQuery)?e.id===idQuery:normalize(e.name).includes(query)))&&(!selected||selected===e.position)
          &&(!activity.value||e.activity===activity.value)&&(!state.value||e.state===state.value)
          &&specials.every(flag=>!fields[flag].value||(fields[flag].value==='yes')===e.flags.has(flag))
          &&Object.entries(range).every(([k,[min,max]])=>[min,max].every(v=>v===null)||(e[k]!==null&&(min===null||e[k]>=min)&&(max===null||e[k]<=max)));
        if(match){matches.push(e);e.row.removeAttribute(marker);}
        else{e.row.setAttribute(marker,virtual||e.row.matches('[class*="virtual"],[style*="position: absolute"]')?'mask':'hide');next.add(e.row);}
      }
      for(const row of previous)if(!next.has(row))row.removeAttribute(marker);
      previous=next;
      const canSort=body&&rows.length&&!virtual&&!rows.some(row=>row.matches('[class*="virtual"],[style*="position: absolute"]'));
      if(!metric||!canSort||sortedBody!==body)clearSort();
      if(metric&&canSort){
        matches.sort((a,b)=>a[metric]===null?b[metric]===null?0:1:b[metric]===null?-1:(a[metric]-b[metric])*(dir==='desc'?-1:1));
        const nextSorted=new Set(matches.map(e=>e.row));
        for(const row of sortedRows)if(!nextSorted.has(row))row.style.removeProperty('--slink-roster-order');
        // Keep React's native rows and handlers mounted. Only their visual order changes.
        matches.forEach(({row},i)=>row.style.setProperty('--slink-roster-order',String(i-matches.length)));
        sortedRows=nextSorted;sortedBody=body;body.setAttribute(sortMarker,'');
      }
      const shown=matches.length;
      const message=(!rows.length?'No loaded members to filter.':shown===0?`No matches among ${rows.length} loaded members.`:`${shown} of ${rows.length} loaded members`)+(metric==='ff'||metric==='stats'||range.ff.some(v=>v!==null)||range.stats.some(v=>v!==null)?' · Stats from SLINK cache only.':'')+(metric&&rows.length&&!canSort?' · Sorting unavailable in this roster layout.':'');
      if(status.textContent!==message)status.textContent=message;
    }
    function schedule(){if(active&&!frame)frame=requestAnimationFrame(render);}
    function stop(){listObserver?.disconnect();cancelAnimationFrame(frame);frame=0;generation++;requested='';intel={};clearSort();clear();}
    function configure(){
      stop();
      controls.hidden=!active;controls.style.display=active?'flex':'none';
      toggle.textContent=active?'Hide member filter':'Filter members';toggle.setAttribute('aria-expanded',String(active));
      if(!active){try{localStorage.setItem(key,JSON.stringify({...read(),active:false}));}catch{}return;}
      if(!sheet.isConnected)document.head.append(sheet);
      listObserver=new MutationObserver(schedule);listObserver.observe(host,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['href','class','title','aria-label','data-activity']});
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
