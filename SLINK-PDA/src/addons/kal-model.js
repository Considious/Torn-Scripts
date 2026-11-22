(function installKal(global) {
  'use strict';
  if (global.SLINK_KAL) return;
  const ORIGIN = 'https://api.kalends.dev';
  const TTL = 10 * 60_000;
  const errors = Object.freeze({1:'Enter a registered KAL key.',2:'KAL key is invalid or disabled.',3:'KAL rejected conflicting credentials.',4:'KAL account is disabled.',5:'Accept the required policies on KAL’s website.',6:'KAL account is restricted.',11:'KAL rejected this player or cursor.',13:'No visible loadout is available.',20:'KAL rate limit reached. Try again later.'});
  const failure = (message, code='KAL_ERROR') => Object.assign(new Error(message), {code});
  function playerId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) throw failure('A valid player ID is required.');
    return id;
  }
  function parseLoadout(value, id) {
    if (!value || value.user_id !== playerId(id) || !Array.isArray(value.equipment)
      || !Number.isFinite(value.observed_at) || value.observed_at <= 0
      || value.equipment.some(item => !item || typeof item !== 'object' || Array.isArray(item))
      || (value.pagination?.next_cursor != null && typeof value.pagination.next_cursor !== 'string')) {
      throw failure('KAL returned an unreadable loadout.', 'KAL_RESPONSE');
    }
    return value; // Preserve unknown metadata and nulls; never manufacture empty slots.
  }
  function stamp(value) { return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toLocaleString() : 'Unknown observation time'; }
  function equipmentText(item) {
    const rows = [`${item.slot_name ?? ('Slot ' + (item.slot ?? '?'))}: ${item.name ?? 'Unknown item'}${item.id ? ' (#'+item.id+')' : ''}`];
    if (item.item_ref) rows.push('Exact item: ' + item.item_ref);
    if (item.rarity) rows.push('Rarity: ' + item.rarity);
    if (item.stats) rows.push(Object.entries(item.stats).map(([k,v])=>k+': '+(v ?? 'Unknown')).join(', '));
    for (const bonus of item.bonuses || []) rows.push((bonus.title ?? 'Unknown bonus') + ': ' + (bonus.description ?? bonus.value ?? 'Unknown'));
    if (item.ammo) rows.push('Ammo: ' + (item.ammo.type ?? 'Unknown') + ' (#' + (item.ammo.id ?? '?') + ')');
    for (const mod of item.mods || []) rows.push('Mod: ' + (mod.name ?? ('#'+(mod.id ?? '?'))) + ' — ' + (mod.description ?? 'Unknown effect'));
    if (item.effect) rows.push('Effect: ' + item.effect);
    if (item.blocked_effects?.length) rows.push('Blocked effects: ' + item.blocked_effects.map(v=>typeof v==='string'?v:JSON.stringify(v)).join(', '));
    return rows.join('\n');
  }
  function loadoutText(value) {
    return `KAL — ${value.name ?? 'Player'} [${value.user_id}]\nObserved: ${stamp(value.observed_at)}\n\n` + (value.equipment.map(equipmentText).join('\n\n') || 'No equipment records returned; missing slots are unknown.');
  }
  function openCache(indexedDB = global.indexedDB, name = 'slink-kal-cache') {
    let opening;
    async function db() {
      if (!indexedDB?.open) throw failure('KAL cache storage is unavailable.', 'KAL_STORAGE');
      if (!opening) opening = new Promise((resolve,reject)=>{
        const request=indexedDB.open(name,1);
        request.onupgradeneeded=()=>request.result.createObjectStore('cache',{keyPath:'id'});
        request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();opening=null;};resolve(request.result);};
        request.onerror=()=>reject(failure('KAL cache could not be opened.', 'KAL_STORAGE'));
        request.onblocked=()=>reject(failure('Close older SLINK views to upgrade KAL storage.', 'KAL_STORAGE'));
      }).catch(error=>{opening=null;throw error;});
      return opening;
    }
    async function transact(mode, operation) {
      const database=await db();
      return new Promise((resolve,reject)=>{
        const tx=database.transaction('cache',mode);let result;
        tx.oncomplete=()=>resolve(result);
        tx.onabort=tx.onerror=()=>reject(failure('KAL cache write failed. Storage may be full.', 'KAL_STORAGE'));
        operation(tx.objectStore('cache'), value=>{result=value;});
      });
    }
    return Object.freeze({
      get:id=>transact('readonly',(store,done)=>{const r=store.get(id);r.onsuccess=()=>done(r.result);}),
      put:record=>transact('readwrite',store=>{store.put(record);const r=store.getAll();r.onsuccess=()=>{const rows=r.result.sort((a,b)=>b.at-a.at);for(const old of rows.slice(150))store.delete(old.id);};}),
      clear:()=>transact('readwrite',store=>store.clear())
    });
  }
  function create({storage, cache, request, now=Date.now, uuid=()=>global.crypto.randomUUID()}) {
    let queue=Promise.resolve(), revision=0;
    const flights=new Map(), cursors=new Map();
    const serial=work=>{const next=queue.catch(()=>{}).then(work);queue=next;return next;};
    async function credentials() {
      const record=await storage.get('credentials');
      if (record == null) return null;
      if (record.schema!==1 || typeof record.key!=='string' || typeof record.scope!=='string') throw failure('KAL credentials need to be reconnected.', 'KAL_STORAGE');
      return record;
    }
    async function settings() {
      const value=await storage.get('settings');
      if(value!=null && value.schema!==1)throw failure('Unsupported KAL settings version.', 'KAL_STORAGE');
      return value || {schema:1,enabled:false,display:'manual'};
    }
    async function api(path, key) {
      const backoff=await storage.get('backoff');
      if(backoff?.schema===1 && now() < (backoff.retryAt || 0))throw failure('KAL is cooling down after a rate limit.', 'KAL_RATE_LIMIT');
      let response;
      try { response=await request(ORIGIN+path,{method:'GET',headers:{Authorization:'ApiKey '+key,Accept:'application/json'},credentials:'omit',redirect:'error'}); }
      catch { throw failure('KAL could not be reached. Try again later.', 'KAL_NETWORK'); }
      let data;
      try { data=JSON.parse(response.text); } catch { data=null; }
      if(response.status===429) {
        const seconds=Number(response.retryAfter), date=Date.parse(response.retryAfter);
        const delay=response.retryAfter!=null&&Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-now():60_000;
        await storage.set('backoff',{schema:1,retryAt:now()+Math.max(1000,delay)});
      }
      if(response.status<200 || response.status>=300 || data?.error) {
        throw failure(errors[Number(data?.code)] || (response.status===429?errors[20]:`KAL request failed (HTTP ${Number(response.status)||0}).`), 'KAL_HTTP_'+(Number(data?.code)||response.status));
      }
      if(!data || typeof data!=='object')throw failure('KAL returned an unreadable response.', 'KAL_RESPONSE');
      return data;
    }
    async function status() {
      const [auth,prefs]=await Promise.all([credentials(),settings()]);
      return {connected:!!auth,enabled:prefs.enabled===true,display:prefs.display||'manual'};
    }
    async function connect(key, consent) {
      return serial(async()=>{
        if(consent!==true)throw failure('Confirm that you want to send this registered key to KAL.');
        key=String(key||'').trim();
        if(!/^[a-zA-Z0-9]{16}$/.test(key))throw failure('Enter a 16-character registered Torn API key.');
        const response=await api('/check-key',key);
        if(response.is_registered!==true)throw failure('Register this key and accept KAL’s policies at kalends.dev first.', 'KAL_UNREGISTERED');
        revision++;cursors.clear();
        await storage.set('settings',{schema:1,enabled:true,display:(await settings()).display||'manual'});
        await storage.set('credentials',{schema:1,key,scope:uuid(),validatedAt:now()});
        try{await cache.clear();}catch{} // Account-scoped cache cannot be reused by the new connection.
        return status();
      });
    }
    async function configure(value) {
      return serial(async()=>{
        if(value.enabled===true && !await credentials())throw failure('Connect a registered KAL key first.');
        const prior=await settings();revision++;cursors.clear();
        await storage.set('settings',{schema:1,enabled:value.enabled===true,display:['manual','slink','official'].includes(value.display)?value.display:prior.display});
        return status();
      });
    }
    async function disconnect() {
      return serial(async()=>{
        revision++;cursors.clear();
        await storage.remove('credentials');
        await storage.set('settings',{schema:1,enabled:false,display:'manual'});
        try{await cache.clear();}catch{} // Credential removal remains effective even if cache cleanup fails.
        return status();
      });
    }
    async function load(id, cursor=null) {
      await queue.catch(()=>{});
      id=playerId(id);
      if(cursor!==null && (typeof cursor!=='string' || !cursor))throw failure('Invalid KAL cursor.');
      const auth=await credentials(), prefs=await settings(), generation=revision;
      if(!auth || !prefs.enabled)throw failure('Enable KAL in SLINK settings first.', 'KAL_DISABLED');
      const context=auth.scope+':'+id;
      if(cursor!==null && !cursors.get(context)?.has(cursor))throw failure('Reload the latest loadout before navigating this history.', 'KAL_CURSOR');
      const identity=JSON.stringify([context,cursor]);
      if(flights.has(identity))return flights.get(identity);
      const current=async()=>generation===revision && (await credentials())?.scope===auth.scope && (await settings()).enabled;
      const work=(async()=>{
        let record;
        try { record=await cache.get(identity); } catch { /* Reads may proceed without cache. */ }
        let value;
        if(record?.schema===1 && record.at<=now() && now()-record.at<TTL) {
          try {value=parseLoadout(record.value,id);}catch{value=null;}
        }
        if(!value)value=parseLoadout(await api('/user/'+id+'/loadout'+(cursor===null?'':'?cursor='+encodeURIComponent(cursor)),auth.key),id);
        if(!await current())throw failure('KAL connection changed. Reopen this loadout.', 'KAL_STALE');
        const next=value.pagination?.next_cursor;
        if(next){if(!cursors.has(context))cursors.set(context,new Set());cursors.get(context).add(next);}
        // Cache contains no credentials; transaction acknowledgement precedes return.
        try {await cache.put({id:identity,schema:1,at:record?.value===value?record.at:now(),value});} catch { /* Cache failure must not hide a valid response. */ }
        if(!await current())throw failure('KAL connection changed. Reopen this loadout.', 'KAL_STALE');
        return value;
      })().finally(()=>flights.delete(identity));
      flights.set(identity,work);return work;
    }
    return Object.freeze({connect,configure,disconnect,status,load});
  }
  function history(client) {
    let generation=0, id=null, selected=null, cursor=null;
    async function select(player, next=null) {
      const token=++generation;id=playerId(player);selected=null;cursor=null;
      const value=await client.load(id,next);
      if(token!==generation)return null;
      selected=value;cursor=next;return value;
    }
    return Object.freeze({select,older:()=>selected?.pagination?.next_cursor?select(id,selected.pagination.next_cursor):Promise.resolve(null),latest:()=>select(id),clear:()=>{generation++;id=null;selected=null;cursor=null;},selected:()=>selected,text:()=>selected?loadoutText(selected):null,cursor:()=>cursor});
  }
  global.SLINK_KAL=Object.freeze({ORIGIN,create,openCache,playerId,parseLoadout,stamp,equipmentText,loadoutText,history});
})(globalThis);
