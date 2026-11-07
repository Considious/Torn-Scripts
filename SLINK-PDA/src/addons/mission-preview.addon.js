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
  function reward(raw,balance,prices,now){
    let item;try{item=JSON.parse(raw);}catch{return null;}
    const points=integer(item?.points);if(!points)return null;
    const id=integer(item.image),quantity=integer(item.amount);
    const price=item.basicType==='Item'&&id&&quantity?prices.get(id):null;
    const age=now-price?.priceCheckedAt;
    const total=price?.priceAvailable===true&&price.marketPrice>0&&Number.isFinite(price.marketPrice)&&age>=0&&age<=86400000?price.marketPrice*quantity:null;
    return {points,affordable:balance==null?null:balance>=points,total:Number.isFinite(total)?total:null,at:total===null?null:price.priceCheckedAt};
  }
  g.SLINK_MISSION_PREVIEW=Object.freeze({hint,integer,reward});
  if(!g.document||location.pathname!=='/page.php'||new URLSearchParams(location.search).get('sid')!=='missions')return;
  const ext=g.SLINK_EXTENSION,pda=g.SLINK_PDA_PLUGIN_API;
  const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
  let queued=false,prices=new Map(),reading=false,dirty=false;
  const seen=new Set();
  function note(target,kind,text){
    let box=target.querySelector(':scope > [data-slink-mission-note="'+kind+'"]');
    if(!box){
      box=document.createElement('p');box.dataset.slinkMissionNote=kind;
      box.style.cssText='padding:.35rem .5rem;margin:.3rem 0;border-inline-start:3px solid currentColor;overflow-wrap:anywhere';
      target.append(box);
    }
    seen.add(box);
    if(box.textContent!==text)box.textContent=text;
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
    const balanceNode=document.querySelector('.total-mission-points');
    const balance=integer(balanceNode?.textContent);
    for(const offer of document.querySelectorAll('ul.rewards-list li[data-ammo-info]')){
      if(!offer.getClientRects().length)continue;
      const target=offer.querySelector('.act-wrap');if(!target)continue;
      const data=reward(offer.dataset.ammoInfo,balance,prices,Date.now());
      if(!data)continue;
      let text='SLINK · '+data.points.toLocaleString()+' credits';
      if(data.affordable!==null)text+=data.affordable?' · enough credits':' · not enough credits';
      if(data.total!==null)text+=' · estimated market value '+money.format(data.total)+' · '+money.format(data.total/data.points)+' per credit · price checked '+new Date(data.at).toLocaleString();
      else text+=' · no recent comparable market price';
      note(target,'reward',text);
    }
    for(const box of document.querySelectorAll('[data-slink-mission-note]'))if(!seen.has(box))box.remove();
  }
  function schedule(){if(!queued&&document.visibilityState!=='hidden'){queued=true;requestAnimationFrame(paint);}}
  async function refresh(){
    if(reading){dirty=true;return;}
    reading=true;
    try{
      do{
        dirty=false;
        const items=ext?(await ext.core.storage.get('shared.providers.v1',{}))?.catalog?.items:pda?.missionPrices?.();
        prices=new Map((Array.isArray(items)?items:[]).map(item=>[Number(item.id),item]));
      }while(dirty);
    }catch{prices.clear();}finally{reading=false;schedule();}
  }
  function start(){
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','style','class','aria-selected','data-ammo-info']});
    g.addEventListener('hashchange',()=>{void refresh();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')void refresh();});
    g.chrome?.storage?.onChanged?.addListener(changes=>{if(ext&&Object.hasOwn(changes,ext.core.storage.fullKey('shared.providers.v1')))void refresh();});
    void refresh();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
