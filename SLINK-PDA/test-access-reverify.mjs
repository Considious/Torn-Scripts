import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./src/30-dashboard-combat.part',import.meta.url),'utf8');
const fragment=source.slice(source.indexOf('async function saveAccess()'),source.indexOf('const MODULE_SCOPES'));
async function run({changeKey=false,rejected=false,newTerms=false,blocked=false}={}){
 const session={token:'existing-session',expiresAt:Date.now()+3600000,scopes:['slink.level']};
 const dataState={apiKey:'old-key',ffKey:'',sessions:{permission:session},usePdaApiKey:false};
 const inputs={'api-key':{value:changeKey?'changed-key':'old-key'},'ff-key':{value:''},'use-pda-api-key':{checked:false},'use-pda-ff-key':{checked:false},'accept-terms':{checked:true}};
 let clears=0;
 const ctx=vm.createContext({
  dataState,moduleState:{access:{}},editableState:{begin:()=>1,commit(){}},
  moduleRoot:()=>({querySelector:selector=>inputs[selector.match(/"([^"]+)"/)[1]]}),
  currentApiKey:()=>dataState.apiKey,clearSessions(){clears++;dataState.sessions={};},
  fetchAllTerms:async()=>{},termsAccepted:()=>!newTerms,acceptCurrentTerms(){},
  ensurePermissionSession:async()=>{throw Object.assign(Error('Unreadable response'),blocked?{status:403,code:'SLINK_CONNECTION_CHALLENGE'}:rejected?{status:403}:{});},
  hasScope:()=>false,ensureLevelingSession:async()=>{},ensureWarSession:async()=>{},
  errorMessage:e=>e.message,writeDataState:async()=>{},flushPdaStorage:async()=>{},renderAllModules(){}
 });
 vm.runInContext(fragment,ctx);await ctx.saveAccess();
 assert.equal(ctx.moduleState.access.saving,false);
 return {clears,dataState,session};
}
const retry=await run();assert.equal(retry.clears,0);assert.equal(retry.dataState.sessions.permission,retry.session);
assert.equal((await run({changeKey:true})).dataState.sessions.permission,undefined);
assert.equal((await run({rejected:true})).dataState.sessions.permission,undefined);
assert.equal((await run({newTerms:true})).dataState.sessions.permission,undefined);
assert.equal((await run({blocked:true})).clears,0,'A non-JSON connection challenge is not an authenticated permission revocation');
console.log('Same-key verification failure retains acknowledged access; changed key, changed terms and explicit rejection invalidate it.');
