import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const loader=fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js',import.meta.url),'utf8');
assert.match(loader,/@grant\s+GM_addElement/);
assert.doesNotMatch(loader,/\(0,\s*eval\)|new Function\(/,'Browser startup must not rely on page string evaluation');
const source=loader.slice(loader.indexOf('async function executeBrowserSource('),loader.indexOf('async function executeBundle('));
const listeners=new Map(),replies=[];let calls=0;
class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail;}}
const document={addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);},getElementById(){return null;},dispatchEvent(event){if(event.type==='channel:browser:ack')replies.push(JSON.parse(event.detail));listeners.get(event.type)?.(event);}};
const ctx=vm.createContext({m:'channel',a:'host',document,CustomEvent,URL,setTimeout,clearTimeout,
 GM_addElement(_tag,attrs){assert.match(attrs.textContent,/SLINK_PDA_BROWSER_TRANSPORT/);queueMicrotask(()=>document.dispatchEvent(new CustomEvent('channel:executed',{detail:'{"ok":true}'})));return {remove(){}};},
 GM_xmlhttpRequest(options){calls++;options.onload({status:200,responseText:'{"ok":true}'});}
});
vm.runInContext(source,ctx);await ctx.executeBrowserSource('/* fixture */');
const send=job=>document.dispatchEvent(new CustomEvent('channel:browser',{detail:JSON.stringify(job)}));
send({id:1,action:'http',url:'https://example.com/collect',method:'GET'});assert.equal(calls,0);
send({id:2,action:'http',url:'https://api.torn.com/v2/user',method:'POST'});assert.equal(calls,0);
send({id:3,action:'http',url:'https://api.torn.com/v2/user',method:'GET'});assert.equal(calls,1);
send({id:4,action:'http',url:'https://slinkcontributionworker.richard-johnson554.workers.dev/api/permissions/auth',method:'POST',data:'{}'});assert.equal(calls,2);
assert.equal(replies.find(r=>r.id===3).response.status,200);
assert.match(replies.find(r=>r.id===1).error,/unsupported/);
const missing=vm.createContext({});vm.runInContext(source,missing);
await assert.rejects(missing.executeBrowserSource(''),/GM_addElement support/);
console.log('Browser startup uses supported manager insertion without eval; service transport is origin/method restricted; unsupported managers fail explicitly.');
