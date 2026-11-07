(function(global){
  'use strict';const api=global.SLINK_PDA_PLUGIN_API,Q=global.SLINK_QOL,ID='pageTools';
  let queue=Promise.resolve(),infoTask=null,profileTask=null;
  function account(){const id=String(api.accountId?.()||'');if(!/^[1-9]\d*$/.test(id))throw Error('Verify SLINK access before using page tools.');return id;}
  function settings(){const record=api.settings(ID,{accounts:{}}),id=account();record.accounts ||= {};return record.accounts[id] ||= Q.normalize();}
  function cache(){const record=api.cache(ID,{}),id=account();if(record.owner!==id){for(const key of Object.keys(record))delete record[key];record.owner=id;}return record;}
  async function profile(force=false){const c=cache();if(!force&&c.context&&Date.now()-c.profileAt<30000)return c.context;if(profileTask)return profileTask;
    profileTask=(async()=>{const body=await api.tornJson('/v2/user?selections=bars,cooldowns,profile','SLINK page tools');const context={life:body.bars?.life||body.life,status:body.profile?.status||body.status,cooldowns:body.cooldowns};Object.assign(cache(),{context,profileAt:Date.now()});return context;})().finally(()=>profileTask=null);return profileTask;}
  const controller=global.SLINK_QOL_UI.create({
    allowed:()=>api.hasScope('slink.adhd.alerts'),load:async()=>({allowed:api.hasScope('slink.adhd.alerts'),settings:settings()}),
    save:value=>{const task=queue.then(async()=>{const old={...settings()};Object.assign(settings(),value);try{await api.save();}catch(error){Object.assign(settings(),old);throw error;}});queue=task.catch(()=>{});return task;},
    profile,cached:async()=>cache(),
    info:async force=>{if(!api.hasScope('slink.adhd.alerts'))throw Error('Your Efficiency permission is required.');const c=cache();if(!force&&c.catalog&&c.perks&&Date.now()-c.catalogAt<86400000&&Date.now()-c.perksAt<15*60000)return c;if(infoTask)return infoTask;
      infoTask=(async()=>{const catalog=!force&&c.catalog&&Date.now()-c.catalogAt<86400000?c.catalog:{items:Q.catalog(await api.tornJson('/v2/torn/items?cat=All&sort=ASC','SLINK page tools')).map(x=>({...x,effect:/medical|alcohol|candy|drug|energy|booster|supply/i.test(x.type)?x.effect:''}))};const perks=await api.tornJson('/v2/user/perks','SLINK page tools');const context=await profile(false);Object.assign(cache(),{catalog,perks,context,catalogAt:catalog===c.catalog?c.catalogAt:Date.now(),perksAt:Date.now(),profileAt:Date.now()});await api.save();return cache();})().finally(()=>infoTask=null);return infoTask;},
    updates:async()=>api.releaseInfo(),product:'pda',version:api.clientVersion||''
  });
  function render(){if(api.shouldRender(ID)){controller.mount(api.root(ID));void controller.sync();}}
  api.register({id:ID,title:'Page tools',shortTitle:'Page tools',scope:'slink.adhd.alerts',render,start(){void controller.sync();},refresh:()=>controller.refreshInfo(true),alerts:()=>[]});
})(globalThis);
