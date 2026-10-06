import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(root, 'SLINK_PDA_Dashboard.user.js'), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

assert(source.includes('// @version      0.4.20'), 'Unexpected PDA Phase 7 version.');
assert(source.includes('data-combat-tab="mugging" hidden'), 'Unauthorized PDA sessions can see the Mugging tab.');
assert(source.includes("['[data-combat-tab=\"mugging\"]', 'slink.mugging']"), 'Mugging is not tied to the backend-managed scope.');
assert(source.includes("tab === 'mugging' && !hasScope('slink.mugging')"), 'Direct Mugging tab selection is not denied.');
assert(source.includes("if (!hasScope('slink.mugging'))") && source.includes("root.innerHTML = '';"), 'The Mugging panel lacks a runtime permission guard.');
assert(source.includes('data-target-source="mugging"') && source.includes("tags = ['Mug']"), 'Mugging does not reuse the explicit Target List handoff.');
assert(!/MUGGING_TEST_USER|MUGGING_FACTION_ID/.test(source), 'PDA contains a hard-coded Mugging tester or faction override.');
console.log('PDA Mugging Phase 7 permission and UI checks passed.');
