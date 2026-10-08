import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(root, 'SLINK_PDA_Dashboard.user.js'), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }
try { new Function(source); }
catch (error) { throw new Error(`PDA userscript has a parse-time syntax error: ${error.message}`); }

assert(source.includes('// @version      0.4.25'), 'Unexpected PDA Phase 10 version.');
assert(source.includes('// @connect      slinkmuggingworker.richard-johnson554.workers.dev'), 'Mugging Worker is not allowlisted for PDA.');
assert(source.includes("mugging:'https://slinkmuggingworker.richard-johnson554.workers.dev'"), 'Mugging Worker URL is missing.');
assert(source.includes('data-combat-tab="mugging" hidden'), 'Unauthorized PDA sessions can see the Mugging tab.');
assert(source.includes("['[data-combat-tab=\"mugging\"]', 'slink.mugging']"), 'Mugging is not tied to the backend-managed scope.');
assert(source.includes("tab === 'mugging' && !hasScope('slink.mugging')"), 'Direct Mugging tab selection is not denied.');
assert(source.includes("if (!hasScope('slink.mugging'))") && source.includes("root.innerHTML = '';"), 'The Mugging panel lacks a runtime permission guard.');
assert(source.includes("await ensurePermissionSession(false)") && source.includes("Authorization:`Bearer ${session.token}`"), 'PDA assignments do not use the shared permission session.');
assert(source.includes("tornJson('/v2/user/battlestats'") && source.includes("['strength', 'defense', 'speed', 'dexterity']"), 'PDA does not calculate the requesting player battle-stat total through the shared Torn limiter.');
assert(source.includes('const MUGGING_ACTIVE_BUDGET = 10') && source.includes('const MUGGING_INACTIVE_BUDGET = 5'), 'PDA active/inactive contribution budgets are incorrect.');
assert(source.includes('const MUGGING_INACTIVE_AFTER_MS = 5 * 60_000'), 'PDA does not reduce Mugging contribution after five minutes.');
assert(source.includes("muggingRequest('/api/contributor/tasks'") && source.includes('runMuggingContribution'), 'PDA contributor task scheduling is missing.');
assert(source.includes("priority:mode === 'active' ? 'normal' : 'low'") && source.includes('wait:false'), 'PDA inactive contribution does not yield to other shared Torn API work.');
assert(source.includes('muggingPendingSync') && source.includes('pendingSync:true'), 'PDA does not retain contributor observations for synchronization.');
assert(source.includes('const MUGGING_SYNC_INTERVAL_MS = 6 * 60 * 60_000') && source.includes('const MUGGING_SYNC_BATCH_SIZE = 100'), 'PDA Phase 10 synchronization is not batched on the six-hour schedule.');
assert(source.includes("muggingRequest('/api/contributor/reports'") && source.includes('acknowledged_report_ids'), 'PDA Phase 10 does not use acknowledged contributor-report batches.');
assert(source.includes('delete latest[playerId]'), 'PDA does not remove acknowledged observations from its pending queue.');
assert(source.includes("mode === 'active'") && source.includes('MUGGING_ASSIGNMENT_REFRESH_MS'), 'Inactive PDA users can still request new personal Mugging assignments.');
assert(source.includes('Inactive mode keeps this cached list visible') && source.includes('up to 5/min'), 'PDA does not explain cached inactive behavior.');
assert(source.includes("muggingRequest('/api/assignments/rough'"), 'PDA does not request rough assignments from the Mugging Worker.');
assert(source.includes('Rough FF') && source.includes('synchronized to shared SLINK intelligence'), 'PDA does not distinguish rough assignments or explain contributor scheduling.');
assert(source.includes('data-action="refresh-mugging"'), 'PDA has no manual assignment refresh.');
assert(source.includes('data-target-source="mugging"') && source.includes("tags = ['Mug']"), 'Mugging does not reuse the explicit Target List handoff.');
assert(!/MUGGING_TEST_USER|MUGGING_FACTION_ID|MUGGING_SERVICE_TOKEN/.test(source), 'PDA contains a hard-coded Mugging override or backend secret.');
assert(source.includes("if (!/^\\/profiles\\.php$/i.test(url.pathname)) return null;"), 'PDA status scraping is not hard-gated to profiles.php.');
assert(source.includes('let attackMugScanTimer = null') && source.includes('}, 120);'), 'PDA attack-result scanning is not throttled.');
assert(!source.includes('slinkMugPending') && !source.includes('recordMugResultNode(node); });'), 'PDA still contains the recursive attack-result refresh loop.');
assert(source.includes('reportedMugNodes.add(node)') && source.includes('Refresh at most once'), 'PDA does not claim each attack-result node before its one optional refresh.');
console.log('PDA Mugging Phase 10 contributor synchronization checks passed.');
