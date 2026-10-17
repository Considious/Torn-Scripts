import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync(new URL('./src/00-runtime-core.part', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('./src/30-dashboard-combat.part', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('./src/90-shell-bootstrap.part', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('./build.mjs', import.meta.url), 'utf8');

assert(core.includes("const DATA_MIRROR_KEY = 'slink-pda-dashboard:data:mirror:v1'"), 'PDA runtime must maintain an independent local data mirror.');
assert(core.includes('function writeDataMirror(value)'), 'Every primary data write must also update the local mirror.');
assert(core.includes('if (key === DATA_STORAGE_KEY) writeDataMirror(value)'), 'The mirror must be written before the GM bridge.');
assert(core.indexOf('if (recordHasData(mirror)) return mirror') < core.indexOf('if (recordHasData(gmValue)) return gmValue'), 'The synchronous mirror must win over stale primary data.');
assert(!core.includes('global.localStorage.removeItem(DATA_STORAGE_KEY);'), 'Startup must never erase the legacy recovery copy.');
assert(build.includes('function readMirror()'), 'The startup loader must recover from the mirror before bootstrapping the runtime.');
assert(build.includes("globalThis.GM_setValue(DATA_STORAGE_KEY, mirror)"), 'The loader must repair primary GM storage after mirror recovery.');
assert(core.includes('function portableBackupPayload()'), 'PDA must generate a restricted portable backup.');
assert(core.includes("settings:JSON.parse(JSON.stringify(dataState.settings || {}))"), 'The backup must include user settings.');
assert(core.includes("targetList:JSON.parse(JSON.stringify(dataState.caches?.targetList || {}))"), 'The backup must include saved targets.');
assert(core.includes('uiState:{'), 'The backup must include dashboard layout and tab preferences.');
assert(!/function portableBackupPayload\(\)[\s\S]*?\n}\n/.exec(core)?.[0].includes('apiKey'), 'Portable backups must not include API keys.');
assert(!/function portableBackupPayload\(\)[\s\S]*?\n}\n/.exec(core)?.[0].includes('sessions'), 'Portable backups must not include login sessions.');
assert(dashboard.includes('API keys and login sessions are never included'), 'The Access UI must clearly explain backup exclusions.');
assert(shell.includes("data-action=\"restore-data-backup\"") || shell.includes("action === 'restore-data-backup'"), 'The Access UI restore action must be wired.');
assert(shell.includes('uploadDataBackup(false)'), 'PDA startup must schedule the twice-daily backup check.');

console.log('PDA durable local storage and API-key-free backup wiring are verified.');
