import fs from 'node:fs';

const source = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(source.includes("const TRAVEL_SAFETY_SCOPE = 'slink.qol.travel-safety';"), 'Travel permission scope is missing.');
assert(source.includes('Math.ceil(Math.max(0, Number(oneWayMs) || 0) * 2 * (1 + TRAVEL_SAFETY_BUFFER_RATIO))'), 'Round-trip calculation or 10% buffer is missing.');
assert(source.includes('button[aria-label^="Travel to "]'), 'Generic Torn Travel button matching is missing.');
assert(source.includes('data-slink-travel-dialog'), 'Travel conflict dialog is missing.');
assert(source.includes("document.addEventListener('click', handleTravelSafetyClick, true)"), 'Capture-phase travel interception is missing.');
assert(source.includes("if (!hasScope(TRAVEL_SAFETY_SCOPE))"), 'Permission enforcement is missing.');
new Function(source);
console.log('PDA travel safety checks passed.');
