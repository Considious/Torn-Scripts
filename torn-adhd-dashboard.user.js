// ==UserScript==
// @name         Torn ADHD Dashboard
// @namespace    Considious [3853023]
// @version      1.1.1
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
    pickpocketRefreshTimer: null,
    pickpocketHeartbeat: null,
    pickpocketFormattedCount: 0,
    crimeProgressPromise: null,
    snoozeExpiryTimer: null,
    apiQueues: { high: [], normal: [], low: [] },
    apiQueueTimer: null,
    apiLimiterUntil: 0,
    windowFocused: document.hasFocus(),
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
    return rollingTornApiUsage({ record: true })…43735 tokens truncated…pdated = 0;
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
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const rect = host.getBoundingClientRect();
    state.settings.position = { mode: 'free', x: Math.round(rect.left), y: Math.round(rect.top) };
    state.drag = null;
    saveSettings();
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
    if (state.settings.position.mode !== 'free') return;
    const rect = host.getBoundingClientRect();
    state.settings.position.x = Math.min(Math.max(0, rect.left), Math.max(0, innerWidth - rect.width));
    state.settings.position.y = Math.min(Math.max(0, rect.top), Math.max(0, innerHeight - 40));
    saveSettings();
    applyPosition();
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
