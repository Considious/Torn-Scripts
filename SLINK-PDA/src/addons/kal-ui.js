(function installKalUi(global) {
  'use strict';
  if(global.SLINK_KAL_UI)return;
  const K=global.SLINK_KAL;
  const attribution='Loadout intelligence provided by KAL — Kalends [2032147]';
  function element(doc,tag,text) {const node=doc.createElement(tag);if(text!=null)node.textContent=text;return node;}
  function button(doc,text,work) {const node=element(doc,'button',text);node.type='button';node.addEventListener('click',work);return node;}
  function mountSettings(root,client,{keyRoot=root}={}) {
    if(root.dataset.kalMounted)return;root.dataset.kalMounted='true';
    const doc=root.ownerDocument;
    global.SLINK_TORN_COMPONENTS?.mark(root,'slink-page-ui');global.SLINK_TORN_COMPONENTS?.install(root.getRootNode());
    root.style.cssText='display:grid;gap:8px;min-width:0;';
    root.append(element(doc,'h3','KAL — Loadout Intelligence'));
    root.append(element(doc,'p','Connect your registered KAL account to view equipment intelligence on player profiles. Equipment collection remains with the official KAL script. This opt-in integration keeps your registered key on this device and sends it only to api.kalends.dev; it is not included in SLINK cloud backups.'));
    const label=element(doc,'label','KAL API Key'), input=element(doc,'input');input.type='password';input.autocomplete='off';input.maxLength=16;input.setAttribute('aria-label','KAL API Key');label.append(input);keyRoot.append(label);
    const consentLabel=element(doc,'label'),consent=element(doc,'input');consent.type='checkbox';consentLabel.append(consent,doc.createTextNode(' Send this registered key only to KAL to validate and use my account. Register and accept policies on KAL’s website first.'));root.append(consentLabel);
    const status=element(doc,'p');status.setAttribute('role','status');
    const controls=element(doc,'div'),displayLabel=element(doc,'label','Equipment display '),display=element(doc,'select');controls.style.cssText='display:flex;flex-wrap:wrap;gap:6px;';
    for(const [value,text]of [['slink','Automatically open SLINK equipment'],['manual','Open SLINK equipment manually']]){const option=element(doc,'option',text);option.value=value;display.append(option);}displayLabel.append(display);root.append(displayLabel);
    let state=null,busy=false;
    const show=value=>{state=value;input.placeholder=value.connected?'Saved — leave blank to keep':'Enter your registered KAL key';display.value=value.display;enable.textContent=value.enabled?'Disable integration':'Enable integration';status.textContent=(value.connected?'KAL key validated. ':'Not connected. ')+(value.enabled?'Integration enabled.':'Integration disabled.');};
    async function run(work){if(busy)return;busy=true;for(const b of controls.querySelectorAll('button'))b.disabled=true;try{show(await work());root.dispatchEvent(new Event('kal-settings-changed',{bubbles:true}));}catch(error){status.textContent=error.message;}finally{busy=false;for(const b of controls.querySelectorAll('button'))b.disabled=false;}}
    const connect=button(doc,'Save KAL key',()=>run(async()=>{const key=input.value.trim();if(!key){if(state?.connected)return client.status();throw Error('Enter your registered KAL key first.');}input.value='';return client.connect(key,consent.checked);}));
    input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();connect.click();}});
    const enable=button(doc,'Enable integration',()=>run(()=>client.configure({enabled:!state?.enabled,display:display.value})));
    const disconnect=button(doc,'Remove KAL key',()=>run(()=>{input.value='';consent.checked=false;return client.disconnect();}));
    controls.append(connect,enable,disconnect,button(doc,'Refresh diagnostics',()=>run(()=>client.status())));root.append(controls,status);
    display.addEventListener('change',()=>run(()=>client.configure({enabled:state?.enabled===true,display:display.value})));
    for(const [title,url]of [['KAL website / registration','https://kalends.dev/'],['API documentation','https://kalends.dev/api-docs'],['Official forum thread','https://www.torn.com/forums.php#/p=threads&f=67&t=16597240']]){const a=element(doc,'a',title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';root.append(a,doc.createTextNode(' · '));}
    root.append(element(doc,'p',attribution));
    client.status().then(show,error=>{status.textContent=error.message;});
  }
  function pagePlayer(location) {
    const url=new URL(location.href);
    const raw=url.pathname==='/profiles.php'?url.searchParams.get('XID'):null;
    try{return raw?K.playerId(raw):null;}catch{return null;}
  }
  function mountPage({document:doc=global.document,location=global.location,client,openAccess,clipboard=text=>global.navigator.clipboard.writeText(text)}) {
    if(doc.getElementById('slink-kal-panel'))return;
    let id=pagePlayer(location);if(!id)return;
    const root=element(doc,'section');root.id='slink-kal-panel';root.className='m-top10';root.setAttribute('aria-label','SLINK KAL loadout information');
    const style=element(doc,'style');style.textContent=`
      #slink-kal-panel{--kal-bg:var(--slink-surface,var(--s-panel,var(--default-bg-panel-color,#f5f5f5)));--kal-fg:var(--slink-text,var(--s-text,var(--default-color,#222)));--kal-border:var(--slink-border,var(--s-border,#7778));--kal-accent:var(--slink-accent,var(--s-accent,#5a9bd7));--kal-muted:var(--slink-muted,var(--s-muted,#777));--kal-control:var(--slink-bg-control,var(--s-control,var(--kal-bg)));box-sizing:border-box;position:static;clear:both;inline-size:100%;max-inline-size:100%;min-inline-size:0;border:1px solid var(--kal-border);border-radius:8px;background:var(--slink-panel-bg,var(--kal-bg));color:var(--kal-fg);font:13px/1.45 sans-serif;overflow:hidden}
      body.dark-mode #slink-kal-panel{--kal-bg:var(--slink-surface,var(--s-panel,#252a32));--kal-fg:var(--slink-text,var(--s-text,#eee));--kal-muted:var(--slink-muted,var(--s-muted,#b8bac2))}
      #slink-kal-panel *{box-sizing:border-box}#slink-kal-panel [hidden]{display:none!important}
      #slink-kal-panel .slink-kal-header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--kal-border);background:color-mix(in srgb,var(--kal-accent) 10%,transparent)}
      #slink-kal-panel h3{margin:0;font:700 13px/1.4 sans-serif}#slink-kal-panel .slink-kal-controls{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
      #slink-kal-panel button{appearance:none;min-height:32px;min-width:34px;margin:0;padding:5px 10px;border:1px solid var(--kal-border);border-radius:5px;background:var(--kal-control);color:var(--kal-fg);font:inherit;cursor:pointer}
      #slink-kal-panel button:hover:enabled{border-color:var(--kal-accent)}#slink-kal-panel button:disabled{opacity:.45;cursor:default}#slink-kal-panel button:focus-visible{outline:2px solid var(--kal-accent);outline-offset:2px}
      #slink-kal-panel [role=status]{margin:8px 10px;overflow-wrap:anywhere}#slink-kal-panel .slink-kal-actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 10px}#slink-kal-panel .slink-kal-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));min-width:0}
      #slink-kal-panel .slink-kal-equipment{display:grid;grid-template-columns:60px minmax(0,1fr);gap:9px;padding:8px 10px;border-bottom:1px solid var(--kal-border);align-items:center;min-width:0}
      #slink-kal-panel .slink-kal-item-plate{width:60px;height:38px;display:flex;align-items:center;justify-content:center;border:1px solid var(--kal-border);border-radius:5px;background:var(--kal-control);overflow:hidden}
      #slink-kal-panel .slink-kal-item-plate[data-rarity="yellow"]{--kal-rarity:#d6b23a}#slink-kal-panel .slink-kal-item-plate[data-rarity="orange"]{--kal-rarity:#d38b25}#slink-kal-panel .slink-kal-item-plate[data-rarity="red"]{--kal-rarity:#dc4b49}
      #slink-kal-panel .slink-kal-item-plate[data-rarity]{border-color:var(--kal-rarity);background:linear-gradient(0deg,color-mix(in srgb,var(--kal-rarity) 35%,#101014),#101014 90%)}
      #slink-kal-panel .slink-kal-item-plate img{object-fit:contain;max-width:100%;max-height:100%}#slink-kal-panel .slink-kal-item-details{display:grid;gap:3px;min-width:0;overflow-wrap:anywhere}#slink-kal-panel small{color:var(--kal-muted)}#slink-kal-panel .slink-kal-bonus{color:var(--kal-accent)}#slink-kal-panel footer{padding:8px 10px;font-size:11px}
      @media(max-width:600px){#slink-kal-panel .slink-kal-groups{grid-template-columns:minmax(0,1fr)}#slink-kal-panel .slink-kal-header{align-items:flex-start}#slink-kal-panel button{min-height:40px}}
    `;
    const header=element(doc,'header');header.className='slink-kal-header';header.append(element(doc,'h3','SLINK · KAL Loadout Information'));
    const controls=element(doc,'nav');controls.className='slink-kal-controls';controls.setAttribute('aria-label','Equipment history');header.append(controls);
    const status=element(doc,'p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const actions=element(doc,'div');actions.className='slink-kal-actions';const cards=element(doc,'div');cards.className='slink-kal-groups';
    root.append(style,header,status,actions,cards,element(doc,'footer',attribution));
    let state=null,busy=false,generation=0,destroyed=false,snapshots=[],position=-1,queued=false;
    const selected=()=>snapshots[position]||null;
    const reset=()=>{generation++;busy=false;snapshots=[];position=-1;cards.replaceChildren();};
    const show=(kind,message)=>{root.dataset.state=kind;status.textContent=message;root.setAttribute('aria-busy',String(kind==='loading'));};
    const setup=button(doc,'Open SLINK Access',async()=>{try{if(!openAccess)throw Error('Open SLINK → Access → KAL to configure this integration.');await openAccess();}catch(error){show('error',error.message);}});
    const retry=button(doc,'Retry',()=>void refresh(true)),loadButton=button(doc,'Load equipment',()=>void load('select'));
    actions.append(setup,retry,loadButton);
    const older=button(doc,'‹',()=>void load('older')),newer=button(doc,'›',()=>void load('newer')),latest=button(doc,'Latest',()=>void load('latest'));
    older.setAttribute('aria-label','Older loadout');older.title='Previous recorded loadout';newer.setAttribute('aria-label','Newer loadout');newer.title='Newer recorded loadout';
    const copy=button(doc,'Copy',async()=>{const value=selected();if(!value)return;try{let copied=false;try{await clipboard(K.loadoutText(value));copied=true;}catch{}
      if(!copied){const input=element(doc,'textarea');input.value=K.loadoutText(value);input.style.cssText='position:fixed;left:-9999px;opacity:0';doc.body.append(input);try{input.select();copied=doc.execCommand('copy');}finally{input.remove();}}
      if(!copied)throw Error('Clipboard refused the copy.');show('ready','Selected loadout copied.');
    }catch{show('error','Copy failed. Allow clipboard access and try Copy again.');}});copy.setAttribute('aria-label','Copy selected loadout');controls.append(copy,older,newer,latest);
    function sync(){controls.hidden=!busy&&!selected();copy.disabled=busy||!selected();older.disabled=busy||!(position<snapshots.length-1||selected()?.pagination?.next_cursor);newer.disabled=latest.disabled=busy||position<=0;setup.hidden=!['credentials','registration','disabled','error'].includes(root.dataset.state);retry.hidden=root.dataset.state!=='error';loadButton.hidden=busy||!state?.enabled||!state?.connected||!!selected();}
    function image(item){
      const img=element(doc,'img'),id=Number(item.id);let url;
      if(Number.isSafeInteger(id)&&id>0){url='https://www.torn.com/images/items/'+id+'/medium.png';img.srcset=[1,2,3,4].map(n=>'https://www.torn.com/images/items/'+id+'/medium'+(n===1?'':'@'+n+'x')+'.png '+n+'x').join(', ');}
      else{const raw=item.image_base||item.image_url||item.image;try{const u=new URL(raw,'https://www.torn.com');if(u.protocol==='https:'&&typeof raw==='string')url=item.image_base?u.href+'.png':u.href;}catch{}}
      if(!url)return element(doc,'span','—');img.src=url;img.alt=item.name||'Equipment';img.loading='lazy';img.width=58;img.height=36;return img;
    }
    function draw(value){
      cards.replaceChildren();const weapons=element(doc,'div'),armor=element(doc,'div');weapons.setAttribute('aria-label','Weapons and other equipment');armor.setAttribute('aria-label','Armor');cards.append(weapons,armor);
      const slotRank=item=>{const slot=String(item.slot_name||'').toLowerCase();return /^primary/.test(slot)?0:/^secondary/.test(slot)?1:/^melee/.test(slot)?2:/^(?:temp|temporary)\b/.test(slot)?3:4;};
      for(const item of [...value.equipment].sort((a,b)=>slotRank(a)-slotRank(b))){
        const row=element(doc,'article');row.className='slink-kal-equipment';const plate=element(doc,'span');plate.className='slink-kal-item-plate';plate.append(image(item));
        const rarity=String(item.rarity||'').trim().toLowerCase();if(['yellow','orange','red'].includes(rarity))plate.dataset.rarity=rarity;
        const details=element(doc,'div');details.className='slink-kal-item-details';details.append(element(doc,'strong',item.name||'Unknown equipment'));
        const meta=[item.slot_name,item.rarity].filter(Boolean);if(meta.length)details.append(element(doc,'small',meta.join(' · ')));
        const stats=item.stats&&typeof item.stats==='object'?Object.entries(item.stats):[['Damage',item.damage],['Accuracy',item.accuracy],['Armor',item.armor]];
        const known=stats.filter(([,v])=>v!=null&&['number','string'].includes(typeof v));if(known.length)details.append(element(doc,'span',known.map(([k,v])=>k[0].toUpperCase()+k.slice(1)+': '+v).join(' · ')));
        for(const bonus of item.bonuses||[]){const line=element(doc,'span',[bonus.title||bonus.name||'Bonus',bonus.description??bonus.value].filter(v=>v!=null&&v!=='').join(' · '));line.className='slink-kal-bonus';details.append(line);}
        for(const mod of [...(item.mods||[]),...(item.upgrades||[])])details.append(element(doc,'small','Mod · '+(mod.description||mod.name||'Unknown')));
        if(item.ammo)details.append(element(doc,'small','Ammo · '+(item.ammo.type||item.ammo.name||'Unknown')));if(item.effect)details.append(element(doc,'small',String(item.effect)));
        row.append(plate,details);const isArmor=slotRank(item)===4&&(/armou?r|helmet|body|chest|pants|trousers|legs|boots|feet|gloves|hands|head/i.test(String(item.slot_name||''))||Number(item.stats?.armor)>0);(isArmor?armor:weapons).append(row);
      }
      weapons.hidden=!weapons.childElementCount;armor.hidden=!armor.childElementCount;
      show(value.equipment.length?'ready':'empty',value.equipment.length?'Observed: '+K.stamp(value.observed_at):'KAL has no equipment records for this player. Missing slots are unknown, not empty. Try another profile or check again later.');
    }
    function failed(error){const code=String(error?.code||''),message=String(error?.message||'KAL could not load equipment.');
      if(code==='KAL_HTTP_13'||/no visible loadout/i.test(message))show('empty','KAL has no visible equipment history for this player. Try another profile or check again later.');
      else if(/KAL_(?:UNREGISTERED|HTTP_[12456])$/.test(code)||/register|key is invalid|account is (?:disabled|restricted)|policies/i.test(message))show('registration',message+' Open SLINK Access → KAL to validate your registered key.');
      else if(code==='KAL_DISABLED')show('credentials','Connect and enable your registered KAL key in SLINK Access → KAL. Your SLINK/Torn key is not connected automatically.');
      else show('error',message+' Use Retry, or check KAL configuration in SLINK Access.');
    }
    async function load(direction){
      if(busy||destroyed||!id||!state?.connected||!state.enabled||root.hidden||!root.isConnected)return;
      busy=true;const token=++generation,player=id;cards.replaceChildren();show('loading','Loading KAL equipment…');sync();
      try{let value,index=position;
        if(direction==='older'){if(position<snapshots.length-1)value=snapshots[index=position+1];else{const cursor=selected()?.pagination?.next_cursor;if(!cursor)return;value=await client.load(player,cursor);index=position+1;}}
        else if(direction==='newer')value=snapshots[index=Math.max(0,position-1)];
        else if(direction==='latest'&&snapshots.length)value=snapshots[index=0];
        else{value=await client.load(player);index=0;}
        if(destroyed||token!==generation||player!==id||!value)return;
        if(index===0&&direction==='select')snapshots=[value];else snapshots[index]=value;position=index;draw(value);
      }catch(error){if(!destroyed&&token===generation)failed(error);}
      finally{if(!destroyed&&token===generation){busy=false;sync();}}
    }
    function place(){const profile=doc.querySelector('.user-profile'),top=profile?.querySelector(':scope > .profile-wrapper');if(top&&(root.parentNode!==profile||!(top.compareDocumentPosition(root)&4)))top.after(root);return !!top;}
    async function refresh(force=false){
      if(destroyed)return;if(!state){show('loading','Checking KAL connection…');sync();}const next=pagePlayer(location);if(next!==id){id=next;reset();show('idle','Choose Load equipment to read KAL history.');}if(!id){root.hidden=true;return;}place();
      const token=generation;try{const value=await client.status();if(destroyed||token!==generation)return;if(state&&(state.connected!==value.connected||state.enabled!==value.enabled||state.display!==value.display)){reset();show('idle','Choose Load equipment to read KAL history.');}state=value;
        root.hidden=value.connected&&!value.enabled;
        if(root.hidden){reset();show('disabled','KAL integration is disabled. Enable it in SLINK Access → KAL.');}
        else if(!value.connected){reset();show('credentials','No KAL API key is connected. Open SLINK Access → KAL to register and validate your key.');}
        else if(force||!selected()&&!['error','empty','registration'].includes(root.dataset.state)){show('idle','Choose Load equipment to read KAL’s recorded equipment history.');sync();if(force||value.display==='slink')void load('select');}
        sync();
      }catch(error){if(!destroyed&&token===generation){root.hidden=false;failed(error);sync();}}
    }
    const settingsChanged=()=>void refresh(),navigated=()=>void refresh(),visibility=()=>{if(!doc.hidden&&state?.enabled&&state.display==='slink'&&!selected()&&root.dataset.state==='idle')void load('select');};
    const observer=new MutationObserver(()=>{if(destroyed||queued)return;queued=true;global.queueMicrotask(()=>{queued=false;if(destroyed)return;const connected=root.isConnected;place();if(pagePlayer(location)!==id)void refresh();else if(!connected&&root.isConnected)visibility();});});
    observer.observe(doc.body||doc.documentElement,{childList:true,subtree:true});
    doc.addEventListener('kal-settings-changed',settingsChanged);doc.addEventListener('visibilitychange',visibility);global.addEventListener?.('popstate',navigated);global.addEventListener?.('hashchange',navigated);
    sync();void refresh();
    return {root,refresh,destroy(){destroyed=true;generation++;observer.disconnect();doc.removeEventListener('kal-settings-changed',settingsChanged);doc.removeEventListener('visibilitychange',visibility);global.removeEventListener?.('popstate',navigated);global.removeEventListener?.('hashchange',navigated);root.remove();}};
  }
  global.SLINK_KAL_UI=Object.freeze({mountSettings,mountPage,pagePlayer});
})(globalThis);
