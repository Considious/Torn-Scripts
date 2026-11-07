(function(g){
  'use strict';
  const p=location.pathname,q=new URLSearchParams(location.search);
  const allowed=()=>p==='/item.php'||p==='/amarket.php'||p==='/factions.php'&&location.hash.includes('tab=armoury')||p==='/page.php'&&q.get('sid')==='ItemMarket';
  if(!['/item.php','/amarket.php','/factions.php','/page.php'].includes(p)||p==='/page.php'&&q.get('sid')!=='ItemMarket')return;
  const model=g.SLINK_WEAPON_MERITS,ext=g.SLINK_EXTENSION,pda=g.SLINK_PDA_PLUGIN_API;
  if(!model||!ext&&!pda)return;
  const selectors={damage:'.bonus-attachment-item-damage-bonus',accuracy:'.bonus-attachment-item-accuracy-bonus'};
  const both=Object.values(selectors).join(',');
  const mark='data-slink-weapon-merit';
  let root,button,notice,observer,snapshot,queued=false,generation=0;
  const added=new Set();
  const storageKey='access.session.v1';
  const own=async()=>{
    if(pda)return String(pda.accountId?.()||'');
    const s=await ext.core.storage.get(storageKey,null);return s?.token&&s.expiresAt>Date.now()?String(s.userId||''):'';
  };
  function itemId(icon){
    for(let n=icon.parentElement,depth=0;n&&n!==root&&depth<8;n=n.parentElement,depth++){
      if(n.querySelectorAll(both).length>2)return '';
      const ids=new Set();
      if(n.matches('li[data-item],li[data-itemid]'))ids.add(n.dataset.item||n.dataset.itemid);
      for(const img of n.querySelectorAll('img[src*="/images/items/"]')){
        const id=img.getAttribute('src').match(/\/images\/items\/(\d+)\//)?.[1];if(id)ids.add(id);
      }
      if(ids.size===1)return [...ids][0];
      if(ids.size>1)return '';
    }
    return '';
  }
  function clear(){for(const n of added)n.remove();added.clear();}
  function draw(){
    queued=false;if(!root?.isConnected||!allowed()||document.hidden||!snapshot)return;
    const next=new Set();
    for(const icon of root.querySelectorAll(both)){
      const base=icon.nextElementSibling;
      if(!base?.matches('span')||Array.from(base.children).some(n=>!n.hasAttribute(mark))||!/^\d+(?:\.\d+)?$/.test(Array.from(base.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()))continue;
      const id=itemId(icon),stat=icon.matches(selectors.damage)?'damage':'accuracy';
      const value=model.suffix(snapshot.levels[snapshot.classes[id]],stat);
      if(!value)continue;
      let label=base.querySelector('['+mark+']');
      if(!label){label=document.createElement('span');label.setAttribute(mark,'');base.append(label);}
      if(label.textContent!==' '+value)label.textContent=' '+value;
      label.title=stat==='damage'?'Weapon mastery merit damage modifier':'Weapon mastery merit accuracy bonus';
      next.add(label);
    }
    for(const n of added)if(!next.has(n))n.remove();
    added.clear();for(const n of next)added.add(n);
  }
  function schedule(){if(!queued&&!document.hidden){queued=true;requestAnimationFrame(draw);}}
  async function load(){
    const revision=++generation;button.disabled=true;notice.textContent='Loading weapon merits…';
    try{
      const owner=await own();if(!owner)throw Error('Verify Access in SLINK first.');
      let value;
      if(pda){
        const cache=pda.cache('weaponMeritCatalogue',{}),fresh=cache.at>Date.now()-86400000&&cache.classes;
        const [perks,catalogue]=await Promise.all([pda.tornJson('/v2/user/perks','SLINK weapon merits'),fresh?null:pda.tornJson('/v2/torn/items?cat=Weapon','SLINK weapon catalogue')]);
        const classes=fresh||model.catalogue(catalogue);if(!Object.keys(classes).length)throw Error('Torn did not return weapon classes.');if(!fresh){cache.classes=classes;cache.at=Date.now();}
        value={levels:model.perks(perks),classes};
      }else value=await ext.core.messaging.send('qol.weaponMerits');
      if(revision!==generation||owner!==await own()||revision!==generation||!allowed())return;
      snapshot={...value,owner};button.textContent='Refresh weapon merits';
      notice.textContent=Object.keys(value.levels).length?'':'No weapon mastery bonuses found.';schedule();
    }catch(e){if(revision===generation){snapshot=null;clear();notice.textContent=e.message||'Could not load weapon merits.';}}
    finally{if(revision===generation&&button)button.disabled=false;}
  }
  function reset(){generation++;snapshot=null;clear();if(button){button.disabled=false;button.textContent='Show weapon merits';notice.textContent='';}}
  function sync(){
    const target=allowed()?(p==='/factions.php'?document.querySelector('#faction-armoury'):document.querySelector('#mainContainer')||document.querySelector('.content-wrapper[role="main"]')):null;
    if(root===target&&button?.isConnected)return;
    observer?.disconnect();const old=button?.parentNode;reset();old?.remove();root=target;button=null;
    if(!root)return;
    const bar=document.createElement('div'),style=document.createElement('style');style.textContent=`[${mark}]{font-size:.76em;font-weight:700;color:#176726;white-space:nowrap} .dark-mode [${mark}]{color:#89e893}`;
    button=document.createElement('button');button.type='button';button.textContent='Show weapon merits';button.onclick=e=>{if(e.isTrusted)void load();};
    notice=document.createElement('span');notice.setAttribute('role','status');notice.style.marginInlineStart='.5em';
    bar.append(button,notice,style);root.prepend(bar);
    observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['src','data-item','data-itemid']});
  }
  function start(){
    new MutationObserver(()=>{if(!button?.isConnected&&allowed())sync();}).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('hashchange',sync);
    window.addEventListener('focus',()=>{if(snapshot)void own().then(owner=>{if(snapshot&&owner!==snapshot.owner)reset();}).catch(reset);});
    if(ext)g.chrome?.storage?.onChanged?.addListener(changes=>{if(Object.hasOwn(changes,ext.core.storage.fullKey(storageKey)))reset();});
    sync();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
