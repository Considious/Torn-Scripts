(function installFactionRooms(global){
  'use strict';
  const api=global.SLINK_PDA_PLUGIN_API,activity=global.SLINK_PDA_PAGE_ACTIVITY,ID='faction-rooms';
  let view=null,ticketLoading=null;
  const settings=()=>api.settings(ID,{enabled:false});
  async function ticket(force){if(ticketLoading)return ticketLoading;ticketLoading=api.factionChat.central('token',force);try{return await ticketLoading;}finally{ticketLoading=null;}}
  function sync(){if(!settings().enabled||!(api.hasScope('slink.chat')||api.hasScope('admin.*'))){view?.dispose();view=null;return;}if(view){view.sync();return;}const client=global.SLINK_FACTION_NODE.create({ticket,members:()=>api.factionChat.central('members'),request:api.factionChat.request});view=global.SLINK_FACTION_NODE_UI.mount({client,activity,theme:api.factionChat.theme,view:api.factionChat.view});}
  api.register({id:ID,title:'Faction Rooms',shortTitle:'Faction Rooms',scopes:['slink.chat','admin.*'],start:sync,
    render(){sync();const root=api.root(ID);if(!root||root.dataset.factionNodeSettings==='true')return;root.dataset.factionNodeSettings='true';void global.SLINK_FACTION_NODE_SETTINGS(root,{get:async()=>settings(),patch:async patch=>{const current=settings(),previous=current.enabled;current.enabled=patch.enabled;try{await api.save();sync();return settings();}catch(error){settings().enabled=previous;throw error;}}});},
    alerts(){return [];}
  });
})(globalThis);
