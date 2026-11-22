import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
let id=1,fail=false,host,plugin;const settings={},cache={};
const api={accountId:()=>id,hasScope:()=>true,settings:(key,defaults)=>settings[key]||=(structuredClone(defaults)),cache:(key,defaults)=>cache[key]||=(structuredClone(defaults)),save:async()=>{if(fail)throw Error('Simulated storage failure');},shouldRender:()=>false,register:value=>plugin=value};
const box={console,Date,Promise,SLINK_PDA_PLUGIN_API:api,SLINK_QOL_UI:{create:value=>{host=value;return {sync:async()=>{},refreshInfo:async()=>{},mount:()=>{}};}}};box.globalThis=box;
vm.runInNewContext(fs.readFileSync(new URL('src/addons/qol-core.js',import.meta.url),'utf8'),box);vm.runInNewContext(fs.readFileSync(new URL('src/addons/page-tools.addon.js',import.meta.url),'utf8'),box);
await host.save(box.SLINK_QOL.normalize({bloodType:'A+'}));assert.equal((await host.load()).settings.bloodType,'A+');id=2;assert.equal((await host.load()).settings.bloodType,null);id=1;fail=true;await assert.rejects(()=>host.save(box.SLINK_QOL.normalize({bloodType:'B+'})));assert.equal((await host.load()).settings.bloodType,'A+','Failed saves restore previous preferences');assert.equal(plugin.id,'pageTools');
console.log('PDA addon account separation, failed-save rollback and registration passed');
