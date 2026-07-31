// ==UserScript==
// @name         Considious Torn Incoming Retaliation Monitor
// @namespace    Considious [3853023]
// @version      1.7.10
// @description  Torn faction retaliation and chain dashboard with FFScouter estimates, alerts, attack shortcuts, and two-step faction chat sharing.
// @author       Considious [3853023]
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Retaliation-Monitor/Torn_Incoming_Retaliation_Monitor.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Retaliation-Monitor/Torn_Incoming_Retaliation_Monitor.user.js
// @match        https://www.torn.com/*
// @connect      api.torn.com
// @connect      ffscouter.com
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/main/shared/Considious_Torn_Lib.js?v=1.3.0
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const TornLib = globalThis.ConsidiousTornLib;
    if (!TornLib) throw new Error('Considious Torn Library failed to load.');

    const POLL_MS = 20_000;
    const RETAL_WINDOW_SECONDS = 5 * 60;
    const LOOKBACK_SECONDS = 10 * 60;
    const RESOLVED_MEMORY_SECONDS = 24 * 60 * 60;
    const MAX_RESULTS = 100;
    const CHAT_COPY_AUTHORIZATION_MS = 30 * 1000;
    const CHAIN_SCRAPE_MS = 1_000;
    const CHAIN_BONUSES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

    const KEYS = {
        tornApiKey: 'retalMonitor.tornApiKey',
        ffApiKey: 'retalMonitor.ffApiKey',
        factionId: 'retalMonitor.factionId',
        minimized: 'retalMonitor.minimized',
        dismissed: 'retalMonitor.dismissed',
        manuallyCleared: 'retalMonitor.manuallyCleared',
        resolved: 'retalMonitor.resolved',
        soundEnabled: 'retalMonitor.soundEnabled'
    };

    const activeRetals = new Map();
    const ffCache = new Map();
    const playerBasicCache = new Map();

    let factionId = Number(GM_getValue(KEYS.factionId, 0)) || 0;
    let apiLease = null;
    let starting = false;
    let polling = false;
    let pollTimer = null;
    let secondTimer = null;
    let chainTimer = null;
    let currentChainId = 0;
    let currentChainCount = 0;
    let currentChainBonus = 0;
    let currentChainMultiplier = '';
    let currentChainSeconds = 0;
    let chainDeadline = 0;
    let lastAlarmThreshold = 0;
    let lastScrapedChainText = '';
    let chainDataSource = 'API';
    let pendingChatSend = null;
    let pendingChatSendTimer = null;

    GM_addStyle(`
        #trm-panel { position: fixed; left: 14px; top: 60px; width: 370px; max-height: 72vh; z-index: 999999; overflow: hidden; border: 1px solid #555; border-radius: 8px; background: #202020; color: #eee; box-shadow: 0 5px 20px rgba(0,0,0,.6); font: 13px Arial, sans-serif; }
        #trm-panel * { box-sizing: border-box; }
        #trm-panel.trm-chain-warning:not(.trm-minimized) { animation: trmPanelWarning .8s steps(2, start) infinite; }
        @keyframes trmPanelWarning { 50% { border-color: #ff3d3d; background: #4a1717; box-shadow: 0 0 22px rgba(255, 45, 45, .9); } }
        #trm-panel.trm-minimized { width: 46px; max-height: 46px; border-radius: 23px; overflow: visible; }
        #trm-panel.trm-minimized .trm-header { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; min-height: 44px; padding: 0; border-bottom: 0; border-radius: 23px; }
        #trm-panel.trm-minimized .trm-header-left, #trm-panel.trm-minimized .trm-header-center, #trm-panel.trm-minimized .trm-header-right, #trm-panel.trm-minimized .trm-title-wrap, #trm-panel.trm-minimized .trm-status, #trm-panel.trm-minimized #trm-sound, #trm-panel.trm-minimized #trm-refresh, #trm-panel.trm-minimized #trm-settings, #trm-panel.trm-minimized #trm-collapse, #trm-panel.trm-minimized .trm-body { display: none; }
        .trm-launcher { display: none; position: relative; width: 44px; height: 44px; border: 0; border-radius: 50%; background: transparent; color: #eee; cursor: pointer; font-size: 23px; }
        #trm-panel.trm-minimized .trm-launcher { display: flex; align-items: center; justify-content: center; position: relative; z-index: 5; flex: 0 0 44px; width: 44px; height: 44px; padding: 0; line-height: 1; pointer-events: auto; }
        .trm-bubble { position: absolute; top: -4px; right: -5px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 10px; background: #d71934; color: #fff; font: 700 11px/19px Arial, sans-serif; text-align: center; }
        .trm-header { display: grid; grid-template-columns: minmax(100px, 1fr) minmax(125px, 1.25fr) auto; align-items: start; column-gap: 10px; min-height: 58px; padding: 8px 9px; border-bottom: 1px solid #555; background: #2c2c2c; }
        .trm-header-left, .trm-header-center, .trm-header-right { min-width: 0; }
        .trm-header-center { display: flex; align-items: flex-start; justify-content: center; gap: 4px; }
        .trm-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .trm-controls { display: flex; align-items: center; gap: 2px; }
        .trm-title-wrap { min-width: 0; }
        .trm-title { font-weight: 700; }
        .trm-chain-link { display: inline-block; margin-top: 3px; color: #9fc8ff; font-size: 11px; text-decoration: none; }
        .trm-chain-link:hover { text-decoration: underline; }
        .trm-chain-stats { margin-top: 1px; color: #ccc; font-size: 11px; line-height: 1.4; text-align: left; white-space: nowrap; }
        .trm-chain-time { font-weight: 700; }
        .trm-chain-source { margin-left: 5px; font-size: 10px; font-weight: 700; opacity: .75; text-transform: uppercase; }
        .trm-chain-time.trm-warning { color: #ff6b6b; }
        .trm-status { color: #aaa; font-size: 11px; }
        .trm-icon { border: 0; padding: 2px 4px; background: transparent; color: #ddd; cursor: pointer; font-size: 15px; }
        .trm-body { max-height: calc(72vh - 58px); overflow-y: auto; padding: 8px; }
        .trm-empty, .trm-error, .trm-setup { padding: 11px; line-height: 1.45; color: #bbb; }
        .trm-error { color: #ff9a9a; }
        .trm-card { position: relative; margin-bottom: 8px; padding: 10px; border: 1px solid #4b4b4b; border-left: 4px solid #d71934; border-radius: 6px; background: #292929; }
        .trm-card:last-child { margin-bottom: 0; }
        .trm-name { padding-right: 22px; font-weight: 700; font-size: 14px; }
        .trm-name a { color: #f2f2f2; text-decoration: none; }
        .trm-meta { margin-top: 5px; color: #bbb; font-size: 12px; line-height: 1.45; }
        .trm-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .trm-badge { display: inline-flex; align-items: center; min-height: 19px; padding: 1px 6px; border: 1px solid #666; border-radius: 10px; background: #363636; color: #ddd; font-size: 10px; font-weight: 700; line-height: 1.2; }
        .trm-badge-retal { border-color: #a54b5a; background: #5d252f; }
        .trm-badge-war { border-color: #a27a36; background: #57431f; }
        .trm-badge-abroad { border-color: #477a9d; background: #243f52; }
        .trm-report { display: grid; grid-template-columns: auto 1fr; gap: 2px 7px; margin-top: 6px; color: #bbb; font-size: 11px; line-height: 1.35; }
        .trm-report-label { color: #888; }
        .trm-online { color: #66d17a; font-weight: 700; }
        .trm-offline { color: #aaa; font-weight: 700; }
        .trm-timer { color: #ffcc66; font-weight: 700; }
        .trm-actions { display: flex; gap: 6px; margin-top: 8px; }
        .trm-btn { flex: 1; padding: 6px 7px; border: 1px solid #666; border-radius: 4px; background: #3b3b3b; color: #eee; cursor: pointer; font-size: 12px; font-weight: 700; }
        .trm-btn:hover { background: #4a4a4a; }
        .trm-attack { border-color: #9a3545; background: #6b1d29; }
        .trm-attack:hover { background: #842536; }
        .trm-chat-send:disabled { opacity: .42; cursor: not-allowed; }
        .trm-chat-send.trm-chat-authorized { border-color: #4f9d68; background: #285b38; box-shadow: 0 0 8px rgba(92, 201, 121, .35); }
        .trm-chat-send.trm-chat-authorized:hover { background: #347548; }
        .trm-dismiss { position: absolute; top: 5px; right: 6px; border: 0; background: transparent; color: #999; cursor: pointer; font-size: 16px; }
        .trm-fields { display: grid; gap: 8px; }
        .trm-fields label { display: block; margin-bottom: 3px; color: #bbb; font-size: 12px; }
        .trm-fields input { width: 100%; padding: 7px; border: 1px solid #555; border-radius: 4px; background: #171717; color: #eee; }
        .trm-settings-actions { display: flex; gap: 6px; margin-top: 10px; }
    `);

    function makePanel() {
        let panel = document.getElementById('trm-panel');
        if (panel) return panel;
        panel = document.createElement('section');
        panel.id = 'trm-panel';
        if (GM_getValue(KEYS.minimized, false)) panel.classList.add('trm-minimized');
        panel.innerHTML = `<div class="trm-header"><button class="trm-launcher" id="trm-launcher" title="Open war dashboard">🚨<span class="trm-bubble" id="trm-bubble" style="display:none">0</span></button><div class="trm-header-left"><div class="trm-title-wrap"><div class="trm-title">🚨 Faction<br>Retaliations</div><a class="trm-chain-link" id="trm-chain-link" href="#" target="_blank" rel="noopener noreferrer" style="display:none"></a></div></div><div class="trm-header-center"><div class="trm-chain-stats" id="trm-chain-stats" style="display:none">Chain: <strong id="trm-chain-count">0 / 0</strong><br>Time remaining: <span class="trm-chain-time" id="trm-chain-time">--:--</span><span id="trm-chain-multiplier"></span><span class="trm-chain-source" id="trm-chain-source">API</span></div><button class="trm-icon" id="trm-sound" title="Chain alarm sound">🔇</button></div><div class="trm-header-right"><div class="trm-status" id="trm-status">Starting…</div><div class="trm-controls"><button class="trm-icon" id="trm-refresh" title="Refresh now">↻</button><button class="trm-icon" id="trm-settings" title="Settings">⚙️</button><button class="trm-icon" id="trm-collapse" title="Minimize and pause">—</button></div></div></div><div class="trm-body" id="trm-body"></div>`;
        document.body.appendChild(panel);
        updateChainLink(); updateChainDisplay(); updateSoundButton(); updateBubble(); bindPanelEvents(panel); return panel;
    }

    function bindPanelEvents(panel) {
        panel.querySelector('#trm-sound').addEventListener('click', toggleSound);
        panel.querySelector('#trm-refresh').addEventListener('click', async () => { const tornKey = GM_getValue(KEYS.tornApiKey, ''); const usedLive = scrapeActiveTabChainWidget(); await refreshChainLinkFromApi(tornKey, !usedLive); await poll(true); });
        panel.querySelector('#trm-settings').addEventListener('click', () => showSettings());
        panel.querySelector('#trm-collapse').addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); minimizePanel(); });
        panel.querySelector('#trm-launcher').addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); restorePanel(); });
    }

    function setStatus(text) { const node = document.getElementById('trm-status'); if (node) node.textContent = text; }

    function showSettings(errorMessage = '') {
        const body = document.getElementById('trm-body'); if (!body) return;
        const tornKey = GM_getValue(KEYS.tornApiKey, ''); const ffKey = GM_getValue(KEYS.ffApiKey, '');
        body.innerHTML = `<div class="trm-setup">${errorMessage ? `<div class="trm-error">${escapeHtml(errorMessage)}</div>` : ''}<div class="trm-fields"><div><label for="trm-torn-key">Torn API key</label><input id="trm-torn-key" type="password" value="${escapeAttribute(tornKey)}" placeholder="Key with faction attacks access"></div><div><label for="trm-ff-key">FFScouter-registered Torn API key</label><input id="trm-ff-key" type="password" value="${escapeAttribute(ffKey)}" placeholder="The Torn key registered with FFScouter"></div></div><div class="trm-settings-actions"><button class="trm-btn" id="trm-save">Save and start</button><button class="trm-btn" id="trm-clear">Clear</button></div></div>`;
        document.getElementById('trm-save').addEventListener('click', () => { GM_setValue(KEYS.tornApiKey, document.getElementById('trm-torn-key').value.trim()); GM_setValue(KEYS.ffApiKey, document.getElementById('trm-ff-key').value.trim()); GM_setValue(KEYS.factionId, 0); factionId = 0; activeRetals.clear(); ffCache.clear(); start(); });
        document.getElementById('trm-clear').addEventListener('click', () => { GM_setValue(KEYS.tornApiKey, ''); GM_setValue(KEYS.ffApiKey, ''); GM_setValue(KEYS.factionId, 0); factionId = 0; activeRetals.clear(); ffCache.clear(); setStatus('Setup required'); showSettings(); });
    }

    function stopRuntimeTimers() { if (pollTimer) clearInterval(pollTimer); if (secondTimer) clearInterval(secondTimer); if (chainTimer) clearInterval(chainTimer); pollTimer = null; secondTimer = null; chainTimer = null; }

    async function start() {
        if (starting) return;
        starting = true;
        try {
            makePanel(); stopRuntimeTimers();
            const tornKey = GM_getValue(KEYS.tornApiKey, ''); const ffKey = GM_getValue(KEYS.ffApiKey, '');
            if (GM_getValue(KEYS.minimized, false)) { updateBubble(); return; }
            if (!runtimeShouldRun()) { setStatus('Paused • another Torn tab owns API polling'); updateBubble(); return; }
            if (!tornKey || !ffKey) { setStatus('Setup required'); showSettings(); return; }
            if (!factionId) { setStatus('Finding faction…'); factionId = await getOwnFactionId(tornKey); GM_setValue(KEYS.factionId, factionId); }
            if (!runtimeShouldRun()) return;
            render(); const usedLive = scrapeActiveTabChainWidget(); await refreshChainLinkFromApi(tornKey, !usedLive); await poll(true);
            if (!runtimeShouldRun()) return;
            pollTimer = window.setInterval(() => poll(false), POLL_MS);
            secondTimer = window.setInterval(() => { updateTimers(); const updated = scrapeActiveTabChainWidget(); if (!updated && currentChainSeconds > 0) { currentChainSeconds = Math.max(0, currentChainSeconds - 1); updateChainDisplay(); } if (!updated && unixNow() % Math.round(POLL_MS / 1000) === 0) refreshChainLinkFromApi(tornKey, true); }, 1000);
            chainTimer = null;
        } catch (error) {
            if (runtimeShouldRun()) { console.error('[Retal Monitor]', error); setStatus('Setup error'); showSettings(error.message); }
        } finally {
            starting = false;
        }
    }

    async function poll(manual = false) {
        if (polling || !runtimeShouldRun()) return; const tornKey = GM_getValue(KEYS.tornApiKey, ''); const ffKey = GM_getValue(KEYS.ffApiKey, ''); if (!tornKey || !ffKey || !factionId) return;
        polling = true; setStatus(manual ? 'Refreshing…' : 'Checking…');
        try {
            const now = unixNow(); const attacks = await getFactionAttacks(tornKey, now - LOOKBACK_SECONDS, now); removeTargetsAlreadyHit(attacks);
            if (!runtimeShouldRun()) return;
            const dismissed = new Set(getDismissed()); const manuallyCleared = getManuallyCleared(); const resolved = getResolved(); const additions = [];
            for (const attack of attacks) {
                if (!isIncomingAttack(attack) || !isSuccessfulAttack(attack)) continue;
                const attackerId = getPlayerId(attack.attacker); if (!attackerId) continue;
                const attackId = String(attack.id ?? attack.attack_id ?? ''); if (!attackId) continue;
                const ended = Number(attack.ended ?? attack.ended_at ?? attack.timestamp_ended ?? attack.started ?? attack.started_at ?? 0); if (!ended) continue;
                const expiresAt = ended + RETAL_WINDOW_SECONDS;
                if (expiresAt <= now || dismissed.has(attackId) || (manuallyCleared[attackId] || 0) > now || (resolved[attackId] || 0) > now || activeRetals.has(attackId)) continue;
                const defenderId = getPlayerId(attack.defender); const location = getAttackLocation(attack); const flags = getAttackFlags(attack);
                additions.push({ attackId, incomingEnded: ended, expiresAt, attackerId, attackerName: getPlayerName(attack.attacker, attackerId), attackerFactionName: getFactionName(attack.attacker), attackerFactionTag: getFactionTag(attack.attacker), defenderId, defenderName: getPlayerName(attack.defender, defenderId), defenderStatus: getPlayerStatus(attack.defender), location, isAbroad: Boolean(location), isWar: flags.isWar, isRetal: flags.isRetal, profileUrl: `https://www.torn.com/profiles.php?XID=${attackerId}`, attackUrl: `https://www.torn.com/page.php?sid=attack&user2ID=${attackerId}`, ffData: ffCache.get(attackerId) || null });
            }
            const playerIdsToFetch = [...new Set([...additions.map(item => item.attackerId), ...[...activeRetals.values()].map(item => item.attackerId)].filter(Boolean))];
            if (playerIdsToFetch.length) await Promise.all(playerIdsToFetch.map(async playerId => { try { const basic = await getUserBasic(tornKey, playerId); playerBasicCache.set(playerId, basic); } catch (error) { if (!error?.runtimePaused) console.warn(`[Retal Monitor] Basic profile lookup failed for ${playerId}:`, error); } }));
            if (!runtimeShouldRun()) return;
            for (const [attackId, target] of activeRetals.entries()) { const basic = playerBasicCache.get(target.attackerId); if (basic && isPlayerHospitalized(basic)) { markResolved(attackId); activeRetals.delete(attackId); } }
            for (const item of additions) { const basic = playerBasicCache.get(item.attackerId); if (basic) { item.location = getPlayerLocation(basic) || item.location || ''; item.isAbroad = Boolean(item.location && item.location.toLowerCase() !== 'torn city'); item.attackerStatus = getPlayerStatus(basic) || item.attackerStatus || ''; } }
            const idsToFetch = [...new Set(additions.map(item => item.attackerId).filter(id => !ffCache.has(id)))];
            if (idsToFetch.length) { try { const ffResults = await getFFScouterStats(ffKey, idsToFetch); for (const item of ffResults) { const id = Number(item.player_id ?? item.playerId ?? item.id ?? item.user_id ?? 0); if (id) ffCache.set(id, item); } } catch (error) { if (!error?.runtimePaused) console.warn('[Retal Monitor] FFScouter lookup failed:', error); } }
            if (!runtimeShouldRun()) return;
            for (const item of additions) { item.ffData = ffCache.get(item.attackerId) || null; activeRetals.set(item.attackId, item); }
            cleanExpired(); trimDismissed(); trimManuallyCleared(); render(); setStatus(`API • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        } catch (error) { if (error?.runtimePaused) return; console.error('[Retal Monitor]', error); setStatus('API error'); if (!activeRetals.size) { const body = document.getElementById('trm-body'); if (body) body.innerHTML = `<div class="trm-error">${escapeHtml(error.message)}</div>`; } } finally { polling = false; }
    }

    function isIncomingAttack(attack) { const defenderFaction = getFactionId(attack.defender); const attackerFaction = getFactionId(attack.attacker); return defenderFaction === factionId && attackerFaction !== factionId; }
    function isSuccessfulAttack(attack) { const result = String(attack.result ?? attack.outcome ?? attack.attack_result ?? '').trim().toLowerCase(); return ['attacked','hospitalized','mugged'].includes(result); }
    function removeTargetsAlreadyHit(attacks) { if (!activeRetals.size) return; const outgoing = attacks.filter(attack => { const attackerFaction = getFactionId(attack.attacker); const defenderId = getPlayerId(attack.defender); const ended = Number(attack.ended ?? attack.ended_at ?? attack.timestamp_ended ?? 0); return attackerFaction === factionId && defenderId && ended && isSuccessfulAttack(attack); }); for (const [attackId, target] of activeRetals.entries()) { const wasHit = outgoing.some(attack => { const defenderId = getPlayerId(attack.defender); const ended = Number(attack.ended ?? attack.ended_at ?? attack.timestamp_ended ?? 0); return defenderId === target.attackerId && ended > target.incomingEnded; }); if (wasHit) { markResolved(attackId); activeRetals.delete(attackId); } } }

    function render() {
        const body = document.getElementById('trm-body'); if (!body) return; cleanExpired(); updateBubble(); updateChainDisplay();
        const items = [...activeRetals.values()].sort((a,b) => b.incomingEnded - a.incomingEnded);
        if (!items.length) { body.innerHTML = `<div class="trm-empty">No active incoming retaliation targets.</div>`; return; }
        body.innerHTML = '';
        for (const target of items) {
            const card = document.createElement('article'); card.className = 'trm-card'; card.dataset.attackId = target.attackId;
            const factionLabel = formatFactionLabel(target); const statusClass = String(target.defenderStatus || '').toLowerCase() === 'online' ? 'trm-online' : 'trm-offline';
            card.innerHTML = `<button class="trm-dismiss" title="Dismiss this retaliation">×</button><div class="trm-name"><a href="${target.profileUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(target.attackerName)} [${target.attackerId}]</a>${factionLabel ? ` <span>${escapeHtml(factionLabel)}</span>` : ''}</div><div class="trm-badges">${target.isRetal ? '<span class="trm-badge trm-badge-retal">🛡 Retal</span>' : ''}${target.isWar ? '<span class="trm-badge trm-badge-war">⚔ War</span>' : ''}${target.location ? `<span class="trm-badge trm-badge-abroad">${target.isAbroad ? '🌍' : '📍'} ${escapeHtml(target.location)}</span>` : ''}</div><div class="trm-report">${target.defenderName ? `<span class="trm-report-label">Attacked</span><span>${escapeHtml(target.defenderName)}${target.defenderId ? ` [${target.defenderId}]` : ''}</span>` : ''}${target.defenderStatus ? `<span class="trm-report-label">Status</span><span class="${statusClass}">${escapeHtml(target.defenderStatus)}</span>` : ''}${target.location ? `<span class="trm-report-label">Location</span><span>${escapeHtml(target.location)}</span>` : ''}<span class="trm-report-label">Estimate</span><span>${escapeHtml(formatFF(target.ffData))}</span><span class="trm-report-label">Expires</span><span class="trm-timer" data-expires="${target.expiresAt}">${formatCountdown(target.expiresAt)}</span></div><div class="trm-actions"><button class="trm-btn trm-copy">📋 Copy</button><button class="trm-btn trm-chat-send" data-attack-id="${target.attackId}" disabled title="Press Copy first. Send remains available for 30 seconds.">💬 Send</button><button class="trm-btn trm-attack">⚔️ ${target.location ? `Attack (${escapeHtml(target.location)})` : 'Attack'}</button></div>`;
            card.querySelector('.trm-copy').addEventListener('click', event => copyCallout(target, event.currentTarget));
            card.querySelector('.trm-chat-send').addEventListener('click', event => sendTargetToFactionChat(target, event.currentTarget));
            card.querySelector('.trm-attack').addEventListener('click', () => window.open(target.attackUrl, '_blank', 'noopener,noreferrer'));
            card.querySelector('.trm-dismiss').addEventListener('click', () => dismiss(target)); body.appendChild(card);
        }
        updateChatSendButtons();
    }

    function updateTimers() { cleanExpired(); updateBubble(); updateChainDisplay(); const visibleCards = document.querySelectorAll('.trm-card'); if (visibleCards.length !== activeRetals.size) { render(); return; } document.querySelectorAll('.trm-timer').forEach(node => node.textContent = formatCountdown(Number(node.dataset.expires))); }
    function cleanExpired() { const now = unixNow(); for (const [id,target] of activeRetals.entries()) if (target.expiresAt <= now) activeRetals.delete(id); }
    function dismiss(target) { const attackId = String(target.attackId); const list = getDismissed(); if (!list.includes(attackId)) { list.push(attackId); GM_setValue(KEYS.dismissed, list.slice(-200)); } const manuallyCleared = getManuallyCleared(); manuallyCleared[attackId] = unixNow() + RESOLVED_MEMORY_SECONDS; GM_setValue(KEYS.manuallyCleared, manuallyCleared); markResolved(attackId); activeRetals.delete(attackId); if (pendingChatSend?.attackId === attackId) clearPendingChatSend(); render(); }
    function getResolved() { const value = GM_getValue(KEYS.resolved, {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    function markResolved(attackId) { const resolved = getResolved(); resolved[String(attackId)] = unixNow() + RESOLVED_MEMORY_SECONDS; const entries = Object.entries(resolved).filter(([,expiresAt]) => Number(expiresAt) > unixNow()).sort((a,b) => Number(a[1])-Number(b[1])).slice(-500); GM_setValue(KEYS.resolved, Object.fromEntries(entries)); }
    function trimResolved() { const now = unixNow(); const resolved = getResolved(); const trimmed = {}; for (const [attackId,expiresAt] of Object.entries(resolved)) if (Number(expiresAt)>now) trimmed[attackId]=Number(expiresAt); GM_setValue(KEYS.resolved, trimmed); }
    function getManuallyCleared() { const value = GM_getValue(KEYS.manuallyCleared, {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    function trimManuallyCleared() { const now=unixNow(); const value=getManuallyCleared(); const trimmed={}; for (const [attackId,expiresAt] of Object.entries(value)) if (Number(expiresAt)>now) trimmed[attackId]=Number(expiresAt); GM_setValue(KEYS.manuallyCleared, trimmed); }
    function getDismissed() { const value=GM_getValue(KEYS.dismissed,[]); return Array.isArray(value)?value.map(String):[]; }
    function trimDismissed() { const manuallyCleared=getManuallyCleared(); const trimmed=getDismissed().filter(id=>Number(manuallyCleared[id]||0)>unixNow()).slice(-200); GM_setValue(KEYS.dismissed,trimmed); }

    function buildCallout(target) { const linkedName=`<a href="${target.profileUrl}">${escapeHtml(target.attackerName)} [${target.attackerId}]</a>`; const linkedAttack=`<a href="${target.attackUrl}">Attack</a>`; const details=[formatFactionLabel(target),target.isRetal?'Retal':'',target.isWar?'War':'',target.location?`Location: ${target.location}`:'',target.defenderName?`Attacked: ${target.defenderName}${target.defenderId?` [${target.defenderId}]`:''}`:'',target.defenderStatus?`Status: ${target.defenderStatus}`:''].filter(Boolean); return `🚨 Retaliation: Please Hospitalize 🚨<br>${linkedName} - ${linkedAttack} - (${escapeHtml(formatFF(target.ffData))})`+(details.length?`<br>${escapeHtml(details.join(' • '))}`:''); }
    function copyCallout(target,button) { const message=buildCallout(target); copyText(message); authorizeChatSend(target,message); const original=button.textContent; button.textContent='✅ Copied'; setTimeout(()=>{button.textContent=original;},1300); }
    function copyText(text) { void TornLib.copyText(text); }

    function clearPendingChatSend(){pendingChatSend=null;if(pendingChatSendTimer){clearTimeout(pendingChatSendTimer);pendingChatSendTimer=null;}updateChatSendButtons();}
    function updateChatSendButtons(){const now=Date.now();if(pendingChatSend&&pendingChatSend.expiresAt<=now)pendingChatSend=null;document.querySelectorAll('.trm-chat-send').forEach(button=>{const attackId=String(button.dataset.attackId||'');const authorized=Boolean(pendingChatSend&&pendingChatSend.attackId===attackId&&pendingChatSend.expiresAt>now);button.disabled=!authorized;button.classList.toggle('trm-chat-authorized',authorized);button.title=authorized?'Send the copied callout to Faction Chat':'Press Copy first. Send remains available for 30 seconds.';});}
    function authorizeChatSend(target,frozenMessage){if(pendingChatSendTimer)clearTimeout(pendingChatSendTimer);pendingChatSend={attackId:String(target.attackId),message:frozenMessage,expiresAt:Date.now()+CHAT_COPY_AUTHORIZATION_MS};pendingChatSendTimer=setTimeout(()=>{pendingChatSendTimer=null;clearPendingChatSend();},CHAT_COPY_AUTHORIZATION_MS);updateChatSendButtons();}
    function findFactionChatContainer(){const factionWindows=[...document.querySelectorAll('[id^="faction-"]')];const exactWindow=factionWindows.find(node=>node.querySelector('textarea[placeholder="Type your message here..."], textarea[class*="textarea"]'));if(exactWindow)return exactWindow;return [...document.querySelectorAll('div, section')].find(node=>{const title=node.querySelector('button span, header span');const composer=node.querySelector('textarea[placeholder*="message" i], [contenteditable="true"]');return composer&&String(title?.textContent||'').trim().toLowerCase()==='faction';})||null;}
    function findFactionChatLauncher(){return [...document.querySelectorAll('button, a, [role="button"]')].find(node=>{const label=[node.getAttribute?.('aria-label'),node.getAttribute?.('title'),node.textContent].filter(Boolean).join(' ').trim().toLowerCase();return label==='faction'||label.includes('faction chat')||label.includes('open faction');})||null;}
    function findFactionChatComposer(container){if(!container)return null;return container.querySelector('textarea[placeholder="Type your message here..."], textarea[class*="textarea"], textarea, [contenteditable="true"]');}
    function setChatComposerContent(composer,html){composer.focus();if(composer.matches('textarea, input')){const prototype=composer.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;if(setter)setter.call(composer,html);else composer.value=html;}else{composer.innerHTML='';try{document.execCommand('insertHTML',false,html);}catch{composer.innerHTML=html;}}try{composer.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:html}));}catch{composer.dispatchEvent(new Event('input',{bubbles:true,composed:true}));}composer.dispatchEvent(new Event('change',{bubbles:true,composed:true}));}
    function findChatSendButton(container,composer){const composerRow=composer?.parentElement;const siblingButton=composerRow?.querySelector('button');if(siblingButton)return siblingButton;const scope=container||composer?.closest('[id^="faction-"]')||document;const buttons=[...scope.querySelectorAll('button, [role="button"]')];return buttons.find(button=>{const label=[button.getAttribute('aria-label'),button.getAttribute('title'),button.textContent].filter(Boolean).join(' ').trim().toLowerCase();const containsSendIcon=Boolean(button.querySelector('svg[viewBox="0 0 18 18"]'));return button.type==='submit'||label==='send'||label.includes('send message')||containsSendIcon;})||null;}
    async function waitForFactionChat(timeoutMs=2500){const started=Date.now();while(Date.now()-started<timeoutMs){const container=findFactionChatContainer();const composer=findFactionChatComposer(container);if(container&&composer)return{container,composer};await new Promise(resolve=>setTimeout(resolve,100));}return{container:null,composer:null};}
    async function waitForEnabledButton(button,timeoutMs=1500){const started=Date.now();while(Date.now()-started<timeoutMs){if(button&&!button.disabled&&button.getAttribute('aria-disabled')!=='true')return true;await new Promise(resolve=>setTimeout(resolve,50));}return false;}
    async function sendTargetToFactionChat(target,button){const attackId=String(target.attackId);const authorization=pendingChatSend;if(!authorization||authorization.attackId!==attackId||authorization.expiresAt<=Date.now()){clearPendingChatSend();alert('Press Copy for this retaliation first. Send is enabled for 30 seconds after Copy.');return;}if(!pageHasFocus()){alert('Open and focus the Torn tab before sending to Faction Chat.');return;}const frozenMessage=authorization.message;const original=button.textContent;button.disabled=true;button.textContent='…';try{let{container,composer}=await waitForFactionChat(250);if(!container||!composer){const launcher=findFactionChatLauncher();if(!launcher)throw new Error('Faction Chat could not be found. Open Faction Chat and try again.');launcher.click();({container,composer}=await waitForFactionChat());}if(!container||!composer)throw new Error('Faction Chat opened, but its message box could not be found.');setChatComposerContent(composer,frozenMessage);const sendButton=findChatSendButton(container,composer);if(!sendButton)throw new Error('The Faction Chat send button could not be found.');const enabled=await waitForEnabledButton(sendButton);if(!enabled)throw new Error('The message was placed in Faction Chat, but Torn did not enable the Send button.');sendButton.click();button.textContent='✓';clearPendingChatSend();}catch(error){console.warn('[Retal Monitor] Faction Chat send failed:',error);alert(error.message);button.textContent='!';updateChatSendButtons();}finally{setTimeout(()=>{button.textContent=original;updateChatSendButtons();},1200);}}

    async function getOwnFactionId(apiKey){const data=await tornRequest('https://api.torn.com/v2/user/faction',apiKey);const id=Number(data.faction?.id??data.profile?.faction?.id??data.id??0);if(!id)throw new Error('Could not determine your faction ID. Check the Torn API key and its access.');return id;}
    function pageIsActiveTab(){return TornLib.isPageActive({requireFocus:false});}
    function pageHasFocus(){return TornLib.isPageActive();}
    function runtimeShouldRun(){return !GM_getValue(KEYS.minimized,false)&&Boolean(apiLease?.isLeader());}
    function findChainWidget(){return document.querySelector('a[href*="factions.php?step=your#/war/chain"]')||document.querySelector('a[href*="#/war/chain"]')||document.querySelector('a[class*="chain-bar___"]');}
    function scrapeActiveTabChainWidget(){if(GM_getValue(KEYS.minimized,false)||!pageHasFocus())return false;const widget=findChainWidget();if(!widget)return false;const valueNode=widget.querySelector('p[class*="bar-value___"]');const timeNode=widget.querySelector('p[class*="bar-timeleft___"]');const multiplierNode=widget.querySelector('span[class*="value___"]');if(!valueNode||!timeNode)return false;const chainText=(valueNode.textContent||'').trim();const timeText=(timeNode.textContent||'').trim();const multiplierText=(multiplierNode?.textContent||'').trim();const chainMatch=chainText.match(/^([\d,.]+)\s*\/\s*([\d,.]+[kKmMbB]?)$/);const timeMatch=timeText.match(/^(\d{1,2}):(\d{2})$/);if(!chainMatch||!timeMatch)return false;currentChainCount=parseCompactNumber(chainMatch[1]);currentChainBonus=parseCompactNumber(chainMatch[2]);currentChainMultiplier=multiplierText;currentChainSeconds=Number(timeMatch[1])*60+Number(timeMatch[2]);chainDeadline=unixNow()+currentChainSeconds;chainDataSource='Live';updateChainDisplay();return true;}
    async function refreshChainLinkFromApi(apiKey,forceChainData=false){if(!apiKey||!runtimeShouldRun())return;try{const data=await tornRequest('https://api.torn.com/v2/faction/chain',apiKey);if(!runtimeShouldRun())return;const chain=data.chain??data.faction?.chain??data;currentChainId=Number(chain?.id??chain?.chain_id??chain?.chainId??data.chain_id??0)||0;updateChainLink();if(forceChainData||!scrapeActiveTabChainWidget()){const now=unixNow();const rawTimeout=Number(chain?.timeout??chain?.time_left??chain?.timeLeft??0);currentChainCount=Number(chain?.current??chain?.hits??chain?.chain??0)||0;currentChainBonus=CHAIN_BONUSES.find(bonus=>bonus>currentChainCount)||0;if(rawTimeout>now){chainDeadline=rawTimeout;currentChainSeconds=rawTimeout-now;}else if(rawTimeout>0){chainDeadline=now+rawTimeout;currentChainSeconds=rawTimeout;}currentChainMultiplier='';chainDataSource='API';updateChainDisplay();}}catch(error){if(runtimeShouldRun())console.warn('[Retal Monitor] Chain link lookup failed:',error);}}
    function updateChainLink(){const link=document.getElementById('trm-chain-link');if(!link)return;if(!currentChainId){link.style.display='none';link.removeAttribute('href');link.textContent='';return;}link.href='https://www.torn.com/war.php?step=chainreport&chainID='+encodeURIComponent(currentChainId);link.textContent=`View chain report #${currentChainId}`;link.style.display='inline-block';}
    function updateChainDisplay(){const panel=document.getElementById('trm-panel'),stats=document.getElementById('trm-chain-stats'),count=document.getElementById('trm-chain-count'),time=document.getElementById('trm-chain-time'),multiplier=document.getElementById('trm-chain-multiplier'),source=document.getElementById('trm-chain-source');if(!panel||!stats||!count||!time||!multiplier||!source)return;if(!currentChainCount&&!currentChainSeconds){stats.style.display='none';panel.classList.remove('trm-chain-warning');resetAlarmState();return;}stats.style.display='block';count.textContent=currentChainBonus?`${currentChainCount.toLocaleString()} / ${currentChainBonus.toLocaleString()}`:currentChainCount.toLocaleString();time.textContent=currentChainSeconds>0?formatDuration(currentChainSeconds):'--:--';multiplier.textContent=currentChainMultiplier?` • ${currentChainMultiplier}`:'';source.textContent=chainDataSource;source.title=chainDataSource==='Live'?'Scraped from the focused Torn page':'Loaded from the Torn API';const warning=currentChainCount>=50&&currentChainSeconds>0&&currentChainSeconds<90&&!GM_getValue(KEYS.minimized,false);time.classList.toggle('trm-warning',warning);panel.classList.toggle('trm-chain-warning',warning);handleChainAlarm(currentChainSeconds);}
    function updateSoundButton(){const button=document.getElementById('trm-sound');if(!button)return;const enabled=Boolean(GM_getValue(KEYS.soundEnabled,false));button.textContent=enabled?'🔊':'🔇';button.title=enabled?'Chain alarm sound is on':'Chain alarm sound is off';}
    function toggleSound(){const enabled=!Boolean(GM_getValue(KEYS.soundEnabled,false));GM_setValue(KEYS.soundEnabled,enabled);updateSoundButton();if(enabled)playAlarmTone(.08);}
    function handleChainAlarm(seconds){if(GM_getValue(KEYS.minimized,false)||!pageHasFocus()||currentChainCount<50||!GM_getValue(KEYS.soundEnabled,false)||seconds<=0||seconds>=90){if(seconds>=90||seconds<=0)resetAlarmState();return;}let threshold=90;if(seconds<=30)threshold=30;else if(seconds<=60)threshold=60;if(lastAlarmThreshold===threshold)return;lastAlarmThreshold=threshold;playAlarmTone(.22);window.setTimeout(()=>playAlarmTone(.18),260);}
    function resetAlarmState(){lastAlarmThreshold=0;}
    function playAlarmTone(volume=.2){try{const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)return;const context=new AudioContextClass(),oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='square';oscillator.frequency.setValueAtTime(760,context.currentTime);gain.gain.setValueAtTime(volume,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.18);oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.18);oscillator.addEventListener('ended',()=>context.close());}catch(error){console.warn('[Retal Monitor] Could not play alarm:',error);}}
    function updateBubble(){const bubble=document.getElementById('trm-bubble');if(!bubble)return;const count=activeRetals.size;bubble.textContent=String(count);bubble.style.display=count?'block':'none';}
    function minimizePanel(){const panel=document.getElementById('trm-panel');if(!panel)return;panel.classList.add('trm-minimized');panel.classList.remove('trm-chain-warning');GM_setValue(KEYS.minimized,true);apiLease?.refresh();resetAlarmState();stopRuntimeTimers();updateBubble();}
    function restorePanel(){const panel=document.getElementById('trm-panel');if(!panel)return;panel.classList.remove('trm-minimized');GM_setValue(KEYS.minimized,false);apiLease?.refresh();scrapeActiveTabChainWidget();syncRuntimeState();}
    function parseCompactNumber(value){const normalized=String(value).trim().replace(/,/g,'').toLowerCase();const match=normalized.match(/^([\d.]+)\s*([kmb])?$/);if(!match)return Number(normalized)||0;const multipliers={k:1_000,m:1_000_000,b:1_000_000_000};return Math.round(Number(match[1])*(multipliers[match[2]]||1));}
    function formatDuration(totalSeconds){return TornLib.formatDuration(totalSeconds);}

    async function getUserBasic(apiKey,playerId){const data=await tornRequest(`https://api.torn.com/v2/user/${encodeURIComponent(playerId)}/profile`,apiKey);return data?.profile??data?.basic??data?.user??data;}
    async function getFactionAttacks(apiKey,from,to){const url='https://api.torn.com/v2/faction/attacks'+`?from=${encodeURIComponent(from)}`+`&to=${encodeURIComponent(to)}`+`&limit=${MAX_RESULTS}`+'&sort=desc';const data=await tornRequest(url,apiKey);const attacks=data.attacks??data.faction?.attacks??[];if(!Array.isArray(attacks))throw new Error('Torn returned no attacks list. The key may need faction attacks access.');return attacks;}
    async function getFFScouterStats(apiKey,playerIds){if(!playerIds.length)return[];const targets=playerIds.join(',');const url='https://ffscouter.com/api/v1/get-stats'+`?key=${encodeURIComponent(apiKey)}`+`&targets=${encodeURIComponent(targets)}`;const data=await requestJson(url);if(Array.isArray(data))return data;if(Array.isArray(data.results))return data.results;if(Array.isArray(data.data))return data.data;throw new Error(data.error?.message??data.error??'FFScouter returned an unexpected response.');}
    function pausedRequestError(){const error=new Error('Retaliation Monitor API work is paused because another Torn tab owns polling or the panel is minimized.');error.runtimePaused=true;return error;}
    function tornRequest(url,apiKey){if(!runtimeShouldRun())return Promise.reject(pausedRequestError());return TornLib.tornRequest(url,apiKey,{timeout:12_000,tornScript:'Retaliation Monitor',invalidJsonMessage:'The API returned invalid JSON.',networkErrorMessage:'Network error while contacting the API.',timeoutMessage:'The API request timed out.'});}
    function requestJson(url,headers={}){if(!runtimeShouldRun())return Promise.reject(pausedRequestError());return TornLib.requestJson(url,{headers,timeout:12_000,invalidJsonMessage:'The API returned invalid JSON.',networkErrorMessage:'Network error while contacting the API.',timeoutMessage:'The API request timed out.',httpErrorMessage:(response,data)=>TornLib.errorMessage(data,`API request failed with status ${response.status}.`)});}

    function getFactionName(side){return String(side?.faction?.name??side?.faction_name??side?.factionName??'').trim();}
    function getFactionTag(side){return String(side?.faction?.tag??side?.faction_tag??side?.factionTag??side?.faction?.short_name??'').trim();}
    function formatFactionLabel(target){const tag=String(target.attackerFactionTag||'').trim(),name=String(target.attackerFactionName||'').trim();if(tag)return`[${tag}]`;if(name)return`[${name}]`;return'';}
    function getPlayerStatus(side){const raw=side?.status?.description??side?.status?.state??side?.status??side?.last_action?.status??side?.lastAction?.status??'';if(typeof raw!=='string')return'';const normalized=raw.trim();if(!normalized)return'';const lower=normalized.toLowerCase();if(lower.includes('online'))return'Online';if(lower.includes('idle'))return'Idle';if(lower.includes('offline'))return'Offline';return normalized;}
    function isPlayerHospitalized(player){const source=player?.profile??player?.basic??player?.user??player;const state=String(source?.status?.state??source?.status?.description??source?.status?.details??source?.status??'').trim().toLowerCase();return state==='hospital'||state==='hospitalized'||state.includes('in hospital')||state.includes('hospitalized');}
    function getPlayerLocation(player){const source=player?.profile??player?.basic??player?.user??player;const raw=source?.status?.description??source?.status?.details??source?.location?.country??source?.location?.name??source?.location??source?.country??'';if(typeof raw==='object'&&raw)return String(raw.country??raw.name??raw.description??raw.details??'').trim();const value=String(raw||'').trim();if(!value)return'';const patterns=[/traveling to\s+(.+)$/i,/returning from\s+(.+)$/i,/traveling from\s+(.+)$/i,/in\s+(.+)$/i];for(const pattern of patterns){const match=value.match(pattern);if(match)return match[1].trim();}if(/^okay$/i.test(value))return'Torn City';if(/hospital|jail|fallen|federal|online|offline|idle/i.test(value))return'';return value;}
    function getAttackLocation(attack){const raw=attack?.location??attack?.country??attack?.attacker?.location?.country??attack?.attacker?.location?.name??attack?.attacker?.country??attack?.modifiers?.location??attack?.modifiers?.abroad??'';if(typeof raw==='object'&&raw)return String(raw.country??raw.name??raw.description??'').trim();const value=String(raw||'').trim();if(!value||value==='0'||value.toLowerCase()==='torn')return'';return value;}
    function getAttackFlags(attack){const modifiers=attack?.modifiers??{},respect=attack?.respect??{},code=String(attack?.code??attack?.type??attack?.attack_type??'').toLowerCase();const retalValue=modifiers?.retaliation??modifiers?.retal??respect?.retaliation??respect?.retal??attack?.is_retaliation??attack?.isRetaliation??0;const warValue=modifiers?.war??modifiers?.war_bonus??modifiers?.warBonus??respect?.war??respect?.war_bonus??attack?.is_war??attack?.isWar??0;const modifierIsActive=value=>{if(value===true)return true;const normalized=String(value??'').trim().toLowerCase();if(normalized==='true'||normalized==='yes')return true;const numeric=Number(value);return Number.isFinite(numeric)&&numeric>1;};return{isRetal:modifierIsActive(retalValue)||code.includes('retal'),isWar:modifierIsActive(warValue)||code.includes('war')};}
    function getFactionId(side){return Number(side?.faction?.id??side?.faction_id??side?.factionId??0);}
    function getPlayerId(side){return Number(side?.id??side?.player_id??side?.user_id??0);}
    function getPlayerName(side,id){return String(side?.name??side?.player_name??side?.username??`Player ${id}`);}
    function formatFF(data){if(!data)return'FFScouter estimate unavailable';const parts=[];const ff=Number(data.fair_fight??data.fairFight??data.ff??NaN);if(Number.isFinite(ff))parts.push(`FF ${ff.toFixed(2)}`);const human=data.bs_estimate_human??data.estimate_human??data.battle_stats_human;const raw=Number(data.bs_estimate??data.estimate??data.battle_stats??NaN);if(human)parts.push(`~${String(human).toUpperCase()} total`);else if(Number.isFinite(raw))parts.push(`~${shortNumber(raw)} total`);return parts.length?parts.join(' | '):'FFScouter estimate unavailable';}
    function shortNumber(value){return TornLib.shortNumber(value);}
    function ageText(timestamp){const seconds=Math.max(0,unixNow()-timestamp);if(seconds<60)return`${seconds}s old`;if(seconds<3600)return`${Math.floor(seconds/60)}m old`;if(seconds<86400)return`${Math.floor(seconds/3600)}h old`;return`${Math.floor(seconds/86400)}d old`;}
    function formatCountdown(expiresAt){const seconds=Math.max(0,expiresAt-unixNow());const minutes=Math.floor(seconds/60);const remainder=seconds%60;return`${minutes}:${String(remainder).padStart(2,'0')}`;}
    function unixNow(){return TornLib.unixNow();}
    function escapeHtml(value){return TornLib.escapeHtml(value);}
    function escapeAttribute(value){return TornLib.escapeAttribute(value);}

    function syncRuntimeState(){
        const panel=makePanel();
        const minimized=GM_getValue(KEYS.minimized,false);
        panel.classList.toggle('trm-minimized',minimized);
        if(!runtimeShouldRun()){
            stopRuntimeTimers();
            panel.classList.remove('trm-chain-warning');
            resetAlarmState();
            if(!minimized)setStatus('Paused • another Torn tab owns API polling');
            updateBubble();
            return;
        }
        scrapeActiveTabChainWidget();
        if(!pollTimer&&!starting)void start();
    }
    document.addEventListener('visibilitychange',syncRuntimeState);
    window.addEventListener('focus',syncRuntimeState);
    window.addEventListener('blur',syncRuntimeState);
    window.addEventListener('beforeunload',()=>{stopRuntimeTimers();apiLease?.destroy();});
    makePanel();
    apiLease=TornLib.createTabLeaderLease('incoming-retaliation-monitor',{
        isEligible:()=>!GM_getValue(KEYS.minimized,false),
        onChange:isLeader=>syncRuntimeState(isLeader),
    });
    syncRuntimeState();
})();
