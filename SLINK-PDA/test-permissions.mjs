import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('./', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('source-manifest.json', root), 'utf8'));
const source = manifest.fragments.map(path => readFileSync(new URL(path, root), 'utf8')).join('');
const addonSource = (manifest.startupAddons || []).map(addon => readFileSync(new URL(addon.source, root), 'utf8')).join('');
const allSource = source + addonSource;
new Function(source);
for (const scope of [
  'slink.combat.bounties',
  'slink.combat.player-stats',
  'slink.combat.target-list',
  'slink.efficiency.merits',
  'slink.efficiency.dollar-bazaars',
  'slink.qol.racing',
  'slink.qol.abroad-stocks',
  'slink.qol.company',
  'slink.qol.museum',
  'slink.qol.money-property',
  'slink.qol.events'
]) assert.ok(allSource.includes(scope), `Missing PDA permission scope: ${scope}`);
assert.ok(source.includes("qualityOfLife:['racing','abroadStocks','company','museums',...pdaPlugins.keys()]"));
assert.ok(!source.includes("qualityOfLife:['racing','abroadStocks','travelSafety']"));
assert.ok(source.includes('hasAdminScope() || hasGrantedScope(required)'));
assert.ok(!source.includes('TRAVEL_SAFETY_SCOPE'));
console.log('PDA permission and navigation validation passed.');
