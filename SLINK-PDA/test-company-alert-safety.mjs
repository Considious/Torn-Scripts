import assert from 'node:assert/strict';
import vm from 'node:vm';
import { extractFunction } from './test-support/runtime.mjs';
const snapshot={self:null,director:false,userId:7,employees:[]};
const settings={enabled:true,addictionThreshold:2,directorThreshold:10};
const context=vm.createContext({Date,COMPANY_SCOPE:'slink.qol.company',hasScope:()=>true,
 dataState:{caches:{company:{snapshot}},settings:{alerts:{snoozedUntil:{}}}},companySettings:()=>settings});
vm.runInContext(extractFunction('companyAlertRows','src/00-runtime-core.part'),context);
assert.equal(context.companyAlertRows().length,0,'A missing self employee must not crash the combined alert list');
snapshot.director=true;snapshot.employees=[{id:8,name:'Employee',addictionPenalty:15}];
assert.equal(context.companyAlertRows()[0]?.id,'company:addiction:8','Directors still get eligible employee alerts without their own roster row');
snapshot.self={id:7,addictionPenalty:5};
assert.equal(context.companyAlertRows().length,2);
context.dataState.settings.alerts.snoozedUntil['company:addiction:self']=Date.now()+60000;
assert.equal(context.companyAlertRows().length,1,'Saved snoozes must still apply');
settings.enabled=false;
assert.equal(context.companyAlertRows().length,0);
console.log('PDA Company missing-self safety, director reminders, snoozes and disable checks passed.');
