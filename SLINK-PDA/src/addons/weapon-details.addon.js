(function(g){
  'use strict';
  function experience(body){
    if(!Array.isArray(body?.weaponexp))throw Error('Torn did not return weapon experience.');
    return Object.fromEntries(body.weaponexp.filter(r=>Number.isSafeInteger(r?.id)&&r.id>0&&Number.isInteger(r.exp)&&r.exp>=0&&r.exp<=100).map(r=>[r.id,r.exp]));
  }
  const xpText=x=>Number.isInteger(x)&&x>=0&&x<=100?`XP ${x}% · +${(x/10).toFixed(1)}% damage · +${(x/50).toFixed(2)} accuracy`:'';
  function bonusText(raw){
    const clean=String(raw??'').replace(/<br\s*\/?\s*>/gi,' — ').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,420);
    return clean.includes(' — ')?clean:'';
  }
  g.SLINK_WEAPON_DETAILS=Object.freeze({experience,xpText,bonusText});
  if(!g.document)return;
  const path=location.pathname,sid=new URLSearchParams(location.search).get('sid')?.toLowerCase(),attack=path==='/page.php'&&sid==='attack';
  const market=['/amarket.php','/bazaar.php'].includes(path)||path==='/page.php'&&['itemmarket','bazaar'].includes(sid);
  if(!attack&&!market&&!['/item.php','/factions.php'].includes(path))return;
  const pda=g.SLINK_PDA_PLUGIN_API,ext=g.SLINK_EXTENSION,key='access.session.v1';
  if(!pda&&!ext)return;
  const inlineOnly=market||attack;
  const owner=async()=>{
    if(pda)return String(pda.accountId?.()||'');
    const s=await ext.core.storage.get(key,null);return s?.token&&s.expiresAt>Date.now()?String(s.userId||''):'';
  };
  const attackSlot=':is([id="weapon_main"],[id="weapon_second"],[id="weapon_melee"],[id="weapon_temp"])[aria-describedby*="attacker_"]';
  const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const itemId=row=>[row.dataset.item,row.dataset.itemid,
    ...Array.from(row.querySelectorAll('img'),img=>[img.getAttribute('src'),img.getAttribute('srcset'),img.currentSrc].join(' ').match(/\/images\/items\/(\d+)\//)?.[1]),
    row.dataset.id
  ].map(Number).find(id=>Number.isSafeInteger(id)&&id>0)||'';
  const regularRows='ul.item-list > li,li[data-item]:not([data-action]),li[data-itemid]:not([data-action]),li[data-id][data-category],li[id]:has(.item-plate),[data-testid="item"]';
  const statIcons='.bonus-attachment-item-damage-bonus,.bonus-attachment-item-accuracy-bonus';
  const nativeBonus='[data-bonus-attachment-title],.bonuses .bonus:not([data-attachments-itemid])[title],.bonuses .bonus:not([data-attachments-itemid]) [title],.iconsbonuses [class*="bonus-attachment-"][title]';
  const ui=g.SLINK_TORN_COMPONENTS;
  if(market&&!ui?.marketWeaponStat)return;
  function rankedBonus(icon){
    if(icon.matches('[class*="bonus-attachment-item-"]'))return null;
    const name=icon.getAttribute('data-bonus-attachment-title')?.trim();
    if(icon.closest('[data-attachments-itemid]'))return null;
    const description=icon.getAttribute('data-bonus-attachment-description')?.trim();
    const parts=bonusText(icon.getAttribute('title')).split(' — ');
    const label=(name||parts.shift())?.slice(0,100);
    const info=(description||parts.join(' — ')).slice(0,350);
    if(!label||!info)return null;
    const magnitude=info.match(/^[+-]?\d+(?:\.\d+)?\s*%/)?.[0];
    return {text:label+(magnitude?' '+magnitude:''),info};
  }
  let mounted,queued=false;
  function mount(root,anchor){
    const box=make('div'),load=make('button','Show weapon XP'),toggle=make('input'),status=make('span');
    load.type='button';toggle.type='checkbox';toggle.checked=true;status.setAttribute('role','status');status.style.marginInlineStart='.4em';
    ui?.mark(box,'slink-page-ui','slink-page-toolbar');box.dataset.slinkWeaponPerksToolbar='';
    if(!inlineOnly){
      const label=make('label');label.append(make('span','Show ranked perks'),toggle);ui?.switchRow(label,toggle);box.append(label);
      if(anchor)anchor.before(box);else root.prepend(box);
    }
    const itemsRoot=path==='/item.php'?(root.closest('#mainContainer,.content-wrapper[role="main"],#mainwrap')||root):root;
    let cache=null,show=true,seq=0,seen=new Map(),addedXP=new Set();
    function clearXP(){for(const n of addedXP)ui?.clearWeaponStat(n);addedXP.clear();}
    function clear(){clearXP();for(const n of seen.values())n.remove();seen.clear();}
    function update(){
      if(document.hidden)return;
      const current=new Set(),nextXP=new Set();
      const selector=attack?attackSlot:market?ui.marketWeaponRows:regularRows;
      const rows=itemsRoot.querySelectorAll(selector);
      const displayed=new Map();
      for(const row of rows){
        const id=market?ui.marketWeaponId(row):itemId(row);
        if(!attack&&row.querySelector(selector))continue;
        const xp=cache?.values[id]??0;
        if(Number.isInteger(xp)&&xp>0&&xp<=100){
          const icons=attack?[]:market?['damage','accuracy']:row.querySelectorAll(statIcons);
          let found=false;
          for(const icon of icons){
            const damage=market?icon==='damage':icon.matches('.bonus-attachment-item-damage-bonus');
            const value=damage?'+'+Number((xp/10).toFixed(1))+'%':'+'+Number((xp/50).toFixed(2));
            const title='Weapon experience '+xp+'%: '+value+' '+(damage?'damage':'accuracy');
            const label=market?ui.marketWeaponStat(row,icon,'xp',value,title):ui?.weaponStat(icon,'xp',value,title);
            if(label){nextXP.add(label);found=true;}
          }
          if(found&&path==='/item.php'){
            const name=(row.querySelector('.name-wrap .name,.title-wrap .name,[data-testid="name"]')?.textContent||row.querySelector('img[alt]')?.alt||'Item '+id).trim();
            const equipped=row.dataset.equipped==='true';
            if(!displayed.has(id)||equipped)displayed.set(id,{name,xp,equipped});
          }
        }
        const bonuses=show&&!attack?[...new Map(Array.from(row.querySelectorAll(nativeBonus),rankedBonus).filter(Boolean).map(b=>[b.text+'|'+b.info,b])).values()]:[];
        const xpFallback=attack&&xp>0?xpText(xp):'';
        if(!xpFallback&&!bonuses.length)continue;
        current.add(row);
        let note=seen.get(row);
        if(!note?.isConnected){
          note=make('div');note.dataset.slinkWeaponDetails='';if(!attack)ui?.mark(note,'slink-page-note');
          note.style.cssText='font-size:.82em;line-height:1.2;white-space:normal;overflow-wrap:anywhere;clear:both;max-inline-size:100%';
          if(attack){note.style.pointerEvents='none';note.style.fontSize='min(.82em,10px)';note.style.lineHeight='1.1';}
          const itemName=market?row.querySelector('[data-testid="description"]'):null;
          const detail=path==='/item.php'?row.querySelector(':scope > .view-item-info'):null;
          if(detail)detail.before(note);else (itemName||row).append(note);seen.set(row,note);
        }
        const signature=JSON.stringify([xpFallback,bonuses]);
        if(note.dataset.signature===signature)continue;note.dataset.signature=signature;
        note.title=xpFallback;
        note.replaceChildren(...(xpFallback?[make('span','XP '+xp+'% · Dmg +'+Number((xp/10).toFixed(1))+'% · Acc +'+Number((xp/50).toFixed(2)))]:[]),...bonuses.flatMap((bonus,i)=>{
          const badge=make('span',bonus.text);
          badge.title=bonus.info;badge.setAttribute('aria-label',bonus.text+': '+bonus.info);
          return i?[document.createTextNode(' · '),badge]:[badge];
        }));
      }
      for(const n of addedXP)if(!nextXP.has(n))ui?.clearWeaponStat(n);
      addedXP=nextXP;
      for(const [row,note] of seen)if(!current.has(row)){note.remove();seen.delete(row);}
      const list=[...displayed.values()].sort((a,b)=>Number(b.equipped)-Number(a.equipped));
      const message=path==='/item.php'?(list.length?list.slice(0,5).map(v=>v.name+' '+v.xp+'%').join(' · ')+(list.length>5?' · +'+(list.length-5)+' more':''):'No weapons with earned experience in this view.'):'';

      if(cache&&Object.keys(cache.values).length&&status.textContent!==message)status.textContent=message;
    }
    function reset(){seq++;cache=null;load.disabled=false;load.hidden=true;load.textContent='Retry weapon XP';status.textContent='';clear();update();}
    async function loadExperience(e){
      if((e&&!e.isTrusted)||load.disabled||document.hidden||!document.hasFocus())return;
      load.hidden=true;
      load.disabled=true;status.textContent='Loading weapon XP…';const run=++seq;
      try{
        const id=await owner();if(!id)throw Error('Verify Access in SLINK first.');
        const pdaCache=pda?.cache('weaponXpSnapshot',{});
        const result=pda ? (pdaCache.owner===id&&pdaCache.at>Date.now()-21600000&&pdaCache.values
          ? pdaCache.values : experience(await pda.tornJson('/v2/user/weaponexp','SLINK weapon XP')))
          : await ext.core.messaging.send('qol.weaponExperience');
        const still=await owner();if(run!==seq||!root.isConnected||!inlineOnly&&!box.isConnected)return;
        if(id!==still){reset();return;}
        if(pdaCache&&pdaCache.values!==result){Object.assign(pdaCache,{owner:id,at:Date.now(),values:result});pda.persist?.();}
        cache={owner:id,values:result,at:Date.now()};load.textContent='Retry weapon XP';
        status.textContent=Object.keys(result).length?'':'Torn didn’t return any weapon experience. It unlocks with Combat Training education.';
        update();
      }catch(error){if(run===seq){cache=null;clearXP();load.hidden=false;load.textContent='Retry weapon XP';status.textContent=error.message||'Could not load weapon experience.';}}
      finally{if(run===seq)load.disabled=false;}
    }
    load.hidden=true;load.onclick=loadExperience;
    toggle.onchange=()=>{show=toggle.checked;update();};
    const obs=new MutationObserver(records=>{if((cache||show)&&records.some(r=>!box.contains(r.target)&&!r.target.closest?.('[data-slink-weapon-details]')))schedule();});
    obs.observe(itemsRoot,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','title','aria-describedby','data-item','data-itemid','data-id','data-bonus-attachment-title','data-bonus-attachment-description','aria-label']});
    function auto(){
      if(market&&!root.querySelector(ui.marketStats))return;
      if((!cache&&!status.textContent)||(cache&&Date.now()-cache.at>=21600000))void loadExperience();
    }
    update();auto();
    return {root,box,update,reset,auto,check(){if(cache)void owner().then(id=>{if(cache&&cache.owner!==id){reset();void loadExperience();}}).catch(reset);},dispose(){seq++;obs.disconnect();clear();box.remove();}};
  }
  function sync(){
    queued=false;if(document.hidden)return;
    const anchor=attack?null:path==='/factions.php'?(location.hash.includes('tab=armoury')?document.querySelector('#faction-armoury > hr'):null):path==='/item.php'?document.querySelector('.equipped-items-wrap'):null;
    const candidate=market?(document.querySelector('#mainContainer,.content-wrapper[role="main"],#mainwrap')||document.body):attack?document.querySelector('#attack-root:has('+attackSlot+')'):anchor?.parentElement;
    const root=market?candidate:candidate?.getClientRects().length&&!candidate.matches('#mainContainer,#mainwrap')&&['block','flow-root'].includes(getComputedStyle(candidate).display)?candidate:null;
    if(root&&mounted?.root===root&&(inlineOnly||mounted.box.isConnected)){mounted.update();mounted.auto();return;}
    mounted?.dispose();mounted=root?mount(root,anchor):null;
  }
  function schedule(){if(!queued&&!document.hidden){queued=true;requestAnimationFrame(sync);}}
  function start(){
    new MutationObserver(()=>{if((!mounted?.root.isConnected||!inlineOnly&&!mounted.box.isConnected)&&(path!=='/factions.php'||location.hash.includes('tab=armoury')))schedule();}).observe(document.body,{subtree:true,childList:true});
    window.addEventListener('hashchange',schedule);window.addEventListener('focus',()=>{mounted?.check();schedule();});
    document.addEventListener('visibilitychange',schedule);
    if(ext)g.chrome?.storage?.onChanged?.addListener(changes=>{if(Object.hasOwn(changes,ext.core.storage.fullKey(key))){mounted?.reset();mounted?.auto();}});
    sync();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
