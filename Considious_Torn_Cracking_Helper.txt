// ==UserScript==
// @name         Considious Torn Cracking Helper
// @namespace    Considious [3853023]
// @version      2.1.0
// @description  Focus-only Cracking pattern helper with a local dictionary and opt-in password contributions.
// @author       Considious [3853023]
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Considious_Torn_Cracking_Helper.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Considious_Torn_Cracking_Helper.user.js
// @match        https://www.torn.com/page.php?sid=crimes*
// @match        https://www.torn.com/loader.php?sid=crimes*
// @match        https://www.torn.com/load.php?sid=crimes*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      raw.githubusercontent.com
// @connect      docs.google.com
// ==/UserScript==

(() => {
    'use strict';

    /*
     * COMPLIANCE / SAFETY BOUNDARY
     * ----------------------------
     * - Reads Torn DOM content ONLY while this tab is visible AND focused.
     * - Stops scanning immediately when focus or visibility is lost.
     * - Never clicks, types, guesses, or performs any Torn game action.
     * - Dictionary downloads are manual.
     * - Contributions are optional, password-only, batched, and never sent
     *   while the tab is hidden, unfocused, or this helper is minimized.
     */

    if (window.__CONSIDIOUS_TORN_CRACKING_HELPER__) return;
    window.__CONSIDIOUS_TORN_CRACKING_HELPER__ = true;

    const DICTIONARY_URL =
        'https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Torn_Cracking_Combined_Passwords.txt';
    const FORM_URL =
        'https://docs.google.com/forms/d/e/1FAIpQLSeC4zsiUuEkuN_Y0oDAojtdbhOTKTcatu1qBSMX70XzTX_T9w/formResponse';
    const FORM_FIELD = 'entry.1357326866';

    const MIN_LENGTH = 4;
    const MAX_LENGTH = 10;
    const MAX_RESULTS = 40;
    const BATCH_SIZE = 100;
    const IDLE_SUBMIT_MS = 5 * 60 * 1000;
    const SCAN_DELAY_MS = 500;
    const DB_NAME = 'considious-torn-cracking-helper';
    const DB_VERSION = 1;

    const PREF = {
        consent: 'ctch_contribution_consent_v1',
        consentAsked: 'ctch_contribution_consent_asked_v1',
        paused: 'ctch_helper_paused_v2',
        settingsOpen: 'ctch_settings_open_v2',
    };

    const COMMON_CORES = new Set([
        'ADMIN', 'ANGEL', 'BABY', 'BEAR', 'BLUE', 'BOSS', 'CHARLIE',
        'CHEESE', 'COOKIE', 'DARK', 'DOG', 'DRAGON', 'FAMILY', 'FIRE',
        'FLOWER', 'FOOTBALL', 'FREAK', 'FREEDOM', 'FUCKYOU', 'GINGER',
        'GREEN', 'HAMMER', 'HAPPY', 'HARLEY', 'HELLO', 'HONEY', 'HUNTER',
        'ILOVEYOU', 'JORDAN', 'KING', 'LETMEIN', 'LOVE', 'LUCKY', 'MASTER',
        'MICHAEL', 'MONKEY', 'MUSTANG', 'PASSWORD', 'PEANUT', 'PRINCESS',
        'QWERTY', 'RANGER', 'ROCKYOU', 'SECRET', 'SHADOW', 'SOCCER',
        'SUMMER', 'SUNSHINE', 'SUPERMAN', 'TIGGER', 'TRUST', 'WELCOME',
        'WHATEVER', 'WINTER'
    ]);

    let db;
    let wordsByLength = new Map();
    let dictionaryCount = 0;
    let dictionaryUpdatedAt = '';
    let scanTimer = null;
    let idleSubmitTimer = null;
    let observer = null;
    let minimized = false;
    let submitting = false;
    let statusMessage = 'Opening local storage…';
    let lastPatterns = new WeakMap();
    const rowHelpers = new Map();
    let activePopup = null;
    let popupCloseTimer = null;
    const candidateCache = new Map();

    function isFocusedAndVisible() {
        return document.visibilityState === 'visible' && document.hasFocus();
    }

    function mayReadTorn() {
        return isFocusedAndVisible() && !minimized;
    }

    function normalizePassword(value) {
        const password = String(value || '').trim().toUpperCase();
        if (password.length < MIN_LENGTH || password.length > MAX_LENGTH) return '';
        return /^[A-Z0-9_.]+$/.test(password) ? password : '';
    }

    function normalizePattern(value) {
        return String(value || '')
            .toUpperCase()
            .replace(/[Ø]/g, '0')
            .replace(/[\s*\-]/g, '?')
            .replace(/[^A-Z0-9_.?]/g, '?')
            .slice(0, MAX_LENGTH);
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const next = request.result;
                if (!next.objectStoreNames.contains('dictionary')) {
                    next.createObjectStore('dictionary');
                }
                if (!next.objectStoreNames.contains('meta')) {
                    next.createObjectStore('meta');
                }
                if (!next.objectStoreNames.contains('passwords')) {
                    const store = next.createObjectStore('passwords', {
                        keyPath: 'password',
                    });
                    store.createIndex('status', 'status', { unique: false });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function idbRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function transactionDone(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }

    async function loadDictionary() {
        const transaction = db.transaction(['dictionary', 'meta'], 'readonly');
        const dictionary = transaction.objectStore('dictionary');
        const meta = transaction.objectStore('meta');
        const buckets = new Map();
        const requests = [];

        for (let length = MIN_LENGTH; length <= MAX_LENGTH; length++) {
            requests.push(
                idbRequest(dictionary.get(`length-${length}`))
                    .then(words => buckets.set(length, words || []))
            );
        }
        const countPromise = idbRequest(meta.get('dictionaryCount'));
        const datePromise = idbRequest(meta.get('dictionaryUpdatedAt'));
        await Promise.all(requests);
        dictionaryCount = Number(await countPromise) || 0;
        dictionaryUpdatedAt = String(await datePromise || '');
        wordsByLength = buckets;
        statusMessage = dictionaryCount
            ? `${dictionaryCount.toLocaleString()} dictionary passwords loaded`
            : 'No dictionary downloaded yet';
        updateStatus();
    }

    function requestText(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || 'GET',
                url,
                data: options.data,
                headers: options.headers || { Accept: 'text/plain, */*' },
                timeout: options.timeout || 120000,
                onload: response => {
                    if (response.status >= 200 && response.status < 400) {
                        resolve(response.responseText || '');
                    } else {
                        reject(new Error(`HTTP ${response.status}`));
                    }
                },
                onerror: () => reject(new Error('Network request failed')),
                ontimeout: () => reject(new Error('Network request timed out')),
            });
        });
    }

    async function updateDictionary(button) {
        if (!isFocusedAndVisible()) {
            setStatus('Focus this tab before updating.');
            return;
        }
        button.disabled = true;
        setStatus('Downloading the combined dictionary…');
        try {
            const text = await requestText(`${DICTIONARY_URL}?v=${Date.now()}`);
            if (!isFocusedAndVisible()) {
                throw new Error('tab lost focus; update cancelled');
            }

            const unique = new Set(
                text.split(/\r?\n/).map(normalizePassword).filter(Boolean)
            );
            const buckets = new Map();
            for (let length = MIN_LENGTH; length <= MAX_LENGTH; length++) {
                buckets.set(length, []);
            }
            for (const word of unique) buckets.get(word.length).push(word);
            for (const words of buckets.values()) words.sort();

            const transaction = db.transaction(['dictionary', 'meta'], 'readwrite');
            const dictionary = transaction.objectStore('dictionary');
            const meta = transaction.objectStore('meta');
            const updatedAt = new Date().toISOString();
            for (const [length, words] of buckets) {
                dictionary.put(words, `length-${length}`);
            }
            meta.put(unique.size, 'dictionaryCount');
            meta.put(updatedAt, 'dictionaryUpdatedAt');
            meta.put(DICTIONARY_URL, 'dictionarySource');
            await transactionDone(transaction);

            wordsByLength = buckets;
            dictionaryCount = unique.size;
            dictionaryUpdatedAt = updatedAt;
            candidateCache.clear();
            setStatus(`${unique.size.toLocaleString()} dictionary passwords saved`);
            scheduleScan();
        } catch (error) {
            setStatus(`Dictionary update failed: ${error.message}`);
        } finally {
            button.disabled = false;
        }
    }

    function candidateScore(word) {
        let score = 0;
        const runs = word.match(/[A-Z]{3,}/g) || [];
        let core = '';
        for (const run of runs) {
            for (let size = run.length; size >= 3; size--) {
                for (let start = 0; start + size <= run.length; start++) {
                    const piece = run.slice(start, start + size);
                    const known = COMMON_CORES.has(piece);
                    const pieceScore = (known ? 1000 : 0) + piece.length;
                    if (pieceScore > score) {
                        score = pieceScore;
                        core = piece;
                    }
                }
            }
        }
        if (/^[0-9]+[A-Z]{3,}[0-9]+$/.test(word)) score += 180;
        if (/^[A-Z]+[0-9]{1,4}$/.test(word)) score += 120;
        if (/^[0-9]{1,4}[A-Z]+$/.test(word)) score += 100;
        if (/[_.]/.test(word)) score += 60;
        return { score, core };
    }

    function getCandidates(pattern) {
        const normalized = normalizePattern(pattern);
        if (normalized.length < MIN_LENGTH) return { total: 0, results: [] };
        if (candidateCache.has(normalized)) return candidateCache.get(normalized);

        const pool = wordsByLength.get(normalized.length) || [];
        const known = [...normalized];
        const matches = [];
        for (const word of pool) {
            let matchesPattern = true;
            for (let index = 0; index < known.length; index++) {
                if (known[index] !== '?' && known[index] !== word[index]) {
                    matchesPattern = false;
                    break;
                }
            }
            if (matchesPattern) {
                const ranking = candidateScore(word);
                matches.push({ word, ...ranking });
            }
        }
        const total = matches.length;
        matches.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
        const output = { total, results: matches.slice(0, MAX_RESULTS) };
        candidateCache.set(normalized, output);
        return output;
    }

    function readPatternFromRow(row) {
        // This function must only ever be called behind mayReadTorn().
        if (!mayReadTorn()) return '';
        const slots = row.querySelectorAll(
            '[class*="charSlot_"], [class*="charSlot"]'
        );
        if (slots.length < MIN_LENGTH || slots.length > MAX_LENGTH) return '';
        let pattern = '';
        for (const slot of slots) {
            const character = slot.textContent.trim().toUpperCase().replace('Ø', '0');
            pattern += /^[A-Z0-9_.]$/.test(character)
                ? character
                : '?';
        }
        return pattern;
    }

    async function recordCompletedPassword(password) {
        if (!mayReadTorn()) return;
        const valid = normalizePassword(password);
        if (!valid) return;

        const readTransaction = db.transaction('passwords', 'readonly');
        const existing = await idbRequest(
            readTransaction.objectStore('passwords').get(valid)
        );
        if (!existing) {
            const writeTransaction = db.transaction('passwords', 'readwrite');
            writeTransaction.objectStore('passwords').put({
                password: valid,
                status: 'pending',
                discoveredAt: new Date().toISOString(),
                submittedAt: '',
            });
            await transactionDone(writeTransaction);
            scheduleIdleSubmission();
            await refreshCounts();
        }
    }

    async function getPasswordRecords(status, limit = Infinity) {
        const transaction = db.transaction('passwords', 'readonly');
        const index = transaction.objectStore('passwords').index('status');
        const records = [];
        return new Promise((resolve, reject) => {
            const request = index.openCursor(IDBKeyRange.only(status));
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor || records.length >= limit) {
                    resolve(records);
                    return;
                }
                records.push(cursor.value);
                cursor.continue();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async function countPasswordRecords(status) {
        const transaction = db.transaction('passwords', 'readonly');
        return idbRequest(
            transaction.objectStore('passwords').index('status')
                .count(IDBKeyRange.only(status))
        );
    }

    async function refreshCounts() {
        if (!db) return;
        const [pending, submitted] = await Promise.all([
            countPasswordRecords('pending'),
            countPasswordRecords('submitted'),
        ]);
        const counter = document.getElementById('ctch-queue-counts');
        if (counter) {
            counter.textContent =
                `${pending.toLocaleString()} pending · ` +
                `${submitted.toLocaleString()} submitted/archive`;
        }
        if (pending >= BATCH_SIZE) void submitPending('batch');
    }

    function contributionEnabled() {
        return Boolean(GM_getValue(PREF.consent, false));
    }

    async function submitPending(reason = 'manual') {
        if (submitting || !contributionEnabled()) return;
        if (!mayReadTorn()) {
            if (reason === 'manual') setStatus('Focus and restore this tab to submit.');
            return;
        }

        const records = await getPasswordRecords('pending', BATCH_SIZE);
        if (!records.length) {
            if (reason === 'manual') setStatus('No pending passwords to submit.');
            return;
        }

        submitting = true;
        updateSubmitButton();
        setStatus(`Submitting ${records.length} password(s)…`);
        try {
            const body =
                `${encodeURIComponent(FORM_FIELD)}=` +
                encodeURIComponent(records.map(record => record.password).join('\n'));
            await requestText(FORM_URL, {
                method: 'POST',
                data: body,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                },
                timeout: 30000,
            });
            if (!mayReadTorn()) {
                throw new Error('tab lost focus before confirmation');
            }

            const submittedAt = new Date().toISOString();
            const transaction = db.transaction('passwords', 'readwrite');
            const store = transaction.objectStore('passwords');
            for (const record of records) {
                store.put({ ...record, status: 'submitted', submittedAt });
            }
            await transactionDone(transaction);
            setStatus(`${records.length} password(s) submitted and archived locally`);
        } catch (error) {
            setStatus(`Submission kept pending: ${error.message}`);
        } finally {
            submitting = false;
            updateSubmitButton();
            await refreshCounts();
        }
    }

    function scheduleIdleSubmission() {
        clearTimeout(idleSubmitTimer);
        idleSubmitTimer = setTimeout(() => {
            if (mayReadTorn()) void submitPending('idle');
        }, IDLE_SUBMIT_MS);
    }

    function positionHelper(helper, slots) {
        const anchor = slots[slots.length - 1];
        if (!anchor?.isConnected) return;
        const rect = anchor.getBoundingClientRect();
        const badgeWidth = helper.badge.offsetWidth || 42;
        const left = Math.min(window.innerWidth - badgeWidth - 6, rect.right + 6);
        helper.badge.style.left = `${Math.max(4, left)}px`;
        helper.badge.style.top = `${Math.max(4, rect.top + rect.height / 2)}px`;

        const popupWidth = Math.min(290, window.innerWidth - 12);
        const popupLeft = Math.min(
            window.innerWidth - popupWidth - 6,
            Math.max(6, rect.right + 6)
        );
        helper.popup.style.width = `${popupWidth}px`;
        helper.popup.style.left = `${popupLeft}px`;
        helper.popup.style.top = `${Math.min(
            window.innerHeight - helper.popup.offsetHeight - 6,
            rect.bottom + 5
        )}px`;
    }

    function closePopup(helper) {
        if (!helper) return;
        helper.popup.hidden = true;
        if (activePopup === helper) activePopup = null;
    }

    function openPopup(helper, slots) {
        clearTimeout(popupCloseTimer);
        if (activePopup && activePopup !== helper) closePopup(activePopup);
        helper.popup.hidden = false;
        activePopup = helper;
        positionHelper(helper, slots);
    }

    function schedulePopupClose(helper, delay = 4000) {
        clearTimeout(popupCloseTimer);
        popupCloseTimer = setTimeout(() => closePopup(helper), delay);
    }

    function createRowHelper(row) {
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'ctch-match-badge';
        badge.hidden = true;

        const popup = document.createElement('aside');
        popup.className = 'ctch-match-popup';
        popup.hidden = true;

        const helper = { row, badge, popup, pattern: '', slots: [] };
        badge.addEventListener('click', event => {
            event.stopPropagation();
            if (popup.hidden) openPopup(helper, helper.slots);
            else closePopup(helper);
        });
        badge.addEventListener('mouseenter', () => openPopup(helper, helper.slots));
        badge.addEventListener('mouseleave', () => schedulePopupClose(helper, 500));
        popup.addEventListener('mouseenter', () => clearTimeout(popupCloseTimer));
        popup.addEventListener('mouseleave', () => schedulePopupClose(helper, 500));

        document.body.append(badge, popup);
        rowHelpers.set(row, helper);
        return helper;
    }

    function renderCompactPopup(helper, pattern, candidates) {
        const { total, results } = candidates;
        helper.popup.replaceChildren();

        const header = document.createElement('div');
        header.className = 'ctch-popup-header';
        const patternText = document.createElement('strong');
        patternText.textContent = pattern;
        const count = document.createElement('span');
        count.textContent = `${total.toLocaleString()} match${total === 1 ? '' : 'es'}`;
        header.append(patternText, count);
        helper.popup.appendChild(header);

        const list = document.createElement('div');
        list.className = 'ctch-popup-list';
        if (!results.length) {
            const empty = document.createElement('div');
            empty.className = 'ctch-popup-empty';
            empty.textContent = 'No dictionary matches';
            list.appendChild(empty);
        } else {
            for (const result of results.slice(0, 10)) {
                const item = document.createElement('div');
                item.className = 'ctch-popup-result';
                const word = document.createElement('span');
                word.textContent = result.word;
                item.appendChild(word);
                if (result.core && COMMON_CORES.has(result.core)) {
                    const core = document.createElement('small');
                    core.textContent = result.core;
                    item.appendChild(core);
                }
                list.appendChild(item);
            }
        }
        helper.popup.appendChild(list);
    }

    function hideAllRowHelpers() {
        closePopup(activePopup);
        for (const helper of rowHelpers.values()) {
            helper.badge.hidden = true;
            helper.popup.hidden = true;
        }
    }

    function cleanDetachedHelpers() {
        for (const [row, helper] of rowHelpers) {
            if (row.isConnected) continue;
            helper.badge.remove();
            helper.popup.remove();
            rowHelpers.delete(row);
        }
    }

    function attachOrRefreshRow(row) {
        if (!mayReadTorn()) return;
        const slots = [
            ...row.querySelectorAll('[class*="charSlot_"], [class*="charSlot"]')
        ];
        if (slots.length < MIN_LENGTH || slots.length > MAX_LENGTH) return;

        const pattern = readPatternFromRow(row);
        const revealedCount = [...pattern].filter(char => char !== '?').length;
        let helper = rowHelpers.get(row);

        // Completely untouched crimes remain exactly as Torn rendered them.
        if (!revealedCount) {
            if (helper) {
                helper.badge.hidden = true;
                closePopup(helper);
                helper.pattern = pattern;
            }
            lastPatterns.set(row, pattern);
            return;
        }

        if (!helper) helper = createRowHelper(row);
        helper.slots = slots;
        helper.badge.hidden = false;
        positionHelper(helper, slots);

        const changed = helper.pattern !== pattern;
        if (!changed) {
            if (!helper.popup.hidden) positionHelper(helper, slots);
            return;
        }

        helper.pattern = pattern;
        lastPatterns.set(row, pattern);
        const candidates = getCandidates(pattern);
        helper.badge.textContent = candidates.total === 1
            ? candidates.results[0]?.word || '1'
            : candidates.total.toLocaleString();
        helper.badge.title =
            `${pattern} · ${candidates.total.toLocaleString()} dictionary matches`;
        renderCompactPopup(helper, pattern, candidates);
        openPopup(helper, slots);
        schedulePopupClose(helper);

        if (!pattern.includes('?')) void recordCompletedPassword(pattern);
    }

    function scanFocusedPage() {
        scanTimer = null;
        if (!mayReadTorn() || !/sid=crimes/i.test(location.href)) return;
        const rows = document.querySelectorAll(
            '.crime-option, [class*="crimeOption_"], [class*="crimeOption"]'
        );
        for (const row of rows) attachOrRefreshRow(row);
        cleanDetachedHelpers();
    }

    function scheduleScan() {
        clearTimeout(scanTimer);
        scanTimer = null;
        if (!mayReadTorn()) return;
        scanTimer = setTimeout(scanFocusedPage, SCAN_DELAY_MS);
    }

    function suspend() {
        clearTimeout(scanTimer);
        clearTimeout(idleSubmitTimer);
        scanTimer = null;
        idleSubmitTimer = null;
        hideAllRowHelpers();
        setFocusIndicator();
    }

    function resumeIfFocused() {
        setFocusIndicator();
        if (!mayReadTorn()) return;
        scheduleScan();
        scheduleIdleSubmission();
    }

    function installFocusGuards() {
        window.addEventListener('blur', suspend, true);
        window.addEventListener('focus', resumeIfFocused, true);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && document.hasFocus()) {
                resumeIfFocused();
            } else {
                suspend();
            }
        });
        observer = new MutationObserver(() => {
            // Mutation records are intentionally ignored. Torn content is only
            // queried later by scanFocusedPage(), after the hard focus gate.
            if (mayReadTorn()) scheduleScan();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('scroll', () => {
            if (mayReadTorn()) scheduleScan();
        }, { passive: true });
        window.addEventListener('resize', () => {
            if (mayReadTorn()) scheduleScan();
        }, { passive: true });
    }

    function setStatus(message) {
        statusMessage = message;
        updateStatus();
    }

    function updateStatus() {
        const status = document.getElementById('ctch-status');
        if (status) status.textContent = statusMessage;
    }

    function setFocusIndicator() {
        const indicator = document.getElementById('ctch-focus');
        if (!indicator) return;
        const active = mayReadTorn();
        indicator.textContent = active
            ? 'FOCUSED · scanning permitted'
            : 'PAUSED · no Torn data is being read';
        indicator.classList.toggle('active', active);
    }

    function updateSubmitButton() {
        const button = document.getElementById('ctch-submit');
        if (button) button.disabled = submitting || !contributionEnabled();
    }

    function showConsentDialog() {
        const overlay = document.createElement('div');
        overlay.id = 'ctch-consent-overlay';
        overlay.innerHTML = `
            <div class="ctch-dialog" role="dialog" aria-modal="true">
                <strong>Help improve the shared password list?</strong>
                <p>The helper can submit only completed password text to the
                community Google Form. It never sends your Torn ID, API key,
                target information, guesses, or page contents.</p>
                <p>Submissions remain queued locally and are sent in batches
                only while this tab is visible and focused. You can change this
                setting at any time.</p>
                <div class="ctch-dialog-actions">
                    <button type="button" data-answer="no">No thanks</button>
                    <button type="button" data-answer="yes">Yes, contribute</button>
                </div>
            </div>`;
        overlay.addEventListener('click', event => {
            const answer = event.target.closest('[data-answer]')?.dataset.answer;
            if (!answer) return;
            GM_setValue(PREF.consentAsked, true);
            GM_setValue(PREF.consent, answer === 'yes');
            const checkbox = document.getElementById('ctch-consent');
            if (checkbox) checkbox.checked = answer === 'yes';
            overlay.remove();
            updateSubmitButton();
            if (answer === 'yes') {
                setStatus('Contributions enabled; only completed passwords are shared.');
                scheduleIdleSubmission();
            }
        });
        document.body.appendChild(overlay);
    }

    async function exportArchive() {
        const [pending, submitted] = await Promise.all([
            getPasswordRecords('pending'),
            getPasswordRecords('submitted'),
        ]);
        const text = [
            '# Pending',
            ...pending.map(record => record.password),
            '',
            '# Submitted archive',
            ...submitted.map(record => record.password),
            '',
        ].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        link.download = `Torn_Cracking_Local_Archive_${new Date()
            .toISOString().slice(0, 10)}.txt`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    function buildPanel() {
        const panel = document.createElement('section');
        panel.id = 'ctch-panel';
        panel.innerHTML = `
            <header>
                <strong>Crack Helper</strong>
                <button id="ctch-settings-toggle" type="button"
                    title="Open settings">⚙</button>
            </header>
            <div id="ctch-body" hidden>
                <div id="ctch-focus">Checking focus…</div>
                <div class="ctch-controls">
                    <button id="ctch-update" type="button">Update dictionary</button>
                </div>
                <div id="ctch-status">${statusMessage}</div>
                <label class="ctch-setting">
                    <input id="ctch-paused" type="checkbox">
                    Pause all scanning
                </label>
                <div class="ctch-contribution">
                    <label>
                        <input id="ctch-consent" type="checkbox">
                        Contribute completed passwords
                    </label>
                    <div id="ctch-queue-counts">0 pending · 0 submitted/archive</div>
                    <div class="ctch-controls">
                        <button id="ctch-submit" type="button">Submit pending now</button>
                        <button id="ctch-export" type="button">Export local archive</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(panel);

        const body = panel.querySelector('#ctch-body');
        const settingsToggle = panel.querySelector('#ctch-settings-toggle');
        const applySettingsOpen = value => {
            const open = Boolean(value);
            body.hidden = !open;
            settingsToggle.textContent = open ? '×' : '⚙';
            settingsToggle.title = open ? 'Close settings' : 'Open settings';
            GM_setValue(PREF.settingsOpen, open);
        };
        applySettingsOpen(Boolean(GM_getValue(PREF.settingsOpen, false)));
        settingsToggle.addEventListener(
            'click',
            () => applySettingsOpen(body.hidden)
        );

        const paused = panel.querySelector('#ctch-paused');
        minimized = Boolean(GM_getValue(PREF.paused, false));
        paused.checked = minimized;
        paused.addEventListener('change', () => {
            minimized = paused.checked;
            GM_setValue(PREF.paused, minimized);
            if (minimized) suspend();
            else resumeIfFocused();
        });

        panel.querySelector('#ctch-update').addEventListener(
            'click',
            event => void updateDictionary(event.currentTarget)
        );
        panel.querySelector('#ctch-submit').addEventListener(
            'click',
            () => void submitPending('manual')
        );
        panel.querySelector('#ctch-export').addEventListener(
            'click',
            () => void exportArchive()
        );

        const consent = panel.querySelector('#ctch-consent');
        consent.checked = contributionEnabled();
        consent.addEventListener('change', () => {
            GM_setValue(PREF.consentAsked, true);
            GM_setValue(PREF.consent, consent.checked);
            updateSubmitButton();
            setStatus(consent.checked
                ? 'Contributions enabled; completed passwords remain locally archived.'
                : 'Contributions disabled; passwords remain local only.');
            if (consent.checked) scheduleIdleSubmission();
        });
        updateSubmitButton();
        setFocusIndicator();
    }

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #ctch-panel {
                position: fixed; top: 86px; left: 12px; z-index: 999999;
                width: auto; max-width: calc(100vw - 24px); color: #e8edf2;
                background: #15191e; border: 1px solid #43505c;
                border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,.45);
                font: 12px/1.35 Arial, sans-serif;
            }
            #ctch-panel header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 8px 10px; background: #20262d;
                border-radius: 8px 8px 0 0;
            }
            #ctch-panel button {
                color: #e8edf2; background: #2b333c;
                border: 1px solid #536170; border-radius: 4px;
                padding: 5px 8px; cursor: pointer;
            }
            #ctch-panel button:disabled { opacity: .5; cursor: default; }
            #ctch-body { width: min(340px, calc(100vw - 44px)); padding: 10px; }
            #ctch-focus {
                padding: 5px 7px; color: #ffcd78; background: #3d3018;
                border-radius: 4px; font-weight: 700;
            }
            #ctch-focus.active { color: #94e6ad; background: #173a23; }
            .ctch-controls { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
            #ctch-status { margin: 6px 0; color: #8fc9ff; }
            .ctch-contribution {
                margin: 9px 0; padding: 8px; background: #101419;
                border: 1px solid #343d46; border-radius: 5px;
            }
            .ctch-setting { display: block; margin: 8px 0; color: #c8d0d8; }
            #ctch-queue-counts { margin-top: 5px; color: #aeb9c4; }
            .ctch-match-badge {
                position: fixed; z-index: 999997; transform: translateY(-50%);
                min-width: 38px; max-width: 118px; height: 22px; padding: 2px 6px;
                overflow: hidden; color: #d9f1ff; background: #183a50;
                border: 1px solid #4c91b8; border-radius: 11px;
                box-shadow: 0 2px 7px rgba(0,0,0,.5);
                font: 700 10px/1 monospace; text-overflow: ellipsis;
                white-space: nowrap; cursor: pointer;
            }
            .ctch-match-popup {
                position: fixed; z-index: 999998; box-sizing: border-box;
                overflow: hidden; color: #e8edf2; background: #151a20;
                border: 1px solid #4c91b8; border-radius: 6px;
                box-shadow: 0 7px 22px rgba(0,0,0,.62);
                font: 11px/1.25 Arial, sans-serif;
            }
            .ctch-popup-header {
                display: flex; justify-content: space-between; gap: 8px;
                padding: 6px 8px; color: #9ddaff; background: #202832;
                border-bottom: 1px solid #354553;
            }
            .ctch-popup-header strong { color: #fff; font-family: monospace; }
            .ctch-popup-list {
                display: grid; grid-template-columns: 1fr 1fr;
                max-height: 150px; overflow: auto; padding: 3px;
            }
            .ctch-popup-result {
                display: flex; justify-content: space-between; gap: 5px;
                min-width: 0; padding: 4px 5px;
                border-bottom: 1px solid rgba(255,255,255,.055);
                font: 700 11px/1.2 monospace;
            }
            .ctch-popup-result span {
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            .ctch-popup-result small { color: #79d99a; font: 9px/1.2 monospace; }
            .ctch-popup-empty { grid-column: 1 / -1; padding: 8px; color: #aeb9c4; }
            #ctch-consent-overlay {
                position: fixed; inset: 0; z-index: 1000000;
                display: grid; place-items: center; padding: 20px;
                background: rgba(0,0,0,.75);
            }
            .ctch-dialog {
                width: min(480px, 100%); padding: 18px; color: #e8edf2;
                background: #181d23; border: 1px solid #536170;
                border-radius: 8px; box-shadow: 0 12px 40px rgba(0,0,0,.6);
                font: 14px/1.45 Arial, sans-serif;
            }
            .ctch-dialog strong { font-size: 17px; }
            .ctch-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
            .ctch-dialog button {
                color: #fff; background: #2b333c; border: 1px solid #607080;
                border-radius: 4px; padding: 7px 11px; cursor: pointer;
            }
            @media (max-width: 720px) {
                #ctch-panel { top: 62px; left: 6px; }
                .ctch-popup-list { grid-template-columns: 1fr; }
            }
        `;
        document.head.appendChild(style);
    }

    async function start() {
        addStyles();
        buildPanel();
        installFocusGuards();
        try {
            db = await openDatabase();
            await loadDictionary();
            await refreshCounts();
            if (!GM_getValue(PREF.consentAsked, false)) showConsentDialog();
            resumeIfFocused();
        } catch (error) {
            setStatus(`Could not open local storage: ${error.message}`);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => void start(), { once: true });
    } else {
        void start();
    }
})();
