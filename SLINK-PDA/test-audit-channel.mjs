import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const loader=read('./SLINK_PDA_Dashboard.user.js');
const root='https://raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/';
assert.ok(loader.includes(root),'PDA source downloads must follow the installable testing branch rather than a pinned historical commit.');
assert.doesNotMatch(loader,/Torn-Scripts\/[a-f0-9]{40}\/SLINK-PDA\//,'Runtime loading must not remain pinned to a historical source commit.');
assert.ok(loader.includes('/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js'),'Userscript updates must stay on the tester branch.');
const cacheKey='slink-pda-dashboard:runtime-cache:audit-test:v1';
assert.equal(cacheKey,'slink-pda-dashboard:runtime-cache:audit-test:v1');
const requests=[],native=new Map(),local=new Map();
let host=null,injected='';
const sandbox={console,URL,TextEncoder,setTimeout,clearTimeout,crypto:{randomUUID:()=> 'test'},
 document:{getElementById:id=>id==='slink-pda-dashboard-host'?host:null,addEventListener(){}},
 localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)},
 sessionStorage:{getItem:()=>null,removeItem(){}},
 GM_getValue:async(key,fallback)=>native.get(key)||fallback,
 GM_setValue:async(key,value)=>native.set(key,value),
 PDA_httpGet:async url=>{
   requests.push(url);assert.ok(url.startsWith(root),'Runtime downloads must stay inside the selected tester branch.');
   const path=url.slice(root.length).split('?')[0];
   return {status:200,data:read('./'+path)};
 },
 PDA_evaluateJavascript:async source=>{injected=source;host={dataset:{slinkReady:'true',slinkAddonsReady:'true'}};}
};
sandbox.globalThis=sandbox;
await vm.runInNewContext(loader,sandbox);
const manifest=JSON.parse(read('./source-manifest.json'));
assert.equal(requests.length,1+manifest.fragments.length+manifest.startupAddons.length,'The manifest and every startup file must load from the current branch at startup.');
const authoredBuild=read('./src/00-runtime-core.part').match(/^const BUILD = (.+);/m)?.[1];
assert.ok(authoredBuild?.includes('sourceRevision'), 'Runtime build identity must be derived from the live source manifest.');
assert.ok(injected.includes(`const BUILD = ${authoredBuild};`));
assert.ok(injected.includes('SLINK_PDA_Direct_Addon_4.js'));
assert.ok(native.get(cacheKey)?.runtimeSource.includes("const CLIENT_VERSION = 'pda-' + String(global.__SLINK_PDA_BOOTSTRAP__?.sourceRevision"));
assert.equal(native.has('slink-pda-dashboard:runtime-cache:v1'),false,'The stable runtime cache must remain untouched.');
console.log('PDA tester loader follows the live branch, evaluates all startup files and isolates its runtime cache.');

