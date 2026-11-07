(function(g){
  'use strict';
  if(location.pathname!=='/factions.php'||new URLSearchParams(location.search).get('step')!=='your')return;
  const ext=g.SLINK_EXTENSION,pda=g.SLINK_PDA_PLUGIN_API;
  if(!ext&&!pda?.armoryFilter)return;
  const scope='slink.officer.armory', keys={mode:'war.armory.mode.v1',protected:'war.armory.whitelist.v1',roster:'war.armory.memberCache.v1'};
  const modes=[['ranked-all','All ranked items'],['ranked-no-prof','Ranked except Proficience'],['proficience-15-plus','Proficience from level 15+']];
  const focused=()=>!document.hidden&&document.hasFocus();
  const tab=()=>location.hash.includes('tab=armoury')?Array.from(document.querySelectorAll('[id="tab=armoury&sub=weapons"],[id="tab=armoury&sub=armour"]')).find(n=>n.getAttribute('aria-hidden')!=='true'&&n.getClientRects().length):null;
  const storage=ext?.core.storage;
  const read=async()=>{
    if(pda)return pda.armoryFilter.read();
    const session=await storage.get('access.session.v1',null);
    if(!session?.token||!session.userId||!session.factionId||!(session.expiresAt>Date.now())||!ext.core.permissions.hasScope(session,scope))return null;
    const [mode,protectedIds,roster]=await Promise.all([storage.get(keys.mode,'ranked-all'),storage.get(keys.protected,[]),storage.get(keys.roster,{})]);
    const owner=session.userId+':'+session.factionId;
    // Old, unbound roster entries must not drive a recall after an account/faction change.
    return {owner,mode,protectedIds,members:roster.owner===owner?roster.members:[]};
  };
  const save=(key,value)=>pda?pda.armoryFilter.save(key,value):storage.set(keys[key],value);
  const load=async owner=>{
    if(pda)return pda.armoryFilter.load();
    const response=await ext.core.messaging.send('faction.officer.armory.roster');
    if((await read())?.owner!==owner)throw Error('Armory access changed. Reopen the filter.');
    const members=Array.isArray(response?.members)?response.members:[];
    await storage.set(keys.roster,{owner,members,savedAt:response.fetchedAt||Date.now()});
    return members;
  };
  const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const btn=(text,fn)=>{const n=make('button',text);n.type='button';n.onclick=fn;return n;};
  const input=(label,type='search')=>{const n=make('input');n.type=type;n.setAttribute('aria-label',label);if(type==='search')n.placeholder=label;return n;};
  const retrieveSelector='.item-action [data-role="retrieve"].active';
  const marker='data-slink-armory-filtered',pick='data-slink-armory-recall-choice';
  const style=make('style');style.textContent=`[${marker}]{display:none!important}[${pick}]{outline:2px solid #e7ac48;outline-offset:-2px}`;
  let mounted,lastRoot,queued=false,syncId=0;
  function mount(root,prefs){
    const box=make('details');box.style.cssText='padding:6px;margin:6px 0;border:1px solid currentColor;border-radius:5px';
    const bar=make('div'),status=make('p');bar.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px';status.setAttribute('role','status');
    const search=input('Item or borrower'),only=input('Show recall candidates only','checkbox'),onlyLabel=make('label','Recall candidates only ');
    onlyLabel.append(only);
    const mode=make('select');mode.setAttribute('aria-label','Recall mode');
    for(const [value,text] of modes){const o=make('option',text);o.value=value;mode.append(o);}
    mode.value=modes.some(([v])=>v===prefs.mode)?prefs.mode:'ranked-all';
    let members=Array.isArray(prefs.members)?prefs.members:[], protectedIds=new Set((Array.isArray(prefs.protectedIds)?prefs.protectedIds:[]).map(String)),working=false,chosen=null,frame=0,marked=new Set(),choices=[];
    const submitted=new WeakMap();
    const manager=make('details'),memberSearch=input('Search member, rank, or ID'),memberList=make('div');
    memberList.style.cssText='max-height:13em;overflow:auto';
    const summary=make('summary');
    const filtered=()=>members.filter(m=>[m.name,m.rank,m.id].join(' ').toLowerCase().includes(memberSearch.value.trim().toLowerCase()));
    async function persist(key,value){
      if((await read())?.owner!==prefs.owner)throw Error('Armory access changed.');
      await save(key,value);
    }
    function paintMembers(){
      summary.textContent='Never retrieve from ('+protectedIds.size+')';
      memberList.replaceChildren(...filtered().map(m=>{
        const label=make('label'),check=input('Protect '+m.name,'checkbox');label.style.display='block';check.checked=protectedIds.has(String(m.id));
        check.onchange=()=>void protect([m],check.checked);
        label.append(check,document.createTextNode(' '+m.name+' · '+(m.rank||'Member')+' · level '+(m.level||'?')+' · '+m.id));return label;
      }));
      if(!members.length)memberList.textContent='Load faction members to manage the protected list.';
    }
    async function protect(rows,on){
      if(working)return;
      const next=new Set(protectedIds);
      for(const m of rows)if(on)next.add(String(m.id));else next.delete(String(m.id));
      working=true;
      try{await persist('protected',[...next]);protectedIds=next;update();}
      catch(error){status.textContent=error.message;}
      finally{working=false;paintMembers();}
    }
    const refresh=btn('Load faction members',async()=>{
      if(working||!focused()||(await read())?.owner!==prefs.owner)return;
      working=true;refresh.disabled=true;
      try{members=await load(prefs.owner);paintMembers();update();}
      catch(error){status.textContent=error.message;}
      finally{working=false;refresh.disabled=false;}
    });
    manager.append(summary,memberSearch,refresh,btn('Protect shown',()=>void protect(filtered(),true)),btn('Unprotect shown',()=>void protect(filtered(),false)),memberList);
    memberSearch.oninput=paintMembers;
    const recall=btn('Recall next',async event=>{
      if(!event.isTrusted||working||!focused()||tab()!==root)return;
      working=true;recall.disabled=true;
      let opened=false;
      try{
        const current=await read();
        if(current?.owner!==prefs.owner||!focused()||tab()!==root||!box.open||current.mode!==mode.value)return;
        const currentProtected=new Set((Array.isArray(current.protectedIds)?current.protectedIds:[]).map(String));
        const candidate=choices.find(({row,id})=>row.isConnected&&root.contains(row)&&row.getClientRects().length&&
          eligibility(row,current.mode,currentProtected)===id&&submitted.get(row)!==id);
        if(!candidate){status.textContent='No eligible visible items. Check the filters or load the faction roster.';return;}
        if(Array.from(root.querySelectorAll('.retrieve-cont .retrieve-yes')).some(n=>n.getClientRects().length)){
          status.textContent='Finish or cancel the open Torn recall first.';return;
        }
        const control=candidate.row.querySelector(retrieveSelector);
        if(!control?.getClientRects().length||control.disabled||control.getAttribute('aria-disabled')==='true')return;
        chosen?.removeAttribute(pick);chosen=candidate.row;chosen.setAttribute(pick,'');
        opened=true;control.click();
        candidate.row.scrollIntoView({block:'nearest'});
        for(let attempt=0;attempt<20;attempt++){
          await new Promise(resolve=>setTimeout(resolve,50));
          if(!focused()||tab()!==root||!box.isConnected||!box.open||!candidate.row.isConnected||!root.contains(candidate.row)||borrowerId(candidate.row)!==candidate.id)
            throw Error('The page or loan changed before confirmation.');
          const confirm=candidate.row.querySelector('.retrieve-cont .retrieve-yes');
          if(!confirm?.getClientRects().length||confirm.disabled||confirm.getAttribute('aria-disabled')==='true')continue;
          const latest=await read();
          if(latest?.owner!==prefs.owner||latest.mode!==current.mode||(latest.protectedIds||[]).map(String).includes(candidate.id)||
            !focused()||tab()!==root||!box.isConnected||!box.open||!root.contains(candidate.row)||borrowerId(candidate.row)!==candidate.id||
            !candidate.row.contains(confirm)||!confirm.getClientRects().length||confirm.disabled||confirm.getAttribute('aria-disabled')==='true')
            throw Error('Access, filters, or the loan changed before confirmation.');
          submitted.set(candidate.row,candidate.id);
          confirm.click();
          status.textContent='One recall submitted to Torn.';
          return;
        }
        throw Error('Torn did not show the recall confirmation.');
      }catch(error){status.textContent=error.message+(opened?' SLINK did not confirm the recall.':'');}
      finally{working=false;recall.disabled=!choices.some(({row,id})=>row.isConnected&&submitted.get(row)!==id);schedule();}
    });
    const borrowerId=row=>row.querySelector('.loaned a[href*="XID="]')?.getAttribute('href')?.match(/[?&]XID=(\d+)/i)?.[1];
    function eligibility(row,selection,excluded){
      const id=borrowerId(row);
      const ranked=row.querySelector('.img-wrap img.torn-item:is(.glow-yellow,.glow-orange,.glow-red)');
      if(!id||excluded.has(id)||!ranked||!row.querySelector(retrieveSelector))return null;
      const prof=!!row.querySelector('.bonus-attachment-experience');
      if(selection==='ranked-no-prof'&&prof)return null;
      if(selection==='proficience-15-plus'&&(!root.id.endsWith('sub=weapons')||!prof||!members.some(m=>String(m.id)===id&&Number(m.level)>=15)))return null;
      return modes.some(([v])=>v===selection)?id:null;
    }
    function update(){
      frame=0;if(!box.open||!focused())return;
      const q=search.value.trim().toLowerCase(),next=new Set();choices=[];
      for(const row of root.querySelectorAll('ul.item-list > li')){
        const item=row.querySelector('.name');if(!item)continue;
        const borrower=row.querySelector('.loaned a[href*="XID="]');
        const id=eligibility(row,mode.value,protectedIds);
        const match=(!q||[item.textContent,borrower?.textContent,borrower?.getAttribute('href')?.match(/[?&]XID=(\d+)/i)?.[1]].join(' ').toLowerCase().includes(q));
        if(match&&id)choices.push({row,id});
        if((!match||(only.checked&&!id))&&row!==chosen){row.setAttribute(marker,'');next.add(row);}
      }
      for(const row of marked)if(!next.has(row))row.removeAttribute(marker);
      marked=next;recall.disabled=working||!choices.some(({row,id})=>submitted.get(row)!==id);
    }
    function schedule(){if(box.open&&!frame&&focused())frame=requestAnimationFrame(update);}
    const observer=new MutationObserver(schedule);
    mode.onchange=async()=>{
      try{await persist('mode',mode.value);update();}
      catch(error){status.textContent=error.message;}
    };
    search.oninput=only.onchange=update;
    const clear=()=>{observer.disconnect();cancelAnimationFrame(frame);frame=0;for(const row of marked)row.removeAttribute(marker);marked.clear();chosen?.removeAttribute(pick);chosen=null;};
    box.ontoggle=()=>{if(box.open){observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','href','aria-disabled']});schedule();}else clear();};
    bar.append(search,onlyLabel,mode,recall,btn('Reset filter',()=>{search.value='';only.checked=false;update();}));
    box.append(make('summary','Armory filter & recaller'),bar,status,manager);
    if(!style.isConnected)document.head.append(style);
    root.prepend(box);paintMembers();
    return {root,box,owner:prefs.owner,dispose(){clear();box.remove();},schedule};
  }
  async function sync(){
    queued=false;const seq=++syncId,root=tab();lastRoot=root;
    let prefs=null;
    if(root)try{prefs=await read();}catch{}
    if(seq!==syncId)return;
    if(!prefs||!root||mounted?.root!==root||mounted.owner!==prefs.owner||!mounted.box.isConnected){mounted?.dispose();mounted=null;}
    if(prefs&&root?.isConnected&&tab()===root&&!mounted)mounted=mount(root,prefs);
    else mounted?.schedule();
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(()=>void sync());}}
  const start=()=>{
    new MutationObserver(()=>{if(lastRoot!==tab()||mounted&&!mounted.box.isConnected)schedule();}).observe(document.querySelector('#mainContainer')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-hidden']});
    window.addEventListener('hashchange',schedule);window.addEventListener('focus',schedule);document.addEventListener('visibilitychange',schedule);
    if(ext)g.chrome?.storage?.onChanged?.addListener(changes=>{if(['access.session.v1','permissions.snapshot'].some(k=>Object.hasOwn(changes,storage.fullKey(k))))schedule();});
    schedule();
  };
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
