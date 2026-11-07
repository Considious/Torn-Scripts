(function(g){
  'use strict';
  const q=new URLSearchParams(location.search),path=location.pathname;
  const kind=path==='/amarket.php'?'auction':path==='/factions.php'?'war':path==='/page.php'&&q.get('sid')==='racing'?'races':path==='/companies.php'?'company':path==='/profiles.php'?'profile':'';
  if(!kind)return;
  const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const button=(text,fn)=>{const n=make('button',text);n.type='button';n.onclick=fn;return n;};
  const txt=(row,sel)=>row.querySelector(sel)?.textContent.trim()||'';
  const num=text=>{const m=String(text??'').match(/[0-9][0-9,]*(?:\.\d+)?/);return m?Number(m[0].replaceAll(',','')):null;};
  const norm=v=>String(v??'').trim().toLowerCase();
  const profileId=row=>row.querySelector('a[href*="profiles.php?XID="]')?.getAttribute('href')?.match(/[?&]XID=(\d+)/i)?.[1];
  const marker='data-slink-extra-filtered';
  let mounted=null,scheduled=false;
  const sheet=make('style');sheet.textContent=`[${marker}]{display:none!important}`;
  function visible(node){return !!node?.getClientRects().length;}
  function listConfig(root){
    if(kind==='auction')return {title:'Filter auctions',rows:()=>root.querySelectorAll(':scope > li[id]:has(.item-name)'),fields:[
      ['search','Item or bonus',(row,v)=>norm(txt(row,'.item-name')+' '+Array.from(row.querySelectorAll('.iconsbonuses [title]'),n=>n.title.replace(/<[^>]*>/g,' ')).join(' ')).includes(v)],
      ['select','Ranked tier',(row,v)=>row.querySelector('.item-plate')?.className?.toLowerCase().includes(v),['yellow','orange','red']]
    ]};
    if(kind==='races')return {title:'Filter custom races',rows:()=>root.querySelectorAll(':scope > li:not(.clear):has(.event-wrap)'),fields:[
      ['search','Race or track',(row,v)=>norm(txt(row,'.event-wrap .name')+' '+txt(row,'.track')).includes(v)],
      ['number','Minimum laps',(row,v)=>{const n=num(txt(row,'.laps'));return n!==null&&n>=v;}],
      ['check','No password',(row)=>!row.classList.contains('protected')],
      ['check','Compatible car only',(row)=>!row.classList.contains('no-suitable')]
    ]};
    return {title:'Filter ranked war members',rows:()=>root.querySelectorAll('.members-list > li:has(a[href*="profiles.php?XID="])'),fields:[
      ['search','Name or player ID',(row,v)=>/^\[?\d+\]?$/.test(v)?profileId(row)===v.replace(/\D/g,''):Array.from(row.querySelectorAll('a[href*="profiles.php?XID="]')).some(a=>norm(a.textContent).includes(v))],
      ['select','War side',(row,v)=>row.classList.contains(v),['your','enemy'],['Your faction','Opponent']],
      ['search','Status',(row,v)=>norm(txt(row,'.status')).includes(v)],
      ['number','Minimum level',(row,v)=>{const n=num(txt(row,'.level'));return n!==null&&n>=v;}]
    ]};
  }
  function mountList(root){
    const spec=listConfig(root),box=make('details'),fields=make('div'),status=make('span');
    fields.style.cssText='display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:5px 0';
    status.setAttribute('role','status');
    const inputs=spec.fields.map(([type,label,filter,options,captions])=>{
      const n=make(type==='select'?'select':'input');
      if(type==='select'){
        for(const [i,value] of ['',...options].entries()){const o=make('option',i?(captions?.[i-1]||value):'Any '+label.toLowerCase());o.value=value;n.append(o);}
      }else{n.type=type;n.placeholder=label;if(type==='number'){n.min='0';n.style.width='8em';}}
      n.setAttribute('aria-label',label);
      n.addEventListener(type==='check'||type==='select'?'change':'input',apply);
      if(type==='check'){n.type='checkbox';const wrap=make('label',label+' ');wrap.append(n);fields.append(wrap);}else fields.append(n);
      return {type,n,filter};
    });
    fields.append(button('Reset',()=>{for(const {type,n} of inputs){if(type==='check')n.checked=false;else n.value='';}apply();}),status);
    box.append(make('summary',spec.title),fields);root.before(box);
    if(!sheet.isConnected)document.head.append(sheet);
    let marked=new Set();
    const observer=new MutationObserver(schedule);
    function clear(){for(const row of marked)row.removeAttribute(marker);marked.clear();}
    function apply(){
      if(!box.open||document.hidden)return;
      const rows=Array.from(spec.rows()),next=new Set();
      for(const row of rows)if(!inputs.every(({type,n,filter})=>{
        const value=type==='check'?n.checked:norm(n.value);
        return value===''||value===false||filter(row,type==='number'?Number(value):value);
      })){row.setAttribute(marker,'');next.add(row);}
      for(const row of marked)if(!next.has(row))row.removeAttribute(marker);marked=next;
      const message=(rows.length-next.size)+' of '+rows.length+' loaded';
      if(status.textContent!==message)status.textContent=message;
    }
    box.ontoggle=()=>{if(box.open){observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','title']});apply();}else{observer.disconnect();clear();}};
    return {root,box,update:apply,dispose(){observer.disconnect();clear();box.remove();}};
  }
  function mountCompany(root){
    const box=make('div'),status=make('span');status.setAttribute('role','status');
    const notes=new Map();
    const clear=()=>{for(const n of notes.values())n.remove();notes.clear();};
    box.append(button('Suggest stock order',()=>{
      clear();
      const cap=Array.from(root.querySelectorAll('.storage-capacity > [data-initial]'),n=>num(n.dataset.initial));
      const total=num(txt(root,'.stock-list > li.total .sold-daily'));
      const rows=Array.from(root.querySelectorAll('.stock-list > li:not(.total,.quantity)')).filter(r=>r.querySelector('.sold-daily')&&r.querySelector('input'));
      if(cap.length!==2||cap.some(v=>v===null)||cap[1]<cap[0]||!(total>0)||!rows.length){status.textContent=' Torn has not displayed enough sales and capacity data to suggest an order.';return;}
      let remaining=Math.floor(cap[1]-cap[0]),used=0;
      for(const row of rows){
        const sold=num(row.querySelector('.sold-daily').lastChild?.textContent);
        if(sold===null)continue;
        const qty=Math.min(remaining,Math.floor((cap[1]-cap[0])*sold/total));
        remaining-=qty;used+=qty;
        const note=make('small',' Suggested: '+qty.toLocaleString());note.dataset.slinkStockSuggestion='';row.querySelector('.sold-daily').append(note);notes.set(row,note);
      }
      status.textContent=' '+used.toLocaleString()+' units suggested from displayed sales and free storage. Enter and review the order in Torn.';
    }),status);
    (root.querySelector('.stock-list')||root.firstElementChild)?.before(box);
    const observer=new MutationObserver(records=>{
      if(notes.size&&records.some(r=>!box.contains(r.target)&&!(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].every(n=>n.matches?.('[data-slink-stock-suggestion]'))))){
        clear();status.textContent=' Stock data changed. Recalculate before ordering.';
      }
    });
    observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-initial']});
    return {root,box,dispose(){observer.disconnect();clear();box.remove();}};
  }
  function mountProfile(root){
    const box=make('details'),field=make('input'),status=make('strong');
    field.placeholder='Allied faction IDs, separated by commas';field.setAttribute('aria-label','Allied faction IDs');
    const key='slink-qol-allies.v1';
    try{field.value=localStorage.getItem(key)||'';}catch{}
    let revision=0,previous='';
    async function update(force=false){
      const a=document.querySelector('.user-info-value a[href*="/factions.php"]');
      const signature=location.href+'|'+a?.href+'|'+field.defaultValue;
      if(!force&&signature===previous)return;
      previous=signature;
      const seq=++revision;
      const id=a?new URL(a.href).searchParams.get('ID'):null;
      let own=null;
      try{
        if(g.SLINK_PDA_PLUGIN_API)own=String(g.SLINK_PDA_PLUGIN_API.factionOfficerIdentity?.()||'').split(':')[1];
        else{
          const session=await g.SLINK_EXTENSION?.core.storage.get('access.session.v1',null);
          if(session?.token&&session.expiresAt>Date.now())own=session.factionId;
        }
      }catch{}
      if(seq!==revision||!box.isConnected)return;
      const ids=String(field.defaultValue||'').split(',');
      const msg=id&&id===String(own)?'Warning: this player is in your faction.':id&&ids.includes(id)?'Warning: this player is in an allied faction.':'';
      if(status.textContent!==msg)status.textContent=msg;
      if(msg&&!box.open&&box.dataset.warned!==msg){box.open=true;box.dataset.warned=msg;}
    }
    field.defaultValue=field.value;
    status.setAttribute('role','status');status.style.display='block';
    box.append(make('summary','Friendly-fire warning'),status,field,button('Save allies',()=>{
      const ids=[...new Set(field.value.split(/[,\s]+/).filter(v=>/^[1-9]\d{0,9}$/.test(v)))].slice(0,100).join(',');
      try{localStorage.setItem(key,ids);field.defaultValue=field.value=ids;void update();}catch{status.textContent='Could not save allied factions on this device.';}
    }));
    root.append(box);void update();
    return {root,box,update,dispose(){revision++;box.remove();}};
  }
  function findRoot(){
    if(kind==='auction')return document.querySelector('.tabContent[aria-hidden="false"] .items-list');
    if(kind==='races')return document.querySelector('.custom-events-wrap .events-list');
    if(kind==='war')return Array.from(document.querySelectorAll('.descriptions .faction-war:has(.enemy-faction):has(.members-list)')).find(visible);
    if(kind==='company')return Array.from(document.querySelectorAll('form[action*="stock"]:has(.stock-list)')).find(visible);
    if(document.querySelector('.user-info-value a[href*="/factions.php"]'))return document.querySelector('.profile-left-wrapper');
  }
  function sync(){
    scheduled=false;if(document.hidden)return;
    const root=findRoot();
    if(mounted?.root!==root||!mounted?.box.isConnected){mounted?.dispose();mounted=root?(kind==='company'?mountCompany(root):kind==='profile'?mountProfile(root):mountList(root)):null;}
    else mounted?.update?.();
  }
  function schedule(){if(!scheduled&&!document.hidden){scheduled=true;requestAnimationFrame(sync);}}
  function start(){
    new MutationObserver(schedule).observe(document.querySelector('#mainContainer')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-hidden']});
    window.addEventListener('hashchange',schedule);document.addEventListener('visibilitychange',schedule);schedule();
    if(kind==='profile')window.addEventListener('focus',()=>mounted?.update(true));
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
