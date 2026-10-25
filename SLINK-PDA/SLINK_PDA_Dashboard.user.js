// ==UserScript==
// @name         SLINK PDA Dashboard [AUDIT TEST]
// @namespace    Considious [3853023]
// @version      0.4.105
// @description  Mobile-first SLINK dashboard for Torn PDA with Combat, Efficiency, Quality of Life, and shared permissions.
// @author       Considious [3853023]
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js
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
  const SOURCE_ROOT = 'https://raw.githubusercontent.com/Considious/Torn-Scripts/36dd3c8c15246e1c931882c2f44f07112981089a/SLINK-PDA/';
  const MANIFEST_URL = SOURCE_ROOT + 'source-manifest.json';
  const PDA_API_KEY = String('###PDA-APIKEY###').trim();
  const ERROR_ID = 'slink-pda-runtime-load-error';
  const HOST_ID = 'slink-pda-dashboard-host';
  const DATA_STORAGE_KEY = 'slink-pda-dashboard:data:v1';
  const DATA_MIRROR_KEY = 'slink-pda-dashboard:data:mirror:v1';
  const OWN_BATTLE_STATS_STORAGE_KEY = 'slink-pda-dashboard:own-battle-stats:v1';
  const BRIDGED_STORAGE_KEYS = new Set([DATA_STORAGE_KEY, OWN_BATTLE_STATS_STORAGE_KEY]);
  const RUNTIME_CACHE_KEY = 'slink-pda-dashboard:runtime-cache:audit-test:v1';
  const CACHE_RETRY_KEY = 'slink-pda-dashboard:runtime-cache-retry:audit-test:v1';
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

  function savedAt(value) {
    return Math.max(0, Number(isRecord(value) ? value._savedAt : 0) || 0);
  }

  function writeMirror(value) {
    if (!isRecord(value)) return;
    try {
      globalThis.localStorage?.setItem(DATA_MIRROR_KEY, JSON.stringify({ schema:1, savedAt:Date.now(), data:value }));
      globalThis.localStorage?.setItem(DATA_STORAGE_KEY, JSON.stringify(value));
    } catch {}
  }

  async function readPersistedData() {
    let primary = null;
    try {
      const value = await gmRead(DATA_STORAGE_KEY, {});
      if (isRecord(value)) primary = value;
    } catch {}
    const mirror = readMirror();
    let selected = hasData(primary) ? primary : mirror || {};
    if (hasData(mirror) && savedAt(mirror) > savedAt(selected)) selected = mirror;
    if (hasData(selected)) writeMirror(selected);
    if (selected === mirror && selected !== primary) {
      await gmWrite(DATA_STORAGE_KEY, selected);
    }
    return selected;
  }

  async function collectBootstrap() {
    const [data, primaryStats] = await Promise.all([readPersistedData(), gmRead(OWN_BATTLE_STATS_STORAGE_KEY, null)]);
    let localStats = null;
    try { localStats = JSON.parse(globalThis.localStorage?.getItem(OWN_BATTLE_STATS_STORAGE_KEY) || 'null'); } catch {}
    const stats = [primaryStats, localStats, data?.caches?.ownBattleStats]
      .filter(value => isRecord(value) && Number(value.total) > 0)
      .sort((a,b) => Number(b.checkedAt || 0) - Number(a.checkedAt || 0))[0] || null;
    return { [DATA_STORAGE_KEY]:data, [OWN_BATTLE_STATS_STORAGE_KEY]:stats, storageWriteEvent:STORAGE_WRITE_EVENT };
  }

  function installStorageBridge() {
    let pendingWrite = Promise.resolve();
    document.addEventListener(STORAGE_WRITE_EVENT, event => {
      try {
        const payload = JSON.parse(String(event?.detail || ''));
        if (!isRecord(payload) || !BRIDGED_STORAGE_KEYS.has(payload.key)) return;
        if (payload.remove) {
          if (payload.key !== DATA_STORAGE_KEY) return;
          try { globalThis.localStorage?.removeItem(DATA_MIRROR_KEY); globalThis.localStorage?.removeItem(DATA_STORAGE_KEY); } catch {}
          if (typeof globalThis.GM_deleteValue === 'function') globalThis.GM_deleteValue(DATA_STORAGE_KEY);
          return;
        }
        if (payload.key === DATA_STORAGE_KEY) writeMirror(payload.value);
        else try { globalThis.localStorage?.setItem(payload.key, JSON.stringify(payload.value)); } catch {}
        // Native PDA storage calls can be asynchronous. Preserve write order
        // so a slow old write cannot finish after the fresh battle-stat save.
        pendingWrite = pendingWrite.then(async () => {
          if (payload.key === OWN_BATTLE_STATS_STORAGE_KEY) {
            const previous = await gmRead(payload.key, null);
            if (Number(previous?.checkedAt || 0) > Number(payload.value?.checkedAt || 0)) return;
          }
          await gmWrite(payload.key, payload.value);
        }).catch(() => undefined);
      } catch {}
    });
  }

  async function gmRead(key, fallback = null) {
    try {
      if (typeof globalThis.GM_getValue !== 'function') return fallback;
      return await Promise.resolve(globalThis.GM_getValue(key, fallback));
    } catch { return fallback; }
  }

  async function gmWrite(key, value) {
    try {
      if (typeof globalThis.GM_setValue === 'function') await Promise.resolve(globalThis.GM_setValue(key, value));
    } catch {}
  }

  function validBundle(value) {
    return Boolean(
      isRecord(value) &&
      value.schema === 1 &&
      typeof value.runtimeSource === 'string' &&
      value.runtimeSource.length > 1000 &&
      Array.isArray(value.addonSources) &&
      value.addonSources.every(source => typeof source === 'string' && source.length > 100)
    );
  }

  async function fetchSource(url) {
    if (typeof globalThis.PDA_httpGet === 'function') {
      const response = await globalThis.PDA_httpGet(url);
      const status = Number(response?.status || response?.statusCode || 200);
      if (status < 200 || status >= 300) throw new Error('SLINK source download returned HTTP ' + status + '.');
      return String(response?.data ?? response?.responseText ?? '');
    }
    if (typeof globalThis.GM_xmlhttpRequest === 'function') {
      return await new Promise((resolve, reject) => {
        globalThis.GM_xmlhttpRequest({
          method:'GET',
          url,
          timeout:20000,
          onload:response => response.status >= 200 && response.status < 300
            ? resolve(String(response.responseText || ''))
            : reject(new Error('SLINK source download returned HTTP ' + response.status + '.')),
          onerror:() => reject(new Error('SLINK source download failed.')),
          ontimeout:() => reject(new Error('SLINK source download timed out.'))
        });
      });
    }
    throw new Error('PDA_httpGet is unavailable.');
  }

  function safeSourcePath(value) {
    const path = String(value || '').trim();
    if (!/^src\/[A-Za-z0-9._/-]+$/.test(path) || path.includes('..')) throw new Error('The SLINK source manifest contains an invalid path.');
    return path;
  }

  async function signatureFor(runtimeSource, addonSources) {
    const joined = [runtimeSource, ...addonSources].join('\n;\n');
    try {
      const bytes = new TextEncoder().encode(joined);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      let hash = 2166136261;
      for (let index = 0; index < joined.length; index += 1) {
        hash ^= joined.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return joined.length + ':' + (hash >>> 0).toString(16);
    }
  }

  async function fetchBundle() {
    const nonce = Date.now();
    const manifestText = await fetchSource(MANIFEST_URL + '?t=' + nonce);
    let manifest;
    try { manifest = JSON.parse(manifestText); }
    catch { throw new Error('The SLINK source manifest was not valid JSON.'); }
    if (manifest?.mode !== 'direct-source' || !Array.isArray(manifest.fragments) || !manifest.fragments.length) {
      throw new Error('The SLINK source manifest is incomplete.');
    }
    const fragmentPaths = manifest.fragments.map(safeSourcePath);
    const addonPaths = (manifest.startupAddons || []).map(addon => safeSourcePath(addon?.source));
    const revision = String(manifest.revision || 'unversioned');
    const query = '?v=' + encodeURIComponent(revision) + '&t=' + nonce;
    const sources = await Promise.all(
      [...fragmentPaths, ...addonPaths].map(path => fetchSource(SOURCE_ROOT + path + query))
    );
    const fragmentSources = sources.slice(0, fragmentPaths.length);
    const addonSources = sources.slice(fragmentPaths.length);
    if (fragmentSources.some(source => source.length < 100)) throw new Error('A SLINK runtime source file was empty or incomplete.');
    if (addonSources.some(source => source.length < 100)) throw new Error('A SLINK startup add-on was empty or incomplete.');
    const runtimeSource = fragmentSources.join('');
    const signature = await signatureFor(runtimeSource, addonSources);
    return { schema:1, revision, signature, runtimeSource, addonSources, savedAt:Date.now() };
  }

  async function executeRuntime(source) {
    if (typeof globalThis.PDA_evaluateJavascript === 'function') {
      await globalThis.PDA_evaluateJavascript(source);
      return;
    }
    (0, eval)(source);
  }

  async function waitUntilReady() {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const host = document.getElementById(HOST_ID);
      if (host?.dataset?.slinkReady === 'true' && host?.dataset?.slinkAddonsReady === 'true') {
        document.getElementById(ERROR_ID)?.remove();
        return;
      }
      await new Promise(resolve => globalThis.setTimeout(resolve, 100));
    }
    throw new Error('Runtime did not signal readiness within 20 seconds.');
  }

  async function executeBundle(bundle) {
    const currentHost = document.getElementById(HOST_ID);
    const runtimeReady = currentHost?.dataset?.slinkReady === 'true';
    const addonsReady = currentHost?.dataset?.slinkAddonsReady === 'true';
    if (runtimeReady && addonsReady) return;
    if (currentHost) currentHost.dataset.slinkAddonsReady = 'false';
    const sources = ['globalThis.__SLINK_PDA_ADDONS_READY__=false;'];
    if (!runtimeReady) {
      const bootstrap = 'globalThis.__SLINK_PDA_BOOTSTRAP__=' + JSON.stringify(await collectBootstrap()) + ';';
      sources.push(bootstrap + '\n' + bundle.runtimeSource.split('###PDA-APIKEY###').join(PDA_API_KEY) + '\n//# sourceURL=SLINK_PDA_Direct_Runtime.js\n');
    }
    bundle.addonSources.forEach((source, index) => {
      sources.push(source.split('###PDA-APIKEY###').join(PDA_API_KEY) + '\n//# sourceURL=SLINK_PDA_Direct_Addon_' + (index + 1) + '.js\n');
    });
    sources.push(`globalThis.__SLINK_PDA_ADDONS_READY__=true;
(() => {
const slinkReadyHost=document.getElementById(${JSON.stringify(HOST_ID)});
if(slinkReadyHost) slinkReadyHost.dataset.slinkAddonsReady='true';
})();`);
    await executeRuntime(sources.join('\n;\n'));
    await waitUntilReady();
  }

  async function loadRuntime() {
    const cached = await gmRead(RUNTIME_CACHE_KEY, null);
    const retryCached = globalThis.sessionStorage?.getItem(CACHE_RETRY_KEY) === '1';
    if (retryCached) {
      globalThis.sessionStorage?.removeItem(CACHE_RETRY_KEY);
      if (!validBundle(cached)) return showFailure(new Error('No known-working SLINK runtime is cached yet.'));
      try { await executeBundle(cached); return; }
      catch (error) { return showFailure(error); }
    }

    let fresh;
    try {
      fresh = await fetchBundle();
    } catch (downloadError) {
      if (!validBundle(cached)) return showFailure(downloadError);
      console.warn('[SLINK PDA] Source download failed; using the last-known-working runtime.', downloadError);
      try { await executeBundle(cached); return; }
      catch (cachedError) { return showFailure(cachedError); }
    }

    try {
      await executeBundle(fresh);
      await gmWrite(RUNTIME_CACHE_KEY, fresh);
    } catch (runtimeError) {
      if (validBundle(cached) && cached.signature !== fresh.signature) {
        try {
          globalThis.sessionStorage?.setItem(CACHE_RETRY_KEY, '1');
          globalThis.location.reload();
          return;
        } catch {}
      }
      showFailure(runtimeError);
    }
  }

  installStorageBridge();
  await loadRuntime();
})();


