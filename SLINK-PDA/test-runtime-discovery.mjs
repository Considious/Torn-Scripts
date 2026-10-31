import assert from 'node:assert/strict';
import vm from 'node:vm';
import { manifest, launcher, runtime, fragments, extractFunction, assertVersionConsistency } from './test-support/runtime.mjs';

assertVersionConsistency();
assert.ok(launcher.includes('source-manifest.json'), 'Launcher must load the source manifest');
assert.ok(fragments.size === manifest.fragments.length && fragments.size > 1, 'All manifest fragments must be discovered');
assert.equal(runtime, manifest.fragments.map(path => fragments.get(path)).join(''), 'Discovery must preserve loader order and source bytes');
assert.throws(() => extractFunction('missingFunctionForDiscoveryTest'), /Missing runtime function/);
assert.throws(() => extractFunction('discordTimestamp', 'missing.part'), /Unknown runtime fragment/);
assert.throws(() => extractFunction('name);evil('));
const source = extractFunction('discordTimestamp', 'src/30-dashboard-combat.part');
assert.ok(!source.includes('function renderTimestamps'), 'Extraction must not include the next declaration');
const context = vm.createContext({ Date });
vm.runInContext(source, context);
assert.equal(context.discordTimestamp('1970-01-01T00:00').code, '<t:0:R>');
assert.equal(context.discordTimestamp('not-a-date'), null);
console.log('Manifest-based runtime discovery, version consistency and exact function extraction passed.');
