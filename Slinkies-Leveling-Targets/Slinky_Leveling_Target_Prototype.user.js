// ==UserScript==
// @name         SLINK Leveling Service
// @namespace    Considious [3853023]
// @version      0.12.4
// @description  Authenticated client for the Shared Live Intelligence NetworK leveling service.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Slinkies-Leveling-Targets/Slinky_Leveling_Target_Prototype.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Slinkies-Leveling-Targets/Slinky_Leveling_Target_Prototype.user.js
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/main/shared/Considious_Torn_Lib.js?v=1.3.6
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @connect      ffscouter.com
// @connect      raw.githubusercontent.com
// @connect      slinkyleveling.richard-johnson554.workers.dev
// @run-at       document-end
// ==/UserScript==

(async function () {
    'use strict';

    // Release: 0.12.4-pda-api-key-options

    const PDA_CORE_LIB_URL =
        'https://raw.githubusercontent.com/Considious/Torn-Scripts/main/' +
        'shared/Considious_Torn_Lib.js?v=1.3.6';
    const PDA_CORE_LOAD_PROMISE_KEY = '__slinkLevelingPdaCoreLoad_v1_3_6';


    function isPdaRuntime() {
        return Boolean(
            typeof globalThis.PDA_httpGet === 'function' ||
            typeof globalThis.PDA_evaluateJavascript === 'function' ||
            typeof globalThis.flutter_inappwebview?.callHandler === 'function'
        );
    }


    async function waitForInitialRuntime(timeoutMs = 5_000) {
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeoutMs) {
            if (globalThis.ConsidiousTornLib) {
                return 'core';
            }
            if (isPdaRuntime()) {
                return 'pda';
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return 'missing';
    }


    async function waitForPdaCoreHandlers(timeoutMs = 5_000) {
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeoutMs) {
            if (
                typeof globalThis.PDA_httpGet === 'function' &&
                typeof globalThis.PDA_evaluateJavascript === 'function'
            ) {
                return {
                    httpGet: globalThis.PDA_httpGet,
                    evaluateJavascript: globalThis.PDA_evaluateJavascript
                };
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        throw new Error('Torn PDA core-loading handlers did not become available.');
    }

    async function waitForTornLib(timeoutMs = 5_000) {
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeoutMs) {
            if (globalThis.ConsidiousTornLib) {
                return globalThis.ConsidiousTornLib;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        throw new Error('Considious Torn Library did not become available.');
    }


    function pdaResponseText(response) {
        if (typeof response === 'string') return response;
        if (typeof response?.responseText === 'string') return response.responseText;
        if (typeof response?.data === 'string') return response.data;
        return '';
    }


    async function loadTornLibThroughPda() {
        if (globalThis.ConsidiousTornLib) {
            return globalThis.ConsidiousTornLib;
        }

        if (!globalThis[PDA_CORE_LOAD_PROMISE_KEY]) {
            globalThis[PDA_CORE_LOAD_PROMISE_KEY] = (async () => {
                const handlers = await waitForPdaCoreHandlers();
                const response = await handlers.httpGet(PDA_CORE_LIB_URL, {
                    Accept: 'text/plain'
                });
                const status = Number(response?.status) || 0;

                if (status && (status < 200 || status >= 300)) {
                    throw new Error(`Core Lib download returned HTTP ${status}.`);
                }

                const source = pdaResponseText(response);
                if (!source || !source.includes('ConsidiousTornLib')) {
                    throw new Error('Core Lib download was empty or invalid.');
                }

                await handlers.evaluateJavascript(
                    `${source}\n//# sourceURL=SLINK-PDA-Core-Lib.js`
                );
                return waitForTornLib();
            })();
        }

        try {
            return await globalThis[PDA_CORE_LOAD_PROMISE_KEY];
        } catch (error) {
            delete globalThis[PDA_CORE_LOAD_PROMISE_KEY];
            throw error;
        }
    }


    async function resolveTornLib() {
        const runtime = await waitForInitialRuntime();

        if (runtime === 'core') {
            return {
                library: globalThis.ConsidiousTornLib,
                pda: isPdaRuntime(),
                loadMode: isPdaRuntime()
                    ? 'pda-preloaded'
                    : (globalThis.ConsidiousTornLib.LOAD_MODE || 'unknown')
            };
        }

        if (runtime === 'pda') {
            return {
                library: await loadTornLibThroughPda(),
                pda: true,
                loadMode: 'pda-remote'
            };
        }

        throw new Error(
            'Core Lib was not supplied by @require and Torn PDA was not detected.'
        );
    }


    let coreRuntime;

    try {
        coreRuntime = await resolveTornLib();
    } catch (error) {
        console.error(
            '[SLINK Leveling] Core Lib failed to load:',
            error
        );

        alert(
            'SLINK Leveling could not start.\n\n' +
            'Considious Torn Core did not load.\n\n' +
            (isPdaRuntime()
                ? 'Torn PDA could not download Core Lib automatically. ' +
                    'Check your connection and reload Torn.'
                : 'Check that your userscript manager allowed the @require dependency.')
        );

        return;
    }


    const TornLib = coreRuntime.library;
    const PDA_RUNTIME = coreRuntime.pda;
    const CORE_LOAD_MODE = coreRuntime.loadMode;
    const PDA_API_KEY_TOKEN = ['###', 'PDA-APIKEY', '###'].join('');
    const PDA_API_KEY = String('###PDA-APIKEY###').trim();
    const PDA_API_KEY_AVAILABLE = Boolean(
        PDA_RUNTIME &&
        PDA_API_KEY &&
        PDA_API_KEY !== PDA_API_KEY_TOKEN
    );
    const SCRIPT_VERSION = '0.12.4';
    const SCRIPT_NAME = 'SLINK Leveling Service';
    const WORKER_URL = 'https://slinkyleveling.richard-johnson554.workers.dev';
    const TERMS_VERSION = '2026-08-14';
    const TERMS_DOCUMENT_SHA256 =
        '398d720e740d2d22fc4c594c2ae7b787aa8a8e267c93a4e7c7c354eb1888f2f4';
    const LEVELING_DISCLOSURE_VERSION = '2026-08-14';
    const LEVELING_DISCLOSURE_SHA256 =
        '336b08215844da186a78031b0a01fbb2090d0ca32c86bb243b8e36f098bcb18d';
    const TERMS_URL =
        'https://github.com/Considious/Torn-Scripts/blob/main/' +
        'Slinkies-Leveling-Targets/terms/2026-08-14/' +
        'SLINK_API_Data_Terms_of_Service.md';
    const LEVELING_TERMS_SUMMARY =
        'Your Torn API key is sent to SLINK only for faction authentication ' +
        'and is otherwise used locally for assigned Torn requests; ordinary ' +
        'member keys are not stored remotely. SLINK persistently shares target ' +
        'status, hospital timing, activity matches, competition measurements, ' +
        'scheduling and coordination data with authorized Slinky\'s members. ' +
        'Exact member battle stats and Fair Fight values stay in this browser. ' +
        'Your Torn user ID, the accepted terms version, document fingerprint ' +
        'and acceptance time are retained in SLINK\'s separate consent ledger.';

    const ACTIVITY_WINDOW_DAYS = 7;
    const ACTIVITY_REFRESH_MS = 24 * 60 * 60 * 1000;
    const FF_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
    const BATTLE_STATS_CACHE_MS = 24 * 60 * 60 * 1000;
    const DEFAULT_POLL_SECONDS = 300;
    const MAX_DISPLAY = 40;
    const MAX_CLIENT_EVENTS = 100;
    const MAX_INTERVAL_CHECKS = 300;
    const OBSERVATION_BATCH_SIZE = 200;
    const CHECK_PACING_GRACE_MS = 5_000;
    const LOCAL_CHECK_RETRY_MS = 24 * 60 * 60 * 1000;
    const MAX_LOCAL_PENDING_CHECKS = 600;
    const PDA_UI_HEARTBEAT_MS = 1_000;
    const PDA_UI_RECOVERY_GAP_MS = 3_000;

    const KEYS = {
        tornKey: 'slinkyLeveling.tornApiKey',
        ffKey: 'slinkyLeveling.ffApiKey',
        usePdaTornKey: 'slinkyLeveling.usePdaTornKey.v1',
        usePdaFfKey: 'slinkyLeveling.usePdaFfKey.v1',
        pollSeconds: 'slinkyLeveling.pollSeconds',
        minFF: 'slinkyLeveling.minFF',
        maxFF: 'slinkyLeveling.maxFF',
        collapsed: 'slinkyLeveling.collapsed',
        panelPosition: 'slinkyLeveling.panelPosition.v1',
        bubblePosition: 'slinkyLeveling.bubblePosition.v1',
        sessionToken: 'slinkyLeveling.workerSession.v1',
        sessionExpiresAt: 'slinkyLeveling.workerSessionExpiresAt.v1',
        lastActivitySyncAt: 'slinkyLeveling.lastActivitySyncAt.v1',
        ffCache: 'slinkyLeveling.ffCache.v1',
        battleStats: 'slinkyLeveling.localBattleStats.v1',
        runtimeState: 'slinkyLeveling.clientRuntime.v1',
        clientEvents: 'slinkyLeveling.clientEvents.v1',
        pendingChecks: 'slinkyLeveling.pendingChecks.v1',
        completedCheckBatches: 'slinkyLeveling.completedCheckBatches.v1',
        acceptedConsentVersion: 'slinkyLeveling.acceptedConsentVersion.v1',
        uiHidden: 'slinkyLeveling.uiHidden.v1',
        uiHeartbeat: 'slinkyLeveling.uiHeartbeat.v1'
    };

    const persistedRuntime = loadJson(KEYS.runtimeState, {});
    const persistedFairFightCache = loadJson(KEYS.ffCache, {});
    const persistedBattleStats = loadJson(KEYS.battleStats, {});

    const state = {
        targets: [],
        recommendationTargets: [],
        ffCache: persistedFairFightCache,
        battleStats: persistedBattleStats,
        polling: false,
        authenticating: false,
        settingsOpen: false,
        termsOpen: false,
        debugOpen: false,
        lastError: '',
        workerVersion: '',
        collector: false,
        collectorExpiresAt: 0,
        cycleStatus: '',
        fairFightStatus: '',
        lastCycleAt: Number(persistedRuntime.lastCycleAt) || 0,
        lastCycleChecked: Number(persistedRuntime.lastCycleChecked) || 0,
        lastCycleReported: Number(persistedRuntime.lastCycleReported) || 0,
        lastActivitySyncAt: Number(GM_getValue(KEYS.lastActivitySyncAt, 0)) || 0,
        activeTargetsReported: Number(persistedRuntime.activeTargetsReported) || 0,
        lastFairFightAt: Number(persistedRuntime.lastFairFightAt) ||
            latestFairFightCacheTime(persistedFairFightCache),
        lastFairFightRequested: Number(persistedRuntime.lastFairFightRequested) || 0,
        lastFairFightSaved: Number(persistedRuntime.lastFairFightSaved) || 0,
        clientEvents: loadJson(KEYS.clientEvents, []),
        timer: null,
        leader: null
    };
    let panelDragController = null;
    let pdaUiHeartbeatTimer = null;
    const PDA_CORE_MODE = PDA_RUNTIME;


    // ================================================================
    // Local settings and session storage
    // ================================================================

    function loadJson(key, fallback) {
        try {
            const value = GM_getValue(key, undefined);
            return value === undefined ? fallback : value;
        } catch {
            return fallback;
        }
    }


    function saveJson(key, value) {
        GM_setValue(key, value);
        return value;
    }


    // Tampermonkey is the durable retry layer for this device. Cloudflare's
    // edge cache is only a short-lived mirror and deterministic scheduling
    // safely reoffers work if both copies disappear.
    function loadPendingChecks() {
        const cutoff = Date.now() - LOCAL_CHECK_RETRY_MS;
        const checks = loadJson(KEYS.pendingChecks, []);

        if (!Array.isArray(checks)) return [];

        return checks.filter(check => {
            return (
                Number.isInteger(Number(check?.id)) &&
                Number(check.id) > 0 &&
                Number(check?.queued_at || 0) >= cutoff
            );
        });
    }


    function savePendingChecks(checks) {
        return saveJson(
            KEYS.pendingChecks,
            checks.slice(0, MAX_LOCAL_PENDING_CHECKS)
        );
    }


    function loadCompletedCheckBatches() {
        const now = Date.now();
        const stored = loadJson(KEYS.completedCheckBatches, {});
        const current = {};

        for (const [batchId, entry] of Object.entries(stored || {})) {
            if (Number(entry?.expires_at || 0) > now) {
                current[batchId] = {
                    target_ids: Array.isArray(entry?.target_ids)
                        ? entry.target_ids.map(Number).filter(Number.isInteger)
                        : [],
                    expires_at: Number(entry.expires_at)
                };
            }
        }

        saveJson(KEYS.completedCheckBatches, current);
        return current;
    }


    function rememberCompletedChecks(observations, acceptedTargetIds) {
        const accepted = new Set(acceptedTargetIds.map(Number));
        const batches = loadCompletedCheckBatches();

        for (const observation of observations) {
            const targetId = Number(observation?.target_id);
            const batchId = String(observation?.check_batch_id || '').trim();

            if (!batchId || !accepted.has(targetId)) continue;

            const entry = batches[batchId] || {
                target_ids: [],
                expires_at: Date.now() + LOCAL_CHECK_RETRY_MS
            };
            entry.target_ids = [...new Set([
                ...entry.target_ids.map(Number),
                targetId
            ])];
            entry.expires_at = Date.now() + LOCAL_CHECK_RETRY_MS;
            batches[batchId] = entry;
        }

        saveJson(KEYS.completedCheckBatches, batches);
    }


    function mergePendingAndClaimedChecks(claimedChecks) {
        const completedBatches = loadCompletedCheckBatches();
        const merged = new Map();

        for (const check of loadPendingChecks()) {
            merged.set(Number(check.id), check);
        }

        for (const check of claimedChecks) {
            const batchId = String(check?.check_batch_id || '').trim();
            const completed = new Set(
                completedBatches[batchId]?.target_ids?.map(Number) || []
            );

            if (completed.has(Number(check.id))) continue;

            if (!merged.has(Number(check.id))) {
                merged.set(Number(check.id), {
                    ...check,
                    queued_at: Date.now()
                });
            }
        }

        return [...merged.values()];
    }


    function reconcilePendingChecks(observations, report) {
        const accepted = new Set(
            (report.accepted || []).map(row => Number(row.target_id))
        );
        const rejected = new Set(
            (report.rejected || []).map(row => Number(row.target_id))
        );
        const finished = new Set([...accepted, ...rejected]);

        rememberCompletedChecks(observations, [...accepted]);
        savePendingChecks(
            loadPendingChecks().filter(check => !finished.has(Number(check.id)))
        );
    }


    function latestFairFightCacheTime(cache) {
        return Object.values(cache || {}).reduce((latest, row) => {
            return Math.max(latest, Number(row?.checkedAt) || 0);
        }, 0);
    }


    function storedBoolean(value, fallback = false) {
        if (value === true || value === 1 || value === 'true' || value === '1') {
            return true;
        }
        if (value === false || value === 0 || value === 'false' || value === '0') {
            return false;
        }
        return fallback;
    }


    function getSettings() {
        const manualTornKey = String(
            GM_getValue(KEYS.tornKey, '') || ''
        ).trim();
        const manualFfKey = String(
            GM_getValue(KEYS.ffKey, '') || ''
        ).trim();
        const usePdaTornKey = PDA_API_KEY_AVAILABLE && storedBoolean(
            GM_getValue(KEYS.usePdaTornKey, undefined),
            !manualTornKey
        );
        const usePdaFfKey = PDA_API_KEY_AVAILABLE && storedBoolean(
            GM_getValue(KEYS.usePdaFfKey, undefined),
            false
        );

        return {
            tornKey: usePdaTornKey ? PDA_API_KEY : manualTornKey,
            ffKey: usePdaFfKey ? PDA_API_KEY : manualFfKey,
            manualTornKey,
            manualFfKey,
            usePdaTornKey,
            usePdaFfKey,
            pollSeconds: clamp(
                Number(GM_getValue(KEYS.pollSeconds, DEFAULT_POLL_SECONDS)) ||
                    DEFAULT_POLL_SECONDS,
                60,
                300
            ),
            minFF: clamp(Number(GM_getValue(KEYS.minFF, 1)) || 1, 1, 3),
            maxFF: clamp(Number(GM_getValue(KEYS.maxFF, 3)) || 3, 1, 3),
            collapsed: Boolean(GM_getValue(KEYS.collapsed, false))
        };
    }


    function saveSettings(values) {
        const previous = getSettings();
        const manualTornKey = String(values.tornKey || '').trim();
        const manualFfKey = String(values.ffKey || '').trim();
        const usePdaTornKey = Boolean(
            PDA_API_KEY_AVAILABLE && values.usePdaTornKey
        );
        const usePdaFfKey = Boolean(
            PDA_API_KEY_AVAILABLE && values.usePdaFfKey
        );
        const tornKey = usePdaTornKey ? PDA_API_KEY : manualTornKey;
        const ffKey = usePdaFfKey ? PDA_API_KEY : manualFfKey;

        GM_setValue(KEYS.tornKey, manualTornKey);
        GM_setValue(KEYS.ffKey, manualFfKey);
        GM_setValue(KEYS.usePdaTornKey, usePdaTornKey);
        GM_setValue(KEYS.usePdaFfKey, usePdaFfKey);
        GM_setValue(
            KEYS.pollSeconds,
            clamp(
                Number(values.pollSeconds) || DEFAULT_POLL_SECONDS,
                60,
                300
            )
        );
        GM_setValue(KEYS.minFF, clamp(Number(values.minFF) || 1, 1, 3));
        GM_setValue(KEYS.maxFF, clamp(Number(values.maxFF) || 3, 1, 3));

        if (tornKey !== previous.tornKey) {
            state.battleStats = {};
            saveJson(KEYS.battleStats, state.battleStats);
        }

        if (ffKey !== previous.ffKey) {
            state.ffCache = {};
            saveJson(KEYS.ffCache, state.ffCache);
        }
    }


    function saveRuntimeState() {
        saveJson(KEYS.runtimeState, {
            lastCycleAt: state.lastCycleAt,
            lastCycleChecked: state.lastCycleChecked,
            lastCycleReported: state.lastCycleReported,
            activeTargetsReported: state.activeTargetsReported,
            lastFairFightAt: state.lastFairFightAt,
            lastFairFightRequested: state.lastFairFightRequested,
            lastFairFightSaved: state.lastFairFightSaved
        });
    }


    function clearWorkerSession() {
        GM_setValue(KEYS.sessionToken, '');
        GM_setValue(KEYS.sessionExpiresAt, 0);
        state.collector = false;
        state.collectorExpiresAt = 0;
    }


    function hasAcceptedCurrentTerms() {
        return String(
            GM_getValue(KEYS.acceptedConsentVersion, '') || ''
        ) === `${TERMS_VERSION}:${LEVELING_DISCLOSURE_VERSION}`;
    }


    function clamp(value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }


    // ================================================================
    // Authenticated Worker client
    // ================================================================

    async function ensureWorkerSession(force = false) {
        if (!hasAcceptedCurrentTerms()) {
            throw new Error(
                'Review and accept the current SLINK API & Data Terms before authentication.'
            );
        }

        const token = String(GM_getValue(KEYS.sessionToken, '') || '').trim();
        const expiresAt = Number(GM_getValue(KEYS.sessionExpiresAt, 0)) || 0;

        if (!force && token && expiresAt > Date.now() + 60_000) {
            return token;
        }

        if (state.authenticating) {
            throw new Error('Authentication is already in progress.');
        }

        const apiKey = getSettings().tornKey;
        if (!apiKey) {
            throw new Error('Add your Torn API key in Settings to authenticate.');
        }

        state.authenticating = true;

        try {
            const reservation = await TornLib.reserveTornApiSlot({
                url: 'https://api.torn.com/v2/key/info',
                method: 'GET',
                script: SCRIPT_NAME,
                priority: 'authentication',
                limit: TornLib.TORN_API_DEFAULT_LIMIT,
                wait: true,
                maxWaitMs: 65_000
            });
            let response;

            try {
                response = await workerRequest('/api/auth', {
                    method: 'POST',
                    auth: false,
                    retryAuthentication: false,
                    body: {
                        api_key: apiKey,
                        terms_accepted: true,
                        terms_version: TERMS_VERSION,
                        terms_sha256: TERMS_DOCUMENT_SHA256,
                        disclosure_version: LEVELING_DISCLOSURE_VERSION,
                        disclosure_sha256: LEVELING_DISCLOSURE_SHA256,
                        client_name: SCRIPT_NAME,
                        client_version: SCRIPT_VERSION
                    }
                });
                await TornLib.finishTornApiLog(reservation, {
                    status: 200,
                    result: 'Authenticated through Cloudflare'
                });
            } catch (error) {
                await TornLib.finishTornApiLog(reservation, {
                    result: 'Authentication failed'
                });
                throw error;
            }

            if (!response?.session_token) {
                throw new Error('Cloudflare did not return a session token.');
            }

            if (response.terms_version !== TERMS_VERSION) {
                throw new Error(
                    'SLINK returned a different terms version. Update the userscript before continuing.'
                );
            }

            GM_setValue(KEYS.sessionToken, response.session_token);
            GM_setValue(KEYS.sessionExpiresAt, Date.parse(response.expires_at) || 0);
            logClientEvent('authenticated', {
                userId: response.user_id,
                expiresAt: response.expires_at
            });
            return response.session_token;
        } finally {
            state.authenticating = false;
        }
    }


    async function workerRequest(path, options = {}) {
        const method = String(options.method || 'GET').toUpperCase();
        const auth = options.auth !== false;
        const retryAuthentication = options.retryAuthentication !== false;
        const headers = {
            Accept: 'application/json'
        };

        if (auth) {
            const token = await ensureWorkerSession(false);
            headers.Authorization = `Bearer ${token}`;
        }

        let data;
        if (options.body !== undefined) {
            headers['Content-Type'] = 'application/json';
            data = JSON.stringify(options.body);
        }

        const response = await gmRequest({
            method,
            url: `${WORKER_URL}${path}`,
            headers,
            data
        });
        const workerVersion = response.headers['x-slinky-worker-version'];
        if (workerVersion) state.workerVersion = workerVersion;

        let body;
        try {
            body = response.text ? JSON.parse(response.text) : {};
        } catch {
            throw new Error(`Cloudflare returned unreadable JSON (HTTP ${response.status}).`);
        }

        if (response.status === 401 && auth && retryAuthentication) {
            clearWorkerSession();
            await ensureWorkerSession(true);
            return workerRequest(path, {
                ...options,
                retryAuthentication: false
            });
        }

        if (response.status < 200 || response.status >= 300) {
            throw new Error(body?.error || `Cloudflare request failed (HTTP ${response.status}).`);
        }

        return body;
    }


    function gmRequest(options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method,
                url: options.url,
                headers: options.headers,
                data: options.data,
                timeout: 30_000,
                onload: response => {
                    resolve({
                        status: Number(response.status) || 0,
                        text: String(response.responseText || ''),
                        headers: parseResponseHeaders(response.responseHeaders)
                    });
                },
                ontimeout: () => reject(new Error('Cloudflare request timed out.')),
                onerror: () => reject(new Error('Could not reach the Cloudflare Worker.'))
            });
        });
    }


    function parseResponseHeaders(rawHeaders) {
        const headers = {};
        for (const line of String(rawHeaders || '').split(/\r?\n/)) {
            const separator = line.indexOf(':');
            if (separator <= 0) continue;
            headers[line.slice(0, separator).trim().toLowerCase()] =
                line.slice(separator + 1).trim();
        }
        return headers;
    }


    // ================================================================
    // Local-only player strength and immediate Fair Fight estimates
    // ================================================================

    async function ensureLocalBattleStats(apiKey, force = false) {
        const cachedAt = Number(state.battleStats?.checkedAt) || 0;
        const cachedScore = Number(state.battleStats?.score) || 0;
        const fresh = (
            cachedScore > 0 &&
            cachedAt > 0 &&
            Date.now() - cachedAt < BATTLE_STATS_CACHE_MS
        );

        if (!force && fresh) return state.battleStats;

        const data = await TornLib.tornRequest(
            'https://api.torn.com/v2/user/battlestats',
            apiKey,
            {
                tornScript: SCRIPT_NAME,
                tornPriority: 'normal',
                tornLimit: TornLib.TORN_API_DEFAULT_LIMIT,
                tornWait: true,
                tornMaxWaitMs: 65_000
            }
        );
        const stats = data?.battlestats ?? data;
        const values = [
            battleStatValue(stats?.strength),
            battleStatValue(stats?.defense),
            battleStatValue(stats?.speed),
            battleStatValue(stats?.dexterity)
        ];

        if (values.some(value => value === null)) {
            throw new Error('Torn returned incomplete battle stats.');
        }

        const score = values.reduce((sum, value) => sum + Math.sqrt(value), 0);
        const total = finiteNumberOrNull(stats?.total) ??
            values.reduce((sum, value) => sum + value, 0);

        if (!Number.isFinite(score) || score <= 0 || total <= 0) {
            throw new Error('Torn returned unusable battle stats.');
        }

        state.battleStats = {
            score,
            total,
            checkedAt: Date.now()
        };
        saveJson(KEYS.battleStats, state.battleStats);
        logClientEvent('local_strength_cached', {
            checkedAt: state.battleStats.checkedAt
        });
        return state.battleStats;
    }


    function battleStatValue(stat) {
        const value = finiteNumberOrNull(stat?.value ?? stat);
        return value !== null && value >= 0 ? value : null;
    }


    function localTargetStatRange(settings = getSettings()) {
        const attackerScore = Number(state.battleStats?.score) || 0;
        if (attackerScore <= 0) return null;

        const minFairFight = Math.min(settings.minFF, settings.maxFF);
        const maxFairFight = Math.max(settings.minFF, settings.maxFF);
        const minScoreRatio = fairFightToScoreRatio(minFairFight);
        const maxScoreRatio = fairFightToScoreRatio(maxFairFight);
        const minimum = balancedTotalFromScore(attackerScore * minScoreRatio);
        const maximum = balancedTotalFromScore(attackerScore * maxScoreRatio);

        return {
            min: minScoreRatio > 0 ? Math.max(1, Math.floor(minimum)) : 0,
            max: Math.max(1, Math.ceil(maximum))
        };
    }


    function fairFightToScoreRatio(fairFight) {
        return clamp(((clamp(fairFight, 1, 3) - 1) * 3) / 8, 0, 0.75);
    }


    function balancedTotalFromScore(score) {
        return Math.min(Number.MAX_SAFE_INTEGER, Math.pow(score / 2, 2));
    }


    function balancedScoreFromTotal(totalStats) {
        const total = finiteNumberOrNull(totalStats);
        return total !== null && total > 0 ? 2 * Math.sqrt(total) : null;
    }


    function estimateLocalFairFight(totalStats) {
        const attackerScore = Number(state.battleStats?.score) || 0;
        const defenderScore = balancedScoreFromTotal(totalStats);
        if (attackerScore <= 0 || defenderScore === null) return null;

        return clamp(1 + (8 / 3) * (defenderScore / attackerScore), 1, 3);
    }


    function localDifficulty(totalStats) {
        const attackerScore = Number(state.battleStats?.score) || 0;
        const defenderScore = balancedScoreFromTotal(totalStats);
        if (attackerScore <= 0 || defenderScore === null) return null;

        const ratio = defenderScore / attackerScore;
        if (ratio <= 0.35) return { label: 'Easy', className: 'slp-easy' };
        if (ratio <= 0.6) return { label: 'Good', className: 'slp-good' };
        if (ratio <= 0.75) return { label: 'Fair', className: 'slp-fair' };
        return { label: 'Risky', className: 'slp-risky' };
    }


    // ================================================================
    // Browser-side data collection assigned by Cloudflare
    // ================================================================

    async function runCycle(forceActivity = false) {
        if (state.polling) return;
        if (!state.leader?.isLeader()) {
            render();
            return;
        }

        const settings = getSettings();

        if (!hasAcceptedCurrentTerms()) {
            clearWorkerSession();
            state.lastError =
                'Review and accept the current SLINK API & Data Terms to use this service.';
            state.cycleStatus = 'Terms acceptance required';
            state.settingsOpen = true;
            render();
            return;
        }

        if (!settings.tornKey) {
            state.lastError = 'Add your Torn API key in Settings.';
            state.settingsOpen = true;
            render();
            return;
        }

        state.polling = true;
        const cycleStartedAt = Date.now();

        state.lastError = '';
        state.cycleStatus = 'Connecting to the SLINK Network…';
        render();

        try {
            await ensureWorkerSession(false);

            state.cycleStatus = 'Reading your locally cached strength range…';
            render();
            try {
                await ensureLocalBattleStats(settings.tornKey);
            } catch (error) {
                state.lastError = `Local Fair Fight estimate: ${TornLib.errorMessage(error)}`;
            }

            state.cycleStatus = 'Asking the SLINK Network for targets…';
            await refreshRecommendations();
            render();

            let fairFightTask = Promise.resolve(null);
            if (settings.ffKey) {
                fairFightTask = hydrateRecommendationFairFight(settings.ffKey)
                    .catch(error => {
                        state.fairFightStatus = 'FFScouter refinement failed; local estimates remain available';
                        state.lastError = `FFScouter: ${TornLib.errorMessage(error)}`;
                        render();
                        return null;
                    });
            } else {
                state.fairFightStatus = state.battleStats?.score
                    ? 'Approximate Fair Fight is ready · Add FFScouter to refine it'
                    : 'Add FFScouter for Fair Fight values';
            }

            if (!state.collector) {
                await fairFightTask;
                state.cycleStatus = 'Targets ready · Standby device';
                state.lastCycleAt = Date.now();
                state.lastCycleChecked = 0;
                state.lastCycleReported = 0;
                logClientEvent('cycle_standby', {
                    collectorExpiresAt: state.collectorExpiresAt
                });
                saveRuntimeState();
                return;
            }

            state.cycleStatus = 'Running scheduled Torn checks…';
            render();
            await syncActivitySnapshots(settings.tornKey, forceActivity);

            const intervalCapacity = checkPlanCapacity(settings.pollSeconds);

            const claim = await workerRequest('/api/checks/claim', {
                method: 'POST',
                body: {
                    interval_capacity: intervalCapacity,
                    poll_seconds: settings.pollSeconds
                }
            });
            state.collector = claim?.collector === true;
            state.collectorExpiresAt = Number(claim?.collector_expires_at) || 0;
            const claimedChecks = Array.isArray(claim?.checks)
                ? claim.checks
                : [];
            const queuedChecks = mergePendingAndClaimedChecks(claimedChecks);
            savePendingChecks(queuedChecks);
            const checks = queuedChecks.slice(0, intervalCapacity);
            const retryCount = checks.filter(check => {
                return Number(check.queued_at || 0) < cycleStartedAt;
            }).length;
            state.cycleStatus = checks.length
                ? `Running ${checks.length} scheduled Torn checks across ${formatMinutes(settings.pollSeconds)}…`
                : 'No Torn checks are currently due';
            if (checks.length && retryCount) {
                state.cycleStatus += ` (${retryCount} restored locally)`;
            }
            render();

            const checkResult = await runPacedChecks(
                settings.tornKey,
                checks,
                settings.pollSeconds
            );
            const observations = checkResult.observations;

            if (observations.length) {
                const report = await submitObservations(observations);
                state.lastCycleReported = Number(report.accepted_count) || 0;
                reconcilePendingChecks(observations, report);
            } else {
                state.lastCycleReported = 0;
            }

            const failures = checkResult.failures;
            if (failures.length && !state.lastError) {
                state.lastError = `${failures.length} assigned Torn check${failures.length === 1 ? '' : 's'} failed.`;
            }

            await fairFightTask;

            state.lastCycleAt = Date.now();
            state.lastCycleChecked = checks.length;
            state.cycleStatus = `${fairFightReadyCount(state.targets)}/${state.targets.length} Fair Fight values shown · Targets ready`;

            logClientEvent('cycle_completed', {
                intervalCapacity,
                dueChecks: Number(claim?.due_count) || 0,
                activeCollectors: Number(claim?.active_collectors) || 0,
                fairShare: Number(claim?.fair_share) || 0,
                pendingBeforeRun: queuedChecks.length,
                assigned: checks.length,
                reported: observations.length,
                failures: failures.length
            });
            saveRuntimeState();
        } catch (error) {
            state.lastError = TornLib.errorMessage(error);
            logClientEvent('cycle_failed', {
                error: state.lastError
            });
        } finally {
            state.polling = false;
            scheduleNextPoll(cycleStartedAt);
            render();
        }
    }


    function checkPlanCapacity(pollSeconds) {
        const checksPerMinute = Number(TornLib.TORN_API_DEFAULT_LIMIT) || 60;
        return clamp(
            Math.floor(checksPerMinute * (Number(pollSeconds) / 60)),
            1,
            MAX_INTERVAL_CHECKS
        );
    }


    function formatMinutes(pollSeconds) {
        const minutes = Number(pollSeconds) / 60;
        return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} minute${minutes === 1 ? '' : 's'}`;
    }


    async function runPacedChecks(apiKey, checks, pollSeconds) {
        const observations = [];
        const failures = [];
        const horizonMs = Math.max(
            0,
            (Number(pollSeconds) * 1000) - CHECK_PACING_GRACE_MS
        );
        const spacingMs = checks.length > 1
            ? horizonMs / (checks.length - 1)
            : 0;
        const startedAt = Date.now();

        await Promise.all(checks.map(async (target, index) => {
            const delayMs = Math.max(
                0,
                (startedAt + Math.floor(index * spacingMs)) - Date.now()
            );
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            try {
                observations.push(await getUserStatus(apiKey, target, 'normal'));
            } catch (error) {
                failures.push({ target, error });
            }
        }));

        return { observations, failures };
    }


    async function getUserStatus(apiKey, target, priority) {
        const url = `https://api.torn.com/v2/user/${encodeURIComponent(target.id)}/basic`;
        const data = await TornLib.tornRequest(url, apiKey, {
            tornScript: SCRIPT_NAME,
            tornPriority: priority,
            tornLimit: TornLib.TORN_API_DEFAULT_LIMIT,
            tornWait: true,
            tornMaxWaitMs: 65_000
        });
        const source = data?.profile ?? data?.basic ?? data?.user ?? data;
        const status = source?.status ?? data?.status ?? {};
        const stateValue =
            status?.state ??
            status?.description ??
            status?.details ??
            source?.state ??
            'Unknown';
        const description = String(
            status?.description ?? status?.details ?? stateValue ?? 'Unknown'
        );

        return {
            target_id: Number(target.id),
            state: String(stateValue || 'Unknown'),
            description,
            until: Number(status?.until) || 0,
            check_batch_id: String(target?.check_batch_id || '') || undefined,
            source: 'torn_api'
        };
    }


    async function submitObservations(observations) {
        const batchSize = OBSERVATION_BATCH_SIZE;
        const combined = {
            ok: true,
            accepted_count: 0,
            rejected_count: 0,
            accepted: [],
            rejected: []
        };

        for (let offset = 0; offset < observations.length; offset += batchSize) {
            const response = await workerRequest('/api/observations', {
                method: 'POST',
                body: { observations: observations.slice(offset, offset + batchSize) }
            });
            combined.ok = combined.ok && response.ok !== false;
            combined.accepted_count += Number(response.accepted_count) || 0;
            combined.rejected_count += Number(response.rejected_count) || 0;
            combined.accepted.push(...(Array.isArray(response.accepted) ? response.accepted : []));
            combined.rejected.push(...(Array.isArray(response.rejected) ? response.rejected : []));
        }

        return combined;
    }


    async function hydrateRecommendationFairFight(apiKey) {
        const targets = recommendationsNeedingFairFight(
            state.recommendationTargets
        );
        if (!targets.length) {
            applyLocalFairFightToRecommendations();
            state.fairFightStatus = 'Fair Fight values loaded from local cache';
            return { requestedCount: 0, savedCount: 0, cachedAt: 0 };
        }

        state.fairFightStatus = `Refining ${targets.length} Fair Fight estimate${targets.length === 1 ? '' : 's'} in the background…`;
        render();
        logClientEvent('fair_fight_started', { requested: targets.length });

        const result = await collectAndCacheFairFight(apiKey, targets);
        state.lastFairFightAt = result.cachedAt || Date.now();
        state.lastFairFightRequested = targets.length;
        state.lastFairFightSaved = result.savedCount;
        state.fairFightStatus = `${result.savedCount} Fair Fight value${result.savedCount === 1 ? '' : 's'} refined · Cached locally for 7 days`;
        applyLocalFairFightToRecommendations();
        saveRuntimeState();
        render();
        logClientEvent('fair_fight_cached_locally', {
            requested: targets.length,
            saved: result.savedCount,
            cachedAt: result.cachedAt
        });

        return {
            requestedCount: targets.length,
            savedCount: result.savedCount,
            cachedAt: result.cachedAt
        };
    }


    async function collectAndCacheFairFight(apiKey, targets) {
        const uniqueIds = [...new Set(targets.map(target => String(target.id)))];
        if (!uniqueIds.length) return { savedCount: 0, cachedAt: 0 };

        const url =
            'https://ffscouter.com/api/v1/get-stats' +
            `?key=${encodeURIComponent(apiKey)}` +
            `&targets=${encodeURIComponent(uniqueIds.join(','))}`;
        const data = await TornLib.requestJson(url, {
            timeout: 20_000,
            invalidJsonMessage: 'FFScouter returned invalid JSON.'
        });
        const rows = Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
                ? data.results
                : Array.isArray(data?.data)
                    ? data.data
                    : [];
        const returned = new Set();
        const cachedAt = Date.now();

        for (const row of rows) {
            const id = Number(row?.player_id ?? row?.id);
            if (!Number.isInteger(id) || id <= 0) continue;
            returned.add(String(id));
            state.ffCache[id] = {
                fairFight: finiteNumberOrNull(row?.fair_fight),
                bsEstimate: finiteNumberOrNull(row?.bs_estimate),
                bsEstimateHuman: String(row?.bs_estimate_human || ''),
                source: String(row?.source || 'FFScouter')
                    .slice(0, 100),
                lastUpdated: String(row?.last_updated || ''),
                noData: Boolean(row?.no_data),
                checkedAt: cachedAt
            };
        }

        for (const id of uniqueIds) {
            if (returned.has(id)) continue;
            state.ffCache[id] = {
                fairFight: null,
                bsEstimate: null,
                bsEstimateHuman: '',
                source: 'FFScouter',
                lastUpdated: '',
                noData: true,
                checkedAt: cachedAt
            };
        }

        saveJson(KEYS.ffCache, state.ffCache);
        return { savedCount: uniqueIds.length, cachedAt };
    }


    function recommendationsNeedingFairFight(targets) {
        const now = Date.now();
        return targets.filter(target => {
            const checkedAt = Number(state.ffCache[String(target.id)]?.checkedAt) || 0;
            return checkedAt <= 0 || now - checkedAt >= FF_CACHE_MS;
        });
    }


    function applyLocalFairFightToRecommendations() {
        const settings = getSettings();
        const minFairFight = Math.min(settings.minFF, settings.maxFF);
        const maxFairFight = Math.max(settings.minFF, settings.maxFF);

        state.targets = state.recommendationTargets
            .map(target => {
                const cached = state.ffCache[String(target.id)] || {};
                const refinedFairFight = finiteNumberOrNull(cached.fairFight);
                const estimatedFairFight = estimateLocalFairFight(target.total_stats);
                const useEstimate = refinedFairFight === null && estimatedFairFight !== null;
                return {
                    ...target,
                    fair_fight: refinedFairFight ?? estimatedFairFight,
                    fair_fight_estimated: useEstimate,
                    bs_estimate: finiteNumberOrNull(cached.bsEstimate) ??
                        finiteNumberOrNull(target.total_stats),
                    fair_fight_source: refinedFairFight !== null
                        ? String(cached.source || 'FFScouter')
                        : useEstimate
                            ? 'Local estimate'
                            : '',
                    fair_fight_checked_at: refinedFairFight !== null
                        ? Number(cached.checkedAt) || 0
                        : 0,
                    local_difficulty: localDifficulty(target.total_stats)
                };
            })
            .filter(target => {
                const fairFight = finiteNumberOrNull(target.fair_fight);
                return fairFight === null || (
                    fairFight >= minFairFight && fairFight <= maxFairFight
                );
            });
    }


    function fairFightReadyCount(targets) {
        return targets.filter(target => {
            if (target?.fair_fight === null || target?.fair_fight === undefined) {
                return false;
            }
            const value = Number(target.fair_fight);
            return Number.isFinite(value) && value > 0;
        }).length;
    }


    async function syncActivitySnapshots(apiKey, force = false) {
        const fresh = (
            state.lastActivitySyncAt > 0 &&
            Date.now() - state.lastActivitySyncAt < ACTIVITY_REFRESH_MS
        );
        if (!force && fresh) return;

        const targetIds = await loadAllTargetIds();
        const activeTargets = {};

        for (let daysAgo = 0; daysAgo < ACTIVITY_WINDOW_DAYS; daysAgo++) {
            const timestamp = activitySnapshotTimestamp(daysAgo);
            const url = `https://api.torn.com/v2/user/snapshot?timestamp=${timestamp}`;
            const csv = await TornLib.requestText(url, {
                headers: { Authorization: `ApiKey ${apiKey}` },
                timeout: 30_000,
                tornScript: SCRIPT_NAME,
                tornPriority: 'background',
                tornLimit: TornLib.TORN_API_DEFAULT_LIMIT,
                tornWait: true,
                tornMaxWaitMs: 65_000,
                networkErrorMessage: 'Could not load Torn daily activity snapshot.'
            });

            collectSnapshotTargetIds(csv, targetIds, timestamp, activeTargets);
        }

        if (Object.keys(activeTargets).length) {
            await workerRequest('/api/activity', {
                method: 'POST',
                body: { active_targets: activeTargets }
            });
        }

        state.lastActivitySyncAt = Date.now();
        state.activeTargetsReported = Object.keys(activeTargets).length;
        GM_setValue(KEYS.lastActivitySyncAt, state.lastActivitySyncAt);
        saveRuntimeState();
        logClientEvent('activity_synced', {
            activeTargets: state.activeTargetsReported
        });
    }


    async function loadAllTargetIds() {
        const ids = new Set();
        let offset = 0;

        while (true) {
            const page = await workerRequest(
                `/api/targets?limit=200&offset=${offset}`
            );
            const targets = Array.isArray(page?.targets) ? page.targets : [];
            for (const target of targets) ids.add(String(target.id));
            if (targets.length < 200) break;
            offset += targets.length;
        }

        return ids;
    }


    function activitySnapshotTimestamp(daysAgo) {
        const date = new Date();
        date.setUTCHours(12, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() - daysAgo);
        return Math.floor(date.getTime() / 1000);
    }


    function collectSnapshotTargetIds(text, targetIds, timestamp, output) {
        const lines = String(text || '').split(/\r?\n/);
        for (let index = 1; index < lines.length; index++) {
            const match = lines[index].match(/^\s*"?(\d+)"?\s*,/);
            if (!match || !targetIds.has(match[1])) continue;
            output[match[1]] = Math.max(Number(output[match[1]]) || 0, timestamp);
        }
    }


    async function refreshRecommendations() {
        const wasCollector = state.collector;
        const settings = getSettings();
        const query = new URLSearchParams({
            limit: String(MAX_DISPLAY),
            poll_seconds: String(settings.pollSeconds),
            min_ff: String(Math.min(settings.minFF, settings.maxFF)),
            max_ff: String(Math.max(settings.minFF, settings.maxFF))
        });
        const targetRange = localTargetStatRange(settings);
        if (targetRange) {
            query.set('min_target_stats', String(targetRange.min));
            query.set('max_target_stats', String(targetRange.max));
        }
        const response = await workerRequest(`/api/recommendations?${query}`);
        state.collector = response?.collector === true;
        state.collectorExpiresAt = Number(response?.collector_expires_at) || 0;
        state.recommendationTargets = Array.isArray(response?.targets)
            ? response.targets
            : [];
        applyLocalFairFightToRecommendations();
        state.workerVersion = response?.version || state.workerVersion;

        if (state.collector !== wasCollector) {
            logClientEvent(
                state.collector ? 'collector_acquired' : 'collector_standby',
                { expiresAt: state.collectorExpiresAt }
            );
        }
    }


    function finiteNumberOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }


    // ================================================================
    // Attack-page observation adapter
    // ================================================================

    function parseVisibleRemainingMs(text) {
        const lower = String(text || '').toLowerCase();
        let total = 0;
        const days = lower.match(/(\d+)\s*d(?:ay)?s?/);
        const hours = lower.match(/(\d+)\s*h(?:our)?s?/);
        const mins = lower.match(/(\d+)\s*m(?:in(?:ute)?)?s?/);
        const secs = lower.match(/(\d+)\s*s(?:ec(?:ond)?)?s?/);
        if (days) total += Number(days[1]) * 24 * 60 * 60 * 1000;
        if (hours) total += Number(hours[1]) * 60 * 60 * 1000;
        if (mins) total += Number(mins[1]) * 60 * 1000;
        if (secs) total += Number(secs[1]) * 1000;
        return total;
    }


    function detectAttackPageStatus(text) {
        const lower = String(text || '').toLowerCase();
        if (lower.includes('federal jail')) return 'Federal';
        if (lower.includes('hiding out')) return 'Hiding Out';
        if (lower.includes('in hospital') || lower.includes('hospitalized')) {
            return 'Hospital';
        }
        if (lower.includes('traveling') || lower.includes('flying')) return 'Traveling';
        if (lower.includes('abroad')) return 'Abroad';
        return '';
    }


    async function scrapeAndReportAttackPage() {
        const page = new URL(window.location.href);
        if (page.searchParams.get('sid') !== 'attack') return false;
        const targetId = Number(page.searchParams.get('user2ID'));
        if (!Number.isInteger(targetId) || targetId <= 0) return false;
        if (!TornLib.isPageActive({ requireFocus: true })) return false;

        const candidates = [
            ...document.querySelectorAll(
                '[class*="status"], [class*="profile"], [class*="info"], [data-testid*="status"]'
            )
        ].map(node => node.innerText || node.textContent || '').filter(Boolean);
        candidates.push(document.body?.innerText || '');

        for (const visibleText of candidates) {
            const status = detectAttackPageStatus(visibleText);
            if (!status) continue;
            const remainingMs = parseVisibleRemainingMs(visibleText);
            const until = remainingMs > 0
                ? Math.floor((Date.now() + remainingMs) / 1000)
                : 0;

            try {
                await ensureWorkerSession(false);
                await submitObservations([{
                    target_id: targetId,
                    state: status,
                    description: visibleText.trim().slice(0, 500),
                    until,
                    source: 'attack_page'
                }]);
                logClientEvent('attack_page_observation', { targetId, status });
                render();
                return true;
            } catch (error) {
                state.lastError = `Attack-page report: ${TornLib.errorMessage(error)}`;
                render();
                return false;
            }
        }

        return false;
    }


    function scheduleAttackPageScrape() {
        const page = new URL(window.location.href);
        if (page.searchParams.get('sid') !== 'attack') return;

        let attempts = 0;
        const tryScrape = async () => {
            attempts++;
            if (await scrapeAndReportAttackPage() || attempts >= 6) return;
            setTimeout(tryScrape, 1000);
        };
        setTimeout(tryScrape, 700);
    }


    // ================================================================
    // Scheduling and client diagnostics
    // ================================================================

    function scheduleNextPoll(cycleStartedAt = 0) {
        if (state.timer) clearTimeout(state.timer);
        const intervalMs = getSettings().pollSeconds * 1000;
        const elapsedMs = cycleStartedAt
            ? Math.max(0, Date.now() - cycleStartedAt)
            : 0;
        const delayMs = Math.max(1_000, intervalMs - elapsedMs);
        state.timer = setTimeout(() => {
            if (state.leader?.isLeader()) {
                void runCycle(false);
            } else {
                scheduleNextPoll();
            }
        }, delayMs);
    }


    function logClientEvent(event, details = {}) {
        state.clientEvents.push({
            at: Date.now(),
            event: String(event || 'event'),
            ...details
        });
        if (state.clientEvents.length > MAX_CLIENT_EVENTS) {
            state.clientEvents.splice(0, state.clientEvents.length - MAX_CLIENT_EVENTS);
        }
        saveJson(KEYS.clientEvents, state.clientEvents);
    }


    function buildDebugData() {
        const sessionExpiresAt = Number(GM_getValue(KEYS.sessionExpiresAt, 0)) || 0;
        const settings = getSettings();
        return {
            scriptVersion: SCRIPT_VERSION,
            coreLibVersion: TornLib.VERSION,
            workerVersion: state.workerVersion || 'Unknown',
            authenticated: sessionExpiresAt > Date.now(),
            termsVersion: TERMS_VERSION,
            levelingDisclosureVersion: LEVELING_DISCLOSURE_VERSION,
            termsAcceptedLocally: hasAcceptedCurrentTerms(),
            sessionExpiresAt,
            leaderTab: Boolean(state.leader?.isLeader()),
            collector: state.collector,
            collectorExpiresAt: state.collectorExpiresAt,
            recommendations: state.targets.length,
            pollSecondsConfigured: settings.pollSeconds,
            pdaRuntime: PDA_RUNTIME,
            pdaApiKeyAvailable: PDA_API_KEY_AVAILABLE,
            usingPdaTornKey: settings.usePdaTornKey,
            usingPdaFfKey: settings.usePdaFfKey,
            lastPrimaryPollAt: state.lastCycleAt,
            lastPrimaryChecked: state.lastCycleChecked,
            lastPrimaryReported: state.lastCycleReported,
            lastActivitySyncAt: state.lastActivitySyncAt,
            activeTargetsReported: state.activeTargetsReported,
            cycleStatus: state.cycleStatus,
            fairFightStatus: state.fairFightStatus,
            localStrengthCachedAt: Number(state.battleStats?.checkedAt) || 0,
            lastFairFightAt: state.lastFairFightAt,
            lastFairFightRequested: state.lastFairFightRequested,
            lastFairFightSaved: state.lastFairFightSaved,
            coreLoadMode: CORE_LOAD_MODE,
            uiHidden: isUiHidden(),
            lastError: state.lastError || '',
            recentEvents: state.clientEvents.slice(-20).reverse()
        };
    }


    function debugText() {
        const data = buildDebugData();
        const lines = [
            `SLINK Leveling Service v${data.scriptVersion}`,
            `CoreLib: ${data.coreLibVersion} (${data.coreLoadMode})`,
            `PDA key: ${data.pdaApiKeyAvailable ? 'available' : 'unavailable'} | Torn ${data.usingPdaTornKey ? 'PDA' : 'manual'} | FFScouter ${data.usingPdaFfKey ? 'PDA' : 'manual'}`,
            `Worker: ${data.workerVersion}`,
            `Authenticated: ${data.authenticated ? 'Yes' : 'No'}`,
            `Session expires: ${data.sessionExpiresAt ? new Date(data.sessionExpiresAt).toLocaleString() : 'None'}`,
            `Polling tab: ${data.leaderTab ? 'Yes' : 'No'}`,
            `API collector: ${data.collector ? 'Yes' : 'Standby device'}`,
            `Collector lease: ${formatDateTime(data.collectorExpiresAt)}`,
            '',
            `Recommendations: ${data.recommendations}`,
            `Polling: Core Lib remaining quota every ${data.pollSecondsConfigured}s`,
            `Last primary: ${formatDateTime(data.lastPrimaryPollAt)} | assigned ${data.lastPrimaryChecked} | reported ${data.lastPrimaryReported}`,
            `Activity sync: ${formatDateTime(data.lastActivitySyncAt)} | active matches ${data.activeTargetsReported}`,
            `Local strength cached: ${formatDateTime(data.localStrengthCachedAt)}`,
            `Fair Fight: requested ${data.lastFairFightRequested} | saved locally ${data.lastFairFightSaved} | cached ${formatDateTime(data.lastFairFightAt)}`,
            `Fair Fight work: ${data.fairFightStatus || 'Idle'}`,
            `Current work: ${data.cycleStatus || 'Idle'}`,
            `Last error: ${data.lastError || 'None'}`,
            '',
            'Recent client events:'
        ];

        for (const row of data.recentEvents) {
            lines.push(`${formatDateTime(row.at)} | ${row.event} | ${JSON.stringify(row)}`);
        }
        return lines.join('\n');
    }


    // ================================================================
    // UI
    // ================================================================

    function readUiHiddenRecord() {
        const stored = loadJson(KEYS.uiHidden, false);

        if (stored === true || stored === 'true') {
            return { hidden: true };
        }
        if (!stored || stored === false || stored === 'false') {
            return { hidden: false };
        }
        if (typeof stored === 'string') {
            try {
                const parsed = JSON.parse(stored);
                return parsed && typeof parsed === 'object'
                    ? parsed
                    : { hidden: Boolean(parsed) };
            } catch {
                return { hidden: false };
            }
        }

        return typeof stored === 'object'
            ? stored
            : { hidden: false };
    }


    function isUiHidden() {
        return readUiHiddenRecord().hidden === true;
    }


    function setUiHidden(hidden) {
        GM_setValue(
            KEYS.uiHidden,
            JSON.stringify(hidden
                ? { hidden: true, hiddenAt: Date.now() }
                : { hidden: false, restoredAt: Date.now() })
        );
    }


    function refreshPdaUiHeartbeat() {
        if (!PDA_RUNTIME) return;
        GM_setValue(KEYS.uiHeartbeat, Date.now());
    }


    function recoverPdaUiAfterReenable() {
        if (!PDA_RUNTIME) return;

        const lastHeartbeat = Number(GM_getValue(KEYS.uiHeartbeat, 0)) || 0;
        const heartbeatGap = lastHeartbeat ? Date.now() - lastHeartbeat : Infinity;

        if (isUiHidden() && heartbeatGap >= PDA_UI_RECOVERY_GAP_MS) {
            setUiHidden(false);
            console.info(
                '[SLINK Leveling] Restored the PDA interface after a fresh script activation.'
            );
        }

        refreshPdaUiHeartbeat();
        pdaUiHeartbeatTimer = setInterval(
            refreshPdaUiHeartbeat,
            PDA_UI_HEARTBEAT_MS
        );
    }


    function removePanel() {
        panelDragController?.destroy();
        panelDragController = null;
        document.getElementById('slinky-leveling-panel')?.remove();
    }


    function initializePanel() {
        if (isUiHidden()) return null;

        const panel = ensurePanel();
        panel.classList.toggle('slp-pda', PDA_CORE_MODE);
        if (panelDragController) return panel;

        panelDragController = TornLib.makePanelDraggable(panel, {
            handle: panel,
            storageKey: KEYS.panelPosition,
            ignoreSelector: 'button, input, textarea, select, a, .slp-body, .slp-footer, [data-no-drag]',
            draggingClass: 'slp-dragging',
            setValue: (_key, position) => {
                GM_setValue(
                    getSettings().collapsed ? KEYS.bubblePosition : KEYS.panelPosition,
                    position
                );
            },
            margin: 4
        });
        installBubbleEdgeBehavior(panel);
        return panel;
    }


    function showUi() {
        setUiHidden(false);
        initializePanel();
        render();
    }


    function registerUiRecoveryCommand() {
        if (typeof GM_registerMenuCommand !== 'function') return;
        GM_registerMenuCommand('Show SLINK interface', showUi);
    }


    function installStyles() {
        GM_addStyle(`
            #slinky-leveling-panel {
                position: fixed; top: 92px; left: 12px; z-index: 999999;
                width: min(390px, calc(100vw - 8px));
                max-height: calc(100dvh - 8px); overflow: hidden;
                border: 1px solid rgba(255,255,255,.16); border-radius: 9px;
                background: rgba(19,22,28,.97); color: #eee;
                font: 12px/1.35 Arial, sans-serif;
                box-shadow: 0 8px 24px rgba(0,0,0,.42);
            }
            #slinky-leveling-panel * { box-sizing: border-box; }
            .slp-head { display:flex; align-items:center; gap:7px; padding:8px 9px; border-bottom:1px solid rgba(255,255,255,.1); cursor:move; user-select:none; }
            .slp-title { font-weight:700; font-size:13px; flex:1; }
            .slp-sub { color:#aaa; font-size:10px; }
            .slp-btn { border:1px solid rgba(255,255,255,.14); background:#2b3039; color:#eee; border-radius:5px; padding:4px 7px; cursor:pointer; }
            .slp-btn:hover { background:#3a414d; }
            .slp-btn:disabled { opacity:.55; cursor:default; }
            .slp-body { max-height:calc(100vh - 165px); overflow:auto; }
            .slp-summary { display:grid; grid-template-columns:repeat(5,1fr); gap:1px; background:rgba(255,255,255,.08); }
            .slp-stat { background:#20242b; padding:6px; text-align:center; }
            .slp-stat b { display:block; font-size:13px; }
            .slp-error { padding:7px 9px; color:#ffb4b4; border-bottom:1px solid rgba(255,255,255,.08); }
            .slp-phase { padding:6px 9px; color:#a9d5ff; border-bottom:1px solid rgba(255,255,255,.08); }
            .slp-settings { padding:9px; border-bottom:1px solid rgba(255,255,255,.1); display:grid; grid-template-columns:1fr 1fr; gap:7px; }
            .slp-settings label { display:flex; flex-direction:column; gap:3px; color:#bbb; }
            .slp-settings .wide { grid-column:1 / -1; }
            .slp-settings input { width:100%; border:1px solid #555; border-radius:4px; background:#11151a; color:#eee; padding:5px 6px; }
            .slp-settings input:disabled { opacity:.7; color:#a9d5ff; }
            .slp-key-setting { display:flex; flex-direction:column; gap:3px; color:#bbb; }
            .slp-key-toggle { flex-direction:row !important; align-items:center; gap:6px !important; color:#d9e9f7 !important; font-size:10px; }
            .slp-key-toggle input { width:auto; margin:0; flex:0 0 auto; }
            .slp-disclosure { grid-column:1 / -1; color:#999; font-size:10px; }
            .slp-terms { grid-column:1 / -1; padding:9px; border:1px solid #4c6075; border-radius:6px; background:#18222d; color:#d9e9f7; }
            .slp-terms strong { display:block; margin-bottom:5px; color:#fff; }
            .slp-terms p { margin:0 0 7px; }
            .slp-terms a { color:#8fc9ff; }
            .slp-terms-agree { display:flex !important; flex-direction:row !important; align-items:flex-start; gap:7px !important; margin-top:8px; color:#fff !important; }
            .slp-terms-agree input { width:auto; margin:2px 0 0; flex:0 0 auto; }
            .slp-terms-summary { grid-column:1 / -1; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 8px; border:1px solid #3d5268; border-radius:6px; background:#18222d; color:#d9e9f7; }
            .slp-settings-actions { grid-column:1 / -1; display:flex; gap:6px; justify-content:flex-end; }
            .slp-btn-danger { border-color:#794343; color:#ffd0d0; background:#442626; }
            .slp-btn-danger:hover { background:#5b3030; }
            .slp-row { padding:7px 8px; border-bottom:1px solid rgba(255,255,255,.07); }
            .slp-row:hover { background:rgba(255,255,255,.035); }
            .slp-row-top { display:flex; align-items:center; gap:6px; }
            .slp-name { flex:1; font-weight:700; color:#fff; text-decoration:none; }
            .slp-level { color:#ffd27a; }
            .slp-meta { display:flex; gap:8px; margin-top:3px; color:#aaa; flex-wrap:wrap; }
            .slp-badge { padding:1px 5px; border-radius:8px; background:#303641; color:#ddd; }
            .slp-hosp-hot { background:#5a2828; color:#ffd0d0; }
            .slp-easy { background:#234a32; color:#c9f7d6; }
            .slp-good { background:#24445a; color:#ccecff; }
            .slp-fair { background:#5a4a24; color:#ffe9ad; }
            .slp-risky { background:#5a2828; color:#ffd0d0; }
            .slp-actions { display:flex; gap:4px; margin-top:5px; }
            .slp-actions a { text-decoration:none; }
            .slp-empty { padding:16px; text-align:center; color:#aaa; }
            .slp-debug { padding:9px; border-bottom:1px solid rgba(255,255,255,.1); background:#181c22; }
            .slp-debug-actions { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:7px; }
            .slp-debug textarea { width:100%; min-height:220px; resize:vertical; border:1px solid #454b55; border-radius:5px; background:#0f1216; color:#d8d8d8; padding:7px; font:11px/1.35 Consolas,monospace; }
            .slp-footer { padding:6px 8px; color:#888; border-top:1px solid rgba(255,255,255,.08); font-size:10px; }
            #slinky-leveling-panel.slp-collapsed {
                width:54px; height:54px; max-height:none; overflow:visible;
                border-radius:50%;
                border-color:rgba(116,190,255,.55);
                background:transparent;
                box-shadow:0 6px 18px rgba(0,0,0,.48);
            }
            .slp-bubble {
                position:relative; display:flex; align-items:center; justify-content:center;
                width:100%; height:100%; padding:0; border:0; border-radius:50%;
                background:linear-gradient(145deg,#3478b9,#172f4c); color:#fff;
                cursor:pointer; font:800 15px/1 Arial,sans-serif; letter-spacing:-.5px;
                box-shadow:inset 0 0 0 1px rgba(255,255,255,.17);
                touch-action:none; user-select:none;
            }
            .slp-bubble:hover { background:linear-gradient(145deg,#438dce,#1d3a5d); }
            .slp-bubble:focus-visible { outline:2px solid #a9d5ff; outline-offset:3px; }
            #slinky-leveling-panel.slp-dragging .slp-bubble { cursor:grabbing; }
            .slp-bubble-status {
                position:absolute; right:2px; bottom:3px; width:11px; height:11px;
                border:2px solid #17202b; border-radius:50%; background:#59d67d;
            }
            .slp-bubble-status.slp-bubble-standby { background:#8aa1b7; }
            .slp-bubble-status.slp-bubble-error { background:#ff7373; }
            #slinky-leveling-panel.slp-pda {
                width:min(310px, calc(100vw - 8px));
                top:4px;
                font-size:11px;
            }
            #slinky-leveling-panel.slp-pda .slp-head { gap:4px; padding:6px; }
            #slinky-leveling-panel.slp-pda .slp-title { font-size:12px; }
            #slinky-leveling-panel.slp-pda .slp-sub { display:none; }
            #slinky-leveling-panel.slp-pda .slp-btn { min-height:30px; padding:4px 6px; }
            #slinky-leveling-panel.slp-pda .slp-body { max-height:calc(100dvh - 46px); }
            #slinky-leveling-panel.slp-pda .slp-summary { grid-template-columns:repeat(2,1fr); }
            #slinky-leveling-panel.slp-pda .slp-stat:last-child { grid-column:1 / -1; }
            #slinky-leveling-panel.slp-pda .slp-settings { grid-template-columns:1fr; padding:7px; }
            #slinky-leveling-panel.slp-pda .slp-settings-actions { flex-direction:column; }
            #slinky-leveling-panel.slp-pda .slp-footer { display:none; }
            #slinky-leveling-panel.slp-pda.slp-collapsed { width:48px; height:48px; }
            @media (max-width: 420px) {
                #slinky-leveling-panel:not(.slp-collapsed) { left:4px; }
                .slp-settings { grid-template-columns:1fr; }
                .slp-settings-actions { flex-wrap:wrap; }
            }
        `);
    }


    function ensurePanel() {
        let panel = document.getElementById('slinky-leveling-panel');
        if (panel) return panel;
        panel = document.createElement('section');
        panel.id = 'slinky-leveling-panel';
        document.body.appendChild(panel);
        return panel;
    }


    function applySavedPanelPosition(collapsed) {
        if (!panelDragController) return;
        const saved = GM_getValue(
            collapsed ? KEYS.bubblePosition : KEYS.panelPosition,
            null
        );
        if (saved) {
            panelDragController.applyPosition(saved);
            return;
        }
        if (collapsed) {
            const bubbleSize = panelDragController
                ? document.getElementById('slinky-leveling-panel')?.offsetHeight || 54
                : 54;
            panelDragController.applyPosition({
                left: 4,
                top: Math.max(4, Math.round((window.innerHeight - bubbleSize) / 2))
            });
        } else {
            panelDragController.clampToViewport();
        }
    }


    function installBubbleEdgeBehavior(panel) {
        let pointer = null;

        panel.addEventListener('pointerdown', event => {
            if (!getSettings().collapsed || !event.target.closest('.slp-bubble')) return;
            pointer = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                moved: false
            };
        });

        panel.addEventListener('pointermove', event => {
            if (!pointer || event.pointerId !== pointer.id) return;
            if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >= 5) {
                pointer.moved = true;
            }
        });

        panel.addEventListener('pointerup', event => {
            if (!pointer || event.pointerId !== pointer.id) return;
            const moved = pointer.moved;
            pointer = null;

            if (!moved) {
                GM_setValue(KEYS.collapsed, false);
                render();
                return;
            }

            const margin = 4;
            const rect = panel.getBoundingClientRect();
            const left = rect.left + (rect.width / 2) <= (window.innerWidth / 2)
                ? margin
                : window.innerWidth - rect.width - margin;
            const top = clamp(
                rect.top,
                margin,
                window.innerHeight - rect.height - margin
            );
            const position = {
                left: Math.round(left),
                top: Math.round(top)
            };
            panelDragController?.applyPosition(position);
            GM_setValue(KEYS.bubblePosition, position);
        });

        panel.addEventListener('pointercancel', () => {
            pointer = null;
        });
    }


    function render() {
        if (isUiHidden()) {
            removePanel();
            return;
        }

        const panel = initializePanel();
        if (!panel) return;
        const settings = getSettings();
        const leader = Boolean(state.leader?.isLeader());
        const busy = state.polling || state.authenticating;
        const usage = TornLib.getTornApiUsage({ limit: TornLib.TORN_API_DEFAULT_LIMIT });
        const clientRole = !leader
            ? 'Standby tab'
            : (state.collector ? 'API collector' : 'Standby device');

        panel.classList.toggle('slp-pda', PDA_CORE_MODE);
        panel.classList.toggle('slp-collapsed', settings.collapsed);
        if (settings.collapsed) {
            const bubbleState = state.lastError
                ? 'slp-bubble-error'
                : (leader && state.collector ? '' : 'slp-bubble-standby');
            panel.innerHTML = `
                <div
                    class="slp-bubble"
                    id="slp-expand"
                    role="button"
                    tabindex="0"
                    title="Open SLINK Leveling Service. Background API work remains active while minimized."
                    aria-label="Open SLINK Leveling Service"
                >
                    <span>SL</span>
                    <span class="slp-bubble-status ${bubbleState}" aria-hidden="true"></span>
                </div>
            `;
            applySavedPanelPosition(true);
            bindEvents(panel);
            return;
        }

        panel.innerHTML = `
            <div class="slp-head">
                <div>
                    <div class="slp-title">SLINK Leveling Service</div>
                    <div class="slp-sub">${clientRole} · Worker ${escapeHtml(state.workerVersion || 'connecting')}</div>
                </div>
                <button class="slp-btn" id="slp-refresh" ${busy ? 'disabled' : ''}>${busy ? 'Syncing…' : 'Refresh'}</button>
                <button class="slp-btn" id="slp-debug-btn">Data</button>
                <button class="slp-btn" id="slp-settings-btn">⚙</button>
                <button class="slp-btn" id="slp-collapse" title="Minimize to the SLINK bubble">−</button>
            </div>
            <div class="slp-body">
                <div class="slp-summary">
                    <div class="slp-stat"><b>${state.targets.length}</b><span>Targets</span></div>
                    <div class="slp-stat"><b>${state.lastCycleChecked}</b><span>Assigned</span></div>
                    <div class="slp-stat"><b>${state.lastCycleReported}</b><span>Reported</span></div>
                    <div class="slp-stat"><b>${fairFightReadyCount(state.targets)}/${state.targets.length}</b><span>FF ready</span></div>
                    <div class="slp-stat"><b>${usage.count}/${usage.limit}</b><span>API / min</span></div>
                </div>
                ${state.cycleStatus ? `<div class="slp-phase">${escapeHtml(state.cycleStatus)}</div>` : ''}
                ${state.fairFightStatus ? `<div class="slp-phase">${escapeHtml(state.fairFightStatus)}</div>` : ''}
                ${state.lastError ? `<div class="slp-error">${escapeHtml(state.lastError)}</div>` : ''}
                ${state.settingsOpen ? settingsHtml(settings) : ''}
                ${state.debugOpen ? debugHtml() : ''}
                <div id="slp-targets">${targetsHtml(state.targets)}</div>
            </div>
            <div class="slp-footer">
                Cloudflare owns target ranking, check scheduling, shared status, competition scoring, per-user distribution, and multi-device failover. Only the elected device performs routine Torn API work.
            </div>
        `;
        applySavedPanelPosition(false);
        bindEvents(panel);
    }


    function settingsHtml(settings) {
        const termsAccepted = hasAcceptedCurrentTerms();
        const showFullTerms = !termsAccepted || state.termsOpen;
        return `
            <div class="slp-settings">
                ${showFullTerms ? `
                    <div class="slp-terms">
                        <strong>Required SLINK Leveling disclosure</strong>
                        <p>${escapeHtml(LEVELING_TERMS_SUMMARY)}</p>
                        <a href="${escapeHtml(TERMS_URL)}" target="_blank" rel="noopener noreferrer">Read the complete SLINK API &amp; Data Terms</a>
                        <label class="slp-terms-agree">
                            <input id="slp-accept-terms" type="checkbox" ${termsAccepted ? 'checked' : ''}>
                            <span>I have read the Leveling disclosure above and agree to version ${escapeHtml(TERMS_VERSION)} of the SLINK API &amp; Data Terms.</span>
                        </label>
                        ${termsAccepted ? '<button class="slp-btn" id="slp-hide-terms" type="button">Hide terms</button>' : ''}
                    </div>
                ` : `
                    <div class="slp-terms-summary">
                        <span>Terms ${escapeHtml(TERMS_VERSION)} accepted</span>
                        <button class="slp-btn" id="slp-show-terms" type="button">View</button>
                    </div>
                `}
                <div class="wide slp-key-setting">
                    <label for="slp-torn-key">Torn API key</label>
                    <input id="slp-torn-key" type="password" value="${escapeHtml(settings.manualTornKey)}" autocomplete="off" ${settings.usePdaTornKey ? 'disabled' : ''} placeholder="${settings.usePdaTornKey ? 'Using Torn PDA API key' : ''}">
                    ${PDA_API_KEY_AVAILABLE ? `
                        <label class="slp-key-toggle">
                            <input id="slp-use-pda-torn-key" type="checkbox" ${settings.usePdaTornKey ? 'checked' : ''}>
                            <span>Use Torn PDA's API key</span>
                        </label>
                    ` : ''}
                </div>
                <div class="slp-disclosure">Used to verify Slinky membership and make assigned Torn requests. Exact battle stats stay in this browser. Only a temporary target-stat range is sent to SLINK for safer assignments.</div>
                <div class="wide slp-key-setting">
                    <label for="slp-ff-key">FFScouter API key</label>
                    <input id="slp-ff-key" type="password" value="${escapeHtml(settings.manualFfKey)}" autocomplete="off" ${settings.usePdaFfKey ? 'disabled' : ''} placeholder="${settings.usePdaFfKey ? 'Using Torn PDA API key' : ''}">
                    ${PDA_API_KEY_AVAILABLE ? `
                        <label class="slp-key-toggle">
                            <input id="slp-use-pda-ff-key" type="checkbox" ${settings.usePdaFfKey ? 'checked' : ''}>
                            <span>Use Torn PDA's API key for FFScouter too</span>
                        </label>
                    ` : ''}
                </div>
                <label>Poll seconds
                    <input id="slp-poll" type="number" min="60" max="300" value="${settings.pollSeconds}">
                </label>
                <label>Min FF
                    <input id="slp-min-ff" type="number" min="1" max="3" step=".1" value="${settings.minFF}">
                </label>
                <label>Max FF
                    <input id="slp-max-ff" type="number" min="1" max="3" step=".1" value="${settings.maxFF}">
                </label>
                <div class="slp-settings-actions">
                    <button class="slp-btn slp-btn-danger" id="slp-hide-forever" type="button">Hide forever</button>
                    <button class="slp-btn" id="slp-clear-session">Clear local session</button>
                    <button class="slp-btn" id="slp-save-settings">Save & authenticate</button>
                </div>
            </div>
        `;
    }


    function debugHtml() {
        return `
            <div class="slp-debug">
                <div class="slp-debug-actions">
                    <button class="slp-btn" id="slp-copy-debug">Copy Debug Data</button>
                    <button class="slp-btn" id="slp-refresh-debug">Refresh View</button>
                </div>
                <textarea id="slp-debug-text" readonly>${escapeHtml(debugText())}</textarea>
            </div>
        `;
    }


    function targetsHtml(targets) {
        if (!targets.length) {
            return `<div class="slp-empty">${state.polling ? 'Asking the SLINK Network for targets…' : 'No recommendations are currently assigned.'}</div>`;
        }

        return targets.map(target => {
            const profileUrl = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(target.id)}`;
            const attackUrl =
                `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(target.id)}`;
            const fairFight = target.fair_fight === null || target.fair_fight === undefined
                ? Number.NaN
                : Number(target.fair_fight);
            const ffText = Number.isFinite(fairFight) && fairFight > 0
                ? `${target.fair_fight_estimated ? '~' : ''}${fairFight.toFixed(2)}`
                : '?';
            const ffTitle = target.fair_fight_estimated
                ? 'Immediate local estimate; FFScouter will refine this in the background.'
                : target.fair_fight_source || 'Fair Fight unavailable';
            const battleStats = Number(target.bs_estimate);
            const statsText = Number.isFinite(battleStats) && battleStats > 0
                ? TornLib.shortNumber(battleStats)
                : shortNumber(target.total_stats);
            const hospitalCount = Number(target.hospitalizations_24h) || 0;
            const nextCheckAt = Number(target.next_check_at) || 0;
            const difficulty = target.local_difficulty || null;

            return `
                <article class="slp-row">
                    <div class="slp-row-top">
                        <a class="slp-name" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(target.name)} [${escapeHtml(target.id)}]</a>
                        <span class="slp-level">Lv ${escapeHtml(target.level ?? '?')}</span>
                    </div>
                    <div class="slp-meta">
                        <span class="slp-badge">${escapeHtml(target.status || 'Unknown')}</span>
                        <span class="slp-badge" title="${escapeHtml(ffTitle)}">FF ${escapeHtml(ffText)}</span>
                        ${difficulty ? `<span class="slp-badge ${escapeHtml(difficulty.className)}">${escapeHtml(difficulty.label)}</span>` : ''}
                        <span class="slp-badge">BS ${escapeHtml(statsText)}</span>
                        <span class="slp-badge ${hospitalCount ? 'slp-hosp-hot' : ''}">Hosp 24h: ${hospitalCount}</span>
                        <span class="slp-badge">${escapeHtml(target.competition_tier || 'Prime')} ${Number(target.competition_score) || 0}</span>
                    </div>
                    <div class="slp-meta">
                        <span>Last hosp: ${escapeHtml(target.last_hospitalized_at ? humanAgo(Number(target.last_hospitalized_at)) : 'Never seen')}</span>
                        <span>Next server check: ${escapeHtml(nextCheckAt ? humanFuture(nextCheckAt) : 'Unscheduled')}</span>
                    </div>
                    <div class="slp-meta"><span title="${escapeHtml(target.sources || '')}">Source: ${escapeHtml(target.sources || 'Unknown')}</span></div>
                    <div class="slp-actions">
                        <a class="slp-btn" href="${escapeHtml(attackUrl)}" target="_blank" rel="noopener noreferrer">Attack</a>
                        <a class="slp-btn" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">Profile</a>
                    </div>
                </article>
            `;
        }).join('');
    }


    function bindEvents(panel) {
        for (const [checkboxId, inputId, placeholder] of [
            ['slp-use-pda-torn-key', 'slp-torn-key', 'Using Torn PDA API key'],
            ['slp-use-pda-ff-key', 'slp-ff-key', 'Using Torn PDA API key']
        ]) {
            const checkbox = panel.querySelector(`#${checkboxId}`);
            const input = panel.querySelector(`#${inputId}`);
            checkbox?.addEventListener('change', () => {
                if (!input) return;
                input.disabled = checkbox.checked;
                input.placeholder = checkbox.checked ? placeholder : '';
            });
        }

        panel.querySelector('#slp-expand')?.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            GM_setValue(KEYS.collapsed, false);
            render();
        });
        panel.querySelector('#slp-refresh')?.addEventListener('click', () => {
            void runCycle(false);
        });
        panel.querySelector('#slp-debug-btn')?.addEventListener('click', () => {
            state.debugOpen = !state.debugOpen;
            render();
        });
        panel.querySelector('#slp-settings-btn')?.addEventListener('click', () => {
            state.settingsOpen = !state.settingsOpen;
            if (!state.settingsOpen) state.termsOpen = false;
            render();
        });
        panel.querySelector('#slp-collapse')?.addEventListener('click', () => {
            GM_setValue(KEYS.collapsed, true);
            render();
        });
        panel.querySelector('#slp-copy-debug')?.addEventListener('click', async event => {
            const button = event.currentTarget;
            const original = button.textContent;
            try {
                await TornLib.copyText(debugText());
                button.textContent = 'Copied!';
            } catch (error) {
                button.textContent = 'Copy failed';
                state.lastError = `Debug copy: ${TornLib.errorMessage(error)}`;
            }
            setTimeout(() => {
                if (button.isConnected) button.textContent = original;
            }, 1400);
        });
        panel.querySelector('#slp-refresh-debug')?.addEventListener('click', render);
        panel.querySelector('#slp-clear-session')?.addEventListener('click', () => {
            clearWorkerSession();
            state.lastError = '';
            render();
        });
        panel.querySelector('#slp-show-terms')?.addEventListener('click', () => {
            state.termsOpen = true;
            render();
        });
        panel.querySelector('#slp-hide-terms')?.addEventListener('click', () => {
            state.termsOpen = false;
            render();
        });
        panel.querySelector('#slp-hide-forever')?.addEventListener('click', () => {
            const recoveryMessage = PDA_RUNTIME
                ? 'The interface will remain hidden while this PDA script stays ' +
                    'active. Disable the script for a few seconds and re-enable ' +
                    'it to restore the interface.\n\n'
                : 'The interface will remain hidden until you restore it from ' +
                    'the userscript menu, or disable and re-enable the plugin.\n\n';
            const confirmed = window.confirm(
                'This will hide the SLINK interface, including the bubble. ' +
                'Background API contribution will continue. ' +
                recoveryMessage +
                'Hide the interface now?'
            );
            if (!confirmed) return;

            setUiHidden(true);
            state.settingsOpen = false;
            state.termsOpen = false;
            removePanel();
        });
        panel.querySelector('#slp-save-settings')?.addEventListener('click', async () => {
            const termsCheckbox = panel.querySelector('#slp-accept-terms');
            const accepted = termsCheckbox
                ? Boolean(termsCheckbox.checked)
                : hasAcceptedCurrentTerms();

            if (!accepted) {
                GM_setValue(KEYS.acceptedConsentVersion, '');
                clearWorkerSession();
                state.lastError =
                    'You must agree to the current SLINK API & Data Terms before authentication.';
                state.settingsOpen = true;
                render();
                return;
            }

            GM_setValue(
                KEYS.acceptedConsentVersion,
                `${TERMS_VERSION}:${LEVELING_DISCLOSURE_VERSION}`
            );
            saveSettings({
                tornKey: panel.querySelector('#slp-torn-key')?.value,
                ffKey: panel.querySelector('#slp-ff-key')?.value,
                usePdaTornKey: panel.querySelector('#slp-use-pda-torn-key')?.checked,
                usePdaFfKey: panel.querySelector('#slp-use-pda-ff-key')?.checked,
                pollSeconds: panel.querySelector('#slp-poll')?.value,
                minFF: panel.querySelector('#slp-min-ff')?.value,
                maxFF: panel.querySelector('#slp-max-ff')?.value
            });
            clearWorkerSession();
            state.settingsOpen = false;
            scheduleNextPoll();
            await runCycle(false);
        });
    }


    function escapeHtml(value) {
        return TornLib.escapeHtml(String(value ?? ''));
    }


    function shortNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? TornLib.shortNumber(parsed) : 'Unknown';
    }


    function humanAgo(timestamp) {
        if (!timestamp) return 'Never';
        const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
        return `${TornLib.formatHumanDuration(seconds)} ago`;
    }


    function humanFuture(timestamp) {
        if (!timestamp) return 'Unscheduled';
        const seconds = Math.ceil((timestamp - Date.now()) / 1000);
        if (seconds <= 0) return 'Due now';
        return `in ${TornLib.formatHumanDuration(seconds)}`;
    }


    function formatDateTime(timestamp) {
        return timestamp ? new Date(timestamp).toLocaleString() : 'Never';
    }


    // ================================================================
    // Startup
    // ================================================================

    async function start() {
        installStyles();
        registerUiRecoveryCommand();
        recoverPdaUiAfterReenable();
        initializePanel();

        state.leader = TornLib.createTabLeaderLease('slinky-leveling-targets', {
            leaseMs: 15_000,
            heartbeatMs: 5_000,
            isEligible: () => true,
            isPreferred: () => TornLib.isPageActive({ requireFocus: true }),
            onChange: isLeader => {
                if (isLeader) {
                    void runCycle(false);
                } else {
                    state.collector = false;
                    state.collectorExpiresAt = 0;
                }
                render();
            }
        });

        if (!getSettings().tornKey || !hasAcceptedCurrentTerms()) {
            state.settingsOpen = true;
        }
        render();
        scheduleAttackPageScrape();
        if (state.leader.isLeader()) {
            await runCycle(false);
        } else {
            scheduleNextPoll();
        }
    }

    start();
})();
