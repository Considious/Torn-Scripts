// ==UserScript==
// @name         SLINK PDA Dashboard
// @namespace    Considious [3853023]
// @version      0.4.47
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
  const RUNTIME_URL = "https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/SLINK_PDA_Runtime.js?v=0.4.47";
  const ADDON_URLS = ["https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/SLINK_PDA_Money_Property.js?v=0.4.47"];
  const PDA_API_KEY = String('###PDA-APIKEY###').trim();
  const ERROR_ID = 'slink-pda-runtime-load-error';
  const DATA_STORAGE_KEY = 'slink-pda-dashboard:data:v1';

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

  function readLegacySettings() {
    try {
      const value = typeof globalThis.GM_getValue === 'function' ? globalThis.GM_getValue(DATA_STORAGE_KEY, {}) : {};
      return isRecord(value) && !(value && typeof value.then === 'function') && isRecord(value.settings) ? value.settings : {};
    } catch { return {}; }
  }

  function collectBootstrap() {
    return { [DATA_STORAGE_KEY]:{ settings:readLegacySettings() } };
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
      if (currentHost?.dataset?.slinkReady === 'true') {
        document.getElementById(ERROR_ID)?.remove();
        return;
      }
      const downloaded = await fetchRuntime();
      if (downloaded.length < 1000) throw new Error('Downloaded runtime was empty or incomplete.');
      const bootstrapSource = 'globalThis.__SLINK_PDA_BOOTSTRAP__=' + JSON.stringify(collectBootstrap()) + ';';
      const hydrated = bootstrapSource + downloaded.split('###PDA-APIKEY###').join(PDA_API_KEY) + '\n//# sourceURL=SLINK_PDA_Runtime.js';
      await executeRuntime(hydrated);
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

  await loadRuntime();
})();
