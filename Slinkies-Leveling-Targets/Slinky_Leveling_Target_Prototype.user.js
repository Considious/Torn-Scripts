// ==UserScript==
// @name         Slinky's Leveling Target Prototype
// @namespace    Considious [3853023]
// @version      0.4.4
// @description  Leveling target prototype using daily activity snapshots, prioritized Torn status checks, FFScouter estimates, and local hospitalization history.
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
// @connect      raw.githubusercontent.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const TornLib = globalThis.ConsidiousTornLib;
    if (!TornLib) throw new Error('Considious Torn Library failed to load.');

    const SCRIPT_NAME = "Slinky Leveling Prototype";
    const MASTER_URL = 'https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Slinkies-Leveling-Targets/Master-Leveling-Targets.csv';

    const HOSPITAL_24H_MS = 24 * 60 * 60 * 1000;
    const HOSPITAL_7D_MS = 7 * 24 * 60 * 60 * 1000;
    const ACTIVITY_WINDOW_DAYS = 7;
    const ACTIVITY_REFRESH_MS = 24 * 60 * 60 * 1000;
    const OKAY_CACHE_MS = 5 * 60 * 1000;
    const NON_OKAY_RECHECK_MS = 5 * 60 * 1000;
    const FF_CACHE_MS = 12 * 60 * 60 * 1000;
    const MASTER_CACHE_MS = 30 * 60 * 1000;
    const PRIMARY_DEFAULT_CHECKS = 10;
    const PRIMARY_MAX_CHECKS = 80;
    const BACKGROUND_DEFAULT_CHECKS = 0;
    const BACKGROUND_MAX_CHECKS = 80;
    const BACKGROUND_POLL_MS = 5 * 60 * 1000;
    const MAX_DISPLAY = 40;
    const MAX_OBSERVATION_LOG = 20_000;

    const KEYS = {
        tornKey: 'slinkyLeveling.tornApiKey',
        ffKey: 'slinkyLeveling.ffApiKey',
        primaryChecks: 'slinkyLeveling.primaryChecks.v2',
        backgroundChecks: 'slinkyLeveling.backgroundChecks.v2',
        pollSeconds: 'slinkyLeveling.pollSeconds',
        minFF: 'slinkyLeveling.minFF',
        maxFF: 'slinkyLeveling.maxFF',
        collapsed: 'slinkyLeveling.collapsed',
        hospitalHistory: 'slinkyLeveling.hospitalHistory.v1',
        statusCache: 'slinkyLeveling.statusCache.v1',
        ffCache: 'slinkyLeveling.ffCache.v1',
        masterCache: 'slinkyLeveling.masterCache.v1',
        activityCache: 'slinkyLeveling.activityCache.v1',
        panelPosition: 'slinkyLeveling.panelPosition.v1',
        runtimeState: 'slinkyLeveling.runtimeState.v1',
        observationLog: 'slinkyLeveling.observationLog.v1'
    };

    const persistedRuntime = loadJson(KEYS.runtimeState, {});

    const state = {
        master: [],
        statusCache: loadJson(KEYS.statusCache, {}),
        ffCache: loadJson(KEYS.ffCache, {}),
        hospitalHistory: loadJson(KEYS.hospitalHistory, {}),
        activityCache: loadJson(KEYS.activityCache, { refreshedAt: 0, activeTargets: {}, snapshots: [] }),
        observationLog: loadJson(KEYS.observationLog, []),
        polling: false,
        backgroundPolling: false,
        lastCycleAt: Number(persistedRuntime.lastCycleAt) || 0,
        lastCycleChecked: Number(persistedRuntime.lastCycleChecked) || 0,
        lastCycleOkay: Number(persistedRuntime.lastCycleOkay) || 0,
        lastBackgroundAt: Number(persistedRuntime.lastBackgroundAt) || 0,
        lastBackgroundChecked: Number(persistedRuntime.lastBackgroundChecked) || 0,
        lastError: '',
        settingsOpen: false,
        debugOpen: false,
        timer: null,
        backgroundTimer: null,
        leader: null
    };

    // ─────────────────────────────────────────────────────────────
    // CoreLib-backed storage and helpers
    // ─────────────────────────────────────────────────────────────

    function loadJson(key, fallback) {
        try {
            const gmValue = GM_getValue(key, undefined);
            if (gmValue !== undefined) return gmValue;
        } catch {
            // Fall through to the page-local cache for migration/compatibility.
        }

        try {
            const localValue = TornLib.readJsonStorage(key, undefined, { merge: false });
            if (localValue !== undefined) {
                try {
                    GM_setValue(key, localValue);
                } catch {
                    // Local storage is still usable even if GM storage is unavailable.
                }
                return localValue;
            }
        } catch {
            // Use the caller's fallback below.
        }

        return fallback;
    }

    function saveJson(key, value) {
        try {
            GM_setValue(key, value);
        } catch {
            // Keep the CoreLib/localStorage copy below as a fallback.
        }

        try {
            TornLib.writeJsonStorage(key, value);
        } catch {
            // GM storage above is the durable primary copy.
        }

        return value;
    }

    function saveRuntimeState() {
        saveJson(KEYS.runtimeState, {
            lastCycleAt: state.lastCycleAt,
            lastCycleChecked: state.lastCycleChecked,
            lastCycleOkay: state.lastCycleOkay,
            lastBackgroundAt: state.lastBackgroundAt,
            lastBackgroundChecked: state.lastBackgroundChecked
        });
    }

    function refreshCollectedDataFromStorage() {
        const storedStatus = loadJson(KEYS.statusCache, {});
        const storedHospital = loadJson(KEYS.hospitalHistory, {});
        const storedFF = loadJson(KEYS.ffCache, {});
        const storedActivity = loadJson(KEYS.activityCache, null);
        const storedRuntime = loadJson(KEYS.runtimeState, {});
        const storedObservations = loadJson(KEYS.observationLog, []);

        if (storedStatus && typeof storedStatus === 'object' && !Array.isArray(storedStatus)) {
            state.statusCache = { ...storedStatus, ...state.statusCache };
        }
        if (storedHospital && typeof storedHospital === 'object' && !Array.isArray(storedHospital)) {
            state.hospitalHistory = { ...storedHospital, ...state.hospitalHistory };
        }
        if (storedFF && typeof storedFF === 'object' && !Array.isArray(storedFF)) {
            state.ffCache = { ...storedFF, ...state.ffCache };
        }
        if (storedActivity && Number(storedActivity.refreshedAt) > Number(state.activityCache?.refreshedAt || 0)) {
            state.activityCache = storedActivity;
        }
        if (Array.isArray(storedObservations) && storedObservations.length > state.observationLog.length) {
            state.observationLog = storedObservations;
        }

        state.lastCycleAt = Math.max(Number(state.lastCycleAt) || 0, Number(storedRuntime.lastCycleAt) || 0);
        state.lastCycleChecked = Number(state.lastCycleChecked) || Number(storedRuntime.lastCycleChecked) || 0;
        state.lastCycleOkay = Number(state.lastCycleOkay) || Number(storedRuntime.lastCycleOkay) || 0;
        state.lastBackgroundAt = Math.max(Number(state.lastBackgroundAt) || 0, Number(storedRuntime.lastBackgroundAt) || 0);
        state.lastBackgroundChecked = Number(state.lastBackgroundChecked) || Number(storedRuntime.lastBackgroundChecked) || 0;
    }

    function escapeHtml(value) {
        return TornLib.escapeHtml(String(value ?? ''));
    }

    function shortNumber(value) {
        const numeric = parseStatNumber(value);
        return Number.isFinite(numeric) ? TornLib.shortNumber(numeric) : String(value ?? 'Unknown');
    }

    function humanAgo(timestamp) {
        if (!timestamp) return 'Never';
        const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
        return `${TornLib.formatHumanDuration(seconds)} ago`;
    }

    // ─────────────────────────────────────────────────────────────
    // Configuration
    // ─────────────────────────────────────────────────────────────

    function getSettings() {
        return {
            tornKey: String(GM_getValue(KEYS.tornKey, '') || '').trim(),
            ffKey: String(GM_getValue(KEYS.ffKey, '') || '').trim(),
            primaryChecks: clamp(Number(GM_getValue(KEYS.primaryChecks, PRIMARY_DEFAULT_CHECKS)) || PRIMARY_DEFAULT_CHECKS, 5, PRIMARY_MAX_CHECKS),
            backgroundChecks: clamp(Number(GM_getValue(KEYS.backgroundChecks, BACKGROUND_DEFAULT_CHECKS)) || 0, 0, BACKGROUND_MAX_CHECKS),
            pollSeconds: clamp(Number(GM_getValue(KEYS.pollSeconds, 90)) || 90, 60, 300),
            minFF: clamp(Number(GM_getValue(KEYS.minFF, 1)) || 1, 1, 5),
            maxFF: clamp(Number(GM_getValue(KEYS.maxFF, 3)) || 3, 1, 5),
            collapsed: Boolean(GM_getValue(KEYS.collapsed, false))
        };
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function saveSettings(values) {
        GM_setValue(KEYS.tornKey, String(values.tornKey || '').trim());
        GM_setValue(KEYS.ffKey, String(values.ffKey || '').trim());
        GM_setValue(KEYS.primaryChecks, clamp(Number(values.primaryChecks) || PRIMARY_DEFAULT_CHECKS, 5, PRIMARY_MAX_CHECKS));
        GM_setValue(KEYS.backgroundChecks, clamp(Number(values.backgroundChecks) || 0, 0, BACKGROUND_MAX_CHECKS));
        GM_setValue(KEYS.pollSeconds, clamp(Number(values.pollSeconds) || 90, 60, 300));
        GM_setValue(KEYS.minFF, clamp(Number(values.minFF) || 1, 1, 5));
        GM_setValue(KEYS.maxFF, clamp(Number(values.maxFF) || 3, 1, 5));
    }

    // ─────────────────────────────────────────────────────────────
    // Master list loading
    // ─────────────────────────────────────────────────────────────

    async function loadMaster(force = false) {
        const cached = loadJson(KEYS.masterCache, null);
        if (!force && cached?.savedAt && Date.now() - cached.savedAt < MASTER_CACHE_MS && Array.isArray(cached.rows)) {
            state.master = cached.rows;
            return state.master;
        }

        const text = await TornLib.requestText(MASTER_URL, {
            timeout: 15_000,
            networkErrorMessage: 'Could not load the Slinkies master leveling list.'
        });

        const rows = parseCsv(text)
            .map(normalizeMasterRow)
            .filter(row => row.id && row.name);

        state.master = rows;
        saveJson(KEYS.masterCache, { savedAt: Date.now(), rows });
        return rows;
    }

    function parseCsv(text) {
        const rows = [];
        let row = [], cell = '', quoted = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (quoted) {
                if (char === '"' && text[i + 1] === '"') {
                    cell += '"'; i++;
                } else if (char === '"') {
                    quoted = false;
                } else {
                    cell += char;
                }
                continue;
            }

            if (char === '"') {
                quoted = true;
            } else if (char === ',') {
                row.push(cell); cell = '';
            } else if (char === '\n') {
                row.push(cell); rows.push(row); row = []; cell = '';
            } else if (char !== '\r') {
                cell += char;
            }
        }

        if (cell.length || row.length) {
            row.push(cell); rows.push(row);
        }

        if (!rows.length) return [];
        const headers = rows.shift().map(value => value.trim());

        return rows
            .filter(values => values.some(value => String(value).trim()))
            .map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
    }

    function normalizeMasterRow(row) {
        return {
            id: String(row.id || '').trim(),
            name: String(row.name || '').trim(),
            level: Number(row.level) || 0,
            total: String(row.total || 'Unknown').trim(),
            totalNumeric: parseStatNumber(row.total),
            profileUrl: String(row.profile_url || `https://www.torn.com/profiles.php?XID=${row.id}`).trim(),
            sources: String(row.sources || '').trim()
        };
    }

    function parseStatNumber(value) {
        const text = String(value ?? '').trim().toLowerCase().replace(/,/g, '');
        if (!text || text === 'unknown' || text === '—') return NaN;

        let multiplier = 1;
        let numberText = text;

        if (text.endsWith('k')) {
            multiplier = 1_000; numberText = text.slice(0, -1);
        } else if (text.endsWith('m')) {
            multiplier = 1_000_000; numberText = text.slice(0, -1);
        } else if (text.endsWith('b')) {
            multiplier = 1_000_000_000; numberText = text.slice(0, -1);
        }

        const numeric = Number(numberText);
        return Number.isFinite(numeric) ? numeric * multiplier : NaN;
    }

    // ─────────────────────────────────────────────────────────────
    // Seven-day activity snapshot cache
    // ─────────────────────────────────────────────────────────────

    function activitySnapshotTimestamp(daysAgo) {
        const date = new Date();
        date.setUTCHours(12, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() - daysAgo);
        return Math.floor(date.getTime() / 1000);
    }

    function parseSnapshotActiveTargets(text, masterIds, snapshotTimestamp, activeTargets) {
        const lines = String(text || '').split(/\r?\n/);

        for (let index = 1; index < lines.length; index++) {
            const match = lines[index].match(/^\s*"?(\d+)"?\s*,/);
            if (!match) continue;

            const id = match[1];
            if (!masterIds.has(id)) continue;

            activeTargets[id] = Math.max(
                Number(activeTargets[id]) || 0,
                snapshotTimestamp
            );
        }
    }

    async function ensureActivitySnapshots(apiKey, force = false) {
        const cache = state.activityCache || {};
        const fresh =
            Number(cache.refreshedAt) > 0 &&
            Date.now() - Number(cache.refreshedAt) < ACTIVITY_REFRESH_MS &&
            cache.activeTargets &&
            typeof cache.activeTargets === 'object';

        if (!force && fresh) return cache;
        if (!state.master.length) await loadMaster(false);

        const masterIds = new Set(state.master.map(target => target.id));
        const activeTargets = {};
        const snapshots = [];

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

            parseSnapshotActiveTargets(csv, masterIds, timestamp, activeTargets);
            snapshots.push(timestamp);
        }

        state.activityCache = {
            refreshedAt: Date.now(),
            activeTargets,
            snapshots
        };
        saveJson(KEYS.activityCache, state.activityCache);
        return state.activityCache;
    }

    function activeWithinSevenDays(id) {
        return Boolean(state.activityCache?.activeTargets?.[id]);
    }

    function lastSeenActiveSnapshot(id) {
        return Number(state.activityCache?.activeTargets?.[id]) || 0;
    }

    function activeExcludedCount() {
        return Object.keys(state.activityCache?.activeTargets || {}).length;
    }

    // ─────────────────────────────────────────────────────────────
    // Hospitalization history
    // ─────────────────────────────────────────────────────────────

    function cleanHospitalHistory() {
        const cutoff = Date.now() - HOSPITAL_7D_MS;

        for (const [id, record] of Object.entries(state.hospitalHistory)) {
            record.events = Array.isArray(record.events)
                ? record.events.map(Number).filter(timestamp => timestamp >= cutoff)
                : [];

            if (!record.events.length && !record.lastHospitalizedAt && !record.lastState) {
                delete state.hospitalHistory[id];
            }
        }

        saveJson(KEYS.hospitalHistory, state.hospitalHistory);
    }

    function getHospitalRecord(id) {
        const record = state.hospitalHistory[id] || {
            events: [],
            lastHospitalizedAt: 0,
            lastHospitalUntil: 0,
            lastState: ''
        };

        const cutoff = Date.now() - HOSPITAL_7D_MS;
        record.events = Array.isArray(record.events)
            ? record.events.map(Number).filter(timestamp => timestamp >= cutoff)
            : [];

        return record;
    }

    function noteStatusObservation(id, statusState, statusUntil = 0) {
        const now = Date.now();
        const normalized = normalizeStatus(statusState);
        const record = getHospitalRecord(id);
        const wasHospital = isHospitalState(record.lastState);
        const isHospital = isHospitalState(normalized);
        const hospitalUntil = Number(statusUntil) || 0;

        // A changed hospital-until timestamp identifies a new hospital stay even
        // when we never caught the brief Okay state between two hospitalizations.
        const newHospitalStay = isHospital && (
            (hospitalUntil > 0 && hospitalUntil !== Number(record.lastHospitalUntil || 0)) ||
            (hospitalUntil <= 0 && !wasHospital)
        );

        if (newHospitalStay) {
            record.events.push(now);
            record.lastHospitalizedAt = now;
        }

        if (isHospital && hospitalUntil > 0) {
            record.lastHospitalUntil = hospitalUntil;
        }

        record.lastState = normalized;
        state.hospitalHistory[id] = record;
    }

    function hospitalCount24h(id) {
        const cutoff = Date.now() - HOSPITAL_24H_MS;
        return getHospitalRecord(id).events.filter(timestamp => timestamp >= cutoff).length;
    }

    function hospitalCount7d(id) {
        return getHospitalRecord(id).events.length;
    }

    function lastHospitalizedAt(id) {
        return Number(getHospitalRecord(id).lastHospitalizedAt) || 0;
    }

    function isHospitalState(value) {
        const lower = String(value || '').toLowerCase();
        return lower.includes('hospital');
    }

    // ─────────────────────────────────────────────────────────────
    // Torn API status polling
    // ─────────────────────────────────────────────────────────────

    async function getUserStatus(apiKey, target, priority = 'normal') {
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

        return {
            state: normalizeStatus(stateValue),
            description: String(status?.description ?? status?.details ?? stateValue ?? 'Unknown'),
            until: Number(status?.until) || 0
        };
    }

    function normalizeStatus(value) {
        const text = String(value || 'Unknown').trim();
        const lower = text.toLowerCase();

        if (lower === 'okay' || lower.includes('okay')) return 'Okay';
        if (lower.includes('hospital')) return 'Hospital';
        if (lower.includes('travel') || lower.includes('flying')) return 'Traveling';
        if (lower.includes('abroad')) return 'Abroad';
        if (lower.includes('jail')) return 'Jail';
        if (lower.includes('federal')) return 'Federal';
        return text || 'Unknown';
    }

    function statusIsOkay(status) {
        return normalizeStatus(status) === 'Okay';
    }

    function updateStatusCache(target, status) {
        const now = Date.now();
        const okay = statusIsOkay(status.state);

        const hospital = isHospitalState(status.state);
        const hospitalUntilMs = hospital && Number(status.until) > 0
            ? Number(status.until) * 1000
            : 0;

        state.statusCache[target.id] = {
            state: status.state,
            description: status.description,
            until: Number(status.until) || 0,
            checkedAt: now,
            // If Torn already told us exactly when Hospital ends, do not waste
            // another API call on that target until the stay should be over.
            nextEligibleAt: hospitalUntilMs > now
                ? hospitalUntilMs + 5_000
                : (okay ? now : now + NON_OKAY_RECHECK_MS)
        };

        noteStatusObservation(target.id, status.state, status.until);

        // Current status remains local operational state. Only hospitalization
        // transitions are retained as long-term competition intelligence.
        saveJson(KEYS.statusCache, state.statusCache);
        saveJson(KEYS.hospitalHistory, state.hospitalHistory);
    }

    // ─────────────────────────────────────────────────────────────
    // FFScouter
    // ─────────────────────────────────────────────────────────────

    async function updateFFScouter(apiKey, targets) {
        if (!apiKey || !targets.length) return;

        const ids = targets.map(target => target.id);
        const staleIds = ids.filter(id => {
            const cached = state.ffCache[id];
            return !cached?.checkedAt || Date.now() - cached.checkedAt >= FF_CACHE_MS;
        });
        if (!staleIds.length) return;

        const url =
            'https://ffscouter.com/api/v1/get-stats' +
            `?key=${encodeURIComponent(apiKey)}` +
            `&targets=${encodeURIComponent(staleIds.join(','))}`;

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

        for (const row of rows) {
            const id = String(row?.player_id ?? row?.id ?? '').trim();
            if (!id) continue;

            returned.add(id);
            state.ffCache[id] = {
                fairFight: Number(row?.fair_fight) || null,
                bsEstimate: Number(row?.bs_estimate) || null,
                bsEstimateHuman: String(row?.bs_estimate_human || ''),
                source: String(row?.source || ''),
                lastUpdated: String(row?.last_updated || ''),
                noData: Boolean(row?.no_data),
                checkedAt: Date.now()
            };
        }

        for (const id of staleIds) {
            if (returned.has(id)) continue;
            state.ffCache[id] = {
                fairFight: null,
                bsEstimate: null,
                bsEstimateHuman: '',
                source: '',
                lastUpdated: '',
                noData: true,
                checkedAt: Date.now()
            };
        }

        saveJson(KEYS.ffCache, state.ffCache);
    }

    function getFF(id) {
        return state.ffCache[id] || {
            fairFight: null,
            bsEstimate: null,
            noData: true,
            checkedAt: 0
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Priority and candidate selection
    // ─────────────────────────────────────────────────────────────

    function priorityTuple(target) {
        const record = getHospitalRecord(target.id);
        const status = state.statusCache[target.id];
        const blocked = status?.nextEligibleAt > Date.now();
        const lastHosp = Number(record.lastHospitalizedAt) || 0;

        return {
            blocked: blocked ? 1 : 0,
            hospital24h: hospitalCount24h(target.id),
            hospital7d: hospitalCount7d(target.id),
            recentHospitalPenalty: lastHosp ? Math.max(0, HOSPITAL_7D_MS - (Date.now() - lastHosp)) : 0,
            level: target.level,
            total: Number.isFinite(target.totalNumeric) ? target.totalNumeric : Number.MAX_SAFE_INTEGER,
            lastCheckedAt: Number(status?.checkedAt) || 0
        };
    }

    function compareCandidates(a, b) {
        const A = priorityTuple(a);
        const B = priorityTuple(b);

        if (A.blocked !== B.blocked) return A.blocked - B.blocked;
        if (A.hospital24h !== B.hospital24h) return A.hospital24h - B.hospital24h;
        if (A.hospital7d !== B.hospital7d) return A.hospital7d - B.hospital7d;
        if (A.recentHospitalPenalty !== B.recentHospitalPenalty) return A.recentHospitalPenalty - B.recentHospitalPenalty;
        // Rotation is more important than repeatedly hammering the same highest
        // level targets. Never-checked and least-recently-checked targets go first.
        if (A.lastCheckedAt !== B.lastCheckedAt) return A.lastCheckedAt - B.lastCheckedAt;
        if (A.level !== B.level) return B.level - A.level;
        if (A.total !== B.total) return A.total - B.total;
        return a.name.localeCompare(b.name);
    }

    function candidateEligible(target, now = Date.now()) {
        if (activeWithinSevenDays(target.id)) return false;

        const cached = state.statusCache[target.id];
        return !cached?.nextEligibleAt || cached.nextEligibleAt <= now;
    }

    function chooseCandidates(limit) {
        const now = Date.now();
        const eligible = [...state.master]
            .filter(target => candidateEligible(target, now));

        const neverChecked = eligible
            .filter(target => !state.statusCache[target.id]?.checkedAt)
            .sort((a, b) => {
                if (a.level !== b.level) return b.level - a.level;
                return a.name.localeCompare(b.name);
            });

        if (neverChecked.length >= limit) {
            return neverChecked.slice(0, limit);
        }

        const neverCheckedIds = new Set(neverChecked.map(target => target.id));
        const revisits = eligible
            .filter(target => !neverCheckedIds.has(target.id))
            .sort(compareCandidates);

        return [...neverChecked, ...revisits].slice(0, limit);
    }

    function chooseBackgroundCandidates(limit, excludeIds = new Set()) {
        const now = Date.now();

        return [...state.master]
            .filter(target => !excludeIds.has(target.id) && candidateEligible(target, now))
            .sort((a, b) => {
                const checkedA = Number(state.statusCache[a.id]?.checkedAt) || 0;
                const checkedB = Number(state.statusCache[b.id]?.checkedAt) || 0;
                if (checkedA !== checkedB) return checkedA - checkedB;
                return compareCandidates(a, b);
            })
            .slice(0, limit);
    }

    function displayTargets(settings) {
        const now = Date.now();

        return state.master
            .filter(target => {
                if (activeWithinSevenDays(target.id)) return false;

                const status = state.statusCache[target.id];
                if (!status) return false;

                // Once we have observed a target, keep it visible. Hospital is
                // useful information, not a reason to hide the target. Members can
                // decide whether to wait, skip, or attack when the stay ends.
                const normalized = normalizeStatus(status.state);
                if (normalized !== 'Okay' && normalized !== 'Hospital') return false;

                const ff = getFF(target.id).fairFight;
                if (Number.isFinite(ff)) {
                    if (ff < settings.minFF || ff > settings.maxFF) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const A24 = hospitalCount24h(a.id);
                const B24 = hospitalCount24h(b.id);
                if (A24 !== B24) return A24 - B24;

                const A7 = hospitalCount7d(a.id);
                const B7 = hospitalCount7d(b.id);
                if (A7 !== B7) return A7 - B7;

                const Ala = lastHospitalizedAt(a.id);
                const Bla = lastHospitalizedAt(b.id);
                if (Ala !== Bla) {
                    if (!Ala) return -1;
                    if (!Bla) return 1;
                    return Ala - Bla;
                }

                if (a.level !== b.level) return b.level - a.level;

                const Aff = getFF(a.id).fairFight;
                const Bff = getFF(b.id).fairFight;
                if (Number.isFinite(Aff) && Number.isFinite(Bff) && Aff !== Bff) return Aff - Bff;
                if (Number.isFinite(Aff) !== Number.isFinite(Bff)) return Number.isFinite(Aff) ? -1 : 1;

                return compareCandidates(a, b);
            })
            .slice(0, MAX_DISPLAY);
    }

    // ─────────────────────────────────────────────────────────────
    // Poll cycle
    // ─────────────────────────────────────────────────────────────

    async function poll(force = false) {
        if (state.polling) return;
        if (!state.leader?.isLeader()) {
            render();
            return;
        }

        const settings = getSettings();
        if (!settings.tornKey) {
            state.lastError = 'Add a Torn API key in Settings.';
            state.settingsOpen = true; render();
            return;
        }

        state.polling = true;
        state.lastError = '';
        render();

        try {
            cleanHospitalHistory();
            if (!state.master.length || force) await loadMaster(force);
            await ensureActivitySnapshots(settings.tornKey, false);

            const candidates = chooseCandidates(settings.primaryChecks);
            state.lastCycleChecked = candidates.length;

            const results = await Promise.allSettled(
                candidates.map(async target => {
                    const status = await getUserStatus(settings.tornKey, target, 'normal');
                    updateStatusCache(target, status);
                    return { target, status };
                })
            );

            const successful = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);

            const okayTargets = successful
                .filter(result => statusIsOkay(result.status.state))
                .map(result => result.target);
            const scoutTargets = successful.map(result => result.target);

            state.lastCycleOkay = okayTargets.length;

            if (settings.ffKey && scoutTargets.length) {
                try {
                    await updateFFScouter(settings.ffKey, scoutTargets);
                } catch (error) {
                    state.lastError = `FFScouter: ${TornLib.errorMessage(error)}`;
                }
            }

            const failures = results.filter(result => result.status === 'rejected');
            if (failures.length && !state.lastError) {
                state.lastError = `${failures.length} Torn status check${failures.length === 1 ? '' : 's'} failed.`;
            }

            state.lastCycleAt = Date.now();
            saveRuntimeState();
            saveJson(KEYS.statusCache, state.statusCache);
            saveJson(KEYS.hospitalHistory, state.hospitalHistory);
            saveJson(KEYS.ffCache, state.ffCache);
        } catch (error) {
            state.lastError = TornLib.errorMessage(error);
        } finally {
            state.polling = false;
            scheduleNextPoll();
            render();
        }
    }

    async function backgroundPoll() {
        if (state.backgroundPolling || state.polling) {
            scheduleBackgroundPoll();
            return;
        }
        if (!state.leader?.isLeader()) {
            scheduleBackgroundPoll();
            return;
        }

        const settings = getSettings();
        if (!settings.tornKey) {
            scheduleBackgroundPoll();
            return;
        }

        state.backgroundPolling = true;

        try {
            if (!state.master.length) await loadMaster(false);
            await ensureActivitySnapshots(settings.tornKey, false);

            if (settings.backgroundChecks <= 0) {
                state.lastBackgroundChecked = 0;
                scheduleBackgroundPoll();
                return;
            }

            const primaryIds = new Set(chooseCandidates(settings.primaryChecks).map(target => target.id));
            const candidates = chooseBackgroundCandidates(settings.backgroundChecks, primaryIds);
            state.lastBackgroundChecked = candidates.length;

            const results = await Promise.allSettled(
                candidates.map(async target => {
                    const status = await getUserStatus(settings.tornKey, target, 'background');
                    updateStatusCache(target, status);
                    return { target, status };
                })
            );

            const successfulTargets = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);
            const scoutTargets = successfulTargets.map(result => result.target);

            if (settings.ffKey && scoutTargets.length) {
                try {
                    await updateFFScouter(settings.ffKey, scoutTargets);
                } catch (error) {
                    console.warn('[Slinky Leveling] Background FFScouter update failed:', error);
                }
            }

            state.lastBackgroundAt = Date.now();
            saveRuntimeState();
            saveJson(KEYS.statusCache, state.statusCache);
            saveJson(KEYS.hospitalHistory, state.hospitalHistory);
            saveJson(KEYS.ffCache, state.ffCache);
        } catch (error) {
            console.warn('[Slinky Leveling] Background poll failed:', error);
        } finally {
            state.backgroundPolling = false;
            scheduleBackgroundPoll();
            render();
        }
    }

    function scheduleBackgroundPoll() {
        if (state.backgroundTimer) clearTimeout(state.backgroundTimer);

        state.backgroundTimer = setTimeout(() => {
            backgroundPoll();
        }, BACKGROUND_POLL_MS);
    }

    function scheduleNextPoll() {
        if (state.timer) clearTimeout(state.timer);

        const settings = getSettings();
        state.timer = setTimeout(() => {
            if (state.leader?.isLeader()) poll(false);
            else scheduleNextPoll();
        }, settings.pollSeconds * 1000);
    }

    // ─────────────────────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────────────────────

    function installStyles() {
        GM_addStyle(`
            #slinky-leveling-panel {
                position: fixed; top: 92px; left: 12px; z-index: 999999;
                width: 390px; max-height: calc(100vh - 110px); overflow: hidden;
                border: 1px solid rgba(255,255,255,.16); border-radius: 9px;
                background: rgba(19, 22, 28, .97); color: #eee;
                font: 12px/1.35 Arial, sans-serif;
                box-shadow: 0 8px 24px rgba(0,0,0,.42);
            }
            #slinky-leveling-panel * { box-sizing: border-box; }
            .slp-head { display:flex; align-items:center; gap:7px; padding:8px 9px; border-bottom:1px solid rgba(255,255,255,.1); cursor:move; user-select:none; }
            .slp-title { font-weight:700; font-size:13px; flex:1; }
            .slp-sub { color:#aaa; font-size:10px; }
            .slp-btn { border:1px solid rgba(255,255,255,.14); background:#2b3039; color:#eee; border-radius:5px; padding:4px 7px; cursor:pointer; }
            .slp-btn:hover { background:#3a414d; }
            .slp-body { max-height: calc(100vh - 165px); overflow:auto; }
            .slp-summary { display:grid; grid-template-columns:repeat(4, 1fr); gap:1px; background:rgba(255,255,255,.08); }
            .slp-stat { background:#20242b; padding:6px; text-align:center; }
            .slp-stat b { display:block; font-size:13px; }
            .slp-muted { color:#999; }
            .slp-error { padding:7px 9px; color:#ffb4b4; border-bottom:1px solid rgba(255,255,255,.08); }
            .slp-settings { padding:9px; border-bottom:1px solid rgba(255,255,255,.1); display:grid; grid-template-columns:1fr 1fr; gap:7px; }
            .slp-settings label { display:flex; flex-direction:column; gap:3px; color:#bbb; }
            .slp-settings .wide { grid-column:1 / -1; }
            .slp-settings input { width:100%; border:1px solid #555; border-radius:4px; background:#11151a; color:#eee; padding:5px 6px; }
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
            .slp-debug-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:5px 10px; margin-bottom:7px; }
            .slp-debug-line { display:flex; justify-content:space-between; gap:8px; color:#bbb; }
            .slp-debug-line b { color:#fff; }
            .slp-debug-actions { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:7px; }
            .slp-debug textarea { width:100%; min-height:180px; resize:vertical; border:1px solid #454b55; border-radius:5px; background:#0f1216; color:#d8d8d8; padding:7px; font:11px/1.35 Consolas, monospace; }
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
        const targets = displayTargets(settings);
        const usage = TornLib.getTornApiUsage({ limit: TornLib.TORN_API_DEFAULT_LIMIT });
        const leader = Boolean(state.leader?.isLeader());

        panel.classList.toggle('slp-collapsed', settings.collapsed);

        panel.innerHTML = `
            <div class="slp-head">
                <div>
                    <div class="slp-title">Slinky Leveling Targets</div>
                    <div class="slp-sub">${leader ? 'Polling tab' : 'Standby tab'} · CoreLib ${escapeHtml(TornLib.VERSION)}</div>
                </div>
                <button class="slp-btn" id="slp-refresh" ${state.polling ? 'disabled' : ''}>${state.polling ? 'Checking…' : 'Refresh'}</button>
                <button class="slp-btn" id="slp-debug-btn">Data</button>
                <button class="slp-btn" id="slp-settings-btn">⚙</button>
                <button class="slp-btn" id="slp-collapse">${settings.collapsed ? '＋' : '−'}</button>
            </div>
            <div class="slp-body">
                <div class="slp-summary">
                    <div class="slp-stat"><b>${targets.length}</b><span>Okay cached</span></div>
                    <div class="slp-stat"><b>${state.lastCycleChecked}</b><span>Primary</span></div>
                    <div class="slp-stat"><b>${activeExcludedCount()}</b><span>Active &lt;7d</span></div>
                    <div class="slp-stat"><b>${usage.count}/${usage.limit}</b><span>API / min</span></div>
                </div>
                ${state.lastError ? `<div class="slp-error">${escapeHtml(state.lastError)}</div>` : ''}
                ${state.settingsOpen ? settingsHtml(settings) : ''}
                ${state.debugOpen ? debugHtml() : ''}
                <div id="slp-targets">${targetsHtml(targets)}</div>
            </div>
            <div class="slp-footer">
                7-day activity snapshots exclude recent players from polling. Hospital hits are local 24h observations. Primary: ${state.lastCycleAt ? escapeHtml(humanAgo(state.lastCycleAt)) : 'Never'} · Background: ${state.lastBackgroundAt ? escapeHtml(humanAgo(state.lastBackgroundAt)) : 'Never'} (${state.lastBackgroundChecked}).
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
                <label class="wide">FFScouter API key
                    <input id="slp-ff-key" type="password" value="${escapeHtml(settings.ffKey)}" autocomplete="off">
                </label>
                <label>Checks per poll (5–80)
                    <input id="slp-primary-checks" type="number" min="5" max="80" value="${settings.primaryChecks}">
                </label>
                <label>Background checks / 5m (0–80)
                    <input id="slp-background-checks" type="number" min="0" max="80" value="${settings.backgroundChecks}">
                </label>
                <label>Poll seconds
                    <input id="slp-poll" type="number" min="60" max="300" value="${settings.pollSeconds}">
                </label>
                <label>Min FF
                    <input id="slp-min-ff" type="number" min="1" max="5" step=".1" value="${settings.minFF}">
                </label>
                <label>Max FF
                    <input id="slp-max-ff" type="number" min="1" max="5" step=".1" value="${settings.maxFF}">
                </label>
                <div class="slp-settings-actions">
                    <button class="slp-btn" id="slp-clear-history">Clear local history</button>
                    <button class="slp-btn" id="slp-save-settings">Save</button>
                </div>
            </div>
        `;
    }

    function buildDebugData() {
        // Re-read durable storage whenever Data is opened/refreshed. This also
        // migrates any existing Local Storage data visible in Chrome DevTools
        // into Tampermonkey's GM storage on first read.
        refreshCollectedDataFromStorage();

        const statusEntries = Object.values(state.statusCache || {});
        const statusCounts = {};

        for (const entry of statusEntries) {
            const status = normalizeStatus(entry?.state || 'Unknown');
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        }

        let hospitalizationEvents24h = 0;
        for (const id of Object.keys(state.hospitalHistory || {})) {
            hospitalizationEvents24h += hospitalCount24h(id);
        }

        const recentChecks = Object.entries(state.statusCache || {})
            .map(([id, record]) => {
                const target = state.master.find(item => item.id === id);
                return {
                    id,
                    name: target?.name || 'Unknown',
                    state: normalizeStatus(record?.state || 'Unknown'),
                    checkedAt: Number(record?.checkedAt) || 0
                };
            })
            .sort((a, b) => b.checkedAt - a.checkedAt)
            .slice(0, 20);

        return {
            scriptVersion: '0.4.4',
            coreLibVersion: TornLib.VERSION,
            leaderTab: Boolean(state.leader?.isLeader()),
            primaryChecksConfigured: getSettings().primaryChecks,
            backgroundChecksConfigured: getSettings().backgroundChecks,
            pollSecondsConfigured: getSettings().pollSeconds,
            masterTargets: state.master.length,
            activeUnder7Days: activeExcludedCount(),
            statusRecords: statusEntries.length,
            statusCounts,
            hospitalizationEvents24h,
            ffScouterRecords: Object.keys(state.ffCache || {}).length,
            hospitalizedTargets: Object.keys(state.hospitalHistory || {}).filter(id => hospitalCount7d(id) > 0).length,
            hospitalizationEvents7d: Object.keys(state.hospitalHistory || {}).reduce((sum, id) => sum + hospitalCount7d(id), 0),
            activitySnapshotRefreshedAt: Number(state.activityCache?.refreshedAt) || 0,
            activitySnapshotCount: Array.isArray(state.activityCache?.snapshots) ? state.activityCache.snapshots.length : 0,
            lastPrimaryPollAt: state.lastCycleAt,
            lastPrimaryChecked: state.lastCycleChecked,
            lastPrimaryOkay: state.lastCycleOkay,
            lastBackgroundPollAt: state.lastBackgroundAt,
            lastBackgroundChecked: state.lastBackgroundChecked,
            lastError: state.lastError || '',
            recentChecks
        };
    }

    function debugText() {
        const data = buildDebugData();
        const knownStatuses = ['Okay', 'Hospital', 'Traveling', 'Abroad', 'Jail', 'Federal'];
        const knownCount = Object.entries(data.statusCounts)
            .filter(([key]) => knownStatuses.includes(key))
            .reduce((sum, [, count]) => sum + count, 0);

        const lines = [
            `Slinky Leveling Target Prototype v${data.scriptVersion}`,
            `CoreLib: ${data.coreLibVersion}`,
            `Polling tab: ${data.leaderTab ? 'Yes' : 'No'}`,
            `Configured polling: ${data.primaryChecksConfigured} checks every ${data.pollSecondsConfigured}s`,
            `Background sampling: ${data.backgroundChecksConfigured} checks every 5m`,
            '',
            `Master targets loaded: ${data.masterTargets}`,
            `Active <7d excluded: ${data.activeUnder7Days}`,
            `Cached status records: ${data.statusRecords}`,
            `  Okay: ${data.statusCounts.Okay || 0}`,
            `  Hospital: ${data.statusCounts.Hospital || 0}`,
            `  Traveling: ${data.statusCounts.Traveling || 0}`,
            `  Abroad: ${data.statusCounts.Abroad || 0}`,
            `  Jail: ${data.statusCounts.Jail || 0}`,
            `  Federal: ${data.statusCounts.Federal || 0}`,
            `  Unknown/Other: ${Math.max(0, data.statusRecords - knownCount)}`,
            `Hospitalization events observed in 24h: ${data.hospitalizationEvents24h}`,
            `FFScouter cached records: ${data.ffScouterRecords}`,
            `Targets hospitalized in 7d: ${data.hospitalizedTargets}`,
            `Hospitalization events observed in 7d: ${data.hospitalizationEvents7d}`,
            `Activity snapshots cached: ${data.activitySnapshotCount}`,
            `Activity snapshot refreshed: ${data.activitySnapshotRefreshedAt ? new Date(data.activitySnapshotRefreshedAt).toLocaleString() : 'Never'}`,
            '',
            `Primary poll: ${data.lastPrimaryPollAt ? new Date(data.lastPrimaryPollAt).toLocaleString() : 'Never'} | checked ${data.lastPrimaryChecked} | Okay ${data.lastPrimaryOkay}`,
            `Background poll: ${data.lastBackgroundPollAt ? new Date(data.lastBackgroundPollAt).toLocaleString() : 'Never'} | checked ${data.lastBackgroundChecked}`,
            `Last error: ${data.lastError || 'None'}`,
            '',
            'Most recent status checks:'
        ];

        for (const row of data.recentChecks) {
            lines.push(`${row.checkedAt ? new Date(row.checkedAt).toLocaleString() : 'Never'} | ${row.name} [${row.id}] | ${row.state}`);
        }

        return lines.join('\n');
    }

    function csvCell(value) {
        const text = String(value ?? '');
        return `"${text.replace(/"/g, '""')}"`;
    }

    function downloadCsv(filename, headers, rows) {
        const lines = [headers.map(csvCell).join(',')];
        for (const row of rows) {
            lines.push(headers.map(header => csvCell(row[header])).join(','));
        }
        const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportHospitalizationSummaryCsv() {
        refreshCollectedDataFromStorage();
        const headers = [
            'id', 'name', 'level', 'total', 'sources',
            'hospitalizations_24h', 'hospitalizations_7d',
            'last_hospitalized_at', 'last_status', 'last_status_checked_at'
        ];
        const rows = state.master
            .map(target => {
                const count24 = hospitalCount24h(target.id);
                const count7 = hospitalCount7d(target.id);
                const lastHosp = lastHospitalizedAt(target.id);
                const status = state.statusCache[target.id] || {};
                return {
                    id: target.id,
                    name: target.name,
                    level: target.level,
                    total: target.total,
                    sources: target.sources,
                    hospitalizations_24h: count24,
                    hospitalizations_7d: count7,
                    last_hospitalized_at: lastHosp ? new Date(lastHosp).toISOString() : '',
                    last_status: status.state || '',
                    last_status_checked_at: status.checkedAt ? new Date(status.checkedAt).toISOString() : ''
                };
            })
            .filter(row => row.hospitalizations_7d > 0)
            .sort((a, b) =>
                b.hospitalizations_24h - a.hospitalizations_24h ||
                b.hospitalizations_7d - a.hospitalizations_7d ||
                String(b.last_hospitalized_at).localeCompare(String(a.last_hospitalized_at))
            );
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCsv(`Slinky-Leveling-Hospitalization-Summary-${stamp}.csv`, headers, rows);
    }

    function exportTargetCacheCsv() {
        refreshCollectedDataFromStorage();
        const headers = [
            'id', 'name', 'level', 'total', 'sources', 'profile_url',
            'active_within_7_days', 'last_seen_active_snapshot',
            'current_status', 'status_description', 'status_checked_at',
            'hospitalizations_observed_24h', 'last_hospitalized_at',
            'fair_fight', 'ff_bs_estimate', 'ff_source', 'ff_checked_at'
        ];
        const rows = state.master.map(target => {
            const status = state.statusCache[target.id] || {};
            const ff = state.ffCache[target.id] || {};
            const lastActive = lastSeenActiveSnapshot(target.id);
            const lastHosp = lastHospitalizedAt(target.id);
            return {
                id: target.id,
                name: target.name,
                level: target.level,
                total: target.total,
                sources: target.sources,
                profile_url: target.profileUrl,
                active_within_7_days: activeWithinSevenDays(target.id) ? 'Yes' : 'No',
                last_seen_active_snapshot: lastActive ? new Date(lastActive * 1000).toISOString() : '',
                current_status: status.state || '',
                status_description: status.description || '',
                status_checked_at: status.checkedAt ? new Date(status.checkedAt).toISOString() : '',
                hospitalizations_observed_24h: hospitalCount24h(target.id),
                last_hospitalized_at: lastHosp ? new Date(lastHosp).toISOString() : '',
                fair_fight: Number.isFinite(Number(ff.fairFight)) ? ff.fairFight : '',
                ff_bs_estimate: ff.bsEstimate ?? '',
                ff_source: ff.source || '',
                ff_checked_at: ff.checkedAt ? new Date(ff.checkedAt).toISOString() : ''
            };
        });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCsv(`Slinky-Leveling-Target-Cache-${stamp}.csv`, headers, rows);
    }

    function debugHtml() {
        const data = buildDebugData();

        return `
            <div class="slp-debug">
                <div class="slp-debug-grid">
                    <div class="slp-debug-line"><span>Master loaded</span><b>${data.masterTargets}</b></div>
                    <div class="slp-debug-line"><span>Active &lt;7d</span><b>${data.activeUnder7Days}</b></div>
                    <div class="slp-debug-line"><span>Status cached</span><b>${data.statusRecords}</b></div>
                    <div class="slp-debug-line"><span>FF cached</span><b>${data.ffScouterRecords}</b></div>
                    <div class="slp-debug-line"><span>Hosp targets 7d</span><b>${data.hospitalizedTargets}</b></div>
                    <div class="slp-debug-line"><span>Hosp events 7d</span><b>${data.hospitalizationEvents7d}</b></div>
                    <div class="slp-debug-line"><span>Okay</span><b>${data.statusCounts.Okay || 0}</b></div>
                    <div class="slp-debug-line"><span>Hospital</span><b>${data.statusCounts.Hospital || 0}</b></div>
                    <div class="slp-debug-line"><span>Traveling</span><b>${data.statusCounts.Traveling || 0}</b></div>
                    <div class="slp-debug-line"><span>Jail</span><b>${data.statusCounts.Jail || 0}</b></div>
                    <div class="slp-debug-line"><span>Hosp events 24h</span><b>${data.hospitalizationEvents24h}</b></div>
                    <div class="slp-debug-line"><span>Snapshots</span><b>${data.activitySnapshotCount}</b></div>
                </div>
                <div class="slp-debug-actions">
                    <button class="slp-btn" id="slp-export-hospitalizations">Export Hospitalizations CSV</button>
                    <button class="slp-btn" id="slp-export-target-cache">Export Target Cache CSV</button>
                    <button class="slp-btn" id="slp-copy-debug">Copy Debug Data</button>
                    <button class="slp-btn" id="slp-refresh-debug">Refresh View</button>
                </div>
                <textarea id="slp-debug-text" readonly>${escapeHtml(debugText())}</textarea>
            </div>
        `;
    }

    function targetsHtml(targets) {
        if (!targets.length) {
            return `<div class="slp-empty">${state.polling ? 'Collecting target status…' : 'No recently verified Okay targets in the configured FF range.'}</div>`;
        }

        return targets.map(target => {
            const ff = getFF(target.id);
            const hospCount = hospitalCount24h(target.id);
            const lastHosp = lastHospitalizedAt(target.id);
            const attackUrl = TornLib.attackLink(target.id);
            const ffText = Number.isFinite(ff.fairFight) ? ff.fairFight.toFixed(2) : '?';
            const statText = ff.bsEstimate ? TornLib.shortNumber(ff.bsEstimate) : shortNumber(target.total);

            return `
                <article class="slp-row">
                    <div class="slp-row-top">
                        <a class="slp-name" href="${escapeHtml(target.profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(target.name)} [${escapeHtml(target.id)}]</a>
                        <span class="slp-level">Lv ${target.level}</span>
                    </div>
                    <div class="slp-meta">
                        <span class="slp-badge">FF ${escapeHtml(ffText)}</span>
                        <span class="slp-badge">BS ${escapeHtml(statText)}</span>
                        <span class="slp-badge ${hospCount ? 'slp-hosp-hot' : ''}">Hosp 24h: ${hospCount}</span>
                        <span class="slp-badge ${hospitalCount7d(target.id) ? 'slp-hosp-hot' : ''}">7d: ${hospitalCount7d(target.id)}</span>
                        <span>Last hosp: ${escapeHtml(lastHosp ? humanAgo(lastHosp) : 'Never seen')}</span>
                    </div>
                    <div class="slp-meta"><span title="${escapeHtml(target.sources)}">Source: ${escapeHtml(target.sources || 'Unknown')}</span></div>
                    <div class="slp-actions">
                        <a class="slp-btn" href="${escapeHtml(attackUrl)}" target="_blank" rel="noopener noreferrer">Attack</a>
                        <a class="slp-btn" href="${escapeHtml(target.profileUrl)}" target="_blank" rel="noopener noreferrer">Profile</a>
                    </div>
                </article>
            `;
        }).join('');
    }

    function bindEvents(panel) {
        panel.querySelector('#slp-refresh')?.addEventListener('click', () => poll(true));

        panel.querySelector('#slp-debug-btn')?.addEventListener('click', () => {
            state.debugOpen = !state.debugOpen;
            render();
        });

        panel.querySelector('#slp-settings-btn')?.addEventListener('click', () => {
            state.settingsOpen = !state.settingsOpen;
            render();
        });

        panel.querySelector('#slp-export-hospitalizations')?.addEventListener('click', () => exportHospitalizationSummaryCsv());
        panel.querySelector('#slp-export-target-cache')?.addEventListener('click', () => exportTargetCacheCsv());

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

        panel.querySelector('#slp-refresh-debug')?.addEventListener('click', () => render());

        panel.querySelector('#slp-collapse')?.addEventListener('click', () => {
            GM_setValue(KEYS.collapsed, !getSettings().collapsed);
            render();
        });

        panel.querySelector('#slp-save-settings')?.addEventListener('click', () => {
            const values = {
                tornKey: panel.querySelector('#slp-torn-key')?.value,
                ffKey: panel.querySelector('#slp-ff-key')?.value,
                primaryChecks: panel.querySelector('#slp-primary-checks')?.value,
                backgroundChecks: panel.querySelector('#slp-background-checks')?.value,
                pollSeconds: panel.querySelector('#slp-poll')?.value,
                minFF: panel.querySelector('#slp-min-ff')?.value,
                maxFF: panel.querySelector('#slp-max-ff')?.value
            };

            saveSettings(values);
            state.settingsOpen = false;
            scheduleNextPoll();
            poll(true);
        });

        panel.querySelector('#slp-clear-history')?.addEventListener('click', () => {
            state.hospitalHistory = {};
            state.statusCache = {};
            state.ffCache = {};
            state.activityCache = { refreshedAt: 0, activeTargets: {}, snapshots: [] };
            state.observationLog = [];

            saveJson(KEYS.hospitalHistory, {});
            saveJson(KEYS.statusCache, {});
            saveJson(KEYS.ffCache, {});
            saveJson(KEYS.activityCache, state.activityCache);
            saveJson(KEYS.observationLog, []);
            render();
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Startup
    // ─────────────────────────────────────────────────────────────

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
                    poll(false);
                    scheduleBackgroundPoll();
                }
            }
        });

        try {
            await loadMaster(false);
        } catch (error) {
            state.lastError = TornLib.errorMessage(error);
        }

        if (!getSettings().tornKey) state.settingsOpen = true;
        render();

        if (state.leader.isLeader()) {
            poll(false);
            scheduleBackgroundPoll();
        } else {
            scheduleNextPoll();
            scheduleBackgroundPoll();
        }
    }

    start();
})();
