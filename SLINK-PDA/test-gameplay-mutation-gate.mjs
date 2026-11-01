import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const shell=fs.readFileSync(new URL('./src/90-shell-bootstrap.part',import.meta.url),'utf8');
const begin=shell.indexOf('function pdaGameplayMutation('),end=shell.indexOf('marketObserver = new MutationObserver',begin);
const ctx=vm.createContext({HOST_ID:'slink-pda-dashboard-host'});vm.runInContext(shell.slice(begin,end),ctx);
const ignored={nodeType:1,closest:()=>true,matches:()=>true};
const gameplay={nodeType:1,closest:()=>false,matches:()=>false};
for(let i=0;i<10000;i++)assert.equal(ctx.pdaGameplayMutation({target:ignored,addedNodes:[gameplay]}),false);
assert.equal(ctx.pdaGameplayMutation({target:gameplay,addedNodes:[ignored]}),false);
assert.equal(ctx.pdaGameplayMutation({target:gameplay,removedNodes:[ignored]}),false);
assert.equal(ctx.pdaGameplayMutation({target:gameplay,addedNodes:[gameplay,ignored]}),true);
assert.equal(ctx.pdaGameplayMutation({target:gameplay,removedNodes:[gameplay]}),true);
assert.equal(ctx.pdaGameplayMutation({target:gameplay,addedNodes:[{nodeType:3}]}),true);
assert.match(shell,/!mutations\.some\(pdaGameplayMutation\)/);
console.log('10,000 chat/UI mutations cannot trigger gameplay scraping; real additions/removals/text still pass.');

