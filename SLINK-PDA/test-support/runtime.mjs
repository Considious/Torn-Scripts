import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
export const read = path => readFileSync(new URL(path, root), 'utf8');
export const manifest = JSON.parse(read('source-manifest.json'));
export const launcher = read(manifest.output || 'SLINK_PDA_Dashboard.user.js');
export const fragments = new Map(manifest.fragments.map(path => [path, read(path)]));
export const runtime = [...fragments.values()].join('');
export const addons = (manifest.startupAddons || []).map(addon => read(addon.source)).join('\n');

export function assertVersionConsistency() {
  const version = launcher.match(/^\/\/ @version\s+(.+)$/m)?.[1]?.trim();
  assert.ok(version, 'Launcher version is missing');
  assert.equal(JSON.parse(read('package.json')).version, version, 'Package and launcher versions differ');
  const digest = 'sha256-' + createHash('sha256').update([runtime, ...((manifest.startupAddons || []).map(addon => read(addon.source)))].join('\n;\n'), 'utf8').digest('hex');
  assert.equal(manifest.revision, digest, 'Manifest must identify the exact current runtime/add-on content.');
  const core = fragments.get('src/00-runtime-core.part');
  assert.match(core, /global\.__SLINK_PDA_BOOTSTRAP__\?\.sourceRevision/,'Runtime identity must be supplied by the dynamic manifest.');
  assert.ok(!core.includes(`const CLIENT_VERSION = '${version}';`), 'Runtime must not duplicate the installer version.');
  assert.ok(launcher.includes('sourceRevision:e.revision'), 'Launcher must pass through the live content revision.');
  new vm.Script(launcher);
  new vm.Script(runtime);
  return version;
}

// Use the JavaScript parser rather than guessing a closing brace from old indentation.
// A fragment may be specified when separate embedded libraries reuse a helper name.
export function extractFunction(name, fragment) {
  const source = fragment ? fragments.get(fragment) : runtime;
  assert.ok(typeof source === 'string', `Unknown runtime fragment: ${fragment}`);
  assert.match(name, /^[A-Za-z_$][\w$]*$/);
  const declaration = new RegExp(`^(?:async )?function ${name}\\(`, 'm');
  const start = source.search(declaration);
  assert.ok(start >= 0, `Missing runtime function: ${name}`);
  const lines = source.slice(start).split('\n');
  let candidate = '';
  for (const line of lines) {
    candidate += line + '\n';
    try { new vm.Script(candidate); return candidate; }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  }
  throw new Error(`Runtime function could not be parsed: ${name}`);
}

