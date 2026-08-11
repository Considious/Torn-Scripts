// ==UserScript==
// @name         Slinky's Leveling Target Prototype
// @namespace    Considious [3853023]
// @version      0.1.0
// @description  API-only leveling target prototype using the Slinkies master list, Torn status checks, FFScouter estimates, and local hospitalization history.
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

    const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
    const OKAY_CACHE_MS = 5 * 60 * 1000;
    const NON_OKAY_RECHECK_MS = 5 * 60 * 1000;
    const FF_CACHE_MS = 12 * 60 * 60 * 1000;
    const MASTER_CACHE_MS = 30 * 60 * 1000;
    const MAX_DISPLAY = 40;

    const KEYS = {
        tornKey: 'slinkyLeveling.tornApiKey',
        ffKey: 'slinkyLeveling.ffApiKey',
        checksPerCycle: 'slinkyLeveling.checksPerCycle',
        pollSeconds: 'slinkyLeveling.pollSeconds',
        minFF: 'slinkyLeveling.minFF',
        maxFF: 'slinkyLeveling.maxFF',
        collapsed: 'slinkyLeveling.collapsed',
        hospitalHistory: 'slinkyLeveling.hospitalHistory.v1',
        statusCache: 'slinkyLeveling.statusCache.v1',
        ffCache: 'slinkyLeveling.ffCache.v1',
        masterCache: 'slinkyLeveling.masterCache.v1'
    };

    const state = {
        master: [],
        statusCache: loadJson(KEYS.statusCache, {}),
        ffCache: loadJson(KEYS.ffCache, {}),
        hospitalHistory: loadJson(KEYS.hospitalHistory, {}),
        polling: false,
        lastCycleAt: 0,
        lastCycleChecked: 0,
        lastCycleOkay: 0,
        lastError: '',
        settingsOpen: false,
        timer: null,
        leader: null
    };

    // ─────────────────────────────────────────────────────────────
    // CoreLib-backed storage and helpers
    // ─────────────────────────────────────────────────────────────

    function loadJson(key, fallback) {
        try {
            return TornLib.readJsonStorage(key, { fallback, merge: false }) ?? fallback;
        } catch {
            return fallback;
        }
    }

    function saveJson(key, value) {
        try {
            return TornLib.writeJsonStorage(key, value);
        } catch {
            return value;
        }
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
            checksPerCycle: clamp(Number(GM_getValue(KEYS.checksPerCycle, 40)) || 40, 10, 40),
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
        GM_setValue(KEYS.checksPerCycle, clamp(Number(values.checksPerCycle) || 40, 10, 40));
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
    // Hospitalization history
    // ─────────────────────────────────────────────────────────────

    function cleanHospitalHistory() {
        const cutoff = Date.now() - HISTORY_WINDOW_MS;

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
            lastState: ''
        };

        const cutoff = Date.now() - HISTORY_WINDOW_MS;
        record.events = Array.isArray(record.events)
            ? record.events.map(Number).filter(timestamp => timestamp >= cutoff)
            : [];

        return record;
    }

    function noteStatusObservation(id, statusState) {
        const now = Date.now();
        const normalized = normalizeStatus(statusState);
        const record = getHospitalRecord(id);
        const wasHospital = isHospitalState(record.lastState);
        const isHospital = isHospitalState(normalized);

        if (isHospital && !wasHospital) {
            record.events.push(now);
            record.lastHospitalizedAt = now;
        }

        record.lastState = normalized;
        state.hospitalHistory[id] = record;
    }

    function hospitalCount24h(id) {
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

    async function getUserStatus(apiKey, target) {
        const url = `https://api.torn.com/v2/user/${encodeURIComponent(target.id)}/basic`;
        const data = await TornLib.tornRequest(url, apiKey, {
            tornScript: SCRIPT_NAME,
            tornPriority: 'normal',
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

        state.statusCache[target.id] = {
            state: status.state,
            description: status.description,
            checkedAt: now,
            nextEligibleAt: okay ? now : now + NON_OKAY_RECHECK_MS
        };

        noteStatusObservation(target.id, status.state);
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
            hospitalCount: record.events.length,
            recentHospitalPenalty: lastHosp ? Math.max(0, HISTORY_WINDOW_MS - (Date.now() - lastHosp)) : 0,
            level: target.level,
            total: Number.isFinite(target.totalNumeric) ? target.totalNumeric : Number.MAX_SAFE_INTEGER,
            lastCheckedAt: Number(status?.checkedAt) || 0
        };
    }

    function compareCandidates(a, b) {
        const A = priorityTuple(a);
        const B = priorityTuple(b);

        if (A.blocked !== B.blocked) return A.blocked - B.blocked;
        if (A.hospitalCount !== B.hospitalCount) return A.hospitalCount - B.hospitalCount;
        if (A.recentHospitalPenalty !== B.recentHospitalPenalty) return A.recentHospitalPenalty - B.recentHospitalPenalty;
        if (A.level !== B.level) return B.level - A.level;
        if (A.total !== B.total) return A.total - B.total;
        if (A.lastCheckedAt !== B.lastCheckedAt) return A.lastCheckedAt - B.lastCheckedAt;
        return a.name.localeCompare(b.name);
    }

    function chooseCandidates(limit) {
        const now = Date.now();

        return [...state.master]
            .filter(target => {
                const cached = state.statusCache[target.id];
                return !cached?.nextEligibleAt || cached.nextEligibleAt <= now;
            })
            .sort(compareCandidates)
            .slice(0, limit);
    }

    function displayTargets(settings) {
        const now = Date.now();

        return state.master
            .filter(target => {
                const status = state.statusCache[target.id];
                if (!status || now - Number(status.checkedAt || 0) > OKAY_CACHE_MS) return false;
                if (!statusIsOkay(status.state)) return false;

                const ff = getFF(target.id).fairFight;
                if (Number.isFinite(ff)) {
                    if (ff < settings.minFF || ff > settings.maxFF) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const Ah = hospitalCount24h(a.id);
                const Bh = hospitalCount24h(b.id);
                if (Ah !== Bh) return Ah - Bh;

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

            const candidates = chooseCandidates(settings.checksPerCycle);
            state.lastCycleChecked = candidates.length;

            const results = await Promise.allSettled(
                candidates.map(async target => {
                    const status = await getUserStatus(settings.tornKey, target);
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

            state.lastCycleOkay = okayTargets.length;

            if (settings.ffKey && okayTargets.length) {
                try {
                    await updateFFScouter(settings.ffKey, okayTargets);
                } catch (error) {
                    state.lastError = `FFScouter: ${TornLib.errorMessage(error)}`;
                }
            }

            const failures = results.filter(result => result.status === 'rejected');
            if (failures.length && !state.lastError) {
                state.lastError = `${failures.length} Torn status check${failures.length === 1 ? '' : 's'} failed.`;
            }

            state.lastCycleAt = Date.now();
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
            .slp-head { display:flex; align-items:center; gap:7px; padding:8px 9px; border-bottom:1px solid rgba(255,255,255,.1); }
            .slp-title { font-weight:700; font-size:13px; flex:1; }
            .slp-sub { color:#aaa; font-size:10px; }
            .slp-btn { border:1px solid rgba(255,255,255,.14); background:#2b3039; color:#eee; border-radius:5px; padding:4px 7px; cursor:pointer; }
            .slp-btn:hover { background:#3a414d; }
            .slp-body { max-height: calc(100vh - 165px); overflow:auto; }
            .slp-summary { display:grid; grid-template-columns:repeat(3, 1fr); gap:1px; background:rgba(255,255,255,.08); }
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
                <button class="slp-btn" id="slp-settings-btn">⚙</button>
                <button class="slp-btn" id="slp-collapse">${settings.collapsed ? '＋' : '−'}</button>
            </div>
            <div class="slp-body">
                <div class="slp-summary">
                    <div class="slp-stat"><b>${targets.length}</b><span>Okay cached</span></div>
                    <div class="slp-stat"><b>${state.lastCycleChecked}</b><span>Checked</span></div>
                    <div class="slp-stat"><b>${usage.count}/${usage.limit}</b><span>API / min</span></div>
                </div>
                ${state.lastError ? `<div class="slp-error">${escapeHtml(state.lastError)}</div>` : ''}
                ${state.settingsOpen ? settingsHtml(settings) : ''}
                <div id="slp-targets">${targetsHtml(targets)}</div>
            </div>
            <div class="slp-footer">
                Hospital hits are local observations, rolling 24h. Last cycle: ${state.lastCycleAt ? escapeHtml(humanAgo(state.lastCycleAt)) : 'Never'}.
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
                <label>Checks / cycle
                    <input id="slp-checks" type="number" min="10" max="40" value="${settings.checksPerCycle}">
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

        panel.querySelector('#slp-settings-btn')?.addEventListener('click', () => {
            state.settingsOpen = !state.settingsOpen;
            render();
        });

        panel.querySelector('#slp-collapse')?.addEventListener('click', () => {
            GM_setValue(KEYS.collapsed, !getSettings().collapsed);
            render();
        });

        panel.querySelector('#slp-save-settings')?.addEventListener('click', () => {
            const values = {
                tornKey: panel.querySelector('#slp-torn-key')?.value,
                ffKey: panel.querySelector('#slp-ff-key')?.value,
                checksPerCycle: panel.querySelector('#slp-checks')?.value,
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

            saveJson(KEYS.hospitalHistory, {});
            saveJson(KEYS.statusCache, {});
            saveJson(KEYS.ffCache, {});
            render();
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Startup
    // ─────────────────────────────────────────────────────────────

    async function start() {
        installStyles();

        state.leader = TornLib.createTabLeaderLease('slinky-leveling-targets', {
            leaseMs: 15_000,
            heartbeatMs: 5_000,
            isEligible: () => true,
            isPreferred: () => TornLib.isPageActive({ requireFocus: true }),
            onChange: isLeader => {
                render();
                if (isLeader) poll(false);
            }
        });

        try {
            await loadMaster(false);
        } catch (error) {
            state.lastError = TornLib.errorMessage(error);
        }

        if (!getSettings().tornKey) state.settingsOpen = true;
        render();

        if (state.leader.isLeader()) poll(false);
        else scheduleNextPoll();
    }

    start();
})();
