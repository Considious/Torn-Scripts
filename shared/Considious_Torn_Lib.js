// ==UserScript==
// @name         Core Lib
// @namespace    Considious [3853023]
// @version      1.2.0
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

  const VERSION = '1.2.0';
  const TORN_API_WINDOW_MS = 60_000;
  const TORN_API_DEFAULT_LIMIT = 60;
  const TORN_API_MAX_LIMIT = 60;
  const TORN_API_LEDGER_KEY = 'considious:torn-api-ledger:v1';
  const TORN_API_LOCK_KEY = 'considious:torn-api-lock:v1';
  const TORN_API_LOCK_NAME = 'considious-torn-api-limiter-v1';
  const TORN_API_LOCK_LEASE_MS = 5_000;
  let memoryLedger = { events: [], cooldownUntil: 0 };
  let inProcessLimiterChain = Promise.resolve();

  function isPageActive({ requireFocus = true } = {}) {
    return document.visibilityState === 'visible' && (!requireFocus || document.hasFocus());
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
          script: String(event.script || 'Unknown').slice(0, 80),
          priority: String(event.priority || 'normal').slice(0, 20),
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
    const shouldWait = options.wait !== false;
    const maxWaitMs = Math.max(0, Number(options.maxWaitMs ?? 65_000) || 0);
    const deadline = Date.now() + maxWaitMs;

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
          ledger.events.push({ at: now, script, priority });
          writeTornApiLedger(ledger);
          return {
            reserved: true,
            at: now,
            usage: ledger.events.length,
            limit,
            script,
            priority,
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
    ledger.events.forEach((event) => {
      byScript[event.script] = (byScript[event.script] || 0) + 1;
    });
    return {
      count: ledger.events.length,
      limit,
      remaining: Math.max(0, limit - ledger.events.length),
      cooldownUntil: ledger.cooldownUntil,
      events: ledger.events.map((event) => ({ ...event })),
      byScript,
      windowMs: TORN_API_WINDOW_MS,
    };
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
    if (isTornApiUrl(url) && options.rateLimit !== false) {
      const reservation = await reserveTornApiSlot({
        limit: options.tornLimit,
        script: options.tornScript,
        priority: options.tornPriority,
        wait: options.tornWait,
        maxWaitMs: options.tornMaxWaitMs,
      });
      if (typeof options.onTornReserved === 'function') options.onTornReserved(reservation);
    }
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: options.method || 'GET',
      url,
      data: options.data,
      headers: options.headers || {},
      timeout: options.timeout || 12_000,
      responseType: options.responseType,
      anonymous: options.anonymous,
      onload: resolve,
      onerror: () => reject(new Error(options.networkErrorMessage || 'Network request failed')),
      ontimeout: () => reject(new Error(options.timeoutMessage || 'Network request timed out')),
      onabort: () => reject(new Error(options.abortMessage || 'Network request was aborted')),
    }));
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
      elementVisible,
      errorMessage,
      escapeAttribute: escapeHtml,
      escapeHtml,
      formatDuration,
      formatHumanDuration,
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
      resetTornApiLedger,
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
