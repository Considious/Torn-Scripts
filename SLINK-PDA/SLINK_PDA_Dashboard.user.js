// ==UserScript==
// @name         SLINK PDA Dashboard
// @namespace    Considious [3853023]
// @version      0.4.56
// @description  Mobile-first SLINK dashboard for Torn PDA with Combat, Efficiency, Quality of Life, and shared permissions.
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
// @connect      raw.githubusercontent.com
// @connect      ffscouter.com
// @connect      weav3r.dev
// @connect      yata.yt
// @connect      prombot.co.uk
// @connect      torn-intel.com
// @connect      droqsdb.com
// @connect      slinkyleveling.richard-johnson554.workers.dev
// @connect      slinkcontributionworker.richard-johnson554.workers.dev
// @connect      slinkwarworker.richard-johnson554.workers.dev
// @connect      slinkmuggingworker.richard-johnson554.workers.dev
// @run-at       document-end
// ==/UserScript==
(async () => {
  'use strict';
  const RUNTIME_URL = "https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/SLINK_PDA_Runtime.js?v=0.4.56";
  const ADDON_URLS = ["https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/SLINK_PDA_Money_Property.js?v=0.4.56","https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/SLINK_PDA_Events.js?v=0.4.56"];
  const PDA_API_KEY = String('###PDA-APIKEY###').trim();
  const ERROR_ID = 'slink-pda-runtime-load-error';
  const DATA_STORAGE_KEY = 'slink-pda-dashboard:data:v1';
  const DATA_MIRROR_KEY = 'slink-pda-dashboard:data:mirror:v1';
  const STORAGE_WRITE_EVENT = 'slink-pda-storage-write:' + (globalThis.crypto?.randomUUID?.() || (String(Date.now()) + ':' + Math.random()));

  function showFailure(error) {
    const message = String(error?.message || error || 'Unknown startup error');
    console.error('SLINK PDA runtime failed to load:', error);
    document.getElementById(ERROR_ID)?.remove();
    const button = document.createElement('button');
    button.id = ERROR_ID;
    button.type = 'button';
    button.textContent = 'SLINK failed: ' + message.slice(0, 120) + ' — tap to retry';
    button.title = message;
    button.style.cssText = 'position:fixed;right:10px;bottom:76px;z-index:2147483647;padding:10px 12px;border:2px solid #111;border-radius:8px;background:#b91c1c;color:#fff;font:bold 12px Arial,sans-serif';
    button.addEventListener('click', () => {
      button.remove();
      void loadRuntime();
    });
    (document.body || document.documentElement).appendChild(button);
  }

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function hasData(value) {
    return Boolean(isRecord(value) && Object.keys(value).length);
  }

  function readMirror() {
    try {
      const parsed = JSON.parse(globalThis.localStorage?.getItem(DATA_MIRROR_KEY) || 'null');
      return isRecord(parsed?.data) ? parsed.data : isRecord(parsed) ? parsed : null;
    } catch { return null; }
  }

  function writeMirror(value) {
    if (!isRecord(value)) return;
    try {
      globalThis.localStorage?.setItem(DATA_MIRROR_KEY, JSON.stringify({ schema:1, savedAt:Date.now(), data:value }));
      globalThis.localStorage?.setItem(DATA_STORAGE_KEY, JSON.stringify(value));
    } catch {}
  }

  function readPersistedData() {
    let primary = null;
    try {
      const value = typeof globalThis.GM_getValue === 'function' ? globalThis.GM_getValue(DATA_STORAGE_KEY, {}) : {};
      if (!(value && typeof value.then === 'function') && isRecord(value)) primary = value;
    } catch {}
    const mirror = readMirror();
    if (hasData(mirror)) {
      try { if (typeof globalThis.GM_setValue === 'function') globalThis.GM_setValue(DATA_STORAGE_KEY, mirror); } catch {}
      return mirror;
    }
    if (hasData(primary)) { writeMirror(primary); return primary; }
    return primary || mirror || {};
  }

  function collectBootstrap() {
    return { [DATA_STORAGE_KEY]:readPersistedData(), storageWriteEvent:STORAGE_WRITE_EVENT };
  }

  function installStorageBridge() {
    document.addEventListener(STORAGE_WRITE_EVENT, event => {
      try {
        const payload = JSON.parse(String(event?.detail || ''));
        if (!isRecord(payload) || payload.key !== DATA_STORAGE_KEY) return;
        if (payload.remove) {
          try { globalThis.localStorage?.removeItem(DATA_MIRROR_KEY); globalThis.localStorage?.removeItem(DATA_STORAGE_KEY); } catch {}
          if (typeof globalThis.GM_deleteValue === 'function') globalThis.GM_deleteValue(DATA_STORAGE_KEY);
          return;
        }
        writeMirror(payload.value);
        if (typeof globalThis.GM_setValue === 'function') globalThis.GM_setValue(DATA_STORAGE_KEY, payload.value);
      } catch {}
    });
  }

  async function fetchSource(url) {
    if (typeof globalThis.PDA_httpGet === 'function') {
      const response = await globalThis.PDA_httpGet(url);
      return String(response?.data ?? response?.responseText ?? '');
    }
    if (typeof globalThis.GM_xmlhttpRequest === 'function') {
      return await new Promise((resolve, reject) => {
        globalThis.GM_xmlhttpRequest({
          method:'GET',
          url:url,
          timeout:15000,
          onload:response => response.status >= 200 && response.status < 300 ? resolve(String(response.responseText || '')) : reject(new Error('Runtime download returned HTTP ' + response.status + '.')),
          onerror:() => reject(new Error('Runtime download failed.')),
          ontimeout:() => reject(new Error('Runtime download timed out.'))
        });
      });
    }
    throw new Error('PDA_httpGet is unavailable.');
  }

  async function fetchRuntime() {
    const [runtimeSource, ...addonSources] = await Promise.all([
      fetchSource(RUNTIME_URL),
      ...ADDON_URLS.map(url => fetchSource(url))
    ]);
    if (runtimeSource.length < 1000) throw new Error('Downloaded runtime was empty or incomplete.');
    addonSources.forEach((source, index) => {
      if (source.length < 100) throw new Error('Downloaded startup add-on ' + (index + 1) + ' was empty or incomplete.');
    });
    return { runtimeSource, addonSources };
  }

  async function executeRuntime(source) {
    if (typeof globalThis.PDA_evaluateJavascript === 'function') {
      await globalThis.PDA_evaluateJavascript(source);
      return;
    }
    (0, eval)(source);
  }

  async function loadRuntime() {
    try {
      const currentHost = document.getElementById('slink-pda-dashboard-host');
      const runtimeReady = currentHost?.dataset?.slinkReady === 'true';
      if (runtimeReady && globalThis.__SLINK_PDA_ADDONS_READY__ === true) {
        document.getElementById(ERROR_ID)?.remove();
        return;
      }
      const { runtimeSource, addonSources } = await fetchRuntime();
      const bootstrapSource = 'globalThis.__SLINK_PDA_BOOTSTRAP__=' + JSON.stringify(collectBootstrap()) + ';';
      const executableSources = ['globalThis.__SLINK_PDA_ADDONS_READY__=false;'];
      if (!runtimeReady) {
        executableSources.push(bootstrapSource + runtimeSource.split('###PDA-APIKEY###').join(PDA_API_KEY) + '\n//# sourceURL=SLINK_PDA_Runtime.js\n');
      }
      addonSources.forEach((source, index) => {
        executableSources.push(source.split('###PDA-APIKEY###').join(PDA_API_KEY) + '\n//# sourceURL=SLINK_PDA_Addon_' + (index + 1) + '.js\n');
      });
      executableSources.push('globalThis.__SLINK_PDA_ADDONS_READY__=true;');
      await executeRuntime(executableSources.join('\n;\n'));
      const readyDeadline = Date.now() + 15_000;
      while (Date.now() < readyDeadline) {
        const readyHost = document.getElementById('slink-pda-dashboard-host');
        if (readyHost?.dataset?.slinkReady === 'true' && globalThis.__SLINK_PDA_ADDONS_READY__ === true) {
          document.getElementById(ERROR_ID)?.remove();
          return;
        }
        await new Promise(resolve => globalThis.setTimeout(resolve, 100));
      }
      throw new Error('Runtime did not signal readiness within 15 seconds.');
    } catch (error) {
      showFailure(error);
    }
  }

  installStorageBridge();
  await loadRuntime();
})();
