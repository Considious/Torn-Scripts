import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertVersionConsistency } from './test-support/runtime.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const loader = fs.readFileSync(path.join(directory, 'SLINK_PDA_Dashboard.user.js'), 'utf8');
const hasLoaderCode = code => loader.replace(/\s/g,'').replaceAll('"', "'").includes(code.replace(/\s/g,'').replaceAll('"', "'"));
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'source-manifest.json'), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

new Function(loader);
assertVersionConsistency();
assert(hasLoaderCode("host?.dataset?.slinkReady === 'true' && host?.dataset?.slinkAddonsReady === 'true'"), 'Readiness must use the shared dashboard host.');
assert(hasLoaderCode("slinkReadyHost.dataset.slinkAddonsReady='true'"), 'Downloaded add-ons do not signal readiness through the shared dashboard host.');
assert(hasLoaderCode("currentHost.dataset.slinkAddonsReady = 'false'"), 'A new add-on attempt does not clear stale readiness.');
assert(!hasLoaderCode("host?.dataset?.slinkReady === 'true' && globalThis.__SLINK_PDA_ADDONS_READY__ === true"), 'Loader still depends on a cross-context readiness variable.');

console.log('PDA runtime readiness validation passed.');
