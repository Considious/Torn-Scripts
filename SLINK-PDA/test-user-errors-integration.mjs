import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const core=read('./src/00-runtime-core.part');
let transport='native',kind='api';
const payload=()=>kind==='api'?{status:200,responseText:JSON.stringify({error:{code:5,error:'Too many requests'}})}:kind==='html'?{status:200,responseText:'<html>not JSON</html>'}:{status:503,responseText:JSON.stringify({user_message:'SLINK Mugging is temporarily unavailable (HTTP 503). [SLINK_SERVICE_UNAVAILABLE]',error:'upstream'})};
const context=vm.createContext({URL,console,
 pdaHttpHandler:()=>transport==='native'?async()=>payload():null,
 GM_API:{},fetch:async()=>{const p=payload();return {ok:p.status===200,status:p.status,json:async()=>JSON.parse(p.responseText)}}
});context.global=context;
vm.runInContext(read('./src/00-errors.part'),context);
vm.runInContext(core.slice(core.indexOf('async function pdaHttpRequest('),core.indexOf('const ffScouterRetryAt')),context);
vm.runInContext(core.slice(core.indexOf('async function requestJsonRaw('),core.indexOf('function readApiLedger(')),context);
for(const t of ['native','gm','fetch']){
 transport=t;context.GM_API.request=t==='gm'?options=>queueMicrotask(()=>options.onload(payload())):null;
 kind='api';const body=await context.requestJsonRaw('https://api.torn.com/v2/user');assert.equal(body.error.code,5);assert.equal(body.error.error,'Too many requests');assert.match(body.error.message,/Torn request allowance/);
 kind='http';await assert.rejects(context.requestJsonRaw('https://api.torn.com/v2/user'),e=>{assert.equal(e.status,503);assert.match(context.SLINK_ERRORS.message(e),/HTTP 503/);return true;});
 kind='html';await assert.rejects(context.requestJsonRaw('https://api.torn.com/v2/user'),e=>context.SLINK_ERRORS.describe(e).id==='SLINK_INVALID_RESPONSE');
}
// Retain native-to-GM fallback despite changing the user-facing wording.
transport='native';context.pdaHttpHandler=()=>async()=>{throw Error('No HTTP origin is configured for muggingWorker.');};
context.GM_API.request=options=>queueMicrotask(()=>options.onload({status:200,responseText:'{"ok":true}'}));
assert.equal((await context.requestJsonRaw('https://api.torn.com/v2/user')).ok,true);
console.log('PDA native, GM and fetch transports: provider errors, readable HTTP failure, malformed JSON and native fallback passed.');

context.pdaHttpHandler=()=>async()=>({status:200,data:{terms:{version:'current',sha256:'fingerprint'}}});
assert.equal((await context.requestJsonRaw('https://slinkwarworker.richard-johnson554.workers.dev/api/terms')).terms.version,'current');
context.pdaHttpHandler=()=>async()=>({terms:{version:'direct'}});
assert.equal((await context.requestJsonRaw('https://slinkwarworker.richard-johnson554.workers.dev/api/terms')).terms.version,'direct');
context.pdaHttpHandler=()=>async()=>({status:200,responseText:''});
await assert.rejects(context.requestJsonRaw('https://slinkwarworker.richard-johnson554.workers.dev/api/terms'),/empty response/);
console.log('PDA decoded-native and direct JSON terms payloads accepted; empty payload rejected explicitly.');
