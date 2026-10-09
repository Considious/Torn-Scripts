import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(directory, 'SLINK_PDA_Dashboard.user.js'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

new Function(source);
assert(source.includes('@version      0.4.29'), 'PDA alert-settings version is missing.');
assert(source.includes('class="alert-settings"'), 'Alert settings UI is missing.');
assert(source.includes('data-alert-type='), 'Alert-type controls are missing.');
assert(source.includes("dataState.settings.alerts.enabledTypes?.[id] === false"), 'Alert generation does not respect disabled types.');
assert(source.includes("data-action=\"alerts-enable-all\""), 'Enable-all control is missing.');
assert(source.includes("data-action=\"alerts-disable-all\""), 'Disable-all control is missing.');

const start = source.indexOf('const PDA_ALERT_TYPES');
const end = source.indexOf('const GOOGLE_PLAY_POINTS_HELP_URL', start);
assert(start >= 0 && end > start, 'Alert type definitions are missing.');
const context = {};
vm.createContext(context);
vm.runInContext(source.slice(start, end) + '\nthis.alerts={PDA_ALERT_TYPES,normalizePdaAlertTypes};', context);
const { PDA_ALERT_TYPES, normalizePdaAlertTypes } = context.alerts;
assert(PDA_ALERT_TYPES.length === 18, 'Expected all 18 built-in PDA alert types.');
const ids = PDA_ALERT_TYPES.map(definition => definition.id);
assert(new Set(ids).size === ids.length, 'Alert type IDs must be unique.');
const defaults = normalizePdaAlertTypes(null);
assert(ids.every(id => defaults[id] === true), 'Existing users must retain all alerts by default.');
const disabled = normalizePdaAlertTypes({ raceOrFly:false, landing:false });
assert(disabled.raceOrFly === false && disabled.landing === false, 'Saved disabled alert choices were not retained.');
assert(disabled.energyFull === true, 'Unspecified alert types must remain enabled.');

const rowsStart = source.indexOf('function alertRows(snapshot)');
const rowsEnd = source.indexOf('function updateAlertIndicator', rowsStart);
const generatedIds = [...source.slice(rowsStart, rowsEnd).matchAll(/\badd\('([^']+)'/g)].map(match => match[1]);
assert(generatedIds.length === ids.length, 'Alert settings and generated built-in alerts are out of sync.');
assert(generatedIds.every(id => ids.includes(id)), 'A generated alert has no settings control.');
assert(ids.every(id => generatedIds.includes(id)), 'An alert setting does not map to a generated alert.');

console.log('PDA alert settings validation passed.');
