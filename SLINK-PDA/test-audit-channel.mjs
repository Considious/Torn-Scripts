import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const loader=read('./SLINK_PDA_Dashboard.user.js');
const root=loader.match(/const SOURCE_ROOT = '([^']+)';/)?.[1];
assert.match(root,/^https:\/\/raw\.githubusercontent\.com\/Considious\/Torn-Scripts\/[a-f0-9]{40}\/SLINK-PDA\/$/,'The tester runtime must be pinned to one immutable source commit.');
assert.ok(loader.includes('/audit/test-foundation/SLINK-PDA/SLINK_PDA_Dashboard.user.js'),'Userscript updates must stay on the tester branch.');
const cacheKey=loader.match(/const RUNTIME_CACHE_KEY = '([^']+)';/)?.[1];
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
   requests.push(url);assert.ok(url.startsWith(root),'No runtime download may escape the pinned test source set.');
   const path=url.slice(root.length).split('?')[0];
   return {status:200,data:read('./'+path)};
 },
 PDA_evaluateJavascript:async source=>{injected=source;host={dataset:{slinkReady:'true',slinkAddonsReady:'true'}};}
};
sandbox.globalThis=sandbox;
await vm.runInNewContext(loader,sandbox);
const manifest=JSON.parse(read('./source-manifest.json'));
assert.equal(requests.length,1+manifest.fragments.length+manifest.startupAddons.length,'The manifest and all startup files must come from the same commit.');
assert.ok(injected.includes('0.4.105-audit-test4'));
assert.ok(injected.includes('SLINK_PDA_Direct_Addon_4.js'));
assert.ok(native.get(cacheKey)?.runtimeSource.includes('0.4.105-audit-test4'));
assert.equal(native.has('slink-pda-dashboard:runtime-cache:v1'),false,'The stable runtime cache must remain untouched.');
console.log('PDA tester loader requests one pinned source set, evaluates all startup files and isolates its runtime cache.');
