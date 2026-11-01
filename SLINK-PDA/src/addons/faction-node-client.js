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
    const model = {status:'idle',error:'',rooms:[],leader:false,userId:null,factionId:null};
    function emit(type, detail={}) { for (const callback of listeners) callback({type,...detail}); }
    function room(id) { if(!validId(id))throw Error('Invalid chat room.'); if(!rooms.has(id))rooms.set(id,{id,messages:new Map(),pending:new Map(),actions:new Map(),access:{read:false,speak:false},status:'closed',error:'',socket:null,open:false,attempts:0,retry:null,nextBefore:null,unread:0}); return rooms.get(id); }
    function closeConnection(state) { cancel(state.retry);cancel(state.connectionTimer);state.connectionTimer=null;state.retry=null;for(const action of state.actions.values()){cancel(action.timer);action.reject(Error('Chat disconnected before this action was confirmed.'));}state.actions.clear();const socket=state.socket;state.socket=null;if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;try{socket.close(1000,'Page inactive');}catch{}} }
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
        identity=nextIdentity;ticket={...value,endpoint};model.userId=value.user_id;model.factionId=value.faction_id;
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
        if(state.socket?.readyState===1&&state.access.speak)state.socket.send(JSON.stringify({type:'send',client_id:clientId,command_id:clientId,content:item.content}));
      }
    }
    function receive(state,socket,event) {
      if(state.socket!==socket||!active)return;
      let data;try{data=JSON.parse(event.data);}catch{return;}
      if(data.protocol!==1){closeConnection(state);state.error='This chat node uses an unsupported protocol. Update SLINK.';state.status='error';emit('room',{id:state.id});return;}
      switch(data.type){
        case 'welcome': cancel(state.connectionTimer);state.connectionTimer=null;state.status='connected';state.error='';state.attempts=0;state.access=data.access;state.nextBefore=data.next_before;state.unread=Number(data.unread)||0;for(const message of data.messages||[])merge(state,message);state.presence=data.presence||[];transmitPending(state);break;
        case 'message':case 'message_update':{const known=state.messages.has(data.message?.message_id);merge(state,data.message);if(!known&&data.type==='message'&&data.message?.user_id!==model.userId)state.unread++;break;}
        case 'ack': merge(state,data.message);state.pending.delete(data.client_id);break;
        case 'access':state.access=data.access;break;
        case 'access_revoked':state.access={read:false,speak:false};state.error=data.reason||'Room access ended.';state.open=false;closeConnection(state);state.status='denied';break;
        case 'presence':state.presence=data.users||[];break;
        case 'typing':state.typing={userId:data.user_id,until:data.expires_at};break;
        case 'action_ack':{const action=state.actions.get(data.command_id);if(action){cancel(action.timer);state.actions.delete(data.command_id);action.resolve(data);}break;}
        case 'error':state.error=String(data.error||'This chat action failed.');if(state.pending.has(data.command_id))state.pending.get(data.command_id).error=state.error;{const action=state.actions.get(data.command_id);if(action){cancel(action.timer);state.actions.delete(data.command_id);action.reject(Error(state.error));}}break;
        case 'delivery_pending':case 'delivery_failed':case 'delivery_confirmed':state.delivery={messageId:data.message_id,status:data.type,reason:data.reason||''};break;
      }
      emit('room',{id:state.id,event:data.type});
    }
    async function connect(id,manual=false) {
      const state=room(id);state.open=true;if(manual)state.attempts=0;
      if(!active||destroyed||state.socket)return;
      const current=generation;state.status='connecting';state.error='';emit('room',{id});
      try{
        const auth=await access();if(current!==generation||!active||!state.open||rooms.get(id)!==state)return;
        const socket=makeSocket(auth.endpoint.replace(/^https:/,'wss:')+'/api/rooms/'+id+'/socket',['slink.chat.v1','slink.token.'+auth.token]);state.socket=socket;
        state.connectionTimer=later(()=>{if(state.socket===socket&&state.status!=='connected'){state.error='The faction room did not finish connecting.';try{socket.close();}catch{}emit('room',{id});}},12000);
        socket.onmessage=event=>receive(state,socket,event);
        socket.onerror=()=>{if(state.socket===socket){state.error='Cannot connect to faction chat. Check the node connection or browser restrictions.';emit('room',{id});}};
        socket.onclose=event=>{
          if(state.socket!==socket)return;cancel(state.connectionTimer);state.connectionTimer=null;state.socket=null;state.status='disconnected';
          if(event.code===4003){state.open=false;state.access={read:false,speak:false};state.error='Your access to this room has ended.';}
          else if(active&&state.open&&state.attempts<3){const delay=[1500,5000,15000][state.attempts++];state.retry=later(()=>{state.retry=null;void connect(id);},delay);}
          else if(state.open)state.error='Chat is disconnected. Press Reconnect when ready.';
          emit('room',{id});
        };
      }catch(error){state.status='error';state.error=error.message;emit('room',{id});}
    }
    async function refresh() {try{model.status='loading';model.error='';emit('status');const result=await api('/api/rooms');model.rooms=result.rooms||[];model.leader=result.leader===true;model.status='ready';emit('list');}catch(error){model.status='error';model.error=error.message;emit('status');throw error;} }
    function send(id,content) {
      const state=room(id);if(!active||state.status!=='connected'||!state.access.speak)throw Error('This room is not ready to send messages.');
      if(state.pending.size>=20)throw Error('Too many messages are waiting to send. Review them before sending more.');
      const clientId=options.uuid?.()||crypto.randomUUID();state.pending.set(clientId,{content,at:now(),error:''});state.socket.send(JSON.stringify({type:'send',client_id:clientId,command_id:clientId,content}));emit('room',{id});return clientId;
    }
    function command(id,value) {const state=room(id);if(!active||state.socket?.readyState!==1)throw Error('Reconnect to this room first.');state.socket.send(JSON.stringify(value));}
    function setActive(value) {if(active===Boolean(value)||destroyed)return;active=Boolean(value);generation++;if(!active){disconnectAll();emit('status');}else for(const state of rooms.values())if(state.open)void connect(state.id);}
    async function older(id){const state=room(id);if(state.loadingOlder||!state.nextBefore)return;state.loadingOlder=true;emit('room',{id});try{const auth=await access(),result=await http(auth.endpoint+'/api/rooms/'+id+'/history?before='+encodeURIComponent(state.nextBefore),{headers:{Authorization:'Bearer '+auth.token}});for(const message of result.messages||[])merge(state,message);state.nextBefore=result.messages?.length?result.next_before:null;}finally{state.loadingOlder=false;emit('room',{id});}}
    return Object.freeze({model,room,refresh,api,send,command,connect,setActive,older,
      action(id,value){const state=room(id),commandId=options.uuid?.()||crypto.randomUUID();if(state.actions.size>=8)return Promise.reject(Error('Wait for the current chat changes to finish.'));return new Promise((resolve,reject)=>{const timer=later(()=>{state.actions.delete(commandId);reject(Error('This chat change was not confirmed. Your draft has been kept.'));},15000);state.actions.set(commandId,{resolve,reject,timer});try{command(id,{...value,command_id:commandId});}catch(error){cancel(timer);state.actions.delete(commandId);reject(error);}});},
      retryPending(id,clientId){const state=room(id),pending=state.pending.get(clientId);if(!pending)return;if(!active||state.status!=='connected'||!state.access.speak)throw Error('Reconnect to a room where you can speak first.');pending.at=now();pending.error='';state.socket.send(JSON.stringify({type:'send',client_id:clientId,command_id:clientId,content:pending.content}));emit('room',{id});},
      discardPending(id,clientId){room(id).pending.delete(clientId);emit('room',{id});},
      subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback);},
      close(id){const state=room(id);state.open=false;closeConnection(state);state.status='closed';emit('room',{id});},
      async members(){await access();return options.members();},
      dispose(){destroyed=true;active=false;generation++;disconnectAll();ticket=null;rooms.clear();listeners.clear();}
    });
  }
  global.SLINK_FACTION_NODE=Object.freeze({create,origin});
})(globalThis);
