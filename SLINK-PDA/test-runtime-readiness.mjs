import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertVersionConsistency } from './test-support/runtime.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const loader = fs.readFileSync(path.join(directory, 'SLINK_PDA_Dashboard.user.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'source-manifest.json'), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

new Function(loader);
assertVersionConsistency();
assert(loader.includes('slinkReady') && loader.includes('slinkAddonsReady'), 'Readiness must use the shared dashboard host.');
assert(loader.includes("dataset.slinkAddonsReady='true'"), 'Downloaded add-ons do not signal readiness through the shared dashboard host.');
assert(loader.includes("dataset.slinkAddonsReady='false'"), 'A new add-on attempt does not clear stale readiness.');
assert(!loader.includes('globalThis.__SLINK_PDA_ADDONS_READY__ === true'), 'Loader still depends on a cross-context readiness variable.');
assert(loader.includes('readSourceManifest(2500)'), 'Cached startup must check the live manifest with a bounded wait.');
assert(loader.includes('main/SLINK-PDA/'), 'Launcher must follow the stable main branch.');

console.log('PDA runtime readiness validation passed.');
