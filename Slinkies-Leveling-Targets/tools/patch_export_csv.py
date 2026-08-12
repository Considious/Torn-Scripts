from pathlib import Path

path = Path('Slinkies-Leveling-Targets/Slinky_Leveling_Target_Prototype.user.js')
text = path.read_text(encoding='utf-8')

text = text.replace('// @version      0.3.2', '// @version      0.4.0', 1)
text = text.replace("    const MAX_DISPLAY = 40;\n", "    const MAX_DISPLAY = 40;\n    const MAX_OBSERVATION_LOG = 20_000;\n", 1)
text = text.replace("        runtimeState: 'slinkyLeveling.runtimeState.v1'\n", "        runtimeState: 'slinkyLeveling.runtimeState.v1',\n        observationLog: 'slinkyLeveling.observationLog.v1'\n", 1)
text = text.replace("        activityCache: loadJson(KEYS.activityCache, { refreshedAt: 0, activeTargets: {}, snapshots: [] }),\n", "        activityCache: loadJson(KEYS.activityCache, { refreshedAt: 0, activeTargets: {}, snapshots: [] }),\n        observationLog: loadJson(KEYS.observationLog, []),\n", 1)
text = text.replace("        const storedActivity = loadJson(KEYS.activityCache, null);\n        const storedRuntime = loadJson(KEYS.runtimeState, {});\n", "        const storedActivity = loadJson(KEYS.activityCache, null);\n        const storedRuntime = loadJson(KEYS.runtimeState, {});\n        const storedObservations = loadJson(KEYS.observationLog, []);\n", 1)
text = text.replace("        if (storedActivity && Number(storedActivity.refreshedAt) > Number(state.activityCache?.refreshedAt || 0)) {\n            state.activityCache = storedActivity;\n        }\n\n        state.lastCycleAt = Math.max", "        if (storedActivity && Number(storedActivity.refreshedAt) > Number(state.activityCache?.refreshedAt || 0)) {\n            state.activityCache = storedActivity;\n        }\n        if (Array.isArray(storedObservations) && storedObservations.length > state.observationLog.length) {\n            state.observationLog = storedObservations;\n        }\n\n        state.lastCycleAt = Math.max", 1)

old = """        noteStatusObservation(target.id, status.state);\n\n        // Persist every completed observation immediately so a refresh mid-cycle\n        // cannot throw away data already collected.\n        saveJson(KEYS.statusCache, state.statusCache);\n        saveJson(KEYS.hospitalHistory, state.hospitalHistory);\n"""
new = """        const beforeHospitalCount = hospitalCount24h(target.id);\n        noteStatusObservation(target.id, status.state);\n        const afterHospitalCount = hospitalCount24h(target.id);\n\n        state.observationLog.push({\n            checkedAt: now,\n            id: target.id,\n            name: target.name,\n            level: target.level,\n            total: target.total,\n            sources: target.sources,\n            status: status.state,\n            description: status.description,\n            until: status.until || 0,\n            hospitalizationObserved: afterHospitalCount > beforeHospitalCount\n        });\n\n        if (state.observationLog.length > MAX_OBSERVATION_LOG) {\n            state.observationLog.splice(0, state.observationLog.length - MAX_OBSERVATION_LOG);\n        }\n\n        // Persist every completed observation immediately so a refresh mid-cycle\n        // cannot throw away data already collected.\n        saveJson(KEYS.statusCache, state.statusCache);\n        saveJson(KEYS.hospitalHistory, state.hospitalHistory);\n        saveJson(KEYS.observationLog, state.observationLog);\n"""
if old not in text:
    raise SystemExit('status observation anchor not found')
text = text.replace(old, new, 1)

