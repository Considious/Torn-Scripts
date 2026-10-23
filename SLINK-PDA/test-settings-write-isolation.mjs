import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const core = fs.readFileSync(new URL('./src/00-runtime-core.part', import.meta.url), 'utf8');
const start = core.indexOf('function cloneSettings');
const end = core.indexOf('function readSafeSettingsEnvelope', start);
assert.ok(start >= 0 && end > start, 'Settings merge helpers are missing.');

const context = {
  storedRecord(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : null; }
};
vm.createContext(context);
vm.runInContext(core.slice(start, end) + '\nthis.mergeSettingChanges=mergeSettingChanges;', context);

const base = { alerts:{ enabledTypes:{ cityItems:true, medicalCooldown:true } }, mugging:{ maxFairFight:3 } };
const latest = { alerts:{ enabledTypes:{ cityItems:false, medicalCooldown:false } }, mugging:{ maxFairFight:3 } };
const unchangedWriter = context.mergeSettingChanges(base, base, latest);
assert.deepEqual(JSON.parse(JSON.stringify(unchangedWriter)), latest, 'A background cache write must retain the newest saved settings.');

const changedHere = { alerts:base.alerts, mugging:{ maxFairFight:2.4 } };
const merged = context.mergeSettingChanges(base, changedHere, latest);
assert.equal(merged.alerts.enabledTypes.cityItems, false, 'An unrelated Mugging save must not restore stale alert choices.');
assert.equal(merged.mugging.maxFairFight, 2.4, 'The setting changed in the active PDA view must be saved.');

assert.match(core, /const settingsChangedHere = !sameSettingValue\(currentSettings, lastPersistedSettings\)/);
assert.match(core, /recordHasData\(latestSettings\.data\) \? cloneSettings\(latestSettings\.data\) : currentSettings/);

console.log('SLINK PDA concurrent settings-write isolation checks passed.');
