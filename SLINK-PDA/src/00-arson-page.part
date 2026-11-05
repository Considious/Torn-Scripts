// Read visible Torn controls only. No network or game actions.
(function installArsonPage(global){
  'use strict';
  const rowSelector='.virtual-item';
  const prefix=name=>'[class^="'+name+'___"],[class*=" '+name+'___"]';
  const actionPhases={breach:'inquired',place:'preparation',ignite:'preparation',stoke:'burning',dampen:'burning',collect:'collection'};
  const clean=value=>String(value||'').trim().replace(/\s+/g,' ');
  function parseDamageRequirement(value){
    const label=clean(value);
    if(/^total destruction required$/i.test(label))return {kind:'total',min:100,max:100,label};
    const single=label.match(/^(less|more) than (\d+(?:\.\d+)?)% damage required$/i);
    if(single){
      const value=Number(single[2]);if(value<0||value>100)return null;
      return single[1].toLowerCase()==='less'?{kind:'maximum',max:value,label}:{kind:'minimum',min:value,label};
    }
    const range=label.match(/^between (\d+(?:\.\d+)?)% and (\d+(?:\.\d+)?)% damage required$/i);
    if(!range)return null;
    const min=Number(range[1]),max=Number(range[2]);
    return min<max&&max<=100?{kind:'range',min,max,label}:null;
  }
  function damagePosition(damage,bounds){
    if(!bounds||!Number.isFinite(damage)||damage<0||damage>100)return 'unknown';
    if(bounds.kind==='maximum')return damage<bounds.max?'within':'above';
    if(bounds.kind==='minimum')return damage>bounds.min?'within':'below';
    if(bounds.kind==='total')return damage===100?'within':'below';
    if(bounds.kind!=='range')return 'unknown';
    if(damage<bounds.min)return 'below';
    if(damage>bounds.max)return 'above';
    // The capture establishes the wording but does not prove inclusive endpoints.
    return damage===bounds.min||damage===bounds.max?'boundary':'within';
  }
  function readRequests(container){
    const groupSelector=prefix('requestIcons');
    const groups=[...container.querySelectorAll(groupSelector)];
    if(container.matches?.(groupSelector))groups.unshift(container);
    const labels=[...new Set(groups.flatMap(group=>[...group.querySelectorAll('[role="img"][aria-label]')]
      .map(icon=>clean(icon.getAttribute('aria-label')))).filter(Boolean))];
    const context=[],requirements=[];
    for(const label of labels){
      const damage=parseDamageRequirement(label);
      if(damage){requirements.push({kind:'damage',limit:damage,label});continue;}
      const family=label.match(/^accelerant requested: (liquids?|solids?|gaseous|gases|gas)$/i)?.[1]?.toLowerCase();
      if(family){requirements.push({kind:'family',family:family.startsWith('liquid')?'liquid':family.startsWith('solid')?'solid':'gas',label});continue;}
      const visibility=label.match(/^(high|low)[ -]visibility fire requested$/i)?.[1]?.toLowerCase();
      if(visibility){requirements.push({kind:'visibility',level:visibility,label});continue;}
      if(/^accidental cause requested$/i.test(label)){requirements.push({kind:'accidental',label});continue;}
      if(/^insurance claim required$/i.test(label)){requirements.push({kind:'insurance',label});continue;}
      if(/^(fraud|business|criminal|cover-up|intimidation|ideological|vendetta)$/i.test(label)){context.push(label);continue;}
      requirements.push({kind:'unknown',label});
    }
    return {labels,context,requirements};
  }
  function readPicker(container){
    const selector=prefix('itemSelector');
    const picker=container?.matches?.(selector)?container:container?.querySelector?.(selector);
    if(!picker)return [];
    const rows=[];
    for(const group of picker.querySelectorAll(prefix('group'))){
      const family={igniters:'igniter',liquids:'liquid',solids:'solid',gases:'gas',dampeners:'dampener'}[clean(group.querySelector(prefix('heading'))?.textContent).toLowerCase()];
      if(!family||typeof family!=='string')continue;
      for(const wrap of group.querySelectorAll(prefix('itemCellWrap'))){
        const button=[...wrap.children].find(node=>node.matches?.('button[aria-label]'));
        if(!button)continue;
        const label=clean(button.getAttribute('aria-label'));
        const blocked=button.disabled||button.getAttribute('aria-disabled')==='true';
        const locked=/^item locked$/i.test(label);
        const owned=label.match(/^(.+?) ([\d,]+) owned$/i);
        const quantity=owned?Number(owned[2].replaceAll(',','')):null;
        const phaseBlocked=label.match(/^(.+?) (Igniting|Dampening|Stoking|Placing) is unavailable at this stage$/i);
        rows.push({family,name:owned?.[1]||phaseBlocked?.[1]||null,ownedQty:Number.isSafeInteger(quantity)?quantity:null,
          locked:locked?true:owned||phaseBlocked?false:null,
          selectable:blocked||locked||quantity===0?false:owned&&Number.isSafeInteger(quantity)&&button.getAttribute('aria-disabled')==='false'?true:null,
          disabledReason:blocked?phaseBlocked?phaseBlocked[2]+' is unavailable at this stage':label||null:null});
      }
    }
    return rows;
  }
  function readJob(row) {
    const title=row.querySelector(prefix('titleAndScenario'));
    const commit=row.querySelector('button.commit-button');
    if(!title||!commit)return null;
    const action=clean(commit.querySelector(prefix('title'))?.textContent).toLowerCase();
    if(!Object.hasOwn(actionPhases,action))return null;
    const meter=row.querySelector('[role="meter"][aria-label="Damage"]');
    const raw=meter?.getAttribute('aria-valuenow');
    const damage=raw!=null&&raw.trim()!==''&&Number.isFinite(Number(raw))&&Number(raw)>=0&&Number(raw)<=100?Number(raw):null;
    const nerveText=clean(commit.querySelector(prefix('nerve'))?.textContent);
    const label=clean(commit.getAttribute('aria-label'));
    const blocked=commit.disabled||commit.getAttribute('aria-disabled')==='true';
    const item=[...row.querySelectorAll('button[aria-expanded][aria-label]')]
      .find(button=>button.matches(prefix('itemButton')));
    const selected=clean(item?.getAttribute('aria-label')).match(/^(.+) selected$/i)?.[1]||null;
    // The native name is a direct text node; injected scenario badges are nested elements.
    const name=clean([...title.firstElementChild?.childNodes||[]].filter(node=>node.nodeType===3).map(node=>node.textContent).join(''));
    const {labels:requestLabels,context,requirements}=readRequests(row);
    const limits=[...new Map(requestLabels.map(parseDamageRequirement).filter(Boolean).map(({label,...limit})=>[JSON.stringify(limit),{...limit,label}])).values()];
    return {name:name||null,scenario:clean(title.querySelector(prefix('scenario'))?.textContent)||null,
      action,phase:actionPhases[action],damage,nerveCost:/^\d+$/.test(nerveText)?Number(nerveText):null,
      usable:blocked?false:commit.getAttribute('aria-disabled')==='false'?true:null,
      disabledReason:blocked?label||null:null,selected,
      requestLabels,context,requirements,bounds:limits.length===1?limits[0]:null,ownedQty:null};
  }
  function guidance(job,previousDamage=null){
    if(!job)return 'Current job state is not confirmed.';
    const position=damagePosition(job.damage,job.bounds);
    const parts=[];
    if(job.usable===false)parts.push(job.disabledReason||'Torn currently has this action disabled.');
    if(job.bounds){
      parts.push(job.bounds.label+'.');
      if(position==='above')parts.push('Displayed damage has reached or passed the disallowed limit. Do not add fuel to fix an overshoot.');
      else if(position==='boundary')parts.push('Displayed damage is on the range boundary; exact endpoint behavior is not confirmed.');
      else if(position==='within')parts.push('Displayed damage meets this damage target; this does not confirm job success.');
      else if(position==='below')parts.push('Displayed damage has not reached the target.');
    }
    for(const requirement of job.requirements||[]){
      if(requirement.kind==='damage')continue;
      if(requirement.kind==='family')parts.push('Use only '+requirement.family+' accelerants; other job requirements still apply.');
      else parts.push(requirement.label+' — not yet verified by the helper.');
    }
    if(job.phase==='burning'){
      const rising=Number.isFinite(previousDamage)&&Number.isFinite(job.damage)&&job.damage>previousDamage;
      if(rising)parts.push('Damage rose from '+previousDamage+'% to '+job.damage+'% since the last observed change.');
      if(job.bounds?.kind==='maximum'||job.bounds?.kind==='range'){
        if(Number.isFinite(job.damage)&&job.damage<job.bounds.max)parts.push((Math.round((job.bounds.max-job.damage)*100)/100)+' percentage points to the upper limit.');
        if(rising&&position==='within')parts.push('Hold off on stoking. Recheck the next damage reading; consider dampening if damage keeps closing in on the cap and Torn allows it.');
        else parts.push('Damage may keep rising while the fire burns. Avoid adding fuel near the cap; reassess before deciding whether to wait or dampen.');
      }else parts.push(rising?'Reassess after that increase before spending nerve to stoke.':'The current reading alone cannot tell whether to stoke or wait.');
      parts.push(job.bounds?.kind==='maximum'||job.bounds?.kind==='range'
        ? 'Residual burn and usable dampeners are not confirmed.' : 'Residual burn is not confirmed.');
    }else if(job.action==='collect')parts.push('Torn shows Collect; check the remaining requirements and whether the action is enabled.');
    else if(!job.bounds)parts.push('Read the current job requirements before choosing a material. Compatible recipes are not confirmed yet.');
    return parts.join(' ');
  }
  const signature=job=>JSON.stringify([job.name,job.scenario,[...job.requestLabels].sort()]);
  const RECIPE_SLOT_MS=12*60*60*1000;
  function recipeJournal({load,save}){
    let queue=Promise.resolve();
    async function current(){return (await load())||{};}
    function update(change){
      const task=queue.catch(()=>{}).then(async()=>{const old=await current(),next=change(old);if(next!==old)await save(next);return next;});
      queue=task;return task;
    }
    return {
      async find(crime,key){return (await current())[crime]?.find(record=>record.key===key)||null;},
      async candidates(crime,key){return ((await current())[crime]||[]).filter(record=>record.key===key);},
      record(crime,key,steps,owner=null){return update(old=>{
        const rows=old[crime]||[],formula=JSON.stringify(steps),prior=rows.find(row=>row.key===key&&JSON.stringify(row.steps)===formula);
        const record={key,steps,successes:(prior?.successes||0)+1,observedAt:Date.now()};
        const next={...old,[crime]:[record,...rows.filter(row=>row!==prior)].slice(0,60)};
        if(owner){
          const sharing=old.sharing?.owner===owner?old.sharing:{owner,pending:[]};
          const duplicate=sharing.pending.some(row=>row.crime===crime&&row.key===key&&JSON.stringify(row.steps)===formula);
          if(!duplicate&&sharing.pending.length<120)next.sharing={...sharing,pending:[...sharing.pending,{id:global.crypto.randomUUID(),crime,key,steps}]};
        }
        return next;
      });},
      discard(){return update(old=>{if(!old.sharing)return old;const {sharing,...next}=old;return next;});},
      sync(owner,send,allowed=()=>true,now=Date.now){
        const task=queue.catch(()=>{}).then(async()=>{
          if(!owner||!await allowed())return;
          const old=await current(),sharing=old.sharing,slot=Math.floor(now()/RECIPE_SLOT_MS);
          if(sharing?.owner!==owner||!sharing.pending.length||sharing.lastSlot===slot||Number(sharing.retryAt)>now())return;
          const batch=sharing.batch&&sharing.batch.slot>=slot-6?sharing.batch:{slot,records:sharing.pending.slice(0,20)};
          const sending={...sharing,batch,retryAt:now()+15*60*1000};
          await save({...old,sharing:sending});
          if(!await allowed())return;
          let reply;
          try{reply=await send({schema:1,...batch});}catch(error){
            if(Number(error?.status)===409)await save({...old,sharing:{...sending,batch:null,lastSlot:slot}});
            return;
          }
          const ids=batch.records.map(row=>row.id);
          if(reply?.ok!==true||reply.slot!==batch.slot||!Array.isArray(reply.accepted)||reply.accepted.length!==ids.length||ids.some(id=>!reply.accepted.includes(id)))return;
          await save({...old,sharing:{...sending,batch:null,pending:sharing.pending.filter(row=>!ids.includes(row.id)),lastSlot:slot,retryAt:0}});
        });
        queue=task;return task;
      }
    };
  }
  function liveOutcome(row){
    return row.querySelector('[class*="entered___"] .outcome-content');
  }
  function captureArson({record,now=Date.now}){
    const runs=new Map();
    function inspect(row,job){
      const run=runs.get(row),pending=run?.pending;
      if(!run)return;
      if(!job||job.name!==run.name||job.scenario!==run.scenario){runs.delete(row);return;}
      if(job.requestLabels.length)run.key=signature(job);
      if(!pending)return;
      if(now()-pending.at>15000){runs.delete(row);return;}
      const result=liveOutcome(row);
      if(!result||clean(result.textContent)===pending.previousText)return;
      if(!result.matches('.crimes-outcome-success')){runs.delete(row);return;}
      if(pending.action==='collect'){
        if(!/already collected your reward/i.test(job.disabledReason||'')||!result.querySelector(prefix('reward')))return;
        runs.delete(row);
        if(run.steps.some(step=>step.action==='ignite'))return record('arson',run.key,run.steps);
      }else{
        run.pending=null;
        if(pending.action!=='breach'){
          run.steps.push({action:pending.action,item:pending.item,damageBefore:pending.damage});
          if(run.steps.length>24)runs.delete(row);
        }
      }
    }
    return {inspect,forget:row=>runs.delete(row),clear:()=>runs.clear(),click(row,job){
      if(!job?.usable||!job.name||!job.scenario)return;
      if(job.action==='breach')runs.set(row,{name:job.name,scenario:job.scenario,key:signature(job),steps:[]});
      const run=runs.get(row);if(!run)return;
      if(run.pending||run.name!==job.name||run.scenario!==job.scenario||
        (job.action==='collect'?job.nerveCost!==2:job.action!=='breach'&&(!job.selected||job.damage===null))){runs.delete(row);return;}
      const result=liveOutcome(row);
      run.pending={action:job.action,item:job.selected,damage:job.damage,previousText:clean(result?.textContent),at:now()};
    }};
  }
  function mount({root,enabled=false,eligible=()=>false,focused,journal,stockCache={}}={}){
    if(!enabled||!root)return ()=>{};
    const doc=root.ownerDocument;
    const controls=new Map();
    const ledger=global.SLINK_ARSON_LEDGER;
    const planner=global.SLINK_EXTENSION?.core.arsonAdvice||global.SLINK_ARSON_ADVICE;
    const stockKey='slink.arson.picker-stock.v1';
    let inventory=stockCache.items,watchedPicker=null,pickerObserver=null;
    if(!inventory){try{inventory=new Map(JSON.parse(global.sessionStorage.getItem(stockKey)||'[]'));}catch{inventory=new Map();}stockCache.items=inventory;}
    function saveInventory(){try{global.sessionStorage.setItem(stockKey,JSON.stringify([...inventory]));}catch{}}
    let portal=null,portalRoot=null,opened=null,leaveTimer=null;
    let observer=null,frame=null,disposed=false;
    const capture=journal&&captureArson({record:(...args)=>journal.record(...args)});
    function onAction(event){
      if(!active()||!event.isTrusted)return;
      const button=event.target.closest?.('button.commit-button'),row=button?.closest(rowSelector);
      if(!row||!root.contains(row)||row.querySelector('button.commit-button')!==button)return;
      const job=readJob(row);
      if(job?.usable&&['place','ignite','stoke','dampen'].includes(job.action)){
        const item=planner?.materials?.[job.selected],stock=inventory.get(job.selected);
        // Conservatively account for a potentially consumed item until the next picker read.
        if(item?.consumed&&Number.isSafeInteger(stock?.ownedQty)&&stock.ownedQty>0){inventory.set(job.selected,{...stock,ownedQty:stock.ownedQty-1});saveInventory();}
      }
      capture.inspect(row,job)?.catch(()=>{});
      capture.click(row,job);
    }
    if(capture)root.addEventListener('click',onAction,true);
    const active=()=>!disposed&&eligible()&&!doc.hidden&&(focused?focused():doc.hasFocus());
    function close(entry){entry.pinned=false;entry.card.hidden=true;entry.button.setAttribute('aria-expanded','false');if(opened===entry)opened=null;if(ledger)entry.card.remove();}
    function remove(entry){entry.cancelPress?.();entry.detach?.();close(entry);entry.wrap.remove();}
    function clear(){global.clearTimeout(leaveTimer);for(const entry of controls.values())remove(entry);controls.clear();capture?.clear();portal?.remove();portal=null;portalRoot=null;watchedPicker=null;pickerObserver?.disconnect();pickerObserver=null;}
    function movePopup(){
      if(!opened||!ledger)return;
      if(!opened.button.isConnected||!active()){close(opened);return;}
      const {card,anchor}=opened,rect=anchor.getBoundingClientRect();
      const viewport=global.visualViewport,offsetX=viewport?.offsetLeft||0,offsetY=viewport?.offsetTop||0;
      const target={left:rect.left-offsetX,right:rect.right-offsetX,top:rect.top-offsetY,bottom:rect.bottom-offsetY,width:rect.width,height:rect.height};
      const point=ledger.computeAnchorPosition(target,card.offsetWidth,card.offsetHeight,'top',{viewportWidth:viewport?.width||global.innerWidth,viewportHeight:viewport?.height||global.innerHeight});
      card.style.left=(point.left+offsetX)+'px';card.style.top=(point.top+offsetY)+'px';
    }
    function attachPopup(entry){
      if(!portal){
        portal=doc.createElement('div');portal.dataset.slinkArsonPortal='';
        portal.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none';
        portalRoot=portal.attachShadow({mode:'open'});doc.body.append(portal);
      }
      ledger.syncTornThemeVars(portal);
      portalRoot.append(entry.card);
    }
    function outside(event){if(opened&&!event.composedPath().includes(portal)&&!event.composedPath().includes(opened.anchor))close(opened);}
    function escape(event){if(opened&&event.key==='Escape')close(opened);}
    function cancelLeave(){global.clearTimeout(leaveTimer);}
    function delayClose(entry){cancelLeave();if(!entry.pinned)leaveTimer=global.setTimeout(()=>close(entry),180);}
    function updateInventory(){
      const triggers=root.querySelectorAll('button[aria-expanded="true"]:is('+prefix('itemButton')+')');
      const row=triggers.length===1?triggers[0].closest(rowSelector):null;
      const picker=row?[...doc.querySelectorAll(prefix('itemSelector'))].find(node=>node.getClientRects().length&&!node.closest('[hidden]')):null;
      if(portal){
        let z=null;
        for(let el=picker;el&&el!==doc.body;el=el.parentElement){
          const style=global.getComputedStyle(el);
          if(style.position!=='static'&&style.zIndex!=='auto'&&Number.isFinite(Number(style.zIndex)))z=Number(style.zIndex);
        }
        portal.style.zIndex=picker?String((z??1)-1):'2147483647';
        portal.style.visibility=picker&&z===null?'hidden':'';
        if(opened)opened.card.style.pointerEvents=picker?'none':'auto';
      }
      if(picker!==watchedPicker){
        pickerObserver?.disconnect();watchedPicker=picker;
        if(picker){pickerObserver ||= new global.MutationObserver(()=>{if(active()&&frame===null)frame=global.requestAnimationFrame(refresh);});pickerObserver.observe(picker,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-label','aria-disabled','disabled']});}
      }
      if(picker){
        const items=readPicker(picker).filter(item=>item.name);
        const action=readJob(row)?.action;
        let changed=false;
        for(const item of items){
          const old=inventory.get(item.name);
          const next={...item,ownedQty:item.ownedQty??old?.ownedQty??null,observedAction:action};
          if(JSON.stringify(old)!==JSON.stringify(next)){inventory.set(item.name,next);changed=true;}
        }
        if(changed)saveInventory();
      }
    }
    function paint(entry,job){
      const action=job.action[0].toUpperCase()+job.action.slice(1);
      const picker=[...doc.querySelectorAll(prefix('itemSelector'))].find(node=>node.getClientRects().length&&!node.closest('[hidden]'));
      const requiredFamilies=job.requirements.filter(row=>row.kind==='family').map(row=>row.family);
      const stock=picker?readPicker(picker).filter(item=>item.name&&item.ownedQty>0&&
        ['liquid','solid','gas'].includes(item.family)&&(!requiredFamilies.length||requiredFamilies.every(family=>family===item.family))):[];
      const stockText=stock.length?'Observed stock matching the material family: '+stock.map(item=>item.name+' ×'+item.ownedQty).join(', ')+'. Stock does not confirm suitability for this job.':null;
      const message=[job.name,job.scenario,action+(job.nerveCost===null?'':' · '+job.nerveCost+' nerve'),
        job.damage===null?'Damage unknown':job.damage+'% damage',job.selected?'Selected: '+job.selected:null,guidance(job,entry.previousDamage),stockText,
        entry.recipe?'Previously successful on this device: '+entry.recipe.steps.map(step=>step.action+' '+step.item+(step.damageBefore===null?'':' at '+step.damageBefore+'%')).join(', ')+'. Check current requirements and inventory before reusing.':'No matching successful run recorded on this device.'].filter(Boolean).join(' — ');
      if(ledger){
        const available=new Map([...inventory].map(([name,item])=>[name,item.observedAction===job.action?item:{...item,selectable:null}]));
        const plan=planner?.observedFormula(job,available,entry.recipes,ledger.starterSteps(job.scenario),ledger.building(job.name))||{};
        const key=JSON.stringify([job.name,job.scenario,plan]);
        if(entry.renderedKey!==key){
          entry.card.replaceChildren(ledger.render(job,plan));entry.renderedKey=key;
          entry.live=doc.createElement('div');entry.live.style.cssText='font:11px/1.35 system-ui;padding:7px 10px;border-top:1px solid #8885';entry.card.append(entry.live);
        }
        const material=ledger.material(job.selected);
        const stats=material?Object.entries(material.values).map(([name,value])=>name.replace(/[A-Z]/g,m=>' '+m.toLowerCase())+': '+value).join(' · '):'';
        const detail=[job.damage===null?null:job.damage+'% damage',job.requestLabels.join(' · '),job.selected&&stats?job.selected+' — '+stats:null,stockText,job.phase==='burning'?guidance(job,entry.previousDamage):null].filter(Boolean).join(' — ');
        if(entry.live.textContent!==detail)entry.live.textContent=detail;
        movePopup();
      }else if(entry.card.textContent!==message)entry.card.textContent=message;
    }
    function observe(entry,job){
      const identity=JSON.stringify([job.name,job.scenario,job.phase,job.requestLabels]);
      if(entry.identity!==identity||job.damage===null||job.damage<entry.damage)entry.previousDamage=null;
      else if(job.phase==='burning'&&Number.isFinite(entry.damage)&&job.damage>entry.damage)entry.previousDamage=entry.damage;
      entry.identity=identity;entry.damage=job.damage;
    }
    function refresh(){
      frame=null;if(!active())return;
      if(ledger)updateInventory();
      const rows=new Set();
      for(const row of root.querySelectorAll(rowSelector)){
        if(!row.getClientRects().length||row.closest('[hidden]'))continue;
        const job=readJob(row);capture?.inspect(row,job)?.catch(()=>{});if(!job)continue;rows.add(row);
        const host=ledger?(row.querySelector(prefix('fireMeter'))||row.querySelector(prefix('itemButton'))?.parentElement):row.querySelector(prefix('titleSection'));
        if(!host)continue;
        let entry=controls.get(row);
        if(entry?.wrap.parentNode!==host){if(entry)remove(entry);controls.delete(row);entry=null;}
        if(!entry){
          const wrap=doc.createElement('span');wrap.dataset.slinkArson='';wrap.style.cssText='position:relative;display:inline-block';
          const button=doc.createElement('button');button.type='button';button.textContent='Arson help';button.setAttribute('aria-expanded','false');
          if(ledger){button.innerHTML=ledger.flame;button.setAttribute('aria-label','Arson help');button.style.cssText='display:inline-flex;align-items:center;gap:3px;cursor:help;border:1px solid currentColor;border-radius:10px;color:#ffb44e;background:#171b22;padding:2px 5px';}
          const card=doc.createElement('span');card.hidden=true;card.setAttribute('role','status');
          card.style.cssText='position:absolute;z-index:10000;width:min(300px,calc(100vw - 16px));max-height:40vh;overflow:auto;background:#171b22;color:#fff;padding:10px;border:1px solid #8a96aa;border-radius:6px;box-sizing:border-box;white-space:normal';
          if(ledger)card.style.cssText='position:fixed;pointer-events:auto;width:max-content;max-width:min(440px,calc(100vw - 16px));max-height:65dvh;overflow:auto;background:var(--slink-arson-popup-bg,var(--tooltip-bg-color,#171b22));color:var(--crimes-baseText-color,#fff);border:1px solid var(--crimes-outcomeDivider-color,#8a96aa);border-radius:8px;box-shadow:0 2px 12px #0008;box-sizing:border-box';
          const anchor=ledger?host:wrap;
          entry={wrap,button,card,anchor};controls.set(row,entry);
          if(ledger){card.addEventListener('pointerenter',cancelLeave);card.addEventListener('pointerleave',()=>delayClose(entry));}
          const open=()=>{
            if(!active())return;const latest=readJob(row);if(!latest)return;
            if(ledger){cancelLeave();if(opened&&opened!==entry)close(opened);opened=entry;attachPopup(entry);}
            if(ledger)updateInventory();
            observe(entry,latest);entry.recipe=null;entry.recipes=[];paint(entry,latest);card.hidden=false;button.setAttribute('aria-expanded','true');
            const key=signature(latest);
            const found=journal?.candidates?journal.candidates('arson',key):journal?.find('arson',key).then(value=>value?[value]:[]);
            found?.then(recipes=>{if(!active()||card.hidden||!entry.wrap.isConnected||entry.recipeKey!==key)return;const current=readJob(row);if(current&&signature(current)===key){entry.recipes=recipes||[];entry.recipe=entry.recipes[0];paint(entry,current);}}).catch(()=>{});
            entry.recipeKey=key;
            if(ledger){movePopup();return;}
            const rect=button.getBoundingClientRect(),height=card.offsetHeight,width=card.offsetWidth;
            const origin=wrap.getBoundingClientRect();
            card.style.left=(Math.max(8,Math.min(rect.left,global.innerWidth-width-8))-origin.left)+'px';
            card.style.top=(Math.max(8,rect.bottom+height+8<=global.innerHeight?rect.bottom:rect.top-height)-origin.top)+'px';
          };
          const enter=event=>{if(event.pointerType!=='touch')open();};
          const leave=()=>{if(doc.activeElement!==button){if(ledger)delayClose(entry);else close(entry);}};
          anchor.addEventListener('pointerenter',enter);anchor.addEventListener('pointerleave',leave);
          button.addEventListener('focus',open);button.addEventListener('blur',()=>{if(ledger)delayClose(entry);else close(entry);});
          let press=null,origin=null;
          entry.cancelPress=()=>{if(press!==null)global.clearTimeout(press);press=null;origin=null;};
          entry.detach=()=>{anchor.removeEventListener('pointerenter',enter);anchor.removeEventListener('pointerleave',leave);};
          button.addEventListener('pointerdown',event=>{
            if(event.pointerType!=='touch')return;
            entry.cancelPress();origin=[event.clientX,event.clientY];
            press=global.setTimeout(()=>{entry.cancelPress();entry.pinned=true;open();},450);
          });
          button.addEventListener('pointermove',event=>{if(origin&&Math.hypot(event.clientX-origin[0],event.clientY-origin[1])>10)entry.cancelPress();});
          for(const event of ['pointerup','pointercancel','pointerleave'])button.addEventListener(event,entry.cancelPress);
          button.addEventListener('click',event=>{event.stopPropagation();if(ledger)entry.pinned=true;open();});
          wrap.addEventListener('keydown',event=>{if(event.key==='Escape'&&!card.hidden){event.stopPropagation();close(entry);}});
          if(ledger)wrap.append(button);else wrap.append(button,card);host.append(wrap);
        }
        observe(entry,job);
        if(!entry.card.hidden)paint(entry,job);
      }
      for(const [row,entry] of controls)if(!rows.has(row)){remove(entry);controls.delete(row);capture?.forget(row);}
    }
    function sync(){
      if(!active()){
        observer?.disconnect();observer=null;
        if(frame!==null)global.cancelAnimationFrame(frame);frame=null;clear();return;
      }
      if(observer)return;
      observer=new global.MutationObserver(records=>{
        if(!active()||frame!==null||records.every(record=>(record.attributeName==='class'&&!record.target.matches?.('.outcome-content,[class*="outcome___"]'))||record.target.closest?.('[data-slink-arson]')||
          (record.type==='childList'&&[...record.addedNodes,...record.removedNodes].length>0&&[...record.addedNodes,...record.removedNodes].every(node=>node.matches?.('[data-slink-arson]')))))return;
        frame=global.requestAnimationFrame(refresh);
      });
      observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','aria-disabled','aria-expanded','aria-valuenow','disabled','class']});refresh();
    }
    const events=[[global,'focus'],[global,'blur'],[global,'hashchange'],[global,'pagehide'],[doc,'visibilitychange']];
    const handlers=events.map(([target,event])=>[target,event,(event==='blur'&&!focused)||event==='pagehide'?()=>{observer?.disconnect();observer=null;if(frame!==null)global.cancelAnimationFrame(frame);frame=null;clear();}:sync]);
    for(const [target,event,handler] of handlers)target.addEventListener(event,handler);
    if(ledger){doc.addEventListener('click',outside,true);doc.addEventListener('keydown',escape);global.addEventListener('scroll',movePopup,true);global.addEventListener('resize',movePopup);}
    sync();
    const stop=()=>{disposed=true;sync();if(capture)root.removeEventListener('click',onAction,true);for(const [target,event,handler] of handlers)target.removeEventListener(event,handler);if(ledger){doc.removeEventListener('click',outside,true);doc.removeEventListener('keydown',escape);global.removeEventListener('scroll',movePopup,true);global.removeEventListener('resize',movePopup);}};
    stop.refresh=()=>{if(active()&&frame===null)frame=global.requestAnimationFrame(refresh);};
    return stop;
  }
  function connect({eligible=()=>false,focused,journal}={}){
    const doc=global.document;
    const stockCache={};
    let enabled=false,disposed=false,observer=null,stopCards=null,mountedRoot=null,frame=null;
    const active=()=>!disposed&&enabled&&eligible()&&!doc.hidden&&(focused?focused():doc.hasFocus())&&
      new URL(global.location.href).searchParams.get('sid')==='crimes'&&/^#\/?arson(?:[/?]|$)/i.test(global.location.hash);
    function clear(){
      observer?.disconnect();observer=null;stopCards?.();stopCards=null;mountedRoot=null;
      if(frame!==null)global.cancelAnimationFrame(frame);frame=null;
    }
    function discover(){
      frame=null;if(!active()||stopCards)return;
      const row=[...doc.querySelectorAll(rowSelector)].find(element=>element.getClientRects().length&&readJob(element));
      const root=doc.querySelector('.arson-root')||row?.parentElement;
      if(!root||root===doc.body)return;
      mountedRoot=root;
      stopCards=mount({root,enabled:true,eligible:active,focused,journal,stockCache});
    }
    function sync(){
      if(!active()){clear();return;}
      if(stopCards||observer)return;
      discover();
      if(doc.body){
        observer=new global.MutationObserver(records=>{
          if(!active()){clear();return;}
          if(mountedRoot&&!mountedRoot.matches('.arson-root')&&!mountedRoot.querySelector(rowSelector)){stopCards?.();stopCards=null;mountedRoot=null;}
          if(stopCards&&records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.matches(prefix('itemSelector'))||node.querySelector(prefix('itemSelector'))))))stopCards.refresh();
          if(mountedRoot&&!mountedRoot.isConnected){stopCards?.();stopCards=null;mountedRoot=null;}
          if(!mountedRoot&&frame===null&&active())frame=global.requestAnimationFrame(discover);
        });
        observer.observe(doc.body,{childList:true,subtree:true});
      }
    }
    const events=[[global,'focus',sync],[global,'blur',focused?sync:clear],[global,'hashchange',sync],[global,'popstate',sync],[global,'pageshow',sync],[global,'pagehide',clear],[doc,'visibilitychange',sync]];
    for(const [target,event,handler] of events)target.addEventListener(event,handler);
    return {setEnabled(value){enabled=value===true;sync();},sync,dispose(){disposed=true;clear();for(const [target,event,handler] of events)target.removeEventListener(event,handler);}};
  }
  const api=Object.freeze({readJob,readPicker,readRequests,parseDamageRequirement,damagePosition,guidance,mount,connect,captureArson,recipeJournal});
  if(global.SLINK_EXTENSION?.define)global.SLINK_EXTENSION.define('core','arsonPage',api);
  else global.SLINK_ARSON_PAGE=api;
})(globalThis);