text = text.replace("            ffScouterRecords: Object.keys(state.ffCache || {}).length,\n            activitySnapshotRefreshedAt:", "            ffScouterRecords: Object.keys(state.ffCache || {}).length,\n            observationsLogged: Array.isArray(state.observationLog) ? state.observationLog.length : 0,\n            activitySnapshotRefreshedAt:", 1)
text = text.replace("            scriptVersion: '0.3.2',", "            scriptVersion: '0.4.0',", 1)
text = text.replace("            `FFScouter cached records: ${data.ffScouterRecords}`,\n            `Activity snapshots cached:", "            `FFScouter cached records: ${data.ffScouterRecords}`,\n            `Status observations logged: ${data.observationsLogged}`,\n            `Activity snapshots cached:", 1)
text = text.replace("                    <div class=\"slp-debug-line\"><span>FF cached</span><b>${data.ffScouterRecords}</b></div>\n                    <div class=\"slp-debug-line\"><span>Okay</span>", "                    <div class=\"slp-debug-line\"><span>FF cached</span><b>${data.ffScouterRecords}</b></div>\n                    <div class=\"slp-debug-line\"><span>Observations</span><b>${data.observationsLogged}</b></div>\n                    <div class=\"slp-debug-line\"><span>Okay</span>", 1)
text = text.replace("                    <button class=\"slp-btn\" id=\"slp-copy-debug\">Copy Debug Data</button>\n                    <button class=\"slp-btn\" id=\"slp-refresh-debug\">Refresh View</button>\n", "                    <button class=\"slp-btn\" id=\"slp-export-observations\">Export Observations CSV</button>\n                    <button class=\"slp-btn\" id=\"slp-export-target-cache\">Export Target Cache CSV</button>\n                    <button class=\"slp-btn\" id=\"slp-copy-debug\">Copy Debug Data</button>\n                    <button class=\"slp-btn\" id=\"slp-refresh-debug\">Refresh View</button>\n", 1)

anchor = """    function debugHtml() {\n        const data = buildDebugData();\n"""
insert = r'''    function csvCell(value) {
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

    function exportObservationCsv() {
        refreshCollectedDataFromStorage();
        const headers = [
            'checked_at', 'id', 'name', 'level', 'total', 'sources',
            'status', 'description', 'status_until', 'hospitalization_observed'
        ];
        const rows = [...state.observationLog]
            .sort((a, b) => Number(a.checkedAt || 0) - Number(b.checkedAt || 0))
            .map(row => ({
                checked_at: row.checkedAt ? new Date(row.checkedAt).toISOString() : '',
                id: row.id || '',
                name: row.name || '',
                level: row.level ?? '',
                total: row.total ?? '',
                sources: row.sources || '',
                status: row.status || '',
                description: row.description || '',
                status_until: row.until ? new Date(Number(row.until) * 1000).toISOString() : '',
                hospitalization_observed: row.hospitalizationObserved ? 'Yes' : 'No'
            }));
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCsv(`Slinky-Leveling-Observations-${stamp}.csv`, headers, rows);
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
'''
if anchor not in text:
    raise SystemExit('debugHtml anchor not found')
text = text.replace(anchor, insert, 1)

text = text.replace("        panel.querySelector('#slp-copy-debug')?.addEventListener('click', async event => {\n", "        panel.querySelector('#slp-export-observations')?.addEventListener('click', () => exportObservationCsv());\n        panel.querySelector('#slp-export-target-cache')?.addEventListener('click', () => exportTargetCacheCsv());\n\n        panel.querySelector('#slp-copy-debug')?.addEventListener('click', async event => {\n", 1)
text = text.replace("            state.activityCache = { refreshedAt: 0, activeTargets: {}, snapshots: [] };\n\n            saveJson(KEYS.hospitalHistory, {});\n", "            state.activityCache = { refreshedAt: 0, activeTargets: {}, snapshots: [] };\n            state.observationLog = [];\n\n            saveJson(KEYS.hospitalHistory, {});\n", 1)
text = text.replace("            saveJson(KEYS.activityCache, state.activityCache);\n            render();\n", "            saveJson(KEYS.activityCache, state.activityCache);\n            saveJson(KEYS.observationLog, []);\n            render();\n", 1)

path.write_text(text, encoding='utf-8')
