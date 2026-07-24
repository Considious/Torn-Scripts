// ==UserScript==
// @name         Considious Torn Stock Paper Trader
// @namespace    Considious [3853023]
// @version      0.1.1
// @description  All-stock API history collector and fake-money trading laboratory for the open stock page.
// @author       Considious [3853023]
// @match        https://www.torn.com/page.php*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @connect      tornsy.com
// @connect      www.tornsy.com
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Considious_Torn_Stock_Paper_Trader.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Considious_Torn_Stock_Paper_Trader.user.js
// ==/UserScript==

(() => {
    'use strict';

    const VERSION = '0.1.1';
    const DB_NAME = 'considious_torn_stock_lab';
    const DB_VERSION = 1;
    const API = 'https://tornsy.com/api';
    const COLLECT_EVERY_MS = 60_000;
    const EVALUATE_EVERY_MS = 5 * 60_000;
    const BACKFILL_LIMIT = 2000;
    const BACKFILL_PLAN = {
        d1: { historyMs: Infinity, label: 'complete daily history' },
        h1: { historyMs: 2 * 365 * 24 * 60 * 60 * 1000, label: '2 years hourly' },
        m5: { historyMs: 90 * 24 * 60 * 60 * 1000, label: '90 days five-minute' },
    };
    const SELL_FEE = 0.001;
    const STARTING_CASH = 10_000_000_000;
    const POSITION_PCT = 0.10;
    const MIN_TRADE = 1_000_000;
    const PREF = {
        minimized: 'ctspt_minimized_v1',
        paused: 'ctspt_paused_v1',
        position: 'ctspt_position_v1',
    };

    const state = {
        db: null,
        tickers: [],
        collecting: false,
        backfilling: false,
        lastCollection: 0,
        lastEvaluation: 0,
        lastError: '',
        currentPrices: new Map(),
        panel: null,
        timer: null,
    };

    function isStockPage() {
        return location.pathname === '/page.php' &&
            new URLSearchParams(location.search).get('sid') === 'stocks';
    }

    function isActive() {
        return isStockPage() &&
            document.visibilityState === 'visible' &&
            document.hasFocus() &&
            !GM_getValue(PREF.paused, false);
    }

    function canUseApi() {
        return isStockPage() && !GM_getValue(PREF.paused, false);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function apiGet(path) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API}${path}`,
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'Considious-Torn-Stock-Paper-Trader',
                },
                timeout: 25_000,
                onload: response => {
                    if (response.status < 200 || response.status >= 300) {
                        reject(new Error(`Tornsy returned HTTP ${response.status}`));
                        return;
                    }
                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch {
                        reject(new Error('Tornsy returned invalid JSON'));
                    }
                },
                ontimeout: () => reject(new Error('Tornsy request timed out')),
                onerror: () => reject(new Error('Tornsy request failed')),
            });
        });
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                const observations = db.createObjectStore(
                    'observations',
                    { keyPath: ['ticker', 'timestamp'] },
                );
                observations.createIndex('ticker_time', ['ticker', 'timestamp']);

                const candles = db.createObjectStore(
                    'candles',
                    { keyPath: ['ticker', 'interval', 'timestamp'] },
                );
                candles.createIndex(
                    'ticker_interval_time',
                    ['ticker', 'interval', 'timestamp'],
                );

                const signals = db.createObjectStore(
                    'signals',
                    { keyPath: 'id', autoIncrement: true },
                );
                signals.createIndex('created_at', 'createdAt');

                const trades = db.createObjectStore(
                    'trades',
                    { keyPath: 'id', autoIncrement: true },
                );
                trades.createIndex('strategy_time', ['strategy', 'executedAt']);

                db.createObjectStore('portfolios', { keyPath: 'strategy' });
                db.createObjectStore('metadata', { keyPath: 'key' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function transaction(storeNames, mode, operation) {
        return new Promise((resolve, reject) => {
            const tx = state.db.transaction(storeNames, mode);
            const stores = Object.fromEntries(
                storeNames.map(name => [name, tx.objectStore(name)]),
            );
            let result;
            try {
                result = operation(stores, tx);
            } catch (error) {
                reject(error);
                return;
            }
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Database transaction aborted'));
        });
    }

    function requestValue(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function getMeta(key) {
        const tx = state.db.transaction(['metadata'], 'readonly');
        return requestValue(tx.objectStore('metadata').get(key));
    }

    async function setMeta(key, value) {
        await transaction(['metadata'], 'readwrite', stores => {
            stores.metadata.put({ key, value, updatedAt: Date.now() });
        });
    }

    async function storeWatchlist(payload) {
        const timestamp = Number(payload.timestamp || Math.floor(Date.now() / 1000));
        const rows = [];
        const tickers = [];
        for (const item of payload.data || []) {
            if (!item.stock || item.price == null) continue;
            const ticker = String(item.stock).toUpperCase();
            if (item.index) continue;
            const row = {
                ticker,
                timestamp,
                price: Number(item.price),
                totalShares: item.total_shares ?? null,
                investors: item.investors ?? null,
                receivedAt: Date.now(),
            };
            rows.push(row);
            tickers.push(ticker);
            state.currentPrices.set(ticker, row.price);
        }
        await transaction(['observations'], 'readwrite', stores => {
            rows.forEach(row => stores.observations.put(row));
        });
        await Promise.all(rows.flatMap(row => [
            upsertLiveCandle(row, 'm5', 5 * 60),
            upsertLiveCandle(row, 'h1', 60 * 60),
            upsertLiveCandle(row, 'd1', 24 * 60 * 60),
        ]));
        state.tickers = [...new Set(tickers)].sort();
        state.lastCollection = timestamp * 1000;
        return rows.length;
    }

    function upsertLiveCandle(observation, interval, seconds) {
        const bucket = Math.floor(observation.timestamp / seconds) * seconds;
        return new Promise((resolve, reject) => {
            const tx = state.db.transaction(['candles'], 'readwrite');
            const store = tx.objectStore('candles');
            const key = [observation.ticker, interval, bucket];
            const request = store.get(key);
            request.onsuccess = () => {
                const existing = request.result;
                if (existing) {
                    existing.high = Math.max(existing.high, observation.price);
                    existing.low = Math.min(existing.low, observation.price);
                    existing.close = observation.price;
                    existing.totalShares = observation.totalShares;
                    store.put(existing);
                } else {
                    store.put({
                        ticker: observation.ticker,
                        interval,
                        timestamp: bucket,
                        open: observation.price,
                        high: observation.price,
                        low: observation.price,
                        close: observation.price,
                        totalShares: observation.totalShares,
                    });
                }
            };
            request.onerror = () => reject(request.error);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async function storeHistory(ticker, interval, payload) {
        const rows = [];
        for (const item of payload.data || []) {
            if (!Array.isArray(item) || item.length < 6) continue;
            rows.push({
                ticker,
                interval,
                timestamp: Number(item[0]),
                open: Number(item[1]),
                high: Number(item[2]),
                low: Number(item[3]),
                close: Number(item[4]),
                totalShares: item[5] == null ? null : Number(item[5]),
            });
        }
        await transaction(['candles'], 'readwrite', stores => {
            rows.forEach(row => stores.candles.put(row));
        });
        return rows.length;
    }

    function earliestCandleTimestamp(ticker, interval) {
        const tx = state.db.transaction(['candles'], 'readonly');
        const index = tx.objectStore('candles').index('ticker_interval_time');
        const range = IDBKeyRange.bound(
            [ticker, interval, 0],
            [ticker, interval, Number.MAX_SAFE_INTEGER],
        );
        return new Promise((resolve, reject) => {
            const request = index.openCursor(range, 'next');
            request.onsuccess = event =>
                resolve(event.target.result?.value?.timestamp ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async function backfillTickerInterval(ticker, interval, plan) {
        const cutoff = Number.isFinite(plan.historyMs)
            ? Math.floor((Date.now() - plan.historyMs) / 1000)
            : 0;
        let cursor = await earliestCandleTimestamp(ticker, interval);
        let totalAdded = 0;
        let pages = 0;

        while (canUseApi()) {
            if (cursor !== null && cursor <= cutoff) break;
            const parameters = {
                interval,
                limit: String(BACKFILL_LIMIT),
            };
            if (cursor !== null) parameters.to = String(cursor);
            if (cutoff > 0) parameters.from = String(cutoff);
            const query = new URLSearchParams(parameters);
            const payload = await apiGet(`/${ticker.toLowerCase()}?${query}`);
            const rows = payload.data || [];
            if (!rows.length) break;
            totalAdded += await storeHistory(ticker, interval, payload);
            pages += 1;
            const oldest = Number(rows[0][0]);
            if (!Number.isFinite(oldest) || oldest >= (cursor ?? Infinity)) {
                throw new Error(`Backfill cursor stalled for ${ticker} ${interval}`);
            }
            cursor = oldest;
            await setMeta(`backfillProgress:${ticker}:${interval}`, {
                oldestTimestamp: cursor,
                totalAdded,
                pages,
                updatedAt: Date.now(),
            });
            render();
            if (rows.length < BACKFILL_LIMIT || cursor <= cutoff) break;
            await sleep(350);
        }
        return { totalAdded, pages, oldestTimestamp: cursor };
    }

    async function backfill() {
        if (state.backfilling || !canUseApi()) return;
        state.backfilling = true;
        render();
        try {
            if (!state.tickers.length) {
                await storeWatchlist(await apiGet('/stocks'));
            }
            for (const [interval, plan] of Object.entries(BACKFILL_PLAN)) {
                for (const ticker of state.tickers) {
                    if (!canUseApi()) return;
                    const key = `backfill:v2:${ticker}:${interval}`;
                    if (await getMeta(key)) continue;
                    const result = await backfillTickerInterval(
                        ticker,
                        interval,
                        plan,
                    );
                    await setMeta(key, {
                        ...result,
                        target: plan.label,
                        completedAt: Date.now(),
                    });
                    render();
                    await sleep(300);
                }
            }
            await setMeta('initialBackfillCompleteV2', {
                completedAt: Date.now(),
                tickers: state.tickers.length,
                plan: BACKFILL_PLAN,
            });
        } catch (error) {
            state.lastError = error.message;
        } finally {
            state.backfilling = false;
            render();
        }
    }

    async function collect() {
        if (state.collecting || !canUseApi()) return;
        state.collecting = true;
        render();
        try {
            const count = await storeWatchlist(await apiGet('/stocks'));
            state.lastError = count ? '' : 'No stocks were returned';
        } catch (error) {
            state.lastError = error.message;
        } finally {
            state.collecting = false;
            render();
        }
    }

    function percentChange(current, previous) {
        return previous ? current / previous - 1 : 0;
    }

    function mean(values) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function standardDeviation(values) {
        const average = mean(values);
        return Math.sqrt(mean(values.map(value => (value - average) ** 2)));
    }

    function features(closes) {
        if (closes.length < 31) return null;
        const window = closes.slice(-31);
        const price = window.at(-1);
        const returns = window.slice(1).map((value, index) =>
            percentChange(value, window[index]));
        const sma7 = mean(window.slice(-7));
        const sma30 = mean(window.slice(-30));
        const gains = returns.slice(-14).map(value => Math.max(value, 0));
        const losses = returns.slice(-14).map(value => Math.max(-value, 0));
        const averageGain = mean(gains);
        const averageLoss = mean(losses);
        const rsi = averageLoss === 0
            ? (averageGain ? 100 : 50)
            : 100 - 100 / (1 + averageGain / averageLoss);
        const priceStd = standardDeviation(window.slice(-30));
        return {
            price,
            return1: percentChange(price, window.at(-2)),
            return7: percentChange(price, window.at(-8)),
            return30: percentChange(price, window[0]),
            smaRatio: percentChange(sma7, sma30),
            volatility30: standardDeviation(returns),
            rsi14: rsi,
            zscore30: priceStd ? (price - sma30) / priceStd : 0,
        };
    }

    function decide(strategy, value) {
        if (strategy === 'momentum') {
            let score = 0;
            score += value.return7 > 0.01 ? 1 : -1;
            score += value.return30 > 0 ? 1 : -1;
            score += value.smaRatio > 0 ? 1 : -1;
            if (score >= 2 && value.rsi14 < 75) {
                return ['BUY', Math.min(0.9, 0.5 + score * 0.1),
                    'Positive multi-period momentum'];
            }
            if (score <= -2) {
                return ['SELL', Math.min(0.9, 0.5 + Math.abs(score) * 0.1),
                    'Negative multi-period momentum'];
            }
            return ['HOLD', 0.5, 'Momentum evidence is mixed'];
        }
        if (strategy === 'mean-reversion') {
            if (value.zscore30 <= -1.5 && value.rsi14 < 40) {
                return ['BUY', Math.min(0.9, 0.55 + Math.abs(value.zscore30) / 10),
                    'Oversold relative to recent range'];
            }
            if (value.zscore30 >= 1.5 && value.rsi14 > 60) {
                return ['SELL', Math.min(0.9, 0.55 + Math.abs(value.zscore30) / 10),
                    'Overextended relative to recent range'];
            }
            return ['HOLD', 0.5, 'No strong mean-reversion condition'];
        }
        const momentum = decide('momentum', value);
        const reversion = decide('mean-reversion', value);
        if (momentum[0] === reversion[0] && ['BUY', 'SELL'].includes(momentum[0])) {
            return [momentum[0], Math.min(0.95, (momentum[1] + reversion[1]) / 2 + 0.05),
                `Agreement: ${momentum[2]}; ${reversion[2]}`];
        }
        if (['BUY', 'SELL'].includes(momentum[0]) && reversion[0] === 'HOLD') {
            return [momentum[0], momentum[1] - 0.1, momentum[2]];
        }
        if (['BUY', 'SELL'].includes(reversion[0]) && momentum[0] === 'HOLD') {
            return [reversion[0], reversion[1] - 0.1, reversion[2]];
        }
        return ['HOLD', 0.45, 'Strategies disagree or lack evidence'];
    }

    async function recentCloses(ticker, interval = 'h1', count = 31) {
        const tx = state.db.transaction(['candles'], 'readonly');
        const index = tx.objectStore('candles').index('ticker_interval_time');
        const range = IDBKeyRange.bound(
            [ticker, interval, 0],
            [ticker, interval, Number.MAX_SAFE_INTEGER],
        );
        const rows = [];
        return new Promise((resolve, reject) => {
            const request = index.openCursor(range, 'prev');
            request.onsuccess = event => {
                const cursor = event.target.result;
                if (!cursor || rows.length >= count) {
                    resolve(rows.reverse().map(row => row.close));
                    return;
                }
                rows.push(cursor.value);
                cursor.continue();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async function portfolio(strategy) {
        const tx = state.db.transaction(['portfolios'], 'readonly');
        const existing = await requestValue(tx.objectStore('portfolios').get(strategy));
        return existing || {
            strategy,
            cash: STARTING_CASH,
            startingCash: STARTING_CASH,
            positions: {},
            realizedProfit: 0,
            createdAt: Date.now(),
        };
    }

    async function recordSignalAndTrade(strategy, ticker, featureSet, decision) {
        const [action, confidence, reason] = decision;
        const createdAt = Date.now();
        let signalId;
        await transaction(['signals'], 'readwrite', stores => {
            const request = stores.signals.add({
                createdAt,
                strategy,
                strategyVersion: `paper-${VERSION}`,
                ticker,
                action,
                confidence,
                referencePrice: featureSet.price,
                features: featureSet,
                reason,
            });
            request.onsuccess = () => { signalId = request.result; };
        });
        if (!['BUY', 'SELL'].includes(action)) return false;

        const account = await portfolio(strategy);
        const position = account.positions[ticker] || { shares: 0, averagePrice: 0 };
        let shares = 0;
        let gross = 0;
        let fee = 0;
        if (action === 'BUY') {
            if (position.shares > 0) return false;
            const budget = account.cash * POSITION_PCT;
            shares = Math.floor(budget / featureSet.price);
            gross = shares * featureSet.price;
            if (shares < 1 || gross < MIN_TRADE) return false;
            account.cash -= gross;
            account.positions[ticker] = {
                shares,
                averagePrice: featureSet.price,
            };
        } else {
            shares = position.shares;
            if (!shares) return false;
            gross = shares * featureSet.price;
            fee = gross * SELL_FEE;
            account.cash += gross - fee;
            account.realizedProfit +=
                (featureSet.price - position.averagePrice) * shares - fee;
            delete account.positions[ticker];
        }
        await transaction(['portfolios', 'trades'], 'readwrite', stores => {
            stores.portfolios.put(account);
            stores.trades.add({
                signalId,
                strategy,
                executedAt: createdAt,
                ticker,
                side: action,
                shares,
                price: featureSet.price,
                grossValue: gross,
                fee,
                cashAfter: account.cash,
            });
        });
        return true;
    }

    async function evaluate() {
        if (!canUseApi() || state.backfilling) return;
        const strategies = ['momentum', 'mean-reversion', 'composite'];
        for (const ticker of state.tickers) {
            if (!canUseApi()) return;
            const closes = await recentCloses(ticker);
            const value = features(closes);
            if (!value) continue;
            for (const strategy of strategies) {
                await recordSignalAndTrade(
                    strategy,
                    ticker,
                    value,
                    decide(strategy, value),
                );
            }
        }
        state.lastEvaluation = Date.now();
        await setMeta('lastEvaluation', state.lastEvaluation);
        render();
    }

    async function databaseCounts() {
        if (!state.db) return { observations: 0, candles: 0, signals: 0, trades: 0 };
        const names = ['observations', 'candles', 'signals', 'trades'];
        const tx = state.db.transaction(names, 'readonly');
        const values = await Promise.all(names.map(name =>
            requestValue(tx.objectStore(name).count())));
        return Object.fromEntries(names.map((name, index) => [name, values[index]]));
    }

    async function portfolioSummary() {
        if (!state.db) return [];
        const result = [];
        for (const strategy of ['momentum', 'mean-reversion', 'composite']) {
            const account = await portfolio(strategy);
            let equity = account.cash;
            for (const [ticker, position] of Object.entries(account.positions)) {
                equity += position.shares *
                    (state.currentPrices.get(ticker) || position.averagePrice);
            }
            result.push({
                strategy,
                equity,
                returnPct: (equity / account.startingCash - 1) * 100,
                positions: Object.keys(account.positions).length,
            });
        }
        return result;
    }

    function formatMoney(value) {
        return `$${Math.round(value).toLocaleString()}`;
    }

    function formatTime(value) {
        return value ? new Date(value).toLocaleTimeString() : 'Not yet';
    }

    async function render() {
        if (!state.panel) return;
        const paused = GM_getValue(PREF.paused, false);
        const active = canUseApi();
        const counts = await databaseCounts();
        const portfolios = await portfolioSummary();
        const status = paused ? 'Paused'
            : state.backfilling ? 'Backfilling history'
                    : state.collecting ? 'Collecting'
                        : active && !isActive() ? 'Background API'
                            : active ? 'Watching' : 'Inactive';
        state.panel.querySelector('#ctspt-status').textContent = status;
        state.panel.querySelector('#ctspt-status').dataset.state =
            active && !paused ? 'active' : 'paused';
        state.panel.querySelector('#ctspt-toggle').textContent =
            paused ? 'Resume' : 'Pause';
        state.panel.querySelector('#ctspt-summary').innerHTML = `
            <div><span>Stocks</span><strong>${state.tickers.length}</strong></div>
            <div><span>Observations</span><strong>${counts.observations.toLocaleString()}</strong></div>
            <div><span>Candles</span><strong>${counts.candles.toLocaleString()}</strong></div>
            <div><span>Paper trades</span><strong>${counts.trades.toLocaleString()}</strong></div>
            <div><span>Last collection</span><strong>${formatTime(state.lastCollection)}</strong></div>
            <div><span>Last evaluation</span><strong>${formatTime(state.lastEvaluation)}</strong></div>`;
        state.panel.querySelector('#ctspt-portfolios').innerHTML = portfolios.length
            ? portfolios.map(item => `
                <div class="ctspt-portfolio">
                    <span>${item.strategy}</span>
                    <strong class="${item.returnPct >= 0 ? 'gain' : 'loss'}">
                        ${formatMoney(item.equity)} (${item.returnPct.toFixed(2)}%)
                    </strong>
                    <small>${item.positions} open positions</small>
                </div>`).join('')
            : '<small>Paper portfolios begin after hourly history is available.</small>';
        const error = state.panel.querySelector('#ctspt-error');
        error.textContent = state.lastError;
        error.hidden = !state.lastError;
    }

    async function exportData() {
        const output = {
            exportedAt: new Date().toISOString(),
            version: VERSION,
            portfolios: [],
            signals: [],
            trades: [],
        };
        for (const storeName of ['portfolios', 'signals', 'trades']) {
            const tx = state.db.transaction([storeName], 'readonly');
            output[storeName] = await requestValue(
                tx.objectStore(storeName).getAll(),
            );
        }
        const blob = new Blob([JSON.stringify(output, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        GM_download({
            url,
            name: `torn-stock-paper-results-${Date.now()}.json`,
            saveAs: true,
            onload: () => URL.revokeObjectURL(url),
            onerror: () => URL.revokeObjectURL(url),
        });
    }

    function makeDraggable(panel) {
        const header = panel.querySelector('header');
        const saved = GM_getValue(PREF.position, null);
        if (saved) {
            panel.style.left = `${saved.left}px`;
            panel.style.top = `${saved.top}px`;
            panel.style.right = 'auto';
        }
        let drag = null;
        header.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target.closest('button')) return;
            const rect = panel.getBoundingClientRect();
            drag = {
                id: event.pointerId,
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            };
            header.setPointerCapture(event.pointerId);
        });
        header.addEventListener('pointermove', event => {
            if (!drag || drag.id !== event.pointerId) return;
            const left = Math.max(4, Math.min(
                event.clientX - drag.x,
                innerWidth - panel.offsetWidth - 4,
            ));
            const top = Math.max(4, Math.min(
                event.clientY - drag.y,
                innerHeight - panel.offsetHeight - 4,
            ));
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
            panel.style.right = 'auto';
        });
        header.addEventListener('pointerup', event => {
            if (!drag || drag.id !== event.pointerId) return;
            drag = null;
            const rect = panel.getBoundingClientRect();
            GM_setValue(PREF.position, {
                left: Math.round(rect.left),
                top: Math.round(rect.top),
            });
        });
    }

    function createPanel() {
        const panel = document.createElement('section');
        panel.id = 'ctspt-panel';
        panel.innerHTML = `
            <header>
                <div>
                    <strong>Stock Paper Lab</strong>
                    <span id="ctspt-status">Starting</span>
                </div>
                <button id="ctspt-minimize" title="Minimize">−</button>
            </header>
            <div id="ctspt-body">
                <div id="ctspt-summary"></div>
                <h4>Fake-money portfolios</h4>
                <div id="ctspt-portfolios"></div>
                <div id="ctspt-error" hidden></div>
                <footer>
                    <button id="ctspt-toggle">Pause</button>
                    <button id="ctspt-backfill">Backfill</button>
                    <button id="ctspt-export">Export</button>
                </footer>
                <small class="ctspt-note">Paper trades only. No Torn actions are performed.</small>
            </div>`;
        document.body.appendChild(panel);
        state.panel = panel;
        makeDraggable(panel);

        const body = panel.querySelector('#ctspt-body');
        const applyMinimized = minimized => {
            body.hidden = minimized;
            panel.querySelector('#ctspt-minimize').textContent = minimized ? '+' : '−';
            GM_setValue(PREF.minimized, minimized);
        };
        applyMinimized(GM_getValue(PREF.minimized, false));
        panel.querySelector('#ctspt-minimize').addEventListener(
            'click',
            () => applyMinimized(!body.hidden),
        );
        panel.querySelector('#ctspt-toggle').addEventListener('click', () => {
            GM_setValue(PREF.paused, !GM_getValue(PREF.paused, false));
            render();
        });
        panel.querySelector('#ctspt-backfill').addEventListener('click', backfill);
        panel.querySelector('#ctspt-export').addEventListener('click', exportData);
    }

    function addStyles() {
        GM_addStyle(`
            #ctspt-panel {
                position: fixed; z-index: 999999; top: 82px; right: 18px;
                width: 330px; color: #d8dde3; background: #15191e;
                border: 1px solid #4a535d; border-radius: 8px;
                box-shadow: 0 8px 24px #0009; font: 13px Arial, sans-serif;
            }
            #ctspt-panel header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 9px 10px; background: #20262d; border-radius: 8px 8px 0 0;
                cursor: move; user-select: none; touch-action: none;
            }
            #ctspt-panel header > div { display: flex; gap: 8px; align-items: center; }
            #ctspt-panel header strong { color: #f2f5f7; }
            #ctspt-status {
                padding: 2px 6px; border-radius: 8px; font-size: 11px;
                color: #111; background: #d49b3c;
            }
            #ctspt-status[data-state="active"] { background: #55b96f; }
            #ctspt-panel button {
                border: 1px solid #59636e; border-radius: 4px; color: #e9edf1;
                background: #2a323a; padding: 5px 9px; cursor: pointer;
            }
            #ctspt-panel button:hover { background: #38434d; }
            #ctspt-body { padding: 10px; }
            #ctspt-summary {
                display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
            }
            #ctspt-summary div {
                display: flex; flex-direction: column; padding: 6px;
                background: #1d2329; border-radius: 4px;
            }
            #ctspt-summary span, .ctspt-portfolio small, .ctspt-note {
                color: #929ca6; font-size: 11px;
            }
            #ctspt-panel h4 { margin: 11px 0 6px; }
            .ctspt-portfolio {
                display: grid; grid-template-columns: 1fr auto;
                padding: 6px; margin-bottom: 4px; background: #1d2329;
                border-radius: 4px;
            }
            .ctspt-portfolio small { grid-column: 1 / -1; }
            .ctspt-portfolio .gain { color: #62c87b; }
            .ctspt-portfolio .loss { color: #e16e6e; }
            #ctspt-error {
                margin-top: 8px; padding: 7px; color: #ffb1b1;
                background: #4a2020; border-radius: 4px;
            }
            #ctspt-panel footer {
                display: flex; gap: 6px; margin-top: 10px;
            }
            .ctspt-note { display: block; margin-top: 8px; }
        `);
    }

    async function tick() {
        if (!isStockPage()) return;
        if (canUseApi()) {
            if (Date.now() - state.lastCollection >= COLLECT_EVERY_MS) {
                await collect();
            }
            const backfilled = await getMeta('initialBackfillCompleteV2');
            if (!backfilled && !state.backfilling) backfill();
            if (Date.now() - state.lastEvaluation >= EVALUATE_EVERY_MS) {
                await evaluate();
            }
        }
        render();
    }

    async function start() {
        if (!isStockPage()) return;
        addStyles();
        createPanel();
        try {
            state.db = await openDatabase();
            const lastEvaluation = await getMeta('lastEvaluation');
            state.lastEvaluation = Number(lastEvaluation?.value || 0);
            await tick();
            state.timer = setInterval(tick, 10_000);
            for (const eventName of ['focus', 'blur']) {
                window.addEventListener(eventName, tick, { passive: true });
            }
            document.addEventListener('visibilitychange', tick, { passive: true });
        } catch (error) {
            state.lastError = error.message;
            render();
        }
    }

    start();
})();
