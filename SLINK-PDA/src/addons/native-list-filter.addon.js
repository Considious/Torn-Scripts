(function(){
  'use strict';
  const routes={friends:'friends',enemies:'enemies',targets:'targets',hospital:'hospital patients',jail:'jail inmates',userlist:'users',abroad:'people abroad'};
  const route=()=>{
    if(location.pathname==='/factions.php')return 'faction-members';
    if(location.pathname==='/hospitalview.php')return 'hospital';
    if(location.pathname==='/jailview.php')return 'jail';
    const q=new URLSearchParams(location.search),type=q.get('type');
    if(location.pathname==='/index.php'&&q.get('page')==='people')return 'abroad';
    if(['/shops.php','/bigalgunshop.php'].includes(location.pathname))return 'city-shop';
    if(location.pathname!=='/page.php')return '';
    if(q.get('sid')==='travel')return 'travel-stock';
    if(q.get('sid')?.toLowerCase()==='userlist')return 'userlist';
    return q.get('sid')==='list'&&['friends','enemies','targets'].includes(type)?type:'';
  };
  if(!route())return;
  const hostSelector=':is(.faction-info-wrap .members-list,.tableWrapper,.userlist-wrapper,[class*="stockTableWrapper___"],.buy-items-wrap .items-list)';
  const rosterBody=':is(.table-body,ul,.users-list,.user-info-list-wrap)';
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
  const shops=new Map();
  const sheet=make('style');
  sheet.textContent=`${hostSelector} [${marker}="hide"]{display:none!important}${hostSelector} [${marker}="mask"]{visibility:hidden!important;pointer-events:none!important}${hostSelector} ${rosterBody}[${sortMarker}]{display:flex!important;flex-direction:column;align-items:stretch}${hostSelector} ${rosterBody}[${sortMarker}] > li{order:var(--slink-roster-order,0)}`;
  function rowData(row){
    const level=numeric(row.querySelector('.level .value,.lvl,.level,[class*="level__"],[data-label="level"]')?.textContent.trim().match(/^(?:level\s*)?(\d+)$/i)?.[1]);
    const state=normalize((row.querySelector('.status .ellipsis')||row.querySelector('.status > :last-child')||row.querySelector('.status'))?.textContent);
    const activity=row.querySelector('[class*="userOnlineStatusIcon___"],[data-activity],[class*="userStatus"],.online,.idle,.offline,[title="Online" i],[title="Idle" i],[title="Offline" i],[aria-label="Online" i],[aria-label="Idle" i],[aria-label="Offline" i]');
    const desc=[activity?.dataset.activity,activity?.getAttribute('alt'),activity?.title,activity?.closest('[aria-label]')?.getAttribute('aria-label'),activity?.getAttribute('class'),row.querySelector('#iconTray li')?.title].join(' ');
    const icons=Array.from(row.querySelectorAll('.icons [title],.icons [aria-label],.user-icons [title],[data-icon][title]'),n=>normalize(n.title||n.getAttribute('aria-label')));
    const iconIds=new Set(Array.from(row.querySelectorAll('li[id^="icon"]'),n=>Number(/^icon(\d+)/.exec(n.id)?.[1])));
    const time=row.querySelector('.info-wrap .time'),last=time?.lastChild?.textContent||'';
    const duration=(/\d\s*(?:h|m|s)\b/i.test(last)?last:time?.textContent)||'';
    const units=[...duration.matchAll(/(\d+)\s*(d(?:ays?)?|h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)(?![a-z])/gi)];
    const minutes=units.length?units.reduce((sum,m)=>sum+Number(m[1])*({d:1440,h:60,m:1,s:1/60}[m[2][0].toLowerCase()]),0):null;
    const revive=row.querySelector('.revive');
    return {level,minutes,revive:revive?(revive.matches('.reviveNotAvailable,[disabled],[aria-disabled="true"]')?'no':'yes'):'',
      activity:activities.find(v=>new RegExp('(?:^|[^a-z])'+v+'(?:[^a-z]|$)','i').test(desc))||'Unknown',
      state:/^okay\b/.test(state)?'Okay':/^hospital\b/.test(state)?'Hospital':/^jail\b/.test(state)?'Jail':/^travel/.test(state)?'Traveling':/^(abroad|in (?!hospital\b|jail\b))/.test(state)?'Abroad':'Unknown',
      flags:new Set(specials.filter((_,i)=>flagIds[i].some(id=>iconIds.has(id))||icons.some(icon=>[/fed(?:ded|eral jail)/,/fallen/,/new player/,/company/,/donator|subscriber/,/recruit/][i].test(icon))))};
  }
  function mount(host,kind){
    const faction=kind==='faction-members',noun=faction?'members':routes[kind];
    const timed=kind==='hospital'||kind==='jail',abroad=kind==='abroad',directory=timed||abroad||kind==='userlist';
    const listMetrics={...metrics,...(timed?{minutes:'Time left (min)'}:{})};
    const key='slink-native-list-filter:'+kind+':v1';
    const read=()=>{try{return JSON.parse(localStorage.getItem(key))||{};}catch{return {};}};
    const saved=read();
    let active=saved.active===true, listObserver, frame=0, previous=new Set(), requested='', intel={}, generation=0, sortedBody=null, sortedRows=new Set();
    const box=make('div');box.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 0';
    const controls=make('div');controls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px';
    const search=make('input');search.type='search';search.placeholder='Name or player ID';search.maxLength=60;search.setAttribute('aria-label','Filter '+noun+' by name or ID');
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
    const revive=choose('revive','Revive availability',[['','Any revive status'],['yes','Revive available'],['no','Revive unavailable']]);
    const sort=choose('sort','Sort '+noun,[['','Torn order'],...Object.entries(listMetrics).flatMap(([id,v])=>[[id+'-desc',v+' ↓'],[id+'-asc',v+' ↑']])]);
    const ranges=Object.entries(listMetrics).map(([id,label])=>{
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
    const back=button('Back to filters',()=>{toggle.scrollIntoView({block:'center'});toggle.focus({preventScroll:true});});
    back.hidden=true;
    const reset=button('Reset',()=>{search.value='';selected='';Object.values(fields).forEach(f=>f.value='');schedule();});
    const preset=button('Save preset',()=>{
      try{localStorage.setItem(key,JSON.stringify({active,query:search.value,role:selected,...Object.fromEntries(Object.entries(fields).map(([k,f])=>[k,f.value]))}));status.textContent='Preset saved. '+status.textContent.replace(/^Preset saved\. /,'');}
      catch{status.textContent='Could not save the preset on this device.';}
    });
    search.addEventListener('input',schedule);
    role.addEventListener('change',()=>{selected=role.value;schedule();});
    if(!faction)selected='';
    controls.append(search,...(faction?[role]:[]),activity,...(faction||abroad?[state]:[]),...(kind==='hospital'?[revive]:[]),sort,...ranges,...(faction||abroad||kind==='userlist'?[special]:[]),reset,preset,status);box.append(toggle,controls);box.style.flexDirection='column';box.style.alignItems='start';host.before(box);host.after(back);
    if(faction)globalThis.SLINK_FACTION_CSV?.attach(box,{name:'Export visible members',file:'slink-faction-members.csv',produce:()=>host.isConnected?globalThis.SLINK_FACTION_CSV.native(host,false):''});
    function clear(){for(const row of previous)row.removeAttribute(marker);previous.clear();}
    function clearSort(){
      sortedBody?.removeAttribute(sortMarker);sortedBody=null;
      for(const row of sortedRows)row.style.removeProperty('--slink-roster-order');
      sortedRows.clear();
    }
    function render(){
      frame=0;if(!active)return;
      const body=host.querySelector(faction?'.table-body':timed||abroad?'.users-list':directory?'.user-info-list-wrap':':scope > ul');
      const rows=Array.from(body?.children||[]).filter(row=>row.matches('li')&&!row.querySelector('.ajax-preloader,.ajax-placeholder')&&row.querySelector('a[href*="profiles.php?XID="]'));
      const entries=rows.map(row=>{
        const a=row.querySelector('a[href*="profiles.php?XID="]');
        const id=new URL(a.href,location.href).searchParams.get('XID')||'';
        const name=Array.from(row.querySelectorAll('a[href*="profiles.php?XID="]')).find(link=>link.textContent.trim())?.textContent||a.title;
        const position=row.querySelector('.position .ellipsis,.position')?.textContent.trim()||'';
        return {row,id,name,position,...rowData(row),ff:numeric(intel[id]?.ff),stats:numeric(intel[id]?.stats)};
      });
      const [metric,dir]=sort.value.split('-');
      const range=Object.fromEntries(Object.keys(listMetrics).map(id=>[id,['min','max'].map(bound=>numeric(fields[id+bound].value))]));
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
          &&(!activity.value||e.activity===activity.value)&&(!(faction||abroad)||!state.value||e.state===state.value)
          &&(kind!=='hospital'||!revive.value||e.revive===revive.value)
          &&(!(faction||abroad||kind==='userlist')||specials.every(flag=>!fields[flag].value||(fields[flag].value==='yes')===e.flags.has(flag)))
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
      back.hidden=shown<15||!body||body.getBoundingClientRect().height<450;
      const message=(!rows.length?`No loaded ${noun} to filter.`:shown===0?`No matches among ${rows.length} loaded ${noun}.`:`${shown} of ${rows.length} loaded ${noun}`)+(metric==='ff'||metric==='stats'||range.ff.some(v=>v!==null)||range.stats.some(v=>v!==null)?' · Stats from SLINK cache only.':'')+(metric&&rows.length&&!canSort?' · Sorting unavailable in this list layout.':'');
      if(status.textContent!==message)status.textContent=message;
    }
    function schedule(){if(active&&!frame)frame=requestAnimationFrame(render);}
    function stop(){listObserver?.disconnect();cancelAnimationFrame(frame);frame=0;generation++;requested='';intel={};back.hidden=true;clearSort();clear();}
    function configure(){
      stop();
      controls.hidden=!active;controls.style.display=active?'flex':'none';
      toggle.textContent=active?(faction?'Hide member filter':'Hide '+noun+' filter'):'Filter '+noun;toggle.setAttribute('aria-expanded',String(active));
      if(!active){try{localStorage.setItem(key,JSON.stringify({...read(),active:false}));}catch{}return;}
      if(!sheet.isConnected)document.head.append(sheet);
      listObserver=new MutationObserver(schedule);listObserver.observe(host,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['href','class','title','alt','aria-label','data-activity','disabled','aria-disabled']});
      schedule();
    }
    configure();
    return {host,box,kind,dispose(){stop();box.remove();back.remove();}};
  }
  function mountShop(host,travel){
    const box=make('div'), fields=make('div'), status=make('span');
    fields.style.cssText='display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:5px 0';
    status.setAttribute('role','status');
    const input=(type,label)=>{const el=make('input');el.type=type;el.placeholder=label;el.setAttribute('aria-label',label);if(type==='number'){el.min='0';el.style.width='7em';}el.addEventListener('input',schedule);return el;};
    const name=input('search','Item name'),price=input('number','Max price'),stock=input('number','Minimum stock');
    name.maxLength=80;
    const category=make('select');category.setAttribute('aria-label','Item type');category.addEventListener('change',schedule);
    const key='slink-native-shop-filter:v1:'+(travel?'travel':location.pathname+':'+(new URLSearchParams(location.search).get('step')||''));
    let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
    for(const [el,id] of [[name,'name'],[price,'price'],[stock,'stock']])if(typeof saved[id]==='string')el.value=saved[id].slice(0,80);
    let active=saved.active===true,observer,frame=0,marked=new Set(),type=travel&&typeof saved.type==='string'?saved.type.slice(0,80):'';
    const toggle=button('Filter items',()=>{active=!active;if(!active)try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old)localStorage.setItem(key,JSON.stringify({...old,active:false}));}catch{}configure();});
    fields.append(name,...(travel?[category]:[]),price,stock,button('Reset',()=>{name.value=price.value=stock.value=type='';try{localStorage.removeItem(key);}catch{}schedule();}),button('Save preset',()=>{
      try{localStorage.setItem(key,JSON.stringify({active:true,name:name.value,price:price.value,stock:stock.value,type}));status.textContent='Preset saved.';}
      catch{status.textContent='Could not save the preset on this device.';}
    }),status);
    box.append(toggle,fields);host.before(box);
    function clear(){for(const row of marked)row.removeAttribute(marker);marked.clear();}
    function configure(){
      fields.hidden=!active;fields.style.display=active?'flex':'none';toggle.textContent=active?'Hide item filter':'Filter items';toggle.setAttribute('aria-expanded',String(active));
      if(active){if(!sheet.isConnected)document.head.append(sheet);observer=new MutationObserver(schedule);observer.observe(host,{childList:true,subtree:true,characterData:true});schedule();}
      else{observer?.disconnect();cancelAnimationFrame(frame);frame=0;clear();}
    }
    function schedule(){if(active&&!frame)frame=requestAnimationFrame(render);}
    const number=(v,re)=>{const m=v?.trim().match(re);return m?numeric(m[1].replaceAll(',','')):null;};
    function render(){
      frame=0;if(!active)return;
      const items=[];
      for(const row of host.children){
        if(!row.matches('li')||row.querySelector('[class*="buyPanel___"]'))continue;
        const item=travel?row.querySelector('[class*="itemName___"]'):row.querySelector('.item[itemid],.item-desc');
        if(!item)continue;
        const cells=travel?Array.from(row.querySelector('[class*="row___"]')?.children||[]):[];
        const cell=(label)=>cells.find(el=>normalize(el.textContent).startsWith(label+' ')||normalize(el.textContent).startsWith(label+':'))?.textContent;
        const text=(travel?item.textContent:(item.querySelector('.name,.item-name')?.textContent||item.getAttribute('title')||item.textContent)).trim();
        const cost=travel?(cell('cost')||cells.find(el=>el.textContent.trim().startsWith('$'))?.textContent):row.querySelector('.price')?.firstChild?.textContent;
        const quantity=travel?cell('stock'):row.querySelector('.instock')?.textContent;
        items.push({row,name:text,type:(cell('type')||'').trim().replace(/^type\s*:?\s*/i,''),price:number(cost,/^(?:cost\s*:?\s*)?\$?([\d,]+)/i),stock:number(quantity,/^(?:stock\s*:?\s*)?([\d,]+)/i)});
      }
      const types=['',...new Set(items.map(i=>i.type).filter(Boolean).sort())];
      if(travel&&(types.length!==category.options.length||types.some((v,i)=>category.options[i].value!==v))){
        category.replaceChildren(...types.map(v=>{const o=make('option',v||'All types');o.value=v;return o;}));
      }
      if(travel)category.value=types.includes(type)?type:'';
      const q=normalize(name.value),max=numeric(price.value),min=numeric(stock.value),next=new Set();
      for(const i of items)if((q&&!normalize(i.name).includes(q))||(category.value&&i.type!==category.value)||(max!==null&&(i.price===null||i.price>max))||(min!==null&&(i.stock===null||i.stock<min))){i.row.setAttribute(marker,'hide');next.add(i.row);}
      for(const row of marked)if(!next.has(row))row.removeAttribute(marker);
      marked=next;
      const message=items.length?`${items.length-next.size} of ${items.length} loaded items`:'No loaded items to filter.';
      if(status.textContent!==message)status.textContent=message;
    }
    category.addEventListener('change',()=>{type=category.value;});
    configure();
    return {box,dispose(){active=false;configure();box.remove();}};
  }
  function sync(){
    queued=false;
    if(document.hidden)return;
    const kind=route(),shopSelector=kind==='travel-stock'?'[class*="stockTableWrapper___"]':kind==='city-shop'?'.buy-items-wrap .items-list':'';
    const lists=new Set(shopSelector?document.querySelectorAll(shopSelector):[]);
    for(const [node,ui] of shops)if(!lists.has(node)||!ui.box.isConnected){ui.dispose();shops.delete(node);}
    for(const node of lists)if(!shops.has(node))shops.set(node,mountShop(node,kind==='travel-stock'));
    const host=kind&&!shopSelector?document.querySelector(kind==='faction-members'?'.faction-info-wrap .members-list':kind==='userlist'?'.userlist-wrapper:has(.user-info-list-wrap)':['hospital','jail','abroad'].includes(kind)?'.userlist-wrapper:has(.users-list)':'.tableWrapper:has(> ul)'):null;
    if(mounted?.host===host&&mounted.kind===kind&&mounted.box.isConnected)return;
    mounted?.dispose();mounted=host?mount(host,kind):null;
  }
  function scheduleMount(){if(!queued&&!document.hidden){queued=true;requestAnimationFrame(sync);}}
  const start=()=>{
    const root=document.querySelector('#mainContainer')||document.querySelector('#mainwrap')||document.body;
    new MutationObserver(()=>{if(!mounted?.host.isConnected||!mounted.box.isConnected||mounted.kind!==route())scheduleMount();}).observe(root,{childList:true,subtree:true});
    window.addEventListener('popstate',scheduleMount);
    document.addEventListener('visibilitychange',scheduleMount);sync();
  };
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
