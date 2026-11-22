import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(process.env.SLINK_PDA_SHELL||new URL('../src/90-shell-bootstrap.part',import.meta.url),'utf8');
const start=source.indexOf('kal:Object.freeze({',source.indexOf('global.SLINK_PDA_PLUGIN_API'));
const end=source.indexOf('armoryFilter:Object.freeze({',start);assert(start>0&&end>start);
const records=new Map(),dataState={settings:{monitoring:{kal:false}}};let calls=0,failSave=false;
const api=new Function('dataState','storageRead','storageWrite','moduleMonitoringEnabled','requestJsonRaw','savePdaChanges','return ({'+source.slice(start,end)+'}).kal;')(
 dataState,(key,fallback)=>records.get(key)??fallback,async(key,value)=>records.set(key,value),()=>dataState.settings.monitoring.kal===true,
 async()=>{calls++;throw Object.assign(Error('Provider error'),{status:403,body:{code:13,error:'No visible loadout'}});},async()=>{if(failSave)throw Error('Storage unavailable');}
);
assert.equal(api.enabled(),false);await assert.rejects(api.request('https://api.kalends.dev/user/42/loadout',{method:'GET'}),/disabled/);assert.equal(calls,0);
await assert.rejects(api.request('https://example.com/user/42/loadout',{method:'GET'}),/read requests/);await assert.rejects(api.request('https://api.kalends.dev/check-key',{method:'POST'}),/read requests/);
const reply=await api.request('https://api.kalends.dev/check-key',{method:'GET'});assert.equal(reply.status,403);assert.equal(JSON.parse(reply.text).code,13);
await api.monitor(true);assert.equal(api.enabled(),true);failSave=true;await assert.rejects(api.monitor(false),/Storage unavailable/);assert.equal(api.enabled(),true,'Failed saves must restore the previous preference');failSave=false;await api.monitor(false);
await api.storage.set('credentials',{schema:1,key:'fixture-key',scope:'fixture'});assert.equal((await api.storage.get('credentials')).key,'fixture-key');assert([...records.keys()].every(k=>k.startsWith('slink.kal.')));assert.equal(JSON.stringify(dataState).includes('fixture-key'),false,'KAL credentials must stay outside the settings/cloud-backup graph');await api.storage.remove('credentials');assert.equal(await api.storage.get('credentials'),null);
console.log('PDA KAL adapter: read-only host guard, off-state gate, HTTP error preservation, persistent-state rollback and separate credential storage passed.');
