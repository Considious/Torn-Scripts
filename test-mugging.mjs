import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
import { runtime as source, launcher, assertVersionConsistency, extractFunction } from './test-support/runtime.mjs';
const combatSource = fs.readFileSync(path.join(root, 'src/30-dashboard-combat.part'), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }
try { new Function(source); }
catch (error) { throw new Error(`PDA userscript has a parse-time syntax error: ${error.message}`); }

assertVersionConsistency();
assert(launcher.includes('// @connect      slinkmuggingworker.richard-johnson554.workers.dev'), 'Launcher must allow Mugging requests.');
assert(source.includes('// @connect      slinkmuggingworker.richard-johnson554.workers.dev'), 'Mugging Worker is not allowlisted for PDA.');
assert(source.includes("mugging:'https://slinkmuggingworker.richard-johnson554.workers.dev'"), 'Mugging Worker URL is missing.');
assert(source.includes('data-combat-tab="mugging" hidden'), 'Unauthorized PDA sessions can see the Mugging tab.');
assert(source.includes("mugging:'slink.mugging'"), 'Mugging is not tied to the backend-managed scope.');
const gate = vm.createContext({ MODULE_SCOPES:{mugging:'slink.mugging'}, pdaPlugins:new Map(), hasScope:()=>false });
vm.runInContext(extractFunction('canAccessModule', 'src/30-dashboard-combat.part'), gate);
assert(!gate.canAccessModule('mugging'), 'Mugging module access must be denied without a grant.');
gate.hasScope = scope => scope === 'slink.mugging';
assert(gate.canAccessModule('mugging'), 'Mugging module access must allow an exact grant.');
assert(source.includes('canAccessModule(tab)'), 'Direct tab selection must use the shared permission predicate.');
assert(source.includes("if (!hasScope('slink.mugging'))") && source.includes("root.innerHTML = '';"), 'The Mugging panel lacks a runtime permission guard.');
assert(source.includes("await ensurePermissionSession(false)") && source.includes("Authorization:`Bearer ${session.token}`"), 'PDA assignments do not use the shared permission session.');
assert(combatSource.includes('pdaSharedData().personal({key:currentApiKey(),force,maxAgeMs:MUGGING_OWN_STATS_TTL_MS,requireLevel:true})') && source.includes("['strength', 'defense', 'speed', 'dexterity']"), 'PDA must use all four authenticated personal stats through the shared provider.');
assert(source.includes('contributionCapacity(readApiLedger(now))') && source.includes('CONTRIBUTION_CEILING = 40') && source.includes('CONTRIBUTION_INTERACTIVE_RESERVE = 10'), 'PDA contribution must use spare shared capacity, not a separate API budget.');
assert(source.includes('MUGGING_INACTIVE_AFTER_MS = MODULE_INACTIVE_AFTER_MS') && source.includes('MODULE_INACTIVE_AFTER_MS = 5 * 60_000'), 'PDA personal assignments must stop after five minutes away.');
assert(source.includes("muggingRequest('/api/contributor/tasks'") && source.includes('runMuggingContribution'), 'PDA contributor task scheduling is missing.');
assert(combatSource.includes("priority:'contribution'") && combatSource.includes('contribution:true') && combatSource.includes('wait:false'), 'PDA contribution does not yield to other shared Torn API work.');
assert(source.includes('muggingPendingSync') && source.includes('pendingSync:true'), 'PDA does not retain contributor observations for synchronization.');
assert(source.includes('const MUGGING_SYNC_INTERVAL_MS = 5 * 60_000') && source.includes('const MUGGING_SYNC_BATCH_SIZE = 100'), 'PDA contributor reports must use five-minute acknowledged batches.');
assert(source.includes("muggingRequest('/api/contributor/reports'") && source.includes('acknowledged_report_ids'), 'PDA Phase 10 does not use acknowledged contributor-report batches.');
assert(source.includes('delete latest[playerId]'), 'PDA does not remove acknowledged observations from its pending queue.');
assert(source.includes("mode === 'active'") && source.includes('MUGGING_ASSIGNMENT_REFRESH_MS'), 'Inactive PDA users can still request new personal Mugging assignments.');
assert(combatSource.includes('Last sync') && !combatSource.includes('Contributor checks use only'), 'PDA should show last sync without internal scheduling commentary.');
assert(source.includes("muggingRequest('/api/assignments/rough'"), 'PDA does not request rough assignments from the Mugging Worker.');
assert(source.includes('Rough FF') && source.includes('acknowledged_report_ids'), 'PDA must label rough assignments and retain acknowledged synchronization.');
assert(source.includes('data-action="refresh-mugging"'), 'PDA has no manual assignment refresh.');
assert(source.includes('data-target-source="mugging"') && source.includes("tags = ['Mug']"), 'Mugging does not reuse the explicit Target List handoff.');
assert(!/MUGGING_TEST_USER|MUGGING_FACTION_ID|MUGGING_SERVICE_TOKEN/.test(source), 'PDA contains a hard-coded Mugging override or backend secret.');
assert(source.includes("if (!/^\\/profiles\\.php$/i.test(url.pathname)) return null;"), 'PDA status scraping is not hard-gated to profiles.php.');
assert(source.includes('let attackMugScanTimer = null') && source.includes('}, 120);'), 'PDA attack-result scanning is not throttled.');
assert(!source.includes('slinkMugPending') && !source.includes('recordMugResultNode(node); });'), 'PDA still contains the recursive attack-result refresh loop.');
assert(source.includes('reportedMugNodes.add(node)') && source.includes('Refresh at most once'), 'PDA does not claim each attack-result node before its one optional refresh.');
console.log('PDA Mugging Phase 10 contributor synchronization checks passed.');

assert(combatSource.includes('muggingLevelBadge(target.level, cache.userLevel)'), 'PDA Mugging does not display the target level with the own-level gradient.');
assert(!combatSource.includes('const company = [target.companyName'), 'PDA Mugging still renders company metadata.');
