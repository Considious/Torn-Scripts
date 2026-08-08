// ==UserScript==
// @name         Core Lib
// @namespace    Considious [3853023]
// @version      1.3.3
// @description  Core library of functions for Considious [3853023]'s family of scripts.
// @author       Considious [3853023]
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/shared/Considious_Torn_Lib.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/shared/Considious_Torn_Lib.js
// @match        https://www.torn.com/*
// @connect      api.torn.com
// @connect      twse.dev
// @connect      ffscouter.com
// @connect      raw.githubusercontent.com
// @connect      docs.google.com
// @connect      weav3r.dev
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function libInstaller(global) {
  'use strict';

  if (global.ConsidiousTornLib) return;

  const VERSION = '1.3.3';
  const TORN_API_WINDOW_MS = 60_000;
  const TORN_API_DEFAULT_LIMIT = 60;
  const TORN_API_MAX_LIMIT = 60;
  const TORN_API_LEDGER_KEY = 'considious:torn-api-ledger:v1';
  const TORN_API_LOG_KEY = 'considious:torn-api-request-log:v1';
  const TORN_API_LOG_WINDOW_MS = 15 * 60_000;
  const TORN_API_LOG_MAX_ENTRIES = 1000;
  const TORN_API_LOCK_KEY = 'considious:torn-api-lock:v1';
  const TORN_API_LOCK_NAME = 'considious-torn-api-limiter-v1';
  const TORN_API_LOCK_LEASE_MS = 5_000;
  const TAB_LEADER_PREFIX = 'considious:tab-leader:v1:';
  const TAB_SESSION_KEY = 'considious:torn-tab-session:v1';
  let memoryLedger = { events: [], cooldownUntil: 0 };
  let memoryApiLog = [];
  let inProcessLimiterChain = Promise.resolve();

  function getTabSessionId() {
    try {
      const storage = global.sessionStorage;
      const existing = String(storage?.getItem(TAB_SESSION_KEY) || '');
      if (existing) return existing.slice(0, 80);
      const created = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      storage?.setItem(TAB_SESSION_KEY, created);
      return created;
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  const TAB_SESSION_ID = getTabSessionId();

  function isPageActive({ requireFocus = true } = {}) {
    return document.visibilityState === 'visible' && (!requireFocus || document.hasFocus());
  }

  function createTabLeaderLease(name, options = {}) {
    const storage = options.storage || global.localStorage;
    const leaseMs = Math.max(5_000, Number(options.leaseMs) || 15_000);
    const heartbeatMs = Math.max(1_000, Math.min(leaseMs / 2, Number(options.heartbeatMs) || 5_000));
    const isEligible = typeof options.isEligible === 'function' ? options.isEligible : () => true;
    const isPreferred = typeof options.isPreferred === 'function'
      ? options.isPreferred
      : () => isPageActive();
    const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
    const key = `${TAB_LEADER_PREFIX}${String(name || 'default').trim() || 'default'}`;
    const ownerId = `${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}:${Math.random().toString(36).slice(2)}`;
    let leader = false;
    let destroyed = false;
    let heartbeatTimer = null;
    let retryTimer = null;

    function readLease() {
      try {
        const parsed = JSON.parse(storage.getItem(key));
        if (!parsed || typeof parsed !== 'object') return null;
        const expiresAt = Number(parsed.expiresAt);
        if (!parsed.owner || !Number.isFinite(expiresAt)) return null;
        return {
          owner: String(parsed.owner),
          expiresAt,
          preferred: Boolean(parsed.preferred),
        };
      } catch {
        return null;
      }
    }

    function setLeader(next) {
      const normalized = Boolean(next);
      if (leader === normalized) return;
      leader = normalized;
      global.queueMicrotask(() => {
        if (!destroyed) onChange(leader);
      });
    }

    function preferredNow() {
      try {
        return Boolean(isPreferred());
      } catch {
        return false;
      }
    }

    function writeOwnLease(now = Date.now(), preferred = preferredNow()) {
      storage.setItem(key, JSON.stringify({
        owner: ownerId,
        expiresAt: now + leaseMs,
        preferred,
      }));
      const confirmed = readLease();
      setLeader(Boolean(confirmed && confirmed.owner === ownerId && confirmed.expiresAt > now));
      return leader;
    }

    function release() {
      if (destroyed) return;
      try {
        const current = readLease();
        if (current?.owner === ownerId) storage.removeItem(key);
      } catch {
        // Another tab will recover after the short lease expires.
      }
      setLeader(false);
    }

    function refresh() {
      if (destroyed) return false;
      if (!isEligible()) {
        release();
        return false;
      }

      const now = Date.now();
      const current = readLease();
      const preferred = preferredNow();
      const ownerCanBePreempted = Boolean(
        current &&
        current.owner !== ownerId &&
        current.expiresAt > now &&
        preferred &&
        !current.preferred
      );
      if (current && current.owner !== ownerId && current.expiresAt > now && !ownerCanBePreempted) {
        setLeader(false);
        return false;
      }

      try {
        return writeOwnLease(now, preferred);
      } catch {
        setLeader(false);
        return false;
      }
    }

    function isLeader() {
      if (destroyed || !isEligible()) {
        setLeader(false);
        return false;
      }
      const current = readLease();
      const ownsCurrentLease = Boolean(
        current &&
        current.owner === ownerId &&
        current.expiresAt > Date.now()
      );
      setLeader(ownsCurrentLease);
      return ownsCurrentLease;
    }

    function scheduleContendedRetry() {
      if (destroyed || retryTimer) return;
      retryTimer = global.setTimeout(() => {
        retryTimer = null;
        refresh();
      }, 25 + Math.floor(Math.random() * 225));
    }

    function handleStorage(event) {
      if (event.storageArea !== storage || event.key !== key || destroyed) return;
      const current = readLease();
      const now = Date.now();
      if (current?.owner === ownerId && current.expiresAt > now) {
        setLeader(true);
      } else {
        setLeader(false);
        if (
          !current ||
          current.expiresAt <= now ||
          (preferredNow() && !current.preferred)
        ) scheduleContendedRetry();
      }
    }

    function handlePriorityChange() {
      refresh();
    }

    function destroy() {
      if (destroyed) return;
      release();
      destroyed = true;
      if (heartbeatTimer) global.clearInterval(heartbeatTimer);
      if (retryTimer) global.clearTimeout(retryTimer);
      global.removeEventListener('storage', handleStorage);
      global.removeEventListener('focus', handlePriorityChange);
      global.removeEventListener('blur', handlePriorityChange);
      global.document?.removeEventListener?.('visibilitychange', handlePriorityChange);
    }

    global.addEventListener('storage', handleStorage);
    global.addEventListener('focus', handlePriorityChange);
    global.addEventListener('blur', handlePriorityChange);
    global.document?.addEventListener?.('visibilitychange', handlePriorityChange);
    heartbeatTimer = global.setInterval(refresh, heartbeatMs);
    refresh();

    return Object.freeze({
      destroy,
      isLeader,
      ownerId,
      refresh,
      release,
      storageKey: key,
    });
  }

  function errorMessage(value, fallback = 'Request failed') {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') {
      const nested = value.error?.error ?? value.error?.message ?? value.error ?? value.message;
      if (nested !== undefined && nested !== value) return errorMessage(nested, fallback);
    }
    return fallback;
  }

  function sleep(milliseconds) {
    return new Promise((resolve) => global.setTimeout(resolve, Math.max(0, Number(milliseconds) || 0)));
  }

  function tornStorage() {
    try {
      const storage = global.localStorage;
      if (!storage) return null;
      storage.getItem(TORN_API_LEDGER_KEY);
      return storage;
    } catch {
      return null;
    }
  }

  function normalizeLedger(value, now = Date.now()) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const events = (Array.isArray(source.events) ? source.events : [])
      .map((event) => {
        if (Number.isFinite(Number(event))) return { at: Number(event), script: 'Legacy', priority: 'normal' };
        if (!event || typeof event !== 'object') return null;
        const at = Number(event.at);
        if (!Number.isFinite(at)) return null;
        return {
          at,
          id: String(event.id || '').slice(0, 120),
          script: String(event.script || 'Unknown').slice(0, 80),
          priority: String(event.priority || 'normal').slice(0, 20),
          method: String(event.method || 'GET').slice(0, 12),
          endpoint: String(event.endpoint || 'Unknown endpoint').slice(0, 240),
          tabId: String(event.tabId || '').slice(0, 80),
        };
      })
      .filter((event) => event && event.at > now - TORN_API_WINDOW_MS)
      .sort((left, right) => left.at - right.at);
    return {
      events,
      cooldownUntil: Math.max(0, Number(source.cooldownUntil) || 0),
    };
  }

  function readTornApiLedger(now = Date.now()) {
    const storage = tornStorage();
    if (!storage) return normalizeLedger(memoryLedger, now);
    try {
      return normalizeLedger(JSON.parse(storage.getItem(TORN_API_LEDGER_KEY) || '{}'), now);
    } catch {
      return normalizeLedger(memoryLedger, now);
    }
  }

  function writeTornApiLedger(ledger) {
    memoryLedger = normalizeLedger(ledger);
    const storage = tornStorage();
    if (!storage) return false;
    try {
      storage.setItem(TORN_API_LEDGER_KEY, JSON.stringify(memoryLedger));
      return true;
    } catch {
      return false;
    }
  }

  function sanitizeTornApiEndpoint(url) {
    try {
      const parsed = new URL(String(url), global.location?.href || 'https://www.torn.com/');
      const queryNames = [...new Set([...parsed.searchParams.keys()]
        .filter((name) => String(name).toLowerCase() !== 'key'))]
        .sort();
      return `${parsed.pathname || '/'}${queryNames.length ? `?${queryNames.join('&')}` : ''}`.slice(0, 240);
    } catch {
      return 'Unknown endpoint';
    }
  }

  function normalizeTornApiLog(value, now = Date.now(), windowMs = TORN_API_LOG_WINDOW_MS) {
    const cutoff = now - Math.max(TORN_API_WINDOW_MS, Math.min(TORN_API_LOG_WINDOW_MS, Number(windowMs) || TORN_API_LOG_WINDOW_MS));
    return (Array.isArray(value) ? value : [])
      .map((event) => {
        if (!event || typeof event !== 'object') return null;
        const at = Number(event.at);
        if (!Number.isFinite(at) || at <= cutoff) return null;
        return {
          id: String(event.id || '').slice(0, 120),
          at,
          finishedAt: Math.max(0, Number(event.finishedAt) || 0),
          durationMs: Math.max(0, Number(event.durationMs) || 0),
          script: String(event.script || 'Unknown').slice(0, 80),
          priority: String(event.priority || 'normal').slice(0, 20),
          method: String(event.method || 'GET').slice(0, 12),
          endpoint: String(event.endpoint || 'Unknown endpoint').slice(0, 240),
          tabId: String(event.tabId || '').slice(0, 80),
          quotaExempt: Boolean(event.quotaExempt),
          quotaClass: String(event.quotaClass || (event.quotaExempt ? 'globally-cached' : 'quota')).slice(0, 40),
          result: String(event.result || 'Pending').slice(0, 80),
          status: Math.max(0, Number(event.status) || 0),
          apiErrorCode: Math.max(0, Number(event.apiErrorCode) || 0),
          apiErrorMessage: String(event.apiErrorMessage || '').slice(0, 160),
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.at - right.at)
      .slice(-TORN_API_LOG_MAX_ENTRIES);
  }

  function readTornApiLog(now = Date.now(), windowMs = TORN_API_LOG_WINDOW_MS) {
    const storage = tornStorage();
    if (!storage) return normalizeTornApiLog(memoryApiLog, now, windowMs);
    try {
      return normalizeTornApiLog(JSON.parse(storage.getItem(TORN_API_LOG_KEY) || '[]'), now, windowMs);
    } catch {
      return normalizeTornApiLog(memoryApiLog, now, windowMs);
    }
  }

  function writeTornApiLog(events) {
    memoryApiLog = normalizeTornApiLog(events);
    const storage = tornStorage();
    if (!storage) return false;
    try {
      storage.setItem(TORN_API_LOG_KEY, JSON.stringify(memoryApiLog));
      return true;
    } catch {
      return false;
    }
  }

  function appendTornApiLog(event) {
    const events = readTornApiLog();
    events.push(event);
    writeTornApiLog(events);
  }

  async function withInProcessLimiterLock(task) {
    const run = inProcessLimiterChain.then(task, task);
    inProcessLimiterChain = run.catch(() => {});
    return run;
  }

  async function withFallbackStorageLock(task) {
    const storage = tornStorage();
    if (!storage) return withInProcessLimiterLock(task);
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const deadline = Date.now() + TORN_API_LOCK_LEASE_MS;

    while (Date.now() < deadline) {
      const now = Date.now();
      let current = null;
      try {
        current = JSON.parse(storage.getItem(TORN_API_LOCK_KEY) || 'null');
      } catch {
        current = null;
      }
      if (!current?.token || Number(current.expiresAt) <= now) {
        try {
          storage.setItem(TORN_API_LOCK_KEY, JSON.stringify({
            token,
            expiresAt: now + TORN_API_LOCK_LEASE_MS,
          }));
          const claimed = JSON.parse(storage.getItem(TORN_API_LOCK_KEY) || 'null');
          if (claimed?.token === token) {
            try {
              return await task();
            } finally {
              try {
                const latest = JSON.parse(storage.getItem(TORN_API_LOCK_KEY) || 'null');
                if (latest?.token === token) storage.removeItem(TORN_API_LOCK_KEY);
              } catch {
                // An expired fallback lock is harmless.
              }
            }
          }
        } catch {
          return withInProcessLimiterLock(task);
        }
      }
      await sleep(20 + Math.floor(Math.random() * 30));
    }
    throw new Error('Could not acquire the shared Torn API limiter lock.');
  }

  function withTornApiLock(task) {
    if (global.navigator?.locks?.request) {
      return global.navigator.locks.request(TORN_API_LOCK_NAME, { mode: 'exclusive' }, task);
    }
    return withFallbackStorageLock(task);
  }

  function normalizedTornLimit(value) {
    const requested = Number(value);
    if (!Number.isFinite(requested) || requested <= 0) return TORN_API_DEFAULT_LIMIT;
    return Math.min(TORN_API_MAX_LIMIT, Math.max(1, Math.floor(requested)));
  }

  function tornApiRateLimitError(message, retryAfterMs, usage) {
    const error = new Error(message);
    error.code = 'TORN_API_LOCAL_RATE_LIMIT';
    error.retryAfterMs = Math.max(0, Number(retryAfterMs) || 0);
    error.usage = usage;
    return error;
  }

  async function reserveTornApiSlot(options = {}) {
    const limit = normalizedTornLimit(options.limit);
    const script = String(options.script || 'Core Lib consumer').slice(0, 80);
    const priority = String(options.priority || 'normal').slice(0, 20);
    const method = String(options.method || 'GET').toUpperCase().slice(0, 12);
    const endpoint = sanitizeTornApiEndpoint(options.url || options.endpoint || '');
    const quotaExempt = options.quotaExempt === true;
    const quotaClass = String(options.quotaClass || (quotaExempt ? 'globally-cached' : 'quota')).slice(0, 40);
    const shouldWait = options.wait !== false;
    const maxWaitMs = Math.max(0, Number(options.maxWaitMs ?? 65_000) || 0);
    const deadline = Date.now() + maxWaitMs;

    if (quotaExempt) {
      return withTornApiLock(() => {
        const now = Date.now();
        const ledger = readTornApiLedger(now);
        const id = `${now}:${Math.random().toString(36).slice(2, 10)}`;
        const event = { id, at: now, script, priority, method, endpoint, tabId: TAB_SESSION_ID, quotaExempt, quotaClass };
        appendTornApiLog({ ...event, result: 'Pending', status: 0, finishedAt: 0, durationMs: 0 });
        return {
          reserved: true,
          id,
          at: now,
          usage: ledger.events.length,
          limit,
          script,
          priority,
          method,
          endpoint,
          tabId: TAB_SESSION_ID,
          quotaExempt,
          quotaClass,
        };
      });
    }

    while (true) {
      const result = await withTornApiLock(() => {
        const now = Date.now();
        const ledger = readTornApiLedger(now);
        if (ledger.cooldownUntil > now) {
          return {
            reserved: false,
            retryAfterMs: ledger.cooldownUntil - now,
            usage: ledger.events.length,
            cooldownUntil: ledger.cooldownUntil,
          };
        }
        if (ledger.events.length < limit) {
          const id = `${now}:${Math.random().toString(36).slice(2, 10)}`;
          const event = { id, at: now, script, priority, method, endpoint, tabId: TAB_SESSION_ID, quotaExempt: false, quotaClass };
          ledger.events.push(event);
          writeTornApiLedger(ledger);
          appendTornApiLog({ ...event, result: 'Pending', status: 0, finishedAt: 0, durationMs: 0 });
          return {
            reserved: true,
            id,
            at: now,
            usage: ledger.events.length,
            limit,
            script,
            priority,
            method,
            endpoint,
            tabId: TAB_SESSION_ID,
            quotaExempt: false,
            quotaClass,
          };
        }
        const releaseIndex = Math.max(0, ledger.events.length - limit);
        const releaseAt = Number(ledger.events[releaseIndex]?.at || now) + TORN_API_WINDOW_MS;
        writeTornApiLedger(ledger);
        return {
          reserved: false,
          retryAfterMs: Math.max(50, releaseAt - now + 50),
          usage: ledger.events.length,
          cooldownUntil: 0,
        };
      });

      if (result.reserved) return result;
      const remaining = deadline - Date.now();
      if (!shouldWait || result.retryAfterMs > remaining || remaining <= 0) {
        const reason = result.cooldownUntil
          ? 'Torn API requests are cooling down after a server rate-limit response.'
          : `Shared Torn API limit reached (${result.usage}/${limit} in the last minute).`;
        throw tornApiRateLimitError(reason, result.retryAfterMs, result.usage);
      }
      await sleep(Math.min(result.retryAfterMs, remaining));
    }
  }

  async function finishTornApiLog(reservation, outcome = {}) {
    const id = String(reservation?.id || '');
    if (!id) return false;
    return withTornApiLock(() => {
      const now = Date.now();
      const events = readTornApiLog(now);
      const event = events.find((item) => item.id === id);
      if (!event) return false;
      event.finishedAt = now;
      event.durationMs = Math.max(0, now - Number(event.at || now));
      event.status = Math.max(0, Number(outcome.status) || 0);
      event.result = String(outcome.result || (event.status ? `HTTP ${event.status}` : 'Completed')).slice(0, 80);
      event.apiErrorCode = Math.max(0, Number(outcome.apiErrorCode) || 0);
      event.apiErrorMessage = String(outcome.apiErrorMessage || '').slice(0, 160);
      writeTornApiLog(events);
      return true;
    });
  }

  async function noteTornApiRateLimit(options = {}) {
    const retryAfterMs = Math.max(5_000, Number(options.retryAfterMs) || 60_000);
    return withTornApiLock(() => {
      const now = Date.now();
      const ledger = readTornApiLedger(now);
      ledger.cooldownUntil = Math.max(ledger.cooldownUntil, now + retryAfterMs);
      writeTornApiLedger(ledger);
      return ledger.cooldownUntil;
    });
  }

  function getTornApiUsage(options = {}) {
    const now = Date.now();
    const limit = normalizedTornLimit(options.limit);
    const ledger = readTornApiLedger(now);
    const byScript = {};
    const byEndpoint = {};
    ledger.events.forEach((event) => {
      byScript[event.script] = (byScript[event.script] || 0) + 1;
      byEndpoint[event.endpoint] = (byEndpoint[event.endpoint] || 0) + 1;
    });
    return {
      count: ledger.events.length,
      limit,
      remaining: Math.max(0, limit - ledger.events.length),
      cooldownUntil: ledger.cooldownUntil,
      events: ledger.events.map((event) => ({ ...event })),
      byScript,
      byEndpoint,
      windowMs: TORN_API_WINDOW_MS,
    };
  }

  function getTornApiLog(options = {}) {
    const windowMs = Math.max(TORN_API_WINDOW_MS, Math.min(TORN_API_LOG_WINDOW_MS, Number(options.windowMs) || TORN_API_LOG_WINDOW_MS));
    const events = readTornApiLog(Date.now(), windowMs);
    const byScript = {};
    const byEndpoint = {};
    const byScriptEndpoint = {};
    const byQuotaClass = {};
    events.forEach((event) => {
      byScript[event.script] = (byScript[event.script] || 0) + 1;
      byEndpoint[event.endpoint] = (byEndpoint[event.endpoint] || 0) + 1;
      const key = `${event.script} :: ${event.method} ${event.endpoint}`;
      byScriptEndpoint[key] = (byScriptEndpoint[key] || 0) + 1;
      byQuotaClass[event.quotaClass] = (byQuotaClass[event.quotaClass] || 0) + 1;
    });
    return {
      events: events.map((event) => ({ ...event })),
      byScript,
      byEndpoint,
      byScriptEndpoint,
      byQuotaClass,
      windowMs,
      tabId: TAB_SESSION_ID,
    };
  }

  async function resetTornApiLog() {
    return withTornApiLock(() => {
      writeTornApiLog([]);
      return true;
    });
  }

  async function resetTornApiLedger() {
    return withTornApiLock(() => {
      writeTornApiLedger({ events: [], cooldownUntil: 0 });
      return true;
    });
  }

  function isTornApiUrl(url) {
    try {
      return new URL(String(url), global.location?.href || 'https://www.torn.com/').hostname === 'api.torn.com';
    } catch {
      return false;
    }
  }

  async function request(url, options = {}) {
    if (typeof GM_xmlhttpRequest !== 'function') {
      throw new Error('GM_xmlhttpRequest is unavailable. Add it to the userscript grants.');
    }
    const tornApiRequest = isTornApiUrl(url);
    let reservation = options.tornReservation || null;
    if (isTornApiUrl(url) && options.rateLimit !== false) {
      reservation = await reserveTornApiSlot({
        limit: options.tornLimit,
        script: options.tornScript,
        priority: options.tornPriority,
        method: options.method || 'GET',
        url,
        quotaExempt: options.tornQuotaExempt,
        quotaClass: options.tornQuotaClass,
        wait: options.tornWait,
        maxWaitMs: options.tornMaxWaitMs,
      });
      if (typeof options.onTornReserved === 'function') options.onTornReserved(reservation);
    }
    return new Promise((resolve, reject) => {
      const finish = (result, status = 0) => {
        if (tornApiRequest && reservation) void finishTornApiLog(reservation, { result, status });
      };
      GM_xmlhttpRequest({
        method: options.method || 'GET',
        url,
        data: options.data,
        headers: options.headers || {},
        timeout: options.timeout || 12_000,
        responseType: options.responseType,
        anonymous: options.anonymous,
        onload: (response) => { response.__tornReservation = reservation; finish(`HTTP ${Number(response.status) || 0}`, response.status); resolve(response); },
        onerror: () => { finish('Network error'); reject(new Error(options.networkErrorMessage || 'Network request failed')); },
        ontimeout: () => { finish('Timed out'); reject(new Error(options.timeoutMessage || 'Network request timed out')); },
        onabort: () => { finish('Aborted'); reject(new Error(options.abortMessage || 'Network request was aborted')); },
      });
    });
  }

  async function requestText(url, options = {}) {
    const response = await request(url, options);
    const minimum = options.minimumStatus ?? 200;
    const maximum = options.maximumStatus ?? 399;
    if (response.status < minimum || response.status > maximum) {
      throw new Error(options.httpErrorMessage?.(response) || `HTTP ${response.status}`);
    }
    return response.responseText || '';
  }

  async function requestJson(url, options = {}) {
    const response = await request(url, options);
    let data;
    try {
      data = JSON.parse(response.responseText);
    } catch {
      throw new Error(options.invalidJsonMessage || 'The server returned invalid JSON.');
    }
    const apiRateLimited = isTornApiUrl(url)
      && (response.status === 429 || Number(data?.error?.code) === 5);
    if (apiRateLimited) {
      await noteTornApiRateLimit({ retryAfterMs: options.tornRateLimitCooldownMs });
    }
    const tornReservation = options.tornReservation || response.__tornReservation;
    if (isTornApiUrl(url) && tornReservation && data?.error) {
      void finishTornApiLog(tornReservation, {
        status: response.status,
        result: `Torn error ${Number(data.error.code) || 0}`,
        apiErrorCode: data.error.code,
        apiErrorMessage: errorMessage(data.error),
      });
    }
    if (response.status < 200 || response.status >= 300) {
      const message = options.httpErrorMessage?.(response, data) || errorMessage(data, `HTTP ${response.status}`);
      const error = new Error(message);
      error.status = response.status;
      error.url = url;
      error.responseText = response.responseText;
      throw error;
    }
    if (options.rejectApiErrors !== false && data?.error) throw new Error(errorMessage(data.error));
    return data;
  }

  function tornRequest(url, apiKey, options = {}) {
    return requestJson(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `ApiKey ${apiKey}`,
      },
    });
  }

  function makePanelDraggable(panel, options = {}) {
    if (!panel) throw new TypeError('A panel element is required.');
    const handle = typeof options.handle === 'string' ? panel.querySelector(options.handle) : options.handle;
    if (!handle) throw new Error('The panel drag handle was not found.');
    const margin = Number.isFinite(options.margin) ? options.margin : 4;
    const ignoreSelector = options.ignoreSelector || 'button, input, textarea, select, a, [data-no-drag]';
    const draggingClass = options.draggingClass || '';
    const storageKey = options.storageKey || '';
    const getValue = options.getValue || (typeof GM_getValue === 'function' ? GM_getValue : null);
    const setValue = options.setValue || (typeof GM_setValue === 'function' ? GM_setValue : null);
    const clamp = (left, top) => ({
      left: Math.max(margin, Math.min(left, global.innerWidth - panel.offsetWidth - margin)),
      top: Math.max(margin, Math.min(top, global.innerHeight - panel.offsetHeight - margin)),
    });
    const apply = (position) => {
      if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) return;
      const next = clamp(position.left, position.top);
      panel.style.left = `${next.left}px`;
      panel.style.top = `${next.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    };
    if (storageKey && getValue) apply(getValue(storageKey, null));
    let drag = null;
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest(ignoreSelector)) return;
      const rect = panel.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      handle.setPointerCapture(event.pointerId);
      if (draggingClass) panel.classList.add(draggingClass);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      apply({ left: event.clientX - drag.offsetX, top: event.clientY - drag.offsetY });
    });
    const finish = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag = null;
      if (draggingClass) panel.classList.remove(draggingClass);
      if (storageKey && setValue) {
        const rect = panel.getBoundingClientRect();
        setValue(storageKey, { left: Math.round(rect.left), top: Math.round(rect.top) });
      }
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    const clampCurrentPosition = () => {
      const rect = panel.getBoundingClientRect();
      apply({ left: rect.left, top: rect.top });
    };
    global.addEventListener('resize', clampCurrentPosition, { passive: true });
    return {
      applyPosition: apply,
      clampToViewport: clampCurrentPosition,
      destroy() {
        global.removeEventListener('resize', clampCurrentPosition);
      },
    };
  }

  async function copyText(text) {
    const value = String(text);
    if (navigator.clipboard?.writeText && document.hasFocus()) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // Fall back to the textarea copy path.
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      if (!document.execCommand('copy')) throw new Error('The browser rejected the copy command.');
      return true;
    } finally {
      textarea.remove();
    }
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function shortNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    for (const [size, suffix] of [[1e15, 'Q'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
      if (Math.abs(number) >= size) return `${Number((number / size).toFixed(2))}${suffix}`;
    }
    return String(Math.round(number));
  }

  function unixNow() {
    return Math.floor(Date.now() / 1000);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatHumanDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours) return `${hours}h ${minutes}m`;
    if (total < 60) return `${total}s`;
    return `${minutes}m`;
  }

  function elementVisible(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function readJsonStorage(key, fallback, options = {}) {
    const storage = options.storage || localStorage;
    try {
      const parsed = JSON.parse(storage.getItem(key));
      if (parsed == null) {
        return options.merge && fallback && typeof fallback === 'object' ? { ...fallback } : fallback;
      }
      if (options.merge && fallback && typeof fallback === 'object' && !Array.isArray(fallback)
        && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...fallback, ...parsed };
      }
      return parsed;
    } catch {
      return options.merge && fallback && typeof fallback === 'object' ? { ...fallback } : fallback;
    }
  }

  function writeJsonStorage(key, value, options = {}) {
    const storage = options.storage || localStorage;
    storage.setItem(key, JSON.stringify(value));
    return value;
  }

  Object.defineProperty(global, 'ConsidiousTornLib', {
    value: Object.freeze({
      VERSION,
      TORN_API_DEFAULT_LIMIT,
      copyText,
      createTabLeaderLease,
      elementVisible,
      errorMessage,
      escapeAttribute: escapeHtml,
      escapeHtml,
      formatDuration,
      formatHumanDuration,
      finishTornApiLog,
      getTornApiLog,
      getTornApiUsage,
      isPageActive,
      isTornApiUrl,
      makePanelDraggable,
      noteTornApiRateLimit,
      readJsonStorage,
      request,
      requestJson,
      requestText,
      reserveTornApiSlot,
      resetTornApiLog,
      resetTornApiLedger,
      sanitizeTornApiEndpoint,
      shortNumber,
      tornRequest,
      unixNow,
      writeJsonStorage,
    }),
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);
