import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { runtime as source, extractFunction } from './test-support/runtime.mjs';

const normalizeShopCases = vm.runInNewContext('('+extractFunction('catalogItems', 'src/10-market-runtime.part')+')');
const shopCases = { items:[
  {id:220,name:'Grenade',value:{shops:[{country:'Torn',shop:'Big Al',sell_price:8000},{country:'United Kingdom',shop:'Abroad',sell_price:10000}]}},
  {id:221,name:'Foreign only',value:{shops:[{country:'Mexico',shop:'Market',sell_price:10000}]}},
  {id:222,name:'Empty',value:{shops:[],sell_price:9000,vendor:{country:'Torn',name:'Legacy'}}},
  {id:223,name:'Buy only',value:{shops:[{country:'Torn',shop:'Shop',buy_price:9000,sell_price:null}]}},
  {id:224,name:'Mixed',value:{shops:[{country:'Torn',shop:'Shop',sell_price:6000},{country:'Japan',shop:'Abroad',sell_price:10000}]}}
] };
const buybacks = Object.fromEntries(normalizeShopCases(shopCases).map(item => [item.id,item.shopSellPrice]));
for (const [id,price] of [[220,7000],[221,0],[222,0],[223,0],[224,6000]]) if (buybacks[id] !== price) throw Error('Incorrect city-shop buyback for '+id);
assert.equal(normalizeShopCases(shopCases).find(item => item.id === 220).overseasSellPrice, 10000);
const classifyShop = vm.runInNewContext('('+extractFunction('bazaarPurchaseOpportunity', 'src/50-market-dom.part')+')', {
  marketPurchaseState:{itemCatalog:{schema:2}}, itemCatalogFresh:()=>true,
  bazaarCardPrice:card=>card.price, bazaarCardUnavailable:()=>false,
  catalogItemForBazaarCard:card=>({sellPrice:7000, overseasSellPrice:card.overseas})
});
assert.equal(classifyShop({price:7500}).shopProfit,false);
assert.equal(classifyShop({price:7500,overseas:9000}).overseasProfit,true);
assert.equal(classifyShop({price:9000,overseas:9000}).overseasProfit,false);
assert.equal(classifyShop({price:1,overseas:9000}).overseasProfit,false);

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

const activity=vm.createContext({pdaPagePresent:true,document:{visibilityState:'visible',hasFocus:()=>false}});
vm.runInContext(extractFunction('pdaDomActive','src/00-runtime-core.part')+extractFunction('focusedTornPage','src/50-market-dom.part'),activity);
assert.equal(activity.focusedTornPage(),true,'A visible PDA WebView must work even when hasFocus is false');
activity.document.visibilityState='hidden';
assert.equal(activity.focusedTornPage(),false,'Hidden PDA pages must not scrape Market DOM');
activity.document.visibilityState='visible';activity.pdaPagePresent=false;
assert.equal(activity.focusedTornPage(),false,'A pagehide-suspended PDA page must not scrape');
assert(source.includes("action === 'toggle-market-dom-test' && hasScope('admin.*')"), 'PDA Market DOM Test action must require admin.*.');
assert(source.includes("${hasScope('admin.*') ? \`<button type=\"button\" data-action=\"toggle-market-dom-test\""), 'PDA Market DOM Test control must be hidden from non-admin users.');
assert(source.includes("data-tdd-market-dom-test"), 'PDA Market DOM Test must mark a real production listing.');
assert(source.includes("[data-tdd-market-dom-test=\"bazaar\"]") && source.includes("[data-tdd-market-dom-test=\"item-market\"]"), 'PDA forced test listings must enter the production quick-buy selector path.');
assert(source.includes("if (!event.isTrusted"), 'PDA SLINK Buy must remain user-initiated.');
assert(source.includes("spec.native.click();"), 'PDA SLINK Buy must delegate to Torn native controls.');

console.log('PDA ADHD market DOM flow, admin-only diagnostic, and WebView-safe activation are verified.');
