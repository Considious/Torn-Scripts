// ==UserScript==
// @name         Torn ADHD Dashboard
// @namespace    Considious [3853023]
// @version      1.3.0
// @description  A privacy-conscious daily reminder dashboard powered by Torn API v2.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @connect      api.torn.com
// @connect      weav3r.dev
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  const STORAGE_KEY = 'tdd-settings-v1';
  const SNOOZE_STORAGE_KEY = 'tdd-snoozes-v1';
  const ITEM_CATALOG_KEY = 'tdd-item-catalog-v1';
  const BAZAAR_CACHE_KEY = 'tdd-weav3r-bazaar-cache-v1';
  const CHECK_CACHE_KEY = 'tdd-check-cache-v1';
  const API_LEDGER_KEY = 'tdd-torn-api-ledger-v1';
  const API_ROOT = 'https://api.torn.com/v2';
  const API_V1_ROOT = 'https://api.torn.com';
  const CORE_REFRESH_MS = 60_000;
  const BAZAAR_FAST_REFRESH_MS = 5_000;
  const BAZAAR_MEDIUM_REFRESH_MS = 30_000;
  const BAZAAR_SLOW_REFRESH_MS = 60_000;
  const API_USAGE_WINDOW_MS = 60_000;
  const API_HARD_LIMIT = 80;
  const API_SLOW_LIMIT = 30;
  const TORN_DAY_MS = 24 * 60 * 60 * 1000;
  const ITEM_CATALOG_MAX_AGE_MS = 7 * TORN_DAY_MS;
  const MARKET_ITEM_TYPES = [
    ['All', 'All categories'],
    ['Drug', 'Drugs'],
    ['Medical', 'Medical'],
    ['Energy Drink', 'Energy drinks'],
    ['Alcohol', 'Alcohol'],
    ['Candy', 'Candy'],
    ['Booster', 'Boosters'],
    ['Enhancer', 'Enhancers'],
    ['Supply Pack', 'Supply packs'],
    ['Special', 'Special'],
    ['Tool', 'Tools'],
    ['Material', 'Materials'],
    ['Flower', 'Flowers'],
    ['Plushie', 'Plushies'],
    ['Artifact', 'Artifacts'],
    ['Other', 'Misc'],
  ];
  const MARKET_ITEM_TYPE_SET = new Set(MARKET_ITEM_TYPES.slice(1).map(([type]) => type));
  const PICKPOCKET_COLORS = {
    ideal: '#40ab24', easy: '#82c370', tooEasy: '#a4d497', tooHard: '#fa8e8e', uncategorized: '#da85ff',
  };
  const PICKPOCKET_MARK_LEVELS = {
    'Drunk man': 100, 'Drunk woman': 100, 'Elderly man': 100, 'Elderly woman': 100, 'Homeless person': 100, Junkie: 100,
    'Classy lady': 150, Laborer: 150, 'Postal worker': 150, 'Young man': 150, 'Young woman': 150, Student: 150,
    'Rich kid': 200, 'Sex worker': 200, Thug: 200,
    Businessman: 250, Businesswoman: 250, Jogger: 250, 'Gang member': 250, Mobster: 250,
    Cyclist: 300, 'Police officer': 350,
  };
  const PICKPOCKET_MARK_GROUPS = {
    Safe: ['Drunk man', 'Drunk woman', 'Homeless person', 'Junkie', 'Elderly man', 'Elderly woman'],
    'Moderately Unsafe': ['Laborer', 'Postal worker', 'Young man', 'Young woman', 'Student'],
    Unsafe: ['Classy lady', 'Rich kid', 'Sex worker'],
    Risky: ['Thug', 'Jogger', 'Businessman', 'Businesswoman', 'Gang member'],
    Dangerous: ['Cyclist'],
    'Very Dangerous': ['Mobster', 'Police officer'],
  };
  const PICKPOCKET_SKILL_CATEGORIES = ['Safe', 'Moderately Unsafe', 'Unsafe', 'Risky', 'Dangerous', 'Very Dangerous'];
  const PICKPOCKET_SKILL_STARTS = [1, 10, 35, 65, 90, 100];
  const PICKPOCKET_BUILDS_TO_AVOID = {
    Businessman: ['Skinny'], 'Drunk man': ['Muscular'], 'Gang member': ['Muscular'], 'Sex worker': ['Muscular'], Student: ['Athletic'], Thug: ['Muscular'],
  };
  const PICKPOCKET_STATUSES_TO_AVOID = {
    Businessman: ['Walking'], 'Drunk man': ['Distracted'], 'Drunk woman': ['Distracted'], 'Homeless person': ['Loitering'],
    Junkie: ['Loitering'], Laborer: ['Distracted'], 'Police officer': ['Walking'], 'Sex worker': ['Distracted'], Thug: ['Loitering', 'Walking'],
  };
  const CRIME_UNIQUE_DEFINITIONS = [
    { key: 'searchCash', crimeId: 1, alertId: 'searchCashUnique', name: 'Search for Cash', route: 'search-for-cash', knownTotal: 34 },
    { key: 'shoplifting', crimeId: 4, alertId: 'clusterRing', name: 'Shoplifting', route: 'shoplifting' },
    { key: 'disposal', crimeId: 9, alertId: 'disposalUnique', name: 'Disposal', route: 'disposal', knownTotal: 11 },
    { key: 'arson', crimeId: 13, alertId: 'arsonUnique', name: 'Arson', route: 'arson' },
  ];
  const CRIME_ALERT_IDS = new Set(CRIME_UNIQUE_DEFINITIONS.map((definition) => definition.alertId));

  const ALERT_META = [
    ['drugCooldown', 'Drug ready'],
    ['nerveFull', 'Nerve full'],
    ['energyFull', 'Energy full'],
    ['medicalCooldown', 'Medical / blood bags'],
    ['boosterCooldown', 'Booster ready'],
    ['missions', 'Mission unfinished'],
    ['cityItem', 'Buy 100 city items'],
    ['raceOrFly', 'Race or fly'],
    ['searchCashUnique', 'Search for Cash unique'],
    ['clusterRing', 'Cluster Ring unique'],
    ['disposalUnique', 'Disposal unique'],
    ['arsonUnique', 'Arson unique'],
    ['landing', 'Landing soon'],
    ['turtle', 'Turtle timer'],
    ['organizedCrime', 'Join an OC'],
    ['education', 'Start an education'],
    ['casinoTokens', 'Spend casino tokens'],
    ['stockBenefits', 'Collect stock benefits'],
    ['energyRefill', 'Energy refill'],
    ['nerveRefill', 'Nerve refill'],
    ['jobAddiction', 'Job addiction'],
    ['playerAddiction', 'Player addiction'],
    ['itemMarket', 'Item market watches'],
  ];
  const ALERT_ICONS = {
    boosterCooldown: 'B↻',
    stockBenefits: 'STK',
    drugCooldown: '💊', nerveFull: '🧠', energyFull: '⚡', medicalCooldown: '🩸',
    missions: '🎯', cityItem: '🏙', raceOrFly: '🏁', searchCashUnique: '🔎', clusterRing: '💍',
    disposalUnique: '🗑', arsonUnique: '🔥', landing: '✈', turtle: '🐢',
    organizedCrime: '👥', education: '🎓', casinoTokens: '🎰', energyRefill: 'E↻',
    nerveRefill: 'N↻', jobAddiction: '💼', playerAddiction: '⚠', itemMarket: '🛒',
  };

  const DEFAULT_SETTINGS = {
    apiKey: '',
    collapsed: false,
    settingsOpen: false,
    settingsSections: {},
    position: { mode: 'top-center', x: null, y: 8 },
    panelSize: { width: null, height: null },
    medicalThresholdHours: 3,
    boosterThresholdHours: 3,
    pickpocketHelperEnabled: true,
    pickpocketMinTargetLevel: 100,
    pickpocketMaxTargetLevel: 300,
    pickpocketLastSkill: 1,
    apiDailyRefreshMinutes: 10,
    marketRefreshMinutes: 2,
    marketRefreshMode: 'cache-aligned',
    weav3rBazaarEnabled: false,
    bazaarRefreshMinutes: 1,
    slowApiMode: false,
    apiPausedUntil: 0,
    marketCatalogCategory: 'All',
    jobAddictionThreshold: 5,
    playerAddictionThreshold: 4,
    flashAlarm: false,
    soundAlarm: false,
    alarmIntervalMinutes: 1,
    browserNotifications: false,
    notifyDesktop: true,
    notifyMobile: false,
    landingLeadMinutes: 5,
    landingFlashAlarm: true,
    landingSoundAlarm: false,
    landingAlarmIntervalMinutes: 1,
    turtleEndAt: 0,
    turtleLeadMinutes: 5,
    turtleFlashAlarm: true,
    turtleSoundAlarm: false,
    turtleAlarmIntervalMinutes: 1,
    marketWatches: [],
    alarmHistory: {},
    enabled: Object.fromEntries(ALERT_META.map(([id]) => [id, true])),
    snoozedUntil: {},
  };

  const persistedChecks = loadCheckCache();
  const state = {
    settings: loadSettings(),
    data: persistedChecks.data,
    dom: {},
    errors: {},
    apiCalls: 0,
    lastMarketUpdated: persistedChecks.lastMarketUpdated,
    lastBazaarUpdated: persistedChecks.lastBazaarUpdated,
    lastFastUpdated: persistedChecks.lastFastUpdated,
    lastRaceUpdated: persistedChecks.lastRaceUpdated,
    nextRaceTravelCheckAt: persistedChecks.nextRaceTravelCheckAt,
    lastMissionsUpdated: persistedChecks.lastMissionsUpdated,
    lastCasinoUpdated: persistedChecks.lastCasinoUpdated,
    lastJobAddictionUpdated: persistedChecks.lastJobAddictionUpdated,
    lastClusterUpdated: persistedChecks.lastClusterUpdated,
    syncing: false,
    lastUpdated: 0,
    lastDailyUpdated: persistedChecks.lastDailyUpdated,
    tornDayStart: tornDayStartSeconds(),
    coreTimer: null,
    marketTimer: null,
    bazaarTimer: null,
    alarmTimer: null,
    itemCatalog: loadItemCatalogCache(),
    bazaarCache: loadBazaarCache(),
    itemCatalogLoading: false,
    marketPolling: false,
    marketRetryAt: 0,
    bazaarCalls: 0,
    bazaarPolling: false,
    bazaarBackoffUntil: 0,
    bazaarRateLimitStrikes: 0,
    flashUntil: 0,
    landingFlashUntil: 0,
    turtleFlashUntil: 0,
    turtleChecking: false,
    raceCheckPending: true,
    raceCheckComplete: false,
    confirmedRaceActive: false,
    alertSnapshot: [],
    alertSnapshotReady: false,
    readyAlertGroups: new Set(),
    checkCycleFailed: false,
    pageCheckPending: false,
    audioContext: null,
    drag: null,
    renderPending: false,
    domObserver: null,
    domRefreshTimer: null,
    windowResizeTimer: null,
    pickpocketRefreshTimer: null,
    pickpocketHeartbeat: null,
    pickpocketFormattedCount: 0,
    crimeProgressPromise: null,
    snoozeExpiryTimer: null,
    apiQueues: { high: [], normal: [], low: [] },
    apiQueueTimer: null,
    apiLimiterUntil: 0,
    windowFocused: document.hasFocus(),
    resizing: null,
    shareComposer: null,
  };

  function loadSettings() {
    const saved = GM_getValue(STORAGE_KEY, {});
    const snoozeLedger = loadSnoozeLedger();
    const savedSnoozes = saved?.snoozedUntil && typeof saved.snoozedUntil === 'object' ? saved.snoozedUntil : {};
    const snoozedUntil = { ...savedSnoozes };
    Object.entries(snoozeLedger).forEach(([id, until]) => {
      snoozedUntil[id] = Math.max(Number(snoozedUntil[id]) || 0, Number(until) || 0);
    });
    return {
      ...DEFAULT_SETTINGS,
      ...(saved && typeof saved === 'object' ? saved : {}),
      position: { ...DEFAULT_SETTINGS.position, ...(saved?.position || {}) },
      panelSize: { ...DEFAULT_SETTINGS.panelSize, ...(saved?.panelSize || {}) },
      enabled: { ...DEFAULT_SETTINGS.enabled, ...(saved?.enabled || {}) },
      snoozedUntil,
      alarmHistory: { ...(saved?.alarmHistory || {}) },
      settingsSections: { ...(saved?.settingsSections || {}) },
      marketWatches: Array.isArray(saved?.marketWatches) ? saved.marketWatches : [],
    };
  }

  function loadSnoozeLedger() {
    const saved = GM_getValue(SNOOZE_STORAGE_KEY, {});
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved)
      .map(([id, until]) => [id, Number(until) || 0])
      .filter(([, until]) => until > 0));
  }

  function saveSnoozeLedger({ replace = false } = {}) {
    const merged = replace ? {} : loadSnoozeLedger();
    Object.entries(state.settings.snoozedUntil).forEach(([id, until]) => {
      merged[id] = Math.max(Number(merged[id]) || 0, Number(until) || 0);
    });
    state.settings.snoozedUntil = merged;
    GM_setValue(SNOOZE_STORAGE_KEY, { ...merged });
  }

  function removeSnoozesWhere(predicate) {
    saveSnoozeLedger();
    Object.keys(state.settings.snoozedUntil).filter(predicate)
      .forEach((id) => delete state.settings.snoozedUntil[id]);
    saveSnoozeLedger({ replace: true });
  }

  function loadCheckCache() {
    const cached = GM_getValue(CHECK_CACHE_KEY, {});
    if (!cached || typeof cached !== 'object' || Array.isArray(cached)) {
      return { data: {}, lastDailyUpdated: 0, lastMarketUpdated: 0, lastBazaarUpdated: 0, lastFastUpdated: 0, lastRaceUpdated: 0, nextRaceTravelCheckAt: 0, lastMissionsUpdated: 0, lastCasinoUpdated: 0, lastJobAddictionUpdated: 0, lastClusterUpdated: 0 };
    }
    return {
      data: cached.data && typeof cached.data === 'object' && !Array.isArray(cached.data) ? cached.data : {},
      lastDailyUpdated: Number(cached.lastDailyUpdated) || 0,
      lastMarketUpdated: Number(cached.lastMarketUpdated) || 0,
      lastBazaarUpdated: Number(cached.lastBazaarUpdated) || 0,
      lastFastUpdated: Number(cached.lastFastUpdated) || 0,
      lastRaceUpdated: Number(cached.lastRaceUpdated) || 0,
      nextRaceTravelCheckAt: Number(cached.nextRaceTravelCheckAt) || 0,
      lastMissionsUpdated: Number(cached.lastMissionsUpdated) || 0,
      lastCasinoUpdated: Number(cached.lastCasinoUpdated) || 0,
      lastJobAddictionUpdated: Number(cached.lastJobAddictionUpdated) || 0,
      lastClusterUpdated: Number(cached.lastClusterUpdated) || 0,
    };
  }

  function saveCheckCache() {
    GM_setValue(CHECK_CACHE_KEY, {
      data: state.data,
      lastDailyUpdated: state.lastDailyUpdated,
      lastMarketUpdated: state.lastMarketUpdated,
      lastBazaarUpdated: state.lastBazaarUpdated,
      lastFastUpdated: state.lastFastUpdated,
      lastRaceUpdated: state.lastRaceUpdated,
      nextRaceTravelCheckAt: state.nextRaceTravelCheckAt,
      lastMissionsUpdated: state.lastMissionsUpdated,
      lastCasinoUpdated: state.lastCasinoUpdated,
      lastJobAddictionUpdated: state.lastJobAddictionUpdated,
      lastClusterUpdated: state.lastClusterUpdated,
      savedAt: Date.now(),
    });
  }

  function loadItemCatalogCache() {
    const cached = GM_getValue(ITEM_CATALOG_KEY, null);
    if (!cached || !Array.isArray(cached.items)) return { fetchedAt: 0, items: [] };
    const items = cached.items.filter((item) => Number(item?.id) > 0 && item?.name && MARKET_ITEM_TYPE_SET.has(item?.type));
    return { fetchedAt: Number(cached.fetchedAt) || 0, items };
  }

  function loadBazaarCache() {
    const cached = GM_getValue(BAZAAR_CACHE_KEY, {});
    if (!cached || typeof cached !== 'object' || Array.isArray(cached)) return {};
    return Object.fromEntries(Object.entries(cached).filter(([, result]) => Number(result?.fetchedAt) > Date.now() - 7 * TORN_DAY_MS && Array.isArray(result?.listings)));
  }

  function saveSettings() {
    const latestSnoozes = loadSnoozeLedger();
    Object.entries(latestSnoozes).forEach(([id, until]) => {
      state.settings.snoozedUntil[id] = Math.max(Number(state.settings.snoozedUntil[id]) || 0, Number(until) || 0);
    });
    GM_setValue(STORAGE_KEY, state.settings);
  }

  function alertSnoozed(id) {
    return Number(state.settings.snoozedUntil[id] || 0) > Date.now();
  }

  function alertCheckDue(id) {
    return state.settings.enabled[id] !== false && !alertSnoozed(id);
  }

  function scheduleNextSnoozeExpiry() {
    if (state.snoozeExpiryTimer) window.clearTimeout(state.snoozeExpiryTimer);
    state.snoozeExpiryTimer = null;
    const now = Date.now();
    const next = Object.values(state.settings.snoozedUntil).map(Number)
      .filter((until) => Number.isFinite(until) && until > now)
      .sort((a, b) => a - b)[0];
    if (!next) return;
    state.snoozeExpiryTimer = window.setTimeout(() => {
      state.snoozeExpiryTimer = null;
      refresh();
    }, Math.min(2_147_000_000, Math.max(50, next - now + 50)));
  }

  function releaseExpiredSnoozes() {
    const now = Date.now();
    Object.entries(loadSnoozeLedger()).forEach(([id, until]) => {
      state.settings.snoozedUntil[id] = Math.max(Number(state.settings.snoozedUntil[id]) || 0, Number(until) || 0);
    });
    const expired = Object.entries(state.settings.snoozedUntil)
      .filter(([, until]) => Number(until) > 0 && Number(until) <= now)
      .map(([id]) => id);
    if (!expired.length) return false;
    expired.forEach((id) => delete state.settings.snoozedUntil[id]);
    saveSnoozeLedger({ replace: true });
    saveSettings();
    scheduleNextSnoozeExpiry();
    return true;
  }

  function visibleTornTab() {
    // Page Visibility identifies the selected tab without requiring window focus.
    // This deliberately does not inspect any other page, tab, history, or storage.
    // The userscript metadata limits execution to Torn; keeping this check focused on
    // visibility also makes the UI testable against a local, non-account fixture.
    return document.visibilityState === 'visible';
  }

  function focusedTornPage() {
    return visibleTornTab() && state.windowFocused && document.hasFocus();
  }

  function rollingTornApiUsage({ record = false } = {}) {
    const now = Date.now();
    const stored = GM_getValue(API_LEDGER_KEY, []);
    const recent = (Array.isArray(stored) ? stored : []).map(Number)
      .filter((timestamp) => Number.isFinite(timestamp) && timestamp > now - API_USAGE_WINDOW_MS)
      .sort((a, b) => a - b);
    if (record) recent.push(now);
    GM_setValue(API_LEDGER_KEY, recent);
    return recent;
  }

  function apiPriorityLimit(priority) {
    if (state.settings.slowApiMode) {
      if (priority === 'high') return API_SLOW_LIMIT;
      if (priority === 'normal') return 20;
      return 10;
    }
    if (priority === 'high') return API_HARD_LIMIT;
    if (priority === 'normal') return 65;
    return 50;
  }

  function reserveTornApiCall(priority = 'normal') {
    const now = Date.now();
    const pausedUntil = Number(state.settings.apiPausedUntil) || 0;
    if (pausedUntil > now) {
      throw new Error(`Torn API paused for ${formatDuration(Math.ceil((pausedUntil - now) / 1000))}.`);
    }
    const recent = rollingTornApiUsage();
    const limit = apiPriorityLimit(priority);
    if (recent.length >= limit) {
      state.apiLimiterUntil = Number(recent[0] || now) + API_USAGE_WINDOW_MS;
      const reserved = limit < (state.settings.slowApiMode ? API_SLOW_LIMIT : API_HARD_LIMIT)
        ? ' Lower-priority checks are yielding capacity to market alerts.'
        : '';
      throw new Error(`Dashboard Torn API limit reached (${recent.length}/${limit} in the last minute).${reserved}`);
    }
    return rollingTornApiUsage({ record: true }).length;
  }

  function processApiQueue() {
    if (state.apiQueueTimer) return;
    const runNext = () => {
      state.apiQueueTimer = null;
      const priority = ['high', 'normal', 'low'].find((name) => state.apiQueues[name].length);
      if (!priority) return;
      const task = state.apiQueues[priority].shift();
      try {
        if (!visibleTornTab()) throw new Error('Paused because this Torn tab is not visible.');
        if (!state.settings.apiKey) throw new Error('Add a Torn API key in Settings.');
        reserveTornApiCall(priority);
        state.apiCalls += 1;
        task.start().then(task.resolve, task.reject);
      } catch (error) {
        task.reject(error);
      }
      const spacing = state.settings.slowApiMode ? 1_000 : 100;
      state.apiQueueTimer = window.setTimeout(runNext, spacing);
    };
    runNext();
  }

  function enqueueTornApiCall(priority, start) {
    return new Promise((resolve, reject) => {
      state.apiQueues[priority] ||= [];
      state.apiQueues[priority].push({ start, resolve, reject });
      processApiQueue();
    });
  }

  function cancelQueuedApiCalls(message) {
    Object.values(state.apiQueues).forEach((queue) => {
      while (queue.length) queue.shift().reject(new Error(message));
    });
  }

  function api(path, query = {}, { priority = 'normal' } = {}) {
    if (!visibleTornTab()) return Promise.reject(new Error('Paused because this Torn tab is not visible.'));
    if (!state.settings.apiKey) return Promise.reject(new Error('Add a Torn API key in Settings.'));
    return enqueueTornApiCall(priority, () => new Promise((resolve, reject) => {
      if (!visibleTornTab()) {
        reject(new Error('Paused because this Torn tab is not visible.'));
        return;
      }
      if (!state.settings.apiKey) {
        reject(new Error('Add a Torn API key in Settings.'));
        return;
      }

      const url = new URL(`${API_ROOT}/${path.replace(/^\/+/, '')}`);
      Object.entries({ ...query, comment: 'DailyDashboard' }).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });

      GM_xmlhttpRequest({
        method: 'GET',
        url: url.toString(),
        headers: {
          Accept: 'application/json',
          Authorization: `ApiKey ${state.settings.apiKey}`,
        },
        timeout: 20_000,
        onload(response) {
          if (!visibleTornTab()) {
            reject(new Error('Response ignored because this Torn tab is no longer visible.'));
            return;
          }
          let body;
          try {
            body = JSON.parse(response.responseText);
          } catch {
            reject(new Error(`Torn API returned invalid JSON (${response.status}).`));
            return;
          }
          if (response.status < 200 || response.status >= 300 || body?.error) {
            reject(new Error(body?.error?.error || `Torn API request failed (${response.status}).`));
            return;
          }
          resolve(body);
        },
        onerror: () => reject(new Error('Could not reach the Torn API.')),
        ontimeout: () => reject(new Error('The Torn API request timed out.')),
      });
    }));
  }

  function apiV1(section, query = {}, { priority = 'normal' } = {}) {
    if (!visibleTornTab()) return Promise.reject(new Error('Paused because this Torn tab is not visible.'));
    if (!state.settings.apiKey) return Promise.reject(new Error('Add a Torn API key in Settings.'));
    return enqueueTornApiCall(priority, () => new Promise((resolve, reject) => {
      if (!visibleTornTab()) {
        reject(new Error('Paused because this Torn tab is not visible.'));
        return;
      }
      if (!state.settings.apiKey) {
        reject(new Error('Add a Torn API key in Settings.'));
        return;
      }
      const url = new URL(`${API_V1_ROOT}/${String(section).replace(/^\/+|\/+$/g, '')}/`);
      Object.entries({ ...query, key: state.settings.apiKey, comment: 'DailyDashboard' }).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
      });
      GM_xmlhttpRequest({
        method: 'GET',
        url: url.toString(),
        headers: { Accept: 'application/json' },
        timeout: 20_000,
        onload(response) {
          if (!visibleTornTab()) {
            reject(new Error('Response ignored because this Torn tab is no longer visible.'));
            return;
          }
          let body;
          try {
            body = JSON.parse(response.responseText);
          } catch {
            reject(new Error(`Torn API returned invalid JSON (${response.status}).`));
            return;
          }
          if (response.status < 200 || response.status >= 300 || body?.error) {
            reject(new Error(body?.error?.error || `Torn API request failed (${response.status}).`));
            return;
          }
          resolve(body);
        },
        onerror: () => reject(new Error('Could not reach the Torn API.')),
        ontimeout: () => reject(new Error('The Torn API request timed out.')),
      });
    }));
  }

  function weav3rBazaars(itemId) {
    return new Promise((resolve, reject) => {
      if (!visibleTornTab()) {
        reject(new Error('Paused because this Torn tab is not visible.'));
        return;
      }
      const url = `https://weav3r.dev/item/${encodeURIComponent(Math.trunc(Number(itemId)))}`;
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { Accept: 'text/html' },
        timeout: 20_000,
        onload(response) {
          if (!visibleTornTab()) {
            reject(new Error('Response ignored because this Torn tab is no longer visible.'));
            return;
          }
          if (response.status === 429) {
            const retryAfter = String(response.responseHeaders || '').match(/^retry-after:\s*(\d+)/im);
            const error = new Error('TornW3B rate limit reached (429). Fast Bazaar polling is temporarily backed off.');
            error.rateLimited = true;
            error.retryAfterMs = Math.max(0, Number(retryAfter?.[1]) || 0) * 1000;
            reject(error);
            return;
          }
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`TornW3B request failed (${response.status}).`));
            return;
          }
          try {
            const page = new DOMParser().parseFromString(response.responseText, 'text/html');
            const freshnessBySeller = new Map();
            for (const match of String(response.responseText || '').matchAll(/playerId\\?":(\d+)[\s\S]{0,600}?lastUpdated\\?":\\?"([^"\\]+)/g)) {
              const sellerId = Number(match[1]);
              const timestamp = Date.parse(match[2]);
              if (sellerId > 0 && Number.isFinite(timestamp)) freshnessBySeller.set(sellerId, timestamp);
            }
            const listings = Array.from(page.querySelectorAll('tr.item-table-row')).map((row) => {
              const cells = row.querySelectorAll('td');
              const sellerLink = row.querySelector('a[href*="torn.com/bazaar.php?userId="]');
              const sellerId = Number(new URL(sellerLink?.href || '', 'https://www.torn.com').searchParams.get('userId'));
              const sellerText = String(sellerLink?.textContent || '').replace(/\s+/g, ' ').trim();
              const sellerName = sellerText.replace(/\s*\[\d+\]\s*$/, '').trim() || `Player ${sellerId}`;
              const quantity = Number(String(cells[1]?.textContent || '').replace(/[^0-9]/g, ''));
              const priceMatch = String(cells[2]?.textContent || '').match(/\$\s*([\d,]+)/);
              const price = Number(String(priceMatch?.[1] || '').replaceAll(',', ''));
              if (!sellerId || !Number.isFinite(price) || price <= 0) return null;
              return {
                sellerId,
                sellerName,
                quantity: Number.isFinite(quantity) ? quantity : 0,
                price,
                href: `https://www.torn.com/bazaar.php?userId=${sellerId}`,
                lastUpdatedAt: freshnessBySeller.get(sellerId) || null,
              };
            }).filter(Boolean);
            resolve({ listings, sourceUrl: url, fetchedAt: Date.now() });
          } catch (error) {
            reject(new Error(`Could not read TornW3B bazaar listings: ${error?.message || 'unknown format'}`));
          }
        },
        onerror: () => reject(new Error('Could not reach TornW3B.')),
        ontimeout: () => reject(new Error('The TornW3B request timed out.')),
      });
      state.bazaarCalls += 1;
    });
  }

  function dailyRefreshMs() {
    const normal = Math.max(5, Number(state.settings.apiDailyRefreshMinutes) || 10) * 60_000;
    return state.settings.slowApiMode ? normal * 3 : normal;
  }

  function countdownRemainingSeconds(seconds, fetchedAt) {
    const initial = Number(seconds);
    if (!Number.isFinite(initial) || initial < 0) return null;
    const elapsed = Number(fetchedAt) > 0 ? Math.max(0, (Date.now() - Number(fetchedAt)) / 1000) : 0;
    return Math.max(0, Math.ceil(initial - elapsed));
  }

  function apiCooldownRemaining(type) {
    return countdownRemainingSeconds(state.data.cooldowns?.cooldowns?.[type], state.data.cooldowns?.__fetchedAt);
  }

  function apiTravelRemaining() {
    const travel = state.data.travel?.travel;
    if (!travel) return null;
    const arrivalAt = Number(travel.arrival_at);
    if (arrivalAt > Math.floor(Date.now() / 1000)) return Math.max(0, arrivalAt - Math.floor(Date.now() / 1000));
    return countdownRemainingSeconds(travel.time_left, state.data.travel?.__fetchedAt);
  }

  function latestTctSchedule(hour, minute, now = Date.now()) {
    const date = new Date(now);
    let scheduled = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute);
    if (scheduled > now) scheduled -= TORN_DAY_MS;
    return scheduled;
  }

  function scheduledTctCheckDue(lastUpdated, hour, minute, now = Date.now()) {
    return Number(lastUpdated) < latestTctSchedule(hour, minute, now);
  }

  function raceRecordActive(race) {
    const status = String(race?.status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['open', 'in_progress', 'waiting', 'scheduled', 'pending'].includes(status)) return true;
    const start = Number(race?.schedule?.start || 0);
    const end = Number(race?.schedule?.end || 0);
    return !end && start > Math.floor(Date.now() / 1000);
  }

  function nextActiveRaceTransitionAt(races, fallbackMs = 6 * 60 * 60_000) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const transitions = (Array.isArray(races) ? races : []).filter(raceRecordActive)
      .flatMap((race) => [Number(race?.schedule?.start || 0), Number(race?.schedule?.end || 0)])
      .filter((timestamp) => timestamp > nowSeconds)
      .map((timestamp) => timestamp * 1000);
    return transitions.length ? Math.min(...transitions) + 5_000 : Date.now() + fallbackMs;
  }

  function coreFallbackRefreshMs() {
    return state.settings.slowApiMode ? 5 * 60_000 : CORE_REFRESH_MS;
  }

  function marketRefreshMs() {
    if (state.settings.marketRefreshMode === 'cache-aligned') return 30_000;
    return Math.max(1, Number(state.settings.marketRefreshMinutes) || 2) * 60_000;
  }

  function bazaarRefreshMs(watchCount = 0) {
    if (watchCount <= 2) return BAZAAR_FAST_REFRESH_MS;
    if (watchCount <= 5) return BAZAAR_MEDIUM_REFRESH_MS;
    return BAZAAR_SLOW_REFRESH_MS;
  }

  function activeMarketWatches() {
    return state.settings.marketWatches.filter((watch) => watch.enabled !== false && Number(watch.itemId) > 0 && Number(watch.maxPrice) > 0);
  }

  function marketResultSignature(result) {
    const market = result?.itemmarket;
    return JSON.stringify({
      cacheTimestamp: Number(market?.cache_timestamp) || 0,
      listings: (market?.listings || []).map((listing) => [Number(listing?.price) || 0, Number(listing?.amount) || 0]),
    });
  }

  function marketResultNextCheckAt(result) {
    const stored = Number(result?.__nextCheckAt) || 0;
    if (stored > 0) return stored;
    return (Number(result?.__fetchedAt) || 0) + marketRefreshMs();
  }

  async function refreshMarketWatches({ force = false } = {}) {
    const watches = activeMarketWatches();
    if (state.marketPolling || !visibleTornTab() || state.settings.enabled.itemMarket === false || !watches.length) return false;
    const now = Date.now();
    if (Number(state.settings.apiPausedUntil) > now) return false;
    const groups = new Map();
    watches.forEach((watch) => {
      const itemId = Math.trunc(Number(watch.itemId));
      if (!groups.has(itemId)) groups.set(itemId, []);
      groups.get(itemId).push(watch);
    });
    const dueGroups = [...groups.entries()].filter(([, itemWatches]) => {
      if (force) return true;
      const previous = state.data.market?.[itemWatches[0].uid];
      return !previous || now >= Math.max(state.marketRetryAt, marketResultNextCheckAt(previous));
    });
    if (!dueGroups.length) {
      if (!state.readyAlertGroups.has('market') && state.data.market) publishAlertGroups(['market']);
      return false;
    }
    state.marketPolling = true;
    let changed = false;
    let allOkay = true;
    try {
      await Promise.all(dueGroups.map(async ([itemId, itemWatches]) => {
        const previous = state.data.market?.[itemWatches[0].uid];
        try {
          const body = await api(`market/${itemId}/itemmarket`, { limit: 1 }, { priority: 'high' });
          const fetchedAt = Date.now();
          const cacheTimestamp = Number(body?.itemmarket?.cache_timestamp) * 1000;
          const cacheDelay = Math.max(1, Number(body?.itemmarket?.cache_delay) || 30) * 1000;
          body.__fetchedAt = fetchedAt;
          body.__nextCheckAt = state.settings.marketRefreshMode === 'cache-aligned'
            ? Math.max(fetchedAt + 5_000, cacheTimestamp + cacheDelay + 250)
            : fetchedAt + marketRefreshMs();
          if (marketResultSignature(previous) !== marketResultSignature(body)) changed = true;
          state.data.market ||= {};
          itemWatches.forEach((watch) => { state.data.market[watch.uid] = body; });
          delete state.errors[`market-item:${itemId}`];
        } catch (error) {
          allOkay = false;
          state.errors[`market-item:${itemId}`] = error?.message || 'Torn Item Market check failed.';
        }
      }));
      state.lastMarketUpdated = Date.now();
      state.marketRetryAt = allOkay ? 0 : Math.max(
        Date.now() + 5_000,
        Number(state.settings.apiPausedUntil) || 0,
        Number(state.apiLimiterUntil) || 0,
      );
      saveCheckCache();
      if (changed || !state.readyAlertGroups.has('market')) publishAlertGroups(['market']);
      return allOkay;
    } finally {
      state.marketPolling = false;
    }
  }

  function scheduleMarketPoll(delayMs = 1_000) {
    if (state.marketTimer) window.clearTimeout(state.marketTimer);
    state.marketTimer = window.setTimeout(async () => {
      state.marketTimer = null;
      await refreshMarketWatches();
      const watches = activeMarketWatches();
      const dueTimes = watches.map((watch) => marketResultNextCheckAt(state.data.market?.[watch.uid])).filter((value) => value > 0);
      const nextDue = dueTimes.length ? Math.min(...dueTimes) : Date.now() + marketRefreshMs();
      const blockedUntil = Math.max(Number(state.settings.apiPausedUntil) || 0, Number(state.apiLimiterUntil) || 0, state.marketRetryAt);
      scheduleMarketPoll(Math.max(1_000, nextDue - Date.now(), blockedUntil - Date.now()));
    }, Math.max(0, Number(delayMs) || 0));
  }

  function bazaarResultSignature(result) {
    return JSON.stringify((result?.listings || []).map((listing) => [
      Number(listing?.sellerId) || 0,
      Number(listing?.price) || 0,
      Number(listing?.quantity) || 0,
      Number(listing?.lastUpdatedAt) || 0,
    ]));
  }

  async function refreshBazaarWatches({ force = false } = {}) {
    const watches = activeMarketWatches();
    if (state.bazaarPolling || !visibleTornTab() || !state.settings.weav3rBazaarEnabled
      || state.settings.enabled.itemMarket === false || !watches.length) return false;
    const now = Date.now();
    const refreshMs = bazaarRefreshMs(watches.length);
    if (!force && (now < state.bazaarBackoffUntil || now - state.lastBazaarUpdated < refreshMs)) {
      if (!state.readyAlertGroups.has('bazaar')) {
        state.data.bazaars ||= {};
        watches.forEach((watch) => {
          const cached = state.bazaarCache[Math.trunc(Number(watch.itemId))];
          if (cached) state.data.bazaars[watch.uid] = cached;
        });
        publishAlertGroups(['bazaar']);
      }
      return false;
    }
    state.bazaarPolling = true;
    const groups = new Map();
    watches.forEach((watch) => {
      const itemId = Math.trunc(Number(watch.itemId));
      if (!groups.has(itemId)) groups.set(itemId, []);
      groups.get(itemId).push(watch);
    });
    let changed = false;
    let allOkay = true;
    let rateLimited = false;
    try {
      await Promise.all([...groups.entries()].map(async ([itemId, itemWatches]) => {
        try {
          const result = await weav3rBazaars(itemId);
          const previous = state.bazaarCache[itemId];
          if (bazaarResultSignature(previous) !== bazaarResultSignature(result)) changed = true;
          state.data.bazaars ||= {};
          itemWatches.forEach((watch) => { state.data.bazaars[watch.uid] = result; });
          state.bazaarCache[itemId] = result;
          delete state.errors[`bazaar-item:${itemId}`];
        } catch (error) {
          allOkay = false;
          state.errors[`bazaar-item:${itemId}`] = error?.message || 'TornW3B Bazaar check failed.';
          if (error?.rateLimited) {
            rateLimited = true;
            state.bazaarRateLimitStrikes += 1;
            const exponentialDelay = Math.min(5 * 60_000, 30_000 * (2 ** (state.bazaarRateLimitStrikes - 1)));
            state.bazaarBackoffUntil = Date.now() + Math.max(Number(error.retryAfterMs) || 0, exponentialDelay);
          }
        }
      }));
      state.lastBazaarUpdated = Date.now();
      if (allOkay) {
        state.bazaarRateLimitStrikes = 0;
        state.bazaarBackoffUntil = 0;
      } else if (!rateLimited) {
        state.bazaarBackoffUntil = Date.now() + refreshMs;
      }
      GM_setValue(BAZAAR_CACHE_KEY, state.bazaarCache);
      saveCheckCache();
      if (changed || !state.readyAlertGroups.has('bazaar')) publishAlertGroups(['bazaar']);
      return allOkay;
    } finally {
      state.bazaarPolling = false;
    }
  }

  function scheduleBazaarPoll(delayMs = 1_000) {
    if (state.bazaarTimer) window.clearTimeout(state.bazaarTimer);
    state.bazaarTimer = window.setTimeout(async () => {
      state.bazaarTimer = null;
      await refreshBazaarWatches();
      const watches = activeMarketWatches();
      const normalDelay = bazaarRefreshMs(watches.length);
      const backoffDelay = Math.max(0, state.bazaarBackoffUntil - Date.now());
      scheduleBazaarPoll(Math.max(1_000, backoffDelay || normalDelay));
    }, Math.max(0, Number(delayMs) || 0));
  }

  function itemCatalogFresh() {
    return state.itemCatalog.items.length > 0 && Date.now() - state.itemCatalog.fetchedAt < ITEM_CATALOG_MAX_AGE_MS;
  }

  function catalogItemsForSelectedCategory() {
    const category = state.settings.marketCatalogCategory || 'All';
    return state.itemCatalog.items.filter((item) => category === 'All' || item.type === category);
  }

  function catalogItemBySearch(search) {
    const normalized = String(search || '').trim().toLocaleLowerCase();
    if (!normalized) return null;
    return state.itemCatalog.items.find((item) => item.name.toLocaleLowerCase() === normalized) || null;
  }

  function selectCatalogItem(watch, item) {
    const previousItemId = Math.trunc(Number(watch.itemId));
    watch.itemId = item.id;
    watch.label = item.name;
    watch.searchText = item.name;
    watch.catalogType = item.type;
    watch.marketEstimate = item.marketPrice;
    if (previousItemId !== item.id) {
      if (state.data.market) delete state.data.market[watch.uid];
      if (state.data.bazaars) delete state.data.bazaars[watch.uid];
      if (previousItemId > 0 && !state.settings.marketWatches.some((other) => other.uid !== watch.uid && Math.trunc(Number(other.itemId)) === previousItemId)) {
        delete state.errors[`market-item:${previousItemId}`];
      }
      state.lastMarketUpdated = 0;
      state.lastBazaarUpdated = 0;
      scheduleMarketPoll(0);
      scheduleBazaarPoll(0);
    }
  }

  async function loadItemCatalog({ force = false } = {}) {
    if (state.itemCatalogLoading || !visibleTornTab() || (!force && itemCatalogFresh())) return;
    if (!state.settings.apiKey) {
      state.errors.itemCatalog = 'Add a Torn API key to load the searchable item list.';
      render();
      return;
    }
    state.itemCatalogLoading = true;
    render();
    try {
      const body = await api('torn/items', { cat: 'All', sort: 'ASC' }, { priority: 'low' });
      const items = (Array.isArray(body?.items) ? body.items : [])
        .filter((item) => Number(item?.id) > 0 && item?.name && MARKET_ITEM_TYPE_SET.has(item?.type) && item?.is_tradable !== false && item?.is_masked !== true)
        .map((item) => ({
          id: Math.trunc(Number(item.id)),
          name: String(item.name),
          type: String(item.type),
          marketPrice: Math.max(0, Math.trunc(Number(item.value?.market_price) || 0)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!items.length) throw new Error('Torn returned an empty item catalog.');
      state.itemCatalog = { fetchedAt: Date.now(), items };
      GM_setValue(ITEM_CATALOG_KEY, state.itemCatalog);
      state.settings.marketWatches.forEach((watch) => {
        const match = items.find((item) => item.id === Math.trunc(Number(watch.itemId))) || catalogItemBySearch(watch.label);
        if (match) selectCatalogItem(watch, match);
      });
      delete state.errors.itemCatalog;
      saveSettings();
    } catch (error) {
      state.errors.itemCatalog = error?.message || 'Could not load the Torn item catalog.';
    } finally {
      state.itemCatalogLoading = false;
      render();
    }
  }

  function tornDayStartSeconds() {
    const now = new Date();
    return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
  }

  function updateTornDayBoundary() {
    const currentDayStart = tornDayStartSeconds();
    if (state.tornDayStart === currentDayStart) return false;
    state.tornDayStart = currentDayStart;
    state.lastDailyUpdated = 0;
    delete state.data.cityItemsNow;
    delete state.data.cityItemsAtReset;
    delete state.data.refills;
    invalidateAlertGroups(['cityItem', 'refills']);
    ['cityItem', 'stockBenefits', 'energyRefill', 'nerveRefill'].forEach((id) => delete state.settings.alarmHistory[id]);
    saveSettings();
    return true;
  }


  function elementVisible(element) {
    if (!element || !element.isConnected || element.getClientRects().length === 0) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
  }

  function sidebarRoot() {
    return document.querySelector('#sidebarroot, #sidebar, [data-testid="sidebar"], aside[class*="sidebar" i]');
  }

  function onPickpocketPage() {
    if (!focusedTornPage()) return false;
    const url = new URL(location.href);
    return url.searchParams.get('sid')?.toLowerCase() === 'crimes' && /(?:^|\/)pickpocket(?:ing)?(?:\/|$)/i.test(url.hash.replace(/^#\/?/, ''));
  }

  function ensurePickpocketStyles() {
    if (document.getElementById('tdd-pickpocket-styles')) return;
    const style = document.createElement('style');
    style.id = 'tdd-pickpocket-styles';
    style.textContent = `
      [data-tdd-pickpocket-hidden="true"] { display: none !important; }
      [data-tdd-pickpocket-semantic="ideal"] { color: ${PICKPOCKET_COLORS.ideal} !important; }
      [data-tdd-pickpocket-semantic="easy"] { color: ${PICKPOCKET_COLORS.easy} !important; }
      [data-tdd-pickpocket-semantic="tooEasy"] { color: ${PICKPOCKET_COLORS.tooEasy} !important; }
      [data-tdd-pickpocket-semantic="tooHard"] { color: ${PICKPOCKET_COLORS.tooHard} !important; }
      [data-tdd-pickpocket-semantic="uncategorized"] { color: ${PICKPOCKET_COLORS.uncategorized} !important; }
      [data-tdd-pickpocket-button="ideal"] { background-color: ${PICKPOCKET_COLORS.ideal} !important; }
      [data-tdd-pickpocket-button="easy"] { background-color: ${PICKPOCKET_COLORS.easy} !important; }
      [data-tdd-pickpocket-button="tooEasy"] { background-color: ${PICKPOCKET_COLORS.tooEasy} !important; }
      [data-tdd-pickpocket-button="tooHard"] { background-color: ${PICKPOCKET_COLORS.tooHard} !important; }
      [data-tdd-pickpocket-button="uncategorized"] { background-color: ${PICKPOCKET_COLORS.uncategorized} !important; }
      [data-tdd-pickpocket-score] { margin-left: 5px; font-size: .82em; font-weight: 700; opacity: .9; }
    `;
    document.head?.appendChild(style);
  }

  function cleanupPickpocketFormatting() {
    document.querySelectorAll('[data-tdd-pickpocket-hidden], [data-tdd-pickpocket-semantic], [data-tdd-pickpocket-button], [data-tdd-pickpocket-card]')
      .forEach((element) => {
        element.removeAttribute('data-tdd-pickpocket-hidden');
        element.removeAttribute('data-tdd-pickpocket-semantic');
        element.removeAttribute('data-tdd-pickpocket-button');
        element.removeAttribute('data-tdd-pickpocket-card');
      });
    document.querySelectorAll('[data-tdd-pickpocket-score]').forEach((element) => element.remove());
    state.pickpocketFormattedCount = 0;
  }

  function pickpocketSkillFromPage() {
    const panel = document.querySelector('#crime-stats-panel, [id*="crime-stats" i], [class*="crimeStats" i]');
    if (!panel) return null;
    const text = String(panel.textContent || '').replace(/\s+/g, ' ').trim();
    const labeled = text.match(/(?:crime\s*skill|skill(?:\s*level)?)\D{0,24}(\d+(?:\.\d+)?)/i);
    if (labeled) return Number(labeled[1]);
    const skillNodes = Array.from(panel.querySelectorAll('[class*="skill" i], [aria-label*="skill" i], [title*="skill" i]'));
    for (const element of skillNodes) {
      const match = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''}`.match(/\b(\d+(?:\.\d+)?)\b/);
      if (match && Number(match[1]) >= 0 && Number(match[1]) <= 100) return Number(match[1]);
    }
    const exactNumbers = Array.from(panel.querySelectorAll('span, div')).map((element) => String(element.textContent || '').trim())
      .filter((value) => /^\d+(?:\.\d+)?$/.test(value)).map(Number)
      .filter((value) => value >= 0 && value <= 100);
    return exactNumbers.length ? exactNumbers.at(-1) : null;
  }

  function pickpocketCsSemantic(mark, skill) {
    let maxIndex = 0;
    PICKPOCKET_SKILL_STARTS.forEach((start, index) => { if (Math.floor(skill) >= start) maxIndex = index; });
    const safeCategories = PICKPOCKET_SKILL_CATEGORIES.slice(0, maxIndex + 1);
    const markIndex = safeCategories.findIndex((category) => PICKPOCKET_MARK_GROUPS[category]?.includes(mark));
    if (markIndex < 0) return 'tooHard';
    if (markIndex === safeCategories.length - 1) return 'ideal';
    if (markIndex === safeCategories.length - 2) return 'easy';
    return 'tooEasy';
  }

  function pickpocketCardForTitleGroup(titleGroup) {
    let node = titleGroup;
    let best = null;
    for (let depth = 0; depth < 12 && node?.parentElement; depth += 1) {
      node = node.parentElement;
      const commitSections = node.querySelectorAll('[class*="commitButtonSection" i]');
      if (commitSections.length === 1) best = node;
      if (commitSections.length > 1) break;
    }
    return best;
  }

  function pickpocketTitleGroups() {
    const direct = Array.from(document.querySelectorAll('[class*="titleAndProps" i]'));
    if (direct.length) return direct;
    return Array.from(document.querySelectorAll('div, section, article')).filter((element) => {
      if (element.children.length < 1 || element.children.length > 5) return false;
      const text = String(element.firstElementChild?.textContent || '').trim();
      return Object.keys(PICKPOCKET_MARK_LEVELS).some((mark) => text.startsWith(mark));
    });
  }

  function formatPickpocketTargets() {
    if (!state.settings.pickpocketHelperEnabled || !onPickpocketPage()) {
      cleanupPickpocketFormatting();
      return;
    }
    ensurePickpocketStyles();
    const scrapedSkill = pickpocketSkillFromPage();
    const skill = Number.isFinite(scrapedSkill) ? scrapedSkill : Number(state.settings.pickpocketLastSkill || 1);
    if (Number.isFinite(scrapedSkill) && Number(state.settings.pickpocketLastSkill) !== scrapedSkill) {
      state.settings.pickpocketLastSkill = scrapedSkill;
      saveSettings();
    }
    const minimum = Math.min(Number(state.settings.pickpocketMinTargetLevel) || 100, Number(state.settings.pickpocketMaxTargetLevel) || 300);
    const maximum = Math.max(Number(state.settings.pickpocketMinTargetLevel) || 100, Number(state.settings.pickpocketMaxTargetLevel) || 300);
    const formattedCards = new Set();
    for (const titleGroup of pickpocketTitleGroups()) {
      const titleElement = titleGroup.firstElementChild || titleGroup;
      const titleText = String(titleElement.textContent || '').replace(/\s+/g, ' ').trim();
      const mark = Object.keys(PICKPOCKET_MARK_LEVELS).find((name) => titleText.startsWith(name));
      if (!mark) continue;
      const card = pickpocketCardForTitleGroup(titleGroup);
      if (!card || formattedCards.has(card)) continue;
      formattedCards.add(card);
      const level = Number(PICKPOCKET_MARK_LEVELS[mark]);
      const physicalElement = titleGroup.children[1] || null;
      const physicalText = String(physicalElement?.textContent || '').trim();
      const build = physicalText.match(/^([A-Za-z]+)/)?.[1] || '';
      const activityElement = card.querySelector('[class*="activity" i]');
      const activity = String(activityElement?.textContent || '').match(/^\D+?(?=\d|$)/)?.[0]?.trim() || '';
      const csSemantic = pickpocketCsSemantic(mark, skill);
      const buildTooHard = PICKPOCKET_BUILDS_TO_AVOID[mark]?.includes(build);
      const activityTooHard = PICKPOCKET_STATUSES_TO_AVOID[mark]?.includes(activity);
      const finalSemantic = buildTooHard || activityTooHard ? 'tooHard' : csSemantic;
      card.dataset.tddPickpocketCard = mark;
      card.dataset.tddPickpocketHidden = level < minimum || level > maximum ? 'true' : 'false';
      titleElement.dataset.tddPickpocketSemantic = csSemantic;
      if (physicalElement) {
        if (buildTooHard) physicalElement.dataset.tddPickpocketSemantic = 'tooHard';
        else physicalElement.removeAttribute('data-tdd-pickpocket-semantic');
      }
      if (activityElement) {
        if (activityTooHard) activityElement.dataset.tddPickpocketSemantic = 'tooHard';
        else activityElement.removeAttribute('data-tdd-pickpocket-semantic');
      }
      const commitSection = card.querySelector('[class*="commitButtonSection" i]');
      if (commitSection) commitSection.dataset.tddPickpocketButton = finalSemantic;
      let badge = titleElement.querySelector(':scope > [data-tdd-pickpocket-score]');
      if (!badge) {
        badge = document.createElement('span');
        badge.dataset.tddPickpocketScore = '';
        titleElement.appendChild(badge);
      }
      const scoreText = `(${level}%)`;
      if (badge.textContent !== scoreText) badge.textContent = scoreText;
    }
    state.pickpocketFormattedCount = formattedCards.size;
  }

  function schedulePickpocketFormatting(delay = 120) {
    if (state.pickpocketRefreshTimer) window.clearTimeout(state.pickpocketRefreshTimer);
    state.pickpocketRefreshTimer = window.setTimeout(() => {
      state.pickpocketRefreshTimer = null;
      formatPickpocketTargets();
    }, delay);
  }

  function crimeUniqueDefinition(key) {
    return CRIME_UNIQUE_DEFINITIONS.find((definition) => definition.key === key) || null;
  }

  function activeCrimeUniqueDefinition() {
    if (!focusedTornPage()) return null;
    const url = new URL(location.href);
    if (url.searchParams.get('sid')?.toLowerCase() !== 'crimes') return null;
    const route = url.hash.replace(/^#\/?/, '').split(/[/?]/)[0].toLowerCase();
    return CRIME_UNIQUE_DEFINITIONS.find((definition) => (
      route === definition.route
      || (definition.key === 'searchCash' && ['searchforcash', 'search-cash'].includes(route))
    )) || null;
  }

  function completedCrimeUniqueIds(key) {
    const response = state.data.crimeUniques?.[key]
      || (key === 'shoplifting' ? state.data.shoplifting : null);
    return (response?.crimes?.uniques || []).map((unique) => Number(unique?.id)).filter(Number.isFinite);
  }

  function scrapeFocusedCrimeUnique() {
    const definition = activeCrimeUniqueDefinition();
    if (!definition) return { key: null, known: false, available: false, detail: '' };
    const pageText = String(document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 50_000);
    const pageLoaded = new RegExp(definition.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(pageText);
    const selector = [
      '[aria-label*="unique" i]', '[title*="unique" i]', '[data-tooltip*="unique" i]',
      '[class*="unique" i]', 'img[src*="unique" i]', 'use[href*="unique" i]',
    ].join(',');
    let markers = [];
    try {
      markers = Array.from(document.querySelectorAll(selector)).filter((element) => (
        element.isConnected && elementVisible(element) && !element.closest('#tdd-host')
      )).slice(0, 100);
    } catch {
      markers = [];
    }
    const candidates = markers.map((marker) => {
      const container = marker.closest('article, li, [class*="crime" i], [class*="option" i], [class*="target" i], section, div') || marker.parentElement;
      const signature = [
        marker.getAttribute?.('aria-label'), marker.getAttribute?.('title'), marker.getAttribute?.('data-tooltip'),
        marker.className?.baseVal || marker.className, marker.getAttribute?.('src'), marker.getAttribute?.('href'),
        container?.className?.baseVal || container?.className, container?.textContent,
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const completed = /\b(?:unique\s+)?(?:obtained|completed|claimed|collected|already found|already earned)\b/i.test(signature)
        || /\b(?:obtained|completed|claimed|collected)[-_ ]?(?:unique|outcome)\b/i.test(signature);
      const action = container?.querySelector?.('button, [role="button"]');
      const actionable = !action || (!action.disabled && action.getAttribute('aria-disabled') !== 'true');
      return { marker, container, signature, available: !completed && actionable };
    });
    const available = candidates.find((candidate) => candidate.available);
    const detailText = String(available?.container?.innerText || available?.signature || '')
      .replace(/\s+/g, ' ').trim().slice(0, 180);
    const known = pageLoaded && (markers.length > 0 || Boolean(document.querySelector('button, [role="button"]')));
    if (known) {
      state.data.crimePageChecks ||= {};
      state.data.crimePageChecks[definition.key] = {
        checkedAt: Date.now(),
        available: Boolean(available),
        detail: detailText,
      };
    }
    return {
      key: definition.key,
      known,
      available: Boolean(available),
      detail: detailText,
    };
  }

  async function refreshCrimeUniqueProgress(now = Date.now(), { force = false } = {}) {
    if (state.crimeProgressPromise) return state.crimeProgressPromise;
    const due = CRIME_UNIQUE_DEFINITIONS.filter((definition) => {
      if (!alertCheckDue(definition.alertId)) return false;
      const scheduled = definition.key === 'disposal'
        ? latestTctSchedule(0, 0, now)
        : latestTctSchedule(12, 0, now);
      const current = state.data.crimeUniques?.[definition.key]
        || (definition.key === 'shoplifting' ? state.data.shoplifting : null);
      return force || Number(current?.__fetchedAt || 0) < scheduled;
    });
    if (!due.length) return true;
    state.crimeProgressPromise = (async () => {
      const results = await Promise.all(due.map(async (definition) => {
        let succeeded = false;
        await guardedRequest(`crimeUniques:${definition.key}`, () => api(`user/${definition.crimeId}/crimes`, {}, { priority: 'low' }), (body) => {
          state.data.crimeUniques ||= {};
          state.data.crimeUniques[definition.key] = { ...body, __fetchedAt: Date.now() };
          if (definition.key === 'shoplifting') state.data.shoplifting = state.data.crimeUniques[definition.key];
          succeeded = true;
        });
        return succeeded;
      }));
      publishAlertGroups(due.map((definition) => definition.alertId));
      return results.every(Boolean);
    })().finally(() => {
      state.crimeProgressPromise = null;
    });
    return state.crimeProgressPromise;
  }

  function labeledSnippets(root, label) {
    if (!root) return [];
    const safe = label.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const selectors = [
      `[id*="${safe}" i]`,
      `[class*="${safe}" i]`,
      `[title*="${safe}" i]`,
      `[aria-label*="${safe}" i]`,
      `[data-tooltip*="${safe}" i]`,
    ].join(',');
    const snippets = [];
    try {
      Array.from(root.querySelectorAll(selectors)).slice(0, 30).forEach((element) => {
        if (!elementVisible(element)) return;
        const values = [
          element.getAttribute('title'),
          element.getAttribute('aria-label'),
          element.getAttribute('data-tooltip'),
          element.textContent,
          element.parentElement?.textContent,
        ];
        values.filter((value) => value && value.length < 400).forEach((value) => snippets.push(value.trim()));
      });
    } catch {
      // Torn occasionally changes generated class names; a failed selector is simply not a signal.
    }
    return [...new Set(snippets)];
  }

  function parseBarFromText(text, label) {
    const normalized = String(text || '').replaceAll(',', '').replace(/\s+/g, ' ');
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const labeled = normalized.match(new RegExp(`${escaped}[^0-9]{0,30}(\\d+)\\s*(?:/|of)\\s*(\\d+)`, 'i'));
    const ratios = [...normalized.matchAll(/(\d+)\s*(?:\/|of)\s*(\d+)/ig)];
    const plain = ratios.length === 1 ? ratios[0] : null;
    const match = labeled || plain;
    if (!match) return null;
    const current = Number(match[1]);
    const maximum = Number(match[2]);
    return Number.isFinite(current) && Number.isFinite(maximum) && maximum > 0 ? { current, maximum } : null;
  }

  function parseCooldownSeconds(text) {
    const value = String(text || '').toLowerCase();
    const clock = value.match(/(?:(\d+)\s*d(?:ays?)?\s*)?(\d{1,3}):(\d{2}):(\d{2})/i);
    if (clock) return Number(clock[1] || 0) * 86400 + Number(clock[2]) * 3600 + Number(clock[3]) * 60 + Number(clock[4]);
    const words = value.match(/(?:(\d+)\s*d(?:ays?)?)?\s*(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?/i);
    if (words && (words[1] || words[2] || words[3])) return Number(words[1] || 0) * 86400 + Number(words[2] || 0) * 3600 + Number(words[3] || 0) * 60;
    if (/\b(?:ready|clear|no cooldown)\b/i.test(value)) return 0;
    return null;
  }

  function parseLabeledCooldownSeconds(text, label) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`\\b${escaped}\\b`, 'i').exec(normalized);
    if (!match) return null;

    // A sidebar parent can contain several unrelated countdowns. Only inspect
    // the short section beginning at this exact status label, and stop as soon
    // as another known sidebar status begins.
    let scoped = normalized.slice(match.index, match.index + 110);
    const afterLabel = scoped.slice(match[0].length);
    const nextStatus = afterLabel.search(/\b(?:drug|medical|energy|nerve|happy|life|hospital|travel|flight|landing|arrival|racing|race|education|booster|casino|stock|organized crime)\b/i);
    if (nextStatus >= 0) scoped = scoped.slice(0, match[0].length + nextStatus);
    return parseCooldownSeconds(scoped);
  }

  function visibleStatusSignal(root, pattern) {
    if (!root) return false;
    const candidates = root.querySelectorAll('[title], [aria-label], [data-tooltip]');
    return Array.from(candidates).slice(0, 250).some((element) => {
      if (!elementVisible(element)) return false;
      return pattern.test(`${element.getAttribute('title') || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('data-tooltip') || ''}`);
    });
  }

  function colorLooksGold(value) {
    const text = String(value || '').trim().toLowerCase();
    let red;
    let green;
    let blue;
    const rgb = text.match(/rgba?\(\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/i);
    if (rgb) {
      red = Number(rgb[1]);
      green = Number(rgb[2]);
      blue = Number(rgb[3]);
    } else {
      const hex = text.match(/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i)?.[1];
      if (!hex) return false;
      const expanded = hex.length === 3 ? [...hex].map((part) => part + part).join('') : hex.slice(0, 6);
      red = Number.parseInt(expanded.slice(0, 2), 16);
      green = Number.parseInt(expanded.slice(2, 4), 16);
      blue = Number.parseInt(expanded.slice(4, 6), 16);
    }
    return red >= 160 && green >= 105 && blue <= 115 && red > blue * 1.45 && green > blue * 1.15;
  }

  function stockDividendIconStatus(root) {
    if (!root) return { known: false, ready: false };
    const selector = [
      'a[href*="stock" i]', '[title*="stock" i]', '[aria-label*="stock" i]',
      '[data-tooltip*="stock" i]', '[id*="stock" i]', '[class*="stock" i]',
    ].join(',');
    let possible = [];
    try {
      possible = Array.from(root.querySelectorAll(selector)).slice(0, 100);
    } catch {
      return { known: false, ready: false };
    }
    const candidates = [...new Set(possible.map((element) => (
      element.closest('a, button, [role="link"], [role="button"]') || element
    )))].filter((element) => {
      if (!elementVisible(element)) return false;
      const signature = [
        element.getAttribute('href'), element.getAttribute('title'), element.getAttribute('aria-label'),
        element.getAttribute('data-tooltip'), element.id, element.className?.baseVal || element.className,
      ].join(' ');
      return /(?:\?|&)sid=stocks(?:&|$)/i.test(signature)
        || /\b(?:stock market|stock exchange|stocks?|dividend)\b/i.test(signature);
    });
    for (const candidate of candidates) {
      const parent = candidate.parentElement && root.contains(candidate.parentElement) ? candidate.parentElement : null;
      const nodes = [candidate, ...(parent ? [parent] : []), ...Array.from(candidate.querySelectorAll('*')).slice(0, 80)];
      const descriptor = nodes.map((element) => [
        element.id,
        element.className?.baseVal || element.className,
        element.getAttribute?.('title'),
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('data-tooltip'),
        element.getAttribute?.('src'),
        element.getAttribute?.('href'),
        element.getAttribute?.('fill'),
        element.getAttribute?.('stroke'),
        element.getAttribute?.('style'),
      ].join(' ')).join(' ');
      if (/\b(?:dividend|payout|stock benefit)\b[\s\S]{0,60}\b(?:ready|available|collectable|collect|claim|withdraw)\b/i.test(descriptor)
        || /\b(?:ready|available|collectable)\b[\s\S]{0,60}\b(?:dividend|payout|stock benefit)\b/i.test(descriptor)
        || /\b(?:gold|golden|yellow)[-_ ]?(?:icon|state|status|variant)?\b/i.test(descriptor)) {
        return { known: true, ready: true };
      }
      for (const element of nodes) {
        const style = getComputedStyle(element);
        const colors = [
          element.getAttribute?.('fill'), element.getAttribute?.('stroke'),
          style.color, style.fill, style.stroke,
        ];
        if (colors.some(colorLooksGold)) return { known: true, ready: true };
      }
    }
    return { known: candidates.length > 0, ready: false };
  }

  function visibleStatusPercent(root, pattern) {
    if (!root) return null;
    const candidates = root.querySelectorAll('[title], [aria-label], [data-tooltip]');
    for (const element of Array.from(candidates).slice(0, 250)) {
      if (!elementVisible(element)) continue;
      const text = `${element.getAttribute('title') || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('data-tooltip') || ''}`;
      if (!pattern.test(text)) continue;
      const match = text.match(/(-?\d+(?:\.\d+)?)\s*%/);
      if (match) return Math.abs(Number(match[1]));
    }
    return null;
  }

  function visibleLabeledContext(labelPattern) {
    const candidates = document.querySelectorAll('h1, h2, h3, h4, [role="heading"], button, li, section, article, div, span');
    let best = '';
    for (const element of Array.from(candidates).slice(0, 2_500)) {
      if (!elementVisible(element)) continue;
      const ownText = String(element.textContent || '').trim();
      if (ownText.length > 120 || !labelPattern.test(ownText)) continue;
      let container = element;
      for (let depth = 0; depth < 7 && container; depth += 1, container = container.parentElement) {
        const text = String(container.innerText || '').trim();
        if (text.length < 30 || text.length > 4_000) continue;
        const attributes = Array.from(container.querySelectorAll('[title], [aria-label], [data-tooltip]')).slice(0, 80)
          .map((node) => `${node.getAttribute('title') || ''} ${node.getAttribute('aria-label') || ''} ${node.getAttribute('data-tooltip') || ''}`)
          .join(' ');
        const context = `${text} ${attributes}`;
        if (context.length > best.length) best = context;
      }
    }
    return best;
  }

  function scrapeActivePage() {
    if (!focusedTornPage()) {
      state.dom = { capturedAt: Date.now(), source: 'api-fallback' };
      return state.dom;
    }
    const root = sidebarRoot();
    if (!root) {
      state.dom = {};
      return state.dom;
    }
    const rootText = (root.innerText || '').slice(0, 12_000);
    const racingIconCandidates = Array.from(document.querySelectorAll('a[href*="sid=racing" i][aria-label*="Racing:" i]'))
      .filter((element) => element.isConnected);
    const activeRacingIcon = racingIconCandidates.find((element) => (
      /^Racing:\s*(?:Racing|Waiting for (?:a|the) race to start|Currently racing)\b/i
        .test(String(element.getAttribute('aria-label') || '').trim())
    ));
    const racingIcon = activeRacingIcon || racingIconCandidates.find(elementVisible) || racingIconCandidates[0];
    const racingIconLabel = String(racingIcon?.getAttribute('aria-label') || '').trim();
    // Torn can draw the global icon through a pseudo-element or child, leaving
    // the labeled anchor with a zero-sized box. Its attached status label is
    // still the authoritative focused-page racing signal.
    const racingIconActive = Boolean(activeRacingIcon);
    const racingIconInactive = !racingIconActive && racingIconCandidates.some((element) => {
      const label = String(element.getAttribute('aria-label') || '').trim();
      const status = label.replace(/^Racing:\s*/i, '').trim();
      return status.length > 0 && !/^(?:loading|checking|unknown)\b/i.test(status);
    });
    const racingIconState = racingIconActive ? 'active' : racingIconInactive ? 'inactive' : 'unknown';
    const raceActivePattern = /\b(?:currently (?:racing|entered|enlisted|participating)|in (?:a|the|an unofficial|a custom) (?:race|event)|(?:race|event) in progress|waiting for (?:a |the |an unofficial |a custom )?(?:race|event)(?: to start)?|(?:you (?:have )?)?(?:joined|entered|enlisted in) (?:a |the |an unofficial |a custom )?(?:race|event)|(?:race|event) (?:starts|begins) in)\b/i;
    const racePageParticipationPattern = /\b(?:you (?:are|have)(?: currently)? (?:racing|entered|enlisted|participating|joined|waiting)|currently (?:entered|enlisted|participating) in (?:this|the|an?)(?: unofficial| custom)? (?:race|event)|your (?:race|event) (?:starts|begins|is in progress)|leave (?:the |this )?(?:race|event)|withdraw from (?:the |this )?(?:race|event))\b/i;
    const onRacewayPage = /(?:\?|&)sid=racing(?:&|$)/i.test(location.search);
    const racePageText = onRacewayPage
      ? (document.body?.innerText || '').slice(0, 25_000)
      : '';
    const raceActionText = onRacewayPage
      ? Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(elementVisible).slice(0, 500)
        .map((element) => `${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''}`)
        .join(' ')
      : '';
    const currentRaceEvidence = racingIconActive
      || raceActivePattern.test(rootText)
      || visibleStatusSignal(root, raceActivePattern)
      || labeledSnippets(root, 'race').some((text) => raceActivePattern.test(text))
      || (onRacewayPage && racePageParticipationPattern.test(`${racePageText} ${raceActionText}`));
    if (currentRaceEvidence) state.confirmedRaceActive = true;
    else if (racingIconState === 'inactive') state.confirmedRaceActive = false;
    const raceActive = state.confirmedRaceActive || currentRaceEvidence;
    const racePageLoaded = onRacewayPage && /\b(?:raceway|official races|custom races|quick race|racing skill|create (?:a )?race)\b/i.test(racePageText);
    const onCrimesPage = /(?:\?|&)sid=crimes(?:&|$)/i.test(location.search);
    const pageText = onCrimesPage ? (document.body?.innerText || '').slice(0, 35_000) : '';
    const jewelryContext = onCrimesPage && /\bshoplifting\b/i.test(pageText) ? visibleLabeledContext(/\bjewelry store\b/i) : '';
    const clusterRingReady = /(?:notoriety\D{0,24}0\s*%|0\s*%\D{0,24}notoriety)/i.test(jewelryContext)
      && /(?:cameras?|cctv)\D{0,35}(?:disabled|off|inactive|down)/i.test(jewelryContext)
      && /(?:guard|security)\D{0,35}(?:off duty|on break|away|disabled|inactive|down)/i.test(jewelryContext);
    const crimeUniqueSignal = scrapeFocusedCrimeUnique();
    const stockIcon = stockDividendIconStatus(root);
    const readBar = (label) => {
      const snippets = labeledSnippets(root, label);
      for (const snippet of snippets) {
        const parsed = parseBarFromText(snippet, label);
        if (parsed) return parsed;
      }
      return parseBarFromText(rootText.match(new RegExp(`${label}[\\s\\S]{0,80}`, 'i'))?.[0], label);
    };
    const readCooldown = (label) => {
      const safe = label.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const attributeSelector = [
        `[title*="${safe}" i]`,
        `[aria-label*="${safe}" i]`,
        `[data-tooltip*="${safe}" i]`,
      ].join(',');
      try {
        for (const element of Array.from(root.querySelectorAll(attributeSelector)).slice(0, 30)) {
          if (!elementVisible(element)) continue;
          const ownStatus = [
            element.getAttribute('title'),
            element.getAttribute('aria-label'),
            element.getAttribute('data-tooltip'),
          ].filter(Boolean).join(' ');
          const parsed = parseLabeledCooldownSeconds(ownStatus, label);
          if (parsed !== null) return parsed;
        }
      } catch {
        // Generated Torn selectors can change; fall through to scoped text.
      }
      for (const snippet of labeledSnippets(root, label)) {
        const parsed = parseLabeledCooldownSeconds(snippet, label);
        if (parsed !== null) return parsed;
      }
      return null;
    };
    const readTravelSeconds = () => {
      for (const label of ['travel', 'flight', 'landing', 'arrival']) {
        for (const snippet of labeledSnippets(root, label)) {
          const parsed = parseCooldownSeconds(snippet);
          if (parsed !== null && parsed > 0) return parsed;
        }
      }
      const nearby = rootText.match(/(?:travel|flight|landing|arrival)[\s\S]{0,120}/i)?.[0];
      const parsed = parseCooldownSeconds(nearby);
      return parsed !== null && parsed > 0 ? parsed : null;
    };
    state.dom = {
      bars: { energy: readBar('energy'), nerve: readBar('nerve') },
      cooldowns: { drug: readCooldown('drug'), medical: readCooldown('medical'), booster: readCooldown('booster') },
      educationActive: visibleStatusSignal(root, /\b(?:education|course)\b/i),
      selfExcluded: visibleStatusSignal(root, /self[\s-]*exclu/i),
      away: visibleStatusSignal(root, /\b(?:traveling|travelling|abroad|in flight)\b/i),
      raceActive,
      // A positive page signal is trustworthy. A loaded Raceway page with no
      // matching text is not proof that the player is outside a custom race.
      raceSignalKnown: raceActive || racingIconState === 'inactive',
      raceIconSignalKnown: racingIconCandidates.length > 0,
      raceIconLabel: racingIconLabel || null,
      raceIconState: racingIconState,
      racePageLoaded,
      clusterRingReady,
      clusterRingSignalKnown: Boolean(jewelryContext),
      crimeUniqueSignal,
      stockBenefitsReady: stockIcon.ready,
      stockBenefitsReadyCount: stockIcon.ready ? 1 : 0,
      stockBenefitsSignalKnown: stockIcon.known,
      travelSeconds: readTravelSeconds(),
      hospitalized: visibleStatusSignal(root, /\b(?:hospital|hospitalized|hospitalised)\b/i),
      hospitalSeconds: readCooldown('hospital'),
      playerAddiction: visibleStatusPercent(root, /\b(?:addiction|black brain)\b/i),
      pageUrl: location.href,
      capturedAt: Date.now(),
      source: 'live-page',
    };
    return state.dom;
  }

  function absorbGeneric(body) {
    const wrappers = {
      bars: 'bars', cooldowns: 'cooldowns', travel: 'travel', profile: 'profile',
      missions: 'missions', education: 'education', organizedCrime: 'organizedCrime',
      refills: 'refills', icons: 'icons', enlistedCars: 'enlistedcars', races: 'races', casino: 'casino',
      battlestats: 'battlestats', job: 'job', stocks: 'stocks',
    };
    Object.entries(wrappers).forEach(([stateKey, property]) => {
      if (Object.hasOwn(body || {}, property)) state.data[stateKey] = { [property]: body[property], __fetchedAt: Date.now() };
    });
  }

  async function guardedRequest(errorKey, request, onSuccess) {
    try {
      const body = await request();
      onSuccess(body);
      delete state.errors[errorKey];
      return true;
    } catch (error) {
      state.errors[errorKey] = error?.message || 'Unknown API error.';
      return false;
    }
  }

  function fastSelectionsNeeded(requireFresh = false) {
    const selections = [];
    const apiBars = state.data.bars?.bars;
    const apiCooldowns = state.data.cooldowns?.cooldowns;
    const drugRemaining = apiCooldownRemaining('drug');
    const boosterRemaining = apiCooldownRemaining('booster');
    if ((alertCheckDue('energyFull') && !state.dom.bars?.energy && (requireFresh || !apiBars?.energy))
      || (alertCheckDue('nerveFull') && !state.dom.bars?.nerve && (requireFresh || !apiBars?.nerve))) selections.push('bars');
    if ((alertCheckDue('drugCooldown') && state.dom.cooldowns?.drug == null
      && (apiCooldowns?.drug == null || (requireFresh && drugRemaining === 0)))
      || (alertCheckDue('medicalCooldown') && state.dom.cooldowns?.medical == null && (requireFresh || apiCooldowns?.medical == null))
      || (alertCheckDue('boosterCooldown') && state.dom.cooldowns?.booster == null
        && (apiCooldowns?.booster == null || (requireFresh && boosterRemaining === 0)))) selections.push('cooldowns');
    return selections;
  }

  function slowSelectionsNeeded() {
    const selections = new Set();
    if (alertCheckDue('education') && !state.dom.educationActive) selections.add('education');
    if (alertCheckDue('organizedCrime')) { selections.add('organizedcrime'); selections.add('profile'); }
    return [...selections];
  }

  function focusedRouteAwaitingLiveData() {
    if (!focusedTornPage()) return false;
    const sid = new URL(location.href).searchParams.get('sid')?.toLowerCase() || '';
    if (sid === 'racing') return !state.dom.racePageLoaded;
    if (sid === 'crimes' && /shoplifting/i.test(location.hash)) return !state.dom.clusterRingSignalKnown;
    return false;
  }

  async function refresh({ includeDaily = false, force = false, domOnly = false } = {}) {
    if (!visibleTornTab() || state.syncing) {
      render();
      return;
    }
    const snoozeExpired = releaseExpiredSnoozes();
    scrapeActivePage();
    state.pageCheckPending = focusedRouteAwaitingLiveData();
    const liveGroups = ['turtle'];
    if (state.dom.bars?.energy) liveGroups.push('energyFull');
    if (state.dom.bars?.nerve) liveGroups.push('nerveFull');
    if (state.dom.cooldowns?.drug != null) liveGroups.push('drugCooldown');
    if (state.dom.cooldowns?.medical != null) liveGroups.push('medicalCooldown');
    if (state.dom.cooldowns?.booster != null) liveGroups.push('boosterCooldown');
    if (state.dom.stockBenefitsSignalKnown) liveGroups.push('stockBenefits');
    if (state.dom.educationActive) liveGroups.push('education');
    if (state.dom.playerAddiction != null) liveGroups.push('playerAddiction');
    if (state.dom.clusterRingSignalKnown && state.data.shoplifting) liveGroups.push('clusterRing');
    const activeCrimeDefinition = crimeUniqueDefinition(state.dom.crimeUniqueSignal?.key);
    if (state.dom.crimeUniqueSignal?.known && activeCrimeDefinition) liveGroups.push(activeCrimeDefinition.alertId);
    if (state.raceCheckComplete && !state.raceCheckPending) liveGroups.push('raceTravel');
    publishAlertGroups(liveGroups);
    const dayChanged = updateTornDayBoundary();
    if (!state.settings.apiKey || domOnly || Number(state.settings.apiPausedUntil) > Date.now()) {
      render();
      return;
    }
    const now = Date.now();
    const needsDaily = force || includeDaily || dayChanged || snoozeExpired || now - state.lastDailyUpdated >= dailyRefreshMs();
    const activeMarketWatches = state.settings.marketWatches.filter((watch) => watch.enabled !== false && Number(watch.itemId) > 0 && Number(watch.maxPrice) > 0);
    state.syncing = true;
    render();
    const tasks = [];
    try {
      tasks.push((async () => {
        const fastDue = force || snoozeExpired || now - state.lastFastUpdated >= coreFallbackRefreshMs();
        const fastSelections = fastSelectionsNeeded(fastDue);
        const okay = !fastSelections.length
          || await guardedRequest('fastFallback', () => api('user', { selections: fastSelections.join(',') }, { priority: 'low' }), absorbGeneric);
        if (!fastSelections.length) delete state.errors.fastFallback;
        if (!okay) return;
        if (fastSelections.length) state.lastFastUpdated = Date.now();
        const groups = [];
        const apiBars = state.data.bars?.bars;
        const apiCooldowns = state.data.cooldowns?.cooldowns;
        const bars = {
          energy: state.dom.bars?.energy || apiBars?.energy,
          nerve: state.dom.bars?.nerve || apiBars?.nerve,
        };
        const cooldowns = {
          drug: state.dom.cooldowns?.drug ?? apiCooldownRemaining('drug'),
          medical: state.dom.cooldowns?.medical ?? apiCooldownRemaining('medical'),
          booster: state.dom.cooldowns?.booster ?? apiCooldownRemaining('booster'),
        };
        if (bars?.energy) groups.push('energyFull');
        if (bars?.nerve) groups.push('nerveFull');
        if (cooldowns?.drug != null) groups.push('drugCooldown');
        if (cooldowns?.medical != null) groups.push('medicalCooldown');
        if (cooldowns?.booster != null) groups.push('boosterCooldown');
        publishAlertGroups(groups);
      })());

      const raceReminderDue = alertCheckDue('raceOrFly');
      const landingReminderDue = alertCheckDue('landing');
      if (raceReminderDue || landingReminderDue) {
        tasks.push((async () => {
          const liveRaceKnown = Boolean(state.confirmedRaceActive || state.dom.raceActive);
          const racePageLoaded = Boolean(state.dom.racePageLoaded);
          const liveTravelKnown = Boolean(state.dom.away) || state.dom.travelSeconds != null;
          const liveTravelRemaining = state.dom.travelSeconds != null ? Number(state.dom.travelSeconds) : null;
          const cachedTravelRemaining = apiTravelRemaining();
          const apiRaceKnownBefore = Array.isArray(state.data.races?.races);
          const apiTravelKnownBefore = Object.hasOwn(state.data.travel || {}, 'travel');
          const racewayKnownBefore = liveRaceKnown || Array.isArray(state.data.enlistedCars?.enlistedcars);
          const cachedCategoryComplete = (!raceReminderDue || liveRaceKnown || (apiRaceKnownBefore && !racePageLoaded))
            && (!(raceReminderDue || landingReminderDue) || liveTravelKnown || apiTravelKnownBefore)
            && (!raceReminderDue || racewayKnownBefore);

          // Positive icon state is definitive. Do not ask either race or travel
          // APIs while Torn says the player is racing or waiting to start.
          if (liveRaceKnown) {
            state.raceCheckPending = false;
            state.raceCheckComplete = true;
            state.lastRaceUpdated = Date.now();
            state.nextRaceTravelCheckAt = nextActiveRaceTransitionAt(state.data.races?.races);
            delete state.errors.races;
            delete state.errors.raceFallback;
            publishAlertGroups(['raceTravel']);
            return;
          }

          // A known journey suppresses the race reminder. Locally reduce its
          // saved countdown and wait until arrival before another API check.
          const knownTravelRemaining = liveTravelRemaining ?? cachedTravelRemaining;
          if ((state.dom.away || Number(knownTravelRemaining) > 0) && Number(knownTravelRemaining) > 0) {
            state.raceCheckPending = false;
            state.raceCheckComplete = true;
            state.lastRaceUpdated = Date.now();
            state.nextRaceTravelCheckAt = Date.now() + Number(knownTravelRemaining) * 1000;
            publishAlertGroups(['raceTravel']);
            return;
          }

          if (!force && !snoozeExpired && cachedCategoryComplete && now < Number(state.nextRaceTravelCheckAt || 0)) {
            state.raceCheckPending = false;
            state.raceCheckComplete = true;
            publishAlertGroups(['raceTravel']);
            return;
          }
          state.raceCheckPending = true;
          state.raceCheckComplete = false;
          render();
          const racePromise = !raceReminderDue || liveRaceKnown
            ? Promise.resolve(true)
            : guardedRequest('races', () => api('user/races', {
              limit: 100,
              sort: 'desc',
              timestamp: Math.floor(Date.now() / 1000),
            }, { priority: 'low' }), (body) => { state.data.races = body; });
          if (!raceReminderDue || liveRaceKnown) delete state.errors.races;
          const fallbackSelections = new Set();
          if ((raceReminderDue || landingReminderDue) && !liveTravelKnown) {
            fallbackSelections.add('travel');
            fallbackSelections.add('profile');
          }
          if (raceReminderDue && !liveRaceKnown) fallbackSelections.add('enlistedcars');
          const fallbackPromise = fallbackSelections.size
            ? guardedRequest('raceFallback', () => api('user', { selections: [...fallbackSelections].join(',') }, { priority: 'low' }), absorbGeneric)
            : Promise.resolve(true);
          if (!fallbackSelections.size) delete state.errors.raceFallback;
          const [raceOkay, fallbackOkay] = await Promise.all([racePromise, fallbackPromise]);
          const apiRaceKnown = Array.isArray(state.data.races?.races);
          const apiTravelKnown = Object.hasOwn(state.data.travel || {}, 'travel');
          const racewaySignalKnown = liveRaceKnown || Array.isArray(state.data.enlistedCars?.enlistedcars);
          state.raceCheckComplete = (!raceReminderDue || liveRaceKnown || (raceOkay && apiRaceKnown))
            && (!(raceReminderDue || landingReminderDue) || liveTravelKnown || (fallbackOkay && apiTravelKnown))
            && (!raceReminderDue || racewaySignalKnown);
          state.raceCheckPending = false;
          if (state.raceCheckComplete) {
            state.lastRaceUpdated = Date.now();
            const apiActiveRace = (state.data.races?.races || []).some(raceRecordActive);
            const remainingTravel = state.dom.travelSeconds ?? apiTravelRemaining();
            state.nextRaceTravelCheckAt = apiActiveRace
              ? nextActiveRaceTransitionAt(state.data.races?.races)
              : Number(remainingTravel) > 0
                ? Date.now() + Number(remainingTravel) * 1000
                : Date.now() + coreFallbackRefreshMs();
            publishAlertGroups(['raceTravel']);
          }
        })());
      }

      tasks.push(refreshCrimeUniqueProgress(now, { force }));

      if (alertCheckDue('clusterRing')) {
        tasks.push((async () => {
          if (!state.data.shoplifting && state.crimeProgressPromise) await state.crimeProgressPromise;
          const cachedStatusKnown = state.dom.clusterRingSignalKnown
            || Array.isArray(state.data.shopliftingStatus?.shoplifting?.jewelry_store);
          if (!force && !snoozeExpired && cachedStatusKnown && state.data.shoplifting && now - state.lastClusterUpdated < coreFallbackRefreshMs()) {
            publishAlertGroups(['clusterRing']);
            return;
          }
          const statusPromise = state.dom.clusterRingSignalKnown
            ? Promise.resolve(true)
            : guardedRequest('clusterRingStatus', () => api('torn', { selections: 'shoplifting' }, { priority: 'low' }), (body) => { state.data.shopliftingStatus = body; });
          if (state.dom.clusterRingSignalKnown) delete state.errors.clusterRingStatus;
          const uniquePromise = state.data.shoplifting ? Promise.resolve(true) : Promise.resolve(false);
          const [statusOkay, uniqueOkay] = await Promise.all([statusPromise, uniquePromise]);
          if (statusOkay && uniqueOkay && state.data.shoplifting) {
            state.lastClusterUpdated = Date.now();
            publishAlertGroups(['clusterRing']);
          }
        })());
      }

      const missionsDue = alertCheckDue('missions')
        && (force || snoozeExpired || scheduledTctCheckDue(state.lastMissionsUpdated, 0, 15, now));
      const casinoDue = alertCheckDue('casinoTokens')
        && (force || snoozeExpired || scheduledTctCheckDue(state.lastCasinoUpdated, 0, 15, now));
      const jobAddictionDue = alertCheckDue('jobAddiction')
        && (force || snoozeExpired || scheduledTctCheckDue(state.lastJobAddictionUpdated, 18, 15, now));
      const dailyTasks = [];

      if (needsDaily && visibleTornTab()) {
        const slowSelections = slowSelectionsNeeded();
        if (slowSelections.length) {
          dailyTasks.push((async () => {
            const okay = await guardedRequest('dailyFallback', () => api('user', { selections: slowSelections.join(','), limit: 20, sort: 'desc' }), absorbGeneric);
            if (!okay) return;
            const groups = [];
            if (state.settings.enabled.education && Object.hasOwn(state.data.education || {}, 'education')) groups.push('education');
            if (state.settings.enabled.organizedCrime
              && Object.hasOwn(state.data.organizedCrime || {}, 'organizedCrime')
              && Object.hasOwn(state.data.profile || {}, 'profile')) groups.push('organizedCrime');
            publishAlertGroups(groups);
          })());
        }
        const needsRefills = alertCheckDue('energyRefill') || alertCheckDue('nerveRefill');
        if (needsRefills) {
          dailyTasks.push((async () => {
            const okay = await guardedRequest('legacyDaily', () => apiV1('user', { selections: 'refills' }), (body) => { state.data.refills = { ...body, __fetchedAt: Date.now() }; });
            if (okay) publishAlertGroups(['refills']);
          })());
        }
        if (alertCheckDue('playerAddiction') && state.dom.playerAddiction == null) {
          dailyTasks.push((async () => {
            const okay = await guardedRequest('playerAddiction', () => api('user/battlestats'), (body) => { state.data.battlestats = body; });
            if (okay) publishAlertGroups(['playerAddiction']);
          })());
        }
        if (alertCheckDue('cityItem')) {
          dailyTasks.push((async () => {
            const results = await Promise.all([
              guardedRequest('cityItemsNow', () => api('user/personalstats', { cat: 'trading' }), (body) => { state.data.cityItemsNow = body; }),
              guardedRequest('cityItemsAtReset', () => api('user/personalstats', { stat: 'cityitemsbought', timestamp: state.tornDayStart }), (body) => { state.data.cityItemsAtReset = body; }),
            ]);
            if (results.every(Boolean)) publishAlertGroups(['cityItem']);
          })());
        }
      }

      if (missionsDue) {
        dailyTasks.push((async () => {
          const okay = await guardedRequest('missions', () => api('user', { selections: 'missions', limit: 20, sort: 'desc' }), absorbGeneric);
          if (!okay) return;
          state.lastMissionsUpdated = Date.now();
          publishAlertGroups(['missions']);
        })());
      }

      if (casinoDue) {
        dailyTasks.push((async () => {
          const casinoPromise = guardedRequest('casino', () => api('user/casino'), (body) => { state.data.casino = { ...body, __fetchedAt: Date.now() }; });
          const iconsPromise = state.dom.selfExcluded
            ? Promise.resolve(true)
            : guardedRequest('casinoExclusion', () => api('user', { selections: 'icons' }), absorbGeneric);
          if (state.dom.selfExcluded) delete state.errors.casinoExclusion;
          const [casinoOkay, iconsOkay] = await Promise.all([casinoPromise, iconsPromise]);
          if (!casinoOkay || !iconsOkay) return;
          state.lastCasinoUpdated = Date.now();
          publishAlertGroups(['casinoTokens']);
        })());
      }

      if (jobAddictionDue) {
        dailyTasks.push((async () => {
          const baseOkay = await guardedRequest('jobAddictionBase', () => api('user', { selections: 'profile,job' }), absorbGeneric);
          if (!baseOkay) return;
          let complete = true;
          if (state.data.job?.job?.type === 'company') {
            complete = await guardedRequest('jobAddiction', () => api('company/employees'), (body) => { state.data.companyEmployees = body; });
          } else {
            delete state.errors.jobAddiction;
            state.data.companyEmployees = null;
          }
          if (!complete) return;
          state.lastJobAddictionUpdated = Date.now();
          publishAlertGroups(['jobAddiction']);
        })());
      }

      const cachedDailyGroups = [];
      if (!missionsDue && state.settings.enabled.missions && Object.hasOwn(state.data.missions || {}, 'missions')) cachedDailyGroups.push('missions');
      if (!needsDaily && state.settings.enabled.education && (state.dom.educationActive || Object.hasOwn(state.data.education || {}, 'education'))) cachedDailyGroups.push('education');
      if (!needsDaily && state.settings.enabled.organizedCrime
        && Object.hasOwn(state.data.organizedCrime || {}, 'organizedCrime')
        && Object.hasOwn(state.data.profile || {}, 'profile')) cachedDailyGroups.push('organizedCrime');
      if (!casinoDue && state.settings.enabled.casinoTokens && state.data.casino?.casino
        && (state.dom.selfExcluded || Array.isArray(state.data.icons?.icons))) cachedDailyGroups.push('casinoTokens');
      if (!needsDaily && (state.settings.enabled.energyRefill || state.settings.enabled.nerveRefill) && state.data.refills?.refills) cachedDailyGroups.push('refills');
      if (!needsDaily && state.settings.enabled.cityItem && state.data.cityItemsNow && state.data.cityItemsAtReset) cachedDailyGroups.push('cityItem');
      if (!needsDaily && state.settings.enabled.playerAddiction && (state.dom.playerAddiction != null || state.data.battlestats?.battlestats)) cachedDailyGroups.push('playerAddiction');
      if (!jobAddictionDue && state.settings.enabled.jobAddiction && state.data.job?.job
        && (state.data.job.job.type !== 'company' || state.data.companyEmployees?.employees)) cachedDailyGroups.push('jobAddiction');
      publishAlertGroups(cachedDailyGroups);

      if (dailyTasks.length || needsDaily) {
        tasks.push(Promise.all(dailyTasks).then(() => {
          if (needsDaily) state.lastDailyUpdated = Date.now();
          saveCheckCache();
        }));
      }
      if (state.settings.enabled.itemMarket !== false && activeMarketWatches.length && visibleTornTab()) {
        tasks.push(refreshMarketWatches({ force }));
      } else if (state.settings.enabled.itemMarket !== false && activeMarketWatches.length && state.data.market) {
        publishAlertGroups(['market']);
      }
      if (state.settings.weav3rBazaarEnabled && state.settings.enabled.itemMarket !== false && activeMarketWatches.length && visibleTornTab()) {
        tasks.push(refreshBazaarWatches({ force }));
      } else if (state.settings.weav3rBazaarEnabled && state.settings.enabled.itemMarket !== false && activeMarketWatches.length) {
        state.data.bazaars ||= {};
        activeMarketWatches.forEach((watch) => {
          const cached = state.bazaarCache[Math.trunc(Number(watch.itemId))];
          if (cached) state.data.bazaars[watch.uid] = cached;
        });
        publishAlertGroups(['bazaar']);
      }
      await Promise.all(tasks);
      state.lastUpdated = Date.now();
      saveCheckCache();
    } finally {
      state.syncing = false;
      render();
    }
  }

  function numberFromPersonalStats(body) {
    const stats = body?.personalstats;
    if (Array.isArray(stats)) {
      const row = stats.find((item) => item?.name === 'cityitemsbought');
      return Number.isFinite(Number(row?.value)) ? Number(row.value) : null;
    }
    const nested = stats?.trading?.items?.bought?.shops;
    if (Number.isFinite(Number(nested))) return Number(nested);

    const visited = new Set();
    function search(value, depth = 0) {
      if (!value || typeof value !== 'object' || depth > 8 || visited.has(value)) return null;
      visited.add(value);
      if (Number.isFinite(Number(value.cityitemsbought))) return Number(value.cityitemsbought);
      if (value.name === 'cityitemsbought' && Number.isFinite(Number(value.value))) {
        return Number(value.value);
      }
      for (const child of Object.values(value)) {
        const match = search(child, depth + 1);
        if (match !== null) return match;
      }
      return null;
    }
    return search(body);
  }

  function refillUsedStatus(refills, type) {
    if (!refills || typeof refills !== 'object') return null;
    const direct = refills[type];
    const candidates = [
      direct && typeof direct === 'object' ? direct.used : direct,
      refills[`${type}_refill_used`],
      refills[`${type}RefillUsed`],
    ];
    for (const value of candidates) {
      if (typeof value === 'boolean') return value;
      if (value === 0 || value === 1) return Boolean(value);
      if (typeof value === 'string' && /^(?:true|false|0|1)$/i.test(value.trim())) {
        return /^(?:true|1)$/i.test(value.trim());
      }
    }
    return null;
  }

  function iconSelfExclusion() {
    if (state.dom.selfExcluded) return { title: 'Visible self-exclusion status', untilMs: 0 };
    const icons = state.data.icons?.icons;
    if (!Array.isArray(icons)) return null;
    const icon = icons.find((item) => /self[\s-]*exclu/i.test(`${item?.title || ''} ${item?.description || ''}`));
    if (!icon) return null;
    const untilMs = Number(icon.until || 0) * 1000;
    if (untilMs && untilMs <= Date.now()) return null;
    return { title: icon.title || 'Self-excluded', untilMs };
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours) return `${hours}h ${minutes}m`;
    if (total < 60) return `${total}s`;
    return `${minutes}m`;
  }

  function playerAddictionPercent() {
    if (state.dom.playerAddiction != null) return Number(state.dom.playerAddiction);
    const stats = state.data.battlestats?.battlestats;
    if (!stats) return null;
    const values = ['strength', 'defense', 'speed', 'dexterity'].flatMap((name) => {
      const modifiers = stats[name]?.modifiers;
      if (!Array.isArray(modifiers)) return [];
      return modifiers
        .filter((modifier) => /addiction/i.test(`${modifier?.effect || ''} ${modifier?.type || ''}`))
        .map((modifier) => Math.abs(Number(modifier?.value)))
        .filter(Number.isFinite);
    });
    return values.length ? Math.max(...values) : 0;
  }

  function jobAddictionPenalty() {
    const employees = state.data.companyEmployees?.employees;
    const userId = Number(state.data.profile?.profile?.id);
    if (!Array.isArray(employees) || !userId) return null;
    const employee = employees.find((item) => Number(item?.id) === userId);
    const value = Number(employee?.effectiveness?.addiction);
    return Number.isFinite(value) ? Math.abs(value) : null;
  }

  function hospitalEndFromCurrentData() {
    if (state.dom.hospitalized && Number(state.dom.hospitalSeconds) > 0) {
      return Date.now() + Number(state.dom.hospitalSeconds) * 1000;
    }
    const status = state.data.profile?.profile?.status;
    const untilMs = Number(status?.until || 0) * 1000;
    if (/hospital/i.test(String(status?.state || '')) && untilMs > Date.now()) return untilMs;
    return 0;
  }

  async function setTurtleTimer() {
    if (state.turtleChecking || !visibleTornTab()) return;
    state.turtleChecking = true;
    scrapeActivePage();
    render();
    try {
      let endAt = hospitalEndFromCurrentData();
      if (!endAt && state.settings.apiKey) {
        const body = await api('user/profile', {}, { priority: 'low' });
        state.data.profile = body;
        endAt = hospitalEndFromCurrentData();
      }
      if (!endAt) throw new Error('No active hospital timer was found on the visible page or in your profile API data.');
      state.settings.turtleEndAt = endAt;
      state.settings.enabled.turtle = true;
      delete state.settings.snoozedUntil.turtle;
      removeSnoozesWhere((id) => id === 'turtle');
      delete state.settings.alarmHistory.turtle;
      delete state.errors.turtleTimer;
      saveSettings();
    } catch (error) {
      state.errors.turtleTimer = error?.message || 'Could not set the Turtle timer.';
    } finally {
      state.turtleChecking = false;
      if (state.alertSnapshotReady && !state.syncing) publishAlertSnapshot();
      render();
    }
  }

  function marketAlerts() {
    if (state.settings.enabled.itemMarket === false) return [];
    return state.settings.marketWatches.map((watch) => {
      const result = state.data.market?.[watch.uid]?.itemmarket;
      const listings = Array.isArray(result?.listings) ? result.listings.filter((listing) => Number.isFinite(Number(listing?.price))) : [];
      const cheapest = listings.length ? listings.reduce((best, listing) => Number(listing.price) < Number(best.price) ? listing : best) : null;
      const itemId = Math.trunc(Number(watch.itemId));
      const threshold = Number(watch.maxPrice);
      const name = String(watch.label || result?.item?.name || `Item ${itemId}`);
      const href = `https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${encodeURIComponent(itemId)}`;
      return {
        id: `market:${watch.uid}`,
        active: watch.enabled !== false && itemId > 0 && threshold > 0 && cheapest && Number(cheapest.price) <= threshold,
        title: `Item Market: ${name} is below your target`,
        detail: cheapest ? `Item Market listing - $${Number(cheapest.price).toLocaleString()}${Number(cheapest.amount) > 1 ? ` x ${Number(cheapest.amount).toLocaleString()}` : ''} - target $${threshold.toLocaleString()}` : '',
        links: [{ label: 'Open Item Market', href }],
        share: cheapest ? {
          source: 'Item Market',
          item: name,
          price: Number(cheapest.price),
          quantity: Number(cheapest.amount) || 0,
          href,
          destination: `Item Market for ${name}`,
        } : null,
        tone: 'urgent',
      };
    });
  }

  function bazaarAlerts() {
    if (!state.settings.weav3rBazaarEnabled || state.settings.enabled.itemMarket === false) return [];
    return state.settings.marketWatches.flatMap((watch) => {
      if (watch.enabled === false || Number(watch.itemId) <= 0 || Number(watch.maxPrice) <= 0) return [];
      const result = state.data.bazaars?.[watch.uid];
      const threshold = Number(watch.maxPrice);
      const itemId = Math.trunc(Number(watch.itemId));
      const name = String(watch.label || `Item ${itemId}`);
      const bestBySeller = new Map();
      (Array.isArray(result?.listings) ? result.listings : []).forEach((listing) => {
        const previous = bestBySeller.get(listing.sellerId);
        if (!previous || Number(listing.price) < Number(previous.price)) bestBySeller.set(listing.sellerId, listing);
      });
      return [...bestBySeller.values()]
        .filter((listing) => Number(listing.price) <= threshold)
        .sort((a, b) => Number(a.price) - Number(b.price))
        .slice(0, 5)
        .map((listing) => {
          const freshnessSeconds = Number(listing.lastUpdatedAt) > 0
            ? Math.max(0, Math.floor((Date.now() - Number(listing.lastUpdatedAt)) / 1000))
            : null;
          const freshness = freshnessSeconds === null
            ? ''
            : freshnessSeconds < 60 ? ` - seller checked ${freshnessSeconds}s ago`
              : ` - seller checked ${Math.floor(freshnessSeconds / 60)}m ago`;
          return {
            id: `bazaar:${watch.uid}:${listing.sellerId}`,
            active: true,
            title: `Bazaar: ${name} from ${listing.sellerName}`,
            detail: `Player bazaar listing - $${Number(listing.price).toLocaleString()}${Number(listing.quantity) > 0 ? ` x ${Number(listing.quantity).toLocaleString()}` : ''} - target $${threshold.toLocaleString()}${freshness} - TornW3B`,
            links: [
              { label: `${listing.sellerName}'s Bazaar`, href: listing.href },
              { label: 'W3B', href: result?.sourceUrl || `https://weav3r.dev/item/${itemId}` },
            ],
            share: {
              source: 'Bazaar',
              item: name,
              sellerName: listing.sellerName,
              sellerId: listing.sellerId,
              price: Number(listing.price),
              quantity: Number(listing.quantity) || 0,
              href: listing.href,
              destination: `${listing.sellerName}'s Bazaar`,
            },
            tone: 'urgent',
            noDisable: true,
          };
        });
    });
  }

  function createAlerts() {
    const apiBars = state.data.bars?.bars;
    const apiCooldowns = state.data.cooldowns?.cooldowns;
    const bars = {
      energy: state.dom.bars?.energy || apiBars?.energy,
      nerve: state.dom.bars?.nerve || apiBars?.nerve,
    };
    const cooldowns = {
      drug: state.dom.cooldowns?.drug ?? apiCooldownRemaining('drug'),
      medical: state.dom.cooldowns?.medical ?? apiCooldownRemaining('medical'),
      booster: state.dom.cooldowns?.booster ?? apiCooldownRemaining('booster'),
    };
    const profile = state.data.profile?.profile;
    const travel = state.data.travel?.travel;
    const missions = state.data.missions?.missions?.givers || [];
    const contracts = missions.flatMap((giver) => giver?.contracts || []);
    const acceptedMissions = contracts.filter((contract) => contract?.status === 'Accepted');
    const education = state.data.education?.education;
    const organizedCrime = state.data.organizedCrime?.organizedCrime;
    const refills = state.data.refills?.refills;
    const energyRefillUsed = refillUsedStatus(refills, 'energy');
    const nerveRefillUsed = refillUsedStatus(refills, 'nerve');
    const casino = state.data.casino?.casino;
    const stockBenefitsReadyCount = Number(state.dom.stockBenefitsReadyCount) || (state.dom.stockBenefitsReady ? 1 : 0);
    const stockBenefitsReady = Boolean(state.dom.stockBenefitsSignalKnown && state.dom.stockBenefitsReady);
    const races = state.data.races?.races || [];
    const cars = state.data.enlistedCars?.enlistedcars || [];
    const apiActiveRace = races.some(raceRecordActive);
    const activeRace = Boolean(state.confirmedRaceActive || state.dom.raceActive) || apiActiveRace;
    const racewayUnlocked = Boolean(state.dom.racePageLoaded) || cars.length > 0 || races.length > 0;
    const clusterRingAchieved = (state.data.shoplifting?.crimes?.uniques || []).some((unique) =>
      (unique?.rewards?.items || []).some((item) => Number(item?.id ?? item?.item_id) === 1465));
    const jewelrySecurity = state.data.shopliftingStatus?.shoplifting?.jewelry_store;
    const apiClusterRingSecurityReady = Array.isArray(jewelrySecurity)
      && Boolean(jewelrySecurity[0]?.disabled)
      && Boolean(jewelrySecurity[1]?.disabled);
    const clusterRingSecurityReady = state.dom.clusterRingSignalKnown
      ? Boolean(state.dom.clusterRingReady)
      : apiClusterRingSecurityReady;
    const shopliftingSkill = Number(state.data.shoplifting?.crimes?.skill);
    const clusterRingSkillEligible = !Number.isFinite(shopliftingSkill) || shopliftingSkill >= 100;
    const crimeUniqueSignal = state.dom.crimeUniqueSignal || {};
    const searchCashCompleted = completedCrimeUniqueIds('searchCash');
    const disposalCompleted = completedCrimeUniqueIds('disposal');
    const arsonCompleted = completedCrimeUniqueIds('arson');
    const travelSeconds = state.dom.travelSeconds ?? apiTravelRemaining();
    const away = state.dom.away || ['Traveling', 'Abroad'].includes(profile?.status?.state) || Number(travelSeconds) > 0;
    const turtleSeconds = Math.max(0, Math.ceil((Number(state.settings.turtleEndAt) - Date.now()) / 1000));
    const excluded = iconSelfExclusion();
    const cityNow = numberFromPersonalStats(state.data.cityItemsNow);
    const cityAtReset = numberFromPersonalStats(state.data.cityItemsAtReset);
    const boughtInCityToday = cityNow !== null && cityAtReset !== null ? Math.max(0, cityNow - cityAtReset) : null;
    const medicalThresholdSeconds = Number(state.settings.medicalThresholdHours || 3) * 3600;
    const boosterThresholdSeconds = Number(state.settings.boosterThresholdHours ?? 3) * 3600;
    const playerAddiction = playerAddictionPercent();
    const jobAddiction = jobAddictionPenalty();

    const alerts = [
      {
        id: 'drugCooldown',
        active: cooldowns && cooldowns.drug === 0,
        title: 'Drug cooldown is clear',
        detail: 'You can take a drug now.',
        links: [
          { label: 'Items', href: 'https://www.torn.com/item.php' },
          { label: 'Armory', href: 'https://www.torn.com/factions.php?step=your&search=first#/tab=armoury&start=0&sub=drugs' },
        ],
        tone: 'ready',
      },
      {
        id: 'nerveFull',
        active: bars?.nerve && bars.nerve.current >= bars.nerve.maximum,
        title: 'Nerve is full',
        detail: bars?.nerve ? `${bars.nerve.current} / ${bars.nerve.maximum}` : '',
        href: 'https://www.torn.com/crimes.php',
        tone: 'urgent',
      },
      {
        id: 'energyFull',
        active: bars?.energy && bars.energy.current >= bars.energy.maximum && bars.energy.current <= 150,
        title: 'Energy is full',
        detail: bars?.energy ? `${bars.energy.current} / ${bars.energy.maximum}` : '',
        href: 'https://www.torn.com/gym.php',
        tone: 'urgent',
      },
      {
        id: 'medicalCooldown',
        active: cooldowns?.medical != null && cooldowns.medical <= medicalThresholdSeconds,
        title: cooldowns?.medical === 0 ? 'Medical cooldown clear - fill blood bags' : 'Medical cooldown is nearly clear',
        detail: cooldowns ? (cooldowns.medical === 0 ? 'Fill an empty blood bag or collect medical supplies.' : `${formatDuration(cooldowns.medical)} remaining`) : '',
        timerSeconds: Number(cooldowns?.medical) || 0,
        links: [
          { label: 'Items', href: 'https://www.torn.com/item.php' },
          { label: 'Armory', href: 'https://www.torn.com/factions.php?step=your&search=first#/tab=armoury&start=0&sub=medical' },
        ],
        tone: 'ready',
      },
      {
        id: 'boosterCooldown',
        active: cooldowns?.booster != null && cooldowns.booster <= boosterThresholdSeconds,
        title: cooldowns?.booster === 0 ? 'Booster cooldown is clear' : 'Booster cooldown is nearly clear',
        detail: cooldowns?.booster != null ? (cooldowns.booster === 0 ? 'You can use a booster now.' : `${formatDuration(cooldowns.booster)} remaining`) : '',
        timerSeconds: Number(cooldowns?.booster) || 0,
        links: [
          { label: 'Items', href: 'https://www.torn.com/item.php' },
          { label: 'Armory', href: 'https://www.torn.com/factions.php?step=your&search=first#/tab=armoury&start=0&sub=boosters' },
        ],
        tone: 'ready',
      },
      {
        id: 'missions',
        active: acceptedMissions.length > 0,
        title: acceptedMissions.length === 1 ? 'Mission is unfinished' : `${acceptedMissions.length} missions are unfinished`,
        detail: acceptedMissions.slice(0, 2).map((item) => item.title).filter(Boolean).join(' / '),
        href: 'https://www.torn.com/page.php?sid=missions',
        tone: 'daily',
      },
      {
        id: 'cityItem',
        active: boughtInCityToday !== null && boughtInCityToday < 100,
        title: 'Buy 100 items from city shops',
        detail: boughtInCityToday !== null ? `${boughtInCityToday} / 100 bought since today's Torn reset - ${100 - boughtInCityToday} remaining.` : '',
        links: [{ label: 'City', href: 'https://www.torn.com/city.php' }],
        tone: 'daily',
      },
      {
        id: 'raceOrFly',
        active: state.raceCheckComplete && !state.raceCheckPending && racewayUnlocked && !activeRace && !away,
        title: 'Start a race or take a flight',
        detail: 'You are on the ground and not entered in an active race.',
        links: [
          { label: 'Raceway', href: 'https://www.torn.com/page.php?sid=racing' },
          { label: 'Travel', href: 'https://www.torn.com/travelagency.php' },
        ],
        tone: 'daily',
      },
      {
        id: 'searchCashUnique',
        active: crimeUniqueSignal.key === 'searchCash' && crimeUniqueSignal.known && crimeUniqueSignal.available,
        title: 'Search for Cash unique is available',
        detail: crimeUniqueSignal.key === 'searchCash' && crimeUniqueSignal.detail
          ? crimeUniqueSignal.detail
          : `${searchCashCompleted.length} Search for Cash uniques recorded as completed.`,
        links: [{ label: 'Search for Cash', href: 'https://www.torn.com/page.php?sid=crimes#/search-for-cash' }],
        tone: 'urgent',
      },
      {
        id: 'clusterRing',
        active: clusterRingSecurityReady && clusterRingSkillEligible && !clusterRingAchieved,
        title: state.dom.clusterRingReady ? 'Cluster Ring unique is available' : 'Cluster Ring security window is open',
        detail: state.dom.clusterRingReady
          ? 'Jewelry Store shows 0% notoriety, cameras disabled, and the guard off duty. You have one clean attempt.'
          : 'Jewelry Store cameras and guard are disabled. The unique still requires Shoplifting skill 100 and 0% Jewelry Store notoriety.',
        links: [{ label: 'Shoplift', href: 'https://www.torn.com/page.php?sid=crimes#/shoplifting' }],
        tone: 'urgent',
      },
      {
        id: 'disposalUnique',
        active: crimeUniqueSignal.key === 'disposal' && crimeUniqueSignal.known && crimeUniqueSignal.available,
        title: 'Disposal unique is available',
        detail: crimeUniqueSignal.key === 'disposal' && crimeUniqueSignal.available && crimeUniqueSignal.detail
          ? crimeUniqueSignal.detail
          : `${disposalCompleted.length} of 11 unique outcomes are recorded as completed.`,
        links: [{ label: 'Disposal', href: 'https://www.torn.com/page.php?sid=crimes#/disposal' }],
        tone: 'urgent',
      },
      {
        id: 'arsonUnique',
        active: crimeUniqueSignal.key === 'arson' && crimeUniqueSignal.known && crimeUniqueSignal.available,
        title: 'Arson unique is available',
        detail: crimeUniqueSignal.key === 'arson' && crimeUniqueSignal.detail
          ? crimeUniqueSignal.detail
          : `${arsonCompleted.length} Arson uniques recorded as completed.`,
        links: [{ label: 'Arson', href: 'https://www.torn.com/page.php?sid=crimes#/arson' }],
        tone: 'urgent',
      },
      {
        id: 'landing',
        active: travelSeconds !== null && travelSeconds > 0 && travelSeconds <= Math.max(1, Number(state.settings.landingLeadMinutes) || 5) * 60,
        title: 'Landing soon',
        detail: `${travel?.destination ? `Arriving in ${travel.destination} in ` : 'Landing in '}${formatDuration(travelSeconds)}`,
        timerSeconds: Number(travelSeconds) || 0,
        links: [{ label: 'Travel', href: 'https://www.torn.com/index.php' }],
        tone: 'landing',
      },
      {
        id: 'turtle',
        active: turtleSeconds > 0 && turtleSeconds <= Math.max(1, Number(state.settings.turtleLeadMinutes) || 5) * 60,
        title: 'Turtle timer: release soon',
        detail: `Hospital timer ends in ${formatDuration(turtleSeconds)}. Re-hospitalize before release.`,
        timerSeconds: turtleSeconds,
        links: [
          { label: 'Hospital', href: 'https://www.torn.com/hospitalview.php' },
          { label: 'Items', href: 'https://www.torn.com/item.php' },
        ],
        tone: 'turtle',
      },
      {
        id: 'organizedCrime',
        active: profile?.faction_id != null && organizedCrime === null,
        title: 'Join an organized crime',
        detail: 'No current OC was returned for your faction membership.',
        href: 'https://www.torn.com/factions.php?step=your#/tab=crimes',
        tone: 'daily',
      },
      {
        id: 'education',
        active: !state.dom.educationActive && education && education.current === null,
        title: 'Start an education course',
        detail: 'No active education was returned.',
        href: 'https://www.torn.com/education.php',
        tone: 'daily',
      },
      {
        id: 'casinoTokens',
        active: casino && casino.tokens > 0 && !excluded,
        title: 'Spend casino tokens',
        detail: casino ? `${casino.tokens.toLocaleString()} token${casino.tokens === 1 ? '' : 's'} available` : '',
        href: 'https://www.torn.com/casino.php',
        tone: 'daily',
      },
      {
        id: 'stockBenefits',
        active: stockBenefitsReady,
        title: stockBenefitsReadyCount === 1 ? 'Stock benefit is ready to collect' : `${stockBenefitsReadyCount} stock benefits are ready to collect`,
        detail: 'Torn\'s focused information-panel stock icon is showing its collectable state.',
        links: [{ label: 'Stocks', href: 'https://www.torn.com/page.php?sid=stocks' }],
        tone: 'ready',
      },
      {
        id: 'energyRefill',
        active: energyRefillUsed === false,
        title: 'Energy refill is unused',
        detail: 'Your daily point refill is still available.',
        links: [{ label: 'Points', href: 'https://www.torn.com/points.php' }],
        tone: 'daily',
      },
      {
        id: 'nerveRefill',
        active: nerveRefillUsed === false,
        title: 'Nerve refill is unused',
        detail: 'Your daily point refill is still available.',
        links: [{ label: 'Points', href: 'https://www.torn.com/points.php' }],
        tone: 'daily',
      },
      {
        id: 'jobAddiction',
        active: jobAddiction != null && jobAddiction > Number(state.settings.jobAddictionThreshold || 0),
        title: 'Job addiction is above your limit',
        detail: jobAddiction != null ? `${jobAddiction} effectiveness-point penalty - threshold ${Number(state.settings.jobAddictionThreshold || 0)}` : '',
        links: [
          { label: 'Travel', href: 'https://www.torn.com/travelagency.php' },
          { label: 'Rehab', href: 'https://www.torn.com/rehab.php' },
        ],
        tone: 'urgent',
      },
      {
        id: 'playerAddiction',
        active: playerAddiction != null && playerAddiction > Number(state.settings.playerAddictionThreshold || 0),
        title: 'Player addiction is above your limit',
        detail: playerAddiction != null ? `${playerAddiction}% battle-stat penalty - threshold ${Number(state.settings.playerAddictionThreshold || 0)}%` : '',
        links: [
          { label: 'Travel', href: 'https://www.torn.com/travelagency.php' },
          { label: 'Rehab', href: 'https://www.torn.com/rehab.php' },
        ],
        tone: 'urgent',
      },
    ];
    return [...alerts, ...marketAlerts(), ...bazaarAlerts()];
  }

  function invalidateAlertSnapshot() {
    state.alertSnapshot = [];
    state.alertSnapshotReady = false;
    state.readyAlertGroups.clear();
  }

  function alertGroupForId(id) {
    if (id === 'raceOrFly' || id === 'landing') return 'raceTravel';
    if (id === 'energyRefill' || id === 'nerveRefill') return 'refills';
    if (String(id).startsWith('market:')) return 'market';
    if (String(id).startsWith('bazaar:')) return 'bazaar';
    return id;
  }

  function invalidateAlertGroups(groups) {
    const targets = new Set(groups || []);
    if (!targets.size) return;
    state.alertSnapshot = state.alertSnapshot.filter((alert) => !targets.has(alertGroupForId(alert.id)));
    targets.forEach((group) => state.readyAlertGroups.delete(group));
    state.alertSnapshotReady = state.readyAlertGroups.size > 0;
  }

  function publishAlertGroups(groups) {
    const targets = new Set((groups || []).filter(Boolean));
    if (!targets.size) return false;
    const fresh = createAlerts();
    const retained = state.alertSnapshot.filter((alert) => !targets.has(alertGroupForId(alert.id)));
    const replacements = fresh.filter((alert) => targets.has(alertGroupForId(alert.id)));
    const byId = new Map([...retained, ...replacements].map((alert) => [alert.id, alert]));
    state.alertSnapshot = fresh.map((alert) => byId.get(alert.id)).filter(Boolean);
    targets.forEach((group) => state.readyAlertGroups.add(group));
    state.alertSnapshotReady = state.readyAlertGroups.size > 0;
    saveCheckCache();
    render();
    return true;
  }

  function publishAlertSnapshot() {
    return publishAlertGroups([...state.readyAlertGroups]);
  }

  function publishedAlerts() {
    return state.alertSnapshotReady ? state.alertSnapshot : [];
  }

  function alertVisible(alert) {
    return alert.active && state.settings.enabled[alert.id] !== false && Number(state.settings.snoozedUntil[alert.id] || 0) <= Date.now();
  }

  const host = document.createElement('div');
  host.id = 'tdd-host';
  const shadow = host.attachShadow({ mode: 'closed' });
  document.documentElement.appendChild(host);

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function copyAlertText(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      return copied;
    }
  }

  function listingShareComposer(alert) {
    const listing = alert?.share;
    if (!listing?.href) return null;
    const source = String(listing.source || 'Listing');
    const item = String(listing.item || 'Item');
    const seller = listing.sellerName
      ? `${String(listing.sellerName)}${listing.sellerId ? ` [${String(listing.sellerId)}]` : ''}`
      : '';
    const price = Number(listing.price);
    const quantity = Math.max(0, Math.trunc(Number(listing.quantity) || 0));
    const href = String(listing.href);
    const priceText = Number.isFinite(price) ? `$${price.toLocaleString()}` : 'Price unavailable';
    const title = seller ? `${source}: ${item} from ${seller}` : `${source}: ${item}`;
    const details = [
      title,
      `Price: ${priceText} each`,
      quantity > 0 ? `Quantity: ${quantity.toLocaleString()}` : '',
      `Link: ${href}`,
    ].filter(Boolean);
    const bbcodeLabel = title.replaceAll('[', '(').replaceAll(']', ')').replace(/[\r\n]+/g, ' ').trim();
    return {
      alertId: alert.id,
      source,
      item,
      seller,
      priceText,
      quantity,
      href,
      destination: String(listing.destination || source),
      plain: details.join('\n'),
      bbcode: `[url=${href}]${bbcodeLabel}[/url] - ${priceText} each${quantity > 0 ? ` - Qty ${quantity.toLocaleString()}` : ''}`,
    };
  }

  function shareComposerMarkup() {
    const share = state.shareComposer;
    if (!share) return '';
    return `
      <section class="share-composer" aria-label="Listing link creator">
        <div class="share-heading">
          <div>
            <strong>Share this listing</strong>
            <small>${escapeHtml(share.source)} destination</small>
          </div>
          <button data-action="close-share" title="Close link creator" aria-label="Close link creator">&times;</button>
        </div>
        <dl class="share-facts">
          <div><dt>For sale</dt><dd>${escapeHtml(share.item)}</dd></div>
          ${share.seller ? `<div><dt>Seller</dt><dd>${escapeHtml(share.seller)}</dd></div>` : ''}
          <div><dt>Price</dt><dd>${escapeHtml(share.priceText)} each</dd></div>
          ${share.quantity > 0 ? `<div><dt>Quantity</dt><dd>${escapeHtml(share.quantity.toLocaleString())}</dd></div>` : ''}
          <div><dt>Goes to</dt><dd><a data-tdd-nav href="${escapeHtml(share.href)}">${escapeHtml(share.destination)}</a></dd></div>
        </dl>
        <div class="share-preview">${escapeHtml(share.plain)}</div>
        <div class="share-actions">
          <button data-action="copy-share" data-share-format="plain">Copy details + link</button>
          <button data-action="copy-share" data-share-format="bbcode">Copy Torn BBCode link</button>
        </div>
      </section>`;
  }

  function applyPosition() {
    const pos = state.settings.position;
    host.style.position = 'fixed';
    host.style.zIndex = '2147483646';
    if (pos.mode === 'free' && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      host.style.left = `${Math.max(0, pos.x)}px`;
      host.style.top = `${Math.max(0, pos.y)}px`;
      host.style.transform = 'none';
    } else {
      host.style.left = '50%';
      host.style.top = `${Number(pos.y) || 8}px`;
      host.style.transform = 'translateX(-50%)';
    }
  }

  function sourceSummary() {
    if (!visibleTornTab()) return 'Paused while this tab is not visible.';
    const live = focusedTornPage();
    const usage = rollingTornApiUsage().length;
    const limit = state.settings.slowApiMode ? API_SLOW_LIMIT : API_HARD_LIMIT;
    const pauseSeconds = Math.max(0, Math.ceil((Number(state.settings.apiPausedUntil) - Date.now()) / 1000));
    const apiMode = pauseSeconds > 0
      ? `Torn API paused ${formatDuration(pauseSeconds)}`
      : `${state.settings.slowApiMode ? 'slow mode - ' : ''}${usage}/${limit} dashboard API calls in the last minute`;
    const mode = `${live ? 'Live page + API fallback' : 'API fallback - live scraping paused until Torn is focused'} - ${apiMode}`;
    if (!state.settings.apiKey) {
      return live
        ? 'Live page - add an API key for unavailable reminders.'
        : 'API fallback unavailable - add an API key or focus Torn for live data.';
    }
    if (state.syncing) return `${mode} - refreshing...`;
    if (state.pageCheckPending) return `${mode} - the current page category is still loading; completed categories remain active.`;
    if (!state.alertSnapshotReady) return `${mode} - waiting for the first completed alert category.`;
    const failures = Object.keys(state.errors).length;
    if (failures && !state.lastUpdated) return `${mode} - ${failures} API source${failures === 1 ? '' : 's'} failed. Open Settings for details.`;
    if (state.lastUpdated) {
      const age = Math.max(0, Math.floor((Date.now() - state.lastUpdated) / 60_000));
      const calls = `${state.apiCalls} Torn API call${state.apiCalls === 1 ? '' : 's'}${state.bazaarCalls ? ` + ${state.bazaarCalls} TornW3B check${state.bazaarCalls === 1 ? '' : 's'}` : ''} this page load`;
      const updated = `updated ${age ? `${age}m ago` : 'just now'} - ${calls}`;
      return failures ? `${mode} - ${updated} - ${failures} source warning${failures === 1 ? '' : 's'}` : `${mode} - ${updated}`;
    }
    return `${mode} - waiting for the first refresh...`;
  }

  function ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    state.audioContext ||= new AudioContextClass();
    if (state.audioContext.state === 'suspended') state.audioContext.resume().catch(() => {});
    return state.audioContext;
  }

  function playAlarmSound() {
    const context = ensureAudioContext();
    if (!context || context.state !== 'running') return;
    [0, 0.24].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(index ? 880 : 660, context.currentTime + offset);
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.2);
    });
  }

  function playLandingSound() {
    const context = ensureAudioContext();
    if (!context || context.state !== 'running') return;
    [1046, 784, 523].forEach((frequency, index) => {
      const offset = index * 0.22;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + offset);
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.19);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.21);
    });
  }

  function playTurtleSound() {
    const context = ensureAudioContext();
    if (!context || context.state !== 'running') return;
    [0, 0.18, 0.46, 0.64].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(index < 2 ? 330 : 440, context.currentTime + offset);
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.11, context.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.13);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.15);
    });
  }

  function mobileBrowser() {
    if (typeof navigator.userAgentData?.mobile === 'boolean') return navigator.userAgentData.mobile;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
      || (matchMedia?.('(pointer: coarse)').matches && innerWidth <= 820);
  }

  function browserNotificationsEnabled() {
    if (!state.settings.browserNotifications || typeof Notification === 'undefined') return false;
    if (Notification.permission !== 'granted') return false;
    return mobileBrowser() ? state.settings.notifyMobile !== false : state.settings.notifyDesktop !== false;
  }

  function notificationPermissionLabel() {
    if (typeof Notification === 'undefined') return 'Not supported by this browser';
    if (Notification.permission === 'granted') return 'Permission granted';
    if (Notification.permission === 'denied') return 'Permission blocked in browser settings';
    return 'Permission not requested';
  }

  async function requestBrowserNotifications() {
    if (typeof Notification === 'undefined') {
      state.errors.browserNotifications = 'This browser does not expose page notifications.';
      render({ force: true });
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        delete state.errors.browserNotifications;
      } else {
        state.errors.browserNotifications = 'Browser notification permission was not granted.';
      }
    } catch (error) {
      state.errors.browserNotifications = error?.message || 'Could not request browser notification permission.';
    }
    saveSettings();
    render({ force: true });
  }

  function primaryAlertLink(alert) {
    return (alert.links || [{ href: alert.href }]).find((link) => link?.href)?.href || '';
  }

  function pushBrowserNotifications(alerts) {
    if (!browserNotificationsEnabled() || !visibleTornTab()) return;
    const selected = alerts.slice(0, 3);
    selected.forEach((alert) => {
      try {
        const notification = new Notification(`Torn: ${alert.title}`, {
          body: alert.detail || 'Daily Dashboard reminder',
          tag: `tdd-${alert.id}`,
          renotify: true,
        });
        notification.onclick = () => {
          window.focus();
          const href = primaryAlertLink(alert);
          if (href) location.href = href;
          notification.close();
        };
      } catch (error) {
        state.errors.browserNotifications = error?.message || 'This browser could not display the notification.';
      }
    });
    if (alerts.length > selected.length) {
      try {
        new Notification(`Torn: ${alerts.length - selected.length} more reminders`, {
          body: 'Open the Daily Dashboard to review them.',
          tag: 'tdd-more-alerts',
        });
      } catch {
        // Some mobile browsers expose permission but require service-worker notifications.
      }
    }
  }

  function maybeAlarm() {
    if (!visibleTornTab() || !state.alertSnapshotReady) return;
    const active = publishedAlerts().filter(alertVisible);
    if (!active.length) return;
    const now = Date.now();
    let historyChanged = false;
    let needsRender = false;
    const normal = active.filter((alert) => !['landing', 'turtle'].includes(alert.id));
    if (normal.length && (state.settings.flashAlarm || state.settings.soundAlarm || browserNotificationsEnabled())) {
      const interval = Math.max(1, Number(state.settings.alarmIntervalMinutes) || 1) * 60_000;
      const dueAlerts = normal.filter((alert) => now - (Number(state.settings.alarmHistory[alert.id]) || 0) >= interval);
      if (dueAlerts.length) {
        dueAlerts.forEach((alert) => { state.settings.alarmHistory[alert.id] = now; });
        historyChanged = true;
        if (state.settings.flashAlarm) {
          state.flashUntil = now + 6_000;
          needsRender = true;
        }
        if (state.settings.soundAlarm) playAlarmSound();
        pushBrowserNotifications(dueAlerts);
      }
    }
    const landing = active.find((alert) => alert.id === 'landing');
    if (landing && (state.settings.landingFlashAlarm || state.settings.landingSoundAlarm || browserNotificationsEnabled())) {
      const interval = Math.max(1, Number(state.settings.landingAlarmIntervalMinutes) || 1) * 60_000;
      if (now - (Number(state.settings.alarmHistory.landing) || 0) >= interval) {
        state.settings.alarmHistory.landing = now;
        historyChanged = true;
        if (state.settings.landingFlashAlarm) {
          state.landingFlashUntil = now + 8_000;
          needsRender = true;
        }
        if (state.settings.landingSoundAlarm) playLandingSound();
        pushBrowserNotifications([landing]);
      }
    }
    const turtle = active.find((alert) => alert.id === 'turtle');
    if (turtle && (state.settings.turtleFlashAlarm || state.settings.turtleSoundAlarm || browserNotificationsEnabled())) {
      const interval = Math.max(1, Number(state.settings.turtleAlarmIntervalMinutes) || 1) * 60_000;
      if (now - (Number(state.settings.alarmHistory.turtle) || 0) >= interval) {
        state.settings.alarmHistory.turtle = now;
        historyChanged = true;
        if (state.settings.turtleFlashAlarm) {
          state.turtleFlashUntil = now + 9_000;
          needsRender = true;
        }
        if (state.settings.turtleSoundAlarm) playTurtleSound();
        pushBrowserNotifications([turtle]);
      }
    }
    if (historyChanged) {
      Object.entries(state.settings.alarmHistory).forEach(([id, timestamp]) => {
        if (now - Number(timestamp) > 30 * TORN_DAY_MS) delete state.settings.alarmHistory[id];
      });
      saveSettings();
    }
    if (needsRender) {
      render();
      window.setTimeout(() => {
        if (Date.now() >= state.flashUntil && Date.now() >= state.landingFlashUntil && Date.now() >= state.turtleFlashUntil) render();
      }, 9_100);
    }
  }

  function settingsMarkup() {
    const exclusion = iconSelfExclusion();
    const errors = Object.entries(state.errors)
      .map(([key, message]) => `<li><strong>${escapeHtml(key)}</strong>: ${escapeHtml(message)}</li>`)
      .join('');
    const catalogItems = catalogItemsForSelectedCategory();
    const catalogOptions = catalogItems.map((item) => {
      const estimate = item.marketPrice ? ` · about $${item.marketPrice.toLocaleString()}` : '';
      return `<option value="${escapeHtml(item.name)}" label="${escapeHtml(`${item.type} · ID ${item.id}${estimate}`)}"></option>`;
    }).join('');
    const marketRows = state.settings.marketWatches.map((watch) => {
      const selected = state.itemCatalog.items.find((item) => item.id === Math.trunc(Number(watch.itemId)));
      const type = selected?.type || watch.catalogType || '';
      const itemId = Math.trunc(Number(watch.itemId));
      const estimate = Number(selected?.marketPrice ?? watch.marketEstimate) || 0;
      const itemMeta = itemId > 0 ? `${type ? `${type} · ` : ''}ID ${itemId}${estimate ? ` · Torn value ~$${estimate.toLocaleString()}` : ''}` : 'Choose an item from the search results';
      return `
      <div class="market-watch" data-market-watch="${escapeHtml(watch.uid)}">
        <input type="checkbox" data-watch-field="enabled" data-watch-uid="${escapeHtml(watch.uid)}" ${watch.enabled !== false && state.settings.enabled[`market:${watch.uid}`] !== false ? 'checked' : ''} title="Enable this watch">
        <label class="market-item-search">
          <input type="text" list="tdd-market-items" data-market-search data-watch-uid="${escapeHtml(watch.uid)}" value="${escapeHtml(watch.searchText ?? watch.label ?? '')}" placeholder="Search item name" autocomplete="off" aria-label="Search Torn items">
          <small>${escapeHtml(itemMeta)}</small>
        </label>
        <input type="number" min="1" step="1" data-watch-field="maxPrice" data-watch-uid="${escapeHtml(watch.uid)}" value="${escapeHtml(watch.maxPrice || '')}" placeholder="Max price" aria-label="Maximum price">
        <button data-action="remove-market-watch" data-watch-uid="${escapeHtml(watch.uid)}" title="Remove watch">x</button>
      </div>
    `; 
    }).join('');
    const sectionOpen = (name) => state.settings.settingsSections?.[name] ? 'open' : '';
    const crimeProgressRows = CRIME_UNIQUE_DEFINITIONS.map((definition) => {
      const response = state.data.crimeUniques?.[definition.key]
        || (definition.key === 'shoplifting' ? state.data.shoplifting : null);
      const completed = completedCrimeUniqueIds(definition.key).length;
      const total = Number(definition.knownTotal) || null;
      const fetchedAt = Number(response?.__fetchedAt || 0);
      return `<li><strong>${escapeHtml(definition.name)}</strong>: ${completed}${total ? ` / ${total}` : ''} completed${fetchedAt ? ` · checked ${new Date(fetchedAt).toLocaleString()}` : ' · awaiting first check'}</li>`;
    }).join('');
    return `
      <section class="settings" aria-label="Dashboard settings">
        <label class="field">
          <span>Torn API key <small>(Limited recommended; stored only by your userscript manager)</small></span>
          <input type="password" data-field="api-key" autocomplete="off" placeholder="${state.settings.apiKey ? 'Key saved — enter a new one to replace it' : 'Paste API key'}">
        </label>
        <div class="settings-actions">
          <button data-action="save-key">Save key</button>
          <button data-action="clear-key" class="subtle">Clear key</button>
          <button data-action="reset-position" class="subtle">Reset position</button>
          <button data-action="reset-size" class="subtle">Reset size</button>
          <button data-action="clear-snoozes" class="subtle">Clear snoozes</button>
        </div>
        <div class="api-controls">
          <strong>Dashboard Torn API: ${rollingTornApiUsage().length} / ${state.settings.slowApiMode ? API_SLOW_LIMIT : API_HARD_LIMIT} calls in the last minute</strong>
          <label><input type="checkbox" data-field="slow-api-mode" ${state.settings.slowApiMode ? 'checked' : ''}> Slow API mode (30/min ceiling; low-priority checks yield first)</label>
          <label>Pause Torn API
            <select data-field="api-pause-duration">
              ${[[5, '5 min'], [15, '15 min'], [30, '30 min'], [60, '1 hour'], [240, '4 hours']].map(([minutes, label]) => `<option value="${minutes}">${label}</option>`).join('')}
            </select>
          </label>
          <button data-action="pause-api">Pause</button>
          ${Number(state.settings.apiPausedUntil) > Date.now() ? `<button data-action="resume-api">Resume now (${formatDuration(Math.ceil((Number(state.settings.apiPausedUntil) - Date.now()) / 1000))})</button>` : ''}
          <small>Counts only Torn requests made by this dashboard across its page changes. TornW3B checks are separate. Other userscripts cannot be counted unless they share this ledger.</small>
        </div>
        <details class="settings-group" data-settings-section="alerts" ${sectionOpen('alerts')}>
          <summary>Alert toggles</summary>
          <p>Choose which reminders the dashboard may check and display. Snoozed alerts remain enabled but temporarily stop their API check.</p>
          <div class="toggles">
            ${ALERT_META.filter(([id]) => !CRIME_ALERT_IDS.has(id)).map(([id, label]) => `
              <label><input type="checkbox" data-toggle-alert="${id}" ${state.settings.enabled[id] !== false ? 'checked' : ''}> ${escapeHtml(label)}</label>
            `).join('')}
          </div>
        </details>
        <details class="settings-group" data-settings-section="thresholds" ${sectionOpen('thresholds')}>
          <summary>Thresholds and special timers</summary>
          <label class="field compact-field">
            <span>Medical reminder threshold</span>
            <select data-field="medical-hours">
              ${[1, 2, 3, 4, 6].map((hours) => `<option value="${hours}" ${Number(state.settings.medicalThresholdHours) === hours ? 'selected' : ''}>${hours} hour${hours === 1 ? '' : 's'}</option>`).join('')}
            </select>
          </label>
          <label class="field compact-field">
            <span>Booster reminder threshold</span>
            <select data-field="booster-hours">
              ${[0, 1, 2, 3, 4, 6, 12, 24].map((hours) => `<option value="${hours}" ${Number(state.settings.boosterThresholdHours) === hours ? 'selected' : ''}>${hours === 0 ? 'When clear' : `${hours} hour${hours === 1 ? '' : 's'}`}</option>`).join('')}
            </select>
          </label>
          <label class="field compact-field">
            <span>Slow-data refresh</span>
            <select data-field="api-refresh-minutes">
              ${[5, 10, 15, 30].map((minutes) => `<option value="${minutes}" ${Number(state.settings.apiDailyRefreshMinutes) === minutes ? 'selected' : ''}>${minutes} minutes</option>`).join('')}
            </select>
          </label>
          <label class="field compact-field">
            <span>Job addiction (points)</span>
            <input type="number" min="0" max="100" step="1" data-field="job-addiction-threshold" value="${escapeHtml(state.settings.jobAddictionThreshold)}">
          </label>
          <label class="field compact-field">
            <span>Player addiction</span>
            <input type="number" min="0" max="100" step="1" data-field="player-addiction-threshold" value="${escapeHtml(state.settings.playerAddictionThreshold)}">
          </label>
          <div class="landing-alarm-settings">
            <strong>Landing alarm</strong>
            <label>Warn me
              <select data-field="landing-lead-minutes">
                ${[1, 2, 5, 10, 15].map((minutes) => `<option value="${minutes}" ${Number(state.settings.landingLeadMinutes) === minutes ? 'selected' : ''}>${minutes} min before</option>`).join('')}
              </select>
            </label>
            <label><input type="checkbox" data-field="landing-flash-alarm" ${state.settings.landingFlashAlarm ? 'checked' : ''}> Blue flash</label>
            <label><input type="checkbox" data-field="landing-sound-alarm" ${state.settings.landingSoundAlarm ? 'checked' : ''}> Landing sound</label>
            <label>Repeat
              <select data-field="landing-alarm-minutes">
                ${[1, 2, 5].map((minutes) => `<option value="${minutes}" ${Number(state.settings.landingAlarmIntervalMinutes) === minutes ? 'selected' : ''}>${minutes} min</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="turtle-alarm-settings">
            <strong>Turtle timer</strong>
            <label>Warn me
              <select data-field="turtle-lead-minutes">
                ${[1, 2, 5, 10, 15].map((minutes) => `<option value="${minutes}" ${Number(state.settings.turtleLeadMinutes) === minutes ? 'selected' : ''}>${minutes} min before</option>`).join('')}
              </select>
            </label>
            <label><input type="checkbox" data-field="turtle-flash-alarm" ${state.settings.turtleFlashAlarm ? 'checked' : ''}> Orange flash</label>
            <label><input type="checkbox" data-field="turtle-sound-alarm" ${state.settings.turtleSoundAlarm ? 'checked' : ''}> Turtle sound</label>
            <label>Repeat
              <select data-field="turtle-alarm-minutes">
                ${[1, 2, 5].map((minutes) => `<option value="${minutes}" ${Number(state.settings.turtleAlarmIntervalMinutes) === minutes ? 'selected' : ''}>${minutes} min</option>`).join('')}
              </select>
            </label>
          </div>
        </details>
        <details class="settings-group" data-settings-section="crimes" ${sectionOpen('crimes')}>
          <summary>Crimes</summary>
          <div class="crime-unique-settings">
            <strong>Unique outcome tracking</strong>
            <p>Disposal completed uniques are checked after its 00:00 TCT reset. The other enabled crimes are checked at 12:00 TCT. Torn requires one small player request per crime; there is no combined endpoint.</p>
            <div class="crime-toggles">
              ${CRIME_UNIQUE_DEFINITIONS.map((definition) => `
                <label><input type="checkbox" data-toggle-alert="${definition.alertId}" ${state.settings.enabled[definition.alertId] !== false ? 'checked' : ''}> ${escapeHtml(definition.name)}</label>
              `).join('')}
            </div>
            <ul>${crimeProgressRows}</ul>
            <small>Search for Cash, Disposal, and Arson availability is scraped only while that crime page is focused. Shoplifting also uses Torn’s global Jewelry Store status. Disposal does not create a general jobs reminder.</small>
          </div>
          <div class="api-controls pickpocket-controls">
            <strong>Pickpocket helper · live page only</strong>
            <label><input type="checkbox" data-field="pickpocket-helper-enabled" ${state.settings.pickpocketHelperEnabled ? 'checked' : ''}> Highlight and filter Pickpocketing targets</label>
            <label>Minimum target
              <select data-field="pickpocket-min-level">
                ${[100, 150, 200, 250, 300, 350].map((level) => `<option value="${level}" ${Number(state.settings.pickpocketMinTargetLevel) === level ? 'selected' : ''}>${level}%</option>`).join('')}
              </select>
            </label>
            <label>Maximum target
              <select data-field="pickpocket-max-level">
                ${[100, 150, 200, 250, 300, 350].map((level) => `<option value="${level}" ${Number(state.settings.pickpocketMaxTargetLevel) === level ? 'selected' : ''}>${level}%</option>`).join('')}
              </select>
            </label>
            <small>Last focused-page skill: ${Number(state.settings.pickpocketLastSkill || 1)} · currently formatted: ${Number(state.pickpocketFormattedCount || 0)} targets. No API calls.</small>
          </div>
        </details>
        <details class="settings-group" data-settings-section="alarms" ${sectionOpen('alarms')}>
          <summary>Alarm behavior</summary>
          <p>These options repeat for any active, unsnoozed reminder except Landing and Turtle, which have separate sounds and timing under Thresholds.</p>
          <div class="alarm-settings">
            <label><input type="checkbox" data-field="flash-alarm" ${state.settings.flashAlarm ? 'checked' : ''}> Flash red</label>
            <label><input type="checkbox" data-field="sound-alarm" ${state.settings.soundAlarm ? 'checked' : ''}> Play the general alarm sound</label>
            <label>Repeat while unfinished
              <select data-field="alarm-minutes">
                ${[1, 2, 5, 10].map((minutes) => `<option value="${minutes}" ${Number(state.settings.alarmIntervalMinutes) === minutes ? 'selected' : ''}>${minutes} min</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="notification-settings">
            <strong>Browser notifications</strong>
            <label><input type="checkbox" data-field="browser-notifications" ${state.settings.browserNotifications ? 'checked' : ''}> Enable native notifications</label>
            <label><input type="checkbox" data-field="notify-desktop" ${state.settings.notifyDesktop !== false ? 'checked' : ''}> Desktop</label>
            <label><input type="checkbox" data-field="notify-mobile" ${state.settings.notifyMobile ? 'checked' : ''}> Mobile browser</label>
            <button data-action="request-notification-permission" type="button">Allow notifications</button>
            <span>${escapeHtml(notificationPermissionLabel())}</span>
            <small>Only fires while this Torn tab is visible. Mobile support depends on the browser; this script cannot send background push when Torn is closed or hidden.</small>
          </div>
        </details>
        <div class="market-settings">
          <div class="section-title">Item market watches</div>
          <p>Search by item name, then set the price that should trigger an alert. Item IDs are filled automatically.</p>
          <div class="catalog-controls">
            <label>Category
              <select data-field="market-catalog-category">
                ${MARKET_ITEM_TYPES.map(([value, label]) => `<option value="${escapeHtml(value)}" ${state.settings.marketCatalogCategory === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
              </select>
            </label>
            <span>${state.itemCatalogLoading ? 'Loading items…' : state.itemCatalog.items.length ? `${state.itemCatalog.items.length.toLocaleString()} items cached` : 'Item list not loaded'}</span>
            <button data-action="refresh-item-catalog" ${state.itemCatalogLoading || !state.settings.apiKey ? 'disabled' : ''}>${state.itemCatalog.items.length ? 'Refresh list' : 'Load items'}</button>
          </div>
          <datalist id="tdd-market-items">${catalogOptions}</datalist>
          <div class="market-head"><span></span><span>Item</span><span>Max price</span><span></span></div>
          ${marketRows || '<div class="market-empty">No watched items yet.</div>'}
          <div class="market-controls">
            <button data-action="add-market-watch" ${state.settings.marketWatches.length >= 10 ? 'disabled' : ''}>${state.settings.marketWatches.length >= 10 ? '10 item limit' : 'Add item'}</button>
            <label>Torn market polling
              <select data-field="market-refresh-minutes">
                <option value="cache-aligned" ${state.settings.marketRefreshMode === 'cache-aligned' ? 'selected' : ''}>Fast - align to Torn's 30s cache</option>
                ${[1, 2, 5, 10].map((minutes) => `<option value="${minutes}" ${state.settings.marketRefreshMode !== 'cache-aligned' && Number(state.settings.marketRefreshMinutes) === minutes ? 'selected' : ''}>${minutes} min</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="bazaar-controls">
            <label><input type="checkbox" data-field="weav3r-bazaar-enabled" ${state.settings.weav3rBazaarEnabled ? 'checked' : ''}> Check TornW3B bazaars</label>
            <span>Every 5 sec for 1â€“2 watches; slows automatically for more</span>
          </div>
          <p class="third-party-note">Optional third-party source: sends watched item IDs only to weav3r.dev. Your Torn API key is never sent. Bazaar results have their own per-seller 1h/1d snoozes.</p>
        </div>
        <p class="privacy"><strong>Privacy rule:</strong> Torn page content is read only while this tab is visible and the Torn browser window is focused. When visible but unfocused, scraped signals are discarded and Torn API fallback is used. Hidden tabs are paused.</p>
        ${exclusion ? `<p class="exclusion">Casino reminder paused by “${escapeHtml(exclusion.title)}”${exclusion.untilMs ? ` until ${new Date(exclusion.untilMs).toLocaleString()}` : ''}.</p>` : ''}
        ${errors ? `<details><summary>API warnings</summary><ul>${errors}</ul></details>` : ''}
      </section>`;
  }

  function alertIconFor(id) {
    if (String(id).startsWith('bazaar:')) return '🏪';
    if (String(id).startsWith('market:')) return '🛒';
    return ALERT_ICONS[id] || '•';
  }

  function headerAlertChip(alert) {
    const href = primaryAlertLink(alert);
    const timer = Number(alert.timerSeconds) > 0 ? formatDuration(alert.timerSeconds) : '';
    const contents = `<span class="chip-icon">${escapeHtml(alertIconFor(alert.id))}</span>${timer ? `<small>${escapeHtml(timer)}</small>` : ''}`;
    const title = `${alert.title}${alert.detail ? ` - ${alert.detail}` : ''}`;
    return href
      ? `<a class="alert-chip ${escapeHtml(alert.tone || '')}" href="${escapeHtml(href)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${contents}</a>`
      : `<span class="alert-chip ${escapeHtml(alert.tone || '')}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${contents}</span>`;
  }

  function render({ force = false } = {}) {
    const activeEditor = shadow.activeElement?.closest?.('input, select, textarea');
    if (!force && activeEditor) {
      state.renderPending = true;
      return;
    }
    state.renderPending = false;
    const previousBody = shadow.querySelector('.body');
    const previousScrollTop = previousBody?.scrollTop || 0;
    const previousScrollLeft = previousBody?.scrollLeft || 0;
    const previousPageX = window.scrollX;
    const previousPageY = window.scrollY;
    applyPosition();
    const allAlerts = publishedAlerts();
    const alerts = allAlerts.filter(alertVisible);
    const snoozedCount = allAlerts.filter((alert) => alert.active && state.settings.enabled[alert.id] !== false && !alertVisible(alert)).length;
    const collapsed = state.settings.collapsed;
    const turtleSeconds = Math.max(0, Math.ceil((Number(state.settings.turtleEndAt) - Date.now()) / 1000));
    const freePosition = state.settings.position.mode === 'free';
    const panelLeft = freePosition && Number.isFinite(Number(state.settings.position.x))
      ? Math.max(0, Number(state.settings.position.x))
      : 10;
    const panelTop = Math.max(0, Number(state.settings.position.y) || 8);
    const availablePanelWidth = Math.max(120, freePosition ? innerWidth - panelLeft - 8 : innerWidth - 20);
    const availablePanelHeight = Math.max(60, innerHeight - panelTop - 8);
    const minimumPanelWidth = Math.min(300, availablePanelWidth);
    const minimumPanelHeight = Math.min(180, availablePanelHeight);
    const requestedPanelWidth = Number(state.settings.panelSize?.width);
    const requestedPanelHeight = Number(state.settings.panelSize?.height);
    const savedPanelWidth = Number.isFinite(requestedPanelWidth) && requestedPanelWidth > 0
      ? Math.min(Math.max(minimumPanelWidth, requestedPanelWidth), availablePanelWidth)
      : null;
    const savedPanelHeight = Number.isFinite(requestedPanelHeight) && requestedPanelHeight > 0
      ? Math.min(Math.max(minimumPanelHeight, requestedPanelHeight), availablePanelHeight)
      : null;
    const panelUserSized = savedPanelWidth !== null || savedPanelHeight !== null;
    const panelStyle = [
      `--panel-min-width:${minimumPanelWidth}px`,
      `--panel-max-width:${availablePanelWidth}px`,
      `--panel-min-height:${minimumPanelHeight}px`,
      `--panel-max-height:${availablePanelHeight}px`,
      savedPanelWidth !== null ? `width:${savedPanelWidth}px` : '',
      !collapsed && savedPanelHeight !== null ? `height:${savedPanelHeight}px` : '',
    ].filter(Boolean).join(';');

    shadow.innerHTML = `
      <style>
        :host { all: initial; color-scheme: dark; }
        * { box-sizing: border-box; }
        .panel { width: min(500px, var(--panel-max-width)); min-width: var(--panel-min-width); min-height: var(--panel-min-height); max-width: var(--panel-max-width); max-height: var(--panel-max-height); display: flex; flex-direction: column; overflow: hidden; resize: both; color: #edf1f5; background: rgba(22, 25, 29, .97); border: 1px solid rgba(255,255,255,.14); border-radius: 0 0 12px 12px; box-shadow: 0 12px 35px rgba(0,0,0,.45); font: 13px/1.35 system-ui, -apple-system, Segoe UI, sans-serif; backdrop-filter: blur(12px); }
        .panel.collapsed { min-height: 39px; height: auto !important; resize: horizontal; }
        .panel.alarm-flash { animation: dashboardAlarmFlash 1s ease-in-out 0s 6; }
        .panel.landing-flash { animation: dashboardLandingFlash 1s ease-in-out 0s 8; }
        .panel.turtle-flash { animation: dashboardTurtleFlash 1s ease-in-out 0s 9; }
        @keyframes dashboardAlarmFlash { 0%,100% { box-shadow: 0 12px 35px rgba(0,0,0,.45); border-color: rgba(255,255,255,.14); } 50% { box-shadow: 0 0 28px 7px rgba(255,72,72,.85); border-color: #ff5b5b; } }
        @keyframes dashboardLandingFlash { 0%,100% { box-shadow: 0 12px 35px rgba(0,0,0,.45); border-color: rgba(255,255,255,.14); } 50% { box-shadow: 0 0 30px 8px rgba(70,174,255,.9); border-color: #58b9ff; } }
        @keyframes dashboardTurtleFlash { 0%,100% { box-shadow: 0 12px 35px rgba(0,0,0,.45); border-color: rgba(255,255,255,.14); } 50% { box-shadow: 0 0 30px 8px rgba(255,153,61,.92); border-color: #ff9a3d; } }
        .header { min-height: 39px; flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 7px 8px 7px 12px; cursor: grab; user-select: none; background: linear-gradient(180deg, #31363d, #252a30); border-bottom: 1px solid rgba(255,255,255,.09); }
        .header:active { cursor: grabbing; }
        .title { min-width: 0; flex: 1; font-weight: 750; letter-spacing: .2px; }
        .count { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; margin-left: 6px; border-radius: 999px; color: #141414; background: ${alerts.length ? '#ffca55' : '#71d69b'}; font-size: 12px; font-weight: 800; }
        .header-alerts { max-width: 255px; display: flex; align-items: center; gap: 4px; overflow-x: auto; overscroll-behavior: contain; scrollbar-width: none; }
        .header-alerts::-webkit-scrollbar { display: none; }
        .alert-chip { min-width: 27px; height: 27px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; padding: 2px 5px; border: 1px solid rgba(255,202,85,.42); border-radius: 7px; color: #fff; background: #3b3424; text-decoration: none; white-space: nowrap; }
        .alert-chip.urgent { border-color: rgba(255,104,104,.55); background: #4a2929; }
        .alert-chip.ready { border-color: rgba(101,214,155,.5); background: #234134; }
        .alert-chip.landing { border-color: rgba(88,185,255,.55); background: #223c50; }
        .alert-chip.turtle { border-color: rgba(255,154,61,.55); background: #4a3421; }
        .alert-chip small { color: #f2f5f7; font-size: 9px; font-weight: 750; }
        .chip-icon { font-size: 14px; line-height: 1; }
        button, select, input { font: inherit; }
        button { border: 1px solid rgba(255,255,255,.14); border-radius: 7px; color: #f4f6f8; background: #353b43; cursor: pointer; }
        button:hover { background: #414955; }
        button:disabled { cursor: not-allowed; opacity: .55; }
        .icon-button { width: 28px; height: 26px; padding: 0; font-size: 15px; }
        .body { min-height: 0; max-height: min(72vh, 700px); overflow: auto; }
        .panel.user-sized .body { flex: 1 1 auto; max-height: none; }
        .status { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 7px 10px; color: #aeb7c1; border-bottom: 1px solid rgba(255,255,255,.08); font-size: 12px; }
        .status span { flex: 1; }
        .status button { padding: 3px 8px; font-size: 11px; }
        .toolbar { display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .toolbar button { flex: 1; padding: 5px 6px; font-size: 11px; }
        .share-composer { margin: 9px 10px; padding: 10px; border: 1px solid rgba(101,214,155,.3); border-radius: 9px; color: #dce4e9; background: #202b27; }
        .share-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .share-heading strong { display: block; color: #8be2b3; font-size: 13px; }
        .share-heading small { color: #93a49c; font-size: 10px; }
        .share-heading button { width: 26px; height: 24px; padding: 0; }
        .share-facts { display: grid; gap: 4px; margin: 9px 0; }
        .share-facts div { display: grid; grid-template-columns: 72px minmax(0,1fr); gap: 8px; }
        .share-facts dt { color: #8f9b95; }
        .share-facts dd { min-width: 0; margin: 0; overflow-wrap: anywhere; color: #eef3f0; }
        .share-facts a { color: #8ecbff; }
        .share-preview { padding: 7px 8px; border: 1px solid rgba(255,255,255,.1); border-radius: 6px; overflow-wrap: anywhere; white-space: pre-wrap; color: #bac5c0; background: #151b18; font: 10px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; }
        .share-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .share-actions button { flex: 1 1 150px; padding: 6px 8px; }
        .empty { padding: 22px 16px; text-align: center; color: #aeb7c1; }
        .empty strong { display: block; margin-bottom: 3px; color: #e7ecef; }
        .alert { display: grid; grid-template-columns: 8px minmax(0,1fr) auto; gap: 9px; align-items: center; padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,.075); }
        .alert:last-child { border-bottom: 0; }
        .tone { width: 8px; height: 34px; border-radius: 99px; background: #ffca55; }
        .urgent .tone { background: #ff6868; }
        .ready .tone { background: #65d69b; }
        .landing .tone { background: #58b9ff; }
        .turtle .tone { background: #ff9a3d; }
        .alert-copy { min-width: 0; }
        .alert-title { color: #f5f7f9; font-weight: 700; }
        .alert-detail { margin-top: 2px; overflow: hidden; color: #aeb7c1; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
        .alert-actions { display: flex; align-items: center; gap: 4px; }
        .alert-actions a, .alert-actions button { min-width: 29px; height: 25px; padding: 3px 6px; text-align: center; text-decoration: none; }
        .alert-actions a { border: 1px solid rgba(255,255,255,.14); border-radius: 7px; color: #fff; background: #3e6b8f; font: 700 11px/17px system-ui, sans-serif; }
        .alert-actions button { color: #c9d0d7; font-size: 10px; }
        .settings { padding: 12px; border-bottom: 1px solid rgba(255,255,255,.08); background: #1d2126; }
        .field { display: grid; gap: 5px; margin-bottom: 10px; color: #d9dfe4; }
        .field small { color: #8f9aa5; font-weight: 400; }
        .field input, .field select { width: 100%; padding: 7px 8px; border: 1px solid rgba(255,255,255,.16); border-radius: 7px; outline: 0; color: #f1f4f6; background: #111418; }
        .field input:focus, .field select:focus { border-color: #5f9dc7; }
        .compact-field { grid-template-columns: 1fr 120px; align-items: center; margin-top: 12px; }
        .settings-actions { display: flex; flex-wrap: wrap; gap: 5px; }
        .settings-actions button { padding: 5px 8px; }
        .api-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 10px; margin: 10px 0; padding: 9px; border: 1px solid rgba(107,178,255,.25); border-radius: 7px; color: #cbd2d8; background: #202a34; }
        .api-controls strong, .api-controls small { flex-basis: 100%; }
        .api-controls label { display: flex; align-items: center; gap: 5px; }
        .api-controls select { padding: 3px 5px; border: 1px solid rgba(255,255,255,.16); border-radius: 6px; color: #f1f4f6; background: #111418; }
        .subtle { color: #b8c1c9; background: #292e34; }
        .settings-group { margin: 10px 0 0; overflow: hidden; border: 1px solid rgba(255,255,255,.11); border-radius: 8px; color: #d6dde3; background: #23282e; font-size: 12px; }
        .settings-group > summary { padding: 9px 10px; cursor: pointer; color: #eef2f5; background: #2a3037; font-size: 13px; font-weight: 750; user-select: none; }
        .settings-group[open] > summary { border-bottom: 1px solid rgba(255,255,255,.09); }
        .settings-group > :not(summary) { margin-left: 10px; margin-right: 10px; }
        .settings-group > p { margin-top: 8px; margin-bottom: 8px; color: #98a3ad; font-size: 11px; }
        .toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin-top: 12px; color: #cbd2d8; }
        .toggles label { display: flex; align-items: center; gap: 5px; }
        .alarm-settings { display: flex; flex-wrap: wrap; gap: 7px 14px; margin: 12px 0; padding: 9px; border-radius: 7px; color: #cbd2d8; background: #272c32; }
        .alarm-settings label { display: flex; align-items: center; gap: 5px; }
        .notification-settings { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 12px; margin: 12px 0; padding: 9px; border: 1px solid rgba(255,202,85,.2); border-radius: 7px; color: #cbd2d8; background: #2c2a22; }
        .notification-settings strong { color: #ffdc8b; }
        .notification-settings label { display: flex; align-items: center; gap: 5px; }
        .notification-settings button { padding: 4px 8px; font-size: 11px; }
        .notification-settings span { color: #9ea8b1; font-size: 10px; }
        .notification-settings small { flex-basis: 100%; color: #8f99a2; }
        .landing-alarm-settings { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 12px; margin: 12px 0; padding: 9px; border: 1px solid rgba(88,185,255,.22); border-radius: 7px; color: #cbd2d8; background: #202b35; }
        .landing-alarm-settings strong { color: #8fd0ff; }
        .landing-alarm-settings label { display: flex; align-items: center; gap: 5px; }
        .turtle-alarm-settings { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 12px; margin: 12px 0; padding: 9px; border: 1px solid rgba(255,154,61,.24); border-radius: 7px; color: #cbd2d8; background: #30271f; }
        .turtle-alarm-settings strong { color: #ffbd80; }
        .turtle-alarm-settings label { display: flex; align-items: center; gap: 5px; }
        .crime-unique-settings { margin-top: 10px; padding: 9px; border: 1px solid rgba(255,104,104,.2); border-radius: 7px; color: #cbd2d8; background: #302525; }
        .crime-unique-settings p { margin: 4px 0 7px; color: #aab3bb; font-size: 11px; }
        .crime-toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 10px; margin: 7px 0; }
        .crime-toggles label { display: flex; align-items: center; gap: 5px; }
        .crime-unique-settings ul { margin: 5px 0; padding-left: 18px; }
        .crime-unique-settings small { color: #98a2aa; }
        .alarm-settings select, .landing-alarm-settings select, .turtle-alarm-settings select, .market-controls select, .catalog-controls select, .bazaar-controls select { padding: 3px 5px; border: 1px solid rgba(255,255,255,.16); border-radius: 6px; color: #f1f4f6; background: #111418; }
        .market-settings { margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.1); }
        .section-title { color: #eef2f5; font-weight: 750; }
        .market-settings > p { margin: 3px 0 9px; color: #929da7; font-size: 11px; }
        .catalog-controls { display: flex; align-items: center; gap: 8px; margin: 7px 0 10px; color: #aeb7c1; font-size: 11px; }
        .catalog-controls label { display: flex; align-items: center; gap: 5px; }
        .catalog-controls span { flex: 1; text-align: right; }
        .catalog-controls button { padding: 4px 7px; }
        .market-head, .market-watch { display: grid; grid-template-columns: 22px minmax(170px,1fr) 105px 28px; gap: 5px; align-items: center; }
        .market-head { margin-bottom: 3px; color: #87919a; font-size: 10px; }
        .market-watch { margin-bottom: 5px; }
        .market-watch input[type="text"], .market-watch input[type="number"] { min-width: 0; width: 100%; padding: 5px 6px; border: 1px solid rgba(255,255,255,.14); border-radius: 6px; color: #eef2f5; background: #111418; }
        .market-item-search { min-width: 0; display: grid; gap: 2px; }
        .market-item-search small { overflow: hidden; color: #87929c; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
        .market-watch button { height: 27px; padding: 0; color: #e2a1a1; }
        .market-empty { padding: 6px 0; color: #8f99a2; font-size: 11px; }
        .market-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; color: #aeb7c1; font-size: 11px; }
        .market-controls button { padding: 5px 9px; }
        .bazaar-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px; padding: 8px; border: 1px solid rgba(255,255,255,.1); border-radius: 7px; color: #cbd2d8; background: #272c32; font-size: 11px; }
        .bazaar-controls label { display: flex; align-items: center; gap: 5px; }
        .market-settings .third-party-note { margin-top: 6px; color: #89949e; }
        .privacy, .exclusion { margin: 12px 0 0; padding: 8px; border-radius: 7px; color: #aeb8c1; background: #272c32; font-size: 11px; }
        .exclusion { color: #d7c994; }
        details { margin-top: 10px; color: #dbb184; font-size: 11px; }
        details ul { margin: 6px 0 0; padding-left: 18px; }
        @media (max-width: 520px) { .title { flex: 0 0 auto; max-width: 130px; } .header-alerts { flex: 1; max-width: none; } .alert { grid-template-columns: 7px minmax(0,1fr); } .alert-actions { grid-column: 2; flex-wrap: wrap; } .toggles { grid-template-columns: 1fr; } .catalog-controls { flex-wrap: wrap; } .catalog-controls span { order: 3; flex-basis: 100%; text-align: left; } .market-head { display:none; } .market-watch { grid-template-columns: 22px minmax(120px,1fr) 90px 28px; } }
      </style>
      <section class="panel ${collapsed ? 'collapsed' : ''} ${panelUserSized && !collapsed ? 'user-sized' : ''} ${state.settings.flashAlarm && Date.now() < state.flashUntil ? 'alarm-flash' : ''} ${state.settings.landingFlashAlarm && Date.now() < state.landingFlashUntil ? 'landing-flash' : ''} ${state.settings.turtleFlashAlarm && Date.now() < state.turtleFlashUntil ? 'turtle-flash' : ''}" style="${panelStyle}" aria-label="Torn Daily Dashboard">
        <header class="header" data-drag-handle>
          <div class="title">Daily Dashboard <span class="count">${alerts.length}</span></div>
          <nav class="header-alerts" aria-label="Active reminder shortcuts">${alerts.map(headerAlertChip).join('')}</nav>
          <button class="icon-button" data-action="settings" title="Settings" aria-label="Settings">⚙</button>
          <button class="icon-button" data-action="collapse" title="${collapsed ? 'Expand' : 'Minimize'}" aria-label="${collapsed ? 'Expand' : 'Minimize'}">${collapsed ? '▾' : '▴'}</button>
        </header>
        ${collapsed ? '' : `
          <div class="body">
            ${state.settings.settingsOpen ? settingsMarkup() : ''}
            <div class="status"><span>${escapeHtml(sourceSummary())}${snoozedCount ? ` · ${snoozedCount} snoozed` : ''}</span><button data-action="refresh">Refresh</button></div>
            <div class="toolbar">
              <button data-action="snooze-all" data-duration="3600000">Snooze all 1h</button>
              <button data-action="snooze-all" data-duration="${TORN_DAY_MS}">Snooze all 1d</button>
              <button data-action="set-turtle-timer" ${state.turtleChecking ? 'disabled' : ''}>${state.turtleChecking ? 'Checking hospital…' : turtleSeconds > 0 ? `Reset Turtle (${formatDuration(turtleSeconds)})` : 'Set Turtle timer'}</button>
              ${turtleSeconds > 0 ? '<button data-action="clear-turtle-timer" title="Cancel the saved Turtle timer">Cancel Turtle</button>' : ''}
            </div>
            ${shareComposerMarkup()}
            <div class="alerts">
              ${alerts.length ? alerts.map((alert) => `
                <article class="alert ${escapeHtml(alert.tone)}">
                  <span class="tone" aria-hidden="true"></span>
                  <div class="alert-copy">
                    <div class="alert-title">${escapeHtml(alert.title)}</div>
                    <div class="alert-detail" title="${escapeHtml(alert.detail)}">${escapeHtml(alert.detail)}</div>
                  </div>
                  <div class="alert-actions">
                    ${(alert.links || [{ label: 'Open', href: alert.href }]).filter((link) => link?.href).map((link) => `<a data-tdd-nav href="${escapeHtml(link.href)}">${escapeHtml(link.label || 'Open')}</a>`).join('')}
                    ${alert.share ? `<button data-action="compose-share" data-alert-id="${escapeHtml(alert.id)}" title="Create a shareable listing link">Share</button>` : ''}
                    <button data-action="snooze" data-alert-id="${alert.id}" data-duration="3600000" title="Snooze 1 hour">1h</button>
                    <button data-action="snooze" data-alert-id="${alert.id}" data-duration="${TORN_DAY_MS}" title="Snooze 1 day">1d</button>
                    ${alert.noDisable ? '' : `<button data-action="disable" data-alert-id="${alert.id}" title="Turn off until re-enabled in Settings">Off</button>`}
                  </div>
                </article>
              `).join('') : `
                <div class="empty"><strong>${state.settings.apiKey ? 'You’re caught up.' : 'Visible-page checks are active.'}</strong>${state.settings.apiKey ? 'No active, unsnoozed reminders.' : 'Add an API key in Settings for reminders that are not exposed on this page.'}</div>
              `}
            </div>
          </div>`}
      </section>`;
    const restoreScroll = () => {
      const nextBody = shadow.querySelector('.body');
      if (nextBody) {
        nextBody.scrollTop = previousScrollTop;
        nextBody.scrollLeft = previousScrollLeft;
      }
      if (window.scrollX !== previousPageX || window.scrollY !== previousPageY) window.scrollTo(previousPageX, previousPageY);
    };
    restoreScroll();
    requestAnimationFrame(restoreScroll);
    window.setTimeout(restoreScroll, 50);
    window.setTimeout(restoreScroll, 200);
  }

  function setSnooze(id, duration) {
    state.settings.snoozedUntil[id] = Date.now() + duration;
    state.flashUntil = 0;
    saveSnoozeLedger();
    saveSettings();
    scheduleNextSnoozeExpiry();
    render();
  }

  shadow.addEventListener('click', (event) => {
    const navigationLink = event.target.closest('a[data-tdd-nav]');
    if (navigationLink && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      window.location.assign(navigationLink.href);
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (state.settings.soundAlarm || state.settings.landingSoundAlarm || state.settings.turtleSoundAlarm) ensureAudioContext();
    if (action === 'collapse') {
      state.settings.collapsed = !state.settings.collapsed;
    } else if (action === 'settings') {
      state.settings.settingsOpen = !state.settings.settingsOpen;
      state.settings.collapsed = false;
      saveSettings();
      render();
      if (state.settings.settingsOpen && !itemCatalogFresh()) loadItemCatalog();
      return;
    } else if (action === 'refresh') {
      refresh({ force: true });
      return;
    } else if (action === 'pause-api') {
      const minutes = Math.max(1, Number(shadow.querySelector('[data-field="api-pause-duration"]')?.value) || 15);
      state.settings.apiPausedUntil = Date.now() + minutes * 60_000;
      cancelQueuedApiCalls(`Torn API manually paused for ${minutes} minute${minutes === 1 ? '' : 's'}.`);
      saveSettings();
      scheduleMarketPoll(minutes * 60_000 + 250);
      render();
      return;
    } else if (action === 'resume-api') {
      state.settings.apiPausedUntil = 0;
      state.apiLimiterUntil = 0;
      saveSettings();
      scheduleMarketPoll(0);
      refresh();
      return;
    } else if (action === 'request-notification-permission') {
      requestBrowserNotifications();
      return;
    } else if (action === 'compose-share') {
      const alert = publishedAlerts().find((item) => item.id === button.dataset.alertId);
      state.shareComposer = listingShareComposer(alert);
      render({ force: true });
      return;
    } else if (action === 'close-share') {
      state.shareComposer = null;
      render({ force: true });
      return;
    } else if (action === 'copy-share') {
      const format = button.dataset.shareFormat === 'bbcode' ? 'bbcode' : 'plain';
      const value = state.shareComposer?.[format];
      const original = button.textContent;
      copyAlertText(value).then((copied) => {
        button.textContent = copied ? (format === 'bbcode' ? 'BBCode copied' : 'Copied') : 'Copy failed';
        window.setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1_500);
      });
      return;
    } else if (action === 'snooze') {
      setSnooze(button.dataset.alertId, Number(button.dataset.duration));
      return;
    } else if (action === 'snooze-all') {
      const until = Date.now() + Number(button.dataset.duration);
      publishedAlerts().filter((alert) => alert.active).forEach((alert) => {
        state.settings.snoozedUntil[alert.id] = until;
      });
      state.flashUntil = 0;
      saveSnoozeLedger();
      scheduleNextSnoozeExpiry();
    } else if (action === 'disable') {
      state.settings.enabled[button.dataset.alertId] = false;
      state.flashUntil = 0;
      if (button.dataset.alertId.startsWith('market:')) {
        const watch = state.settings.marketWatches.find((item) => `market:${item.uid}` === button.dataset.alertId);
        if (watch) watch.enabled = false;
      }
    } else if (action === 'set-turtle-timer') {
      setTurtleTimer();
      return;
    } else if (action === 'clear-turtle-timer') {
      state.settings.turtleEndAt = 0;
      state.turtleFlashUntil = 0;
      delete state.settings.alarmHistory.turtle;
      delete state.settings.snoozedUntil.turtle;
      removeSnoozesWhere((id) => id === 'turtle');
      delete state.errors.turtleTimer;
    } else if (action === 'add-market-watch') {
      if (state.settings.marketWatches.length >= 10) return;
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      state.settings.marketWatches.push({ uid, itemId: '', label: '', searchText: '', maxPrice: '', enabled: true });
      state.settings.enabled[`market:${uid}`] = true;
      if (!itemCatalogFresh()) loadItemCatalog();
    } else if (action === 'refresh-item-catalog') {
      loadItemCatalog({ force: true });
      return;
    } else if (action === 'remove-market-watch') {
      const uid = button.dataset.watchUid;
      const removed = state.settings.marketWatches.find((watch) => watch.uid === uid);
      state.settings.marketWatches = state.settings.marketWatches.filter((watch) => watch.uid !== uid);
      delete state.settings.enabled[`market:${uid}`];
      delete state.settings.snoozedUntil[`market:${uid}`];
      delete state.settings.alarmHistory[`market:${uid}`];
      Object.keys(state.settings.snoozedUntil).filter((id) => id.startsWith(`bazaar:${uid}:`)).forEach((id) => delete state.settings.snoozedUntil[id]);
      removeSnoozesWhere((id) => id === `market:${uid}` || id.startsWith(`bazaar:${uid}:`));
      Object.keys(state.settings.alarmHistory).filter((id) => id.startsWith(`bazaar:${uid}:`)).forEach((id) => delete state.settings.alarmHistory[id]);
      if (state.data.market) delete state.data.market[uid];
      if (state.data.bazaars) delete state.data.bazaars[uid];
      if (removed && !state.settings.marketWatches.some((watch) => Number(watch.itemId) === Number(removed.itemId))) {
        delete state.errors[`market-item:${Math.trunc(Number(removed.itemId))}`];
      }
      state.lastBazaarUpdated = 0;
      state.lastMarketUpdated = 0;
      scheduleMarketPoll(0);
      scheduleBazaarPoll(0);
    } else if (action === 'clear-snoozes') {
      state.settings.snoozedUntil = {};
      saveSnoozeLedger({ replace: true });
      scheduleNextSnoozeExpiry();
    } else if (action === 'reset-position') {
      state.settings.position = { mode: 'top-center', x: null, y: 8 };
    } else if (action === 'reset-size') {
      state.settings.panelSize = { width: null, height: null };
    } else if (action === 'clear-key') {
      state.settings.apiKey = '';
      state.data = {};
      state.errors = {};
      invalidateAlertSnapshot();
      state.lastUpdated = 0;
      state.lastDailyUpdated = 0;
      state.lastMarketUpdated = 0;
      state.lastBazaarUpdated = 0;
      state.lastFastUpdated = 0;
      state.lastRaceUpdated = 0;
      state.nextRaceTravelCheckAt = 0;
      state.lastMissionsUpdated = 0;
      state.lastCasinoUpdated = 0;
      state.lastJobAddictionUpdated = 0;
      state.lastClusterUpdated = 0;
      saveCheckCache();
    } else if (action === 'save-key') {
      const input = shadow.querySelector('[data-field="api-key"]');
      const key = input?.value.trim();
      if (key && key !== state.settings.apiKey) {
        state.settings.apiKey = key;
        state.data = {};
        state.lastDailyUpdated = 0;
        state.lastMarketUpdated = 0;
        state.lastBazaarUpdated = 0;
        state.lastFastUpdated = 0;
        state.lastRaceUpdated = 0;
        state.nextRaceTravelCheckAt = 0;
        state.lastMissionsUpdated = 0;
        state.lastCasinoUpdated = 0;
        state.lastJobAddictionUpdated = 0;
        state.lastClusterUpdated = 0;
        invalidateAlertSnapshot();
        saveCheckCache();
      }
      saveSettings();
      refresh({ force: true });
      if (key && state.settings.settingsOpen) loadItemCatalog();
      return;
    }
    saveSettings();
    if (state.alertSnapshotReady && !state.syncing) publishAlertSnapshot();
    render();
  });

  shadow.addEventListener('change', (event) => {
    const toggle = event.target.closest('[data-toggle-alert]');
    if (toggle) {
      state.settings.enabled[toggle.dataset.toggleAlert] = toggle.checked;
      if (toggle.dataset.toggleAlert === 'itemMarket' && toggle.checked) {
        state.lastMarketUpdated = 0;
        state.lastBazaarUpdated = 0;
        scheduleMarketPoll(0);
        scheduleBazaarPoll(0);
      }
      if (toggle.checked && CRIME_ALERT_IDS.has(toggle.dataset.toggleAlert)) {
        window.setTimeout(() => refresh(), 0);
      }
      saveSettings();
      if (state.alertSnapshotReady && !state.syncing) publishAlertSnapshot();
      render();
      return;
    }
    if (event.target.matches('[data-field="medical-hours"]')) {
      state.settings.medicalThresholdHours = Number(event.target.value);
      saveSettings();
      render();
      return;
    }
    if (event.target.matches('[data-field="booster-hours"]')) {
      state.settings.boosterThresholdHours = Number(event.target.value);
      saveSettings();
      if (state.alertSnapshotReady && !state.syncing) publishAlertGroups(['boosterCooldown']);
      render();
      return;
    }
    if (event.target.matches('[data-field="pickpocket-helper-enabled"]')) {
      state.settings.pickpocketHelperEnabled = event.target.checked;
      saveSettings();
      if (event.target.checked) schedulePickpocketFormatting(0);
      else cleanupPickpocketFormatting();
      render();
      return;
    }
    if (event.target.matches('[data-field="pickpocket-min-level"], [data-field="pickpocket-max-level"]')) {
      const field = event.target.matches('[data-field="pickpocket-min-level"]') ? 'pickpocketMinTargetLevel' : 'pickpocketMaxTargetLevel';
      state.settings[field] = Number(event.target.value);
      if (Number(state.settings.pickpocketMinTargetLevel) > Number(state.settings.pickpocketMaxTargetLevel)) {
        if (field === 'pickpocketMinTargetLevel') state.settings.pickpocketMaxTargetLevel = state.settings.pickpocketMinTargetLevel;
        else state.settings.pickpocketMinTargetLevel = state.settings.pickpocketMaxTargetLevel;
      }
      saveSettings();
      schedulePickpocketFormatting(0);
      render();
      return;
    }
    if (event.target.matches('[data-field="api-refresh-minutes"]')) {
      state.settings.apiDailyRefreshMinutes = Number(event.target.value);
    } else if (event.target.matches('[data-field="market-refresh-minutes"]')) {
      if (event.target.value === 'cache-aligned') {
        state.settings.marketRefreshMode = 'cache-aligned';
      } else {
        state.settings.marketRefreshMode = 'fixed';
        state.settings.marketRefreshMinutes = Number(event.target.value);
      }
      Object.values(state.data.market || {}).forEach((result) => { delete result.__nextCheckAt; });
      state.lastMarketUpdated = 0;
      scheduleMarketPoll(0);
    } else if (event.target.matches('[data-field="slow-api-mode"]')) {
      state.settings.slowApiMode = event.target.checked;
      state.apiLimiterUntil = 0;
      scheduleMarketPoll(0);
    } else if (event.target.matches('[data-field="weav3r-bazaar-enabled"]')) {
      state.settings.weav3rBazaarEnabled = event.target.checked;
      state.lastBazaarUpdated = 0;
      scheduleBazaarPoll(0);
    } else if (event.target.matches('[data-field="market-catalog-category"]')) {
      state.settings.marketCatalogCategory = event.target.value;
    } else if (event.target.matches('[data-field="job-addiction-threshold"]')) {
      state.settings.jobAddictionThreshold = Number(event.target.value);
    } else if (event.target.matches('[data-field="player-addiction-threshold"]')) {
      state.settings.playerAddictionThreshold = Number(event.target.value);
    } else if (event.target.matches('[data-field="flash-alarm"]')) {
      state.settings.flashAlarm = event.target.checked;
      state.settings.alarmHistory = {};
    } else if (event.target.matches('[data-field="sound-alarm"]')) {
      state.settings.soundAlarm = event.target.checked;
      state.settings.alarmHistory = {};
      if (event.target.checked) ensureAudioContext();
    } else if (event.target.matches('[data-field="alarm-minutes"]')) {
      state.settings.alarmIntervalMinutes = Number(event.target.value);
      state.settings.alarmHistory = {};
    } else if (event.target.matches('[data-field="browser-notifications"]')) {
      state.settings.browserNotifications = event.target.checked;
      state.settings.alarmHistory = {};
    } else if (event.target.matches('[data-field="notify-desktop"]')) {
      state.settings.notifyDesktop = event.target.checked;
      state.settings.alarmHistory = {};
    } else if (event.target.matches('[data-field="notify-mobile"]')) {
      state.settings.notifyMobile = event.target.checked;
      state.settings.alarmHistory = {};
    } else if (event.target.matches('[data-field="landing-lead-minutes"]')) {
      state.settings.landingLeadMinutes = Number(event.target.value);
      delete state.settings.alarmHistory.landing;
    } else if (event.target.matches('[data-field="landing-flash-alarm"]')) {
      state.settings.landingFlashAlarm = event.target.checked;
      delete state.settings.alarmHistory.landing;
    } else if (event.target.matches('[data-field="landing-sound-alarm"]')) {
      state.settings.landingSoundAlarm = event.target.checked;
      delete state.settings.alarmHistory.landing;
      if (event.target.checked) ensureAudioContext();
    } else if (event.target.matches('[data-field="landing-alarm-minutes"]')) {
      state.settings.landingAlarmIntervalMinutes = Number(event.target.value);
      delete state.settings.alarmHistory.landing;
    } else if (event.target.matches('[data-field="turtle-lead-minutes"]')) {
      state.settings.turtleLeadMinutes = Number(event.target.value);
      delete state.settings.alarmHistory.turtle;
    } else if (event.target.matches('[data-field="turtle-flash-alarm"]')) {
      state.settings.turtleFlashAlarm = event.target.checked;
      delete state.settings.alarmHistory.turtle;
    } else if (event.target.matches('[data-field="turtle-sound-alarm"]')) {
      state.settings.turtleSoundAlarm = event.target.checked;
      delete state.settings.alarmHistory.turtle;
      if (event.target.checked) ensureAudioContext();
    } else if (event.target.matches('[data-field="turtle-alarm-minutes"]')) {
      state.settings.turtleAlarmIntervalMinutes = Number(event.target.value);
      delete state.settings.alarmHistory.turtle;
    } else if (event.target.matches('[data-watch-field]')) {
      const watch = state.settings.marketWatches.find((item) => item.uid === event.target.dataset.watchUid);
      if (!watch) return;
      const field = event.target.dataset.watchField;
      const previousItemId = Math.trunc(Number(watch.itemId));
      watch[field] = field === 'enabled' ? event.target.checked : event.target.value;
      if (field === 'enabled') state.settings.enabled[`market:${watch.uid}`] = event.target.checked;
      if (field === 'itemId' && state.data.market) delete state.data.market[watch.uid];
      if (field === 'itemId' && state.data.bazaars) delete state.data.bazaars[watch.uid];
      if (field === 'itemId' && previousItemId > 0 && !state.settings.marketWatches.some((item) => item.uid !== watch.uid && Math.trunc(Number(item.itemId)) === previousItemId)) {
        delete state.errors[`market-item:${previousItemId}`];
      }
      state.lastMarketUpdated = 0;
      state.lastBazaarUpdated = 0;
      scheduleMarketPoll(0);
      scheduleBazaarPoll(0);
    } else {
      return;
    }
    saveSettings();
    if (state.alertSnapshotReady && !state.syncing) publishAlertSnapshot();
    render();
  });

  shadow.addEventListener('input', (event) => {
    const input = event.target.closest('[data-market-search]');
    if (!input) return;
    const watch = state.settings.marketWatches.find((item) => item.uid === input.dataset.watchUid);
    if (!watch) return;
    const searchText = input.value;
    const previousItemId = Math.trunc(Number(watch.itemId));
    watch.searchText = searchText;
    const match = catalogItemBySearch(searchText);
    if (match) {
      selectCatalogItem(watch, match);
      const meta = input.closest('[data-market-watch]')?.querySelector('.market-item-search small');
      if (meta) meta.textContent = `${match.type} - ID ${match.id}${Number(match.marketPrice) ? ` - Torn value ~$${Number(match.marketPrice).toLocaleString()}` : ''}`;
      saveSettings();
      return;
    }
    if (previousItemId > 0 && searchText.trim().toLocaleLowerCase() !== String(watch.label || '').trim().toLocaleLowerCase()) {
      watch.itemId = '';
      watch.label = '';
      watch.catalogType = '';
      watch.marketEstimate = 0;
      if (state.data.market) delete state.data.market[watch.uid];
      if (state.data.bazaars) delete state.data.bazaars[watch.uid];
      if (!state.settings.marketWatches.some((other) => other.uid !== watch.uid && Math.trunc(Number(other.itemId)) === previousItemId)) {
        delete state.errors[`market-item:${previousItemId}`];
      }
      state.lastMarketUpdated = 0;
      state.lastBazaarUpdated = 0;
      scheduleMarketPoll(0);
      scheduleBazaarPoll(0);
    }
    saveSettings();
  });

  shadow.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!state.renderPending || shadow.activeElement?.closest?.('input, select, textarea')) return;
      render({ force: true });
    }, 0);
  });

  shadow.addEventListener('toggle', (event) => {
    const section = event.target.closest?.('[data-settings-section]');
    if (!section) return;
    state.settings.settingsSections ||= {};
    state.settings.settingsSections[section.dataset.settingsSection] = section.open;
    saveSettings();
  }, true);

  shadow.addEventListener('pointerdown', (event) => {
    if (state.settings.soundAlarm || state.settings.landingSoundAlarm || state.settings.turtleSoundAlarm) ensureAudioContext();
    const panel = event.target.closest('.panel');
    if (panel) {
      const panelRect = panel.getBoundingClientRect();
      const onResizeHandle = event.clientX >= panelRect.right - 22 && event.clientY >= panelRect.bottom - 22;
      if (onResizeHandle) {
        state.resizing = { pointerId: event.pointerId };
        state.drag = null;
        return;
      }
    }
    const header = event.target.closest('[data-drag-handle]');
    if (!header || event.target.closest('button, a, input, select')) return;
    const rect = host.getBoundingClientRect();
    state.drag = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    header.setPointerCapture(event.pointerId);
  });

  shadow.addEventListener('pointermove', (event) => {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const rect = host.getBoundingClientRect();
    const x = Math.min(Math.max(0, event.clientX - state.drag.dx), Math.max(0, innerWidth - rect.width));
    const y = Math.min(Math.max(0, event.clientY - state.drag.dy), Math.max(0, innerHeight - 40));
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    host.style.transform = 'none';
  });

  shadow.addEventListener('pointerup', (event) => {
    if (state.resizing?.pointerId === event.pointerId) {
      const panel = shadow.querySelector('.panel');
      const rect = panel?.getBoundingClientRect();
      if (rect) {
        state.settings.panelSize = {
          width: Math.round(rect.width),
          height: state.settings.collapsed
            ? Number(state.settings.panelSize?.height) || null
            : Math.round(rect.height),
        };
        saveSettings();
      }
      state.resizing = null;
      return;
    }
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const rect = host.getBoundingClientRect();
    state.settings.position = { mode: 'free', x: Math.round(rect.left), y: Math.round(rect.top) };
    state.drag = null;
    saveSettings();
  });

  window.addEventListener('pointerup', (event) => {
    if (state.resizing?.pointerId !== event.pointerId) return;
    const panel = shadow.querySelector('.panel');
    const rect = panel?.getBoundingClientRect();
    if (rect) {
      state.settings.panelSize = {
        width: Math.round(rect.width),
        height: state.settings.collapsed
          ? Number(state.settings.panelSize?.height) || null
          : Math.round(rect.height),
      };
      saveSettings();
    }
    state.resizing = null;
  });

  document.addEventListener('visibilitychange', () => {
    if (visibleTornTab()) {
      state.windowFocused = document.hasFocus();
      refresh({ domOnly: true });
      schedulePickpocketFormatting(0);
    } else {
      state.windowFocused = false;
      state.dom = { capturedAt: Date.now(), source: 'paused' };
      cleanupPickpocketFormatting();
      render();
    }
  });

  window.addEventListener('focus', () => {
    state.windowFocused = true;
    refresh({ domOnly: true });
    schedulePickpocketFormatting(0);
  });

  window.addEventListener('blur', () => {
    state.windowFocused = false;
    state.dom = { capturedAt: Date.now(), source: 'api-fallback' };
    cleanupPickpocketFormatting();
    if (state.raceCheckComplete && !state.raceCheckPending) publishAlertGroups(['raceTravel']);
    render();
  });

  window.addEventListener('hashchange', () => schedulePickpocketFormatting(0));
  window.addEventListener('popstate', () => schedulePickpocketFormatting(0));

  function scheduleVisiblePageSignalRefresh() {
    if (!focusedTornPage() || state.domRefreshTimer) return;
    state.domRefreshTimer = window.setTimeout(() => {
      state.domRefreshTimer = null;
      const beforeRaceIconState = state.dom.raceIconState || 'unknown';
      const beforeCrimeUniqueKey = state.dom.crimeUniqueSignal?.key || null;
      const before = JSON.stringify({
        energy: state.dom.bars?.energy,
        nerve: state.dom.bars?.nerve,
        drug: state.dom.cooldowns?.drug,
        medical: state.dom.cooldowns?.medical,
        booster: state.dom.cooldowns?.booster,
        raceActive: state.dom.raceActive,
        raceKnown: state.dom.raceSignalKnown,
        raceIcon: state.dom.raceIconLabel,
        raceIconState: state.dom.raceIconState,
        racePageLoaded: state.dom.racePageLoaded,
        clusterReady: state.dom.clusterRingReady,
        clusterKnown: state.dom.clusterRingSignalKnown,
        crimeUniqueKey: state.dom.crimeUniqueSignal?.key,
        crimeUniqueKnown: state.dom.crimeUniqueSignal?.known,
        crimeUniqueAvailable: state.dom.crimeUniqueSignal?.available,
        stockReady: state.dom.stockBenefitsReady,
        stockKnown: state.dom.stockBenefitsSignalKnown,
        education: state.dom.educationActive,
        addiction: state.dom.playerAddiction,
      });
      scrapeActivePage();
      state.pageCheckPending = focusedRouteAwaitingLiveData();
      const after = JSON.stringify({
        energy: state.dom.bars?.energy,
        nerve: state.dom.bars?.nerve,
        drug: state.dom.cooldowns?.drug,
        medical: state.dom.cooldowns?.medical,
        booster: state.dom.cooldowns?.booster,
        raceActive: state.dom.raceActive,
        raceKnown: state.dom.raceSignalKnown,
        raceIcon: state.dom.raceIconLabel,
        raceIconState: state.dom.raceIconState,
        racePageLoaded: state.dom.racePageLoaded,
        clusterReady: state.dom.clusterRingReady,
        clusterKnown: state.dom.clusterRingSignalKnown,
        crimeUniqueKey: state.dom.crimeUniqueSignal?.key,
        crimeUniqueKnown: state.dom.crimeUniqueSignal?.known,
        crimeUniqueAvailable: state.dom.crimeUniqueSignal?.available,
        stockReady: state.dom.stockBenefitsReady,
        stockKnown: state.dom.stockBenefitsSignalKnown,
        education: state.dom.educationActive,
        addiction: state.dom.playerAddiction,
      });
      if (before === after) return;
      const groups = [];
      if (state.dom.bars?.energy) groups.push('energyFull');
      if (state.dom.bars?.nerve) groups.push('nerveFull');
      if (state.dom.cooldowns?.drug != null) groups.push('drugCooldown');
      if (state.dom.cooldowns?.medical != null) groups.push('medicalCooldown');
      if (state.dom.cooldowns?.booster != null) groups.push('boosterCooldown');
      if (state.dom.stockBenefitsSignalKnown) groups.push('stockBenefits');
      if (state.dom.educationActive) groups.push('education');
      if (state.dom.playerAddiction != null) groups.push('playerAddiction');
      if (state.dom.clusterRingSignalKnown && state.data.shoplifting) groups.push('clusterRing');
      const beforeCrimeDefinition = crimeUniqueDefinition(beforeCrimeUniqueKey);
      const afterCrimeDefinition = crimeUniqueDefinition(state.dom.crimeUniqueSignal?.key);
      if (beforeCrimeDefinition) groups.push(beforeCrimeDefinition.alertId);
      if (state.dom.crimeUniqueSignal?.known && afterCrimeDefinition) groups.push(afterCrimeDefinition.alertId);
      const becameExplicitlyInactive = beforeRaceIconState !== 'inactive' && state.dom.raceIconState === 'inactive';
      if (becameExplicitlyInactive) {
        state.nextRaceTravelCheckAt = 0;
        state.lastRaceUpdated = 0;
        state.raceCheckPending = true;
        state.raceCheckComplete = false;
      } else if (state.dom.raceActive) {
        state.raceCheckPending = false;
        state.raceCheckComplete = true;
        groups.push('raceTravel');
      } else if (state.dom.raceSignalKnown && state.raceCheckComplete && !state.raceCheckPending) {
        groups.push('raceTravel');
      }
      publishAlertGroups(groups);
      render();
      if (becameExplicitlyInactive && !state.syncing) refresh();
    }, 600);
  }

  window.addEventListener('resize', () => {
    if (state.settings.position.mode === 'free') {
      const rect = host.getBoundingClientRect();
      state.settings.position.x = Math.min(Math.max(0, rect.left), Math.max(0, innerWidth - rect.width));
      state.settings.position.y = Math.min(Math.max(0, rect.top), Math.max(0, innerHeight - 40));
      saveSettings();
      applyPosition();
    }
    if (state.windowResizeTimer) window.clearTimeout(state.windowResizeTimer);
    state.windowResizeTimer = window.setTimeout(() => {
      state.windowResizeTimer = null;
      render();
    }, 120);
  });

  render();
  window.setTimeout(() => refresh(), 800);
  if (state.settings.settingsOpen && !itemCatalogFresh()) loadItemCatalog();
  if (document.body) {
    state.domObserver = new MutationObserver(() => {
      scheduleVisiblePageSignalRefresh();
      schedulePickpocketFormatting();
    });
    state.domObserver.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label', 'data-tooltip', 'class', 'style', 'fill', 'stroke', 'href', 'src'],
    });
  }
  schedulePickpocketFormatting(0);
  state.pickpocketHeartbeat = window.setInterval(() => {
    if (focusedTornPage()) schedulePickpocketFormatting(0);
    else cleanupPickpocketFormatting();
  }, 1_500);
  state.coreTimer = window.setInterval(() => refresh(), CORE_REFRESH_MS);
  scheduleNextSnoozeExpiry();
  scheduleMarketPoll();
  // TornW3B uses a dedicated timer so fast Bazaar polling never triggers Torn
  // API categories or rebuilds the dashboard when the listings are unchanged.
  scheduleBazaarPoll();
  state.alarmTimer = window.setInterval(maybeAlarm, 5_000);
})();
