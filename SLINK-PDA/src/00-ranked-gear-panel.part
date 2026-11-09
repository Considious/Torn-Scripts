(function(g){
 'use strict';
 const endpoint='https://slink-ranked-gear-preview.richard-johnson554.workers.dev';
 const key='slink.ranked-gear.preview.v1',seenKey=key+'.seen';
 const panels=new WeakMap(), ttl=300000;
 const read=(name,fallback)=>{try{return JSON.parse(g.localStorage.getItem(name))??fallback;}catch{return fallback;}};
 const write=(name,data)=>{try{g.localStorage.setItem(name,JSON.stringify(data));return true;}catch{return false;}};
 const dollars=n=>Number.isFinite(n)?'$'+Math.round(n).toLocaleString():'Unavailable';
 const perkKey=values=>values.map(([name,value])=>JSON.stringify([String(name).trim().toLowerCase(),value])).sort().join('|');
 const marketPerkIds=new Map(Object.entries({
  achilles:50,assassinate:72,backstab:52,berserk:54,bleed:57,blindfire:33,blindside:51,bloodlust:85,
  burn:30,comeback:67,conserve:55,cripple:45,crusher:49,cupid:47,deadeye:63,deadly:62,demoralize:36,
  disarm:86,doubletap:105,doubleedged:74,empower:87,eviscerate:56,execute:75,finale:82,focus:79,
  freeze:38,frenzy:80,fury:64,grace:53,hazardous:34,homerun:83,irradiate:102,lacerate:89,motivation:61,
  paralyze:59,parry:84,penetrate:101,plunder:21,poison:32,powerful:68,proficience:14,puncture:66,
  quicken:88,rage:65,revitalize:41,roshambo:43,shock:120,slow:44,smash:104,smurf:73,specialist:71,
  spray:35,stricken:20,stun:58,suppress:60,sureshot:78,throttle:48,toxin:103,warlord:81,weaken:46,
  windup:76,wither:42
 }));
 function itemMarketSearchLink(x){
  const category=new Map([['melee','Melee'],['primary','Primary'],['secondary','Secondary'],['armor','Defensive'],['defensive','Defensive']]).get(x.category);
  if(x.source!=='item_market'||!category||!Number.isSafeInteger(x.itemId)||x.itemId<1||!Number.isSafeInteger(x.price)||x.price<1||!/^\d{1,24}$/.test(String(x.uid??'')))return null;
  const u=new URL('https://www.torn.com/page.php?sid=ItemMarket');
  u.searchParams.set('slinkRankedMarket',x.itemId+'-'+x.uid);
  const filters=new URLSearchParams({view:'category',categoryName:category,sortField:'price',sortOrder:'ASC',priceFrom:String(Math.max(1,x.price-1)),priceTo:String(x.price+1)});
  if(category==='Defensive'){
   // Use only set slugs confirmed in Torn's own search URLs.
   if(/^riot\b/i.test(x.itemName??''))filters.set('armourySet','riot');
   if(Number.isFinite(x.armor)&&x.armor>0){
    filters.set('armorFrom',String(Math.floor(x.armor)));
    filters.set('armorTo',String(Math.ceil(x.armor)));
   }
  }else{
   const ids=[...new Set((Array.isArray(x.bonuses)?x.bonuses:[]).map(b=>marketPerkIds.get(String(b?.name??'').toLowerCase().replace(/[^a-z]/g,''))).filter(Boolean))];
   ids.slice(0,2).forEach((id,i)=>filters.set('bonuses['+i+']',String(id)));
  }
  u.hash='/market/'+filters;
  return u.href;
 }
 function highlightMarketInfo(doc,href){
  const u=new URL(href);
  const target=u.searchParams.get('slinkRankedMarket');
  const match=u.pathname==='/page.php'&&u.searchParams.get('sid')==='ItemMarket'&&/^\d{1,12}-\d{1,24}$/.test(target??'')?doc.getElementById('wai-itemInfo-'+target):null;
  for(const panel of doc.querySelectorAll('[data-slink-ranked-market-info]'))if(panel!==match)panel.removeAttribute('data-slink-ranked-market-info');
  if(match&&!match.hasAttribute('data-slink-ranked-market-info'))match.setAttribute('data-slink-ranked-market-info','');
 }
 function bazaarLink(x){
  if(x.source!=='bazaar'||!Number.isSafeInteger(x.sellerId)||x.sellerId<1||!Number.isSafeInteger(x.itemId)||x.itemId<1||!Number.isSafeInteger(x.price)||x.price<1||!['yellow','orange','red'].includes(x.rarity)||![1,2].includes(x.bonuses?.length)||!x.bonuses.every(b=>b.name&&Number.isFinite(b.value))||![x.damage,x.accuracy].every(Number.isFinite))return null;
  const u=new URL('https://www.torn.com/bazaar.php');
  u.searchParams.set('userId',x.sellerId);
  const uid=String(x.uid??'');
  if(!/^\d{1,24}$/.test(uid))return null;
  u.searchParams.set('slinkRanked',JSON.stringify([x.itemId,x.price,x.rarity,x.damage,x.accuracy,perkKey(x.bonuses.map(b=>[b.name,b.value])),uid]));
  return u.href;
 }
 function highlightBazaar(cards,{itemId,price,available},href){
  const raw=new URL(href).searchParams.get('slinkRanked');
  let target;try{if(raw&&raw.length<1024)target=JSON.parse(raw);}catch{}
  const matches=Array.isArray(target)&&target.length===7&&typeof target[6]==='string'&&/^\d{1,24}$/.test(target[6])?[...cards].filter(card=>{
   if(itemId(card)!==target[0]||price(card)!==target[1]||!available(card)||!['yellow','orange','red'].includes(target[2])||!card.querySelector('img.glow-'+target[2]))return false;
   const stat=kind=>Number(card.querySelector('[area-label="'+kind+'"]')?.nextElementSibling?.textContent.trim()||NaN);
   if(stat('damage')!==target[3]||stat('accuracy')!==target[4])return false;
   const bonuses=[...card.querySelectorAll('[data-bonus-attachment-title][data-bonus-attachment-description]')];
   if(![1,2].includes(bonuses.length))return false;
   const pairs=bonuses.map(el=>[el.dataset.bonusAttachmentTitle,el.dataset.bonusAttachmentDescription.match(/^\s*(\d+(?:\.\d+)?)\s*%/)?.[1]]);
   return pairs.every(([name,value])=>name&&value!=null)&&perkKey(pairs.map(([name,value])=>[name,Number(value)]))===target[5];
  }):[];
  const match=matches.length===1?matches[0]:null;
  for(const card of cards){
   if(card===match){if(card.getAttribute('data-slink-ranked-bazaar-match')!==target[6])card.setAttribute('data-slink-ranked-bazaar-match',target[6]);}
   else card.removeAttribute('data-slink-ranked-bazaar-match');
  }
 }
 function rankedConfirmationMatches(wrapper,flow){
  if(flow?.quantity!==1||!Number.isSafeInteger(flow.itemId)||!Number.isSafeInteger(flow.price)||flow.price<=0||!/^\d{1,24}$/.test(flow.rankedUid??''))return false;
  const id='buy-confirmation-msg-'+flow.itemId+'-'+flow.rankedUid;
  const message=wrapper?.querySelector('[id="'+id+'"]');
  if(!message||wrapper.querySelector('button[aria-label="Yes"]')?.getAttribute('aria-labelledby')!==id)return false;
  const qty=message.querySelector('[class*="name___"]')?.textContent.match(/^\s*Buy\s+(\d+)\s*[x×]\s/i)?.[1];
  const total=message.querySelector('[class*="sum___"]')?.textContent.trim();
  return qty==='1'&&/^\$\d[\d,]*$/.test(total??'')&&Number(total.slice(1).replaceAll(',',''))===flow.price;
 }
 function newMatch(previous,price){return Number.isFinite(price)&&price>0&&(!Number.isFinite(previous)||price<=previous*.95);}
 function mount(root,{request=defaultRequest}={}){
  if(!root)return;
  let panel=panels.get(root);
  if(panel){if(panel.parentNode!==root)root.prepend(panel);return;}
  const d=root.ownerDocument;
  const add=(parent,tag,text)=>{const e=d.createElement(tag);if(text!=null)e.textContent=text;parent.append(e);return e;};
  panel=d.createElement('details');panel.className='card full';panel.dataset.slinkRankedGear='';panels.set(root,panel);root.prepend(panel);
  add(panel,'summary','Ranked Gear');
  const intro=add(panel,'p','Completed Torn sales and Weaver’s observed asking prices are separate. Bunker value is a scrap equivalent, not a sale estimate.');
  intro.className='muted';
  const nav=add(panel,'div');nav.className='target-actions';
  const history=add(panel,'section'),watch=add(panel,'section');watch.hidden=true;
  for(const [label,active] of [['Price Checker',history],['Bunker Watch',watch]]){
   const button=add(nav,'button',label);button.type='button';button.setAttribute('aria-pressed',String(!active.hidden));
   button.addEventListener('click',()=>{history.hidden=active!==history;watch.hidden=active!==watch;for(const b of nav.children)b.setAttribute('aria-pressed',String(b===button));});
  }
  const field=(form,name,label,type='text')=>{
   const wrap=add(form,'label',label+' ');wrap.style.display='block';
   const input=add(wrap,'input');input.name=name;input.type=type;if(type==='number'){input.min='0';input.step='any';}return input;
  };
  function status(container){const out=add(container,'div');out.setAttribute('role','status');return out;}
  function action(form,label){const button=add(form,'button',label);button.type='submit';return button;}
  const historyForm=add(history,'form');
  for(const [n,label] of [['item','Exact item name'],['category','Category'],['rarity','Rarity'],['weaponClass','Weapon class'],['bonus1','Bonus 1'],['bonus2','Bonus 2']])field(historyForm,n,label);
  const advanced=add(historyForm,'details');add(advanced,'summary','Value, stats and date filters');
  for(const [n,label] of [['Bonus1','Bonus 1'],['Bonus2','Bonus 2'],['Quality','Quality'],['Damage','Damage'],['Accuracy','Accuracy'],['Armor','Armor']])for(const [prefix,desc] of [['min','Minimum'],['max','Maximum']])field(advanced,prefix+n,desc+' '+label,'number');
  field(advanced,'minDate','From date','date');field(advanced,'maxDate','Through date','date');
  const find=action(historyForm,'Search completed sales'),historyOut=status(history);
  historyForm.addEventListener('submit',async e=>{
   e.preventDefault();const qs=new URLSearchParams();
   for(const [n,value] of new FormData(historyForm))if(String(value).trim()){
    let v=String(value).trim();if(n.endsWith('Date'))v=String(Date.parse(v+'T00:00:00Z')/1000+(n==='maxDate'?86399:0));
    if(['rarity','category','weaponClass'].includes(n))v=v.toLowerCase();qs.set(n,v);
   }
   if(!qs.size){historyOut.textContent='Choose at least one gear filter.';return;}
   find.disabled=true;historyOut.textContent='Searching completed sales…';
   try{
    const result=await request('/api/ranked/history?'+qs);historyOut.replaceChildren();
    const s=result.summary;
    add(historyOut,'p',s.count?'Median '+dollars(s.median)+' · '+s.count.toLocaleString()+' comparable sales':'No matching completed sales in the archive.');
    if(s.count)add(historyOut,'p','25–75%: '+dollars(s.p25)+' – '+dollars(s.p75)+' · Average '+dollars(s.average)+' · Trimmed average '+dollars(s.trimmedAverage)+' · Range '+dollars(s.min)+' – '+dollars(s.max)+' · Recent median '+dollars(s.recentMedian));
    add(historyOut,'p',result.source+(result.indexedThrough?' · Indexed through '+new Date(result.indexedThrough*1000).toLocaleDateString():' · Archive not seeded yet'));
    const sort=add(historyOut,'select');sort.setAttribute('aria-label','Sort recent completed sales');
    for(const [v,t] of [['date','Newest'],['price','Highest sale price']])add(sort,'option',t).value=v;
    const sales=add(historyOut,'div');
    const draw=()=>{sales.replaceChildren();const rows=[...result.rows];if(sort.value==='price')rows.sort((a,b)=>b.sale_price-a.sale_price);for(const x of rows){
     const card=add(sales,'article');card.className='target-card';
     add(card,'strong',x.item_name+' · '+dollars(x.sale_price));add(card,'p',[new Date(x.ended_at*1000).toLocaleDateString(),x.rarity,x.bonus_1&&[x.bonus_1,x.bonus_1_value].filter(v=>v!=null).join(' '),x.bonus_2&&[x.bonus_2,x.bonus_2_value].filter(v=>v!=null).join(' '),...[['Quality',x.quality],['Damage',x.damage],['Accuracy',x.accuracy],['Armor',x.armor]].filter(([,v])=>v!=null).map(([k,v])=>k+' '+v)].filter(Boolean).join(' · '));
     const manual=read(key,{}).rate,rate=manual>0?manual:result.quote?.rate;
     if(x.bb)add(card,'small','Bunker scrap: '+x.bb+' BB'+(rate>0?' · '+dollars(x.bb*rate)+' ('+(manual>0?'manual rate':'Small Arms Cache ask ÷ 20')+')':' · cash rate unavailable'));
    }};
    sort.addEventListener('change',draw);draw();
   }catch(err){historyOut.textContent=err.message||'Historical service unavailable.';}finally{find.disabled=false;}
  });
  const watchForm=add(watch,'form'), config=read(key,{});
  const groups={};
  const groupLabels={small:'Small weapons (Pistols / SMGs)',melee:'Melee',long:'Rifles / Shotguns',heavy:'Machine Guns / Heavy Artillery',armor:'Armor',1:'1 perk',2:'2 perks'};
  for(const [name,title,values] of [['groups','Gear to watch',['small','melee','long','heavy','armor']],['rarities','Rarity',['yellow','orange','red']],['perkCounts','Perks',[1,2]]]){
   const box=add(watchForm,'fieldset');add(box,'legend',title);groups[name]=values.map(value=>{
    const l=add(box,'label');const i=add(l,'input');i.type='checkbox';i.checked=config[name]?.includes(value)??true;l.append(' '+(name==='rarities'?value:groupLabels[value])+' ');return [value,i];
   });
  }
  for(const [n,label] of [['maxPercent','Maximum % of bunker value'],['maxPrice','Your maximum spend'],['minBB','Minimum Bunker Bucks'],['minDiscount','Minimum discount %'],['minBonus','Minimum bonus value'],['rate','Manual $ / BB (blank uses Small Arms Cache ÷ 20)']]){
   const i=field(watchForm,n,label,'number');i.value=config[n]??(n==='maxPercent'?90:'');
  }
  field(watchForm,'bonus','Required bonus').value=config.bonus??'';
  const scan=action(watchForm,'Save and check watch'),liveOut=status(watch);
  let lastScan=0,pending=false,active=!!config.enabled;
  async function poll(){
   if(!active||pending||!panel.isConnected||!panel.getClientRects().length||!panel.open||watch.hidden||d.hidden||Date.now()-lastScan<ttl)return;
   pending=true;lastScan=Date.now();scan.disabled=true;liveOut.textContent='Checking the shared Weaver snapshot…';
   try{
    const rule=read(key,{}),result=await request('/api/ranked/watch',{rules:[{...rule,id:'ranked-default'}],rate:rule.rate||null});
    if(!active||!panel.isConnected)return;
    liveOut.replaceChildren();
    add(liveOut,'p',result.source+' · observed '+new Date(result.observedAt).toLocaleString()+' · '+dollars(result.rate)+' / BB ('+result.rateSource+')'+(result.complete?'':' · Partial listing coverage'));
    const seen=read(seenKey,{}), now=Date.now();let fresh=0;
    for(const m of result.matches){
     const x=m.row,k=String(x.uid),previous=Object.hasOwn(seen,k)?seen[k]:null;
     const isNew=newMatch(previous?.price,x.price);
     if(isNew){fresh++;Object.defineProperty(seen,k,{value:{price:x.price,at:now},enumerable:true,configurable:true,writable:true});}
     const card=add(liveOut,'article');card.className='target-card';card.style.borderInlineStart='3px solid '+({yellow:'#d9ad30',orange:'#e47826',red:'#dc4353'}[x.rarity]||'currentColor');add(card,'strong',(isNew?'New deal · ':'')+x.itemName+' · '+x.rarity+' · '+x.bonuses.length+' perk'+(x.bonuses.length===1?'':'s'));
     add(card,'p',m.bb+' BB · '+dollars(x.price)+' ask · '+dollars(m.bunkerValue)+' bunker value · '+m.percent.toFixed(1)+'%'+(x.source?' · '+x.source:''));
     if(x.bonuses?.length)add(card,'p',x.bonuses.map(b=>b.name+(b.value==null?'':' '+b.value+'%')).join(' · '));
     if(typeof x.updatedAt==='string'&&Number.isFinite(Date.parse(x.updatedAt)))add(card,'small','Listing last updated '+new Date(x.updatedAt).toLocaleString());
     try{const ranked=bazaarLink(x),market=itemMarketSearchLink(x),u=new URL(ranked||market||x.link);if(u.origin==='https://www.torn.com'&&!u.username&&!u.password){const a=add(card,'a',ranked?'Find matching roll in bazaar':market?'Find candidates in Item Market':'View observed listing');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}}catch{}
    }
    write(seenKey,Object.fromEntries(Object.entries(seen).filter(([,v])=>now-v.at<30*86400000).sort((a,b)=>b[1].at-a[1].at).slice(0,500)));
    if(fresh)add(liveOut,'p',fresh+' new Bunker Watch match'+(fresh===1?'':'es')+'.');
    if(!result.matches.length)add(liveOut,'p','No matching deals in the current snapshot.');
   }catch(err){liveOut.textContent=err.message||'Live listings are unavailable. Historical pricing is independent.';}
   finally{pending=false;scan.disabled=false;}
  }
  watchForm.addEventListener('submit',e=>{
   e.preventDefault();const input=Object.fromEntries(new FormData(watchForm));
   const rule={enabled:true,bonus:String(input.bonus).trim().slice(0,120)};
   for(const n of ['maxPercent','maxPrice','minBB','minDiscount','minBonus','rate'])rule[n]=Number(input[n])||0;
   for(const [k,choices] of Object.entries(groups))rule[k]=choices.filter(([,i])=>i.checked).map(([v])=>v);
   if(!rule.groups.length||!rule.rarities.length||!rule.perkCounts.length||!(rule.maxPercent>0&&rule.maxPercent<=100)){liveOut.textContent='Select gear, rarity, and perk count, and enter a threshold from 1 to 100%.';return;}
   if(!write(key,rule)){liveOut.textContent='Watch could not be saved.';return;}
   active=true;lastScan=0;void poll();
  });
  const stop=add(watch,'button','Pause watch');stop.type='button';stop.addEventListener('click',()=>{active=false;write(key,{...read(key,{}),enabled:false});liveOut.textContent='Watch paused.';});
  // A shared worker refreshes upstream data; this panel only checks while visible.
  const timer=g.setInterval(()=>{if(!panel.isConnected){if(!root.isConnected)g.clearInterval(timer);return;}void poll();},ttl);
 }
 async function defaultRequest(path,body){
  let response;try{response=await g.fetch(endpoint+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw Error('The Ranked Gear preview worker is not reachable.');}
  const value=await response.json();if(!response.ok)throw Error(value?.error||'Ranked Gear preview unavailable.');return value;
 }
 g.SLINK_RANKED_GEAR=Object.freeze({mount,newMatch,bazaarLink,highlightBazaar,rankedConfirmationMatches,itemMarketSearchLink,highlightMarketInfo});
})(globalThis);
