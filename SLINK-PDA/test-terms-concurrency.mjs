import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const core=fs.readFileSync(new URL('./src/00-runtime-core.part',import.meta.url),'utf8');
const market=fs.readFileSync(new URL('./src/10-market-runtime.part',import.meta.url),'utf8');
const terms={version:'current',sha256:'fingerprint'};
const payload=url=>url.includes('permission')?{terms}:url.includes('leveling')?{version:terms.version,document_sha256:terms.sha256,disclosure_version:terms.version,disclosure_sha256:terms.sha256}:{terms};
const started=new Map();let sent=0,suppressed=0;
// Match Torn PDA's public native HTTP helper behavior: calls repeated inside
// two seconds return undefined instead of sharing the original promise.
const native=async url=>{
 const now=Date.now();if(started.has(url)&&now-started.get(url)<2000){suppressed++;return;}
 started.set(url,now);sent++;await new Promise(r=>setTimeout(r,10));
 return {status:200,responseText:JSON.stringify(payload(url))};
};
const ctx=vm.createContext({URL,Date,setTimeout,clearTimeout,dataState:{terms:null},URLS:{permission:'https://permission.test',leveling:'https://leveling.test',war:'https://war.test'},pdaHttpHandler:()=>native,writeDataState(){},errorMessage:error=>error.message});
ctx.global=ctx;
vm.runInContext(core.slice(core.indexOf('async function pdaHttpRequest('),core.indexOf('const ffScouterRetryAt')),ctx);
ctx.requestJson=url=>ctx.pdaHttpRequest('GET',url,{},undefined);
vm.runInContext(market.slice(market.indexOf('async function fetchAllTerms('),market.indexOf('function termsAccepted(')),ctx);
await Promise.all([ctx.fetchAllTerms(),ctx.fetchAllTerms(),ctx.fetchAllTerms()]);
assert.equal(sent,3,'Concurrent terms loads must send one request per service');
assert.equal(suppressed,0,'SLINK must not hit PDA’s no-result de-duplication path');
await ctx.fetchAllTerms(true);
assert.equal(suppressed,0,'An immediate forced refresh must reuse the confirmed native response in the two-second bridge window');
console.log('Concurrent and immediate-repeat native terms requests avoid PDA’s undefined duplicate response; all callers receive complete terms.');

let bridged=0;ctx.pdaHttpHandler=()=>async()=>undefined;
ctx.flutter_inappwebview={callHandler:async()=>{bridged++;return {status:200,responseText:JSON.stringify({terms})};}};
assert.equal((await ctx.pdaHttpRequest('GET','https://fallback.test/api/permissions/terms',{},undefined)).terms.version,'current');
assert.equal(bridged,1,'An empty convenience-helper result may use the documented native bridge once');
await assert.rejects(ctx.pdaHttpRequest('POST','https://fallback.test/api/faction/onboarding/42/verify',{},'{}'),error=>error.code==='SLINK_PDA_HTTP_BRIDGE');
assert.equal(bridged,1,'Never replay a product mutation after an empty helper result');
let authCalls=0;
const auth=async(_url,_headers,body)=>{authCalls++;await new Promise(r=>setTimeout(r,5));return {status:200,responseText:JSON.stringify({identity:JSON.parse(body).api_key})};};
ctx.pdaHttpHandler=()=>auth;
const login=(key)=>ctx.pdaHttpRequest('POST','https://access.test/api/permissions/auth',{},JSON.stringify({api_key:key}));
const [one,two,other]=await Promise.all([login('synthetic-A'),login('synthetic-A'),login('synthetic-B')]);
assert.equal(authCalls,2);assert.equal(one.identity,two.identity);assert.equal(other.identity,'synthetic-B');
console.log('Native bridge fallback is bounded to terms/sign-in; mutations are not replayed and different login identities never share responses.');
