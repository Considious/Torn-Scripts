import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const pda=process.argv[2]||(import.meta.url.endsWith('/test-chat-shared-buttons.mjs')?fileURLToPath(new URL('./',import.meta.url)):null),source=fs.readFileSync(pda?pda+'/src/addons/chat.addon.js':new URL('../src/content/custom-chat-buttons.js',import.meta.url),'utf8');
function extract(name){const start=source.indexOf('  function '+name+'(');assert(start>=0);let code='';for(const line of source.slice(start).split('\n')){code+=line+'\n';try{new vm.Script(code);return code;}catch{}}throw Error(name);}
const definitions=source.slice(source.indexOf('  const SCOPE_CONTEXTS'),source.indexOf('  let macros'));
const ctx=vm.createContext({crypto:{randomUUID:()=> 'new'},macros:[],contextType:root=>root.type});
vm.runInContext(definitions+['newId','normalizedMacro','normalizeMacros','scopeIncludes','scopeFromContexts','eligibleMacros'].map(extract).join('\n'),ctx);
const original=[{id:'a',label:'Faction legacy',message:'A',scope:'faction'},{id:'b',label:'Private legacy',message:'B',scope:'private'},{id:'c',label:'Newsletter',message:'C',scope:'newsletter'},{id:'d',label:'Both destinations',message:'D',scope:'private_newsletter'},{id:'off',label:'Off',message:'Off',scope:'all',enabled:false}];
ctx.macros=ctx.normalizeMacros(original);
for(const type of ['faction','private','company','global','trade'])assert.deepEqual(Array.from(ctx.eligibleMacros({type}),row=>row.id),['a','b','d']);
assert.deepEqual(Array.from(ctx.eligibleMacros({type:'newsletter'}),row=>row.id),['c','d']);
assert.equal(ctx.scopeFromContexts(new Set(['both'])),'both');assert.equal(ctx.scopeFromContexts(new Set(['both','newsletter'])),'all');assert.equal(ctx.scopeFromContexts(new Set(['newsletter'])),'newsletter');assert.equal(original[0].scope,'faction','Normalizing must not mutate old saved records');
assert.match(source,/armed\?\.contextId === contextId\(menuChatRoot\)/,'Sharing buttons must not share an armed send across recipients');
assert.match(source,/\['both', 'All chats'\]/);assert.doesNotMatch(source,/\['private', 'Private chat'\]/);
console.log((pda?'PDA':'Extension')+' shared buttons: all native chat destinations, legacy scopes, newsletter isolation, disabled buttons, and recipient-specific send confirmation passed.');
