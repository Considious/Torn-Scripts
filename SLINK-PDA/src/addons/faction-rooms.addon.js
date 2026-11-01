(function installFactionRooms(global){
  'use strict';
  const api=global.SLINK_PDA_PLUGIN_API,activity=global.SLINK_PDA_PAGE_ACTIVITY,ID='faction-rooms';
  let view=null,ticketLoading=null;
  const settings=()=>api.settings(ID,{enabled:false,soundEnabled:true});
  async function patch(patch){const current=settings(),previous={...current};Object.assign(current,patch);try{await api.save();sync();return settings();}catch(error){const restored=settings();for(const key of Object.keys(patch))if(Object.hasOwn(previous,key))restored[key]=previous[key];else delete restored[key];throw error;}}
  async function ticket(force){if(ticketLoading)return ticketLoading;ticketLoading=api.factionChat.central('token',force);try{return await ticketLoading;}finally{ticketLoading=null;}}
  function sync(){if(!settings().enabled){view?.dispose();view=null;return;}if(view){view.sync();return;}const client=global.SLINK_FACTION_NODE.create({watchRooms:true,ticket,members:()=>api.factionChat.central('members'),request:api.factionChat.request});view=global.SLINK_FACTION_NODE_UI.mount({client,activity,theme:api.factionChat.theme,preferences:{get:async()=>settings(),patch},view:api.factionChat.view});}
  api.register({id:ID,title:'Faction Rooms',shortTitle:'Faction Rooms',scopes:[],start:sync,
    render(){sync();if(api.shouldRender&&!api.shouldRender(ID))return;const root=api.root(ID);if(!root||root.dataset.factionNodeSettings==='true')return;root.dataset.factionNodeSettings='true';void global.SLINK_FACTION_NODE_SETTINGS(root,{get:async()=>settings(),patch});},
    alerts(){return [];}
  });
})(globalThis);
