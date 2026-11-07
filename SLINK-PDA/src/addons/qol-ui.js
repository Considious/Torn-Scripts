/* SLINK themed page enhancements. Independent UI, inspired by TornTools contributors.
 * No background Torn-page fetching. One trusted click sends at most one use request. */
(function(global){
  'use strict';
  const Q=global.SLINK_QOL;
  function create(host){
    const doc=host.document||global.document;
    let config=Q.normalize(),loaded=false,allowed=false,stopped=false,observer=null,scope=null,timer=null,busy=false,preparing=false,queue=Promise.resolve(),context=null,seenAt=0;
    let items=new Map(),metadata=new Map(),bonus={},catalogAt=0,profileAt=0,bonusAt=0,status='',tray=null,links=null,manager=null,style=null,lastRoute='',inputPending=false,lastMedical=null;
    const changed=new Set();
    const active=()=>!stopped&&allowed&&(!host.allowed||host.allowed())&&doc.visibilityState!=='hidden'&&doc.hasFocus();
    const route=()=>{const u=new URL(global.location.href);return u.pathname==='/item.php'?'inventory':u.pathname==='/factions.php'&&(/armoury|armory/i.test(u.hash)||doc.querySelector('.armoury-tabs,.armoury-points-wrap,#faction-armoury-tabs'))?'armory':null;};
    function node(tag,text,attrs={}){const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el;}
    function button(label,fn,attrs={}){const b=node('button',label,{type:'button',...attrs});b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();Promise.resolve(fn(event)).catch(error=>notice(error.message||String(error)));});return b;}
    function notice(text){status=String(text||'');for(const el of [tray?.querySelector('[role="status"]'),manager?.querySelector('[role="status"]')])if(el)el.textContent=status;}
    function emit(){for(const fn of changed)fn(config);}
    function mutate(fn){
      const task=queue.then(async()=>{const next=Q.normalize(fn(Q.normalize(config)));await host.save(next);config=next;emit();drawManager();schedule();return config;});
      queue=task.catch(()=>{});return task;
    }
    function installStyle(){if(style)return;style=node('style');style.textContent=`
      .slink-qol{box-sizing:border-box;color:var(--slt-text,var(--slink-text,#eee));font:inherit;background:var(--slt-panel,var(--slink-panel,#222));border:1px solid var(--slt-border,var(--slink-border,#666));border-radius:9px;padding:8px;margin:7px 0;line-height:1.4}
      .slink-qol button,.slink-qol input,.slink-qol select,.slink-qol a{box-sizing:border-box;font:inherit;color:inherit}
      .slink-qol button,.slink-qol select,.slink-qol input{background:var(--slt-control,var(--slink-control,#333));border:1px solid var(--slt-border,var(--slink-border,#888));border-radius:6px;padding:5px 7px;min-height:32px}
      .slink-qol button{cursor:pointer}.slink-qol button:disabled{opacity:.55;cursor:not-allowed}.slink-qol button:focus-visible{outline:2px solid var(--slt-accent,#ad7cff);outline-offset:2px}
      .slink-qol-row,.slink-qol-favorites,.slink-qol-links{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.slink-qol-row{margin:5px 0}.slink-qol-row>span:first-child{flex:1;min-width:110px}.slink-qol-row input[type="text"],.slink-qol-row input[type="url"]{flex:1;min-width:100px;width:100%}
      .slink-qol [role="status"]{display:block;white-space:pre-wrap;margin-top:4px}.slink-qol small{opacity:.82}.slink-qol-add{font-size:11px;padding:2px 4px;cursor:pointer;margin-left:4px}
      .slink-qol-info{display:block;font-size:11px;line-height:1.3;color:var(--slt-text,#ddd);white-space:normal}.slink-qol h3{margin:9px 0 4px}.slink-qol label{display:inline-flex;gap:5px;align-items:center;margin:4px 7px 4px 0}
      .slink-qol [draggable="true"]{touch-action:pan-y}.slink-qol-links a{padding:4px 6px;color:var(--slt-link,#c9a5ff)}
    `;doc.head.append(style);}
    function moveControl(row,key,kind){
      const list=kind==='favorites'?config.favorites:config.links,keyFn=kind==='favorites'?Q.favoriteKey:x=>x.id,index=list.findIndex(x=>keyFn(x)===key);
      const up=button('↑',()=>mutate(s=>({...s,[kind]:Q.move(s[kind],key,-1,keyFn)})),{'aria-label':'Move up'}),down=button('↓',()=>mutate(s=>({...s,[kind]:Q.move(s[kind],key,1,keyFn)})),{'aria-label':'Move down'});
      up.disabled=index===0;down.disabled=index===list.length-1;row.append(up,down,button('Remove',()=>mutate(s=>({...s,[kind]:s[kind].filter(x=>keyFn(x)!==key)}))));
      row.draggable=true;row.dataset.sortKey=key;row.addEventListener('dragstart',event=>{event.dataTransfer.setData('text/plain',kind+'\n'+key);event.dataTransfer.effectAllowed='move';});
      row.addEventListener('dragover',e=>e.preventDefault());row.addEventListener('drop',event=>{event.preventDefault();const [group,from]=event.dataTransfer.getData('text/plain').split('\n');if(group!==kind)return;void mutate(s=>{const i=s[kind].findIndex(x=>keyFn(x)===from),j=s[kind].findIndex(x=>keyFn(x)===key);return {...s,[kind]:Q.move(s[kind],from,j-i,keyFn)};}).catch(e=>notice(e.message));});
    }
    function drawManager(){
      if(!manager||inputPending)return;manager.replaceChildren();manager.classList.add('slink-qol');const localStyle=node('style');localStyle.textContent=style?.textContent||'';manager.append(localStyle);
      manager.append(node('h3','Page tools'));
      for(const [key,label]of [['enabled','Enable page tools'],['quickItems','Quick-use favorites'],['customLinks','Custom links'],['effects','Item effects'],['values','Item values']]){
        const l=node('label'),input=node('input',undefined,{type:'checkbox'});input.checked=config[key];input.addEventListener('change',()=>void mutate(s=>({...s,[key]:input.checked})).catch(e=>notice(e.message)));l.append(input,doc.createTextNode(label));manager.append(l);
      }
      const row=node('div',undefined,{class:'slink-qol-row'}),blood=node('select',undefined,{'aria-label':'Your Torn blood type'});blood.append(node('option','Choose Torn blood type',{value:''}));for(const type of Q.BLOOD)blood.append(node('option',type,{value:type}));blood.value=config.bloodType||'';
      blood.addEventListener('change',()=>void mutate(s=>({...s,bloodType:blood.value})).catch(e=>notice(e.message)));row.append(node('span','Your Torn blood type'),blood);manager.append(row,node('small','Blood shortcuts are disabled until your Torn blood type is known. No action is used to discover it.'));
      manager.append(button('Refresh item information',()=>refreshInfo(true)),node('small',' Load once for item prices/effects and your faction/education bonuses; refreshed only when requested.'),node('h3','Quick-use favorites'));
      manager.append(node('small','Use ☆ beside an item on your current Items/Armory page. Reorder here with arrows or drag-and-drop. One click uses one item.'));
      for(const f of config.favorites){const r=node('div',undefined,{class:'slink-qol-row'});r.append(node('span',f.name+' · '+f.source));moveControl(r,Q.favoriteKey(f),'favorites');manager.append(r);}
      const specials=node('div',undefined,{class:'slink-qol-row'}),source=node('select',undefined,{'aria-label':'Favorite source'});source.append(node('option','Items',{value:'inventory'}),node('option','Faction armory',{value:'armory'}));
      const select=node('select',undefined,{'aria-label':'Special shortcut'});for(const [id,label]of [['heal-exit','Leave hospital efficiently'],['heal-max','Heal to full efficiently'],['blood-heal','Best compatible blood bag'],['blood-hospital','Self-hospitalize with blood'],['points-energy','Energy refill (armory only)'],['points-nerve','Nerve refill (armory only)']])select.append(node('option',label,{value:id}));
      specials.append(source,select,button('Add shortcut',()=>{if(select.value.startsWith('points-')&&source.value!=='armory')throw Error('Points refills are available only in the faction armory.');return mutate(s=>Q.addFavorite(s,{id:select.value,source:source.value,name:select.selectedOptions[0].textContent}));}));manager.append(specials,node('h3','Custom links'));
      for(const l of config.links){const r=node('div',undefined,{class:'slink-qol-row'});r.append(node('span',l.name));r.append(button('Edit',()=>editLink(l)));moveControl(r,l.id,'links');manager.append(r);}
      manager.append(button('Add link',()=>editLink()),node('h3','Updates'),button('Check for updates',checkUpdate),node('div',status,{role:'status','aria-live':'polite'}));
    }
    function editLink(existing){
      if(!manager)return;inputPending=true;const form=node('form',undefined,{class:'slink-qol'}),name=node('input',undefined,{type:'text',placeholder:'Name',required:'',maxlength:60,'aria-label':'Link name'}),href=node('input',undefined,{type:'url',placeholder:'https://…',required:'','aria-label':'Link URL'}),tab=node('input',undefined,{type:'checkbox'}),label=node('label','');
      name.value=existing?.name||'';href.value=existing?.href||'';tab.checked=existing?.newTab===true;label.append(tab,doc.createTextNode('Open in new tab'));form.append(name,href,label);
      const save=node('button','Save link',{type:'submit'});form.append(save,button('Cancel',()=>{inputPending=false;drawManager();}));
      form.addEventListener('submit',async e=>{e.preventDefault();const url=Q.safeUrl(href.value);if(!url||!name.value.trim())return;save.disabled=true;
        try{const updated={id:existing?.id||global.crypto.randomUUID(),name:name.value.trim(),href:url,newTab:tab.checked};await mutate(s=>({...s,links:existing?s.links.map(x=>x.id===existing.id?updated:x):[...s.links,updated]}));inputPending=false;drawManager();}catch(error){notice(error.message);save.disabled=false;}});
      manager.append(form);name.focus();
    }
    async function checkUpdate(){const result=await host.updates();const version=result?.[host.product]?.version;if(!version)throw Error('Update information is not available yet. Your installed files were not changed.');const comparison=Q.versionCompare(version,host.version);notice(comparison===null?'Version information could not be compared.':comparison>0?`SLINK ${version} is available. Installed: ${host.version}.`:`SLINK ${host.version} is up to date.`);if(comparison>0&&manager){const url=Q.safeUrl(result[host.product].url);if(url){const a=node('a','Open official download',{href:url,target:'_blank',rel:'noopener noreferrer'});manager.append(a);}}}
    async function refreshInfo(force=false){
      if(!allowed)return;notice('Loading item information…');
      try{const result=await host.info(force);metadata=new Map(Q.catalog(result.catalog).map(x=>[x.id,x]));bonus=Q.bonuses(result.perks);catalogAt=Number(result.catalogAt)||Date.now();profileAt=Number(result.profileAt)||Date.now();bonusAt=Number(result.perksAt)||Date.now();context=result.context||null;notice('Item information loaded.');schedule();}catch(e){notice(e.message||String(e));throw e;}
    }
    function quantity(row){const raw=row.querySelector('.qty,[data-qty],[class*="quantity"]');const text=raw?.dataset.qty||raw?.textContent||row.dataset.qty||row.dataset.quantity;const m=String(text||'').replace(/,/g,'').match(/\d+/);return m?Number(m[0]):null;}
    function readRows(source){
      const out=[];const selectors=source==='inventory'?'li[data-item][data-category],li[data-id][data-category]':'.armoury-tabs .item-list>li,#faction-armoury-tabs ~ .armoury-tabs .item-list>li';
      for(const row of scope?.querySelectorAll(selectors)||[]){
        if(row.closest('.slink-qol')||!row.getClientRects().length)continue;
        const id=String(source==='inventory'?row.dataset.item||row.dataset.id:row.querySelector('[data-itemid]')?.dataset.itemid||row.dataset.itemid||'');if(!/^[1-9]\d*$/.test(id))continue;
        const meta=metadata.get(id),name=meta?.name||row.querySelector('.name .bold,.name-wrap .name,.name,[data-name]')?.textContent?.trim()||'Item '+id;
        const category=String(row.dataset.category||meta?.type||'');
        const usable=/medical|drug|candy|alcohol|energy.?drink|booster|supply.?pack/i.test(category)||/Blood Bag|First Aid Kit|Morphine/.test(name);
        const q=quantity(row),item={...meta,id,name,quantity:q,source,usable,row};item.effect=Q.effect(meta||{name},bonus);out.push(item);
      }
      return out;
    }
    function makeUse(source,id,name){const b=button(name,event=>use(source,id,event),{'data-qol-use':id});b.disabled=busy;return b;}
    function decorate(source,rows){
      for(const item of rows){const row=item.row;if(!config.quickItems)row.querySelector('.slink-qol-add')?.remove();if(config.quickItems&&item.usable&&!row.querySelector('.slink-qol-add')){
        const b=button('☆',()=>mutate(s=>Q.addFavorite(s,{source,id:item.id,name:item.name})),{class:'slink-qol-add','aria-label':'Add '+item.name+' to SLINK quick use',title:'Add to SLINK quick use'});row.querySelector('.name,.name-wrap')?.append(b);
      }
      let info=row.querySelector(':scope > .slink-qol-info');const parts=[];
      if(config.effects&&item.effect)parts.push(item.effect.label);
      if(config.values&&Q.finite(item.price)!==null&&item.quantity!==null)parts.push(`Market estimate $${Math.round(item.price).toLocaleString()} each · $${Math.round(item.price*item.quantity).toLocaleString()} total`);
      if(parts.length){if(!info){info=node('small',undefined,{class:'slink-qol-info'});row.append(info);}const value=parts.join(' · ');if(info.textContent!==value)info.textContent=value;}else info?.remove();
      }
    }
    function tradeValues(){
      if(global.location.pathname!=='/trade.php')return;
      scope=doc.querySelector('.content-wrapper[role="main"],#mainContainer,#mainwrap');if(!scope)return;
      for(const row of scope.querySelectorAll('.cont .color1 .desc > li,.trade-items li[data-item],.trade-items li[data-itemid]')){
        let info=row.querySelector(':scope>.slink-qol-info');if(!config.values){info?.remove();continue;}
        const name=row.querySelector('.name')?.textContent.trim(),id=String(row.dataset.item||row.dataset.itemid||row.querySelector('[data-itemid]')?.dataset.itemid||'');
        const matches=id?[metadata.get(id)].filter(Boolean):[...metadata.values()].filter(x=>x.name===name);
        const item=matches.length===1?matches[0]:null,q=quantity(row);
        if(!item||q===null||Q.finite(item.price)===null){info?.remove();continue;}
        if(!info){info=node('small',undefined,{class:'slink-qol-info'});row.append(info);}const text=`Market estimate: $${Math.round(item.price*q).toLocaleString()} · ${q.toLocaleString()} × $${Math.round(item.price).toLocaleString()}`;if(info.textContent!==text)info.textContent=text;
      }
      observer ||= new MutationObserver(()=>schedule());observer.observe(scope,{childList:true,subtree:true,characterData:true});
    }
    function scan(){
      timer=null;observer?.disconnect();if(!active()||!config.enabled||!['quickItems','effects','values','customLinks'].some(k=>config[k])){cleanNative();return;}
      installStyle();const source=route();if(source!==lastRoute){items.clear();seenAt=0;lastRoute=source;}
      if(config.customLinks&&config.links.length){const target=doc.querySelector('#sidebar')||doc.querySelector('.content-wrapper[role="main"]');if(target){if(!links||!links.isConnected){links=node('nav',undefined,{class:'slink-qol slink-qol-links','aria-label':'SLINK custom links'});target.prepend(links);}links.replaceChildren();for(const l of config.links)links.append(node('a',l.name,{href:l.href,...(l.newTab?{target:'_blank',rel:'noopener noreferrer'}:{})}));}}
      else{links?.remove();links=null;}
      if(!config.quickItems&&!config.effects&&!config.values){tray?.remove();tray=null;scope?.querySelectorAll('.slink-qol-add,.slink-qol-info').forEach(n=>n.remove());return;}
      if(!source){tray?.remove();tray=null;tradeValues();return;}
      scope=source==='inventory'?doc.querySelector('#mainContainer,.content-wrapper[role="main"],#mainwrap'):doc.querySelector('.content-wrapper[role="main"],#mainContainer,#mainwrap');
      if(!scope)return;
      const rows=readRows(source);items=new Map(rows.map(x=>[x.id,x]));seenAt=Date.now();decorate(source,rows);
      // Learn only a displayed own-player blood-type label, never another player's profile.
      if(!config.bloodType){const label=doc.querySelector('#sidebar [title*="Blood type" i],#sidebar [aria-label*="Blood type" i]');const match=(label?.getAttribute('title')||label?.getAttribute('aria-label')||'').match(/blood type\s*:?\s*(AB|A|B|O)\s*([+-])/i);if(match)void mutate(s=>({...s,bloodType:Q.blood(match[1]+match[2])})).catch(e=>notice(e.message));}
      if(config.quickItems){if(!tray||!tray.isConnected){tray=node('section',undefined,{class:'slink-qol','aria-label':'SLINK quick use'});scope.prepend(tray);}tray.replaceChildren(node('strong','Quick use'),node('small',' · One item per click'));
        const wrap=node('div',undefined,{class:'slink-qol-favorites'});for(const f of config.favorites.filter(x=>x.source===source)){const item=items.get(f.id),special=Q.SPECIAL.includes(f.id);const b=makeUse(source,f.id,f.name+(item?.quantity!==null&&item?.quantity!==undefined?' ×'+item.quantity:''));const img=item?.row.querySelector('img');if(img){const icon=img.cloneNode(false);icon.width=24;icon.height=24;icon.alt='';icon.style.verticalAlign='middle';b.prepend(icon);}if(!special&&(!item||!item.usable||!(item.quantity>0)))b.disabled=true;b.title=special?'Uses one selected item per click':item?'Use one '+item.name:'Open the item category to verify availability';wrap.append(b);}tray.append(wrap,node('div',status,{role:'status','aria-live':'polite'}));
      }else{tray?.remove();tray=null;}
      observer ||= new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.slink-qol')&&!r.target.closest?.('.slink-qol-info')&&(r.type==='characterData'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType!==1||!n.matches?.('.slink-qol-add,.slink-qol-info')))))schedule();});
      observer.observe(scope,{childList:true,subtree:true,characterData:true});
    }
    function schedule(){if(!timer&&!stopped)timer=global.setTimeout(scan,120);}
    function cleanNative(){observer?.disconnect();tray?.remove();tray=null;links?.remove();links=null;scope?.querySelectorAll('.slink-qol-add,.slink-qol-info').forEach(n=>n.remove());}
    function readLife(){const el=doc.querySelector('#barLife,[id^="barLife"],[aria-label^="Life:"]');const text=[el?.textContent,el?.getAttribute('title'),el?.getAttribute('aria-label')].join(' ');const m=text.replace(/,/g,'').match(/(\d+)\s*\/\s*(\d+)/);return m&&+m[2]>0?100*(1-+m[1]/+m[2]):null;}
    function currentHospital(){const el=doc.querySelector('#sidebar [title*="Hospital" i] [data-time],#sidebar [data-time][title*="Hospital" i],#sidebar [data-state="hospital"]');const until=Number(el?.dataset.time||el?.dataset.until);if(until>Date.now()/1000)return (until*1000-Date.now())/60000;return null;}
    function medicalSignature(value){return JSON.stringify([value?.life?.current,value?.life?.maximum,value?.status?.state,value?.status?.until]);}
    async function use(source,id,event){if(preparing)return;preparing=true;tray?.querySelectorAll('[data-qol-use]').forEach(b=>b.disabled=true);try{return await performUse(source,id,event);}finally{preparing=false;schedule();}}
    async function performUse(source,id,event){
      if(!event.isTrusted)throw Error('Quick use requires your own click or tap.');
      if(busy||!active()||!config.enabled||!config.quickItems||route()!==source)return;
      const access=await host.load();if(access.allowed===false||!active()||route()!==source)return;
      if(!Q.normalize(access.settings).favorites.some(f=>f.source===source&&f.id===id))throw Error('This shortcut has changed. Reopen Page tools.');
      if(!config.favorites.some(f=>f.source===source&&f.id===id))throw Error('This shortcut is no longer saved.');
      if(['heal-exit','heal-max','blood-heal'].includes(id)&&Date.now()-bonusAt>15*60000){await refreshInfo(false);scan();if(!active()||route()!==source)return;}
      let chosen=items.get(id);const dataAge=Date.now()-bonusAt;
      if(['heal-exit','heal-max'].includes(id)){context=await host.profile(true);profileAt=Date.now();if(!active()||route()!==source)return;}
      if(id==='heal-exit'||id==='heal-max'){
        if(lastMedical&&medicalSignature(context)===lastMedical)throw Error('Torn’s medical status has not caught up with the last use yet. No item used. Wait for the status to update, or choose a specific favorite yourself.');
        const life=context?.life,missingLife=Number(life?.maximum)>0?100*(1-Number(life.current)/Number(life.maximum)):readLife();
        const until=Number(context?.status?.until),hospitalMinutes=context?.status?.state==='Hospital'&&until?Math.max(0,(until*1000-Date.now())/60000):context?.status?.state?0:currentHospital();
        const plan=Q.healPlan([...items.values()],{mode:id,type:config.bloodType,missingLife,hospitalMinutes});if(plan.error)throw Error(plan.error);chosen=plan.item;
      }else if(id==='blood-heal'||id==='blood-hospital'){const picked=Q.chooseBlood([...items.values()],config.bloodType,id==='blood-hospital',source);if(picked.error)throw Error(picked.error);chosen=picked.item;}
      const points=id.startsWith('points-');
      if(points&&(source!=='armory'||!scope?.querySelector('.armoury-points-wrap .give[data-role="refill"]')))throw Error('Open your faction points armory to verify refill access first.');
      if(!points&&(!chosen||!chosen.usable||!(chosen.quantity>0)||Date.now()-seenAt>60000))throw Error('Open the current item category to verify this item and its stock.');
      if(!points&&chosen.effect?.blood){const ok=Q.compatible(chosen.effect.blood,config.bloodType);if(ok===null)throw Error('Set your Torn blood type first.');if(id!=='blood-hospital'&&!ok)throw Error('This blood bag is incompatible. Use the explicitly labeled self-hospital shortcut if that is intended.');}
      if(['heal-exit','heal-max','blood-heal'].includes(id)&&dataAge>15*60000)throw Error('Refresh item information before using a medical shortcut; bonuses may have changed.');
      const token=doc.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('rfc_v='))?.slice(6);if(!token)throw Error('Torn’s action token is unavailable. Reload this page; no item was used.');
      const endpoint=new URL(points?'/factions.php':'/item.php','https://www.torn.com');endpoint.searchParams.set('rfcv',decodeURIComponent(token));
      const body=new URLSearchParams(points?{step:id==='points-energy'?'armouryRefillEnergy':'armouryRefillNerve'}:{step:'useItem',itemID:chosen.id,...(source==='armory'?{fac:'1'}:{id:chosen.id})});
      busy=true;tray?.querySelectorAll('[data-qol-use]').forEach(b=>b.disabled=true);notice('Using '+(points?id:chosen.name)+'…');
      const abort=new AbortController(),timeout=global.setTimeout(()=>abort.abort(),12000);
      try{const response=await global.fetch(endpoint.href,{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:body.toString(),signal:abort.signal});
        const raw=await response.text();let result;try{result=JSON.parse(raw);}catch{throw Error('Torn’s reply could not be read. The action may have completed; check your item list before trying again.');}
        const parsed=new DOMParser().parseFromString(String(result.text||result.message||result.error||''),'text/html').body.textContent;
        if(!response.ok||result.success!==true&&result.success!==1)throw Error(parsed||'Torn did not confirm item use.');
        if(chosen){chosen.quantity=Math.max(0,chosen.quantity-1);const q=chosen.row?.querySelector('.qty');if(q)q.textContent=String(chosen.quantity);}
        // Native bars may not have changed after a direct request: invalidate medical planning until refreshed.
        if(chosen?.effect?.kind==='medical'){lastMedical=context?medicalSignature(context):null;profileAt=0;}
        notice(parsed||'Torn confirmed the action.');
      }catch(error){notice(error.name==='AbortError'?'Torn did not reply in time. The action may have completed; check before trying again.':error.message);}
      finally{global.clearTimeout(timeout);busy=false;schedule();}
    }
    let updateChecked=false;
    async function sync(){try{const result=await host.load();allowed=result.allowed!==false;config=Q.normalize(result.settings);loaded=true;if(!allowed)cleanNative();else if(host.cached){const c=await host.cached();metadata=new Map(Q.catalog(c.catalog).map(x=>[x.id,x]));bonus=Q.bonuses(c.perks);catalogAt=Number(c.catalogAt)||0;profileAt=Number(c.profileAt)||0;bonusAt=Number(c.perksAt)||0;context=c.context||null;}drawManager();schedule();
      if(allowed&&config.enabled&&!updateChecked){updateChecked=true;void host.updates().then(data=>{const release=data?.[host.product];if(Q.versionCompare(release?.version,host.version)>0){notice('SLINK '+release.version+' is available.');const href=Q.safeUrl(release.url);if(href){const update=node('aside',undefined,{class:'slink-qol','aria-label':'SLINK update available'});update.append(node('a','SLINK '+release.version+' available',{href,target:'_blank',rel:'noopener noreferrer'}),button('Dismiss',()=>update.remove()));doc.querySelector('#sidebar')?.prepend(update);}}}).catch(()=>{});}
    }catch(error){allowed=false;cleanNative();if(manager){manager.replaceChildren(node('p','Page tools could not load. Verify access and reopen this tab.'));manager.append(node('div',undefined,{role:'status'}));}notice('Settings could not be loaded: '+error.message);}}
    const wake=()=>{if(!active()){observer?.disconnect();return;}schedule();};
    doc.addEventListener('visibilitychange',wake);global.addEventListener('focus',wake);global.addEventListener('blur',wake);global.addEventListener('hashchange',wake);global.addEventListener('popstate',wake);
    return Object.freeze({sync,refreshInfo,mutate,subscribe(fn){changed.add(fn);return()=>changed.delete(fn);},mount(root){manager=root;installStyle();if(loaded)drawManager();else void sync();},unmount(){manager=null;inputPending=false;},getSettings:()=>config,stop(){stopped=true;observer?.disconnect();global.clearTimeout(timer);cleanNative();style?.remove();doc.removeEventListener('visibilitychange',wake);for(const [name,fn]of [['focus',wake],['blur',wake],['hashchange',wake],['popstate',wake]])global.removeEventListener(name,fn);}});
  }
  global.SLINK_QOL_UI=Object.freeze({create});
})(globalThis);
