import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync(new URL('./src/00-runtime-core.part', import.meta.url), 'utf8');
const combat = fs.readFileSync(new URL('./src/30-dashboard-combat.part', import.meta.url), 'utf8');

assert.match(core, /const MUGGING_OWN_STATS_TTL_MS = 15 \* 60_000/);
assert.match(combat, /function pdaStoredOwnBattleStats/);
assert.match(combat, /dataState\.caches\.ownBattleStats/);
assert.match(combat, /pdaOwnBattleStats\(force === true && options\.background !== true\)/);
assert.match(combat, /userBattleStats:Math\.max\(0, Number\(ownStats\?\.total/);
assert.match(combat, /userBattleStats,/);

console.log('PDA shared battle-stat freshness checks passed.');

