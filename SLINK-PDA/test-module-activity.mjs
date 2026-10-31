import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { runtime as source, extractFunction } from './test-support/runtime.mjs';

test('PDA modules keep independent five-minute activity clocks', () => {
  assert.match(source, /MODULE_INACTIVE_AFTER_MS\s*=\s*5\s*\*\s*60_000/);
  const context=vm.createContext({dataState:{caches:{}},MODULE_INACTIVE_AFTER_MS:300000,writeDataState(){}});
  for(const name of ['moduleActivityMap','moduleLastActiveAt','moduleIsActive','touchModuleActivity'])
    vm.runInContext(extractFunction(name,'src/00-runtime-core.part'),context);
  const now=1800000000000;
  for(const name of ['leveling','war','mugging','market'])assert.equal(context.moduleIsActive(name,now),false);
  context.touchModuleActivity('war',now);
  assert.equal(context.moduleIsActive('war',now+300000),true);
  assert.equal(context.moduleIsActive('war',now+300001),false);
  assert.equal(context.moduleIsActive('market',now),false,'War activity must not reactivate Market');
  context.touchModuleActivity('market',now+100000);
  assert.equal(context.moduleIsActive('market',now+400000),true);
  assert.equal(context.moduleIsActive('war',now+400000),false);
  assert.equal(context.touchModuleActivity('unknown',now),0);
});

test('Market Watch idles independently and keeps its five-second active cadence', () => {
  assert.match(source, /moduleIsActive\(['"]market['"]\)/);
  assert.match(source, /scheduleMarketWake/);
  assert.match(source, /5_000|5000/);
  assert.doesNotMatch(source, /filler=1/);
});

test('shared contribution uses only spare capacity from the common ledger', () => {
  assert.match(source, /CONTRIBUTION_CEILING\s*=\s*40/);
  assert.match(source, /CONTRIBUTION_INTERACTIVE_RESERVE\s*=\s*10/);
  assert.match(source, /priority:\s*['"]contribution['"]/);
  assert.match(source, /contribution:\s*true/);
  const context=vm.createContext({API_LIMIT:60,CONTRIBUTION_CEILING:40,CONTRIBUTION_INTERACTIVE_RESERVE:10});
  vm.runInContext(extractFunction('contributionCapacity','src/00-runtime-core.part'),context);
  const ledger=(total,contribution)=>({events:Array.from({length:total},(_,i)=>({priority:i<contribution?'contribution':'normal'}))});
  assert.equal(context.contributionCapacity(ledger(0,0)).available,40);
  assert.equal(context.contributionCapacity(ledger(49,0)).available,1);
  assert.equal(context.contributionCapacity(ledger(50,0)).available,0);
  assert.equal(context.contributionCapacity(ledger(40,40)).available,0);
  assert.equal(context.contributionCapacity(ledger(60,0)).available,0);
});

test('inactive War uses the lightweight alert path and Mugging contribution remains independent', () => {
  assert.match(source, /refreshWarAlerts/);
  assert.match(source, /moduleIsActive\(['"]war['"]\)/);
  assert.match(source, /runMuggingContribution/);
  assert.match(source, /moduleIsActive\(['"]mugging['"],\s*now\)/);
});
