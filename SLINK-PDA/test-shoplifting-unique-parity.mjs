import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const core = fs.readFileSync(path.join(directory, 'src/00-runtime-core.part'), 'utf8');
const alerts = fs.readFileSync(path.join(directory, 'src/40-war.part'), 'utf8');
const loader = fs.readFileSync(path.join(directory, 'SLINK_PDA_Dashboard.user.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'source-manifest.json'), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(loader.match(/^\/\/ @version\s+(.+)$/m)?.[1]?.trim() === JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')).version, 'PDA installer version and package metadata must agree.');
assert(/^sha256-[a-f0-9]{64}$/.test(manifest.revision), 'Runtime manifest must use its generated content digest.');

const match = core.match(/const SHOPLIFTING_UNIQUE_WINDOWS = Object\.freeze\((\[[\s\S]*?\])\.map\(entry => Object\.freeze\(entry\)\)\);/);
assert(match, 'Shoplifting unique catalog is missing.');
const outcomes = JSON.parse(match[1]);
assert(outcomes.length === 60, 'Expected all 60 Shoplifting unique outcomes.');
const ids = outcomes.map(outcome => Number(outcome.id));
assert(ids.every(Number.isFinite), 'Every Shoplifting unique must use its Torn outcome ID.');
assert(new Set(ids).size === outcomes.length, 'Shoplifting Torn outcome IDs must be unique.');
assert(outcomes.find(outcome => outcome.label === 'Cluster Ring')?.id === 20765, 'Cluster Ring must use Torn outcome ID 20765.');
assert(outcomes.find(outcome => outcome.label === 'High-Speed Drive')?.id === 12802, 'High-Speed Drive must use Torn outcome ID 12802.');
assert(outcomes.find(outcome => outcome.label === 'Coat Hanger')?.id === 12711, 'Coat Hanger must use Torn outcome ID 12711.');

assert(alerts.includes('SHOPLIFTING_UNIQUE_WINDOWS.filter(outcome => expectedIdSet.has(outcome.id))'), 'PDA completion progress is not keyed by Torn outcome ID.');
assert(alerts.includes('!completedIds.includes(outcome.id)'), 'Completed Shoplifting uniques are not excluded by Torn outcome ID.');
assert(alerts.includes('const id = Number(outcome.id);'), 'Live Shoplifting opportunities are not keyed by Torn outcome ID.');
assert(alerts.includes('!expectedIds.has(id) || completed.has(id)'), 'Live Shoplifting alerts do not exclude unknown or completed Torn outcome IDs.');
assert(!alerts.includes('const id = Number(expectedIds[index]);'), 'Legacy array-position Shoplifting mapping is still present.');

console.log('PDA Shoplifting unique parity validation passed.');
