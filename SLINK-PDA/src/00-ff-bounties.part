/* FFScouter OpenAPI 1.20.0: credentials stay in the trusted transport; no persistent board data. */
(function(g){
 'use strict';
 const base='https://ffscouter.com', policy=base+'/claim-bounties', setup=base+'/guides/ff-scouter-v2-installation';
 const paths={check:'/api/v1/check-key',board:'/api/v1/bounties/seller/board',accept:'/api/v1/bounties/seller/policy/accept',status:'/api/v1/bounties/seller/claims/status',claim:'/api/v1/bounties/seller/claims'};
 const errors={key:'Save your own FFScouter key in SLINK, then check again.',invalid:'FFScouter rejected this key. Check your saved FFScouter key.',registration:'Register your key with FFScouter, then check again.',permissions:'Use a registered Custom Torn key with attacks and battlestats access.',policy:'Read and accept FFScouter’s Bounty Board rules and data policy.',rate:'FFScouter rate limit reached. Wait one minute before refreshing.',conflict:'FFScouter reported a conflict. Refresh the board and check your claims before retrying.',unavailable:'FFScouter is temporarily unavailable. Try again later.',network:'Could not reach FFScouter. Check your connection and try again.',access:'SLINK Bounties access is required.'};
 const lists=['pending_claims','recent_hits','claim_history'];
 const claimsValid=v=>v&&lists.every(k=>Array.isArray(v[k]));
 function classify(e){
  const status=Number(e?.status),code=Number(e?.body?.code??e?.code);
  if(code===86)return 'policy';if(code===87||code===88)return 'permissions';if(code===6)return 'registration';
  if(status===429||code===21)return 'rate';if(status===409||code===91)return 'conflict';
  if(status===400||status===401||status===403)return 'invalid';
  return status>=500?'unavailable':status?'unavailable':'network';
 }
 function service({getKey,request,now=Date.now}){
  let key='', epoch=0, pending=null, cache=null, savedAt=0, nextAt=0;
  async function run(action){
   if(!['load','accept','claim','status'].includes(action))return {state:'access'};
   const credential=await getKey();
   const own=typeof credential==='string'?credential.trim():'';
   if(own!==key){key=own;epoch++;pending=null;cache=null;savedAt=0;nextAt=0;}
   if(!own)return {state:'key'};
   if(!/^[A-Za-z0-9]{16}$/.test(own))return {state:'invalid'};
   if(pending)return action==='load'?pending:{state:'busy'};
   if(now()<nextAt)return {state:'rate'};
   if(action==='load'&&cache&&now()-savedAt<15000)return cache;
   const gen=epoch;
   const call=async name=>{
    const url=new URL(paths[name],base);url.searchParams.set('key',own);
    const body=name==='accept'?{key:own,i_have_read_rules_and_data_policy:true}:name==='claim'?{key:own}:undefined;
    const response=await request(url.href,body);
    if(response?.error)throw {body:response,status:400};
    return JSON.parse(JSON.stringify(response??null,(field,value)=>
     /^(key|api_key|token|authorization)$/i.test(field)?undefined:typeof value==='string'?value.replaceAll(own,'[redacted]'):value));
   };
   const task=(async()=>{
    let claimResult=null;
    try{
     const checked=await call('check');
     if(gen!==epoch)return {state:'access'};
     if(checked?.is_registered===false)return {state:'registration'};
     if(checked?.is_registered!==true)return {state:'unavailable'};
     if(action==='accept'){
      const accepted=await call('accept');if(accepted?.ok!==true)return {state:'unavailable'};
     }
     if(action==='claim'){
      if(cache?.state!=='ready')return {state:'policy'};
      const created=await call('claim');
      if(!Number.isSafeInteger(created?.claim?.id)||!claimsValid(created?.claims))return {state:'claimUncertain'};
      claimResult={state:'submitted',claims:created.claims};
      try{const status=await call('status');if(claimsValid(status?.claims))claimResult.claims=status.claims;}catch(error){if(classify(error)==='rate'){nextAt=now()+60000;return claimResult;}}
     }
     if(action==='status'&&cache?.state==='ready'){
      const status=await call('status');
      if(!claimsValid(status?.claims))return {state:'unavailable'};
      if(gen!==epoch)return {state:'access'};
      return cache={...cache,claims:status.claims};
     }
     const data=await call('board');
     if(gen!==epoch)return {state:'access'};
     if(!Array.isArray(data?.board?.targets)||!claimsValid(data?.claims))return claimResult||{state:'unavailable'};
     savedAt=now();cache={state:'ready',board:data.board,claims:data.claims};
     return {...cache,submitted:!!claimResult};
    }catch(error){
     if(gen!==epoch)return {state:'access'};
     const state=classify(error);
     if(state==='rate')nextAt=now()+60000;
     if(['registration','invalid','policy'].includes(state))cache=null;
     return claimResult||{state:action==='claim'&&state==='network'?'claimUncertain':state};
    }
   })();
   pending=task;
   try{return await task;}finally{if(pending===task)pending=null;}
  }
  return run;
 }
 function tabs(root,selected,onSelect){
  const nav=root.ownerDocument.createElement('div');nav.className='target-actions';nav.setAttribute('role','group');nav.setAttribute('aria-label','Bounty source');
  for(const [id,label] of [['torn','Torn Bounties'],['ff','Fair Fight Bounties']]){
   const button=root.ownerDocument.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(selected===id));button.addEventListener('click',()=>onSelect(id));nav.append(button);
  }
  root.prepend(nav);
 }
 function mount(root,run){
  const d=root.ownerDocument, safe=(tag,value,parent=root)=>{const e=d.createElement(tag);if(value!=null)e.textContent=String(value);parent.append(e);return e;};
  const link=(label,href,parent=root)=>{const a=safe('a',label,parent);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;};
  const button=(label,fn,parent=root)=>{const e=safe('button',label,parent);e.type='button';e.addEventListener('click',fn);return e;};
  const money=n=>Number.isFinite(n)?'$'+n.toLocaleString():null;
  const line=(parts,parent)=>safe('p',parts.filter(x=>x!=null&&x!=='').join(' · '),parent);
  const date=n=>Number.isFinite(n)&&n>0?new Date(n*1000).toLocaleString():null;
  const id=n=>Number.isSafeInteger(n)&&n>0?n:null;
  const attack=(player,parent)=>{if(id(player))link('Attack','https://www.torn.com/page.php?sid=attack&user2ID='+player,parent).className='action-link';};
  const card=(parent)=>{const n=safe('article',null,parent);n.className='target-card bounty-target';n.style.overflowWrap='anywhere';return n;};
  safe('h2','Fair Fight Bounties');link('Powered by FFScouter · Bounty Board Rules / Data Policy',policy);
  const details=safe('details');safe('summary','How Fair Fight Bounties Work',details);
  safe('p','Finish the attack yourself with Hospitalize. Assists, Mug and Leave do not count. Faction bounties share one pool. FFScouter credits the highest-paying eligible bounty; limited hits can be filled by others first. Claim promptly and keep your registered key active until payment.',details);
  const msg=safe('p');msg.setAttribute('role','status');
  const controls=safe('div');controls.className='target-actions';
  const refresh=button('Refresh Bounties',()=>load('load'),controls);
  const claim=button('Claim Completed Hit',e=>{if(e.isTrusted)void load('claim');},controls);claim.hidden=true;
  const statusButton=button('Refresh My Claims',()=>load('status'),controls);statusButton.hidden=true;
  const content=safe('section');let board=null,claimRows=null,working=false;
  function drawClaims(){
   if(!claimsValid(claimRows))return;
   safe('h3','My Fair Fight Claims',content);
   for(const row of claimRows.pending_claims)line([row.target_name||'Monitoring all eligible targets',row.state,row.successful_checks+' / '+row.required_checks+' checks',date(row.created_at)],card(content));
   for(const row of claimRows.recent_hits)line([row.target_name,money(row.reward_amount),'Payment: '+row.payout_status,date(row.paid_at||row.credited_at)],card(content));
   for(const row of claimRows.claim_history)line([row.target_name||'Monitoring claim',row.state,row.credited_hits+' credited hit(s)',date(row.completed_at||row.created_at)],card(content));
   if(lists.every(k=>!claimRows[k].length))safe('p','No claims yet.',content);
  }
  function draw(){
   content.replaceChildren();claim.hidden=statusButton.hidden=!board;
   if(!board){drawClaims();return;}
   safe('p','Claiming asks FFScouter to verify eligible hospitalizations from the last 24 hours. A submitted claim is not a payment.',content);
   const filter=safe('input',null,content);filter.type='search';filter.placeholder='Filter by player or faction';filter.setAttribute('aria-label','Filter bounty targets');
   const sort=safe('select',null,content);sort.setAttribute('aria-label','Sort bounty targets');
   for(const [k,v] of [['reward','Reward'],['hits','Hits remaining'],['stats','Battle stats'],['name','Target name']]){const o=safe('option',v,sort);o.value=k;}
   const label=safe('label',null,content),available=safe('input',null,label);available.type='checkbox';label.append(' Available only');
   const strongLabel=safe('label',null,content),strong=safe('input',null,strongLabel);strong.type='checkbox';strongLabel.append(' Hide stronger targets');
   const targets=safe('div',null,content);
   function rows(){
    targets.replaceChildren();const q=filter.value.trim().toLowerCase();
    const matches=board.targets.filter(x=>x&&(id(x.target_player_id)||id(x.target_faction_id))&&(!available.checked||!x.disabled&&x.total_remaining>0)&&(!strong.checked||!(x.all_members_stronger===true||Number.isFinite(x.estimate)&&Number.isFinite(board.seller?.estimate)&&x.estimate>board.seller.estimate))&&[x.target_name,x.target_faction_name,x.target_player_id,x.target_faction_id,...(Array.isArray(x.members)?x.members.map(m=>m.name):[])].some(v=>String(v??'').toLowerCase().includes(q)));
    const fields={reward:'max_price_per_hit',hits:'total_remaining',stats:'estimate'};
    matches.sort((a,b)=>sort.value==='name'?String(a.target_name).localeCompare(String(b.target_name)):(b[fields[sort.value]]??-1)-(a[fields[sort.value]]??-1));
    if(!matches.length)safe('p',board.targets.length?'No bounties match these filters.':'No open bounties.',targets);
    for(const x of matches){
     const box=card(targets),faction=id(x.target_faction_id),player=id(x.target_player_id);
     safe('strong',x.target_name+' ['+(faction||player)+']',box);
     line([faction?'Faction bounty · shared pool':'Player bounty',money(x.max_price_per_hit)&&money(x.max_price_per_hit)+' max per hit',x.total_remaining+' remaining',Number.isFinite(x.estimate)?'Estimated stats '+x.estimate.toLocaleString():null,x.status?.description||x.status?.state,x.disabled?'Unavailable'+(x.disabled_reason?' ('+x.disabled_reason+')':''):null],box);
     if(Array.isArray(x.tiers)&&x.tiers.length>1)line(x.tiers.map(t=>money(t.price_per_hit)+' × '+t.quantity_remaining),box);
     if(!x.disabled&&x.total_remaining>0&&!faction)attack(player,box);
     if(faction&&Array.isArray(x.members)&&x.members.length){
      const group=safe('details',null,box);safe('summary',x.members_truncated?'Some faction members':'Faction members',group);
      for(const m of x.members){
       if(strong.checked&&Number.isFinite(m.estimate)&&Number.isFinite(board.seller?.estimate)&&m.estimate>board.seller.estimate)continue;
       const member=safe('div',null,group);line([m.name,id(m.player_id)?'['+m.player_id+']':null,Number.isFinite(m.estimate)?'Estimated stats '+m.estimate.toLocaleString():null,m.status?.description||m.status?.state],member);if(!x.disabled&&x.total_remaining>0)attack(m.player_id,member);
      }
     }
    }
   }
   for(const field of [filter,sort,available,strong])field.addEventListener(field===filter?'input':'change',rows);
   rows();drawClaims();
  }
  async function load(action){
   if(working)return;working=true;for(const b of [refresh,claim,statusButton])b.disabled=true;
   msg.textContent=action==='claim'?'Submitting claim…':'Checking FFScouter…';
   let result;
   try{result=await run(action);}catch{result={state:action==='claim'?'claimUncertain':'network'};}
   working=false;if(!root.isConnected)return;
   for(const b of [refresh,claim,statusButton])b.disabled=false;
   if(result?.state==='ready'){board=result.board;claimRows=result.claims;draw();refresh.textContent='Refresh Bounties';msg.textContent=result.submitted?'Claim submitted. FFScouter is verifying eligible hits.':'';return;}
   board=null;claimRows=result?.claims||null;draw();
   const state=result?.state;
   msg.textContent=state==='submitted'?'Claim submitted. The board could not refresh; check again later.':state==='claimUncertain'?'Submission could not be confirmed. Check My Claims at FFScouter before retrying.':errors[state]||'FFScouter could not complete the request. Try again.';
   if(['key','invalid','registration','permissions'].includes(state)){
    safe('p','Open FFScouter’s setup guide, create a Custom Torn key with attacks and battlestats, register it, then save it in your existing SLINK FFScouter settings and check again.',content);
    link('Open FFScouter Setup',setup,content);refresh.textContent='Check Again';
   }else if(state==='policy'){
    safe('p','FFScouter stores the registered key for verification, retains attack logs, and may share qualifying attack details and your name/ID with buyers and service operators. SLINK does not persist this board or your claims.',content);
    link('Read FFScouter’s Bounty Board Data Policy and Rules',policy,content);
    button('I Accept the FFScouter Bounty Board Policy',e=>{if(e.isTrusted){e.currentTarget.disabled=true;void load('accept');}},content);
   }
  }
  void load('load');
 }
 g.SLINK_FF_BOUNTIES=Object.freeze({service,tabs,mount});
})(globalThis);
