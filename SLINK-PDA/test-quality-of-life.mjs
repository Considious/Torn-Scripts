import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./SLINK_PDA_Runtime.js', import.meta.url), 'utf8');

assert(source.includes('/api/public/v1/restocking-soon'), 'Abroad Stocks must use the provider forecast endpoint for published restock estimates.');
assert(source.includes('estimatedRestockMinutes'), 'Abroad Stocks must normalize provider restock estimates.');
assert(/===\s*companyTypeId/.test(source), 'Company job points must match the current company type, not the individual company ID.');
assert(source.includes('class="abroad-summary"'), 'Abroad Stocks must render a compact mobile summary.');
assert(source.includes('class="museum-watch-controls"'), 'Museum market controls must use the mobile layout.');
assert(!source.includes('market USD'), 'Museum prices must use Torn cash notation rather than USD.');

console.log('PDA Quality of Life data and mobile layout wiring is verified.');
