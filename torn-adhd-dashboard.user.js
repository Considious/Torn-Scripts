// ==UserScript==
// @name         Considious Torn ADHD Dashboard
// @namespace    Considious [3853023]
// @version      1.4.30
// @description  Privacy-conscious Torn reminders with shared API limiting, city-shop stock, and market watches.
// @author       Considious [3853023]
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/torn-adhd-dashboard.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/torn-adhd-dashboard.user.js
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @connect      api.torn.com
// @connect      weav3r.dev
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/main/shared/Considious_Torn_Lib.js?v=1.3.4
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  const TornLib = globalThis.ConsidiousTornLib;
  if (!TornLib) throw new Error('Considious Torn Library failed to load.');

  const STORAGE_KEY = 'tdd-settings-v1';
  const SNOOZE_STORAGE_KEY = 'tdd-snoozes-v1';
  const ITEM_CATALOG_KEY = 'tdd-item-catalog-v1';
  const BAZAAR_CACHE_KEY = 'tdd-weav3r-bazaar-cache-v1';
  const DOLLAR_BAZAAR_CACHE_KEY = 'tdd-weav3r-dollar-bazaars-v1';
  const WEAV3R_CATEGORY_CACHE_KEY = 'tdd-weav3r-category-cache-v1';
  const AWARD_CACHE_KEY = 'tdd-awards-cache-v1';
  const CHECK_CACHE_KEY = 'tdd-check-cache-v1';
  const CHECK_CACHE_SCHEMA_VERSION = 4;
  const API_ROOT = 'https://api.torn.com/v2';
  const API_V1_ROOT = 'https://api.torn.com';
  const CORE_REFRESH_MS = 60_000;
  const NERVE_REFRESH_MS = 5 * 60_000;
  const ENERGY_REFRESH_MS = 10 * 60_000;
  const COOLDOWN_REFRESH_MS = 10 * 60_000;
  const EDUCATION_OC_REFRESH_MS = 7 * 60_000;
  const RACE_TRAVEL_REFRESH_MS = 3 * 60_000;
  const CITY_SHOP_REFRESH_MS = 5 * 60_000;
  const API_TRANSITION_SETTLE_MS = 5_000;
  const TORN_RESET_SETTLE_MS = 15_000;
  const ITEM_MARKET_FALLBACK_REFRESH_MS = 30_000;
  const ITEM_MARKET_CACHE_SAFETY_MS = 1_000;
  const ITEM_MARKET_STALE_RETRY_MIN_MS = 2_000;
  const ITEM_MARKET_STALE_RETRY_MAX_MS = 5_000;
  const ITEM_MARKET_LISTING_LIMIT = 5;
  const POINTS_MARKET_REFRESH_MS = 30_000;
  const MARKET_WATCH_LIMIT = 50;
  const MARKET_PRIORITY_CYCLES = Object.freeze({ high: 1, normal: 2, low: 4 });
  const WEAV3R_PRIORITY_REFRESH_MS = Object.freeze({ high: 10_000, normal: 30_000, low: 60_000 });
  const WEAV3R_CATEGORY_CACHE_MAX_AGE_MS = 60 * 60_000;
  const WEAV3R_CATEGORY_MAX_PAGES = 6;
  const DOLLAR_BAZAAR_CACHE_MAX_AGE_MS = 30_000;
  const DOLLAR_BAZAAR_LIMIT = 50;
  const CITY_SHOP_TARGETS = [
    { id: 180, name: 'Bottle of Beer', label: 'Beer' },
    { id: 392, name: 'Pepper Spray', label: 'Pepper Spray' },
    { id: 731, name: 'Empty Blood Bag', label: 'Empty Blood Bags' },
  ];
  const API_HARD_LIMIT = 60;
  const API_SLOW_LIMIT = 30;
  const TORN_DAY_MS = 24 * 60 * 60 * 1000;
  const ITEM_CATALOG_MAX_AGE_MS = TORN_DAY_MS;
  const AWARD_CATALOG_MAX_AGE_MS = 7 * TORN_DAY_MS;
  const TRACKED_AWARD_LIMIT = 3;
  const FINISHER_TARGET = 1_000;
  const FINISHER_LABELS = Object.freeze({
    heavy_artillery: 'Heavy artillery',
    machine_guns: 'Machine guns',
    rifles: 'Rifles',
    sub_machine_guns: 'Sub-machine guns',
    shotguns: 'Shotguns',
    pistols: 'Pistols',
    temporary: 'Temporary',
    piercing: 'Piercing',
    slashing: 'Slashing',
    clubbing: 'Clubbing',
    mechanical: 'Mechanical',
    hand_to_hand: 'Hand-to-hand',
  });
  const SOUVENIR_ASSIGNMENTS = Object.freeze([
    { item: 'Mayan Statue', location: 'Mexico' },
    { item: 'Hockey Stick', location: 'Canada' },
    { item: 'Pele Charm', location: 'Hawaii' },
    { item: 'Soccer Ball', location: 'Argentina' },
    { item: 'Jade Buddha', location: 'China' },
    { item: 'Maneki Neko', location: 'Japan' },
    { item: 'Elephant Statue', location: 'South Africa' },
    { item: 'Afro Comb', location: 'South Africa' },
    { item: 'Compass', location: 'Argentina' },
    { item: 'Sextant', location: 'UK' },
    { item: 'Yucca Plant', location: 'Mexico' },
    { item: 'Fire Hydrant', location: 'Canada' },
    { item: 'Model Space Ship', location: 'UK' },
    { item: 'Ship in a Bottle', location: 'UK' },
    { item: 'Paper Weight', location: 'UK' },
    { item: 'Tailors Dummy', location: 'UK' },
    { item: 'Sumo Doll', location: 'Japan' },
    { item: 'Chopsticks', location: 'Japan' },
    { item: 'Dart Board', location: 'UK' },
    { item: 'Crazy Straw', location: 'Mexico' },
    { item: 'Sensu', location: 'Japan' },
    { item: 'Yakitori Lantern', location: 'Japan' },
    { item: 'Snowboard', location: 'Switzerland' },
    { item: 'Steel Drum', location: 'Caymans' },
    { item: 'Nodding Turtle', location: 'Caymans' },
  ]);
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
  const TRAVEL_CONTRABAND_NAMES = new Set([
    'Obsidian Point', 'Bearer Bond', 'Insulin', 'Bear Gall', 'Quartz Point', 'Shark Fin', 'Turtle Shell', 'Basalt Point',
    'Chert Point', 'Patagonian Fossil', 'Meteorite Fragment', 'Chalcedony Point', 'Ephedrine Powder', 'Safrole Oil',
    'Ergotamine Ampoule', 'Counterfeit Manga', 'Whale Meat', 'Tiger Bone Powder', 'Pangolin Scales', 'Ambergris Lump',
    'Natural Pearls', 'Uncut Diamonds', 'Quartzite Point',
  ]);
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
    ['itemMarket', 'Market watches'],
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
    activeView: 'alerts',
    awardTypeFilter: 'all',
    trackedAwards: [],
    settingsSections: {},
    position: { mode: 'top-center', x: null, y: 8 },
    panelSize: { width: null, height: null },
    medicalThresholdHours: 3,
    boosterThresholdHours: 3,
    pickpocketHelperEnabled: true,
    pickpocketMinTargetLevel: 1,
    pickpocketMaxTargetLevel: 300,
    pickpocketLastSkill: 1,
    apiDailyRefreshMinutes: 10,
    marketRefreshMinutes: 2,
    marketRefreshMode: 'cache-aligned',
    weav3rBazaarEnabled: false,
    slowApiMode: false,
    apiPausedUntil: 0,
    marketCatalogCategory: 'All',
    pawnShopMarginPercent: 0,
    pawnShopPriority: 'high',
    jobAddictionThreshold: 5,
    playerAddictionThreshold: 4,
    flashAlarm: false,
    soundAlarm: false,
    muteSounds: false,
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
    cachedMarketCalls: 0,
    lastMarketUpdated: persistedChecks.lastMarketUpdated,
    lastBazaarUpdated: persistedChecks.lastBazaarUpdated,
    lastEnergyUpdated: persistedChecks.lastEnergyUpdated,
    lastNerveUpdated: persistedChecks.lastNerveUpdated,
    lastCooldownsUpdated: persistedChecks.lastCooldownsUpdated,
    lastEducationOcUpdated: persistedChecks.lastEducationOcUpdated,
    lastRaceUpdated: persistedChecks.lastRaceUpdated,
    nextRaceTravelCheckAt: persistedChecks.nextRaceTravelCheckAt,
    lastMissionsUpdated: persistedChecks.lastMissionsUpdated,
    lastCasinoUpdated: persistedChecks.lastCasinoUpdated,
    lastJobAddictionUpdated: persistedChecks.lastJobAddictionUpdated,
    lastClusterUpdated: persistedChecks.lastClusterUpdated,
    nextApiChecks: persistedChecks.nextApiChecks,
    syncing: false,
    lastUpdated: 0,
    lastDailyUpdated: persistedChecks.lastDailyUpdated,
    tornDayStart: persistedChecks.tornDayStart,
    coreTimer: null,
    marketTimer: null,
    bazaarTimer: null,
    alarmTimer: null,
    itemCatalog: loadItemCatalogCache(),
    awards: loadAwardCache(),
    awardsLoading: false,
    bazaarCache: loadBazaarCache(),
    dollarBazaarCache: loadDollarBazaarCache(),
    dollarBazaarLoading: false,
    dollarBazaarError: '',
    dollarBazaarBackoffUntil: 0,
    weav3rCategoryCache: loadWeav3rCategoryCache(),
    itemCatalogLoading: false,
    pawnShopCandidates: [],
    pawnShopCandidateSelection: new Set(),
    pawnShopCandidatesLoading: false,
    pawnShopCandidatesLoadedAt: 0,
    pawnShopStatus: '',
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
    alertSnapshot: persistedChecks.alertSnapshot,
    alertSnapshotReady: persistedChecks.alertSnapshotReady,
    readyAlertGroups: new Set(persistedChecks.readyAlertGroups),
    checkCycleFailed: false,
    pageCheckPending: false,
    audioContext: null,
    drag: null,
    renderPending: false,
    domObserver: null,
    domRefreshTimer: null,
    bazaarOneDollarTimer: null,
    bazaarCatalogRequestedAt: 0,
    pendingBazaarPurchase: null,
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
    chatShareArm: null,
  };
  let dashboardNetworkLease = null;

  function loadSettings() {
    const saved = GM_getValue(STORAGE_KEY, {});
    const snoozeLedger = loadSnoozeLedger();
    const savedSnoozes = saved?.snoozedUntil && typeof saved.snoozedUntil === 'object' ? saved.snoozedUntil : {};
    const snoozedUntil = { ...savedSnoozes };
    Object.entries(snoozeLedger).forEach(([id, until]) => {
      snoozedUntil[id] = Math.max(Number(snoozedUntil[id]) || 0, Number(until) || 0);
    });
    const pickpocketMin = Math.min(300, Math.max(1, Math.trunc(Number(saved?.pickpocketMinTargetLevel) || DEFAULT_SETTINGS.pickpocketMinTargetLevel)));
    const pickpocketMax = Math.min(300, Math.max(1, Math.trunc(Number(saved?.pickpocketMaxTargetLevel) || DEFAULT_SETTINGS.pickpocketMaxTargetLevel)));
    return {
      ...DEFAULT_SETTINGS,
      ...(saved && typeof saved === 'object' ? saved : {}),
      position: { ...DEFAULT_SETTINGS.position, ...(saved?.position || {}) },
      panelSize: { ...DEFAULT_SETTINGS.panelSize, ...(saved?.panelSize || {}) },
      enabled: { ...DEFAULT_SETTINGS.enabled, ...(saved?.enabled || {}) },
      snoozedUntil,
      alarmHistory: { ...(saved?.alarmHistory || {}) },
      settingsSections: { ...(saved?.settingsSections || {}) },
      activeView: ['alerts', 'awards', 'dollarBazaars'].includes(saved?.activeView) ? saved.activeView : 'alerts',
      awardTypeFilter: normalizedAwardTypeFilter(saved?.awardTypeFilter),
      trackedAwards: Array.isArray(saved?.trackedAwards)
        ? [...new Set(saved.trackedAwards.map(String).filter((key) => /^(?:medal|honor):\d+$/.test(key)))].slice(0, TRACKED_AWARD_LIMIT)
        : [],
      pickpocketMinTargetLevel: Math.min(pickpocketMin, pickpocketMax),
      pickpocketMaxTargetLevel: Math.max(pickpocketMin, pickpocketMax),
      marketWatches: Array.isArray(saved?.marketWatches)
        ? saved.marketWatches.map((watch) => ({
          ...watch,
          marketType: watch?.marketType === 'points' ? 'points' : 'item',
          priority: normalizedMarketPriority(watch?.priority),
        }))
        : [],
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
      return {
        data: {},
        tornDayStart: 0,
        lastDailyUpdated: 0,
        lastMarketUpdated: 0,
        lastBazaarUpdated: 0,
        lastEnergyUpdated: 0,
        lastNerveUpdated: 0,
        lastCooldownsUpdated: 0,
        lastEducationOcUpdated: 0,
        lastRaceUpdated: 0,
        nextRaceTravelCheckAt: 0,
        lastMissionsUpdated: 0,
        lastCasinoUpdated: 0,
        lastJobAddictionUpdated: 0,
        lastClusterUpdated: 0,
        nextApiChecks: {},
        lastUpdated: 0,
        alertSnapshot: [],
        alertSnapshotReady: false,
        readyAlertGroups: [],
      };
    }
    const legacyFastUpdated = Number(cached.lastFastUpdated) || 0;
    const data = cached.data && typeof cached.data === 'object' && !Array.isArray(cached.data) ? { ...cached.data } : {};
    const nextApiChecks = cached.nextApiChecks && typeof cached.nextApiChecks === 'object' && !Array.isArray(cached.nextApiChecks)
      ? Object.fromEntries(Object.entries(cached.nextApiChecks).map(([key, value]) => [key, Number(value) || 0]))
      : {};
    const cachedSchemaVersion = Number(cached.schemaVersion) || 0;
    let tornDayStart = Number(cached.tornDayStart) || 0;
    let lastDailyUpdated = Number(cached.lastDailyUpdated) || 0;
    let lastCasinoUpdated = Number(cached.lastCasinoUpdated) || 0;
    let lastCooldownsUpdated = Number(cached.lastCooldownsUpdated) || legacyFastUpdated;
    let alertSnapshot = Array.isArray(cached.alertSnapshot) ? cached.alertSnapshot : [];
    let readyAlertGroups = Array.isArray(cached.readyAlertGroups) ? cached.readyAlertGroups.filter(Boolean) : [];
    if (cachedSchemaVersion < 2) {
      const cooldownAlertIds = new Set(['drugCooldown', 'medicalCooldown', 'boosterCooldown']);
      delete data.cooldowns;
      delete nextApiChecks.cooldowns;
      lastCooldownsUpdated = 0;
      alertSnapshot = alertSnapshot.filter((alert) => !cooldownAlertIds.has(alert?.id));
      readyAlertGroups = readyAlertGroups.filter((group) => !cooldownAlertIds.has(group));
    }
    if (cachedSchemaVersion < 3) {
      const dailyAlertIds = new Set(['energyRefill', 'nerveRefill', 'cityItem']);
      ['refills', 'cityItemsNow', 'cityItemsAtReset', 'cityShops'].forEach((key) => delete data[key]);
      ['refills', 'cityItems'].forEach((key) => delete nextApiChecks[key]);
      tornDayStart = 0;
      lastDailyUpdated = 0;
      alertSnapshot = alertSnapshot.filter((alert) => !dailyAlertIds.has(alert?.id));
      readyAlertGroups = readyAlertGroups.filter((group) => group !== 'refills' && group !== 'cityItem');
    }
    if (cachedSchemaVersion < 4) {
      const dailyAlertIds = new Set(['energyRefill', 'nerveRefill', 'cityItem', 'casinoTokens']);
      ['refills', 'cityItemsNow', 'cityItemsAtReset', 'cityShops', 'casino'].forEach((key) => delete data[key]);
      ['refills', 'cityItems', 'casinoTokens'].forEach((key) => delete nextApiChecks[key]);
      tornDayStart = 0;
      lastDailyUpdated = 0;
      lastCasinoUpdated = 0;
      alertSnapshot = alertSnapshot.filter((alert) => !dailyAlertIds.has(alert?.id));
      readyAlertGroups = readyAlertGroups.filter((group) => !['refills', 'cityItem', 'casinoTokens'].includes(group));
    }
    return {
      data,
      tornDayStart,
      lastDailyUpdated,
      lastMarketUpdated: Number(cached.lastMarketUpdated) || 0,
      lastBazaarUpdated: Number(cached.lastBazaarUpdated) || 0,
      lastEnergyUpdated: Number(cached.lastEnergyUpdated) || legacyFastUpdated,
      lastNerveUpdated: Number(cached.lastNerveUpdated) || legacyFastUpdated,
      lastCooldownsUpdated,
      lastEducationOcUpdated: Number(cached.lastEducationOcUpdated) || 0,
      lastRaceUpdated: Number(cached.lastRaceUpdated) || 0,
      nextRaceTravelCheckAt: Number(cached.nextRaceTravelCheckAt) || 0,
      lastMissionsUpdated: Number(cached.lastMissionsUpdated) || 0,
      lastCasinoUpdated,
      lastJobAddictionUpdated: Number(cached.lastJobAddictionUpdated) || 0,
      lastClusterUpdated: Number(cached.lastClusterUpdated) || 0,
      nextApiChecks,
      lastUpdated: Number(cached.lastUpdated) || Number(cached.savedAt) || 0,
      alertSnapshot,
      alertSnapshotReady: cached.alertSnapshotReady === true && readyAlertGroups.length > 0,
      readyAlertGroups,
    };
  }

  function saveCheckCache() {
    if (dashboardNetworkLease && !ownsDashboardNetworkLease()) return;
    GM_setValue(CHECK_CACHE_KEY, {
      schemaVersion: CHECK_CACHE_SCHEMA_VERSION,
      data: state.data,
      tornDayStart: state.tornDayStart,
      lastDailyUpdated: state.lastDailyUpdated,
      lastMarketUpdated: state.lastMarketUpdated,
      lastBazaarUpdated: state.lastBazaarUpdated,
      lastEnergyUpdated: state.lastEnergyUpdated,
      lastNerveUpdated: state.lastNerveUpdated,
      lastCooldownsUpdated: state.lastCooldownsUpdated,
      lastEducationOcUpdated: state.lastEducationOcUpdated,
      lastRaceUpdated: state.lastRaceUpdated,
      nextRaceTravelCheckAt: state.nextRaceTravelCheckAt,
      lastMissionsUpdated: state.lastMissionsUpdated,
      lastCasinoUpdated: state.lastCasinoUpdated,
      lastJobAddictionUpdated: state.lastJobAddictionUpdated,
      lastClusterUpdated: state.lastClusterUpdated,
      nextApiChecks: state.nextApiChecks,
      lastUpdated: state.lastUpdated,
      alertSnapshot: state.alertSnapshot,
      alertSnapshotReady: state.alertSnapshotReady,
      readyAlertGroups: [...state.readyAlertGroups],
      savedAt: Date.now(),
    });
  }

  function applyCheckCache(cached) {
    state.data = cached.data;
    state.tornDayStart = cached.tornDayStart;
    state.lastDailyUpdated = cached.lastDailyUpdated;
    state.lastMarketUpdated = cached.lastMarketUpdated;
    state.lastBazaarUpdated = cached.lastBazaarUpdated;
    state.lastEnergyUpdated = cached.lastEnergyUpdated;
    state.lastNerveUpdated = cached.lastNerveUpdated;
    state.lastCooldownsUpdated = cached.lastCooldownsUpdated;
    state.lastEducationOcUpdated = cached.lastEducationOcUpdated;
    state.lastRaceUpdated = cached.lastRaceUpdated;
    state.nextRaceTravelCheckAt = cached.nextRaceTravelCheckAt;
    state.lastMissionsUpdated = cached.lastMissionsUpdated;
    state.lastCasinoUpdated = cached.lastCasinoUpdated;
    state.lastJobAddictionUpdated = cached.lastJobAddictionUpdated;
    state.lastClusterUpdated = cached.lastClusterUpdated;
    state.nextApiChecks = cached.nextApiChecks;
    state.lastUpdated = cached.lastUpdated;
    state.alertSnapshot = cached.alertSnapshot;
    state.alertSnapshotReady = cached.alertSnapshotReady;
    state.readyAlertGroups = new Set(cached.readyAlertGroups);
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

  function loadDollarBazaarCache() {
    const cached = GM_getValue(DOLLAR_BAZAAR_CACHE_KEY, {});
    if (!cached || typeof cached !== 'object' || Array.isArray(cached) || !Array.isArray(cached.bazaars)) {
      return { fetchedAt: 0, sourceUrl: 'https://weav3r.dev/dollar-bazaars', bazaars: [] };
    }
    return {
      fetchedAt: Math.max(0, Number(cached.fetchedAt) || 0),
      sourceUrl: String(cached.sourceUrl || 'https://weav3r.dev/dollar-bazaars'),
      bazaars: cached.bazaars.map((row) => ({
        playerId: Math.max(0, Math.trunc(Number(row?.playerId) || 0)),
        playerName: String(row?.playerName || ''),
        itemCount: Math.max(0, Math.trunc(Number(row?.itemCount) || 0)),
        totalValue: Math.max(0, Math.trunc(Number(row?.totalValue) || 0)),
        updatedAt: Math.max(0, Number(row?.updatedAt) || 0),
      })).filter((row) => row.playerId > 0),
    };
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
    if (!expired.length) return [];
    expired.forEach((id) => delete state.settings.snoozedUntil[id]);
    saveSnoozeLedger({ replace: true });
    saveSettings();
    scheduleNextSnoozeExpiry();
    return expired;
  }

  function visibleTornTab() {
    return TornLib.isPageActive({ requireFocus: false });
  }

  function focusedTornPage() {
    return state.windowFocused && TornLib.isPageActive();
  }

  function loadAwardCache() {
    const cached = GM_getValue(AWARD_CACHE_KEY, {});
    if (!cached || typeof cached !== 'object' || Array.isArray(cached)) {
      return {
        catalogFetchedAt: 0,
        playerFetchedAt: 0,
        catalogMedals: [],
        catalogHonors: [],
        medals: [],
        honors: [],
        merits: null,
        userId: 0,
        finishingHits: {},
        personalStats: {},
        profile: {},
        error: '',
      };
    }
    return {
      catalogFetchedAt: Number(cached.catalogFetchedAt) || 0,
      playerFetchedAt: Number(cached.playerFetchedAt) || 0,
      catalogMedals: Array.isArray(cached.catalogMedals) ? cached.catalogMedals : [],
      catalogHonors: Array.isArray(cached.catalogHonors) ? cached.catalogHonors : [],
      medals: Array.isArray(cached.medals) ? cached.medals : [],
      honors: Array.isArray(cached.honors) ? cached.honors : [],
      merits: cached.merits && typeof cached.merits === 'object' ? cached.merits : null,
      userId: Math.max(0, Math.trunc(Number(cached.userId) || 0)),
      finishingHits: cached.finishingHits && typeof cached.finishingHits === 'object' && !Array.isArray(cached.finishingHits)
        ? cached.finishingHits
        : {},
      personalStats: cached.personalStats && typeof cached.personalStats === 'object' && !Array.isArray(cached.personalStats)
        ? cached.personalStats
        : {},
      profile: cached.profile && typeof cached.profile === 'object' && !Array.isArray(cached.profile)
        ? cached.profile
        : {},
      error: String(cached.error || ''),
    };
  }

  function saveAwardCache() {
    GM_setValue(AWARD_CACHE_KEY, {
      ...state.awards,
      savedAt: Date.now(),
    });
  }

  function loadWeav3rCategoryCache() {
    const cached = GM_getValue(WEAV3R_CATEGORY_CACHE_KEY, {});
    if (!cached || typeof cached !== 'object' || Array.isArray(cached)) return {};
    return Object.fromEntries(Object.entries(cached).filter(([, result]) => (
      Number(result?.fetchedAt) > Date.now() - 7 * TORN_DAY_MS && Array.isArray(result?.items)
    )));
  }

  function ownsDashboardNetworkLease() {
    return Boolean(dashboardNetworkLease?.isLeader());
  }

  function dashboardOwnerPauseError(message = 'ADHD Dashboard polling is owned by another Torn tab.') {
    const error = new Error(message);
    error.dashboardOwnerPause = true;
    return error;
  }

  function isDashboardOwnerPause(error) {
    return error?.dashboardOwnerPause === true;
  }

  function rollingTornApiUsage() {
    return TornLib.getTornApiUsage({
      limit: state.settings.slowApiMode ? API_SLOW_LIMIT : API_HARD_LIMIT,
    }).events;
  }

  function tornApiDiagnostics() {
    return typeof TornLib.getTornApiLog === 'function'
      ? TornLib.getTornApiLog({ windowMs: 15 * 60_000 })
      : { events: [], byScript: {}, byEndpoint: {}, byScriptEndpoint: {}, windowMs: 15 * 60_000 };
  }

  function finishQueuedTornApiCall(reservation, result, status = 0, apiError = null) {
    if (typeof TornLib.finishTornApiLog === 'function') {
      void TornLib.finishTornApiLog(reservation, {
        result,
        status,
        apiErrorCode: apiError?.code,
        apiErrorMessage: apiError?.error || apiError?.message || '',
      });
    }
  }

  function apiPriorityLimit(priority) {
    if (state.settings.slowApiMode) {
      if (priority === 'high') return API_SLOW_LIMIT;
      if (priority === 'normal') return 20;
      return 10;
    }
    if (priority === 'high') return API_HARD_LIMIT;
    if (priority === 'normal') return 50;
    return 40;
  }

  function processApiQueue() {
    if (state.apiQueueTimer) return;
    const runNext = async () => {
      state.apiQueueTimer = -1;
      const priority = ['high', 'normal', 'low'].find((name) => state.apiQueues[name].length);
      if (!priority) {
        state.apiQueueTimer = null;
        return;
      }
      const queue = state.apiQueues[priority];
      const task = queue.shift();
      try {
        if (!ownsDashboardNetworkLease()) throw dashboardOwnerPauseError();
        if (!state.settings.apiKey) throw new Error('Add a Torn API key in Settings.');
        const pausedUntil = Number(state.settings.apiPausedUntil) || 0;
        if (pausedUntil > Date.now()) {
          throw new Error(`Torn API paused for ${formatDuration(Math.ceil((pausedUntil - Date.now()) / 1000))}.`);
        }
        task.reservation = await TornLib.reserveTornApiSlot({
          limit: apiPriorityLimit(priority),
          script: 'ADHD Dashboard',
          priority,
          method: task.method || 'GET',
          url: task.url,
          quotaExempt: task.quotaExempt,
          quotaClass: task.quotaClass,
          wait: task.waitForQuota,
          maxWaitMs: task.maxWaitMs,
        });
        if (task.quotaExempt) state.cachedMarketCalls += 1;
        else state.apiCalls += 1;
        task.resolve(await task.start(task.reservation));
      } catch (error) {
        if (Number(error?.retryAfterMs) > 0) state.apiLimiterUntil = Date.now() + Number(error.retryAfterMs);
        task.reject(error);
      }
      const spacing = state.settings.slowApiMode ? 1_000 : 100;
      state.apiQueueTimer = window.setTimeout(runNext, spacing);
    };
    state.apiQueueTimer = window.setTimeout(runNext, 0);
  }
  function enqueueTornApiCall(priority, start, requestMeta = {}) {
    return new Promise((resolve, reject) => {
      state.apiQueues[priority] ||= [];
      state.apiQueues[priority].push({
        start,
        resolve,
        reject,
        method: String(requestMeta.method || 'GET'),
        url: String(requestMeta.url || ''),
        quotaExempt: requestMeta.quotaExempt === true,
        quotaClass: String(requestMeta.quotaClass || (requestMeta.quotaExempt ? 'globally-cached-itemmarket' : 'quota')),
        waitForQuota: requestMeta.waitForQuota !== false,
        maxWaitMs: Math.max(0, Number(requestMeta.maxWaitMs ?? 65_000) || 0),
        reservation: null,
      });
      processApiQueue();
    });
  }

  function cancelQueuedApiCalls(message) {
    const error = message instanceof Error ? message : new Error(message);
    Object.values(state.apiQueues).forEach((queue) => {
      while (queue.length) queue.shift().reject(error);
    });
  }

  function api(path, query = {}, { priority = 'normal', quotaExempt = false, quotaClass = '', waitForQuota = true, maxWaitMs = 65_000 } = {}) {
    if (!ownsDashboardNetworkLease()) return Promise.reject(dashboardOwnerPauseError());
    if (!state.settings.apiKey) return Promise.reject(new Error('Add a Torn API key in Settings.'));
    const url = new URL(`${API_ROOT}/${path.replace(/^\/+/, '')}`);
    Object.entries({ ...query, comment: 'DailyDashboard' }).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    return enqueueTornApiCall(priority, (reservation) => new Promise((resolve, reject) => {
      if (!ownsDashboardNetworkLease()) {
        finishQueuedTornApiCall(reservation, 'Cancelled before request');
        reject(dashboardOwnerPauseError());
        return;
      }
      if (!state.settings.apiKey) {
        finishQueuedTornApiCall(reservation, 'Cancelled before request');
        reject(new Error('Add a Torn API key in Settings.'));
        return;
      }

      GM_xmlhttpRequest({
        method: 'GET',
        url: url.toString(),
        headers: {
          Accept: 'application/json',
          Authorization: `ApiKey ${state.settings.apiKey}`,
        },
        timeout: 20_000,
        onload(response) {
          finishQueuedTornApiCall(reservation, `HTTP ${Number(response.status) || 0}`, response.status);
          if (!ownsDashboardNetworkLease()) {
            reject(dashboardOwnerPauseError('Response ignored because another Torn tab now owns ADHD Dashboard polling.'));
            return;
          }
          let body;
          try {
            body = JSON.parse(response.responseText);
          } catch {
            reject(new Error(`Torn API returned invalid JSON (${response.status}).`));
            return;
          }
          if (body?.error) finishQueuedTornApiCall(reservation, `Torn error ${Number(body.error.code) || 0}`, response.status, body.error);
          const serverRateLimited = Number(response.status) === 429 || Number(body?.error?.code) === 5;
          if (serverRateLimited) void TornLib.noteTornApiRateLimit({ retryAfterMs: 60_000 });
          if (response.status < 200 || response.status >= 300 || body?.error) {
            const error = new Error(body?.error?.error || `Torn API request failed (${response.status}).`);
            if (serverRateLimited) {
              error.code = 'TORN_API_SERVER_RATE_LIMIT';
              error.retryAfterMs = 60_000;
            }
            reject(error);
            return;
          }
          resolve(body);
        },
        onerror: () => { finishQueuedTornApiCall(reservation, 'Network error'); reject(new Error('Could not reach the Torn API.')); },
        ontimeout: () => { finishQueuedTornApiCall(reservation, 'Timed out'); reject(new Error('The Torn API request timed out.')); },
      });
    }), { method: 'GET', url: url.toString(), quotaExempt, quotaClass, waitForQuota, maxWaitMs });
  }

  function apiV1(section, query = {}, { priority = 'normal' } = {}) {
    if (!ownsDashboardNetworkLease()) return Promise.reject(dashboardOwnerPauseError());
    if (!state.settings.apiKey) return Promise.reject(new Error('Add a Torn API key in Settings.'));
    const url = new URL(`${API_V1_ROOT}/${String(section).replace(/^\/+|\/+$/g, '')}/`);
    Object.entries({ ...query, key: state.settings.apiKey, comment: 'DailyDashboard' }).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    return enqueueTornApiCall(priority, (reservation) => new Promise((resolve, reject) => {
      if (!ownsDashboardNetworkLease()) {
        finishQueuedTornApiCall(reservation, 'Cancelled before request');
        reject(dashboardOwnerPauseError());
        return;
      }
      if (!state.settings.apiKey) {
        finishQueuedTornApiCall(reservation, 'Cancelled before request');
        reject(new Error('Add a Torn API key in Settings.'));
        return;
      }
      GM_xmlhttpRequest({
        method: 'GET',
        url: url.toString(),
        headers: { Accept: 'application/json' },
        timeout: 20_000,
        onload(response) {
          finishQueuedTornApiCall(reservation, `HTTP ${Number(response.status) || 0}`, response.status);
          if (!ownsDashboardNetworkLease()) {
            reject(dashboardOwnerPauseError('Response ignored because another Torn tab now owns ADHD Dashboard polling.'));
            return;
          }
          let body;
          try {
            body = JSON.parse(response.responseText);
          } catch {
            reject(new Error(`Torn API returned invalid JSON (${response.status}).`));
            return;
          }
          if (body?.error) finishQueuedTornApiCall(reservation, `Torn error ${Number(body.error.code) || 0}`, response.status, body.error);
          if (Number(body?.error?.code) === 5) void TornLib.noteTornApiRateLimit({ retryAfterMs: 60_000 });
          if (response.status < 200 || response.status >= 300 || body?.error) {
            reject(new Error(body?.error?.error || `Torn API request failed (${response.status}).`));
            return;
          }
          resolve(body);
        },
        onerror: () => { finishQueuedTornApiCall(reservation, 'Network error'); reject(new Error('Could not reach the Torn API.')); },
        ontimeout: () => { finishQueuedTornApiCall(reservation, 'Timed out'); reject(new Error('The Torn API request timed out.')); },
      });
    }), { method: 'GET', url: url.toString() });
  }

  function highlightedBazaarHref(sellerId, itemId, price, lastUpdatedAt = 0) {
    const url = new URL('https://www.torn.com/bazaar.php');
    url.searchParams.set('userId', String(Math.trunc(Number(sellerId))));
    url.searchParams.set('itemId', String(Math.trunc(Number(itemId))));
    url.searchParams.set('price', String(Math.trunc(Number(price))));
    url.searchParams.set('highlight', '1');
    if (Number(lastUpdatedAt) > 0) url.searchParams.set('v', String(Math.trunc(Number(lastUpdatedAt) / 1000)));
    url.hash = '/';
    return url.toString();
  }

  function onBazaarPage() {
    return /\/bazaar\.php$/i.test(location.pathname);
  }

  function ensureBazaarOneDollarStyles() {
    if (document.getElementById('tdd-bazaar-one-dollar-styles')) return;
    const style = document.createElement('style');
    style.id = 'tdd-bazaar-one-dollar-styles';
    style.textContent = `
      [data-tdd-bazaar-one-dollar] {
        outline: 4px solid #39ff14 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 18px 5px rgba(57,255,20,.72), inset 0 0 0 2px rgba(57,255,20,.5) !important;
      }
      [data-tdd-bazaar-shop-profit] {
        outline: 4px solid #ff4fbd !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 18px 5px rgba(255,79,189,.68), inset 0 0 0 2px rgba(255,79,189,.48) !important;
      }
    `;
    document.head?.appendChild(style);
  }

  function bazaarCardPrice(card) {
    const priceElement = card?.querySelector?.('[data-testid="price"]');
    if (!priceElement) return null;
    for (const node of priceElement.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const match = String(node.textContent || '').replaceAll(',', '').match(/\$?\s*(\d+(?:\.\d+)?)/);
      if (match) return Number(match[1]);
    }
    const match = String(priceElement.textContent || '').match(/^\s*\$?\s*([\d,]+(?:\.\d+)?)/);
    return match ? Number(match[1].replaceAll(',', '')) : null;
  }

  function bazaarCssColorLooksRed(value) {
    const match = String(value || '').match(/rgba?\(\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)(?:\D+(\d+(?:\.\d+)?))?/i);
    if (!match || (match[4] != null && Number(match[4]) === 0)) return false;
    const red = Number(match[1]);
    const green = Number(match[2]);
    const blue = Number(match[3]);
    return red >= 90 && green <= red * 0.65 && blue <= red * 0.8;
  }

  function bazaarCardUnavailable(card) {
    const priceElement = card.querySelector('[data-testid="price"]');
    const blockedPurchaseSelector = '[class*="isBlockedForBuying"], #isBlockedForBuyingTooltip';
    const unavailableSelector = '[aria-disabled="true"], [data-disabled="true"], [class*="disabled" i], [class*="unavailable" i], [class*="soldOut" i], [class*="cannotBuy" i]';
    if (card.querySelector(blockedPurchaseSelector)) return true;
    if (card.matches(unavailableSelector) || priceElement?.matches(unavailableSelector)) return true;
    if (/\b(?:cannot buy|can't buy|unavailable|sold out|purchase limit|buy limit)\b/i.test(String(card.textContent || ''))) return true;
    const purchaseControls = Array.from(card.querySelectorAll('button, [role="button"]')).filter((control) => (
      /\b(?:buy|purchase)\b/i.test(`${control.textContent || ''} ${control.getAttribute('aria-label') || ''} ${control.getAttribute('title') || ''}`)
    ));
    if (purchaseControls.length && !purchaseControls.some((control) => !control.disabled && control.getAttribute('aria-disabled') !== 'true')) return true;
    const cardStyle = getComputedStyle(card);
    const priceStyle = priceElement ? getComputedStyle(priceElement) : null;
    return bazaarCssColorLooksRed(cardStyle.backgroundColor)
      || bazaarCssColorLooksRed(cardStyle.borderColor)
      || bazaarCssColorLooksRed(priceStyle?.color)
      || bazaarCssColorLooksRed(priceStyle?.backgroundColor);
  }

  function bazaarListingCards() {
    const container = document.querySelector('[data-testid="bazaar-items"]');
    if (!container) return [];
    const direct = Array.from(container.querySelectorAll('[data-testid="item"]'));
    if (direct.length) return direct;
    return [...new Set(Array.from(container.querySelectorAll('img[src*="/images/items/"], img[srcset*="/images/items/"]'))
      .map((image) => image.closest('[class*="item___"]'))
      .filter(Boolean))];
  }

  function bazaarCardItemId(card) {
    const image = card?.querySelector?.('img[src*="/images/items/"], img[srcset*="/images/items/"]');
    const match = `${image?.getAttribute('src') || ''} ${image?.getAttribute('srcset') || ''}`.match(/\/images\/items\/(\d+)\//i);
    return match ? Math.trunc(Number(match[1])) : 0;
  }

  function bazaarCardStock(card) {
    const stockText = card?.querySelector?.('[data-testid="amount-value"]')?.textContent
      || String(card?.textContent || '').match(/([\d,]+)\s+in stock/i)?.[1]
      || '';
    const stock = Number(String(stockText).replace(/[^\d]/g, ''));
    return Number.isFinite(stock) && stock > 0 ? Math.trunc(stock) : 0;
  }

  function catalogItemById(itemId) {
    const id = Math.trunc(Number(itemId));
    return id > 0 ? state.itemCatalog.items.find((item) => item.id === id) || null : null;
  }

  function bazaarCardItemName(card) {
    return String(card?.querySelector?.('[data-testid="name"]')?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function catalogItemForBazaarCard(card) {
    return catalogItemById(bazaarCardItemId(card)) || catalogItemBySearch(bazaarCardItemName(card));
  }

  function itemCatalogHasSellPrices() {
    return state.itemCatalog.items.some((item) => Object.hasOwn(item, 'sellPrice'));
  }

  function requestBazaarSellPriceCatalog() {
    if ((itemCatalogFresh() && itemCatalogHasSellPrices()) || state.itemCatalogLoading || !state.settings.apiKey || !ownsDashboardNetworkLease()) return;
    if (Date.now() - Number(state.bazaarCatalogRequestedAt || 0) < 5 * 60_000) return;
    state.bazaarCatalogRequestedAt = Date.now();
    void loadItemCatalog({ force: true }).then(() => scheduleBazaarOneDollarFormatting(0));
  }

  function formatBazaarOneDollarListings() {
    if (!onBazaarPage()) {
      document.querySelectorAll('[data-tdd-bazaar-one-dollar]').forEach((card) => card.removeAttribute('data-tdd-bazaar-one-dollar'));
      document.querySelectorAll('[data-tdd-bazaar-shop-profit]').forEach((card) => card.removeAttribute('data-tdd-bazaar-shop-profit'));
      return;
    }
    ensureBazaarOneDollarStyles();
    requestBazaarSellPriceCatalog();
    const cards = new Set(bazaarListingCards());
    document.querySelectorAll('[data-tdd-bazaar-one-dollar]').forEach((card) => {
      if (!cards.has(card)) card.removeAttribute('data-tdd-bazaar-one-dollar');
    });
    document.querySelectorAll('[data-tdd-bazaar-shop-profit]').forEach((card) => {
      if (!cards.has(card)) card.removeAttribute('data-tdd-bazaar-shop-profit');
    });
    cards.forEach((card) => {
      const price = bazaarCardPrice(card);
      const available = !bazaarCardUnavailable(card);
      const sellPrice = Number(catalogItemForBazaarCard(card)?.sellPrice) || 0;
      const oneDollar = available && price === 1;
      const shopProfit = available && !oneDollar && price !== null && sellPrice > 0 && price < sellPrice;
      card.toggleAttribute('data-tdd-bazaar-one-dollar', oneDollar);
      card.toggleAttribute('data-tdd-bazaar-shop-profit', shopProfit);
    });
  }

  function bazaarPurchaseButton(control) {
    if (!control) return false;
    if (control.matches('[class*="controlPanelButton___"]')) return true;
    const label = `${control.textContent || ''} ${control.getAttribute('aria-label') || ''} ${control.getAttribute('title') || ''}`.trim();
    return /^(?:buy|purchase)\b/i.test(label);
  }

  function bazaarPurchaseQuantityInput(pending) {
    const itemId = Number(pending?.itemId) || 0;
    const currentCard = pending?.card?.isConnected
      ? pending.card
      : bazaarListingCards().find((card) => bazaarCardItemId(card) === itemId);
    const roots = [currentCard];
    document.querySelectorAll('[class*="buyMenu__"], [class*="buyForm___"], [role="dialog"], [aria-modal="true"], [class*="modal" i], [class*="dialog" i], [class*="confirm" i]').forEach((root) => {
      if (elementVisible(root)) roots.push(root);
    });
    const active = document.activeElement;
    if (active?.matches?.('[class*="buyAmountInput_"], input[type="number"], input[inputmode="numeric"]') && !active.disabled && !active.readOnly) return active;
    for (const root of roots.filter(Boolean)) {
      const inputs = Array.from(root.querySelectorAll('[class*="buyAmountInput_"], input[type="number"], input[inputmode="numeric"], input[pattern*="0-9"]'))
        .filter((input) => !input.disabled && !input.readOnly && elementVisible(input));
      const labelled = inputs.find((input) => /\b(?:amount|quantity|qty|buy)\b/i.test(`${input.name || ''} ${input.id || ''} ${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`));
      if (labelled || inputs.length === 1) return labelled || inputs[0];
    }
    return null;
  }

  function fillBazaarPurchaseMaximum(pending) {
    if (!pending || state.pendingBazaarPurchase !== pending || Date.now() - pending.clickedAt > 2_000) return false;
    const input = bazaarPurchaseQuantityInput(pending);
    if (!input) return false;
    const declaredMax = Number(input.max || input.getAttribute('aria-valuemax') || input.dataset.max);
    const moneyText = document.querySelector('#user-money')?.dataset?.money;
    const normalizedMoney = String(moneyText ?? '').replace(/[^\d.-]/g, '');
    const money = normalizedMoney ? Number(normalizedMoney) : null;
    const affordable = Number(pending.price) > 0 && Number.isFinite(money) ? Math.floor(money / Number(pending.price)) : null;
    if (affordable !== null && affordable < 1) return false;
    const candidates = [Number(pending.stock), declaredMax, affordable, 10_000].filter((value) => Number.isFinite(value) && value > 0);
    if (!candidates.length) return false;
    const maximum = Math.max(1, Math.trunc(Math.min(...candidates)));
    if (Number(input.value) !== maximum) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(input, String(maximum));
      else input.value = String(maximum);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  function handleBazaarPurchaseClick(event) {
    if (!onBazaarPage()) return;
    const control = event.target?.closest?.('button, [role="button"]');
    if (!bazaarPurchaseButton(control)) return;
    const card = bazaarListingCards().find((candidate) => candidate.contains(control));
    if (!card || bazaarCardUnavailable(card)) return;
    const pending = {
      card,
      itemId: bazaarCardItemId(card),
      price: bazaarCardPrice(card),
      stock: bazaarCardStock(card),
      clickedAt: Date.now(),
    };
    state.pendingBazaarPurchase = pending;
    [0, 60, 180, 420, 900, 1_500].forEach((delay) => window.setTimeout(() => {
      fillBazaarPurchaseMaximum(pending);
      if (delay === 1_500 && state.pendingBazaarPurchase === pending) state.pendingBazaarPurchase = null;
    }, delay));
  }

  function scheduleBazaarOneDollarFormatting(delay = 80) {
    if (state.bazaarOneDollarTimer) window.clearTimeout(state.bazaarOneDollarTimer);
    state.bazaarOneDollarTimer = window.setTimeout(() => {
      state.bazaarOneDollarTimer = null;
      formatBazaarOneDollarListings();
    }, delay);
  }

  function weav3rBazaars(itemId) {
    return new Promise((resolve, reject) => {
      if (!ownsDashboardNetworkLease()) {
        reject(dashboardOwnerPauseError());
        return;
      }
      const url = `https://weav3r.dev/item/${encodeURIComponent(Math.trunc(Number(itemId)))}`;
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { Accept: 'text/html' },
        timeout: 20_000,
        onload(response) {
          if (!ownsDashboardNetworkLease()) {
            reject(dashboardOwnerPauseError('Response ignored because another Torn tab now owns ADHD Dashboard polling.'));
            return;
          }
          if (response.status === 429) {
            const retryAfter = String(response.responseHeaders || '').match(/^retry-after:\s*(\d+)/im);
            const error = new Error('TornW3B rate limit reached (429). Bazaar polling is temporarily backed off.');
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
              const lastUpdatedAt = freshnessBySeller.get(sellerId) || null;
              return {
                sellerId,
                sellerName,
                quantity: Number.isFinite(quantity) ? quantity : 0,
                price,
                href: highlightedBazaarHref(sellerId, itemId, price, lastUpdatedAt),
                lastUpdatedAt,
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

  function externalTimestampMs(value) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizedDollarBazaar(row) {
    const source = row?.bazaar && typeof row.bazaar === 'object' ? { ...row, ...row.bazaar } : row;
    const player = source?.player && typeof source.player === 'object' ? source.player : {};
    const playerId = Math.trunc(Number(
      source?.player_id ?? source?.playerId ?? source?.user_id ?? source?.userId
      ?? source?.seller_id ?? source?.sellerId ?? player?.id ?? source?.id
    ));
    if (!(playerId > 0)) return null;
    return {
      playerId,
      playerName: String(
        source?.player_name ?? source?.playerName ?? source?.user_name ?? source?.userName
        ?? source?.seller_name ?? source?.sellerName ?? player?.name ?? `Player ${playerId}`
      ).trim() || `Player ${playerId}`,
      itemCount: Math.max(0, Math.trunc(Number(
        source?.item_count ?? source?.itemCount ?? source?.items_count ?? source?.itemsCount
        ?? source?.total_items ?? source?.totalItems ?? source?.quantity ?? source?.count
        ?? (Array.isArray(source?.items) ? source.items.length : 0)
      ) || 0)),
      totalValue: Math.max(0, Math.trunc(Number(
        source?.total_value ?? source?.totalValue ?? source?.market_value ?? source?.marketValue
        ?? source?.total_market_value ?? source?.totalMarketValue ?? source?.value
      ) || 0)),
      updatedAt: externalTimestampMs(
        source?.updated_at ?? source?.updatedAt ?? source?.last_checked ?? source?.lastChecked
        ?? source?.content_updated ?? source?.contentUpdated
      ),
    };
  }

  function dollarBazaarRows(body) {
    const candidates = [
      body,
      body?.bazaars,
      body?.results,
      body?.items,
      body?.data,
      body?.data?.bazaars,
      body?.data?.results,
      body?.data?.items,
    ];
    const rows = candidates.find(Array.isArray) || [];
    const unique = new Map();
    rows.map(normalizedDollarBazaar).filter(Boolean).forEach((row) => {
      const current = unique.get(row.playerId);
      if (!current || row.totalValue > current.totalValue || row.updatedAt > current.updatedAt) unique.set(row.playerId, row);
    });
    return [...unique.values()]
      .sort((left, right) => right.totalValue - left.totalValue || right.itemCount - left.itemCount || left.playerName.localeCompare(right.playerName))
      .slice(0, DOLLAR_BAZAAR_LIMIT);
  }

  async function refreshDollarBazaars({ force = false } = {}) {
    if (state.dollarBazaarLoading) return false;
    dashboardNetworkLease?.refresh();
    if (!ownsDashboardNetworkLease()) {
      state.dollarBazaarError = 'Another Torn tab owns Dashboard network requests. Keep this tab visible and try again.';
      render();
      return false;
    }
    const now = Date.now();
    if (!force && Number(state.dollarBazaarCache.fetchedAt) > now - DOLLAR_BAZAAR_CACHE_MAX_AGE_MS) {
      state.dollarBazaarError = '';
      render();
      return true;
    }
    if (now < state.dollarBazaarBackoffUntil) {
      state.dollarBazaarError = `TornW3B is rate-limited. Try again in ${formatDuration(Math.ceil((state.dollarBazaarBackoffUntil - now) / 1000))}.`;
      render();
      return false;
    }
    state.dollarBazaarLoading = true;
    state.dollarBazaarError = '';
    render();
    const sourceUrl = `https://weav3r.dev/api/dollar-bazaars/bazaars?page=1&limit=${DOLLAR_BAZAAR_LIMIT}`;
    try {
      state.bazaarCalls += 1;
      const body = await TornLib.requestJson(sourceUrl, {
        headers: { Accept: 'application/json' },
        timeout: 20_000,
        invalidJsonMessage: 'TornW3B returned an unreadable $1 Bazaar response.',
        networkErrorMessage: 'Could not reach TornW3B for $1 Bazaars.',
        timeoutMessage: 'The TornW3B $1 Bazaar request timed out.',
      });
      if (!ownsDashboardNetworkLease()) throw dashboardOwnerPauseError('The $1 Bazaar response was ignored because another Torn tab became Dashboard owner.');
      const bazaars = dollarBazaarRows(body);
      state.dollarBazaarCache = {
        fetchedAt: Date.now(),
        sourceUrl: 'https://weav3r.dev/dollar-bazaars?tab=bazaars',
        bazaars,
      };
      GM_setValue(DOLLAR_BAZAAR_CACHE_KEY, state.dollarBazaarCache);
      state.dollarBazaarBackoffUntil = 0;
      return true;
    } catch (error) {
      if (Number(error?.status) === 429) state.dollarBazaarBackoffUntil = Date.now() + 60_000;
      state.dollarBazaarError = isDashboardOwnerPause(error)
        ? error.message
        : error?.message || 'Could not load TornW3B $1 Bazaars.';
      return false;
    } finally {
      state.dollarBazaarLoading = false;
      render();
    }
  }

  function dailyRefreshMs() {
    const normal = Math.max(5, Number(state.settings.apiDailyRefreshMinutes) || 10) * 60_000;
    return state.settings.slowApiMode ? normal * 3 : normal;
  }

  function nextTornResetAtMs(now = Date.now()) {
    const date = new Date(now);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) + TORN_RESET_SETTLE_MS;
  }

  function apiCheckDueAt(key, lastUpdated, fallbackMs, now = Date.now(), { honorScheduled = false } = {}) {
    const scheduled = Number(state.nextApiChecks?.[key]) || 0;
    const fallbackAt = (Number(lastUpdated) || 0) + Math.max(1_000, Number(fallbackMs) || 0);
    if (honorScheduled && scheduled > 0) return now >= scheduled;
    return now >= (scheduled > 0 ? Math.min(scheduled, fallbackAt) : fallbackAt);
  }

  function dailyStatusCheckDue(key, statusKnown, lastUpdated, fallbackMs, now = Date.now()) {
    if (!statusKnown) {
      const retryAt = (Number(lastUpdated) || 0) + Math.max(1_000, Number(fallbackMs) || 0);
      return now >= retryAt;
    }
    return apiCheckDueAt(key, lastUpdated, fallbackMs, now, { honorScheduled: true });
  }

  function deferApiCheck(key, nextAt) {
    state.nextApiChecks ||= {};
    const value = Number(nextAt);
    state.nextApiChecks[key] = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
  }

  function barNextApiCheckAt(bar, fetchedAt, fallbackMs) {
    const current = Number(bar?.current);
    const maximum = Number(bar?.maximum);
    const fullTime = Number(bar?.full_time);
    if (Number.isFinite(current) && Number.isFinite(maximum) && current < maximum && Number.isFinite(fullTime) && fullTime > 0) {
      const transitionAt = fullTime > 7 * 24 * 60 * 60
        ? fullTime * 1000
        : fetchedAt + fullTime * 1000;
      if (transitionAt > fetchedAt) return transitionAt + API_TRANSITION_SETTLE_MS;
    }
    return fetchedAt + fallbackMs;
  }

  function normalizedCooldownSeconds(value) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.max(0, Math.trunc(seconds)) : null;
  }

  function cooldownThresholdSeconds(type) {
    const configured = Number(type === 'medical' ? state.settings.medicalThresholdHours : state.settings.boosterThresholdHours);
    if (type === 'medical') return (Number.isFinite(configured) && configured >= 1 ? configured : 3) * 3600;
    if (type === 'booster') return (Number.isFinite(configured) && configured >= 0 ? configured : 3) * 3600;
    return 0;
  }

  function cooldownNextApiCheckAt(type, seconds, fetchedAt) {
    const remaining = normalizedCooldownSeconds(seconds);
    const fallbackAt = fetchedAt + COOLDOWN_REFRESH_MS;
    if (remaining === null || remaining === 0) return fallbackAt;
    const threshold = cooldownThresholdSeconds(type);
    const nextTransitionSeconds = remaining > threshold ? remaining - threshold : remaining;
    return Math.min(fallbackAt, fetchedAt + nextTransitionSeconds * 1000 + API_TRANSITION_SETTLE_MS);
  }

  function educationNextApiCheckAt(education, fetchedAt) {
    const until = Number(education?.current?.until) * 1000;
    if (until > fetchedAt) return until + API_TRANSITION_SETTLE_MS;
    return fetchedAt + EDUCATION_OC_REFRESH_MS;
  }

  function organizedCrimeNextApiCheckAt(organizedCrime, fetchedAt) {
    if (!organizedCrime || typeof organizedCrime !== 'object' || Number(organizedCrime.code) > 0) {
      return fetchedAt + EDUCATION_OC_REFRESH_MS;
    }
    const readyAt = Number(organizedCrime.ready_at) * 1000;
    if (readyAt > fetchedAt) return readyAt + API_TRANSITION_SETTLE_MS;
    return fetchedAt + EDUCATION_OC_REFRESH_MS;
  }

  function enabledRefillsComplete() {
    const refills = state.data.refills?.refills;
    const statuses = [];
    if (alertCheckDue('energyRefill')) statuses.push(refillUsedStatus(refills, 'energy'));
    if (alertCheckDue('nerveRefill')) statuses.push(refillUsedStatus(refills, 'nerve'));
    return statuses.length > 0 && statuses.every((used) => used === true);
  }

  function enabledRefillStatusKnown() {
    const refills = state.data.refills?.refills;
    const statuses = [];
    if (alertCheckDue('energyRefill')) statuses.push(refillUsedStatus(refills, 'energy'));
    if (alertCheckDue('nerveRefill')) statuses.push(refillUsedStatus(refills, 'nerve'));
    return statuses.length > 0 && statuses.every((used) => used !== null);
  }

  function casinoTokenCount(body = state.data.casino) {
    const value = body?.casino?.tokens;
    if (value === null || value === undefined || value === '') return null;
    return Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : null;
  }

  function countdownRemainingSeconds(seconds, fetchedAt) {
    const initial = normalizedCooldownSeconds(seconds);
    if (initial === null) return null;
    const elapsed = Number(fetchedAt) > 0 ? Math.max(0, (Date.now() - Number(fetchedAt)) / 1000) : 0;
    return Math.max(0, Math.ceil(initial - elapsed));
  }

  function apiCooldownRemaining(type) {
    return countdownRemainingSeconds(state.data.cooldowns?.cooldowns?.[type], state.data.cooldowns?.__fetchedAt);
  }

  function resolvedCooldownRemaining(type) {
    const domRemaining = normalizedCooldownSeconds(state.dom.cooldowns?.[type]);
    const apiRemaining = apiCooldownRemaining(type);
    const domFresh = state.dom.source === 'live-page' && Date.now() - Number(state.dom.capturedAt || 0) < 30_000;
    // The focused page updates immediately when an item is used and can cross a
    // configured alert threshold before the shared API cache refreshes. The DOM
    // parser is label-scoped, so a fresh value is safer than an older API value
    // in either direction.
    if (domFresh && domRemaining !== null) return domRemaining;
    return apiRemaining ?? domRemaining;
  }

  function resolvedCooldowns() {
    return {
      drug: resolvedCooldownRemaining('drug'),
      medical: resolvedCooldownRemaining('medical'),
      booster: resolvedCooldownRemaining('booster'),
    };
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

  function clusterFallbackRefreshMs() {
    return state.settings.slowApiMode ? 5 * 60_000 : CORE_REFRESH_MS;
  }

  function marketRefreshMs(marketType = 'points') {
    if (state.settings.marketRefreshMode === 'cache-aligned') {
      return marketType === 'item' ? ITEM_MARKET_FALLBACK_REFRESH_MS : POINTS_MARKET_REFRESH_MS;
    }
    return Math.max(1, Number(state.settings.marketRefreshMinutes) || 2) * 60_000;
  }

  function normalizedMarketPriority(value) {
    return Object.hasOwn(MARKET_PRIORITY_CYCLES, value) ? value : 'normal';
  }

  function marketPriorityRank(value) {
    return { high: 0, normal: 1, low: 2 }[normalizedMarketPriority(value)];
  }

  function itemMarketCheapestPrice(result) {
    const prices = (Array.isArray(result?.itemmarket?.listings) ? result.itemmarket.listings : [])
      .map((listing) => Number(listing?.price))
      .filter((price) => Number.isFinite(price) && price > 0);
    return prices.length ? Math.min(...prices) : null;
  }

  function watchMarketPriority(watch, result = null) {
    if (watchMarketType(watch) !== 'item') return 'normal';
    const cheapest = itemMarketCheapestPrice(result);
    const threshold = Number(watch?.maxPrice);
    if (cheapest !== null && threshold > 0 && cheapest <= threshold) return 'high';
    return normalizedMarketPriority(watch?.priority);
  }

  function groupMarketPriority(watches, result = null) {
    return (Array.isArray(watches) ? watches : []).reduce((best, watch) => {
      const priority = watchMarketPriority(watch, result);
      return marketPriorityRank(priority) < marketPriorityRank(best) ? priority : best;
    }, 'low');
  }

  function itemMarketCacheTimestamp(result) {
    const timestamp = Number(result?.itemmarket?.cache_timestamp);
    return Number.isFinite(timestamp) && timestamp > 0 ? Math.trunc(timestamp) : 0;
  }

  function itemMarketCacheDelayMs(result) {
    const delaySeconds = Number(result?.itemmarket?.cache_delay);
    return Number.isFinite(delaySeconds) && delaySeconds >= 0 ? Math.ceil(delaySeconds * 1_000) : null;
  }

  function itemMarketCacheBoundaryAt(result) {
    const timestamp = itemMarketCacheTimestamp(result);
    const delayMs = itemMarketCacheDelayMs(result);
    if (!timestamp || delayMs === null) return 0;
    return timestamp * 1_000 + delayMs + ITEM_MARKET_CACHE_SAFETY_MS;
  }

  function itemMarketStaleRetryMs(result) {
    const retryCount = Math.max(1, Math.trunc(Number(result?.__cacheRetryCount) || 1));
    return Math.min(ITEM_MARKET_STALE_RETRY_MAX_MS, ITEM_MARKET_STALE_RETRY_MIN_MS + (retryCount - 1) * 1_000);
  }

  function itemMarketNextCheckAt(result, priority = 'normal') {
    const stored = Number(result?.__nextCheckAt) || 0;
    if (stored > 0) return stored;
    const fetchedAt = Number(result?.__fetchedAt) || 0;
    if (!fetchedAt) return 0;
    const cycles = MARKET_PRIORITY_CYCLES[normalizedMarketPriority(priority)];
    if (state.settings.marketRefreshMode !== 'cache-aligned') {
      return fetchedAt + marketRefreshMs('item') * cycles;
    }
    const cacheBoundaryAt = itemMarketCacheBoundaryAt(result);
    return cacheBoundaryAt > 0
      ? Math.max(cacheBoundaryAt, fetchedAt + ITEM_MARKET_CACHE_SAFETY_MS)
      : fetchedAt + ITEM_MARKET_FALLBACK_REFRESH_MS;
  }

  function weav3rRefreshMsForPriority(priority = 'normal') {
    return WEAV3R_PRIORITY_REFRESH_MS[normalizedMarketPriority(priority)];
  }

  function watchMarketType(watch) {
    return watch?.marketType === 'points' ? 'points' : 'item';
  }

  function activeMarketWatches() {
    return state.settings.marketWatches.filter((watch) => {
      if (watch.enabled === false || Number(watch.maxPrice) <= 0) return false;
      return watchMarketType(watch) === 'points' || Number(watch.itemId) > 0;
    });
  }

  function activeBazaarWatches() {
    return activeMarketWatches().filter((watch) => watchMarketType(watch) === 'item');
  }

  function pointsMarketListings(result) {
    const source = result?.pointsmarket?.listings ?? result?.pointsmarket ?? result?.listings ?? [];
    const rows = Array.isArray(source) ? source : Object.values(source || {});
    return rows.map((listing) => {
      const price = Number(listing?.cost ?? listing?.price ?? listing?.price_per_point ?? listing?.pricePerPoint);
      const amount = Number(listing?.quantity ?? listing?.amount ?? listing?.points);
      if (!Number.isFinite(price) || price <= 0) return null;
      return {
        price,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
      };
    }).filter(Boolean);
  }

  function marketResultSignature(result, marketType = 'item') {
    if (marketType === 'points') {
      return JSON.stringify(pointsMarketListings(result).map((listing) => [listing.price, listing.amount]));
    }
    const market = result?.itemmarket;
    return JSON.stringify({
      cacheTimestamp: Number(market?.cache_timestamp) || 0,
      listings: (market?.listings || []).map((listing) => [Number(listing?.price) || 0, Number(listing?.amount) || 0]),
    });
  }

  function marketResultNextCheckAt(result, marketType = 'item', priority = 'normal') {
    if (marketType === 'item') return itemMarketNextCheckAt(result, priority);
    const stored = Number(result?.__nextCheckAt) || 0;
    if (stored > 0) return stored;
    return (Number(result?.__fetchedAt) || 0) + marketRefreshMs(marketType);
  }

  async function refreshMarketWatches({ force = false } = {}) {
    const watches = activeMarketWatches();
    if (state.marketPolling || !ownsDashboardNetworkLease() || state.settings.enabled.itemMarket === false || !watches.length) return false;
    const now = Date.now();
    const groups = new Map();
    watches.forEach((watch) => {
      const marketType = watchMarketType(watch);
      const itemId = Math.trunc(Number(watch.itemId));
      const key = marketType === 'points' ? 'points' : `item:${itemId}`;
      if (!groups.has(key)) groups.set(key, { marketType, itemId, watches: [] });
      groups.get(key).watches.push(watch);
    });
    const dueGroups = [...groups.values()].map((group) => {
      const previous = state.data.market?.[group.watches[0].uid];
      group.priority = group.marketType === 'item' ? groupMarketPriority(group.watches, previous) : 'normal';
      group.nextCheckAt = marketResultNextCheckAt(previous, group.marketType, group.priority);
      return group;
    }).filter((group) => {
      if (Number(state.settings.apiPausedUntil) > now || Number(state.apiLimiterUntil) > now) return false;
      if (force) return true;
      const previous = state.data.market?.[group.watches[0].uid];
      return !previous || now >= Math.max(state.marketRetryAt, group.nextCheckAt);
    }).sort((left, right) => (
      ((left.marketType === 'item' ? 0 : 1) - (right.marketType === 'item' ? 0 : 1))
      || (marketPriorityRank(left.priority) - marketPriorityRank(right.priority))
      || (left.nextCheckAt - right.nextCheckAt)
    ));
    if (!dueGroups.length) {
      if (!state.readyAlertGroups.has('market') && state.data.market) publishAlertGroups(['market']);
      return false;
    }
    state.marketPolling = true;
    let changed = false;
    let allOkay = true;
    try {
      for (let index = 0; index < dueGroups.length; index += 5) {
        const batch = dueGroups.slice(index, index + 5);
        await Promise.all(batch.map(async (group) => {
          const previous = state.data.market?.[group.watches[0].uid];
          const errorKey = group.marketType === 'points' ? 'market-points' : `market-item:${group.itemId}`;
          try {
            const body = group.marketType === 'points'
              ? await api('market', { selections: 'pointsmarket', limit: 100 }, { priority: 'high', waitForQuota: false, maxWaitMs: 0 })
              : await api(`market/${group.itemId}/itemmarket`, { limit: ITEM_MARKET_LISTING_LIMIT }, { priority: group.priority, quotaClass: 'itemmarket', waitForQuota: false, maxWaitMs: 0 });
            const fetchedAt = Date.now();
            body.__fetchedAt = fetchedAt;
            body.__marketType = group.marketType;
            const previousCacheTimestamp = group.marketType === 'item' ? itemMarketCacheTimestamp(previous) : 0;
            const responseCacheTimestamp = group.marketType === 'item' ? itemMarketCacheTimestamp(body) : 0;
            const cacheDidNotAdvance = state.settings.marketRefreshMode === 'cache-aligned'
              && previousCacheTimestamp > 0
              && responseCacheTimestamp === previousCacheTimestamp;
            if (cacheDidNotAdvance) {
              const retained = previous && typeof previous === 'object' ? previous : body;
              retained.__fetchedAt = fetchedAt;
              retained.__cacheRetryCount = Math.min(4, Math.max(0, Math.trunc(Number(retained.__cacheRetryCount) || 0)) + 1);
              retained.__nextCheckAt = fetchedAt + itemMarketStaleRetryMs(retained);
              retained.__lastCacheAttemptAt = fetchedAt;
              state.data.market ||= {};
              group.watches.forEach((watch) => { state.data.market[watch.uid] = retained; });
              delete state.errors[errorKey];
              return;
            }
            const nextPriority = group.marketType === 'item' ? groupMarketPriority(group.watches, body) : 'normal';
            if (group.marketType === 'item') body.__cacheRetryCount = 0;
            body.__nextCheckAt = group.marketType === 'item'
              ? itemMarketNextCheckAt(body, nextPriority)
              : fetchedAt + marketRefreshMs(group.marketType);
            if (marketResultSignature(previous, group.marketType) !== marketResultSignature(body, group.marketType)) changed = true;
            state.data.market ||= {};
            group.watches.forEach((watch) => { state.data.market[watch.uid] = body; });
            delete state.errors[errorKey];
          } catch (error) {
            if (isDashboardOwnerPause(error)) return;
            allOkay = false;
            state.errors[errorKey] = error?.message || (group.marketType === 'points' ? 'Torn Points Market check failed.' : 'Torn Item Market check failed.');
          }
        }));
        if (index + 5 < dueGroups.length) await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      state.lastMarketUpdated = Date.now();
      state.marketRetryAt = allOkay ? 0 : Math.max(Date.now() + 5_000, Number(state.apiLimiterUntil) || 0);
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
      const dueTimes = watches.map((watch) => {
        const marketType = watchMarketType(watch);
        const result = state.data.market?.[watch.uid];
        const nextCheckAt = marketResultNextCheckAt(result, marketType, watchMarketPriority(watch, result));
        return Math.max(nextCheckAt, Number(state.settings.apiPausedUntil) || 0, Number(state.apiLimiterUntil) || 0);
      }).filter((value) => value > 0);
      const nextDue = dueTimes.length ? Math.min(...dueTimes) : Date.now() + marketRefreshMs('points');
      const blockedUntil = state.marketRetryAt;
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

  function bazaarWatchNextCheckAt(watch) {
    const itemId = Math.trunc(Number(watch?.itemId));
    const fetchedAt = Number(state.bazaarCache[itemId]?.fetchedAt) || 0;
    if (!fetchedAt) return 0;
    const marketResult = state.data.market?.[watch.uid];
    return fetchedAt + weav3rRefreshMsForPriority(watchMarketPriority(watch, marketResult));
  }

  async function refreshBazaarWatches({ force = false } = {}) {
    const watches = activeBazaarWatches();
    if (state.bazaarPolling || !ownsDashboardNetworkLease() || !state.settings.weav3rBazaarEnabled
      || state.settings.enabled.itemMarket === false || !watches.length) return false;
    const now = Date.now();
    if (!force && now < state.bazaarBackoffUntil) {
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
    const groups = new Map();
    watches.forEach((watch) => {
      const itemId = Math.trunc(Number(watch.itemId));
      if (!groups.has(itemId)) groups.set(itemId, []);
      groups.get(itemId).push(watch);
    });
    const dueGroups = [...groups.entries()].map(([itemId, itemWatches]) => {
      const marketResult = state.data.market?.[itemWatches[0].uid];
      const priority = groupMarketPriority(itemWatches, marketResult);
      const fetchedAt = Number(state.bazaarCache[itemId]?.fetchedAt) || 0;
      return { itemId, itemWatches, priority, nextCheckAt: fetchedAt ? fetchedAt + weav3rRefreshMsForPriority(priority) : 0 };
    }).filter((group) => force || !group.nextCheckAt || now >= group.nextCheckAt)
      .sort((left, right) => marketPriorityRank(left.priority) - marketPriorityRank(right.priority) || left.nextCheckAt - right.nextCheckAt);
    if (!dueGroups.length) {
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
    let changed = false;
    let allOkay = true;
    let rateLimited = false;
    try {
      for (let index = 0; index < dueGroups.length; index += 4) {
        const batch = dueGroups.slice(index, index + 4);
        await Promise.all(batch.map(async ({ itemId, itemWatches }) => {
          try {
            const result = await weav3rBazaars(itemId);
            const previous = state.bazaarCache[itemId];
            if (bazaarResultSignature(previous) !== bazaarResultSignature(result)) changed = true;
            state.data.bazaars ||= {};
            itemWatches.forEach((watch) => { state.data.bazaars[watch.uid] = result; });
            state.bazaarCache[itemId] = result;
            delete state.errors[`bazaar-item:${itemId}`];
          } catch (error) {
            if (isDashboardOwnerPause(error)) return;
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
        if (rateLimited) break;
        if (index + 4 < dueGroups.length) await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      state.lastBazaarUpdated = Date.now();
      if (allOkay) {
        state.bazaarRateLimitStrikes = 0;
        state.bazaarBackoffUntil = 0;
      } else if (!rateLimited) {
        state.bazaarBackoffUntil = Date.now() + 30_000;
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
      const watches = activeBazaarWatches();
      const dueTimes = watches.map(bazaarWatchNextCheckAt).filter((value) => value > 0);
      const nextDue = dueTimes.length ? Math.min(...dueTimes) : Date.now() + weav3rRefreshMsForPriority('normal');
      const backoffDelay = Math.max(0, state.bazaarBackoffUntil - Date.now());
      scheduleBazaarPoll(Math.max(1_000, backoffDelay, nextDue - Date.now()));
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
    watch.pawnSellPrice = item.sellPrice;
    watch.vendorName = item.vendorName;
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
    if (state.itemCatalogLoading || !ownsDashboardNetworkLease() || (!force && itemCatalogFresh())) return;
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
          buyPrice: Math.max(0, Math.trunc(Number(item.value?.buy_price) || 0)),
          sellPrice: Math.max(0, Math.trunc(Number(item.value?.sell_price) || 0)),
          vendorName: String(item.value?.vendor?.name || ''),
          vendorCountry: String(item.value?.vendor?.country || ''),
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
      if (isDashboardOwnerPause(error)) return;
      state.errors.itemCatalog = error?.message || 'Could not load the Torn item catalog.';
    } finally {
      state.itemCatalogLoading = false;
      render();
    }
  }

  function pawnShopWatchCapacity() {
    return Math.max(0, MARKET_WATCH_LIMIT - state.settings.marketWatches.length);
  }

  function pawnShopThreshold(sellPrice) {
    const margin = Math.min(99, Math.max(0, Number(state.settings.pawnShopMarginPercent) || 0));
    return Math.max(1, Math.floor(Number(sellPrice) * (1 - margin / 100)));
  }

  async function loadPawnShopCandidates({ force = false } = {}) {
    if (state.pawnShopCandidatesLoading) return;
    state.pawnShopCandidatesLoading = true;
    state.pawnShopStatus = '';
    delete state.errors.pawnShopBuilder;
    render();
    try {
      const catalogHasSellPrices = state.itemCatalog.items.some((item) => Object.hasOwn(item, 'sellPrice'));
      if (force || !catalogHasSellPrices || !itemCatalogFresh()) await loadItemCatalog({ force: true });
      if (!state.itemCatalog.items.length) throw new Error('Load the Torn item catalog first.');
      const tornCandidates = state.itemCatalog.items
        .filter((item) => TRAVEL_CONTRABAND_NAMES.has(item.name) && Number(item.sellPrice) > 0);
      let weav3rItems = [];
      if (state.settings.weav3rBazaarEnabled) {
        try {
          const categories = [...new Set(tornCandidates.map((item) => item.type))];
          for (const category of categories) {
            weav3rItems.push(...await loadWeav3rCategoryStats(category, { force }));
          }
        } catch (error) {
          state.errors.pawnShopTornW3B = error?.message || 'TornW3B category enrichment failed.';
        }
      }
      const weav3rById = new Map(weav3rItems.map((item) => [item.id, item]));
      state.pawnShopCandidates = tornCandidates
        .map((item) => ({ ...item, ...(weav3rById.get(item.id) || {}), sellPrice: item.sellPrice, buyPrice: item.buyPrice, vendorName: item.vendorName, vendorCountry: item.vendorCountry }))
        .sort((left, right) => Number(right.sellPrice) - Number(left.sellPrice) || left.name.localeCompare(right.name));
      state.pawnShopCandidatesLoadedAt = Date.now();
      const validIds = new Set(state.pawnShopCandidates.map((item) => item.id));
      state.pawnShopCandidateSelection = new Set([...state.pawnShopCandidateSelection].filter((id) => validIds.has(id)));
      state.pawnShopStatus = `${state.pawnShopCandidates.length} official travel-contraband items currently have a Torn city-shop sell-back value${state.settings.weav3rBazaarEnabled ? `; ${state.pawnShopCandidates.filter((item) => weav3rById.has(item.id)).length} enriched by TornW3B` : ''}.`;
    } catch (error) {
      if (!isDashboardOwnerPause(error)) state.errors.pawnShopBuilder = error?.message || 'Could not build Pawn Shop candidates.';
    } finally {
      state.pawnShopCandidatesLoading = false;
      render();
    }
  }

  function selectTopPawnShopCandidates() {
    const tracked = new Set(state.settings.marketWatches.filter((watch) => watchMarketType(watch) === 'item').map((watch) => Math.trunc(Number(watch.itemId))));
    const capacity = pawnShopWatchCapacity();
    state.pawnShopCandidateSelection = new Set(state.pawnShopCandidates.filter((item) => !tracked.has(item.id)).slice(0, capacity).map((item) => item.id));
    state.pawnShopStatus = `${state.pawnShopCandidateSelection.size} candidate${state.pawnShopCandidateSelection.size === 1 ? '' : 's'} selected.`;
  }

  function addSelectedPawnShopWatches() {
    const tracked = new Set(state.settings.marketWatches.filter((watch) => watchMarketType(watch) === 'item').map((watch) => Math.trunc(Number(watch.itemId))));
    const selected = state.pawnShopCandidates.filter((item) => state.pawnShopCandidateSelection.has(item.id) && !tracked.has(item.id));
    const addable = selected.slice(0, pawnShopWatchCapacity());
    const priority = normalizedMarketPriority(state.settings.pawnShopPriority);
    addable.forEach((item, index) => {
      const uid = `${Date.now() + index}-${Math.random().toString(36).slice(2, 7)}`;
      state.settings.marketWatches.push({
        uid,
        marketType: 'item',
        itemId: item.id,
        label: item.name,
        searchText: item.name,
        maxPrice: pawnShopThreshold(item.sellPrice),
        priority,
        catalogType: item.type,
        marketEstimate: item.marketPrice,
        pawnSellPrice: item.sellPrice,
        pawnShopCategory: 'Travel Contraband',
        enabled: true,
      });
      state.settings.enabled[`market:${uid}`] = true;
    });
    state.pawnShopCandidateSelection = new Set();
    state.pawnShopStatus = addable.length
      ? `Added ${addable.length} Pawn Shop watch${addable.length === 1 ? '' : 'es'} at ${Number(state.settings.pawnShopMarginPercent) || 0}% minimum margin.`
      : 'No new candidates were added.';
    state.lastMarketUpdated = 0;
    state.lastBazaarUpdated = 0;
    scheduleMarketPoll(0);
    scheduleBazaarPoll(0);
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
    state.lastCasinoUpdated = 0;
    delete state.data.cityItemsNow;
    delete state.data.cityItemsAtReset;
    delete state.data.refills;
    delete state.data.casino;
    ['refills', 'cityItems', 'casinoTokens', 'playerAddiction'].forEach((key) => delete state.nextApiChecks[key]);
    invalidateAlertGroups(['cityItem', 'refills', 'casinoTokens']);
    ['cityItem', 'stockBenefits', 'energyRefill', 'nerveRefill', 'casinoTokens'].forEach((id) => delete state.settings.alarmHistory[id]);
    saveSettings();
    return true;
  }


  function elementVisible(element) {
    return TornLib.elementVisible(element);
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
      #tdd-pickpocket-filter { position: relative; z-index: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 7px; width: 100%; margin: 0 0 10px; padding: 8px 10px; border: 1px solid rgba(255,255,255,.14); border-radius: 7px; color: #ddd; background: rgba(22,25,28,.96); font: 600 12px/1.2 system-ui,sans-serif; pointer-events: none; box-sizing: border-box; }
      #tdd-pickpocket-filter strong { margin-right: 2px; color: #f1f1f1; }
      #tdd-pickpocket-filter label { display: inline-flex; align-items: center; gap: 4px; pointer-events: auto; }
      #tdd-pickpocket-filter input { width: 58px; padding: 3px 4px; border: 1px solid rgba(255,255,255,.18); border-radius: 5px; color: #fff; background: #15181b; }
      #tdd-pickpocket-filter button { padding: 4px 7px; border: 1px solid rgba(255,255,255,.18); border-radius: 5px; color: #fff; background: #363c43; cursor: pointer; pointer-events: auto; }
      #tdd-pickpocket-filter [data-tdd-pickpocket-visible-count] { margin-left: auto; color: #aeb8c1; font-size: 11px; }
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
    document.getElementById('tdd-pickpocket-filter')?.remove();
    state.pickpocketFormattedCount = 0;
  }

  function normalizedPickpocketLevel(value, fallback) {
    return Math.min(300, Math.max(1, Math.trunc(Number(value) || fallback)));
  }

  function updatePickpocketRange(minimum, maximum) {
    const min = normalizedPickpocketLevel(minimum, 1);
    const max = normalizedPickpocketLevel(maximum, 300);
    state.settings.pickpocketMinTargetLevel = Math.min(min, max);
    state.settings.pickpocketMaxTargetLevel = Math.max(min, max);
    saveSettings();
    schedulePickpocketFormatting(0);
  }

  function ensurePickpocketPageControls(cards, visibleCount) {
    const firstCard = cards[0];
    const cardList = firstCard?.parentElement;
    const controlsHost = cardList?.parentElement;
    if (!cardList || !controlsHost) return;
    let controls = document.getElementById('tdd-pickpocket-filter');
    if (!controls) {
      controls = document.createElement('div');
      controls.id = 'tdd-pickpocket-filter';
      controls.innerHTML = `<strong>Target level</strong>
        <label>Min <input type="number" min="1" max="300" step="1" data-tdd-pickpocket-min></label>
        <label>Max <input type="number" min="1" max="300" step="1" data-tdd-pickpocket-max></label>
        <button type="button" data-tdd-pickpocket-all>Show 1–300</button>
        <span data-tdd-pickpocket-visible-count></span>`;
      controls.addEventListener('change', (event) => {
        if (!event.target.matches('[data-tdd-pickpocket-min], [data-tdd-pickpocket-max]')) return;
        const minInput = controls.querySelector('[data-tdd-pickpocket-min]');
        const maxInput = controls.querySelector('[data-tdd-pickpocket-max]');
        updatePickpocketRange(minInput?.value, maxInput?.value);
      });
      controls.addEventListener('click', (event) => {
        if (!event.target.closest('[data-tdd-pickpocket-all]')) return;
        updatePickpocketRange(1, 300);
      });
    }
    if (controls.parentElement !== controlsHost || controls.nextSibling !== cardList) controlsHost.insertBefore(controls, cardList);
    const minInput = controls.querySelector('[data-tdd-pickpocket-min]');
    const maxInput = controls.querySelector('[data-tdd-pickpocket-max]');
    if (document.activeElement !== minInput) minInput.value = String(state.settings.pickpocketMinTargetLevel);
    if (document.activeElement !== maxInput) maxInput.value = String(state.settings.pickpocketMaxTargetLevel);
    const count = controls.querySelector('[data-tdd-pickpocket-visible-count]');
    if (count) count.textContent = `${visibleCount}/${cards.length} visible`;
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
    for (let depth = 0; depth < 12 && node?.parentElement; depth += 1) {
      node = node.parentElement;
      const commitSections = node.querySelectorAll('[class*="commitButtonSection" i]');
      if (commitSections.length === 1) return node;
      if (commitSections.length > 1) break;
    }
    return null;
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
    const minimum = Math.min(normalizedPickpocketLevel(state.settings.pickpocketMinTargetLevel, 1), normalizedPickpocketLevel(state.settings.pickpocketMaxTargetLevel, 300));
    const maximum = Math.max(normalizedPickpocketLevel(state.settings.pickpocketMinTargetLevel, 1), normalizedPickpocketLevel(state.settings.pickpocketMaxTargetLevel, 300));
    const formattedCards = new Set();
    let visibleCount = 0;
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
      const hidden = level < minimum || level > maximum;
      card.dataset.tddPickpocketHidden = hidden ? 'true' : 'false';
      if (!hidden) visibleCount += 1;
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
    ensurePickpocketPageControls([...formattedCards], visibleCount);
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
    const clockPair = value.match(/\b(\d{1,3}):(\d{2}):(\d{2})\s*\/\s*(\d{1,3}):(\d{2}):(\d{2})\b/);
    if (clockPair) return Number(clockPair[1]) * 3600 + Number(clockPair[2]) * 60 + Number(clockPair[3]);
    const units = [...value.matchAll(/(\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/gi)];
    if (units.length) {
      return Math.max(0, Math.round(units.reduce((total, match) => {
        const amount = Number(match[1]);
        const unit = match[2][0].toLowerCase();
        return total + amount * (unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1);
      }, 0)));
    }
    const withoutCompletionDates = value.replace(/\b\d{1,2}:\d{1,2}:\d{4}\s+\d{1,3}:\d{2}:\d{2}\b/g, ' ');
    const clock = withoutCompletionDates.match(/(?:(\d+)\s*d(?:ays?)?\s*)?(\d{1,3}):(\d{2}):(\d{2})/i);
    if (clock) return Number(clock[1] || 0) * 86400 + Number(clock[2]) * 3600 + Number(clock[3]) * 60 + Number(clock[4]);
    const shortClock = withoutCompletionDates.match(/\b(\d{1,3}):(\d{2})(?!:)\b/);
    if (shortClock) return Number(shortClock[1]) * 3600 + Number(shortClock[2]) * 60;
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
      try {
        const tooltipSelector = '[role="tooltip"], [class*="tooltip" i], [data-tooltip-content]';
        for (const tooltip of Array.from(document.querySelectorAll(tooltipSelector)).slice(-80)) {
          if (!elementVisible(tooltip)) continue;
          const text = String(tooltip.textContent || '').trim();
          if (!new RegExp(`\\b${safe}\\b`, 'i').test(text)) continue;
          const parsed = parseLabeledCooldownSeconds(text, label);
          if (parsed !== null) return parsed;
        }
      } catch {
        // Some tooltip libraries briefly detach their portal while it updates.
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
      if (isDashboardOwnerPause(error)) return false;
      state.errors[errorKey] = error?.message || 'Unknown API error.';
      return false;
    }
  }

  function fastSelectionsNeeded({ energyDue = false, nerveDue = false, cooldownsDue = false } = {}) {
    const selections = [];
    const apiBars = state.data.bars?.bars;
    const apiCooldowns = state.data.cooldowns?.cooldowns;
    if ((alertCheckDue('energyFull') && !state.dom.bars?.energy && (energyDue || !apiBars?.energy))
      || (alertCheckDue('nerveFull') && !state.dom.bars?.nerve && (nerveDue || !apiBars?.nerve))) selections.push('bars');
    const cooldownTypes = [
      ['drug', 'drugCooldown'],
      ['medical', 'medicalCooldown'],
      ['booster', 'boosterCooldown'],
    ];
    const enabledCooldowns = cooldownTypes.filter(([, alertId]) => alertCheckDue(alertId));
    const cooldownMissing = enabledCooldowns.some(([type]) => (
      normalizedCooldownSeconds(state.dom.cooldowns?.[type]) === null
      && normalizedCooldownSeconds(apiCooldowns?.[type]) === null
    ));
    if (enabledCooldowns.length && (cooldownsDue || cooldownMissing)) selections.push('cooldowns');
    return selections;
  }

  function clusterRingAlreadyAchieved() {
    return (state.data.shoplifting?.crimes?.uniques || []).some((unique) =>
      (unique?.rewards?.items || []).some((item) => Number(item?.id ?? item?.item_id) === 1465));
  }

  function educationOcSelectionsNeeded({ educationDue = false, organizedCrimeDue = false } = {}) {
    const selections = new Set();
    if (educationDue && alertCheckDue('education') && !state.dom.educationActive) selections.add('education');
    if (organizedCrimeDue && alertCheckDue('organizedCrime')) { selections.add('organizedcrime'); selections.add('profile'); }
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
    if (state.syncing) {
      render();
      return;
    }
    const expiredSnoozes = new Set(releaseExpiredSnoozes());
    const snoozeExpiredFor = (...ids) => ids.some((id) => expiredSnoozes.has(id));
    if (visibleTornTab()) {
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
    }
    const dayChanged = updateTornDayBoundary();
    if (!ownsDashboardNetworkLease() || !state.settings.apiKey || domOnly || Number(state.settings.apiPausedUntil) > Date.now()) {
      render();
      return;
    }
    const now = Date.now();
    const dailySnoozeExpired = snoozeExpiredFor('energyRefill', 'nerveRefill', 'cityItem', 'playerAddiction');
    const dailyInterval = dailyRefreshMs();
    const refillsEnabled = alertCheckDue('energyRefill') || alertCheckDue('nerveRefill');
    const refillsDue = refillsEnabled && (force || dayChanged || snoozeExpiredFor('energyRefill', 'nerveRefill')
      || dailyStatusCheckDue('refills', enabledRefillStatusKnown(), state.lastDailyUpdated, dailyInterval, now));
    const cityItemsStatusKnown = numberFromPersonalStats(state.data.cityItemsNow) !== null
      && numberFromPersonalStats(state.data.cityItemsAtReset) !== null;
    const cityItemsDue = alertCheckDue('cityItem') && (force || dayChanged || snoozeExpiredFor('cityItem')
      || dailyStatusCheckDue('cityItems', cityItemsStatusKnown, state.lastDailyUpdated, dailyInterval, now));
    const playerAddictionDue = alertCheckDue('playerAddiction') && state.dom.playerAddiction == null
      && (force || dayChanged || snoozeExpiredFor('playerAddiction')
        || apiCheckDueAt('playerAddiction', state.lastDailyUpdated, dailyInterval, now));
    const needsDaily = force || includeDaily || dayChanged || dailySnoozeExpired
      || refillsDue || cityItemsDue || playerAddictionDue;
    const marketWatchesActive = activeMarketWatches();
    state.syncing = true;
    render();
    const tasks = [];
    try {
      tasks.push((async () => {
        const fastDue = {
          energyDue: force || snoozeExpiredFor('energyFull') || apiCheckDueAt('energy', state.lastEnergyUpdated, ENERGY_REFRESH_MS, now),
          nerveDue: force || snoozeExpiredFor('nerveFull') || apiCheckDueAt('nerve', state.lastNerveUpdated, NERVE_REFRESH_MS, now),
          cooldownsDue: force || snoozeExpiredFor('drugCooldown', 'medicalCooldown', 'boosterCooldown')
            || apiCheckDueAt('cooldowns', state.lastCooldownsUpdated, COOLDOWN_REFRESH_MS, now),
        };
        const fastSelections = fastSelectionsNeeded(fastDue);
        const okay = !fastSelections.length
          || await guardedRequest('fastFallback', () => api('user', { selections: fastSelections.join(',') }, { priority: 'low' }), absorbGeneric);
        if (!fastSelections.length) delete state.errors.fastFallback;
        if (!okay) return;
        const updatedAt = Date.now();
        if (fastSelections.includes('bars')) {
          if (fastDue.energyDue) state.lastEnergyUpdated = updatedAt;
          if (fastDue.nerveDue) state.lastNerveUpdated = updatedAt;
          const bars = state.data.bars?.bars;
          if (bars?.energy) deferApiCheck('energy', barNextApiCheckAt(bars.energy, updatedAt, ENERGY_REFRESH_MS));
          if (bars?.nerve) deferApiCheck('nerve', barNextApiCheckAt(bars.nerve, updatedAt, NERVE_REFRESH_MS));
        }
        if (fastSelections.includes('cooldowns') && fastDue.cooldownsDue) {
          state.lastCooldownsUpdated = updatedAt;
          const apiCooldowns = state.data.cooldowns?.cooldowns;
          const nextChecks = [
            state.settings.enabled.drugCooldown !== false ? cooldownNextApiCheckAt('drug', apiCooldowns?.drug, updatedAt) : 0,
            state.settings.enabled.medicalCooldown !== false ? cooldownNextApiCheckAt('medical', apiCooldowns?.medical, updatedAt) : 0,
            state.settings.enabled.boosterCooldown !== false ? cooldownNextApiCheckAt('booster', apiCooldowns?.booster, updatedAt) : 0,
          ].filter((value) => value > updatedAt);
          deferApiCheck('cooldowns', nextChecks.length ? Math.min(...nextChecks) : updatedAt + COOLDOWN_REFRESH_MS);
        }
        const groups = [];
        const apiBars = state.data.bars?.bars;
        const apiCooldowns = state.data.cooldowns?.cooldowns;
        const bars = {
          energy: state.dom.bars?.energy || apiBars?.energy,
          nerve: state.dom.bars?.nerve || apiBars?.nerve,
        };
        const cooldowns = resolvedCooldowns();
        if (bars?.energy) groups.push('energyFull');
        if (bars?.nerve) groups.push('nerveFull');
        if (cooldowns?.drug != null) groups.push('drugCooldown');
        if (cooldowns?.medical != null) groups.push('medicalCooldown');
        if (cooldowns?.booster != null) groups.push('boosterCooldown');
        publishAlertGroups(groups);
      })());

      const raceReminderDue = alertCheckDue('raceOrFly');
      const landingReminderDue = alertCheckDue('landing');
      const raceSnoozeExpired = snoozeExpiredFor('raceOrFly', 'landing');
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
            state.nextRaceTravelCheckAt = nextActiveRaceTransitionAt(state.data.races?.races, RACE_TRAVEL_REFRESH_MS);
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

          if (!force && !raceSnoozeExpired && cachedCategoryComplete && now < Number(state.nextRaceTravelCheckAt || 0)) {
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
              ? nextActiveRaceTransitionAt(state.data.races?.races, RACE_TRAVEL_REFRESH_MS)
              : Number(remainingTravel) > 0
                ? Date.now() + Number(remainingTravel) * 1000
                : Date.now() + RACE_TRAVEL_REFRESH_MS;
            publishAlertGroups(['raceTravel']);
          }
        })());
      }

      tasks.push(refreshCrimeUniqueProgress(now, { force }));

      const educationDue = alertCheckDue('education')
        && (force || snoozeExpiredFor('education') || apiCheckDueAt('education', state.lastEducationOcUpdated, EDUCATION_OC_REFRESH_MS, now));
      const organizedCrimeDue = alertCheckDue('organizedCrime')
        && (force || snoozeExpiredFor('organizedCrime') || apiCheckDueAt('organizedCrime', state.lastEducationOcUpdated, EDUCATION_OC_REFRESH_MS, now));
      const educationOcDue = educationDue || organizedCrimeDue;
      if (educationOcDue) {
        const selections = educationOcSelectionsNeeded({ educationDue, organizedCrimeDue });
        if (selections.length) {
          tasks.push((async () => {
            const okay = await guardedRequest('educationOcFallback', () => api('user', {
              selections: selections.join(','),
              limit: 20,
              sort: 'desc',
            }, { priority: 'low' }), absorbGeneric);
            if (!okay) return;
            const updatedAt = Date.now();
            state.lastEducationOcUpdated = updatedAt;
            if (selections.includes('education')) {
              deferApiCheck('education', educationNextApiCheckAt(state.data.education?.education, updatedAt));
            }
            if (selections.includes('organizedcrime')) {
              deferApiCheck('organizedCrime', organizedCrimeNextApiCheckAt(state.data.organizedCrime?.organizedCrime, updatedAt));
            }
            const groups = [];
            if (state.settings.enabled.education && Object.hasOwn(state.data.education || {}, 'education')) groups.push('education');
            if (state.settings.enabled.organizedCrime
              && Object.hasOwn(state.data.organizedCrime || {}, 'organizedCrime')
              && Object.hasOwn(state.data.profile || {}, 'profile')) groups.push('organizedCrime');
            publishAlertGroups(groups);
          })());
        } else {
          if (educationDue && state.dom.educationActive) deferApiCheck('education', now + EDUCATION_OC_REFRESH_MS);
          delete state.errors.educationOcFallback;
        }
      }

      if (alertCheckDue('clusterRing')) {
        tasks.push((async () => {
          if (!state.data.shoplifting && state.crimeProgressPromise) await state.crimeProgressPromise;
          if (clusterRingAlreadyAchieved()) {
            delete state.errors.clusterRingStatus;
            state.lastClusterUpdated = now;
            publishAlertGroups(['clusterRing']);
            return;
          }
          const cachedStatusKnown = state.dom.clusterRingSignalKnown
            || Array.isArray(state.data.shopliftingStatus?.shoplifting?.jewelry_store);
          if (!force && !snoozeExpiredFor('clusterRing') && cachedStatusKnown && state.data.shoplifting && now - state.lastClusterUpdated < clusterFallbackRefreshMs()) {
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
        && (force || snoozeExpiredFor('missions') || scheduledTctCheckDue(state.lastMissionsUpdated, 0, 15, now));
      const casinoStatusKnown = casinoTokenCount() !== null
        && (state.dom.selfExcluded || Array.isArray(state.data.icons?.icons));
      const casinoDue = alertCheckDue('casinoTokens')
        && (force || dayChanged || snoozeExpiredFor('casinoTokens')
          || dailyStatusCheckDue('casinoTokens', casinoStatusKnown, state.lastCasinoUpdated, dailyInterval, now));
      const jobAddictionDue = alertCheckDue('jobAddiction')
        && (force || snoozeExpiredFor('jobAddiction') || scheduledTctCheckDue(state.lastJobAddictionUpdated, 18, 15, now));
      const dailyTasks = [];

      if (needsDaily) {
        if (refillsDue) {
          dailyTasks.push((async () => {
            const okay = await guardedRequest('dailyRefills', () => api('user/refills'), (body) => {
              if (refillUsedStatus(body?.refills, 'energy') === null || refillUsedStatus(body?.refills, 'nerve') === null) {
                throw new Error('Torn returned refill data in an unreadable format.');
              }
              state.data.refills = { ...body, __fetchedAt: Date.now() };
            });
            if (!okay) return;
            delete state.errors.legacyDaily;
            deferApiCheck('refills', enabledRefillsComplete() ? nextTornResetAtMs() : Date.now() + dailyInterval);
            publishAlertGroups(['refills']);
          })());
        }
        if (playerAddictionDue) {
          dailyTasks.push((async () => {
            const okay = await guardedRequest('playerAddiction', () => api('user/battlestats'), (body) => { state.data.battlestats = body; });
            if (!okay) return;
            deferApiCheck('playerAddiction', Date.now() + dailyInterval);
            publishAlertGroups(['playerAddiction']);
          })());
        }
        if (cityItemsDue) {
          dailyTasks.push((async () => {
            const baselineKnown = numberFromPersonalStats(state.data.cityItemsAtReset) !== null;
            const results = await Promise.all([
              guardedRequest('cityItemsNow', () => api('user/personalstats', { cat: 'trading' }), (body) => { state.data.cityItemsNow = body; }),
              baselineKnown
                ? Promise.resolve(true)
                : guardedRequest('cityItemsAtReset', () => api('user/personalstats', { stat: 'cityitemsbought', timestamp: state.tornDayStart }), (body) => { state.data.cityItemsAtReset = body; }),
            ]);
            if (!results.every(Boolean)) return;
            const remaining = cityItemsRemainingToday();
            if (remaining === null) {
              state.errors.cityItemsStatus = 'Torn returned city-item totals in an unreadable format.';
              deferApiCheck('cityItems', Date.now() + dailyInterval);
              return;
            }
            delete state.errors.cityItemsStatus;
            deferApiCheck('cityItems', remaining === 0 ? nextTornResetAtMs() : Date.now() + dailyInterval);
            publishAlertGroups(['cityItem']);
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
          const casinoPromise = guardedRequest('casino', () => api('user/casino'), (body) => {
            if (casinoTokenCount(body) === null) throw new Error('Torn returned casino-token data in an unreadable format.');
            state.data.casino = { ...body, __fetchedAt: Date.now() };
          });
          const iconsPromise = state.dom.selfExcluded
            ? Promise.resolve(true)
            : guardedRequest('casinoExclusion', () => api('user', { selections: 'icons' }), (body) => {
              if (!Array.isArray(body?.icons)) throw new Error('Torn returned icon data in an unreadable format.');
              absorbGeneric(body);
            });
          if (state.dom.selfExcluded) delete state.errors.casinoExclusion;
          const [casinoOkay, iconsOkay] = await Promise.all([casinoPromise, iconsPromise]);
          if (!casinoOkay || !iconsOkay) {
            state.lastCasinoUpdated = Date.now();
            deferApiCheck('casinoTokens', Date.now() + dailyInterval);
            return;
          }
          state.lastCasinoUpdated = Date.now();
          deferApiCheck('casinoTokens', casinoTokenCount() === 0 || iconSelfExclusion()
            ? nextTornResetAtMs()
            : Date.now() + dailyInterval);
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
      if (!educationOcDue && state.settings.enabled.education && (state.dom.educationActive || Object.hasOwn(state.data.education || {}, 'education'))) cachedDailyGroups.push('education');
      if (!educationOcDue && state.settings.enabled.organizedCrime
        && Object.hasOwn(state.data.organizedCrime || {}, 'organizedCrime')
        && Object.hasOwn(state.data.profile || {}, 'profile')) cachedDailyGroups.push('organizedCrime');
      if (!casinoDue && state.settings.enabled.casinoTokens && state.data.casino?.casino
        && (state.dom.selfExcluded || Array.isArray(state.data.icons?.icons))) cachedDailyGroups.push('casinoTokens');
      if (!refillsDue && (state.settings.enabled.energyRefill || state.settings.enabled.nerveRefill) && state.data.refills?.refills) cachedDailyGroups.push('refills');
      if (!cityItemsDue && state.settings.enabled.cityItem && state.data.cityItemsNow && state.data.cityItemsAtReset) cachedDailyGroups.push('cityItem');
      if (!playerAddictionDue && state.settings.enabled.playerAddiction && (state.dom.playerAddiction != null || state.data.battlestats?.battlestats)) cachedDailyGroups.push('playerAddiction');
      if (!jobAddictionDue && state.settings.enabled.jobAddiction && state.data.job?.job
        && (state.data.job.job.type !== 'company' || state.data.companyEmployees?.employees)) cachedDailyGroups.push('jobAddiction');
      publishAlertGroups(cachedDailyGroups);

      if (dailyTasks.length || needsDaily) {
        tasks.push(Promise.all(dailyTasks).then(() => {
          if (needsDaily) state.lastDailyUpdated = Date.now();
          saveCheckCache();
        }));
      }
      if (state.settings.enabled.itemMarket !== false && marketWatchesActive.length) {
        tasks.push(refreshMarketWatches({ force }));
      } else if (state.settings.enabled.itemMarket !== false && marketWatchesActive.length && state.data.market) {
        publishAlertGroups(['market']);
      }
      if (state.settings.weav3rBazaarEnabled && state.settings.enabled.itemMarket !== false && activeBazaarWatches().length) {
        tasks.push(refreshBazaarWatches({ force }));
      } else if (state.settings.weav3rBazaarEnabled && state.settings.enabled.itemMarket !== false && activeBazaarWatches().length) {
        state.data.bazaars ||= {};
        activeBazaarWatches().forEach((watch) => {
          const cached = state.bazaarCache[Math.trunc(Number(watch.itemId))];
          if (cached) state.data.bazaars[watch.uid] = cached;
        });
        publishAlertGroups(['bazaar']);
      }
      await Promise.all(tasks);
      if (alertCheckDue('cityItem')) {
        await refreshCityShopStockIfNeeded({ force });
        publishAlertGroups(['cityItem']);
      }
      state.lastUpdated = Date.now();
      saveCheckCache();
    } finally {
      state.syncing = false;
      render();
    }
  }

  function numberFromPersonalStats(body) {
    const presentNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : null;
    const stats = body?.personalstats;
    if (Array.isArray(stats)) {
      const row = stats.find((item) => item?.name === 'cityitemsbought');
      return presentNumber(row?.value);
    }
    const nested = stats?.trading?.items?.bought?.shops;
    const nestedNumber = presentNumber(nested);
    if (nestedNumber !== null) return nestedNumber;

    const visited = new Set();
    function search(value, depth = 0) {
      if (!value || typeof value !== 'object' || depth > 8 || visited.has(value)) return null;
      visited.add(value);
      const direct = presentNumber(value.cityitemsbought);
      if (direct !== null) return direct;
      if (value.name === 'cityitemsbought') {
        const named = presentNumber(value.value);
        if (named !== null) return named;
      }
      for (const child of Object.values(value)) {
        const match = search(child, depth + 1);
        if (match !== null) return match;
      }
      return null;
    }
    return search(body);
  }

  function numericPersonalStats(body) {
    const result = {};
    const visited = new Set();
    const normalizePart = (part) => String(part || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    function visit(value, path = [], depth = 0) {
      if (value == null || depth > 12) return;
      if (Array.isArray(value)) {
        value.forEach((entry, index) => {
          if (entry && typeof entry === 'object' && entry.name != null && Number.isFinite(Number(entry.value))) {
            result[normalizePart(entry.name)] = Number(entry.value);
          } else {
            visit(entry, [...path, String(index)], depth + 1);
          }
        });
        return;
      }
      if (typeof value === 'object') {
        if (visited.has(value)) return;
        visited.add(value);
        Object.entries(value).forEach(([key, child]) => visit(child, [...path, normalizePart(key)], depth + 1));
        return;
      }
      if ((typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) && path.length) {
        result[path.join('.')] = Number(value);
      }
    }
    visit(body?.personalstats);
    return result;
  }

  function awardProfileFromBody(body) {
    const profile = body?.profile && typeof body.profile === 'object' ? body.profile : {};
    return {
      id: Math.max(0, Math.trunc(Number(profile.id) || 0)),
      level: Math.max(0, Math.trunc(Number(profile.level) || 0)),
      age: Math.max(0, Math.trunc(Number(profile.age) || 0)),
      awards: Math.max(0, Math.trunc(Number(profile.awards) || 0)),
      forumPosts: Math.max(0, Math.trunc(Number(profile.forum_posts) || 0)),
      friends: Math.max(0, Math.trunc(Number(profile.friends) || 0)),
      enemies: Math.max(0, Math.trunc(Number(profile.enemies) || 0)),
      karma: Number.isFinite(Number(profile.karma)) ? Number(profile.karma) : 0,
      daysMarried: Math.max(0, Math.trunc(Number(profile.spouse?.days_married) || 0)),
    };
  }

  function finishingHitsFromPersonalStats(body) {
    const direct = body?.personalstats?.finishing_hits;
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return Object.fromEntries(Object.keys(FINISHER_LABELS).map((key) => [key, Math.max(0, Math.trunc(Number(direct[key]) || 0))]));
    }
    const legacyNames = {
      heavy_artillery: 'heavyhits', machine_guns: 'machinehits', rifles: 'riflehits', sub_machine_guns: 'smghits',
      shotguns: 'shotgunhits', pistols: 'pistolhits', temporary: 'temphits', piercing: 'piercinghits',
      slashing: 'slashinghits', clubbing: 'clubbinghits', mechanical: 'mechanicalhits', hand_to_hand: 'h2hhits',
    };
    const numericStats = numericPersonalStats(body);
    const rows = Array.isArray(body?.personalstats) ? body.personalstats : [];
    const byName = new Map(rows.map((row) => [String(row?.name || ''), Number(row?.value) || 0]));
    return Object.fromEntries(Object.entries(legacyNames).map(([key, legacyName]) => [
      key,
      Math.max(0, Math.trunc(Number(numericStats[`finishing_hits.${key}`] ?? numericStats[legacyName] ?? byName.get(legacyName)) || 0)),
    ]));
  }

  function awardKey(kind, id) {
    return `${kind}:${Math.trunc(Number(id) || 0)}`;
  }

  function normalizedAwardTypeFilter(value) {
    const filter = String(value || 'all').toLowerCase();
    if (filter === 'honor:default') return 'honor';
    return /^(?:all|medal|honor|medal:[a-z0-9_-]+|honor:[a-z0-9_-]+)$/.test(filter) ? filter : 'all';
  }

  function awardCategoryTitle(award) {
    return String(award?.type?.title || '').trim().toLowerCase();
  }

  function isDefaultHonorAward(award) {
    return award?.kind === 'honor' && (awardCategoryTitle(award) === 'default' || Number(award?.type?.id) === 1);
  }

  function isUnavailableCurrentAward(award) {
    const text = `${awardCategoryTitle(award)} ${awardRequirementText(award)}`;
    return /\b(?:auto thefts?|grand theft auto)\b/i.test(text);
  }

  function awardObjectiveSatisfied(award) {
    const requirement = normalizedAwardRequirementText(award);
    const hasSafeCumulativeObjective = /\breach level \d+\b/.test(requirement)
      || (awardRequirementNumbers(award).length > 0 && /\b(?:crimes?|offenses?)\b/.test(requirement));
    if (!hasSafeCumulativeObjective) return false;
    const progress = awardObjectiveProgress(award);
    return Boolean(progress?.rows?.length) && progress.rows.every((row) => (
      Number.isFinite(Number(row.current)) && Number.isFinite(Number(row.target)) && Number(row.current) >= Number(row.target)
    ));
  }

  function awardCatalogRows() {
    const completedMedals = new Set(state.awards.medals.map((award) => Math.trunc(Number(award?.id ?? award))));
    const completedHonors = new Set(state.awards.honors.map((award) => Math.trunc(Number(award?.id ?? award))));
    return [
      ...state.awards.catalogMedals.map((award) => ({ ...award, kind: 'medal', completed: completedMedals.has(Math.trunc(Number(award?.id))) })),
      ...state.awards.catalogHonors.map((award) => ({ ...award, kind: 'honor', completed: completedHonors.has(Math.trunc(Number(award?.id))) })),
    ].filter((award) => Number(award?.id) > 0 && award?.name && !isDefaultHonorAward(award) && !isUnavailableCurrentAward(award))
      .map((award) => award.completed || !awardObjectiveSatisfied(award) ? award : { ...award, completed: true, completedByCounter: true });
  }

  function awardByKey(key) {
    return awardCatalogRows().find((award) => awardKey(award.kind, award.id) === key) || null;
  }

  function awardRequirementText(award) {
    return String(award?.description || award?.name || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&(?:nbsp|#160);/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function awardNumericRequirementText(award) {
    const units = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
    const tens = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
    const word = '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)';
    return awardRequirementText(award).replace(new RegExp(`\\b${word}(?:[ -]+${word})*\\b`, 'gi'), (phrase) => {
      let value = 0;
      for (const token of phrase.toLowerCase().split(/[ -]+/)) {
        if (Object.hasOwn(units, token)) value += units[token];
        else if (Object.hasOwn(tens, token)) value += tens[token];
        else if (token === 'hundred') value = Math.max(1, value) * 100;
      }
      return String(value);
    });
  }

  function normalizedAwardRequirementText(award) {
    return awardNumericRequirementText(award)
      .toLowerCase()
      .replace(/\b(year|month|week|day|hour|minute|second)s?\b/g, '$1');
  }

  function awardRequirementNumbers(award) {
    const matches = awardNumericRequirementText(award).match(/\$?\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:thousand|million|billion|trillion|mil|bn|[kmbt])\b|\s*(?:st|nd|rd|th)\b)?/gi) || [];
    const multipliers = { k: 1e3, thousand: 1e3, m: 1e6, mil: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, trillion: 1e12 };
    return matches.map((match) => {
      const clean = match.toLowerCase().replace(/[$,\s]/g, '').replace(/(?:st|nd|rd|th)$/i, '');
      const unit = clean.match(/(thousand|million|billion|trillion|mil|bn|[kmbt])$/i)?.[1]?.toLowerCase() || '';
      const numericText = unit ? clean.slice(0, -unit.length) : clean;
      return Math.max(0, Number(numericText) * (multipliers[unit] || 1));
    }).filter(Number.isFinite);
  }

  function awardProgressionFamily(award) {
    const numbers = awardRequirementNumbers(award);
    if (!numbers.length) return '';
    const normalizedRequirement = normalizedAwardRequirementText(award)
      .replace(/\$?\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:thousand|million|billion|trillion|mil|bn|[kmbt])\b|\s*(?:st|nd|rd|th)\b)?/gi, '#')
      .replace(/\s+/g, ' ')
      .trim();
    return `${award.kind}|${award?.type?.id ?? award?.type?.title ?? ''}|${normalizedRequirement}`;
  }

  function isEarlierAwardRequirement(candidate, later) {
    const candidateNumbers = awardRequirementNumbers(candidate);
    const laterNumbers = awardRequirementNumbers(later);
    return candidateNumbers.length > 0
      && candidateNumbers.length === laterNumbers.length
      && candidateNumbers.every((value, index) => value <= laterNumbers[index])
      && candidateNumbers.some((value, index) => value < laterNumbers[index]);
  }

  function isStorePurchaseHonor(award) {
    return award?.kind === 'honor' && /\bpurchased from (?:the )?(?:token shop|points building)(?:\s+or\s+(?:the )?(?:token shop|points building))?\b/i.test(awardRequirementText(award));
  }

  function collapseAwardProgressions(rows) {
    const storePurchases = rows.filter(isStorePurchaseHonor).sort((left, right) => Number(left.id) - Number(right.id) || String(left.name).localeCompare(String(right.name)));
    const storeReminder = storePurchases.find((award) => state.settings.trackedAwards.includes(awardKey(award.kind, award.id))) || storePurchases[0] || null;
    const families = new Map();
    rows.forEach((award) => {
      const family = awardProgressionFamily(award) || `unique:${awardKey(award.kind, award.id)}`;
      if (!families.has(family)) families.set(family, []);
      families.get(family).push(award);
    });
    return rows.filter((award) => {
      const key = awardKey(award.kind, award.id);
      if (isStorePurchaseHonor(award)) return award === storeReminder;
      if (state.settings.trackedAwards.includes(key)) return true;
      const family = awardProgressionFamily(award) || `unique:${key}`;
      return !families.get(family).some((candidate) => candidate !== award && isEarlierAwardRequirement(candidate, award));
    });
  }

  function awardMatchesTypeFilter(award, filter = state.settings.awardTypeFilter) {
    const normalized = normalizedAwardTypeFilter(filter);
    if (normalized === 'all') return true;
    const [kind, category = ''] = normalized.split(':');
    return award.kind === kind && (!category || awardCategoryTitle(award) === category);
  }

  function awardCategoryLabel(category) {
    if (category === 'misc') return 'Miscellaneous';
    return category.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function awardFilterOptionsMarkup() {
    const selected = state.settings.awardTypeFilter;
    const option = (value, label) => `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    const categories = (kind) => [...new Set(awardCatalogRows().filter((award) => award.kind === kind).map(awardCategoryTitle).filter(Boolean))].sort();
    return `${option('all', 'All awards')}
      <optgroup label="Medals">${option('medal', 'All medals')}${categories('medal').map((category) => option(`medal:${category}`, awardCategoryLabel(category))).join('')}</optgroup>
      <optgroup label="Honors">${option('honor', 'All honors')}${categories('honor').map((category) => option(`honor:${category}`, awardCategoryLabel(category))).join('')}</optgroup>`;
  }

  function pruneUnavailableTrackedAwards() {
    const available = awardCatalogRows();
    if (!available.length) return false;
    const validKeys = new Set(available.map((award) => awardKey(award.kind, award.id)));
    const next = state.settings.trackedAwards.filter((key) => validKeys.has(key));
    if (next.length === state.settings.trackedAwards.length) return false;
    state.settings.trackedAwards = next;
    return true;
  }

  function uncompletedAwards({ collapseProgressions = true } = {}) {
    const rows = awardCatalogRows().filter((award) => !award.completed && awardMatchesTypeFilter(award));
    return (collapseProgressions ? collapseAwardProgressions(rows) : rows)
      .sort((left, right) => {
        const leftTracked = state.settings.trackedAwards.includes(awardKey(left.kind, left.id));
        const rightTracked = state.settings.trackedAwards.includes(awardKey(right.kind, right.id));
        return Number(rightTracked) - Number(leftTracked)
          || String(left?.type?.title || '').localeCompare(String(right?.type?.title || ''))
          || String(left.name).localeCompare(String(right.name));
      });
  }

  function isWarMachineAward(award) {
    const name = String(award?.name || '');
    const requirement = String(award?.description || '');
    return /\bwar\s+machine\b/i.test(name)
      || (/\b1,?000\b/i.test(requirement) && /finishing hits?/i.test(requirement) && /\b(?:every|all) categor(?:y|ies)\b/i.test(requirement));
  }

  function isSouvenirAward(award) {
    const text = `${award?.name || ''} ${award?.description || ''}`;
    return /souven(?:ir|ier)/i.test(text);
  }

  function souvenirAssignmentForUserId(userId) {
    const normalizedId = Math.trunc(Number(userId));
    if (!(normalizedId > 0)) return null;
    const lastTwo = normalizedId % 100;
    const index = lastTwo % SOUVENIR_ASSIGNMENTS.length;
    return {
      ...SOUVENIR_ASSIGNMENTS[index],
      code: String(index).padStart(2, '0'),
      lastTwo: String(lastTwo).padStart(2, '0'),
    };
  }

  function finisherProgress() {
    const rows = Object.entries(FINISHER_LABELS).map(([key, label]) => ({
      key,
      label,
      value: Math.max(0, Math.trunc(Number(state.awards.finishingHits?.[key]) || 0)),
    }));
    const rawTotal = rows.reduce((sum, row) => sum + row.value, 0);
    const cappedTotal = rows.reduce((sum, row) => sum + Math.min(FINISHER_TARGET, row.value), 0);
    const remaining = rows.filter((row) => row.value < FINISHER_TARGET);
    return { rows, rawTotal, cappedTotal, remaining, targetTotal: rows.length * FINISHER_TARGET };
  }

  function awardStatValue(...paths) {
    for (const path of paths.flat()) {
      const value = state.awards.personalStats?.[path];
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return null;
  }

  function awardObjectiveProgress(award) {
    const text = normalizedAwardRequirementText(award);
    const numbers = awardRequirementNumbers(award);
    const target = numbers[0];
    const result = (current, label, customTarget = target) => (
      Number.isFinite(Number(current)) && Number.isFinite(Number(customTarget)) && Number(customTarget) > 0
        ? { rows: [{ current: Math.max(0, Number(current)), target: Number(customTarget), label }] }
        : null
    );
    const statResult = (path, label, transform = (value) => value, customTarget = target) => {
      const current = awardStatValue(path);
      return current === null ? null : result(transform(current), label, customTarget);
    };

    if (/\b(?:live|living|citizen|been)\b.*\btorn\b.*\b(?:year|day)/i.test(text)) {
      const years = /\byear\b/.test(text);
      return result(state.awards.profile?.age, 'days in Torn', years ? target * 365 : target);
    }
    if (/\b(?:stay|stayed|same spouse|married)\b.*\bmarried\b|\bmarriage\b/i.test(text)) {
      return result(state.awards.profile?.daysMarried, 'days married');
    }
    if (/\breach\s+(?:level\s+)?\d|\battain\s+level\b/i.test(text) && /\blevel\b/i.test(text)) {
      return result(state.awards.profile?.level, 'level');
    }
    if (/\b(?:total )?awards?\b/i.test(text) && /\b(?:achieve|reach|earn|obtain)\b/i.test(text)) {
      return statResult('other.awards', 'awards', (value) => value, target)
        || result(state.awards.profile?.awards, 'awards');
    }
    if (/\btime played\b/i.test(text)) {
      const seconds = awardStatValue('other.activity.time');
      return seconds === null ? null : result(seconds / 3600, 'hours played');
    }
    if (/\bonline (?:each|every) day|\bactive streak\b/i.test(text)) {
      return statResult('other.activity.streak.current', 'current daily streak');
    }
    if (/\bforum posts?\b/i.test(text)) return result(state.awards.profile?.forumPosts, 'forum posts');
    if (/\bkarma\b/i.test(text)) return result(state.awards.profile?.karma, 'karma');
    if (/\bfriends?\b/i.test(text) && /\b(?:have|make|reach)\b/i.test(text)) return result(state.awards.profile?.friends, 'friends');
    if (/\benemies\b/i.test(text) && /\b(?:have|make|reach)\b/i.test(text)) return result(state.awards.profile?.enemies, 'enemies');

    const finisherWeapon = Object.entries({
      heavy_artillery: /heavy artillery/,
      machine_guns: /machine guns?/,
      rifles: /rifles?/,
      sub_machine_guns: /(?:sub[ -]?machine guns?|smgs?)/,
      shotguns: /shotguns?/,
      pistols: /pistols?/,
      temporary: /temporary (?:items?|weapons?)/,
      piercing: /piercing weapons?/,
      slashing: /slashing weapons?/,
      clubbing: /clubbing weapons?/,
      mechanical: /mechanical weapons?/,
      hand_to_hand: /(?:hand[ -]to[ -]hand|unarmed|fists?)/,
    }).find(([, pattern]) => pattern.test(text));
    if (/finishing hits?/i.test(text) && finisherWeapon) {
      return result(state.awards.finishingHits?.[finisherWeapon[0]], `${FINISHER_LABELS[finisherWeapon[0]]} finishing hits`);
    }

    if (/\bwin\b.*\battacks?\b.*\band\b.*\bdefends?\b/i.test(text) && numbers.length >= 2) {
      const attacks = awardStatValue('attacking.attacks.won');
      const defends = awardStatValue('attacking.defends.won');
      if (attacks !== null && defends !== null) {
        return { rows: [
          { current: attacks, target: numbers[0], label: 'attacks won' },
          { current: defends, target: numbers[1], label: 'defends won' },
        ] };
      }
    }
    if (/\bwin\b.*\bstealth(?:ed)? attacks?\b/i.test(text)) return statResult('attacking.attacks.stealth', 'stealthed attacks won');
    if (/\bwin\b.*\battacks?\b/i.test(text)) return statResult('attacking.attacks.won', 'attacks won');
    if (/\b(?:lose|lost)\b.*\battacks?\b/i.test(text)) return statResult('attacking.attacks.lost', 'attacks lost');
    if (/\bassist(?:ed)?\b.*\battacks?\b/i.test(text)) return statResult('attacking.attacks.assist', 'attack assists');
    if (/\bstalemates?\b/i.test(text)) return statResult('attacking.attacks.stalemate', 'attack stalemates');
    if (/\bwin\b.*\bdefends?\b/i.test(text)) return statResult('attacking.defends.won', 'defends won');
    if (/\b(?:lose|lost)\b.*\bdefends?\b/i.test(text)) return statResult('attacking.defends.lost', 'defends lost');
    if (/\benemies? escape\b|\bfoes? escape\b/i.test(text)) return statResult('attacking.escapes.foes', 'enemies escaped');
    if (/\b(?:escape|run away)\b.*\b(?:foes?|opponents?|attacks?)\b/i.test(text)) return statResult('attacking.escapes.player', 'successful escapes');
    if (/\bkill streak\b/i.test(text)) return statResult('attacking.killstreak.best', 'best kill streak');
    if (/\bcritical hits?\b/i.test(text)) return statResult('attacking.hits.critical', 'critical hits');
    if (/\bone[ -]hit kills?\b/i.test(text)) return statResult('attacking.hits.one_hit_kills', 'one-hit kills');
    if (/\b(?:total damage|damage in total)\b/i.test(text)) return statResult('attacking.damage.total', 'total damage');
    if (/\bdamage\b.*\b(?:single hit|one hit)\b|\b(?:single hit|one hit)\b.*\bdamage\b/i.test(text)) return statResult('attacking.damage.best', 'best single-hit damage');
    if (/\bunarmored\b.*\b(?:attacks?|defends?|wins?)\b/i.test(text)) return statResult('attacking.unarmored_wins', 'unarmored wins');
    if (/\bfire\b.*\brounds?\b/i.test(text)) return statResult('attacking.ammunition.total', 'rounds fired');
    if (/\btracer rounds?\b/i.test(text)) return statResult('attacking.ammunition.tracer', 'tracer rounds used');
    if (/\bincendiary rounds?\b/i.test(text)) return statResult('attacking.ammunition.incendiary', 'incendiary rounds used');
    if (/\bpiercing rounds?\b/i.test(text)) return statResult('attacking.ammunition.piercing', 'piercing rounds used');
    if (/\bhollow(?:[ -]point)? rounds?\b/i.test(text)) return statResult('attacking.ammunition.hollow_point', 'hollow-point rounds used');
    if (/\b(?:earn|gain)\b.*\bfaction respect\b|\brespect\b.*\bfor (?:your )?faction\b/i.test(text)) return statResult('attacking.faction.respect', 'faction respect earned');
    if (/\bretaliation hits?\b|\bperform\b.*\bretaliations?\b/i.test(text)) return statResult('attacking.faction.retaliations', 'retaliation hits');
    if (/\branked war hits?\b/i.test(text)) return statResult('attacking.faction.ranked_war_hits', 'ranked war hits');
    if (/\braid hits?\b/i.test(text)) return statResult('attacking.faction.raid_hits', 'raid hits');
    if (/\bcollect\b.*\bbounties?\b/i.test(text)) return statResult('bounties.collected.amount', 'bounties collected');
    if (/\b(?:earn|make)\b.*\bbount(?:y|ies)\b/i.test(text)) return statResult('bounties.collected.value', 'bounty earnings');
    if (/\b(?:money mugged|mugged in total|from mugging)\b/i.test(text)) return statResult('attacking.networth.money_mugged', 'money mugged');
    if (/\b(?:single|largest) mug(?:ging)?\b/i.test(text)) return statResult('attacking.networth.largest_mug', 'largest mug');

    if (/\bbust\b.*\bpeople|\bpeople busted\b/i.test(text)) return statResult('jail.busts.success', 'successful busts');
    if (/\bfailed busts?\b/i.test(text)) return statResult('jail.busts.fails', 'failed busts');
    if (/\b(?:bail|buy)\b.*\b(?:people|players?)\b.*\bjail\b/i.test(text)) return statResult('jail.bails.amount', 'people bailed');
    if (/\bmedical items?\b/i.test(text)) return statResult('hospital.medical_items_used', 'medical items used');
    if (/\bwithdraw\b.*\bblood\b/i.test(text)) return statResult('hospital.blood_withdrawn', 'blood bags withdrawn');
    if (/\brevive\b.*\b(?:people|players?|times?)\b|\bperform\b.*\brevives?\b/i.test(text)) return statResult('hospital.reviving.revives', 'revives performed');
    if (/\brevive skill\b/i.test(text)) return statResult('hospital.reviving.skill', 'revive skill');

    const crimeSkill = Object.entries({
      search_for_cash: /search for cash/,
      bootlegging: /bootlegging/,
      graffiti: /graffiti/,
      shoplifting: /shoplifting/,
      pickpocketing: /pickpocketing/,
      card_skimming: /card skimming/,
      burglary: /burglary/,
      hustling: /hustling/,
      disposal: /disposal/,
      cracking: /cracking/,
      forgery: /forgery/,
      scamming: /scamming/,
      arson: /arson/,
    }).find(([, pattern]) => pattern.test(text));
    if (/\bskill(?: level)?\b/i.test(text) && crimeSkill) return statResult(`crimes.skills.${crimeSkill[0]}`, `${awardCategoryLabel(crimeSkill[0])} skill`);
    if (/\borganized crimes?\b/i.test(text)) return statResult(['crimes.offenses.organized_crimes', 'crimes.organized_crimes'], 'organized crimes');
    if (/\btotal crimes?\b|\bcriminal offenses?\b/i.test(text)) return statResult(['crimes.offenses.total', 'crimes.total'], 'criminal offenses');
    const crimeType = Object.entries({
      vandalism: /vandalism/,
      fraud: /fraud/,
      theft: /\bthefts?\b/,
      counterfeiting: /counterfeit/,
      illicit_services: /illicit services?/,
      cybercrime: /cybercrime/,
      extortion: /extortion/,
      illegal_production: /illegal production/,
      sell_illegal_goods: /selling illegal (?:goods|products)/,
      auto_theft: /auto theft/,
      drug_deals: /drug deals?/,
      computer: /computer crimes?/,
      murder: /murders?/,
      other: /["']?other["']? crimes?/,
    }).find(([, pattern]) => pattern.test(text));
    if (/\b(?:crimes?|offenses?)\b/i.test(text) && crimeType) {
      return statResult([`crimes.offenses.${crimeType[0]}`, `crimes.${crimeType[0]}`], `${awardCategoryLabel(crimeType[0])} offenses`);
    }

    if (/\bmails?\b.*\b(?:send|sent)\b|\b(?:send|sent)\b.*\bmails?\b/i.test(text)) return statResult('communication.mails_sent.total', 'mail sent');
    if (/\bclassified ads?\b/i.test(text)) return statResult('communication.classified_ads', 'classified ads');
    if (/\bpersonal ads?\b/i.test(text)) return statResult('communication.personals', 'personal ads');

    if (/\bfind\b.*\bitems?\b.*\bcity\b/i.test(text)) return statResult('items.found.city', 'items found in the city');
    if (/\bfind\b.*\bitems?\b.*\bdump\b/i.test(text)) return statResult('items.found.dump', 'items found in the dump');
    if (/\b(?:trash|trashed|dump)\b.*\bitems?\b/i.test(text)) return statResult('items.trashed', 'items trashed');
    if (/\bread\b.*\bbooks?\b/i.test(text)) return statResult('items.used.books', 'books read');
    if (/\b(?:use|used)\b.*\bboosters?\b/i.test(text)) return statResult('items.used.boosters', 'boosters used');
    if (/\b(?:eat|use|used)\b.*\bcandy\b/i.test(text)) return statResult('items.used.candy', 'candy used');
    if (/\b(?:drink|use|used)\b.*\balcohol\b/i.test(text)) return statResult('items.used.alcohol', 'alcohol used');
    if (/\b(?:drink|use|used)\b.*\benergy drinks?\b/i.test(text)) return statResult('items.used.energy_drinks', 'energy drinks used');
    if (/\b(?:use|used)\b.*\bstat enhancers?\b/i.test(text)) return statResult('items.used.stat_enhancers', 'stat enhancers used');
    if (/\bcode\b.*\bviruses?\b/i.test(text)) return statResult('items.viruses_coded', 'viruses coded');

    const destination = Object.entries({
      argentina: /argentina/,
      canada: /canada/,
      cayman_islands: /cayman/,
      china: /china/,
      hawaii: /hawaii/,
      japan: /japan/,
      mexico: /mexico/,
      united_arab_emirates: /(?:dubai|united arab emirates|uae)/,
      united_kingdom: /(?:england|united kingdom|\buk\b)/,
      south_africa: /south africa/,
      switzerland: /switzerland/,
    }).find(([, pattern]) => pattern.test(text));
    if (/\btravel\b/i.test(text) && destination) return statResult(`travel.${destination[0]}`, `trips to ${awardCategoryLabel(destination[0])}`);
    if (/\btravel\b.*\btimes?\b/i.test(text)) return statResult('travel.total', 'trips completed');
    if (/\b(?:import|buy|purchase)\b.*\bitems?\b.*\babroad\b/i.test(text)) return statResult('travel.items_bought', 'items bought abroad');
    if (/\b(?:defeat|win)\b.*\b(?:people|players?|attacks?)\b.*\babroad\b/i.test(text)) return statResult('travel.attacks_won', 'attacks won abroad');
    if (/\b(?:spend|spent)\b.*\b(?:days?|hours?)\b.*\b(?:air|travel)/i.test(text)) {
      const seconds = awardStatValue('travel.time_spent');
      const targetInDays = /\bday\b/.test(text);
      return seconds === null ? null : result(seconds / (targetInDays ? 86400 : 3600), targetInDays ? 'days in the air' : 'hours in the air');
    }
    if (/\bhunting skill\b/i.test(text)) return statResult('travel.hunting.skill', 'hunting skill');

    const drug = ['cannabis', 'ecstasy', 'ketamine', 'lsd', 'opium', 'pcp', 'shrooms', 'speed', 'vicodin', 'xanax'].find((name) => new RegExp(`\\b${name}\\b`, 'i').test(text));
    if (/\b(?:use|used|take|taken)\b/i.test(text) && drug) return statResult(`drugs.${drug}`, `${drug} used`);
    if (/\b(?:use|used|take|taken)\b.*\bdrugs?\b/i.test(text)) return statResult('drugs.total', 'drugs used');
    if (/\boverdoses?\b/i.test(text)) return statResult('drugs.overdoses', 'overdoses');
    if (/\brehab(?:ilitation)?s?\b/i.test(text)) return statResult('drugs.rehabilitations.amount', 'rehabilitations');

    if (/\bmission contracts?\b/i.test(text)) return statResult('missions.contracts.total', 'mission contracts');
    if (/\bduke contracts?\b/i.test(text)) return statResult('missions.contracts.duke', 'Duke contracts');
    if (/\bmission credits?\b/i.test(text)) return statResult('missions.credits', 'mission credits');
    if (/\bcomplete\b.*\bmissions?\b/i.test(text)) return statResult('missions.missions', 'missions completed');
    if (/\bracing points?\b/i.test(text)) return statResult('racing.points', 'racing points');
    if (/\bdriver skill\b|\bracing skill\b/i.test(text)) return statResult('racing.skill', 'racing skill');
    if (/\bwin\b.*\braces?\b/i.test(text)) return statResult('racing.races.won', 'races won');
    if (/\benter\b.*\braces?\b/i.test(text)) return statResult('racing.races.entered', 'races entered');

    if (/\benergy refills?\b/i.test(text)) return statResult('other.refills.energy', 'energy refills used');
    if (/\bnerve refills?\b/i.test(text)) return statResult('other.refills.nerve', 'nerve refills used');
    if (/\b(?:casino|token) refills?\b/i.test(text)) return statResult('other.refills.token', 'casino refills used');
    if (/\bjob points?\b.*\bused\b|\buse\b.*\bjob points?\b/i.test(text)) return statResult('jobs.job_points_used', 'job points used');
    if (/\btrains? received\b/i.test(text)) return statResult('jobs.trains_received', 'job trains received');
    if (/\bmerits? bought\b|\bbuy\b.*\bmerits?\b/i.test(text)) return statResult('other.merits_bought', 'merits bought');
    if (/\bdonator days?\b/i.test(text)) return statResult('other.donator_days', 'donator days');
    if (/\branked war wins?\b/i.test(text)) return statResult('other.ranked_war_wins', 'ranked war wins');
    if (/\bnet\s*worth\b/i.test(text)) return statResult('networth.total', 'networth');
    if (/\bauctions?\b/i.test(text) && /\bwin\b/i.test(text)) return statResult('trading.items.auctions.won', 'auctions won');
    if (/\bpoints?\b.*\b(?:sell|sold)\b|\b(?:sell|sold)\b.*\bpoints?\b/i.test(text)) return statResult('trading.points.sold', 'points sold');
    if (/\bcustomers?\b.*\bbazaar\b|\bbazaar\b.*\bcustomers?\b/i.test(text)) return statResult('trading.bazaar.customers', 'bazaar customers');

    const battleStat = ['strength', 'defense', 'speed', 'dexterity'].find((name) => new RegExp(`\\b${name}\\b`, 'i').test(text));
    if (battleStat && /\b(?:gain|attain|reach)\b/i.test(text)) {
      const value = state.data.battlestats?.battlestats?.[battleStat]?.value;
      if (Number.isFinite(Number(value))) return result(value, battleStat);
    }
    if (/\btotal stats?\b/i.test(text)) {
      const stats = state.data.battlestats?.battlestats;
      const values = ['strength', 'defense', 'speed', 'dexterity'].map((name) => Number(stats?.[name]?.value));
      if (values.every(Number.isFinite)) return result(values.reduce((sum, value) => sum + value, 0), 'total battle stats');
    }
    return null;
  }

  function formatAwardProgressNumber(value) {
    const number = Math.max(0, Number(value) || 0);
    return (Number.isInteger(number) ? number : Math.floor(number * 10) / 10).toLocaleString();
  }

  function objectiveProgressMarkup(progress, compact) {
    const percentages = progress.rows.map((row) => Math.min(100, Math.floor(row.current / row.target * 100)));
    const percent = percentages.length ? Math.min(...percentages) : 0;
    const reached = progress.rows.every((row) => row.current >= row.target);
    const rows = progress.rows.map((row) => {
      const remaining = Math.max(0, row.target - row.current);
      return `<span><b>${formatAwardProgressNumber(row.current)} / ${formatAwardProgressNumber(row.target)}</b> ${escapeHtml(row.label)}${remaining > 0 ? ` · ${formatAwardProgressNumber(remaining)} remaining` : ''}</span>`;
    }).join('');
    return `<div class="award-progress ${compact ? 'compact' : ''} ${reached ? 'reached' : ''}"><strong>${percent}% complete${reached ? ' · threshold reached' : ''}</strong><div class="award-progress-meter"><i style="width:${percent}%"></i></div>${rows}</div>`;
  }

  function awardProgressMarkup(award, { compact = false } = {}) {
    if (isWarMachineAward(award)) {
      const progress = finisherProgress();
      const percent = progress.targetTotal ? Math.min(100, Math.floor(progress.cappedTotal / progress.targetTotal * 100)) : 0;
      const completeCount = progress.rows.length - progress.remaining.length;
      const remainingMarkup = progress.remaining.length
        ? `<div class="finisher-progress-list">${progress.remaining.map((row) => `<span><b>${row.value.toLocaleString()} / ${FINISHER_TARGET.toLocaleString()}</b> ${escapeHtml(row.label)} · ${(FINISHER_TARGET - row.value).toLocaleString()} remaining</span>`).join('')}</div>`
        : '<span>Every finishing-hit category is complete.</span>';
      return `<div class="award-progress ${compact ? 'compact' : ''} ${progress.remaining.length ? '' : 'reached'}"><strong>${completeCount}/${progress.rows.length} categories complete · ${percent}% overall</strong><div class="award-progress-meter"><i style="width:${percent}%"></i></div>${remainingMarkup}</div>`;
    }
    if (isSouvenirAward(award)) {
      const assignment = souvenirAssignmentForUserId(state.awards.userId);
      if (!assignment) {
        return `<div class="award-progress ${compact ? 'compact' : ''}"><strong>Souvenir not calculated yet</strong><small>Refresh awards to load your Torn user ID.</small></div>`;
      }
      return `<div class="award-progress ${compact ? 'compact' : ''}"><strong>Your souvenir: ${escapeHtml(assignment.item)}</strong><span>${escapeHtml(assignment.location)} · code ${assignment.code}</span><small>User ID ending ${assignment.lastTwo} → ${assignment.code}</small></div>`;
    }
    const objective = awardObjectiveProgress(award);
    if (objective) return objectiveProgressMarkup(objective, compact);
    if (!compact) return '';
    const needsRefresh = state.awards.playerFetchedAt && !Object.keys(state.awards.personalStats || {}).length;
    return `<div class="award-progress compact unavailable"><strong>${needsRefresh ? 'Refresh to load progress' : 'No live counter from Torn'}</strong><small>${needsRefresh ? 'The cached award data predates objective tracking.' : 'Torn only reports this objective when the award is granted.'}</small></div>`;
  }

  function trackedAwardsMarkup() {
    const tracked = state.settings.trackedAwards.map(awardByKey).filter(Boolean);
    if (!tracked.length) return '';
    return `<section class="tracked-awards"><div class="tracked-awards-head"><strong>Tracked awards</strong><button data-action="refresh-awards" title="Refresh award completion and objective progress" ${state.awardsLoading ? 'disabled' : ''}>${state.awardsLoading ? 'Refreshing…' : '↻'}</button></div><div class="tracked-award-grid">${tracked.map((award) => `
      <article class="tracked-award ${award.completed ? 'completed' : ''}">
        <div><strong>${escapeHtml(award.name)}</strong><small>${award.completed ? 'Completed' : escapeHtml(award.kind === 'medal' ? 'Medal' : 'Honor')}</small></div>
        <button data-action="untrack-award" data-award-key="${escapeHtml(awardKey(award.kind, award.id))}" title="Stop tracking">×</button>
        <p>${escapeHtml(award.description || 'Requirement not provided by Torn.')}</p>
        ${awardProgressMarkup(award, { compact: true })}
      </article>`).join('')}</div></section>`;
  }

  function awardsMarkup() {
    const allRows = awardCatalogRows();
    const incomplete = uncompletedAwards();
    const allIncomplete = uncompletedAwards({ collapseProgressions: false });
    const hiddenMilestones = Math.max(0, allIncomplete.length - incomplete.length);
    const meritInfo = state.awards.merits;
    const refreshed = Number(state.awards.playerFetchedAt) > 0 ? new Date(state.awards.playerFetchedAt).toLocaleString() : 'never';
    const activeTrackedAwards = state.settings.trackedAwards.map(awardByKey).filter(Boolean);
    const trackedFull = activeTrackedAwards.length >= TRACKED_AWARD_LIMIT;
    if (!state.settings.apiKey) {
      return '<div class="empty"><strong>Add an API key in Settings.</strong>A Minimal or higher key can load your medals, honors, merits, and finisher counts.<br><button data-action="settings">Open Settings</button></div>';
    }
    if (!allRows.length && state.awardsLoading) return '<div class="empty"><strong>Loading awards…</strong>Torn is returning your completed awards and the award catalog.</div>';
    if (!allRows.length) {
      return `<div class="empty"><strong>Awards have not been loaded.</strong>${escapeHtml(state.awards.error || 'Use Refresh awards to load them.')}<br><button data-action="refresh-awards">Refresh awards</button></div>`;
    }
    return `<section class="awards-view">
      <div class="awards-summary">
        <div><strong>${incomplete.length.toLocaleString()}</strong><span>next goals shown</span></div>
        <div><strong>${Number(meritInfo?.available || 0).toLocaleString()}</strong><span>unspent merits</span></div>
        <div><strong>${activeTrackedAwards.length}/${TRACKED_AWARD_LIMIT}</strong><span>tracked</span></div>
      </div>
      <div class="awards-controls">
        <label>Show <select data-field="award-type-filter">${awardFilterOptionsMarkup()}</select></label>
        <span>Updated ${escapeHtml(refreshed)}${hiddenMilestones ? ` · ${hiddenMilestones.toLocaleString()} later milestone${hiddenMilestones === 1 ? '' : 's'} hidden` : ''}</span>
        <button data-action="refresh-awards" ${state.awardsLoading ? 'disabled' : ''}>${state.awardsLoading ? 'Refreshing…' : 'Refresh awards'}</button>
      </div>
      ${state.awards.error ? `<div class="awards-error">${escapeHtml(state.awards.error)}</div>` : ''}
      <div class="award-list">${incomplete.map((award) => {
        const key = awardKey(award.kind, award.id);
        const tracked = state.settings.trackedAwards.includes(key);
        return `<article class="award-card ${tracked ? 'tracked' : ''}">
          <div class="award-card-head"><div><strong>${escapeHtml(award.name)}</strong><small>${escapeHtml(award.kind === 'medal' ? 'Medal' : 'Honor')}${award?.type?.title ? ` · ${escapeHtml(award.type.title)}` : ''}</small></div><button data-action="${tracked ? 'untrack-award' : 'track-award'}" data-award-key="${escapeHtml(key)}" ${!tracked && trackedFull ? 'disabled title="Untrack an award first; the dashboard shows up to three."' : ''}>${tracked ? 'Tracking' : 'Track'}</button></div>
          <p>${escapeHtml(award.description || 'Requirement not provided by Torn.')}</p>
          ${awardProgressMarkup(award)}
        </article>`;
      }).join('') || '<div class="empty"><strong>Nothing left in this filter.</strong>Every award in this category is complete.</div>'}</div>
    </section>`;
  }

  function dollarBazaarHref(playerId) {
    const url = new URL('https://www.torn.com/bazaar.php');
    url.searchParams.set('userId', String(Math.trunc(Number(playerId))));
    url.hash = '/';
    return url.toString();
  }

  function dollarBazaarsMarkup() {
    const rows = state.dollarBazaarCache.bazaars || [];
    const refreshed = Number(state.dollarBazaarCache.fetchedAt) > 0
      ? new Date(state.dollarBazaarCache.fetchedAt).toLocaleString()
      : 'never';
    const sourceUrl = state.dollarBazaarCache.sourceUrl || 'https://weav3r.dev/dollar-bazaars';
    return `<section class="dollar-bazaars-view">
      <div class="dollar-bazaars-controls">
        <div><strong>Weaver $1 Bazaars</strong><small>${rows.length.toLocaleString()} Bazaar link${rows.length === 1 ? '' : 's'} · updated ${escapeHtml(refreshed)}</small></div>
        <button data-action="refresh-dollar-bazaars" ${state.dollarBazaarLoading ? 'disabled' : ''}>${state.dollarBazaarLoading ? 'Polling…' : 'Poll now'}</button>
      </div>
      ${state.dollarBazaarError ? `<div class="awards-error">${escapeHtml(state.dollarBazaarError)}</div>` : ''}
      <div class="dollar-bazaar-list">${rows.map((row) => `
        <article class="dollar-bazaar-row">
          <a href="${escapeHtml(dollarBazaarHref(row.playerId))}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.playerName)} [${row.playerId}]</a>
          <span>${row.itemCount.toLocaleString()} item${row.itemCount === 1 ? '' : 's'}</span>
          <strong>${row.totalValue > 0 ? `$${row.totalValue.toLocaleString()}` : 'Value unavailable'}</strong>
          ${row.updatedAt > 0 ? `<small>Checked ${escapeHtml(new Date(row.updatedAt).toLocaleString())}</small>` : ''}
        </article>
      `).join('') || `<div class="empty"><strong>${state.dollarBazaarLoading ? 'Polling TornW3B…' : 'No $1 Bazaars loaded.'}</strong>${state.dollarBazaarLoading ? 'Waiting for Weaver’s current Bazaar list.' : 'Use Poll now to load up to 50 active Bazaar links.'}</div>`}</div>
      <div class="dollar-bazaars-source"><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Open the full TornW3B Dollar Bazaars page</a><small>This uses Weaver, not your Torn API quota. Availability restrictions are only known after opening a Bazaar.</small></div>
    </section>`;
  }

  async function refreshAwards({ forceCatalog = false } = {}) {
    if (state.awardsLoading) return;
    dashboardNetworkLease?.refresh?.();
    if (!ownsDashboardNetworkLease()) {
      state.awards.error = 'Another Torn tab currently owns Dashboard API polling. Focus this tab and try again.';
      render();
      return;
    }
    if (!state.settings.apiKey) {
      state.awards.error = 'Add a Torn API key in Settings.';
      render();
      return;
    }
    state.awardsLoading = true;
    state.awards.error = '';
    render();
    const catalogDue = forceCatalog || !state.awards.catalogMedals.length || !state.awards.catalogHonors.length
      || Date.now() - Number(state.awards.catalogFetchedAt) >= AWARD_CATALOG_MAX_AGE_MS;
    const requests = [
      api('user', { selections: 'profile,medals,honors,merits,personalstats', cat: 'all' }, { priority: 'high' }),
      catalogDue ? api('torn', { selections: 'medals,honors' }, { priority: 'normal' }) : Promise.resolve(null),
    ];
    const [playerResult, catalogResult] = await Promise.allSettled(requests);
    const errors = [];
    if (playerResult.status === 'fulfilled') {
      const body = playerResult.value;
      state.awards.medals = Array.isArray(body?.medals) ? body.medals : [];
      state.awards.honors = Array.isArray(body?.honors) ? body.honors : [];
      state.awards.merits = body?.merits && typeof body.merits === 'object' ? body.merits : null;
      state.awards.profile = awardProfileFromBody(body);
      state.awards.userId = state.awards.profile.id;
      state.awards.personalStats = numericPersonalStats(body);
      state.awards.finishingHits = finishingHitsFromPersonalStats(body);
      state.awards.playerFetchedAt = Date.now();
    } else if (!isDashboardOwnerPause(playerResult.reason)) {
      errors.push(playerResult.reason?.message || 'Could not load your completed awards.');
    }
    if (catalogResult.status === 'fulfilled' && catalogResult.value) {
      const body = catalogResult.value;
      state.awards.catalogMedals = Array.isArray(body?.medals) ? body.medals : [];
      state.awards.catalogHonors = Array.isArray(body?.honors) ? body.honors : [];
      state.awards.catalogFetchedAt = Date.now();
    } else if (catalogResult.status === 'rejected' && !isDashboardOwnerPause(catalogResult.reason)) {
      errors.push(catalogResult.reason?.message || 'Could not load the award catalog.');
    }
    state.awards.error = errors.join(' ');
    state.awardsLoading = false;
    if (pruneUnavailableTrackedAwards()) saveSettings();
    saveAwardCache();
    render();
  }

  function cityItemsRemainingToday() {
    const cityNow = numberFromPersonalStats(state.data.cityItemsNow);
    const cityAtReset = numberFromPersonalStats(state.data.cityItemsAtReset);
    if (cityNow === null || cityAtReset === null) return null;
    return Math.max(0, 100 - Math.max(0, cityNow - cityAtReset));
  }

  function cityShopTargetStock(body) {
    const found = new Map();
    const targetById = new Map(CITY_SHOP_TARGETS.map((target) => [target.id, target]));
    const targetByName = new Map(CITY_SHOP_TARGETS.map((target) => [target.name.toLowerCase(), target]));
    const visited = new Set();

    function visit(value, key = '', depth = 0) {
      if (!value || typeof value !== 'object' || depth > 10 || visited.has(value)) return;
      visited.add(value);
      const rawName = String(value.name ?? value.item_name ?? value.itemName ?? value.title ?? '').trim();
      const rawId = Number(value.item_id ?? value.itemID ?? value.id ?? key);
      const target = targetById.get(rawId) || targetByName.get(rawName.toLowerCase());
      if (target) {
        const stockValue = [value.stock, value.quantity, value.amount, value.available, value.in_stock]
          .find((candidate) => candidate !== '' && candidate !== null && candidate !== undefined && Number.isFinite(Number(candidate)));
        const stock = stockValue === undefined ? null : Math.max(0, Number(stockValue));
        const previous = found.get(target.id);
        if (!previous || previous.stock === null || stock !== null) found.set(target.id, { ...target, stock });
      }
      Object.entries(value).forEach(([childKey, child]) => visit(child, childKey, depth + 1));
    }

    visit(body);
    return CITY_SHOP_TARGETS.map((target) => found.get(target.id) || { ...target, stock: null });
  }

  function cityShopStockSummary() {
    const response = state.data.cityShops;
    if (!response?.__fetchedAt) return '';
    const rows = cityShopTargetStock(response);
    return rows.map((item) => {
      if (item.stock === null) return `${item.label}: stock unavailable`;
      return item.stock > 0 ? `${item.label}: ${item.stock.toLocaleString()} in stock` : `${item.label}: sold out`;
    }).join(' · ');
  }

  async function refreshCityShopStockIfNeeded({ force = false } = {}) {
    const remaining = cityItemsRemainingToday();
    if (!(remaining > 0)) {
      delete state.data.cityShops;
      delete state.errors.cityShopStock;
      return false;
    }
    const fetchedAt = Number(state.data.cityShops?.__fetchedAt) || 0;
    if (!force && Date.now() - fetchedAt < CITY_SHOP_REFRESH_MS) return true;
    return guardedRequest('cityShopStock', () => apiV1('torn', { selections: 'cityshops' }, { priority: 'low' }), (body) => {
      state.data.cityShops = { ...body, __fetchedAt: Date.now() };
    });
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
    return TornLib.formatHumanDuration(seconds);
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
      const marketType = watchMarketType(watch);
      const response = state.data.market?.[watch.uid];
      const threshold = Number(watch.maxPrice);
      if (marketType === 'points') {
        const listings = pointsMarketListings(response);
        const cheapest = listings.length ? listings.reduce((best, listing) => listing.price < best.price ? listing : best) : null;
        const href = 'https://www.torn.com/pmarket.php';
        return {
          id: `market:${watch.uid}`,
          active: watch.enabled !== false && threshold > 0 && cheapest && cheapest.price <= threshold,
          title: 'Points Market is below your target',
          detail: cheapest ? `Points Market listing - $${cheapest.price.toLocaleString()} per point${cheapest.amount > 0 ? ` x ${cheapest.amount.toLocaleString()} points` : ''} - target $${threshold.toLocaleString()}` : '',
          links: [{ label: 'Open Points Market', href }],
          shareText: cheapest ? `Points Market | $${cheapest.price.toLocaleString()} per point${cheapest.amount > 0 ? ` x ${cheapest.amount.toLocaleString()} points` : ''} | target $${threshold.toLocaleString()} | ${chatAnchor(href, 'Open Points Market')}` : '',
          tone: 'urgent',
        };
      }
      const result = response?.itemmarket;
      const listings = Array.isArray(result?.listings) ? result.listings.filter((listing) => Number.isFinite(Number(listing?.price))) : [];
      const cheapest = listings.length ? listings.reduce((best, listing) => Number(listing.price) < Number(best.price) ? listing : best) : null;
      const itemId = Math.trunc(Number(watch.itemId));
      const name = String(watch.label || result?.item?.name || `Item ${itemId}`);
      const href = `https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${encodeURIComponent(itemId)}`;
      return {
        id: `market:${watch.uid}`,
        active: watch.enabled !== false && itemId > 0 && threshold > 0 && cheapest && Number(cheapest.price) <= threshold,
        title: `Item Market: ${name} is below your target`,
        detail: cheapest ? `Item Market listing - $${Number(cheapest.price).toLocaleString()}${Number(cheapest.amount) > 1 ? ` x ${Number(cheapest.amount).toLocaleString()}` : ''} - target $${threshold.toLocaleString()}` : '',
        links: [{ label: 'Open Item Market', href }],
        shareText: cheapest ? `Item Market | ${escapeHtml(name)} | $${Number(cheapest.price).toLocaleString()}${Number(cheapest.amount) > 0 ? ` x ${Number(cheapest.amount).toLocaleString()}` : ''} | target $${threshold.toLocaleString()} | ${chatAnchor(href, 'Open Item Market')}` : '',
        tone: 'urgent',
      };
    });
  }
  function bazaarAlerts() {
    if (!state.settings.weav3rBazaarEnabled || state.settings.enabled.itemMarket === false) return [];
    return state.settings.marketWatches.flatMap((watch) => {
      if (watchMarketType(watch) !== 'item' || watch.enabled === false || Number(watch.itemId) <= 0 || Number(watch.maxPrice) <= 0) return [];
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
            shareText: `Bazaar | ${escapeHtml(name)} | $${Number(listing.price).toLocaleString()}${Number(listing.quantity) > 0 ? ` x ${Number(listing.quantity).toLocaleString()}` : ''} | target $${threshold.toLocaleString()} | ${chatAnchor(listing.href, `${listing.sellerName}'s Bazaar`)}`,
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
    const cooldowns = resolvedCooldowns();
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
    const clusterRingAchieved = clusterRingAlreadyAchieved();
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
    const cityStockSummary = cityShopStockSummary();
    const medicalThresholdSeconds = cooldownThresholdSeconds('medical');
    const boosterThresholdSeconds = cooldownThresholdSeconds('booster');
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
        timerSeconds: cooldowns?.medical,
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
        timerSeconds: cooldowns?.booster,
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
        detail: boughtInCityToday !== null ? `${boughtInCityToday} / 100 bought since today's Torn reset - ${100 - boughtInCityToday} remaining.${cityStockSummary ? ` ${cityStockSummary}.` : ' Checking Beer, Pepper Spray, and Empty Blood Bag stock.'}` : '',
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
    return TornLib.escapeHtml(value ?? '');
  }

  function chatAnchor(href, label) {
    return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  }

  async function copyAlertText(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    try {
      return await TornLib.copyText(text);
    } catch {
      return false;
    }
  }

  function findFactionChatContainer() {
    const factionWindows = [...document.querySelectorAll('[id^="faction-"]')];
    const exactWindow = factionWindows.find((node) => node.querySelector(
      'textarea[placeholder="Type your message here..."], textarea[class*="textarea"]'
    ));
    if (exactWindow) return exactWindow;

    return [...document.querySelectorAll('div, section')].find((node) => {
      const title = node.querySelector('button span, header span');
      const composer = node.querySelector(
        'textarea[placeholder*="message" i], [contenteditable="true"]'
      );
      return composer && String(title?.textContent || '').trim().toLowerCase() === 'faction';
    }) || null;
  }

  function findFactionChatLauncher() {
    return [...document.querySelectorAll('button, a, [role="button"]')].find((node) => {
      const label = [
        node.getAttribute?.('aria-label'),
        node.getAttribute?.('title'),
        node.textContent,
      ].filter(Boolean).join(' ').trim().toLowerCase();
      return label === 'faction'
        || label.includes('faction chat')
        || label.includes('open faction');
    }) || null;
  }

  function findFactionChatComposer(container) {
    if (!container) return null;
    return container.querySelector(
      'textarea[placeholder="Type your message here..."], '
      + 'textarea[class*="textarea"], '
      + 'textarea, '
      + '[contenteditable="true"]'
    );
  }

  function setFactionChatComposerContent(composer, text) {
    composer.focus();
    if (composer.matches('textarea, input')) {
      const prototype = composer.tagName === 'TEXTAREA'
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) setter.call(composer, text);
      else composer.value = text;
    } else {
      composer.innerHTML = '';
      try {
        document.execCommand('insertHTML', false, text);
      } catch {
        composer.innerHTML = text;
      }
    }

    try {
      composer.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
        data: text,
      }));
    } catch {
      composer.dispatchEvent(new Event('input', {
        bubbles: true,
        composed: true,
      }));
    }
    composer.dispatchEvent(new Event('change', {
      bubbles: true,
      composed: true,
    }));
  }

  function findFactionChatSendButton(container, composer) {
    const composerRow = composer?.parentElement;
    const siblingButton = composerRow?.querySelector('button');
    if (siblingButton) return siblingButton;

    const scope = container || composer?.closest('[id^="faction-"]');
    if (!scope) return null;
    return [...scope.querySelectorAll('button, [role="button"]')].find((button) => {
      const label = [
        button.getAttribute('aria-label'),
        button.getAttribute('title'),
        button.textContent,
      ].filter(Boolean).join(' ').trim().toLowerCase();
      const containsSendIcon = Boolean(button.querySelector('svg[viewBox="0 0 18 18"]'));
      return button.type === 'submit'
        || label === 'send'
        || label.includes('send message')
        || containsSendIcon;
    }) || null;
  }

  async function waitForFactionChat(timeoutMs = 2500) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const container = findFactionChatContainer();
      const composer = findFactionChatComposer(container);
      if (container && composer) return { container, composer };
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { container: null, composer: null };
  }

  async function waitForFactionChatSendButton(container, composer, timeoutMs = 1500) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const button = findFactionChatSendButton(container, composer);
      if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
        return button;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }

  async function sendListingToTornChat(text) {
    if (!focusedTornPage()) return { ok: false, label: 'Focus Torn first' };

    let { container, composer } = await waitForFactionChat(250);
    if (!container || !composer) {
      const launcher = findFactionChatLauncher();
      if (!launcher) return { ok: false, label: 'Faction Chat not found' };
      launcher.click();
      ({ container, composer } = await waitForFactionChat());
    }
    if (!container || !composer) {
      return { ok: false, label: 'Faction message box not found' };
    }

    setFactionChatComposerContent(composer, text);
    const sendButton = await waitForFactionChatSendButton(container, composer);
    if (!sendButton) return { ok: false, label: 'Faction send not ready' };
    if (!focusedTornPage()) return { ok: false, label: 'Focus Torn first' };
    sendButton.click();
    return { ok: true, label: 'Sent to Faction' };
  }

  function chatShareArmed(alertId) {
    const arm = state.chatShareArm;
    if (!arm || arm.alertId !== alertId || arm.expiresAt <= Date.now()) return false;
    return true;
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
    const live = focusedTornPage();
    const ownsNetwork = ownsDashboardNetworkLease();
    const usage = rollingTornApiUsage().length;
    const limit = state.settings.slowApiMode ? API_SLOW_LIMIT : API_HARD_LIMIT;
    const pauseSeconds = Math.max(0, Math.ceil((Number(state.settings.apiPausedUntil) - Date.now()) / 1000));
    const apiMode = !dashboardNetworkLease
      ? 'selecting the single Dashboard polling tab'
      : !ownsNetwork
        ? `${usage}/${limit} shared API calls - another Torn tab owns Dashboard polling`
        : pauseSeconds > 0
      ? `Torn API paused ${formatDuration(pauseSeconds)}`
      : `${state.settings.slowApiMode ? 'slow mode - ' : ''}${usage}/${limit} shared API calls in the last minute`;
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
      const calls = `${state.apiCalls} quota-counted Torn API call${state.apiCalls === 1 ? '' : 's'}${state.cachedMarketCalls ? ` + ${state.cachedMarketCalls} globally cached Item Market request${state.cachedMarketCalls === 1 ? '' : 's'}` : ''}${state.bazaarCalls ? ` + ${state.bazaarCalls} TornW3B check${state.bazaarCalls === 1 ? '' : 's'}` : ''} this page load`;
      const updated = `updated ${age ? `${age}m ago` : 'just now'} - ${calls}`;
      return failures ? `${mode} - ${updated} - ${failures} source warning${failures === 1 ? '' : 's'}` : `${mode} - ${updated}`;
    }
    return `${mode} - waiting for the first refresh...`;
  }

  function soundsMuted() {
    return state.settings.muteSounds === true;
  }

  function ensureAudioContext() {
    if (soundsMuted()) return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    state.audioContext ||= new AudioContextClass();
    if (state.audioContext.state === 'suspended') state.audioContext.resume().catch(() => {});
    return state.audioContext;
  }

  function playAlarmSound() {
    if (soundsMuted()) return;
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
    if (soundsMuted()) return;
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
    if (soundsMuted()) return;
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

  function alertNavigationLinks(alert) {
    return (alert.links || [{ label: 'Open', href: alert.href }]).filter((link) => link?.href);
  }

  function primaryAlertLink(alert) {
    return alertNavigationLinks(alert)[0]?.href || '';
  }

  function usesLinkedAlertTitle(alert) {
    const id = String(alert?.id || '');
    return id.startsWith('market:') || id.startsWith('bazaar:');
  }

  function alertTitleMarkup(alert) {
    const title = escapeHtml(alert.title);
    const href = usesLinkedAlertTitle(alert) ? primaryAlertLink(alert) : '';
    return href
      ? `<a class="alert-title-link" data-tdd-nav href="${escapeHtml(href)}">${title}</a>`
      : title;
  }

  function alertActionLinks(alert) {
    const links = alertNavigationLinks(alert);
    return usesLinkedAlertTitle(alert) ? links.slice(1) : links;
  }

  function pushBrowserNotifications(alerts) {
    if (!browserNotificationsEnabled() || !ownsDashboardNetworkLease()) return;
    const selected = alerts.slice(0, 3);
    selected.forEach((alert) => {
      try {
        const notification = new Notification(`Torn: ${alert.title}`, {
          body: alert.detail || 'Daily Dashboard reminder',
          tag: `tdd-${alert.id}`,
          renotify: true,
          silent: soundsMuted(),
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
          silent: soundsMuted(),
        });
      } catch {
        // Some mobile browsers expose permission but require service-worker notifications.
      }
    }
  }

  function maybeAlarm() {
    if (!ownsDashboardNetworkLease() || !state.alertSnapshotReady) return;
    const active = publishedAlerts().filter(alertVisible);
    if (!active.length) return;
    const now = Date.now();
    let historyChanged = false;
    let needsRender = false;
    const normal = active.filter((alert) => !['landing', 'turtle'].includes(alert.id));
    const generalSoundEnabled = state.settings.soundAlarm && !soundsMuted();
    const landingSoundEnabled = state.settings.landingSoundAlarm && !soundsMuted();
    const turtleSoundEnabled = state.settings.turtleSoundAlarm && !soundsMuted();
    if (normal.length && (state.settings.flashAlarm || generalSoundEnabled || browserNotificationsEnabled())) {
      const interval = Math.max(1, Number(state.settings.alarmIntervalMinutes) || 1) * 60_000;
      const dueAlerts = normal.filter((alert) => now - (Number(state.settings.alarmHistory[alert.id]) || 0) >= interval);
      if (dueAlerts.length) {
        dueAlerts.forEach((alert) => { state.settings.alarmHistory[alert.id] = now; });
        historyChanged = true;
        if (state.settings.flashAlarm) {
          state.flashUntil = now + 6_000;
          needsRender = true;
        }
        if (generalSoundEnabled) playAlarmSound();
        pushBrowserNotifications(dueAlerts);
      }
    }
    const landing = active.find((alert) => alert.id === 'landing');
    if (landing && (state.settings.landingFlashAlarm || landingSoundEnabled || browserNotificationsEnabled())) {
      const interval = Math.max(1, Number(state.settings.landingAlarmIntervalMinutes) || 1) * 60_000;
      if (now - (Number(state.settings.alarmHistory.landing) || 0) >= interval) {
        state.settings.alarmHistory.landing = now;
        historyChanged = true;
        if (state.settings.landingFlashAlarm) {
          state.landingFlashUntil = now + 8_000;
          needsRender = true;
        }
        if (landingSoundEnabled) playLandingSound();
        pushBrowserNotifications([landing]);
      }
    }
    const turtle = active.find((alert) => alert.id === 'turtle');
    if (turtle && (state.settings.turtleFlashAlarm || turtleSoundEnabled || browserNotificationsEnabled())) {
      const interval = Math.max(1, Number(state.settings.turtleAlarmIntervalMinutes) || 1) * 60_000;
      if (now - (Number(state.settings.alarmHistory.turtle) || 0) >= interval) {
        state.settings.alarmHistory.turtle = now;
        historyChanged = true;
        if (state.settings.turtleFlashAlarm) {
          state.turtleFlashUntil = now + 9_000;
          needsRender = true;
        }
        if (turtleSoundEnabled) playTurtleSound();
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

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  function exportApiLedgerCsv() {
    const events = tornApiDiagnostics().events;
    const headers = ['requested_at', 'script', 'method', 'endpoint', 'request_class', 'counts_toward_local_quota', 'priority', 'result', 'http_status', 'torn_error_code', 'torn_error_message', 'duration_ms', 'tab_session'];
    const rows = events.map((event) => [
      new Date(Number(event.at) || 0).toISOString(),
      event.script,
      event.method,
      event.endpoint,
      event.quotaClass || (event.quotaExempt ? 'globally-cached' : 'quota'),
      event.quotaExempt ? 'no' : 'yes',
      event.priority,
      event.result,
      event.status || '',
      event.apiErrorCode || '',
      event.apiErrorMessage || '',
      event.durationMs || '',
      event.tabId,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    downloadTextFile(`torn-api-ledger-${new Date().toISOString().replaceAll(':', '-')}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function apiLedgerMarkup() {
    const diagnostics = tornApiDiagnostics();
    const events = diagnostics.events;
    const minuteUsage = TornLib.getTornApiUsage({ limit: state.settings.slowApiMode ? API_SLOW_LIMIT : API_HARD_LIMIT });
    const minuteEvents = events.filter((event) => Number(event.at) > Date.now() - 60_000);
    const quotaEvents = minuteEvents.filter((event) => !event.quotaExempt);
    const cachedItemEvents = minuteEvents.filter((event) => event.quotaExempt && event.quotaClass === 'globally-cached-itemmarket');
    const legacyUnattributed = Math.max(0, minuteUsage.count - quotaEvents.length);
    const groupedRows = (source) => {
      const groups = {};
      source.forEach((event) => {
        const label = `${event.script} :: ${event.method || 'GET'} ${event.endpoint || 'Unknown endpoint'}`;
        groups[label] = (groups[label] || 0) + 1;
      });
      return Object.entries(groups).sort((left, right) => right[1] - left[1]).map(([label, count]) => `<li><strong>${count}×</strong> <code>${escapeHtml(label)}</code></li>`).join('');
    };
    const quotaRows = groupedRows(quotaEvents);
    const cachedRows = groupedRows(cachedItemEvents);
    const recentRows = [...events].reverse().slice(0, 100).map((event) => {
      const time = new Date(Number(event.at) || 0).toLocaleTimeString();
      const tab = String(event.tabId || '').slice(-6) || 'legacy';
      const requestClass = event.quotaExempt ? 'cached / quota-exempt' : 'quota';
      const error = event.apiErrorCode ? ` · Torn error ${event.apiErrorCode}: ${event.apiErrorMessage || 'Unknown error'}` : '';
      return `<li><strong>${escapeHtml(time)}</strong> ${escapeHtml(event.script)} · <code>${escapeHtml(event.method)} ${escapeHtml(event.endpoint)}</code> · ${escapeHtml(requestClass)} · ${escapeHtml(event.result || 'Pending')}${escapeHtml(error)} · tab ${escapeHtml(tab)}</li>`;
    }).join('');
    const mainOpen = state.settings.settingsSections?.apiLedger ? 'open' : '';
    const recentOpen = state.settings.settingsSections?.apiLedgerRecent ? 'open' : '';
    return `<details class="api-ledger-details" data-settings-section="apiLedger" ${mainOpen}><summary>API request ledger · ${minuteUsage.count} quota reservations last minute</summary><p>Every Dashboard Torn API request, including Item Market checks, reserves a slot in Core's shared limiter. Item Market calls are counted conservatively because the response does not reliably prove that Torn served a quota-free cache hit. Endpoint query values and API keys are never stored. The detailed endpoint breakdown comes from the diagnostic log so older Core instances cannot erase its metadata.</p>${quotaRows ? `<strong>Quota-counted requests in the last minute</strong><ol class="api-ledger-list">${quotaRows}</ol>` : '<p>No detailed quota-counted requests in the last minute.</p>'}${legacyUnattributed ? `<p><strong>${legacyUnattributed} legacy/unattributed limiter reservation${legacyUnattributed === 1 ? '' : 's'}</strong> are included in the quota total but were written without detailed metadata.</p>` : ''}${cachedRows ? `<strong>Legacy quota-exempt Item Market requests still in the 15-minute log</strong><ol class="api-ledger-list">${cachedRows}</ol>` : ''}${recentRows ? `<details class="api-ledger-recent" data-settings-section="apiLedgerRecent" ${recentOpen}><summary>Most recent 100 requests</summary><ol class="api-ledger-list">${recentRows}</ol></details>` : ''}<div class="settings-actions"><button data-action="export-api-ledger">Export ledger CSV</button><button data-action="clear-api-ledger" class="subtle">Clear 15-minute history</button></div><small>This cannot see calls from extensions, other browsers/devices, or non-Torn services such as TornW3B.</small></details>`;
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
      const marketType = watchMarketType(watch);
      const isPoints = marketType === 'points';
      const selected = state.itemCatalog.items.find((item) => item.id === Math.trunc(Number(watch.itemId)));
      const type = selected?.type || watch.catalogType || '';
      const itemId = Math.trunc(Number(watch.itemId));
      const estimate = Number(selected?.marketPrice ?? watch.marketEstimate) || 0;
      const pawnSellPrice = Number(selected?.sellPrice ?? watch.pawnSellPrice) || 0;
      const itemMeta = isPoints
        ? 'Alert when the cheapest listing reaches your maximum price per point'
        : itemId > 0 ? `${type ? `${type} · ` : ''}ID ${itemId}${estimate ? ` · Torn value ~$${estimate.toLocaleString()}` : ''}${pawnSellPrice ? ` · sell-back $${pawnSellPrice.toLocaleString()}` : ''}` : 'Choose an item from the search results';
      return `
      <div class="market-watch" data-market-watch="${escapeHtml(watch.uid)}">
        <input type="checkbox" data-watch-field="enabled" data-watch-uid="${escapeHtml(watch.uid)}" ${watch.enabled !== false && state.settings.enabled[`market:${watch.uid}`] !== false ? 'checked' : ''} title="Enable this watch">
        <label class="market-item-search">
          <select class="market-source-select" data-watch-field="marketType" data-watch-uid="${escapeHtml(watch.uid)}" aria-label="Market source">
            <option value="item" ${marketType === 'item' ? 'selected' : ''}>Item Market</option>
            <option value="points" ${marketType === 'points' ? 'selected' : ''}>Points Market</option>
          </select>
          ${isPoints
            ? '<span class="points-watch-name">Points</span>'
            : `<input type="text" list="tdd-market-items" data-market-search data-watch-uid="${escapeHtml(watch.uid)}" value="${escapeHtml(watch.searchText ?? watch.label ?? '')}" placeholder="Search item name" autocomplete="off" aria-label="Search Torn items">`}
          <small>${escapeHtml(itemMeta)}</small>
        </label>
        <input type="number" min="1" step="1" data-watch-field="maxPrice" data-watch-uid="${escapeHtml(watch.uid)}" value="${escapeHtml(watch.maxPrice || '')}" placeholder="${isPoints ? 'Max $ / point' : 'Max price'}" aria-label="${isPoints ? 'Maximum price per point' : 'Maximum item price'}">
        <select class="market-priority-select" data-watch-field="priority" data-watch-uid="${escapeHtml(watch.uid)}" aria-label="Watch priority" title="High every 20s up to 60/min; Normal every 40s below 50/min; Low every 80s below 40/min" ${isPoints ? 'disabled' : ''}>
          ${['high', 'normal', 'low'].map((priority) => `<option value="${priority}" ${normalizedMarketPriority(watch.priority) === priority ? 'selected' : ''}>${priority[0].toUpperCase()}${priority.slice(1)}</option>`).join('')}
        </select>
        <button data-action="remove-market-watch" data-watch-uid="${escapeHtml(watch.uid)}" title="Remove watch">x</button>
      </div>
    `;
    }).join('');
    const sectionOpen = (name) => state.settings.settingsSections?.[name] ? 'open' : '';
    const pawnTrackedIds = new Set(state.settings.marketWatches.filter((watch) => watchMarketType(watch) === 'item').map((watch) => Math.trunc(Number(watch.itemId))));
    const pawnCapacity = pawnShopWatchCapacity();
    const pawnRows = state.pawnShopCandidates.map((item) => {
      const tracked = pawnTrackedIds.has(item.id);
      const checked = state.pawnShopCandidateSelection.has(item.id);
      const weav3r = Number(item.bazaarCount) > 0
        ? `${Number(item.bazaarCount).toLocaleString()} bazaar${Number(item.bazaarCount) === 1 ? '' : 's'}${Number(item.bazaarAvgPrice) ? ` · avg $${Number(item.bazaarAvgPrice).toLocaleString()}` : ''}`
        : 'No TornW3B bazaar summary';
      const vendor = [item.vendorName, item.vendorCountry].filter(Boolean).join(' · ');
      return `<label class="pawn-candidate ${tracked ? 'tracked' : ''}">
        <input type="checkbox" data-pawn-candidate-id="${item.id}" ${checked ? 'checked' : ''} ${tracked ? 'disabled' : ''}>
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(`${item.type} · ID ${item.id}${vendor ? ` · ${vendor}` : ''}${tracked ? ' · already watched' : ''}`)}</small></span>
        <span class="pawn-values"><strong>Sell $${Number(item.sellPrice).toLocaleString()}</strong><small>${escapeHtml(weav3r)}</small></span>
      </label>`;
    }).join('');
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
          <strong>Shared Torn API: ${rollingTornApiUsage().length} / ${state.settings.slowApiMode ? API_SLOW_LIMIT : API_HARD_LIMIT} calls in the last minute</strong>
          <label><input type="checkbox" data-field="slow-api-mode" ${state.settings.slowApiMode ? 'checked' : ''}> Slow API mode (30/min ceiling; low-priority checks yield first)</label>
          <label>Pause Torn API
            <select data-field="api-pause-duration">
              ${[[5, '5 min'], [15, '15 min'], [30, '30 min'], [60, '1 hour'], [240, '4 hours']].map(([minutes, label]) => `<option value="${minutes}">${label}</option>`).join('')}
            </select>
          </label>
          <button data-action="pause-api">Pause</button>
          ${Number(state.settings.apiPausedUntil) > Date.now() ? `<button data-action="resume-api">Resume now (${formatDuration(Math.ceil((Number(state.settings.apiPausedUntil) - Date.now()) / 1000))})</button>` : ''}
          <small>Core Lib coordinates Torn API requests made by this dashboard, Ranked War Panel, and Retaliation Monitor on this browser profile and Torn origin. External apps, extensions, other devices, and TornW3B cannot be counted.</small>
          ${apiLedgerMarkup()}
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
            <span>Other slow-data refresh</span>
            <select data-field="api-refresh-minutes">
              ${[5, 10, 15, 30].map((minutes) => `<option value="${minutes}" ${Number(state.settings.apiDailyRefreshMinutes) === minutes ? 'selected' : ''}>${minutes} minutes</option>`).join('')}
            </select>
          </label>
          <p><small>Fallback cadence: nerve 5 min; energy and cooldowns 10 min; education and organized crime 7 min; race and travel 3 min. Successful responses postpone the next call until their returned full-time, cooldown, education, OC, travel, race, or Torn-reset transition. Related selections are combined whenever they are due together.</small></p>
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
              <input type="number" min="1" max="300" step="1" data-field="pickpocket-min-level" value="${Number(state.settings.pickpocketMinTargetLevel)}">
            </label>
            <label>Maximum target
              <input type="number" min="1" max="300" step="1" data-field="pickpocket-max-level" value="${Number(state.settings.pickpocketMaxTargetLevel)}">
            </label>
            <small>Last focused-page skill: ${Number(state.settings.pickpocketLastSkill || 1)} · currently formatted: ${Number(state.pickpocketFormattedCount || 0)} targets. No API calls.</small>
          </div>
        </details>
        <details class="settings-group" data-settings-section="alarms" ${sectionOpen('alarms')}>
          <summary>Alarm behavior</summary>
          <p>These options repeat for any active, unsnoozed reminder except Landing and Turtle, which have separate sounds and timing under Thresholds.</p>
          <div class="alarm-settings">
            <label><input type="checkbox" data-field="mute-sounds" ${state.settings.muteSounds ? 'checked' : ''}> Mute all dashboard sounds</label>
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
        <details class="settings-group market-settings" data-settings-section="marketWatches" ${sectionOpen('marketWatches')}>
          <summary>Market watches · ${state.settings.marketWatches.length}/${MARKET_WATCH_LIMIT}</summary>
          <p>Choose Item Market or Points Market, then set the maximum price that should trigger an alert.</p>
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
          <div class="market-head"><span></span><span>Market / item</span><span>Max price</span><span>Priority</span><span></span></div>
          ${marketRows || '<div class="market-empty">No watched items yet.</div>'}
          <div class="market-controls">
            <button data-action="add-market-watch" ${state.settings.marketWatches.length >= MARKET_WATCH_LIMIT ? 'disabled' : ''}>${state.settings.marketWatches.length >= MARKET_WATCH_LIMIT ? `${MARKET_WATCH_LIMIT} watch limit` : `Add watch (${state.settings.marketWatches.length}/${MARKET_WATCH_LIMIT})`}</button>
            <label>Torn market polling
              <select data-field="market-refresh-minutes">
                <option value="cache-aligned" ${state.settings.marketRefreshMode === 'cache-aligned' ? 'selected' : ''}>Torn cache-aligned / points 30s</option>
                ${[1, 2, 5, 10].map((minutes) => `<option value="${minutes}" ${state.settings.marketRefreshMode !== 'cache-aligned' && Number(state.settings.marketRefreshMinutes) === minutes ? 'selected' : ''}>${minutes} min</option>`).join('')}
              </select>
            </label>
          </div>
          <p class="priority-note"><strong>Priority:</strong> Each Item Market watch follows Torn's returned cache timestamp and delay, then checks one second after that cache should refresh. If Torn still returns the same timestamp, it retries after 2–5 seconds. High, Normal, and Low determine quota order and headroom; a watch at or below its alert price temporarily becomes High. Each response is limited to the five cheapest listings, and every Torn Item Market check counts in Core's shared API ledger.</p>
          <div class="bazaar-controls">
            <label><input type="checkbox" data-field="weav3r-bazaar-enabled" ${state.settings.weav3rBazaarEnabled ? 'checked' : ''}> Check TornW3B bazaars</label>
            <span>High 10s · Normal 30s · Low 60s; four at a time with rate-limit backoff</span>
          </div>
          <p class="third-party-note">Optional third-party source for Item Market watches only: sends watched item IDs to weav3r.dev. Your Torn API key is never sent. Bazaar results have their own per-seller 1h/1d snoozes.</p>
          <details class="pawn-shop-builder" data-settings-section="pawnShopBuilder" ${sectionOpen('pawnShopBuilder')}>
            <summary>Travel contraband / city-shop profit builder</summary>
            <p>Build up to ${MARKET_WATCH_LIMIT} watches from Torn's official 23 travel-contraband items, limited to goods that currently have a city-shop sell-back value. This includes Insulin, Bear Gall, Shark Fin, Turtle Shell, Pangolin Scales, Tiger Bone Powder, and the other recent imports. TornW3B statistics are added when its checkbox above is enabled.</p>
            <div class="pawn-builder-controls">
              <label>Minimum profit margin
                <span><input type="number" min="0" max="99" step="1" data-field="pawn-shop-margin" value="${escapeHtml(state.settings.pawnShopMarginPercent)}">%</span>
              </label>
              <label>New-watch priority
                <select data-field="pawn-shop-priority">
                  ${['high', 'normal', 'low'].map((priority) => `<option value="${priority}" ${normalizedMarketPriority(state.settings.pawnShopPriority) === priority ? 'selected' : ''}>${priority[0].toUpperCase()}${priority.slice(1)}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="settings-actions pawn-actions">
              <button data-action="load-pawn-shop-candidates" ${state.pawnShopCandidatesLoading || !state.settings.apiKey ? 'disabled' : ''}>${state.pawnShopCandidatesLoading ? 'Loading...' : state.pawnShopCandidates.length ? 'Refresh candidates' : 'Load candidates'}</button>
              <button data-action="select-top-pawn-shop" class="subtle" ${!state.pawnShopCandidates.length || !pawnCapacity ? 'disabled' : ''}>Select top ${pawnCapacity}</button>
              <button data-action="clear-pawn-shop-selection" class="subtle" ${!state.pawnShopCandidateSelection.size ? 'disabled' : ''}>Clear selection</button>
              <button data-action="add-pawn-shop-watches" ${!state.pawnShopCandidateSelection.size || !pawnCapacity ? 'disabled' : ''}>Add selected (${state.pawnShopCandidateSelection.size})</button>
            </div>
            <p class="pawn-status">${escapeHtml(state.pawnShopStatus || `${pawnCapacity} watch slots available.`)}</p>
            ${pawnRows ? `<div class="pawn-candidate-list">${pawnRows}</div>` : '<div class="market-empty">Load the current travel-contraband list to review city-shop profit candidates.</div>'}
          </details>
        </details>
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
    const previousPawnList = shadow.querySelector('.pawn-candidate-list');
    const previousScrollTop = previousBody?.scrollTop || 0;
    const previousScrollLeft = previousBody?.scrollLeft || 0;
    const previousPawnScrollTop = previousPawnList?.scrollTop || 0;
    const previousPawnScrollLeft = previousPawnList?.scrollLeft || 0;
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
        :host { all: initial; color-scheme: dark; overflow-anchor: none; }
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
        .view-button { height: 26px; padding: 0 8px; color: #d7e7f2; font-size: 11px; font-weight: 750; }
        .view-button.active { border-color: rgba(113,214,155,.58); color: #dff8e9; background: #234134; }
        .body { min-height: 0; max-height: min(72vh, 700px); overflow: auto; overflow-anchor: none; }
        .panel.user-sized .body { flex: 1 1 auto; max-height: none; }
        .status { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 7px 10px; color: #aeb7c1; border-bottom: 1px solid rgba(255,255,255,.08); font-size: 12px; }
        .status span { flex: 1; }
        .status button { padding: 3px 8px; font-size: 11px; }
        .toolbar { display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .toolbar button { flex: 1; padding: 5px 6px; font-size: 11px; }
        .empty { padding: 22px 16px; text-align: center; color: #aeb7c1; }
        .empty strong { display: block; margin-bottom: 3px; color: #e7ecef; }
        .empty button { margin-top: 9px; padding: 5px 9px; }
        .alert { display: grid; grid-template-columns: 8px minmax(0,1fr) auto; gap: 9px; align-items: center; padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,.075); }
        .alert:last-child { border-bottom: 0; }
        .tone { width: 8px; height: 34px; border-radius: 99px; background: #ffca55; }
        .urgent .tone { background: #ff6868; }
        .ready .tone { background: #65d69b; }
        .landing .tone { background: #58b9ff; }
        .turtle .tone { background: #ff9a3d; }
        .alert-copy { min-width: 0; }
        .alert-title { color: #f5f7f9; font-weight: 700; }
        .alert-title-link { color: inherit; text-decoration: underline; text-decoration-color: rgba(143,208,255,.55); text-decoration-thickness: 1px; text-underline-offset: 2px; }
        .alert-title-link:hover, .alert-title-link:focus-visible { color: #8fd0ff; text-decoration-color: currentColor; }
        .alert-detail { margin-top: 2px; overflow: hidden; color: #aeb7c1; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
        .alert-actions { display: flex; align-items: center; gap: 4px; }
        .alert-actions a, .alert-actions button { min-width: 29px; height: 25px; padding: 3px 6px; text-align: center; text-decoration: none; }
        .alert-actions a { border: 1px solid rgba(255,255,255,.14); border-radius: 7px; color: #fff; background: #3e6b8f; font: 700 11px/17px system-ui, sans-serif; }
        .alert-actions button { color: #c9d0d7; font-size: 10px; }
        .market-listing-alert { min-height: 78px; grid-template-columns: 8px minmax(0,1fr); grid-template-rows: auto auto; align-items: stretch; }
        .market-listing-alert .tone { grid-row: 1 / span 2; height: auto; min-height: 58px; align-self: stretch; }
        .market-listing-alert .alert-copy { align-self: start; }
        .market-listing-alert .alert-title { overflow-wrap: anywhere; }
        .market-listing-alert .alert-detail { display: -webkit-box; overflow: hidden; white-space: normal; line-height: 1.35; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
        .market-listing-alert .alert-actions { grid-column: 2; flex-wrap: wrap; justify-content: flex-start; align-self: end; }
        .tracked-awards { padding: 9px 10px 11px; border-top: 1px solid rgba(255,255,255,.09); background: #1d2227; }
        .tracked-awards-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; color: #e9eef2; }
        .tracked-awards-head button { width: 28px; height: 24px; padding: 0; }
        .tracked-award-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 7px; }
        .tracked-award { min-width: 0; display: grid; grid-template-columns: minmax(0,1fr) 22px; align-content: start; gap: 4px; padding: 8px; border: 1px solid rgba(102,178,232,.27); border-radius: 8px; background: #202b34; }
        .tracked-award.completed { border-color: rgba(101,214,155,.45); background: #203129; }
        .tracked-award > div:first-child { min-width: 0; }
        .tracked-award strong, .tracked-award small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tracked-award small { margin-top: 2px; color: #8fa0ac; font-size: 9px; text-transform: uppercase; }
        .tracked-award > button { width: 22px; height: 22px; padding: 0; color: #cbd2d8; }
        .tracked-award > p { grid-column: 1 / -1; margin: 2px 0 0; display: -webkit-box; overflow: hidden; color: #b5c0c8; font-size: 10px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
        .awards-view { min-height: 0; }
        .awards-summary { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; padding: 10px; border-bottom: 1px solid rgba(255,255,255,.08); background: #1d2227; }
        .awards-summary > div { padding: 8px; text-align: center; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: #272d33; }
        .awards-summary strong, .awards-summary span { display: block; }
        .awards-summary strong { color: #f3f6f8; font-size: 17px; }
        .awards-summary span { margin-top: 2px; color: #96a2ac; font-size: 9px; text-transform: uppercase; }
        .awards-controls { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.08); color: #9eabb4; font-size: 10px; }
        .awards-controls label { display: flex; align-items: center; gap: 5px; }
        .awards-controls select { padding: 4px 6px; color: #eef2f5; background: #111418; }
        .awards-controls span { min-width: 0; flex: 1; text-align: right; }
        .awards-controls button { padding: 5px 8px; white-space: nowrap; }
        .awards-error { margin: 8px 10px 0; padding: 7px 8px; border: 1px solid rgba(255,104,104,.35); border-radius: 7px; color: #ffc0c0; background: #3a2525; font-size: 10px; }
        .award-list { min-height: 0; }
        .dollar-bazaars-view { min-height: 0; }
        .dollar-bazaars-controls { display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid rgba(255,255,255,.08); background: #1d2227; }
        .dollar-bazaars-controls > div { min-width: 0; flex: 1; }
        .dollar-bazaars-controls strong, .dollar-bazaars-controls small { display: block; }
        .dollar-bazaars-controls small { margin-top: 2px; color: #96a2ac; font-size: 9px; }
        .dollar-bazaars-controls button { white-space: nowrap; }
        .dollar-bazaar-list { min-height: 0; }
        .dollar-bazaar-row { display: grid; grid-template-columns: minmax(145px,1fr) auto auto; gap: 4px 9px; align-items: center; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.075); }
        .dollar-bazaar-row > a { min-width: 0; overflow: hidden; color: #8dc8ed; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
        .dollar-bazaar-row > span { color: #aab5bd; font-size: 10px; white-space: nowrap; }
        .dollar-bazaar-row > strong { color: #8fe0af; font-size: 11px; text-align: right; white-space: nowrap; }
        .dollar-bazaar-row > small { grid-column: 1 / -1; color: #77858f; font-size: 9px; }
        .dollar-bazaars-source { display: grid; gap: 3px; padding: 9px 10px; color: #8d9aa3; background: #1d2227; font-size: 9px; }
        .dollar-bazaars-source a { color: #8dc8ed; }
        .award-card { padding: 10px; border-bottom: 1px solid rgba(255,255,255,.075); }
        .award-card.tracked { background: rgba(55,101,132,.16); }
        .award-card-head { display: flex; align-items: flex-start; gap: 8px; }
        .award-card-head > div { min-width: 0; flex: 1; }
        .award-card-head strong, .award-card-head small { display: block; }
        .award-card-head strong { color: #f3f6f8; }
        .award-card-head small { margin-top: 2px; color: #8fa0ac; font-size: 9px; text-transform: uppercase; }
        .award-card-head button { min-width: 58px; padding: 4px 7px; font-size: 10px; }
        .award-card.tracked .award-card-head button { border-color: rgba(101,214,155,.42); color: #dff8e9; background: #234134; }
        .award-card > p { margin: 6px 0 0; color: #b5c0c8; font-size: 11px; line-height: 1.4; }
        .award-progress { display: grid; gap: 3px; margin-top: 7px; padding: 7px; border: 1px solid rgba(255,202,85,.22); border-radius: 7px; color: #d8dee3; background: #302d24; font-size: 10px; }
        .award-progress strong { color: #ffdc8b; }
        .award-progress span, .award-progress small { color: #adb7bf; white-space: normal; }
        .award-progress span { display: block; }
        .award-progress span b { color: #edf2f5; font-weight: 750; }
        .finisher-progress-list { display: grid; grid-template-columns: repeat(auto-fit,minmax(175px,1fr)); gap: 3px 9px; }
        .award-progress-meter { height: 5px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.1); }
        .award-progress-meter i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#e3a93a,#ffdc76); }
        .award-progress.reached { border-color: rgba(101,214,155,.38); background: #203129; }
        .award-progress.reached strong { color: #8ee6b1; }
        .award-progress.reached .award-progress-meter i { background: #65d69b; }
        .award-progress.unavailable { border-color: rgba(255,255,255,.12); background: #282c31; }
        .award-progress.unavailable strong { color: #c9d0d7; }
        .tracked-award .award-progress { grid-column: 1 / -1; margin-top: 2px; }
        .tracked-award .award-progress.compact small { display: -webkit-box; overflow: hidden; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
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
        .api-controls select, .api-controls input[type="number"] { padding: 3px 5px; border: 1px solid rgba(255,255,255,.16); border-radius: 6px; color: #f1f4f6; background: #111418; }
        .api-controls input[type="number"] { width: 64px; }
        .api-ledger-details { flex-basis: 100%; min-width: 0; padding: 7px 8px; border: 1px solid rgba(255,255,255,.12); border-radius: 6px; background: rgba(0,0,0,.18); }
        .api-ledger-details > summary, .api-ledger-recent > summary { cursor: pointer; color: #eef2f5; font-weight: 700; }
        .api-ledger-details p { margin: 7px 0; color: #aeb8c1; font-size: 11px; line-height: 1.4; }
        .api-ledger-list { max-height: 180px; margin: 6px 0 9px; padding-left: 22px; overflow: auto; color: #cbd2d8; font-size: 10px; line-height: 1.45; }
        .api-ledger-list code { color: #a9d0ff; overflow-wrap: anywhere; }
        .api-ledger-recent { margin: 7px 0; }
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
        .alarm-settings select, .landing-alarm-settings select, .turtle-alarm-settings select, .market-controls select, .catalog-controls select, .bazaar-controls select, .pawn-builder-controls select, .pawn-builder-controls input { padding: 3px 5px; border: 1px solid rgba(255,255,255,.16); border-radius: 6px; color: #f1f4f6; background: #111418; }
        .market-settings { margin-top: 10px; padding-top: 0; border-top: 0; }
        .section-title { color: #eef2f5; font-weight: 750; }
        .market-settings > p { margin: 3px 0 9px; color: #929da7; font-size: 11px; }
        .catalog-controls { display: flex; align-items: center; gap: 8px; margin: 7px 0 10px; color: #aeb7c1; font-size: 11px; }
        .catalog-controls label { display: flex; align-items: center; gap: 5px; }
        .catalog-controls span { flex: 1; text-align: right; }
        .catalog-controls button { padding: 4px 7px; }
        .market-head, .market-watch { display: grid; grid-template-columns: 22px minmax(170px,1fr) 105px 84px 28px; gap: 5px; align-items: center; }
        .market-head { margin-bottom: 3px; color: #87919a; font-size: 10px; }
        .market-watch { margin-bottom: 5px; }
        .market-watch input[type="text"], .market-watch input[type="number"], .market-watch select { min-width: 0; width: 100%; padding: 5px 6px; border: 1px solid rgba(255,255,255,.14); border-radius: 6px; color: #eef2f5; background: #111418; }
        .market-source-select { font-size: 10px; }
        .points-watch-name { padding: 4px 2px 1px; color: #eef2f5; font-weight: 750; }
        .market-item-search { min-width: 0; display: grid; gap: 2px; }
        .market-item-search small { overflow: hidden; color: #87929c; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
        .market-watch button { height: 27px; padding: 0; color: #e2a1a1; }
        .market-empty { padding: 6px 0; color: #8f99a2; font-size: 11px; }
        .market-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; color: #aeb7c1; font-size: 11px; }
        .market-controls button { padding: 5px 9px; }
        .priority-note { margin: 7px 0 0; color: #98a4ae; font-size: 10px; line-height: 1.4; }
        .bazaar-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px; padding: 8px; border: 1px solid rgba(255,255,255,.1); border-radius: 7px; color: #cbd2d8; background: #272c32; font-size: 11px; }
        .bazaar-controls label { display: flex; align-items: center; gap: 5px; }
        .market-settings .third-party-note { margin-top: 6px; color: #89949e; }
        .pawn-shop-builder { margin-top: 10px; padding: 8px; border: 1px solid rgba(101,214,155,.22); border-radius: 7px; color: #cbd2d8; background: #202a26; }
        .pawn-shop-builder > summary { cursor: pointer; color: #dff7ea; font-weight: 750; }
        .pawn-shop-builder > p { margin: 7px 0; color: #9ba9a2; font-size: 10px; line-height: 1.4; }
        .pawn-builder-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin: 9px 0; }
        .pawn-builder-controls label { display: grid; gap: 3px; color: #aeb8b2; font-size: 10px; }
        .pawn-builder-controls label > span { display: flex; align-items: center; gap: 3px; }
        .pawn-builder-controls input { min-width: 0; width: 100%; }
        .pawn-actions { margin-bottom: 7px; }
        .pawn-status { color: #b9cec2 !important; }
        .pawn-candidate-list { max-height: 320px; overflow: auto; overflow-anchor: none; border: 1px solid rgba(255,255,255,.09); border-radius: 6px; background: rgba(0,0,0,.13); }
        .pawn-candidate { display: grid; grid-template-columns: 20px minmax(150px,1fr) minmax(135px,.8fr); gap: 6px; align-items: center; padding: 6px 7px; border-bottom: 1px solid rgba(255,255,255,.07); cursor: pointer; }
        .pawn-candidate:last-child { border-bottom: 0; }
        .pawn-candidate.tracked { opacity: .55; cursor: default; }
        .pawn-candidate span { min-width: 0; }
        .pawn-candidate strong, .pawn-candidate small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pawn-candidate small { margin-top: 2px; color: #86948c; font-size: 9px; }
        .pawn-values { text-align: right; }
        .privacy, .exclusion { margin: 12px 0 0; padding: 8px; border-radius: 7px; color: #aeb8c1; background: #272c32; font-size: 11px; }
        .exclusion { color: #d7c994; }
        details { margin-top: 10px; color: #dbb184; font-size: 11px; }
        details ul { margin: 6px 0 0; padding-left: 18px; }
        @media (max-width: 520px) { .title { flex: 0 0 auto; max-width: 130px; } .header-alerts { flex: 1; max-width: none; } .view-button { width: 28px; padding: 0; overflow: hidden; font-size: 0; } .view-button::before { content: '★'; font-size: 14px; } .view-button.dollar-button::before { content: '$1'; font-size: 11px; } .alert { grid-template-columns: 7px minmax(0,1fr); } .alert-actions { grid-column: 2; flex-wrap: wrap; } .tracked-award-grid { grid-template-columns: 1fr; } .awards-controls { flex-wrap: wrap; } .awards-controls span { order: 3; flex-basis: 100%; text-align: left; } .dollar-bazaar-row { grid-template-columns: minmax(110px,1fr) auto; } .dollar-bazaar-row > strong { grid-column: 2; } .toggles { grid-template-columns: 1fr; } .catalog-controls { flex-wrap: wrap; } .catalog-controls span { order: 3; flex-basis: 100%; text-align: left; } .market-head { display:none; } .market-watch { grid-template-columns: 22px minmax(105px,1fr) 74px 72px 28px; } .pawn-builder-controls { grid-template-columns: 1fr; } .pawn-candidate { grid-template-columns: 20px minmax(100px,1fr); } .pawn-values { grid-column: 2; text-align: left; } }
      </style>
      <section class="panel ${collapsed ? 'collapsed' : ''} ${panelUserSized && !collapsed ? 'user-sized' : ''} ${state.settings.flashAlarm && Date.now() < state.flashUntil ? 'alarm-flash' : ''} ${state.settings.landingFlashAlarm && Date.now() < state.landingFlashUntil ? 'landing-flash' : ''} ${state.settings.turtleFlashAlarm && Date.now() < state.turtleFlashUntil ? 'turtle-flash' : ''}" style="${panelStyle}" aria-label="Torn Daily Dashboard">
        <header class="header" data-drag-handle>
          <div class="title">Daily Dashboard <span class="count">${alerts.length}</span></div>
          <nav class="header-alerts" aria-label="Active reminder shortcuts">${alerts.map(headerAlertChip).join('')}</nav>
          <button class="view-button ${state.settings.activeView === 'awards' && !state.settings.settingsOpen ? 'active' : ''}" data-action="toggle-awards" title="${state.settings.activeView === 'awards' && !state.settings.settingsOpen ? 'Return to alerts' : 'Open medals and honors'}">${state.settings.activeView === 'awards' && !state.settings.settingsOpen ? 'Alerts' : 'Awards'}</button>
          <button class="view-button dollar-button ${state.settings.activeView === 'dollarBazaars' && !state.settings.settingsOpen ? 'active' : ''}" data-action="toggle-dollar-bazaars" title="${state.settings.activeView === 'dollarBazaars' && !state.settings.settingsOpen ? 'Return to alerts' : 'Open Weaver $1 Bazaars'}">${state.settings.activeView === 'dollarBazaars' && !state.settings.settingsOpen ? 'Alerts' : '$1'}</button>
          <button class="icon-button" data-action="toggle-mute" title="${state.settings.muteSounds ? 'Unmute dashboard sounds' : 'Mute dashboard sounds'}" aria-label="${state.settings.muteSounds ? 'Unmute dashboard sounds' : 'Mute dashboard sounds'}" aria-pressed="${state.settings.muteSounds ? 'true' : 'false'}">${state.settings.muteSounds ? '🔇' : '🔊'}</button>
          <button class="icon-button" data-action="settings" title="Settings" aria-label="Settings">⚙</button>
          <button class="icon-button" data-action="collapse" title="${collapsed ? 'Expand' : 'Minimize'}" aria-label="${collapsed ? 'Expand' : 'Minimize'}">${collapsed ? '▾' : '▴'}</button>
        </header>
        ${collapsed ? '' : `
          <div class="body">
            ${state.settings.settingsOpen ? settingsMarkup() : ''}
            ${state.settings.activeView === 'awards' && !state.settings.settingsOpen ? awardsMarkup() : state.settings.activeView === 'dollarBazaars' && !state.settings.settingsOpen ? dollarBazaarsMarkup() : `
              <div class="status"><span>${escapeHtml(sourceSummary())}${snoozedCount ? ` · ${snoozedCount} snoozed` : ''}</span><button data-action="refresh">Refresh</button></div>
              <div class="toolbar">
                <button data-action="snooze-all" data-duration="3600000">Snooze all 1h</button>
                <button data-action="snooze-all" data-duration="${TORN_DAY_MS}">Snooze all 1d</button>
                <button data-action="set-turtle-timer" ${state.turtleChecking ? 'disabled' : ''}>${state.turtleChecking ? 'Checking hospital…' : turtleSeconds > 0 ? `Reset Turtle (${formatDuration(turtleSeconds)})` : 'Set Turtle timer'}</button>
                ${turtleSeconds > 0 ? '<button data-action="clear-turtle-timer" title="Cancel the saved Turtle timer">Cancel Turtle</button>' : ''}
              </div>
              <div class="alerts">
              ${alerts.length ? alerts.map((alert) => `
                <article class="alert ${escapeHtml(alert.tone)} ${String(alert.id).startsWith('market:') || String(alert.id).startsWith('bazaar:') ? 'market-listing-alert' : ''}">
                  <span class="tone" aria-hidden="true"></span>
                  <div class="alert-copy">
                    <div class="alert-title">${alertTitleMarkup(alert)}</div>
                    <div class="alert-detail" title="${escapeHtml(alert.detail)}">${escapeHtml(alert.detail)}</div>
                  </div>
                  <div class="alert-actions">
                    ${alertActionLinks(alert).map((link) => `<a data-tdd-nav href="${escapeHtml(link.href)}">${escapeHtml(link.label || 'Open')}</a>`).join('')}
                    ${alert.shareText ? `
                      <button data-action="copy-alert" data-alert-id="${escapeHtml(alert.id)}" data-copy-text="${escapeHtml(alert.shareText)}" title="Copy the compact listing and HTML link">Copy</button>
                      <button data-action="send-chat" data-alert-id="${escapeHtml(alert.id)}" title="${chatShareArmed(alert.id) ? 'Send the copied listing directly to Faction Chat' : 'Copy this listing first to unlock Faction Chat sending'}" ${chatShareArmed(alert.id) ? '' : 'disabled'}>Send to Faction</button>
                    ` : ''}
                    <button data-action="snooze" data-alert-id="${alert.id}" data-duration="3600000" title="Snooze 1 hour">1h</button>
                    <button data-action="snooze" data-alert-id="${alert.id}" data-duration="${TORN_DAY_MS}" title="Snooze 1 day">1d</button>
                    ${alert.noDisable ? '' : `<button data-action="disable" data-alert-id="${alert.id}" title="Turn off until re-enabled in Settings">Off</button>`}
                  </div>
                </article>
              `).join('') : `
                <div class="empty"><strong>${state.settings.apiKey ? 'You’re caught up.' : 'Visible-page checks are active.'}</strong>${state.settings.apiKey ? 'No active, unsnoozed reminders.' : 'Add an API key in Settings for reminders that are not exposed on this page.'}</div>
              `}
              </div>
              ${trackedAwardsMarkup()}
            `}
          </div>`}
      </section>`;
    const restoreScroll = () => {
      const nextBody = shadow.querySelector('.body');
      if (nextBody) {
        nextBody.scrollTop = previousScrollTop;
        nextBody.scrollLeft = previousScrollLeft;
      }
      const nextPawnList = shadow.querySelector('.pawn-candidate-list');
      if (nextPawnList) {
        nextPawnList.scrollTop = previousPawnScrollTop;
        nextPawnList.scrollLeft = previousPawnScrollLeft;
      }
    };
    restoreScroll();
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
    if (!soundsMuted() && (state.settings.soundAlarm || state.settings.landingSoundAlarm || state.settings.turtleSoundAlarm)) ensureAudioContext();
    if (action === 'toggle-mute') {
      state.settings.muteSounds = !state.settings.muteSounds;
      state.settings.alarmHistory = {};
      if (state.settings.muteSounds) state.audioContext?.suspend?.().catch(() => {});
      else ensureAudioContext();
      saveSettings();
      render();
      return;
    } else if (action === 'toggle-awards') {
      const openingAwards = state.settings.activeView !== 'awards' || state.settings.settingsOpen;
      state.settings.activeView = openingAwards ? 'awards' : 'alerts';
      state.settings.settingsOpen = false;
      state.settings.collapsed = false;
      saveSettings();
      render();
      if (openingAwards && (!state.awards.playerFetchedAt || !Object.keys(state.awards.personalStats || {}).length
        || !state.awards.profile?.id || !state.awards.catalogMedals.length || !state.awards.catalogHonors.length)) {
        refreshAwards();
      }
      return;
    } else if (action === 'toggle-dollar-bazaars') {
      const openingDollarBazaars = state.settings.activeView !== 'dollarBazaars' || state.settings.settingsOpen;
      state.settings.activeView = openingDollarBazaars ? 'dollarBazaars' : 'alerts';
      state.settings.settingsOpen = false;
      state.settings.collapsed = false;
      saveSettings();
      render();
      if (openingDollarBazaars) refreshDollarBazaars();
      return;
    } else if (action === 'collapse') {
      state.settings.collapsed = !state.settings.collapsed;
    } else if (action === 'settings') {
      state.settings.activeView = 'alerts';
      state.settings.settingsOpen = !state.settings.settingsOpen;
      state.settings.collapsed = false;
      saveSettings();
      render();
      if (state.settings.settingsOpen && !itemCatalogFresh()) loadItemCatalog();
      return;
    } else if (action === 'refresh') {
      refresh({ force: true });
      return;
    } else if (action === 'refresh-awards') {
      refreshAwards();
      return;
    } else if (action === 'refresh-dollar-bazaars') {
      refreshDollarBazaars({ force: true });
      return;
    } else if (action === 'track-award') {
      const key = String(button.dataset.awardKey || '');
      pruneUnavailableTrackedAwards();
      if (awardByKey(key) && !state.settings.trackedAwards.includes(key) && state.settings.trackedAwards.length < TRACKED_AWARD_LIMIT) {
        state.settings.trackedAwards.push(key);
      }
    } else if (action === 'untrack-award') {
      const key = String(button.dataset.awardKey || '');
      state.settings.trackedAwards = state.settings.trackedAwards.filter((trackedKey) => trackedKey !== key);
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
    } else if (action === 'export-api-ledger') {
      exportApiLedgerCsv();
      return;
    } else if (action === 'clear-api-ledger') {
      if (typeof TornLib.resetTornApiLog === 'function') {
        TornLib.resetTornApiLog().then(render).catch((error) => console.warn('[ADHD Dashboard] Could not clear API ledger:', error));
      }
      return;
    } else if (action === 'request-notification-permission') {
      requestBrowserNotifications();
      return;
    } else if (action === 'copy-alert') {
      const value = String(button.dataset.copyText || '');
      const original = button.textContent;
      copyAlertText(value).then((copied) => {
        button.textContent = copied ? 'Copied' : 'Copy failed';
        if (copied) {
          const arm = {
            alertId: button.dataset.alertId,
            text: value,
            expiresAt: Date.now() + 120_000,
          };
          state.chatShareArm = arm;
          shadow.querySelectorAll('[data-action="send-chat"]').forEach((sendButton) => {
            const armed = sendButton.dataset.alertId === arm.alertId;
            sendButton.disabled = !armed;
            sendButton.title = armed
              ? 'Send the copied listing directly to Faction Chat'
              : 'Copy this listing first to unlock Faction Chat sending';
          });
          window.setTimeout(() => {
            if (state.chatShareArm !== arm || arm.expiresAt > Date.now()) return;
            state.chatShareArm = null;
            shadow.querySelectorAll('[data-action="send-chat"]').forEach((sendButton) => {
              sendButton.disabled = true;
              sendButton.title = 'Copy this listing first to unlock Faction Chat sending';
            });
          }, 120_100);
        }
        window.setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1_500);
      });
      return;
    } else if (action === 'send-chat') {
      if (!chatShareArmed(button.dataset.alertId)) {
        button.disabled = true;
        button.title = 'Copy this listing first to unlock Faction Chat sending';
        return;
      }
      const arm = state.chatShareArm;
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Sending...';
      sendListingToTornChat(arm.text).then((result) => {
        if (!button.isConnected) return;
        button.textContent = result.label;
        if (result.ok) {
          state.chatShareArm = null;
          shadow.querySelectorAll('[data-action="send-chat"]').forEach((sendButton) => {
            sendButton.disabled = true;
            sendButton.title = 'Copy this listing first to unlock Faction Chat sending';
          });
        } else {
          button.disabled = !chatShareArmed(button.dataset.alertId);
        }
        window.setTimeout(() => {
          if (button.isConnected) button.textContent = original;
        }, 1_800);
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
      if (state.settings.marketWatches.length >= MARKET_WATCH_LIMIT) return;
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      state.settings.marketWatches.push({ uid, marketType: 'item', itemId: '', label: '', searchText: '', maxPrice: '', priority: 'normal', enabled: true });
      state.settings.enabled[`market:${uid}`] = true;
      if (!itemCatalogFresh()) loadItemCatalog();
    } else if (action === 'load-pawn-shop-candidates') {
      loadPawnShopCandidates({ force: state.pawnShopCandidates.length > 0 });
      return;
    } else if (action === 'select-top-pawn-shop') {
      selectTopPawnShopCandidates();
    } else if (action === 'clear-pawn-shop-selection') {
      state.pawnShopCandidateSelection = new Set();
      state.pawnShopStatus = 'Selection cleared.';
    } else if (action === 'add-pawn-shop-watches') {
      addSelectedPawnShopWatches();
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
      if (removed && watchMarketType(removed) === 'item' && !state.settings.marketWatches.some((watch) => watchMarketType(watch) === 'item' && Number(watch.itemId) === Number(removed.itemId))) {
        delete state.errors[`market-item:${Math.trunc(Number(removed.itemId))}`];
      }
      if (removed && watchMarketType(removed) === 'points' && !state.settings.marketWatches.some((watch) => watchMarketType(watch) === 'points')) {
        delete state.errors['market-points'];
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
      state.lastEnergyUpdated = 0;
      state.lastNerveUpdated = 0;
      state.lastCooldownsUpdated = 0;
      state.lastEducationOcUpdated = 0;
      state.lastRaceUpdated = 0;
      state.nextRaceTravelCheckAt = 0;
      state.lastMissionsUpdated = 0;
      state.lastCasinoUpdated = 0;
      state.lastJobAddictionUpdated = 0;
      state.lastClusterUpdated = 0;
      state.nextApiChecks = {};
      state.awards = {
        ...state.awards,
        playerFetchedAt: 0,
        medals: [],
        honors: [],
        merits: null,
        userId: 0,
        finishingHits: {},
        personalStats: {},
        profile: {},
        error: '',
      };
      saveAwardCache();
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
        state.lastEnergyUpdated = 0;
        state.lastNerveUpdated = 0;
        state.lastCooldownsUpdated = 0;
        state.lastEducationOcUpdated = 0;
        state.lastRaceUpdated = 0;
        state.nextRaceTravelCheckAt = 0;
        state.lastMissionsUpdated = 0;
        state.lastCasinoUpdated = 0;
        state.lastJobAddictionUpdated = 0;
        state.lastClusterUpdated = 0;
        state.nextApiChecks = {};
        state.awards = {
          ...state.awards,
          playerFetchedAt: 0,
          medals: [],
          honors: [],
          merits: null,
          userId: 0,
          finishingHits: {},
          personalStats: {},
          profile: {},
          error: '',
        };
        saveAwardCache();
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
      if (state.alertSnapshotReady && !state.syncing) publishAlertGroups(['medicalCooldown']);
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
      state.settings[field] = normalizedPickpocketLevel(event.target.value, field === 'pickpocketMinTargetLevel' ? 1 : 300);
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
    } else if (event.target.matches('[data-field="award-type-filter"]')) {
      state.settings.awardTypeFilter = normalizedAwardTypeFilter(event.target.value);
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
    } else if (event.target.matches('[data-field="pawn-shop-margin"]')) {
      state.settings.pawnShopMarginPercent = Math.min(99, Math.max(0, Number(event.target.value) || 0));
    } else if (event.target.matches('[data-field="pawn-shop-priority"]')) {
      state.settings.pawnShopPriority = normalizedMarketPriority(event.target.value);
    } else if (event.target.matches('[data-field="job-addiction-threshold"]')) {
      state.settings.jobAddictionThreshold = Number(event.target.value);
    } else if (event.target.matches('[data-field="player-addiction-threshold"]')) {
      state.settings.playerAddictionThreshold = Number(event.target.value);
    } else if (event.target.matches('[data-field="mute-sounds"]')) {
      state.settings.muteSounds = event.target.checked;
      state.settings.alarmHistory = {};
      if (state.settings.muteSounds) state.audioContext?.suspend?.().catch(() => {});
      else ensureAudioContext();
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
    } else if (event.target.matches('[data-pawn-candidate-id]')) {
      const itemId = Math.trunc(Number(event.target.dataset.pawnCandidateId));
      if (event.target.checked) {
        if (state.pawnShopCandidateSelection.size < pawnShopWatchCapacity()) state.pawnShopCandidateSelection.add(itemId);
        else event.target.checked = false;
      } else {
        state.pawnShopCandidateSelection.delete(itemId);
      }
      state.pawnShopStatus = `${state.pawnShopCandidateSelection.size} candidate${state.pawnShopCandidateSelection.size === 1 ? '' : 's'} selected.`;
      const status = shadow.querySelector('.pawn-status');
      if (status) status.textContent = state.pawnShopStatus;
      const addButton = shadow.querySelector('[data-action="add-pawn-shop-watches"]');
      if (addButton) {
        addButton.textContent = `Add selected (${state.pawnShopCandidateSelection.size})`;
        addButton.disabled = !state.pawnShopCandidateSelection.size || !pawnShopWatchCapacity();
      }
      const clearButton = shadow.querySelector('[data-action="clear-pawn-shop-selection"]');
      if (clearButton) clearButton.disabled = !state.pawnShopCandidateSelection.size;
      return;
    } else if (event.target.matches('[data-watch-field]')) {
      const watch = state.settings.marketWatches.find((item) => item.uid === event.target.dataset.watchUid);
      if (!watch) return;
      const field = event.target.dataset.watchField;
      const previousMarketType = watchMarketType(watch);
      const previousItemId = Math.trunc(Number(watch.itemId));
      if (field === 'enabled') {
        watch.enabled = event.target.checked;
        state.settings.enabled[`market:${watch.uid}`] = event.target.checked;
      } else if (field === 'marketType') {
        watch.marketType = event.target.value === 'points' ? 'points' : 'item';
        if (watch.marketType === 'points') {
          watch.itemId = '';
          watch.label = '';
          watch.searchText = '';
          watch.catalogType = '';
          watch.marketEstimate = 0;
          watch.priority = 'normal';
        }
      } else if (field === 'priority') {
        watch.priority = normalizedMarketPriority(event.target.value);
      } else {
        watch[field] = event.target.value;
      }
      if (field === 'marketType' || field === 'itemId') {
        if (state.data.market) delete state.data.market[watch.uid];
        if (state.data.bazaars) delete state.data.bazaars[watch.uid];
      }
      if ((field === 'marketType' || field === 'itemId') && previousMarketType === 'item' && previousItemId > 0
        && !state.settings.marketWatches.some((item) => item.uid !== watch.uid && watchMarketType(item) === 'item' && Math.trunc(Number(item.itemId)) === previousItemId)) {
        delete state.errors[`market-item:${previousItemId}`];
      }
      if (field === 'marketType' && previousMarketType === 'points'
        && !state.settings.marketWatches.some((item) => item.uid !== watch.uid && watchMarketType(item) === 'points')) {
        delete state.errors['market-points'];
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
      if (meta) meta.textContent = `${match.type} - ID ${match.id}${Number(match.marketPrice) ? ` - Torn value ~$${Number(match.marketPrice).toLocaleString()}` : ''}${Number(match.sellPrice) ? ` - sell-back $${Number(match.sellPrice).toLocaleString()}` : ''}`;
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
    if (!soundsMuted() && (state.settings.soundAlarm || state.settings.landingSoundAlarm || state.settings.turtleSoundAlarm)) ensureAudioContext();
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
  document.addEventListener('click', handleBazaarPurchaseClick, true);

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

  function handleDashboardNetworkOwnerChange(isOwner) {
    if (!isOwner) {
      if (state.apiQueueTimer && state.apiQueueTimer !== -1) window.clearTimeout(state.apiQueueTimer);
      state.apiQueueTimer = null;
      cancelQueuedApiCalls(dashboardOwnerPauseError());
      state.syncing = false;
      render();
      return;
    }
    applyCheckCache(loadCheckCache());
    scheduleMarketPoll(0);
    scheduleBazaarPoll(0);
    if (state.settings.settingsOpen && !itemCatalogFresh()) loadItemCatalog();
    refresh();
    render();
  }

  if (typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener(CHECK_CACHE_KEY, (_key, _oldValue, _newValue, remote) => {
      if (!remote || ownsDashboardNetworkLease()) return;
      applyCheckCache(loadCheckCache());
      render();
    });
    GM_addValueChangeListener(STORAGE_KEY, (_key, _oldValue, _newValue, remote) => {
      if (!remote) return;
      state.settings = loadSettings();
      scheduleNextSnoozeExpiry();
      scheduleMarketPoll(0);
      scheduleBazaarPoll(0);
      if (ownsDashboardNetworkLease()) refresh();
      render({ force: true });
    });
    GM_addValueChangeListener(ITEM_CATALOG_KEY, (_key, _oldValue, _newValue, remote) => {
      if (!remote) return;
      state.itemCatalog = loadItemCatalogCache();
      render({ force: true });
    });
    GM_addValueChangeListener(AWARD_CACHE_KEY, (_key, _oldValue, _newValue, remote) => {
      if (!remote) return;
      state.awards = loadAwardCache();
      render({ force: true });
    });
    GM_addValueChangeListener(BAZAAR_CACHE_KEY, (_key, _oldValue, _newValue, remote) => {
      if (!remote || ownsDashboardNetworkLease()) return;
      state.bazaarCache = loadBazaarCache();
    });
    GM_addValueChangeListener(DOLLAR_BAZAAR_CACHE_KEY, (_key, _oldValue, _newValue, remote) => {
      if (!remote || ownsDashboardNetworkLease()) return;
      state.dollarBazaarCache = loadDollarBazaarCache();
      state.dollarBazaarError = '';
      if (state.settings.activeView === 'dollarBazaars') render({ force: true });
    });
    GM_addValueChangeListener(WEAV3R_CATEGORY_CACHE_KEY, (_key, _oldValue, _newValue, remote) => {
      if (!remote || ownsDashboardNetworkLease()) return;
      state.weav3rCategoryCache = loadWeav3rCategoryCache();
    });
  }

  function weav3rCategoryPage(category, pageNumber) {
    return new Promise((resolve, reject) => {
      if (!ownsDashboardNetworkLease()) {
        reject(dashboardOwnerPauseError());
        return;
      }
      const url = `https://weav3r.dev/api/categories/items?cat=${encodeURIComponent(category)}&page=${Math.max(1, Math.trunc(Number(pageNumber) || 1))}&sort=marketPrice&dir=desc`;
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { Accept: 'application/json' },
        timeout: 20_000,
        onload(response) {
          if (!ownsDashboardNetworkLease()) {
            reject(dashboardOwnerPauseError('Response ignored because another Torn tab now owns ADHD Dashboard polling.'));
            return;
          }
          if (response.status === 429) {
            const retryAfter = String(response.responseHeaders || '').match(/^retry-after:\s*(\d+)/im);
            const error = new Error('TornW3B category rate limit reached (429). Try loading the category again later.');
            error.rateLimited = true;
            error.retryAfterMs = Math.max(0, Number(retryAfter?.[1]) || 0) * 1000;
            reject(error);
            return;
          }
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`TornW3B category request failed (${response.status}).`));
            return;
          }
          try {
            const rows = JSON.parse(response.responseText);
            if (!Array.isArray(rows)) throw new Error('unexpected response format');
            resolve(rows.map((item) => ({
              id: Math.trunc(Number(item?.id)),
              name: String(item?.name || ''),
              type: String(item?.type || category),
              marketPrice: Math.max(0, Math.trunc(Number(item?.marketPrice) || 0)),
              bazaarAvgPrice: Math.max(0, Math.trunc(Number(item?.bazaarAvgPrice) || 0)),
              bazaarCount: Math.max(0, Math.trunc(Number(item?.bazaarCount) || 0)),
              circulation: Math.max(0, Math.trunc(Number(item?.circulation) || 0)),
            })).filter((item) => item.id > 0 && item.name));
          } catch (error) {
            reject(new Error(`Could not read TornW3B category data: ${error?.message || 'unknown format'}`));
          }
        },
        onerror: () => reject(new Error('Could not reach TornW3B for category data.')),
        ontimeout: () => reject(new Error('The TornW3B category request timed out.')),
      });
      state.bazaarCalls += 1;
    });
  }

  async function loadWeav3rCategoryStats(category, { force = false } = {}) {
    const normalizedCategory = MARKET_ITEM_TYPE_SET.has(category) ? category : 'Other';
    const cached = state.weav3rCategoryCache[normalizedCategory];
    if (!force && Number(cached?.fetchedAt) > Date.now() - WEAV3R_CATEGORY_CACHE_MAX_AGE_MS && Array.isArray(cached?.items)) {
      return cached.items;
    }
    const items = [];
    for (let page = 1; page <= WEAV3R_CATEGORY_MAX_PAGES; page += 1) {
      const rows = await weav3rCategoryPage(normalizedCategory, page);
      items.push(...rows);
      if (rows.length < 50) break;
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
    const uniqueItems = [...new Map(items.map((item) => [item.id, item])).values()];
    state.weav3rCategoryCache[normalizedCategory] = { fetchedAt: Date.now(), items: uniqueItems };
    GM_setValue(WEAV3R_CATEGORY_CACHE_KEY, state.weav3rCategoryCache);
    return uniqueItems;
  }

  window.addEventListener('beforeunload', () => {
    dashboardNetworkLease?.destroy();
  });

  dashboardNetworkLease = TornLib.createTabLeaderLease('adhd-dashboard-network', {
    isEligible: () => true,
    onChange: handleDashboardNetworkOwnerChange,
  });

  render();
  window.setTimeout(() => refresh(), 800);
  if (state.settings.settingsOpen && !itemCatalogFresh()) loadItemCatalog();
  if (document.body) {
    state.domObserver = new MutationObserver(() => {
      scheduleVisiblePageSignalRefresh();
      schedulePickpocketFormatting();
      scheduleBazaarOneDollarFormatting();
    });
    state.domObserver.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label', 'aria-disabled', 'disabled', 'data-disabled', 'data-tooltip', 'class', 'style', 'fill', 'stroke', 'href', 'src'],
    });
  }
  schedulePickpocketFormatting(0);
  scheduleBazaarOneDollarFormatting(0);
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
