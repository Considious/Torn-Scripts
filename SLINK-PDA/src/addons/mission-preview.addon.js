// Objective facts independently summarized from https://wiki.torn.com/wiki/List_of_Duke_Missions
// Native page selectors cross-checked against TornTools; no mission or purchase actions.
(function(g){
  'use strict';
  const guide=new Map([
    ['show some muscle','An attack on the named target is enough; you don’t need to win.'],
    ['battering ram','Attack the named target three times. Wins aren’t required.'],
    ['new kid on the block','Defeat five players; this contract doesn’t specify particular targets.'],
    ['against the odds','Defeat both named targets. The guide lists no weapon restriction.'],
    ['a kimpossible task','Win using only melee and temporary weapons; don’t fire primary or secondary weapons.'],
    ['an honorary degree','Win without doing gun damage. Check the weapon restrictions in your contract.'],
    ['a problem at the tracks','Defeat the three named targets without using guns, including when weakening them beforehand.'],
    ['birthday surprise','Check the exact requested item before buying it; the gift contents can vary.']
  ]);
  const hint=title=>guide.get(String(title??'').trim().replace(/\s*\*\s*$/,'').replace(/\s+/g,' ').toLowerCase())??null;
  const integer=v=>{const s=String(v??'').trim();if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s))return null;const n=Number(s.replaceAll(',',''));return Number.isSafeInteger(n)?n:null;};
  const normalize=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const ammoAwards={
    hollowpoint:['Maimed','hollowammoused'], tracer:['Marked','tracerammoused'],
    piercing:['Penetrated','piercingammoused'], incendiary:['Scorched','incendiaryammoused']
  };
  const sources={
    ammo:'/v2/user/ammo', mods:'/v2/user/itemmods',
    inventory:'/user/?selections=inventory', progress:'/user/?selections=personalstats,honors'
  };
  function parse(raw){
    try{const result=JSON.parse(raw);return result?.basicType?result:null;}catch{return null;}
  }
  function reward(item,prices,account,now){
    const id=integer(item.image),quantity=integer(item.amount);
    const price=item.basicType==='Item'&&id&&quantity?prices.get(id):null;
    const age=now-price?.priceCheckedAt;
    const total=price?.priceAvailable===true&&price.marketPrice>0&&age>=0&&age<=86400000
      ? price.marketPrice*quantity:null;
    let owned=null;
    const progress=[];
    const type=normalize(item.ammoType||item.type);
    const award=Object.hasOwn(ammoAwards,type)?ammoAwards[type]:null;
    function addProgress(label,count,goal){
      if(count!==null&&count<goal)progress.push({label,count,goal});
    }
    if(item.basicType==='Ammo'){
      const caliber=integer(item.weapons?.[0]?.ammoType);
      if(Array.isArray(account.ammo?.ammo)&&caliber!==null){
        const ammo=account.ammo.ammo.find(entry=>integer(entry.id)===caliber);
        const match=ammo?.types?.find(entry=>normalize(entry.name)===type);
        owned=match?integer(match.quantity):0;
      }
      const stats=account.progress?.personalstats;
      const honors=account.progress?.honors;
      const dragon=type==='incendiary'&&/^12gauge/.test(normalize(item.title||item.name));
      if(dragon&&Array.isArray(honors)&&!honors.some(entry=>integer(entry?.id??entry)===951)){
        addProgress('Dragon’s Breath',0,1);
      }
      if(award){
        const special=integer(stats?.specialammoused);
        const tier=[[100,'Surplus'],[1000,'Bandolier'],[10000,'Quartermaster']].find(([goal])=>special!==null&&special<goal);
        if(tier)addProgress(tier[1],special,tier[0]);
        addProgress(award[0],integer(stats?.[award[1]]),2500);
      }
    }else if(item.basicType==='Item'&&id&&Array.isArray(account.inventory?.inventory)){
      owned=account.inventory.inventory.filter(entry=>integer(entry.ID??entry.id)===id)
        .reduce((sum,entry)=>sum+(integer(entry.quantity)??0),0);
    }else if(item.basicType==='Upgrade'&&Array.isArray(account.mods?.itemmods)){
      const name=normalize(item.name||item.title);
      owned=Number(account.mods.itemmods.some(entry=>normalize(entry.name||entry.title)===name));
    }
    return {total:Number.isFinite(total)?total:null,owned,progress};
  }
  g.SLINK_MISSION_PREVIEW=Object.freeze({hint,integer,parse,reward});
  if(!g.document||location.pathname!=='/page.php'||new URLSearchParams(location.search).get('sid')!=='missions')return;
  const ext=g.SLINK_EXTENSION,pda=g.SLINK_PDA_PLUGIN_API;
  const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  const inventoryCache=new Map();
  const offerSelector='ul.rewards-list li[data-ammo-info]';
  let queued=false,prices=new Map(),reading=false,dirty=false;
  const seen=new Set();
  function note(target,kind,text){
    let box=target.querySelector(':scope > [data-slink-mission-note="'+kind+'"]');
    if(!box){
      box=document.createElement(kind==='reward'?'div':'p');box.dataset.slinkMissionNote=kind;
      if(kind==='hint')globalThis.SLINK_TORN_COMPONENTS?.mark(box,'slink-page-note');
      target.append(box);
    }
    seen.add(box);
    if(box.dataset.summary!==text){box.dataset.summary=text;box.textContent=text;}
    return box;
  }
  function paint(){
    queued=false;if(document.visibilityState==='hidden')return;
    seen.clear();
    for(const card of document.querySelectorAll('.giver-cont-wrap > div[id^="mission"]')){
      if(!card.getClientRects().length)continue;
      const heading=card.querySelector('.title-black'),body=card.querySelector('.max-height-fix');
      if(!heading||!body?.getClientRects().length)continue;
      const title=card.dataset.originalTitle||[...heading.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim()||heading.textContent;
      const text=hint(title);
      note(body,'hint',text?'SLINK hint: '+text+' Follow the exact objective Torn shows after acceptance.':'SLINK: No verified hint for this contract yet.');
    }
    const account=Object.fromEntries([...inventoryCache].map(([key,entry])=>[key,entry.data]));
    for(const offer of document.querySelectorAll(offerSelector)){
      if(!offer.getClientRects().length)continue;
      const target=offer.querySelector('.act-wrap'),item=parse(offer.dataset.ammoInfo);
      if(!target||!item)continue;
      const data=reward(item,prices,account,Date.now());
      const parts=[];
      if(data.total!==null&&!offer.querySelector('.tt-mission-reward-total'))parts.push('Value: '+money.format(data.total));
      if(data.owned!==null&&!offer.querySelector('.tt-mission-reward-owned'))parts.push('Owned: '+data.owned.toLocaleString());
      if(!parts.length&&!data.progress.length)continue;
      const box=note(target,'reward',parts.join(' · '));
      const signature=JSON.stringify(data.progress);
      if(box.dataset.progress!==signature||box.querySelectorAll('progress').length!==data.progress.length){
        box.dataset.progress=signature;
        box.textContent=parts.join(' · ');
        for(const {label,count,goal} of data.progress){
          const line=document.createElement('div');
          const bar=document.createElement('progress');
          const labelText=label+' '+count.toLocaleString()+'/'+goal.toLocaleString();
          bar.max=goal;bar.value=count;bar.setAttribute('aria-label',labelText);
          line.append(labelText,bar);box.append(line);
        }
      }
    }
    for(const box of document.querySelectorAll('[data-slink-mission-note]'))if(!seen.has(box))box.remove();
  }
  function schedule(){if(!queued&&document.visibilityState!=='hidden'){queued=true;requestAnimationFrame(paint);}}
  async function refresh(){
    if(document.visibilityState==='hidden')return;
    if(reading){dirty=true;return;}
    reading=true;
    try{
      do{
        dirty=false;
        const items=ext?(await ext.core.storage.get('shared.providers.v1',{}))?.catalog?.items:pda?.missionPrices?.();
        prices=new Map((Array.isArray(items)?items:[]).map(item=>[Number(item.id),item]));
        const needed=new Set();
        for(const offer of document.querySelectorAll(offerSelector)){
          const item=parse(offer.dataset.ammoInfo);
          const own=!offer.querySelector('.tt-mission-reward-owned');
          if(item?.basicType==='Ammo'){
            if(own)needed.add('ammo');
            if(Object.hasOwn(ammoAwards,normalize(item.ammoType||item.type)))needed.add('progress');
          }
          if(own&&item?.basicType==='Upgrade')needed.add('mods');
          if(own&&item?.basicType==='Item')needed.add('inventory');
        }
        await Promise.all([...needed].map(async key=>{
          if(Date.now()-(inventoryCache.get(key)?.at??0)<300000)return;
          const data=await Promise.resolve().then(()=>ext
            ? ext.core.messaging.send('missions.rewardData',{kind:key})
            : pda?.tornJson?.(sources[key],'SLINK PDA Mission Rewards')).catch(()=>null);
          inventoryCache.set(key,{data,at:Date.now()});
        }));
      }while(dirty);
    }catch{prices.clear();}finally{reading=false;schedule();}
  }
  function start(){
    const style=document.createElement('style');
    style.textContent=`
      .rewards-list .act-wrap:has(> [data-slink-mission-note="reward"]){flex-wrap:wrap;height:auto;min-height:0}
      .rewards-list [data-slink-mission-note="reward"]{flex:0 0 100%;clear:both;display:block;padding:2px 5px;font-size:11px;line-height:1.25;overflow-wrap:anywhere}
      .rewards-list [data-slink-mission-note="reward"] progress{display:block;width:100%;height:5px}
    `;
    document.head.append(style);
    const zones='.giver-cont-wrap,.rewards-list';
    const root=document.querySelector('#mainContainer,.content-wrapper[role="main"],#mainwrap')||document.body;
    const relevant=n=>n.nodeType===1&&(n.matches(zones)||n.querySelector(zones));
    new MutationObserver(records=>{
      if(records.some(record=>{
        const target=record.target.nodeType===1?record.target:record.target.parentElement;
        if(target?.closest('[data-slink-mission-note]'))return false;
        if(record.type==='childList'&&[...record.addedNodes,...record.removedNodes].every(n=>n.matches?.('[data-slink-mission-note]')))return false;
        return target?.closest(zones)||record.type==='attributes'&&relevant(target)||
          record.type==='childList'&&[...record.addedNodes,...record.removedNodes].some(relevant);
      })){
        schedule();
        if(records.some(record=>record.attributeName==='data-ammo-info'||[...record.addedNodes].some(n=>relevant(n)||n.matches?.(offerSelector)||n.querySelector?.(offerSelector))))void refresh();
      }
    }).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','style','class','aria-selected','data-ammo-info']});
    g.addEventListener('hashchange',()=>{void refresh();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')void refresh();});
    g.chrome?.storage?.onChanged?.addListener(changes=>{if(ext&&Object.hasOwn(changes,ext.core.storage.fullKey('shared.providers.v1')))void refresh();});
    document.addEventListener('click',event=>{
      if(event.target.closest?.('.rewards-list .btn-rewards-action.yes')){
        inventoryCache.clear();
        setTimeout(()=>void refresh(),1000);
      }
    },true);
    void refresh();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
