// ==UserScript==
// @name         SLINK Scout
// @namespace    Considious [3853023]
// @version      0.1.0
// @description  Local FFScouter discovery companion for finding possible SLINK targets.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-Scout/SLINK_Scout.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-Scout/SLINK_Scout.user.js
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/main/shared/Considious_Torn_Lib.js?v=1.3.5
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      ffscouter.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // Release: 0.1.0-ffscouter-local-csv-discovery

    const TornLib = globalThis.ConsidiousTornLib;
    if (!TornLib) throw new Error('Considious Torn Library failed to load.');

    const SCRIPT_VERSION = '0.1.0';
    const FFSCOUTER_TARGETS_URL = 'https://ffscouter.com/api/v1/get-targets';
    const REQUEST_COOLDOWN_MS = 12_500;
    const MAX_RESULTS = 50;

    const KEYS = {
        ffKey: 'slinkScout.ffscouterKey.v1',
        filters: 'slinkScout.filters.v1',
        seen: 'slinkScout.seenIds.v1',
        lastResults: 'slinkScout.lastResults.v1',
        lastRequestAt: 'slinkScout.lastRequestAt.v1',
        collapsed: 'slinkScout.collapsed.v1',
        panelPosition: 'slinkScout.panelPosition.v1',
        bubblePosition: 'slinkScout.bubblePosition.v1'
    };

    const DEFAULT_FILTERS = Object.freeze({
        minLevel: 50,
        maxLevel: 100,
        useFairFight: false,
        minFairFight: 1,
        maxFairFight: 3,
        minBattleStats: '',
        maxBattleStats: '',
        randomSample: true,
        inactiveOnly: true,
        factionlessOnly: false,
        hideSeen: true,
        resultLimit: 50
    });

    const state = {
        busy: false,
        error: '',
        message: 'Ready for a manual FFScouter search.',
        results: loadJson(KEYS.lastResults, []),
        returnedCount: 0
    };
    let panelDragController = null;


    // ================================================================
    // Storage and values
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


    function loadFilters() {
        return {
            ...DEFAULT_FILTERS,
            ...loadJson(KEYS.filters, {})
        };
    }


    function seenMap() {
        const value = loadJson(KEYS.seen, {});
        return value && typeof value === 'object' ? value : {};
    }


    function seenCount() {
        return Object.keys(seenMap()).length;
    }


    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }


    function parseStatInput(value) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replaceAll(',', '');
        if (!normalized) return null;
        const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([kmbt]?)$/);
        if (!match) throw new Error(`Invalid battle-stat value: ${value}`);
        const multipliers = { '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
        const parsed = Number(match[1]) * multipliers[match[2]];
        if (!Number.isFinite(parsed) || parsed < 0) {
            throw new Error(`Invalid battle-stat value: ${value}`);
        }
        return parsed;
    }


    function escapeHtml(value) {
        return TornLib.escapeHtml(String(value ?? ''));
    }


    function shortStats(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0
            ? TornLib.shortNumber(parsed)
            : 'Unknown';
    }


    function finiteOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }


    function formatUtc(unixSeconds) {
        const parsed = Number(unixSeconds);
        return Number.isFinite(parsed) && parsed > 0
            ? new Date(parsed * 1000).toISOString()
            : '';
    }


    function formatLastAction(unixSeconds) {
        const parsed = Number(unixSeconds);
        if (!Number.isFinite(parsed) || parsed <= 0) return 'Unknown';
        const seconds = Math.max(0, Math.floor(Date.now() / 1000) - parsed);
        return `${TornLib.formatHumanDuration(seconds)} ago`;
    }


    // ================================================================
    // FFScouter discovery
    // ================================================================

    function normalizeTarget(target) {
        return {
            player_id: Number(target?.player_id) || 0,
            name: String(target?.name || 'Unknown'),
            level: Number(target?.level) || 0,
            fair_fight: finiteOrNull(target?.fair_fight),
            bs_estimate: finiteOrNull(target?.bs_estimate),
            bs_estimate_human: String(target?.bs_estimate_human || ''),
            bss_public: finiteOrNull(target?.bss_public),
            bss_public_timestamp: Number(target?.bss_public_timestamp) || 0,
            last_action: Number(target?.last_action) || 0,
            source: String(target?.source || 'bss'),
            hospital_until: Number(target?.hospital_until) || 0,
            discovered_at: Date.now()
        };
    }


    function readFilters(panel) {
        const filters = {
            minLevel: clamp(Number(panel.querySelector('#sls-min-level')?.value) || 1, 1, 100),
            maxLevel: clamp(Number(panel.querySelector('#sls-max-level')?.value) || 100, 1, 100),
            useFairFight: Boolean(panel.querySelector('#sls-use-ff')?.checked),
            minFairFight: clamp(Number(panel.querySelector('#sls-min-ff')?.value) || 1, 1, 3),
            maxFairFight: clamp(Number(panel.querySelector('#sls-max-ff')?.value) || 3, 1, 3),
            minBattleStats: String(panel.querySelector('#sls-min-bs')?.value || '').trim(),
            maxBattleStats: String(panel.querySelector('#sls-max-bs')?.value || '').trim(),
            randomSample: Boolean(panel.querySelector('#sls-random')?.checked),
            inactiveOnly: Boolean(panel.querySelector('#sls-inactive')?.checked),
            factionlessOnly: Boolean(panel.querySelector('#sls-factionless')?.checked),
            hideSeen: Boolean(panel.querySelector('#sls-hide-seen')?.checked),
            resultLimit: clamp(Number(panel.querySelector('#sls-limit')?.value) || 50, 1, MAX_RESULTS)
        };

        if (filters.minLevel > filters.maxLevel) {
            throw new Error('Minimum level cannot be higher than maximum level.');
        }
        if (filters.useFairFight && filters.minFairFight > filters.maxFairFight) {
            throw new Error('Minimum Fair Fight cannot be higher than maximum Fair Fight.');
        }

        const minimumStats = parseStatInput(filters.minBattleStats);
        const maximumStats = parseStatInput(filters.maxBattleStats);
        if (minimumStats !== null && maximumStats !== null && minimumStats > maximumStats) {
            throw new Error('Minimum battle stats cannot be higher than maximum battle stats.');
        }
        if (filters.randomSample && !filters.inactiveOnly) {
            throw new Error('Random discovery uses FFScouter’s inactive pool. Enable Inactive only or turn off Random discovery.');
        }
        if (filters.randomSample && filters.factionlessOnly) {
            throw new Error('Factionless-only filtering requires targeted discovery. Turn off Random discovery.');
        }

        return filters;
    }


    function buildDiscoveryUrl(apiKey, filters) {
        if (filters.randomSample) {
            return `${FFSCOUTER_TARGETS_URL}?${new URLSearchParams({
                key: apiKey,
                limit: String(MAX_RESULTS)
            })}`;
        }

        const parameters = new URLSearchParams({
            key: apiKey,
            minlevel: String(filters.minLevel),
            maxlevel: String(filters.maxLevel),
            inactiveonly: filters.inactiveOnly ? '1' : '0',
            limit: String(filters.resultLimit),
            factionless: filters.factionlessOnly ? '1' : '0'
        });
        if (filters.useFairFight) {
            parameters.set('minff', String(filters.minFairFight));
            parameters.set('maxff', String(filters.maxFairFight));
        }
        return `${FFSCOUTER_TARGETS_URL}?${parameters}`;
    }


    function filterAndSortTargets(targets, filters, alreadySeen) {
        const minimumStats = parseStatInput(filters.minBattleStats);
        const maximumStats = parseStatInput(filters.maxBattleStats);

        return targets.filter(target => {
            if (!target.player_id) return false;
            if (target.level < filters.minLevel || target.level > filters.maxLevel) return false;
            if (filters.useFairFight && (
                target.fair_fight === null ||
                target.fair_fight < filters.minFairFight ||
                target.fair_fight > filters.maxFairFight
            )) return false;
            if (filters.hideSeen && alreadySeen[target.player_id]) return false;
            if (minimumStats !== null && (
                target.bs_estimate === null || target.bs_estimate < minimumStats
            )) return false;
            if (maximumStats !== null && (
                target.bs_estimate === null || target.bs_estimate > maximumStats
            )) return false;
            return true;
        }).sort((left, right) => {
            const leftStats = left.bs_estimate ?? Number.POSITIVE_INFINITY;
            const rightStats = right.bs_estimate ?? Number.POSITIVE_INFINITY;
            return leftStats - rightStats || right.level - left.level || left.player_id - right.player_id;
        }).slice(0, filters.resultLimit);
    }


    function markSeen(targets) {
        const seen = seenMap();
        const now = Date.now();
        for (const target of targets) {
            seen[target.player_id] = now;
        }
        saveJson(KEYS.seen, seen);
    }


    async function discover(panel) {
        if (state.busy) return;
        state.error = '';

        try {
            const apiKey = String(panel.querySelector('#sls-ff-key')?.value || '').trim();
            if (!/^[A-Za-z0-9]{16}$/.test(apiKey)) {
                throw new Error('Enter the 16-character API key registered with FFScouter.');
            }

            const filters = readFilters(panel);
            const lastRequestAt = Number(GM_getValue(KEYS.lastRequestAt, 0)) || 0;
            const waitMs = REQUEST_COOLDOWN_MS - (Date.now() - lastRequestAt);
            if (waitMs > 0) {
                throw new Error(`FFScouter allows five searches per minute. Try again in ${Math.ceil(waitMs / 1000)} seconds.`);
            }

            GM_setValue(KEYS.ffKey, apiKey);
            saveJson(KEYS.filters, filters);
            GM_setValue(KEYS.lastRequestAt, Date.now());
            state.busy = true;
            state.message = 'Asking FFScouter for candidate targets…';
            render();

            const response = await TornLib.requestJson(
                buildDiscoveryUrl(apiKey, filters),
                {
                    headers: { Accept: 'application/json' },
                    timeout: 20_000,
                    invalidJsonMessage: 'FFScouter returned an invalid response.',
                    networkErrorMessage: 'Could not reach FFScouter.',
                    timeoutMessage: 'FFScouter took too long to respond.'
                }
            );

            const returned = Array.isArray(response?.targets)
                ? response.targets.map(normalizeTarget)
                : [];
            const visible = filterAndSortTargets(returned, filters, seenMap());
            state.returnedCount = returned.length;
            state.results = visible;
            markSeen(visible);
            saveJson(KEYS.lastResults, visible);

            const hidden = returned.length - visible.length;
            state.message = visible.length
                ? `FFScouter returned ${returned.length}; showing ${visible.length} lowest-stat matches${hidden ? ` after hiding ${hidden}` : ''}.`
                : `FFScouter returned ${returned.length}, but every result was excluded by the local battle-stat or seen filters.`;
        } catch (error) {
            state.error = TornLib.errorMessage(error);
            state.message = 'Discovery did not complete.';
        } finally {
            state.busy = false;
            render();
        }
    }


    // ================================================================
    // CSV export
    // ================================================================

    function csvCell(value) {
        const text = String(value ?? '');
        return /[",\r\n]/.test(text)
            ? `"${text.replaceAll('"', '""')}"`
            : text;
    }


    function exportCsv() {
        if (!state.results.length) return;
        const header = [
            'player_id',
            'name',
            'level',
            'fair_fight',
            'bs_estimate',
            'bs_estimate_human',
            'bss_public',
            'bss_public_timestamp',
            'last_action',
            'last_action_utc',
            'source',
            'hospital_until',
            'profile_url',
            'attack_url',
            'discovered_at_utc'
        ];
        const rows = state.results.map(target => [
            target.player_id,
            target.name,
            target.level,
            target.fair_fight ?? '',
            target.bs_estimate ?? '',
            target.bs_estimate_human,
            target.bss_public ?? '',
            target.bss_public_timestamp || '',
            target.last_action || '',
            formatUtc(target.last_action),
            target.source,
            target.hospital_until || '',
            `https://www.torn.com/profiles.php?XID=${target.player_id}`,
            TornLib.attackLink(target.player_id),
            new Date(target.discovered_at).toISOString()
        ]);
        const csv = [header, ...rows]
            .map(row => row.map(csvCell).join(','))
            .join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
        link.href = url;
        link.download = `slink-scout-${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        state.message = `Exported ${state.results.length} candidates to CSV.`;
        render();
    }


    // ================================================================
    // Interface
    // ================================================================

    function installStyles() {
        GM_addStyle(`
            #slink-scout-panel {
                position:fixed; top:110px; right:auto; left:420px; z-index:999998;
                width:470px; max-width:calc(100vw - 16px); max-height:calc(100vh - 120px);
                overflow:hidden; border:1px solid rgba(255,255,255,.16); border-radius:9px;
                background:rgba(18,23,27,.98); color:#eee; font:12px/1.35 Arial,sans-serif;
                box-shadow:0 8px 24px rgba(0,0,0,.44);
            }
            #slink-scout-panel * { box-sizing:border-box; }
            .sls-head { display:flex; align-items:center; gap:7px; padding:8px 9px; border-bottom:1px solid rgba(255,255,255,.1); cursor:move; user-select:none; }
            .sls-title { flex:1; font-weight:700; font-size:13px; }
            .sls-sub { color:#9fb3b8; font-size:10px; }
            .sls-btn { border:1px solid rgba(255,255,255,.16); border-radius:5px; padding:5px 8px; background:#29343a; color:#eee; cursor:pointer; }
            .sls-btn:hover { background:#38464e; }
            .sls-btn:disabled { opacity:.5; cursor:default; }
            .sls-body { max-height:calc(100vh - 165px); overflow:auto; }
            .sls-disclosure { padding:8px 9px; color:#b9c8cc; background:#18272d; border-bottom:1px solid rgba(255,255,255,.08); }
            .sls-filters { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; padding:9px; border-bottom:1px solid rgba(255,255,255,.09); }
            .sls-filters label { display:flex; flex-direction:column; gap:3px; color:#bbc3c6; }
            .sls-filters .sls-wide { grid-column:1 / -1; }
            .sls-filters input { width:100%; border:1px solid #536168; border-radius:4px; padding:5px 6px; background:#10171a; color:#fff; }
            .sls-checks { grid-column:1 / -1; display:grid; grid-template-columns:1fr 1fr; gap:6px; }
            .sls-checks label { display:flex; flex-direction:row; align-items:center; gap:6px; }
            .sls-checks input { width:auto; }
            .sls-filter-note { grid-column:1 / -1; color:#899a9f; font-size:10px; }
            .sls-actions { grid-column:1 / -1; display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
            .sls-message { padding:7px 9px; color:#a9dff0; border-bottom:1px solid rgba(255,255,255,.08); }
            .sls-error { padding:7px 9px; color:#ffb5b5; border-bottom:1px solid rgba(255,255,255,.08); }
            .sls-summary { display:flex; gap:12px; padding:6px 9px; color:#9caeb4; border-bottom:1px solid rgba(255,255,255,.08); }
            .sls-results { overflow-x:auto; }
            .sls-table { width:100%; border-collapse:collapse; min-width:620px; }
            .sls-table th { position:sticky; top:0; z-index:1; padding:6px; text-align:left; background:#253138; color:#cfe6ed; }
            .sls-table td { padding:6px; border-top:1px solid rgba(255,255,255,.07); vertical-align:top; }
            .sls-table tr:hover td { background:rgba(255,255,255,.035); }
            .sls-player { color:#9bdcff; font-weight:700; text-decoration:none; }
            .sls-muted { color:#91a0a5; font-size:10px; }
            .sls-row-actions { display:flex; gap:4px; }
            .sls-row-actions a { white-space:nowrap; text-decoration:none; }
            .sls-empty { padding:18px; text-align:center; color:#93a1a6; }
            .sls-footer { padding:6px 9px; color:#77878c; border-top:1px solid rgba(255,255,255,.08); font-size:10px; }
            #slink-scout-panel.sls-collapsed { width:54px; height:54px; max-height:none; overflow:visible; border-radius:50%; background:transparent; border-color:rgba(79,213,182,.6); }
            .sls-bubble { position:relative; display:flex; width:100%; height:100%; align-items:center; justify-content:center; border-radius:50%; background:linear-gradient(145deg,#2ca889,#145148); color:#fff; cursor:pointer; font:800 14px/1 Arial,sans-serif; touch-action:none; user-select:none; box-shadow:0 6px 18px rgba(0,0,0,.48),inset 0 0 0 1px rgba(255,255,255,.18); }
            .sls-bubble:hover { background:linear-gradient(145deg,#36bea0,#1a6559); }
            .sls-bubble:focus-visible { outline:2px solid #a9f5e3; outline-offset:3px; }
            #slink-scout-panel.sls-dragging .sls-bubble { cursor:grabbing; }
            .sls-bubble-dot { position:absolute; right:2px; bottom:3px; width:11px; height:11px; border:2px solid #152522; border-radius:50%; background:#60dd89; }
            .sls-bubble-dot.sls-bubble-error { background:#ff7373; }
        `);
    }


    function ensurePanel() {
        let panel = document.getElementById('slink-scout-panel');
        if (panel) return panel;
        panel = document.createElement('section');
        panel.id = 'slink-scout-panel';
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
        } else if (collapsed) {
            panelDragController.applyPosition({
                left: window.innerWidth - 58,
                top: Math.max(4, Math.round((window.innerHeight - 54) * 0.65))
            });
        } else {
            panelDragController.clampToViewport();
        }
    }


    function installBubbleEdgeBehavior(panel) {
        let pointer = null;
        panel.addEventListener('pointerdown', event => {
            if (!GM_getValue(KEYS.collapsed, false) || !event.target.closest('.sls-bubble')) return;
            pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
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
            const position = {
                left: Math.round(rect.left + rect.width / 2 <= window.innerWidth / 2
                    ? margin
                    : window.innerWidth - rect.width - margin),
                top: Math.round(clamp(rect.top, margin, window.innerHeight - rect.height - margin))
            };
            panelDragController?.applyPosition(position);
            GM_setValue(KEYS.bubblePosition, position);
        });
        panel.addEventListener('pointercancel', () => {
            pointer = null;
        });
    }


    function filtersHtml(filters) {
        const apiKey = String(GM_getValue(KEYS.ffKey, '') || '');
        const fairFightDisabled = filters.useFairFight ? '' : 'disabled';
        return `
            <div class="sls-disclosure">
                Local discovery only. Your key is stored in this Tampermonkey script and sent only to FFScouter. This tool does not scrape Torn pages or send candidates to SLINK yet.
            </div>
            <div class="sls-filters">
                <label class="sls-wide">FFScouter-registered API key
                    <input id="sls-ff-key" type="password" value="${escapeHtml(apiKey)}" autocomplete="off">
                </label>
                <label>Minimum level
                    <input id="sls-min-level" type="number" min="1" max="100" value="${filters.minLevel}">
                </label>
                <label>Maximum level
                    <input id="sls-max-level" type="number" min="1" max="100" value="${filters.maxLevel}">
                </label>
                <label>Minimum estimated stats
                    <input id="sls-min-bs" type="text" value="${escapeHtml(filters.minBattleStats)}" placeholder="Blank or 100k">
                </label>
                <label>Maximum estimated stats
                    <input id="sls-max-bs" type="text" value="${escapeHtml(filters.maxBattleStats)}" placeholder="Blank or 10m">
                </label>
                <label>Minimum Fair Fight
                    <input id="sls-min-ff" type="number" min="1" max="3" step=".05" value="${filters.minFairFight}" ${fairFightDisabled}>
                </label>
                <label>Maximum Fair Fight
                    <input id="sls-max-ff" type="number" min="1" max="3" step=".05" value="${filters.maxFairFight}" ${fairFightDisabled}>
                </label>
                <label>Result limit
                    <input id="sls-limit" type="number" min="1" max="50" value="${filters.resultLimit}">
                </label>
                <div></div>
                <div class="sls-checks">
                    <label><input id="sls-random" type="checkbox" ${filters.randomSample ? 'checked' : ''}> Random discovery</label>
                    <label><input id="sls-use-ff" type="checkbox" ${filters.useFairFight ? 'checked' : ''}> Filter by Fair Fight</label>
                    <label><input id="sls-hide-seen" type="checkbox" ${filters.hideSeen ? 'checked' : ''}> Hide locally seen IDs</label>
                    <label><input id="sls-inactive" type="checkbox" ${filters.inactiveOnly ? 'checked' : ''}> Inactive only (14+ days)</label>
                    <label><input id="sls-factionless" type="checkbox" ${filters.factionlessOnly ? 'checked' : ''}> Factionless only</label>
                </div>
                <div class="sls-filter-note">
                    Random discovery is recommended: FFScouter returns a fresh inactive sample, then level, optional FF, seen-ID, and estimated-stat filters are applied locally. Turn it off for FFScouter’s targeted search, which may repeat the same strongest 50 results. Display order is lowest estimated stats first.
                </div>
                <div class="sls-actions">
                    <button class="sls-btn" id="sls-clear-seen">Clear seen history</button>
                    <button class="sls-btn" id="sls-export" ${state.results.length ? '' : 'disabled'}>Export displayed CSV</button>
                    <button class="sls-btn" id="sls-search" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Searching…' : 'Search FFScouter'}</button>
                </div>
            </div>
        `;
    }


    function resultsHtml() {
        if (!state.results.length) {
            return '<div class="sls-empty">No displayed candidates yet.</div>';
        }
        return `
            <div class="sls-results">
                <table class="sls-table">
                    <thead><tr><th>Player</th><th>Level</th><th>Est. stats</th><th>FF</th><th>Last action</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${state.results.map(target => {
                            const profile = `https://www.torn.com/profiles.php?XID=${target.player_id}`;
                            const attack = TornLib.attackLink(target.player_id);
                            return `
                                <tr>
                                    <td><a class="sls-player" href="${escapeHtml(profile)}" target="_blank" rel="noopener noreferrer">${escapeHtml(target.name)} [${target.player_id}]</a><div class="sls-muted">${escapeHtml(target.source)}</div></td>
                                    <td>${target.level || '?'}</td>
                                    <td title="${escapeHtml(String(target.bs_estimate ?? 'Unknown'))}">${escapeHtml(target.bs_estimate_human || shortStats(target.bs_estimate))}</td>
                                    <td>${target.fair_fight === null ? '?' : target.fair_fight.toFixed(2)}</td>
                                    <td>${escapeHtml(formatLastAction(target.last_action))}<div class="sls-muted">${escapeHtml(formatUtc(target.last_action).slice(0, 10))}</div></td>
                                    <td><div class="sls-row-actions"><a class="sls-btn" href="${escapeHtml(attack)}" target="_blank" rel="noopener noreferrer">Attack</a><a class="sls-btn" href="${escapeHtml(profile)}" target="_blank" rel="noopener noreferrer">Profile</a></div></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }


    function render() {
        const panel = ensurePanel();
        const collapsed = Boolean(GM_getValue(KEYS.collapsed, false));
        panel.classList.toggle('sls-collapsed', collapsed);

        if (collapsed) {
            panel.innerHTML = `
                <div class="sls-bubble" id="sls-expand" role="button" tabindex="0" title="Open SLINK Scout" aria-label="Open SLINK Scout">
                    <span>SS</span>
                    <span class="sls-bubble-dot ${state.error ? 'sls-bubble-error' : ''}" aria-hidden="true"></span>
                </div>
            `;
            applySavedPanelPosition(true);
            bindEvents(panel);
            return;
        }

        const filters = loadFilters();
        panel.innerHTML = `
            <div class="sls-head">
                <div class="sls-title">SLINK Scout<div class="sls-sub">FFScouter candidate discovery · v${SCRIPT_VERSION}</div></div>
                <button class="sls-btn" id="sls-collapse" title="Minimize to a movable bubble">−</button>
            </div>
            <div class="sls-body">
                ${filtersHtml(filters)}
                ${state.error ? `<div class="sls-error">${escapeHtml(state.error)}</div>` : ''}
                <div class="sls-message">${escapeHtml(state.message)}</div>
                <div class="sls-summary"><span>Displayed: ${state.results.length}</span><span>Seen locally: ${seenCount()}</span></div>
                ${resultsHtml()}
            </div>
            <div class="sls-footer">One click makes one FFScouter request. No automatic background discovery and no Torn API usage.</div>
        `;
        applySavedPanelPosition(false);
        bindEvents(panel);
    }


    function bindEvents(panel) {
        panel.querySelector('#sls-search')?.addEventListener('click', () => {
            void discover(panel);
        });
        panel.querySelector('#sls-export')?.addEventListener('click', exportCsv);
        panel.querySelector('#sls-clear-seen')?.addEventListener('click', () => {
            saveJson(KEYS.seen, {});
            state.message = 'Local seen-ID history cleared.';
            state.error = '';
            render();
        });
        panel.querySelector('#sls-use-ff')?.addEventListener('change', event => {
            const disabled = !event.currentTarget.checked;
            const minimum = panel.querySelector('#sls-min-ff');
            const maximum = panel.querySelector('#sls-max-ff');
            if (minimum) minimum.disabled = disabled;
            if (maximum) maximum.disabled = disabled;
        });
        panel.querySelector('#sls-collapse')?.addEventListener('click', () => {
            GM_setValue(KEYS.collapsed, true);
            render();
        });
        panel.querySelector('#sls-expand')?.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            GM_setValue(KEYS.collapsed, false);
            render();
        });
    }


    function start() {
        installStyles();
        const panel = ensurePanel();
        panelDragController = TornLib.makePanelDraggable(panel, {
            handle: panel,
            storageKey: KEYS.panelPosition,
            ignoreSelector: 'button, input, select, textarea, a, .sls-body, [data-no-drag]',
            draggingClass: 'sls-dragging',
            setValue: (_key, position) => {
                GM_setValue(
                    GM_getValue(KEYS.collapsed, false)
                        ? KEYS.bubblePosition
                        : KEYS.panelPosition,
                    position
                );
            },
            margin: 4
        });
        installBubbleEdgeBehavior(panel);
        render();
    }

    start();
})();
