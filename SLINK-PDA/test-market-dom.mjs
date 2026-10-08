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

assert(source.includes("return document.visibilityState !== 'hidden';"), 'PDA Market DOM formatting must not depend on document.hasFocus().');
assert(source.includes("action === 'toggle-market-dom-test' && hasScope('admin.*')"), 'PDA Market DOM Test action must require admin.*.');
assert(source.includes("${hasScope('admin.*') ? \`<button type=\"button\" data-action=\"toggle-market-dom-test\""), 'PDA Market DOM Test control must be hidden from non-admin users.');
assert(source.includes("data-tdd-market-dom-test"), 'PDA Market DOM Test must mark a real production listing.');
assert(source.includes("[data-tdd-market-dom-test=\"bazaar\"]") && source.includes("[data-tdd-market-dom-test=\"item-market\"]"), 'PDA forced test listings must enter the production quick-buy selector path.');
assert(source.includes("if (!event.isTrusted"), 'PDA SLINK Buy must remain user-initiated.');
assert(source.includes("spec.native.click();"), 'PDA SLINK Buy must delegate to Torn native controls.');

console.log('PDA ADHD market DOM flow, admin-only diagnostic, and WebView-safe activation are verified.');
