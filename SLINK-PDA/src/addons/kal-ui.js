(function installKalUi(global) {
  'use strict';
  if(global.SLINK_KAL_UI)return;
  const K=global.SLINK_KAL;
  const attribution='Loadout intelligence provided by KAL — Kalends [2032147]';
  function element(doc,tag,text) {const node=doc.createElement(tag);if(text!=null)node.textContent=text;return node;}
  function button(doc,text,work) {const node=element(doc,'button',text);node.type='button';node.addEventListener('click',work);return node;}
  function mountSettings(root,client) {
    if(root.dataset.kalMounted)return;root.dataset.kalMounted='true';
    const doc=root.ownerDocument;
    root.style.cssText='display:grid;gap:8px;min-width:0;';
    root.append(element(doc,'h3','KAL — Loadout Intelligence'));
    root.append(element(doc,'p','Connect your registered KAL account to view equipment intelligence on player profiles. Equipment collection remains with the official KAL script.'));
    const label=element(doc,'label','KAL API Key'), input=element(doc,'input');input.type='password';input.autocomplete='off';input.maxLength=16;input.setAttribute('aria-label','KAL API Key');label.append(input);root.append(label);
    const consentLabel=element(doc,'label'),consent=element(doc,'input');consent.type='checkbox';consentLabel.append(consent,doc.createTextNode(' Send this registered key only to KAL to validate and use my account. Register and accept policies on KAL’s website first.'));root.append(consentLabel);
    const status=element(doc,'p');status.setAttribute('role','status');
    const controls=element(doc,'div'),displayLabel=element(doc,'label','Equipment display '),display=element(doc,'select');controls.style.cssText='display:flex;flex-wrap:wrap;gap:6px;';
    for(const [value,text]of [['manual','Open SLINK equipment manually'],['slink','Use SLINK equipment panel'],['official','Use official KAL display']]){const option=element(doc,'option',text);option.value=value;display.append(option);}displayLabel.append(display);root.append(displayLabel);
    let state=null,busy=false;
    const show=value=>{state=value;display.value=value.display;enable.textContent=value.enabled?'Disable integration':'Enable integration';status.textContent=(value.connected?'KAL key validated. ':'Not connected. ')+(value.enabled?'Integration enabled.':'Integration disabled.');};
    async function run(work){if(busy)return;busy=true;for(const b of controls.querySelectorAll('button'))b.disabled=true;try{show(await work());root.dispatchEvent(new Event('kal-settings-changed',{bubbles:true}));}catch(error){status.textContent=error.message;}finally{busy=false;for(const b of controls.querySelectorAll('button'))b.disabled=false;}}
    const connect=button(doc,'Connect / Validate',()=>run(async()=>{const key=input.value;input.value='';return client.connect(key,consent.checked);}));
    const enable=button(doc,'Enable integration',()=>run(()=>client.configure({enabled:!state?.enabled,display:display.value})));
    const disconnect=button(doc,'Disconnect / Clear key',()=>run(()=>{input.value='';consent.checked=false;return client.disconnect();}));
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
  function mountPage({document:doc=global.document,location=global.location,client,clipboard=text=>global.navigator.clipboard.writeText(text)}) {
    if(doc.getElementById('slink-kal-panel'))return;
    let id=pagePlayer(location);if(!id)return;
    const root=element(doc,'details'),summary=element(doc,'summary','SLINK · KAL equipment');root.id='slink-kal-panel';
    // Closed/manual by default, so the official display remains usable and no read occurs invisibly.
    root.style.cssText='position:fixed;right:12px;top:150px;z-index:100000;max-width:min(420px,90vw);max-height:70vh;overflow:auto;padding:10px;border:1px solid var(--slink-border,var(--s-border,#777));border-radius:8px;background:var(--slink-panel-bg,var(--s-panel,var(--default-bg-panel-color,#fff)));color:var(--slink-text,var(--s-text,var(--default-color,#222)));font:13px/1.5 sans-serif;';
    const status=element(doc,'p'),cards=element(doc,'div'),controls=element(doc,'div');status.setAttribute('role','status');root.append(summary,status,controls,cards,element(doc,'small',attribution));
    const history=K.history(client);let busy=false,viewGeneration=0;
    const latest=button(doc,'Latest',()=>load(()=>history.select(id))),older=button(doc,'Older',()=>load(()=>history.older())),copy=button(doc,'Copy selected',async()=>{const value=history.text();if(!value)return;try{await clipboard(value);status.textContent='Selected loadout copied.';}catch{status.textContent='Clipboard unavailable. Select the equipment text to copy it.';}});
    controls.append(latest,older,copy);
    function sync(){latest.disabled=busy;older.disabled=busy||!history.selected()?.pagination?.next_cursor;copy.disabled=busy||!history.selected();}
    async function load(work){if(busy)return;busy=true;const generation=++viewGeneration;cards.replaceChildren();status.textContent='Loading KAL equipment…';sync();try{const value=await work();if(generation!==viewGeneration||!value)return;status.textContent='Observed: '+K.stamp(value.observed_at);for(const item of value.equipment){const card=element(doc,'pre',K.equipmentText(item));card.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;padding:8px;border:1px solid currentColor;border-radius:5px;font:inherit;';cards.append(card);}if(!value.equipment.length)cards.append(element(doc,'p','No equipment records returned. Missing slots are unknown.'));}catch(error){if(generation===viewGeneration)status.textContent=error.message;}finally{if(generation===viewGeneration){busy=false;sync();}}}
    async function refresh(){const state=await client.status();root.hidden=!pagePlayer(location)||!state.enabled||state.display==='official';if(root.hidden){viewGeneration++;busy=false;history.clear();cards.replaceChildren();root.open=false;}sync();}
    root.addEventListener('toggle',()=>{if(root.open&&!root.hidden&&!history.selected())void load(()=>history.select(id));});
    doc.addEventListener('kal-settings-changed',()=>void refresh().catch(()=>{}));
    global.addEventListener?.('popstate',()=>{const next=pagePlayer(location);if(next===id)return;id=next;viewGeneration++;busy=false;history.clear();cards.replaceChildren();root.open=false;root.hidden=true;sync();void refresh().catch(()=>{});});
    (doc.body||doc.documentElement).append(root);sync();void refresh().catch(error=>{status.textContent=error.message;root.hidden=true;});
    return {root,refresh};
  }
  global.SLINK_KAL_UI=Object.freeze({mountSettings,mountPage,pagePlayer});
})(globalThis);
