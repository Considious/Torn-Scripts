(function(g){
  'use strict';
  if(location.pathname!=='/city.php')return;
  const ext=g.SLINK_EXTENSION, pda=g.SLINK_PDA_BANK_PREVIEW;
  if(!ext&&!pda)return;
  const compare=pda?.compare??ext.core.moneyProperty.bankComparison;
  const load=pda?.load??(async()=> (await ext.core.messaging.send('bank.preview.load')).planner);
  const isBank=()=>new URLSearchParams(location.hash.replace(/^#\/?\??/,'')).get('p')==='bank';
  const create=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const format=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
  let panel=null,observer=null;
  function mount(target){
    if(panel?.parentNode===target)return;
    panel?.remove();
    const section=create('section');panel=section;section.setAttribute('aria-label','SLINK Bank comparison');
    section.style.cssText='margin:.5rem 0;padding:.65rem;border:1px solid currentColor;border-radius:.4rem;line-height:1.5';
    const label=create('label','Amount to compare ($) ');
    const input=create('input');input.inputMode='numeric';input.value='1000000';input.style.cssText='max-width:100%;width:10rem';
    label.append(input);
    const refresh=create('button','Load / refresh bank comparison');refresh.type='button';refresh.style.margin='.3rem';
    const status=create('p','Load your rates and bonuses to compare terms.');status.setAttribute('role','status');
    const details=create('p'), results=create('ul');
    let planner=null;
    function render(){
      results.replaceChildren();details.textContent='';
      if(!planner)return;
      const raw=input.value.trim();
      if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw)||Number(raw.replaceAll(',',''))>2000000000){
        details.textContent='Enter a whole dollar amount from $0 to $2 billion.';return;
      }
      const report=compare(planner,Number(raw.replaceAll(',','')));
      if(report.error){details.textContent=report.error;return;}
      details.textContent=`Bank interest merits: ${report.meritLevel}/10 · Bank stock bonus: ${report.stock.active?'active':'not active'}.`;
      for(const row of report.rows){
        results.append(create('li',row.available?
          `${row.label}: ${format.format(row.profit)} estimated interest · ${format.format(row.total)} at maturity · ${row.effectiveApr.toFixed(2)}% APR${row.days===report.best?' · best daily rate':''}`:
          `${row.label}: rate unavailable`));
      }
    }
    input.addEventListener('input',render);
    input.addEventListener('keydown',e=>{if(e.key==='Enter')e.preventDefault();});
    refresh.addEventListener('click',async()=>{
      refresh.disabled=true;status.textContent='Loading bank comparison…';
      try{
        const snapshot=await load();if(!snapshot)throw Error('Bank comparison is unavailable. Check Access and try again.');
        if(!section.isConnected||!isBank())return;
        planner=snapshot;render();
        status.textContent=[planner.fetchedAt?`Rates checked: ${new Date(planner.fetchedAt).toLocaleString()}.`:'Rate timestamp unavailable.',planner.error].filter(Boolean).join(' ');
      }catch(e){status.textContent=(e.message||'Bank comparison could not be loaded.')+(planner?' Showing the last loaded comparison.':'');}
      finally{refresh.disabled=false;}
    });
    section.append(create('strong','SLINK Bank comparison'),create('p','Estimates only. Torn pays interest at maturity. This does not change or submit an investment.'),label,refresh,status,details,results);
    target.prepend(section);
  }
  function sync(){
    if(!isBank()){observer?.disconnect();observer=null;panel?.remove();panel=null;return;}
    const target=document.querySelector('#mainContainer,.content-wrapper[role="main"],#mainwrap');
    if(target)mount(target);
    if(!observer&&document.body){observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});}
  }
  g.addEventListener('hashchange',sync);sync();
})(globalThis);
