import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');

test('PDA modules keep independent five-minute activity clocks', () => {
  assert.match(source, /MODULE_INACTIVITY_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
  assert.match(source, /function touchModuleActivity\(module/);
  assert.match(source, /function moduleIsActive\(module/);
  for (const module of ['leveling', 'war', 'mugging', 'market']) {
    assert.match(source, new RegExp(`touchModuleActivity\\(['"]${module}['"]`));
  }
});

test('Market Watch idles independently and keeps its five-second active cadence', () => {
  assert.match(source, /moduleIsActive\(['"]market['"]\)/);
  assert.match(source, /scheduleMarketWake/);
  assert.match(source, /5_000|5000/);
  assert.doesNotMatch(source, /filler=1/);
});

test('shared contribution uses only spare capacity from the common ledger', () => {
  assert.match(source, /CONTRIBUTION_CEILING\s*=\s*40/);
  assert.match(source, /INTERACTIVE_RESERVE\s*=\s*10/);
  assert.match(source, /priority:\s*['"]contribution['"]/);
  assert.match(source, /contribution:\s*true/);
});

test('inactive War uses the lightweight alert path and Mugging contribution remains independent', () => {
  assert.match(source, /refreshWarAlerts/);
  assert.match(source, /moduleIsActive\(['"]war['"]\)/);
  assert.match(source, /runMuggingContribution/);
  assert.match(source, /moduleIsActive\(['"]mugging['"]\)/);
});
