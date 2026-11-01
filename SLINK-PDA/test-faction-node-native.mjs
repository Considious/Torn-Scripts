import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const shell=await readFile(new URL('./src/90-shell-bootstrap.part',import.meta.url),'utf8');
const factory=shell.slice(shell.indexOf('const factionNodeAccess='),shell.indexOf('global.SLINK_PDA_PLUGIN_API = Object.freeze({'));
function fixture(){const calls=[],auth=[],state={panels:{existing:true}};let stale=true;const context=vm.createContext({URL,state,writeState:async()=>{},URLS:{permission:'https://central.example.test'},host:{},ensurePermissionSession:async force=>{auth.push(force);return {token:'permission-token'};},requestJson:async(url,options)=>{calls.push({url,options});if(stale){stale=false;const error=Error('Refresh');error.status=428;throw error;}return url.includes('/api/chat/token')?{endpoint:'https://node.example.test',token:'chat-token'}:{members:[]};},global:{SLINK_FACTION_NODE:{origin:value=>new URL(value).origin},getComputedStyle:()=>({length:0,getPropertyValue:()=>''})}});vm.runInContext(factory+';globalThis.api=factionNodeAccess;',context);return {api:context.api,calls,auth,state};}
test('PDA reuses native JSON transport, refreshes stale identity and pins the discovered node origin',async()=>{
 const f=fixture();assert.throws(()=>f.api.request('https://node.example.test/api/rooms',{}),/verified node/);await f.api.central('token');assert.deepEqual(f.auth,[false,true]);
 await f.api.request('https://node.example.test/api/rooms',{headers:{Authorization:'Bearer chat-token'}});assert.equal(f.calls.at(-1).options.headers.Authorization,'Bearer chat-token');assert.throws(()=>f.api.request('https://other.example.test/api/rooms',{}),/verified node/);
});
test('testing installer follows the feature branch and isolates its runtime bundle cache',async()=>{
 const source=await readFile(new URL('./SLINK_PDA_Faction_Node_Test.user.js',import.meta.url),'utf8');assert.ok(source.includes('Torn-Scripts/feature/faction-node-v1/SLINK-PDA/'));assert.ok(source.includes('slink-pda-faction-node-test:runtime-cache:v1'));assert.ok(!source.includes('Torn-Scripts/main/SLINK-PDA/'));
 const manifest=JSON.parse(await readFile(new URL('./source-manifest.json',import.meta.url),'utf8')),addons=manifest.startupAddons.map(row=>row.source);assert.ok(addons.indexOf('src/addons/faction-node-client.js')<addons.indexOf('src/addons/faction-rooms.addon.js'));
});
test('failed PDA preference save restores the current settings object, without starting chat or clearing other values',async()=>{
 let settings={enabled:false,unrelated:'keep'},editor,started=0;
 const root={dataset:{}};
 const api={settings(){settings={...settings};return settings;},hasScope:()=>true,root:()=>root,save:async()=>{api.settings();throw Error('Native write not acknowledged');},register(plugin){plugin.start();plugin.render();}};
 const source=await readFile(new URL('./src/addons/faction-rooms.addon.js',import.meta.url),'utf8');
 vm.runInNewContext(source,{SLINK_PDA_PLUGIN_API:api,SLINK_PDA_PAGE_ACTIVITY:{},SLINK_FACTION_NODE_SETTINGS:async(_root,options)=>{editor=options;},SLINK_FACTION_NODE:{create(){started++;}},SLINK_FACTION_NODE_UI:{mount(){started++;}}});
 assert.equal(started,0);await assert.rejects(editor.patch({enabled:true}),/not acknowledged/);assert.equal(settings.enabled,false);assert.equal(settings.unrelated,'keep');assert.equal(started,0);
});
test('room view uses the small UI preference record and never persists draft text or overwrites detail-panel flags',async()=>{
 const f=fixture();await f.api.view.save({visible:true,view:'chat',roomId:'general',userId:1,factionId:10,draft:'do not upload'});const saved=await f.api.view.get();assert.equal(saved.roomId,'general');assert.equal('draft' in saved,false);assert.deepEqual(f.state.panels,{existing:true});assert.equal(f.calls.length,0);
});
