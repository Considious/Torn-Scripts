import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const read = relativePath => fs.readFileSync(path.join(directory, relativePath), 'utf8');
const core = read('src/00-runtime-core.part');
const alerts = read('src/40-war.part');
const shell = read('src/90-shell-bootstrap.part');
const loader = read('SLINK_PDA_Dashboard.user.js');
const manifest = JSON.parse(read('source-manifest.json'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(loader.match(/^\/\/ @version\s+(.+)$/m)?.[1]?.trim() === JSON.parse(read('package.json')).version, 'PDA installer version and package metadata must agree.');
assert(/^sha256-[a-f0-9]{64}$/.test(manifest.revision), 'Runtime manifest must use its generated content digest.');
assert(core.includes("const ALERT_SNOOZE_STORAGE_KEY = 'slink-pda-dashboard:alert-snoozes:v1';"), 'Dedicated alert snooze storage is missing.');
assert(core.includes('const alertSnoozes = mergeAlertSnoozes('), 'Stored alert snoozes are not merged during startup.');
assert(core.includes('snoozedUntil:alertSnoozes'), 'Merged alert snoozes are not applied to alert settings.');
assert(core.includes('writeAlertSnoozes(dataState.settings?.alerts?.snoozedUntil);'), 'Alert snoozes are not persisted independently.');
assert(alerts.includes("add('medicalCooldown', medical === 0"), 'Medical cooldown alert no longer uses its stable ID.');
assert(alerts.includes('Number(snoozed[id] || 0) <= Date.now()'), 'Alert generation does not honor snooze deadlines.');

const handlerStart = shell.indexOf("if (action === 'snooze-alert')");
const handlerEnd = shell.indexOf("if (action === 'hide-city-until-reset')", handlerStart);
assert(handlerStart >= 0 && handlerEnd > handlerStart, 'Alert snooze handler is missing.');
const handler = shell.slice(handlerStart, handlerEnd);
const reconcileAt = handler.indexOf('reconcileAlertNotifications(');
const writeAt = handler.indexOf('savePdaChanges()');
assert(reconcileAt >= 0 && writeAt > reconcileAt, 'Snoozing must reconcile the notification ledger before awaiting durable storage.');

console.log('PDA alert snooze persistence validation passed.');
