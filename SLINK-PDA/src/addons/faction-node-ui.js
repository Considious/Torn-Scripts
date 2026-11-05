(function installFactionNodeUI(global) {
  'use strict';
  const labels={faction:'Entire faction',selected:'Selected members',leaders:'Leaders only'};
  // UI inspiration: Torn Rooms by Manuel Cecchetto (github.com/manuelcecchetto/torn-rooms).
  // SLINK implementation and artwork; no Torn Rooms code or generated assets are reused.
  function mount({client,activity,domActivity=activity,theme,media,view,preferences,onManage,document:doc=global.document,child=null}) {
    let launcher=null,host=null,root=null,observer=null,discovery=null,observedChat=null,selected=null,mediaPanel=null,disposed=false,readTimer=null,typingTimer=null,actionMenu=null,pressTimer=null;
    const rows=new Map(),drafts=new Map(),names=child?.names||new Map(),reserved=new Set(),watched=new Set();
    const roomWindows=new Map();
    let recentRoom=null,hubFront=false;
    const openPanels=()=>[host,...[...roomWindows.values()].map(item=>item.ui.element())].filter(el=>el&&!el.hidden);
    let resizeObserver=null,placementFrame=null,dockStyle=null,lastGap=3,lastSize={width:300,height:400},soundEnabled=true,autoMedia=child?.autoMedia?.()!==false,roomSounds={},consented=!preferences,preferencesReady=!preferences,audio=null,lastSoundAt=0,sending=false,preferenceLoading=null;
    const nativePanelSelector='[class*="item___"] [class*="root___Ex8tg"]';
    function unreserve(){for(const el of reserved)el.removeAttribute('data-slink-room-reserve');reserved.clear();dockStyle?.remove();dockStyle=null;}
    function sizeInput(event){if(event.target.matches?.('#chatRoot input[type="range"]'))schedulePlace();}
    function nativeTransition(event){if(!domEligible()||!['transform','width','height'].includes(event.propertyName))return;if(event.target.matches?.('#chatRoot [class*="item___"],#chatRoot [class*="root___Ex8tg"]'))schedulePlace();}
    function schedulePlace(){if(child||!domEligible()||!openPanels().length||placementFrame!==null)return;placementFrame=global.requestAnimationFrame(()=>{placementFrame=null;place();});}
    function loadPreferences(){if(!preferences||preferenceLoading)return;preferenceLoading=Promise.resolve(preferences.get()).then(value=>{const oldConsent=consented;activity.setIdleMinutes?.([0,1,5,15,60].includes(value.idleMinutes)?value.idleMinutes:0);soundEnabled=value.soundEnabled!==false;const mediaChanged=autoMedia!==(value.autoMedia!==false);autoMedia=value.autoMedia!==false;roomSounds=value.roomSounds||{};pins=global.SLINK_FACTION_NODE?.validPins?.(value.pins)?value.pins:[];paintPins();consented=value.noticeAccepted===global.SLINK_FACTION_NODE?.ROOM_NOTICE;const first=!preferencesReady;preferencesReady=true;if(root){$('[data-room-sound]').checked=soundEnabled;paintList();if(mediaChanged){if(!autoMedia)for(const row of rows.values())for(const image of row.querySelectorAll('img.preview'))image.remove();paintRoom();}}if(first||oldConsent!==consented)global.queueMicrotask(sync);}).catch(()=>{}).finally(()=>{preferenceLoading=null;});}
    async function saveSound(){const next=$('[data-room-sound]').checked;try{if(preferences)await preferences.patch({soundEnabled:next});soundEnabled=next;if(next)primeAudio();else{void audio?.close().catch(()=>{});audio=null;}}catch(error){$('[data-room-sound]').checked=soundEnabled;throw error;}}
    async function ensureConsent(){if(!preferences)return true;await preferenceLoading;if(consented)return true;if(!global.confirm(global.SLINK_FACTION_NODE.ROOM_NOTICE_TEXT+'\n\nContinue to SLINK Rooms?'))return false;await preferences.patch({noticeAccepted:global.SLINK_FACTION_NODE.ROOM_NOTICE});consented=true;client.setActive(true);return true;}
    async function roomSound(id,checked){const saved=preferences?await preferences.patch({roomSounds:{[id]:checked}}):null;roomSounds=saved?.roomSounds||{...roomSounds,[id]:checked};if(checked)primeAudio();}
    function primeAudio(){if(!soundEnabled)return;try{const Audio=global.AudioContext||global.webkitAudioContext;if(!Audio)return;audio||=new Audio();void audio.resume().catch(()=>{});}catch{}}
    function messageSound(event){if(!soundEnabled||roomSounds[event.id]===false||!event.incoming||!eligible()||Date.now()-lastSoundAt<500)return;lastSoundAt=Date.now();primeAudio();if(!audio||audio.state!=='running')return;try{const tone=audio.createOscillator(),gain=audio.createGain();tone.type='sine';tone.frequency.setValueAtTime(740,audio.currentTime);tone.frequency.setValueAtTime(880,audio.currentTime+0.09);gain.gain.setValueAtTime(0.06,audio.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+0.22);tone.connect(gain);gain.connect(audio.destination);tone.onended=()=>{tone.disconnect();gain.disconnect();};tone.start();tone.stop(audio.currentTime+0.23);}catch{}}
    function knownName(message){const id=Number(message.user_id),raw=String(message.display_name||'').trim();if(raw&&!/^Player(?:\s+\d+)?$/i.test(raw)){names.set(id,raw);return raw;}const resolved=names.get(id)||(id===client.model.userId?client.model.userName:'');return resolved&&!/^Player(?:\s+\d+)?$/i.test(resolved)?resolved:'Member';}
    function loadNames(){if(loadNames.loaded||!client.members)return;loadNames.loaded=true;void client.members().then(result=>{if(disposed)return;for(const member of result.members||[])if(member.user_name&&!/^Player(?:\s+\d+)?$/i.test(member.user_name))names.set(Number(member.user_id),member.user_name);if(eligible()&&root&&selected)paintRoom();}).catch(()=>{});}
    function learnNames(){if(client.model.userName&&!/^Player(?:\s+\d+)?$/i.test(client.model.userName))names.set(client.model.userId,client.model.userName);for(const room of client.model.rooms)for(const person of client.room(room.room_id).presence||[])if(person.display_name&&!/^Player(?:\s+\d+)?$/i.test(person.display_name))names.set(Number(person.user_id),person.display_name);}

    let currentView='home',mediaType='gif',savedView=null,viewReady=!view,restoreStarted=false,restoring=false,lastWritten='',navigationRevision=0;
    const eligible=()=>!disposed&&activity.eligible();
    const domEligible=()=>!disposed&&domActivity.eligible();
    const $=selector=>root.querySelector(selector);
    const node=(tag,text)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
    function button(text,handler){const el=node('button',text);el.type='button';el.addEventListener('click',()=>void attempt(handler));return el;}
    function notice(message){if(root){const el=$('[data-notice]');el.textContent=String(message||'');el.hidden=!message;}}
    async function attempt(task){if(!eligible())return;try{await task();}catch(error){notice(error.message||'This action could not be completed.');}}
    function remember(){syncButtons();if(!view||!host)return;const identified=!!client.model.userId&&!!client.model.factionId;if(restoring||!identified)return;const record=!identified||restoring?{visible:false}:{visible:!host.hidden,view:currentView==='media'?'chat':currentView,userId:client.model.userId,factionId:client.model.factionId,roomId:selected||null,windows:[...roomWindows].map(([id,{ui}])=>({id,minimized:ui.element()?.hidden===true}))},encoded=JSON.stringify(record);if(encoded===lastWritten)return;lastWritten=encoded;void Promise.resolve().then(()=>view.save(record)).catch(error=>{if(lastWritten===encoded)lastWritten='';if(!disposed&&!host.hidden)notice('Could not remember this window: '+error.message);});}
    async function restore(){
      if(!preferencesReady||!consented||!viewReady||!(savedView?.visible||savedView?.windows?.length)||restoreStarted||!eligible()||!domEligible()||!launcher?.isConnected||navigationRevision)return;
      restoreStarted=true;restoring=true;
      try{
        create();host.hidden=!savedView.visible;show('home');const revision=navigationRevision;
        await client.refresh();if(revision!==navigationRevision)return;
        const same=savedView.userId===client.model.userId&&savedView.factionId===client.model.factionId;
        const previous=savedView.windows??(savedView.view==='chat'&&savedView.roomId?[{id:savedView.roomId,minimized:false}]:[]);
        if(same)for(const entry of previous.slice(0,12))if(client.model.rooms.some(room=>room.room_id===entry.id)){
          openRoom(entry.id);if(entry.minimized)roomWindows.get(entry.id)?.ui.hideRoom();
        }
        updateRoomFocus();
      }catch(error){notice(error.message);}finally{restoring=false;remember();}
    }
    function paintTheme(){if(!host)return;const tokens=theme?.()||{};for(const [name,value]of Object.entries(tokens))if(name.startsWith('--slink-')&&typeof value==='string'){host.style.setProperty(name,value);launcher?.style.setProperty(name,value);}}
    function place(){
      if(child){child.layout();return;}
      syncButtons();
      const windows=openPanels();
      if(!windows.length||!launcher?.isConnected){unreserve();return;}
      if(!domEligible())return;
      const chat=doc.getElementById('chatRoot'),bar=launcher.parentElement,barRect=bar.getBoundingClientRect(),panels=[...(chat?.querySelectorAll(nativePanelSelector)||[])].filter(el=>{const r=el.getBoundingClientRect();return !el.hidden&&r.width>40&&r.height>80&&global.getComputedStyle(el).visibility!=='hidden';});
      // Share Torn's outer chat stacking level, but paint before its native UI.
      // This keeps native badges/popovers above Rooms without lowering it behind
      // unrelated page content or changing any native z-index.
      const ancestors=[];for(let el=bar;el&&el!==chat;el=el.parentElement)ancestors.unshift(el);
      let layer=0;for(const el of ancestors){const style=global.getComputedStyle(el);if(style.zIndex!=='auto'){layer=Number(style.zIndex)||0;break;}if(['fixed','sticky'].includes(style.position)||style.transform!=='none'||Number(style.opacity)<1||style.isolation==='isolate')break;}
      for(const panel of windows){if(panel.style.zIndex!==String(layer))panel.style.zIndex=String(layer);if(panel.parentElement!==chat)chat.prepend(panel);}
      const primary=panels.find(el=>!['notes_panel','people_panel'].includes(el.id))||panels[0];
      if(primary){const r=primary.getBoundingClientRect();lastSize={width:r.width,height:r.height};}
      else for(const input of chat?.querySelectorAll('[class*="panelSizeContainer___"] input[type="range"]')||[]){const label=(input.closest('label')||input.parentElement.querySelector('label'))?.textContent||'',percent=Number(input.value);if(!Number.isFinite(percent))continue;if(/^Height\b/i.test(label))lastSize.height=400*percent/100;else if(/^Width\b/i.test(label))lastSize.width=300*percent/100;}
      // Measure the complete Torn window, not just its inner content panel.
      const exterior=el=>{const inner=el.getBoundingClientRect(),frame=el.closest('[class*="root___tV4zg"]'),outer=frame?.getBoundingClientRect();return outer&&outer.width>0?{left:Math.min(inner.left,outer.left),right:Math.max(inner.right,outer.right)}:inner;};
      const next=new Set(panels.map(el=>el.closest('[class*="item___"]')).filter(Boolean));
      for(const el of reserved)if(!next.has(el))el.removeAttribute('data-slink-room-reserve');
      reserved.clear();let index=0;for(const el of next){reserved.add(el);const key=String(index++);if(el.getAttribute('data-slink-room-reserve')!==key)el.setAttribute('data-slink-room-reserve',key);}
      if(next.size){dockStyle||=node('style');if(!dockStyle.isConnected)(doc.head||doc.documentElement).append(dockStyle);}
      // Torn sets transition-duration on these wrappers, which otherwise animates
      // our reservation as well as its DnD transform. Reserve instantly; retain
      // Torn's transform/opacity animations and leave the original inline styles alone.
      const baseCSS='[data-slink-room-reserve]{transition-property:transform,opacity!important;translate:0px 0!important}';
      if(dockStyle)dockStyle.textContent=baseCSS;
      const natural=panels.map(el=>({el,wrapper:el.closest('[class*="item___"]'),rect:exterior(el)}));
      const ordered=natural.map(item=>item.rect).sort((a,b)=>a.left-b.left),gaps=ordered.slice(1).map((rect,i)=>rect.left-ordered[i].right).filter(gap=>gap>0&&gap<64).sort((a,b)=>a-b);
      if(gaps.length)lastGap=gaps[Math.floor(gaps.length/2)];
      const panelRect=primary?.getBoundingClientRect(),width=Math.min(lastSize.width,global.innerWidth-16),bottom=Math.max(0,global.innerHeight-(panelRect?.bottom??barRect.top)),height=Math.min(lastSize.height,global.innerHeight-bottom-8),rightmost=natural.length?Math.max(...natural.map(item=>item.rect.right)):barRect.right;
      const base=Math.max(0,Math.min(global.innerWidth-width,global.innerWidth-rightmost));
      const capacity=Math.max(1,Math.floor((global.innerWidth-base+lastGap)/(width+lastGap)));
      const candidates=hubFront&&windows.includes(host)?[...windows.filter(panel=>panel!==host),host]:windows;
      const visible=(candidates.length>capacity?candidates.slice(-capacity):candidates).sort((a,b)=>Number(b===host)-Number(a===host));
      for(const panel of windows)panel.style.visibility=visible.includes(panel)?'visible':'hidden';
      visible.forEach((panel,i)=>{panel.style.width=width+'px';panel.style.height=Math.max(120,height)+'px';panel.style.bottom=bottom+'px';panel.style.right=(base+i*(width+lastGap))+'px';panel.style.maxHeight=Math.max(120,global.innerHeight-bottom-8)+'px';});
      const required=Math.max(0,rightmost-visible.at(-1).getBoundingClientRect().left+lastGap),shifts=new Map([...next].map(wrapper=>[wrapper,required]));
      const apply=()=>{if(dockStyle)dockStyle.textContent=baseCSS+[...shifts].map(([wrapper,pixels])=>'[data-slink-room-reserve="'+wrapper.getAttribute('data-slink-room-reserve')+'"]{translate:-'+pixels+'px 0!important}').join('');};
      apply();
      // CSS pixels in Torn's rail can be scaled. Calibrate against the actual
      // visible movement instead of assuming a 300px translate moved 300px.
      for(const wrapper of next){const sample=natural.find(item=>item.wrapper===wrapper),moved=sample.rect.right-exterior(sample.el).right;if(moved>0&&Math.abs(moved-required)>.25)shifts.set(wrapper,required*required/moved);}
      apply();
      if(!next.size){dockStyle?.remove();dockStyle=null;}
      if(!resizeObserver&&global.ResizeObserver)resizeObserver=new global.ResizeObserver(schedulePlace);const observe=new Set([...panels,bar]);for(const el of watched)if(!observe.has(el)){resizeObserver?.unobserve(el);watched.delete(el);}for(const el of observe)if(!watched.has(el)){watched.add(el);resizeObserver?.observe(el);}
      paintTheme();
    }
    function create(){
      if(host)return;
      host=node('section');host.style.cssText='position:fixed;top:auto;left:auto;right:0;bottom:0;visibility:hidden;margin:0;padding:0;border:0;box-sizing:border-box;min-width:0;max-width:none;transform:none;translate:none';host.dataset.slinkFactionNode='';host.hidden=true;root=host.attachShadow({mode:'open'});
      root.innerHTML=`<style>
      :host{position:fixed;z-index:0;display:block;width:min(390px,calc(100vw - 16px));height:min(560px,75dvh);color:var(--slink-text,#eee);font:13px/1.4 Arial,sans-serif} :host([hidden]){display:none!important}*{box-sizing:border-box}[hidden]{display:none!important}
      .window{height:100%;display:flex;flex-direction:column;border:1px solid var(--slink-accent,#8751aa);border-radius:8px;background:var(--slink-panel,#19191f);box-shadow:0 4px 18px #0008;overflow:hidden}header,.toolbar,.compose,.footer{flex:none;padding:7px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}header{background:var(--slink-surface,#22232b);border-bottom:1px solid var(--slink-border,#555)}header strong{flex:1;min-width:0}button,input,select,textarea{font:inherit;color:inherit;border:1px solid var(--slink-border,#666);border-radius:5px;background:var(--slink-surface,#282932)}button{cursor:pointer;padding:5px 8px;white-space:normal}button:disabled{opacity:.5;cursor:default}input,select,textarea{padding:6px;min-width:0;max-width:100%}input:not([type=checkbox]),select{width:100%}textarea{resize:vertical;width:100%;min-height:38px;max-height:90px}a{color:var(--slink-accent,#c5a8f9)}p{margin:5px 0}.body{min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden}.scroll{min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;flex:1;padding:8px}.room-list{display:grid;gap:6px;align-content:start;grid-auto-rows:max-content}.room-list .room-entry{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;min-height:48px;height:auto;padding:8px 10px;background:rgba(20,18,26,.82)}.room-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.room-entry{width:100%}.room-sound{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;font-size:12px}.room-list small{display:block;opacity:.9;line-height:1.35}.room-description{white-space:pre-wrap;overflow-wrap:anywhere}.room-list .room-entry strong{font-size:13px}.toolbar{padding-top:4px;padding-bottom:4px}.toolbar select{flex:1;width:auto}.notice{flex:none;padding:0 8px;overflow-wrap:anywhere;max-height:80px;overflow:auto;color:var(--slink-warning,#ffd783)}.messages{list-style:none;padding:0;margin:0}.message{padding:7px 8px;margin:0 0 5px;border:1px solid #ffffff18;border-radius:5px;background:rgba(9,10,14,.82);color:#f6f5f8;overflow-wrap:anywhere}.message a{color:var(--slink-link,#d3baff)}.scroll{background:rgba(10,9,15,.45)}.meta{display:flex;gap:5px;align-items:baseline;flex-wrap:wrap}.meta small{opacity:.65}.text{white-space:pre-wrap;overflow-wrap:anywhere}.message-menu{position:fixed;z-index:2147483647;display:grid;min-width:120px;padding:4px;gap:2px;background:var(--slink-surface,#24222b);border:1px solid var(--slink-border,#888);border-radius:6px;box-shadow:0 3px 14px #0009}.message-menu button{text-align:left;padding:7px 12px}.message:focus-visible{outline:1px solid var(--slink-accent,#ad82df)}.message .actions{display:flex;gap:5px;margin-top:4px}.actions button{font-size:11px;padding:2px 5px}.compose{display:block;padding:4px 6px;border-top:1px solid var(--slink-border,#555)}.compose textarea{height:34px;min-height:34px;max-height:72px}.compose .actions{display:flex;gap:5px;margin-top:3px;flex-wrap:wrap}.compose .actions button{font-size:11px;padding:3px 7px}.compose .actions button:first-child{margin-right:auto}.field{display:block;margin:9px 0}.field span{display:block;font-weight:bold;margin-bottom:3px}.checks label{display:block;margin:8px 0}.group{border-top:1px solid #8885;margin-top:10px;padding-top:8px}.pending{font-size:12px;color:var(--slink-warning,#ffd783)}.preview{display:block;max-width:100%;max-height:180px;object-fit:contain}.muted{opacity:.75}.footer{font-size:11px;line-height:1.2;padding:2px 6px;opacity:.8}.media-surface{height:100%;min-height:0;overflow:auto}.reply{border-left:2px solid var(--slink-accent,#ad82df);padding-left:5px;font-size:12px;white-space:pre-wrap}
      /* Compact Torn-style Rooms chrome, with independent SLINK artwork. */
      :host{font:13px/1.35 Arial,sans-serif}
      .window{border-radius:6px 6px 3px 3px;border-color:var(--slink-border,#4b4b4b);background-color:var(--slink-panel,#292929);box-shadow:0 3px 12px #0007}
      header{min-height:36px;padding:4px 6px;flex-wrap:nowrap;gap:4px;background:linear-gradient(#ffffff19,#0000002a),var(--room-header-color,#20516d);border-bottom:1px solid #0008}
      .directory-tools{display:flex;gap:4px;padding:5px;border-bottom:1px solid #ffffff26;background:#333}
      .directory-tools input[type=search]{height:32px;background:#090909;color:#eee;border:1px solid #555;flex:1;min-width:0}
      .directory-menu{padding:4px 6px;background:#363636}.directory-menu>summary,.room-options>summary{cursor:pointer;list-style:none}
      .room-row{grid-template-columns:minmax(0,1fr) auto;border:0;align-items:center}
      .room-list .room-entry{display:grid;grid-template-columns:42px minmax(0,1fr);min-height:58px;align-items:center;width:100%;gap:8px}
      .room-icon{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:19px;color:#fff;position:relative}
      .room-icon b{position:absolute;left:-2px;top:-3px;border-radius:50%;background:#668b2a;border:1px solid #c4ea75;padding:0 3px;font-size:10px}
      .room-copy{min-width:0}.room-copy strong,.room-copy small{display:block;overflow:hidden;text-overflow:ellipsis}
      .room-copy strong{white-space:nowrap}.room-copy small{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
      .room-options{font-size:12px}.room-options summary{padding:4px}.room-options[open]{min-width:65px}
      .window .scroll{background:#303030;color:#eee}.message{display:table;max-width:100%;background:#202020;color:#eee}.message[data-mine]{margin-left:auto;background:#080808}
      .window{background:#303030;color:#e8e8e8;border-color:#494949}
      header{color:#fff;border-bottom-color:#151515;font-weight:700}
      .directory-tools{background:linear-gradient(#4a4a4a,#333);border-color:#151515}
      .compose{background:#303030;border-top:1px solid #484848}
      .compose textarea{background:transparent;color:#eee}
      .compose textarea::placeholder{color:#a0a0a0}
      .footer{background:#303030;border-top:1px solid #484848;color:#aaa}
      .message .meta,.message .text{display:inline}.message .meta small{display:none}.message .meta a{color:inherit;text-decoration:none}.message .meta a:hover{text-decoration:underline}
      [data-personal-rooms]{padding:4px 6px;margin:0;border-top:0}.personal-create{display:block;font-weight:700;padding:5px 0}

      header strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:3px}
      header button,.room-tools button{display:grid;place-items:center;width:28px;height:27px;padding:0;border:0;background:transparent;border-radius:4px}
      header button:hover,.room-tools button:hover{background:#ffffff26}
      header svg,.compose svg{width:16px;height:16px;display:block}
      .toolbar{padding:4px 6px;min-height:30px;gap:5px}
      .room-list{gap:2px}.room-row{gap:4px;padding:3px 0;border-bottom:1px solid #ffffff14}
      .room-list .room-entry{min-height:35px;padding:4px 6px;gap:1px;border:0;background:transparent}
      .room-list .room-entry:hover{background:#ffffff16}.room-row select{width:auto;padding:2px}
      .scroll{padding:4px 6px;background:#0002}.message{padding:3px 6px;margin:0 0 3px;border:0;border-radius:4px;background:#0005}
      .meta{gap:4px}.meta a{font-weight:700}.meta small{font-size:10px;margin-left:auto}
      .compose{padding:3px 5px;background:var(--slink-surface,#343434);border-top:1px solid #ffffff16}
      .compose-line{display:flex;align-items:end;gap:3px}.compose textarea{flex:1;min-height:28px;height:28px;border:0;background:#0002;padding:5px 6px;resize:none}
      .compose button{border:0;background:transparent;padding:3px 4px;min-height:25px}.compose button:hover:not(:disabled){background:#ffffff22}
      .compose [data-send]{display:grid;place-items:center;width:28px;flex:none}.compose [data-cancel-reply]{font-size:11px}
      .footer{min-height:17px;background:#0003;color:var(--slink-muted,#bbb);padding:2px 6px}
      [data-personal-rooms]{padding:4px 2px;border-top:1px solid #ffffff21;margin-top:4px}
      .window{border-radius:5px;box-shadow:0 2px 7px #0007;font:13px Arial,sans-serif}
      header{height:36px;min-height:36px;padding:0 5px 0 8px;background:linear-gradient(#ffffff25,#0005),var(--room-header-color,#20516d);box-shadow:inset 0 1px 2px #ffffff40}
      header strong{font-size:14px}.window header button{color:#ddd}.window header [data-header-icon]{display:grid;place-items:center;width:22px;font-size:19px;color:#ddd}.window header [data-close] svg{width:21px;height:21px}
      .window .scroll{padding:5px 6px;background:#333}.window .message{padding:4px 6px;background:#222;border-radius:5px}.window .message[data-mine]{background:#080808}
      .window .compose{background:#333;padding:2px 4px}.window .compose textarea{height:34px;min-height:34px;background:transparent}.window .compose [data-send] svg{width:21px;height:21px}
      .window .footer{justify-content:center;border-top:0;background:#333;color:#aaa;min-height:20px}
      </style><div class="window"><header><span data-header-icon aria-hidden="true">${roomGlyph}</span><strong data-window-title>SLINK Rooms</strong><button type="button" data-home aria-label="Room list" title="Room list">${roomGlyph}</button><button type="button" data-admin aria-label="Manage rooms" title="Manage rooms" hidden>⚙</button><button type="button" data-room-info aria-expanded="false" aria-label="Room information" title="Room information" hidden>⌄</button><button type="button" data-close aria-label="Minimize faction rooms"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 17h18v3H3z"/></svg></button><button type="button" data-close-room aria-label="Close room" title="Close room" hidden>×</button></header>
      <p class="notice" data-notice role="status" hidden></p><div class="body" data-home-view><div class="directory-tools"><input data-room-search type="search" placeholder="Search your rooms" aria-label="Search your rooms"><details class="directory-menu"><summary aria-label="Room settings">⚙</summary><button type="button" data-refresh>Refresh rooms</button><label><input type="checkbox" data-room-sound checked> Notification sounds</label><p><a href="https://github.com/manuelcecchetto/torn-rooms" target="_blank" rel="noopener noreferrer">Design inspired by Torn Rooms</a></p></details></div><div class="scroll"><section data-personal-rooms></section><div class="room-list" data-rooms></div></div></div>
      <div class="body" data-chat-view hidden><div data-room-details hidden><p class="room-description" data-room-description></p><div class="toolbar"><button type="button" data-reconnect>Reconnect</button><button type="button" data-older>Earlier messages</button></div></div><div class="scroll" data-scroller><ol class="messages" data-messages></ol></div><div class="pending" data-pending></div><div class="footer" data-room-status></div><div class="compose"><div class="reply" data-reply hidden></div><div class="compose-line"><textarea data-draft maxlength="4096" rows="1" placeholder="Type your message here…" aria-label="Room message"></textarea><button type="button" data-gifs>GIF</button><button type="button" data-stickers>Sticker</button><button type="button" data-send aria-label="Send" title="Send">${sendGlyph}</button></div><button type="button" data-cancel-reply hidden>Cancel reply/edit</button></div></div>
      <div class="body" data-media-view hidden><div class="toolbar"><button type="button" data-media-back>Back to room</button></div><div class="media-surface" data-media></div></div>
      <div data-admin-view hidden></div></div>`;
      // Static template only. All server/user strings below use textContent or text nodes.
      root.addEventListener('pointerdown',event=>{child?.focus();if(actionMenu&&!event.target.closest('.message-menu'))closeMessageActions();},true);root.addEventListener('scroll',event=>{if(!actionMenu?.contains(root.activeElement)&&!actionMenu?.contains(event.target))closeMessageActions();},true);
      $('[data-close-room]').hidden=!child;
      $('[data-close-room]').onclick=()=>child?.close();
      if(child){$('[data-home]').hidden=true;$('[data-admin]').hidden=true;}
      $('[data-close]').onclick=()=>{if(child){child.minimize();return;}closeMessageActions();host.hidden=true;place();mediaPanel?.suspend();remember();};
      host.setAttribute('role','dialog');host.setAttribute('aria-label','SLINK Faction Rooms');doc.getElementById('chatRoot')?.prepend(host);
      $('[data-home]').onclick=()=>show('home');$('[data-admin]').onclick=()=>void attempt(openAdmin);
      $('[data-refresh]').onclick=()=>void attempt(()=>client.refresh());$('[data-reconnect]').onclick=()=>selected&&void client.connect(selected,true);
      $('[data-room-search]').oninput=paintList;
      $('[data-send]').onclick=()=>void attempt(sendDraft);
      $('[data-room-sound]').onchange=()=>void attempt(saveSound);
      $('[data-room-info]').onclick=()=>{const info=$('[data-room-details]');info.hidden=!info.hidden;$('[data-room-info]').setAttribute('aria-expanded',String(!info.hidden));};
      $('[data-draft]').addEventListener('keydown',event=>{if(event.key!=='Enter'||event.shiftKey||event.isComposing||event.keyCode===229)return;event.preventDefault();event.stopPropagation();if(!event.repeat&&!$('[data-send]').disabled)void attempt(sendDraft);});
      loadPreferences();$('[data-cancel-reply]').onclick=clearReply;
      $('[data-draft]').addEventListener('input',()=>{if(!selected)return;const draft=$('[data-draft]');draft.style.height='34px';draft.style.height=Math.min(72,Math.max(34,draft.scrollHeight))+'px';drafts.set(selected,draft.value);if(!typingTimer&&eligible()){try{client.command(selected,{type:'typing'});}catch{}typingTimer=global.setTimeout(()=>{typingTimer=null;},3000);}});
      $('[data-scroller]').addEventListener('scroll',markRead);$('[data-older]').onclick=()=>void attempt(async()=>{if(selected)await client.older(selected);});
      $('[data-gifs]').onclick=()=>void attempt(()=>openMedia('gif'));$('[data-stickers]').onclick=()=>void attempt(()=>openMedia('sticker'));$('[data-media-back]').onclick=()=>{mediaPanel?.suspend();show('chat');};

    }
    function show(nextView){if(!host)return;closeMessageActions();navigationRevision++;currentView=nextView;for(const name of ['home','chat','admin','media'])$('[data-'+name+'-view]').hidden=name!==nextView;if(nextView!=='media')mediaPanel?.suspend();notice('');place();if(nextView==='chat')paintRoom();else if(nextView==='home')paintList();remember();}
    function markRead(){if(readTimer||!selected||host.hidden||$('[data-chat-view]').hidden||!domEligible())return;const scroller=$('[data-scroller]');if(scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight>30)return;const readingRoom=selected;readTimer=global.setTimeout(()=>{readTimer=null;if(!domEligible()||host.hidden||selected!==readingRoom||$('[data-chat-view]').hidden||scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight>30)return;const state=client.room(readingRoom),seq=Math.max(0,...[...state.messages.values()].map(m=>m.seq));if(seq>(state.lastRead||0)){try{client.command(selected,{type:'read',seq});state.lastRead=seq;state.unread=0;paintBadge();}catch{}}},1500);}
    function paintBadge(){if(!launcher)return;const count=[...client.model.rooms].reduce((n,item)=>n+client.room(item.room_id).unread,0);launcher.setAttribute('aria-label','SLINK Faction Rooms'+(count?', '+count+' unread messages':''));let badge=launcher.querySelector('[data-node-unread]');if(!count){badge?.remove();return;}if(!badge){badge=node('div');badge.dataset.nodeUnread='';badge.className='messageCount___EWpiR';const span=node('span');span.className='root___XpplE headingH1___VK9XQ root____FDYX oneDigit___FJ3vn';span.style.color='white';badge.append(span);launcher.append(badge);}badge.firstChild.textContent=count>99?'99+':String(count);badge.firstChild.classList.toggle('oneDigit___FJ3vn',count<10);}
    let pins=[],pinBar=null,pinSignature='',pinSaving=false;
    function paintPins(){
      if(!launcher?.parentElement||!domEligible())return;
      const visible=[...roomWindows.keys()].flatMap(id=>{const item=client.model.rooms.find(room=>room.room_id===id),pin=pins.find(pin=>pin.id===id);return item?[{id,name:item.name,...roomLook(item,pin),unread:client.room(id).unread}]:[];});
      if(!pinBar&&!visible.length)return;
      if(!pinBar){pinBar=node('span');pinBar.dataset.slinkRoomPins='';pinBar.style.cssText='display:inline-flex;flex:none;align-items:center;gap:2px';}
      if(pinBar.nextElementSibling!==launcher)launcher.before(pinBar);
      const key=JSON.stringify(visible);if(pinSignature===key)return;pinSignature=key;
      pinBar.replaceChildren(...visible.map(pin=>{
        const el=button(pin.icon,()=>toggleRoom(pin.id));
        el.className=launcher.className;el.dataset.roomPin=pin.id;el.title=pin.name;el.setAttribute('aria-label',pin.name+(pin.unread?', '+pin.unread+' unread':''));
        el.style.cssText=barButtonCss+';background-color:'+pin.color;
        if(pin.unread){const badge=node('span',pin.unread>99?'99+':String(pin.unread));badge.style.cssText='position:absolute;top:-4px;right:-2px;background:#19743c;color:white;border-radius:9px;font:700 10px system-ui;padding:1px 3px';el.append(badge);}
        return el;
      }));
      pinBar.hidden=!visible.length;pinBar.style.display=visible.length?'inline-flex':'none';
      for(const key of ['--room-button-width','--room-button-height'])pinBar.style.setProperty(key,launcher.style.getPropertyValue(key));
      syncButtons();
    }
    async function savePins(next){if(pinSaving)return;pinSaving=true;try{const saved=await preferences.patch({pins:next});pins=saved?.pins||next;paintList();}catch(error){notice('Not saved: '+error.message);paintList();}finally{pinSaving=false;}}
    function pinControls(item){
      const box=node('span'),pin=pins.find(row=>row.id===item.room_id),{pinIcons,pinColors}=global.SLINK_FACTION_NODE;
      const toggle=button(pin?'Reset style':'Customize',()=>void savePins(pin?pins.filter(row=>row.id!==pin.id):[...pins,{id:item.room_id,icon:pinIcons[0],color:pinColors[0]}]));toggle.disabled=!pin&&pins.length>=5;box.append(toggle);
      if(pin)for(const [key,values] of [['icon',pinIcons],['color',pinColors]]){
        const select=node('select');select.setAttribute('aria-label',key+' for '+item.name);
        values.forEach((value,index)=>{const option=node('option',key==='icon'?value:['Purple','Blue','Green','Red','Gold'][index]);option.value=value;select.append(option);});select.value=pin[key];
        select.onchange=()=>void savePins(pins.map(row=>row.id===pin.id?{...row,[key]:select.value}:row));box.append(select);
      }
      return box;
    }
    function paintPersonal(){
      const panel=$('[data-personal-rooms]'),data=client.model.personal||{used:0,limit:0,rooms:[]};
      const signature=JSON.stringify([client.model.userId,data]);if(panel.dataset.signature===signature)return;
      panel.dataset.signature=signature;panel.replaceChildren(node('p','Personal rooms · '+data.used+'/'+data.limit+' rooms available.'));
      const contact=node('a','Contact Considious [3853023] to purchase more rooms');contact.href='https://www.torn.com/profiles.php?XID=3853023';contact.target='_blank';contact.rel='noopener noreferrer';panel.append(contact);
      const makeField=(label,value,max)=>{const wrap=node('label',label+' '),input=node('input');input.value=value;input.maxLength=max;wrap.className='field';wrap.append(input);return [wrap,input];};
      const makeLookField=(label,values,value)=>{const wrap=node('label',label+' '),select=node('select');wrap.className='field';for(const [i,v] of values.entries()){const option=node('option',v.startsWith('#')?['Purple','Blue','Green','Red','Gold'][i]:v);option.value=v;select.append(option);}select.value=value;wrap.append(select);return [wrap,select];};
      const details=node('details'),summary=node('summary','Create New Chat Room');summary.className='personal-create';details.append(summary);
      const [nameField,name]=makeField('Room name','',60),[descField,description]=makeField('Description','',300);
      const [iconField,icon]=makeLookField('Icon',global.SLINK_FACTION_NODE.pinIcons,'◆'),[colorField,color]=makeLookField('Icon and header color',global.SLINK_FACTION_NODE.pinColors,'#20516d');
      let createId=null,createSignature='';
      async function change(control,input){
        if(control.disabled)return;control.disabled=true;
        try{await client.api('/api/personal-rooms',input);await client.refresh();}
        finally{control.disabled=false;}
      }
      const create=button('Create personal room',async()=>{const value=JSON.stringify([name.value.trim(),description.value,icon.value,color.value]);if(value!==createSignature){createSignature=value;createId=global.crypto.randomUUID();}await change(create,{action:'create',request_id:createId,name:name.value.trim(),description:description.value,icon:icon.value,color:color.value});});
      if(data.used<data.limit){details.append(nameField,descField,iconField,colorField,create);panel.append(details);}
      else{const unavailable=node('strong','Create New Chat Room');unavailable.className='personal-create';unavailable.setAttribute('aria-disabled','true');panel.prepend(unavailable);}
      for(const room of data.rooms||[]){
        const form=node('details');form.append(node('summary','Manage '+room.name));
        const [titleField,title]=makeField('Room name',room.name,60),[aboutField,about]=makeField('Description',room.description,300);
        const [roomIconField,roomIcon]=makeLookField('Icon',global.SLINK_FACTION_NODE.pinIcons,room.icon||'◆'),[roomColorField,roomColor]=makeLookField('Icon and header color',global.SLINK_FACTION_NODE.pinColors,room.color||'#20516d');
        const rename=button('Save details',()=>change(rename,{action:'update',room_id:room.room_id,name:title.value.trim(),description:about.value,icon:roomIcon.value,color:roomColor.value}));rename.disabled=!data.limit;
        const archive=button('Archive room',()=>global.confirm('Archive this personal room and free its slot?')?change(archive,{action:'archive',room_id:room.room_id}):undefined);
        const [memberField,member]=makeField('Faction member ID','',15);member.inputMode='numeric';
        const invite=button('Add member',()=>change(invite,{action:'member.set',room_id:room.room_id,user_id:Number(member.value),can_read:true,can_speak:true}));invite.disabled=!data.limit;
        form.append(titleField,aboutField,roomIconField,roomColorField,rename,archive,memberField,invite);
        for(const entry of room.members||[]){
          const memberRow=node('p','Player '+entry.user_id+' ');
          const remove=button('Remove',()=>change(remove,{action:'member.remove',room_id:room.room_id,user_id:entry.user_id}));remove.disabled=!data.limit;memberRow.append(remove);form.append(memberRow);
        }
        panel.append(form);
      }
    }
    function roomLook(item,pin){return {icon:item?.icon||pin?.icon||"◆",color:item?.color||pin?.color||"#20516d"};}
    function paintList(){
      paintBadge();paintPins();if(!root||host.hidden||currentView!=='home')return;
      paintPersonal();$('[data-admin]').hidden=!client.model.leader;
      const list=$('[data-rooms]'),query=$('[data-room-search]').value.trim().toLowerCase();
      const items=client.model.rooms.filter(item=>item.name.toLowerCase().includes(query));
      const snapshot=items.map(item=>{
        const state=client.room(item.room_id);
        let latest=null;for(const message of state.messages?.values()||[])if(!latest||message.seq>latest.seq)latest=message;
        return {item,unread:state.unread,latest};
      });
      const key=JSON.stringify([query,client.model.status,snapshot,roomSounds,pins]);if(list.dataset.signature===key)return;list.dataset.signature=key;list.replaceChildren();
      for(const {item,unread,latest} of snapshot){
        const pin=pins.find(pin=>pin.id===item.room_id),el=button('',()=>openRoom(item.room_id));el.className='room-entry';
        const look=roomLook(item,pin),icon=node('span',look.icon);icon.className='room-icon';icon.style.backgroundColor=look.color;icon.setAttribute('aria-hidden','true');if(unread)icon.append(node('b',unread>99?'99+':String(unread)));
        const copy=node('span');copy.className='room-copy';copy.append(node('strong',item.name));
        copy.append(node('small',latest&&!latest.deleted_at?knownName(latest)+': '+(latest.content?.text||'Media message'):item.description||labels[item.visibility]||'Room'));
        el.append(icon,copy);el.setAttribute('aria-label',item.name+(unread?', '+unread+' unread':''));const row=node('div');row.className='room-row';row.append(el);
        if(preferences){const options=node('details');options.className='room-options';const summary=node('summary','⋯');summary.setAttribute('aria-label','Options for '+item.name);options.append(summary);
          const label=node('label'),check=node('input');check.type='checkbox';check.checked=roomSounds[item.room_id]!==false;check.setAttribute('aria-label','Notification sounds for '+item.name);
          check.onchange=()=>void attempt(()=>roomSound(item.room_id,check.checked));label.append(check,doc.createTextNode(' Sound'));options.append(label);
          if(global.SLINK_FACTION_NODE?.pinIcons)options.append(pinControls(item));row.append(options);
        }list.append(row);
      }
      if(!items.length)list.append(node('p',query?'No matching rooms.':client.model.status==='loading'?'Loading rooms…':'No accessible rooms.'));
    }
    function clearReply(){if(!root)return;$('[data-reply]').hidden=true;$('[data-reply]').textContent='';$('[data-cancel-reply]').hidden=true;delete host.dataset.replyTo;delete host.dataset.editId;}
    function updateRoomFocus(){
      const active=roomWindows.get(recentRoom)?.ui.element();
      client.setViewedRoom?.(active&&!active.hidden?recentRoom:[...roomWindows].reverse().find(([,item])=>!item.ui.element()?.hidden)?.[0]||null);
      paintPins();place();remember();
    }
    function toggleRoom(id){
      const entry=roomWindows.get(id),panel=entry?.ui.element();
      if(panel&&!panel.hidden&&panel.style.visibility!=='hidden'){entry.ui.hideRoom();updateRoomFocus();return;}
      openRoom(id);
    }
    function removeRoom(id){
      const entry=roomWindows.get(id);if(!entry)return;roomWindows.delete(id);entry.ui.dispose();
      if(recentRoom===id)recentRoom=null;updateRoomFocus();
    }
    function openRoom(id){
      let entry=roomWindows.get(id);
      if(!entry&&roomWindows.size>=12){notice('Close a room before opening another.');return;}
      if(!entry){
        const shared={...client,setActive(){},setBackground(){},setViewedRoom(){},dispose(){}};
        const ui=mount({client:shared,activity:{eligible,subscribe:()=>()=>{}},domActivity:{eligible:domEligible,subscribe:()=>()=>{}},theme,media,document:doc,
          child:{names,autoMedia:()=>autoMedia,focus:()=>{if(recentRoom!==id){recentRoom=id;updateRoomFocus();}},layout:schedulePlace,minimize:()=>{ui.hideRoom();updateRoomFocus();},close:()=>removeRoom(id),look:()=>roomLook(client.model.rooms.find(item=>item.room_id===id),pins.find(pin=>pin.id===id))}});
        entry={ui};roomWindows.set(id,entry);
      }else{roomWindows.delete(id);roomWindows.set(id,entry);}
      recentRoom=id;hubFront=false;entry.ui.openRoomWindow(id);updateRoomFocus();
    }
    function openLocalRoom(id){if(selected)drafts.set(selected,$('[data-draft]').value);selected=id;rows.clear();$('[data-messages]').replaceChildren();$('[data-draft]').value=drafts.get(id)||'';clearReply();show('chat');void client.connect(id);}
    function replyTo(message,edit=false){if(!eligible())return;host.dataset[edit?'editId':'replyTo']=message.message_id;delete host.dataset[edit?'replyTo':'editId'];$('[data-reply]').textContent=(edit?'Editing: ':'Replying to: ')+(message.content?.text||'Media message');$('[data-reply]').hidden=false;$('[data-cancel-reply]').hidden=false;if(edit)$('[data-draft]').value=message.content?.text||'';$('[data-draft]').focus();}
    async function sendDraft(){if(!selected||sending||$('[data-send]').disabled)return;const roomId=selected,text=$('[data-draft]').value,editing=host.dataset.editId,prior=editing&&client.room(roomId).messages.get(editing);if(!text.trim()&&prior?.content?.type!=='media')return;const content=prior?{...prior.content,text}:{type:host.dataset.replyTo?'reply':'text',text,...(host.dataset.replyTo?{reply_to:host.dataset.replyTo}:{})};sending=true;try{if(editing)await client.action(roomId,{type:'edit',message_id:editing,content});else client.send(roomId,content);}finally{sending=false;}if(selected===roomId&&$('[data-draft]').value===text){$('[data-draft]').value='';drafts.delete(roomId);clearReply();}}
    function messageRow(message,state){const li=node('li');li.className='message';if(Number(message.user_id)===Number(client.model.userId))li.dataset.mine='';li.dataset.messageId=message.message_id;li.dataset.revision=String(message.revision);li.dataset.displayName=knownName(message);li.dataset.mediaMode=autoMedia?'auto':'click';const meta=node('div');meta.className='meta';const profile=node('a',knownName(message) + ': ');profile.href='https://www.torn.com/profiles.php?XID='+Number(message.user_id);profile.target='_blank';profile.rel='noopener noreferrer';meta.append(profile);if(message.origin_faction_id!==client.model.factionId)meta.append(node('small','Faction '+message.origin_faction_id));meta.append(node('small',new Date(message.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));li.append(meta);
      if(message.deleted_at){li.append(node('p','Message removed'));return li;}
      if(message.reply_to){const quoted=state.messages.get(message.reply_to);const quote=node('div',(quoted?.display_name||'Earlier message')+': '+(quoted?.content?.text||'Media or unavailable message'));quote.className='reply';li.append(quote);}
      const text=node('div',message.content?.text||'');text.className='text';li.append(text);
      if(message.content?.url){try{const url=new URL(message.content.url);if(url.protocol==='https:'&&!url.username&&!url.password){const link=node('a','Open media');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';const image=()=>{const img=node('img');img.alt='Shared chat media';img.className='preview';img.referrerPolicy='no-referrer';img.loading='lazy';img.decoding='async';img.src=global.SLINK_CHAT_MEDIA?.getMediaUrl?.(url.href)||url.href;img.addEventListener('error',()=>{link.textContent='Open media (preview unavailable)';});return img;};if(autoMedia){link.textContent='';link.setAttribute('aria-label','Open shared media');link.append(image());li.append(link);}else{li.append(link);const preview=button('Show image',()=>{if(preview.dataset.loaded)return;preview.dataset.loaded='true';preview.replaceWith(image());});li.append(preview);}}}catch{}}
      li.tabIndex=0;li.setAttribute('aria-label','Message from '+knownName(message)+'. Right-click or hold for actions.');
      const roomId=selected;let press=null,suppressClickUntil=0;
      const cancelPress=()=>{global.clearTimeout(pressTimer);pressTimer=null;press=null;};
      li.addEventListener('contextmenu',event=>{if(event.target.closest('a'))return;event.preventDefault();cancelPress();showMessageActions(roomId,message.message_id,li,event.clientX,event.clientY);});
      li.addEventListener('keydown',event=>{if(event.key!=='ContextMenu'&&!(event.shiftKey&&event.key==='F10'))return;event.preventDefault();const rect=li.getBoundingClientRect();showMessageActions(roomId,message.message_id,li,rect.left+10,rect.top+10);});
      li.addEventListener('pointerdown',event=>{if(!['touch','pen'].includes(event.pointerType)||event.target.closest('a,button'))return;cancelPress();press={x:event.clientX,y:event.clientY};pressTimer=global.setTimeout(()=>{pressTimer=null;suppressClickUntil=Date.now()+900;showMessageActions(roomId,message.message_id,li,event.clientX,event.clientY);},500);});
      li.addEventListener('pointermove',event=>{if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)cancelPress();});
      for(const type of ['pointerup','pointercancel'])li.addEventListener(type,cancelPress);
      li.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}},true);
      return li;
    }
    function closeMessageActions(){global.clearTimeout(pressTimer);pressTimer=null;actionMenu?.remove();actionMenu=null;}
    function showMessageActions(roomId,id,row,x,y){
      closeMessageActions();if(!eligible()||selected!==roomId)return;
      const state=client.room(roomId),message=state.messages.get(id);if(!message||message.deleted_at||state.access.read===false)return;
      const menu=node('div');menu.className='message-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Message actions');actionMenu=menu;root.append(menu);
      const add=(label,handler,disabled=false)=>{const item=button(label,()=>{closeMessageActions();if(selected===roomId)return handler();});item.setAttribute('role','menuitem');item.disabled=disabled;menu.append(item);};
      add('Reply',()=>replyTo(message),!state.access.speak);
      const own=message.user_id===client.model.userId&&message.origin_faction_id===client.model.factionId;
      if(own)add('Edit',()=>replyTo(message,true),!state.access.speak);
      if(own||state.access.moderate)add('Delete',async()=>{if(global.confirm('Remove this message?'))await client.action(roomId,{type:'delete',message_id:id});});
      if(state.access.moderate&&!own&&Number(message.origin_faction_id)===client.model.factionId){add('Mute member…',()=>showTimedModeration(roomId,message,row,x,y,'mute'));add('Remove room access…',()=>showTimedModeration(roomId,message,row,x,y,'kick'));}
      const bounds=menu.getBoundingClientRect();menu.style.left=Math.max(4,Math.min(x,global.innerWidth-bounds.width-4))+'px';menu.style.top=Math.max(4,Math.min(y,global.innerHeight-bounds.height-4))+'px';
      menu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeMessageActions();row.focus();}else if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const items=[...menu.querySelectorAll('button:not(:disabled)')],index=items.indexOf(root.activeElement);items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}});menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
    }
    function showTimedModeration(roomId,message,row,x,y,action){
      closeMessageActions();if(selected!==roomId||!client.room(roomId).access.moderate)return;
      const menu=node('div');menu.className='message-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',action==='mute'?'Mute duration':'Remove access duration');actionMenu=menu;menu.style.maxHeight='calc(100vh - 16px)';menu.style.overflowY='auto';menu.append(node('strong',(action==='mute'?'Mute ':'Remove access: ')+knownName(message)));
      for(const [minutes,label]of [[15,'15 minutes'],[60,'1 hour'],[720,'12 hours'],[1440,'1 day'],[10080,'1 week'],[0,'Until restored']]){
        const item=button(label,async()=>{const current=client.room(roomId);if(selected!==roomId||!current.access.moderate)throw Error('You no longer have room moderation permission.');const roomName=client.model.rooms.find(room=>room.room_id===roomId)?.name||roomId,summary=(action==='mute'?'Mute ':'Remove room access for ')+knownName(message)+' ['+Number(message.user_id)+'] in '+roomName+' for '+label.toLowerCase()+'? '+(action==='mute'?'They can still read but cannot send.':'They cannot read or send in this SLINK room.');if(!global.confirm(summary))return;await client.api('/api/rooms/'+roomId+'/moderate',{message_id:message.message_id,action,duration_minutes:minutes});closeMessageActions();notice(action==='mute'?'Member muted in this room.':'Member access removed for this room.');});item.setAttribute('role','menuitem');menu.append(item);
      }
      menu.append(button('Cancel',closeMessageActions));root.append(menu);const bounds=menu.getBoundingClientRect();menu.style.left=Math.max(4,Math.min(x,global.innerWidth-bounds.width-4))+'px';menu.style.top=Math.max(4,Math.min(y,global.innerHeight-bounds.height-4))+'px';menu.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMessageActions();row.focus();}});menu.querySelector('button')?.focus({preventScroll:true});
    }
    function paintRoom(change){if(!selected||!root||!eligible()||host.hidden||$('[data-chat-view]').hidden)return;const state=client.room(selected),list=$('[data-messages]'),scroller=$('[data-scroller]'),bottom=scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<35,oldHeight=scroller.scrollHeight,oldTop=scroller.scrollTop;
      if(child){const look=child.look();host.style.setProperty('--room-header-color',look.color);const icon=$('[data-header-icon]');if(icon.textContent!==look.icon)icon.textContent=look.icon;}learnNames();const roomDetails=client.model.rooms.find(r=>r.room_id===selected);syncButtons();$('[data-room-description]').textContent=roomDetails?.description||'No description.';
      if(state.access.read===false){rows.clear();list.replaceChildren();$('[data-send]').disabled=true;$('[data-gifs]').disabled=true;$('[data-stickers]').disabled=true;$('[data-room-status]').textContent=state.error||(state.status==='connecting'?'Connecting to this room…':'Room access is unavailable.');paintBadge();return;}
      const changed=change&&state.messages.get(change.message_id),tail=list.lastElementChild,previous=changed&&rows.get(changed.message_id);
      let messages;
      if(changed&&rows.size+(previous?0:1)===state.messages.size&&(previous||changed.seq>Number(tail?.dataset.sequence||0))&&host.dataset.paintedMedia===String(autoMedia)){
        const row=messageRow(changed,state);row.dataset.sequence=String(changed.seq);
        if(previous)previous.replaceWith(row);else list.append(row);
        rows.set(changed.message_id,row);
      }else{
      messages=[...state.messages.values()].sort((a,b)=>a.seq-b.seq);const keep=new Set(messages.map(m=>m.message_id));for(const [id,el]of rows)if(!keep.has(id)){el.remove();rows.delete(id);}
      for(let index=0;index<messages.length;index++){const message=messages[index];let el=rows.get(message.message_id);if(!el||el.dataset.revision!==String(message.revision)||el.dataset.displayName!==knownName(message)||message.content?.url&&el.dataset.mediaMode!==(autoMedia?'auto':'click')){const replacement=messageRow(message,state);if(el)el.replaceWith(replacement);el=replacement;rows.set(message.message_id,el);}if(list.children[index]!==el)list.insertBefore(el,list.children[index]||null);}
      }
      host.dataset.paintedMedia=String(autoMedia);
      for(const el of [list.firstElementChild,list.lastElementChild])if(el)el.dataset.sequence=String(state.messages.get(el.dataset.messageId)?.seq||0);
      if(bottom)scroller.scrollTop=scroller.scrollHeight;else if(messages?.[0]?.seq<Number(host.dataset.firstSeq||Infinity))scroller.scrollTop=oldTop+scroller.scrollHeight-oldHeight;
      host.dataset.firstSeq=String(list.firstElementChild?.dataset.sequence||0);$('[data-send]').disabled=state.status!=='connected'||!state.access.speak;$('[data-gifs]').disabled=$('[data-stickers]').disabled=$('[data-send]').disabled;
      $('[data-room-status]').textContent=state.error||(state.status==='connected'?(state.access.speak?'Connected':state.access.reason||'Read only')+' · '+(state.presence?.length||0)+' online':state.status);
      $('[data-older]').disabled=!state.nextBefore||state.loadingOlder===true;const pending=$('[data-pending]');pending.replaceChildren();for(const [id,item]of state.pending){const line=node('div',(item.error||'Sending…')+' '+String(item.content.text||'Media message').slice(0,100));if(item.error)line.append(button('Retry',()=>client.retryPending(selected,id)),button('Discard',()=>client.discardPending(selected,id)));pending.append(line);}
      if(state.delivery?.status==='delivery_failed')notice(state.delivery.reason);paintBadge();markRead();
    }
    async function openMedia(type){if(!selected)return;mediaType=type;if(!mediaPanel){if(!global.SLINK_GIPHY_PANEL)throw Error('Chat media tools are not available.');mediaPanel=global.SLINK_GIPHY_PANEL(media?.(),{chatWindow:true,isActive:()=>eligible()&&!host.hidden&&!$('[data-media-view]').hidden,send:async url=>{client.send(selected,{type:'media',url,provider:'giphy'});show('chat');}});$('[data-media]').append(mediaPanel.host);}show('media');await mediaPanel.open(type);}
    async function openAdmin(){if(onManage){await onManage();if(host){host.hidden=true;client.setViewedRoom?.(null);unreserve();resizeObserver?.disconnect();remember();}}else notice('Open Quality of Life → Faction Rooms to manage rooms.');}
    const roomGlyph='<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 4h14v10H9l-4 3v-3H3z"/><path d="M8 18h7l4 3v-4h2V8h-2M6 8h8M6 11h5"/></svg>';
    const sendGlyph='<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 4l18 8-18 8 2-7 10-1-10-1z"/></svg>';
    const barButtonCss='position:relative;display:inline-grid;place-items:center;flex:none;width:var(--room-button-width,38px);min-width:0;height:var(--room-button-height,34px);margin:0;padding:0;color:white;border:1px solid #0006;border-radius:3px 3px 0 0;background-image:linear-gradient(#ffffff24,#0005)';
    function syncButtons(){
      const opened=!!host&&!host.hidden,chat=opened&&currentView==='chat';
      if(root){const title=$('[data-window-title]');if(title)title.textContent=chat?(client.model.rooms.find(room=>room.room_id===selected)?.name||'Room'):'SLINK Rooms';}
      if(launcher){launcher.setAttribute('aria-pressed',String(opened&&!chat));launcher.style.boxShadow=opened&&!chat?'inset 0 -2px currentColor':'';}
      for(const el of pinBar?.children||[]){const panel=roomWindows.get(el.dataset.roomPin)?.ui.element(),on=panel&&!panel.hidden&&panel.style.visibility!=='hidden';el.setAttribute('aria-pressed',String(!!on));el.style.boxShadow=on?'inset 0 -2px currentColor':'';}
    }
    function attach(){if(child||!domEligible())return;const chat=doc.getElementById('chatRoot'),anchor=chat?.querySelector('#people_panel_button');if(!anchor)return;if(!launcher){launcher=node('button');launcher.innerHTML=roomGlyph;launcher.type='button';launcher.id='slink-faction-node-button';launcher.title='SLINK Faction Rooms';launcher.className=anchor.className;launcher.style.cssText=barButtonCss+';background-color:var(--slink-surface,#3c3c3c)';launcher.onclick=()=>void attempt(async()=>{if(!await ensureConsent())return;const first=!host;create();host.hidden=!host.hidden&&host.style.visibility!=='hidden';if(!host.hidden)hubFront=true;client.setViewedRoom?.(!host.hidden&&currentView==='chat'?selected:null);if(host.hidden)place();primeAudio();if(!host.hidden){if(first)show('home');await client.refresh();paintList();paintRoom();place();if(currentView==='media')await mediaPanel?.open(mediaType);}remember();});}if(launcher.parentElement!==anchor.parentElement)anchor.before(launcher);const w=anchor.offsetWidth,h=anchor.offsetHeight;for(const el of [launcher,pinBar])if(el){if(w>20)el.style.setProperty('--room-button-width',w+'px');if(h>20)el.style.setProperty('--room-button-height',h+'px');}paintPins();syncButtons();if(host&&!host.isConnected)chat.prepend(host);paintTheme();if(host&&!host.hidden)schedulePlace();void restore();}
    function sync(){if(child){autoMedia=child.autoMedia();if(eligible()&&root)paintRoom();return;}observer?.disconnect();discovery?.disconnect();resizeObserver?.disconnect();watched.clear();client.setBackground?.(!domEligible());if(!eligible()){void audio?.suspend().catch(()=>{});client.setActive(false);mediaPanel?.suspend();return;}loadPreferences();client.setActive(preferencesReady&&consented);if(!domEligible())return;attach();observedChat=doc.getElementById('chatRoot');if(observedChat){observer||=new MutationObserver(records=>{if(!domEligible())return;const containsAnchor=n=>n.nodeType===1&&(n.id==='people_panel_button'||n.querySelector?.('#people_panel_button'));if(records.some(record=>record.type==='attributes'&&record.target.matches?.('[class*="root___Ex8tg"],[class*="item___"],[class*="root___PF7AM"],[class*="root___Ef1Ql"]')||[...record.addedNodes,...record.removedNodes].some(n=>n.nodeType===1&&(n.matches?.(nativePanelSelector)||n.querySelector?.('[class*="root___Ex8tg"]')))))schedulePlace();if(records.some(record=>[...record.addedNodes].some(containsAnchor)||[...record.removedNodes].some(n=>n===launcher||containsAnchor(n))))attach();});observer.observe(observedChat,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});}discovery||=new MutationObserver(()=>{if(domEligible()&&doc.getElementById('chatRoot')!==observedChat)sync();});discovery.observe(observedChat?.parentElement||doc.body,{childList:true,subtree:!observedChat});for(const item of roomWindows.values())item.ui.sync();if(openPanels().length)place();if(host&&!host.hidden){paintRoom();if(currentView==='media')void attempt(()=>mediaPanel?.open(mediaType));}if(preferencesReady&&consented&&client.model.status==='idle')void client.refresh().catch(()=>{});void restore();}
    const unsubscribe=client.subscribe(event=>{if(!eligible())return;if(!child)messageSound(event);if(event.type==='room'||event.type==='list'){paintBadge();paintPins();}if(!root)return;if(event.type==='identity'){if(!child)for(const id of [...roomWindows.keys()])removeRoom(id);selected=null;drafts.clear();rows.clear();names.clear();loadNames.loaded=false;$('[data-draft]').value='';$('[data-messages]').replaceChildren();show('home');}if(event.type==='list'){loadNames();paintList();}else if(event.type==='room'){if(currentView==='home')paintList();if(event.id===selected)paintRoom(event.message);}else if(event.type==='status')notice(client.model.error);});
    const stopActivity=activity.subscribe(sync),stopDom=domActivity===activity?null:domActivity.subscribe(sync);if(!child){global.addEventListener('resize',schedulePlace);doc.addEventListener('input',sizeInput,true);doc.addEventListener('transitionend',nativeTransition,true);}if(view)void view.get().then(record=>{if(disposed)return;savedView=record;viewReady=true;void restore();}).catch(()=>{viewReady=true;});sync();
    return {sync,element:()=>host,hideRoom(){if(host){host.hidden=true;closeMessageActions();mediaPanel?.suspend();}},openRoomWindow(id){create();host.hidden=false;if(selected!==id)openLocalRoom(id);else show("chat");},async open(manage=false){if(!await ensureConsent())return;create();host.hidden=false;client.setActive(true);await client.refresh();paintList();if(manage){if(!client.model.leader){show('home');throw Error('Only explicitly assigned Chat Leaders can manage rooms.');}await openAdmin();}else show('home');place();},dispose(){disposed=true;for(const {ui} of roomWindows.values())ui.dispose();roomWindows.clear();closeMessageActions();unreserve();resizeObserver?.disconnect();global.cancelAnimationFrame(placementFrame);void audio?.close().catch(()=>{});observer?.disconnect();discovery?.disconnect();stopActivity?.();stopDom?.();unsubscribe();activity.dispose?.();global.removeEventListener('resize',schedulePlace);doc.removeEventListener('input',sizeInput,true);doc.removeEventListener('transitionend',nativeTransition,true);global.clearTimeout(readTimer);global.clearTimeout(typingTimer);mediaPanel?.stop();pinBar?.remove();launcher?.remove();host?.remove();client.dispose();}};
  }

  function mountAdmin({container,client,preferences,document:doc=global.document}){
    const host=doc.createElement('section');host.dataset.slinkRoomManagement='';host.style.cssText='display:block;position:static;width:100%;height:auto;margin:0;padding:0;min-width:0';container.append(host);
    const root=host.attachShadow({mode:'open'});let disposed=false,adminState=null,members=[],memberId=null,adminRoom=null,review=null,createAttempt=null;
    root.innerHTML="<style>:host{display:block;width:100%;height:auto;color:inherit;font:inherit}*{box-sizing:border-box}[hidden]{display:none!important}.editor{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;align-items:start}.editor>label,.editor>button{grid-column:1/-1}.group{padding:10px;border:1px solid var(--slink-border,#7777);border-radius:7px;min-width:0}.field{display:block;margin:0 0 10px}.field span{display:block;margin-bottom:3px}.checks label{display:block;margin:7px 0}.member-list{display:grid;gap:3px;max-height:220px;overflow:auto;padding:4px;border:1px solid var(--slink-border,#7777);border-radius:6px}.member-row{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7px;padding:5px;background:var(--slink-surface,#24222b)}.member-row button{text-align:left;border:0;background:transparent;padding:0}.member-row small{display:block;color:var(--slink-muted,#bbb)}button,input,select,textarea{font:inherit;color:inherit;background:var(--slink-surface,#24222b);border:1px solid var(--slink-border,#777);border-radius:5px;padding:6px;max-width:100%}input:not([type=checkbox]),select,textarea{width:100%}button{cursor:pointer}button:disabled{opacity:.5}.toolbar{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}p{margin:6px 0;overflow-wrap:anywhere}textarea{min-height:70px;resize:vertical}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--slink-accent,#b38beb)}</style><p data-admin-notice role=\"status\" hidden></p><div data-admin-form hidden><div class=\"editor\"><label class=\"field\"><span>Room</span><select data-admin-room></select></label><button type=\"button\" data-new-room>New room</button>\n      <div class=\"group\"><label class=\"field\"><span>Name</span><input data-name maxlength=\"60\"></label><label class=\"field\"><span>Description</span><input data-description maxlength=\"300\"></label><label class=\"field\"><span>Who can enter?</span><select data-visibility><option value=\"faction\">All members</option><option value=\"selected\">Selected members or roles</option><option value=\"leaders\">Leaders only</option></select></label><div data-position-grants></div><button type=\"button\" data-save-room>Save room</button> <button type=\"button\" data-archive>Archive room</button></div>\n      <div class=\"group\"><label class=\"field\"><span>Find a faction member</span><input type=\"search\" data-member placeholder=\"Name, ID or faction role\" autocomplete=\"off\"><div class=\"toolbar\"><button type=\"button\" data-select-shown>Select shown</button><button type=\"button\" data-clear-shown>Clear shown</button></div><div data-member-results class=\"member-list\" role=\"group\" aria-label=\"Faction member access\"></div><p data-member-list-status role=\"status\"></p><button type=\"button\" data-refresh-members>Refresh members</button></label><p data-member-state></p><div class=\"checks\"><label><input type=\"checkbox\" data-can-read> Can read this room</label><label><input type=\"checkbox\" data-can-speak> Can send messages</label><label><input type=\"checkbox\" data-moderator> Room moderator</label></div><label class=\"field\"><span>Temporary access length</span><select data-access-duration><option value=\"0\">No expiry</option><option value=\"60\">1 hour</option><option value=\"1440\">1 day</option><option value=\"10080\">1 week</option></select></label><button type=\"button\" data-reset-member>Remove room override</button><label class=\"field\"><span>Restriction length</span><select data-duration><option value=\"15\">15 minutes</option><option value=\"60\">1 hour</option><option value=\"1440\">1 day</option><option value=\"10080\">1 week</option><option value=\"0\">Until removed</option></select></label><div class=\"toolbar\"><button type=\"button\" data-mute>Mute</button><button type=\"button\" data-unmute>Unmute</button><button type=\"button\" data-block>Remove access</button><button type=\"button\" data-unblock>Restore access</button></div></div>\n      <div class=\"group\"><strong>Chat Leaders</strong><p data-leaders></p><button type=\"button\" data-promote>Make selected member a Leader</button> <button type=\"button\" data-demote>Remove selected Leader</button></div>\n      <div class=\"group\"><strong>Link another faction</strong><label class=\"field\"><span>Other faction ID</span><input type=\"number\" data-target min=\"1\"></label><button type=\"button\" data-invite>Create invitation</button><label class=\"field\"><span>Invitation to share or review</span><textarea data-invitation aria-label=\"Faction link invitation\"></textarea></label><button type=\"button\" data-copy-invite>Copy invitation</button> <button type=\"button\" data-review>Review invitation</button><p data-review-summary></p><button type=\"button\" data-approve disabled>Approve link to this room</button> <button type=\"button\" data-reject>Clear invitation</button><div data-links></div></div>\n      <div class=\"group\"><button type=\"button\" data-diagnostics>Check connection</button><p data-diagnostics-output></p></div></div></div>";
    const form=root.querySelector('[data-admin-form]'),$=selector=>root.querySelector(selector),node=(tag,text)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
    function notice(text){if(disposed)return;const el=$('[data-admin-notice]');el.textContent=String(text||'');el.hidden=!text;}
    async function attempt(task){if(disposed)return;try{await task();}catch(error){notice(error.message||'Could not save this room change.');}}
    function button(text,handler){const el=node('button',text);el.type='button';el.onclick=()=>void attempt(handler);return el;}
    function member(){const value=$('[data-member]').value.trim(),entry=members.find(m=>(m.user_name+' ['+m.user_id+']')===value||String(m.user_id)===value);memberId=entry?.user_id||(/^[1-9][0-9]*$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):null);return memberId;}
    // Adapted from SLINK Armory Recaller: the same searchable, bounded checkbox
    // list, name/rank/ID matching and Select shown/Clear shown workflow.
    function matchingMembers(){const query=$('[data-member]').value.trim().toLowerCase();return members.filter(m=>(m.user_name+' ['+m.user_id+'] '+(m.position||'')).toLowerCase().includes(query));}
    function filterMembers(){const list=$('[data-member-results]'),shown=matchingMembers(),room=selectedAdminRoom();list.replaceChildren();for(const m of shown){const row=node('div'),check=node('input'),choose=node('button'),name=node('strong',m.user_name),details=node('small',(m.position||'Member')+' · ID '+m.user_id);row.className='member-row';check.type='checkbox';check.dataset.memberAccess=String(m.user_id);check.setAttribute('aria-label','Room access for '+m.user_name);const entry=room?.members.find(entry=>entry.user_id===m.user_id);check.checked=entry?entry.can_read!==false&&(!entry.access_until||entry.access_until>Date.now()):room?.visibility==='faction'||(room?.allowed_positions||[]).includes(m.position);check.disabled=!adminRoom||room?.visibility==='leaders'||adminState?.leaders.includes(m.user_id);check.onchange=()=>void attempt(async()=>{await client.api('/api/admin',{action:'members.set',room_id:adminRoom,user_ids:[m.user_id],can_read:check.checked,access_until:expiry('[data-access-duration]')});await reloadAdmin();notice('Room access updated.');});choose.type='button';choose.append(name,details);choose.onclick=()=>{$('[data-member]').value=m.user_name+' ['+m.user_id+']';paintMember();};row.append(check,choose);list.append(row);}$('[data-member-list-status]').textContent=!members.length?'No faction directory loaded. Use Refresh members, or enter a member’s numeric ID.':!shown.length?'No matching members. Search a name, ID or role.':shown.length+' matching member'+(shown.length===1?'':'s');}
    async function shownAccess(checked){if(!adminRoom)throw Error('Choose a room first.');const ids=matchingMembers().filter(m=>!adminState.leaders.includes(m.user_id)).map(m=>m.user_id);if(!ids.length)throw Error('No matching members to change.');await client.api('/api/admin',{action:'members.set',room_id:adminRoom,user_ids:ids,can_read:checked,access_until:expiry('[data-access-duration]')});await reloadAdmin();notice('Room access updated for '+ids.length+' members.');}

    function paintPositions(room){const holder=$('[data-position-grants]');holder.hidden=(room?.visibility||'selected')!=='selected';holder.replaceChildren();const roles=[...new Set([...members.map(m=>m.position).filter(Boolean),...room?.allowed_positions||[]])].sort();if(roles.length){holder.append(node('p','Roles allowed in selected-access rooms'));for(const role of roles){const label=node('label'),input=node('input');input.type='checkbox';input.dataset.positionGrant=role;input.checked=(room?.allowed_positions||[]).includes(role);label.style.display='block';label.append(input,doc.createTextNode(' '+role));holder.append(label);}}}
    async function loadMembers(refresh=false){const result=await client.members(refresh);members=result.members||[];if(!refresh&&!members.length){const fresh=await client.members(true);members=fresh.members||[];}filterMembers();paintPositions(selectedAdminRoom());if(adminState)$('[data-leaders]').textContent=adminState.leaders.map(id=>members.find(m=>m.user_id===id)?.user_name||'Player '+id).join(', ');}

    function selectedAdminRoom(){return adminState?.rooms.find(r=>r.room_id===adminRoom);}
    function paintMember(){member();const r=selectedAdminRoom(),entry=r?.members.find(m=>m.user_id===memberId);$('[data-can-read]').checked=entry?entry.can_read!==false&&(r?.visibility!=='selected'||!entry.access_until||entry.access_until>Date.now()):r?.visibility==='faction'||(r?.allowed_positions||[]).includes(members.find(m=>m.user_id===memberId)?.position);$('[data-can-speak]').checked=entry?.can_speak!==false;$('[data-moderator]').checked=entry?.role==='moderator';$('[data-access-duration]').disabled=!r||r.visibility==='leaders';$('[data-member-state]').textContent=!memberId?'Choose a member from the list.':[(entry?.muted&&(!entry.muted_until||entry.muted_until>Date.now())?'Muted'+(entry.muted_until?' until '+new Date(entry.muted_until).toLocaleString():''):''),(entry?.blocked&&(!entry.blocked_until||entry.blocked_until>Date.now())?'Access removed'+(entry.blocked_until?' until '+new Date(entry.blocked_until).toLocaleString():''):''),(r?.visibility==='selected'&&entry?.access_until?(entry.access_until>Date.now()?'Access until '+new Date(entry.access_until).toLocaleString():'Access grant expired'):'')].filter(Boolean).join(' · ');}
    function paintAdminRoom(){const r=selectedAdminRoom();paintPositions(r);$('[data-name]').value=r?.name||'';$('[data-description]').value=r?.description||'';$('[data-room-icon]').value=r?.icon||'◆';$('[data-room-color]').value=r?.color||'#20516d';$('[data-visibility]').value=r?.visibility||'selected';$('[data-archive]').disabled=!r;paintMember();const links=$('[data-links]');links.replaceChildren();for(const link of r?.links||[]){if(!link.active)continue;const p=node('p','Linked faction '+link.remote_faction+' ');p.append(button('Disconnect',async()=>{if(global.confirm('Disconnect this faction room link?')){await client.api('/api/links/revoke',{room_id:adminRoom,link_id:link.link_id});await reloadAdmin();}}));links.append(p);}}
    async function reloadAdmin(keepDraft=true){
      adminState=await client.api('/api/admin');const previousRoom=adminRoom,retain=keepDraft||root.activeElement?.matches('[data-name],[data-description],[data-visibility],[data-room-icon],[data-room-color]'),draft={name:$('[data-name]').value,description:$('[data-description]').value,icon:$('[data-room-icon]').value,color:$('[data-room-color]').value,visibility:$('[data-visibility]').value};
      const select=$('[data-admin-room]');select.replaceChildren();for(const r of adminState.rooms.filter(r=>!r.archived)){const option=node('option',r.name);option.value=r.room_id;select.append(option);}
      if(!adminState.rooms.some(r=>r.room_id===adminRoom&&!r.archived))adminRoom=select.options[0]?.value||null;select.value=adminRoom||'';$('[data-leaders]').textContent=adminState.leaders.map(id=>members.find(m=>m.user_id===id)?.user_name||'Player '+id).join(', ');paintAdminRoom();filterMembers();
      if(retain&&previousRoom===adminRoom){$('[data-name]').value=draft.name;$('[data-description]').value=draft.description;$('[data-room-icon]').value=draft.icon;$('[data-room-color]').value=draft.color;$('[data-visibility]').value=draft.visibility;}await client.refresh();
    }
    async function openAdmin(){await reloadAdmin(false);try{await loadMembers();return '';}catch(error){filterMembers();return 'Member directory unavailable: '+error.message;}}

    async function memberChange(patch){if(!adminRoom||!member())throw Error('Choose a room and faction member first.');await client.api('/api/admin',{action:'member.set',room_id:adminRoom,user_id:memberId,...patch});await reloadAdmin();notice('Member permissions updated.');}
    function expiry(selector){const minutes=Number($(selector).value);return minutes?Date.now()+minutes*60000:null;}
    function bindAdmin(){
      $('[data-visibility]').onchange=()=>{$('[data-position-grants]').hidden=$('[data-visibility]').value!=='selected';};$('[data-admin-room]').onchange=()=>{adminRoom=$('[data-admin-room]').value;paintAdminRoom();};$('[data-member]').oninput=()=>{filterMembers();paintMember();};$('[data-select-shown]').onclick=()=>void attempt(()=>shownAccess(true));$('[data-clear-shown]').onclick=()=>void attempt(()=>shownAccess(false));$('[data-refresh-members]').onclick=()=>void attempt(async()=>{await loadMembers(true);notice('Member list updated.');});
      $('[data-new-room]').onclick=()=>{adminRoom=null;createAttempt=null;$('[data-admin-room]').value='';paintAdminRoom();$('[data-name]').focus();};
      $('[data-save-room]').onclick=()=>void attempt(async()=>{const details={name:$('[data-name]').value.trim(),description:$('[data-description]').value,icon:$('[data-room-icon]').value,color:$('[data-room-color]').value,visibility:$('[data-visibility]').value,allowed_positions:[...root.querySelectorAll('[data-position-grant]:checked')].map(input=>input.dataset.positionGrant)},fingerprint=JSON.stringify(details);if(!adminRoom&&createAttempt?.fingerprint!==fingerprint)createAttempt={fingerprint,id:crypto.randomUUID()};const result=await client.api('/api/admin',{action:adminRoom?'room.update':'room.create',...(adminRoom?{room_id:adminRoom}:{request_id:createAttempt.id}),...details});adminRoom=result.room_id||adminRoom;createAttempt=null;await reloadAdmin();notice('Room saved.');});
      $('[data-archive]').onclick=()=>void attempt(async()=>{if(adminRoom&&global.confirm('Archive this room and disconnect its faction links?')){await client.api('/api/admin',{action:'room.archive',room_id:adminRoom});await reloadAdmin();}});
      for(const [selector,key]of [['[data-can-read]','can_read'],['[data-can-speak]','can_speak'],['[data-moderator]','role']])$(selector).onchange=()=>void attempt(()=>memberChange({[key]:key==='role'?($(selector).checked?'moderator':'member'):$(selector).checked,...(key==='can_read'&&$(selector).checked?{access_until:expiry('[data-access-duration]')}:{})}));
      $('[data-access-duration]').onchange=()=>{if(selectedAdminRoom()?.visibility==='selected'&&member()&&$('[data-can-read]').checked)void attempt(()=>memberChange({can_read:true,access_until:expiry('[data-access-duration]')}));};
      $('[data-mute]').onclick=()=>void attempt(()=>memberChange({muted:true,muted_until:expiry('[data-duration]')}));$('[data-unmute]').onclick=()=>void attempt(()=>memberChange({muted:false,muted_until:null}));$('[data-block]').onclick=()=>void attempt(()=>memberChange({blocked:true,blocked_until:expiry('[data-duration]')}));$('[data-unblock]').onclick=()=>void attempt(()=>memberChange({blocked:false,blocked_until:null}));
      $('[data-reset-member]').onclick=()=>void attempt(async()=>{if(!member()||!adminRoom)throw Error('Choose a room and member.');await client.api('/api/admin',{action:'member.remove',room_id:adminRoom,user_id:memberId});await reloadAdmin();});
      for(const [selector,enabled]of [['[data-promote]',true],['[data-demote]',false]])$(selector).onclick=()=>void attempt(async()=>{if(!member())throw Error('Choose a faction member first.');if(global.confirm((enabled?'Assign':'Remove')+' Chat Leader access for this member?')){await client.api('/api/admin',{action:'leader.set',user_id:memberId,enabled});await client.refresh();if(!client.model.leader){form.hidden=true;notice('Chat Leader access is required.');}else await reloadAdmin();}});
      $('[data-invite]').onclick=()=>void attempt(async()=>{if(!adminRoom)throw Error('Choose a room first.');const result=await client.api('/api/links/invite',{room_id:adminRoom,target_faction:Number($('[data-target]').value)});$('[data-invitation]').value=JSON.stringify({invitation:result.invitation,certificate:result.certificate});notice('Share this invitation with the other faction’s Chat Leader. It expires after 30 minutes.');});
      $('[data-copy-invite]').onclick=()=>void attempt(()=>global.navigator.clipboard.writeText($('[data-invitation]').value));
      $('[data-invitation]').oninput=()=>{review=null;$('[data-approve]').disabled=true;$('[data-review-summary]').textContent='';};
      $('[data-review]').onclick=()=>void attempt(async()=>{review=null;let payload;try{payload=JSON.parse($('[data-invitation]').value);}catch{throw Error('Paste the complete faction invitation, then choose Review.');}const result=await client.api('/api/links/review',payload);review=payload;$('[data-review-summary]').textContent='Verified invitation from faction '+result.faction_id+'. Approving will share this room’s future messages with that faction.';$('[data-approve]').disabled=false;});
      $('[data-approve]').onclick=()=>void attempt(async()=>{if(!review||!adminRoom)throw Error('Review the invitation and select a local room.');await client.api('/api/links/approve',{room_id:adminRoom,...review});review=null;$('[data-approve]').disabled=true;await reloadAdmin();notice('Faction link connected.');});
      $('[data-reject]').onclick=()=>{$('[data-invitation]').value='';$('[data-invitation]').oninput();};
      $('[data-diagnostics]').onclick=()=>void attempt(async()=>{const result=await client.api('/api/admin/diagnostics');$('[data-diagnostics-output]').textContent='Connected · '+result.rooms.length+' rooms · '+result.rooms.reduce((n,r)=>n+r.connected,0)+' room connections · '+result.rooms.reduce((n,r)=>n+r.pending_deliveries,0)+' pending linked deliveries';});
    }

    bindAdmin();
    return {async open(){
      if(disposed)return;
      if(preferences){const saved=await preferences.get();if(saved.noticeAccepted!==global.SLINK_FACTION_NODE.ROOM_NOTICE){if(!global.confirm(global.SLINK_FACTION_NODE.ROOM_NOTICE_TEXT+'\n\nContinue to room management?'))return;await preferences.patch({noticeAccepted:global.SLINK_FACTION_NODE.ROOM_NOTICE});}}
      notice('Loading room management…');client.setActive(true);await client.refresh();if(disposed)return;
      if(!client.model.leader){form.hidden=true;notice('Only explicitly assigned Chat Leaders can manage rooms.');return;}
      const warning=await openAdmin();if(!disposed){form.hidden=false;notice(warning);}
    },sync(){},suspend(){client.setActive(false);},resume(){if(!disposed)client.setActive(true);},dispose(){disposed=true;client.dispose();host.remove();}};
  }
  global.SLINK_FACTION_NODE_UI=Object.freeze({mount,mountAdmin});
})(globalThis);
