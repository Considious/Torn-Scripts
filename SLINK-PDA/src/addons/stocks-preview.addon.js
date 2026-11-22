(function(g){
  'use strict';
  const onPage=()=>location.pathname==='/page.php'&&new URLSearchParams(location.search).get('sid')==='stocks';
  if(!onPage())return;
  const model=g.SLINK_STOCKS_MODEL, ext=g.SLINK_EXTENSION, pda=g.SLINK_PDA_PLUGIN_API;
  const scope='slink.qol.money-property', key='stocks.preview.hidden.v1';
  const pdaId=()=>String(pda.accountId?.()||'');
  const host=pda?{
    load:async()=>{
      await pda.ensurePermission(false);if(!pda.hasScope(scope))throw Error('Money & Property access is required.');
      const cache=pda.cache('stocksPreviewEducation');
      const catalog=async()=>{
        if(cache.body&&Date.now()-cache.at<7*86400000)return cache.body;
        const body=await pda.tornJson('/v2/torn/education','SLINK Stocks');
        cache.body=body;cache.at=Date.now();await pda.save();return body;
      };
      const [holdings,market,money,items,education,educationCourses]=await Promise.all([
        pda.tornJson('/v2/user/stocks','SLINK Stocks'),
        pda.tornJson('/v2/torn/stocks','SLINK Stocks'),
        pda.tornJson('/v2/user/money','SLINK Stocks').catch(()=>null),
        pda.sharedCatalog({maxAgeMs:7*86400000,needPrices:true}).catch(()=>null),
        pda.tornJson('/v2/user/education','SLINK Stocks').catch(()=>null),
        catalog().catch(()=>null)
      ]);
      const cash=money?.money?.cash??money?.money?.wallet??null;
      return {holdings:holdings.stocks,market:market.stocks,cash,education,educationCourses,
        benefitRows:g.SLINK_PDA_STOCK_BENEFITS?.rows(holdings,market,items?.items||[],cash??0)||[],fetchedAt:Date.now()};
    },
    get:async()=>pdaId()?pda.settings('stocksPreview',{})[pdaId()]:[],
    set:async value=>{const id=pdaId();if(!id)throw Error('Verify Access first.');const prefs=pda.settings('stocksPreview',{}),old=prefs[id];prefs[id]=value;try{await pda.save();}catch(e){if(old===undefined)delete prefs[id];else prefs[id]=old;throw e;}}
  }:{
    load:()=>ext.core.messaging.send('stocks.preview.load'),
    get:()=>ext.core.storage.get(key,[]),
    set:value=>ext.core.storage.set(key,value)
  };
  const money=n=>n==null?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
  const element=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
  const button=(label,fn)=>{const b=element('button',label);b.type='button';b.addEventListener('click',fn);return b;};
  let hidden=new Set(), saving=false, showHidden=false, data=null, root=null, observer=null, pending=false, loading=false, status, summary, controls, picker, search, ownership, panel, tradeTools, recommendationList, recommendationStatus, affordable, sort;
  const compact=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
  const tradeBlocks=new Map();
  const hideButtons=new WeakSet();
  const tradeSelector='[class*="stockDropdown__"] :is([class*="buyBlock__"],[class*="sellBlock__"])';
  const quantitySelector='input.input-money:not([type="hidden"])';
  const shown=node=>node?.isConnected&&!node.closest('[hidden],[aria-hidden="true"]')&&node.getClientRects().length>0;
  const visible=()=>document.visibilityState!=='hidden';
  const market=()=>new Map((data?.market||[]).map(s=>[s.id,s]));
  const holding=id=>data?.holdings?.find(h=>h.id===id);
  const rowSelector='[class*="stock___"][id]';
  function rowId(row){
    if(!row)return null;
    const id=Number(row.id);
    if(Number.isSafeInteger(id)&&id>0)return id;
    const token=row.id.toUpperCase();
    return [...market().values()].find(s=>String(s.acronym).toUpperCase()===token)?.id??null;
  }
  function refreshDisplay(){
    const prices=new Map([...market()].map(([id,s])=>[id,s.market?.price]));
    const result=model.portfolio(data?.holdings,prices);
    summary.textContent=result?`Portfolio value: ${money(result.value)} · Unrealized profit/loss before fees: ${money(result.profit)}`:'Load stock data to see your portfolio and benefit costs.';
    controls.textContent=showHidden?'Hide filtered stocks':`Show hidden stocks (${hidden.size})`;
    renderRecommendations();
  }
  function renderRecommendations(){
    if(!recommendationList)return;
    const rows=model.recommendations(data,{affordableOnly:affordable.checked,sort:sort.value,hidden:[...hidden]});
    const nodes=rows.map(stock=>{
      const item=element('li');
      const label=element('strong',stock.acronym+' · '+stock.name);
      const detail=stock.education
        ? stock.benefitDescription+' · Education still in progress'
        : compact(stock.weeklyValue)+'/week · '+(stock.monthlyRoi*100).toFixed(2)+'% monthly ROI';
      item.append(label,element('div',compact(stock.incrementalCost)+' to first benefit · '+detail));
      return item;
    });
    recommendationList.replaceChildren(...nodes);
    recommendationStatus.textContent=!data?'Load stock data to see recommendations.':rows.length?'Based on loaded payout prices. Affordability uses cash on hand.':
      affordable.checked&&data.cash==null?'Cash balance unavailable. Refresh or turn off the affordability filter.':'No qualifying unowned stocks match these filters.';
  }
  async function toggle(id){
    if(!id||saving)return;
    const next=new Set(hidden);if(!next.delete(id))next.add(id);
    saving=true;
    try{await host.set([...next]);hidden=next;status.textContent='';refreshDisplay();schedule();}
    catch(e){status.textContent=e.message||'Could not save stock filters.';}
    finally{saving=false;}
  }
  function attachTrade(block,sell){
    if(tradeBlocks.has(block))return;
    const wrap=element('div');wrap.className='slink-stock-amount';globalThis.SLINK_TORN_COMPONENTS?.card(wrap);
    const label=element('label',sell?'Sell up to ($ net) ':'Buy budget ($) ');
    const input=element('input');input.inputMode='decimal';input.placeholder='e.g. 25,000';label.append(input);
    const result=element('div');result.setAttribute('role','status');
    const check=fill=>{
      const fields=Array.from(block.querySelectorAll(quantitySelector)).filter(shown);
      const current=fields.length===1?fields[0]:null;
      const owned=root.querySelectorAll('[class*="stockOwned__"][class*="active__"]');
      const row=owned.length===1?owned[0].closest(rowSelector):null;
      const id=rowId(row);
      const nativeRow=block.closest(rowSelector);
      if(!root?.contains(block)||!shown(block)||!row||(nativeRow&&nativeRow!==row)){
        result.textContent='Open the stock and its Torn trade form before filling shares.';
        return;
      }
      const priceText=row.querySelector('[class*="stockPrice__"] [class*="price__"]')?.textContent;
      const price=model.amount(priceText||'');
      const balance=sell?(holding(id)?.shares??(data?0:null)):data?.cash;
      const q=model.quote(model.amount(input.value),price,sell,sell?balance:null);
      const over=q&&(sell?q.exceeds:typeof balance==='number'&&q.total>balance);
      if(!q){result.textContent='Enter a positive dollar amount and open one stock with a visible price.';return;}
      const stale=data&&Date.now()-data.fetchedAt>120000;
      const note=over?(sell?' Not enough owned shares in the loaded snapshot.':' Not enough cash in the loaded snapshot.'):balance==null||stale?' Check your current balance in Torn.':'';
      result.textContent=`${q.shares.toLocaleString()} shares · estimated ${sell?'net proceeds':'cost'} ${money(q.total)}.${note} Torn handles confirmation.`;
      if(!fill||over||!current||current.disabled||current.readOnly||!current.isConnected)return;
      const set=Object.getOwnPropertyDescriptor(g.HTMLInputElement.prototype,'value')?.set;
      if(!set)return;
      set.call(current,String(q.shares));
      current.dispatchEvent(new Event('input',{bubbles:true}));
    };
    input.addEventListener('input',()=>check(false));
    input.addEventListener('keydown',e=>{if(e.key==='Enter')e.preventDefault();});
    wrap.append(label,button('Fill Torn shares',()=>check(true)),result);
    tradeTools.append(wrap);
    tradeBlocks.set(block,wrap);
  }
  function scan(){
    pending=false;if(!root?.isConnected||!visible()||!onPage())return;
    const lookup=market();
    for(const row of root.querySelectorAll(rowSelector)){
      const id=rowId(row), stock=lookup.get(id);
      const title=row.querySelector('[class*="stockName___"]');
      const name=[title?.getAttribute('aria-label'),title?.textContent,stock?.name,stock?.acronym,row.id].join(' ').toLowerCase();
      const count=row.querySelector('p[class*="count___"]')?.textContent.trim();
      const owned=data?Number(holding(id)?.shares)>0:count==='None'?false:count&&/\d/.test(count)?model.amount(count)>0:null;
      const wanted=ownership.value;
      const filtered=(hidden.has(id)&&!showHidden)||!name.includes(search.value.trim().toLowerCase())||(wanted==='owned'&&owned!==true)||(wanted==='unowned'&&owned!==false);
      if(row.classList.contains('slink-stock-filtered')!==filtered)row.classList.toggle('slink-stock-filtered',filtered);
      if(!id)continue;
      row.querySelectorAll(':scope > .slink-stock-detail').forEach(node=>node.remove());
      const nameCell=title?.querySelector('[class*="nameContainer___"]')||title;
      let hideButton=row.querySelector('.slink-stock-hide');
      if(!hideButton&&nameCell){
        hideButton=element('button','Hide stock');hideButton.type='button';
        hideButton.className='slink-stock-hide';
        globalThis.SLINK_TORN_COMPONENTS?.mark(hideButton,'slink-page-action');
        nameCell.append(hideButton);
      }
      if(hideButton&&!hideButtons.has(hideButton)){
        hideButtons.add(hideButton);
        hideButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void toggle(rowId(row));});
        hideButton.addEventListener('keydown',event=>event.stopPropagation());
      }
      const caption=hidden.has(id)?'Restore stock':'Hide stock';
      if(hideButton&&hideButton.textContent!==caption)hideButton.textContent=caption;
      const info=row.querySelector('[class*="dividendInfo___"]');
      let benefit=row.querySelector('.slink-stock-benefit');
      const h=holding(id),price=stock?.market?.price,shares=h?.shares??0;
      const goal=data&&stock&&model.threshold(stock.bonus?.requirement,shares,{passive:stock.bonus?.passive===true,cap:stock.acronym==='MCS'?10:Infinity});
      const show=info&&goal!=null&&price>0&&!info.querySelector('.tt-cost-to-next');
      if(show){
        if(!benefit){benefit=element('small');benefit.className='slink-stock-benefit';globalThis.SLINK_TORN_COMPONENTS?.mark(benefit,'slink-page-positive');info.append(benefit);}
        const text='Next benefit: '+compact((goal-shares)*price);
        if(benefit.textContent!==text)benefit.textContent=text;
        const detail=(goal-shares).toLocaleString()+' more shares · estimated '+money((goal-shares)*price);
        if(benefit.title!==detail)benefit.title=detail;
      }else if(benefit)benefit.remove();
    }
    const blocks=new Set(Array.from(root.querySelectorAll(tradeSelector)).filter(block=>
      shown(block)&&Array.from(block.querySelectorAll(quantitySelector)).some(shown)));
    for(const [block,tools] of tradeBlocks)if(!blocks.has(block)){
      tools.remove();
      tradeBlocks.delete(block);
    }
    for(const block of blocks)attachTrade(block,block.className.includes('sellBlock__'));
    tradeTools.hidden=!tradeBlocks.size;
  }
  function schedule(){if(!pending&&visible()){pending=true;requestAnimationFrame(scan);}}
  async function load(){
    if(loading)return;loading=true;status.textContent='Loading stock data…';
    try{
      const snapshot=await host.load();
      if(!Array.isArray(snapshot.holdings)||!Array.isArray(snapshot.market)||!snapshot.market.length)throw Error('Torn did not return stock data.');
      snapshot.educationRemaining=model.educationRemaining(snapshot.education,snapshot.educationCourses);
      data=snapshot;
      status.textContent='Snapshot: '+new Date(data.fetchedAt).toLocaleTimeString()+'. Refresh after trading.';
      refreshDisplay();schedule();
    }catch(e){status.textContent=(e.message||'Could not load stocks.')+(data?' Showing the last snapshot.':'');}
    finally{loading=false;}
  }
  function mount(){
    if(!onPage()||!visible())return;
    const next=document.querySelector('#stockmarketroot');
    if(!next||(next===root&&panel?.isConnected))return;
    observer?.disconnect();root=next;
    if(panel){
      for(const tools of tradeBlocks.values())tools.remove();
      tradeBlocks.clear();
      tradeTools.hidden=true;
      root.before(panel);
      observeRoot();
      return;
    }
    const style=element('style',`
      .slink-stock-filtered{display:none!important}
      #stockmarketroot .slink-stock-hide{display:block!important;inline-size:max-content!important;min-inline-size:0!important;min-block-size:0!important;block-size:auto!important;margin:2px 0 0!important;padding:0 2px!important;border:0!important;border-radius:2px!important;background:transparent!important;color:var(--sp-link)!important;font:11px/1.25 Arial,sans-serif!important;text-decoration:underline;white-space:nowrap!important}
      #stockmarketroot .slink-stock-hide:hover{color:var(--sp-text)!important}
      #stockmarketroot .slink-stock-benefit{display:block;font:11px/1.3 Arial,sans-serif;color:var(--sp-success);overflow-wrap:anywhere}
      .slink-stock-recommendations{margin:8px 0;padding:0;min-width:0}
      .slink-stock-recommendations label{display:inline-flex;align-items:center;gap:4px;margin:4px 10px 4px 0}
      .slink-stock-recommendations ol{padding-inline-start:22px;margin:5px 0}
      .slink-stock-recommendations li{margin:5px 0}
    `);
    panel=element('details');panel.open=true;panel.className='slink-stocks-panel';panel.setAttribute('aria-label','SLINK Stocks tools');globalThis.SLINK_TORN_COMPONENTS?.card(panel);
    summary=element('div');status=element('div');status.setAttribute('role','status');
    controls=button('',()=>{showHidden=!showHidden;refreshDisplay();schedule();});
    picker=button('Load / refresh stocks',()=>void load());
    search=element('input');search.type='search';search.placeholder='Stock name or symbol';search.setAttribute('aria-label','Stock name or symbol');search.addEventListener('input',schedule);
    ownership=element('select');ownership.setAttribute('aria-label','Stock ownership');for(const [value,label] of [['','All stocks'],['owned','Owned'],['unowned','Not owned']]){const option=element('option',label);option.value=value;ownership.append(option);}ownership.addEventListener('change',schedule);
    const filterKey='slink-native-extra-filter:v1:stocks';
    search.maxLength=80;
    try{const saved=JSON.parse(localStorage.getItem(filterKey)||'{}');if(typeof saved?.query==='string')search.value=saved.query.slice(0,80);if(['owned','unowned'].includes(saved?.ownership))ownership.value=saved.ownership;}catch{}
    const savePreset=button('Save filter preset',()=>{try{localStorage.setItem(filterKey,JSON.stringify({query:search.value,ownership:ownership.value}));status.textContent='Stock filter preset saved.';}catch{status.textContent='Could not save the preset on this device.';}});
    const resetFilters=button('Reset filters',()=>{search.value=ownership.value='';try{localStorage.removeItem(filterKey);}catch{}schedule();});
    const recommendations=element('div');recommendations.className='slink-stock-recommendations';
    const affordLabel=element('label');affordable=element('input');affordable.type='checkbox';affordLabel.append(affordable,'What can I afford');
    sort=element('select');sort.setAttribute('aria-label','Recommendation order');
    for(const [value,label] of [['monthlyRoi','Monthly ROI'],['weeklyValue','Weekly payout']]){const option=element('option',label);option.value=value;sort.append(option);}
    sort.addEventListener('change',renderRecommendations);affordable.addEventListener('change',renderRecommendations);
    recommendationList=element('ol');recommendationStatus=element('small');recommendationStatus.setAttribute('role','status');
    recommendations.append(element('strong','Top 3 unowned stocks'),affordLabel,sort,recommendationList,recommendationStatus);
    tradeTools=element('div');
    tradeTools.hidden=true;
    panel.append(element('summary','SLINK Stocks'),summary,picker,controls,search,ownership,savePreset,resetFilters,status,recommendations,tradeTools,style);
    root.before(panel);
    refreshDisplay();
    observeRoot();
  }
  function observeRoot(){
    observer=new MutationObserver(schedule);
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden','disabled']});
    schedule();
  }
  void host.get().then(ids=>{hidden=new Set(Array.isArray(ids)?ids.filter(Number.isSafeInteger):[]);if(summary)refreshDisplay();schedule();}).catch(()=>{});
  const boot=new MutationObserver(()=>{
    if(!root?.isConnected||!panel?.isConnected)mount();
  });
  mount();
  boot.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{mount();schedule();});
})(globalThis);
