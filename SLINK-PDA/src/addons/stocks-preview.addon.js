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
      const [holdings,market,money]=await Promise.all([pda.tornJson('/v2/user/stocks','SLINK Stocks'),pda.tornJson('/v2/torn/stocks','SLINK Stocks'),pda.tornJson('/v2/user/money','SLINK Stocks').catch(()=>null)]);
      return {holdings:holdings.stocks,market:market.stocks,cash:money?.money?.cash,fetchedAt:Date.now()};
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
  let hidden=new Set(), saving=false, showHidden=false, data=null, root=null, observer=null, pending=false, loading=false, status, summary, controls, picker, search, ownership;
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
    if(block.querySelector('.slink-stock-amount'))return;
    const native=block.querySelector('input.input-money:not([type="hidden"])');
    if(!native)return;
    const wrap=element('div');wrap.className='slink-stock-amount';
    const label=element('label',sell?'Sell up to ($ net) ':'Buy budget ($) ');
    const input=element('input');input.inputMode='decimal';input.placeholder='e.g. 25,000';label.append(input);
    const result=element('div');result.setAttribute('role','status');
    const check=fill=>{
      const fields=block.querySelectorAll('input.input-money:not([type="hidden"])');
      const current=fields.length===1?fields[0]:null;
      const owned=root.querySelectorAll('[class*="stockOwned__"][class*="active__"]');
      const row=owned.length===1?owned[0].closest(rowSelector):null;
      const id=rowId(row);
      const priceText=row?.querySelector('[class*="stockPrice__"] [class*="price__"]')?.textContent;
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
    block.append(wrap);
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
      row.classList.toggle('slink-stock-filtered',(hidden.has(id)&&!showHidden)||!name.includes(search.value.trim().toLowerCase())||(wanted==='owned'&&owned!==true)||(wanted==='unowned'&&owned!==false));
      if(!id)continue;
      let label=row.querySelector('.slink-stock-detail');
      if(!label){
        label=element('div');label.className='slink-stock-detail';
        label.append(element('span'),button('Hide stock',e=>{e.stopPropagation();void toggle(id);}));
        row.append(label);
      }
      const h=holding(id), price=stock?.market?.price;
      const shares=h?.shares??0;
      const goal=stock&&model.threshold(stock.bonus?.requirement,shares,{passive:stock.bonus?.passive===true,cap:stock.acronym==='MCS'?10:Infinity});
      const msg=goal!=null&&price>0?`Next benefit: ${(goal-shares).toLocaleString()} more shares · estimated ${money((goal-shares)*price)} `:'';
      if(label.firstChild.textContent!==msg)label.firstChild.textContent=msg;
      const caption=hidden.has(id)?'Restore stock':'Hide stock';
      if(label.lastChild.textContent!==caption)label.lastChild.textContent=caption;
    }
    for(const block of root.querySelectorAll('[class*="stockDropdown__"] [class*="buyBlock__"],[class*="stockDropdown__"] [class*="sellBlock__"]'))attachTrade(block,block.className.includes('sellBlock__'));
  }
  function schedule(){if(!pending&&visible()){pending=true;requestAnimationFrame(scan);}}
  async function load(){
    if(loading)return;loading=true;status.textContent='Loading stock data…';
    try{
      const snapshot=await host.load();
      if(!Array.isArray(snapshot.holdings)||!Array.isArray(snapshot.market)||!snapshot.market.length)throw Error('Torn did not return stock data.');
      data=snapshot;
      status.textContent='Snapshot: '+new Date(data.fetchedAt).toLocaleTimeString()+'. Refresh after trading.';
      refreshDisplay();schedule();
    }catch(e){status.textContent=(e.message||'Could not load stocks.')+(data?' Showing the last snapshot.':'');}
    finally{loading=false;}
  }
  function mount(){
    if(!onPage()||!visible())return;
    const next=document.querySelector('#stockmarketroot');
    if(!next||next===root)return;
    observer?.disconnect();root=next;
    const style=element('style','.slink-stock-filtered{display:none!important}.slink-stocks-panel,.slink-stock-amount,.slink-stock-detail{padding:.45rem;line-height:1.5}.slink-stocks-panel button,.slink-stock-amount button,.slink-stock-detail button{padding:.2rem .45rem;margin:.2rem;color:inherit;background:transparent;border:1px solid currentColor;border-radius:.3rem}.slink-stock-amount input{max-width:8rem}.slink-stocks-panel{border:1px solid currentColor;border-radius:.4rem;margin:.5rem 0}');
    const panel=element('section');panel.className='slink-stocks-panel';panel.setAttribute('aria-label','SLINK Stocks tools');
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
    panel.append(element('strong','SLINK Stocks'),summary,picker,controls,search,ownership,savePreset,resetFilters,status,style);root.prepend(panel);
    observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});
    refreshDisplay();schedule();
  }
  void host.get().then(ids=>{hidden=new Set(Array.isArray(ids)?ids.filter(Number.isSafeInteger):[]);if(summary)refreshDisplay();schedule();}).catch(()=>{});
  const boot=new MutationObserver(()=>{mount();if(root)boot.disconnect();});
  mount();if(!root)boot.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{mount();schedule();});
})(globalThis);
