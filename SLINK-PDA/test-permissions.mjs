import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');
for (const scope of [
  'slink.combat.bounties',
  'slink.combat.player-stats',
  'slink.combat.target-list',
  'slink.efficiency.merits',
  'slink.efficiency.dollar-bazaars',
  'slink.qol.racing',
  'slink.qol.abroad-stocks',
  'slink.qol.company',
  'slink.qol.museum'
]) assert.ok(source.includes(scope), `Missing PDA permission scope: ${scope}`);
assert.ok(source.includes("qualityOfLife:['racing','abroadStocks','company','museums']"));
assert.ok(!source.includes("qualityOfLife:['racing','abroadStocks','travelSafety']"));
assert.ok(source.includes('hasAdminScope() || hasGrantedScope(required)'));
console.log('PDA permission and navigation validation passed.');
