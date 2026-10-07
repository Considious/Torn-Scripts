import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');

for (const functionName of [
  'formatBazaarOneDollarListings',
  'formatItemMarketPurchaseOpportunities',
  'fillBazaarPurchaseMaximum',
  'fillItemMarketPurchaseMaximum',
  'syncHighlightedQuickPurchaseControls',
  'handleHighlightedQuickPurchaseClick'
]) {
  assert(source.includes(`function ${functionName}`), `Missing ADHD Dashboard purchase function: ${functionName}`);
}
for (const marker of [
  'data-tdd-bazaar-targeted',
  'data-tdd-bazaar-shop-profit',
  'data-tdd-item-market-one-dollar',
  'data-tdd-item-market-shop-profit',
  'data-tdd-quick-buy',
  'tdd-quick-buy-layer'
]) {
  assert(source.includes(marker), `Missing ADHD Dashboard DOM marker: ${marker}`);
}
assert(!source.includes('function formatMarketPurchasePage'), 'The duplicate PDA market formatter must stay removed');
assert(!source.includes('data-slink-market-highlight'), 'The duplicate PDA highlight attributes must stay removed');
assert(source.includes("url.searchParams.set('highlight', '1')"), 'Bazaar alerts must use the ADHD highlight contract');
assert(!source.includes('slink-armory-request-cell'), 'PDA must not restructure Torn Armory rows');
assert(source.includes('function retrieveWarArmoryItem'), 'PDA Armory recall handling must remain available');
console.log('PDA uses the original ADHD market highlighting/BUY flow without changing Torn Armory rows.');
