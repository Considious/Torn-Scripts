// ==UserScript==
// @name         SLINK PDA Dashboard
// @namespace    Considious [3853023]
// @version      0.2.1
// @description  Mobile-first SLINK dashboard for Torn PDA with shared permissions and module sessions.
// @author       Considious [3853023]
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/SLINK_PDA_Dashboard.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/SLINK_PDA_Dashboard.user.js
// @match        https://www.torn.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @connect      api.torn.com
// @connect      ffscouter.com
// @connect      slinkyleveling.richard-johnson554.workers.dev
// @connect      slinkcontributionworker.richard-johnson554.workers.dev
// @connect      slinkwarworker.richard-johnson554.workers.dev
// @run-at       document-end
// ==/UserScript==

(function installSlinkPdaDashboard(global) {
  'use strict';

  const BUILD = '0.2.1-modules';
  const HOST_ID = 'slink-pda-dashboard-host';
  const STORAGE_KEY = 'slink-pda-dashboard:ui:v1';
  const DATA_STORAGE_KEY = 'slink-pda-dashboard:data:v1';
  const SHARED_API_LEDGER_KEY = 'considious:torn-api-ledger:v1';
  const SHARED_API_LOCK = 'considious-torn-api-limiter-v1';
  const ROOT_OVERFLOW_KEY = 'slinkPdaPreviousOverflow';
  const API_WINDOW_MS = 60_000;
  const API_LIMIT = 60;
  const CLIENT_NAME = 'SLINK PDA Dashboard';
  const CLIENT_VERSION = '0.2.1';
  const URLS = Object.freeze({
    permission:'https://slinkcontributionworker.richard-johnson554.workers.dev',
    leveling:'https://slinkyleveling.richard-johnson554.workers.dev',
    war:'https://slinkwarworker.richard-johnson554.workers.dev',
    torn:'https://api.torn.com'
  });
  const PDA_KEY_TOKEN = ['###', 'PDA-APIKEY', '###'].join('');
  const PDA_API_KEY = String('###PDA-APIKEY###').trim();
  const PDA_API_KEY_AVAILABLE = Boolean(PDA_API_KEY && PDA_API_KEY !== PDA_KEY_TOKEN);
  const GM_API = Object.freeze({
    get:typeof GM_getValue === 'function' ? GM_getValue : global.GM_getValue,
    set:typeof GM_setValue === 'function' ? GM_setValue : global.GM_setValue,
    remove:typeof GM_deleteValue === 'function' ? GM_deleteValue : global.GM_deleteValue,
    menu:typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : global.GM_registerMenuCommand,
    request:typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : global.GM_xmlhttpRequest,
    notify:typeof GM_notification === 'function' ? GM_notification : global.GM_notification
  });

  if (global.SLINK_PDA_DASHBOARD?.build === BUILD) {
    global.SLINK_PDA_DASHBOARD.open();
    return;
  }
  document.getElementById(HOST_ID)?.remove();

  const defaults = Object.freeze({
    page: 'combat',
    combatTab: 'leveling',
    efficiencyTab: 'alerts',
    theme: 'slink-dark',
    bubblePosition: null
  });

  function readState() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
    } catch {
      return { ...defaults };
    }
  }

  function writeState() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        page: state.page,
        combatTab: state.combatTab,
        efficiencyTab: state.efficiencyTab,
        theme: state.theme,
        bubblePosition: state.bubblePosition
      }));
    } catch {}
  }

  function storageRead(key, fallback) {
    try {
      if (typeof GM_API.get === 'function') {
        const value = GM_API.get(key, fallback);
        if (!(value && typeof value.then === 'function')) return value;
      }
    } catch {}
    try {
      const parsed = JSON.parse(global.localStorage.getItem(key) || 'null');
      return parsed === null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function storageWrite(key, value) {
    try {
      if (typeof GM_API.set === 'function') GM_API.set(key, value);
      else global.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function storageDelete(key) {
    try {
      if (typeof GM_API.remove === 'function') GM_API.remove(key);
      else global.localStorage.removeItem(key);
    } catch {}
  }

  function readDataState() {
    const saved = storageRead(DATA_STORAGE_KEY, {});
    const value = saved && typeof saved === 'object' ? saved : {};
    return {
      apiKey:String(value.apiKey || ''),
      ffKey:String(value.ffKey || ''),
      usePdaApiKey:value.usePdaApiKey ?? value.usePdaKey ?? true,
      usePdaFfKey:value.usePdaFfKey ?? false,
      accepted:value.accepted && typeof value.accepted === 'object' ? value.accepted : {},
      terms:value.terms && typeof value.terms === 'object' ? value.terms : {},
      sessions:value.sessions && typeof value.sessions === 'object' ? value.sessions : {},
      caches:value.caches && typeof value.caches === 'object' ? value.caches : {},
      settings:{
        leveling:{ minFF:1, maxFF:3, ...(value.settings?.leveling || {}) },
        war:{ mode:'war', idleMinutes:5, ...(value.settings?.war || {}) },
        alerts:{ snoozedUntil:{}, ...(value.settings?.alerts || {}) },
        merits:{ refreshMinutes:15, filter:'all', page:1, pageSize:20, pinned:[], ...(value.settings?.merits || {}) }
      }
    };
  }

  function writeDataState() {
    storageWrite(DATA_STORAGE_KEY, dataState);
  }

  function currentApiKey() {
    if (PDA_API_KEY_AVAILABLE && dataState.usePdaApiKey) return PDA_API_KEY;
    return String(dataState.apiKey || '').trim();
  }

  function currentFfKey() {
    if (PDA_API_KEY_AVAILABLE && dataState.usePdaFfKey) return PDA_API_KEY;
    return String(dataState.ffKey || '').trim();
  }

  const state = readState();
  const dataState = readDataState();
  let dashboardOpen = false;
  let drag = null;
  let swipe = null;
  let networkQueue = Promise.resolve();
  let schedulerTimer = null;
  const moduleState = {
    access:{ busy:false, error:'' },
    leveling:{ busy:false, error:'', data:dataState.caches.leveling || null },
    war:{ busy:false, error:'', data:dataState.caches.war || null },
    stats:{ busy:false, error:'', data:dataState.caches.stats || null },
    alerts:{ busy:false, error:'', data:dataState.caches.alerts || null, lastAttemptAt:0 },
    merits:{ busy:false, error:'', data:dataState.caches.merits || null }
  };

  function serializeNetwork(task) {
    const result = networkQueue.then(task, task);
    networkQueue = result.catch(() => undefined);
    return result;
  }

  function errorMessage(error) {
    return String(error?.message || error || 'Unknown error').replace(/^Error:\s*/i, '').trim();
  }

  function pdaHttpHandler(method) {
    if (method === 'GET') return typeof PDA_httpGet === 'function' ? PDA_httpGet : global.PDA_httpGet;
    if (method === 'POST') return typeof PDA_httpPost === 'function' ? PDA_httpPost : global.PDA_httpPost;
    return null;
  }

  async function pdaHttpRequest(method, url, headers, body) {
    const handlerName = `PDA_http${method[0]}${method.slice(1).toLowerCase()}`;
    const direct = pdaHttpHandler(method);
    const response = typeof direct === 'function'
      ? await direct(url, headers, ...(body === undefined ? [] : [body]))
      : await global.flutter_inappwebview.callHandler(handlerName, url, headers, ...(body === undefined ? [] : [body]));
    const status = Number(response?.status ?? response?.statusCode) || 0;
    const responseText = typeof response === 'string' ? response : String(response?.responseText ?? response?.body ?? response?.data ?? '');
    let parsed = null;
    try { parsed = JSON.parse(responseText || 'null'); } catch {}
    if (status && (status < 200 || status >= 300)) {
      const error = new Error(parsed?.error?.message || parsed?.error || response?.statusText || `HTTP ${status}`);
      error.status = status;
      error.body = parsed;
      throw error;
    }
    return parsed ?? {};
  }

  function requestJson(url, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = { Accept:'application/json', ...(options.headers || {}) };
    const body = options.body === undefined
      ? undefined
      : typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    if (body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const pdaDirect = pdaHttpHandler(method);
    if (typeof pdaDirect === 'function' || typeof global.flutter_inappwebview?.callHandler === 'function') {
      return pdaHttpRequest(method, url, headers, body);
    }
    if (typeof GM_API.request === 'function') {
      return new Promise((resolve, reject) => {
        GM_API.request({
          method, url, headers, data:body, timeout:Number(options.timeout) || 30_000,
          onload(response) {
            let parsed = null;
            try { parsed = JSON.parse(String(response.responseText || 'null')); } catch {}
            if (Number(response.status) < 200 || Number(response.status) >= 300) {
              const error = new Error(parsed?.error?.message || parsed?.error || `HTTP ${response.status}`);
              error.status = Number(response.status) || 0;
              error.body = parsed;
              reject(error);
              return;
            }
            resolve(parsed ?? {});
          },
          ontimeout() { reject(new Error('The request timed out.')); },
          onerror(response) { reject(new Error(response?.error || response?.statusText || 'The request failed.')); }
        });
      });
    }
    return global.fetch(url, { method, headers, body, cache:'no-store', credentials:'omit' }).then(async response => {
      let parsed = null;
      try { parsed = await response.json(); } catch {}
      if (!response.ok) {
        const error = new Error(parsed?.error?.message || parsed?.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.body = parsed;
        throw error;
      }
      return parsed ?? {};
    });
  }

  function readApiLedger(now = Date.now()) {
    let source = {};
    try { source = JSON.parse(global.localStorage.getItem(SHARED_API_LEDGER_KEY) || '{}'); } catch {}
    if (Array.isArray(source)) source = { events:source };
    const seen = new Set();
    const events = (Array.isArray(source?.events) ? source.events : [])
      .map((event, index) => Number.isFinite(Number(event))
        ? { at:Number(event), id:`legacy:${event}:${index}` }
        : event && Number.isFinite(Number(event.at)) ? { ...event, at:Number(event.at) } : null)
      .filter(event => event && event.at > now - API_WINDOW_MS && event.at <= now + 5_000)
      .filter(event => {
        const id = String(event.id || `${event.at}:${event.script || ''}:${event.endpoint || ''}`);
        if (seen.has(id)) return false;
        seen.add(id);
        event.id = id;
        return true;
      })
      .sort((left, right) => left.at - right.at);
    const cooldownUntil = Number(source?.cooldownUntil) > now ? Number(source.cooldownUntil) : 0;
    return { events, cooldownUntil };
  }

  function writeApiLedger(ledger) {
    try { global.localStorage.setItem(SHARED_API_LEDGER_KEY, JSON.stringify(ledger)); } catch {}
  }

  async function withApiLock(task) {
    if (global.navigator?.locks?.request) return global.navigator.locks.request(SHARED_API_LOCK, task);
    return task();
  }

  async function reserveTornApi(endpoint = 'unknown') {
    return serializeNetwork(async () => {
      while (true) {
        const reservation = await withApiLock(() => {
          const now = Date.now();
          const ledger = readApiLedger(now);
          if (ledger.cooldownUntil > now || ledger.events.length >= API_LIMIT) return { waitUntil:Math.max(ledger.cooldownUntil, Number(ledger.events[0]?.at || now) + API_WINDOW_MS + 25) };
          ledger.events.push({
            at:now,
            id:`slink-pda:${global.crypto?.randomUUID?.() || `${now}:${Math.random().toString(36).slice(2)}`}`,
            script:'SLINK PDA Dashboard', priority:'normal', method:'GET', endpoint:String(endpoint).slice(0, 180), tabId:'pda-dashboard'
          });
          writeApiLedger(ledger);
          return { reservedAt:now };
        });
        if (reservation.reservedAt) return reservation;
        await new Promise(resolve => global.setTimeout(resolve, Math.max(50, Math.min(5_000, reservation.waitUntil - Date.now()))));
      }
    });
  }

  function apiUsage() {
    const ledger = readApiLedger();
    return { count:ledger.events.length, limit:API_LIMIT, remaining:Math.max(0, API_LIMIT - ledger.events.length) };
  }

  async function tornJson(path, comment = 'SLINK PDA Dashboard') {
    const key = currentApiKey();
    if (!key) throw new Error('Save a Torn API key under Access first.');
    const url = new URL(path.startsWith('http') ? path : `${URLS.torn}${path}`);
    if (!url.searchParams.has('comment')) url.searchParams.set('comment', comment);
    await reserveTornApi(url.pathname);
    const result = await requestJson(url.href, { headers:{ Authorization:`ApiKey ${key}` } });
    if (result?.error) throw new Error(result.error.message || result.error.error || 'Torn API request failed.');
    return result;
  }

  function scopeMatches(granted, required) {
    const left = String(granted || '');
    const right = String(required || '');
    return left === '*' || left === right || (left.endsWith('.*') && right.startsWith(left.slice(0, -1)));
  }

  function hasGrantedScope(required) {
    return (dataState.sessions.permission?.scopes || []).some(scope => scopeMatches(scope, required));
  }

  function hasScope(required) {
    const session = dataState.sessions.permission;
    return Boolean(session?.token && Number(session.expiresAt) > Date.now() && hasGrantedScope(required));
  }

  function hasAdminScope() {
    const session = dataState.sessions.permission;
    return Boolean(session?.token && Number(session.expiresAt) > Date.now() && (session.scopes || []).some(scope => String(scope) === 'admin.*' || String(scope) === '*'));
  }

  function hasThemeScope(required) {
    return hasAdminScope() || hasScope(required);
  }

  function validSession(name) {
    const session = dataState.sessions[name];
    return session?.token && Number(session.expiresAt) > Date.now() + 60_000 ? session : null;
  }

  async function fetchAllTerms(force = false) {
    const cached = dataState.terms;
    if (!force && cached?.fetchedAt && Date.now() - Number(cached.fetchedAt) < 60 * 60_000 && cached.permission?.version && cached.leveling?.version && cached.war?.version) return cached;
    const [permissionResponse, levelingResponse, warResponse] = await Promise.all([
      requestJson(`${URLS.permission}/api/permissions/terms`),
      requestJson(`${URLS.leveling}/api/terms`),
      requestJson(`${URLS.war}/api/terms`)
    ]);
    const terms = {
      fetchedAt:Date.now(),
      permission:{
        version:String(permissionResponse?.terms?.version || ''),
        sha256:String(permissionResponse?.terms?.sha256 || ''),
        url:String(permissionResponse?.terms?.url || ''),
        summary:String(permissionResponse?.terms?.summary || '')
      },
      leveling:{
        version:String(levelingResponse?.version || ''),
        sha256:String(levelingResponse?.document_sha256 || ''),
        disclosureVersion:String(levelingResponse?.disclosure_version || ''),
        disclosureSha256:String(levelingResponse?.disclosure_sha256 || ''),
        url:String(levelingResponse?.document_url || ''),
        summary:String(levelingResponse?.leveling_service_summary || '')
      },
      war:{
        version:String(warResponse?.terms?.version || ''),
        sha256:String(warResponse?.terms?.sha256 || ''),
        url:String(warResponse?.terms?.url || ''),
        summary:String(warResponse?.terms?.summary || '')
      }
    };
    if (!terms.permission.version || !terms.permission.sha256 || !terms.leveling.version || !terms.leveling.sha256 || !terms.leveling.disclosureVersion || !terms.leveling.disclosureSha256 || !terms.war.version || !terms.war.sha256) {
      throw new Error('One or more SLINK services returned incomplete terms metadata.');
    }
    dataState.terms = terms;
    writeDataState();
    return terms;
  }

  function termsAccepted(name) {
    const terms = dataState.terms?.[name];
    const accepted = dataState.accepted?.[name];
    if (!terms || !accepted || accepted.version !== terms.version || accepted.sha256 !== terms.sha256) return false;
    if (name === 'leveling') return accepted.disclosureVersion === terms.disclosureVersion && accepted.disclosureSha256 === terms.disclosureSha256;
    return true;
  }

  function acceptCurrentTerms() {
    const now = Date.now();
    for (const name of ['permission', 'leveling', 'war']) {
      const terms = dataState.terms?.[name];
      if (!terms?.version || !terms?.sha256) throw new Error('Load the current SLINK terms before accepting them.');
      dataState.accepted[name] = {
        version:terms.version,
        sha256:terms.sha256,
        disclosureVersion:terms.disclosureVersion || '',
        disclosureSha256:terms.disclosureSha256 || '',
        acceptedAt:now
      };
    }
    writeDataState();
  }

  function normalizeSession(response) {
    return {
      token:String(response?.session_token || ''),
      expiresAt:Date.parse(response?.expires_at) || 0,
      userId:Number(response?.user_id) || 0,
      userName:String(response?.user_name || `Player ${response?.user_id || ''}`).trim(),
      factionId:Number(response?.faction_id) || 0,
      roles:Array.isArray(response?.roles) ? response.roles.map(String) : [],
      scopes:Array.isArray(response?.scopes) ? response.scopes.map(String) : []
    };
  }

  async function ensurePermissionSession(force = false) {
    if (!force && validSession('permission')) return dataState.sessions.permission;
    const key = currentApiKey();
    if (!key) throw new Error('Save a Torn API key first.');
    await fetchAllTerms(false);
    if (!termsAccepted('permission')) throw new Error('Accept the current SLINK terms before authenticating.');
    await reserveTornApi('/v2/user/basic');
    const response = await requestJson(`${URLS.permission}/api/permissions/auth`, {
      method:'POST',
      body:{
        api_key:key,
        terms_accepted:true,
        terms_version:dataState.terms.permission.version,
        terms_sha256:dataState.terms.permission.sha256,
        client_name:CLIENT_NAME,
        client_version:CLIENT_VERSION
      }
    });
    const session = normalizeSession(response);
    if (!session.token || !session.scopes.length) throw new Error('SLINK returned no active feature permissions for this account.');
    dataState.sessions.permission = session;
    writeDataState();
    return session;
  }

  async function ensureLevelingSession(force = false) {
    if (!hasScope('slink.level')) throw new Error('Your SLINK account does not have slink.level permission.');
    if (!force && validSession('leveling')) return dataState.sessions.leveling;
    await fetchAllTerms(false);
    if (!termsAccepted('leveling')) throw new Error('Accept the current SLINK Leveling terms and disclosure under Access.');
    await reserveTornApi('/v2/user/basic');
    const terms = dataState.terms.leveling;
    const response = await requestJson(`${URLS.leveling}/api/auth`, {
      method:'POST',
      body:{
        api_key:currentApiKey(), terms_accepted:true,
        terms_version:terms.version, terms_sha256:terms.sha256,
        disclosure_version:terms.disclosureVersion, disclosure_sha256:terms.disclosureSha256,
        client_name:CLIENT_NAME, client_version:CLIENT_VERSION, contributor_only:false
      }
    });
    const session = normalizeSession(response);
    if (!session.token || !session.scopes.some(scope => scopeMatches(scope, 'slink.level'))) throw new Error('SLINK Leveling did not return slink.level permission.');
    dataState.sessions.leveling = session;
    writeDataState();
    return session;
  }

  async function ensureWarSession(force = false) {
    if (!hasScope('slink.war')) throw new Error('Your SLINK account does not have slink.war permission.');
    if (!force && validSession('war')) return dataState.sessions.war;
    await fetchAllTerms(false);
    if (!termsAccepted('war')) throw new Error('Accept the current SLINK War terms under Access.');
    await reserveTornApi('/v2/user/basic');
    const terms = dataState.terms.war;
    const response = await requestJson(`${URLS.war}/api/auth`, {
      method:'POST',
      body:{ api_key:currentApiKey(), terms_accepted:true, terms_version:terms.version, terms_sha256:terms.sha256, client_name:CLIENT_NAME, client_version:CLIENT_VERSION }
    });
    const session = normalizeSession(response);
    if (!session.token || !session.scopes.some(scope => scopeMatches(scope, 'slink.war'))) throw new Error('SLINK War did not return slink.war permission.');
    dataState.sessions.war = session;
    writeDataState();
    return session;
  }

  async function productRequest(name, path, options = {}, retried = false) {
    const session = name === 'leveling' ? await ensureLevelingSession(false) : await ensureWarSession(false);
    try {
      return await requestJson(`${URLS[name]}${path}`, {
        ...options,
        headers:{ Authorization:`Bearer ${session.token}`, ...(options.headers || {}) }
      });
    } catch (error) {
      if (error?.status === 401 && !retried) {
        dataState.sessions[name] = null;
        writeDataState();
        if (name === 'leveling') await ensureLevelingSession(true); else await ensureWarSession(true);
        return productRequest(name, path, options, true);
      }
      throw error;
    }
  }

  function clearSessions() {
    dataState.sessions = {};
    writeDataState();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
  }

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function number(value, digits = 0) {
    const parsed = finite(value);
    return parsed === null ? '—' : parsed.toLocaleString(undefined, { maximumFractionDigits:digits, minimumFractionDigits:digits });
  }

  function money(value, signed = false) {
    const parsed = finite(value);
    if (parsed === null) return '—';
    return `${signed && parsed > 0 ? '+' : parsed < 0 ? '-' : ''}$${Math.abs(parsed).toLocaleString(undefined, { maximumFractionDigits:0 })}`;
  }

  function relativeTime(timestamp) {
    const elapsed = Math.max(0, Date.now() - Number(timestamp || 0));
    if (!timestamp) return 'never';
    if (elapsed < 60_000) return `${Math.max(1, Math.floor(elapsed / 1000))}s ago`;
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
    if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
    return `${Math.floor(elapsed / 86_400_000)}d ago`;
  }

  function duration(seconds) {
    const total = Math.max(0, Math.ceil(Number(seconds) || 0));
    if (total >= 3600) return `${Math.floor(total / 3600)}h ${Math.floor(total % 3600 / 60)}m`;
    if (total >= 60) return `${Math.floor(total / 60)}m`;
    return `${total}s`;
  }

  function moduleRoot(name) {
    return shadow?.querySelector?.(`[data-module-root="${name}"]`) || null;
  }

  function moduleMessage(text, kind = '') {
    return `<div class="module-message ${escapeHtml(kind)}">${escapeHtml(text)}</div>`;
  }

  function actionLink(label, href) {
    return `<a class="action-link" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  }

  function lockedModule(scope, label) {
    if (!currentApiKey()) return moduleMessage('Add your Torn API key under Access to start this module.', 'locked');
    if (!validSession('permission')) return moduleMessage('Authenticate under Access so SLINK can load your feature permissions.', 'locked');
    return moduleMessage(`${label} requires ${scope}. Ask a SLINK administrator to grant that scope.`, 'locked');
  }

  function renderAccess() {
    const root = moduleRoot('access');
    if (!root) return;
    const permission = validSession('permission');
    const usage = apiUsage();
    const terms = dataState.terms || {};
    const accepted = ['permission', 'leveling', 'war'].every(termsAccepted);
    const termLinks = ['permission', 'leveling', 'war'].map(name => {
      const item = terms[name];
      return item?.version ? `<a href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener">${escapeHtml(name)} ${escapeHtml(item.version)}</a>` : `<span>${escapeHtml(name)} not loaded</span>`;
    }).join('');
    root.innerHTML = `<div class="grid">
      <article class="card wide"><div class="card-head"><div><h2>API &amp; feature access</h2><span class="muted">The key and sessions stay in this userscript's local storage.</span></div><span class="badge ${permission ? 'ready' : 'warn'}">${permission ? 'Connected' : 'Setup'}</span></div>
        ${moduleState.access.error ? moduleMessage(moduleState.access.error, 'error') : ''}
        <div class="access-form">
          <label>Torn API key<input type="password" autocomplete="off" data-field="api-key" value="${escapeHtml(dataState.apiKey)}" placeholder="Limited-access Torn key"></label>
          <label>FFScouter API key<input type="password" autocomplete="off" data-field="ff-key" value="${escapeHtml(dataState.ffKey)}" placeholder="Usually different from the Torn key"></label>
          ${PDA_API_KEY_AVAILABLE ? `<label class="check-row"><input type="checkbox" data-field="use-pda-api-key" ${dataState.usePdaApiKey ? 'checked' : ''}>Use Torn PDA's injected key for Torn API requests.</label><label class="check-row"><input type="checkbox" data-field="use-pda-ff-key" ${dataState.usePdaFfKey ? 'checked' : ''}>Use Torn PDA's injected key as the FFScouter fallback.</label>` : '<span class="muted wide">Torn PDA key injection was not detected. Saved Torn and FFScouter keys will be used independently.</span>'}
          <span class="muted wide">The FFScouter key is sent only to FFScouter when refining target estimates.</span>
          <label class="check-row wide"><input type="checkbox" data-field="accept-terms" ${accepted ? 'checked' : ''}>I accept the current SLINK permission, Leveling, and War terms/disclosures shown below.</label>
          <div class="access-actions wide"><button type="button" data-action="save-access">Save &amp; authenticate</button><button type="button" data-action="load-terms">Load current terms</button><button class="danger" type="button" data-action="clear-access">Clear key &amp; sessions</button></div>
        </div>
        <div class="terms-list">${termLinks}</div>
      </article>
      <article class="card"><div class="card-head"><div><h2>Session</h2><span class="muted">${permission ? `${escapeHtml(permission.userName)} [${permission.userId}]` : 'Not authenticated'}</span></div></div><details class="scope-details"><summary>${permission?.scopes?.length ? `${permission.scopes.length} granted permissions` : 'No permissions loaded'}</summary><div class="scope-list">${permission?.scopes?.length ? permission.scopes.map(scope => `<span>${escapeHtml(scope)}</span>`).join('') : '<span>No scopes loaded</span>'}</div></details></article>
      <article class="card"><div class="card-head"><div><h2>Shared API limiter</h2><span class="muted">Shared with compatible Considious scripts in this Torn page.</span></div></div><div class="stats"><div class="stat"><strong>${usage.count}</strong><span>Last minute</span></div><div class="stat"><strong>${usage.remaining}</strong><span>Remaining</span></div><div class="stat"><strong>${usage.limit}</strong><span>Limit</span></div><div class="stat"><strong>1</strong><span>Queue</span></div></div></article>
    </div>`;
    applyPermissionGates();
  }

  async function loadTerms(force = false) {
    moduleState.access.busy = true;
    moduleState.access.error = '';
    renderAccess();
    try { await fetchAllTerms(force); }
    catch (error) { moduleState.access.error = errorMessage(error); }
    finally { moduleState.access.busy = false; renderAccess(); }
  }

  async function saveAccess() {
    const keyInput = moduleRoot('access')?.querySelector('[data-field="api-key"]');
    const ffInput = moduleRoot('access')?.querySelector('[data-field="ff-key"]');
    const pdaApiInput = moduleRoot('access')?.querySelector('[data-field="use-pda-api-key"]');
    const pdaFfInput = moduleRoot('access')?.querySelector('[data-field="use-pda-ff-key"]');
    const acceptance = moduleRoot('access')?.querySelector('[data-field="accept-terms"]');
    dataState.apiKey = String(keyInput?.value || '').trim();
    dataState.ffKey = String(ffInput?.value || '').trim();
    dataState.usePdaApiKey = pdaApiInput ? pdaApiInput.checked : false;
    dataState.usePdaFfKey = pdaFfInput ? pdaFfInput.checked : false;
    clearSessions();
    moduleState.access.error = '';
    try {
      await fetchAllTerms(false);
      if (!acceptance?.checked) throw new Error('Accept the current SLINK terms and disclosures before authenticating.');
      acceptCurrentTerms();
      await ensurePermissionSession(true);
      await Promise.allSettled([hasScope('slink.level') ? ensureLevelingSession(true) : Promise.resolve(), hasScope('slink.war') ? ensureWarSession(true) : Promise.resolve()]);
    } catch (error) {
      moduleState.access.error = errorMessage(error);
    }
    writeDataState();
    renderAllModules();
  }

  function applyPermissionGates() {
    const gates = [
      ['[data-combat-tab="leveling"]', 'slink.level'],
      ['[data-combat-tab="war"]', 'slink.war'],
      ['[data-efficiency-tab="alerts"]', 'slink.adhd.alerts'],
      ['[data-efficiency-tab="merits"]', 'slink.adhd.alerts'],
      ['[data-theme-choice="slinky-pursuit"]', 'slink.theme.pursuit'],
      ['[data-theme-choice="slinky-underglow"]', 'slink.theme.underglow']
    ];
    for (const [selector, scope] of gates) {
      const control = shadow?.querySelector?.(selector);
      if (!control) continue;
      const allowed = scope.startsWith('slink.theme.') ? hasThemeScope(scope) : hasScope(scope);
      control.classList.toggle('permission-lock', !allowed);
      control.title = allowed ? '' : `Requires ${scope}`;
    }
  }

  function levelingRows(payload) {
    return Array.isArray(payload?.targets) ? payload.targets : Array.isArray(payload?.recommendations) ? payload.recommendations : [];
  }

  async function refineWithFfScouter(rows) {
    const values = Array.isArray(rows) ? rows : [];
    const key = currentFfKey();
    if (!key || !values.length) return values;
    const now = Date.now();
    const cache = dataState.caches.ffScouter && typeof dataState.caches.ffScouter === 'object' ? dataState.caches.ffScouter : {};
    const ids = [...new Set(values.map(row => Math.trunc(Number(row?.id ?? row?.target_id ?? row?.user_id) || 0)).filter(id => id > 0))];
    const missing = ids.filter(id => !cache[id] || now - Number(cache[id].checkedAt || 0) >= 5 * 60_000);
    for (let index = 0; index < missing.length; index += 100) {
      const targets = missing.slice(index, index + 100);
      const url = `https://ffscouter.com/api/v1/get-stats?key=${encodeURIComponent(key)}&targets=${encodeURIComponent(targets.join(','))}`;
      const response = await requestJson(url);
      const returnedRows = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : Array.isArray(response?.results) ? response.results : [];
      const returned = new Set();
      for (const row of returnedRows) {
        const id = Math.trunc(Number(row?.player_id ?? row?.id ?? row?.user_id) || 0);
        if (!id) continue;
        returned.add(id);
        cache[id] = { fairFight:finite(row?.fair_fight ?? row?.fairFight ?? row?.ff), battleStats:finite(row?.bs_estimate ?? row?.battle_stats_estimate ?? row?.total_stats), source:String(row?.source || 'FFScouter'), checkedAt:now };
      }
      for (const id of targets) if (!returned.has(id)) cache[id] = { fairFight:null, battleStats:null, source:'FFScouter', checkedAt:now };
    }
    dataState.caches.ffScouter = cache;
    writeDataState();
    return values.map(row => {
      const id = Math.trunc(Number(row?.id ?? row?.target_id ?? row?.user_id) || 0);
      const refined = cache[id] || {};
      return {
        ...row,
        fair_fight:finite(refined.fairFight) ?? row?.fair_fight,
        fairFight:finite(refined.fairFight) ?? row?.fairFight,
        bs_estimate:finite(refined.battleStats) ?? row?.bs_estimate,
        battleStatsEstimate:finite(refined.battleStats) ?? row?.battleStatsEstimate,
        fairFightSource:finite(refined.fairFight) === null ? row?.fairFightSource : refined.source
      };
    });
  }

  function renderLeveling() {
    const root = moduleRoot('leveling');
    if (!root) return;
    if (!hasScope('slink.level')) { root.innerHTML = lockedModule('slink.level', 'SLINK Leveling'); return; }
    const current = moduleState.leveling;
    if (current.busy && !current.data) { root.innerHTML = moduleMessage('Loading recommendations…'); return; }
    if (current.error && !current.data) { root.innerHTML = moduleMessage(current.error, 'error'); return; }
    const payload = current.data?.payload || {};
    const rows = levelingRows(payload);
    root.innerHTML = `<div class="grid"><article class="card full"><div class="card-head"><div><h2>SLINK Leveling</h2><span class="muted">Read-only PDA recommendations · no API-check contribution</span></div><span class="badge ${payload.collector ? 'warn' : 'ready'}">${payload.collector ? 'Collector available' : 'Standby'}</span></div>
      <div class="module-toolbar"><span>${rows.length} target${rows.length === 1 ? '' : 's'} · FF ${number(dataState.settings.leveling.minFF, 1)}–${number(dataState.settings.leveling.maxFF, 1)} · updated ${relativeTime(current.data?.at)}</span></div>
      ${current.error ? moduleMessage(current.error, 'error') : ''}
      <div class="target-stack">${rows.length ? rows.map(row => {
        const id = Math.trunc(Number(row?.id ?? row?.target_id) || 0);
        const name = String(row?.name || `Player ${id}`);
        const ff = finite(row?.fair_fight ?? row?.fairFight);
        const status = String(row?.status ?? row?.previous_status ?? 'Unknown');
        return `<article class="target-card"><div><strong>${escapeHtml(name)} [${id}]</strong><small>Level ${number(row?.level)} · ${escapeHtml(status)}${ff === null ? '' : ` · FF ${number(ff, 2)}`}</small></div><div class="target-actions">${actionLink('Profile', `https://www.torn.com/profiles.php?XID=${id}`)}${actionLink('Attack', `https://www.torn.com/page.php?sid=attack&user2ID=${id}`)}</div></article>`;
      }).join('') : moduleMessage('No recommendations are currently assigned.')}</div>
    </article></div>`;
  }

  async function refreshLeveling(force = false) {
    const current = moduleState.leveling;
    const cached = dataState.caches.leveling;
    if (!force && cached?.at && Date.now() - cached.at < 5 * 60_000) { current.data = cached; renderLeveling(); return; }
    current.busy = true; current.error = ''; renderLeveling();
    try {
      await ensurePermissionSession(false);
      await ensureLevelingSession(false);
      const lastActivity = Number(dataState.caches.levelingActivityAt) || 0;
      if (Date.now() - lastActivity >= 5 * 60_000) {
        await productRequest('leveling', '/api/user/activity', { method:'POST', body:{ last_interaction_at:Date.now() } });
        dataState.caches.levelingActivityAt = Date.now();
      }
      const settings = dataState.settings.leveling;
      const query = new URLSearchParams({ limit:'20', poll_seconds:'300', min_ff:String(Math.min(settings.minFF, settings.maxFF)), max_ff:String(Math.max(settings.minFF, settings.maxFF)) });
      const payload = await productRequest('leveling', `/api/recommendations?${query}`);
      if (Array.isArray(payload?.targets)) payload.targets = await refineWithFfScouter(payload.targets);
      else if (Array.isArray(payload?.recommendations)) payload.recommendations = await refineWithFfScouter(payload.recommendations);
      current.data = dataState.caches.leveling = { at:Date.now(), payload };
      writeDataState();
    } catch (error) { current.error = errorMessage(error); }
    finally { current.busy = false; renderLeveling(); }
  }

  function warFactionEntries(factions) {
    if (Array.isArray(factions)) return factions.map(row => [Math.trunc(Number(row?.id ?? row?.faction_id ?? row?.faction?.id) || 0), row]).filter(([id]) => id > 0);
    return Object.entries(factions || {}).map(([key, row]) => [Math.trunc(Number(row?.id ?? row?.faction_id ?? row?.faction?.id ?? key) || 0), row]).filter(([id]) => id > 0);
  }

  function currentRankedWar(payload, ownFactionId) {
    const now = Math.floor(Date.now() / 1000);
    const source = payload?.rankedwars ?? payload?.ranked_wars ?? payload?.wars ?? [];
    const rows = Array.isArray(source) ? source : Object.values(source || {});
    return rows.map(war => {
      const start = Number(war?.war?.start ?? war?.start ?? war?.started ?? 0);
      const end = Number(war?.war?.end ?? war?.end ?? war?.ended ?? 0);
      const opponent = warFactionEntries(war?.factions ?? war?.war?.factions).find(([id]) => id !== Number(ownFactionId));
      if (!start || (end && end <= now) || !opponent) return null;
      return { war, start, opponentId:opponent[0], opponentName:String(opponent[1]?.name || `Faction ${opponent[0]}`) };
    }).filter(Boolean).sort((a, b) => (a.start <= now ? 0 : 1) - (b.start <= now ? 0 : 1) || Math.abs(a.start - now) - Math.abs(b.start - now))[0] || null;
  }

  function makeWarId(ownFactionId, opponentId, startedAtSeconds) {
    return `rw_${Math.trunc(Number(ownFactionId))}_${Math.trunc(Number(opponentId))}_${Math.trunc(Number(startedAtSeconds))}`;
  }

  function renderWar() {
    const root = moduleRoot('war');
    if (!root) return;
    if (!hasScope('slink.war')) { root.innerHTML = lockedModule('slink.war', 'SLINK War'); return; }
    const current = moduleState.war;
    if (current.busy && !current.data) { root.innerHTML = moduleMessage('Finding your ranked war…'); return; }
    if (current.error && !current.data) { root.innerHTML = moduleMessage(current.error, 'error'); return; }
    if (!current.data?.activeWar) { root.innerHTML = `<div class="grid"><article class="card full"><div class="card-head"><div><h2>SLINK War</h2><span class="muted">Assigned and active ranked-war detection</span></div><span class="badge">No war</span></div>${current.error ? moduleMessage(current.error, 'error') : moduleMessage('No assigned or active ranked war was found.')}</article></div>`; return; }
    const active = current.data.activeWar;
    const snapshot = current.data.snapshot || {};
    const members = Array.isArray(snapshot.members) ? snapshot.members : Array.isArray(snapshot.targets) ? snapshot.targets : [];
    const retals = Array.isArray(snapshot.retals) ? snapshot.retals : [];
    const officer = hasScope('slink.war.officer');
    root.innerHTML = `<div class="grid"><article class="card full"><div class="card-head"><div><h2>${escapeHtml(active.opponentName)}</h2><span class="muted">${active.phase === 'active' ? 'Ranked war active' : `Assigned · starts ${new Date(active.start * 1000).toLocaleString()}`}</span></div><span class="badge ${officer ? 'ready' : ''}">${officer ? 'Officer' : 'Member'}</span></div>
      <div class="stats"><div class="stat"><strong>${members.length}</strong><span>Targets</span></div><div class="stat"><strong>${retals.length}</strong><span>Retals</span></div><div class="stat"><strong>${number(snapshot?.stats?.attacks ?? snapshot?.attacks ?? 0)}</strong><span>Attacks</span></div><div class="stat"><strong>${number(snapshot?.stats?.chain ?? snapshot?.chain ?? 0)}</strong><span>Chain</span></div></div>
      <div class="module-toolbar"><span>Updated ${relativeTime(current.data.at)} · read-only PDA snapshot${officer ? ' · officer tools unlocked' : ''}</span></div>
      ${current.error ? moduleMessage(current.error, 'error') : ''}
      <div class="target-stack">${members.slice(0, 30).map(member => {
        const id = Math.trunc(Number(member?.id ?? member?.user_id) || 0);
        const name = String(member?.name || `Player ${id}`);
        const activity = String(member?.activity ?? member?.last_action?.status ?? 'Unknown');
        const status = String(member?.statusState ?? member?.status?.state ?? 'Unknown');
        const ff = finite(member?.fairFight ?? member?.fair_fight);
        const estimate = finite(member?.battleStatsEstimate ?? member?.battle_stats_estimate);
        return `<article class="target-card"><div><strong>${escapeHtml(name)} [${id}]</strong><small>${escapeHtml(activity)} · ${escapeHtml(status)}${estimate === null ? '' : ` · BS ${number(estimate)}`}${ff === null ? '' : ` · FF ${number(ff, 2)}`}</small></div><div class="target-actions">${actionLink('Profile', `https://www.torn.com/profiles.php?XID=${id}`)}${actionLink('Attack', `https://www.torn.com/page.php?sid=attack&user2ID=${id}`)}</div></article>`;
      }).join('') || moduleMessage('No targets were returned for this war.')}</div>
    </article></div>`;
  }

  async function refreshWar(force = false) {
    const current = moduleState.war;
    const cached = dataState.caches.war;
    if (!force && cached?.at && Date.now() - cached.at < 5 * 60_000) { current.data = cached; renderWar(); return; }
    current.busy = true; current.error = ''; renderWar();
    try {
      const session = await ensurePermissionSession(false);
      await ensureWarSession(false);
      if (!session.factionId) throw new Error('Your permission session does not include a faction.');
      const wars = await tornJson(`/v2/faction/${encodeURIComponent(session.factionId)}/rankedwars?sort=desc&limit=10`, 'SLINK PDA ranked war detection');
      const found = currentRankedWar(wars, session.factionId);
      if (!found) {
        current.data = dataState.caches.war = { at:Date.now(), activeWar:null, snapshot:null };
      } else {
        const activeWar = { opponentId:found.opponentId, opponentName:found.opponentName, start:found.start, phase:found.start * 1000 <= Date.now() ? 'active' : 'assigned', warId:makeWarId(session.factionId, found.opponentId, found.start) };
        const query = new URLSearchParams({ opponent_faction_id:String(found.opponentId), mode:String(dataState.settings.war.mode || 'war'), idle_minutes:String(dataState.settings.war.idleMinutes || 5) });
        const snapshot = await productRequest('war', `/api/wars/${encodeURIComponent(activeWar.warId)}/snapshot?${query}`);
        if (Array.isArray(snapshot?.members)) snapshot.members = await refineWithFfScouter(snapshot.members);
        else if (Array.isArray(snapshot?.targets)) snapshot.targets = await refineWithFfScouter(snapshot.targets);
        current.data = dataState.caches.war = { at:Date.now(), activeWar, snapshot };
      }
      writeDataState();
    } catch (error) { current.error = errorMessage(error); }
    finally { current.busy = false; renderWar(); }
  }

  const PLAYER_STATS = ['xantaken','energydrinkused','refills','attackswon','respectforfaction','retals','timeplayed','networth'];

  function personalStatMap(response) {
    return Object.fromEntries((Array.isArray(response?.personalstats) ? response.personalstats : []).map(row => [String(row?.name || ''), finite(row?.value)]).filter(([key, value]) => key && value !== null));
  }

  function statDelta(current, previous, name) {
    return finite(current[name]) === null || finite(previous[name]) === null ? null : Number(current[name]) - Number(previous[name]);
  }

  function statsPeriod(current, previous, days) {
    return { days, xanax:statDelta(current, previous, 'xantaken'), cans:statDelta(current, previous, 'energydrinkused'), refills:statDelta(current, previous, 'refills'), attacks:statDelta(current, previous, 'attackswon'), respect:statDelta(current, previous, 'respectforfaction'), retals:statDelta(current, previous, 'retals'), activity:statDelta(current, previous, 'timeplayed'), networth:statDelta(current, previous, 'networth') };
  }

  function perDay(value, days, digits = 2) {
    return finite(value) === null ? '—' : `${number(value, digits)} (${number(Number(value) / days, digits)}/d)`;
  }

  function renderStats() {
    const root = moduleRoot('stats');
    if (!root) return;
    const current = moduleState.stats;
    if (current.busy && !current.data) { root.innerHTML = moduleMessage('Loading your daily Torn snapshot…'); return; }
    if (current.error && !current.data) { root.innerHTML = moduleMessage(current.error, 'error'); return; }
    const data = current.data?.data;
    if (!data) { root.innerHTML = moduleMessage('Your daily player snapshot has not been loaded yet.'); return; }
    const seven = data.periods[7], thirty = data.periods[30];
    const table = (title, rows) => `<article class="card"><h2>${escapeHtml(title)}</h2><div class="stat-table"><div class="stat-row head"><span></span><strong>7 days</strong><strong>30 days</strong></div>${rows.map(([label, key, digits = 2, formatter = perDay]) => `<div class="stat-row"><span>${escapeHtml(label)}</span><strong>${formatter(seven[key], 7, digits)}</strong><strong>${formatter(thirty[key], 30, digits)}</strong></div>`).join('')}</div></article>`;
    root.innerHTML = `<div class="module-toolbar"><span>Updated ${relativeTime(current.data.at)} · Torn historical stats update daily</span></div>${current.error ? moduleMessage(current.error, 'error') : ''}<div class="grid">
      ${table('Consumables', [['Xanax','xanax'],['Energy cans','cans'],['Refills','refills']])}
      ${table('Combat', [['Attacks','attacks'],['Respect','respect'],['Retals','retals'],['Activity','activity',1,(value, days) => finite(value) === null ? '—' : `${number(Number(value) / 3600 / days, 2)}h/d`]])}
      <article class="card"><h2>Networth</h2><div class="value-list"><div><span>Current</span><strong>${money(data.networth.current)}</strong></div><div><span>Yesterday</span><strong>${money(data.networth.yesterday, true)}</strong></div><div><span>Day before</span><strong>${money(data.networth.dayBefore, true)}</strong></div><div><span>7 days</span><strong>${money(data.networth.seven, true)}</strong></div><div><span>30 days</span><strong>${money(data.networth.thirty, true)}</strong></div></div></article>
      <article class="card"><h2>Working stats</h2><div class="two-column"><div class="mini"><span>Manual</span><strong>${number(data.work.manual)}</strong></div><div class="mini"><span>Intelligence</span><strong>${number(data.work.intelligence)}</strong></div><div class="mini"><span>Endurance</span><strong>${number(data.work.endurance)}</strong></div><div class="mini"><span>Total</span><strong>${number(data.work.total)}</strong></div></div></article>
      <article class="card full"><div class="value-list"><div><span>Current faction armory balance</span><strong>${money(data.armoryBalance)}</strong></div></div></article>
    </div>`;
  }

  async function refreshStats(force = false) {
    const current = moduleState.stats;
    const cached = dataState.caches.stats;
    const today = Math.floor(Date.now() / 86_400_000);
    if (!force && cached?.day === today) { current.data = cached; renderStats(); return; }
    current.busy = true; current.error = ''; renderStats();
    try {
      const baseline = today * 86_400_000;
      const statParam = PLAYER_STATS.join(',');
      const [now, one, two, seven, thirty] = await Promise.all([
        tornJson(`/v2/user?selections=personalstats,money,workstats&stat=${statParam}`, 'SLINK PDA daily player stats'),
        tornJson(`/v2/user/personalstats?stat=${statParam}&timestamp=${Math.floor((baseline - 86_400_000) / 1000)}`, 'SLINK PDA player history'),
        tornJson(`/v2/user/personalstats?stat=${statParam}&timestamp=${Math.floor((baseline - 2 * 86_400_000) / 1000)}`, 'SLINK PDA player history'),
        tornJson(`/v2/user/personalstats?stat=${statParam}&timestamp=${Math.floor((baseline - 7 * 86_400_000) / 1000)}`, 'SLINK PDA player history'),
        tornJson(`/v2/user/personalstats?stat=${statParam}&timestamp=${Math.floor((baseline - 30 * 86_400_000) / 1000)}`, 'SLINK PDA player history')
      ]);
      const maps = [now, one, two, seven, thirty].map(personalStatMap);
      const moneyBody = now?.money || {};
      const work = now?.workstats || {};
      const data = {
        periods:{ 7:statsPeriod(maps[0], maps[3], 7), 30:statsPeriod(maps[0], maps[4], 30) },
        networth:{ current:maps[0].networth, yesterday:statDelta(maps[0], maps[1], 'networth'), dayBefore:statDelta(maps[1], maps[2], 'networth'), seven:statDelta(maps[0], maps[3], 'networth'), thirty:statDelta(maps[0], maps[4], 'networth') },
        work:{ manual:work.manual_labor, intelligence:work.intelligence, endurance:work.endurance, total:work.total },
        armoryBalance:finite(moneyBody?.faction?.money ?? moneyBody?.faction_balance?.money ?? (typeof moneyBody?.faction === 'number' ? moneyBody.faction : null))
      };
      current.data = dataState.caches.stats = { at:Date.now(), day:today, data };
      writeDataState();
    } catch (error) { current.error = errorMessage(error); }
    finally { current.busy = false; renderStats(); }
  }

  function refillAvailable(refills, type) {
    const row = refills?.[type];
    if (row && typeof row === 'object') {
      if (typeof row.available === 'boolean') return row.available;
      if (typeof row.used === 'boolean') return !row.used;
    }
    if (typeof row === 'boolean') return !row;
    return false;
  }

  function acceptedMissions(missions) {
    const givers = Array.isArray(missions?.givers) ? missions.givers : Array.isArray(missions) ? missions : [];
    return givers.flatMap(giver => Array.isArray(giver?.contracts) ? giver.contracts : []).filter(contract => /^accepted$/i.test(String(contract?.status || '')));
  }

  function personalStat(response, statName) {
    return personalStatMap(response)[statName] ?? null;
  }

  function cooldownSeconds(body, name, fetchedAt) {
    const value = finite(body?.cooldowns?.[name]);
    return value === null ? null : Math.max(0, Math.ceil(value - Math.max(0, Date.now() - fetchedAt) / 1000));
  }

  function alertRows(snapshot) {
    const body = snapshot?.body || {};
    const fetchedAt = Number(snapshot?.at) || Date.now();
    const snoozed = dataState.settings.alerts.snoozedUntil || {};
    const rows = [];
    const add = (id, active, title, detail, links = []) => {
      if (active && Number(snoozed[id] || 0) <= Date.now()) rows.push({ id, title, detail, links });
    };
    const energy = body?.bars?.energy || {};
    const nerve = body?.bars?.nerve || {};
    const drug = cooldownSeconds(body, 'drug', fetchedAt);
    const medical = cooldownSeconds(body, 'medical', fetchedAt);
    const booster = cooldownSeconds(body, 'booster', fetchedAt);
    const missions = acceptedMissions(body?.missions);
    const cityBought = finite(snapshot?.cityBought);
    add('drugCooldown', drug === 0, 'Drug cooldown is clear', 'You can take a drug now.', [['Items','https://www.torn.com/item.php'],['Faction Armory','https://www.torn.com/factions.php?step=your#/tab=armoury']]);
    add('medicalCooldown', medical === 0, 'Medical cooldown is clear', 'Fill a blood bag or use medical supplies.', [['Items','https://www.torn.com/item.php'],['Faction Armory','https://www.torn.com/factions.php?step=your#/tab=armoury']]);
    add('boosterCooldown', booster === 0, 'Booster cooldown is clear', 'You can use a booster now.', [['Items','https://www.torn.com/item.php'],['Faction Armory','https://www.torn.com/factions.php?step=your#/tab=armoury']]);
    add('energyFull', finite(energy.current) !== null && finite(energy.maximum) !== null && Number(energy.current) >= Number(energy.maximum), 'Energy is full', `${number(energy.current)} / ${number(energy.maximum)}`, [['Gym','https://www.torn.com/gym.php']]);
    add('nerveFull', finite(nerve.current) !== null && finite(nerve.maximum) !== null && Number(nerve.current) >= Number(nerve.maximum), 'Nerve is full', `${number(nerve.current)} / ${number(nerve.maximum)}`, [['Crimes','https://www.torn.com/page.php?sid=crimes']]);
    add('energyRefill', refillAvailable(body?.refills, 'energy'), 'Energy refill is unused', 'Your daily point refill is available.', [['Points','https://www.torn.com/points.php'],['Faction Armory','https://www.torn.com/factions.php?step=your#/tab=armoury']]);
    add('nerveRefill', refillAvailable(body?.refills, 'nerve'), 'Nerve refill is unused', 'Your daily point refill is available.', [['Points','https://www.torn.com/points.php'],['Faction Armory','https://www.torn.com/factions.php?step=your#/tab=armoury']]);
    add('missions', missions.length > 0, missions.length >= 3 ? 'Mission cap reached' : `${missions.length} unfinished mission${missions.length === 1 ? '' : 's'}`, missions.length >= 3 ? 'Complete one before another arrives so you do not miss mission credits.' : missions.map(row => row?.title).filter(Boolean).slice(0, 2).join(' / '), [['Missions','https://www.torn.com/page.php?sid=missions']]);
    add('cityItems', cityBought !== null && cityBought < 100, 'Buy 100 city items', `${number(cityBought)} / 100 bought since daily reset. Once the shared cap reaches 100, every city-item reminder stops.`, [['City','https://www.torn.com/city.php']]);
    const stocks = Array.isArray(body?.stocks) ? body.stocks : [];
    const catalogRows = Array.isArray(snapshot?.stockCatalog?.stocks) ? snapshot.stockCatalog.stocks : Array.isArray(snapshot?.stockCatalog) ? snapshot.stockCatalog : [];
    const stockCatalog = new Map(catalogRows.map(stock => [Number(stock?.id), stock]));
    const readyStocks = stocks.flatMap(stock => {
      const definition = stockCatalog.get(Number(stock?.id));
      if (stock?.bonus?.available !== true || definition?.bonus?.passive !== false) return [];
      return [{ ...stock, name:definition?.name, acronym:definition?.acronym }];
    });
    add('stockBenefits', readyStocks.length > 0, 'Stock benefit ready', readyStocks.map(stock => stock?.name ? `${stock.name}${stock.acronym ? ` (${stock.acronym})` : ''}` : stock?.acronym || `Stock ${stock?.id}`).join(', '), [['Stocks','https://www.torn.com/page.php?sid=stocks']]);
    const modifiers = ['strength','defense','speed','dexterity'].flatMap(name => Array.isArray(body?.battlestats?.[name]?.modifiers) ? body.battlestats[name].modifiers : []).filter(row => /addiction/i.test(`${row?.effect || ''} ${row?.type || ''}`));
    const addiction = modifiers.length ? Math.max(...modifiers.map(row => Math.abs(Number(row?.value) || 0))) : 0;
    add('playerAddiction', addiction >= 15, 'Player addiction needs attention', `${number(addiction, 1)}% battle-stat penalty.`, [['Travel','https://www.torn.com/travelagency.php']]);
    return rows;
  }

  function updateAlertIndicator(count) {
    const total = Math.max(0, Number(count) || 0);
    const badge = shadow?.querySelector?.('.launcher-alert-count');
    if (!badge) return;
    badge.hidden = total === 0;
    badge.textContent = total > 99 ? '99+' : String(total);
    launcher.classList.toggle('has-alerts', total > 0);
    launcher.setAttribute('aria-label', total > 0 ? `Open SLINK dashboard, ${total} active alert${total === 1 ? '' : 's'}` : 'Open SLINK dashboard');
  }

  function showSystemAlert(alert) {
    const title = `SLINK Efficiency: ${alert.title}`;
    const text = String(alert.detail || 'Open Torn PDA to review this alert.');
    try {
      if (typeof GM_API.notify === 'function') {
        GM_API.notify({ title, text, tag:`slink-efficiency-${alert.id}`, timeout:12_000 });
        return;
      }
    } catch {}
    try {
      if (typeof global.Notification === 'function' && global.Notification.permission === 'granted') new global.Notification(title, { body:text, tag:`slink-efficiency-${alert.id}` });
    } catch {}
  }

  function reconcileAlertNotifications(snapshot) {
    const active = alertRows(snapshot);
    const currentIds = active.map(alert => alert.id);
    const prior = dataState.caches.alertNotificationIds;
    if (Array.isArray(prior)) {
      const priorIds = new Set(prior.map(String));
      active.filter(alert => !priorIds.has(alert.id)).forEach(showSystemAlert);
    }
    dataState.caches.alertNotificationIds = currentIds;
    updateAlertIndicator(active.length);
  }

  function renderAlerts() {
    const root = moduleRoot('alerts');
    if (!root) return;
    if (!hasScope('slink.adhd.alerts')) { updateAlertIndicator(0); root.innerHTML = lockedModule('slink.adhd.alerts', 'SLINK Efficiency'); return; }
    const current = moduleState.alerts;
    if (current.busy && !current.data) { updateAlertIndicator(0); root.innerHTML = moduleMessage('Loading Torn API timers…'); return; }
    if (current.error && !current.data) { updateAlertIndicator(0); root.innerHTML = moduleMessage(current.error, 'error'); return; }
    const alerts = alertRows(current.data);
    updateAlertIndicator(alerts.length);
    root.innerHTML = `<div class="grid"><article class="card full"><div class="card-head"><div><h2>SLINK Efficiency</h2><span class="muted">Direct Torn API timers · no Worker polling</span></div><span class="badge ${alerts.length ? 'warn' : 'ready'}">${alerts.length} active</span></div>
      <div class="module-toolbar"><span>Updated ${relativeTime(current.data?.at)} · checks every 5m while Torn PDA keeps this page alive</span></div>${current.error ? moduleMessage(current.error, 'error') : ''}
      <div class="alert-list">${alerts.length ? alerts.map(alert => `<article class="alert"><div><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.detail)}</span></div><div class="target-actions">${alert.links.map(([label, href]) => actionLink(label, href)).join('')}<button type="button" data-action="snooze-alert" data-alert-id="${escapeHtml(alert.id)}" data-minutes="5">Snooze 5m</button><button type="button" data-action="snooze-alert" data-alert-id="${escapeHtml(alert.id)}" data-minutes="60">Snooze 1h</button></div></article>`).join('') : moduleMessage('Nothing needs your attention right now.')}</div>
    </article></div>`;
  }

  async function refreshAlerts(force = false) {
    const current = moduleState.alerts;
    const cached = dataState.caches.alerts;
    if (!force && cached?.at && Date.now() - cached.at < 5 * 60_000) { current.lastAttemptAt = Number(cached.at) || Date.now(); current.data = cached; renderAlerts(); return; }
    current.lastAttemptAt = Date.now();
    current.busy = true; current.error = ''; renderAlerts();
    try {
      await ensurePermissionSession(false);
      if (!hasScope('slink.adhd.alerts')) throw new Error('Your SLINK account does not have slink.adhd.alerts permission.');
      const selections = 'bars,cooldowns,travel,education,organizedcrime,refills,missions,casino,profile,races,enlistedcars,stocks,battlestats';
      const reset = Math.floor(Date.now() / 86_400_000) * 86_400_000;
      const [body, cityCurrent, atReset] = await Promise.all([
        tornJson(`/v2/user?selections=${selections}`, 'SLINK PDA efficiency alerts'),
        tornJson('/v2/user/personalstats?stat=cityitemsbought', 'SLINK PDA city item total'),
        tornJson(`/v2/user/personalstats?stat=cityitemsbought&timestamp=${Math.floor(reset / 1000)}`, 'SLINK PDA city item baseline')
      ]);
      const currentBought = personalStat(cityCurrent, 'cityitemsbought');
      const resetBought = personalStat(atReset, 'cityitemsbought');
      let stockCatalog = dataState.caches.stockCatalog?.data || null;
      if (!dataState.caches.stockCatalog?.at || Date.now() - dataState.caches.stockCatalog.at >= 7 * 86_400_000) {
        stockCatalog = await tornJson('/v2/torn/stocks', 'SLINK PDA stock names');
        dataState.caches.stockCatalog = { at:Date.now(), data:stockCatalog };
      }
      current.data = dataState.caches.alerts = { at:Date.now(), body, stockCatalog, cityBought:currentBought === null || resetBought === null ? null : Math.max(0, currentBought - resetBought) };
      reconcileAlertNotifications(current.data);
      writeDataState();
    } catch (error) { current.error = errorMessage(error); }
    finally { current.busy = false; renderAlerts(); }
  }

  function cleanAwardText(value) {
    return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  function awardFamily(award) {
    return `${award.kind}|${award?.type?.id ?? award?.type?.title ?? ''}|${cleanAwardText(award?.description).toLowerCase().replace(/\$?\d[\d,]*(?:\.\d+)?/g, '#')}`;
  }

  function awardTarget(award) {
    const match = cleanAwardText(award?.description).match(/\$?\s*(\d[\d,]*(?:\.\d+)?)/);
    return match ? Number(match[1].replace(/[$,\s]/g, '')) : Number.POSITIVE_INFINITY;
  }

  function meritGoals(data) {
    if (!data) return [];
    const completedMedals = new Set((data.player?.medals || []).map(row => Number(row?.id ?? row)));
    const completedHonors = new Set((data.player?.honors || []).map(row => Number(row?.id ?? row)));
    const catalog = [
      ...(Array.isArray(data.catalog?.medals) ? data.catalog.medals : []).map(row => ({ ...row, kind:'medal' })),
      ...(Array.isArray(data.catalog?.honors) ? data.catalog.honors : []).map(row => ({ ...row, kind:'honor' }))
    ].filter(row => Number(row?.id) > 0 && row?.name)
      .filter(row => row.kind === 'medal' ? !completedMedals.has(Number(row.id)) : !completedHonors.has(Number(row.id)));
    const pinned = new Set(dataState.settings.merits.pinned || []);
    return catalog.map(award => ({ ...award, key:`${award.kind}:${award.id}`, pinned:pinned.has(`${award.kind}:${award.id}`) }))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned)
        || String(a?.type?.title || '').localeCompare(String(b?.type?.title || ''))
        || awardTarget(a) - awardTarget(b)
        || String(a.name).localeCompare(String(b.name)));
  }

  function renderMerits() {
    const root = moduleRoot('merits');
    if (!root) return;
    if (!hasScope('slink.adhd.alerts')) { root.innerHTML = lockedModule('slink.adhd.alerts', 'Merit tracking'); return; }
    const current = moduleState.merits;
    if (current.busy && !current.data) { root.innerHTML = moduleMessage('Loading award catalog and progress…'); return; }
    if (current.error && !current.data) { root.innerHTML = moduleMessage(current.error, 'error'); return; }
    const allGoals = meritGoals(current.data?.data);
    const filter = /^(?:all|medal|honor)$/.test(String(dataState.settings.merits.filter)) ? String(dataState.settings.merits.filter) : 'all';
    const goals = filter === 'all' ? allGoals : allGoals.filter(award => award.kind === filter);
    const pageSize = Math.max(10, Math.min(50, Number(dataState.settings.merits.pageSize) || 20));
    const totalPages = Math.max(1, Math.ceil(goals.length / pageSize));
    const page = Math.max(1, Math.min(totalPages, Number(dataState.settings.merits.page) || 1));
    dataState.settings.merits.page = page;
    const visibleGoals = goals.slice((page - 1) * pageSize, page * pageSize);
    root.innerHTML = `<div class="grid"><article class="card full"><div class="card-head"><div><h2>Merit farm</h2><span class="muted">Every incomplete medal and honor returned by Torn, with pages instead of a hidden cutoff.</span></div><span class="badge ready">${(dataState.settings.merits.pinned || []).length} / 3 pinned</span></div>
      <div class="module-toolbar"><span>Updated ${relativeTime(current.data?.at)} · ${number(goals.length)} incomplete · page ${page} / ${totalPages}</span><label>Show <select data-field="merit-filter"><option value="all" ${filter === 'all' ? 'selected' : ''}>All</option><option value="medal" ${filter === 'medal' ? 'selected' : ''}>Medals</option><option value="honor" ${filter === 'honor' ? 'selected' : ''}>Honors</option></select></label><label>Refresh <select data-field="merit-refresh"><option value="15" ${Number(dataState.settings.merits.refreshMinutes) === 15 ? 'selected' : ''}>15m</option><option value="30" ${Number(dataState.settings.merits.refreshMinutes) === 30 ? 'selected' : ''}>30m</option><option value="60" ${Number(dataState.settings.merits.refreshMinutes) === 60 ? 'selected' : ''}>1h</option></select></label></div>${current.error ? moduleMessage(current.error, 'error') : ''}
      <div class="merit-list">${visibleGoals.length ? visibleGoals.map(award => `<article class="merit merit-row"><div class="award-emblem ${escapeHtml(award.kind)}" aria-hidden="true">${award.kind === 'medal' ? '★' : 'H'}</div><div class="merit-copy"><strong>${escapeHtml(award.name)}</strong><small>${escapeHtml(award?.type?.title || (award.kind === 'medal' ? 'Medal' : 'Honor'))}</small><span>${escapeHtml(cleanAwardText(award.description) || `${award.kind} ${award.id}`)}</span></div><button type="button" data-action="pin-merit" data-merit-key="${escapeHtml(award.key)}">${award.pinned ? 'Unpin' : 'Pin'}</button></article>`).join('') : moduleMessage('No incomplete awards match this filter.')}</div>
      <nav class="pagination" aria-label="Merit pages"><button type="button" data-action="merit-page" data-merit-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${page} of ${totalPages}</span><button type="button" data-action="merit-page" data-merit-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next</button></nav>
    </article></div>`;
  }

  async function refreshMerits(force = false) {
    const current = moduleState.merits;
    const cached = dataState.caches.merits;
    const ttl = Math.max(5, Number(dataState.settings.merits.refreshMinutes) || 15) * 60_000;
    if (!force && cached?.at && Date.now() - cached.at < ttl) { current.data = cached; renderMerits(); return; }
    current.busy = true; current.error = ''; renderMerits();
    try {
      await ensurePermissionSession(false);
      if (!hasScope('slink.adhd.alerts')) throw new Error('Your SLINK account does not have slink.adhd.alerts permission.');
      const [player, personalStats, catalog] = await Promise.all([
        tornJson('/v2/user?selections=profile,faction,medals,honors,merits', 'SLINK PDA Merit farm'),
        tornJson('/v2/user/personalstats?cat=all', 'SLINK PDA Merit progress'),
        tornJson('/v2/torn?selections=medals,honors', 'SLINK PDA award catalog')
      ]);
      current.data = dataState.caches.merits = { at:Date.now(), data:{ player, personalStats, catalog } };
      writeDataState();
    } catch (error) { current.error = errorMessage(error); }
    finally { current.busy = false; renderMerits(); }
  }

  function activeModuleName() {
    if (state.page === 'combat') return state.combatTab;
    if (state.page === 'efficiency') return state.efficiencyTab;
    return 'access';
  }

  async function loadActiveModule(force = false) {
    if (!dashboardOpen || document.hidden) return;
    const name = activeModuleName();
    if (name === 'access') { renderAccess(); if (!dataState.terms?.fetchedAt) await loadTerms(false); return; }
    const loaders = { leveling:refreshLeveling, war:refreshWar, stats:refreshStats, alerts:refreshAlerts, merits:refreshMerits };
    if (loaders[name] && !moduleState[name].busy) await loaders[name](force);
  }

  function renderAllModules() {
    renderAccess(); renderLeveling(); renderWar(); renderStats(); renderAlerts(); renderMerits(); applyPermissionGates();
  }

  function startScheduler() {
    if (schedulerTimer) return;
    schedulerTimer = global.setInterval(() => {
      const canRefreshAlerts = Boolean(currentApiKey() && hasGrantedScope('slink.adhd.alerts') && (validSession('permission') || termsAccepted('permission')));
      if (canRefreshAlerts && !moduleState.alerts.busy && Date.now() - moduleState.alerts.lastAttemptAt >= 5 * 60_000) void refreshAlerts(false);
      if (dashboardOpen && !document.hidden) void loadActiveModule(false);
    }, 30_000);
  }
  let host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      --s-bg:#0b1118;--s-panel:#121b25;--s-card:#17222e;--s-control:#223140;
      --s-border:rgba(132,199,255,.43);--s-soft:rgba(255,255,255,.11);
      --s-text:#edf7ff;--s-muted:#9fb2c4;--s-accent:#3b8cca;--s-alt:#75c1ff;
      --s-ready:#91e2a8;--s-warning:#ffd174;--s-error:#ff9c9c;
      --s-shadow:rgba(0,0,0,.72);--s-page:radial-gradient(circle at 50% -20%,#203950 0,#0b1118 48%,#070b10 100%);
      all:initial;color-scheme:dark;font-family:Arial,sans-serif;
    }
    :host([data-theme="slinky-pursuit"]){--s-bg:#03070c;--s-panel:#080e16;--s-card:#0e1621;--s-control:#172334;--s-border:rgba(232,239,246,.68);--s-text:#f7fbff;--s-muted:#adbac8;--s-accent:#167fe8;--s-alt:#ef3333;--s-ready:#7dd8ff;--s-warning:#ffca57;--s-page:radial-gradient(circle at 4% 0,rgba(220,25,25,.34),transparent 34%),radial-gradient(circle at 96% 0,rgba(20,115,255,.36),transparent 36%),#02050a}
    :host([data-theme="slinky-underglow"]){--s-bg:#020303;--s-panel:#070909;--s-card:#0d1010;--s-control:#161a19;--s-border:rgba(211,181,255,.69);--s-text:#faf7fc;--s-muted:#b9b0c0;--s-accent:#9f43ed;--s-alt:#74ef42;--s-ready:#9cff74;--s-warning:#dcff61;--s-page:radial-gradient(circle at 8% 100%,rgba(82,255,28,.25),transparent 38%),radial-gradient(circle at 92% 0,rgba(171,51,255,.31),transparent 42%),#010202}
    *{box-sizing:border-box}
    button,select{font:inherit}
    button{min-height:44px;border:1px solid var(--s-border);border-radius:9px;background:var(--s-control);color:var(--s-text);cursor:pointer;touch-action:manipulation}
    button:active{filter:brightness(1.25);transform:translateY(1px)}
    .launcher[hidden]{display:none}.launcher{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483647;display:grid;width:58px;height:58px;min-height:58px;padding:0;place-items:center;border:1px solid var(--s-border);border-radius:50%;background:linear-gradient(145deg,var(--s-accent),var(--s-bg));box-shadow:0 8px 25px var(--s-shadow),-3px 0 13px color-mix(in srgb,var(--s-alt) 45%,transparent),3px 0 13px color-mix(in srgb,var(--s-accent) 55%,transparent);cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none}
    .launcher[data-dragging="true"]{cursor:grabbing;transform:scale(1.06)}
    .launcher.has-alerts{border-color:var(--s-error);box-shadow:0 8px 25px var(--s-shadow),0 0 18px color-mix(in srgb,var(--s-error) 80%,transparent);animation:slink-alert-pulse 1.35s ease-in-out infinite alternate}@keyframes slink-alert-pulse{to{filter:brightness(1.28)}}
    .coil{position:relative;width:31px;height:27px;pointer-events:none}.coil i{position:absolute;left:3px;width:25px;height:10px;border:2px solid #edf4f7;border-radius:50%;filter:drop-shadow(0 0 3px var(--s-alt))}.coil i:nth-child(1){top:0}.coil i:nth-child(2){top:6px}.coil i:nth-child(3){top:12px}.coil i:nth-child(4){top:18px}
    .launcher-label{position:absolute;right:52px;padding:5px 8px;border:1px solid var(--s-soft);border-radius:7px;background:var(--s-panel);color:var(--s-text);font:bold 10px/1 Arial,sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transform:translateX(5px);transition:.16s}.launcher:focus-visible .launcher-label,.launcher:hover .launcher-label{opacity:1;transform:none}
    .launcher-alert-count{position:absolute;top:-5px;right:-5px;display:grid;min-width:23px;height:23px;padding:0 5px;place-items:center;border:2px solid var(--s-bg);border-radius:999px;background:var(--s-error);color:#170404;font:bold 10px/1 Arial,sans-serif;pointer-events:none}.launcher-alert-count[hidden]{display:none}
    .overlay[hidden]{display:none}.overlay{position:fixed;inset:0;z-index:2147483646;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;background:var(--s-page);color:var(--s-text);font:13px/1.42 Arial,sans-serif;overscroll-behavior:contain}
    .topbar{display:flex;align-items:center;gap:10px;min-height:64px;padding:max(9px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 9px max(14px,env(safe-area-inset-left));border-bottom:1px solid var(--s-border);background:color-mix(in srgb,var(--s-bg) 94%,transparent);box-shadow:0 7px 22px var(--s-shadow);touch-action:pan-x}
    .brand-mark{display:grid;width:39px;height:39px;flex:0 0 auto;place-items:center;border-radius:10px;background:linear-gradient(145deg,var(--s-accent),var(--s-bg));box-shadow:inset 0 0 0 1px var(--s-border),0 0 13px color-mix(in srgb,var(--s-alt) 30%,transparent);font-weight:900}
    .brand{min-width:0;flex:1}.brand strong,.brand span{display:block}.brand strong{font-size:15px}.brand span{overflow:hidden;color:var(--s-muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
    .prototype{padding:4px 7px;border:1px solid var(--s-warning);border-radius:999px;color:var(--s-warning);font-size:9px;font-weight:700;white-space:nowrap}
    .close{display:flex;align-items:center;justify-content:center;gap:5px;min-width:46px;padding:0 12px;font-size:14px}.close>span:first-child{font-size:22px}.close-label{font-weight:700}
    .primary-nav{display:flex;gap:7px;padding:8px max(14px,env(safe-area-inset-right)) 8px max(14px,env(safe-area-inset-left));border-bottom:1px solid var(--s-soft);background:color-mix(in srgb,var(--s-panel) 93%,transparent)}
    .primary-nav button{min-width:105px;padding:7px 17px;color:var(--s-muted);font-weight:700}.primary-nav button[aria-selected="true"]{border-color:var(--s-alt);background:linear-gradient(135deg,var(--s-accent),var(--s-control));color:var(--s-text);box-shadow:0 0 12px color-mix(in srgb,var(--s-alt) 22%,transparent)}
    .scroll{min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:14px max(14px,calc((100vw - 1240px)/2)) max(24px,env(safe-area-inset-bottom))}
    .page[hidden],.subpage[hidden]{display:none}
    .page-head{display:flex;align-items:start;gap:12px;margin:2px 0 12px}.page-head>div{min-width:0;flex:1}.page-head h1{margin:0;font-size:22px}.page-head p{margin:3px 0 0;color:var(--s-muted)}
    .page-actions{display:flex;gap:7px}.page-actions button{padding:6px 12px}
    .subnav{display:flex;gap:6px;margin-bottom:11px;overflow:auto;scrollbar-width:none}.subnav::-webkit-scrollbar{display:none}.subnav button{min-width:92px;padding:6px 12px;color:var(--s-muted);white-space:nowrap}.subnav button[aria-selected="true"]{background:var(--s-accent);color:var(--s-text)}
    .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:11px}.card{grid-column:span 4;min-width:0;padding:13px;border:1px solid var(--s-border);border-radius:11px;background:color-mix(in srgb,var(--s-panel) 96%,transparent);box-shadow:0 8px 20px var(--s-shadow)}.card.wide{grid-column:span 8}.card.full{grid-column:1/-1}.card h2,.card h3{margin:0}.card h2{font-size:15px}.card h3{font-size:12px}.muted{color:var(--s-muted)}
    .card-head{display:flex;align-items:start;gap:8px;margin-bottom:10px}.card-head>div{min-width:0;flex:1}.badge{display:inline-block;padding:3px 7px;border:1px solid var(--s-soft);border-radius:999px;color:var(--s-muted);font-size:9px;white-space:nowrap}.badge.ready{border-color:var(--s-ready);color:var(--s-ready)}.badge.warn{border-color:var(--s-warning);color:var(--s-warning)}
    .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.stat{padding:9px 5px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg);text-align:center}.stat strong,.stat span{display:block}.stat strong{font-size:17px}.stat span{color:var(--s-muted);font-size:9px}
    .status{margin:10px 0 0;padding:8px 9px;border-left:3px solid var(--s-accent);border-radius:5px;background:var(--s-bg);color:var(--s-muted)}
    .target-list,.alert-list,.merit-list{display:grid;gap:7px}.target,.alert,.merit{display:grid;gap:7px;padding:10px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg)}.target{grid-template-columns:minmax(0,1fr) auto;align-items:center}.target strong,.target small{display:block}.target small{color:var(--s-muted)}.target button{padding:5px 12px}.alert{border-left:4px solid var(--s-ready)}.alert.warn{border-left-color:var(--s-warning)}.alert strong,.alert span{display:block}.alert span{color:var(--s-muted)}
    .two-column{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.mini{padding:9px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg)}.mini span,.mini strong{display:block}.mini span{color:var(--s-muted);font-size:9px}
    .meter{height:6px;overflow:hidden;border-radius:99px;background:#05080b}.meter i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--s-accent),var(--s-alt))}
    .later{color:var(--s-muted);font-size:10px}.theme-row{display:flex;gap:7px;flex-wrap:wrap}.theme-row button{padding:7px 11px}.theme-row button[aria-selected="true"]{outline:2px solid var(--s-alt);outline-offset:1px}
    .recovery{display:grid;gap:8px}.recovery code{padding:3px 5px;border-radius:4px;background:var(--s-bg);color:var(--s-alt)}
    .module-message{padding:11px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg);color:var(--s-muted)}.module-message.error{border-color:var(--s-error);color:var(--s-error)}.module-message.locked{border-color:var(--s-warning);color:var(--s-warning)}
    .module-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-bottom:10px}.module-toolbar>span{min-width:0;flex:1;color:var(--s-muted)}.module-toolbar button{padding:6px 12px}
    .access-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.access-form label{display:grid;gap:4px;color:var(--s-muted)}.access-form .wide{grid-column:1/-1}.access-form input,.access-form select{width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--s-border);border-radius:8px;background:var(--s-bg);color:var(--s-text)}.access-form input[type="checkbox"]{width:20px;min-height:20px;margin:1px 0}.check-row{display:flex!important;grid-template-columns:none!important;align-items:flex-start;gap:8px!important;color:var(--s-text)!important}.access-actions{display:flex;flex-wrap:wrap;gap:7px}.access-actions button{padding:7px 12px}.danger{border-color:var(--s-error);color:var(--s-error)}
    .terms-list,.scope-list{display:flex;flex-wrap:wrap;gap:6px}.terms-list a,.scope-list span,.action-link{display:inline-flex;align-items:center;min-height:32px;padding:5px 8px;border:1px solid var(--s-soft);border-radius:7px;background:var(--s-bg);color:var(--s-alt);text-decoration:none}.scope-list span{color:var(--s-text)}.scope-details summary{min-height:40px;padding:9px;border:1px solid var(--s-soft);border-radius:7px;background:var(--s-bg);cursor:pointer}.scope-details[open] summary{margin-bottom:8px}
    .target-actions{display:flex;flex-wrap:wrap;gap:6px}.target-actions a,.alert a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:5px 10px;border:1px solid var(--s-border);border-radius:7px;background:var(--s-control);color:var(--s-text);text-decoration:none}.target-actions button,.alert button{padding:5px 10px}
    .target-stack{display:grid;gap:7px}.target-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:10px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg)}.target-card strong,.target-card small{display:block}.target-card small{color:var(--s-muted)}
    .stat-table,.value-list{display:grid;gap:0;margin-top:8px}.stat-row,.value-list>div{display:grid;grid-template-columns:minmax(82px,1fr) minmax(105px,auto) minmax(105px,auto);align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--s-soft)}.stat-row.head{padding-top:0;color:var(--s-muted);font-size:10px}.stat-row strong{text-align:right;white-space:nowrap;font-size:11px}.value-list>div{grid-template-columns:minmax(0,1fr) auto}.value-list strong{white-space:nowrap}.merit strong,.merit span,.merit small{display:block}.merit span,.merit small{color:var(--s-muted)}.merit small{margin:1px 0 4px;color:var(--s-alt);font-size:9px;text-transform:uppercase;letter-spacing:.04em}.merit-row{grid-template-columns:44px minmax(0,1fr) auto;align-items:center}.award-emblem{display:grid!important;width:42px;height:48px;place-items:center;clip-path:polygon(10% 0,90% 0,100% 72%,50% 100%,0 72%);background:linear-gradient(160deg,var(--s-accent),#17202b);color:white!important;font-size:19px;font-weight:900;text-shadow:0 1px 2px #000}.award-emblem.honor{background:linear-gradient(160deg,#6f3e87,#2b1732)}.award-emblem.medal{background:linear-gradient(160deg,#a27820,#36260b)}.merit-copy{min-width:0}.pagination{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:11px}.pagination button{min-width:94px;padding:6px 12px}.pagination button:disabled{opacity:.45;cursor:not-allowed}.pagination span{color:var(--s-muted)}.module-toolbar label{display:flex;align-items:center;gap:5px;color:var(--s-muted)}.module-toolbar select{min-height:38px;padding:5px 8px;border:1px solid var(--s-border);border-radius:7px;background:var(--s-bg);color:var(--s-text)}
    .positive{color:var(--s-ready)}.negative{color:var(--s-error)}.permission-lock{opacity:.6}.subnav button:disabled{cursor:not-allowed;opacity:.5}.busy{animation:slink-pulse 1s ease-in-out infinite alternate}@keyframes slink-pulse{to{filter:brightness(1.35)}}
    .mobile-hint{display:none}
    @media(max-width:900px){.card{grid-column:span 6}.card.wide{grid-column:1/-1}}
    @media(max-width:700px){
      .overlay{grid-template-rows:auto minmax(0,1fr)}.topbar{min-height:58px;padding-top:max(7px,env(safe-area-inset-top));padding-bottom:7px}.brand-mark{width:35px;height:35px}.prototype{display:none}.close{width:48px;min-width:48px;flex-basis:48px;padding:0}.close-label{display:none}
      .primary-nav{position:absolute;right:0;bottom:0;left:0;z-index:4;justify-content:stretch;padding:7px max(8px,env(safe-area-inset-right)) max(7px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));border-top:1px solid var(--s-border);border-bottom:0;box-shadow:0 -7px 20px var(--s-shadow)}.primary-nav button{min-width:0;flex:1;padding:5px 3px;font-size:11px}.primary-nav button::before{display:block;margin-bottom:1px;font-size:18px}.primary-nav button[data-page="combat"]::before{content:"⚔"}.primary-nav button[data-page="efficiency"]::before{content:"⏱"}.primary-nav button[data-page="access"]::before{content:"⚙"}
      .scroll{padding:10px max(9px,env(safe-area-inset-right)) calc(82px + env(safe-area-inset-bottom)) max(9px,env(safe-area-inset-left))}.page-head{align-items:center}.page-head h1{font-size:18px}.page-head p{font-size:10px}.page-actions button{min-height:44px}
      .grid{gap:8px}.card,.card.wide{grid-column:1/-1;padding:11px}.stats{gap:5px}.stat{padding:8px 3px}.stat strong{font-size:15px}.two-column{gap:6px}.access-form{grid-template-columns:1fr}.access-form .wide{grid-column:auto}.target-card{grid-template-columns:1fr}.merit-row{grid-template-columns:40px minmax(0,1fr) auto}.award-emblem{width:38px;height:44px}.mobile-hint{display:block}.launcher{width:54px;height:54px;min-height:54px}.launcher-label{display:none}
    }
    @media(max-width:370px){.brand span{display:none}.page-head p{display:none}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.two-column{grid-template-columns:1fr}.subnav button{min-width:82px}.stat-row{grid-template-columns:minmax(62px,1fr) minmax(86px,auto) minmax(86px,auto);gap:4px}.stat-row strong{font-size:9px}}
    @media(orientation:landscape) and (max-height:520px){.topbar{min-height:50px}.brand-mark{width:32px;height:32px}.scroll{padding-top:8px}.primary-nav{position:absolute;top:50px;right:0;bottom:0;left:auto;width:94px;flex-direction:column;justify-content:flex-start;padding:8px max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) 8px;border-top:0;border-bottom:0;border-left:1px solid var(--s-border);box-shadow:-7px 0 20px var(--s-shadow)}.primary-nav button{width:100%;min-width:0;min-height:54px;flex:0 0 auto}.scroll{padding-right:104px;padding-bottom:max(10px,env(safe-area-inset-bottom))}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
  `;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'launcher';
  launcher.setAttribute('aria-label', 'Open SLINK dashboard');
  launcher.title = 'Tap to open SLINK. Drag to move.';
  launcher.innerHTML = '<span class="coil" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="launcher-alert-count" hidden>0</span><span class="launcher-label">Open SLINK</span>';

  const overlay = document.createElement('section');
  overlay.className = 'overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'SLINK PDA Dashboard');
  overlay.innerHTML = `
    <header class="topbar" data-swipe-close>
      <div class="brand-mark" aria-hidden="true">SL</div>
      <div class="brand"><strong>SLINK Dashboard</strong><span>Shared Live Intelligence NetworK · PDA shell ${BUILD}</span></div>
      <span class="prototype">PDA MODULE BUILD</span>
      <button class="close" type="button" data-action="close" aria-label="Minimize dashboard" title="Minimize SLINK to the movable bubble"><span aria-hidden="true">−</span><span class="close-label">Minimize</span></button>
    </header>
    <nav class="primary-nav" aria-label="Dashboard sections">
      <button type="button" data-page="combat">Combat</button>
      <button type="button" data-page="efficiency">Efficiency</button>
      <button type="button" data-page="access">Access</button>
    </nav>
    <main class="scroll">
      <section class="page" data-page-panel="combat">
        <div class="page-head"><div><h1>Combat</h1><p>Leveling, War, and your private daily stats in one mobile workspace.</p></div><div class="page-actions"><button type="button" data-action="refresh-active">Refresh</button></div></div>
        <nav class="subnav" aria-label="Combat tools"><button type="button" data-combat-tab="leveling">Leveling</button><button type="button" data-combat-tab="war">War</button><button type="button" data-combat-tab="stats">Stats</button></nav>
        <div class="subpage" data-combat-panel="leveling"><div data-module-root="leveling"></div></div>
        <div class="subpage" data-combat-panel="war" hidden><div data-module-root="war"></div></div>
        <div class="subpage" data-combat-panel="stats" hidden><div data-module-root="stats"></div></div>
      </section>
      <section class="page" data-page-panel="efficiency" hidden>
        <div class="page-head"><div><h1>Efficiency</h1><p>API-backed reminders and Merit farms, locally coordinated inside PDA.</p></div><div class="page-actions"><button type="button" data-action="refresh-active">Refresh</button></div></div>
        <nav class="subnav" aria-label="Efficiency tools"><button type="button" data-efficiency-tab="alerts">Alerts</button><button type="button" data-efficiency-tab="merits">Merits</button></nav>
        <div class="subpage" data-efficiency-panel="alerts"><div data-module-root="alerts"></div></div>
        <div class="subpage" data-efficiency-panel="merits" hidden><div data-module-root="merits"></div></div>
      </section>
      <section class="page" data-page-panel="access" hidden>
        <div class="page-head"><div><h1>Access &amp; layout</h1><p>One PDA key, one local session manager, and one shared Torn API limiter.</p></div></div>
        <div data-module-root="access"></div>
        <div class="grid"><article class="card wide"><div class="card-head"><div><h2>Mobile recovery</h2><span class="muted">The dashboard can always get out of your way.</span></div><span class="badge ready">Protected</span></div><div class="recovery"><span>Tap <strong>−</strong> in the top bar to minimize. The movable bubble appears only after the dashboard closes.</span><span>Drag the bubble anywhere. Its position is clamped back onscreen after rotation and resizing.</span><span>Press <code>Esc</code> or <code>Alt + Shift + S</code> on a keyboard.</span><span>Swipe downward on the dashboard header to minimize on touch devices.</span><button type="button" data-action="reset-layout">Reset launcher position and layout</button></div></article><article class="card"><div class="card-head"><div><h2>Themes</h2><span class="muted">Pursuit and Underglow require their SLINK theme permissions.</span></div></div><div class="theme-row"><button type="button" data-theme-choice="slink-dark">Dark</button><button type="button" data-theme-choice="slinky-pursuit">Pursuit</button><button type="button" data-theme-choice="slinky-underglow">Underglow</button></div></article><article class="card full mobile-hint"><strong>Phone note:</strong> The bottom navigation stays reachable above the device safe area. In landscape it moves to the right edge to preserve vertical room.</article></div>
      </section>
    </main>`;

  shadow.append(style, overlay, launcher);
  document.documentElement.appendChild(host);

  function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), Math.max(min, max));
  }

  function clampLauncher(persist = false) {
    if (!state.bubblePosition) {
      delete launcher.dataset.positioned;
      launcher.style.removeProperty('left');
      launcher.style.removeProperty('top');
      launcher.style.removeProperty('right');
      launcher.style.removeProperty('bottom');
      return;
    }
    const width = launcher.offsetWidth || 58;
    const height = launcher.offsetHeight || 58;
    const left = clamp(state.bubblePosition.left, 4, global.innerWidth - width - 4);
    const top = clamp(state.bubblePosition.top, 4, global.innerHeight - height - 4);
    launcher.style.left = `${left}px`;
    launcher.style.top = `${top}px`;
    launcher.style.right = 'auto';
    launcher.style.bottom = 'auto';
    launcher.dataset.positioned = 'true';
    state.bubblePosition = { left: Math.round(left), top: Math.round(top) };
    if (persist) writeState();
  }

  function selectPage(page, persist = true) {
    if (!['combat', 'efficiency', 'access'].includes(page)) page = 'combat';
    state.page = page;
    shadow.querySelectorAll('[data-page-panel]').forEach(panel => { panel.hidden = panel.dataset.pagePanel !== page; });
    shadow.querySelectorAll('[data-page]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.page === page)));
    if (persist) writeState();
    shadow.querySelector('.scroll').scrollTop = 0;
    if (dashboardOpen) void loadActiveModule(false);
  }

  function selectSubpage(group, tab, persist = true) {
    const allowed = group === 'combat' ? ['leveling', 'war', 'stats'] : ['alerts', 'merits'];
    if (!allowed.includes(tab)) tab = allowed[0];
    state[group === 'combat' ? 'combatTab' : 'efficiencyTab'] = tab;
    shadow.querySelectorAll(`[data-${group}-panel]`).forEach(panel => { panel.hidden = panel.dataset[`${group}Panel`] !== tab; });
    shadow.querySelectorAll(`[data-${group}-tab]`).forEach(button => button.setAttribute('aria-selected', String(button.dataset[`${group}Tab`] === tab)));
    if (persist) writeState();
    if (dashboardOpen) void loadActiveModule(false);
  }

  function setTheme(theme, persist = true) {
    if (!['slink-dark', 'slinky-pursuit', 'slinky-underglow'].includes(theme)) theme = 'slink-dark';
    const required = { 'slinky-pursuit':'slink.theme.pursuit', 'slinky-underglow':'slink.theme.underglow' }[theme];
    if (required && !hasThemeScope(required)) theme = 'slink-dark';
    state.theme = theme;
    host.dataset.theme = theme;
    shadow.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.themeChoice === theme)));
    if (persist) writeState();
  }

  function lockTornScroll() {
    if (!document.documentElement.dataset[ROOT_OVERFLOW_KEY]) document.documentElement.dataset[ROOT_OVERFLOW_KEY] = document.documentElement.style.overflow || ' ';
    document.documentElement.style.overflow = 'hidden';
  }

  function unlockTornScroll() {
    const prior = document.documentElement.dataset[ROOT_OVERFLOW_KEY];
    if (prior !== undefined) {
      document.documentElement.style.overflow = prior === ' ' ? '' : prior;
      delete document.documentElement.dataset[ROOT_OVERFLOW_KEY];
    }
  }

  function openDashboard() {
    dashboardOpen = true;
    overlay.hidden = false;
    launcher.hidden = true;
    lockTornScroll();
    selectPage(state.page, false);
    renderAllModules();
    void loadActiveModule(false);
    global.setTimeout(() => shadow.querySelector('[data-action="close"]')?.focus({ preventScroll: true }), 0);
  }

  function closeDashboard() {
    dashboardOpen = false;
    overlay.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute('aria-label', 'Open SLINK dashboard');
    launcher.querySelector('.launcher-label').textContent = 'Open SLINK';
    unlockTornScroll();
    clampLauncher(true);
    launcher.focus({ preventScroll: true });
  }

  function toggleDashboard() {
    if (dashboardOpen) closeDashboard(); else openDashboard();
  }

  function resetLayout() {
    state.page = defaults.page;
    state.combatTab = defaults.combatTab;
    state.efficiencyTab = defaults.efficiencyTab;
    state.theme = defaults.theme;
    state.bubblePosition = null;
    setTheme(state.theme, false);
    selectPage(state.page, false);
    selectSubpage('combat', state.combatTab, false);
    selectSubpage('efficiency', state.efficiencyTab, false);
    clampLauncher(false);
    writeState();
  }

  launcher.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const box = launcher.getBoundingClientRect();
    drag = { id:event.pointerId, x:event.clientX, y:event.clientY, left:box.left, top:box.top, moved:false };
    launcher.dataset.dragging = 'true';
    launcher.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  launcher.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    state.bubblePosition = { left:drag.left + dx, top:drag.top + dy };
    clampLauncher(false);
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    delete launcher.dataset.dragging;
    clampLauncher(true);
    if (!moved) toggleDashboard();
  }
  launcher.addEventListener('pointerup', finishDrag);
  launcher.addEventListener('pointercancel', event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    delete launcher.dataset.dragging;
    clampLauncher(true);
  });

  overlay.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') closeDashboard();
    if (action === 'reset-layout') resetLayout();
    if (action === 'refresh-active') void loadActiveModule(true);
    if (action === 'load-terms') void loadTerms(true);
    if (action === 'save-access') void saveAccess();
    if (action === 'clear-access') {
      dataState.apiKey = '';
      dataState.ffKey = '';
      dataState.usePdaApiKey = PDA_API_KEY_AVAILABLE;
      dataState.usePdaFfKey = false;
      dataState.accepted = {};
      clearSessions();
      writeDataState();
      moduleState.access.error = '';
      setTheme('slink-dark');
      renderAllModules();
    }
    if (action === 'snooze-alert') {
      const button = event.target.closest('[data-alert-id]');
      const id = String(button?.dataset.alertId || '');
      const minutes = Math.max(1, Number(button?.dataset.minutes) || 5);
      if (id) {
        dataState.settings.alerts.snoozedUntil[id] = Date.now() + minutes * 60_000;
        writeDataState();
        renderAlerts();
      }
    }
    if (action === 'pin-merit') {
      const key = String(event.target.closest('[data-merit-key]')?.dataset.meritKey || '');
      const pinned = new Set(dataState.settings.merits.pinned || []);
      if (pinned.has(key)) pinned.delete(key);
      else if (pinned.size < 3) pinned.add(key);
      dataState.settings.merits.pinned = [...pinned];
      writeDataState();
      renderMerits();
    }
    if (action === 'merit-page') {
      dataState.settings.merits.page = Math.max(1, Number(event.target.closest('[data-merit-page]')?.dataset.meritPage) || 1);
      writeDataState();
      renderMerits();
      shadow.querySelector('.scroll')?.scrollTo?.({ top:0, behavior:'smooth' });
    }
    const page = event.target.closest('[data-page]')?.dataset.page;
    if (page) selectPage(page);
    const combatTab = event.target.closest('[data-combat-tab]')?.dataset.combatTab;
    if (combatTab) selectSubpage('combat', combatTab);
    const efficiencyTab = event.target.closest('[data-efficiency-tab]')?.dataset.efficiencyTab;
    if (efficiencyTab) selectSubpage('efficiency', efficiencyTab);
    const theme = event.target.closest('[data-theme-choice]')?.dataset.themeChoice;
    if (theme) {
      const required = { 'slinky-pursuit':'slink.theme.pursuit', 'slinky-underglow':'slink.theme.underglow' }[theme];
      if (required && !hasThemeScope(required)) {
        moduleState.access.error = `This theme requires ${required}.`;
        renderAccess();
      } else setTheme(theme);
    }
  });

  overlay.addEventListener('change', event => {
    if (event.target.matches('[data-field="merit-refresh"]')) {
      dataState.settings.merits.refreshMinutes = Math.max(5, Number(event.target.value) || 15);
      writeDataState();
      renderMerits();
    }
    if (event.target.matches('[data-field="merit-filter"]')) {
      dataState.settings.merits.filter = String(event.target.value || 'all');
      dataState.settings.merits.page = 1;
      writeDataState();
      renderMerits();
    }
  });

  const swipeHeader = shadow.querySelector('[data-swipe-close]');
  swipeHeader.addEventListener('pointerdown', event => { if (!event.target.closest('button')) swipe = { id:event.pointerId, x:event.clientX, y:event.clientY }; });
  swipeHeader.addEventListener('pointerup', event => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = Math.abs(event.clientX - swipe.x);
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (dy > 70 && dy > dx * 1.35) closeDashboard();
  });
  swipeHeader.addEventListener('pointercancel', () => { swipe = null; });

  global.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dashboardOpen) closeDashboard();
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      toggleDashboard();
    }
  });
  global.addEventListener('resize', () => clampLauncher(true));
  global.addEventListener('orientationchange', () => global.setTimeout(() => clampLauncher(true), 180));
  document.addEventListener('visibilitychange', () => { if (dashboardOpen && !document.hidden) void loadActiveModule(false); });
  global.addEventListener('pagehide', unlockTornScroll, { once:true });

  const guardian = new MutationObserver(() => {
    if (!host.isConnected && document.documentElement) document.documentElement.appendChild(host);
  });
  guardian.observe(document, { childList:true, subtree:true });

  if (typeof GM_API.menu === 'function') {
    GM_API.menu('Open SLINK PDA Dashboard', openDashboard);
    GM_API.menu('Reset SLINK PDA layout', resetLayout);
  }

  setTheme(state.theme, false);
  selectPage(state.page, false);
  selectSubpage('combat', state.combatTab, false);
  selectSubpage('efficiency', state.efficiencyTab, false);
  clampLauncher(false);
  renderAllModules();
  if (moduleState.alerts.data && !Array.isArray(dataState.caches.alertNotificationIds)) {
    reconcileAlertNotifications(moduleState.alerts.data);
    writeDataState();
  }
  startScheduler();
  if (currentApiKey() && hasGrantedScope('slink.adhd.alerts') && (validSession('permission') || termsAccepted('permission'))) global.setTimeout(() => void refreshAlerts(false), 5_000);

  global.SLINK_PDA_DASHBOARD = Object.freeze({
    build:BUILD,
    open:openDashboard,
    close:closeDashboard,
    toggle:toggleDashboard,
    reset:resetLayout,
    isOpen:() => dashboardOpen
  });
})(globalThis);
