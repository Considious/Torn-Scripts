import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(root, 'src/00-runtime-core.part'), 'utf8');
const start = source.indexOf('const ABROAD_STOCKS = (() => {');
const close = source.indexOf('\n})();', start);
if (start < 0 || close < 0) throw new Error('Abroad Stocks core block was not found.');
const snippet = source.slice(start, close + '\n})();'.length) + '\nglobalThis.__ABROAD_STOCKS__ = ABROAD_STOCKS;';
const context = { globalThis:null, Intl, Date };
context.globalThis = context;
vm.runInNewContext(snippet, context, { filename:'src/00-runtime-core.part#abroad-stocks' });
const abroad = context.__ABROAD_STOCKS__;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const fetchedAt = Date.now();

const currentShape = abroad.normalizeProvider('yata', {
  stocks:{ mex:{ stocks:[{ id:206, name:'Xanax', quantity:41, cost:735000 }] } }
}, fetchedAt);
assert(currentShape.length === 1 && currentShape[0].countryCode === 'mex', 'Current provider shape changed.');

const futureItem = abroad.normalizeProvider('yata', {
  stocks:{ mex:{ stocks:[{ id:9999, name:'Future provider item', quantity:7, cost:123456 }] } }
}, fetchedAt);
assert(futureItem.length === 1 && futureItem[0].itemId === 9999, 'New provider items must remain data-driven.');

const futureCountry = abroad.normalizeProvider('prometheus', {
  data:{ nzl:{ name:'New Zealand', items:{ 777:{ item_name:'Kiwi', current_stock:4, buy_price:50 } } } }
}, fetchedAt);
assert(futureCountry.length === 1, 'Unknown provider destinations should not be discarded.');
assert(futureCountry[0].countryCode === 'nzl' && futureCountry[0].countryName === 'New Zealand', 'Dynamic country identity was lost.');
assert(futureCountry[0].itemId === 777 && futureCountry[0].quantity === 4, 'Object-keyed items were not normalized.');

const flatItems = abroad.normalizeProvider('tornIntel', {
  data:{ items:[{ country_code:'mex', item_id:206, item_name:'Xanax', available:5, foreign_price:735000 }] }
}, fetchedAt);
assert(flatItems.length === 1 && flatItems[0].countryCode === 'mex' && flatItems[0].quantity === 5, 'Flat item lists were not normalized.');

console.log('PDA Abroad Stocks validation passed.');

// Exercise the filter model from the production view.
{
  const filterSource = fs.readFileSync(path.join(root, 'src/20-quality-of-life.part'), 'utf8');
  const filterStart = filterSource.indexOf('function stockFilters(');
  const filterEnd = filterSource.indexOf('function stockFilterOptions(', filterStart);
  const {stockFilters,filterModel}=vm.runInNewContext(filterSource.slice(filterStart,filterEnd)+'\n({stockFilters,filterModel});');
  const rows=[
    {key:'mex:1',countryCode:'mex',countryName:'Mexico',itemId:1,itemName:'Item A',itemType:'Melee'},
    {key:'can:1',countryCode:'can',countryName:'Canada',itemId:1,itemName:'Item A',itemType:'Melee'},
    {key:'can:2',countryCode:'can',countryName:'Canada',itemId:2,itemName:'Item B',itemType:'Contraband'}
  ];
  const persisted=JSON.parse(JSON.stringify(stockFilters({item:'id:2',excluded:['Weapons']})));
  const itemView=filterModel(rows,persisted);
  assert(itemView.countries.length===1&&itemView.countries[0][0]==='can','Item selection must restrict countries.');
  assert(itemView.visible.has('can:2')&&!itemView.visible.has('can:1'),'Exclusion or selection was lost.');
  const countryView=filterModel(rows,stockFilters({country:'mex'}));
  assert(countryView.items.length===1&&countryView.items[0][0]==='id:1','Country must restrict item choices.');
  const first=abroad.normalizeProvider('yata',{stocks:{can:{stocks:[{id:2,name:'Item B',quantity:0,category:'Contraband'}]}}});
  const removed=abroad.normalizeProvider('droqs',{stocks:{can:{stocks:[{id:3,name:'Old item',quantity:15}]}}});
  const merged=abroad.mergeSnapshots({yata:first,droqs:removed});
  assert(merged.length===1&&merged[0].sources.yata.quantity===0&&merged[0].itemType==='Contraband','Zero stock stays listed and enrichment alone cannot advertise inventory.');
}
