(function installChatGiphy(global) {
  'use strict';
  // Owner explicitly approved publication as a shared client-side application key.
  const APPLICATION_KEY = '3HOMWQm6YvOIVJfRZsTNjiE3g86AqzoW';
  const DEFAULTS = Object.freeze({ enabled:false, keyMode:'integrated', apiKey:'' });
  function normalize(value = {}) {
    return { ...DEFAULTS, ...value, enabled:value.enabled === true,
      keyMode:value.keyMode === 'custom' ? 'custom' : 'integrated', apiKey:String(value.apiKey || '').trim() };
  }
  function publicSettings(value) {
    const settings = normalize(value);
    return { enabled:settings.enabled, keyMode:settings.keyMode, hasCustomKey:!!settings.apiKey };
  }
  function mediaUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password &&
        (url.hostname === 'giphy.com' || url.hostname.endsWith('.giphy.com')) ? String(value) : '';
    } catch { return ''; }
  }
  function resultRow(gif) {
    const images = gif?.images || {};
    return { id:String(gif?.id || ''), title:String(gif?.title || 'GIF'),
      creator:String(gif?.user?.display_name || gif?.username || ''), url:mediaUrl(gif?.url),
      still:mediaUrl(images.fixed_width_still?.url || images.fixed_height_still?.url || images.original_still?.url),
      mp4:mediaUrl(images.fixed_width?.mp4 || images.fixed_height?.mp4 || images.downsized_small?.mp4),
      image:mediaUrl(images.fixed_width?.webp || images.fixed_height?.webp || images.fixed_width?.url || images.original?.url) };
  }
  function createClient({ read, write, authorize, request, now = Date.now }) {
    let saves = Promise.resolve(), pending = null, blockedUntil = 0, lastRequest = -Infinity;
    async function get() { await authorize(); await saves.catch(()=>{}); return publicSettings(await read()); }
    function patch(changes = {}) {
      const captured = { ...changes };
      const task = saves.catch(()=>{}).then(async()=>{
        await authorize(); const previous = normalize(await read()), next = { ...previous };
        if (Object.hasOwn(captured,'enabled')) next.enabled = captured.enabled === true;
        if (Object.hasOwn(captured,'keyMode')) {
          if (!['integrated','custom'].includes(captured.keyMode)) throw Error('Choose a GIPHY key option.');
          next.keyMode = captured.keyMode;
        }
        if (Object.hasOwn(captured,'apiKey')) {
          const key = String(captured.apiKey).trim();
          if (key && !/^[a-zA-Z0-9_-]{8,128}$/.test(key)) throw Error('Enter a valid GIPHY API key, not a URL or Torn key.');
          next.apiKey = key;
        }
        await write(next); return publicSettings(next);
      });
      saves = task; return task;
    }
    async function search(input = {}) {
      await authorize(); await saves.catch(()=>{});
      const settings = normalize(await read());
      if (!settings.enabled) throw Error('Enable the GIF picker first.');
      const key = settings.keyMode === 'custom' ? settings.apiKey : APPLICATION_KEY;
      if (!key) throw Error('Add your GIPHY API key or choose the integrated key.');
      const query = String(input.query || '');
      if (query.length > 50) throw Error('GIPHY searches can contain up to 50 characters.');
      const offset = Math.max(0, Math.min(query.trim() ? 4999 : 499, Math.floor(Number(input.offset) || 0)));
      if (pending) throw Error('A GIF request is still running. Please wait.');
      if (now() < blockedUntil) throw Error('GIPHY request limit reached. Please try again later.');
      if (now() - lastRequest < 1000) throw Error('Please wait a moment before searching again.');
      const url = new URL('https://api.giphy.com/v1/gifs/' + (query.trim() ? 'search' : 'trending'));
      url.searchParams.set('api_key',key); url.searchParams.set('limit','12');
      url.searchParams.set('offset',String(offset)); url.searchParams.set('rating','pg-13');
      if (query.trim()) url.searchParams.set('q',query);
      lastRequest = now();
      let timeout;
      pending = Promise.race([Promise.resolve().then(()=>request(url.href)),new Promise((_,reject)=>{
        timeout = setTimeout(()=>reject(Error('GIPHY request timed out. Please retry.')),12000);
      })]);
      try {
        const response = await pending;
        const status = Number(response.status || response.body?.meta?.status || 0);
        if (status === 429 || response.body?.meta?.status === 429) {
          blockedUntil = now() + Math.max(60000, Math.min(3600000, Number(response.retryAfter || 60)*1000));
          throw Error('GIPHY request limit reached. Please try again later.');
        }
        if (status === 401 || status === 403) throw Error('GIPHY rejected this key. Check your API key and its access.');
        if (status < 200 || status >= 300) throw Error('GIPHY is unavailable (HTTP ' + status + '). Please retry later.');
        if (!Array.isArray(response.body?.data)) throw Error('GIPHY returned an unexpected response.');
        await authorize();
        const current = normalize(await read());
        if (!current.enabled || current.keyMode !== settings.keyMode || current.apiKey !== settings.apiKey) throw Error('GIF settings changed. Please search again.');
        return { rows:response.body.data.map(resultRow), offset, nextOffset:offset+response.body.data.length,
          hasMore:response.body.data.length > 0 && offset+response.body.data.length < Number(response.body.pagination?.total_count || 0) && offset < (query.trim()?4999:499) };
      } catch (error) {
        // Native transport errors can contain the key-bearing URL. Never expose them.
        if (/^(GIPHY |GIF settings)/.test(error?.message || '')) throw error;
        throw Error('Could not reach GIPHY. Check connectivity and try again.');
      } finally { clearTimeout(timeout); pending = null; }
    }
    return Object.freeze({ get, patch, search });
  }
  async function request(url) {
    if (typeof global.PDA_httpGet === 'function') {
      const response = await global.PDA_httpGet(url,{Accept:'application/json'});
      const raw = response?.responseText ?? response?.body ?? response?.data ?? response;
      return { status:Number(response?.status ?? response?.statusCode) || 200, body:typeof raw === 'string' ? JSON.parse(raw) : raw };
    }
    if (typeof global.GM_xmlhttpRequest === 'function') return new Promise((resolve,reject)=>{
      global.GM_xmlhttpRequest({method:'GET',url,anonymous:true,timeout:10000,
        onload:r=>{try{resolve({status:r.status,body:JSON.parse(r.responseText)});}catch{reject(Error('Invalid response'));}},
        onerror:()=>reject(Error('Network error')),ontimeout:()=>reject(Error('Timeout'))});
    });
    const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),10000);
    try {
      const response = await global.fetch(url,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
      let body; try { body = await response.json(); } catch { body = null; }
      return {status:response.status,body,retryAfter:response.headers.get('Retry-After')};
    } finally { clearTimeout(timer); }
  }
  let pdaClient;
  function client() {
    if (global.SLINK_EXTENSION?.core?.messaging) {
      const send = global.SLINK_EXTENSION.core.messaging.send;
      return { get:()=>send('chat.giphy.get'),patch:changes=>send('chat.giphy.patch',changes),search:input=>send('chat.giphy.search',input) };
    }
    const api = global.SLINK_PDA_PLUGIN_API;
    if (!api) throw Error('Chat settings are unavailable.');
    return pdaClient ||= createClient({ read:()=>api.settings('chat',{}).giphy || {},
      write:async value=>{api.settings('chat',{}).giphy=value; await api.save();},
      authorize:async()=>{await api.ensurePermission(false);if(!api.hasScope('slink.qol.chat')&&!api.hasScope('admin.*'))throw Error('Chat permission is required.');}, request });
  }
  global.SLINK_GIPHY = Object.freeze({createClient,client,request,publicSettings,mediaUrl,resultRow});
})(globalThis);
