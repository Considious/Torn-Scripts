import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const core = fs.readFileSync(path.join(directory, 'src/00-runtime-core.part'), 'utf8');
const alerts = fs.readFileSync(path.join(directory, 'src/40-war.part'), 'utf8');
const shell = fs.readFileSync(path.join(directory, 'src/90-shell-bootstrap.part'), 'utf8');
const source = core + alerts + shell;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(core.includes('@version      0.4.106'), 'PDA alert-settings version is missing.');
assert(source.includes('class="alert-settings"'), 'Alert settings UI is missing.');
assert(source.includes('data-alert-type='), 'Alert-type controls are missing.');
assert(source.includes("dataState.settings.alerts.enabledTypes?.[id] === false"), 'Alert generation does not respect disabled types.');
assert(source.includes("data-action=\"alerts-enable-all\""), 'Enable-all control is missing.');
assert(source.includes("data-action=\"alerts-disable-all\""), 'Disable-all control is missing.');

const start = core.indexOf('const PDA_CITY_SHOP_TARGETS');
const end = core.indexOf('const GOOGLE_PLAY_POINTS_HELP_URL', start);
assert(start >= 0 && end > start, 'Alert type definitions are missing.');
const context = {};
vm.createContext(context);
vm.runInContext(core.slice(start, end) + '\nthis.alerts={PDA_ALERT_TYPES,PDA_CITY_SHOP_TARGETS,normalizePdaAlertTypes};', context);
const { PDA_ALERT_TYPES, PDA_CITY_SHOP_TARGETS, normalizePdaAlertTypes } = context.alerts;
assert(PDA_ALERT_TYPES.length === 32, 'Expected all built-in and city-stock PDA alert types.');
assert(PDA_CITY_SHOP_TARGETS.length === 6, 'Expected the six extension-matched city stock targets.');
const ids = PDA_ALERT_TYPES.map(definition => definition.id);
assert(new Set(ids).size === ids.length, 'Alert type IDs must be unique.');
const defaults = normalizePdaAlertTypes(null);
assert(PDA_ALERT_TYPES.filter(definition => definition.defaultEnabled !== false).every(definition => defaults[definition.id] === true), 'Existing built-in alerts must remain enabled by default.');
assert(PDA_CITY_SHOP_TARGETS.every(target => defaults[`cityStock:${target.id}`] === false), 'City stock alerts must remain opt-in.');
const disabled = normalizePdaAlertTypes({ raceOrFly:false, landing:false });
assert(disabled.raceOrFly === false && disabled.landing === false, 'Saved disabled alert choices were not retained.');
assert(disabled.energyFull === true, 'Unspecified alert types must remain enabled.');
assert(alerts.includes('cityShopTargetStockPda(snapshot?.cityShops)'), 'PDA city stock alerts are not generated from Torn cityshops data.');
assert(alerts.includes("tornJson('/v2/torn/cityshops'"), 'PDA city stock alerts do not fetch Torn cityshops data.');
assert(shell.includes("dataState.settings.alerts.enabledTypes[id] = event.target.checked === true"), 'Individual alert choices are not persisted from their own checkbox.');
assert(alerts.includes('data-ui-autosave="true" data-alert-type='), 'Alert checkboxes must not be overwritten by the draft restoration guard.');

console.log('PDA alert settings validation passed.');
