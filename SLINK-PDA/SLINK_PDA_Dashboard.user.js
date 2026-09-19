// ==UserScript==
// @name         SLINK PDA Dashboard
// @namespace    Considious [3853023]
// @version      0.4.0
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
// @connect      weav3r.dev
// @connect      slinkyleveling.richard-johnson554.workers.dev
// @connect      slinkcontributionworker.richard-johnson554.workers.dev
// @connect      slinkwarworker.richard-johnson554.workers.dev
// @run-at       document-end
// ==/UserScript==

(function installSlinkPdaDashboard(global) {
  'use strict';

  const BUILD = '0.4.0-war-panel-parity';
  const HOST_ID = 'slink-pda-dashboard-host';
  const STORAGE_KEY = 'slink-pda-dashboard:ui:v1';
  const DATA_STORAGE_KEY = 'slink-pda-dashboard:data:v1';
  const SHARED_API_LEDGER_KEY = 'considious:torn-api-ledger:v1';
  const SHARED_API_LOCK = 'considious-torn-api-limiter-v1';
  const ROOT_OVERFLOW_KEY = 'slinkPdaPreviousOverflow';
  const API_WINDOW_MS = 60_000;
  const API_LIMIT = 60;
  const CLIENT_NAME = 'SLINK PDA Dashboard';
  const CLIENT_VERSION = '0.4.0';
  const WEEK_MS = 7 * 86_400_000;
  const GOOGLE_PLAY_POINTS_URL = 'https://play.google.com/store/points';
  const URLS = Object.freeze({
    permission:'https://slinkcontributionworker.richard-johnson554.workers.dev',
    leveling:'https://slinkyleveling.richard-johnson554.workers.dev',
    war:'https://slinkwarworker.richard-johnson554.workers.dev',
    torn:'https://api.torn.com',
    weaver:'https://weav3r.dev'
  });
  const MARKET_PRIORITIES = Object.freeze({ high:0, normal:1, low:2 });
  const TORN_PRIORITY_LIMITS = Object.freeze({ high:60, normal:50, low:40 });
  const WEAVER_REFRESH_MS = Object.freeze({ high:35_000, normal:70_000, low:140_000 });
  const MARKET_TIERS = Object.freeze([5, 10, 15, 20, 25, 30, 35, 40]);
  const MARKET_SUGGESTION_LIMIT = 10;
  const MUG_RESULT_DEDUPE_MS = 5 * 60_000;
  const ITEM_MARKET_FALLBACK_MS = 30_000;
  const POINTS_MARKET_REFRESH_MS = 30_000;
  const WEAVER_RATE_LIMIT = 80;
  const WEAVER_RATE_WINDOW_MS = 60_000;
  const WEAVER_MIN_REQUEST_SPACING_MS = Math.ceil(WEAVER_RATE_WINDOW_MS / WEAVER_RATE_LIMIT);
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
        war:{
          mode:'war', idleMinutes:5, insideHitCap:0, insideBlockMode:'warn', activeTab:'targets',
          targetMinFF:1, targetMaxFF:3, targetStatus:'all', targetSort:'availability',
          outsideMinFF:1, outsideMaxFF:3, dismissedRetals:{}, lastStatusAt:0, lastAttackAt:0, lastAttackEnded:0,
          armoryMode:'ranked-all', armoryWhitelist:[],
          ...(value.settings?.war || {})
        },
        alerts:{ snoozedUntil:{}, cityDoneDay:null, googlePlayPointsClaimedAt:0, ...(value.settings?.alerts || {}) },
        market:{ enabled:true, quickBuyEnabled:true, lastPriority:'normal', watches:[], dismissals:{}, ...(value.settings?.market || {}) },
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
  let marketObserver = null;
  let marketFormatTimer = null;
  let marketWakeTimer = null;
  let marketQuickBuyLayer = null;
  let marketPositionFrame = null;
  let keyboardFocusTimer = null;
  const marketQuickBuys = new Map();
  const reportedMugNodes = new WeakSet();
  const recentMugResults = new Map();
  const moduleState = {
    access:{ busy:false, error:'' },
    leveling:{ busy:false, error:'', data:dataState.caches.leveling || null },
    war:{ busy:false, error:'', outsideBusy:false, outsideError:'', renderPending:false, data:dataState.caches.war || null },
    stats:{ busy:false, error:'', data:dataState.caches.stats || null },
    alerts:{ busy:false, error:'', data:dataState.caches.alerts || null, lastAttemptAt:0 },
    market:{ busy:false, error:'', data:dataState.caches.market || null, editingUid:'', lastAttemptAt:0, refreshPermissions:true, draft:null, renderPending:false },
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

  async function reserveTornApi(endpoint = 'unknown', options = {}) {
    const limit = Math.max(1, Math.min(API_LIMIT, Number(options.limit) || API_LIMIT));
    const wait = options.wait !== false;
    const priority = ['high', 'normal', 'low'].includes(String(options.priority)) ? String(options.priority) : 'normal';
    return serializeNetwork(async () => {
      while (true) {
        const reservation = await withApiLock(() => {
          const now = Date.now();
          const ledger = readApiLedger(now);
          if (ledger.cooldownUntil > now || ledger.events.length >= limit) return { waitUntil:Math.max(ledger.cooldownUntil, Number(ledger.events[0]?.at || now) + API_WINDOW_MS + 25) };
          ledger.events.push({
            at:now,
            id:`slink-pda:${global.crypto?.randomUUID?.() || `${now}:${Math.random().toString(36).slice(2)}`}`,
            script:'SLINK PDA Dashboard', priority, method:'GET', endpoint:String(endpoint).slice(0, 180), tabId:'pda-dashboard'
          });
          writeApiLedger(ledger);
          return { reservedAt:now };
        });
        if (reservation.reservedAt) return reservation;
        if (!wait) {
          const error = new Error('Waiting for shared Torn API capacity.');
          error.code = 'SLINK_TORN_API_LIMIT';
          error.retryAfterMs = Math.max(250, reservation.waitUntil - Date.now());
          throw error;
        }
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

  const THEME_TOKEN_MAP = Object.freeze({
    '--slink-bg':'--s-bg', '--slink-panel-bg':'--s-panel', '--slink-surface':'--s-panel', '--slink-card':'--s-card',
    '--slink-bg-control':'--s-control', '--slink-control':'--s-control', '--slink-border':'--s-border', '--slink-border-soft':'--s-soft',
    '--slink-text':'--s-text', '--slink-muted':'--s-muted', '--slink-accent':'--s-accent', '--slink-accent-alt':'--s-alt',
    '--slink-ready':'--s-ready', '--slink-warning':'--s-warning', '--slink-error':'--s-error', '--slink-shadow':'--s-shadow', '--slink-page-bg':'--s-page'
  });

  function bundledThemes() {
    return [
      { id:'slink-dark', label:'Dark', description:'The standard free SLINK interface.', scope:null, swatch:['#162331','#2f74ad','#8fc9ff'], tokens:{} },
      { id:'slinky-pursuit', label:'Pursuit', description:'Chrome coils with red and blue pursuit lighting.', scope:'slink.theme.pursuit', swatch:['#05080d','#ee2525','#167ee7'], tokens:{} },
      { id:'slinky-underglow', label:'Underglow', description:'Glossy black with purple and green tuner-style underglow.', scope:'slink.theme.underglow', swatch:['#030405','#a53dff','#7bff45'], tokens:{} }
    ];
  }

  function themeCatalog() {
    const themes = dataState.caches.themeCatalog?.catalog?.themes;
    return Array.isArray(themes) && themes.length ? themes : bundledThemes();
  }

  function validateThemeCatalog(value) {
    if (!value || Number(value.schemaVersion) !== 1 || !Array.isArray(value.themes) || !value.themes.length || value.themes.length > 32) throw new Error('Unsupported SLINK theme catalog.');
    const seen = new Set();
    const themes = value.themes.map(entry => {
      const id = String(entry?.id || ''); const label = String(entry?.label || ''); const description = String(entry?.description || ''); const scope = entry?.scope == null ? null : String(entry.scope);
      if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(id) || seen.has(id) || !label || label.length > 80 || description.length > 180) throw new Error('Theme catalog contains invalid display metadata.');
      if (scope !== null && !/^slink\.theme\.[a-z0-9][a-z0-9-]{0,63}$/.test(scope)) throw new Error(`Theme ${id} has an invalid permission scope.`);
      if (!entry.tokens || typeof entry.tokens !== 'object' || Array.isArray(entry.tokens)) throw new Error(`Theme ${id} has invalid tokens.`);
      const tokens = {};
      for (const [name, raw] of Object.entries(entry.tokens)) {
        if (!Object.hasOwn(THEME_TOKEN_MAP, name)) continue;
        const token = String(raw || '').trim();
        if (!token || token.length > 320 || !/^[a-zA-Z0-9#(),.%+\-\s]+$/.test(token) || /url\s*\(|expression\s*\(/i.test(token)) throw new Error(`Theme ${id} contains a disallowed token.`);
        tokens[name] = token;
      }
      const swatch = Array.isArray(entry.swatch) ? entry.swatch.slice(0, 3).map(String) : [];
      if (swatch.length !== 3 || !swatch.every(color => /^#[0-9a-fA-F]{6}$/.test(color))) throw new Error(`Theme ${id} has invalid swatches.`);
      seen.add(id); return { id, label, description, scope, swatch, tokens };
    });
    if (!themes.some(theme => theme.id === 'slink-dark' && !theme.scope)) throw new Error('Theme catalog is missing the free fallback.');
    return { schemaVersion:1, revision:String(value.revision || ''), updatedAt:String(value.updatedAt || ''), themes };
  }

  async function loadThemeCatalog(force = false) {
    const cached = dataState.caches.themeCatalog;
    if (!force && cached?.catalog && Date.now() - Number(cached.fetchedAt) < 12 * 60 * 60_000) { renderThemeChoices(); return cached.catalog; }
    try {
      const response = await requestJson(`${URLS.war}/api/themes`);
      const catalog = validateThemeCatalog(response?.catalog);
      dataState.caches.themeCatalog = { catalog, fetchedAt:Date.now(), source:String(response?.source || 'worker') }; writeDataState(); renderThemeChoices(); setTheme(state.theme, false); return catalog;
    } catch (error) {
      if (!cached?.catalog) moduleState.access.error = `Theme catalog: ${errorMessage(error)}`;
      renderThemeChoices(); return cached?.catalog || null;
    }
  }

  function renderThemeChoices() {
    const row = shadow?.querySelector?.('.theme-row'); if (!row) return;
    row.innerHTML = themeCatalog().map(theme => {
      const unlocked = !theme.scope || hasThemeScope(theme.scope);
      const colors = Array.isArray(theme.swatch) && theme.swatch.length === 3 ? theme.swatch : ['#111827','#3b82f6','#dbeafe'];
      return `<button type="button" data-theme-choice="${escapeHtml(theme.id)}" title="${escapeHtml(unlocked ? theme.description : `Requires ${theme.scope}`)}" class="${unlocked ? '' : 'permission-lock'}"><i class="theme-swatch" style="--c1:${escapeHtml(colors[0])};--c2:${escapeHtml(colors[1])};--c3:${escapeHtml(colors[2])}"></i>${escapeHtml(theme.label)}${unlocked ? '' : ' 🔒'}</button>`;
    }).join('');
    row.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.themeChoice === state.theme)));
  }

  function marketWatchLimit() {
    const session = validSession('permission');
    if (!session) return 0;
    const scopes = Array.isArray(session.scopes) ? session.scopes.map(String) : [];
    if (scopes.some(scope => scope === '*' || scope === 'admin.*' || scope === 'slink.adhd.*' || scope === 'slink.adhd.marketwatch.*')) return MARKET_TIERS.at(-1);
    return scopes.reduce((maximum, scope) => {
      const tier = Number(scope.match(/^slink\.adhd\.marketwatch\.(\d+)$/)?.[1]) || 0;
      return MARKET_TIERS.includes(tier) ? Math.max(maximum, tier) : maximum;
    }, 0);
  }

  function normalizeMarketPriority(value) {
    return Object.hasOwn(MARKET_PRIORITIES, value) ? String(value) : 'normal';
  }

  function normalizeMarketWatch(input = {}, index = 0) {
    const marketType = input.marketType === 'points' ? 'points' : 'item';
    return {
      uid:String(input.uid || `watch-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`).slice(0, 100),
      marketType,
      itemId:marketType === 'item' ? Math.max(0, Math.trunc(Number(input.itemId) || 0)) : 0,
      label:marketType === 'points' ? 'Points' : String(input.label || '').trim().slice(0, 120),
      maxPrice:Math.max(0, Math.trunc(Number(input.maxPrice) || 0)),
      priority:normalizeMarketPriority(input.priority),
      marketEnabled:marketType === 'points' ? true : input.marketEnabled !== false,
      bazaarEnabled:marketType === 'item' && input.bazaarEnabled !== false,
      enabled:input.enabled !== false
    };
  }

  function marketSettings() {
    const input = dataState.settings.market && typeof dataState.settings.market === 'object' ? dataState.settings.market : {};
    dataState.settings.market = {
      enabled:input.enabled !== false,
      quickBuyEnabled:input.quickBuyEnabled !== false,
      lastPriority:normalizeMarketPriority(input.lastPriority),
      watches:(Array.isArray(input.watches) ? input.watches : []).map(normalizeMarketWatch),
      dismissals:input.dismissals && typeof input.dismissals === 'object' ? input.dismissals : {}
    };
    return dataState.settings.market;
  }

  function marketRuntime() {
    const stored = dataState.caches.market && typeof dataState.caches.market === 'object' ? dataState.caches.market : {};
    return {
      catalog:stored.catalog && typeof stored.catalog === 'object' ? stored.catalog : { fetchedAt:0, items:[] },
      results:stored.results && typeof stored.results === 'object' ? stored.results : {},
      weaver:stored.weaver && typeof stored.weaver === 'object' ? stored.weaver : { events:[], cooldownUntil:0 },
      fetchedAt:Number(stored.fetchedAt) || 0,
      lastError:String(stored.lastError || '')
    };
  }

  function catalogItems(body = {}) {
    const rows = Array.isArray(body.items) ? body.items : Object.values(body.items || {});
    return rows.filter(item => Number(item?.id) > 0 && item?.name && item?.is_tradable !== false && item?.is_masked !== true).map(item => {
      const shops = Array.isArray(item?.value?.shops) ? item.value.shops : [];
      const sell = shops.map(shop => ({ price:Number(shop?.sell_price) || 0, shop:String(shop?.shop || ''), country:String(shop?.country || '') }))
        .filter(row => row.price > 0).sort((left, right) => right.price - left.price)[0]
        || { price:Number(item?.value?.sell_price) || 0, shop:String(item?.value?.vendor?.name || ''), country:String(item?.value?.vendor?.country || '') };
      return { id:Math.trunc(Number(item.id)), name:String(item.name), type:String(item.type || 'Other'), image:String(item.image || ''), marketPrice:Math.max(0, Math.trunc(Number(item?.value?.market_price) || 0)), shopSellPrice:Math.max(0, Math.trunc(sell.price || 0)), shopSellName:sell.shop, shopSellCountry:sell.country };
    }).sort((left, right) => left.name.localeCompare(right.name));
  }

  function marketListings(body = {}) {
    const source = body?.itemmarket || body?.data?.itemmarket || body;
    return (Array.isArray(source?.listings) ? source.listings : []).map(row => ({ price:Math.max(0, Math.trunc(Number(row?.price) || 0)), quantity:Math.max(0, Math.trunc(Number(row?.amount ?? row?.quantity) || 0)) })).filter(row => row.price > 0).sort((a, b) => a.price - b.price);
  }

  function pointsListings(body = {}) {
    const source = body?.pointsmarket || body?.data?.pointsmarket || body;
    const rows = Array.isArray(source?.listings) ? source.listings : Array.isArray(source) ? source : Object.values(source?.listings || source || {});
    return rows.map(row => ({ price:Math.max(0, Math.trunc(Number(row?.cost ?? row?.price ?? row?.price_per_point ?? row?.pricePerPoint) || 0)), quantity:Math.max(0, Math.trunc(Number(row?.quantity ?? row?.amount ?? row?.points) || 0)) })).filter(row => row.price > 0).sort((a, b) => a.price - b.price);
  }

  function externalTimestampMs(value) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function bazaarUrl(sellerId, itemId, price, updatedAt = 0) {
    const url = new URL('https://www.torn.com/bazaar.php');
    url.searchParams.set('userId', String(Math.trunc(Number(sellerId))));
    url.searchParams.set('itemId', String(Math.trunc(Number(itemId))));
    url.searchParams.set('price', String(Math.trunc(Number(price))));
    url.searchParams.set('slinkHighlight', '1');
    if (updatedAt > 0) url.searchParams.set('v', String(Math.trunc(updatedAt / 1000)));
    url.hash = '/';
    return url.toString();
  }

  function weaverListings(body = {}, itemId = 0) {
    const candidates = [body?.listings, body?.bazaarListings, body?.bazaar_listings, body?.marketplace?.listings, body?.item?.listings, body?.data?.listings, body?.data?.bazaarListings, body?.data?.bazaar_listings, body];
    const rows = candidates.find(Array.isArray) || [];
    return rows.map(row => {
      const nested = row?.listing && typeof row.listing === 'object' ? row.listing : row?.bazaar && typeof row.bazaar === 'object' ? row.bazaar : row?.offer && typeof row.offer === 'object' ? row.offer : null;
      const source = nested ? { ...row, ...nested } : row;
      const seller = source?.seller || source?.player || source?.user || source?.owner || {};
      const sellerId = Math.trunc(Number(source?.sellerId ?? source?.seller_id ?? source?.playerId ?? source?.player_id ?? source?.userId ?? source?.user_id ?? seller?.id ?? seller?.playerId ?? seller?.userId));
      const price = Math.trunc(Number(source?.price ?? source?.cost ?? source?.priceEach ?? source?.price_each ?? source?.price_per_item ?? source?.pricePerUnit));
      if (!(sellerId > 0) || !(price > 0)) return null;
      const quantity = Math.max(0, Math.trunc(Number(source?.quantity ?? source?.amount ?? source?.stock ?? source?.available ?? source?.item_count) || 0));
      const sellerName = String(source?.sellerName ?? source?.seller_name ?? source?.playerName ?? source?.player_name ?? source?.userName ?? source?.user_name ?? seller?.name ?? `Player ${sellerId}`).trim() || `Player ${sellerId}`;
      const updatedAt = externalTimestampMs(source?.lastUpdatedAt ?? source?.last_updated_at ?? source?.updatedAt ?? source?.updated_at ?? source?.lastChecked ?? source?.timestamp);
      return { sellerId, sellerName, price, quantity, updatedAt, href:bazaarUrl(sellerId, itemId, price, updatedAt) };
    }).filter(Boolean).sort((a, b) => a.price - b.price);
  }

  function itemMarketUrl(itemId, price = 0) {
    return `https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${encodeURIComponent(Math.trunc(Number(itemId)))}${price > 0 ? `&slinkPrice=${encodeURIComponent(Math.trunc(Number(price)))}` : ''}`;
  }

  function marketMoney(value) {
    return `$${Math.max(0, Math.trunc(Number(value) || 0)).toLocaleString('en-US')}`;
  }

  function marketPriorityFor(watch, previous = {}) {
    const listings = watch.marketType === 'points' ? previous?.points?.listings : previous?.market?.listings || previous?.bazaar?.listings;
    const cheapest = Number(Array.isArray(listings) ? listings[0]?.price : 0) || 0;
    return cheapest > 0 && watch.maxPrice > 0 && cheapest <= watch.maxPrice ? 'high' : normalizeMarketPriority(watch.priority);
  }

  function dealDismissKey(deal) {
    return `${String(deal.id || '')}|${Math.max(0, Number(deal.price) || 0)}|${Math.max(0, Number(deal.quantity) || 0)}`;
  }

  function marketOpportunities(runtime = marketRuntime()) {
    const settings = marketSettings();
    const limit = marketWatchLimit();
    const catalog = new Map((runtime.catalog?.items || []).map(item => [Number(item.id), item]));
    const now = Date.now();
    settings.dismissals = Object.fromEntries(Object.entries(settings.dismissals || {}).filter(([, until]) => Number(until) > now));
    return settings.watches.slice(0, limit).flatMap(watch => {
      if (!watch.enabled || !(watch.maxPrice > 0)) return [];
      const result = runtime.results?.[watch.uid] || {};
      if (watch.marketType === 'points') {
        const listing = result.points?.listings?.[0];
        if (!listing || listing.price > watch.maxPrice) return [];
        const href = 'https://www.torn.com/pmarket.php';
        return [{ id:`points:${watch.uid}`, watchUid:watch.uid, source:'Points Market', itemName:'Points', itemId:0, price:listing.price, quantity:listing.quantity, href, detail:`${marketMoney(listing.price)} per point${listing.quantity ? ` × ${number(listing.quantity)}` : ''} · target ${marketMoney(watch.maxPrice)}`, shareText:`Points Market | ${marketMoney(listing.price)} per point | target ${marketMoney(watch.maxPrice)} | ${href}` }];
      }
      const item = catalog.get(watch.itemId) || {};
      const name = watch.label || item.name || `Item ${watch.itemId}`;
      const sellText = item.shopSellPrice > 0 ? `${marketMoney(item.shopSellPrice)}${item.shopSellName ? ` at ${item.shopSellName}` : ''}` : '';
      const rows = [];
      const market = result.market?.listings?.[0];
      if (watch.marketEnabled && market && market.price <= watch.maxPrice) {
        const href = itemMarketUrl(watch.itemId, market.price);
        rows.push({ id:`market:${watch.uid}`, watchUid:watch.uid, source:'Item Market', itemId:watch.itemId, itemName:name, price:market.price, quantity:market.quantity, shopSellPrice:item.shopSellPrice || 0, href, detail:`${marketMoney(market.price)}${market.quantity ? ` × ${number(market.quantity)}` : ''} · target ${marketMoney(watch.maxPrice)}${sellText ? ` · shop sells ${sellText}` : ''}`, shareText:`Item Market | ${name} | ${marketMoney(market.price)} | target ${marketMoney(watch.maxPrice)}${sellText ? ` | shop sell ${sellText}` : ''} | ${href}` });
      }
      const best = new Map();
      for (const listing of result.bazaar?.listings || []) if (!best.has(listing.sellerId) || listing.price < best.get(listing.sellerId).price) best.set(listing.sellerId, listing);
      if (watch.bazaarEnabled) for (const listing of [...best.values()].filter(row => row.price <= watch.maxPrice).slice(0, 5)) rows.push({ id:`bazaar:${watch.uid}:${listing.sellerId}`, watchUid:watch.uid, source:'Bazaar', itemId:watch.itemId, itemName:name, price:listing.price, quantity:listing.quantity, shopSellPrice:item.shopSellPrice || 0, href:listing.href, detail:`${marketMoney(listing.price)}${listing.quantity ? ` × ${number(listing.quantity)}` : ''} from ${listing.sellerName} · target ${marketMoney(watch.maxPrice)}${sellText ? ` · shop sells ${sellText}` : ''}`, shareText:`Bazaar | ${name} | ${marketMoney(listing.price)} | ${listing.sellerName} | target ${marketMoney(watch.maxPrice)}${sellText ? ` | shop sell ${sellText}` : ''} | ${listing.href}` });
      return rows;
    }).map(row => ({ ...row, dismissKey:dealDismissKey(row) })).filter(row => !settings.dismissals[row.dismissKey]).sort((a, b) => a.price - b.price);
  }

  async function marketTornJson(url, endpoint, priority) {
    const key = currentApiKey();
    if (!key) throw new Error('Save a Torn API key under Access first.');
    const normalized = normalizeMarketPriority(priority);
    await reserveTornApi(endpoint, { wait:false, limit:TORN_PRIORITY_LIMITS[normalized], priority:normalized });
    const body = await requestJson(url, { headers:{ Authorization:`ApiKey ${key}` } });
    if (body?.error) throw new Error(body.error.message || body.error.error || 'Torn API request failed.');
    return body;
  }

  async function marketEnsureCatalog(runtime, force = false) {
    if (!force && runtime.catalog?.items?.length && Date.now() - Number(runtime.catalog.fetchedAt) < 86_400_000) return runtime.catalog;
    const body = await marketTornJson(`${URLS.torn}/v2/torn/items?cat=All&sort=ASC`, '/v2/torn/items', 'high');
    const items = catalogItems(body);
    if (!items.length) throw new Error('Torn returned an empty item catalog.');
    runtime.catalog = { fetchedAt:Date.now(), items };
    return runtime.catalog;
  }

  function marketDue(source, force) {
    return force || !Number(source?.nextCheckAt) || Number(source.nextCheckAt) <= Date.now();
  }

  async function marketWeaverJson(url, runtime) {
    const now = Date.now();
    const prior = runtime.weaver || {};
    const events = (Array.isArray(prior.events) ? prior.events : []).map(Number).filter(at => at > now - WEAVER_RATE_WINDOW_MS && at <= now + 5_000).sort((a, b) => a - b);
    const retryAt = Math.max(Number(prior.cooldownUntil) || 0, Number(events.at(-1) || 0) + WEAVER_MIN_REQUEST_SPACING_MS, events.length >= WEAVER_RATE_LIMIT ? Number(events[0]) + WEAVER_RATE_WINDOW_MS : 0);
    runtime.weaver = { events, cooldownUntil:Number(prior.cooldownUntil) > now ? Number(prior.cooldownUntil) : 0 };
    if (retryAt > now) { const error = new Error('Weaver request budget is reserved for a later watch.'); error.retryAfterMs = retryAt - now; throw error; }
    runtime.weaver.events.push(now);
    try { return await requestJson(url); }
    catch (error) {
      if (Number(error?.status) === 429) runtime.weaver.cooldownUntil = Date.now() + 15 * 60_000;
      throw error;
    }
  }

  function marketErrorSummary(watches, results) {
    const capacity = [];
    const other = [];
    for (const watch of watches) for (const [source, message] of Object.entries(results[watch.uid]?.errors || {})) {
      if (/shared Torn API capacity/i.test(message)) capacity.push(watch.label || 'Points');
      else other.push(`${watch.label || 'Points'} ${source === 'bazaar' ? 'Weaver Bazaar' : source === 'points' ? 'Points Market' : 'Item Market'}: ${message}`);
    }
    if (capacity.length) other.unshift(`${capacity.length} Market Watch check${capacity.length === 1 ? '' : 's'} queued for shared Torn API capacity.`);
    return other.join(' · ');
  }

  function scheduleMarketWake(runtime = marketRuntime()) {
    if (marketWakeTimer) global.clearTimeout(marketWakeTimer);
    marketWakeTimer = null;
    if (!marketSettings().enabled || marketWatchLimit() <= 0) return;
    const times = marketSettings().watches.slice(0, marketWatchLimit()).filter(watch => watch.enabled && watch.maxPrice > 0).flatMap(watch => {
      const result = runtime.results?.[watch.uid] || {};
      return watch.marketType === 'points'
        ? [Number(result.points?.nextCheckAt) || Date.now()]
        : [watch.marketEnabled ? Number(result.market?.nextCheckAt) || Date.now() : 0, watch.bazaarEnabled ? Number(result.bazaar?.nextCheckAt) || Date.now() : 0].filter(Boolean);
    });
    if (!times.length) return;
    const delay = Math.max(1_000, Math.min(...times) - Date.now());
    marketWakeTimer = global.setTimeout(() => { marketWakeTimer = null; void refreshMarket(false); }, delay);
  }

  async function refreshMarket(force = false) {
    const current = moduleState.market;
    if (current.busy) return;
    current.busy = true; current.error = ''; current.lastAttemptAt = Date.now();
    if (dashboardOpen) renderMarketUnlessEditing();
    const runtime = marketRuntime();
    try {
      const refreshPermissions = moduleState.market.refreshPermissions;
      moduleState.market.refreshPermissions = false;
      await ensurePermissionSession(refreshPermissions);
      const limit = marketWatchLimit();
      if (!limit) throw new Error('Your account does not have a SLINK Market Watch tier (.5 through .40).');
      const settings = marketSettings();
      await marketEnsureCatalog(runtime, false);
      if (!settings.enabled) {
        runtime.fetchedAt = runtime.fetchedAt || Date.now(); current.data = dataState.caches.market = runtime; writeDataState(); return;
      }
      const allowed = settings.watches.slice(0, limit);
      const valid = new Set(allowed.map(watch => watch.uid));
      runtime.results = Object.fromEntries(Object.entries(runtime.results).filter(([uid]) => valid.has(uid)));
      const ordered = [...allowed].sort((a, b) => MARKET_PRIORITIES[marketPriorityFor(a, runtime.results[a.uid])] - MARKET_PRIORITIES[marketPriorityFor(b, runtime.results[b.uid])]);
      let tornBlockedUntil = 0;
      for (const watch of ordered) {
        if (!watch.enabled || !(watch.maxPrice > 0)) continue;
        const previous = runtime.results[watch.uid] || {};
        const next = { ...previous, errors:{ ...(previous.errors || {}) } };
        if (watch.marketType === 'points') {
          if (marketDue(previous.points, force)) {
            if (tornBlockedUntil > Date.now()) {
              next.errors.points = 'Waiting for shared Torn API capacity.';
              next.points = { ...(previous.points || {}), nextCheckAt:tornBlockedUntil };
            } else try {
              const body = await marketTornJson(`${URLS.torn}/v2/market?selections=pointsmarket&limit=100`, '/v2/market?selections=pointsmarket', 'high');
              const now = Date.now(); next.points = { fetchedAt:now, nextCheckAt:now + POINTS_MARKET_REFRESH_MS, listings:pointsListings(body) }; delete next.errors.points;
            } catch (error) {
              const retry = Date.now() + (Number(error?.retryAfterMs) || 5_000); next.errors.points = errorMessage(error); next.points = { ...(previous.points || {}), nextCheckAt:retry }; if (error.code === 'SLINK_TORN_API_LIMIT') tornBlockedUntil = retry;
            }
          }
        } else if (watch.itemId > 0) {
          if (watch.marketEnabled && marketDue(previous.market, force)) {
            if (tornBlockedUntil > Date.now()) {
              next.errors.market = 'Waiting for shared Torn API capacity.'; next.market = { ...(previous.market || {}), nextCheckAt:tornBlockedUntil };
            } else try {
              const priority = marketPriorityFor(watch, previous);
              const body = await marketTornJson(`${URLS.torn}/v2/market/${encodeURIComponent(watch.itemId)}/itemmarket?limit=5`, `/v2/market/${watch.itemId}/itemmarket`, priority);
              const source = body?.itemmarket || body?.data?.itemmarket || body;
              const now = Date.now(); const cacheTimestamp = Math.max(0, Math.trunc(Number(source?.cache_timestamp) || 0)); const delay = Number(source?.cache_delay); const cacheDelayMs = Number.isFinite(delay) && delay >= 0 ? Math.ceil(delay * 1_000) : null;
              const stale = cacheTimestamp > 0 && cacheTimestamp === Number(previous.market?.cacheTimestamp); const cacheRetryCount = stale ? Number(previous.market?.cacheRetryCount || 0) + 1 : 0;
              const nextCheckAt = stale ? now + Math.min(5_000, 2_000 + Math.max(0, cacheRetryCount - 1) * 1_000) : cacheTimestamp > 0 && cacheDelayMs !== null ? Math.max(cacheTimestamp * 1_000 + cacheDelayMs + 1_000, now + 1_000) : now + ITEM_MARKET_FALLBACK_MS;
              next.market = { fetchedAt:now, listings:marketListings(body), cacheTimestamp, cacheDelayMs, cacheRetryCount, nextCheckAt }; delete next.errors.market;
            } catch (error) {
              const retry = Date.now() + (Number(error?.retryAfterMs) || 5_000); next.errors.market = errorMessage(error); next.market = { ...(previous.market || {}), nextCheckAt:retry }; if (error.code === 'SLINK_TORN_API_LIMIT') tornBlockedUntil = retry;
            }
          }
          if (watch.bazaarEnabled) {
            const priority = marketPriorityFor(watch, previous);
            const dueAt = Number(previous.bazaar?.nextCheckAt) || Number(previous.bazaar?.fetchedAt || 0) + WEAVER_REFRESH_MS[priority];
            if (force || dueAt <= Date.now()) try {
              const url = `${URLS.weaver}/api/marketplace/${encodeURIComponent(watch.itemId)}?maxPrice=${encodeURIComponent(watch.maxPrice)}&limit=5`;
              const body = await marketWeaverJson(url, runtime); const now = Date.now(); next.bazaar = { fetchedAt:now, nextCheckAt:now + WEAVER_REFRESH_MS[priority], sourceUrl:url, listings:weaverListings(body, watch.itemId) }; delete next.errors.bazaar;
            } catch (error) { next.errors.bazaar = errorMessage(error); next.bazaar = { ...(previous.bazaar || {}), nextCheckAt:Date.now() + (Number(error?.retryAfterMs) || 5_000) }; }
          }
        }
        runtime.results[watch.uid] = next;
      }
      runtime.fetchedAt = Date.now(); runtime.lastError = marketErrorSummary(allowed, runtime.results);
      current.data = dataState.caches.market = runtime;
      reconcileMarketNotifications(runtime);
      writeDataState();
    } catch (error) { current.error = errorMessage(error); runtime.lastError = current.error; current.data = dataState.caches.market = runtime; writeDataState(); }
    finally { current.busy = false; renderMarketUnlessEditing(); scheduleMarketDomFormat(); scheduleMarketWake(current.data || runtime); }
  }

  async function refreshMarketPermissions() {
    const current = moduleState.market;
    if (current.busy) return;
    current.busy = true;
    current.error = '';
    renderMarket();
    try {
      await ensurePermissionSession(true);
      current.refreshPermissions = false;
    } catch (error) {
      current.error = errorMessage(error);
    } finally {
      current.busy = false;
      renderAllModules();
    }
    if (marketWatchLimit() > 0) void refreshMarket(false);
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
      ['[data-efficiency-tab="market"]', 'slink.adhd.marketwatch tier'],
      ['[data-efficiency-tab="merits"]', 'slink.adhd.alerts'],
      ['[data-theme-choice="slinky-pursuit"]', 'slink.theme.pursuit'],
      ['[data-theme-choice="slinky-underglow"]', 'slink.theme.underglow']
    ];
    for (const [selector, scope] of gates) {
      const control = shadow?.querySelector?.(selector);
      if (!control) continue;
      const allowed = scope.startsWith('slink.theme.') ? hasThemeScope(scope) : scope === 'slink.adhd.marketwatch tier' ? marketWatchLimit() > 0 : hasScope(scope);
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

  function parseMugResultText(value) {
    const match = String(value || '').replace(/\s+/g, ' ').trim().match(/^You mugged (.+?) and stole \$([\d,]+)$/i);
    const amount = Number(String(match?.[2] || '').replaceAll(',', ''));
    return match && Number.isSafeInteger(amount) && amount > 0 ? { victimName:match[1].trim(), amount } : null;
  }

  function attackPageUrl() {
    try {
      const url = new URL(global.location.href);
      return url.pathname.endsWith('/page.php') && url.searchParams.get('sid') === 'attack' ? url : null;
    } catch {
      return null;
    }
  }

  function attackPageTargetId() {
    return Math.trunc(Number(attackPageUrl()?.searchParams.get('user2ID')) || 0);
  }

  function pdaMugReports() {
    if (!Array.isArray(dataState.caches.warMugReports)) dataState.caches.warMugReports = [];
    return dataState.caches.warMugReports;
  }

  function mugStatsForWar(warId) {
    const reports = pdaMugReports().filter(report => report.warId === warId);
    const amounts = reports.map(report => Number(report.amount) || 0).filter(amount => amount > 0);
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    return { reports, count:amounts.length, total, min:amounts.length ? Math.min(...amounts) : 0, max:amounts.length ? Math.max(...amounts) : 0, average:amounts.length ? Math.round(total / amounts.length) : 0 };
  }

  function recordMugResultNode(node) {
    if (!node || reportedMugNodes.has(node)) return;
    const result = parseMugResultText(node.textContent);
    if (!result) return;
    const active = moduleState.war.data?.activeWar;
    if (!active && currentApiKey() && hasGrantedScope('slink.war') && node.dataset.slinkMugPending !== 'true') {
      node.dataset.slinkMugPending = 'true';
      void refreshWar(false).finally(() => { delete node.dataset.slinkMugPending; recordMugResultNode(node); });
      return;
    }
    reportedMugNodes.add(node);
    if (!active || active.phase !== 'active') return;
    const victimId = attackPageTargetId();
    const fingerprint = `${active.warId}|${victimId}|${result.victimName.toLowerCase()}|${result.amount}`;
    const now = Date.now();
    for (const [key, at] of recentMugResults) if (now - at > MUG_RESULT_DEDUPE_MS) recentMugResults.delete(key);
    if (recentMugResults.has(fingerprint) || pdaMugReports().some(report => report.fingerprint === fingerprint && now - Number(report.at || 0) <= MUG_RESULT_DEDUPE_MS)) return;
    recentMugResults.set(fingerprint, now);
    dataState.caches.warMugReports = [...pdaMugReports(), { warId:active.warId, victimId, victimName:result.victimName, amount:result.amount, at:now, fingerprint, source:'torn_attack_result_dom' }].slice(-1_000);
    writeDataState();
    if (dashboardOpen && state.page === 'combat' && state.combatTab === 'war') renderWar();
  }

  function scanAttackMugResults() {
    if (!attackPageUrl()) return;
    document.querySelectorAll('div[class*="dialog___"] div[class*="title___"],div[class*="green___"] div[class*="title___"]').forEach(recordMugResultNode);
  }

  function warOfficer() {
    return hasScope('slink.war.officer') || hasScope('admin.*');
  }

  function warMemberId(member) {
    return Math.trunc(Number(member?.id ?? member?.user_id ?? member?.player_id ?? member?.attackerId) || 0);
  }

  function warMemberStatus(member) {
    return String(member?.statusState ?? member?.status?.state ?? member?.status ?? 'Unknown');
  }

  function warMemberActivity(member) {
    return String(member?.activity ?? member?.last_action?.status ?? member?.lastAction?.status ?? 'Unknown');
  }

  function warStatusSeconds(member) {
    const until = Number(member?.statusUntil ?? member?.status?.until) || 0;
    return Math.max(0, until - Math.floor(Date.now() / 1000));
  }

  function warTctTime(seconds) {
    if (!seconds) return '';
    return new Date(Number(seconds) * 1000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'UTC' });
  }

  function warSortMembers(rows, sort = 'availability') {
    const values = [...(Array.isArray(rows) ? rows : [])];
    return values.sort((left, right) => {
      const leftFf = finite(left?.fairFight ?? left?.fair_fight) ?? Number.POSITIVE_INFINITY;
      const rightFf = finite(right?.fairFight ?? right?.fair_fight) ?? Number.POSITIVE_INFINITY;
      if (sort === 'fairFightAsc') return leftFf - rightFf;
      if (sort === 'fairFightDesc') return rightFf - leftFf;
      const score = member => {
        const status = warMemberStatus(member).toLowerCase();
        const activity = warMemberActivity(member).toLowerCase();
        if (status === 'okay' && activity === 'online') return 0;
        if (status === 'okay' && activity === 'idle') return 1;
        if (status === 'okay') return 2;
        if (status.includes('hospital')) return 3 + warStatusSeconds(member) / 100000;
        return 4;
      };
      return score(left) - score(right) || leftFf - rightFf;
    });
  }

  function warMemberContext(member) {
    const bits = [];
    const description = String(member?.statusDescription ?? member?.status?.description ?? '').trim();
    const lastAction = String(member?.lastActionRelative ?? member?.last_action?.relative ?? '').trim();
    if (description && description.toLowerCase() !== warMemberStatus(member).toLowerCase()) bits.push(description);
    if (lastAction) bits.push(lastAction);
    return bits.length ? `<span class="war-context">${escapeHtml(bits.join(' · '))}</span>` : '';
  }

  function warCallout(member) {
    const id = warMemberId(member);
    const status = warMemberStatus(member);
    const activity = warMemberActivity(member);
    const ff = finite(member?.fairFight ?? member?.fair_fight);
    const estimate = finite(member?.battleStatsEstimate ?? member?.battle_stats_estimate ?? member?.bs_estimate);
    return `${String(member?.name || `Player ${id}`)} [${id}] · ${activity} · ${status}${estimate === null ? '' : ` · BS ${number(estimate)}`}${ff === null ? '' : ` · FF ${number(ff, 2)}`} · https://www.torn.com/profiles.php?XID=${id}`;
  }

  function warInsideGate(targetId) {
    const data = moduleState.war.data || {};
    const config = data.snapshot?.config || dataState.settings.war;
    const chain = Math.max(0, Number(data.panelStats?.chain?.current) || 0);
    const range = [[0, 100], [200, 250], [450, 500], [950, 1000], [2350, 2500], [4850, 5000], [9900, 10000]].find(([minimum, maximum]) => chain >= minimum && chain <= maximum);
    const opponentIds = new Set((data.snapshot?.members || []).map(warMemberId));
    const mode = ['off', 'warn', 'block'].includes(config.insideBlockMode) ? config.insideBlockMode : 'warn';
    return { active:Boolean(config.mode === 'termed' && mode !== 'off' && range && opponentIds.has(Number(targetId))), mode, chain, range };
  }

  function warInsideMessage(gate) {
    return `Inside hits disabled: chain ${gate.chain} is inside the ${gate.range?.[0]}–${gate.range?.[1]} major bonus window.`;
  }

  function warMemberCard(member, outside = false) {
    const id = warMemberId(member);
    const status = warMemberStatus(member);
    const activity = warMemberActivity(member);
    const hospitalized = /hospital/i.test(status);
    const remaining = warStatusSeconds(member);
    const ff = finite(member?.fairFight ?? member?.fair_fight);
    const estimate = finite(member?.battleStatsEstimate ?? member?.battle_stats_estimate ?? member?.bs_estimate);
    const gate = outside ? { active:false } : warInsideGate(id);
    const attack = `<a class="action-link ${gate.active ? 'war-inside-attack' : ''}" href="https://www.torn.com/page.php?sid=attack&user2ID=${id}" ${gate.active ? `data-action="war-inside-attack" data-war-target="${id}" data-war-gate="${gate.mode}"` : ''}>${gate.active && gate.mode === 'block' ? 'INSIDES DISABLED' : 'Attack'}</a>`;
    return `<article class="war-card ${gate.active ? 'war-inside-blocked' : ''}"><div class="war-card-head"><a href="https://www.torn.com/profiles.php?XID=${id}">${escapeHtml(member?.name || `Player ${id}`)} [${id}]</a><span>Lv ${number(member?.level)}</span></div><div class="war-meta"><span class="war-pill ${/^online$/i.test(activity) ? 'online' : ''}">${escapeHtml(activity)}</span><span class="war-pill ${hospitalized ? 'hospital' : ''}">${escapeHtml(status)}${hospitalized && remaining ? ` · ${duration(remaining)} · ${warTctTime(Number(member?.statusUntil ?? member?.status?.until))} TCT` : ''}</span><span class="war-pill">BS ${estimate === null ? '?' : number(estimate)}</span><span class="war-pill">FF ${ff === null ? '?' : number(ff, 2)}</span>${warMemberContext(member)}</div>${gate.active ? `<div class="war-inside-warning">${escapeHtml(warInsideMessage(gate))}</div>` : ''}<div class="target-actions">${attack}${actionLink('Profile', `https://www.torn.com/profiles.php?XID=${id}`)}<button type="button" data-action="copy-war-target" data-war-target="${id}" data-war-outside="${outside ? 'true' : 'false'}">Copy</button><button type="button" data-action="send-war-target" data-war-target="${id}" data-war-outside="${outside ? 'true' : 'false'}">Send to Faction</button></div></article>`;
  }

  function warTargetView(snapshot) {
    const settings = dataState.settings.war;
    const minimum = Math.min(Number(settings.targetMinFF) || 1, Number(settings.targetMaxFF) || 3);
    const maximum = Math.max(Number(settings.targetMinFF) || 1, Number(settings.targetMaxFF) || 3);
    const members = warSortMembers(snapshot?.members || snapshot?.targets || [], settings.targetSort).filter(member => {
      const ff = finite(member?.fairFight ?? member?.fair_fight);
      const okay = /^okay$/i.test(warMemberStatus(member).trim());
      if (ff !== null && (ff < minimum || ff > maximum)) return false;
      return settings.targetStatus === 'okay' ? okay : settings.targetStatus === 'notOkay' ? !okay : true;
    });
    return `<div class="war-filters"><label>Minimum FF<input type="number" min="0" max="100" step="0.1" data-field="war-target-min" value="${minimum}"></label><label>Maximum FF<input type="number" min="0" max="100" step="0.1" data-field="war-target-max" value="${maximum}"></label><label>Status<select data-field="war-target-status"><option value="all" ${settings.targetStatus === 'all' ? 'selected' : ''}>All</option><option value="okay" ${settings.targetStatus === 'okay' ? 'selected' : ''}>Okay</option><option value="notOkay" ${settings.targetStatus === 'notOkay' ? 'selected' : ''}>Not okay</option></select></label><label>Sort<select data-field="war-target-sort"><option value="availability" ${settings.targetSort === 'availability' ? 'selected' : ''}>Availability</option><option value="fairFightDesc" ${settings.targetSort === 'fairFightDesc' ? 'selected' : ''}>FF high to low</option><option value="fairFightAsc" ${settings.targetSort === 'fairFightAsc' ? 'selected' : ''}>FF low to high</option></select></label></div><div class="war-stack">${members.length ? members.map(member => warMemberCard(member)).join('') : moduleMessage('No ranked-war opponents match the current filters.')}</div>`;
  }

  function warOutsideView(data) {
    const settings = dataState.settings.war;
    const members = warSortMembers(data?.outsideTargets || [], 'fairFightAsc');
    return `<div class="war-filters"><label>Minimum FF<input type="number" min="1" max="3" step="0.1" data-field="war-outside-min" value="${Number(settings.outsideMinFF) || 1}"></label><label>Maximum FF<input type="number" min="1" max="3" step="0.1" data-field="war-outside-max" value="${Number(settings.outsideMaxFF) || 3}"></label><div class="war-filter-action"><button type="button" data-action="refresh-war-outside" ${moduleState.war.outsideBusy ? 'disabled' : ''}>${moduleState.war.outsideBusy ? 'Polling…' : 'Poll up to 50 outside targets'}</button></div></div>${moduleState.war.outsideError ? moduleMessage(moduleState.war.outsideError, 'error') : ''}<div class="war-stack">${members.length ? members.map(member => warMemberCard(member, true)).join('') : moduleMessage('Choose a Fair Fight range and poll FFScouter for outside targets.')}</div>`;
  }

  function warClaimForm(snapshot) {
    const officer = warOfficer();
    const members = Array.isArray(snapshot?.members) ? snapshot.members : [];
    return `<div class="war-claim-form"><label>Target<select data-field="war-claim-target"><option value="">Select a war target</option>${members.map(member => `<option value="${warMemberId(member)}">${escapeHtml(member?.name || `Player ${warMemberId(member)}`)} [${warMemberId(member)}]</option>`).join('')}</select></label>${officer ? '<label>Assign Torn ID (optional)<input type="number" min="1" data-field="war-claim-assignee" placeholder="Leave blank to claim for yourself"></label>' : ''}<button type="button" data-action="claim-war-target">Claim med-out target</button></div>`;
  }

  function warClaimsView(snapshot) {
    const session = dataState.sessions.permission || {};
    const claims = Array.isArray(snapshot?.claims) ? snapshot.claims : [];
    return `${warClaimForm(snapshot)}<div class="war-stack">${claims.length ? claims.map(claim => {
      const mine = Number(claim?.claimedById ?? claim?.claimed_by_id) === Number(session.userId);
      const targetId = Number(claim?.targetId ?? claim?.target_id) || 0;
      const expiresAt = Number(claim?.expiresAt ?? claim?.expires_at) || 0;
      return `<article class="war-card"><div class="war-card-head"><a href="https://www.torn.com/profiles.php?XID=${targetId}">${escapeHtml(claim?.targetName ?? claim?.target_name ?? `Player ${targetId}`)} [${targetId}]</a><span>${duration((expiresAt - Date.now()) / 1000)}</span></div><div class="war-meta"><span class="war-pill">Claimed by ${escapeHtml(claim?.claimedByName ?? claim?.claimed_by_name ?? claim?.claimedById ?? claim?.claimed_by_id ?? 'Unknown')}</span></div>${mine || warOfficer() ? `<div class="target-actions"><button type="button" data-action="release-war-claim" data-war-target="${targetId}">Release claim</button></div>` : ''}</article>`;
    }).join('') : moduleMessage('No med-out targets are currently claimed.')}</div>`;
  }

  function warVisibleRetals(snapshot, active) {
    const settings = dataState.settings.war;
    const now = Math.floor(Date.now() / 1000);
    const dismissed = settings.dismissedRetals && typeof settings.dismissedRetals === 'object' ? settings.dismissedRetals : {};
    const opponentIds = new Set((snapshot?.members || []).map(warMemberId));
    return (Array.isArray(snapshot?.retals) ? snapshot.retals : []).filter(retal => {
      const expiresAt = Number(retal?.expiresAt ?? retal?.expires_at) || now + 300;
      const key = `user:${Number(retal?.attackerId) || String(retal?.attackId || '')}`;
      const opponentRetal = settings.mode === 'termed' && (Number(retal?.attackerFactionId) === Number(active?.opponentId) || opponentIds.has(Number(retal?.attackerId)));
      return expiresAt > now && !opponentRetal && Number(dismissed[key] || dismissed[String(retal?.attackId)]) <= now;
    });
  }

  function warRetalCards(snapshot, active) {
    const now = Math.floor(Date.now() / 1000);
    const retals = warVisibleRetals(snapshot, active);
    if (!retals.length) return '';
    return `<section class="war-alert-block"><strong>Active retaliation alerts</strong><div class="war-stack">${retals.map(retal => {
      const id = Number(retal?.attackerId) || 0;
      const attackId = String(retal?.attackId || id);
      const status = String(retal?.attackerStatus || retal?.attackerActivity || 'Unknown');
      const expires = Number(retal?.expiresAt) || now + 300;
      const faction = retal?.attackerFactionName || (retal?.attackerFactionId ? `Faction ${retal.attackerFactionId}` : 'No faction');
      return `<article class="war-card war-retal"><button class="war-dismiss" type="button" data-action="dismiss-war-retal" data-war-retal="${escapeHtml(attackId)}" aria-label="Dismiss retaliation alert">×</button><div class="war-card-head"><a href="https://www.torn.com/profiles.php?XID=${id}">${escapeHtml(retal?.attackerName || `Player ${id}`)} [${id}]</a><span>${duration(expires - now)}</span></div><div class="war-retal-report"><span>Faction</span><strong>${escapeHtml(faction)}</strong><span>Attacked</span><strong>${escapeHtml(retal?.defenderName || `Player ${retal?.defenderId || '?'}`)}</strong><span>Status</span><strong>${escapeHtml(status)}</strong><span>Fair Fight</span><strong>${number(retal?.fairFight, 2)}</strong></div><div class="target-actions"><button type="button" data-action="copy-war-retal" data-war-retal="${escapeHtml(attackId)}">Copy</button><button type="button" data-action="send-war-retal" data-war-retal="${escapeHtml(attackId)}">Send to Faction</button>${actionLink('Attack', `https://www.torn.com/page.php?sid=attack&user2ID=${id}`)}${actionLink('Profile', `https://www.torn.com/profiles.php?XID=${id}`)}</div></article>`;
    }).join('')}</div></section>`;
  }

  function warItemRequests(snapshot) {
    if (!warOfficer()) return '';
    const requests = Array.isArray(snapshot?.itemRequests) ? snapshot.itemRequests : [];
    if (!requests.length) return '';
    return `<section class="war-alert-block"><strong>Armory item requests</strong><div class="war-stack">${requests.map(request => `<article class="war-card"><div class="war-card-head"><a href="https://www.torn.com/profiles.php?XID=${Number(request?.requesterId) || 0}">${escapeHtml(request?.requesterName || `Player ${request?.requesterId || '?'}`)} [${Number(request?.requesterId) || '?'}]</a><span>${escapeHtml(request?.bonusName || 'Ranked')}</span></div><div class="war-meta"><span class="war-pill">${escapeHtml(request?.itemName || 'Item')}</span><span class="war-pill">Held by ${escapeHtml(request?.holderName || `Player ${request?.holderId || '?'}`)}</span><span class="war-context">${escapeHtml(request?.holderStatus || 'Unknown')} · ${escapeHtml(request?.holderLastAction || 'Unknown')}</span></div><div class="target-actions">${actionLink('Open armory', request?.armoryUrl || 'https://www.torn.com/factions.php?step=your#/tab=armoury')}<button type="button" data-action="resolve-war-armory-request" data-war-request="${escapeHtml(request?.requestId || '')}">Dismiss</button></div></article>`).join('')}</div></section>`;
  }

  function warLogsView(data) {
    const rows = Array.isArray(data?.logs) ? data.logs : [];
    if (!rows.length) return moduleMessage('No loss, escape, or online-hit counters yet.');
    const grouped = new Map();
    for (const row of rows) {
      const id = Number(row?.attacker_id ?? row?.attackerId) || 0;
      if (!grouped.has(id)) grouped.set(id, { id, name:String(row?.attacker_name ?? row?.attackerName ?? `Player ${id}`), total:0, rows:[] });
      const group = grouped.get(id); group.total += Number(row?.event_count ?? row?.eventCount) || 0; group.rows.push(row);
    }
    return `<div class="war-stack">${[...grouped.values()].sort((a, b) => b.total - a.total).map(group => `<details class="war-log"><summary><strong>${escapeHtml(group.name)} [${group.id}]</strong><span>${number(group.total)} recorded</span></summary>${group.rows.map(row => `<div class="war-log-event"><strong>${escapeHtml(String(row?.outcome || 'unknown').replaceAll('_', ' '))} × ${number(row?.event_count ?? row?.eventCount)}</strong><span>${escapeHtml(row?.defender_name ?? row?.defenderName ?? `Player ${row?.defender_id ?? row?.defenderId ?? '?'}`)} · ${new Date(Number(row?.last_seen_at ?? row?.lastSeenAt) || 0).toLocaleString()}</span></div>`).join('')}</details>`).join('')}</div>`;
  }

  function activeWarArmoryTab() {
    return [document.querySelector('[id="tab=armoury&sub=weapons"]'), document.querySelector('[id="tab=armoury&sub=armour"]')].filter(Boolean).find(tab => tab.getAttribute('aria-hidden') !== 'true' && global.getComputedStyle(tab).display !== 'none') || null;
  }

  function warArmoryBorrower(row) {
    const link = row.querySelector('.loaned a[href*="XID="]');
    const match = link?.getAttribute('href')?.match(/[?&]XID=(\d+)/i);
    return match ? { id:String(match[1]), name:link.textContent.trim() || match[1] } : null;
  }

  function warArmoryEligible(row, tab) {
    const borrower = warArmoryBorrower(row);
    const whitelist = new Set((dataState.settings.war.armoryWhitelist || []).map(String));
    if (!borrower || whitelist.has(borrower.id) || !row.querySelector('.item-action [data-role="retrieve"].active')) return null;
    const image = row.querySelector('.img-wrap img.torn-item');
    if (!image || !['glow-yellow', 'glow-orange', 'glow-red'].some(name => image.classList.contains(name))) return null;
    const proficience = Boolean(row.querySelector('.bonus-attachment-experience'));
    const mode = dataState.settings.war.armoryMode || 'ranked-all';
    if (mode === 'ranked-no-prof' && proficience) return null;
    if (mode === 'proficience-15-plus') {
      const isWeapons = tab?.id?.includes('sub=weapons');
      const member = (dataState.caches.warArmoryMembers?.members || []).find(item => String(item.id) === borrower.id);
      if (!isWeapons || !proficience || Number(member?.level) < 15) return null;
    }
    return borrower;
  }

  async function refreshWarArmoryMembers(force = false) {
    const cached = dataState.caches.warArmoryMembers;
    if (!force && cached?.at && Date.now() - cached.at < 12 * 60 * 60_000 && cached?.members?.length) return cached.members;
    const response = await tornJson('/v2/faction/members', 'SLINK PDA Armory roster');
    const source = response?.members ?? response?.faction?.members ?? [];
    const rows = Array.isArray(source) ? source : Object.entries(source || {}).map(([id, row]) => ({ id, ...(row || {}) }));
    const members = rows.map(row => ({ id:String(warMemberId(row)), name:String(row?.name || `Player ${warMemberId(row)}`), level:Number(row?.level) || 0, rank:String(row?.position?.name ?? row?.position_name ?? row?.position ?? row?.rank ?? 'Member').trim() || 'Member', statusState:String(row?.status?.state || 'Unknown'), statusDescription:String(row?.status?.description || ''), lastActionRelative:String(row?.last_action?.relative || 'Unknown') })).filter(row => Number(row.id) > 0).sort((left, right) => left.rank.localeCompare(right.rank, undefined, { sensitivity:'base', numeric:true }) || left.name.localeCompare(right.name, undefined, { sensitivity:'base', numeric:true }));
    if (!members.length) throw new Error('Torn returned no faction members. A faction-capable API key may be required.');
    dataState.caches.warArmoryMembers = { at:Date.now(), members };
    writeDataState();
    return members;
  }

  async function retrieveWarArmoryItem() {
    const current = moduleState.war;
    const tab = activeWarArmoryTab();
    if (!tab) { current.error = 'Open the Weapons or Armor tab in Faction Armoury first.'; renderWar(); return; }
    try {
      if (dataState.settings.war.armoryMode === 'proficience-15-plus') await refreshWarArmoryMembers(false);
      for (const row of tab.querySelectorAll('ul.item-list > li')) {
        const borrower = warArmoryEligible(row, tab);
        if (!borrower) continue;
        const item = row.querySelector('.name')?.textContent.trim() || 'item';
        row.querySelector('.item-action [data-role="retrieve"].active')?.click();
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise(resolve => global.setTimeout(resolve, 50));
          const confirm = row.querySelector('.retrieve-cont .retrieve-yes');
          if (confirm && confirm.getClientRects().length) {
            confirm.click(); current.error = ''; current.armoryStatus = `Retrieved one ${item} from ${borrower.name}.`; renderWar(); return;
          }
        }
        throw new Error('Torn did not display the retrieval confirmation.');
      }
      current.armoryStatus = 'No eligible ranked items remain on this page.'; current.error = ''; renderWar();
    } catch (error) { current.error = errorMessage(error); renderWar(); }
  }

  function nextWarArmoryPage() {
    const tab = activeWarArmoryTab();
    if (!tab) { moduleState.war.error = 'Open the Weapons or Armor tab in Faction Armoury first.'; renderWar(); return; }
    const selectors = ['.gallery-wrapper.pagination a[href] > i.pagination-right', '.pagination a[href] > i.pagination-right', '.pagination a.next:not(.disabled)', '.pagination .next:not(.disabled) a', 'a[aria-label="Next"]', 'a[title="Next"]', '[data-page="next"]'];
    for (const selector of selectors) {
      const found = tab.querySelector(selector);
      const control = found?.matches('a,button') ? found : found?.closest('a,button');
      if (control && !control.classList.contains('disabled') && !control.classList.contains('disable')) { control.click(); moduleState.war.armoryStatus = 'Moved to the next armory page.'; renderWar(); return; }
    }
    moduleState.war.armoryStatus = 'No enabled Next Page control was found.'; renderWar();
  }

  function warArmoryView(snapshot) {
    const requests = Array.isArray(snapshot?.itemRequests) ? snapshot.itemRequests : [];
    const onArmory = Boolean(activeWarArmoryTab());
    const members = dataState.caches.warArmoryMembers?.members || [];
    const whitelist = new Set((dataState.settings.war.armoryWhitelist || []).map(String));
    const ranks = [...new Set(members.map(member => member.rank))];
    return `<div class="war-stack"><article class="war-card"><div class="war-card-head"><strong>Officer Armory Recaller</strong><span>${requests.length} request${requests.length === 1 ? '' : 's'}</span></div>${onArmory ? '' : `<p class="muted">Open Torn's armory, then choose Weapons or Armor.</p><div class="target-actions">${actionLink('Open faction armory', 'https://www.torn.com/factions.php?step=your#/tab=armoury')}</div>`}<div class="war-armory-controls"><label>Recall mode<select data-field="war-armory-mode"><option value="ranked-all" ${dataState.settings.war.armoryMode === 'ranked-all' ? 'selected' : ''}>All ranked items</option><option value="ranked-no-prof" ${dataState.settings.war.armoryMode === 'ranked-no-prof' ? 'selected' : ''}>Ranked except Proficience</option><option value="proficience-15-plus" ${dataState.settings.war.armoryMode === 'proficience-15-plus' ? 'selected' : ''}>Proficience from level 15+</option></select></label><div class="target-actions"><button type="button" data-action="retrieve-war-armory" ${onArmory ? '' : 'disabled'}>Retrieve Next</button><button type="button" data-action="next-war-armory" ${onArmory ? '' : 'disabled'}>Next Page</button></div></div><span class="muted">${escapeHtml(moduleState.war.armoryStatus || 'Retrieval only runs after you press Retrieve Next.')}</span><details class="war-armory-manager"><summary>Never retrieve from (${whitelist.size})</summary><input type="search" data-field="war-armory-search" placeholder="Search name, rank, or ID"><div class="target-actions"><button type="button" data-action="refresh-war-armory-members">Refresh roster</button><button type="button" data-action="select-shown-war-armory">Select shown</button><button type="button" data-action="clear-shown-war-armory">Clear shown</button></div><div class="war-armory-ranks">${ranks.map(rank => { const rankMembers = members.filter(member => member.rank === rank); const selected = rankMembers.filter(member => whitelist.has(String(member.id))).length; return `<button type="button" data-action="toggle-war-armory-rank" data-armory-rank="${escapeHtml(rank)}">${escapeHtml(rank)} ${selected}/${rankMembers.length}</button>`; }).join('')}</div><div class="war-armory-members">${members.length ? members.map(member => `<label data-armory-search-row="${escapeHtml(`${member.name} ${member.rank} ${member.id}`.toLowerCase())}"><input type="checkbox" data-war-armory-member="${member.id}" ${whitelist.has(String(member.id)) ? 'checked' : ''}><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.rank)} · level ${member.level || '?'} · ID ${member.id}</small></span></label>`).join('') : moduleMessage('Refresh the faction roster to manage the whitelist.')}</div></details></article>${requests.length ? warItemRequests(snapshot) : moduleMessage('No active armory item requests.')}</div>`;
  }

  function warSettingsView(snapshot) {
    const config = snapshot?.config || {};
    const settings = dataState.settings.war;
    return `<div class="war-settings"><label>Faction War mode<select data-field="war-mode"><option value="war" ${(config.mode || settings.mode) === 'war' ? 'selected' : ''}>Real war</option><option value="termed" ${(config.mode || settings.mode) === 'termed' ? 'selected' : ''}>Termed war</option></select></label><label>Faction idle filter<input type="number" min="0" max="60" data-field="war-idle" value="${Number(config.idleMinutes ?? settings.idleMinutes) || 0}"></label><label>Inside-hit cap<input type="number" min="0" max="9999" data-field="war-inside-cap" value="${Number(config.insideHitCap ?? settings.insideHitCap) || 0}"></label><label>Major-window inside gate<select data-field="war-inside-mode"><option value="off" ${(config.insideBlockMode || settings.insideBlockMode) === 'off' ? 'selected' : ''}>Off</option><option value="warn" ${(config.insideBlockMode || settings.insideBlockMode || 'warn') === 'warn' ? 'selected' : ''}>Warning with override</option><option value="block" ${(config.insideBlockMode || settings.insideBlockMode) === 'block' ? 'selected' : ''}>Hard block</option></select></label><div class="war-settings-note">These faction-wide controls apply to every SLINK War user. Major-window gating only activates in Termed mode.</div><button type="button" data-action="save-war-settings">Save War settings</button></div>`;
  }

  function renderWar(force = false) {
    const root = moduleRoot('war');
    if (!root) return;
    if (!force && moduleState.war.data && root.contains(shadow?.activeElement) && shadow.activeElement.matches('input,select,textarea')) {
      moduleState.war.renderPending = true;
      return;
    }
    moduleState.war.renderPending = false;
    if (!hasScope('slink.war')) { root.innerHTML = lockedModule('slink.war', 'SLINK War'); return; }
    const current = moduleState.war;
    if (current.busy && !current.data) { root.innerHTML = moduleMessage('Finding your ranked war…'); return; }
    if (current.error && !current.data) { root.innerHTML = moduleMessage(current.error, 'error'); return; }
    if (!current.data?.activeWar) { root.innerHTML = `<div class="grid"><article class="card full"><div class="card-head"><div><h2>SLINK War</h2><span class="muted">Assigned and active ranked-war detection</span></div><span class="badge">No war</span></div>${current.error ? moduleMessage(current.error, 'error') : moduleMessage('No assigned or active ranked war was found.')}</article></div>`; return; }
    const active = current.data.activeWar;
    const snapshot = current.data.snapshot || {};
    const members = Array.isArray(snapshot.members) ? snapshot.members : Array.isArray(snapshot.targets) ? snapshot.targets : [];
    const officer = warOfficer();
    const settings = dataState.settings.war;
    const allowedTabs = ['targets', 'outside', 'claims', ...(officer ? ['armory', 'logs', 'settings'] : [])];
    if (!allowedTabs.includes(settings.activeTab)) settings.activeTab = 'targets';
    const tab = settings.activeTab;
    const tabBody = tab === 'targets' ? warTargetView(snapshot) : tab === 'outside' ? warOutsideView(current.data) : tab === 'claims' ? warClaimsView(snapshot) : tab === 'armory' ? warArmoryView(snapshot) : tab === 'logs' ? warLogsView(current.data) : warSettingsView(snapshot);
    const mugStats = mugStatsForWar(active.warId);
    const panelStats = current.data.panelStats || {};
    const chain = panelStats?.chain?.current ? `${number(panelStats.chain.current)}${panelStats.chain.target ? `/${number(panelStats.chain.target)}` : ''}` : 'None';
    const itemRequestCount = officer && Array.isArray(snapshot.itemRequests) ? snapshot.itemRequests.length : 0;
    root.innerHTML = `<div class="grid"><article class="card full"><div class="card-head"><div><h2>${escapeHtml(active.opponentName)}</h2><span class="muted">${active.phase === 'active' ? 'Ranked war active' : `Assigned · starts ${new Date(active.start * 1000).toLocaleString()}`}</span></div><span class="badge ${officer ? 'ready' : ''}">${officer ? 'Officer' : 'Member'}</span></div><nav class="war-tabs">${allowedTabs.map(name => `<button type="button" data-action="select-war-tab" data-war-tab="${name}" aria-selected="${tab === name}">${name[0].toUpperCase()}${name.slice(1)}${name === 'armory' && itemRequestCount ? `<span class="nav-count">${itemRequestCount > 99 ? '99+' : itemRequestCount}</span>` : ''}</button>`).join('')}</nav>${tab === 'armory' ? '' : `<div class="stats"><div class="stat"><strong>${number(panelStats.attacks || 0)}</strong><span>Attacks</span></div><div class="stat"><strong>${number(panelStats.warAttacks || 0)}${Number(snapshot?.config?.insideHitCap) ? `/${number(snapshot.config.insideHitCap)}` : ''}</strong><span>War / cap</span></div><div class="stat"><strong>${number(mugStats.count)}</strong><span>Mugs</span></div><div class="stat"><strong>${chain}</strong><span>Chain</span></div></div><article class="mug-report"><div><strong>Mug report</strong><span>${mugStats.count ? `${number(mugStats.count)} mugs · ${money(mugStats.total)} total · ${money(mugStats.average)} average · ${money(mugStats.min)} min · ${money(mugStats.max)} max` : 'No completed war mugs captured on this device yet.'}</span></div><button type="button" data-action="copy-war-mug-report" ${mugStats.count ? '' : 'disabled'}>Copy report</button></article>${warItemRequests(snapshot)}${warRetalCards(snapshot, active)}`}<div class="module-toolbar"><span>Updated ${relativeTime(current.data.at)} · ${members.length} ranked-war opponents${current.busy ? ' · refreshing…' : ''}</span></div>${current.error ? moduleMessage(current.error, 'error') : ''}<div class="war-tab-body">${tabBody}</div></article></div>`;
  }

  function warAttackRows(payload) {
    const source = payload?.attacks ?? payload?.data ?? [];
    return Array.isArray(source) ? source : Object.values(source || {});
  }

  function updateWarPersonalStats(attacks, active, session) {
    if (!Array.isArray(attacks) || !attacks.length) return;
    const cache = dataState.caches.warPersonalStats?.warId === active.warId ? dataState.caches.warPersonalStats : { warId:active.warId, attacks:0, warAttacks:0, seen:[] };
    const seen = new Set(cache.seen || []);
    for (const attack of attacks) {
      const attackId = String(attack?.id ?? attack?.attack_id ?? '');
      const attackerId = Number(attack?.attacker?.id ?? attack?.attacker_id) || 0;
      if (!attackId || seen.has(attackId) || attackerId !== Number(session.userId)) continue;
      seen.add(attackId); cache.attacks += 1;
      const factionId = Number(attack?.defender?.faction?.id ?? attack?.defender?.faction_id ?? attack?.defender_faction_id) || 0;
      if (attack?.is_ranked_war === true || factionId === Number(active.opponentId)) cache.warAttacks += 1;
    }
    cache.seen = [...seen].slice(-1000);
    dataState.caches.warPersonalStats = cache;
  }

  async function refreshWar(force = false) {
    const current = moduleState.war;
    const cached = dataState.caches.war;
    if (!force && cached?.at && Date.now() - cached.at < 30_000) { current.data = cached; renderWar(); return; }
    current.busy = true; current.error = ''; renderWar();
    try {
      const session = await ensurePermissionSession(false);
      await ensureWarSession(false);
      if (!session.factionId) throw new Error('Your permission session does not include a faction.');
      let activeWar = cached?.activeWar || null;
      if (force || !Number(cached?.detectedAt) || Date.now() - Number(cached.detectedAt) >= 5 * 60_000) {
        const wars = await tornJson(`/v2/faction/${encodeURIComponent(session.factionId)}/rankedwars?sort=desc&limit=10`, 'SLINK PDA ranked war detection');
        const found = currentRankedWar(wars, session.factionId);
        activeWar = found ? { opponentId:found.opponentId, opponentName:found.opponentName, start:found.start, phase:found.start * 1000 <= Date.now() ? 'active' : 'assigned', warId:makeWarId(session.factionId, found.opponentId, found.start) } : null;
      }
      if (!activeWar) {
        current.data = dataState.caches.war = { at:Date.now(), detectedAt:Date.now(), activeWar:null, snapshot:null, outsideTargets:cached?.outsideTargets || [] };
      } else {
        const body = { opponent_faction_id:activeWar.opponentId };
        if (activeWar.phase === 'active') {
          const heartbeat = await productRequest('war', `/api/wars/${encodeURIComponent(activeWar.warId)}/heartbeat`, { method:'POST', body });
          if (heartbeat?.collectStatus && Date.now() - Number(dataState.settings.war.lastStatusAt || 0) >= 30_000) {
            const response = await tornJson(`/v2/faction/${encodeURIComponent(activeWar.opponentId)}/members`, 'SLINK PDA War opponent status');
            const source = response?.members ?? response?.faction?.members ?? [];
            const members = Array.isArray(source) ? source : Object.entries(source || {}).map(([id, row]) => ({ id, ...(row || {}) }));
            if (members.length) {
              await productRequest('war', `/api/wars/${encodeURIComponent(activeWar.warId)}/status`, { method:'POST', body:{ ...body, observedAt:Date.now(), members } });
              dataState.settings.war.lastStatusAt = Date.now();
            }
          }
          if (heartbeat?.collectAttacks && hasGrantedScope('slink.war.faction') && Date.now() - Number(dataState.settings.war.lastAttackAt || 0) >= 30_000) {
            const now = Math.floor(Date.now() / 1000);
            const from = Math.max(now - 600, Number(dataState.settings.war.lastAttackEnded || 0) - 60);
            const response = await tornJson(`/v2/faction/attacks?from=${from}&to=${now}&limit=100&sort=desc`, 'SLINK PDA War attack collection');
            const attacks = warAttackRows(response);
            await productRequest('war', `/api/wars/${encodeURIComponent(activeWar.warId)}/attacks`, { method:'POST', body:{ ...body, attacks } });
            updateWarPersonalStats(attacks, activeWar, session);
            dataState.settings.war.lastAttackAt = Date.now();
            dataState.settings.war.lastAttackEnded = attacks.reduce((maximum, attack) => Math.max(maximum, Number(attack?.ended ?? attack?.ended_at) || 0), Number(dataState.settings.war.lastAttackEnded) || 0);
          }
        }
        const query = new URLSearchParams({ opponent_faction_id:String(activeWar.opponentId), mode:String(dataState.settings.war.mode || 'war'), idle_minutes:String(dataState.settings.war.idleMinutes || 5) });
        const snapshot = await productRequest('war', `/api/wars/${encodeURIComponent(activeWar.warId)}/snapshot?${query}`);
        if (activeWar.phase !== 'active' && !snapshot?.members?.length) {
          const response = await tornJson(`/v2/faction/${encodeURIComponent(activeWar.opponentId)}/members`, 'SLINK PDA scheduled War roster');
          const source = response?.members ?? response?.faction?.members ?? [];
          snapshot.members = Array.isArray(source) ? source : Object.entries(source || {}).map(([id, row]) => ({ id, ...(row || {}) }));
          snapshot.retals = [];
        }
        if (Array.isArray(snapshot?.members)) snapshot.members = await refineWithFfScouter(snapshot.members);
        if (Array.isArray(snapshot?.retals) && snapshot.retals.length) {
          const rows = snapshot.retals.map(retal => ({ id:retal.attackerId, name:retal.attackerName, ...retal }));
          const refined = await refineWithFfScouter(rows);
          snapshot.retals = snapshot.retals.map((retal, index) => ({ ...retal, fairFight:refined[index]?.fairFight ?? refined[index]?.fair_fight ?? retal.fairFight, battleStatsEstimate:refined[index]?.battleStatsEstimate ?? retal.battleStatsEstimate }));
        }
        if (snapshot?.config) {
          dataState.settings.war.mode = snapshot.config.mode || dataState.settings.war.mode;
          dataState.settings.war.idleMinutes = Number(snapshot.config.idleMinutes ?? dataState.settings.war.idleMinutes) || 0;
          dataState.settings.war.insideHitCap = Number(snapshot.config.insideHitCap) || 0;
          dataState.settings.war.insideBlockMode = snapshot.config.insideBlockMode || 'warn';
        }
        let logs = cached?.logs || [];
        let logsAt = Number(cached?.logsAt) || 0;
        if (warOfficer() && activeWar.phase === 'active' && (force || Date.now() - logsAt >= 10 * 60_000)) {
          try {
            const response = await productRequest('war', `/api/wars/${encodeURIComponent(activeWar.warId)}/logs?limit=200&include_stored=1`);
            logs = [...(Array.isArray(response?.stored) ? response.stored : []), ...(Array.isArray(response?.pending) ? response.pending : [])];
            logsAt = Date.now();
          } catch (error) { current.error = `War logs: ${errorMessage(error)}`; }
        }
        let chain = cached?.panelStats?.chain || null;
        try {
          const response = await tornJson('/v2/faction/chain', 'SLINK PDA War chain');
          const value = response?.chain ?? response;
          chain = { current:Number(value?.current ?? value?.hits ?? value?.length) || 0, target:Number(value?.max ?? value?.target) || 0, secondsLeft:Number(value?.timeout ?? value?.seconds_left ?? value?.time_left) || 0 };
        } catch {}
        const personal = dataState.caches.warPersonalStats?.warId === activeWar.warId ? dataState.caches.warPersonalStats : { attacks:0, warAttacks:0 };
        current.data = dataState.caches.war = { at:Date.now(), detectedAt:cached?.activeWar?.warId === activeWar.warId ? Number(cached.detectedAt) || Date.now() : Date.now(), activeWar, snapshot, logs, logsAt, outsideTargets:cached?.outsideTargets || [], panelStats:{ attacks:Number(personal.attacks) || 0, warAttacks:Number(personal.warAttacks) || 0, chain } };
      }
      writeDataState();
    } catch (error) { current.error = errorMessage(error); }
    finally { current.busy = false; renderWar(); }
  }

  async function refreshWarOutside() {
    const current = moduleState.war;
    if (current.outsideBusy) return;
    const settings = dataState.settings.war;
    const root = moduleRoot('war');
    const minimum = Math.max(1, Math.min(3, Number(root?.querySelector('[data-field="war-outside-min"]')?.value ?? settings.outsideMinFF) || 1));
    const maximum = Math.max(1, Math.min(3, Number(root?.querySelector('[data-field="war-outside-max"]')?.value ?? settings.outsideMaxFF) || 3));
    if (minimum > maximum) { current.outsideError = 'Minimum Fair Fight cannot be higher than maximum Fair Fight.'; renderWar(); return; }
    const key = currentFfKey();
    if (!key) { current.outsideError = 'Save an FFScouter API key under Access before polling outside targets.'; renderWar(); return; }
    current.outsideBusy = true; current.outsideError = ''; renderWar();
    try {
      const query = new URLSearchParams({ key, minlevel:'1', maxlevel:'100', inactiveonly:'0', factionless:'0', minff:String(minimum), maxff:String(maximum), limit:'50' });
      const response = await requestJson(`https://ffscouter.com/api/v1/get-targets?${query}`);
      if (response?.error) throw new Error(String(response.error?.message || response.error));
      const now = Math.floor(Date.now() / 1000);
      const rows = (Array.isArray(response?.targets) ? response.targets : []).map(row => {
        const lastAction = Number(row?.last_action ?? row?.lastAction) || 0;
        const hospitalUntil = Number(row?.hospital_until ?? row?.status_until) || 0;
        const minutes = lastAction ? Math.max(0, Math.floor((now - lastAction) / 60)) : null;
        return { id:warMemberId(row), name:String(row?.name || `Player ${warMemberId(row)}`), level:Number(row?.level) || 0, activity:minutes === null ? 'Unknown' : minutes < 5 ? 'Online' : minutes < 15 ? 'Idle' : 'Offline', lastActionRelative:minutes === null ? '' : `${minutes}m ago`, statusState:hospitalUntil > now ? 'Hospital' : 'Unknown', statusUntil:hospitalUntil, fairFight:finite(row?.fair_fight ?? row?.fairFight ?? row?.ff), battleStatsEstimate:finite(row?.bs_estimate ?? row?.battle_stats_estimate ?? row?.total_stats) };
      }).filter(row => row.id > 0).slice(0, 50);
      settings.outsideMinFF = minimum; settings.outsideMaxFF = maximum;
      current.data = dataState.caches.war = { ...(current.data || dataState.caches.war || {}), outsideTargets:rows, at:Number(current.data?.at || dataState.caches.war?.at) || Date.now() };
      writeDataState();
    } catch (error) { current.outsideError = errorMessage(error); }
    finally { current.outsideBusy = false; renderWar(); }
  }

  async function updateWarClaim(operation, targetId = 0) {
    const current = moduleState.war;
    const active = current.data?.activeWar;
    if (!active) return;
    const root = moduleRoot('war');
    if (operation === 'claim') targetId = Number(root?.querySelector('[data-field="war-claim-target"]')?.value) || 0;
    if (!targetId) { current.error = 'Select a med-out target first.'; renderWar(); return; }
    const member = (current.data?.snapshot?.members || []).find(row => warMemberId(row) === targetId);
    const assigneeId = warOfficer() ? Number(root?.querySelector('[data-field="war-claim-assignee"]')?.value) || 0 : 0;
    try {
      const response = await productRequest('war', `/api/wars/${encodeURIComponent(active.warId)}/claims`, { method:'POST', body:{ opponent_faction_id:active.opponentId, operation, targetId, targetName:String(member?.name || `Player ${targetId}`), assigneeId, minutes:30 } });
      current.data.snapshot.claims = Array.isArray(response?.claims) ? response.claims : current.data.snapshot.claims;
      current.error = ''; writeDataState(); renderWar();
    } catch (error) { current.error = errorMessage(error); renderWar(); }
  }

  async function resolveWarArmoryRequest(requestId) {
    const current = moduleState.war;
    const active = current.data?.activeWar;
    if (!active || !requestId) return;
    try {
      const response = await productRequest('war', `/api/wars/${encodeURIComponent(active.warId)}/item-requests`, { method:'POST', body:{ opponent_faction_id:active.opponentId, operation:'resolve', requestId } });
      current.data.snapshot.itemRequests = Array.isArray(response?.itemRequests) ? response.itemRequests : [];
      current.error = ''; writeDataState(); renderWar();
    } catch (error) { current.error = errorMessage(error); renderWar(); }
  }

  async function saveWarOfficerSettings() {
    const current = moduleState.war;
    const active = current.data?.activeWar;
    const root = moduleRoot('war');
    if (!active || !warOfficer()) return;
    const body = { opponent_faction_id:active.opponentId, mode:root?.querySelector('[data-field="war-mode"]')?.value === 'termed' ? 'termed' : 'war', idleMinutes:Math.max(0, Math.min(60, Number(root?.querySelector('[data-field="war-idle"]')?.value) || 0)), insideHitCap:Math.max(0, Math.min(9999, Number(root?.querySelector('[data-field="war-inside-cap"]')?.value) || 0)), insideBlockMode:root?.querySelector('[data-field="war-inside-mode"]')?.value || 'warn' };
    try {
      const response = await productRequest('war', `/api/wars/${encodeURIComponent(active.warId)}/config`, { method:'POST', body });
      const config = response?.config || body;
      current.data.snapshot.config = config;
      Object.assign(dataState.settings.war, { mode:config.mode, idleMinutes:config.idleMinutes, insideHitCap:config.insideHitCap, insideBlockMode:config.insideBlockMode });
      current.error = ''; writeDataState(); renderWar();
    } catch (error) { current.error = errorMessage(error); renderWar(); }
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
    const target = String(statName || '').toLowerCase();
    const direct = personalStatMap(response)[target];
    if (direct !== undefined) return direct;
    const visited = new Set();
    function search(value, depth = 0) {
      if (!value || typeof value !== 'object' || depth > 8 || visited.has(value)) return null;
      visited.add(value);
      if (String(value?.name || '').toLowerCase() === target && finite(value?.value) !== null) return finite(value.value);
      for (const [key, child] of Object.entries(value)) {
        if (String(key).toLowerCase() === target && finite(child) !== null) return finite(child);
        const found = search(child, depth + 1);
        if (found !== null) return found;
      }
      return null;
    }
    return search(response);
  }

  function utcDay(timestamp = Date.now()) {
    return Math.floor(Number(timestamp) / 86_400_000);
  }

  function cooldownSeconds(body, name, fetchedAt) {
    const value = finite(body?.cooldowns?.[name]);
    return value === null ? null : Math.max(0, Math.ceil(value - Math.max(0, Date.now() - fetchedAt) / 1000));
  }

  function apiRows(value, nestedKey) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.[nestedKey])) return value[nestedKey];
    if (value && typeof value === 'object') return Object.values(value);
    return [];
  }

  function raceActive(races, profileStatus = {}, icons = []) {
    const states = apiRows(races, 'races').flatMap(race => [race?.status, race?.state, race?.status?.state, race?.status?.description, race?.description]);
    states.push(profileStatus?.state, profileStatus?.description, profileStatus?.details, typeof profileStatus === 'string' ? profileStatus : '');
    states.push(...apiRows(icons, 'icons').flatMap(icon => [icon?.title, icon?.description, typeof icon === 'string' ? icon : '']));
    return states.some(value => {
      const text = String(value ?? '').trim();
      return /^(?:open|in[_ -]?progress|waiting|scheduled|pending|racing)$/i.test(text)
        || /\bwaiting\s+for\s+(?:a\s+)?race\b/i.test(text)
        || /\b(?:currently\s+)?in\s+(?:a\s+)?race\b/i.test(text)
        || /\b(?:currently\s+)?racing\b/i.test(text)
        || /\brace\s+(?:in[_ -]?progress|waiting|scheduled|pending)\b/i.test(text);
    });
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
    const cityHidden = Number(dataState.settings.alerts.cityDoneDay) === utcDay();
    const profile = body?.profile || {};
    const travel = body?.travel || {};
    const travelSeconds = Number(travel?.arrival_at) * 1_000 > Date.now() ? Math.ceil((Number(travel.arrival_at) * 1_000 - Date.now()) / 1_000) : Math.max(0, Number(travel?.time_left) || 0);
    const away = ['traveling', 'abroad'].includes(String(profile?.status?.state || '').toLowerCase()) || travelSeconds > 0;
    const activeRace = raceActive(body?.races, profile?.status, body?.icons);
    const racewayKnown = body?.enlistedcars !== undefined || body?.races !== undefined || body?.icons !== undefined;
    add('drugCooldown', drug === 0, 'Drug cooldown is clear', 'You can take a drug now.', [['Items','https://www.torn.com/item.php'],['Faction Armory','https://www.torn.com/factions.php?step=your#/tab=armoury']]);
    add('medicalCooldown', medical === 0, 'Medical cooldown is clear', 'Fill a blood bag or use medical supplies.', [['Items','https://www.torn.com/item.php'],['Faction Armory','https://www.torn.com/factions.php?step=your#/tab=armoury']]);
    add('boosterCooldown', booster === 0, 'Booster cooldown is clear', 'You can use a booster now.', [['Items','https://www.torn.com/item.php'],['Faction Armory','https://www.torn.com/factions.php?step=your#/tab=armoury']]);
    add('energyFull', finite(energy.current) !== null && finite(energy.maximum) !== null && Number(energy.current) >= Number(energy.maximum), 'Energy is full', `${number(energy.current)} / ${number(energy.maximum)}`, [['Gym','https://www.torn.com/gym.php']]);
    add('nerveFull', finite(nerve.current) !== null && finite(nerve.maximum) !== null && Number(nerve.current) >= Number(nerve.maximum), 'Nerve is full', `${number(nerve.current)} / ${number(nerve.maximum)}`, [['Crimes','https://www.torn.com/page.php?sid=crimes']]);
    add('energyRefill', refillAvailable(body?.refills, 'energy'), 'Energy refill is unused', 'Your daily point refill is available.', [['Points','https://www.torn.com/points.php'],['Faction Armory','https://www.torn.com/factions.php?step=your#/tab=armoury']]);
    add('nerveRefill', refillAvailable(body?.refills, 'nerve'), 'Nerve refill is unused', 'Your daily point refill is available.', [['Points','https://www.torn.com/points.php'],['Faction Armory','https://www.torn.com/factions.php?step=your#/tab=armoury']]);
    add('missions', missions.length > 0, missions.length >= 3 ? 'Mission cap reached' : `${missions.length} unfinished mission${missions.length === 1 ? '' : 's'}`, missions.length >= 3 ? 'Complete one before another arrives so you do not miss mission credits.' : missions.map(row => row?.title).filter(Boolean).slice(0, 2).join(' / '), [['Missions','https://www.torn.com/page.php?sid=missions']]);
    add('googlePlayPoints', Number(dataState.settings.alerts.googlePlayPointsClaimedAt || 0) + WEEK_MS <= Date.now(), 'Claim your weekly Google Play Points prize', 'Open Google Play Points, claim the weekly prize, then mark it claimed here. This reminder returns seven days after confirmation.', [['Open Google Play Points',GOOGLE_PLAY_POINTS_URL]]);
    add('cityItems', !cityHidden && cityBought !== null && cityBought < 100, 'Buy 100 city items', `${number(cityBought)} / 100 bought since daily reset. Once the shared cap reaches 100, every city-item reminder stops.`, [['City','https://www.torn.com/city.php']]);
    add('raceOrFly', racewayKnown && !activeRace && !away, 'Start a race or take a flight', 'You are on the ground and not entered in an active race.', [['Raceway','https://www.torn.com/page.php?sid=racing'],['Travel','https://www.torn.com/travelagency.php']]);
    add('landing', travelSeconds > 0 && travelSeconds <= 10 * 60, 'Landing soon', `${travel?.destination ? `Arriving in ${travel.destination} in ` : 'Landing in '}${duration(travelSeconds)}`, [['Travel','https://www.torn.com/index.php']]);
    add('organizedCrime', Number(profile?.faction_id || 0) > 0 && (body?.organizedcrime ?? body?.organizedCrime) === null, 'Join an organized crime', 'No current organized crime was returned for your faction membership.', [['Faction crimes','https://www.torn.com/factions.php?step=your#/tab=crimes']]);
    add('education', Boolean(body?.education) && body.education.current === null, 'Start an education course', 'No active education course was returned.', [['Education','https://www.torn.com/education.php']]);
    add('casinoTokens', Number(body?.casino?.tokens) > 0, 'Spend casino tokens', `${number(body.casino.tokens)} token${Number(body.casino.tokens) === 1 ? '' : 's'} available.`, [['Casino','https://www.torn.com/casino.php']]);
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
    const alertTotal = Math.max(0, Number(count) || 0);
    const marketTotal = marketWatchLimit() > 0 ? marketOpportunities(moduleState.market.data || marketRuntime()).length : 0;
    const total = alertTotal + marketTotal;
    const badge = shadow?.querySelector?.('.launcher-alert-count');
    if (!badge) return;
    badge.hidden = total === 0;
    badge.textContent = total > 99 ? '99+' : String(total);
    launcher.classList.toggle('has-alerts', total > 0);
    launcher.setAttribute('aria-label', total > 0 ? `Open SLINK dashboard, ${total} active alert${total === 1 ? '' : 's'}` : 'Open SLINK dashboard');
  }

  function openAlertDestination(href) {
    try {
      const destination = new URL(String(href || ''), global.location.href);
      if (!/^https?:$/.test(destination.protocol)) return false;
      global.location.href = destination.href;
      return true;
    } catch {
      return false;
    }
  }

  function showSystemAlert(alert) {
    const title = `SLINK Efficiency: ${alert.title}`;
    const href = String(alert.href || alert.links?.[0]?.[1] || '');
    const text = `${String(alert.detail || 'Open Torn PDA to review this alert.')}${href ? ' Tap to open.' : ''}`;
    try {
      if (typeof GM_API.notify === 'function') {
        GM_API.notify({ title, text, tag:`slink-efficiency-${alert.id}`, timeout:12_000, ...(href ? { onclick:() => openAlertDestination(href) } : {}) });
        return;
      }
    } catch {}
    try {
      if (typeof global.Notification === 'function' && global.Notification.permission === 'granted') {
        const notification = new global.Notification(title, { body:text, tag:`slink-efficiency-${alert.id}` });
        if (href) notification.onclick = () => { notification.close(); openAlertDestination(href); };
      }
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
    const cityBought = finite(current.data?.cityBought);
    const cityHidden = Number(dataState.settings.alerts.cityDoneDay) === utcDay();
    const cityStatus = cityHidden
      ? 'City reminder hidden until the next daily reset'
      : cityBought === null ? 'City purchase total unavailable'
        : cityBought >= 100 ? 'City cap complete · 100 / 100 bought today'
          : `${number(cityBought)} / 100 city items bought today`;
    updateAlertIndicator(alerts.length);
    root.innerHTML = `<div class="grid"><article class="card full"><div class="card-head"><div><h2>SLINK Efficiency</h2><span class="muted">Direct Torn API timers · no Worker polling</span></div><span class="badge ${alerts.length ? 'warn' : 'ready'}">${alerts.length} active</span></div>
      <div class="module-toolbar"><span>Updated ${relativeTime(current.data?.at)} · checks every 5m while Torn PDA keeps this page alive</span><span>${escapeHtml(cityStatus)}</span></div>${current.error ? moduleMessage(current.error, 'error') : ''}
      <div class="alert-list">${alerts.length ? alerts.map(alert => `<article class="alert"><div><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.detail)}</span></div><div class="target-actions">${alert.links.map(([label, href]) => actionLink(label, href)).join('')}${alert.id === 'cityItems' ? '<button type="button" data-action="hide-city-until-reset">Hide until reset</button>' : ''}${alert.id === 'googlePlayPoints' ? '<button type="button" data-action="claim-google-play-points">Claimed — remind in 7 days</button>' : ''}<button type="button" data-action="snooze-alert" data-alert-id="${escapeHtml(alert.id)}" data-minutes="5">Snooze 5m</button><button type="button" data-action="snooze-alert" data-alert-id="${escapeHtml(alert.id)}" data-minutes="60">Snooze 1h</button></div></article>`).join('') : moduleMessage('Nothing needs your attention right now.')}</div>
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
      const selections = 'bars,cooldowns,travel,education,organizedcrime,refills,missions,casino,profile,races,enlistedcars,icons,stocks,battlestats';
      const day = utcDay();
      const reset = day * 86_400_000;
      const [body, cityCurrent] = await Promise.all([
        tornJson(`/v2/user?selections=${selections}`, 'SLINK PDA efficiency alerts'),
        tornJson('/v2/user/personalstats?stat=cityitemsbought', 'SLINK PDA city item total')
      ]);
      const currentBought = personalStat(cityCurrent, 'cityitemsbought');
      let resetBought = cached?.cityDay === day && Number(cached.cityBaselineVersion) === 2 ? finite(cached.cityAtReset) : null;
      if (resetBought === null) {
        const atReset = await tornJson(`/v2/user/personalstats?stat=cityitemsbought&timestamp=${Math.floor(reset / 1000) - 1}`, 'SLINK PDA city item baseline');
        resetBought = personalStat(atReset, 'cityitemsbought');
      }
      if (currentBought === null || resetBought === null) throw new Error('Torn returned no usable city-item purchase total.');
      let stockCatalog = dataState.caches.stockCatalog?.data || null;
      if (!dataState.caches.stockCatalog?.at || Date.now() - dataState.caches.stockCatalog.at >= 7 * 86_400_000) {
        stockCatalog = await tornJson('/v2/torn/stocks', 'SLINK PDA stock names');
        dataState.caches.stockCatalog = { at:Date.now(), data:stockCatalog };
      }
      current.data = dataState.caches.alerts = { at:Date.now(), body, stockCatalog, cityDay:day, cityBaselineVersion:2, cityTotal:currentBought, cityAtReset:resetBought, cityBought:Math.max(0, currentBought - resetBought) };
      reconcileAlertNotifications(current.data);
      writeDataState();
    } catch (error) { current.error = errorMessage(error); }
    finally { current.busy = false; renderAlerts(); }
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
    const textarea = document.createElement('textarea');
    textarea.value = text; textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.append(textarea); textarea.select();
    const copied = document.execCommand('copy'); textarea.remove();
    return Promise.resolve(copied);
  }

  function factionContainer() {
    const exact = [...document.querySelectorAll('[id^="faction-"]')].find(node => node.querySelector('textarea[placeholder="Type your message here..."],textarea[class*="textarea"]'));
    if (exact) return exact;
    return [...document.querySelectorAll('div,section')].find(node => {
      const composer = node.querySelector('textarea[placeholder*="message" i],[contenteditable="true"]');
      const title = node.querySelector('button span,header span');
      return composer && String(title?.textContent || '').trim().toLowerCase() === 'faction';
    }) || null;
  }

  function factionLauncher() {
    return [...document.querySelectorAll('button,a,[role="button"]')].find(node => {
      const label = [node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.textContent].filter(Boolean).join(' ').trim().toLowerCase();
      return label === 'faction' || label.includes('faction chat') || label.includes('open faction');
    }) || null;
  }

  function factionComposer(container) {
    return container?.querySelector('textarea[placeholder="Type your message here..."],textarea[class*="textarea"],textarea,[contenteditable="true"]') || null;
  }

  async function waitFor(check, timeoutMs = 2_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = check(); if (value) return value;
      await new Promise(resolve => global.setTimeout(resolve, 75));
    }
    return null;
  }

  async function sendToFaction(text) {
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return false;
    let container = factionContainer(); let input = factionComposer(container);
    if (!input) {
      const launcher = factionLauncher(); if (!launcher) return false;
      launcher.click();
      const found = await waitFor(() => { const next = factionContainer(); const field = factionComposer(next); return field ? { next, field } : null; });
      container = found?.next; input = found?.field;
    }
    if (!input || !document.hasFocus()) return false;
    input.focus();
    if (input.matches('textarea,input')) {
      const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) setter.call(input, text); else input.value = text;
    } else input.textContent = text;
    input.dispatchEvent(new Event('input', { bubbles:true, composed:true }));
    input.dispatchEvent(new Event('change', { bubbles:true, composed:true }));
    const send = await waitFor(() => [...(container?.querySelectorAll('button,[role="button"]') || [])].find(button => {
      const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent].filter(Boolean).join(' ').toLowerCase();
      return !button.disabled && (button.type === 'submit' || label.trim() === 'send' || label.includes('send message'));
    }), 1_500);
    if (!send || !document.hasFocus()) return false;
    send.click(); return true;
  }

  function reconcileMarketNotifications(runtime) {
    const deals = marketOpportunities(runtime);
    const currentIds = deals.map(deal => deal.dismissKey);
    const prior = dataState.caches.marketNotificationIds;
    if (Array.isArray(prior)) {
      const seen = new Set(prior.map(String));
      deals.filter(deal => !seen.has(deal.dismissKey)).forEach(deal => showSystemAlert({ id:`market-${deal.id}`, title:`${deal.itemName} at ${marketMoney(deal.price)}`, detail:`${deal.source}: ${deal.detail}`, href:deal.href }));
    }
    dataState.caches.marketNotificationIds = currentIds;
    updateAlertIndicator(alertRows(moduleState.alerts.data).length);
  }

  function marketItemLabel(item) {
    return `${item.name} [${item.id}]${item.shopSellPrice > 0 ? ` · shop sells ${marketMoney(item.shopSellPrice)}${item.shopSellName ? ` at ${item.shopSellName}` : ''}` : ''}`;
  }

  function captureMarketDraft() {
    const root = moduleRoot('market');
    const itemInput = root?.querySelector('[data-field="market-item"]');
    if (!itemInput) return moduleState.market.draft;
    const itemText = String(itemInput.value || '').trim();
    moduleState.market.draft = {
      uid:moduleState.market.editingUid || '',
      marketType:root.querySelector('[data-field="market-type"]')?.value === 'points' ? 'points' : 'item',
      itemText,
      itemId:Number(itemText.match(/\[(\d+)\]/)?.[1]) || 0,
      label:itemText.replace(/\s*\[\d+\].*$/, '').trim(),
      maxPrice:String(root.querySelector('[data-field="market-price"]')?.value || ''),
      priority:normalizeMarketPriority(root.querySelector('[data-field="market-priority"]')?.value),
      marketEnabled:Boolean(root.querySelector('[data-field="market-source"]')?.checked),
      bazaarEnabled:Boolean(root.querySelector('[data-field="bazaar-source"]')?.checked),
      enabled:true
    };
    return moduleState.market.draft;
  }

  function marketSuggestionRows(query, catalog) {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return [];
    const numeric = /^\d+$/.test(needle) ? Number(needle) : 0;
    return catalog.map(item => {
      const name = String(item.name || '').toLowerCase();
      const score = numeric && Number(item.id) === numeric ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : String(item.id).startsWith(needle) ? 3 : 99;
      return { item, score };
    }).filter(row => row.score < 99).sort((a, b) => a.score - b.score || String(a.item.name).localeCompare(String(b.item.name))).slice(0, MARKET_SUGGESTION_LIMIT).map(row => row.item);
  }

  function renderMarketSuggestions(query = '') {
    const root = moduleRoot('market');
    const input = root?.querySelector('[data-field="market-item"]');
    const suggestions = root?.querySelector('[data-market-item-suggestions]');
    if (!input || !suggestions || input.disabled) return;
    const catalog = moduleState.market.data?.catalog?.items || marketRuntime().catalog.items || [];
    const rows = marketSuggestionRows(query || input.value, catalog);
    suggestions.innerHTML = rows.map(item => `<button type="button" data-market-item-option="${item.id}"><strong>${escapeHtml(item.name)} [${item.id}]</strong><small>${item.shopSellPrice > 0 ? `Shop sells ${marketMoney(item.shopSellPrice)}${item.shopSellName ? ` at ${escapeHtml(item.shopSellName)}` : ''}` : `${escapeHtml(item.type || 'Item')} · no shop sell price`}</small></button>`).join('');
    suggestions.hidden = rows.length === 0;
    input.setAttribute('aria-expanded', String(rows.length > 0));
  }

  function selectMarketSuggestion(itemId) {
    const catalog = moduleState.market.data?.catalog?.items || marketRuntime().catalog.items || [];
    const item = catalog.find(row => Number(row.id) === Number(itemId));
    const root = moduleRoot('market');
    const input = root?.querySelector('[data-field="market-item"]');
    const suggestions = root?.querySelector('[data-market-item-suggestions]');
    if (!item || !input) return;
    input.value = marketItemLabel(item);
    if (suggestions) suggestions.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    captureMarketDraft();
  }

  function renderMarketUnlessEditing() {
    const active = shadow?.activeElement;
    if (active?.closest?.('[data-module-root="market"] .market-form')) {
      captureMarketDraft();
      moduleState.market.renderPending = true;
      return;
    }
    moduleState.market.renderPending = false;
    renderMarket();
  }

  function renderMarket(preserveForm = true) {
    const root = moduleRoot('market');
    if (!root) return;
    if (preserveForm) captureMarketDraft();
    const current = moduleState.market;
    const limit = marketWatchLimit();
    if (!limit) { root.innerHTML = `${lockedModule('a slink.adhd.marketwatch tier (.5 through .40)', 'SLINK Market Watch')}${current.error ? moduleMessage(current.error, 'error') : ''}<div class="market-bulk-actions"><button type="button" data-action="refresh-market-permissions" ${current.busy ? 'disabled' : ''}>${current.busy ? 'Refreshing permissions…' : 'Refresh permissions'}</button></div>`; return; }
    const runtime = current.data || marketRuntime();
    const settings = marketSettings();
    const deals = marketOpportunities(runtime);
    const usage = apiUsage();
    const edit = settings.watches.find(watch => watch.uid === current.editingUid) || null;
    const form = current.draft || edit || { marketType:'item', itemId:0, label:'', itemText:'', maxPrice:'', priority:settings.lastPriority, marketEnabled:true, bazaarEnabled:true };
    const catalog = Array.isArray(runtime.catalog?.items) ? runtime.catalog.items : [];
    const selectedItem = catalog.find(item => item.id === Number(form.itemId));
    const itemValue = form.itemText || (selectedItem ? marketItemLabel(selectedItem) : form.label ? `${form.label}${form.itemId ? ` [${form.itemId}]` : ''}` : '');
    const error = current.error || runtime.lastError;
    root.innerHTML = `<div class="grid">
      <article class="card full"><div class="card-head"><div><h2>${edit ? 'Edit market watch' : 'Add a market watch'}</h2></div><button type="button" data-action="refresh-market-permissions" ${current.busy ? 'disabled' : ''}>Refresh permissions</button><span class="badge ${current.busy ? 'warn' : 'ready'}">${settings.watches.length} / ${limit}</span></div>
        ${error ? moduleMessage(error, 'error') : ''}
        <div class="market-form">
          <label>Watch type<select data-field="market-type"><option value="item" ${form.marketType === 'item' ? 'selected' : ''}>Item</option><option value="points" ${form.marketType === 'points' ? 'selected' : ''}>Points Market</option></select></label>
          <div class="market-item-field"><label for="slink-market-item-input">Item</label><div class="market-item-picker"><input id="slink-market-item-input" type="text" data-field="market-item" value="${escapeHtml(itemValue)}" placeholder="Type an item name" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" ${form.marketType === 'points' ? 'disabled' : ''}><div class="market-item-suggestions" data-market-item-suggestions role="listbox" hidden></div></div><small>${catalog.length ? `Type a name or ID to search ${number(catalog.length)} API catalog items.` : 'Loading Torn item names and shop sell prices automatically…'}</small></div>
          <label>Maximum price<input type="number" inputmode="numeric" min="1" step="1" data-field="market-price" value="${form.maxPrice || ''}" placeholder="Target price"></label>
          <label>Priority<select data-field="market-priority"><option value="high" ${form.priority === 'high' ? 'selected' : ''}>High</option><option value="normal" ${form.priority === 'normal' ? 'selected' : ''}>Normal</option><option value="low" ${form.priority === 'low' ? 'selected' : ''}>Low</option></select></label>
          <fieldset class="market-sources" ${form.marketType === 'points' ? 'disabled' : ''}><legend>Sources</legend><label><input type="checkbox" data-field="market-source" ${form.marketEnabled ? 'checked' : ''}> Item Market</label><label><input type="checkbox" data-field="bazaar-source" ${form.bazaarEnabled ? 'checked' : ''}> Weaver Bazaar</label></fieldset>
          <div class="market-form-actions"><button type="button" data-action="save-market-watch">${edit ? 'Update watch' : 'Save watch'}</button><button type="button" data-action="clear-market-form">Clear</button></div>
        </div>
        <div class="market-options"><label><input type="checkbox" data-field="market-enabled" ${settings.enabled ? 'checked' : ''}> Run market watches while Torn/PDA keeps this userscript alive</label><label><input type="checkbox" data-field="market-quick-buy" ${settings.quickBuyEnabled ? 'checked' : ''}> Add SLINK Buy over highlighted native buy/cart controls</label></div>
      </article>
      <article class="card full"><div class="card-head"><div><h2>Active deals</h2><span class="muted">Updated ${relativeTime(runtime.fetchedAt)} · Torn API ${usage.count}/${usage.limit} in the shared rolling minute</span></div><span class="badge ${deals.length ? 'ready' : ''}">${deals.length}</span></div>
        <div class="market-bulk-actions"><button type="button" data-action="copy-market-list" ${deals.length ? '' : 'disabled'}>Copy item list</button><button type="button" data-action="send-market-list" ${deals.length ? '' : 'disabled'}>Send list to Faction</button></div>
        <div class="market-deals">${deals.length ? deals.map(deal => `<article class="market-deal"><strong>${escapeHtml(deal.source)} · ${escapeHtml(deal.itemName)}</strong><span>${escapeHtml(deal.detail)}</span><div class="target-actions"><a href="${escapeHtml(deal.href)}">Open &amp; highlight</a><button type="button" data-action="copy-market-deal" data-market-deal="${escapeHtml(deal.id)}">Copy</button><button type="button" data-action="send-market-deal" data-market-deal="${escapeHtml(deal.id)}">Send to Faction</button><button type="button" data-action="dismiss-market-deal" data-market-dismiss="${escapeHtml(deal.dismissKey)}">Dismiss 5m</button></div></article>`).join('') : '<div class="module-message">No watched listing is currently at or below its target.</div>'}</div>
      </article>
      <article class="card full"><div class="card-head"><div><h2>Configured watches</h2><span class="muted">High follows Torn cache timestamp + API delay + 1 second; normal reserves 10 calls/min and low reserves 20 for other features.</span></div></div><div class="market-watch-grid">${settings.watches.length ? settings.watches.map(watch => { const item = catalog.find(row => row.id === watch.itemId); const sell = item?.shopSellPrice > 0 ? ` · shop sells ${marketMoney(item.shopSellPrice)}${item.shopSellName ? ` at ${item.shopSellName}` : ''}` : ''; return `<article class="market-watch"><strong>${escapeHtml(watch.label || 'Points Market')}${watch.itemId ? ` [${watch.itemId}]` : ''}</strong><span>Target ${marketMoney(watch.maxPrice)} · ${escapeHtml(watch.priority)} · ${watch.marketType === 'points' ? 'Points Market' : [watch.marketEnabled && 'Item Market', watch.bazaarEnabled && 'Weaver Bazaar'].filter(Boolean).join(' + ')}${escapeHtml(sell)}</span><div class="target-actions"><button type="button" data-action="edit-market-watch" data-market-watch="${escapeHtml(watch.uid)}">Edit</button><button class="danger" type="button" data-action="remove-market-watch" data-market-watch="${escapeHtml(watch.uid)}">Remove</button></div></article>`; }).join('') : '<div class="module-message">No watches saved yet.</div>'}</div></article>
    </div>`;
    updateAlertIndicator(alertRows(moduleState.alerts.data).length);
  }

  function readMarketForm() {
    const root = moduleRoot('market');
    const type = root?.querySelector('[data-field="market-type"]')?.value === 'points' ? 'points' : 'item';
    const catalog = moduleState.market.data?.catalog?.items || marketRuntime().catalog.items || [];
    const itemText = String(root?.querySelector('[data-field="market-item"]')?.value || '').trim();
    const bracketId = Number(itemText.match(/\[(\d+)\]/)?.[1]) || 0;
    const exact = catalog.find(item => item.id === bracketId) || catalog.find(item => item.name.toLowerCase() === itemText.toLowerCase());
    return normalizeMarketWatch({
      uid:moduleState.market.editingUid || undefined,
      marketType:type,
      itemId:type === 'points' ? 0 : exact?.id || bracketId,
      label:type === 'points' ? 'Points' : exact?.name || itemText.replace(/\s*\[\d+\].*$/, '').trim(),
      maxPrice:Number(root?.querySelector('[data-field="market-price"]')?.value) || 0,
      priority:root?.querySelector('[data-field="market-priority"]')?.value,
      marketEnabled:root?.querySelector('[data-field="market-source"]')?.checked,
      bazaarEnabled:root?.querySelector('[data-field="bazaar-source"]')?.checked
    });
  }

  function saveMarketWatch() {
    const settings = marketSettings(); const limit = marketWatchLimit(); const watch = readMarketForm();
    if (!(watch.maxPrice > 0)) { moduleState.market.error = 'Enter a maximum price greater than zero.'; renderMarket(); return; }
    const catalog = moduleState.market.data?.catalog?.items || marketRuntime().catalog.items || [];
    if (watch.marketType === 'item' && (!(watch.itemId > 0) || !catalog.some(item => Number(item.id) === watch.itemId))) { moduleState.market.error = 'Choose an item from the API-loaded name list.'; renderMarket(); return; }
    if (watch.marketType === 'item' && !watch.marketEnabled && !watch.bazaarEnabled) { moduleState.market.error = 'Choose Item Market, Weaver Bazaar, or both.'; renderMarket(); return; }
    const index = settings.watches.findIndex(row => row.uid === watch.uid);
    if (index < 0 && settings.watches.length >= limit) { moduleState.market.error = `Your permission allows ${limit} watches.`; renderMarket(); return; }
    if (index >= 0) settings.watches[index] = watch; else settings.watches.push(watch);
    settings.lastPriority = watch.priority; moduleState.market.editingUid = ''; moduleState.market.draft = null; moduleState.market.error = '';
    const runtime = marketRuntime(); delete runtime.results[watch.uid]; dataState.caches.market = runtime;
    writeDataState(); renderMarket(false); void refreshMarket(false);
  }

  function marketPurchasePage() {
    const url = new URL(location.href); const joined = `${url.search}&${url.hash}`;
    const itemId = Number(joined.match(/(?:itemID|itemId)=(\d+)/i)?.[1] || url.searchParams.get('itemId')) || 0;
    const price = Number(joined.match(/slinkPrice=(\d+)/i)?.[1] || url.searchParams.get('price')) || 0;
    const bazaar = url.pathname.toLowerCase().endsWith('/bazaar.php');
    const market = String(url.searchParams.get('sid') || '').toLowerCase() === 'itemmarket' || /itemmarket/i.test(url.pathname) || /(?:^|\/)itemmarket(?:\/|$)/i.test(url.hash.replace(/^#\/?/, ''));
    return bazaar || market ? { itemId, price, bazaar, market, linked:itemId > 0 && price > 0 && (market || url.searchParams.get('slinkHighlight') === '1') } : null;
  }

  function marketNodePrice(node) {
    const text = String(node.querySelector('[data-testid="price"],[class*="price___"]')?.textContent || node.textContent || '');
    const match = text.match(/\$\s*([\d,]+(?:\.\d+)?)/) || text.match(/^\s*([\d,]+(?:\.\d+)?)/);
    return match ? Number(match[1].replaceAll(',', '')) : 0;
  }

  function marketNodeItemId(node) {
    const declared = Number(node?.dataset?.itemId || node?.getAttribute?.('data-item-id')) || 0;
    if (declared > 0) return Math.trunc(declared);
    const image = node.querySelector('img[src*="/images/items/"],img[srcset*="/images/items/"]');
    const imageId = Number(`${image?.getAttribute?.('src') || ''} ${image?.getAttribute?.('srcset') || ''}`.match(/\/images\/items\/(\d+)\//i)?.[1]) || 0;
    if (imageId > 0) return imageId;
    const href = node.querySelector('a[href*="itemID=" i],a[href*="itemId=" i]')?.getAttribute('href') || '';
    return Number(href.match(/(?:itemID|itemId)=(\d+)/i)?.[1]) || 0;
  }

  function marketPageItemId(page) {
    if (page.itemId > 0) return page.itemId;
    const main = document.querySelector('#mainContainer,#main-container,[data-testid="main-content"],main[role="main"],main');
    const ids = [...new Set([...(main?.querySelectorAll('img[src*="/images/items/"],img[srcset*="/images/items/"]') || [])].map(image => Number(`${image.getAttribute('src') || ''} ${image.getAttribute('srcset') || ''}`.match(/\/images\/items\/(\d+)\//i)?.[1]) || 0).filter(Boolean))];
    return ids.length === 1 ? ids[0] : 0;
  }

  function marketPurchaseNodes(page) {
    if (page.bazaar) {
      const container = document.querySelector('[data-testid="bazaar-items"]'); if (!container) return [];
      const direct = [...container.querySelectorAll('[data-testid="item"]')];
      return direct.length ? direct : [...new Set([...container.querySelectorAll('img[src*="/images/items/"],img[srcset*="/images/items/"]')].map(image => image.closest('[class*="item___"],article,li')).filter(Boolean))];
    }
    const rows = [...document.querySelectorAll('ul[class*="sellerList___"] li[class*="rowWrapper___"],[data-testid="seller-row"],[data-testid="market-listing"]')].filter(node => node.querySelector('[class*="sellerRow___"],[class*="price___"],[data-testid="price"]'));
    if (rows.length) return [...new Set(rows)];
    return [...new Set([...document.querySelectorAll('button[class*="buyButton___"],button[aria-label^="Buy "]')].map(button => button.closest('li,article,[class*="rowWrapper___"]')).filter(Boolean))];
  }

  function marketNodeUnavailable(node) {
    if (node.matches('[aria-disabled="true"],[data-disabled="true"],[class*="disabled" i],[class*="unavailable" i],[class*="soldOut" i]') || node.querySelector('[class*="isBlockedForBuying"],#isBlockedForBuyingTooltip')) return true;
    if (/\b(?:cannot buy|can't buy|unavailable|sold out|purchase limit|buy limit)\b/i.test(String(node.textContent || ''))) return true;
    const controls = [...node.querySelectorAll('button,[role="button"]')].filter(button => !button.matches('[data-slink-market-buy]') && (/\b(?:buy|purchase)\b/i.test(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`) || button.matches('[class*="buyButton___"],[class*="controlPanelButton___"]')));
    return controls.length > 0 && !controls.some(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true');
  }

  function marketFillMaximum(node, price) {
    const input = node.querySelector('input[data-testid="legacy-money-input"]:not([type="hidden"]),input.input-money:not([type="hidden"]),input[type="number"]');
    if (!input || input.disabled || input.readOnly) return;
    const stock = Number(String(input.dataset?.money || '').replace(/[^\d]/g, '')) || Number(String(node.textContent || '').match(/([\d,]+)\s+(?:available|in stock)/i)?.[1]?.replaceAll(',', '')) || Number(input.max) || 1;
    const availableMoney = Number(String(document.querySelector('#user-money')?.dataset?.money || '').replace(/[^\d]/g, '')) || Number.POSITIVE_INFINITY;
    const maximum = Math.max(1, Math.min(stock, Number.isFinite(availableMoney) && price > 0 ? Math.floor(availableMoney / price) : stock));
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, String(maximum)); else input.value = String(maximum);
    input.dispatchEvent(new Event('input', { bubbles:true })); input.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function ensureMarketQuickBuyLayer() {
    if (marketQuickBuyLayer?.isConnected) return marketQuickBuyLayer;
    marketQuickBuyLayer = document.createElement('div'); marketQuickBuyLayer.dataset.slinkMarketBuyLayer = 'true';
    marketQuickBuyLayer.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none'; document.body.appendChild(marketQuickBuyLayer); return marketQuickBuyLayer;
  }

  function positionMarketQuickBuy(button, native) {
    if (!button?.isConnected || !native?.isConnected) return;
    const rect = native.getBoundingClientRect(); const hidden = rect.width <= 0 || rect.height <= 0 || rect.right < 0 || rect.bottom < 0 || rect.left > innerWidth || rect.top > innerHeight;
    button.style.display = hidden ? 'none' : 'flex'; if (hidden) return;
    button.style.left = `${Math.round(rect.left * 10) / 10}px`; button.style.top = `${Math.round(rect.top * 10) / 10}px`; button.style.width = `${Math.round(rect.width * 10) / 10}px`; button.style.height = `${Math.round(rect.height * 10) / 10}px`;
  }

  function syncMarketQuickBuyPositions() {
    if (marketPositionFrame) return;
    marketPositionFrame = global.requestAnimationFrame(() => { marketPositionFrame = null; marketQuickBuys.forEach((spec, native) => positionMarketQuickBuy(spec.button, native)); });
  }

  function removeMarketQuickBuy(native) {
    marketQuickBuys.get(native)?.button?.remove(); native?.removeAttribute?.('data-slink-market-buy-native'); marketQuickBuys.delete(native);
    if (!marketQuickBuys.size) { marketQuickBuyLayer?.remove(); marketQuickBuyLayer = null; }
  }

  function clearMarketQuickBuys() {
    [...marketQuickBuys.keys()].forEach(removeMarketQuickBuy); document.querySelectorAll('[data-slink-market-buy]').forEach(button => button.remove()); marketQuickBuyLayer?.remove(); marketQuickBuyLayer = null;
  }

  function installMarketQuickBuy(node, price) {
    if (!marketSettings().quickBuyEnabled) return null;
    const native = [...node.querySelectorAll('button,[role="button"]')].find(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true' && !button.matches('[data-slink-market-buy]') && (/\b(?:buy|purchase)\b/i.test(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`) || button.matches('[class*="buyButton___"],[class*="controlPanelButton___"]')));
    if (!native) return null;
    const existing = marketQuickBuys.get(native); if (existing) { existing.node = node; existing.price = price; positionMarketQuickBuy(existing.button, native); return native; }
    const button = document.createElement('button'); button.type = 'button'; button.dataset.slinkMarketBuy = 'true'; button.textContent = 'SLINK Buy'; button.title = 'SLINK Buy maximum available quantity';
    button.style.cssText = 'position:fixed;box-sizing:border-box;display:flex;align-items:center;justify-content:center;margin:0;padding:0 3px;border:1px solid rgba(255,255,255,.32);border-radius:4px;background:linear-gradient(#b9ff68,#68c51d);box-shadow:inset 0 1px rgba(255,255,255,.48),0 0 7px rgba(112,255,40,.55);color:#111;font:700 10px/1.1 Arial,sans-serif;text-align:center;text-transform:uppercase;overflow:hidden;cursor:pointer;pointer-events:auto';
    button.addEventListener('click', event => { if (!event.isTrusted || document.visibilityState !== 'visible' || !document.hasFocus()) return; event.preventDefault(); event.stopImmediatePropagation(); const spec = marketQuickBuys.get(native); if (!spec || native.disabled) return; marketFillMaximum(spec.node, spec.price); native.click(); [40, 160, 450].forEach(delay => global.setTimeout(scheduleMarketDomFormat, delay)); });
    native.dataset.slinkMarketBuyNative = 'true'; ensureMarketQuickBuyLayer().appendChild(button); marketQuickBuys.set(native, { button, node, price }); positionMarketQuickBuy(button, native); return native;
  }

  function formatMarketPurchasePage() {
    const page = marketPurchasePage();
    const cleanup = node => { ['data-slink-market-highlight','data-slink-market-targeted','data-slink-market-shop-profit','data-slink-market-one-dollar','data-slink-market-reason'].forEach(name => node.removeAttribute(name)); node.style.removeProperty('outline'); node.style.removeProperty('outline-offset'); node.style.removeProperty('box-shadow'); marketQuickBuys.forEach((spec, native) => { if (spec.node === node) removeMarketQuickBuy(native); }); };
    if (!page || marketWatchLimit() <= 0) { document.querySelectorAll('[data-slink-market-highlight]').forEach(cleanup); clearMarketQuickBuys(); return; }
    const catalog = moduleState.market.data?.catalog?.items || marketRuntime().catalog.items || [];
    const nodes = marketPurchaseNodes(page); const matched = new Set(); const activeBuys = new Set();
    for (const node of nodes) {
      const price = marketNodePrice(node); const itemId = marketNodeItemId(node) || marketPageItemId(page);
      const image = node.querySelector('img[src*="/images/items/"],img[srcset*="/images/items/"]'); const name = String(node.querySelector('[data-testid="name"]')?.textContent || image?.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const item = catalog.find(row => row.id === itemId) || catalog.find(row => name && row.name.toLowerCase() === name);
      const available = !marketNodeUnavailable(node); const targeted = page.linked && (page.itemId <= 0 || itemId <= 0 || itemId === page.itemId) && price === page.price; const oneDollar = available && price === 1; const shopProfit = available && price > 0 && Number(item?.shopSellPrice) > 0 && price < Number(item.shopSellPrice);
      if (!targeted && !oneDollar && !shopProfit) { if (node.hasAttribute('data-slink-market-highlight')) cleanup(node); continue; }
      matched.add(node); node.dataset.slinkMarketHighlight = targeted ? 'targeted' : shopProfit ? 'shop-profit' : 'one-dollar'; node.toggleAttribute('data-slink-market-targeted', targeted); node.toggleAttribute('data-slink-market-shop-profit', shopProfit); node.toggleAttribute('data-slink-market-one-dollar', oneDollar);
      const color = targeted || oneDollar ? '#39ff14' : '#ff4fbd'; const glow = targeted || oneDollar ? 'rgba(57,255,20,.72)' : 'rgba(255,79,189,.68)'; node.style.setProperty('outline', `4px solid ${color}`, 'important'); node.style.setProperty('outline-offset', '2px', 'important'); node.style.setProperty('box-shadow', `0 0 18px 5px ${glow}`, 'important'); node.dataset.slinkMarketReason = targeted ? 'SLINK API-matched listing' : shopProfit ? `Below city shop sell price (${marketMoney(item.shopSellPrice)})` : '$1 purchase opportunity';
      if (available) { const native = installMarketQuickBuy(node, price); if (native) activeBuys.add(native); }
    }
    document.querySelectorAll('[data-slink-market-highlight]').forEach(node => { if (!matched.has(node)) cleanup(node); }); marketQuickBuys.forEach((_spec, native) => { if (!activeBuys.has(native)) removeMarketQuickBuy(native); });
  }

  function scheduleMarketDomFormat() {
    if (marketFormatTimer) return;
    marketFormatTimer = global.setTimeout(() => { marketFormatTimer = null; formatMarketPurchasePage(); }, 80);
  }

  function cleanAwardText(value) {
    return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  function numericRequirementText(award) {
    const units = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19 };
    const tens = { twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };
    const word = '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)';
    return cleanAwardText(award?.description || award?.name).replace(new RegExp(`\\b${word}(?:[ -]+${word})*\\b`, 'gi'), phrase => {
      let value = 0;
      for (const token of phrase.toLowerCase().split(/[ -]+/)) {
        if (Object.hasOwn(units, token)) value += units[token];
        else if (Object.hasOwn(tens, token)) value += tens[token];
        else if (token === 'hundred') value = Math.max(1, value) * 100;
      }
      return String(value);
    });
  }

  function awardTargets(award) {
    const matches = numericRequirementText(award).match(/\$?\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:thousand|million|billion|trillion|mil|bn|[kmbt])\b|\s*(?:st|nd|rd|th)\b)?/gi) || [];
    const multipliers = { k:1e3, thousand:1e3, m:1e6, mil:1e6, million:1e6, b:1e9, bn:1e9, billion:1e9, t:1e12, trillion:1e12 };
    return matches.map(match => {
      const clean = match.toLowerCase().replace(/[$,\s]/g, '').replace(/(?:st|nd|rd|th)$/i, '');
      const unit = clean.match(/(thousand|million|billion|trillion|mil|bn|[kmbt])$/i)?.[1]?.toLowerCase() || '';
      return Number(unit ? clean.slice(0, -unit.length) : clean) * (multipliers[unit] || 1);
    }).filter(Number.isFinite);
  }

  function awardFamily(award) {
    const text = numericRequirementText(award).toLowerCase().replace(/\b(year|month|week|day|hour|minute|second)s?\b/g, '$1');
    if (/\breach (?:the )?rank of\b/.test(text)) return `${award.kind}|${award?.type?.id ?? award?.type?.title ?? ''}|player-rank`;
    if (!awardTargets(award).length) return '';
    return `${award.kind}|${award?.type?.id ?? award?.type?.title ?? ''}|${text.replace(/\$?\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:thousand|million|billion|trillion|mil|bn|[kmbt])\b|\s*(?:st|nd|rd|th)\b)?/gi, '#').replace(/\s+/g, ' ').trim()}`;
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
    const families = new Map();
    for (const award of catalog.map(row => ({ ...row, key:`${row.kind}:${row.id}` }))) {
      const familyKey = awardFamily(award) || `unique:${award.key}`;
      if (!families.has(familyKey)) families.set(familyKey, []);
      families.get(familyKey).push(award);
    }
    const goals = [];
    for (const family of families.values()) {
      family.sort((a, b) => {
        const left = awardTargets(a), right = awardTargets(b);
        for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
          if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) - (right[index] || 0);
        }
        return Number(a.id) - Number(b.id);
      });
      const pinnedKey = family.find(award => pinned.has(award.key))?.key || '';
      goals.push({
        ...family[0],
        pinned:Boolean(pinnedKey),
        pinKey:pinnedKey || family[0].key,
        laterMilestones:family.slice(1).map(award => ({ name:String(award.name), targets:awardTargets(award) }))
      });
    }
    return goals.sort((a, b) => Number(b.pinned) - Number(a.pinned)
      || String(a?.type?.title || '').localeCompare(String(b?.type?.title || ''))
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
    root.innerHTML = `<div class="grid"><article class="card full"><div class="card-head"><div><h2>Merit farm</h2><span class="muted">Only the next incomplete award in each milestone family is shown; later tiers stay summarized on its tile.</span></div><span class="badge ready">${(dataState.settings.merits.pinned || []).length} / 3 pinned</span></div>
      <div class="module-toolbar"><span>Updated ${relativeTime(current.data?.at)} · ${number(goals.length)} next milestones · page ${page} / ${totalPages}</span><label>Show <select data-field="merit-filter"><option value="all" ${filter === 'all' ? 'selected' : ''}>All</option><option value="medal" ${filter === 'medal' ? 'selected' : ''}>Medals</option><option value="honor" ${filter === 'honor' ? 'selected' : ''}>Honors</option></select></label><label>Refresh <select data-field="merit-refresh"><option value="15" ${Number(dataState.settings.merits.refreshMinutes) === 15 ? 'selected' : ''}>15m</option><option value="30" ${Number(dataState.settings.merits.refreshMinutes) === 30 ? 'selected' : ''}>30m</option><option value="60" ${Number(dataState.settings.merits.refreshMinutes) === 60 ? 'selected' : ''}>1h</option></select></label></div>${current.error ? moduleMessage(current.error, 'error') : ''}
      <div class="merit-list">${visibleGoals.length ? visibleGoals.map(award => { const later = award.laterMilestones || []; const shown = later.slice(0, 8); return `<article class="merit merit-row"><div class="award-emblem ${escapeHtml(award.kind)}" aria-hidden="true">${award.kind === 'medal' ? '★' : 'H'}</div><div class="merit-copy"><strong>${escapeHtml(award.name)}</strong><small>${escapeHtml(award?.type?.title || (award.kind === 'medal' ? 'Medal' : 'Honor'))}</small><span>${escapeHtml(cleanAwardText(award.description) || `${award.kind} ${award.id}`)}</span>${later.length ? `<span class="merit-later">Later: ${escapeHtml(shown.map(row => row.targets.length ? row.targets.map(value => number(value)).join(' / ') : row.name).join(' · '))}${later.length > shown.length ? ` · +${later.length - shown.length} more` : ''}</span>` : ''}</div><button type="button" data-action="pin-merit" data-merit-key="${escapeHtml(award.pinKey)}">${award.pinned ? 'Unpin' : 'Pin'}</button></article>`; }).join('') : moduleMessage('No incomplete awards match this filter.')}</div>
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
    const loaders = { leveling:refreshLeveling, war:refreshWar, stats:refreshStats, alerts:refreshAlerts, market:refreshMarket, merits:refreshMerits };
    if (loaders[name] && !moduleState[name].busy) await loaders[name](force);
  }

  function renderAllModules() {
    renderAccess(); renderLeveling(); renderWar(); renderStats(); renderAlerts(); renderMarket(); renderMerits(); renderThemeChoices(); applyPermissionGates();
  }

  function startScheduler() {
    if (schedulerTimer) return;
    schedulerTimer = global.setInterval(() => {
      const canRefreshAlerts = Boolean(currentApiKey() && hasGrantedScope('slink.adhd.alerts') && (validSession('permission') || termsAccepted('permission')));
      if (canRefreshAlerts && !moduleState.alerts.busy && Date.now() - moduleState.alerts.lastAttemptAt >= 5 * 60_000) void refreshAlerts(false);
      const canRefreshMarket = Boolean(currentApiKey() && marketWatchLimit() > 0 && marketSettings().enabled);
      if (canRefreshMarket && !moduleState.market.busy && Date.now() - moduleState.market.lastAttemptAt >= 15_000) void refreshMarket(false);
      const canRefreshWar = Boolean(currentApiKey() && hasGrantedScope('slink.war') && (validSession('war') || termsAccepted('war')));
      if (canRefreshWar && !moduleState.war.busy && (dataState.caches.war?.activeWar || Date.now() - Number(dataState.caches.war?.detectedAt || 0) >= 5 * 60_000)) void refreshWar(false);
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
    .overlay[hidden]{display:none}.overlay{position:fixed;inset:0;z-index:2147483646;display:grid;width:100%;max-width:none;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;background:var(--s-page);color:var(--s-text);font:13px/1.42 Arial,sans-serif;overscroll-behavior:contain}
    .topbar{display:flex;align-items:center;gap:10px;min-height:64px;padding:max(9px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 9px max(14px,env(safe-area-inset-left));border-bottom:1px solid var(--s-border);background:color-mix(in srgb,var(--s-bg) 94%,transparent);box-shadow:0 7px 22px var(--s-shadow);touch-action:pan-x}
    .brand-mark{display:grid;width:39px;height:39px;flex:0 0 auto;place-items:center;border-radius:10px;background:linear-gradient(145deg,var(--s-accent),var(--s-bg));box-shadow:inset 0 0 0 1px var(--s-border),0 0 13px color-mix(in srgb,var(--s-alt) 30%,transparent);font-weight:900}
    .brand{min-width:0;flex:1}.brand strong,.brand span{display:block}.brand strong{font-size:15px}.brand span{overflow:hidden;color:var(--s-muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
    .prototype{padding:4px 7px;border:1px solid var(--s-warning);border-radius:999px;color:var(--s-warning);font-size:9px;font-weight:700;white-space:nowrap}
    .close{display:flex;align-items:center;justify-content:center;gap:5px;min-width:46px;padding:0 12px;font-size:14px}.close>span:first-child{font-size:22px}.close-label{font-weight:700}
    .primary-nav{display:flex;gap:7px;padding:8px max(14px,env(safe-area-inset-right)) 8px max(14px,env(safe-area-inset-left));border-bottom:1px solid var(--s-soft);background:color-mix(in srgb,var(--s-panel) 93%,transparent)}
    .primary-nav button{min-width:105px;padding:7px 17px;color:var(--s-muted);font-weight:700}.primary-nav button[aria-selected="true"]{border-color:var(--s-alt);background:linear-gradient(135deg,var(--s-accent),var(--s-control));color:var(--s-text);box-shadow:0 0 12px color-mix(in srgb,var(--s-alt) 22%,transparent)}
    .scroll{width:100%;min-width:0;min-height:0;overflow:auto;overflow-anchor:none;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:14px max(14px,calc((100vw - 1240px)/2)) max(24px,env(safe-area-inset-bottom))}
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
    .later{color:var(--s-muted);font-size:10px}.theme-row{display:flex;gap:7px;flex-wrap:wrap}.theme-row button{display:flex;align-items:center;gap:7px;padding:7px 11px}.theme-row button[aria-selected="true"]{outline:2px solid var(--s-alt);outline-offset:1px}.theme-swatch{width:29px;height:15px;border:1px solid var(--s-soft);border-radius:999px;background:linear-gradient(90deg,var(--c1) 0 33%,var(--c2) 33% 67%,var(--c3) 67%);box-shadow:0 0 5px var(--s-shadow)}
    .recovery{display:grid;gap:8px}.recovery code{padding:3px 5px;border-radius:4px;background:var(--s-bg);color:var(--s-alt)}
    .module-message{padding:11px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg);color:var(--s-muted)}.module-message.error{border-color:var(--s-error);color:var(--s-error)}.module-message.locked{border-color:var(--s-warning);color:var(--s-warning)}
    .module-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-bottom:10px}.module-toolbar>span{min-width:0;flex:1;color:var(--s-muted)}.module-toolbar button{padding:6px 12px}
    .access-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.access-form label{display:grid;gap:4px;color:var(--s-muted)}.access-form .wide{grid-column:1/-1}.access-form input,.access-form select{width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--s-border);border-radius:8px;background:var(--s-bg);color:var(--s-text)}.access-form input[type="checkbox"]{width:20px;min-height:20px;margin:1px 0}.check-row{display:flex!important;grid-template-columns:none!important;align-items:flex-start;gap:8px!important;color:var(--s-text)!important}.access-actions{display:flex;flex-wrap:wrap;gap:7px}.access-actions button{padding:7px 12px}.danger{border-color:var(--s-error);color:var(--s-error)}
    .terms-list,.scope-list{display:flex;flex-wrap:wrap;gap:6px}.terms-list a,.scope-list span,.action-link{display:inline-flex;align-items:center;min-height:32px;padding:5px 8px;border:1px solid var(--s-soft);border-radius:7px;background:var(--s-bg);color:var(--s-alt);text-decoration:none}.scope-list span{color:var(--s-text)}.scope-details summary{min-height:40px;padding:9px;border:1px solid var(--s-soft);border-radius:7px;background:var(--s-bg);cursor:pointer}.scope-details[open] summary{margin-bottom:8px}
    .target-actions{display:flex;flex-wrap:wrap;gap:6px}.target-actions a,.alert a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:5px 10px;border:1px solid var(--s-border);border-radius:7px;background:var(--s-control);color:var(--s-text);text-decoration:none}.target-actions button,.alert button{padding:5px 10px}
    .target-stack{display:grid;gap:7px}.target-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:10px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg)}.target-card strong,.target-card small{display:block}.target-card small{color:var(--s-muted)}.mug-report{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:9px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg)}.mug-report>div{min-width:0;flex:1}.mug-report strong,.mug-report span{display:block}.mug-report span{color:var(--s-muted);font-size:10px}.mug-report button{padding:5px 10px}
    .war-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(76px,1fr));gap:5px;margin-bottom:9px}.war-tabs button{display:flex;align-items:center;justify-content:center;gap:5px;min-width:0;padding:5px}.war-tabs button[aria-selected="true"]{border-color:var(--s-alt);background:var(--s-accent)}.nav-count{display:grid;min-width:19px;height:19px;padding:0 4px;place-items:center;border:2px solid #090909;border-radius:99px;background:#e32727;color:#fff;font:bold 9px/1 Arial,sans-serif}.war-tab-body{margin-top:9px}.war-stack{display:grid;gap:7px}.war-card{position:relative;display:grid;gap:7px;padding:9px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg)}.war-card-head{display:flex;align-items:center;gap:7px;padding-bottom:6px;border-bottom:1px solid var(--s-soft)}.war-card-head>a,.war-card-head>strong{min-width:0;flex:1;color:var(--s-text);font-weight:800;text-decoration:none}.war-card-head>span{color:var(--s-muted);white-space:nowrap}.war-meta{display:flex;align-items:stretch;flex-wrap:wrap;gap:5px}.war-pill{display:inline-flex;align-items:center;min-height:24px;padding:3px 7px;border:1px solid var(--s-soft);border-radius:99px;background:var(--s-control)}.war-pill.online{color:var(--s-ready)}.war-pill.hospital{color:var(--s-warning)}.war-context{flex-basis:100%;color:var(--s-muted);font-size:10px}.war-filters,.war-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:9px}.war-filters label,.war-settings label,.war-claim-form label{display:grid;gap:3px;color:var(--s-muted)}.war-filters input,.war-filters select,.war-settings input,.war-settings select,.war-claim-form input,.war-claim-form select{width:100%;min-width:0;min-height:42px;padding:6px 8px;border:1px solid var(--s-border);border-radius:7px;background:var(--s-bg);color:var(--s-text)}.war-filter-action{display:flex;align-items:end}.war-filter-action button,.war-settings>button{width:100%;padding:5px 8px}.war-settings-note{grid-column:1/-1;padding:8px;border:1px solid var(--s-soft);border-radius:7px;color:var(--s-muted)}.war-settings>button{grid-column:1/-1}.war-claim-form{display:grid;grid-template-columns:minmax(150px,2fr) minmax(130px,1fr) auto;align-items:end;gap:7px;margin-bottom:9px}.war-claim-form button{padding:5px 9px}.war-alert-block{display:grid;gap:7px;margin:9px 0;padding:8px;border:1px solid var(--s-border);border-radius:8px;background:color-mix(in srgb,var(--s-panel) 80%,transparent)}.war-retal{padding-right:39px;border-left:4px solid var(--s-error)}.war-dismiss{position:absolute;top:7px;right:7px;display:grid;width:27px;min-height:27px;padding:0;place-items:center;border-color:var(--s-error);border-radius:50%;color:var(--s-error);font-weight:900}.war-retal-report{display:grid;grid-template-columns:75px minmax(0,1fr);gap:4px 7px}.war-retal-report>span{color:var(--s-muted)}.war-inside-blocked{outline:3px solid var(--s-error);box-shadow:0 0 15px color-mix(in srgb,var(--s-error) 48%,transparent)}.war-inside-warning{color:var(--s-error);font-weight:800}.target-actions .war-inside-attack{border-color:var(--s-error);color:var(--s-error);font-weight:800}.war-log{border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg)}.war-log summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:8px;cursor:pointer}.war-log summary span{color:var(--s-muted)}.war-log-event{display:grid;gap:2px;margin:0 8px 7px;padding:7px;border-left:3px solid var(--s-border);background:var(--s-panel)}.war-log-event span{color:var(--s-muted);font-size:10px}
    .stat-table,.value-list{display:grid;gap:0;margin-top:8px}.stat-row,.value-list>div{display:grid;grid-template-columns:minmax(82px,1fr) minmax(105px,auto) minmax(105px,auto);align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--s-soft)}.stat-row.head{padding-top:0;color:var(--s-muted);font-size:10px}.stat-row strong{text-align:right;white-space:nowrap;font-size:11px}.value-list>div{grid-template-columns:minmax(0,1fr) auto}.value-list strong{white-space:nowrap}.merit strong,.merit span,.merit small{display:block}.merit span,.merit small{color:var(--s-muted)}.merit small{margin:1px 0 4px;color:var(--s-alt);font-size:9px;text-transform:uppercase;letter-spacing:.04em}.merit .merit-later{margin-top:5px;color:var(--s-alt);font-size:10px}.merit-row{grid-template-columns:44px minmax(0,1fr) auto;align-items:center}.award-emblem{display:grid!important;width:42px;height:48px;place-items:center;clip-path:polygon(10% 0,90% 0,100% 72%,50% 100%,0 72%);background:linear-gradient(160deg,var(--s-accent),#17202b);color:white!important;font-size:19px;font-weight:900;text-shadow:0 1px 2px #000}.award-emblem.honor{background:linear-gradient(160deg,#6f3e87,#2b1732)}.award-emblem.medal{background:linear-gradient(160deg,#a27820,#36260b)}.merit-copy{min-width:0}.pagination{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:11px}.pagination button{min-width:94px;padding:6px 12px}.pagination button:disabled{opacity:.45;cursor:not-allowed}.pagination span{color:var(--s-muted)}.module-toolbar label{display:flex;align-items:center;gap:5px;color:var(--s-muted)}.module-toolbar select{min-height:38px;padding:5px 8px;border:1px solid var(--s-border);border-radius:7px;background:var(--s-bg);color:var(--s-text)}
    .market-form{display:grid;grid-template-columns:minmax(130px,.7fr) minmax(260px,2fr) minmax(150px,1fr) minmax(125px,.7fr);align-items:start;gap:9px}.market-form>label,.market-item-field{display:grid;gap:4px;color:var(--s-muted)}.market-form input,.market-form select{width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--s-border);border-radius:8px;background:var(--s-bg);color:var(--s-text)}.market-form small{color:var(--s-muted);font-size:9px}.market-item-picker{position:relative;min-width:0}.market-item-suggestions{position:absolute;right:0;bottom:calc(100% + 6px);left:0;z-index:8;display:grid;max-height:min(42vh,320px);gap:4px;overflow:auto;padding:5px;border:1px solid var(--s-border);border-radius:9px;background:var(--s-panel);box-shadow:0 10px 26px var(--s-shadow);overscroll-behavior:contain}.market-item-suggestions[hidden]{display:none}.market-item-suggestions button{display:grid;min-height:46px;padding:6px 8px;text-align:left}.market-item-suggestions strong,.market-item-suggestions small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.market-item-suggestions small{color:var(--s-muted)}.market-sources{display:flex;align-items:center;align-self:end;gap:12px;min-height:44px;margin:0;padding:6px 10px;border:1px solid var(--s-border);border-radius:8px}.market-sources legend{padding:0 4px;color:var(--s-muted);font-size:10px}.market-sources label,.market-options label{display:flex;align-items:center;gap:6px}.market-sources input,.market-options input{width:18px;height:18px;min-height:18px}.market-form-actions,.market-bulk-actions{display:flex;align-items:center;gap:7px;align-self:end}.market-form-actions button,.market-bulk-actions button{padding:6px 12px}.market-options{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;padding-top:10px;border-top:1px solid var(--s-soft);color:var(--s-muted)}.market-watch-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.market-watch,.market-deal{display:grid;align-content:start;gap:6px;min-width:0;padding:10px;border:1px solid var(--s-soft);border-radius:8px;background:var(--s-bg)}.market-watch strong,.market-watch span,.market-deal strong,.market-deal span{display:block;overflow-wrap:anywhere}.market-watch span,.market-deal span{color:var(--s-muted)}.market-deals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.market-deal{border-left:4px solid var(--s-ready)}
    .war-armory-controls{display:grid;grid-template-columns:minmax(170px,1fr) auto;align-items:end;gap:7px}.war-armory-controls label{display:grid;gap:3px;color:var(--s-muted)}.war-armory-controls select,.war-armory-manager input[type="search"]{width:100%;min-height:42px;padding:6px 8px;border:1px solid var(--s-border);border-radius:7px;background:var(--s-bg);color:var(--s-text)}.war-armory-manager{padding:7px;border:1px solid var(--s-soft);border-radius:7px}.war-armory-manager summary{min-height:40px;padding:8px;cursor:pointer;font-weight:800}.war-armory-ranks{display:flex;flex-wrap:wrap;gap:5px;margin:7px 0}.war-armory-ranks button{min-height:34px;padding:4px 7px}.war-armory-members{display:grid;gap:4px;max-height:280px;overflow:auto;padding:4px;border:1px solid var(--s-soft);border-radius:7px}.war-armory-members>label{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:7px;padding:6px;background:var(--s-bg)}.war-armory-members>label[hidden]{display:none}.war-armory-members input{width:20px;height:20px}.war-armory-members strong,.war-armory-members small{display:block}.war-armory-members small{color:var(--s-muted)}
    .war-armory-controls{grid-template-columns:1fr}
    .positive{color:var(--s-ready)}.negative{color:var(--s-error)}.permission-lock{opacity:.6}.subnav button:disabled{cursor:not-allowed;opacity:.5}.busy{animation:slink-pulse 1s ease-in-out infinite alternate}@keyframes slink-pulse{to{filter:brightness(1.35)}}
    .mobile-hint{display:none}:host([data-keyboard-open]) .primary-nav{visibility:hidden;pointer-events:none}
    @media(max-width:900px){.card{grid-column:span 6}.card.wide{grid-column:1/-1}.market-form{grid-template-columns:repeat(2,minmax(0,1fr))}.market-item-field{grid-column:span 2}.market-watch-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:700px){
      .overlay{grid-template-rows:auto minmax(0,1fr)}.topbar{min-height:58px;padding-top:max(7px,env(safe-area-inset-top));padding-bottom:7px}.brand-mark{width:35px;height:35px}.prototype{display:none}.close{width:48px;min-width:48px;flex-basis:48px;padding:0}.close-label{display:none}
      .primary-nav{position:absolute;right:0;bottom:0;left:0;z-index:4;justify-content:stretch;padding:4px 6px;border-top:1px solid var(--s-border);border-bottom:0;box-shadow:0 -5px 14px var(--s-shadow)}.primary-nav button{min-width:0;flex:1;padding:2px 3px;font-size:11px}.primary-nav button::before{display:block;margin-bottom:0;font-size:15px}.primary-nav button[data-page="combat"]::before{content:"⚔"}.primary-nav button[data-page="efficiency"]::before{content:"⏱"}.primary-nav button[data-page="access"]::before{content:"⚙"}
      .scroll{padding:8px max(8px,env(safe-area-inset-right)) 58px max(8px,env(safe-area-inset-left))}.page-head{align-items:center;margin-bottom:8px}.page-head h1{font-size:18px}.page-head p{font-size:10px}.page-actions button{min-height:40px}.overlay input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),.overlay textarea,.overlay select{font-size:16px}
      .grid{gap:8px}.card,.card.wide{grid-column:1/-1;padding:10px}.stats{gap:5px}.stat{padding:8px 3px}.stat strong{font-size:15px}.two-column{gap:6px}.access-form{grid-template-columns:1fr}.access-form .wide{grid-column:auto}.target-card{grid-template-columns:1fr}.mug-report{align-items:stretch;flex-direction:column}.war-filters,.war-settings,.war-claim-form{grid-template-columns:1fr}.war-settings-note,.war-settings>button{grid-column:auto}.war-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}.merit-row{grid-template-columns:40px minmax(0,1fr) auto}.award-emblem{width:38px;height:44px}.market-form,.market-watch-grid,.market-deals{grid-template-columns:1fr}.market-item-field{grid-column:auto}.market-sources{align-self:auto}.market-form-actions{align-self:auto}.mobile-hint{display:block}.launcher{width:54px;height:54px;min-height:54px}.launcher-label{display:none}
    }
    @media(max-width:370px){.brand span{display:none}.page-head p{display:none}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.two-column{grid-template-columns:1fr}.subnav button{min-width:82px}.stat-row{grid-template-columns:minmax(62px,1fr) minmax(86px,auto) minmax(86px,auto);gap:4px}.stat-row strong{font-size:9px}}
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
        <div class="page-head"><div><h1>Efficiency</h1><p>API-backed reminders, market watches, and Merit farms coordinated inside PDA.</p></div><div class="page-actions"><button type="button" data-action="refresh-active">Refresh</button></div></div>
        <nav class="subnav" aria-label="Efficiency tools"><button type="button" data-efficiency-tab="alerts">Alerts</button><button type="button" data-efficiency-tab="market">Market</button><button type="button" data-efficiency-tab="merits">Merits</button></nav>
        <div class="subpage" data-efficiency-panel="alerts"><div data-module-root="alerts"></div></div>
        <div class="subpage" data-efficiency-panel="market" hidden><div data-module-root="market"></div></div>
        <div class="subpage" data-efficiency-panel="merits" hidden><div data-module-root="merits"></div></div>
      </section>
      <section class="page" data-page-panel="access" hidden>
        <div class="page-head"><div><h1>Access &amp; layout</h1><p>One PDA key, one local session manager, and one shared Torn API limiter.</p></div></div>
        <div data-module-root="access"></div>
        <div class="grid"><article class="card wide"><div class="card-head"><div><h2>Mobile recovery</h2><span class="muted">The dashboard can always get out of your way.</span></div><span class="badge ready">Protected</span></div><div class="recovery"><span>Tap <strong>−</strong> in the top bar to minimize. The movable bubble appears only after the dashboard closes.</span><span>Drag the bubble anywhere. Its position is clamped back onscreen after rotation and resizing.</span><span>Press <code>Esc</code> or <code>Alt + Shift + S</code> on a keyboard.</span><span>Swipe downward on the dashboard header to minimize on touch devices.</span><button type="button" data-action="reset-layout">Reset launcher position and layout</button></div></article><article class="card"><div class="card-head"><div><h2>Themes</h2><span class="muted">Loaded from the same permission-gated catalog as the extension.</span></div><button type="button" data-action="refresh-themes">Refresh</button></div><div class="theme-row"></div></article><article class="card full mobile-hint"><strong>Phone note:</strong> The bottom navigation stays reachable above the device safe area. In landscape it moves to the right edge to preserve vertical room.</article></div>
      </section>
    </main>`;

  shadow.append(style, overlay, launcher);
  document.documentElement.appendChild(host);

  function keyboardEditable(node) {
    if (!node?.matches) return false;
    if (node.matches('textarea,[contenteditable="true"]')) return true;
    return node.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]):not([type="color"])');
  }

  function syncKeyboardState() {
    const focused = dashboardOpen && keyboardEditable(shadow.activeElement);
    host.toggleAttribute('data-keyboard-open', focused);
  }

  function keepFocusedFieldVisible(node) {
    const scroller = shadow.querySelector('.scroll');
    if (!scroller || shadow.activeElement !== node) return;
    const field = node.closest('label,.market-item-field,.access-form') || node;
    const fieldRect = field.getBoundingClientRect();
    const scrollRect = scroller.getBoundingClientRect();
    const viewportBottom = global.visualViewport ? global.visualViewport.offsetTop + global.visualViewport.height : scrollRect.bottom;
    const visibleTop = scrollRect.top + 8;
    const visibleBottom = Math.min(scrollRect.bottom, viewportBottom) - 10;
    if (fieldRect.bottom > visibleBottom) scroller.scrollTop += fieldRect.bottom - visibleBottom;
    else if (fieldRect.top < visibleTop) scroller.scrollTop -= visibleTop - fieldRect.top;
  }

  function guardUnexpectedBottomJump(expectedTop, node) {
    const scroller = shadow.querySelector('.scroll');
    if (!scroller || !keyboardEditable(node)) return;
    const check = () => {
      if (shadow.activeElement !== node) return;
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const jumpedToEnd = max > expectedTop + 140 && scroller.scrollTop >= max - 3;
      if (jumpedToEnd) scroller.scrollTop = expectedTop;
      keepFocusedFieldVisible(node);
    };
    global.requestAnimationFrame(check);
    global.setTimeout(check, 90);
    global.setTimeout(check, 260);
  }

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
    const allowed = group === 'combat' ? ['leveling', 'war', 'stats'] : ['alerts', 'market', 'merits'];
    if (!allowed.includes(tab)) tab = allowed[0];
    state[group === 'combat' ? 'combatTab' : 'efficiencyTab'] = tab;
    if (group === 'efficiency' && tab === 'market' && persist) moduleState.market.refreshPermissions = true;
    shadow.querySelectorAll(`[data-${group}-panel]`).forEach(panel => { panel.hidden = panel.dataset[`${group}Panel`] !== tab; });
    shadow.querySelectorAll(`[data-${group}-tab]`).forEach(button => button.setAttribute('aria-selected', String(button.dataset[`${group}Tab`] === tab)));
    if (persist) writeState();
    if (dashboardOpen) void loadActiveModule(false);
  }

  function setTheme(theme, persist = true) {
    let definition = themeCatalog().find(item => item.id === theme) || themeCatalog().find(item => item.id === 'slink-dark') || bundledThemes()[0];
    if (definition.scope && !hasThemeScope(definition.scope)) definition = themeCatalog().find(item => item.id === 'slink-dark') || bundledThemes()[0];
    theme = definition.id;
    state.theme = theme;
    host.dataset.theme = theme;
    for (const property of new Set(Object.values(THEME_TOKEN_MAP))) host.style.removeProperty(property);
    for (const [name, value] of Object.entries(definition.tokens || {})) if (THEME_TOKEN_MAP[name]) host.style.setProperty(THEME_TOKEN_MAP[name], value);
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
    host.removeAttribute('data-keyboard-open');
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
    if (action === 'refresh-themes') void loadThemeCatalog(true);
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
    if (action === 'hide-city-until-reset') {
      dataState.settings.alerts.cityDoneDay = utcDay();
      reconcileAlertNotifications(moduleState.alerts.data);
      writeDataState();
      renderAlerts();
    }
    if (action === 'claim-google-play-points') {
      dataState.settings.alerts.googlePlayPointsClaimedAt = Date.now();
      reconcileAlertNotifications(moduleState.alerts.data);
      writeDataState();
      renderAlerts();
    }
    if (action === 'copy-war-mug-report') {
      const button = event.target.closest('button');
      const active = moduleState.war.data?.activeWar;
      const stats = active ? mugStatsForWar(active.warId) : null;
      if (button && active && stats?.count) void (async () => {
        button.disabled = true;
        const lines = [`SLINK mug report vs ${active.opponentName}`, `${stats.count} mugs · ${money(stats.total)} total · ${money(stats.average)} average · ${money(stats.min)} min · ${money(stats.max)} max`, ...stats.reports.map(report => `${new Date(report.at).toLocaleString()} · ${report.victimName}${report.victimId ? ` [${report.victimId}]` : ''} · ${money(report.amount)}`)];
        const okay = await copyText(lines.join('\n'));
        button.textContent = okay ? 'Copied' : 'Copy failed';
        button.disabled = false;
      })();
    }
    if (action === 'select-war-tab') {
      const tab = String(event.target.closest('[data-war-tab]')?.dataset.warTab || 'targets');
      const officerTabs = warOfficer() ? ['armory', 'logs', 'settings'] : [];
      if (['targets', 'outside', 'claims', ...officerTabs].includes(tab)) {
        dataState.settings.war.activeTab = tab;
        writeDataState();
        renderWar();
      }
    }
    if (action === 'refresh-war-outside') void refreshWarOutside();
    if (action === 'war-inside-attack') {
      const link = event.target.closest('[data-war-target]');
      const gate = warInsideGate(Number(link?.dataset.warTarget) || 0);
      if (gate.active && (gate.mode === 'block' || !global.confirm(`${warInsideMessage(gate)}\n\nOpen this inside target anyway?`))) {
        event.preventDefault();
        event.stopPropagation();
        moduleState.war.error = warInsideMessage(gate);
        renderWar();
      }
    }
    if (action === 'claim-war-target') void updateWarClaim('claim');
    if (action === 'release-war-claim') void updateWarClaim('release', Number(event.target.closest('[data-war-target]')?.dataset.warTarget) || 0);
    if (action === 'resolve-war-armory-request') void resolveWarArmoryRequest(String(event.target.closest('[data-war-request]')?.dataset.warRequest || ''));
    if (action === 'save-war-settings') void saveWarOfficerSettings();
    if (action === 'retrieve-war-armory') void retrieveWarArmoryItem();
    if (action === 'next-war-armory') nextWarArmoryPage();
    if (action === 'refresh-war-armory-members') void refreshWarArmoryMembers(true).then(() => { moduleState.war.error = ''; renderWar(); }).catch(error => { moduleState.war.error = errorMessage(error); renderWar(); });
    if (action === 'toggle-war-armory-rank') {
      const rank = String(event.target.closest('[data-armory-rank]')?.dataset.armoryRank || '');
      const members = (dataState.caches.warArmoryMembers?.members || []).filter(member => member.rank === rank);
      const whitelist = new Set((dataState.settings.war.armoryWhitelist || []).map(String));
      const select = !members.every(member => whitelist.has(String(member.id)));
      members.forEach(member => select ? whitelist.add(String(member.id)) : whitelist.delete(String(member.id)));
      dataState.settings.war.armoryWhitelist = [...whitelist]; writeDataState(); renderWar();
    }
    if (action === 'select-shown-war-armory' || action === 'clear-shown-war-armory') {
      const whitelist = new Set((dataState.settings.war.armoryWhitelist || []).map(String));
      const checked = action === 'select-shown-war-armory';
      moduleRoot('war')?.querySelectorAll('[data-armory-search-row]:not([hidden]) [data-war-armory-member]').forEach(input => checked ? whitelist.add(String(input.dataset.warArmoryMember)) : whitelist.delete(String(input.dataset.warArmoryMember)));
      dataState.settings.war.armoryWhitelist = [...whitelist]; writeDataState(); renderWar();
    }
    if (action === 'dismiss-war-retal') {
      const attackId = String(event.target.closest('[data-war-retal]')?.dataset.warRetal || '');
      const retal = (moduleState.war.data?.snapshot?.retals || []).find(row => String(row?.attackId || row?.attackerId) === attackId);
      if (retal) {
        const key = `user:${Number(retal.attackerId) || attackId}`;
        if (!dataState.settings.war.dismissedRetals || typeof dataState.settings.war.dismissedRetals !== 'object') dataState.settings.war.dismissedRetals = {};
        dataState.settings.war.dismissedRetals[key] = Number(retal.expiresAt) || Math.floor(Date.now() / 1000) + 300;
        writeDataState();
        renderWar();
      }
    }
    if (action === 'copy-war-target' || action === 'send-war-target') {
      const button = event.target.closest('[data-war-target]');
      const id = Number(button?.dataset.warTarget) || 0;
      const rows = button?.dataset.warOutside === 'true' ? moduleState.war.data?.outsideTargets : moduleState.war.data?.snapshot?.members;
      const member = (rows || []).find(row => warMemberId(row) === id);
      if (member && button) void (async () => {
        button.disabled = true;
        const okay = action === 'copy-war-target' ? await copyText(warCallout(member)) : await sendToFaction(warCallout(member));
        button.textContent = okay ? action === 'copy-war-target' ? 'Copied' : 'Sent to Faction' : 'Try again';
        button.disabled = false;
      })();
    }
    if (action === 'copy-war-retal' || action === 'send-war-retal') {
      const button = event.target.closest('[data-war-retal]');
      const attackId = String(button?.dataset.warRetal || '');
      const retal = (moduleState.war.data?.snapshot?.retals || []).find(row => String(row?.attackId || row?.attackerId) === attackId);
      if (retal && button) void (async () => {
        const text = `RETAL: ${retal.attackerName || `Player ${retal.attackerId}`} [${retal.attackerId}] attacked ${retal.defenderName || `Player ${retal.defenderId || '?'}`} · ${retal.attackerStatus || retal.attackerActivity || 'Unknown'} · https://www.torn.com/page.php?sid=attack&user2ID=${retal.attackerId}`;
        button.disabled = true;
        const okay = action === 'copy-war-retal' ? await copyText(text) : await sendToFaction(text);
        button.textContent = okay ? action === 'copy-war-retal' ? 'Copied' : 'Sent to Faction' : 'Try again';
        button.disabled = false;
      })();
    }
    if (action === 'refresh-market-permissions') void refreshMarketPermissions();
    if (action === 'save-market-watch') saveMarketWatch();
    if (action === 'clear-market-form') { moduleState.market.editingUid = ''; moduleState.market.draft = null; moduleState.market.error = ''; renderMarket(false); }
    if (action === 'edit-market-watch') {
      moduleState.market.editingUid = String(event.target.closest('[data-market-watch]')?.dataset.marketWatch || '');
      const watch = marketSettings().watches.find(row => row.uid === moduleState.market.editingUid);
      moduleState.market.draft = watch ? { ...watch, itemText:watch.marketType === 'points' ? '' : `${watch.label || `Item ${watch.itemId}`} [${watch.itemId}]` } : null;
      moduleState.market.error = ''; renderMarket(false); shadow.querySelector('.scroll')?.scrollTo?.({ top:0, behavior:'smooth' });
    }
    if (action === 'remove-market-watch') {
      const uid = String(event.target.closest('[data-market-watch]')?.dataset.marketWatch || '');
      const settings = marketSettings(); settings.watches = settings.watches.filter(watch => watch.uid !== uid); if (moduleState.market.editingUid === uid) moduleState.market.editingUid = '';
      const runtime = marketRuntime(); delete runtime.results[uid]; dataState.caches.market = runtime; writeDataState(); renderMarket(); scheduleMarketDomFormat();
    }
    const marketOption = event.target.closest('[data-market-item-option]');
    if (marketOption) selectMarketSuggestion(Number(marketOption.dataset.marketItemOption));
    if (action === 'dismiss-market-deal') {
      const key = String(event.target.closest('[data-market-dismiss]')?.dataset.marketDismiss || '');
      if (key) { marketSettings().dismissals[key] = Date.now() + 5 * 60_000; writeDataState(); renderMarket(); }
    }
    if (action === 'copy-market-deal' || action === 'send-market-deal') {
      const id = String(event.target.closest('[data-market-deal]')?.dataset.marketDeal || '');
      const deal = marketOpportunities(moduleState.market.data || marketRuntime()).find(row => row.id === id);
      const button = event.target.closest('button');
      if (deal && button) void (async () => { button.disabled = true; const okay = action === 'copy-market-deal' ? await copyText(deal.shareText) : await sendToFaction(deal.shareText); button.textContent = okay ? action === 'copy-market-deal' ? 'Copied' : 'Sent to Faction' : action === 'copy-market-deal' ? 'Copy failed' : 'Open/focus Faction Chat'; button.disabled = false; })();
    }
    if (action === 'copy-market-list' || action === 'send-market-list') {
      const text = marketOpportunities(moduleState.market.data || marketRuntime()).slice(0, 12).map(row => row.shareText).join('\n');
      const button = event.target.closest('button');
      if (text && button) void (async () => { button.disabled = true; const okay = action === 'copy-market-list' ? await copyText(text) : await sendToFaction(text); button.textContent = okay ? action === 'copy-market-list' ? 'List copied' : 'Sent to Faction' : action === 'copy-market-list' ? 'Copy failed' : 'Open/focus Faction Chat'; button.disabled = false; })();
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
      const required = themeCatalog().find(item => item.id === theme)?.scope || null;
      if (required && !hasThemeScope(required)) {
        moduleState.access.error = `This theme requires ${required}.`;
        renderAccess();
      } else setTheme(theme);
    }
  });

  overlay.addEventListener('change', event => {
    if (event.target.matches('[data-field="war-armory-mode"]')) {
      dataState.settings.war.armoryMode = String(event.target.value || 'ranked-all'); writeDataState();
    }
    if (event.target.matches('[data-war-armory-member]')) {
      const whitelist = new Set((dataState.settings.war.armoryWhitelist || []).map(String));
      const id = String(event.target.dataset.warArmoryMember || '');
      if (event.target.checked) whitelist.add(id); else whitelist.delete(id);
      dataState.settings.war.armoryWhitelist = [...whitelist]; writeDataState();
    }
    if (event.target.matches('[data-field="war-target-min"],[data-field="war-target-max"],[data-field="war-target-status"],[data-field="war-target-sort"]')) {
      const root = moduleRoot('war');
      dataState.settings.war.targetMinFF = Math.max(0, Number(root?.querySelector('[data-field="war-target-min"]')?.value) || 0);
      dataState.settings.war.targetMaxFF = Math.max(0, Number(root?.querySelector('[data-field="war-target-max"]')?.value) || 3);
      dataState.settings.war.targetStatus = root?.querySelector('[data-field="war-target-status"]')?.value || 'all';
      dataState.settings.war.targetSort = root?.querySelector('[data-field="war-target-sort"]')?.value || 'availability';
      writeDataState();
      renderWar(true);
    }
    if (event.target.closest?.('.market-form')) captureMarketDraft();
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
    if (event.target.matches('[data-field="market-priority"]')) {
      dataState.settings.market.lastPriority = normalizeMarketPriority(event.target.value); writeDataState();
    }
    if (event.target.matches('[data-field="market-enabled"]')) {
      marketSettings().enabled = event.target.checked; writeDataState(); renderMarket(); scheduleMarketWake(); if (event.target.checked) void refreshMarket(false);
    }
    if (event.target.matches('[data-field="market-quick-buy"]')) {
      marketSettings().quickBuyEnabled = event.target.checked; writeDataState(); if (!event.target.checked) clearMarketQuickBuys(); else scheduleMarketDomFormat();
    }
    if (event.target.matches('[data-field="market-type"]')) {
      captureMarketDraft();
      const points = event.target.value === 'points';
      const root = moduleRoot('market'); const item = root?.querySelector('[data-field="market-item"]'); const sources = root?.querySelector('.market-sources');
      if (item) item.disabled = points; if (sources) sources.disabled = points;
    }
  });

  overlay.addEventListener('input', event => {
    const expectedTop = shadow.querySelector('.scroll')?.scrollTop || 0;
    if (event.target.matches('[data-field="war-armory-search"]')) {
      const needle = String(event.target.value || '').trim().toLowerCase();
      moduleRoot('war')?.querySelectorAll('[data-armory-search-row]').forEach(row => { row.hidden = Boolean(needle && !String(row.dataset.armorySearchRow || '').includes(needle)); });
    }
    if (event.target.matches('[data-field="market-item"],[data-field="market-price"]')) {
      captureMarketDraft();
      if (event.target.matches('[data-field="market-item"]')) renderMarketSuggestions(event.target.value);
    }
    guardUnexpectedBottomJump(expectedTop, event.target);
  });

  overlay.addEventListener('focusin', event => {
    const expectedTop = shadow.querySelector('.scroll')?.scrollTop || 0;
    if (keyboardFocusTimer) global.clearTimeout(keyboardFocusTimer);
    syncKeyboardState();
    if (event.target.matches('[data-field="market-item"]')) renderMarketSuggestions(event.target.value);
    guardUnexpectedBottomJump(expectedTop, event.target);
  });

  overlay.addEventListener('focusout', event => {
    if (keyboardFocusTimer) global.clearTimeout(keyboardFocusTimer);
    keyboardFocusTimer = global.setTimeout(() => {
      keyboardFocusTimer = null;
      syncKeyboardState();
      const suggestions = moduleRoot('market')?.querySelector('[data-market-item-suggestions]');
      if (suggestions && !shadow.activeElement?.closest?.('[data-market-item-suggestions]')) suggestions.hidden = true;
      if (moduleState.market.renderPending && !shadow.activeElement?.closest?.('[data-module-root="market"] .market-form')) renderMarket();
      if (moduleState.war.renderPending && !shadow.activeElement?.closest?.('[data-module-root="war"] input,[data-module-root="war"] select,[data-module-root="war"] textarea')) renderWar(true);
    }, 150);
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
  global.addEventListener('resize', () => { clampLauncher(true); syncKeyboardState(); keepFocusedFieldVisible(shadow.activeElement); });
  global.visualViewport?.addEventListener('resize', () => { syncKeyboardState(); keepFocusedFieldVisible(shadow.activeElement); });
  global.addEventListener('orientationchange', () => global.setTimeout(() => clampLauncher(true), 180));
  global.addEventListener('hashchange', scheduleMarketDomFormat);
  global.addEventListener('popstate', scheduleMarketDomFormat);
  global.addEventListener('resize', syncMarketQuickBuyPositions);
  global.addEventListener('scroll', syncMarketQuickBuyPositions, true);
  document.addEventListener('visibilitychange', () => { if (dashboardOpen && !document.hidden) void loadActiveModule(false); });
  global.addEventListener('pagehide', unlockTornScroll, { once:true });

  const guardian = new MutationObserver(() => {
    if (!host.isConnected && document.documentElement) document.documentElement.appendChild(host);
  });
  guardian.observe(document, { childList:true, subtree:true });
  marketObserver = new MutationObserver(() => { scheduleMarketDomFormat(); scanAttackMugResults(); });
  marketObserver.observe(document.body, { childList:true, subtree:true });

  if (typeof GM_API.menu === 'function') {
    GM_API.menu('Open SLINK PDA Dashboard', openDashboard);
    GM_API.menu('Reset SLINK PDA layout', resetLayout);
  }

  renderThemeChoices();
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
  global.setTimeout(() => void loadThemeCatalog(false), 2_000);
  if (currentApiKey() && hasGrantedScope('slink.adhd.alerts') && (validSession('permission') || termsAccepted('permission'))) global.setTimeout(() => void refreshAlerts(false), 5_000);
  if (currentApiKey() && marketWatchLimit() > 0 && marketSettings().enabled) global.setTimeout(() => void refreshMarket(false), 7_000);
  scheduleMarketDomFormat();
  scanAttackMugResults();

  global.SLINK_PDA_DASHBOARD = Object.freeze({
    build:BUILD,
    open:openDashboard,
    close:closeDashboard,
    toggle:toggleDashboard,
    reset:resetLayout,
    isOpen:() => dashboardOpen,
    refreshMarket:() => refreshMarket(true)
  });
})(globalThis);
