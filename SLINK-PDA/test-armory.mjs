import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');
function extract(name, async = false) {
  const start = source.indexOf(`  ${async ? 'async ' : ''}function ${name}(`);
  assert(start >= 0, `Missing ${name}`);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}
function fixture({ mode = 'ranked-all', level = 15, ranked = true, prof = false, skipped = false, confirmation = true, focused = true, loseFocus = false } = {}) {
  const renders = [], delays = [], clicks = [];
  const row = { querySelector(selector) {
    if (selector === '.name') return { textContent:'Ranked weapon' };
    if (selector.includes('.loaned')) return { getAttribute:() => '?XID=1', textContent:'Borrower' };
    if (selector.includes('img.torn-item')) return { classList:{ contains:color => ranked && color === 'glow-yellow' } };
    if (selector.includes('bonus-attachment')) return prof ? {} : null;
    if (selector.includes('data-role')) return { click:() => clicks.push('open') };
    if (selector.includes('retrieve-yes')) return confirmation ? { getClientRects:() => [1], click:() => clicks.push('confirm') } : null;
    return null;
  } };
  const tab = { id:'tab=armoury&sub=weapons', querySelectorAll:() => [row] };
  const state = { armoryBusy:false };
  const context = vm.createContext({
    moduleState:{ war:state },
    dataState:{ settings:{ war:{ armoryMode:mode, armoryWhitelist:skipped ? ['1'] : [] } }, caches:{ warArmoryMembers:{ members:level === undefined ? [] : [{ id:'1', level }] } } },
    document:{ visibilityState:'visible', hasFocus:() => focused },
    activeWarArmoryTab:() => tab,
    refreshWarArmoryMembers:async () => [],
    renderWar:() => renders.push({ busy:state.armoryBusy, error:state.error, status:state.armoryStatus }),
    errorMessage:error => error.message,
    setTimeout:(callback, delay) => { delays.push(delay); if (loseFocus) focused = false; callback(); }
  });
  for (const name of ['warArmoryPageFocused', 'warArmorySetStatus', 'warArmoryBorrower', 'warArmoryEligible']) vm.runInContext(extract(name), context);
  for (const name of ['retrieveOneWarArmoryItem', 'retrieveWarArmoryItem']) vm.runInContext(extract(name, true), context);
  return { context, state, renders, delays, clicks, row, tab };
}
const success = fixture();
const first = success.context.retrieveWarArmoryItem();
await success.context.retrieveWarArmoryItem();
await first;
assert.deepEqual(success.clicks, ['open', 'confirm'], 'One retrieval per click with double-click protection');
assert.deepEqual(success.delays, [50], 'No delay except waiting for native confirmation');
assert.equal(success.renders[0].busy, true);
assert.equal(success.renders.at(-1).busy, false);
for (const options of [{ ranked:false }, { skipped:true }, { focused:false }, { confirmation:false }, { loseFocus:true }, { mode:'unknown' }, { mode:'ranked-no-prof', prof:true }, { mode:'proficience-15-plus', prof:true, level:14 }, { mode:'proficience-15-plus', prof:true, level:NaN }]) {
  const run = fixture(options);
  await run.context.retrieveWarArmoryItem();
  assert(!run.clicks.includes('confirm'), `Unexpected retrieval: ${JSON.stringify(options)}`);
  assert.equal(run.renders.at(-1).busy, false, 'Restore button immediately on all exits');
}
const prof = fixture({ mode:'proficience-15-plus', prof:true, level:15 });
await prof.context.retrieveWarArmoryItem();
assert(prof.clicks.includes('confirm'));
prof.context.dataState.caches.warArmoryMembers.members = [];
assert.equal(prof.context.warArmoryEligible(prof.row, prof.tab), null, 'Unknown member must not pass level filter');
assert.equal(prof.context.warArmoryEligible(prof.row, { id:'tab=armoury&sub=armour' }), null);

const next = { textContent:'Next', disabled:false, classList:{ contains:() => false }, matches:() => true, getAttribute:name => name === 'href' ? '#armoury-page-2' : '', click:() => success.clicks.push('next') };
const tab = { querySelector:() => null, querySelectorAll:() => [next] };
success.context.document.querySelector = () => null;
success.context.activeWarArmoryTab = () => tab;
success.context.global = { location:{ hash:'#page-1' } };
vm.runInContext(extract('findNextWarArmoryPageControl') + '\n' + extract('nextWarArmoryPage'), success.context);
success.context.nextWarArmoryPage();
assert(success.clicks.includes('next'), 'Text-based Next fallback missing');
assert.equal(success.context.global.location.hash, 'armoury-page-2', 'Exact hash fallback missing');
next.disabled = true;
assert.equal(success.context.findNextWarArmoryPageControl(tab), null, 'Disabled Next must be skipped');
console.log('PDA armory retrieval, whitelist, ranked/level filters, focus, double-click protection and pagination passed.');
