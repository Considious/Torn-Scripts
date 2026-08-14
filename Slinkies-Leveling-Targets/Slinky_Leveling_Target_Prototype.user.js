// ==UserScript==
// @name         Slinky's Leveling Target Panel
// @namespace    Considious [3853023]
// @version      0.6.0
// @description  Authenticated thin client for Slinky's shared Cloudflare leveling-target service.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Slinkies-Leveling-Targets/Slinky_Leveling_Target_Prototype.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Slinkies-Leveling-Targets/Slinky_Leveling_Target_Prototype.user.js
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/main/shared/Considious_Torn_Lib.js?v=1.3.5
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @connect      ffscouter.com
// @connect      slinkyleveling.richard-johnson554.workers.dev
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const TornLib = globalThis.ConsidiousTornLib;
    if (!TornLib) throw new Error('Considious Torn Library failed to load.');

    const SCRIPT_VERSION = '0.6.0';
    const SCRIPT_NAME = 'Slinky Leveling Panel';
    const WORKER_URL = 'https://slinkyleveling.richard-johnson554.workers.dev';

    const ACTIVITY_WINDOW_DAYS = 7;
    const ACTIVITY_REFRESH_MS = 24 * 60 * 60 * 1000;
    const BACKGROUND_POLL_MS = 5 * 60 * 1000;
    const PRIMARY_DEFAULT_CHECKS = 10;
    const PRIMARY_MAX_CHECKS = 80;
    const BACKGROUND_DEFAULT_CHECKS = 0;
    const BACKGROUND_MAX_CHECKS = 80;
    const MAX_DISPLAY = 40;
    const MAX_CLIENT_EVENTS = 100;

    const KEYS = {
        tornKey: 'slinkyLeveling.tornApiKey',
        ffKey: 'slinkyLeveling.ffApiKey',
        primaryChecks: 'slinkyLeveling.primaryChecks.v2',
        backgroundChecks: 'slinkyLeveling.backgroundChecks.v2',
        pollSeconds: 'slinkyLeveling.pollSeconds',
        minFF: 'slinkyLeveling.minFF',
        maxFF: 'slinkyLeveling.maxFF',
        collapsed: 'slinkyLeveling.collapsed',
        panelPosition: 'slinkyLeveling.panelPosition.v1',
        sessionToken: 'slinkyLeveling.workerSession.v1',
        sessionExpiresAt: 'slinkyLeveling.workerSessionExpiresAt.v1',
        lastActivitySyncAt: 'slinkyLeveling.lastActivitySyncAt.v1',
        runtimeState: 'slinkyLeveling.clientRuntime.v1',
        clientEvents: 'slinkyLeveling.clientEvents.v1'
    };

    const persistedRuntime = loadJson(KEYS.runtimeState, {});

    const state = {
        targets: [],
        polling: false,
        backgroundPolling: false,
        authenticating: false,
        settingsOpen: false,
        debugOpen: false,
        lastError: '',
        workerVersion: '',
        lastCycleAt: Number(persistedRuntime.lastCycleAt) || 0,
        lastCycleChecked: Number(persistedRuntime.lastCycleChecked) || 0,
        lastCycleReported: Number(persistedRuntime.lastCycleReported) || 0,
        lastBackgroundAt: Number(persistedRuntime.lastBackgroundAt) || 0,
        lastBackgroundChecked: Number(persistedRuntime.lastBackgroundChecked) || 0,
        lastActivitySyncAt: Number(GM_getValue(KEYS.lastActivitySyncAt, 0)) || 0,
        activeTargetsReported: Number(persistedRuntime.activeTargetsReported) || 0,
        clientEvents: loadJson(KEYS.clientEvents, []),
        timer: null,
        backgroundTimer: null,
        leader: null
    };


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


    function getSettings() {
        return {
            tornKey: String(GM_getValue(KEYS.tornKey, '') || '').trim(),
            ffKey: String(GM_getValue(KEYS.ffKey, '') || '').trim(),
            primaryChecks: clamp(
                Number(GM_getValue(KEYS.primaryChecks, PRIMARY_DEFAULT_CHECKS)) ||
                    PRIMARY_DEFAULT_CHECKS,
                0,
                PRIMARY_MAX_CHECKS
            ),
            backgroundChecks: clamp(
                Number(GM_getValue(KEYS.backgroundChecks, BACKGROUND_DEFAULT_CHECKS)) || 0,
                0,
                BACKGROUND_MAX_CHECKS
            ),
            pollSeconds: clamp(
                Number(GM_getValue(KEYS.pollSeconds, 90)) || 90,
                60,
                300
            ),
            minFF: clamp(Number(GM_getValue(KEYS.minFF, 1)) || 1, 0, 10),
            maxFF: clamp(Number(GM_getValue(KEYS.maxFF, 3)) || 3, 0, 10),
            collapsed: Boolean(GM_getValue(KEYS.collapsed, false))
        };
    }


    function saveSettings(values) {
        GM_setValue(KEYS.tornKey, String(values.tornKey || '').trim());
        GM_setValue(KEYS.ffKey, String(values.ffKey || '').trim());
        GM_setValue(
            KEYS.primaryChecks,
            clamp(Number(values.primaryChecks) || 0, 0, PRIMARY_MAX_CHECKS)
        );
        GM_setValue(
            KEYS.backgroundChecks,
            clamp(Number(values.backgroundChecks) || 0, 0, BACKGROUND_MAX_CHECKS)
        );
        GM_setValue(
            KEYS.pollSeconds,
            clamp(Number(values.pollSeconds) || 90, 60, 300)
        );
        GM_setValue(KEYS.minFF, clamp(Number(values.minFF) || 0, 0, 10));
        GM_setValue(KEYS.maxFF, clamp(Number(values.maxFF) || 0, 0, 10));
    }


    function saveRuntimeState() {
        saveJson(KEYS.runtimeState, {
            lastCycleAt: state.lastCycleAt,
            lastCycleChecked: state.lastCycleChecked,
            lastCycleReported: state.lastCycleReported,
            lastBackgroundAt: state.lastBackgroundAt,
            lastBackgroundChecked: state.lastBackgroundChecked,
            activeTargetsReported: state.activeTargetsReported
        });
    }


    function clearWorkerSession() {
        GM_setValue(KEYS.sessionToken, '');
        GM_setValue(KEYS.sessionExpiresAt, 0);
    }


    function clamp(value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }


    // ================================================================
    // Authenticated Worker client
    // ================================================================

    async function ensureWorkerSession(force = false) {
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
            const response = await workerRequest('/api/auth', {
                method: 'POST',
                auth: false,
                retryAuthentication: false,
                body: { api_key: apiKey }
            });

            if (!response?.session_token) {
                throw new Error('Cloudflare did not return a session token.');
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
    // Browser-side data collection assigned by Cloudflare
    // ================================================================

    async function runCycle(checkLimit, cycleKind, forceActivity = false) {
        if (state.polling || state.backgroundPolling) return;
        if (!state.leader?.isLeader()) {
            render();
            return;
        }

        const isBackground = cycleKind === 'background';
        const settings = getSettings();

        if (!settings.tornKey) {
            state.lastError = 'Add your Torn API key in Settings.';
            state.settingsOpen = true;
            render();
            return;
        }

        if (isBackground) state.backgroundPolling = true;
        else state.polling = true;

        state.lastError = '';
        render();

        try {
            await ensureWorkerSession(false);
            await syncActivitySnapshots(settings.tornKey, forceActivity);

            const claim = await workerRequest('/api/checks/claim', {
                method: 'POST',
                body: { limit: clamp(Number(checkLimit) || 0, 0, 80) }
            });
            const checks = Array.isArray(claim?.checks) ? claim.checks : [];
            const observations = [];

            const results = await Promise.allSettled(
                checks.map(async target => {
                    const observed = await getUserStatus(
                        settings.tornKey,
                        target,
                        isBackground ? 'background' : 'normal'
                    );
                    observations.push(observed);
                    return target;
                })
            );

            if (observations.length) {
                const report = await submitObservations(observations);
                state.lastCycleReported = Number(report.accepted_count) || 0;
            } else {
                state.lastCycleReported = 0;
            }

            const successfulTargets = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);

            if (settings.ffKey && successfulTargets.length) {
                try {
                    await collectAndReportFairFight(settings.ffKey, successfulTargets);
                } catch (error) {
                    state.lastError = `FFScouter: ${TornLib.errorMessage(error)}`;
                }
            }

            const failures = results.filter(result => result.status === 'rejected');
            if (failures.length && !state.lastError) {
                state.lastError = `${failures.length} assigned Torn check${failures.length === 1 ? '' : 's'} failed.`;
            }

            await refreshRecommendations();

            if (isBackground) {
                state.lastBackgroundAt = Date.now();
                state.lastBackgroundChecked = checks.length;
            } else {
                state.lastCycleAt = Date.now();
                state.lastCycleChecked = checks.length;
            }

            logClientEvent('cycle_completed', {
                kind: cycleKind,
                assigned: checks.length,
                reported: observations.length,
                failures: failures.length
            });
            saveRuntimeState();
        } catch (error) {
            state.lastError = TornLib.errorMessage(error);
            logClientEvent('cycle_failed', {
                kind: cycleKind,
                error: state.lastError
            });
        } finally {
            if (isBackground) state.backgroundPolling = false;
            else state.polling = false;
            scheduleNextPoll();
            scheduleBackgroundPoll();
            render();
        }
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
            source: 'torn_api'
        };
    }


    async function submitObservations(observations) {
        return workerRequest('/api/observations', {
            method: 'POST',
            body: { observations }
        });
    }


    async function collectAndReportFairFight(apiKey, targets) {
        const uniqueIds = [...new Set(targets.map(target => String(target.id)))];
        if (!uniqueIds.length) return;

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
        const reports = [];

        for (const row of rows) {
            const id = Number(row?.player_id ?? row?.id);
            if (!Number.isInteger(id) || id <= 0) continue;
            returned.add(String(id));
            reports.push({
                target_id: id,
                fair_fight: finiteNumberOrNull(row?.fair_fight),
                bs_estimate: finiteNumberOrNull(row?.bs_estimate),
                source: String(row?.source || 'FFScouter')
            });
        }

        for (const id of uniqueIds) {
            if (returned.has(id)) continue;
            reports.push({
                target_id: Number(id),
                fair_fight: null,
                bs_estimate: null,
                source: 'FFScouter'
            });
        }

        if (reports.length) {
            await workerRequest('/api/fair-fight', {
                method: 'POST',
                body: { targets: reports.slice(0, 200) }
            });
        }
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
        const settings = getSettings();
        const query = new URLSearchParams({
            limit: String(MAX_DISPLAY),
            min_ff: String(Math.min(settings.minFF, settings.maxFF)),
            max_ff: String(Math.max(settings.minFF, settings.maxFF))
        });
        const response = await workerRequest(`/api/recommendations?${query}`);
        state.targets = Array.isArray(response?.targets) ? response.targets : [];
        state.workerVersion = response?.version || state.workerVersion;
    }


    function finiteNumberOrNull(value) {
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
                await refreshRecommendations();
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

    function scheduleNextPoll() {
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(() => {
            if (state.leader?.isLeader()) {
                runCycle(getSettings().primaryChecks, 'primary', false);
            } else {
                scheduleNextPoll();
            }
        }, getSettings().pollSeconds * 1000);
    }


    function scheduleBackgroundPoll() {
        if (state.backgroundTimer) clearTimeout(state.backgroundTimer);
        state.backgroundTimer = setTimeout(() => {
            if (state.leader?.isLeader() && getSettings().backgroundChecks > 0) {
                runCycle(getSettings().backgroundChecks, 'background', false);
            } else {
                scheduleBackgroundPoll();
            }
        }, BACKGROUND_POLL_MS);
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
        return {
            scriptVersion: SCRIPT_VERSION,
            coreLibVersion: TornLib.VERSION,
            workerVersion: state.workerVersion || 'Unknown',
            authenticated: sessionExpiresAt > Date.now(),
            sessionExpiresAt,
            leaderTab: Boolean(state.leader?.isLeader()),
            recommendations: state.targets.length,
            primaryChecksConfigured: getSettings().primaryChecks,
            backgroundChecksConfigured: getSettings().backgroundChecks,
            pollSecondsConfigured: getSettings().pollSeconds,
            lastPrimaryPollAt: state.lastCycleAt,
            lastPrimaryChecked: state.lastCycleChecked,
            lastPrimaryReported: state.lastCycleReported,
            lastBackgroundPollAt: state.lastBackgroundAt,
            lastBackgroundChecked: state.lastBackgroundChecked,
            lastActivitySyncAt: state.lastActivitySyncAt,
            activeTargetsReported: state.activeTargetsReported,
            lastError: state.lastError || '',
            recentEvents: state.clientEvents.slice(-20).reverse()
        };
    }


    function debugText() {
        const data = buildDebugData();
        const lines = [
            `Slinky Leveling Panel v${data.scriptVersion}`,
            `CoreLib: ${data.coreLibVersion}`,
            `Worker: ${data.workerVersion}`,
            `Authenticated: ${data.authenticated ? 'Yes' : 'No'}`,
            `Session expires: ${data.sessionExpiresAt ? new Date(data.sessionExpiresAt).toLocaleString() : 'None'}`,
            `Polling tab: ${data.leaderTab ? 'Yes' : 'No'}`,
            '',
            `Recommendations: ${data.recommendations}`,
            `Primary contribution: ${data.primaryChecksConfigured} every ${data.pollSecondsConfigured}s`,
            `Background contribution: ${data.backgroundChecksConfigured} every 5m`,
            `Last primary: ${formatDateTime(data.lastPrimaryPollAt)} | assigned ${data.lastPrimaryChecked} | reported ${data.lastPrimaryReported}`,
            `Last background: ${formatDateTime(data.lastBackgroundPollAt)} | assigned ${data.lastBackgroundChecked}`,
            `Activity sync: ${formatDateTime(data.lastActivitySyncAt)} | active matches ${data.activeTargetsReported}`,
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

    function installStyles() {
        GM_addStyle(`
            #slinky-leveling-panel {
                position: fixed; top: 92px; left: 12px; z-index: 999999;
                width: 390px; max-height: calc(100vh - 110px); overflow: hidden;
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
            .slp-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:rgba(255,255,255,.08); }
            .slp-stat { background:#20242b; padding:6px; text-align:center; }
            .slp-stat b { display:block; font-size:13px; }
            .slp-error { padding:7px 9px; color:#ffb4b4; border-bottom:1px solid rgba(255,255,255,.08); }
            .slp-settings { padding:9px; border-bottom:1px solid rgba(255,255,255,.1); display:grid; grid-template-columns:1fr 1fr; gap:7px; }
            .slp-settings label { display:flex; flex-direction:column; gap:3px; color:#bbb; }
            .slp-settings .wide { grid-column:1 / -1; }
            .slp-settings input { width:100%; border:1px solid #555; border-radius:4px; background:#11151a; color:#eee; padding:5px 6px; }
            .slp-disclosure { grid-column:1 / -1; color:#999; font-size:10px; }
            .slp-settings-actions { grid-column:1 / -1; display:flex; gap:6px; justify-content:flex-end; }
            .slp-row { padding:7px 8px; border-bottom:1px solid rgba(255,255,255,.07); }
            .slp-row:hover { background:rgba(255,255,255,.035); }
            .slp-row-top { display:flex; align-items:center; gap:6px; }
            .slp-name { flex:1; font-weight:700; color:#fff; text-decoration:none; }
            .slp-level { color:#ffd27a; }
            .slp-meta { display:flex; gap:8px; margin-top:3px; color:#aaa; flex-wrap:wrap; }
            .slp-badge { padding:1px 5px; border-radius:8px; background:#303641; color:#ddd; }
            .slp-hosp-hot { background:#5a2828; color:#ffd0d0; }
            .slp-actions { display:flex; gap:4px; margin-top:5px; }
            .slp-actions a { text-decoration:none; }
            .slp-empty { padding:16px; text-align:center; color:#aaa; }
            .slp-debug { padding:9px; border-bottom:1px solid rgba(255,255,255,.1); background:#181c22; }
            .slp-debug-actions { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:7px; }
            .slp-debug textarea { width:100%; min-height:220px; resize:vertical; border:1px solid #454b55; border-radius:5px; background:#0f1216; color:#d8d8d8; padding:7px; font:11px/1.35 Consolas,monospace; }
            .slp-footer { padding:6px 8px; color:#888; border-top:1px solid rgba(255,255,255,.08); font-size:10px; }
            #slinky-leveling-panel.slp-collapsed .slp-body,
            #slinky-leveling-panel.slp-collapsed .slp-footer { display:none; }
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


    function render() {
        const panel = ensurePanel();
        const settings = getSettings();
        const leader = Boolean(state.leader?.isLeader());
        const busy = state.polling || state.backgroundPolling || state.authenticating;
        const usage = TornLib.getTornApiUsage({ limit: TornLib.TORN_API_DEFAULT_LIMIT });

        panel.classList.toggle('slp-collapsed', settings.collapsed);
        panel.innerHTML = `
            <div class="slp-head">
                <div>
                    <div class="slp-title">Slinky Leveling Targets</div>
                    <div class="slp-sub">${leader ? 'Active client' : 'Standby tab'} · Worker ${escapeHtml(state.workerVersion || 'connecting')}</div>
                </div>
                <button class="slp-btn" id="slp-refresh" ${busy ? 'disabled' : ''}>${busy ? 'Syncing…' : 'Refresh'}</button>
                <button class="slp-btn" id="slp-debug-btn">Data</button>
                <button class="slp-btn" id="slp-settings-btn">⚙</button>
                <button class="slp-btn" id="slp-collapse">${settings.collapsed ? '＋' : '−'}</button>
            </div>
            <div class="slp-body">
                <div class="slp-summary">
                    <div class="slp-stat"><b>${state.targets.length}</b><span>Targets</span></div>
                    <div class="slp-stat"><b>${state.lastCycleChecked}</b><span>Assigned</span></div>
                    <div class="slp-stat"><b>${state.lastCycleReported}</b><span>Reported</span></div>
                    <div class="slp-stat"><b>${usage.count}/${usage.limit}</b><span>API / min</span></div>
                </div>
                ${state.lastError ? `<div class="slp-error">${escapeHtml(state.lastError)}</div>` : ''}
                ${state.settingsOpen ? settingsHtml(settings) : ''}
                ${state.debugOpen ? debugHtml() : ''}
                <div id="slp-targets">${targetsHtml(state.targets)}</div>
            </div>
            <div class="slp-footer">
                Cloudflare owns target ranking, check scheduling, shared status, competition scoring, and per-member distribution. This client only performs assigned browser/API work and renders the result.
            </div>
        `;
        bindEvents(panel);
    }


    function settingsHtml(settings) {
        return `
            <div class="slp-settings">
                <label class="wide">Torn API key
                    <input id="slp-torn-key" type="password" value="${escapeHtml(settings.tornKey)}" autocomplete="off">
                </label>
                <div class="slp-disclosure">Used to verify Slinky membership and make assigned Torn requests. The key is stored locally and is not retained by Cloudflare.</div>
                <label class="wide">FFScouter API key
                    <input id="slp-ff-key" type="password" value="${escapeHtml(settings.ffKey)}" autocomplete="off">
                </label>
                <label>Checks per poll (0–80)
                    <input id="slp-primary-checks" type="number" min="0" max="80" value="${settings.primaryChecks}">
                </label>
                <label>Background / 5m (0–80)
                    <input id="slp-background-checks" type="number" min="0" max="80" value="${settings.backgroundChecks}">
                </label>
                <label>Poll seconds
                    <input id="slp-poll" type="number" min="60" max="300" value="${settings.pollSeconds}">
                </label>
                <label>Min FF
                    <input id="slp-min-ff" type="number" min="0" max="10" step=".1" value="${settings.minFF}">
                </label>
                <label>Max FF
                    <input id="slp-max-ff" type="number" min="0" max="10" step=".1" value="${settings.maxFF}">
                </label>
                <div class="slp-settings-actions">
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
            return `<div class="slp-empty">${state.polling ? 'Asking Cloudflare for targets…' : 'No recommendations are currently assigned.'}</div>`;
        }

        return targets.map(target => {
            const profileUrl = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(target.id)}`;
            const attackUrl = TornLib.attackLink(target.id);
            const fairFight = Number(target.fair_fight);
            const ffText = Number.isFinite(fairFight) ? fairFight.toFixed(2) : '?';
            const battleStats = Number(target.bs_estimate);
            const statsText = Number.isFinite(battleStats) && battleStats > 0
                ? TornLib.shortNumber(battleStats)
                : shortNumber(target.total_stats);
            const hospitalCount = Number(target.hospitalizations_24h) || 0;
            const nextCheckAt = Number(target.next_check_at) || 0;

            return `
                <article class="slp-row">
                    <div class="slp-row-top">
                        <a class="slp-name" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(target.name)} [${escapeHtml(target.id)}]</a>
                        <span class="slp-level">Lv ${escapeHtml(target.level ?? '?')}</span>
                    </div>
                    <div class="slp-meta">
                        <span class="slp-badge">${escapeHtml(target.status || 'Unknown')}</span>
                        <span class="slp-badge">FF ${escapeHtml(ffText)}</span>
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
        panel.querySelector('#slp-refresh')?.addEventListener('click', () => {
            runCycle(getSettings().primaryChecks, 'primary', false);
        });
        panel.querySelector('#slp-debug-btn')?.addEventListener('click', () => {
            state.debugOpen = !state.debugOpen;
            render();
        });
        panel.querySelector('#slp-settings-btn')?.addEventListener('click', () => {
            state.settingsOpen = !state.settingsOpen;
            render();
        });
        panel.querySelector('#slp-collapse')?.addEventListener('click', () => {
            GM_setValue(KEYS.collapsed, !getSettings().collapsed);
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
        panel.querySelector('#slp-save-settings')?.addEventListener('click', async () => {
            saveSettings({
                tornKey: panel.querySelector('#slp-torn-key')?.value,
                ffKey: panel.querySelector('#slp-ff-key')?.value,
                primaryChecks: panel.querySelector('#slp-primary-checks')?.value,
                backgroundChecks: panel.querySelector('#slp-background-checks')?.value,
                pollSeconds: panel.querySelector('#slp-poll')?.value,
                minFF: panel.querySelector('#slp-min-ff')?.value,
                maxFF: panel.querySelector('#slp-max-ff')?.value
            });
            clearWorkerSession();
            state.settingsOpen = false;
            scheduleNextPoll();
            await runCycle(getSettings().primaryChecks, 'primary', false);
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
        const panel = ensurePanel();
        TornLib.makePanelDraggable(panel, {
            handle: panel,
            storageKey: KEYS.panelPosition,
            ignoreSelector: 'button, input, textarea, select, a, .slp-body, .slp-footer, [data-no-drag]',
            margin: 4
        });

        state.leader = TornLib.createTabLeaderLease('slinky-leveling-targets', {
            leaseMs: 15_000,
            heartbeatMs: 5_000,
            isEligible: () => true,
            isPreferred: () => TornLib.isPageActive({ requireFocus: true }),
            onChange: isLeader => {
                render();
                if (isLeader) {
                    runCycle(getSettings().primaryChecks, 'primary', false);
                }
            }
        });

        if (!getSettings().tornKey) state.settingsOpen = true;
        render();
        scheduleAttackPageScrape();

        if (state.leader.isLeader()) {
            await runCycle(getSettings().primaryChecks, 'primary', false);
        } else {
            scheduleNextPoll();
            scheduleBackgroundPoll();
        }
    }

    start();
})();
