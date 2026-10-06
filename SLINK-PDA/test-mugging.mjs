import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(root, 'SLINK_PDA_Dashboard.user.js'), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

assert(source.includes('// @version      0.4.21'), 'Unexpected PDA Phase 8 version.');
assert(source.includes('// @connect      slinkmuggingworker.richard-johnson554.workers.dev'), 'Mugging Worker is not allowlisted for PDA.');
assert(source.includes("mugging:'https://slinkmuggingworker.richard-johnson554.workers.dev'"), 'Mugging Worker URL is missing.');
assert(source.includes('data-combat-tab="mugging" hidden'), 'Unauthorized PDA sessions can see the Mugging tab.');
assert(source.includes("['[data-combat-tab=\"mugging\"]', 'slink.mugging']"), 'Mugging is not tied to the backend-managed scope.');
assert(source.includes("tab === 'mugging' && !hasScope('slink.mugging')"), 'Direct Mugging tab selection is not denied.');
assert(source.includes("if (!hasScope('slink.mugging'))") && source.includes("root.innerHTML = '';"), 'The Mugging panel lacks a runtime permission guard.');
assert(source.includes("await ensurePermissionSession(false)") && source.includes("Authorization:`Bearer ${session.token}`"), 'PDA assignments do not use the shared permission session.');
assert(source.includes("tornJson('/v2/user/battlestats'") && source.includes("['strength', 'defense', 'speed', 'dexterity']"), 'PDA does not calculate the requesting player battle-stat total through the shared Torn limiter.');
assert(source.includes("muggingRequest('/api/assignments/rough'"), 'PDA does not request rough assignments from the Mugging Worker.');
assert(source.includes('Rough FF') && source.includes('Contributor scheduling remains off until Phase 9'), 'PDA does not distinguish rough assignments from future refined data.');
assert(source.includes('data-action="refresh-mugging"'), 'PDA has no manual assignment refresh.');
assert(source.includes('data-target-source="mugging"') && source.includes("tags = ['Mug']"), 'Mugging does not reuse the explicit Target List handoff.');
assert(!/MUGGING_TEST_USER|MUGGING_FACTION_ID|MUGGING_SERVICE_TOKEN/.test(source), 'PDA contains a hard-coded Mugging override or backend secret.');
console.log('PDA Mugging Phase 8 rough assignment checks passed.');
