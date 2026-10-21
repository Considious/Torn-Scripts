import assert from 'node:assert/strict';
import fs from 'node:fs';

const alerts = fs.readFileSync(new URL('./src/40-war.part', import.meta.url), 'utf8');
assert.match(alerts, /const snapshotFresh = fetchedAt > 0 && Date\.now\(\) - fetchedAt <= 15 \* 60_000/);
assert.match(alerts, /if \(id !== 'timer24' && !snapshotFresh\) return/);

console.log('SLINK PDA stale-alert cutoff checks passed.');

