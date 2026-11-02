(function installFactionNodeClient(global) {
  'use strict';
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  function origin(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash)
      throw Error('The faction chat service returned an invalid HTTPS address.');
    if(/^(localhost|.*\.local|\d+\.\d+\.\d+\.\d+|\[)/i.test(url.hostname))throw Error('The faction chat node must use a public HTTPS hostname.');
    return url.origin;
  }
  async function request(url, options = {}) {
    const response = await fetch(url, {...options, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(15000)});
    let value;
    try { value = await response.json(); } catch { throw Error(`Faction chat returned an unreadable response (HTTP ${response.status}).`); }
    if (!response.ok) { const error = Error(value?.error || `Faction chat request failed (HTTP ${response.status}).`); error.code=value?.code; error.status=response.status; throw error; }
    return value;
  }
  function create(options) {
    const now = options.now || Date.now, later = options.later || setTimeout, cancel = options.cancel || clearTimeout;
    const makeSocket = options.socket || ((url, protocols) => new WebSocket(url, protocols));
    const http = options.request || request, listeners = new Set(), rooms = new Map();
    let active=false, destroyed=false, generation=0, ticket=null, authenticating=null, renewal=null, identity=null;
    const model = {status:'idle',error:'',rooms:[],leader:false,userId:null,userName:'',factionId:null};
    function emit(type, detail={}) { for (const callback of listeners) callback({type,...detail}); }
    function room(id) { if(!validId(id))throw Error('Invalid chat room.'); if(!rooms.has(id))rooms.set(id,{id,messages:new Map(),pending:new Map(),actions:new Map(),access:{read:false,speak:false},status:'closed',error:'',socket:null,open:false,attempts:0,retry:null,nextBefore:null,unread:0}); return rooms.get(id); }
    function closeConnection(state) { cancel(state.pollTimer);state.pollTimer=null;state.httpVersion=(state.httpVersion||0)+1;state.http=false;state.connectVersion=(state.connectVersion||0)+1;cancel(state.retry);cancel(state.connectionTimer);state.connectionTimer=null;state.retry=null;for(const action of state.actions.values()){cancel(action.timer);action.reject(Error('Chat disconnected before this action was confirmed.'));}state.actions.clear();const socket=state.socket;state.socket=null;if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;try{socket.close(1000,'Page inactive');}catch{}} }
    function disconnectAll() { cancel(renewal);renewal=null;for(const state of rooms.values()){closeConnection(state);state.status='paused';} }
    async function access(force=false) {
      if(!active||destroyed)throw Error('Open faction chat on the active Torn page.');
      if(!force&&ticket&&ticket.expires_at>now()+30000)return ticket;
      if(authenticating)return authenticating;
      const current=generation;
      authenticating=(async()=>{
        const value=await options.ticket(force);
        if(current!==generation||!active||destroyed)throw Error('Chat access changed while connecting.');
        if(!value?.token||!validId(value.node_id)||value.expires_at<=now()+1000||!Number.isSafeInteger(value.user_id)||value.user_id<=0||!Number.isSafeInteger(value.faction_id)||value.faction_id<=0)throw Error('Faction chat returned incomplete access information.');
        const endpoint=origin(value.endpoint),nextIdentity=value.user_id+':'+value.faction_id+':'+value.node_id;
        if(identity&&identity!==nextIdentity){disconnectAll();rooms.clear();model.rooms=[];emit('identity');}
        identity=nextIdentity;ticket={...value,endpoint};model.userId=value.user_id;model.userName=String(value.user_name||'');model.factionId=value.faction_id;
        cancel(renewal);renewal=later(()=>void renew(),Math.max(1000,value.expires_at-now()-20000));return ticket;
      })();
      try{return await authenticating;}finally{authenticating=null;}
    }
    async function renew() {
      if(!active||destroyed)return;
      try{const next=await access(true);for(const state of rooms.values())if(state.socket?.readyState===1)state.socket.send(JSON.stringify({type:'auth',token:next.token}));}
      catch(error){model.error=error.message;model.status='error';disconnectAll();emit('status');}
    }
    async function api(path,payload) {
      if(!/^\/api\/(rooms(?:\/[A-Za-z0-9_-]+\/history)?|admin(?:\/diagnostics)?|links\/(invite|review|approve|revoke))$/.test(path))throw Error('Unsupported faction chat request.');
      const auth=await access();return http(auth.endpoint+path,{method:payload?'POST':'GET',headers:{Authorization:'Bearer '+auth.token,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});
    }
    function merge(state, message) {
      if(!validId(message?.message_id)||!Number.isSafeInteger(message.seq)||!Number.isSafeInteger(message.revision))return;
      const existing=state.messages.get(message.message_id);if(existing&&existing.revision>message.revision)return;
      state.messages.set(message.message_id,message);
      if(state.messages.size>300){const oldest=[...state.messages.values()].sort((a,b)=>a.seq-b.seq)[0];state.messages.delete(oldest.message_id);}
    }
    function transmitPending(state) {
      for(const [clientId,item] of state.pending){
        if(item.error)continue;
        if(now()-item.at>300000){item.error='Not sent: reconnect took too long. Review and send again.';continue;}
        if(state.access.speak&&(state.http||state.socket?.readyState===1))dispatch(state,{type:'send',client_id:clientId,command_id:clientId,content:item.content});
      }
    }
    function receive(state,socket,event) {
      if(state.socket!==socket||!active)return;
      let data;try{data=JSON.parse(event.data);}catch{return;}
      if(data.protocol!==1){closeConnection(state);state.error='This chat node uses an unsupported protocol. Update SLINK.';state.status='error';emit('room',{id:state.id});return;}
      let incoming=false;
      switch(data.type){
        case 'welcome': cancel(state.connectionTimer);state.connectionTimer=null;state.status='connected';state.connectedAt=now();state.error='';state.access=data.access;state.nextBefore=data.next_before;state.unread=Number(data.unread)||0;for(const message of data.messages||[])merge(state,message);state.presence=data.presence||[];transmitPending(state);break;
        case 'message':case 'message_update':{const known=state.messages.has(data.message?.message_id);merge(state,data.message);if(!known&&data.type==='message'&&data.message?.user_id!==model.userId){state.unread++;incoming=true;}break;}
        case 'ack': merge(state,data.message);state.pending.delete(data.client_id);break;
        case 'access':state.access=data.access;break;
        case 'access_revoked':state.access={read:false,speak:false};state.error=data.reason||'Room access ended.';state.open=false;closeConnection(state);state.status='denied';break;
        case 'presence':state.presence=data.users||[];break;
        case 'typing':state.typing={userId:data.user_id,until:data.expires_at};break;
        case 'action_ack':{const action=state.actions.get(data.command_id);if(action){cancel(action.timer);state.actions.delete(data.command_id);action.resolve(data);}break;}
        case 'error':state.error=String(data.error||'This chat action failed.');if(state.pending.has(data.command_id))state.pending.get(data.command_id).error=state.error;{const action=state.actions.get(data.command_id);if(action){cancel(action.timer);state.actions.delete(data.command_id);action.reject(Error(state.error));}}break;
        case 'delivery_pending':case 'delivery_failed':case 'delivery_confirmed':state.delivery={messageId:data.message_id,status:data.type,reason:data.reason||''};break;
      }
      emit('room',{id:state.id,event:data.type,incoming});
    }
    async function httpCommand(state,value){
      const version=state.httpVersion,current=generation,key=value.command_id||value.type;state.httpPending||=new Set();if(state.httpPending.has(key))return;state.httpPending.add(key);
      try{const auth=await access(),result=await http(auth.endpoint+'/api/rooms/'+state.id+'/events',{method:'POST',headers:{Authorization:'Bearer '+auth.token,'Content-Type':'application/json'},body:JSON.stringify(value)});
        if(!active||current!==generation||version!==state.httpVersion)return;
        for(const event of result.events||[])receive(state,null,{data:JSON.stringify(event)});
      }catch(error){if(!active||current!==generation||version!==state.httpVersion)return;receive(state,null,{data:JSON.stringify({protocol:1,type:'error',command_id:value.command_id,error:error.message})});}finally{state.httpPending.delete(key);}
    }
    function dispatch(state,value){if(state.http)void httpCommand(state,value);else state.socket.send(JSON.stringify(value));}
    async function httpConnect(state){
      closeConnection(state);state.http=true;state.status='connecting';state.error='';const version=state.httpVersion,current=generation;
      async function poll(){
        if(!active||destroyed||!state.open||version!==state.httpVersion||current!==generation)return;
        try{const auth=await access(),result=await http(auth.endpoint+'/api/rooms/'+state.id+'/sync?after='+Number(state.httpAfter||0)+'&changed='+Number(state.httpChanged||0),{headers:{Authorization:'Bearer '+auth.token}});
          if(!active||version!==state.httpVersion||current!==generation)return;
          if(result.protocol!==1||result.type!=='welcome'||typeof result.access?.read!=='boolean'||typeof result.access?.speak!=='boolean')throw Error('The faction node needs the HTTPS chat update. Your draft has been kept.');
          state.httpAfter=Number(result.after)||0;state.httpChanged=Number(result.changed)||0;
          const incoming=state.httpLoaded&&(result.messages||[]).some(message=>!state.messages.has(message.message_id)&&message.user_id!==model.userId);state.httpLoaded=true;
          receive(state,null,{data:JSON.stringify(result)});if(incoming)emit('room',{id:state.id,incoming:true});
          state.pollTimer=later(()=>void poll(),result.more?0:5000);
        }catch(error){if(!active||version!==state.httpVersion||current!==generation)return;state.status='disconnected';state.access={read:false,speak:false};state.error=error.message;emit('room',{id:state.id});if(![401,403,404,426].includes(Number(error.status)))state.pollTimer=later(()=>void poll(),15000);}
      }
      await poll();
    }
    async function connect(id,manual=false) {
      const state=room(id);state.open=true;if(manual){state.attempts=0;state.httpAfter=0;state.httpChanged=0;state.httpLoaded=false;closeConnection(state);state.status='closed';}
      if(state.retryAfter>now()){state.error='Too many chat updates. Wait a minute before reconnecting.';emit('room',{id});return;}
      if(!active||destroyed||state.socket||state.http||state.status==='connecting')return;
      const current=generation,connection=state.connectVersion=(state.connectVersion||0)+1;state.status='connecting';state.error='';emit('room',{id});
      try{
        if(state.httpPreferred){await httpConnect(state);return;}const auth=await access(manual);if(current!==generation||connection!==state.connectVersion||!active||!state.open||rooms.get(id)!==state)return;
        const socket=makeSocket(auth.endpoint.replace(/^https:/,'wss:')+'/api/rooms/'+id+'/socket',['slink.chat.v1','slink.token.'+auth.token]);state.socket=socket;
        state.connectionTimer=later(()=>{if(state.socket===socket&&state.status!=='connected'){state.httpPreferred=true;void httpConnect(state);}},12000);
        socket.onmessage=event=>receive(state,socket,event);
        socket.onerror=()=>{if(state.socket===socket){state.httpPreferred=true;void httpConnect(state);}};
        socket.onclose=event=>{
          if(state.socket!==socket)return;cancel(state.connectionTimer);state.connectionTimer=null;state.socket=null;if(state.status==='connected'&&now()-state.connectedAt>=30000)state.attempts=0;state.status='disconnected';
          if(event.code===4003){state.open=false;state.access={read:false,speak:false};state.error='Your access to this room has ended.';}
          else if(event.code===4008){state.retryAfter=now()+60000;state.error='Too many chat updates. Wait a minute, then press Reconnect.';}
          else if(event.code===4002){state.error='The chat request was rejected. Review it before reconnecting.';}
          else if(active&&state.open&&state.attempts<3){const delay=[1500,5000,15000][state.attempts++];state.retry=later(()=>{state.retry=null;void connect(id);},delay);}
          else if(state.open)state.error='Chat is disconnected. Press Reconnect when ready.';
          emit('room',{id});
        };
      }catch(error){if(connection!==state.connectVersion)return;if(error.name==='SecurityError'||/operation is insecure|content security policy/i.test(error.message||'')){state.httpPreferred=true;await httpConnect(state);return;}state.status='error';state.error=error.message;emit('room',{id});}
    }
    async function refresh() {try{model.status='loading';model.error='';emit('status');const result=await api('/api/rooms');model.rooms=result.rooms||[];model.leader=result.leader===true;model.status='ready';emit('list');if(options.watchRooms){const allowed=new Set(model.rooms.map(item=>item.room_id));for(const state of rooms.values())if(!allowed.has(state.id)){state.open=false;state.access={read:false,speak:false};closeConnection(state);}for(const item of model.rooms)void connect(item.room_id);}}catch(error){model.status='error';model.error=error.message;emit('status');throw error;} }
    function send(id,content) {
      const state=room(id);if(!active||state.status!=='connected'||!state.access.speak)throw Error('This room is not ready to send messages.');
      if(state.pending.size>=20)throw Error('Too many messages are waiting to send. Review them before sending more.');
      const clientId=options.uuid?.()||crypto.randomUUID();state.pending.set(clientId,{content,at:now(),error:''});dispatch(state,{type:'send',client_id:clientId,command_id:clientId,content});emit('room',{id});return clientId;
    }
    function command(id,value) {const state=room(id);if(!active||!state.http&&state.socket?.readyState!==1)throw Error('Reconnect to this room first.');dispatch(state,value);}
    function setActive(value) {if(active===Boolean(value)||destroyed)return;active=Boolean(value);generation++;if(!active){disconnectAll();emit('status');}else for(const state of rooms.values())if(state.open)void connect(state.id);}
    async function older(id){const state=room(id);if(state.loadingOlder||!state.nextBefore)return;state.loadingOlder=true;emit('room',{id});try{const auth=await access(),result=await http(auth.endpoint+'/api/rooms/'+id+'/history?before='+encodeURIComponent(state.nextBefore),{headers:{Authorization:'Bearer '+auth.token}});for(const message of result.messages||[])merge(state,message);state.nextBefore=result.messages?.length?result.next_before:null;}finally{state.loadingOlder=false;emit('room',{id});}}
    return Object.freeze({model,room,refresh,api,send,command,connect,setActive,older,
      action(id,value){const state=room(id),commandId=options.uuid?.()||crypto.randomUUID();if(state.actions.size>=8)return Promise.reject(Error('Wait for the current chat changes to finish.'));return new Promise((resolve,reject)=>{const timer=later(()=>{state.actions.delete(commandId);reject(Error('This chat change was not confirmed. Your draft has been kept.'));},15000);state.actions.set(commandId,{resolve,reject,timer});try{command(id,{...value,command_id:commandId});}catch(error){cancel(timer);state.actions.delete(commandId);reject(error);}});},
      retryPending(id,clientId){const state=room(id),pending=state.pending.get(clientId);if(!pending)return;if(!active||state.status!=='connected'||!state.access.speak)throw Error('Reconnect to a room where you can speak first.');pending.at=now();pending.error='';dispatch(state,{type:'send',client_id:clientId,command_id:clientId,content:pending.content});emit('room',{id});},
      discardPending(id,clientId){room(id).pending.delete(clientId);emit('room',{id});},
      subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback);},
      close(id){const state=room(id);state.open=false;closeConnection(state);state.status='closed';emit('room',{id});},
      async members(refresh=false){await access();return options.members(refresh);},
      dispose(){destroyed=true;active=false;generation++;disconnectAll();ticket=null;rooms.clear();listeners.clear();}
    });
  }
  // Chat retains its signing issuer, but its grants/acceptance now use the shared
  // permissions database. The short-lived transport session does not replace Access.
  const TEST_CENTRAL='https://slink-chat-central-test.richard-johnson554.workers.dev';
  function createTestAccess(options){
    const now=options.now||Date.now;let session=null,inflight=null,keyId=null,generation=0;
    const fingerprint=async key=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(key||'').trim())))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    function clear(){generation++;session=null;inflight=null;keyId=null;}
    async function authenticate(force=false){
      const context=await options.context(),key=String(context.key||'').trim();
      if(!context.enabled){clear();throw Error('Enable Faction Rooms before connecting.');}
      if(!key){clear();throw Error('Save your Torn API key in SLINK Access first.');}
      const current=await fingerprint(key);if(current!==keyId){clear();keyId=current;}
      if(!force&&session&&session.until>now()+30000)return session;
      if(inflight)return inflight;
      const epoch=generation;
      const task=(async()=>{
        const result=await options.request(TEST_CENTRAL+'/api/permissions/terms'),terms=result?.terms;
        if(!terms?.version||!terms?.sha256)throw Error('Chat Central returned incomplete terms. Your normal SLINK login has not changed.');
        // Re-read after metadata arrives: accepting in Access while this request
        // is in flight must not leave Rooms checking an older local snapshot.
        const currentContext=await options.context(),records=currentContext.accepted||[];
        if(!currentContext.enabled||await fingerprint(currentContext.key)!==current)throw Error('The saved key or chat setting changed. Reopen faction rooms.');
        const matching=records.some(record=>record?.version===terms.version&&String(record?.sha256||record?.documentSha256||'')===terms.sha256);
        const newer=records.find(record=>/^\d{4}-\d{2}-\d{2}$/.test(record?.version||'')&&/^\d{4}-\d{2}-\d{2}$/.test(terms.version)&&record.version>terms.version);
        const conflicting=records.find(record=>record?.version===terms.version&&String(record?.sha256||record?.documentSha256||'')!==terms.sha256);
        if(newer||!matching&&conflicting){const saved=newer||conflicting,error=Error('Chat Central publishes policy '+terms.version+', but this device accepted '+saved.version+(newer?'':' with a different document fingerprint')+'. The SLINK services disagree; Chat Central needs the current deployment. Your acceptance is saved—reaccepting or clearing storage will not fix this. [SLINK_TERMS_SERVICE_MISMATCH]');error.code='SLINK_TERMS_SERVICE_MISMATCH';throw error;}
        if(!matching)throw Error('Review and accept the current SLINK terms in Access before connecting to faction rooms.');
        await options.reserve?.();
        const response=await options.request(TEST_CENTRAL+'/api/permissions/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:{api_key:key,terms_accepted:true,terms_version:terms.version,terms_sha256:terms.sha256,client_name:'SLINK Faction Rooms'}});
        if(!response?.session_token||!Array.isArray(response.scopes)||!response.scopes.includes('slink.chat')||!Number.isSafeInteger(Number(response.faction_id))||Number(response.faction_id)<=0)throw Error('Your faction needs an active Faction Chat license in SLINK permissions. Administrator status does not replace that license.');
        const until=Math.min(Date.parse(response.expires_at)||0,(Number(response.iat)+300)*1000);
        if(!Number.isFinite(until)||until<=now()+30000)throw Error('Chat Central returned an expired sign-in. Retry once.');
        const latest=await options.context();if(epoch!==generation||!latest.enabled||await fingerprint(latest.key)!==current)throw Error('The saved key or chat setting changed during sign-in. Reopen faction rooms.');
        session={token:String(response.session_token),until};return session;
      })();inflight=task;
      try{return await task;}finally{if(inflight===task)inflight=null;}
    }
    async function central(path,force=false,retry=true){
      if(!['token','members'].includes(path))throw Error('Unsupported faction chat access request.');
      const auth=await authenticate(path==='token'&&force),epoch=generation,context=path==='members'&&force?await options.context():null;
      try{const response=await options.request(TEST_CENTRAL+'/api/chat/'+path,{method:path==='token'||context?'POST':'GET',headers:{Authorization:'Bearer '+auth.token,'Content-Type':'application/json'},...(path==='token'?{body:{}}:context?{body:{api_key:String(context.key||'').trim()}}:{})});
        const latest=await options.context();if(epoch!==generation||!latest.enabled||await fingerprint(latest.key)!==keyId)throw Error('The saved key or chat setting changed. Reopen faction rooms.');return response;
      }catch(error){if(retry&&[401,428].includes(Number(error.status))){session=null;return central(path,true,false);}throw error;}
    }
    return Object.freeze({central,clear});
  }
  // Third-party room connections are not Torn collectors. Keep the most
  // recently focused room owner alive on blur, without multiplying sockets in
  // every Torn tab. This channel carries ownership metadata only, never keys.
  function createRoomActivity({activity,focusRequired=true,document:doc=global.document}={}){
    const listeners=new Set(),id=crypto.randomUUID();let present=true,disposed=false,owner=false,known=null,clock=0,channel=null;
    const eligible=()=>present&&!disposed&&owner;
    const focused=()=>doc.visibilityState!=='hidden'&&(focusRequired?doc.hasFocus?.()===true:activity.eligible());
    const emit=()=>{for(const callback of listeners)callback(eligible());};
    function claim(){if(!present||disposed||!focused())return;clock=Math.max(clock+1,Date.now());known={id,stamp:clock};owner=true;channel?.postMessage({type:'claim',...known});emit();}
    function receive(event){const value=event.data;if(!value||value.id===id||typeof value.id!=='string'||!Number.isSafeInteger(value.stamp))return;if(value.type==='hello'){if(owner)channel?.postMessage({type:'claim',...known});return;}clock=Math.max(clock,value.stamp);if(value.type==='claim'&&!(owner&&focused())&&(!known||value.stamp>known.stamp||value.stamp===known.stamp&&(owner||value.id>known.id))){known={id:value.id,stamp:value.stamp};if(owner){owner=false;emit();}}else if(value.type==='release'&&known?.id===value.id){known=null;if(focused())claim();}}
    function hide(){present=false;if(owner)channel?.postMessage({type:'release',id,stamp:clock});owner=false;emit();}
    function show(){present=true;if(focused())claim();}
    const focus=()=>claim(),visibility=()=>{if(focused())claim();};
    try{if(global.BroadcastChannel){channel=new global.BroadcastChannel('slink-faction-rooms-owner-v1');channel.onmessage=receive;channel.postMessage({type:'hello',id,stamp:0});}}catch{}
    global.addEventListener('focus',focus);global.addEventListener('pagehide',hide);global.addEventListener('pageshow',show);doc.addEventListener('visibilitychange',visibility);
    const stop=activity.subscribe(()=>{if(!owner&&focused())claim();});if(focused())claim();
    return Object.freeze({eligible,subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback);},dispose(){if(disposed)return;hide();disposed=true;stop?.();listeners.clear();channel?.close();global.removeEventListener('focus',focus);global.removeEventListener('pagehide',hide);global.removeEventListener('pageshow',show);doc.removeEventListener('visibilitychange',visibility);}});
  }
  const ROOM_NOTICE='third-party-rooms-v1';
  const ROOM_NOTICE_TEXT='SLINK Rooms are independent, third-party chat rooms, not managed or endorsed by Torn. Messages are hosted outside Torn by the faction node operator and may be read or moderated by authorized room members and administrators. They are not end-to-end encrypted. Use at your own risk; do not share API keys or sensitive information.';
  function roomSettings(value={}){return {...value,enabled:value.enabled!==false,soundEnabled:value.soundEnabled!==false,autoMedia:value.autoMedia!==false,roomSounds:value.roomSounds&&typeof value.roomSounds==='object'?value.roomSounds:{}};}
  function patchRoomSettings(current,input){
    if(!input||!Object.keys(input).length||Object.entries(input).some(([key,value])=>key==='noticeAccepted'?value!==ROOM_NOTICE:key==='roomSounds'?(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length>500||Object.entries(value).some(([id,on])=>!/^[A-Za-z0-9_-]{1,100}$/.test(id)||typeof on!=='boolean')):!['enabled','soundEnabled','autoMedia'].includes(key)||typeof value!=='boolean'))throw Error('Invalid faction room preference.');
    const saved=roomSettings(current);return {...saved,...input,roomSounds:{...saved.roomSounds,...input.roomSounds}};
  }
  global.SLINK_FACTION_NODE=Object.freeze({create,origin,createTestAccess,createRoomActivity,TEST_CENTRAL,ROOM_NOTICE,ROOM_NOTICE_TEXT,roomSettings,patchRoomSettings});
})(globalThis);
