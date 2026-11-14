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
  const path=location.pathname,sid=new URLSearchParams(location.search).get('sid'),attack=path==='/page.php'&&sid==='attack';
  if(!attack&&!['/item.php','/amarket.php','/factions.php'].includes(path)&&!(path==='/page.php'&&sid?.toLowerCase()==='itemmarket'))return;
  const pda=g.SLINK_PDA_PLUGIN_API,ext=g.SLINK_EXTENSION,key='access.session.v1';
  if(!pda&&!ext)return;
  const owner=async()=>{
    if(pda)return String(pda.accountId?.()||'');
    const s=await ext.core.storage.get(key,null);return s?.token&&s.expiresAt>Date.now()?String(s.userId||''):'';
  };
  const attackSlot=':is([id="weapon_main"],[id="weapon_second"],[id="weapon_melee"],[id="weapon_temp"])[aria-describedby*="attacker_"]';
  const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const itemId=row=>[row.dataset.item,row.dataset.itemid,row.dataset.id,
    ...Array.from(row.querySelectorAll('img'),img=>[img.getAttribute('src'),img.getAttribute('srcset'),img.currentSrc].join(' ').match(/\/images\/items\/(\d+)\//)?.[1])
  ].map(Number).find(id=>Number.isSafeInteger(id)&&id>0)||'';
  const regularRows='ul.item-list > li,li[data-item],li[data-itemid],li[data-id][data-category],[data-testid="item"],li[id]:has(.item-plate)';
  const nativeBonus=':is(.bonuses .bonus,.iconBonuses___sb7SH,[class*="iconBonuses___"],.iconsbonuses) [class*="bonus-attachment-"][title]';
  let mounted,queued=false;
  function mount(root){
    const box=make('div'),load=make('button','Show weapon XP'),toggle=make('button','Explain special bonuses'),status=make('span');
    load.type=toggle.type='button';status.setAttribute('role','status');status.style.marginInlineStart='.4em';
    globalThis.SLINK_TORN_COMPONENTS?.card(box);box.classList.add('slink-page-toolbar');
    box.append(make('strong','Weapon experience'),status,...(attack?[]:[toggle]),load);root.prepend(box);
    const itemsRoot=path==='/item.php'?(root.closest('#mainContainer,.content-wrapper[role="main"],#mainwrap')||root):root;
    let cache=null,show=false,seq=0,seen=new Map();
    function clear(){for(const n of seen.values())n.remove();seen.clear();}
    function update(){
      if(document.hidden||!cache&&!show)return;
      const current=new Set();
      const rows=itemsRoot.querySelectorAll(attack?attackSlot:regularRows);
      for(const row of rows){
        const id=itemId(row);
        if(!id||!attack&&row.querySelector(regularRows))continue;
        const xp=cache?xpText(cache.values[id]):'';
        const bonuses=show?[...new Set(Array.from(row.querySelectorAll(nativeBonus),icon=>bonusText(icon.getAttribute('title'))).filter(Boolean))]:[];
        if(!xp&&!bonuses.length)continue;
        current.add(row);
        let note=seen.get(row);
        if(!note?.isConnected){
          note=make('div');note.dataset.slinkWeaponDetails='';if(!attack)globalThis.SLINK_TORN_COMPONENTS?.mark(note,'slink-page-note');note.style.cssText='font-size:.8em;line-height:1.2;white-space:normal;overflow-wrap:anywhere';
          if(attack)note.style.pointerEvents='none';
          const itemName=path==='/item.php'?row.querySelector('.name-wrap .name,.name-wrap,.name'):null;
          (itemName||row).append(note);seen.set(row,note);
        }
        const signature=JSON.stringify([xp,bonuses]);
        if(note.dataset.signature===signature)continue;note.dataset.signature=signature;
        note.title=attack?xp:'';
        note.replaceChildren(...(xp?[make('div',attack?'XP '+cache.values[id]+'%':xp)]:[]),...bonuses.map(text=>make('div',text)));
      }
      for(const [row,note] of seen)if(!current.has(row)){note.remove();seen.delete(row);}
      if(cache&&Object.keys(cache.values).length)status.textContent=seen.size?'':'No matching weapons in this view. Open a weapon category.';
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
        const still=await owner();if(run!==seq||!box.isConnected)return;
        if(id!==still){reset();return;}
        if(pdaCache&&pdaCache.values!==result){Object.assign(pdaCache,{owner:id,at:Date.now(),values:result});pda.persist?.();}
        cache={owner:id,values:result,at:Date.now()};load.textContent='Retry weapon XP';
        status.textContent=Object.keys(result).length?'':'Torn didn’t return any weapon experience. It unlocks with Combat Training education.';
        update();
      }catch(error){if(run===seq){cache=null;clear();update();load.hidden=false;load.textContent='Retry weapon XP';status.textContent=error.message||'Could not load weapon experience.';}}
      finally{if(run===seq)load.disabled=false;}
    }
    load.hidden=true;load.onclick=loadExperience;
    toggle.setAttribute('aria-pressed','false');
    toggle.onclick=()=>{show=!show;toggle.setAttribute('aria-pressed',String(show));toggle.textContent=show?'Hide bonus explanations':'Explain special bonuses';if(!show&&!cache)clear();else update();};
    const obs=new MutationObserver(records=>{if((cache||show)&&records.some(r=>!box.contains(r.target)&&!r.target.closest?.('[data-slink-weapon-details]')))schedule();});
    obs.observe(itemsRoot,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','title','aria-describedby','data-item','data-itemid','data-id']});
    void loadExperience();
    return {root,box,update,reset,auto(){if((!cache&&!status.textContent)||(cache&&Date.now()-cache.at>=21600000))void loadExperience();},check(){if(cache)void owner().then(id=>{if(cache&&cache.owner!==id){reset();void loadExperience();}}).catch(reset);},dispose(){seq++;obs.disconnect();clear();box.remove();}};
  }
  function sync(){
    queued=false;if(document.hidden)return;
    const root=attack?document.querySelector('#attack-root'):path==='/factions.php'?(location.hash.includes('tab=armoury')?document.querySelector('#faction-armoury'):null):document.querySelector('#mainContainer')||document.querySelector('.content-wrapper[role="main"]');
    if(root&&mounted?.root===root&&mounted.box.isConnected){mounted.update();mounted.auto();return;}
    mounted?.dispose();mounted=root?mount(root):null;
  }
  function schedule(){if(!queued&&!document.hidden){queued=true;requestAnimationFrame(sync);}}
  function start(){
    new MutationObserver(()=>{if(!mounted?.box.isConnected&&(path!=='/factions.php'||location.hash.includes('tab=armoury')))schedule();}).observe(document.body,{subtree:true,childList:true});
    window.addEventListener('hashchange',schedule);window.addEventListener('focus',()=>{mounted?.check();schedule();});
    document.addEventListener('visibilitychange',schedule);
    if(ext)g.chrome?.storage?.onChanged?.addListener(changes=>{if(Object.hasOwn(changes,ext.core.storage.fullKey(key))){mounted?.reset();mounted?.auto();}});
    sync();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
