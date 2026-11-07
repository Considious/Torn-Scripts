(function(g){
  'use strict';
  const positive=n=>Number.isSafeInteger(n)&&n>0;
  function compare(rows,{days=0,happy=0}={}){
    const eligible=rows.filter(r=>positive(r?.cost)&&positive(r?.rental_period)&&(!happy||Number.isFinite(r.happy)&&r.happy>=happy));
    const summarize=values=>{
      const sorted=values.sort((a,b)=>a-b),n=sorted.length,m=n>>1;
      return n?{n,low:sorted[0],median:n%2?sorted[m]:(sorted[m-1]+sorted[m])/2,high:sorted[n-1]}:null;
    };
    return {daily:summarize(eligible.map(r=>r.cost/r.rental_period)),term:days?summarize(eligible.filter(r=>r.rental_period===days).map(r=>r.cost)):null};
  }
  g.SLINK_LEASE_COMPARE=Object.freeze({compare});
  if(!g.document||location.pathname!=='/properties.php')return;
  const ext=g.SLINK_EXTENSION,pda=g.SLINK_PDA_PLUGIN_API,scope='slink.qol.money-property';
  if(!ext&&!pda)return;
  async function request(type){
    if(!pda)return ext.core.messaging.send('qol.leaseCompare',{type});
    const session=await pda.ensurePermission(false),owner=String(session?.userId??session?.user_id??'');
    if(!owner||!pda.hasScope(scope))throw Error('Money & Property access is required.');
    const result=await pda.tornJson(type?'/v2/market/'+type+'/rentals?limit=50':'/v2/torn/properties','SLINK Lease comparison');
    if(String(pda.accountId?.()||'')!==owner||!pda.hasScope(scope))throw Error('SLINK access changed.');
    return result;
  }
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
  const labelled=(label,input)=>{const n=el('label',label+' ');input.setAttribute('aria-label',label);n.append(input);return n;};
  const currency=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  let mounted,queued=false;
  function mount(root){
    const panel=el('details'),bar=el('div'),status=el('p'),results=el('div');
    panel.style.cssText='padding:.5rem;margin:.5rem 0;border:1px solid currentColor;border-radius:.35rem';
    bar.style.cssText='display:flex;gap:6px;flex-wrap:wrap;align-items:center';
    status.setAttribute('role','status');
    const type=el('select'),days=el('input'),happy=el('input');
    for(const n of [days,happy]){n.type='number';n.min='0';n.step='1';n.style.width='6em';n.oninput=render;}
    const placeholder=el('option','Select property type');placeholder.value='';type.append(placeholder);
    let sample=null,busy=false,loaded=false;
    type.onchange=()=>{sample=null;results.replaceChildren();status.textContent='';market.disabled=!type.value;};
    function render(){
      if(!sample||Number(type.value)!==sample.type)return;
      const d=Number(days.value),h=Number(happy.value);
      const {daily,term}=compare(sample.rows,{days:positive(d)?d:0,happy:positive(h)?h:0});
      const display=(label,data)=>el('p',data?`${label}: ${currency(data.median)} median · ${currency(data.low)}–${currency(data.high)} · ${data.n} listings`:`${label}: no matching listings in this sample.`);
      results.replaceChildren(display('Rent per day',daily),...(positive(d)?[display(d+' days, upfront rent',term)]:[]),
        el('small','Asking prices from one market page; not completed leases. Rent figures exclude upkeep and staff fees. Compare upgrades separately.'));
    }
    const load=button('Load property types',async event=>{
      if(!event.isTrusted||busy||loaded)return;
      busy=true;load.disabled=true;status.textContent='Loading property types…';
      try{
        const response=await request(0);
        const types=(Array.isArray(response?.properties)?response.properties:[]).filter(r=>positive(r?.id)&&typeof r.name==='string'&&r.name.trim());
        if(!types.length)throw Error('Torn did not return property types.');
        for(const row of types){const option=el('option',row.name);option.value=row.id;type.append(option);}
        loaded=true;load.hidden=true;status.textContent='Choose a property type to compare.';
      }catch(error){status.textContent=error.message||'Could not load property types.';}
      finally{busy=false;load.disabled=false;}
    });
    const market=button('Compare rental listings',async event=>{
      const id=Number(type.value);if(!event.isTrusted||busy||!positive(id))return;
      busy=true;market.disabled=type.disabled=true;sample=null;results.replaceChildren();status.textContent='Loading listings…';
      try{
        const response=await request(id),rows=response?.rentals?.listings;
        if(!Array.isArray(rows))throw Error('Torn did not return rental listings.');
        sample={type:id,rows:rows.slice(0,50)};
        const timestamp=Number(response.rentals_timestamp);
        status.textContent=timestamp>0?'Market snapshot: '+new Date(timestamp*1000).toLocaleString()+'.':'Loaded a sample of current asking prices.';
        render();
      }catch(error){status.textContent=error.message||'Could not load rental listings.';}
      finally{busy=false;type.disabled=false;market.disabled=!type.value;}
    });
    market.disabled=true;
    bar.append(load,labelled('Property',type),labelled('Lease days (optional)',days),labelled('Minimum happiness (optional)',happy),market);
    panel.append(el('summary','SLINK rental comparison'),bar,status,results);
    const tabs=root.querySelector('.properties-tabs');if(tabs)tabs.after(panel);else root.prepend(panel);
    return {root,panel};
  }
  function sync(){
    queued=false;if(document.hidden)return;
    const root=document.querySelector('#properties-page-wrap');
    if(root&&mounted?.root===root&&mounted.panel.isConnected)return;
    mounted?.panel.remove();mounted=root?mount(root):null;
  }
  function schedule(){if(!queued&&!document.hidden){queued=true;requestAnimationFrame(sync);}}
  function start(){
    new MutationObserver(()=>{if(!mounted?.panel.isConnected)schedule();}).observe(document.querySelector('#mainContainer')||document.body,{childList:true,subtree:true});
    document.addEventListener('visibilitychange',schedule);sync();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
