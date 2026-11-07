(function(g){
  'use strict';
  function options(raw){
    let value;
    try{value=JSON.parse(raw);}catch{return [];}
    if(!value||typeof value!=='object')return [];
    const rows=Object.entries(value).filter(([key])=>key!=='0').map(([key,remaining])=>({sessions:/^[1-9]\d*$/.test(key)?Number(key):NaN,remaining:typeof remaining==='number'?remaining:number(remaining)}));
    if(rows.some(r=>!Number.isSafeInteger(r.sessions)||!Number.isFinite(r.remaining)||r.remaining<0||r.remaining>100))return [];
    rows.sort((a,b)=>a.sessions-b.sessions);
    return rows.every((r,i)=>!i||r.remaining<=rows[i-1].remaining)?rows:[];
  }
  function number(raw){
    if(!/^\d+(?:\.\d{1,2})?$/.test(String(raw??'')))return null;
    const n=Number(raw);return Number.isSafeInteger(Math.round(n*100))?n:null;
  }
  function compare(rows,target,price,cash){
    const chosen=rows.find(r=>r.remaining<=target);
    const cost=r=>price>0&&Number.isSafeInteger(Math.round(r.sessions*price*100))?r.sessions*price:null;
    const offer=r=>r?{...r,cost:cost(r)}:null;
    const best=offer(chosen);
    const alternative=chosen?offer(rows.filter(r=>r.sessions<chosen.sessions).at(-1)):null;
    return {best,alternative,lowest:offer(rows.at(-1)),affordable:best?.cost!=null&&cash!=null?best.cost<=cash:null};
  }
  g.SLINK_REHAB_PREVIEW=Object.freeze({options,number,compare});
  if(!g.document||location.pathname!=='/index.php'||new URLSearchParams(location.search).get('page')!=='rehab')return;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
  const pct=new Intl.NumberFormat('en-US',{maximumFractionDigits:4});
  let anchor=null,panel=null,input=null,result=null,queued=false;
  function render(){
    if(!panel||document.visibilityState==='hidden')return;
    const root=document.querySelector('#rehub-progress');
    const source=root?.querySelector('.ui-slider[data-percentages]')??root?.querySelector('.range-slider-data[data-percentages]');
    const rows=options(source?.getAttribute('data-percentages'));
    const wrap=root?.closest('.rehab-progress-wrap')??root;
    const price=number(wrap?.querySelector('.money[data-cost]')?.getAttribute('data-cost')??document.querySelector('.rehab-progress-wrap .money[data-cost]')?.getAttribute('data-cost'));
    const cash=number(wrap?.querySelector('.money[data-money]')?.getAttribute('data-money')??document.querySelector('.rehab-progress-wrap .money[data-money]')?.getAttribute('data-money'));
    const target=number(input.value.trim());
    let line;
    const describe=r=>`${r.sessions.toLocaleString()} ${r.sessions===1?'session':'sessions'} · ${pct.format(r.remaining)}% on Torn’s remaining scale${r.cost==null?' · price unavailable':' · estimated '+money.format(r.cost)}`;
    if(target===null||target>100)line='Enter a target from 0% to 100%.';
    else if(!rows.length)line='Torn’s rehab options aren’t available to read. Use Torn’s own controls and quote.';
    else{
      const plan=compare(rows,target,price,cash);
      if(target===100)line='No session needed for a target of 100% on the remaining scale.';
      else if(!plan.best)line='No displayed option reaches that target. Lowest displayed: '+describe(plan.lowest)+'.';
      else line='Fewest sessions for this target: '+describe(plan.best)+'.'+
        (plan.affordable===false?' Above the cash shown by Torn.':'')+
        (plan.alternative?' Fewer sessions: '+describe(plan.alternative)+'.':'');
    }
    if(result.textContent!==line)result.textContent=line;
  }
  function sync(){
    queued=false;if(document.visibilityState==='hidden')return;
    const next=document.querySelector('.rehab-desc');
    if(!next){panel?.remove();panel=anchor=null;return;}
    if(anchor!==next||!panel?.isConnected){
      const value=input?.value??'0';
      panel?.remove();anchor=next;
      panel=el('section');panel.setAttribute('aria-label','SLINK Rehab guide');
      panel.style.cssText='margin:.5rem 0;padding:.65rem;border:1px solid currentColor;border-radius:.4rem;line-height:1.5';
      const label=el('label','Target remaining (%) ');
      input=el('input');input.inputMode='decimal';input.value=value;input.style.width='5rem';
      input.addEventListener('input',render);
      input.addEventListener('keydown',e=>{if(e.key==='Enter')e.preventDefault();});
      label.append(input);
      result=el('p');result.setAttribute('role','status');
      panel.append(el('strong','SLINK Rehab guide'),label,result,el('p','Compare fewer sessions if you’re comfortable leaving some addiction. Effectiveness can decline with repeat use. Check Torn’s final quote; SLINK does not change the slider or buy sessions.'));
      anchor.after(panel);
    }
    render();
  }
  const schedule=()=>{if(!queued&&document.visibilityState!=='hidden'){queued=true;requestAnimationFrame(sync);}};
  function start(){
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-percentages','data-cost','data-money']});
    document.addEventListener('visibilitychange',schedule);sync();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
