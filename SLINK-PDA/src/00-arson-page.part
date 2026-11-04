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
  function mount({root,enabled=false,eligible=()=>false,focused}={}){
    if(!enabled||!root)return ()=>{};
    const doc=root.ownerDocument;
    const controls=new Map();
    let observer=null,frame=null,disposed=false;
    const active=()=>!disposed&&eligible()&&!doc.hidden&&(focused?focused():doc.hasFocus());
    function close(entry){entry.card.hidden=true;entry.button.setAttribute('aria-expanded','false');}
    function remove(entry){entry.cancelPress?.();entry.wrap.remove();}
    function clear(){for(const entry of controls.values())remove(entry);controls.clear();}
    function paint(entry,job){
      const action=job.action[0].toUpperCase()+job.action.slice(1);
      const picker=[...doc.querySelectorAll(prefix('itemSelector'))].find(node=>node.getClientRects().length&&!node.closest('[hidden]'));
      const requiredFamilies=job.requirements.filter(row=>row.kind==='family').map(row=>row.family);
      const stock=picker?readPicker(picker).filter(item=>item.name&&item.ownedQty>0&&
        ['liquid','solid','gas'].includes(item.family)&&(!requiredFamilies.length||requiredFamilies.every(family=>family===item.family))):[];
      const stockText=stock.length?'Observed stock matching the material family: '+stock.map(item=>item.name+' ×'+item.ownedQty).join(', ')+'. Stock does not confirm suitability for this job.':null;
      const message=[job.name,job.scenario,action+(job.nerveCost===null?'':' · '+job.nerveCost+' nerve'),
        job.damage===null?'Damage unknown':job.damage+'% damage',job.selected?'Selected: '+job.selected:null,guidance(job,entry.previousDamage),stockText,
        'No full formula has been validated for this job.'].filter(Boolean).join(' — ');
      if(entry.card.textContent!==message)entry.card.textContent=message;
    }
    function observe(entry,job){
      const identity=JSON.stringify([job.name,job.scenario,job.phase,job.requestLabels]);
      if(entry.identity!==identity||job.damage===null||job.damage<entry.damage)entry.previousDamage=null;
      else if(job.phase==='burning'&&Number.isFinite(entry.damage)&&job.damage>entry.damage)entry.previousDamage=entry.damage;
      entry.identity=identity;entry.damage=job.damage;
    }
    function refresh(){
      frame=null;if(!active())return;
      const rows=new Set();
      for(const row of root.querySelectorAll(rowSelector)){
        if(!row.getClientRects().length||row.closest('[hidden]'))continue;
        const job=readJob(row);if(!job)continue;rows.add(row);
        const host=row.querySelector(prefix('titleSection'));
        if(!host)continue;
        let entry=controls.get(row);
        if(entry?.wrap.parentNode!==host){if(entry)remove(entry);controls.delete(row);entry=null;}
        if(!entry){
          const wrap=doc.createElement('span');wrap.dataset.slinkArson='';wrap.style.cssText='position:relative;display:inline-block';
          const button=doc.createElement('button');button.type='button';button.textContent='Arson help';button.setAttribute('aria-expanded','false');
          const card=doc.createElement('span');card.hidden=true;card.setAttribute('role','status');
          card.style.cssText='position:absolute;z-index:10000;width:min(300px,calc(100vw - 16px));max-height:40vh;overflow:auto;background:#171b22;color:#fff;padding:10px;border:1px solid #8a96aa;border-radius:6px;box-sizing:border-box;white-space:normal';
          entry={wrap,button,card};controls.set(row,entry);
          const open=()=>{
            if(!active())return;const latest=readJob(row);if(!latest)return;
            observe(entry,latest);paint(entry,latest);card.hidden=false;button.setAttribute('aria-expanded','true');
            const rect=button.getBoundingClientRect(),height=card.offsetHeight,width=card.offsetWidth;
            const origin=wrap.getBoundingClientRect();
            card.style.left=(Math.max(8,Math.min(rect.left,global.innerWidth-width-8))-origin.left)+'px';
            card.style.top=(Math.max(8,rect.bottom+height+8<=global.innerHeight?rect.bottom:rect.top-height)-origin.top)+'px';
          };
          wrap.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')open();});
          wrap.addEventListener('pointerleave',()=>{if(doc.activeElement!==button)close(entry);});
          button.addEventListener('focus',open);button.addEventListener('blur',()=>close(entry));
          let press=null,origin=null;
          entry.cancelPress=()=>{if(press!==null)global.clearTimeout(press);press=null;origin=null;};
          button.addEventListener('pointerdown',event=>{
            if(event.pointerType!=='touch')return;
            entry.cancelPress();origin=[event.clientX,event.clientY];
            press=global.setTimeout(()=>{entry.cancelPress();open();},450);
          });
          button.addEventListener('pointermove',event=>{if(origin&&Math.hypot(event.clientX-origin[0],event.clientY-origin[1])>10)entry.cancelPress();});
          for(const event of ['pointerup','pointercancel','pointerleave'])button.addEventListener(event,entry.cancelPress);
          button.addEventListener('click',event=>{event.stopPropagation();open();});
          wrap.addEventListener('keydown',event=>{if(event.key==='Escape'&&!card.hidden){event.stopPropagation();close(entry);}});
          wrap.append(button,card);host.append(wrap);
        }
        observe(entry,job);
        if(!entry.card.hidden)paint(entry,job);
      }
      for(const [row,entry] of controls)if(!rows.has(row)){remove(entry);controls.delete(row);}
    }
    function sync(){
      if(!active()){
        observer?.disconnect();observer=null;
        if(frame!==null)global.cancelAnimationFrame(frame);frame=null;clear();return;
      }
      if(observer)return;
      observer=new global.MutationObserver(records=>{
        if(!active()||frame!==null||records.every(record=>record.target.closest?.('[data-slink-arson]')||
          (record.type==='childList'&&[...record.addedNodes,...record.removedNodes].length>0&&[...record.addedNodes,...record.removedNodes].every(node=>node.matches?.('[data-slink-arson]')))))return;
        frame=global.requestAnimationFrame(refresh);
      });
      observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','aria-disabled','aria-valuenow','disabled']});refresh();
    }
    const events=[[global,'focus'],[global,'blur'],[global,'hashchange'],[global,'pagehide'],[doc,'visibilitychange']];
    const handlers=events.map(([target,event])=>[target,event,(event==='blur'&&!focused)||event==='pagehide'?()=>{observer?.disconnect();observer=null;if(frame!==null)global.cancelAnimationFrame(frame);frame=null;clear();}:sync]);
    for(const [target,event,handler] of handlers)target.addEventListener(event,handler);
    sync();
    return ()=>{disposed=true;sync();for(const [target,event,handler] of handlers)target.removeEventListener(event,handler);};
  }
  function connect({eligible=()=>false,focused}={}){
    const doc=global.document;
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
      const root=row?.parentElement;
      if(!root||root===doc.body)return;
      mountedRoot=root;
      stopCards=mount({root,enabled:true,eligible:active,focused});
    }
    function sync(){
      if(!active()){clear();return;}
      if(stopCards||observer)return;
      discover();
      if(doc.body){
        observer=new global.MutationObserver(()=>{
          if(mountedRoot&&!mountedRoot.isConnected){stopCards?.();stopCards=null;mountedRoot=null;}
          if(!mountedRoot&&frame===null&&active())frame=global.requestAnimationFrame(discover);
        });
        observer.observe(doc.body,{childList:true,subtree:true});
      }
    }
    const events=[[global,'focus',sync],[global,'blur',focused?sync:clear],[global,'hashchange',sync],[global,'pageshow',sync],[global,'pagehide',clear],[doc,'visibilitychange',sync]];
    for(const [target,event,handler] of events)target.addEventListener(event,handler);
    return {setEnabled(value){enabled=value===true;sync();},sync,dispose(){disposed=true;clear();for(const [target,event,handler] of events)target.removeEventListener(event,handler);}};
  }
  const api=Object.freeze({readJob,readPicker,readRequests,parseDamageRequirement,damagePosition,guidance,mount,connect});
  if(global.SLINK_EXTENSION?.define)global.SLINK_EXTENSION.define('core','arsonPage',api);
  else global.SLINK_ARSON_PAGE=api;
})(globalThis);
