/* Travel Run submits at most one matching native transaction per trusted press. */
(function (g) {
  'use strict';
  const key = 'slink.travel-run.plan.v1', runKey = key + '.progress';
  const fallbackLabels = { hospital: 'Self-hospitalize', heal: 'Heal out', home: 'Return to Torn', profitable: 'Buy a profitable alternative' };
  function plan(input = {}) {
    input=input&&typeof input==='object'?input:{};
    const clean = value => String(value ?? '').trim().slice(0, 80);
    const seen = new Set();
    const buys = (Array.isArray(input.buys) ? input.buys : []).map(clean).filter(name => {
      const lower = name.toLowerCase();
      if (!lower || seen.has(lower)) return false;
      seen.add(lower);
      return true;
    }).slice(0, 12);
    const optional = value => value === '' || value == null || !Number.isFinite(Number(value)) || Number(value)<0 ? null : Math.floor(Number(value));
    return { sell: clean(input.sell), buys, fallback: Object.hasOwn(fallbackLabels, input.fallback) ? input.fallback : 'home',
      destination:clean(input.destination),capacity:optional(input.capacity),cash:optional(input.cash),
      itemIds:(Array.isArray(input.itemIds)?input.itemIds:[]).map(Number).filter(id=>Number.isSafeInteger(id)&&id>0).slice(0,12),
      sellMode:['all','selected'].includes(input.sellMode)?input.sellMode:input.sell?'selected':'off',
      sellIds:(Array.isArray(input.sellIds)?input.sellIds:[]).map(Number).filter(id=>Number.isSafeInteger(id)&&id>0),
      hospitalId:optional(input.hospitalId),healId:optional(input.healId),
      buyMax:input.buyMax!==false,buyAmount:Math.max(1,optional(input.buyAmount)??1),
      travelMethod:['standard','airstrip','private','business'].includes(input.travelMethod)?input.travelMethod:'',
      departAt:optional(input.departAt),shoppingMinutes:Math.min(240,optional(input.shoppingMinutes)??10),
      nextTrips:(Array.isArray(input.nextTrips)?input.nextTrips:[]).map(clean).filter(Boolean).slice(0,3) };
  }
  function steps(value) {
    return [
      ...(value.sell ? [{ type: 'sell', item: value.sell, label: 'Sell ' + value.sell }] : []),
      ...value.buys.map(name => ({ type: 'buy', item: name, label: 'Buy ' + name })),
      ...(value.fallback !== 'home' ? [{ type: value.fallback, label: fallbackLabels[value.fallback] }] : []),
      { type: 'home', label: fallbackLabels.home }
    ];
  }
  function advance(queue, index, result) {
    const current = queue[index];
    if (!current) return index;
    if (result === 'done' || (result === 'unavailable' && ['sell', 'buy', 'hospital', 'heal'].includes(current.type))) return index + 1;
    return index;
  }
  const norm = text => String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const one = nodes => nodes.length === 1 ? nodes[0] : null;
  const visible = node => node && node.isConnected && node.getClientRects().length > 0 && !node.closest('[hidden],[inert],[aria-hidden="true"]') &&
    !['hidden','collapse'].includes(node.ownerDocument.defaultView.getComputedStyle(node).visibility);
  const usable = node => visible(node)&&!node.disabled&&node.getAttribute('aria-disabled')!=='true'&&!node.matches('.disabled,[class*="disabled___"]');
  const query = (root, selector) => [...(root?.querySelectorAll(selector)||[])].filter(usable);
  const number = value => {const raw=String(value??'').replace(/[$,\s]/g,'');return /^\d+(?:\.\d+)?$/.test(raw)?Number(raw):null;};
  const textControl = control => norm(control.getAttribute('aria-label')||control.value||control.textContent);
  const maxControl = root => one(query(root,'button,input[type="button"],[role="button"]').filter(node=>/^(?:max(?:imum)?(?:\s*\(\d+\))?|click here to add the maximum amount(?:[ .:]\s*\d+|, or use shortcuts like .+)?)$/.test(textControl(node))));
  const quantityField = root => one(query(root,'input:not([type="hidden"]):not([type="button"]):not([type="submit"])').filter(input=>
    !input.readOnly&&(input.type==='number'||/amount|quantity|\bqty\b/i.test([input.name,input.placeholder,input.getAttribute('aria-label')].join(' '))||input.dataset.inputMoneyVisible==='true')));
  function itemName(row) {
    const explicit=row.getAttribute('data-item-name')||row.querySelector('[data-item-name]')?.getAttribute('data-item-name');
    return norm(explicit||row.querySelector('button[aria-controls$="-itemInfoWrapper"],[class*="itemName___"],[class*="name___"],h3,h4')?.textContent||row.querySelector('img[alt]')?.alt);
  }
  function shopRows(root) {
    const rows=new Map();
    for(const control of [...root.querySelectorAll('button,input[type="button"],input[type="submit"],a[aria-controls]')].filter(visible)){
      if(!/^(?:buy|purchase)(?:\b|$)/.test(textControl(control)))continue;
      const row=control.closest('[data-item-id],[data-item-name],[class*="row___"],li[class*="item"],article');
      if(!row||!itemName(row)||rows.has(row))continue;
      const form=control.form&&row.contains(control.form)?control.form:row.querySelector('form');
      const quantity=quantityField(form||row),id=row.dataset.itemId||/item-(\d+)/.exec(control.getAttribute('aria-controls')||form?.id||'')?.[1]||null;
      const stockLabel=one([...row.querySelectorAll('[class*="srOnly___"]')].filter(label=>norm(label.textContent)==='stock'));
      const stockText=stockLabel?.parentElement?.textContent.slice(stockLabel.textContent.length);
      const stock=number(row.getAttribute('data-stock')??row.querySelector('[data-stock]')?.getAttribute('data-stock')??row.querySelector('[class*="stock___"],[class*="quantity___"]')?.textContent??stockText);
      const cost=number(row.getAttribute('data-price')??row.querySelector('[data-price]')?.getAttribute('data-price')??row.querySelector('[class*="displayPrice___"],[class*="price___"],[class*="cost___"]')?.textContent);
      rows.set(row,{row,control,form,quantity,item:itemName(row),itemName:row.dataset.itemName||
        row.querySelector('button[aria-controls$="-itemInfoWrapper"],[class*="itemName___"],[class*="name___"],h3,h4')?.textContent?.trim()||
        row.querySelector('img[alt]')?.alt||itemName(row),itemId:id,stock,cost});
    }
    // Disabled or sold-out cards still matter when explaining the next priority.
    for(const row of root.querySelectorAll('[data-item-name],[data-item-id]')){
      if(rows.has(row)||!usable(row)||!itemName(row))continue;
      const stock=number(row.getAttribute('data-stock'));
      if(stock===0||/sold out|out of stock/i.test(row.textContent))rows.set(row,{row,item:itemName(row),itemId:row.dataset.itemId,stock:0,cost:number(row.dataset.price)});
    }
    return [...rows.values()];
  }
  function nativeConstraints(root) {
    const capacityNode=root.querySelector('[data-carry-capacity],[aria-label^="Carrying capacity"],[aria-label^="Available carrying capacity"]');
    let capacity=null;
    if(capacityNode?.hasAttribute('data-carry-capacity')){const max=number(capacityNode.getAttribute('data-carry-capacity')),used=number(capacityNode.getAttribute('data-carry-used'));if(max!==null&&used!==null)capacity=Math.max(0,max-used);}
    const label=capacityNode?.getAttribute('aria-label')||'';
    if(capacity===null){const count=/^Carrying capacity:?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i.exec(label),free=/^Available carrying capacity:?\s*(\d+)/i.exec(label);if(count)capacity=Math.max(0,Number(count[2])-Number(count[1]));else if(free)capacity=Number(free[1]);}
    const cashNode=root.querySelector('[data-cash]')||root.ownerDocument.getElementById('user-money');
    const cash=number(cashNode?.getAttribute('data-cash')??cashNode?.getAttribute('data-money'));
    return {capacity,cash};
  }
  function purchaseLimit(row, limits={}) {
    const bounds=[row.stock,number(row.quantity?.max),limits.capacity,limits.cash!==null&&limits.cash!==undefined&&row.cost>0?Math.floor(limits.cash/row.cost):null].filter(value=>value!==null&&value!==undefined);
    return bounds.length?Math.max(0,Math.floor(Math.min(...bounds))):null;
  }
  function purchaseQuantity(row, limits, options) {
    const limit = purchaseLimit(row, limits);
    if (options.buyMax) return limit;
    return limit === null ? options.buyAmount : Math.min(limit, options.buyAmount);
  }
  function inventoryItems(root) {
    const inventory=root.querySelector('ul[class*="inventoryPanel___"],[aria-label^="Inventory "],[data-travel-inventory]');
    if(!inventory)return [];
    return query(inventory,'button[aria-expanded],button[aria-selected]').flatMap(control=>{
      const slot=control.closest('li,[data-item-id]')||control.parentElement;
      const image=control.querySelector('img.torn-item[alt]');
      const imageId=/^\/images\/items\/(\d+)\//.exec(image?.getAttribute('src')||'')?.[1];
      const id=Number(control.dataset.itemId||slot.dataset.itemId||imageId);
      const item=control.dataset.itemName||image?.alt||(control.parentElement===slot?slot.dataset.itemName:null);
      const expanded=control.getAttribute('aria-expanded')==='true';
      const visibleSale=expanded&&one(query(slot,'[class*="panel___"] [role="group"] button[type="button"]').filter(button=>textControl(button)==='sell'));
      const eligible=(control.dataset.sellable||slot.dataset.sellable)==='true'||!!visibleSale;
      return Number.isSafeInteger(id)&&id>0&&item?[{itemId:id,item,slot,control,eligible}]:[];
    });
  }
  function inventorySelection(root,current) {
    const inventory=root.querySelector('ul[class*="inventoryPanel___"],[aria-label^="Inventory "],[data-travel-inventory]');
    if(!inventory)return null;
    const slots=current.itemId!=null?inventoryItems(root).filter(row=>shopItem(row,current)).map(row=>row.control):query(inventory,'button[aria-expanded],button[aria-selected]').filter(button=>norm(button.querySelector('img[alt]')?.alt||button.dataset.itemName||button.getAttribute('aria-label')?.replace(/ slot \d+$/i,''))===norm(current.item));
    const selected=slots.filter(button=>button.getAttribute('aria-expanded')==='true'||button.getAttribute('aria-selected')==='true');
    return selected.length>1?null:{inventory,slot:selected[0]?.parentElement,control:selected[0]||slots[0],selected:!!selected.length};
  }
  function nativeConfirmation(root,current,amount) {
    if(current.type==='buy'){
      const row=one(shopRows(root).filter(row=>shopItem(row,current)));
      const id=row?.control?.getAttribute('aria-controls');
      if(id!=='item-'+current.itemId+'-buyPanel')return null;
      const panel=root.ownerDocument.getElementById(id);
      const question=norm(panel?.querySelector('p[class*="confirmQuestion___"]')?.textContent);
      const match=/^buy ([\d,]+)\s*[x×]\s*(.+?) for \$([\d,]+)\?$/.exec(question);
      if(!match||number(match[1])!==amount||norm(match[2])!==norm(current.item)||
          row.cost===null||number(match[3])!==amount*row.cost)return null;
      return one(query(panel,'button[type="button"]').filter(button=>textControl(button)==='yes'));
    }
    const selection=inventorySelection(root,current);
    if(!selection?.selected)return null;
    return one(query(selection.slot,'[class*="confirmQuestion___"] form button[type="submit"][aria-describedby]').filter(button=>{
      const question=button.ownerDocument.getElementById(button.getAttribute('aria-describedby'));
      if(textControl(button)!=='yes'||!button.closest('[class*="confirmQuestion___"]')?.contains(question))return false;
      const text=norm(question.textContent),name=norm(question.querySelector('strong')?.textContent);
      return name===norm(current.item)&&(current.type==='sell'?text.startsWith('sell '):text.startsWith('would you like to use '));
    }));
  }
  function nativeAction(root, current, maxSet, limits={}, options={buyMax:true}) {
    if(current.type==='hospital'||current.type==='heal'){
      const selected=inventorySelection(root,current);
      if(!selected?.control)return null;
      if(!selected.selected)return {control:selected.control,kind:'open',label:'Select '+current.item};
      const control=one(query(selected.slot,'[class*="panel___"] [role="group"] button[type="button"]').filter(button=>
        ['use','use '+norm(current.item)].includes(textControl(button))));
      return control&&{control,kind:'transaction',label:current.label};
    }
    if(current.type==='home'){
      const control=one(query(root,'a.travel-home-header-button[aria-expanded="false"],a[aria-controls="travel-home-panel"][aria-expanded="false"],button[aria-controls="travel-home-panel"][aria-expanded="false"]'));
      return control&&{control,kind:'open',label:'Return Home'};
    }
    if(current.type==='sell'){
      const selected=inventorySelection(root,current);if(!selected?.control)return null;
      if(!selected.selected)return {control:selected.control,kind:'open',label:'Select '+current.item+' to sell'};
      const panel=selected.slot.querySelector('[class*="panel___"],[role="region"],form');if(!panel)return null;
      const sell=one(query(panel,'button[type="button"],[role="tab"]').filter(button=>textControl(button)==='sell'));
      if(sell&&sell.getAttribute('aria-current')!=='true'&&sell.getAttribute('aria-selected')!=='true'&&!quantityField(panel))return {control:sell,kind:'transaction',label:'Sell '+current.item};
      const quantity=quantityField(panel),control=quantity&&!maxSet.has(quantity)&&maxControl(quantity.form||panel);
      return control?{control,quantity,kind:'max',label:'Set maximum sale quantity'}:null;
    }
    if(current.type==='buy'){
      const row=one(shopRows(root).filter(row=>shopItem(row,current)));if(!row?.control||row.stock===0||!row.quantity&&!usable(row.control))return null;
      const limit=purchaseQuantity(row,limits,options);if(limit===0)return null;
      if(row.quantity&&limit!==null&&number(row.quantity.value)!==limit&&row.control.getAttribute('aria-expanded')==='false'&&row.control.hasAttribute('aria-controls')){
        return {control:row.control,quantity:row.quantity,limit,kind:'transaction',label:'Buy '+current.item};
      }
      if(row.quantity&&!maxSet.has(row.quantity)){
        const control=maxControl(row.form||row.row);
        if(control&&options.buyMax)return {control,quantity:row.quantity,limit,kind:'max',label:'Set maximum quantity for '+current.item};
        if(limit!==null&&number(row.quantity.value)!==limit)return {control:row.quantity,quantity:row.quantity,limit,kind:'quantity',label:'Prepare quantity for '+current.item};
      }
      // Only delegate an explicit panel opener. A submit-only Buy stays native.
      if(usable(row.control)&&row.control.getAttribute('aria-expanded')==='false'&&row.control.hasAttribute('aria-controls'))return {control:row.control,kind:'transaction',label:'Buy '+current.item};
    }
    return null;
  }
  function feedbackNodes(root) {return [...new Set([...query(root,'[role="status"],[role="alert"],[data-result],[class*="success"],[class*="error"]'),...query(root.ownerDocument,'[role="alert"]')])];}
  function feedbackOutcome(node,current) {
    const text=norm(node.textContent),item=norm(current.item);
    if(!item||!text.includes(item))return null;
    if(/\b(?:failed|unable|cannot|not enough|insufficient|sold out|out of stock|unsuccessful)\b/.test(text))return {result:'failed'};
    const verb=current.type==='buy'?'(?:bought|purchased)':'sold';
    if(!new RegExp('\\b'+verb+'\\b').test(text))return null;
    const escaped=item.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const quantity=new RegExp('\\b'+verb+'\\s+(?:([\\d,]+)\\s*(?:x|×)?\\s*)?'+escaped+'(?=$|[.!,:;]|\\s+(?:for|at|to|from)\\b)').exec(text);
    if(!quantity&&norm(node.getAttribute('data-item-name'))!==item)return null;
    const count=number(node.getAttribute('data-quantity'))??number(quantity?.[1]);
    return count===0?null:{result:'done',quantity:count};
  }
  function medicalOptions(items,qol,bloodType){
    const hospital=[],heal=[];
    for(const item of items){
      const name=norm(item.item);
      if(/^ipecac(?: syrup)?$/.test(name)){hospital.push(item);continue;}
      if(/^(morphine|first aid kit)$/.test(name)){heal.push(item);continue;}
      const type=qol?.effect({name:item.item})?.blood;
      if(!type||!bloodType)continue;
      const compatible=qol.compatible(type,bloodType);
      if(compatible===true)heal.push(item);
      if(compatible===false)hospital.push(item);
    }
    return {hospital,heal};
  }
  function shopItem(row, current) {
    return current.itemId != null ? Number(row.itemId) === Number(current.itemId) : norm(row.item) === norm(current.item);
  }
  function preferredItems(value, snapshot) {
    if (value.itemIds.length) return value.itemIds.map(id => ({
      itemId:id,
      item:snapshot.catalog?.items?.find(item=>Number(item.id)===id)?.name ||
        snapshot.rows?.find(row=>Number(row.itemId)===id)?.itemName || 'Item '+id
    }));
    return value.buys.map(item=>({item}));
  }
  function chooseShopping(value, snapshot, rows, completed, limits, now=Date.now()) {
    const bought = completed.filter(row=>row.type==='buy'&&row.result==='done');
    const remaining = preferredItems(value,snapshot).filter(item=>!bought.some(row=>shopItem(row,item)));
    if (limits.capacity===0 || !remaining.length || bought.some(row=>row.alternative)) return {type:'home',label:'Return Home'};
    let uncertain = false,unaffordable=false;
    for (const item of remaining) {
      const row = one(rows.filter(row=>shopItem(row,item)));
      if (!row || row.stock===null) {uncertain=true;continue;}
      if (row.stock===0) continue;
      if (!row.control || row.control.disabled&&!row.quantity) {uncertain=true;continue;}
      if (purchaseLimit(row,limits)===0){unaffordable=true;continue;}
      return {...item,item:row.itemName||item.item,type:'buy',label:'Buy '+(row.itemName||item.item)};
    }
    if (uncertain) return {type:'blocked',label:'Check Torn shop',reason:'Travel Run cannot verify stock for every remaining preferred item.'};
    if (bought.length || value.fallback==='home') return {type:'home',label:'Return Home'};
    if (value.fallback==='profitable') {
      const candidates=rows.flatMap(row=>{
        const resale=priceFor(snapshot,row.itemId,now);
        const quantity=purchaseQuantity(row,limits,value);
        if (!row.itemId||!row.control||!row.cost||!row.stock||!resale.fresh||quantity<=0||
            limits.cash===null||limits.capacity===null||resale.price<=row.cost) return [];
        return [{...row,profit:(resale.price-row.cost)*quantity}];
      }).sort((a,b)=>b.profit-a.profit||Number(a.itemId)-Number(b.itemId));
      const best=candidates[0];
      return best?{type:'buy',itemId:best.itemId,item:best.itemName,label:'Buy '+best.itemName,alternative:true,profit:best.profit}:
        {type:'home',label:'Return Home',reason:'No profitable alternative could be identified using current pricing.'};
    }
    return unaffordable?{type:'home',label:'Return Home',reason:'Available preferred items do not fit the current cash or quantity limits.'}:
      {type:'hospital',label:'Self-Hospitalize'};
  }
  function countryFor(snapshot,value) {
    return (snapshot.countries||[]).find(country=>norm(country.code)===norm(value)||norm(country.name)===norm(value))||null;
  }
  function priceFor(snapshot,id,now) {
    const item=(snapshot.catalog?.items||[]).find(item=>Number(item.id)===Number(id));
    const price=number(item?.marketPrice??snapshot.marketPrices?.[id]);
    const at=Number(item?.priceCheckedAt||snapshot.catalog?.pricesAt||snapshot.marketPricesFetchedAt)||0;
    return {price,at,fresh:price!==null&&at>0&&at<=now+300000&&now-at<=86400000};
  }
  function travelPlanning(value,snapshot={},now=Date.now()) {
    const method=value.travelMethod||snapshot.settings?.travelMethod||'standard',departAt=value.departAt??now;
    const destinations=(snapshot.countries||[]).map(country=>{
      const minutes=number(country.travelTimes?.[method]??(method==='standard'?country.minutes:null));
      let capacity=value.capacity,cash=value.cash,totalCost=0,totalProfit=0,hasTotal=false;
      const items=preferredItems(value,snapshot).map(({item:name},priority)=>{
        const row=(snapshot.rows||[]).find(row=>norm(row.countryCode)===norm(country.code)&&(value.itemIds[priority]?Number(row.itemId)===value.itemIds[priority]:norm(row.itemName)===norm(name)));
        const sources=Object.entries(row?.sources||{}).filter(([provider,source])=>provider!=='droqs'&&source&&number(source.cost)!==null&&Number(source.updatedAt)>0&&Number(source.updatedAt)<=now+300000).sort((a,b)=>Number(b[1].updatedAt)-Number(a[1].updatedAt));
        const [provider,source]=sources[0]||[];
        const cost=source?number(source.cost):null,stock=source?number(source.quantity):null,at=Number(source?.updatedAt)||0;
        const fresh=at>0&&now-at<=15*60000,resale=priceFor(snapshot,row?.itemId,now);
        const bounds=[stock,capacity,cash!==null&&cost>0?Math.floor(cash/cost):null].filter(v=>v!==null);
        const quantity=fresh&&stock!==null&&capacity!==null&&bounds.length?Math.max(0,Math.floor(Math.min(...bounds))):null;
        const unitProfit=fresh&&cost!==null&&resale.fresh?resale.price-cost:null;
        const purchaseCost=quantity!==null&&cost!==null?quantity*cost:null,profit=quantity!==null&&unitProfit!==null?quantity*unitProfit:null;
        if(quantity!==null){if(capacity!==null)capacity-=quantity;if(cash!==null&&purchaseCost!==null)cash-=purchaseCost;}
        if(purchaseCost!==null)totalCost+=purchaseCost;if(profit!==null){totalProfit+=profit;hasTotal=true;}
        return {name,priority,provider,at,fresh,stock,cost,resale:resale.price,resaleFresh:resale.fresh,unitProfit,quantity,purchaseCost,profit,nextRestockAt:Number(row?.nextRestockAt)>now?Number(row.nextRestockAt):null,predictionSource:row?.predictionSource||''};
      });
      const fits=item=>value.capacity!==0&&(value.cash===null||item.cost===null||value.cash>=item.cost);
      const available=items.filter(item=>item.fresh&&item.stock>0&&item.quantity!==0&&fits(item)),restocks=items.filter(item=>item.fresh&&item.nextRestockAt&&fits(item));
      return {country,items,minutes,departAt,arrivalAt:minutes===null?null:departAt+minutes*60000,returnAt:minutes===null?null:departAt+(minutes*2+value.shoppingMinutes)*60000,totalCost,totalProfit:hasTotal?totalProfit:null,remainingCapacity:capacity,
        priority:available.length?Math.min(...available.map(item=>item.priority)):restocks.length?Math.min(...restocks.map(item=>item.priority)):Infinity,available:available.length,restockOptions:restocks.length};
    });
    const recommendations=destinations.filter(row=>row.available||row.restockOptions).sort((a,b)=>Number(!a.available)-Number(!b.available)||a.priority-b.priority||b.available-a.available||(b.totalProfit??-Infinity)-(a.totalProfit??-Infinity)||(a.minutes??Infinity)-(b.minutes??Infinity)).slice(0,3);
    return {selected:destinations.find(row=>norm(row.country.code)===norm(value.destination)||norm(row.country.name)===norm(value.destination))||null,recommendations,method,
      constraintsBlocked:destinations.some(row=>row.items.some(item=>item.fresh&&item.stock>0&&(item.quantity===0||value.cash!==null&&item.cost>value.cash)))};
  }
  if (typeof module === 'object' && module.exports) module.exports = { plan, steps, advance, nativeAction, nativeConfirmation, shopRows, nativeConstraints, purchaseLimit, purchaseQuantity, chooseShopping, preferredItems, medicalOptions, feedbackOutcome, travelPlanning };
  const d = g.document, loc = g.location;
  if (!d || !loc || g.__slinkTravelRunInstalled || g.top !== g.self ||
      !(loc.pathname === '/travelagency.php' || (loc.pathname === '/page.php' && ['travel', 'travelAgency', 'travelagency'].includes(new URLSearchParams(loc.search).get('sid'))))) return;
  g.__slinkTravelRunInstalled = true;
  function read(storage, name) { try { return JSON.parse(g[storage].getItem(name)); } catch { return null; } }
  function write(storage, name, value) {
    try { g[storage].setItem(name, JSON.stringify(value)); return true; } catch { return false; }
  }
  let value = plan(read('localStorage', key) || {});
  const progress = read('sessionStorage', runKey);
  let samePlan=false;try{samePlan=!!progress&&JSON.stringify(plan(JSON.parse(progress.plan)))===JSON.stringify(value);}catch{}
  let index = samePlan ? progress.index : null;
  let completed=samePlan&&Array.isArray(progress.completed)?progress.completed:[],runId=samePlan&&progress.runId||String(Date.now()),pending=null;
  let shopStatus=samePlan?progress.shopStatus||'':'',unresolved=samePlan?progress.unresolved||null:null;
  const saveProgress = () => write('sessionStorage', runKey, { plan: JSON.stringify(value), index, completed,runId,shopStatus,unresolved });
  if (!Number.isInteger(index) || index < 0 || index > steps(value).length) index = null;
  let host, refresh,observeRoot;
  const emptySnapshot={countries:[],rows:[]};
  function mount() {
    const app = d.getElementById('travel-root')||d.getElementById('travelagency-root')||d.querySelector('[data-travel-root]');
    const root = app || d.querySelector('a.travel-home-header-button[aria-controls="travel-home-panel"],ul[class*="inventoryPanel___"][aria-label^="Inventory "]')
      ?.closest('main,[role="main"],.content-wrapper');
    if (!root) return;
    if (host?.parentNode === root) { refresh?.(); return; }
    if (host) { pending=null;root.prepend(host);observeRoot?.(root);refresh?.(); return; }
    host = d.createElement('div');
    host.id = 'slink-travel-run';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{display:block;min-width:0;max-width:100%}form,label{display:grid;gap:5px}form{margin-top:8px;max-width:700px}textarea{resize:vertical}
      .planning-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr));gap:8px}.travel-hint{font-size:.92em;opacity:.85}.travel-progress{padding-left:20px}.travel-progress li{margin:4px 0}#planning-results article{border:1px solid var(--slink-border,var(--s-border,#7778));border-radius:6px;padding:8px;margin:8px 0}#planning-results p{margin:5px 0}.travel-error{color:var(--slink-error,var(--s-danger,inherit))}
      </style><section class="slink-page-ui slink-page-card">
      <button id="compact" type="button" aria-expanded="true" aria-controls="run-details">Collapse</button><div id="run-details"><h3>Travel Run</h3><section id="plan-panel" aria-label="Travel Run configuration" hidden>
      <form><label>Sell inventory first<select name="sellMode"><option value="off">Off</option><option value="all">All eligible items</option><option value="selected">Selected items</option></select></label>
      <label id="sell-picker" hidden>Items to sell<select name="sellIds" multiple></select></label>
      <label>Destination<select name="country"></select></label>
      <label>Find items<input id="find-item" type="search" placeholder="Search foreign shop items"></label>
      <div id="priorities" class="planning-fields"></div>
      <button type="button" id="add-priority">Add item priority</button>
      <p id="compatibility" role="status"></p>
      <div id="purchase-prices" aria-label="Cached purchase prices"></div>
      <div class="planning-fields"><label><span><input name="buyMax" type="checkbox"> Buy Max</span></label>
      <label>Buy Amount<input name="buyAmount" type="number" min="1" step="1" required></label></div>
      <label>If nothing can be bought<select name="fallback"><option value="home">Return to Torn</option><option value="hospital">Hospitalize and wait for restock</option><option value="profitable">Buy a profitable item and return</option></select></label>
      <div id="medical-options" class="planning-fields" hidden><label>Self-hospitalization item<select name="hospitalId"></select></label>
      <label>Leave-hospital item<select name="healId"></select></label><p id="medical-status" role="status"></p></div>
      <details id="planner"><summary>Trip estimates</summary><p class="travel-hint">Uses existing Abroad Stocks snapshots, not a separate stock browser. For fresh intelligence, open SLINK → Abroad Stocks, then read its cache here. Reported stock never guarantees availability on arrival.</p>
      <div class="planning-fields">
      <label>Travel method<select name="travelMethod"><option value="">Use Abroad Stocks preference</option><option value="standard">Standard</option><option value="airstrip">Airstrip</option><option value="private">Private / WLT</option><option value="business">Business Class</option></select></label>
      <label>Free carrying spaces (optional)<input name="capacity" type="number" min="0" max="9999" placeholder="Unknown"></label>
      <label>Shopping budget (optional)<input name="cash" type="number" min="0" placeholder="Unknown"></label>
      <label>Proposed departure<input name="departAt" type="datetime-local"></label>
      <label>Shopping allowance (minutes)<input name="shoppingMinutes" type="number" min="0" max="240"></label></div>
      <label>Following trips (optional, one destination per line)<textarea name="nextTrips" rows="2" maxlength="242" placeholder="Reuses this shopping priority list; each trip starts only when you choose."></textarea></label>
      <div class="slink-page-toolbar"><button type="button" id="analyze">Read cached trip suggestions</button></div><div id="planning-results" role="status"></div></details>
      <div class="slink-page-toolbar"><button type="submit">Save and start run</button></div></form>
      </section><p id="status" role="status"></p><p id="availability" class="travel-hint"></p><p id="limits" class="travel-hint"></p>
      <ol id="progress" class="travel-progress" aria-label="Shopping progress"></ol>
      <div class="slink-page-toolbar"><button type="button" id="next"></button><button type="button" id="skip">Skip this step</button><button type="button" id="finish" hidden>Finish shopping · return home</button><button type="button" id="edit">Set up Travel Run</button><button type="button" id="next-trip" hidden>Prepare next trip</button></div></div><button type="button" id="open" hidden></button></section>`;
    const get = id => shadow.getElementById(id);g.SLINK_TORN_COMPONENTS?.install(shadow);
    const panel=get('plan-panel'),form=shadow.querySelector('form'),fields=form.elements;
    const next=get('next'),skip=get('skip'),edit=get('edit'),status=get('status'),open=get('open');
    let compact=read('localStorage',key+'.compact')===true;
    const compactButton=get('compact'),details=get('run-details');
    function paintCompact(){
      details.hidden=compact;
      compactButton.textContent=compact?'Expand Travel Run':'Collapse';
      compactButton.setAttribute('aria-expanded',String(!compact));
    }
    compactButton.addEventListener('click',()=>{
      compact=!compact;
      write('localStorage',key+'.compact',compact);
      paintCompact();
    });
    paintCompact();
    let editing=index===null,maxSet=new WeakSet(),planningRevision=0,snapshot=emptySnapshot,draftIds=[],draftCountry='',bloodType='';
    const foreground=()=>foregroundPage();
    function active(){
      if(index===null||index>steps(value).length)return null;
      const queued=steps(value)[index];
      if(!host.parentElement)return queued;
      if(unresolved&&!pending)return {type:'blocked',label:'Check last transaction',reason:'Torn did not provide a verified result before navigation. Check the transaction in Torn before starting another run.'};
      const root=host.parentElement;
      const rows=shopRows(root);
      const state=root.querySelector('[data-travel-state]')?.dataset||root.dataset;
      const hospitalBadge=one(query(d,'a[href="/hospitalview.php"][aria-label^="Hospital:"]'));
      if(state.travelState==='hospitalized'||hospitalBadge){
        if(shopStatus!=='waiting'){shopStatus='waiting';saveProgress();}
        const reported=preferredItems(value,snapshot).some(item=>(snapshot.rows||[]).some(row=>
          Number(row.itemId)===Number(item.itemId)&&norm(row.countryCode)===norm(value.destination)&&
          Object.values(row.sources||{}).some(source=>Number(source.quantity)>0&&Number(source.updatedAt)>0&&
            Date.now()-Number(source.updatedAt)<900000&&Number(source.updatedAt)<=Date.now())));
        if(!reported)return {type:'blocked',label:'Waiting for Restock',reason:'Abroad Stocks has no recent restock report for the selected items.'};
        const medicine=medicalOptions(inventoryItems(root),g.SLINK_QOL,bloodType).heal.find(item=>item.itemId===value.healId);
        return medicine?{...medicine,type:'heal',label:'Leave Hospital',reason:'Abroad Stocks reports a restock. The report may be stale.'}:
          {type:'blocked',label:'Leave Hospital',reason:'The configured medical item is unavailable or its compatibility could not be verified.'};
      }
      if(shopStatus==='waiting'&&state.travelState==='abroad'){shopStatus='rechecking';saveProgress();}
      if(state.travelState==='departed'||state.travelState==='in-transit')return {type:'blocked',label:'In transit',reason:'Travel Run will resume on arrival.'};
      if(state.travelState==='home'&&shopStatus==='returning'){shopStatus='complete';saveProgress();return null;}
      if(shopStatus==='complete')return null;
      if(state.travelState==='returning')return {type:'blocked',label:'Returning home',reason:'The return flight is in progress.'};
      if(state.travelState==='home')return {type:'blocked',label:'Awaiting departure',reason:'Select your destination in Torn’s travel agency to begin.'};
      if(state.destinationCode&&norm(state.destinationCode)!==norm(value.destination))return {type:'blocked',label:'Check destination',reason:'The current shop is outside the planned destination.'};
      if(!rows.length)return {type:'blocked',label:'Check travel status',reason:'Travel Run could not identify the current travel state or foreign shop.'};
      const sale=value.sellMode==='off'?null:inventoryItems(root).find(row=>
        row.eligible&&(value.sellMode==='all'||value.sellIds.includes(row.itemId))&&!completed.some(done=>done.type==='sell'&&shopItem(done,row)));
      if(sale)return {...sale,type:'sell',label:'Sell '+sale.item};
      if(queued?.type==='sell'&&value.sell&&!value.sellIds.length&&!completed.some(row=>row.type==='sell'))return queued;
      if(shopStatus==='finished'||shopStatus==='returning')return {type:'home',label:'Return Home'};
      const action=chooseShopping(value,snapshot,rows,completed,limits());
      if(action.type!=='hospital')return action;
      if(shopStatus==='rechecking')return {type:'home',label:'Return Home',reason:'The preferred items are still sold out in Torn.'};
      const medicine=medicalOptions(inventoryItems(root),g.SLINK_QOL,bloodType).hospital.find(item=>item.itemId===value.hospitalId);
      return medicine?{...action,...medicine}:{...action,reason:'The configured hospitalization item is unavailable or its compatibility could not be verified.'};
    }
    const countries=()=>snapshot.countries||[];
    const reports=()=>snapshot.rows||[];
    const option=(value,label)=>new Option(label,String(value));
    const sellableIn=(id,code)=>reports().some(row=>Number(row.itemId)===id&&norm(row.countryCode)===norm(code));
    function itemNameFor(id){
      return preferredItems({itemIds:[id]},snapshot)[0].item;
    }
    function paintChoices(){
      const selected=draftIds.filter(Boolean);
      const destinations=countries().filter(country=>!selected.length||selected.every(id=>sellableIn(id,country.code)));
      const saved=countries().find(country=>norm(country.code)===norm(draftCountry)||norm(country.name)===norm(draftCountry));
      const conflict=!!saved&&!destinations.includes(saved);
      fields.country.replaceChildren(option('','Choose destination'),...destinations.map(country=>option(country.code,country.name)));
      if(conflict)fields.country.append(option(saved.code,saved.name+' (unavailable for selected items)'));
      fields.country.value=saved?.code||'';
      const search=norm(get('find-item').value);
      const ids=[...new Set(reports().map(row=>Number(row.itemId)).filter(id=>Number.isSafeInteger(id)&&id>0))];
      const available=ids.filter(id=>!saved||sellableIn(id,saved.code)).filter(id=>!search||norm(itemNameFor(id)).includes(search));
      available.sort((a,b)=>itemNameFor(a).localeCompare(itemNameFor(b)));
      const priorities=get('priorities');
      const focused=priorities.contains(shadow.activeElement)?shadow.activeElement.dataset.priority:null;
      priorities.replaceChildren(...draftIds.map((id,i)=>{
        const label=d.createElement('label'),select=d.createElement('select');
        label.append(i===0?'Primary item':i===1?'Secondary item':'Additional item '+(i-1));
        select.dataset.priority=i;
        const options=available.filter(candidate=>candidate===id||!selected.includes(candidate));
        if(id&&!options.includes(id))options.unshift(id);
        select.replaceChildren(option('','Choose item'),...options.map(candidate=>option(candidate,itemNameFor(candidate))));
        select.value=id||'';
        select.addEventListener('change',()=>{draftIds[i]=Number(select.value)||0;paintChoices();});
        label.append(select);return label;
      }));
      if(focused!==null)priorities.querySelector('[data-priority="'+focused+'"]')?.focus();
      get('compatibility').textContent=conflict?'The selected country and items are unavailable together. Change a priority or destination.':
        !reports().length?'No foreign shop catalogue is cached. Open SLINK Abroad Stocks to load its catalogue.':'';
      get('add-priority').disabled=draftIds.length>=12;
      paintPrices(selected);
    }
    function paintPrices(selected){
      const output=get('purchase-prices');
      const now=Date.now();
      output.replaceChildren(...selected.map(id=>{
        const comparison=d.createElement('details'),title=d.createElement('summary'),list=d.createElement('ul');
        title.textContent=itemNameFor(id)+' prices';
        comparison.append(title,list);
        for(const country of countries().filter(country=>sellableIn(id,country.code))){
          const row=reports().find(row=>Number(row.itemId)===id&&norm(row.countryCode)===norm(country.code));
          const source=Object.values(row?.sources||{}).filter(source=>number(source?.cost)!==null&&
            Number(source.updatedAt)>0&&Number(source.updatedAt)<=now+300000)
            .sort((a,b)=>Number(b.updatedAt)-Number(a.updatedAt))[0];
          const age=source?Math.max(0,Math.floor((now-source.updatedAt)/60000)):null;
          const price=number(source?.cost),stock=number(source?.quantity);
          const resale=priceFor(snapshot,id,now);
          const money=amount=>'$'+amount.toLocaleString();
          const parts=[country.name,price===null?'Price unavailable':money(price)];
          if(stock!==null)parts.push(stock+' last reported');
          if(age!==null)parts.push(age+'m old'+(age>=15?' (stale)':''));
          if(resale.fresh&&resale.price!==null){parts.push('resale '+money(resale.price));if(price!==null&&age<15)parts.push('estimated '+money(resale.price-price)+' per item');}
          const line=d.createElement('li');line.textContent=parts.join(' · ');list.append(line);
        }
        return comparison;
      }));
    }
    function formPlan(){
      const itemIds=draftIds.filter(Boolean);
      return plan({...value,sell:'',sellMode:fields.sellMode.value,sellIds:[...fields.sellIds.selectedOptions].map(option=>Number(option.value)),itemIds,buys:itemIds.map(itemNameFor),buyMax:fields.buyMax.checked,buyAmount:fields.buyAmount.value,
        fallback:fields.fallback.value,destination:fields.country.value,capacity:fields.capacity.value,cash:fields.cash.value,
        travelMethod:fields.travelMethod.value,departAt:fields.departAt.value?new Date(fields.departAt.value).getTime():null,
        shoppingMinutes:fields.shoppingMinutes.value,nextTrips:fields.nextTrips.value.split(/\r?\n/)});
    }
    function limits(){
      const live=nativeConstraints(host.parentElement),buys=completed.filter(row=>row.type==='buy'&&row.result==='done');
      const unknown=buys.some(row=>row.quantity===null),units=buys.reduce((sum,row)=>sum+(row.quantity||0),0);
      const spentUnknown=buys.some(row=>row.spent===null),spent=buys.reduce((sum,row)=>sum+(row.spent||0),0);
      const last=buys.at(-1),capacity=[live.capacity,value.capacity!==null&&!unknown?Math.max(0,value.capacity-units):null,last?.capacityBefore!=null&&last.quantity!=null?Math.max(0,last.capacityBefore-last.quantity):null].filter(v=>v!==null);
      const cash=[live.cash,value.cash!==null&&!spentUnknown?Math.max(0,value.cash-spent):null,last?.cashBefore!=null&&last.spent!=null?Math.max(0,last.cashBefore-last.spent):null].filter(v=>v!==null);
      return {capacity:capacity.length?Math.min(...capacity):null,cash:cash.length?Math.min(...cash):null};
    }
    function actionFor(current){return !editing&&current&&foreground()?nativeAction(host.parentElement,current,maxSet,limits(),value):null;}
    function paintAction(){
      const current=active(),action=actionFor(current),budget=limits();
      if(!editing&&!pending&&current&&status.textContent.startsWith('Next:'))status.textContent='Next: '+current.label;
      open.hidden=editing||!current;open.disabled=!action||!!pending;
      open.textContent=action?.label||current?.label||'';
      get('limits').textContent=editing?'':`Free carrying spaces: ${budget.capacity??'unknown'} · Shopping cash: ${budget.cash===null?'unknown':'$'+budget.cash.toLocaleString()}.`;
      let hint=current?.reason||(!action&&!editing&&current?'The native '+current.label.toLowerCase()+' control could not be verified on this page.':'');
      if(!editing&&current?.type==='buy'){
        const row=one(shopRows(host.parentElement).filter(row=>shopItem(row,current)));
        hint=row?.stock===0?'Torn shows this item sold out. Your plan has not advanced. Choose Skip if you want the next priority.':row&&!usable(row.control)?'Torn’s purchase control is disabled or unavailable. The run has not advanced.':row?`Native shop item found${row.stock===null?' · stock quantity unknown':` · ${row.stock} reported here`}. ${purchaseLimit(row,budget)===0?'Current quantity, capacity, or cash limit is zero.':'Confirm purchases with Torn’s own controls.'}`:'This item is not identifiable in the current shop panel. Open the native shop or use manual confirmation after checking the result.';
      }
      if(current?.profit>0)hint+=` Estimated profit $${current.profit.toLocaleString()}.`;
      get('availability').textContent=hint;
    }
    function paintSaleChoices(selected=[...fields.sellIds.selectedOptions].map(option=>Number(option.value))){
      const items=inventoryItems(host.parentElement||root);
      const known=new Map(items.map(row=>[row.itemId,row.item]));
      for(const id of selected)if(!known.has(id))known.set(id,itemNameFor(id));
      fields.sellIds.replaceChildren(...[...known].map(([id,name])=>option(id,name)));
      for(const choice of fields.sellIds.options)choice.selected=selected.includes(Number(choice.value));
      get('sell-picker').hidden=fields.sellMode.value!=='selected';
    }
    function fill(){
      fields.buyMax.checked=value.buyMax;
      fields.buyAmount.value=value.buyAmount;
      fields.buyAmount.disabled=value.buyMax;
      fields.sellMode.value=value.sellMode;fields.fallback.value=value.fallback==='heal'?'home':value.fallback;
      paintSaleChoices(value.sellIds);
      draftIds=[...value.itemIds];draftCountry=value.destination;
      while(draftIds.length<2)draftIds.push(0);
      paintChoices();
      for(const name of ['capacity','cash','travelMethod','shoppingMinutes'])fields[name].value=value[name]??'';
      fields.departAt.value=value.departAt?new Date(value.departAt-new Date(value.departAt).getTimezoneOffset()*60000).toISOString().slice(0,16):'';fields.nextTrips.value=value.nextTrips.join('\n');
    }
    function render(message=''){
      const current=active();panel.hidden=!editing;next.hidden=true;skip.hidden=true;
      skip.textContent=current?.type==='buy'?'Unavailable · next priority':'Skip this step';edit.textContent=index===null?'Set up Travel Run':current?'Edit plan':'Start another run';
      get('finish').hidden=editing||current?.type!=='buy';get('next-trip').hidden=editing||!!current||!value.nextTrips.length;
      const stepStatus=editing?'Plan a run or keep it as a simple shopping checklist.':current?'Next: '+current.label:'Run complete. No flight or subsequent trip was started automatically.';
      status.textContent=message?message+' '+(!editing?stepStatus:''):stepStatus;
      next.textContent=current?.type==='home'?'Confirm return started':'Confirm manually: '+(current?.label||'')+' done';
      get('progress').replaceChildren(...completed.map(row=>{const li=d.createElement('li');li.textContent=(row.result==='done'?'Completed: ':'Skipped: ')+row.label+(row.quantity!==null&&row.quantity!==undefined?' · '+row.quantity+' items':'')+(row.verified?' · native result verified':row.result==='done'?' · manually confirmed':'');return li;}));
      if(host.parentElement)paintAction();
    }
    function unchanged(){const saved=read('localStorage',key);if(saved&&JSON.stringify(plan(saved))!==JSON.stringify(value)){render('This plan changed in another tab. Edit or reload before continuing.');return false;}return true;}
    function complete(result,evidence={}){
      const current=pending?.step||active();if(!current||editing||!unchanged())return;
      completed.push({type:current.type,item:current.item,itemId:current.itemId,alternative:current.alternative,label:current.label,result,quantity:evidence.quantity??null,spent:current.type==='buy'&&evidence.quantity!=null&&pending?.cost!=null?evidence.quantity*pending.cost:null,capacityBefore:pending?.capacityBefore??null,cashBefore:pending?.cashBefore??null,verified:evidence.verified===true});
      if(!['buy','hospital'].includes(current.type)||!shopRows(host.parentElement).length)index=advance(steps(value),index,result);
      pending=null;unresolved=null;maxSet=new WeakSet();
      if(current.type==='buy'&&evidence.verified&&limits().capacity===0)index=steps(value).length-1;
      if(['hospital','heal'].includes(active()?.type)&&completed.some(row=>row.type==='buy'&&row.result==='done'))index++;
      render(saveProgress()?(evidence.verified?'Torn confirmed this step. Review the next priority; no action was started.':''):'Progress is available only on this page.');
    }
    const act=(result,event)=>{if(event.isTrusted&&foreground()&&!editing&&index!==null)complete(result);};
    fields.buyMax.addEventListener('change',()=>{fields.buyAmount.disabled=fields.buyMax.checked;});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(!event.isTrusted||!foreground())return;
      const proposed=formPlan();
      if(!proposed.destination||!proposed.itemIds.length||!proposed.itemIds.every(id=>sellableIn(id,proposed.destination))){render('Choose a destination and at least one item sold there.');return;}
      value=proposed;index=0;shopStatus='';completed=[];pending=null;unresolved=null;runId=String(Date.now())+Math.random().toString(36).slice(2);editing=false;maxSet=new WeakSet();panel.hidden=true;
      const saved=write('localStorage',key,value),progress=saveProgress();render(saved&&progress?'':'Storage is unavailable; this run may reset on navigation.');
    });
    next.addEventListener('click',event=>act('done',event));skip.addEventListener('click',event=>act('unavailable',event));
    get('finish').addEventListener('click',event=>{if(!event.isTrusted||!foreground()||editing||pending||!unchanged())return;shopStatus='finished';index=steps(value).length-1;pending=null;saveProgress();render('Shopping finished by your choice. Open Torn’s return panel when ready.');});
    let submitting=false;
    function setQuantity(field,amount){
      const setter=Object.getOwnPropertyDescriptor(g.HTMLInputElement.prototype,'value')?.set;
      setter?.call(field,String(amount));
      field.dispatchEvent(new Event('input',{bubbles:true}));
      field.dispatchEvent(new Event('change',{bubbles:true}));
    }
    open.addEventListener('click',async event=>{
      if(!event.isTrusted||!foreground()||editing||pending||submitting||!host.isConnected||!unchanged())return;
      const current=active(),selected=actionFor(current);if(!selected||selected.label!==open.textContent){paintAction();return;}
      if(selected.kind==='transaction'){
        const root=host.parentElement;
        const row=current.type==='buy'?one(shopRows(root).filter(row=>shopItem(row,current))):null;
        const amount=selected.limit??number(row?.quantity?.value);
        if(current.type==='buy'&&(!amount||amount!==purchaseQuantity(row,limits(),value)))return;
        submitting=true;
        open.disabled=true;
        try{
          if(selected.quantity){
            setQuantity(selected.quantity,amount);
            await new Promise(resolve=>g.setTimeout(resolve,0));
            if(!foreground()||host?.parentElement!==root||editing||pending||!unchanged())return;
          }
          if(!nativeConfirmation(root,current,amount)){
            if(!usable(selected.control)){render('Torn did not enable Buy for this quantity. Check cash and carrying space.');return;}
            selected.control.click();
          }
          await new Promise(resolve=>g.setTimeout(resolve,0));
          if(!foreground()||host?.parentElement!==root||editing||pending||!unchanged())return;
          const confirmation=nativeConfirmation(root,current,amount);
          if(!confirmation){render('Torn’s confirmation could not be verified. Review the native panel.');return;}
          startPending(current,confirmation,row,amount);
          confirmation.click();
          checkOutcome();
        }finally{submitting=false;if(host?.parentElement===root)paintAction();}
        return;
      }
      if(active()?.type==='home'&&completed.some(row=>row.type==='buy'&&row.verified)&&limits().capacity>0&&
        !g.confirm('You still have inventory space. Are you sure you want to return home?'))return;
      if(selected.kind==='quantity'){
        const setter=Object.getOwnPropertyDescriptor(g.HTMLInputElement.prototype,'value')?.set;setter?.call(selected.quantity,String(selected.limit));selected.quantity.dispatchEvent(new Event('input',{bubbles:true}));selected.quantity.dispatchEvent(new Event('change',{bubbles:true}));selected.quantity.focus();
      }else selected.control.click();
      if(selected.quantity){maxSet.add(selected.quantity);if(selected.limit!==null&&selected.limit!==undefined&&number(selected.quantity.value)>selected.limit){const setter=Object.getOwnPropertyDescriptor(g.HTMLInputElement.prototype,'value')?.set;setter?.call(selected.quantity,String(selected.limit));selected.quantity.dispatchEvent(new Event('input',{bubbles:true}));selected.quantity.dispatchEvent(new Event('change',{bubbles:true}));}}
      render('Prepared one native control. Review and confirm the transaction in Torn; this step is not complete.');
    });
    edit.addEventListener('click',event=>{if(!event.isTrusted||pending)return;editing=!editing;if(editing)fill();render();});
    get('next-trip').addEventListener('click',event=>{if(!event.isTrusted||!foreground())return;value=plan({...value,destination:value.nextTrips[0],nextTrips:value.nextTrips.slice(1),departAt:null});index=null;completed=[];pending=null;editing=true;write('localStorage',key,value);saveProgress();fill();get('planner').open=true;render('Review the next destination and current stock before starting this trip.');});
    fields.sellMode.addEventListener('change',()=>paintSaleChoices());
    fields.country.addEventListener('change',()=>{draftCountry=fields.country.value;paintChoices();});
    get('find-item').addEventListener('input',paintChoices);
    get('add-priority').addEventListener('click',()=>{if(draftIds.length<12){draftIds.push(0);paintChoices();}});
    function capture(event){
      if(event.isTrusted&&foreground()&&active()?.type==='home'){
        const confirmation=event.target.closest?.('button,[role="button"]');
        const panel=confirmation?.closest('#travel-home-panel,[class*="body___"]');
        if(panel&&/travel back to torn\b/.test(norm(panel.querySelector('p')?.textContent))&&
          usable(confirmation)&&/^(?:confirm )?travel back$/.test(textControl(confirmation))){
          shopStatus='returning';saveProgress();
        }
      }
      if(!event.isTrusted||!foreground()||editing||!['buy','sell'].includes(active()?.type)||!unchanged())return;
      const control=event.submitter||event.target.closest('button,input[type="submit"]');if(!control||!usable(control)||control.getAttribute('aria-expanded')==='false')return;
      if(event.type==='submit'&&pending?.control===control&&Date.now()-pending.at<1000)return;
      const current=active(),label=textControl(control);
      if(!/^(?:buy|purchase|sell|confirm|yes)(?:\b|$)/.test(label))return;
      const row=current.type==='buy'?one(shopRows(host.parentElement).filter(row=>shopItem(row,current))):null;
      const area=current.type==='buy'?row?.row:inventorySelection(host.parentElement,current)?.slot;
      const dialog=control.closest('[role="dialog"]');
      if(!area?.contains(control)&&!(dialog&&norm(dialog.textContent).includes(norm(current.item))&&(/item-(\d+)/.exec(control.form?.id||'')?.[1]===String(row?.itemId))))return;
      startPending(current,control,row,number((control.form?quantityField(control.form):row?.quantity)?.value));
    }
    function startPending(current,control,row,quantity){
      const baseline=new Map(feedbackNodes(host.parentElement).map(node=>[node,norm(node.textContent)]));
      const before=limits();pending={runId,index,step:current,type:current.type,item:current.item,at:Date.now(),baseline,seen:new Set(baseline.values()),capacityBefore:before.capacity,cashBefore:before.cash,cost:row?.cost??null,quantity,url:loc.href,control};
      unresolved={type:current.type,itemId:current.itemId};saveProgress();
      render('Waiting for Torn’s result. Travel Run will wait for an item-specific result.');
    }
    function checkOutcome(){
      if(!pending||!foreground()||editing||pending.runId!==runId||pending.index!==index||pending.url!==loc.href)return;
      if(['hospital','heal'].includes(pending.type)){
        const hospital=!!one(query(d,'a[href="/hospitalview.php"][aria-label^="Hospital:"]'));
        const state=host.parentElement.querySelector('[data-travel-state]')?.dataset.travelState;
        if(pending.type==='hospital'&&(hospital||state==='hospitalized')){shopStatus='waiting';complete('done',{quantity:1,verified:true});return;}
        if(pending.type==='heal'&&!hospital&&(state==='abroad'||shopRows(host.parentElement).length)){shopStatus='rechecking';complete('done',{quantity:1,verified:true});return;}
      }
      for(const node of feedbackNodes(host.parentElement)){
        if(pending.baseline.get(node)===norm(node.textContent)||pending.seen.has(norm(node.textContent)))continue;
        const outcome=feedbackOutcome(node,pending.step);if(!outcome)continue;
        if(outcome.result==='failed'){pending=null;unresolved=null;saveProgress();render('Torn reported a failed or unavailable transaction. This step is not complete. Review stock and retry if the item is available.');return;}
        complete('done',{...outcome,verified:true});return;
      }
    }
    const marked=new Map();
    function highlight(){
      const priorities=preferredItems(value,snapshot).slice(0,2);
      const rows=shopRows(host.parentElement);
      const next=new Map(rows.flatMap(({row,itemId,item})=>{
        const priority=priorities.findIndex(current=>shopItem({itemId,item},current));
        return priority<0?[]:[[row,priority]];
      }));
      for(const [row,original] of marked)if(!next.has(row)){restore(row,original);marked.delete(row);}
      for(const [row,priority] of next){
        if(marked.has(row))continue;
        const style=row.style;
        marked.set(row,{outline:style.outline,outlineOffset:style.outlineOffset,order:style.order});
        style.outline='2px solid var(--slink-success, #32cd32)';
        style.outlineOffset='-2px';
        if(/flex|grid/.test(g.getComputedStyle(row.parentElement).display))style.order=String(priority-2);
      }
    }
    function restore(row,original){Object.assign(row.style,original);}
    lifecycle.signal.addEventListener('abort',()=>{for(const [row,original] of marked)restore(row,original);marked.clear();},{once:true});
    let snapshotAt=0,readingSnapshot=false;
    async function refreshWaitingSnapshot(){
      if(shopStatus!=='waiting'||readingSnapshot||Date.now()-snapshotAt<15000)return;
      snapshotAt=Date.now();
      readingSnapshot=true;
      try{
        const cached=await planningSnapshot();
        if(foreground()&&host?.shadowRoot===shadow){snapshot=cached;paintAction();}
      }catch{
        if(foreground()&&host?.shadowRoot===shadow)status.textContent='Could not read Abroad Stocks. Travel Run is still waiting.';
      }finally{readingSnapshot=false;}
    }
    refresh=()=>{checkOutcome();paintAction();highlight();void refreshWaitingSnapshot();};
    root.prepend(host);observeRoot?.(root);
    d.addEventListener('click',capture,{capture:true,signal:lifecycle.signal});d.addEventListener('submit',capture,{capture:true,signal:lifecycle.signal});
    fill();render();
    void planningSnapshot().then(cached=>{
      if(!foreground()||host?.shadowRoot!==shadow)return;
      snapshot=cached;
      if(!value.itemIds.length&&value.buys.length){
        const migrated=value.buys.map(name=>[...new Set(reports().filter(row=>norm(row.itemName)===norm(name)).map(row=>Number(row.itemId)))]);
        if(migrated.every(matches=>matches.length===1&&Number.isSafeInteger(matches[0]))){
          value=plan({...value,itemIds:migrated.map(matches=>matches[0])});
          write('localStorage',key,value);saveProgress();fill();
        }
      }
      paintChoices();paintSaleChoices();render();highlight();
    }).catch(()=>{if(host?.shadowRoot===shadow)get('compatibility').textContent='Could not read the Abroad Stocks cache. Open Abroad Stocks and try again.';});
    let analyzeBusy=false;
    get('analyze').addEventListener('click',async event=>{
      if(!event.isTrusted||!foreground()||analyzeBusy)return;
      const ticket=++planningRevision,owner=host;analyzeBusy=true;get('analyze').disabled=true;const output=get('planning-results');output.textContent='Reading existing Abroad Stocks cache…';
      try{
        const cached=await planningSnapshot();if(!foreground()||host!==owner||ticket!==planningRevision)return;snapshot=cached;
        paintChoices();
        const draft=formPlan(),native=nativeConstraints(host.parentElement),estimate=travelPlanning({...draft,capacity:draft.capacity??native.capacity,cash:draft.cash??native.cash},snapshot);
        output.replaceChildren();const note=d.createElement('p');note.textContent='Estimates only. Provider reports do not confirm live stock or arrival availability. Costs and profit exclude fees.';output.append(note);
        const reports=estimate.selected?[estimate.selected]:estimate.recommendations;
        if(!reports.length){output.append(d.createTextNode(estimate.constraintsBlocked?'No purchase fits the current carrying-space or cash limits. Adjust your plan, or keep using the checklist.':draft.buys.length?'No fresh matching stock is cached. Open SLINK Abroad Stocks for current reports. The checklist remains usable without API keys.':'Enter your shopping priorities first, then read cached suggestions.'));return;}
        for(const report of reports){
          const card=d.createElement('article'),title=d.createElement('strong');title.textContent=report.country.name;card.append(title);
          const use=d.createElement('button');use.type='button';use.textContent='Use '+report.country.name;use.addEventListener('click',()=>{draftCountry=report.country.code;paintChoices();});if(!estimate.selected)card.append(use);
          const timeline=d.createElement('p');timeline.textContent=report.minutes===null?'Travel time unavailable for this country or method.':`${report.minutes} min each way · Proposed departure ${new Date(report.departAt).toLocaleString()} · Arrival ${new Date(report.arrivalAt).toLocaleString()} · Estimated home ${new Date(report.returnAt).toLocaleString()} (includes ${draft.shoppingMinutes} min shopping allowance).`;card.append(timeline);
          for(const item of report.items){const line=d.createElement('p'),age=item.at?Math.max(0,Math.floor((Date.now()-item.at)/60000))+'m old':'time unknown';line.textContent=`${item.priority+1}. ${item.name}: ${item.provider?`${item.stock??'unknown'} reported · ${item.provider}, ${age}${item.fresh?'':' — stale'}`:'No cached report'}${item.cost!==null?' · $'+item.cost.toLocaleString()+' each':''}${item.resale!==null?' · resale estimate $'+item.resale.toLocaleString()+(item.resaleFresh?'':' (stale/undated)'):''}${item.unitProfit!==null?' · potential $'+item.unitProfit.toLocaleString()+' per item':''}${item.quantity!==null?' · up to '+item.quantity+' planned':''}${item.nextRestockAt?' · estimated restock '+new Date(item.nextRestockAt).toLocaleString()+' ('+(item.predictionSource||'source estimate')+')'+(report.minutes!==null?' · estimated departure for restock '+new Date(item.nextRestockAt-report.minutes*60000).toLocaleString():''):''}`;card.append(line);}
          if(report.totalProfit!==null){const total=d.createElement('p');total.textContent='Estimated purchase cost $'+report.totalCost.toLocaleString()+' · Potential profit $'+report.totalProfit.toLocaleString()+' before fees.';card.append(total);}
          if(report.items.some(item=>!item.resaleFresh)){const hint=d.createElement('p');hint.textContent='Current resale pricing is unavailable for some items. Configure your Torn key in SLINK Access and refresh pricing through Abroad Stocks; the checklist does not need a key.';card.append(hint);}
          output.append(card);
        }
      }catch(error){if(host===owner&&foreground())output.textContent='Could not read planning data: '+String(error.message||error)+'. The checklist still works. Open SLINK Access if credentials or permissions need attention.';}
      finally{analyzeBusy=false;if(host===owner)get('analyze').disabled=false;}
    });
  }

  let enabled=false, frame=null, observer=null,discovery=null, lifecycle=null, generation=0,attachedRoot=null;
  async function planningSnapshot(){
    if(!foregroundPage())throw Error('Open Travel Run on the active travel page.');
    if(g.SLINK_PDA_PLUGIN_API?.travelRunPlanning)return g.SLINK_PDA_PLUGIN_API.travelRunPlanning();
    const storage=g.SLINK_EXTENSION?.core?.storage;
    if(!storage)return {countries:g.SLINK_EXTENSION?.core?.abroadStocks?.COUNTRIES||[],rows:[]};
    const [snapshot,runtime,shared]=await Promise.all([g.SLINK_EXTENSION.core.messaging.send('abroadStocks.status',{refreshIfDue:false}),storage.get('abroadStocks.runtime.v1',{}),storage.get('shared.providers.v1',{})]);
    return {rows:snapshot.rows||[],fetchedAt:snapshot.fetchedAt||0,settings:snapshot.settings||{},countries:g.SLINK_EXTENSION?.core?.abroadStocks?.COUNTRIES||[],catalog:shared.catalog,marketPrices:runtime.marketPrices,marketPricesFetchedAt:runtime.marketPricesFetchedAt};
  }
  function foregroundPage(){return enabled&&d.visibilityState==='visible'&&d.hasFocus();}
  function schedule(){
    if(!foregroundPage()||frame!==null)return;
    frame=g.requestAnimationFrame(()=>{
      frame=null;
      if(foregroundPage()){if(host?.isConnected)refresh?.();else mount();}
    });
  }
  function setEnabled(value){
    const next=value!==false;if(next===enabled)return;enabled=next;
    if(!enabled){
      lifecycle?.abort();lifecycle=null;observer?.disconnect();observer=null;discovery?.disconnect();discovery=null;attachedRoot=null;pending=null;
      if(frame!==null)g.cancelAnimationFrame(frame);frame=null;
      host?.remove();host=null;refresh=null;return;
    }
    lifecycle=new AbortController();const {signal}=lifecycle;
    observer=new MutationObserver(schedule);
    observeRoot=root=>{
      observer.disconnect();observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-expanded','aria-disabled','aria-selected','aria-current','disabled','hidden','inert','max','data-stock','data-price','data-travel-state','data-destination-code','class']});
      attachedRoot=root;
    };
    discovery=new MutationObserver(records=>{
      if(!host?.isConnected||attachedRoot&&!attachedRoot.isConnected){schedule();return;}
      if(pending&&records.some(record=>(record.target.nodeType===1?record.target:record.target.parentElement)?.closest('[role="alert"]')||[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches('[role="alert"]')||node.querySelector('[role="alert"]')))))schedule();
    });
    discovery.observe(d.documentElement,{childList:true,subtree:true,characterData:true});
    g.addEventListener('focus',schedule,{signal});
    d.addEventListener('visibilitychange',schedule,{signal});
    d.addEventListener('input',event=>{if(host?.parentElement?.contains(event.target))schedule();},{signal});
    g.addEventListener('popstate',()=>{pending=null;schedule();},{signal});
    g.addEventListener('hashchange',()=>{pending=null;schedule();},{signal});
    schedule();
  }
  const pda=g.SLINK_PDA_PLUGIN_API, storage=g.SLINK_EXTENSION?.core?.storage;
  const setting='ui.monitoring.travel-run.enabled';
  if(pda){
    const sync=()=>setEnabled(pda.moduleMonitoringEnabled?.('travel-run')!==false);
    g.addEventListener('slink:travel-run-monitoring',sync);sync();
  }else if(storage){
    const sync=async()=>{const run=++generation;try{const value=await storage.get(setting,true);if(run===generation)setEnabled(value);}catch{}};
    g.chrome.storage.onChanged.addListener((changes,area)=>{
      if(area!=='local')return;
      if(Object.hasOwn(changes,storage.fullKey(setting)))void sync();
      if(Object.hasOwn(changes,storage.fullKey('abroadStocks.runtime.v1')))schedule();
    });
    void sync();
  }else setEnabled(true);
})(globalThis);
