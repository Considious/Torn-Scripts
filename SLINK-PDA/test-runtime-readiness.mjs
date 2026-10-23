import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const loader = fs.readFileSync(path.join(directory, 'SLINK_PDA_Dashboard.user.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'source-manifest.json'), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

new Function(loader);
assert(loader.includes('@version      0.4.86'), 'PDA loader version was not bumped.');
assert(manifest.revision === '0.4.86', 'Direct-source manifest revision was not bumped.');
assert(loader.includes("host?.dataset?.slinkReady === 'true' && host?.dataset?.slinkAddonsReady === 'true'"), 'Readiness must use the shared dashboard host.');
assert(loader.includes("slinkReadyHost.dataset.slinkAddonsReady='true'"), 'Downloaded add-ons do not signal readiness through the shared dashboard host.');
assert(loader.includes("currentHost.dataset.slinkAddonsReady = 'false'"), 'A new add-on attempt does not clear stale readiness.');
assert(!loader.includes("host?.dataset?.slinkReady === 'true' && globalThis.__SLINK_PDA_ADDONS_READY__ === true"), 'Loader still depends on a cross-context readiness variable.');

console.log('PDA runtime readiness validation passed.');
