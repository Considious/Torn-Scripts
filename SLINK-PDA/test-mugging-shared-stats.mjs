import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const core = fs.readFileSync(new URL('./src/00-runtime-core.part', import.meta.url), 'utf8');
const combat = fs.readFileSync(new URL('./src/30-dashboard-combat.part', import.meta.url), 'utf8');

assert.match(core, /const MUGGING_OWN_STATS_TTL_MS = 15 \* 60_000/);
assert.match(core, /OWN_BATTLE_STATS_STORAGE_KEY = 'slink-pda-dashboard:own-battle-stats:v1'/);
assert.match(combat, /function pdaStoredOwnBattleStats/);
assert.match(combat, /dataState\.caches\.ownBattleStats/);
assert.match(combat, /source:'torn-v2-battlestats'/);
assert.match(combat, /storageWrite\(OWN_BATTLE_STATS_STORAGE_KEY, dataState\.caches\.ownBattleStats\)/);
assert.match(combat, /delete dataState\.caches\.muggingOwnBattleStats/);
assert.doesNotMatch(combat, /Number\(shared\.checkedAt\)>=Number\(legacy\.checkedAt\)/);
assert.match(combat, /pdaOwnBattleStats\(force === true && options\.background !== true\)/);
assert.match(combat, /userBattleStats:Math\.max\(0, Number\(ownStats\?\.total/);
assert.match(combat, /userBattleStats,/);

// Reproduce the recording: fresh Torn stats survive an obsolete GM copy,
// a different page writing its old cache, and a new page/runtime context.
const disk = new Map();
const gmDisk = new Map();
const fresh = {total:603502,level:25,checkedAt:2000,source:'torn-v2-battlestats'};
const stale = {total:571764,level:25,checkedAt:1000};
const key = 'slink-pda-dashboard:own-battle-stats:v1';
disk.set(key, JSON.stringify(fresh));
gmDisk.set(key, stale);
function contextFor(cached) {
  const ctx = {
    OWN_BATTLE_STATS_STORAGE_KEY:key, DATA_STORAGE_KEY:'data',
    PDA_BOOTSTRAP:{[key]:stale}, GM_API:{get:k=>gmDisk.get(k)},
    global:{localStorage:{getItem:k=>disk.get(k)||null}},
    dataState:{caches:{ownBattleStats:cached}},
    readDataMirror:()=>null, DATA_MIRROR_KEY:'mirror',
    storageWrite(k,value){disk.set(k,JSON.stringify(value));}
  };
  vm.createContext(ctx);
  vm.runInContext(core.slice(core.indexOf('function storedRecord(value)'), core.indexOf('function writeDataMirror(value)'))+
    core.slice(core.indexOf('function storageRead(key, fallback)'), core.indexOf('function storageWrite(key, value)'))+
    combat.slice(combat.indexOf('function pdaStoredOwnBattleStats()'), combat.indexOf('async function pdaOwnBattleStats')), ctx);
  return ctx;
}
const oldPage = contextFor(stale);
assert.equal(oldPage.pdaStoredOwnBattleStats().total,603502,'Old page must adopt the newer independent stats before a background cache write.');
assert.equal(contextFor(oldPage.dataState.caches.ownBattleStats).pdaStoredOwnBattleStats().total,603502,'Reload must not restore 571K from stale native storage.');
const loader = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
const bootstrapContext = { DATA_STORAGE_KEY:'data', OWN_BATTLE_STATS_STORAGE_KEY:key, STORAGE_WRITE_EVENT:'bridge',
  readPersistedData:async()=>({caches:{ownBattleStats:stale}}), gmRead:async()=>fresh,
  globalThis:{localStorage:{getItem:()=>null}}, isRecord:value=>value&&typeof value==='object' };
vm.createContext(bootstrapContext);
vm.runInContext(loader.slice(loader.indexOf('  async function collectBootstrap()'),loader.indexOf('  function installStorageBridge()')),bootstrapContext);
assert.equal((await bootstrapContext.collectBootstrap())[key].total,603502,'Asynchronous native storage must be awaited before injecting startup data.');

console.log('PDA shared battle-stat freshness checks passed.');
