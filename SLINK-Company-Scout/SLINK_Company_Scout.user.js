// ==UserScript==
// @name         SLINK Company Scout
// @namespace    Considious [3853023]
// @version      0.1.1
// @description  Build and filter a local directory of Torn companies for SLINK research.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-Company-Scout/SLINK_Company_Scout.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-Company-Scout/SLINK_Company_Scout.user.js
// @require      https://raw.githubusercontent.com/Considious/Torn-Scripts/main/shared/Considious_Torn_Lib.js?v=1.3.5
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // Release: 0.1.1-company-type-names-resizable-panel
    // This research stage deliberately stops at company-level discovery.
    // It does not request employee lists, user profiles, or send data to SLINK.

    const TornLib = globalThis.ConsidiousTornLib;
    if (!TornLib) throw new Error('Considious Torn Library failed to load.');

    const SCRIPT_VERSION = '0.1.1';
    const SNAPSHOT_URL = 'https://api.torn.com/v2/company/snapshot';
    const COMPANY_TYPES_URL = 'https://api.torn.com/v2/torn/companies';
    const DISPLAY_LIMIT = 300;
    const KEYS = Object.freeze({
        apiKey: 'slinkCompanyScout.tornApiKey.v1',
        snapshot: 'slinkCompanyScout.snapshot.v1',
        fetchedAt: 'slinkCompanyScout.fetchedAt.v1',
        typeNames: 'slinkCompanyScout.typeNames.v1',
        filters: 'slinkCompanyScout.filters.v1',
        selectedTypes: 'slinkCompanyScout.selectedTypes.v1',
        collapsed: 'slinkCompanyScout.collapsed.v1',
        panelPosition: 'slinkCompanyScout.panelPosition.v1',
        bubblePosition: 'slinkCompanyScout.bubblePosition.v1',
        panelSize: 'slinkCompanyScout.panelSize.v1'
    });
    const DEFAULT_FILTERS = Object.freeze({
        minimumRating: 7,
        maximumRating: 10,
        employeesOnly: true
    });

    const storedSnapshot = loadValue(KEYS.snapshot, []);
    const state = {
        busy: false,
        error: '',
        message: Array.isArray(storedSnapshot) && storedSnapshot.length
            ? `Loaded ${storedSnapshot.length.toLocaleString()} locally saved companies.`
            : 'Ready to download Torn\'s daily company directory.',
        companies: Array.isArray(storedSnapshot)
            ? storedSnapshot.map(normalizeStoredCompany).filter(company => company.id)
            : [],
        fetchedAt: Number(loadValue(KEYS.fetchedAt, 0)) || 0,
        typeNames: loadValue(KEYS.typeNames, {}),
        filters: {
            ...DEFAULT_FILTERS,
            ...loadValue(KEYS.filters, {})
        },
        selectedTypes: loadValue(KEYS.selectedTypes, null)
    };
    let panelDragController = null;
    let bubblePointer = null;


    // ================================================================
    // Values and formatting
    // ================================================================

    function loadValue(key, fallback) {
        try {
            const value = GM_getValue(key, undefined);
            return value === undefined ? fallback : value;
        } catch {
            return fallback;
        }
    }


    function saveValue(key, value) {
        GM_setValue(key, value);
        return value;
    }


    function escapeHtml(value) {
        return TornLib.escapeHtml(String(value ?? ''));
    }


    function numeric(value) {
        const parsed = Number(String(value ?? '').replaceAll(',', '').trim());
        return Number.isFinite(parsed) ? parsed : 0;
    }


    function booleanValue(value) {
        return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());
    }


    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }


    function shortMoney(value) {
        const amount = Number(value);
        return Number.isFinite(amount) ? `$${TornLib.shortNumber(amount)}` : '$0';
    }


    function formatDate(milliseconds) {
        const parsed = Number(milliseconds);
        return Number.isFinite(parsed) && parsed > 0
            ? new Date(parsed).toLocaleString()
            : 'Never';
    }


    function snapshotAge() {
        if (!state.fetchedAt) return 'No saved snapshot';
        const seconds = Math.max(0, Math.floor((Date.now() - state.fetchedAt) / 1000));
        return `${TornLib.formatHumanDuration(seconds)} old`;
    }


    // ================================================================
    // CSV parsing and normalized company records
    // ================================================================

    function parseCsv(text) {
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;
        const source = String(text || '').replace(/^\uFEFF/, '');

        for (let index = 0; index < source.length; index += 1) {
            const character = source[index];
            if (quoted) {
                if (character === '"' && source[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else if (character === '"') {
                    quoted = false;
                } else {
                    field += character;
                }
                continue;
            }
            if (character === '"') {
                quoted = true;
            } else if (character === ',') {
                row.push(field);
                field = '';
            } else if (character === '\n') {
                row.push(field.replace(/\r$/, ''));
                if (row.some(value => value !== '')) rows.push(row);
                row = [];
                field = '';
            } else {
                field += character;
            }
        }
        row.push(field.replace(/\r$/, ''));
        if (row.some(value => value !== '')) rows.push(row);
        if (quoted) throw new Error('Torn returned an incomplete CSV file.');
        return rows;
    }


    function csvObjects(text) {
        const rows = parseCsv(text);
        if (rows.length < 2) throw new Error('The company snapshot did not contain any company rows.');
        const headers = rows[0].map(header => String(header).trim().toLowerCase());
        for (const required of ['id', 'name', 'type', 'rating']) {
            if (!headers.includes(required)) {
                throw new Error(`The company snapshot is missing its ${required} column.`);
            }
        }
        return rows.slice(1).map(values => Object.fromEntries(
            headers.map((header, index) => [header, values[index] ?? ''])
        ));
    }


    function normalizeCompany(row) {
        return {
            id: numeric(row.id),
            name: String(row.name || 'Unknown'),
            created_at: numeric(row.created_at),
            days_old: numeric(row.days_old),
            type_id: numeric(row.type_id ?? row.type),
            type_name: String(row.type_name || (numeric(row.type_id ?? row.type) ? '' : row.type) || ''),
            rating: numeric(row.rating),
            director_id: numeric(row.director_id),
            employees_hired: numeric(row.employees_hired),
            employees_capacity: numeric(row.employees_capacity),
            daily_income: numeric(row.daily_income),
            daily_customers: numeric(row.daily_customers),
            weekly_income: numeric(row.weekly_income),
            weekly_customers: numeric(row.weekly_customers),
            applications_allowed: booleanValue(row.applications_allowed)
        };
    }


    function normalizeStoredCompany(company) {
        return normalizeCompany(company || {});
    }


    function parseSnapshot(text) {
        const trimmed = String(text || '').trim();
        if (trimmed.startsWith('{')) {
            let response;
            try {
                response = JSON.parse(trimmed);
            } catch {
                throw new Error('Torn returned an invalid response instead of the company CSV.');
            }
            throw new Error(TornLib.errorMessage(response?.error || response, 'Torn did not return the company CSV.'));
        }
        return csvObjects(text)
            .map(normalizeCompany)
            .filter(company => company.id && company.name)
            .sort(compareCompanies);
    }


    function compareCompanies(left, right) {
        return right.rating - left.rating ||
            right.daily_income - left.daily_income ||
            left.name.localeCompare(right.name) ||
            left.id - right.id;
    }


    // ================================================================
    // Filters and collection
    // ================================================================

    function companyTypeKey(company) {
        return company.type_id ? String(company.type_id) : `name:${company.type_name || 'Unknown'}`;
    }


    function companyTypeName(companyOrKey) {
        const key = typeof companyOrKey === 'object'
            ? companyTypeKey(companyOrKey)
            : String(companyOrKey);
        if (key.startsWith('name:')) return key.slice(5);
        return String(state.typeNames?.[key] || `Company type ${key}`);
    }

    function typeCounts() {
        const counts = new Map();
        for (const company of state.companies) {
            const key = companyTypeKey(company);
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        return [...counts.entries()].sort(([left], [right]) =>
            companyTypeName(left).localeCompare(companyTypeName(right))
        );
    }


    function selectedTypeSet() {
        const available = typeCounts().map(([type]) => type);
        if (!Array.isArray(state.selectedTypes)) return new Set(available);
        return new Set(state.selectedTypes.map(String).filter(type => available.includes(type)));
    }


    function filteredCompanies() {
        const selected = selectedTypeSet();
        return state.companies.filter(company => {
            if (!selected.has(companyTypeKey(company))) return false;
            if (company.rating < state.filters.minimumRating) return false;
            if (company.rating > state.filters.maximumRating) return false;
            if (state.filters.employeesOnly && company.employees_hired <= 0) return false;
            return true;
        }).sort(compareCompanies);
    }


    function readControls(panel, options = {}) {
        const minimumRating = clamp(Number(panel.querySelector('#scs-min-rating')?.value) || 1, 1, 10);
        const maximumRating = clamp(Number(panel.querySelector('#scs-max-rating')?.value) || 10, 1, 10);
        if (minimumRating > maximumRating) {
            throw new Error('Minimum stars cannot be higher than maximum stars.');
        }
        state.filters = {
            minimumRating,
            maximumRating,
            employeesOnly: Boolean(panel.querySelector('#scs-employees-only')?.checked)
        };
        const typeInputs = [...panel.querySelectorAll('[data-company-type]')];
        if (options.includeTypes !== false && typeInputs.length) {
            state.selectedTypes = typeInputs
                .filter(input => input.checked)
                .map(input => input.dataset.companyType)
                .filter(Boolean);
        }
        saveValue(KEYS.filters, state.filters);
        if (Array.isArray(state.selectedTypes)) {
            saveValue(KEYS.selectedTypes, state.selectedTypes);
        }
    }


    function applyFilters(panel) {
        state.error = '';
        try {
            readControls(panel);
            state.message = `Filters now show ${filteredCompanies().length.toLocaleString()} companies.`;
        } catch (error) {
            state.error = TornLib.errorMessage(error);
        }
        render();
    }


    async function ensureCompanyTypeNames(apiKey, companies) {
        const requiredIds = [...new Set(companies.map(company => company.type_id).filter(Boolean).map(String))];
        const missingNames = requiredIds.filter(id => !state.typeNames?.[id]);
        if (!missingNames.length) return false;

        state.message = 'Downloading Torn company-type names...';
        render();
        const response = await TornLib.tornRequest(COMPANY_TYPES_URL, apiKey, {
            timeout: 30_000,
            tornScript: 'SLINK Company Scout',
            tornPriority: 'normal',
            networkErrorMessage: 'Could not download Torn company-type names.',
            timeoutMessage: 'The Torn company-type directory took too long to respond.'
        });
        const companyTypes = Array.isArray(response?.companies)
            ? response.companies
            : Object.values(response?.companies || {});
        const names = { ...(state.typeNames || {}) };
        for (const companyType of companyTypes) {
            const id = numeric(companyType?.id);
            const name = String(companyType?.name || '').trim();
            if (id && name) names[String(id)] = name;
        }
        const stillMissing = requiredIds.filter(id => !names[id]);
        if (stillMissing.length) {
            throw new Error(`Torn did not provide names for ${stillMissing.length} company types.`);
        }
        state.typeNames = names;
        saveValue(KEYS.typeNames, names);
        return true;
    }


    async function refreshSnapshot(panel) {
        if (state.busy) return;
        state.error = '';
        try {
            readControls(panel, { includeTypes: state.companies.length > 0 });
            const apiKey = String(panel.querySelector('#scs-api-key')?.value || '').trim();
            if (!/^[A-Za-z0-9]{16}$/.test(apiKey)) {
                throw new Error('Enter your 16-character Torn API key.');
            }
            saveValue(KEYS.apiKey, apiKey);
            state.busy = true;
            state.message = 'Downloading Torn\'s daily company snapshot...';
            render();

            const csv = await TornLib.requestText(SNAPSHOT_URL, {
                headers: {
                    Authorization: `ApiKey ${apiKey}`,
                    Accept: 'text/csv'
                },
                timeout: 45_000,
                tornScript: 'SLINK Company Scout',
                tornPriority: 'normal',
                networkErrorMessage: 'Could not reach the Torn API.',
                timeoutMessage: 'The Torn company snapshot took too long to download.'
            });
            const companies = parseSnapshot(csv);
            if (!companies.length) throw new Error('Torn returned an empty company directory.');

            await ensureCompanyTypeNames(apiKey, companies);

            state.companies = companies;
            state.fetchedAt = Date.now();
            const availableTypes = typeCounts().map(([type]) => type);
            if (!Array.isArray(state.selectedTypes)) {
                state.selectedTypes = availableTypes;
                saveValue(KEYS.selectedTypes, availableTypes);
            }
            saveValue(KEYS.snapshot, companies);
            saveValue(KEYS.fetchedAt, state.fetchedAt);
            state.message = `Downloaded ${companies.length.toLocaleString()} companies across ${availableTypes.length} company types.`;
        } catch (error) {
            state.error = TornLib.errorMessage(error);
            state.message = 'The company directory was not updated.';
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
        return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }


    function exportFilteredCsv() {
        const companies = filteredCompanies();
        if (!companies.length) {
            state.error = 'There are no matching companies to export.';
            render();
            return;
        }
        const headers = [
            'id', 'name', 'type_id', 'type_name', 'rating', 'director_id',
            'employees_hired', 'employees_capacity', 'days_old',
            'daily_income', 'weekly_income', 'daily_customers',
            'weekly_customers', 'applications_allowed', 'created_at'
        ];
        const lines = [headers.join(',')];
        for (const company of companies) {
            const exported = {
                ...company,
                type_name: companyTypeName(company)
            };
            lines.push(headers.map(header => csvCell(exported[header])).join(','));
        }
        const blob = new Blob([`\uFEFF${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `slink-company-directory-${date}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        state.error = '';
        state.message = `Exported ${companies.length.toLocaleString()} filtered companies.`;
        render();
    }


    // ================================================================
    // Interface
    // ================================================================

    function installStyles() {
        GM_addStyle(`
            #slink-company-scout {
                position:fixed; right:18px; top:110px; z-index:999999;
                display:flex; flex-direction:column;
                width:min(520px,calc(100vw - 24px)); height:min(520px,calc(100vh - 130px));
                min-width:360px; min-height:260px;
                max-width:calc(100vw - 8px); max-height:calc(100vh - 8px);
                overflow:hidden; border:1px solid #52636b; border-radius:8px;
                background:#11191d; color:#e8edef; font:12px/1.35 Arial,sans-serif;
                box-shadow:0 9px 28px rgba(0,0,0,.48); resize:both;
            }
            #slink-company-scout * { box-sizing:border-box; }
            .scs-head { flex:none; display:flex; align-items:center; gap:8px; padding:9px 10px; background:#1b2b31; border-bottom:1px solid rgba(255,255,255,.1); cursor:move; user-select:none; }
            .scs-title { flex:1; font-size:14px; font-weight:700; }
            .scs-sub { color:#93a7ad; font-size:10px; font-weight:400; }
            .scs-body { flex:1; min-height:0; overflow:auto; }
            .scs-disclosure { padding:8px 10px; color:#b9c7cb; background:#17242a; border-bottom:1px solid rgba(255,255,255,.08); }
            .scs-controls { display:grid; grid-template-columns:2fr 1fr 1fr; gap:8px; padding:10px; border-bottom:1px solid rgba(255,255,255,.09); }
            .scs-controls label { display:flex; flex-direction:column; gap:3px; color:#c1cbce; }
            .scs-controls input[type="text"], .scs-controls input[type="password"], .scs-controls input[type="number"] { width:100%; padding:6px 7px; border:1px solid #52636b; border-radius:4px; background:#0d1417; color:#fff; }
            .scs-check-line { grid-column:1 / -1; display:flex!important; flex-direction:row!important; align-items:center; gap:6px!important; }
            .scs-actions { grid-column:1 / -1; display:flex; flex-wrap:wrap; justify-content:flex-end; gap:6px; }
            .scs-btn { padding:5px 9px; border:1px solid rgba(255,255,255,.17); border-radius:5px; background:#29363c; color:#eef3f4; cursor:pointer; }
            .scs-btn:hover { background:#3a4a51; }
            .scs-btn:disabled { opacity:.5; cursor:default; }
            .scs-btn.scs-primary { background:#176653; border-color:#318d76; }
            .scs-types { padding:9px 10px; border-bottom:1px solid rgba(255,255,255,.09); }
            .scs-type-head { display:flex; align-items:center; gap:7px; margin-bottom:7px; }
            .scs-type-title { flex:1; font-weight:700; color:#cfe3e7; }
            .scs-type-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px 12px; max-height:190px; overflow:auto; padding-right:5px; }
            .scs-type-grid label { display:flex; align-items:flex-start; gap:5px; color:#b8c5c9; }
            .scs-type-count { color:#788d94; }
            .scs-message, .scs-error { padding:7px 10px; border-bottom:1px solid rgba(255,255,255,.08); }
            .scs-message { color:#a8def0; }
            .scs-error { color:#ffb4b4; }
            .scs-summary { display:flex; flex-wrap:wrap; gap:13px; padding:7px 10px; color:#98aab0; border-bottom:1px solid rgba(255,255,255,.08); }
            .scs-results { overflow-x:auto; }
            .scs-table { width:100%; min-width:750px; border-collapse:collapse; }
            .scs-table th { position:sticky; top:0; z-index:1; padding:6px; text-align:left; background:#25343a; color:#d1e8ed; }
            .scs-table td { padding:6px; border-top:1px solid rgba(255,255,255,.07); vertical-align:top; }
            .scs-table tr:hover td { background:rgba(255,255,255,.035); }
            .scs-company { color:#9edfff; font-weight:700; text-decoration:none; }
            .scs-muted { color:#84979d; font-size:10px; }
            .scs-empty { padding:18px; text-align:center; color:#91a2a7; }
            .scs-footer { flex:none; padding:7px 10px; color:#788a90; border-top:1px solid rgba(255,255,255,.08); font-size:10px; }
            #slink-company-scout.scs-collapsed { display:block; width:54px; height:54px; min-width:54px; min-height:54px; max-width:54px; max-height:54px; overflow:visible; resize:none; border-radius:50%; background:transparent; border-color:rgba(65,197,220,.65); }
            .scs-bubble { display:flex; width:100%; height:100%; align-items:center; justify-content:center; border-radius:50%; background:linear-gradient(145deg,#278aa0,#174955); color:#fff; cursor:pointer; font:800 13px/1 Arial,sans-serif; user-select:none; touch-action:none; box-shadow:0 6px 18px rgba(0,0,0,.48),inset 0 0 0 1px rgba(255,255,255,.18); }
            .scs-bubble:hover { background:linear-gradient(145deg,#31a4bc,#1d5c69); }
            @media (max-width:700px) {
                .scs-controls { grid-template-columns:1fr 1fr; }
                .scs-controls .scs-key { grid-column:1 / -1; }
                .scs-type-grid { grid-template-columns:1fr; }
            }
        `);
    }


    function ensurePanel() {
        let panel = document.getElementById('slink-company-scout');
        if (panel) return panel;
        panel = document.createElement('section');
        panel.id = 'slink-company-scout';
        document.body.appendChild(panel);
        return panel;
    }


    function typeOptionsHtml() {
        const counts = typeCounts();
        if (!counts.length) {
            return '<div class="scs-empty">Download the company directory to load company-type checkboxes.</div>';
        }
        const selected = selectedTypeSet();
        return `
            <div class="scs-types">
                <div class="scs-type-head">
                    <div class="scs-type-title">Company types</div>
                    <button class="scs-btn" id="scs-types-all">Select all</button>
                    <button class="scs-btn" id="scs-types-none">Select none</button>
                </div>
                <div class="scs-type-grid">
                    ${counts.map(([type, count]) => `
                        <label>
                            <input type="checkbox" data-company-type="${escapeHtml(type)}" ${selected.has(type) ? 'checked' : ''}>
                            <span>${escapeHtml(companyTypeName(type))} <span class="scs-type-count">(${count.toLocaleString()})</span></span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }


    function resultsHtml(companies) {
        if (!state.companies.length) {
            return '<div class="scs-empty">No company snapshot has been downloaded yet.</div>';
        }
        if (!companies.length) {
            return '<div class="scs-empty">No companies match the selected types and star range.</div>';
        }
        const displayed = companies.slice(0, DISPLAY_LIMIT);
        return `
            <div class="scs-results">
                <table class="scs-table">
                    <thead><tr><th>Company</th><th>Type</th><th>Stars</th><th>Staff</th><th>Daily income</th><th>Weekly income</th><th>Director</th><th>Age</th></tr></thead>
                    <tbody>
                        ${displayed.map(company => {
                            const companyUrl = `https://www.torn.com/joblist.php#/p=corpinfo&ID=${company.id}`;
                            const directorUrl = company.director_id
                                ? `https://www.torn.com/profiles.php?XID=${company.director_id}`
                                : '';
                            return `
                                <tr>
                                    <td><a class="scs-company" href="${escapeHtml(companyUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(company.name)} [${company.id}]</a></td>
                                    <td>${escapeHtml(companyTypeName(company))}</td>
                                    <td>${company.rating}</td>
                                    <td>${company.employees_hired}/${company.employees_capacity}</td>
                                    <td title="$${company.daily_income.toLocaleString()}">${shortMoney(company.daily_income)}</td>
                                    <td title="$${company.weekly_income.toLocaleString()}">${shortMoney(company.weekly_income)}</td>
                                    <td>${directorUrl ? `<a class="scs-company" href="${escapeHtml(directorUrl)}" target="_blank" rel="noopener noreferrer">${company.director_id}</a>` : '-'}</td>
                                    <td>${company.days_old.toLocaleString()} days</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                ${companies.length > DISPLAY_LIMIT ? `<div class="scs-empty">Showing the first ${DISPLAY_LIMIT.toLocaleString()} matches. All ${companies.length.toLocaleString()} are included in CSV export.</div>` : ''}
            </div>
        `;
    }


    function applySavedPosition(collapsed) {
        if (!panelDragController) return;
        const saved = loadValue(collapsed ? KEYS.bubblePosition : KEYS.panelPosition, null);
        if (saved) {
            panelDragController.applyPosition(saved);
        } else if (collapsed) {
            panelDragController.applyPosition({
                left: window.innerWidth - 60,
                top: Math.max(4, Math.round((window.innerHeight - 54) * 0.7))
            });
        } else {
            panelDragController.clampToViewport();
        }
    }


    function applySavedSize(panel, collapsed) {
        panel.style.removeProperty('width');
        panel.style.removeProperty('height');
        if (collapsed) return;
        const size = loadValue(KEYS.panelSize, null);
        if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) return;
        panel.style.width = `${size.width}px`;
        panel.style.height = `${size.height}px`;
    }


    function render() {
        const panel = ensurePanel();
        const collapsed = Boolean(loadValue(KEYS.collapsed, false));
        panel.classList.toggle('scs-collapsed', collapsed);
        applySavedSize(panel, collapsed);

        if (collapsed) {
            panel.innerHTML = `<div class="scs-bubble" role="button" tabindex="0" title="Open SLINK Company Scout">CS</div>`;
            applySavedPosition(true);
            bindEvents(panel);
            return;
        }

        const companies = filteredCompanies();
        const selectedCount = selectedTypeSet().size;
        const apiKey = String(loadValue(KEYS.apiKey, '') || '');
        panel.innerHTML = `
            <div class="scs-head">
                <div class="scs-title">SLINK Company Scout<div class="scs-sub">Company directory research - v${SCRIPT_VERSION}</div></div>
                <button class="scs-btn" id="scs-collapse" title="Minimize to a movable bubble">-</button>
            </div>
            <div class="scs-body">
                <div class="scs-disclosure">Your Torn API key stays in this Tampermonkey script and is sent only to Torn. The first download may make one additional request to translate company-type IDs into names. This release does not inspect employees or upload anything to SLINK.</div>
                <div class="scs-controls">
                    <label class="scs-key">Torn API key
                        <input id="scs-api-key" type="password" value="${escapeHtml(apiKey)}" autocomplete="off">
                    </label>
                    <label>Minimum stars
                        <input id="scs-min-rating" type="number" min="1" max="10" value="${state.filters.minimumRating}">
                    </label>
                    <label>Maximum stars
                        <input id="scs-max-rating" type="number" min="1" max="10" value="${state.filters.maximumRating}">
                    </label>
                    <label class="scs-check-line"><input id="scs-employees-only" type="checkbox" ${state.filters.employeesOnly ? 'checked' : ''}> Only show companies with employees</label>
                    <div class="scs-actions">
                        <button class="scs-btn" id="scs-apply" ${state.companies.length ? '' : 'disabled'}>Apply filters</button>
                        <button class="scs-btn" id="scs-export" ${companies.length ? '' : 'disabled'}>Export filtered CSV</button>
                        <button class="scs-btn scs-primary" id="scs-refresh" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Downloading...' : state.companies.length ? 'Refresh daily snapshot' : 'Download company directory'}</button>
                    </div>
                </div>
                ${typeOptionsHtml()}
                ${state.error ? `<div class="scs-error">${escapeHtml(state.error)}</div>` : ''}
                <div class="scs-message">${escapeHtml(state.message)}</div>
                <div class="scs-summary">
                    <span>Directory: ${state.companies.length.toLocaleString()}</span>
                    <span>Selected types: ${selectedCount}</span>
                    <span>Matches: ${companies.length.toLocaleString()}</span>
                    <span>Saved: ${escapeHtml(formatDate(state.fetchedAt))} (${escapeHtml(snapshotAge())})</span>
                </div>
                ${resultsHtml(companies)}
            </div>
            <div class="scs-footer">The daily Torn snapshot is downloaded once. Filters are local. Drag the bottom-right corner to resize this panel.</div>
        `;
        applySavedPosition(false);
        bindEvents(panel);
    }


    function bindEvents(panel) {
        panel.querySelector('#scs-refresh')?.addEventListener('click', () => {
            void refreshSnapshot(panel);
        });
        panel.querySelector('#scs-apply')?.addEventListener('click', () => {
            applyFilters(panel);
        });
        panel.querySelector('#scs-export')?.addEventListener('click', () => {
            exportFilteredCsv();
        });
        panel.querySelector('#scs-types-all')?.addEventListener('click', () => {
            for (const input of panel.querySelectorAll('[data-company-type]')) input.checked = true;
        });
        panel.querySelector('#scs-types-none')?.addEventListener('click', () => {
            for (const input of panel.querySelectorAll('[data-company-type]')) input.checked = false;
        });
        panel.querySelector('#scs-collapse')?.addEventListener('click', () => {
            saveValue(KEYS.collapsed, true);
            render();
        });
        panel.querySelector('.scs-bubble')?.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            saveValue(KEYS.collapsed, false);
            render();
        });
    }


    function installBubbleBehavior(panel) {
        panel.addEventListener('pointerdown', event => {
            if (!loadValue(KEYS.collapsed, false) || !event.target.closest('.scs-bubble')) return;
            bubblePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        });
        panel.addEventListener('pointermove', event => {
            if (!bubblePointer || event.pointerId !== bubblePointer.id) return;
            if (Math.hypot(event.clientX - bubblePointer.x, event.clientY - bubblePointer.y) >= 5) {
                bubblePointer.moved = true;
            }
        });
        panel.addEventListener('pointerup', event => {
            if (!bubblePointer || event.pointerId !== bubblePointer.id) return;
            const moved = bubblePointer.moved;
            bubblePointer = null;
            if (moved) return;
            saveValue(KEYS.collapsed, false);
            render();
        });
        panel.addEventListener('pointercancel', () => {
            bubblePointer = null;
        });
    }


    function start() {
        installStyles();
        const panel = ensurePanel();
        panelDragController = TornLib.makePanelDraggable(panel, {
            handle: panel,
            storageKey: KEYS.panelPosition,
            ignoreSelector: 'button,input,label,a,.scs-body,[data-no-drag]',
            draggingClass: 'scs-dragging',
            setValue: (_key, position) => {
                saveValue(loadValue(KEYS.collapsed, false) ? KEYS.bubblePosition : KEYS.panelPosition, position);
            },
            margin: 4
        });
        let resizeTimer = null;
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeTimer);
            if (loadValue(KEYS.collapsed, false)) return;
            resizeTimer = setTimeout(() => {
                const rect = panel.getBoundingClientRect();
                if (rect.width <= 60 || rect.height <= 60) return;
                saveValue(KEYS.panelSize, {
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                });
            }, 150);
        });
        resizeObserver.observe(panel);
        installBubbleBehavior(panel);
        render();
    }

    start();
})();
