// ==UserScript==
// @name         Considious Torn Ranked War Target Panel
// @namespace    Considious [3853023]
// @version      0.9.29
// @description  Right-side ranked-war target panel using TWSE shared data with a Torn API fallback.
// @author       Considious [3853023]
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Ranked-War-Target-Panel/Torn_Ranked_War_Target_Panel.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Ranked-War-Target-Panel/Torn_Ranked_War_Target_Panel.user.js
// @match        https://www.torn.com/*
// @connect      api.torn.com
// @connect      twse.dev
// @connect      ffscouter.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/main/shared/Considious_Torn_Lib.js?v=1.3.3
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const TornLib = globalThis.ConsidiousTornLib;
    if (!TornLib) throw new Error('Considious Torn Library failed to load.');

    const PREFIX = 'rw-target-panel:';
    const REFRESH_MS = 10000;
    const WAR_REFRESH_MS = 12 * 60 * 60 * 1000;
    const NETWORK_REFRESH_MS = 60 * 1000;
    const FF_REFRESH_MS = 6 * 60 * 60 * 1000;
    const PERSONAL_ATTACK_REFRESH_MS = 5000;
    const CHAIN_DOM_REFRESH_MS = 1000;
    const CHAIN_API_REFRESH_MS = 60000;
    const WAR_REPORT_REFRESH_MS = 10000;
    const CHAIN_REPORT_REFRESH_MS = 10000;
    const TURTLE_STATUS_REFRESH_MS = 60 * 1000;
    const TWSE_STALE_MS = 5 * 60 * 1000;
    const TWSE_CACHE_PREFIX = 'xentac-torn_war_stuff_enhanced-status-';

    const defaults = {
        apiKey: '',
        ffApiKey: '',
        mode: 'termed',
        idleCutoff: 5,
        minFF: '',
        maxFF: '',
        showUnknownFF: true,
        hideAbroad: false,
        hideJail: false,
        chainAlertEnabled: true,
        turtleTimerEnabled: true,
        turtleReminderMinutes: 5,
        corner: 'top-right',
        targetsCollapsed: false,
        bubbleMode: false,
        collapsed: false,
        panelPosition: null,
        panelSize: { width: 240, height: null },
        panelTop: 90,
        panelBottom: 20
    };

    let settings = loadSettings();
    let apiLease = null;
    let opponent = null;
    let members = [];
    let ffById = {};
    let lastWarCheck = 0;
    let lastNetworkCheck = 0;
    let lastFFCheck = 0;
    let lastDataTimestamp = 0;
    let lastPersonalAttackCheck = 0;
    let lastChainApiCheck = 0;
    let lastWarReportCheck = 0;
    let lastChainReportCheck = 0;
    let ownUserId = '';
    let ownFactionId = '';
    let personalStats = {
        totalAttacks: 0,
        warAttacks: 0,
        updatedAt: 0,
        error: ''
    };
    let chainState = {
        id: '',
        current: 0,
        target: 0,
        timeLeft: '',
        secondsLeft: null,
        href: 'https://www.torn.com/factions.php?step=your#/war/chain',
        apiError: '',
        source: 'Waiting'
    };
    let refreshTimer = null;
    let personalAttackTimer = null;
    let chainTimer = null;
    let turtleStatusTimer = null;
    let panel = null;
    let panelDragController = null;
    let panelResizeController = null;
    let statusText = 'Starting…';
    let chainAlertAudioContext = null;
    let lastChainAlarmAt = 0;
    let chainAlarmSequenceActive = false;
    let lastTurtleStatusCheck = 0;
    let turtleAudioContext = null;
    let turtleAlarmInterval = null;
    let turtleHospitalUntil = 0;
    let turtleAlarmForUntil = 0;
    let turtleAcknowledgedUntil = 0;
    let turtleStatusError = '';
    let pendingChatSend = null;
    let pendingChatSendTimer = null;
    const CHAT_COPY_AUTHORIZATION_MS = 30 * 1000;

    function readSavedOpponent() {
        try {
            const raw = localStorage.getItem(PREFIX + 'opponent');
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            return parsed?.id ? parsed : null;
        } catch {
            return null;
        }
    }

    function saveOpponent(value) {
        if (!value?.id) return;
        localStorage.setItem(PREFIX + 'opponent', JSON.stringify(value));
    }

    function loadSettings() {
        return TornLib.readJsonStorage(PREFIX + 'settings', defaults, { merge: true });
    }

    function saveSettings() {
        TornLib.writeJsonStorage(PREFIX + 'settings', settings);
    }

    function gmRequest(url, options = {}) {
        if (!runtimeShouldRun()) {
            const error = new Error('Ranked War Panel API work is paused because another Torn tab owns polling or the panel is in bubble mode.');
            error.runtimePaused = true;
            return Promise.reject(error);
        }
        return TornLib.requestJson(url, {
            ...options,
            timeout: options.timeout || 15000,
            tornScript: options.tornScript || 'Ranked War Panel',
            invalidJsonMessage: 'Invalid JSON response',
            networkErrorMessage: 'Network request failed',
            timeoutMessage: 'Request timed out',
        });
    }

    function normalizeMembers(payload) {
        const source =
            payload?.members ??
            payload?.data?.members ??
            payload?.torn_response?.members ??
            payload?.payload?.torn_response?.members ??
            payload?.latest?.torn_response?.members ??
            {};

        if (Array.isArray(source)) {
            return source.map(normalizeMember).filter(Boolean);
        }

        return Object.entries(source).map(([id, member]) =>
            normalizeMember({ id, ...member })
        ).filter(Boolean);
    }

    function normalizeMember(raw) {
        const id = String(raw?.id ?? raw?.player_id ?? raw?.user_id ?? raw?.userID ?? '');
        if (!id) return null;

        const lastAction = raw.last_action ?? raw.lastAction ?? {};
        const status = raw.status ?? {};
        const name = raw.name ?? raw.player_name ?? `Player ${id}`;

        const activity =
            normalizeActivity(lastAction.status) ||
            normalizeActivity(raw.activity) ||
            normalizeActivity(raw.online_status) ||
            'Unknown';

        const lastActionTimestamp = Number(
            lastAction.timestamp ??
            raw.last_action_timestamp ??
            raw.lastActionTimestamp ??
            0
        );

        return {
            id,
            name,
            level: raw.level ?? null,
            activity,
            lastActionTimestamp,
            lastActionRelative: lastAction.relative ?? raw.last_action_relative ?? '',
            statusState: status.state ?? raw.status_state ?? raw.state ?? 'Unknown',
            statusDescription: status.description ?? raw.status_description ?? '',
            statusUntil: Number(status.until ?? raw.status_until ?? 0),
            raw
        };
    }

    function normalizeActivity(value) {
        const text = String(value || '').toLowerCase();
        if (text.includes('online')) return 'Online';
        if (text.includes('idle') || text.includes('away')) return 'Idle';
        if (text.includes('offline')) return 'Offline';
        return '';
    }

    function findNumericField(value, names, depth = 0) {
        if (!value || typeof value !== 'object' || depth > 6) return '';

        for (const name of names) {
            const candidate = value[name];
            if (candidate !== undefined && candidate !== null && /^\d+$/.test(String(candidate))) {
                return String(candidate);
            }
        }

        for (const child of Object.values(value)) {
            if (!child || typeof child !== 'object') continue;
            const found = findNumericField(child, names, depth + 1);
            if (found) return found;
        }

        return '';
    }

    function normalizeWarFactionEntries(factions) {
        if (Array.isArray(factions)) {
            return factions
                .map(faction => {
                    const id = String(
                        faction?.id ??
                        faction?.faction_id ??
                        faction?.faction?.id ??
                        ''
                    );
                    return id ? [id, faction] : null;
                })
                .filter(Boolean);
        }

        if (!factions || typeof factions !== 'object') return [];

        return Object.entries(factions)
            .map(([key, faction]) => {
                const id = String(
                    faction?.id ??
                    faction?.faction_id ??
                    faction?.faction?.id ??
                    (/^\d+$/.test(key) ? key : '')
                );
                return id ? [id, faction] : null;
            })
            .filter(Boolean);
    }

    async function getCurrentOpponent() {
        if (!settings.apiKey || settings.apiKey.length !== 16) {
            throw new Error('Enter a 16-character Torn API key in panel settings.');
        }

        const url =
            `https://api.torn.com/faction/?selections=rankedwars&key=${encodeURIComponent(settings.apiKey)}` +
            `&comment=RankedWarTargetPanel`;

        const data = await gmRequest(url);
        if (data?.error) {
            throw new Error(data.error.error || 'Torn API error');
        }

        const wars = data?.rankedwars ?? data?.ranked_wars ?? {};
        const entries = Array.isArray(wars)
            ? wars.map(war => [String(war?.id ?? war?.ranked_war_id ?? ''), war])
            : Object.entries(wars);

        const now = Math.floor(Date.now() / 1000);

        const activeEntry = entries.find(([, war]) => {
            const start = Number(war?.war?.start ?? war?.start ?? 0);
            const end = Number(war?.war?.end ?? war?.end ?? 0);
            const target = Number(war?.war?.target ?? war?.target ?? 0);
            return start > 0 && start <= now && (!end || end > now) && !target;
        }) || entries.find(([, war]) => {
            const start = Number(war?.war?.start ?? war?.start ?? 0);
            const end = Number(war?.war?.end ?? war?.end ?? 0);
            return start > 0 && start <= now && (!end || end > now);
        });

        if (!activeEntry) {
            throw new Error('No active ranked war was found.');
        }

        const [entryId, active] = activeEntry;
        const factions = active.factions ?? active?.war?.factions ?? {};
        const factionEntries = normalizeWarFactionEntries(factions);

        try {
            const [basic, factionInfo] = await Promise.all([
                gmRequest(
                    `https://api.torn.com/v2/user/basic?key=${encodeURIComponent(settings.apiKey)}` +
                    `&comment=RankedWarTargetPanel`
                ),
                gmRequest(
                    `https://api.torn.com/v2/user/faction?key=${encodeURIComponent(settings.apiKey)}` +
                    `&comment=RankedWarTargetPanel`
                )
            ]);

            ownUserId = findNumericField(basic, [
                'id',
                'player_id',
                'user_id'
            ]) || ownUserId;

            ownFactionId = findNumericField(factionInfo, [
                'faction_id',
                'id'
            ]) || ownFactionId;
        } catch (error) {
            if (error?.runtimePaused) throw error;
            try {
                const profile = await gmRequest(
                    `https://api.torn.com/user/?selections=profile&key=${encodeURIComponent(settings.apiKey)}` +
                    `&comment=RankedWarTargetPanel`
                );

                ownUserId = String(profile?.player_id ?? profile?.profile?.player_id ?? ownUserId);
                ownFactionId = String(
                    profile?.faction?.faction_id ??
                    profile?.faction?.id ??
                    profile?.profile?.faction?.faction_id ??
                    ownFactionId
                );
            } catch (fallbackError) {
                if (fallbackError?.runtimePaused) throw fallbackError;
                // Saved IDs and faction metadata can still identify the opponent.
            }
        }

        if (ownFactionId) {
            localStorage.setItem(PREFIX + 'ownFactionId', ownFactionId);
        }

        let opponentEntry = factionEntries.find(([id]) =>
            ownFactionId && String(id) !== ownFactionId
        );

        if (!opponentEntry) {
            opponentEntry = factionEntries.find(([, faction]) =>
                faction?.is_enlisted === false ||
                faction?.is_user_faction === false
            );
        }

        if (!opponentEntry && factionEntries.length === 2) {
            const learnedOwn =
                ownFactionId ||
                localStorage.getItem(PREFIX + 'ownFactionId');

            if (learnedOwn) {
                opponentEntry = factionEntries.find(([id]) => String(id) !== String(learnedOwn));
            }
        }

        if (!opponentEntry && factionEntries.length === 2 && opponent?.id) {
            opponentEntry = factionEntries.find(([id]) => String(id) === String(opponent.id));
        }

        if (!opponentEntry) {
            throw new Error(
                `War found, but the opponent faction could not be identified ` +
                `(found ${factionEntries.length} faction entr${factionEntries.length === 1 ? 'y' : 'ies'}).`
            );
        }

        const [id, info] = opponentEntry;
        return {
            id: String(id),
            name: info?.name ?? `Faction ${id}`,
            warId: String(
                active?.id ??
                active?.ranked_war_id ??
                active?.war?.id ??
                entryId ??
                ''
            ),
            start: Number(active?.war?.start ?? active?.start ?? 0),
            end: Number(active?.war?.end ?? active?.end ?? 0)
        };
    }

    function isActivePage() {
        return TornLib.isPageActive();
    }

    function runtimeShouldRun() {
        return !settings.bubbleMode && Boolean(apiLease?.isLeader());
    }

    function isVisibleRankedWarPage() {
        if (!isActivePage() || !location.href.includes('factions.php')) return false;

        const route = `${location.pathname}${location.search}${location.hash}`.toLowerCase();
        if (/(ranked|rankedwar|ranked-war|\/war\/rank)/.test(route)) return true;

        const mainText = (
            document.querySelector('#mainContainer, main, [role="main"]')?.textContent ||
            ''
        ).slice(0, 5000);

        return /ranked\s*war/i.test(mainText);
    }

    function scanVisibleRankedWarOpponent() {
        if (!isVisibleRankedWarPage()) return null;

        const learnedOwn = String(
            ownFactionId ||
            localStorage.getItem(PREFIX + 'ownFactionId') ||
            ''
        );

        const roots = [
            ...document.querySelectorAll(
                '[class*="ranked"][class*="war"], [class*="rankWar"], [class*="war"][class*="header"], #mainContainer, main, [role="main"]'
            )
        ];
        const searchRoots = roots.length ? roots : [document];

        const candidates = new Map();

        for (const root of searchRoots) {
            const links = root.querySelectorAll(
                'a[href*="factions.php"][href*="ID="], a[href*="/factions.php"][href*="ID="]'
            );

            for (const link of links) {
                const id = link.href.match(/[?&]ID=(\d+)/i)?.[1];
                if (!id || id === learnedOwn) continue;

                const rawName = (
                    link.textContent ||
                    link.getAttribute('aria-label') ||
                    link.getAttribute('title') ||
                    ''
                ).replace(/\s+/g, ' ').trim();

                const current = candidates.get(id) || {
                    id,
                    name: '',
                    count: 0
                };

                current.count += 1;

                if (
                    rawName &&
                    rawName.length <= 80 &&
                    !/^(profile|faction|view)$/i.test(rawName)
                ) {
                    current.name = rawName;
                }

                candidates.set(id, current);
            }
        }

        const ranked = [...candidates.values()]
            .sort((a, b) => b.count - a.count);

        localStorage.setItem(
            PREFIX + 'visibleWarFactionIds',
            JSON.stringify(ranked.map(item => item.id))
        );

        if (!ranked.length) return null;

        // Do not guess when the page exposes several unrelated faction links.
        if (
            ranked.length > 1 &&
            ranked[0].count < ranked[1].count * 2
        ) {
            return null;
        }

        const found = ranked[0];
        return {
            id: String(found.id),
            name: found.name || `Faction ${found.id}`,
            warId: '',
            start: 0,
            end: 0,
            source: 'Visible Ranked War page'
        };
    }

    function switchOpponent(nextOpponent, source = 'Ranked war') {
        if (!nextOpponent?.id) return false;

        const changed =
            !opponent ||
            String(opponent.id) !== String(nextOpponent.id) ||
            (
                nextOpponent.warId &&
                opponent.warId &&
                String(opponent.warId) !== String(nextOpponent.warId)
            );

        opponent = {
            ...opponent,
            ...nextOpponent,
            id: String(nextOpponent.id)
        };
        saveOpponent(opponent);

        if (!changed) return false;

        members = [];
        ffById = {};
        lastDataTimestamp = 0;
        lastNetworkCheck = 0;
        lastFFCheck = 0;
        pendingChatSend = null;

        statusText = `${source}: loading ${opponent.name}…`;
        render();
        return true;
    }

    function learnFactionIdsFromVisibleWarPage() {
        return scanVisibleRankedWarOpponent();
    }

    function readTwseLocalCache(factionId) {
        try {
            const raw = localStorage.getItem(`${TWSE_CACHE_PREFIX}${factionId}`);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.members || typeof parsed.timestamp !== 'number') {
                return null;
            }

            const cachedMembers = normalizeMembers({ members: parsed.members });
            if (!cachedMembers.length) return null;

            return {
                members: cachedMembers,
                timestamp: parsed.timestamp,
                source: 'Existing TWSE cache'
            };
        } catch (error) {
            console.warn('[RW Target Panel] Could not read TWSE local cache:', error);
            return null;
        }
    }

    function readPanelCache(factionId) {
        try {
            const raw = localStorage.getItem(`${PREFIX}faction-cache:${factionId}`);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.members) || typeof parsed.timestamp !== 'number') {
                return null;
            }

            return {
                members: parsed.members,
                ffById: parsed.ffById || {},
                timestamp: parsed.timestamp,
                source: 'Saved panel cache'
            };
        } catch (error) {
            console.warn('[RW Target Panel] Could not read saved panel cache:', error);
            return null;
        }
    }

    function savePanelCache(factionId, cachedMembers, cachedFF = ffById) {
        try {
            localStorage.setItem(
                `${PREFIX}faction-cache:${factionId}`,
                JSON.stringify({
                    timestamp: Date.now(),
                    members: cachedMembers,
                    ffById: cachedFF
                })
            );
        } catch (error) {
            console.warn('[RW Target Panel] Could not save panel cache:', error);
        }
    }

    function useNewestLocalCache(factionId) {
        const candidates = [
            readTwseLocalCache(factionId),
            readPanelCache(factionId)
        ].filter(Boolean);

        if (!candidates.length) return null;

        candidates.sort((a, b) => b.timestamp - a.timestamp);
        return candidates[0];
    }

    async function fetchSharedMembers(factionId) {
        const url = `https://twse.dev/faction/${encodeURIComponent(factionId)}`;

        try {
            const payload = await gmRequest(url);
            const sharedMembers = normalizeMembers(payload);

            if (!sharedMembers.length) {
                throw new Error('TWSE returned no members');
            }

            const timestamp = Number(payload?.timestamp ?? payload?.updated_at ?? Date.now());

            return {
                members: sharedMembers,
                source: 'TWSE shared data',
                sharedAvailable: true,
                timestamp: Number.isFinite(timestamp) ? timestamp : Date.now()
            };
        } catch (error) {
            const cached = useNewestLocalCache(factionId);

            if (cached?.members?.length) {
                return {
                    members: cached.members,
                    source: error.status === 404
                        ? 'Cached TWSE data — server returned 404'
                        : 'Cached TWSE data — shared feed unavailable',
                    sharedAvailable: false,
                    cachedTimestamp: cached.timestamp,
                    timestamp: cached.timestamp
                };
            }

            if (error.status !== 404) {
                console.warn('[RW Target Panel] TWSE request failed:', error);
            }

            throw new Error(
                'No TWSE data is available yet. Open the Ranked War page while Torn is focused to refresh it.'
            );
        }
    }

    async function fetchOfficialFactionMembers_UNUSED(factionId) {
        if (!settings.apiKey || settings.apiKey.length !== 16) {
            throw new Error('TWSE has no cached data and a Torn API key is required for fallback.');
        }

        const url =
            `https://api.torn.com/v2/faction?` +
            `id=${encodeURIComponent(factionId)}` +
            `&selections=members,timestamp` +
            `&key=${encodeURIComponent(settings.apiKey)}` +
            `&comment=RankedWarTargetPanel`;

        const payload = await gmRequest(url);

        if (payload?.error) {
            throw new Error(payload.error.error || 'Torn faction API error');
        }

        return normalizeMembers(payload);
    }

    async function fetchFFData(targetMembers) {
        if (!settings.ffApiKey || targetMembers.length === 0) return {};

        const ids = targetMembers.map(member => member.id);
        const output = {};

        for (let index = 0; index < ids.length; index += 100) {
            const batch = ids.slice(index, index + 100);
            const url =
                `https://ffscouter.com/api/v1/get-stats?key=${encodeURIComponent(settings.ffApiKey)}` +
                `&targets=${batch.join(',')}`;

            try {
                const result = await gmRequest(url);
                const rows = Array.isArray(result) ? result : result?.data ?? result?.results ?? [];
                for (const row of rows) {
                    const id = String(row.player_id ?? row.id ?? row.user_id ?? '');
                    if (!id) continue;
                    output[id] = extractFF(row);
                }
            } catch (error) {
                console.warn('[RW Target Panel] FFScouter request failed:', error);
            }
        }

        return output;
    }

    function extractFF(row) {
        const candidates = [
            row.fair_fight,
            row.fairFight,
            row.ff,
            row.ff_score,
            row.score,
            row?.estimate?.fair_fight
        ];

        for (const candidate of candidates) {
            const value = Number(candidate);
            if (Number.isFinite(value)) return value;
        }

        return null;
    }

    function minutesSince(timestamp) {
        if (!timestamp) return Infinity;
        return Math.max(0, (Date.now() / 1000 - timestamp) / 60);
    }

    function isTermedEligible(member) {
        if (member.activity === 'Online') return false;
        if (member.activity === 'Offline') return true;

        if (member.activity === 'Idle') {
            if (Number(settings.idleCutoff) <= 0) return true;
            return minutesSince(member.lastActionTimestamp) >= Number(settings.idleCutoff);
        }

        return false;
    }

    function matchesFF(member) {
        const ff = ffById[member.id];
        const min = settings.minFF === '' ? null : Number(settings.minFF);
        const max = settings.maxFF === '' ? null : Number(settings.maxFF);

        if (ff == null || !Number.isFinite(ff)) {
            return settings.showUnknownFF;
        }

        if (min != null && Number.isFinite(min) && ff < min) return false;
        if (max != null && Number.isFinite(max) && ff > max) return false;
        return true;
    }

    function isAbroad(member) {
        const state = String(member.statusState || '').toLowerCase();
        const description = String(member.statusDescription || '').toLowerCase();

        return (
            state.includes('travel') ||
            state.includes('abroad') ||
            description.includes('traveling') ||
            description.includes('travelling') ||
            description.includes('abroad') ||
            description.includes('returning to')
        );
    }

    function isJailed(member) {
        const state = String(member.statusState || '').toLowerCase();
        const description = String(member.statusDescription || '').toLowerCase();

        return (
            state.includes('jail') ||
            description.includes('jail')
        );
    }

    function isHospitalized(member) {
        return String(member.statusState || '').toLowerCase().includes('hospital');
    }

    function hospitalSecondsRemaining(member) {
        if (!isHospitalized(member) || !member.statusUntil) return Infinity;
        return Math.max(0, member.statusUntil - Math.floor(Date.now() / 1000));
    }

    function getVisibleMembers() {
        return members
            .filter(member => settings.mode !== 'termed' || isTermedEligible(member))
            .filter(member => !settings.hideAbroad || !isAbroad(member))
            .filter(member => !settings.hideJail || !isJailed(member))
            .filter(matchesFF)
            .sort((a, b) => {
                const aHospitalized = isHospitalized(a);
                const bHospitalized = isHospitalized(b);

                // Available targets always come first.
                if (aHospitalized !== bHospitalized) {
                    return aHospitalized ? 1 : -1;
                }

                // Among hospitalized targets, shortest remaining hospital time comes first.
                if (aHospitalized && bHospitalized) {
                    const hospitalDifference =
                        hospitalSecondsRemaining(a) - hospitalSecondsRemaining(b);
                    if (hospitalDifference) return hospitalDifference;
                }

                const order = { Online: 0, Idle: 1, Offline: 2, Unknown: 3 };
                const activityDifference =
                    (order[a.activity] ?? 4) - (order[b.activity] ?? 4);
                if (activityDifference) return activityDifference;

                const aff = ffById[a.id];
                const bff = ffById[b.id];
                if (Number.isFinite(aff) && Number.isFinite(bff)) return aff - bff;

                return a.name.localeCompare(b.name);
            });
    }

    function shouldHospitalize(member) {
        return settings.mode === 'non-termed' && member.activity === 'Online';
    }

    function formatHospital(member) {
        if (member.statusState !== 'Hospital' || !member.statusUntil) return '';
        const remaining = member.statusUntil - Math.floor(Date.now() / 1000);
        if (remaining <= 0) return '';

        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        return `${hours ? `${hours}h ` : ''}${minutes}m ${seconds}s`;
    }

    function formatTornCityTime(unixSeconds) {
        if (!Number.isFinite(Number(unixSeconds))) return '';

        return new Date(Number(unixSeconds) * 1000).toLocaleTimeString('en-GB', {
            timeZone: 'UTC',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function statusEmoji(member) {
        if (member.activity === 'Online') return '🟢 ';
        if (member.activity === 'Idle') return '🟡 ';
        if (member.activity === 'Offline') return '⚪ ';
        return '';
    }

    function buildCopyText(member) {
        const profile = `https://www.torn.com/profiles.php?XID=${member.id}`;
        const attack = `https://www.torn.com/loader2.php?sid=getInAttack&user2ID=${member.id}`;
        const linkedName = `<a href="${profile}">${escapeHtml(member.name)} [${member.id}]</a>`;
        const details = [`<a href="${attack}">Attack</a>`];

        const hospital = formatHospital(member);
        if (hospital) {
            const readyAt = formatTornCityTime(member.statusUntil);
            details.push(
                `In hospital for ${hospital}${readyAt ? ` - Ready at ${readyAt} TCT` : ''}`
            );
        }

        const ff = ffById[member.id];
        if (Number.isFinite(ff)) details.push(`FF: ${ff.toFixed(2)}`);

        details.push(`Activity: ${member.activity}${member.lastActionRelative ? ` (${escapeHtml(member.lastActionRelative)})` : ''}`);

        let message = `${statusEmoji(member)}${linkedName} - ${details.join(' - ')}`;

        if (shouldHospitalize(member)) {
            message = `🚨 PLEASE HOSPITALIZE — PLAYER IS ONLINE 🚨<br>${message}`;
        }

        return message;
    }

    function clearPendingChatSend() {
        pendingChatSend = null;

        if (pendingChatSendTimer) {
            clearTimeout(pendingChatSendTimer);
            pendingChatSendTimer = null;
        }

        updateChatSendButtons();
    }

    function updateChatSendButtons() {
        const now = Date.now();

        if (pendingChatSend && pendingChatSend.expiresAt <= now) {
            pendingChatSend = null;
        }

        document.querySelectorAll('.rw-chat-send').forEach(button => {
            const targetId = String(button.dataset.targetId || '');
            const authorized = Boolean(
                pendingChatSend &&
                pendingChatSend.memberId === targetId &&
                pendingChatSend.expiresAt > now
            );

            button.disabled = !authorized;
            button.classList.toggle('rw-chat-authorized', authorized);
            button.title = authorized
                ? 'Send the copied callout to Faction Chat'
                : 'Press Copy first. Send remains available for 30 seconds.';
        });
    }

    function authorizeChatSend(member, frozenMessage) {
        if (pendingChatSendTimer) {
            clearTimeout(pendingChatSendTimer);
        }

        pendingChatSend = {
            memberId: String(member.id),
            message: frozenMessage,
            expiresAt: Date.now() + CHAT_COPY_AUTHORIZATION_MS
        };

        pendingChatSendTimer = setTimeout(() => {
            pendingChatSendTimer = null;
            clearPendingChatSend();
        }, CHAT_COPY_AUTHORIZATION_MS);

        updateChatSendButtons();
    }

    async function copyMember(member, button) {
        const text = buildCopyText(member);
        await TornLib.copyText(text);
        authorizeChatSend(member, text);
        const original = button.textContent;
        button.textContent = '✓';
        setTimeout(() => button.textContent = original, 1000);
    }

    function findFactionChatContainer() {
        // Torn currently identifies an open faction chat window with an ID such
        // as "faction-46978". Prefer that stable semantic identifier instead of
        // relying on the hashed CSS class names.
        const factionWindows = [
            ...document.querySelectorAll('[id^="faction-"]')
        ];

        const exactWindow = factionWindows.find(node =>
            node.querySelector(
                'textarea[placeholder="Type your message here..."], textarea[class*="textarea"]'
            )
        );

        if (exactWindow) return exactWindow;

        // Compatibility fallback for older/newer chat layouts.
        return [...document.querySelectorAll('div, section')].find(node => {
            const title = node.querySelector('button span, header span');
            const composer = node.querySelector(
                'textarea[placeholder*="message" i], [contenteditable="true"]'
            );

            return composer &&
                String(title?.textContent || '').trim().toLowerCase() === 'faction';
        }) || null;
    }

    function findFactionChatLauncher() {
        return [...document.querySelectorAll('button, a, [role="button"]')].find(node => {
            const label = [
                node.getAttribute?.('aria-label'),
                node.getAttribute?.('title'),
                node.textContent
            ].filter(Boolean).join(' ').trim().toLowerCase();

            return label === 'faction' ||
                label.includes('faction chat') ||
                label.includes('open faction');
        }) || null;
    }

    function findFactionChatComposer(container) {
        if (!container) return null;

        return container.querySelector(
            'textarea[placeholder="Type your message here..."], ' +
            'textarea[class*="textarea"], ' +
            'textarea, ' +
            '[contenteditable="true"]'
        );
    }

    function setChatComposerContent(composer, html) {
        composer.focus();

        if (composer.matches('textarea, input')) {
            const prototype = composer.tagName === 'TEXTAREA'
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

            if (setter) setter.call(composer, html);
            else composer.value = html;
        } else {
            composer.innerHTML = '';
            try {
                document.execCommand('insertHTML', false, html);
            } catch {
                composer.innerHTML = html;
            }
        }

        // Torn's React-controlled textarea needs a real bubbling input event
        // before its send button changes from disabled to enabled.
        try {
            composer.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                composed: true,
                inputType: 'insertText',
                data: html
            }));
        } catch {
            composer.dispatchEvent(new Event('input', {
                bubbles: true,
                composed: true
            }));
        }

        composer.dispatchEvent(new Event('change', {
            bubbles: true,
            composed: true
        }));
    }

    function findChatSendButton(container, composer) {
        // In the supplied Torn markup, the send button is the button immediately
        // beside the textarea inside the same composer row.
        const composerRow = composer?.parentElement;
        const siblingButton = composerRow?.querySelector('button');

        if (siblingButton) return siblingButton;

        const scope = container || composer?.closest('[id^="faction-"]') || document;
        const buttons = [...scope.querySelectorAll('button, [role="button"]')];

        return buttons.find(button => {
            const label = [
                button.getAttribute('aria-label'),
                button.getAttribute('title'),
                button.textContent
            ].filter(Boolean).join(' ').trim().toLowerCase();

            const containsSendIcon = Boolean(
                button.querySelector('svg[viewBox="0 0 18 18"]')
            );

            return button.type === 'submit' ||
                label === 'send' ||
                label.includes('send message') ||
                containsSendIcon;
        }) || null;
    }

    async function waitForFactionChat(timeoutMs = 2500) {
        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            const container = findFactionChatContainer();
            const composer = findFactionChatComposer(container);

            if (container && composer) {
                return { container, composer };
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return { container: null, composer: null };
    }

    async function waitForEnabledButton(button, timeoutMs = 1500) {
        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, 50));
        }

        return false;
    }

    async function sendMemberToFactionChat(member, button) {
        const memberId = String(member.id);
        const authorization = pendingChatSend;

        if (
            !authorization ||
            authorization.memberId !== memberId ||
            authorization.expiresAt <= Date.now()
        ) {
            clearPendingChatSend();
            alert('Press Copy for this target first. Send is enabled for 30 seconds after Copy.');
            return;
        }

        if (!isActivePage()) {
            alert('Open and focus the Torn tab before sending to Faction Chat.');
            return;
        }

        // Use only the frozen message created by the separate Copy click.
        const frozenMessage = authorization.message;
        const original = button.textContent;
        button.disabled = true;
        button.textContent = '…';

        try {
            let { container, composer } = await waitForFactionChat(250);

            if (!container || !composer) {
                const launcher = findFactionChatLauncher();
                if (!launcher) {
                    throw new Error(
                        'Faction Chat could not be found. Open Faction Chat and try again.'
                    );
                }

                launcher.click();
                ({ container, composer } = await waitForFactionChat());
            }

            if (!container || !composer) {
                throw new Error(
                    'Faction Chat opened, but its message box could not be found.'
                );
            }

            setChatComposerContent(composer, frozenMessage);

            const sendButton = findChatSendButton(container, composer);
            if (!sendButton) {
                throw new Error('The Faction Chat send button could not be found.');
            }

            const enabled = await waitForEnabledButton(sendButton);
            if (!enabled) {
                throw new Error(
                    'The message was placed in Faction Chat, but Torn did not enable the Send button.'
                );
            }

            sendButton.click();
            button.textContent = '✓';

            // One Copy authorizes exactly one Send.
            clearPendingChatSend();
        } catch (error) {
            console.warn('[RW Target Panel] Faction Chat send failed:', error);
            alert(error.message);
            button.textContent = '!';

            // Keep the authorization until its original expiration so the user
            // can retry after opening/focusing Faction Chat.
            updateChatSendButtons();
        } finally {
            setTimeout(() => {
                button.textContent = original;
                updateChatSendButtons();
            }, 1200);
        }
    }

    function escapeHtml(value) {
        return TornLib.escapeHtml(value);
    }

    function extractAttackRows(payload) {
        const source =
            payload?.attacks ??
            payload?.attacksfull ??
            payload?.data?.attacks ??
            payload?.data?.attacksfull ??
            payload?.data ??
            [];

        if (Array.isArray(source)) return source;
        if (source && typeof source === 'object') return Object.values(source);
        return [];
    }

    function attackTimestamp(attack) {
        return Number(
            attack?.ended ??
            attack?.timestamp_ended ??
            attack?.timestamp ??
            attack?.started ??
            attack?.timestamp_started ??
            0
        );
    }

    function isOutgoingAttack(attack) {
        const direction = String(
            attack?.direction ??
            attack?.type ??
            attack?.attack_type ??
            ''
        ).toLowerCase();

        if (direction) return direction.includes('outgoing');

        const attackerId = String(
            attack?.attacker?.id ??
            attack?.attacker_id ??
            attack?.attackerID ??
            ''
        );

        return !ownUserId || attackerId === ownUserId;
    }

    function isRankedWarAttack(attack) {
        if (
            attack?.is_ranked_war === true ||
            attack?.ranked_war === true ||
            attack?.isRankedWar === true
        ) {
            return true;
        }

        const warModifier = Number(
            attack?.modifiers?.war ??
            attack?.modifiers?.ranked_war ??
            attack?.war ??
            0
        );

        if (warModifier > 1) return true;

        const targetFactionId = String(
            attack?.defender?.faction_id ??
            attack?.defender?.faction?.id ??
            attack?.defender_faction ??
            attack?.defender_faction_id ??
            ''
        );

        const respect = Number(
            attack?.respect_gain ??
            attack?.respect ??
            attack?.respect_gained ??
            0
        );

        return Boolean(
            opponent?.id &&
            targetFactionId === String(opponent.id) &&
            respect > 0
        );
    }

    function findOwnMemberRecord(value, depth = 0) {
        if (!value || depth > 8) return null;

        if (Array.isArray(value)) {
            for (const item of value) {
                const match = findOwnMemberRecord(item, depth + 1);
                if (match) return match;
            }
            return null;
        }

        if (typeof value !== 'object') return null;

        const candidateId = String(
            value?.id ??
            value?.user_id ??
            value?.player_id ??
            value?.member_id ??
            value?.user?.id ??
            value?.player?.id ??
            ''
        );

        if (ownUserId && candidateId === String(ownUserId)) {
            return value;
        }

        if (ownUserId && Object.prototype.hasOwnProperty.call(value, ownUserId)) {
            const keyed = value[ownUserId];
            if (keyed && typeof keyed === 'object') return keyed;
        }

        for (const child of Object.values(value)) {
            const match = findOwnMemberRecord(child, depth + 1);
            if (match) return match;
        }

        return null;
    }

    function extractCount(record, names) {
        if (!record || typeof record !== 'object') return null;

        for (const name of names) {
            const value = Number(record[name]);
            if (Number.isFinite(value)) return value;
        }

        for (const child of Object.values(record)) {
            if (!child || typeof child !== 'object' || Array.isArray(child)) continue;
            for (const name of names) {
                const value = Number(child[name]);
                if (Number.isFinite(value)) return value;
            }
        }

        return null;
    }

    function getActorId(record, role) {
        const roleObject = record?.[role];
        return String(
            roleObject?.id ??
            roleObject?.user_id ??
            roleObject?.player_id ??
            record?.[`${role}_id`] ??
            record?.[`${role}ID`] ??
            ''
        );
    }

    function collectObjects(value, predicate, output = [], depth = 0, seen = new Set()) {
        if (!value || typeof value !== 'object' || depth > 10 || seen.has(value)) {
            return output;
        }

        seen.add(value);

        if (predicate(value)) output.push(value);

        for (const child of Object.values(value)) {
            if (child && typeof child === 'object') {
                collectObjects(child, predicate, output, depth + 1, seen);
            }
        }

        return output;
    }

    function uniqueAttackCountForUser(payload, userId) {
        if (!userId) return null;

        const rows = collectObjects(payload, value => {
            const attackerId = getActorId(value, 'attacker');
            if (attackerId !== String(userId)) return false;

            return Boolean(
                value?.id ??
                value?.attack_id ??
                value?.code ??
                value?.started ??
                value?.ended ??
                value?.timestamp
            );
        });

        if (!rows.length) return null;

        const keys = new Set();
        for (const row of rows) {
            const key = String(
                row?.id ??
                row?.attack_id ??
                row?.code ??
                `${getActorId(row, 'attacker')}:${getActorId(row, 'defender')}:${attackTimestamp(row)}`
            );
            keys.add(key);
        }

        return keys.size;
    }

    async function refreshRankedWarReport(force = false) {
        // Personal attack totals come from the documented chain-report schema.
    }

    async function refreshPersonalAttackStats(force = false) {
        await refreshChainApi(force);
    }

    async function refreshChainReportStats(force = false) {
        if (!runtimeShouldRun() || !settings.apiKey || !chainState.id || !ownUserId) return;

        const now = Date.now();
        if (!force && now - lastChainReportCheck < CHAIN_REPORT_REFRESH_MS) return;
        lastChainReportCheck = now;

        const url =
            `https://api.torn.com/v2/faction/${encodeURIComponent(chainState.id)}/chainreport` +
            `?key=${encodeURIComponent(settings.apiKey)}` +
            `&comment=RankedWarTargetPanel`;

        try {
            const payload = await gmRequest(url);
            if (payload?.error) {
                throw new Error(payload.error.error || payload.error.message || 'Torn API error');
            }

            /*
             * Official Torn API v2 OpenAPI schema v6.1.1:
             * chainreport.attackers[].id
             * chainreport.attackers[].attacks.total
             * chainreport.attackers[].attacks.war
             * https://www.torn.com/swagger/openapi.json
             */
            const attackers = payload?.chainreport?.attackers;
            if (!Array.isArray(attackers)) {
                throw new Error('Invalid chain report response: chainreport.attackers is missing.');
            }

            const ownAttacker = attackers.find(
                attacker => String(attacker?.id) === String(ownUserId)
            );

            if (!ownAttacker) {
                throw new Error('Your player ID is not listed in chainreport.attackers.');
            }

            const totalAttacks = Number(ownAttacker?.attacks?.total);
            const warAttacks = Number(ownAttacker?.attacks?.war);

            if (!Number.isFinite(totalAttacks)) {
                throw new Error('chainreport.attackers[].attacks.total is missing.');
            }
            if (!Number.isFinite(warAttacks)) {
                throw new Error('chainreport.attackers[].attacks.war is missing.');
            }

            personalStats.totalAttacks = totalAttacks;
            personalStats.warAttacks = warAttacks;
            personalStats.updatedAt = Date.now();
            personalStats.error = '';
        } catch (error) {
            if (error?.runtimePaused) return;
            personalStats.error = `Chain report: ${error.message}`;
        }
    }

    function extractChainObject(payload) {
        return (
            payload?.chain ??
            payload?.data?.chain ??
            payload?.ongoing_chain ??
            payload?.data?.ongoing_chain ??
            payload
        );
    }

    async function refreshChainApi(force = false) {
        if (!runtimeShouldRun() || !settings.apiKey) return;

        const now = Date.now();
        if (!force && now - lastChainApiCheck < CHAIN_API_REFRESH_MS) return;
        lastChainApiCheck = now;

        const url =
            `https://api.torn.com/v2/faction/chain` +
            `?key=${encodeURIComponent(settings.apiKey)}` +
            `&comment=RankedWarTargetPanel`;

        try {
            const payload = await gmRequest(url);
            if (!runtimeShouldRun()) return;
            if (payload?.error) {
                throw new Error(payload.error.error || payload.error.message || 'Torn API error');
            }

            const chain = extractChainObject(payload);
            const chainId = String(
                chain?.id ??
                chain?.chain_id ??
                payload?.chain_id ??
                ''
            );

            if (chainId) {
                chainState.id = chainId;
                chainState.href =
                    `https://www.torn.com/war.php?step=chainreport&chainID=${encodeURIComponent(chainId)}`;
            }

            const current = Number(chain?.current ?? chain?.hits ?? chain?.length);
            const target = Number(chain?.max ?? chain?.target);

            if (Number.isFinite(current)) chainState.current = current;
            if (Number.isFinite(target)) chainState.target = target;

            chainState.apiError = '';
            chainState.source = 'API';
            await refreshChainReportStats(force);
        } catch (error) {
            if (error?.runtimePaused) return;
            chainState.apiError = error.message;
        }

        renderWarSummary();
    }

    function parseChainSeconds(value) {
        const parts = String(value || '').trim().split(':').map(Number);
        if (parts.some(part => !Number.isFinite(part))) return null;
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return null;
    }

    function readVisibleChainBar() {
        if (!runtimeShouldRun() || !isActivePage()) return;

        const anchor =
            document.querySelector('a[href*="#/war/chain"]') ||
            document.querySelector('a[href*="factions.php?step=your"][class*="chain-bar"]');

        if (!anchor) {
            chainState = {
                ...chainState,
                timeLeft: '',
                secondsLeft: null
            };
            renderWarSummary();
            return;
        }

        const valueNode =
            anchor.querySelector('[class*="bar-value"]') ||
            [...anchor.querySelectorAll('p, span')].find(node =>
                /\d[\d,]*\s*\/\s*\d[\d,kKmM]*/.test(node.textContent || '')
            );

        const timeNode =
            anchor.querySelector('[class*="bar-timeleft"]') ||
            [...anchor.querySelectorAll('p, span')].find(node =>
                /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/.test(node.textContent || '')
            );

        const match = String(valueNode?.textContent || '').match(
            /([\d,]+)\s*\/\s*([\d,.]+)\s*([kKmM]?)/i
        );

        let current = 0;
        let target = 0;

        if (match) {
            current = Number(match[1].replaceAll(',', '')) || 0;
            target = Number(match[2].replaceAll(',', '')) || 0;
            const suffix = match[3].toLowerCase();
            if (suffix === 'k') target *= 1000;
            if (suffix === 'm') target *= 1000000;
        }

        const timeLeft = String(timeNode?.textContent || '').trim();

        chainState = {
            ...chainState,
            current,
            target,
            timeLeft,
            secondsLeft: parseChainSeconds(timeLeft),
            source: 'Live'
        };

        renderWarSummary();
    }

    function unlockChainAlertAudio() {
        if (!settings.chainAlertEnabled) return;

        try {
            if (!chainAlertAudioContext) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                chainAlertAudioContext = new AudioContextClass();
            }

            if (chainAlertAudioContext.state === 'suspended') {
                chainAlertAudioContext.resume().catch(() => {});
            }
        } catch {
            // Visual warning continues even if browser audio is unavailable.
        }
    }

    function playChainAlertTone(startDelay = 0) {
        if (!chainAlertAudioContext || chainAlertAudioContext.state !== 'running') return;

        const startAt = chainAlertAudioContext.currentTime + startDelay;
        const oscillator = chainAlertAudioContext.createOscillator();
        const gain = chainAlertAudioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(620, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);

        oscillator.connect(gain);
        gain.connect(chainAlertAudioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.3);
    }

    function updateChainAlert(isDanger) {
        if (!isDanger || !settings.chainAlertEnabled) {
            lastChainAlarmAt = 0;
            chainAlarmSequenceActive = false;
            return;
        }

        unlockChainAlertAudio();

        const now = Date.now();
        if (chainAlarmSequenceActive || now - lastChainAlarmAt < 10000) return;

        lastChainAlarmAt = now;
        chainAlarmSequenceActive = true;
        playChainAlertTone(0);
        playChainAlertTone(0.42);

        window.setTimeout(() => {
            chainAlarmSequenceActive = false;
        }, 900);
    }


    function unlockTurtleAudio() {
        try {
            if (!turtleAudioContext) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                turtleAudioContext = new AudioContextClass();
            }

            if (turtleAudioContext.state === 'suspended') {
                turtleAudioContext.resume().catch(() => {});
            }
        } catch {
            // The visual warning remains available if audio cannot start.
        }
    }

    function playTurtleSirenBurst() {
        if (!turtleAudioContext || turtleAudioContext.state !== 'running') return;

        const startAt = turtleAudioContext.currentTime;
        const oscillator = turtleAudioContext.createOscillator();
        const gain = turtleAudioContext.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(430, startAt);
        oscillator.frequency.linearRampToValueAtTime(940, startAt + 0.55);
        oscillator.frequency.linearRampToValueAtTime(430, startAt + 1.1);

        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.03);
        gain.gain.setValueAtTime(0.22, startAt + 1.0);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.12);

        oscillator.connect(gain);
        gain.connect(turtleAudioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + 1.15);
    }

    function startTurtleAlarm(testOnly = false) {
        unlockTurtleAudio();
        playTurtleSirenBurst();

        if (testOnly) {
            window.setTimeout(() => {
                stopTurtleAlarm();
                if (turtleHospitalUntil <= 0) renderWarSummary();
            }, 3500);
            return;
        }

        if (turtleAlarmInterval) return;
        turtleAlarmInterval = window.setInterval(playTurtleSirenBurst, 5000);
    }

    function stopTurtleAlarm() {
        if (turtleAlarmInterval) {
            clearInterval(turtleAlarmInterval);
            turtleAlarmInterval = null;
        }
    }

    function showTurtleAlert(message) {
        if (!panel) return;
        const box = panel.querySelector('.rw-turtle-status');
        const messageNode = panel.querySelector('.rw-turtle-message');
        if (!box || !messageNode) return;

        messageNode.textContent = message;
        box.hidden = false;
        box.classList.add('rw-turtle-danger');
    }

    function renderTurtleStatus() {
        if (!panel) return;

        const box = panel.querySelector('.rw-turtle-status');
        const messageNode = panel.querySelector('.rw-turtle-message');
        if (!box || !messageNode) return;

        const realWarMode = settings.mode === 'non-termed';
        const now = Math.floor(Date.now() / 1000);
        const remaining = turtleHospitalUntil > now
            ? turtleHospitalUntil - now
            : 0;
        const reminderSeconds = settings.turtleReminderMinutes * 60;
        const warningActive =
            realWarMode &&
            settings.turtleTimerEnabled &&
            remaining > 0 &&
            remaining <= reminderSeconds &&
            turtleAcknowledgedUntil !== turtleHospitalUntil;

        if (warningActive) {
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            messageNode.textContent =
                `Hospital ends in ${mins}:${String(secs).padStart(2, '0')} — re-up before release.`;
            box.hidden = false;
            box.classList.add('rw-turtle-danger');
            return;
        }

        box.classList.remove('rw-turtle-danger');

        if (
            realWarMode &&
            settings.turtleTimerEnabled &&
            remaining > reminderSeconds
        ) {
            const alertIn = remaining - reminderSeconds;
            const mins = Math.floor(alertIn / 60);
            const secs = alertIn % 60;
            messageNode.textContent =
                `Hospitalized — Turtle alarm in ${mins}:${String(secs).padStart(2, '0')}.`;
            box.hidden = false;
            return;
        }

        if (turtleStatusError && realWarMode && settings.turtleTimerEnabled) {
            messageNode.textContent = `Turtle Timer unavailable: ${turtleStatusError}`;
            box.hidden = false;
            return;
        }

        box.hidden = true;
    }

    function evaluateTurtleTimer() {
        const realWarMode = settings.mode === 'non-termed';
        const now = Math.floor(Date.now() / 1000);
        const remaining = turtleHospitalUntil - now;
        const shouldAlarm =
            realWarMode &&
            settings.turtleTimerEnabled &&
            remaining > 0 &&
            remaining <= settings.turtleReminderMinutes * 60 &&
            turtleAcknowledgedUntil !== turtleHospitalUntil;

        if (shouldAlarm) {
            turtleAlarmForUntil = turtleHospitalUntil;
            startTurtleAlarm(false);
        } else {
            stopTurtleAlarm();
        }

        renderTurtleStatus();
    }

    async function refreshTurtleStatus(force = false) {
        const realWarMode = settings.mode === 'non-termed';

        if (!runtimeShouldRun()) {
            stopTurtleAlarm();
            renderWarSummary();
            return;
        }

        if (!realWarMode || !settings.turtleTimerEnabled || !settings.apiKey) {
            turtleStatusError = '';
            turtleHospitalUntil = 0;
            stopTurtleAlarm();
            renderWarSummary();
            return;
        }

        const nowMs = Date.now();
        if (!force && nowMs - lastTurtleStatusCheck < TURTLE_STATUS_REFRESH_MS) {
            evaluateTurtleTimer();
            return;
        }

        lastTurtleStatusCheck = nowMs;

        try {
            const basic = await gmRequest(
                `https://api.torn.com/v2/user/basic?key=${encodeURIComponent(settings.apiKey)}` +
                `&comment=SLINKTurtleTimer`
            );
            if (!runtimeShouldRun()) return;

            const status = basic?.status || {};
            const state = String(status?.state || '');
            const until = Number(status?.until || 0);

            turtleStatusError = '';

            if (state.toLowerCase() === 'hospital' && Number.isFinite(until) && until > 0) {
                if (turtleHospitalUntil !== until) {
                    turtleAcknowledgedUntil = 0;
                    turtleAlarmForUntil = 0;
                }
                turtleHospitalUntil = until;
            } else {
                turtleHospitalUntil = 0;
                turtleAlarmForUntil = 0;
                turtleAcknowledgedUntil = 0;
                stopTurtleAlarm();
            }
        } catch (error) {
            if (error?.runtimePaused) return;
            turtleStatusError = error.message;
        }

        evaluateTurtleTimer();
        renderWarSummary();
    }

    function renderWarSummary() {
        if (!panel) return;

        const summary = panel.querySelector('.rw-war-summary');
        if (!summary) return;

        const chainActive = chainState.current > 0;
        const chainText = chainActive
            ? `${chainState.current.toLocaleString()}${chainState.target ? `/${chainState.target.toLocaleString()}` : ''}${chainState.timeLeft ? ` • ${chainState.timeLeft}` : ''}`
            : 'No active chain';

        summary.querySelector('.rw-war-hits').textContent =
            personalStats.warAttacks.toLocaleString();

        const compactAttacks = panel.querySelector('.rw-compact-attacks');
        if (compactAttacks) {
            const attackCount = personalStats.warAttacks.toLocaleString();
            compactAttacks.textContent = `${attackCount} attack${personalStats.warAttacks === 1 ? '' : 's'}`;
        }

        summary.querySelector('.rw-all-attacks').textContent =
            personalStats.totalAttacks.toLocaleString();

        summary.querySelector('.rw-chain-value').textContent = chainText;
        const chainSource = summary.querySelector('.rw-chain-source');
        if (chainSource) chainSource.textContent = chainState.source || 'Waiting';

        const chainLink = summary.querySelector('.rw-chain-link');
        chainLink.href = chainState.href;
        chainLink.textContent = chainState.id ? 'Chain report' : 'Chain page';
        chainLink.title = chainState.id
            ? `Open full chain report ${chainState.id}`
            : (chainState.apiError || 'Waiting for chain ID');

        const isDanger =
            settings.chainAlertEnabled &&
            chainActive &&
            chainState.current >= 50 &&
            Number.isFinite(chainState.secondsLeft) &&
            chainState.secondsLeft > 0 &&
            chainState.secondsLeft <= 90;

        summary.classList.toggle('rw-chain-danger', isDanger);
        updateChainAlert(isDanger);

        renderTurtleStatus();

        const updateNode = summary.querySelector('.rw-stats-age');
        if (personalStats.error) {
            updateNode.textContent = `Stats cached: ${personalStats.error}`;
        } else if (personalStats.updatedAt) {
            const seconds = Math.max(
                0,
                Math.floor((Date.now() - personalStats.updatedAt) / 1000)
            );
            updateNode.textContent = `Updated ${seconds}s ago`;
        } else {
            updateNode.textContent = 'Waiting for attack stats';
        }
    }

    function render() {
        if (!panel) createPanel();

        applyPanelSize();
        applyPanelPosition();
        panel.classList.toggle('collapsed', settings.collapsed);
        panel.classList.toggle('targets-collapsed', settings.targetsCollapsed);
        panel.classList.toggle('bubble-mode', settings.bubbleMode);

        const detailsToggle = panel.querySelector('.rw-collapse');
        if (detailsToggle) {
            detailsToggle.title = settings.collapsed
                ? 'Show controls and war summary'
                : 'Show target list only';
            detailsToggle.setAttribute('aria-label', detailsToggle.title);
            detailsToggle.setAttribute('aria-pressed', String(settings.collapsed));
        }

        const list = panel.querySelector('.rw-list');
        const heading = panel.querySelector('.rw-opponent');
        const status = panel.querySelector('.rw-status');
        const count = panel.querySelector('.rw-count');

        if (opponent) {
            heading.textContent = `${opponent.name} [${opponent.id}]`;
            heading.href =
                `https://www.torn.com/factions.php?step=profile&ID=${encodeURIComponent(opponent.id)}`;
            heading.title = `Open ${opponent.name}'s faction page`;
        } else {
            heading.textContent = 'Current Ranked-War Opponent';
            heading.removeAttribute('href');
            heading.removeAttribute('title');
        }
        status.textContent = statusText;

        const twseWarning = panel.querySelector('.rw-twse-warning');
        if (twseWarning) {
            const stale = Boolean(
                opponent &&
                lastDataTimestamp &&
                Date.now() - lastDataTimestamp > TWSE_STALE_MS
            );
            twseWarning.hidden = !stale;
        }

        const targetToggle = panel.querySelector('.rw-target-toggle');
        if (targetToggle) {
            targetToggle.textContent = settings.targetsCollapsed
                ? 'Show target list'
                : 'Minimize target list';
            targetToggle.title = settings.targetsCollapsed
                ? 'Show the player target list'
                : 'Hide the player target list';
        }

        renderWarSummary();

        const visible = getVisibleMembers();
        count.textContent = `${visible.length}/${members.length}`;

        list.replaceChildren();

        if (!visible.length) {
            const empty = document.createElement('div');
            empty.className = 'rw-empty';
            empty.textContent = members.length
                ? 'No members match the current filters.'
                : 'No shared faction data loaded yet.';
            list.appendChild(empty);
            return;
        }

        for (const member of visible) {
            const card = document.createElement('div');
            card.className = `rw-member ${member.activity.toLowerCase()}`;

            const ff = ffById[member.id];
            const hospital = formatHospital(member);
            const lastAction = member.lastActionRelative ||
                (member.lastActionTimestamp ? `${Math.floor(minutesSince(member.lastActionTimestamp))}m ago` : 'Unknown');

            card.innerHTML = `
                <div class="rw-member-line">
                    <a class="rw-name" target="_blank" href="https://www.torn.com/profiles.php?XID=${member.id}">
                        ${escapeHtml(member.name)} [${member.id}]
                    </a>
                    <span class="rw-ff">FF ${Number.isFinite(ff) ? ff.toFixed(2) : '?'}</span>
                    <span class="rw-share-buttons">
                        <button class="rw-copy" title="Copy formatted target callout">📄</button>
                        <button class="rw-chat-send"
                                data-target-id="${member.id}"
                                disabled
                                title="Press Copy first. Send remains available for 30 seconds.">💬</button>
                    </span>
                </div>
                <div class="rw-member-line rw-member-secondary">
                    <span>${statusEmoji(member)}${member.activity}</span>
                    <span>${escapeHtml(lastAction)}</span>
                    <span>${escapeHtml(member.statusState)}</span>
                    ${hospital ? `<span>${hospital}</span>` : ''}
                    ${shouldHospitalize(member) ? '<span class="rw-hospitalize">HOSP</span>' : ''}
                    <span class="rw-actions">
                        <a target="_blank" href="https://www.torn.com/loader2.php?sid=getInAttack&user2ID=${member.id}">Attack</a>
                        <a target="_blank" href="https://www.torn.com/profiles.php?XID=${member.id}">Profile</a>
                    </span>
                </div>
            `;

            card.querySelector('.rw-copy').addEventListener('click', event =>
                copyMember(member, event.currentTarget)
            );
            card.querySelector('.rw-chat-send').addEventListener('click', event =>
                sendMemberToFactionChat(member, event.currentTarget)
            );
            list.appendChild(card);
        }

        // Rendering fresh cards must not cancel an already-authorized send.
        updateChatSendButtons();
    }

    function applyPanelPosition() {
        if (!panel) return;

        const free = settings.panelPosition;
        const hasFreePosition = Number.isFinite(free?.left) && Number.isFinite(free?.top);
        panel.classList.toggle('rw-free-position', hasFreePosition);
        panel.classList.toggle('rw-resize-left', !hasFreePosition && settings.corner.endsWith('right'));
        panel.classList.toggle('rw-resize-top', !hasFreePosition && settings.corner.startsWith('bottom'));

        if (panel.classList.contains('rw-dragging') || panel.classList.contains('rw-resizing')) return;
        if (hasFreePosition) {
            panelDragController?.applyPosition(free);
            return;
        }

        const isLeft = settings.corner.endsWith('left');
        const isBottom = settings.corner.startsWith('bottom');

        panel.style.left = isLeft ? '10px' : 'auto';
        panel.style.right = isLeft ? 'auto' : '10px';

        if (isBottom) {
            panel.style.top = 'auto';
            panel.style.bottom = `${settings.panelBottom}px`;
        } else {
            panel.style.bottom = 'auto';
            panel.style.top = `${settings.panelTop}px`;
        }
    }

    function createPanel() {
        panel = document.createElement('section');
        panel.id = 'rw-target-panel';
        panel.innerHTML = `
            <button class="rw-bubble" type="button" title="Open war target panel" aria-label="Open war target panel">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="5.5"></circle>
                    <circle cx="8" cy="8" r="1.5"></circle>
                    <path d="M8 1v3M8 12v3M1 8h3M12 8h3"></path>
                </svg>
            </button>
            <header class="rw-header">
                <div class="rw-header-main">
                    <div class="rw-title">WAR TARGETS <span class="rw-version">v0.9.29</span> <span class="rw-count">0/0</span></div>
                    <div class="rw-header-subline">
                        <a class="rw-opponent" target="_blank" rel="noopener noreferrer">Current Ranked-War Opponent</a>
                        <span class="rw-compact-attacks" title="Your current ranked-war attack count">0 attacks</span>
                    </div>
                </div>
                <div class="rw-header-buttons">
                    <button class="rw-refresh" type="button" title="Refresh" aria-label="Refresh">
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M13.2 5.5A5.5 5.5 0 1 0 13 11"></path>
                            <path d="M13 1.5v4H9"></path>
                        </svg>
                    </button>
                    <button class="rw-bubble-toggle" type="button" title="Minimize entire panel" aria-label="Minimize entire panel">
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                            <circle cx="8" cy="8" r="5.5"></circle>
                            <circle cx="8" cy="8" r="1.5"></circle>
                        </svg>
                    </button>
                    <button class="rw-collapse" type="button" title="Show target list only" aria-label="Show target list only">
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M3 4h10M3 8h10M3 12h10"></path>
                            <circle cx="5" cy="4" r="1"></circle>
                            <circle cx="11" cy="8" r="1"></circle>
                            <circle cx="6" cy="12" r="1"></circle>
                        </svg>
                    </button>
                </div>
            </header>

            <div class="rw-body">
                <div class="rw-dashboard-section">
                  <div class="rw-controls">
                    <label>Mode
                        <select class="rw-mode">
                            <option value="termed">Termed</option>
                            <option value="non-termed">Real War</option>
                        </select>
                    </label>

                    <label class="rw-cutoff-label">Idle cutoff
                        <span><input class="rw-cutoff" type="number" min="0" step="1"> min</span>
                    </label>

                    <div class="rw-row">
                        <label>Min FF<input class="rw-minff" type="number" min="0" step="0.01" placeholder="Any"></label>
                        <label>Max FF<input class="rw-maxff" type="number" min="0" step="0.01" placeholder="Any"></label>
                    </div>

                    <label class="rw-check">
                        <input class="rw-unknown" type="checkbox"> Show unknown FF
                    </label>

                    <label class="rw-check">
                        <input class="rw-hide-abroad" type="checkbox"> Hide abroad/traveling
                    </label>

                    <label class="rw-check">
                        <input class="rw-hide-jail" type="checkbox"> Hide jailed
                    </label>

                    <div class="rw-row">
                        <label class="rw-position-setting">Panel position
                            <select class="rw-corner">
                                <option value="top-right">Top right</option>
                                <option value="top-left">Top left</option>
                                <option value="bottom-right">Bottom right</option>
                                <option value="bottom-left">Bottom left</option>
                            </select>
                        </label>
                    </div>

                    <details class="rw-settings" open>
                        <summary>Settings & alerts</summary>

                        <label class="rw-check rw-chain-alert-setting"
                               title="Flash the panel and sound two slow beeps when the active chain reaches 90 seconds or less">
                            <input class="rw-chain-alert" type="checkbox">
                            Enable chain warning at 90s
                        </label>

                        <div class="rw-turtle-settings">
                            <label class="rw-check"
                                   title="In Real War mode, check your hospital status once per minute and warn before release">
                                <input class="rw-turtle-enabled" type="checkbox">
                                Enable 🐢 Turtle Timer in Real War
                            </label>
                            <label class="rw-turtle-minutes-label">
                                Warn before release
                                <span><input class="rw-turtle-minutes" type="number" min="1" max="60" step="1"> min</span>
                            </label>
                            <button class="rw-test-turtle" type="button">Test Turtle Alarm</button>
                        </div>

                        <label>Torn API key<input class="rw-apikey" type="password" maxlength="16"></label>
                        <label>FFScouter key<input class="rw-ffkey" type="password"></label>
                        <div class="rw-note">
                            The panel reads the active ranked-war opponent through Torn's API and member
                            data through twse.dev. It does not open or scrape unseen faction pages.
                        </div>
                    </details>
                </div>

                <div class="rw-war-summary">
                    <div class="rw-war-stat">
                        <strong class="rw-war-hits">0</strong>
                        <span>War attacks</span>
                    </div>
                    <div class="rw-war-stat rw-wide-stat">
                        <strong class="rw-all-attacks">0</strong>
                        <span>Attacks</span>
                    </div>
                    <div class="rw-tier-goals">T2 100 • T3 140 • T4 170</div>
                    <div class="rw-chain-row">
                        <span>Chain: <strong class="rw-chain-value">No active chain</strong>
                            <small class="rw-chain-source">Waiting</small>
                        </span>
                        <a class="rw-chain-link" target="_blank"
                           href="https://www.torn.com/factions.php?step=your#/war/chain">Chain report</a>
                    </div>
                    <div class="rw-stats-age">Waiting for attack stats</div>
                    <div class="rw-turtle-status" hidden>
                        <div class="rw-turtle-title">🐢 TURTLE TIME</div>
                        <div class="rw-turtle-message">Re-up before leaving the hospital.</div>
                        <button class="rw-turtle-ack" type="button">Acknowledge</button>
                    </div>
                </div>

                <div class="rw-twse-warning" hidden>
                    ⚠ TWSE data is more than 5 minutes old.
                    <a target="_blank"
                       href="https://www.torn.com/factions.php?step=your&type=1#/war/rankreport">
                        Visit the war page
                    </a>
                    to refresh live target information.
                </div>
                <div class="rw-status">Starting…</div>
                  <div class="rw-list-controls">
                    <button class="rw-target-toggle" title="Hide or show the player target list">
                        Minimize target list
                    </button>
                  </div>
                </div>
                <div class="rw-list"></div>
            </div>
            <div class="rw-resize-handle" role="separator" aria-label="Resize War Panel" title="Drag to resize"></div>
        `;

        document.body.appendChild(panel);

        const mode = panel.querySelector('.rw-mode');
        const cutoff = panel.querySelector('.rw-cutoff');
        const minFF = panel.querySelector('.rw-minff');
        const maxFF = panel.querySelector('.rw-maxff');
        const unknown = panel.querySelector('.rw-unknown');
        const hideAbroad = panel.querySelector('.rw-hide-abroad');
        const hideJail = panel.querySelector('.rw-hide-jail');
        const chainAlert = panel.querySelector('.rw-chain-alert');
        const turtleEnabled = panel.querySelector('.rw-turtle-enabled');
        const turtleMinutes = panel.querySelector('.rw-turtle-minutes');
        const corner = panel.querySelector('.rw-corner');
        const apiKey = panel.querySelector('.rw-apikey');
        const ffKey = panel.querySelector('.rw-ffkey');

        mode.value = settings.mode;
        cutoff.value = settings.idleCutoff;
        minFF.value = settings.minFF;
        maxFF.value = settings.maxFF;
        unknown.checked = settings.showUnknownFF;
        hideAbroad.checked = settings.hideAbroad;
        hideJail.checked = settings.hideJail;
        chainAlert.checked = settings.chainAlertEnabled;
        turtleEnabled.checked = settings.turtleTimerEnabled;
        turtleMinutes.value = settings.turtleReminderMinutes;
        corner.value = settings.corner;
        apiKey.value = settings.apiKey;
        ffKey.value = settings.ffApiKey;

        mode.addEventListener('change', () => {
            updateSetting('mode', mode.value);
            refreshTurtleStatus(true);
        });
        cutoff.addEventListener('change', () => updateSetting('idleCutoff', Math.max(0, Number(cutoff.value) || 0)));
        minFF.addEventListener('input', () => updateSetting('minFF', minFF.value));
        maxFF.addEventListener('input', () => updateSetting('maxFF', maxFF.value));
        unknown.addEventListener('change', () =>
            updateSetting('showUnknownFF', unknown.checked)
        );
        hideAbroad.addEventListener('change', () =>
            updateSetting('hideAbroad', hideAbroad.checked)
        );
        hideJail.addEventListener('change', () =>
            updateSetting('hideJail', hideJail.checked)
        );
        chainAlert.addEventListener('change', () => {
            settings.chainAlertEnabled = chainAlert.checked;
            saveSettings();
            if (settings.chainAlertEnabled) unlockChainAlertAudio();
            render();
        });
        turtleEnabled.addEventListener('change', () => {
            settings.turtleTimerEnabled = turtleEnabled.checked;
            saveSettings();
            if (!settings.turtleTimerEnabled) stopTurtleAlarm();
            refreshTurtleStatus(true);
            renderWarSummary();
        });
        turtleMinutes.addEventListener('change', () => {
            settings.turtleReminderMinutes = Math.max(
                1,
                Math.min(60, Number(turtleMinutes.value) || 5)
            );
            turtleMinutes.value = settings.turtleReminderMinutes;
            saveSettings();
            evaluateTurtleTimer();
            renderWarSummary();
        });
        panel.querySelector('.rw-test-turtle').addEventListener('click', () => {
            unlockTurtleAudio();
            showTurtleAlert('Test alarm — this is the Turtle Timer sound.');
            startTurtleAlarm(true);
        });
        panel.querySelector('.rw-turtle-ack').addEventListener('click', () => {
            turtleAcknowledgedUntil = turtleHospitalUntil || turtleAlarmForUntil || -1;
            stopTurtleAlarm();
            renderWarSummary();
        });
        corner.addEventListener('change', () => {
            settings.corner = corner.value;
            settings.panelPosition = null;
            saveSettings();
            applyPanelPosition();
        });

        ffKey.addEventListener('change', () => {
            settings.ffApiKey = ffKey.value.trim();
            saveSettings();
            refreshData(true);
        });

        panel.querySelector('.rw-target-toggle').addEventListener('click', () => {
            settings.targetsCollapsed = !settings.targetsCollapsed;
            saveSettings();
            render();
        });

        panel.querySelector('.rw-refresh').addEventListener('click', () => hardRefresh());

        panel.querySelector('.rw-bubble-toggle').addEventListener('click', () => {
            settings.bubbleMode = true;
            saveSettings();
            apiLease?.refresh();
            syncRuntimeState();
            render();
        });

        panel.querySelector('.rw-bubble').addEventListener('click', () => {
            settings.bubbleMode = false;
            saveSettings();
            render();
            apiLease?.refresh();
            syncRuntimeState({ refresh: true });
        });

        panel.querySelector('.rw-collapse').addEventListener('click', () => {
            settings.collapsed = !settings.collapsed;
            saveSettings();
            render();
        });

        panelDragController = TornLib.makePanelDraggable(panel, {
            handle: panel.querySelector('.rw-header'),
            storageKey: PREFIX + 'free-position',
            draggingClass: 'rw-dragging',
            getValue: () => settings.panelPosition,
            setValue: (_key, position) => {
                settings.panelPosition = position;
                saveSettings();
                applyPanelPosition();
            }
        });
        panelResizeController = makePanelResizable(panel, panel.querySelector('.rw-resize-handle'));

        document.addEventListener('pointerdown', () => {
            unlockChainAlertAudio();
            unlockTurtleAudio();
        }, { once: true, passive: true });
        document.addEventListener('keydown', () => {
            unlockChainAlertAudio();
            unlockTurtleAudio();
        }, { once: true });
    }

    function updateSetting(key, value) {
        settings[key] = value;
        saveSettings();
        render();
    }

    function makePanelResizable(element, handle) {
        let resize = null;
        const margin = 4;

        const finish = event => {
            if (!resize || event.pointerId !== resize.pointerId) return;
            resize = null;
            element.classList.remove('rw-resizing');
            document.body.style.userSelect = '';
            panelDragController?.clampToViewport();
            saveSettings();
        };

        handle.addEventListener('pointerdown', event => {
            if (event.button !== 0 || settings.bubbleMode) return;
            const rect = element.getBoundingClientRect();
            resize = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startLeft: rect.left,
                startTop: rect.top,
                startRight: rect.right,
                startBottom: rect.bottom,
                startWidth: rect.width,
                startHeight: rect.height,
                fromLeft: element.classList.contains('rw-resize-left'),
                fromTop: element.classList.contains('rw-resize-top'),
                free: element.classList.contains('rw-free-position')
            };
            element.classList.add('rw-resizing');
            handle.setPointerCapture(event.pointerId);
            document.body.style.userSelect = 'none';
            event.preventDefault();
        });

        handle.addEventListener('pointermove', event => {
            if (!resize || event.pointerId !== resize.pointerId) return;
            const dx = event.clientX - resize.startX;
            const dy = event.clientY - resize.startY;
            const maximumWidth = resize.free
                ? (resize.fromLeft ? resize.startRight - margin : innerWidth - resize.startLeft - margin)
                : innerWidth - margin * 2;
            const maximumHeight = resize.free
                ? (resize.fromTop ? resize.startBottom - margin : innerHeight - resize.startTop - margin)
                : innerHeight - margin * 2;
            const width = Math.max(210, Math.min(maximumWidth, resize.startWidth + (resize.fromLeft ? -dx : dx)));
            const height = Math.max(100, Math.min(maximumHeight, resize.startHeight + (resize.fromTop ? -dy : dy)));

            settings.panelSize = { width: Math.round(width), height: Math.round(height) };
            element.style.width = `${width}px`;
            element.style.height = `${height}px`;

            if (resize.free) {
                const left = resize.fromLeft ? resize.startRight - width : resize.startLeft;
                const top = resize.fromTop ? resize.startBottom - height : resize.startTop;
                settings.panelPosition = { left: Math.round(left), top: Math.round(top) };
                element.style.left = `${left}px`;
                element.style.top = `${top}px`;
                element.style.right = 'auto';
                element.style.bottom = 'auto';
            }
        });

        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);

        return {
            destroy() {
                resize = null;
                document.body.style.userSelect = '';
            }
        };
    }

    async function hardRefresh() {
        if (!runtimeShouldRun()) return;
        statusText = 'Hard refresh: rescanning Ranked War…';
        render();

        lastWarCheck = 0;
        lastNetworkCheck = 0;
        lastFFCheck = 0;
        lastPersonalAttackCheck = 0;
        lastChainApiCheck = 0;
        lastWarReportCheck = 0;
        lastChainReportCheck = 0;

        const visibleOpponent = scanVisibleRankedWarOpponent();
        if (visibleOpponent) {
            switchOpponent(visibleOpponent, 'Visible Ranked War');
        } else {
            // Force an API opponent lookup only when the visible page cannot identify it.
            opponent = null;
        }

        startOwnedTimers();
        await refreshData(true);
    }

    async function refreshData(forceNetwork = false) {
        if (!runtimeShouldRun()) return;
        try {
            const now = Date.now();
            const visibleOpponent = scanVisibleRankedWarOpponent();

            if (visibleOpponent) {
                switchOpponent(visibleOpponent, 'Visible Ranked War');
            }

            if (!opponent || now - lastWarCheck > WAR_REFRESH_MS) {
                const savedOpponent = readSavedOpponent();

                if (!opponent && savedOpponent) {
                    opponent = savedOpponent;
                    render();
                }

                statusText = opponent
                    ? 'Confirming ranked-war opponent…'
                    : 'Finding active ranked war…';
                render();

                try {
                    const apiOpponent = await getCurrentOpponent();
                    if (!runtimeShouldRun()) return;
                    switchOpponent(apiOpponent, 'Torn API');
                    lastWarCheck = now;
                } catch (error) {
                    if (error?.runtimePaused) return;
                    if (!opponent) throw error;
                    console.warn('[RW Target Panel] Opponent refresh failed; using current opponent:', error);
                    statusText = 'Using current ranked-war opponent';
                    lastWarCheck = now;
                }
            }

            const localCache = useNewestLocalCache(opponent.id);

            if (localCache && localCache.timestamp > lastDataTimestamp) {
                members = localCache.members;
                lastDataTimestamp = localCache.timestamp;

                if (localCache.ffById) {
                    ffById = { ...ffById, ...localCache.ffById };
                }

                const ageSeconds = Math.max(
                    0,
                    Math.floor((Date.now() - localCache.timestamp) / 1000)
                );

                statusText = `${localCache.source} • ${ageSeconds}s old`;
                render();
            }

            const shouldCheckNetwork =
                forceNetwork ||
                !members.length ||
                now - lastNetworkCheck >= NETWORK_REFRESH_MS;

            if (shouldCheckNetwork) {
                lastNetworkCheck = now;
                statusText = members.length
                    ? 'Checking for newer shared data…'
                    : 'Loading TWSE shared data…';
                render();

                const factionResult = await fetchSharedMembers(opponent.id);
                if (!runtimeShouldRun()) return;

                if (factionResult.members.length) {
                    members = factionResult.members;
                    lastDataTimestamp = Number(
                        factionResult.timestamp ??
                        factionResult.cachedTimestamp ??
                        Date.now()
                    );
                    savePanelCache(opponent.id, members);

                    const ageSeconds = Math.max(
                        0,
                        Math.floor((Date.now() - lastDataTimestamp) / 1000)
                    );
                    statusText = `${factionResult.source} • ${ageSeconds}s old`;
                }
            }

            await refreshChainApi(forceNetwork);
            if (!runtimeShouldRun()) return;

            if (
                settings.ffApiKey &&
                members.length &&
                (forceNetwork || !Object.keys(ffById).length || now - lastFFCheck >= FF_REFRESH_MS)
            ) {
                lastFFCheck = now;
                const freshFF = await fetchFFData(members);
                if (!runtimeShouldRun()) return;

                if (Object.keys(freshFF).length) {
                    ffById = { ...ffById, ...freshFF };
                    savePanelCache(opponent.id, members, ffById);
                }
            }

            render();
        } catch (error) {
            if (error?.runtimePaused) return;
            if (members.length) {
                statusText = `Using cached data — ${error.message}`;
            } else {
                statusText = error.message;
            }
            render();
        }
    }

    GM_addStyle(`
        #rw-target-panel {
            position: fixed;
            right: 10px;
            top: 90px;
            width: 240px;
            min-width: 210px;
            min-height: 100px;
            max-width: calc(100vw - 8px);
            max-height: calc(100vh - 8px);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            background: rgba(30, 30, 30, .98);
            color: #ddd;
            border: 1px solid #555;
            border-radius: 8px;
            box-shadow: 0 8px 28px rgba(0,0,0,.45);
            font: 10px/1.12 Arial, sans-serif;
            overflow: hidden;
        }

        #rw-target-panel * { box-sizing: border-box; }
        #rw-target-panel button,
        #rw-target-panel input,
        #rw-target-panel select { font: inherit; }

        .rw-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            padding: 4px 6px;
            background: #202020;
            border-bottom: 1px solid #4a4a4a;
            cursor: move;
        }

        .rw-title { font-weight: 700; color: #eee; letter-spacing: .4px; }
        .rw-count { color: #aaa; font-weight: 400; }
        .rw-header-main { flex: 1 1 auto; min-width: 0; }
        .rw-header-subline { display: flex; align-items: center; gap: 5px; min-width: 0; }
        .rw-opponent {
            flex: 1 1 auto;
            min-width: 0;
            max-width: 220px;
            color: #8ab4f8;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-decoration: none;
        }
        .rw-opponent:hover { text-decoration: underline; }
        .rw-compact-attacks {
            display: none;
            flex: 0 0 auto;
            color: #bbb;
            font-weight: 700;
            white-space: nowrap;
        }
        #rw-target-panel.collapsed .rw-compact-attacks { display: inline; }
        .rw-header-buttons { display: flex; gap: 5px; }

        .rw-header button svg,
        .rw-bubble svg {
            display: block;
            width: 13px;
            height: 13px;
            margin: auto;
            overflow: visible;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.6;
            stroke-linecap: round;
            stroke-linejoin: round;
            pointer-events: none;
        }

        .rw-header button svg circle[r="1"],
        .rw-header button svg circle[r="1.5"],
        .rw-bubble svg circle[r="1.5"] {
            fill: currentColor;
            stroke: none;
        }

        .rw-header button,
        .rw-share-buttons {
            display: inline-flex;
            gap: 3px;
            margin-left: auto;
        }
        .rw-chat-send {
            min-width: 25px;
            padding: 1px 4px;
            cursor: pointer;
        }
        .rw-chat-send:disabled {
            cursor: not-allowed;
            opacity: .35;
        }
        .rw-chat-send.rw-chat-authorized {
            opacity: 1;
            cursor: pointer;
            outline: 1px solid #7ca900;
            box-shadow: 0 0 5px rgba(124, 169, 0, .75);
        }
        .rw-chain-source {
            margin-left: 4px;
            color: #aaa;
            font-weight: 400;
        }
        .rw-twse-warning {
            padding: 7px;
            border-top: 1px solid #665b2e;
            border-bottom: 1px solid #665b2e;
            background: #342d12;
            color: #ffe38a;
            line-height: 1.35;
        }
        .rw-twse-warning[hidden] {
            display: none !important;
        }
        .rw-twse-warning a {
            color: #fff0a8;
            font-weight: 800;
            text-decoration: underline;
        }

        .rw-copy {
            border: 1px solid #555;
            border-radius: 4px;
            background: #333;
            color: #ddd;
            cursor: pointer;
        }

        .rw-header button {
            width: 22px;
            height: 20px;
            padding: 0;
            color: #fff !important;
            background: rgba(255, 255, 255, .10);
            border: 1px solid rgba(255, 255, 255, .34);
            border-radius: 4px;
            text-shadow: 0 1px 2px #000;
            opacity: 1;
            cursor: pointer;
        }
        .rw-header button:hover {
            background: rgba(255, 255, 255, .22);
            border-color: rgba(255, 255, 255, .7);
        }
        .rw-header button[aria-pressed="true"] {
            background: rgba(138, 180, 248, .28);
            border-color: #8ab4f8;
            color: #d7e7ff !important;
        }
        .rw-body {
            min-height: 0;
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .rw-dashboard-section { flex: 0 0 auto; min-height: 0; }
        #rw-target-panel.collapsed .rw-dashboard-section { display: none; }

        #rw-target-panel.targets-collapsed .rw-list {
            display: none;
        }

        #rw-target-panel.targets-collapsed .rw-status {
            border-bottom: 0;
        }

        .rw-list-controls {
            display: flex;
            justify-content: flex-end;
            padding: 3px 5px;
            border-bottom: 1px solid #444;
            background: #202020;
        }

        .rw-target-toggle {
            padding: 2px 6px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #303030;
            color: #ccc;
            cursor: pointer;
            font-size: 9px;
            line-height: 1.25;
        }

        .rw-target-toggle:hover {
            background: #3a3a3a;
            color: #fff;
        }

        #rw-target-panel.targets-collapsed .rw-list-controls {
            border-bottom: 0;
        }

        .rw-bubble {
            display: none;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border: 1px solid #666;
            background: #222;
            color: #eee;
            font-size: 21px;
            line-height: 1;
            cursor: pointer;
            box-shadow: 0 5px 18px rgba(0,0,0,.45);
        }

        #rw-target-panel.bubble-mode {
            width: 42px !important;
            max-height: 42px !important;
            min-height: 42px;
            border: 0;
            border-radius: 50%;
            background: transparent;
            overflow: visible;
            box-shadow: none;
        }

        #rw-target-panel.bubble-mode .rw-bubble {
            display: block;
        }

        #rw-target-panel.bubble-mode .rw-header,
        #rw-target-panel.bubble-mode .rw-body,
        #rw-target-panel.bubble-mode .rw-resize-handle {
            display: none !important;
        }

        .rw-resize-handle {
            position: absolute;
            right: 1px;
            bottom: 1px;
            width: 12px;
            height: 12px;
            z-index: 3;
            cursor: nwse-resize;
            touch-action: none;
            opacity: .7;
            background:
                linear-gradient(135deg, transparent 0 48%, #aaa 49% 56%, transparent 57% 67%, #777 68% 75%, transparent 76%);
        }

        #rw-target-panel.rw-resize-left .rw-resize-handle {
            left: 1px;
            right: auto;
            transform: scaleX(-1);
            cursor: nesw-resize;
        }

        #rw-target-panel.rw-resize-top .rw-resize-handle {
            top: 1px;
            bottom: auto;
            transform: scaleY(-1);
            cursor: nesw-resize;
        }

        #rw-target-panel.rw-resize-left.rw-resize-top .rw-resize-handle {
            transform: scale(-1);
            cursor: nwse-resize;
        }

        #rw-target-panel.rw-free-position .rw-resize-handle {
            left: auto;
            right: 1px;
            top: auto;
            bottom: 1px;
            transform: none;
            cursor: nwse-resize;
        }


        .rw-controls {
            padding: 4px 6px;
            border-bottom: 1px solid #444;
            display: grid;
            gap: 5px;
        }

        .rw-controls label { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .rw-controls input,
        .rw-controls select {
            width: 112px;
            min-width: 0;
            padding: 2px 3px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #171717;
            color: #ddd;
        }

        .rw-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .rw-row label { display: grid; gap: 3px; }
        .rw-position-setting { grid-column: 1 / -1; }
        .rw-row input { width: 100%; }
        .rw-check { justify-content: flex-start !important; }
        .rw-check input { width: auto; }

        .rw-settings {
            border-top: 1px solid #444;
            padding-top: 5px;
        }
        .rw-settings summary {
            cursor: pointer;
            color: #ddd;
            font-weight: 700;
        }
        .rw-settings[open] { display: grid; gap: 7px; }
        .rw-settings label { margin-top: 6px; }
        .rw-chain-alert-setting {
            padding: 5px 6px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #202020;
        }
        .rw-turtle-settings {
            display: grid;
            gap: 6px;
            padding: 7px;
            border: 1px solid #665b2e;
            border-radius: 5px;
            background: #242114;
        }
        .rw-turtle-minutes-label {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }
        .rw-turtle-minutes {
            width: 55px !important;
        }
        .rw-test-turtle {
            cursor: pointer;
        }
        .rw-turtle-status {
            grid-column: 1 / -1;
            margin-top: 6px;
            padding: 7px;
            border: 1px solid #8d7b32;
            border-radius: 5px;
            background: #2b2715;
            text-align: center;
        }
        .rw-turtle-status[hidden] {
            display: none !important;
        }
        .rw-turtle-title {
            font-size: 14px;
            font-weight: 900;
            color: #ffdf62;
        }
        .rw-turtle-message {
            margin: 4px 0 6px;
        }
        .rw-turtle-ack {
            font-weight: 700;
            cursor: pointer;
        }
        .rw-turtle-danger {
            animation: rwTurtlePulse 1.8s ease-in-out infinite;
        }
        @keyframes rwTurtlePulse {
            0%, 100% {
                box-shadow: 0 0 0 rgba(255, 190, 0, 0);
                background: #2b2715;
            }
            50% {
                box-shadow: 0 0 18px rgba(255, 190, 0, 0.9);
                background: #5a4300;
            }
        }
        .rw-note { color: #999; font-size: 11px; }

        .rw-war-summary {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 3px 8px;
            padding: 4px 6px;
            border-bottom: 1px solid #444;
            background: #222;
        }

        .rw-war-stat {
            display: flex;
            align-items: baseline;
            gap: 4px;
            white-space: nowrap;
        }

        .rw-war-stat strong {
            color: #eee;
            font-size: 12px;
        }

        .rw-war-stat span,
        .rw-stats-age {
            color: #999;
        }

        .rw-wide-stat {
            min-width: 0;
            overflow: hidden;
        }

        .rw-wide-stat span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .rw-tier-goals {
            grid-column: 1 / -1;
            color: #999;
            font-size: 9px;
            white-space: nowrap;
            padding-left: 1px;
        }

        .rw-chain-row {
            grid-column: 1 / -1;
            display: flex;
            justify-content: space-between;
            gap: 6px;
            white-space: nowrap;
        }

        .rw-chain-link {
            color: #8ab4f8;
            text-decoration: none;
        }

        .rw-stats-age {
            grid-column: 1 / -1;
            font-size: 8px;
        }

        .rw-chain-danger {
            animation: rw-chain-alert 1.6s ease-in-out infinite;
        }

        @keyframes rw-chain-alert {
            0%, 100% {
                background: rgba(100, 18, 18, .94);
                box-shadow: inset 0 0 0 1px #e45b5b, 0 0 8px rgba(228, 91, 91, .3);
            }
            50% {
                background: rgba(42, 18, 18, .94);
                box-shadow: inset 0 0 0 1px #7b3030;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .rw-chain-danger {
                animation-duration: 3s;
            }
        }

        .rw-status {
            padding: 4px 8px;
            color: #aaa;
            background: #282828;
            border-bottom: 1px solid #444;
        }

        .rw-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 2px; }
        .rw-member {
            padding: 2px 3px;
            margin-bottom: 1px;
            border: 1px solid #494949;
            border-left-width: 4px;
            border-radius: 5px;
            background: #252525;
        }

        .rw-member.online { border-left-color: #45b85a; }
        .rw-member.idle { border-left-color: #d5a72d; }
        .rw-member.offline { border-left-color: #888; }

        .rw-member-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .rw-name {
            color: #ddd;
            font-weight: 700;
            text-decoration: none;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
        }
        .rw-copy { min-width: 20px; height: 18px; padding: 0 2px; font-size: 10px; }

        .rw-member-line {
            display: flex;
            align-items: center;
            gap: 3px;
            min-width: 0;
        }

        .rw-member-secondary {
            margin-top: 1px;
            color: #aaa;
            white-space: nowrap;
            overflow: hidden;
        }

        .rw-member-secondary > span {
            flex: 0 0 auto;
        }

        .rw-ff {
            margin-left: auto;
            color: #bbb;
            white-space: nowrap;
        }

        .rw-actions {
            display: inline-flex;
            gap: 4px;
            margin-left: auto;
        }
        .rw-actions a { color: #8ab4f8; text-decoration: none; }
        .rw-hospitalize { color: #ff7373; font-weight: 700; }
        .rw-empty { padding: 10px 8px; text-align: center; color: #999; }






    `);

    GM_registerMenuCommand('Ranked War Panel: Toggle bubble mode', () => {
        settings.bubbleMode = !settings.bubbleMode;
        saveSettings();
        render();
        apiLease?.refresh();
        syncRuntimeState({ refresh: !settings.bubbleMode });
    });

    GM_registerMenuCommand('Ranked War Panel: Move to next corner', () => {
        const corners = ['top-right', 'top-left', 'bottom-left', 'bottom-right'];
        const currentIndex = Math.max(0, corners.indexOf(settings.corner));
        settings.corner = corners[(currentIndex + 1) % corners.length];
        settings.panelPosition = null;
        saveSettings();
        applyPanelPosition();
        render();
    });

    GM_registerMenuCommand('Ranked War Panel: Refresh', () => hardRefresh());
    GM_registerMenuCommand('Ranked War Panel: Clear saved settings', () => {
        localStorage.removeItem(PREFIX + 'settings');
        location.reload();
    });

    createPanel();

    const savedOpponent = readSavedOpponent();
    if (savedOpponent) {
        opponent = savedOpponent;
        const localCache = useNewestLocalCache(savedOpponent.id);

        if (localCache) {
            members = localCache.members;
            ffById = localCache.ffById || {};
            lastDataTimestamp = localCache.timestamp;
            statusText = `${localCache.source} • loaded immediately`;
        }
    }

    render();

    function stopOwnedTimers() {
        if (refreshTimer) clearInterval(refreshTimer);
        if (personalAttackTimer) clearInterval(personalAttackTimer);
        if (chainTimer) clearInterval(chainTimer);
        if (turtleStatusTimer) clearInterval(turtleStatusTimer);

        refreshTimer = null;
        personalAttackTimer = null;
        chainTimer = null;
        turtleStatusTimer = null;
    }

    function startOwnedTimers() {
        stopOwnedTimers();
        if (!runtimeShouldRun()) return;

        refreshTimer = setInterval(() => {
            if (!runtimeShouldRun()) return;
            const cached = opponent ? useNewestLocalCache(opponent.id) : null;

            if (cached && cached.timestamp > lastDataTimestamp) {
                members = cached.members;
                ffById = { ...ffById, ...(cached.ffById || {}) };
                lastDataTimestamp = cached.timestamp;
                statusText = `${cached.source} • updated`;
                render();
            }

            // This pass checks the focused Ranked War DOM for a new opponent
            // without spending a Torn API call.
            refreshData(false);
        }, REFRESH_MS);

        personalAttackTimer = setInterval(() => {
            if (!runtimeShouldRun()) return;
            refreshChainApi(false).then(() => renderWarSummary());
        }, PERSONAL_ATTACK_REFRESH_MS);

        chainTimer = setInterval(() => {
            if (!runtimeShouldRun()) return;
            readVisibleChainBar();
            evaluateTurtleTimer();
        }, CHAIN_DOM_REFRESH_MS);

        turtleStatusTimer = setInterval(() => {
            if (!runtimeShouldRun()) return;
            refreshTurtleStatus(false);
        }, TURTLE_STATUS_REFRESH_MS);
    }

    function syncRuntimeState({ refresh = false } = {}) {
        if (!runtimeShouldRun()) {
            stopOwnedTimers();
            updateChainAlert(false);
            stopTurtleAlarm();
            statusText = settings.bubbleMode
                ? 'Paused in bubble mode'
                : 'Paused • another Torn tab owns API polling';
            render();
            return;
        }

        const restarting = !refreshTimer;
        if (restarting) startOwnedTimers();
        readVisibleChainBar();
        const visibleOpponent = scanVisibleRankedWarOpponent();
        if (visibleOpponent) switchOpponent(visibleOpponent, 'Visible Ranked War');
        if (refresh || restarting) {
            refreshData(false);
            refreshTurtleStatus(false);
        }
    }

    function applyPanelSize() {
        if (!panel) return;
        if (panel.classList.contains('rw-resizing')) return;
        const width = Number(settings.panelSize?.width);
        const height = Number(settings.panelSize?.height);
        panel.style.width = Number.isFinite(width) && width >= 210 ? `${width}px` : '240px';
        panel.style.height = Number.isFinite(height) && height >= 100 ? `${height}px` : 'auto';
    }

    window.addEventListener('focus', syncRuntimeState);
    window.addEventListener('blur', syncRuntimeState);
    document.addEventListener('visibilitychange', syncRuntimeState);
    window.addEventListener('storage', event => {
        if (event.key === PREFIX + 'settings') {
            settings = loadSettings();
            applyPanelSize();
            applyPanelPosition();
            render();
            apiLease?.refresh();
            syncRuntimeState({ refresh: !settings.bubbleMode });
        }
    });

    window.addEventListener('beforeunload', () => {
        stopOwnedTimers();
        panelDragController?.destroy();
        panelResizeController?.destroy();
        apiLease?.destroy();
    });

    apiLease = TornLib.createTabLeaderLease('ranked-war-target-panel', {
        isEligible: () => !settings.bubbleMode,
        onChange: isLeader => syncRuntimeState({ refresh: isLeader }),
    });
    syncRuntimeState({ refresh: true });
})();
