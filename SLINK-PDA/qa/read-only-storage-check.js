(() => {
  const scrub = value => String(value || '')
    .replace(/https?:\/\/[^\s"<>]+/g, url => url.split(/[?#]/)[0])
    .replace(/\b[A-Za-z0-9]{16,}\b/g, '[redacted]')
    .slice(0, 3000);
  const host = document.getElementById('slink-pda-dashboard-host');
  const report = {
    build: window.SLINK_PDA_DASHBOARD?.build || 'not available',
    runtimeReady: host?.dataset?.slinkReady || 'no',
    addonsReady: host?.dataset?.slinkAddonsReady || 'no',
    pageVisible: document.visibilityState,
    nativeEvaluatorPresent: typeof window.PDA_evaluateJavascript === 'function',
    nativeFactoryPresent: typeof window.__pdaStorageFactory === 'function',
    flutterBridgePresent: typeof window.flutter_inappwebview?.callHandler === 'function',
    slinkSaveStatus: (() => {const status=window.SLINK_PDA_DASHBOARD?.storage?.status?.();return status?{pending:status.pending,failed:status.failed,backend:status.backend}:'not available';})(),
    browserStorage: {}
  };
  try {
    const groups = {tornChatCache: 0, slink: 0, gm: 0, other: 0};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      const group = /^tchat_query_cache/i.test(key) ? 'tornChatCache' : /slink/i.test(key) ? 'slink' : /^GM/i.test(key) ? 'gm' : 'other';
      groups[group] += (key.length + (localStorage.getItem(key)?.length || 0)) * 2;
    }
    report.browserStorage = {approximateUTF16KiB: Object.fromEntries(Object.entries(groups).map(([key, size]) => [key, Math.round(size / 1024)]))};
  } catch (error) { report.browserStorage = {readError: scrub(error.message)}; }
  const seen = new Set();
  function record(error) {
    const text = scrub(error?.stack || error?.message || error);
    if (!text || seen.has(text) || seen.size >= 12) return;
    seen.add(text);
    console.log('[SLINK CHECK ERROR] ' + text);
  }
  const onError = event => record(event.error || {message: [event.message, event.filename, event.lineno, event.colno].join(' ')});
  const onRejection = event => record(event.reason);
  // Observe argument TYPES and completion only. Do not print namespace IDs,
  // key names, payload values, returned records, API keys or chat messages.
  const bridge=window.flutter_inappwebview,original=bridge?.callHandler;
  let nativeCalls=0,wrapped=null;
  if(typeof original==='function')try{
    wrapped=function(name,...args){
      if(name!=='PDA_storage')return Reflect.apply(original,this,[name,...args]);
      const id=++nativeCalls,start=Date.now(),payload=args[2];
      const type=value=>value===null?'null':Array.isArray(value)?'array':typeof value;
      const method=['get','getMany','loadAll','list','usage','set','setMany','delete'].includes(args[1])?args[1]:'unrecognized';
      if(id<=16)console.log('[SLINK CHECK NATIVE] '+JSON.stringify({id,method,namespaceType:type(args[0]),methodType:type(args[1]),payloadType:type(payload),keyType:type(payload?.key),keysTypes:Array.isArray(payload?.keys)?[...new Set(payload.keys.map(type))]:null}));
      const result=Reflect.apply(original,this,[name,...args]);
      if(result&&typeof result.then==='function')result.then(value=>{
        if(id<=16)console.log('[SLINK CHECK NATIVE END] '+JSON.stringify({id,ms:Date.now()-start,ok:value?.ok,error:value?.ok===false?scrub(value.error):undefined}));
      },error=>{if(id<=16)console.log('[SLINK CHECK NATIVE END] '+JSON.stringify({id,ms:Date.now()-start,error:scrub(error?.message||error)}));});
      return result;
    };
    bridge.callHandler=wrapped;
    report.nativeCallObservation=bridge.callHandler===wrapped?'enabled for 90 seconds':'unavailable';
  }catch{report.nativeCallObservation='unavailable';}
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  setTimeout(() => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    if(wrapped&&bridge?.callHandler===wrapped)bridge.callHandler=original;
    console.log('[SLINK CHECK] Capture ended. Native storage calls observed: '+nativeCalls);
  }, 90000);
  console.log('[SLINK CHECK] ' + JSON.stringify(report));
  return 'Read-only check ready. Try Save and authenticate once within 90 seconds, then share only SLINK CHECK lines. No data was changed.';
})()
