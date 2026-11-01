(function installFactionNodeSettings(global){
  'use strict';
  global.SLINK_FACTION_NODE_SETTINGS=async function(root,{get,patch,createManager}){
    root.innerHTML='<h3>Faction Rooms</h3><p>Chat with your faction or linked factions. Your faction needs a separate Chat license and a connected Faction Node.</p><label><input type="checkbox" data-node-enabled disabled> Show faction rooms in Torn chat</label><label><input type="checkbox" data-node-sound disabled> Play message sounds (individual rooms can be muted below)</label><p data-node-save role="status"></p><button type="button" data-node-retry hidden>Retry</button><p data-node-disclosure></p><div><button type="button" data-node-open>Rooms &amp; sound preferences</button> <button type="button" data-node-manage>Manage rooms</button></div><div data-node-manager></div>';
    const find=s=>root.querySelector(s),control=find('[data-node-enabled]'),sound=find('[data-node-sound]'),status=find('[data-node-save]'),retry=find('[data-node-retry]');let stopped=false,busy=false,desired,manager;
    find('[data-node-disclosure]').textContent=global.SLINK_FACTION_NODE.ROOM_NOTICE_TEXT;
    async function save(){if(busy||stopped)return;busy=true;control.disabled=sound.disabled=true;retry.hidden=true;status.textContent='Saving…';try{const saved=await patch(desired);if(stopped)return;control.checked=saved.enabled!==false;sound.checked=saved.soundEnabled!==false;manager?.sync();status.textContent='Saved.';}catch(error){if(!stopped){status.textContent='Not saved: '+error.message;retry.hidden=false;}}finally{busy=false;if(!stopped)control.disabled=sound.disabled=false;}}
    control.onchange=()=>{desired={enabled:control.checked};void save();};sound.onchange=()=>{desired={soundEnabled:sound.checked};void save();};retry.onclick=()=>void save();
    async function open(manage){try{manager||=createManager?.(find('[data-node-manager]'));if(!manager)throw Error('Room controls are not available.');await manager.open(manage);status.textContent='';}catch(error){if(!stopped)status.textContent=error.message;}}
    find('[data-node-open]').onclick=()=>void open(false);find('[data-node-manage]').onclick=()=>void open(true);
    try{const saved=await get();if(!stopped){control.checked=saved.enabled!==false;sound.checked=saved.soundEnabled!==false;control.disabled=sound.disabled=false;}}catch(error){if(!stopped)status.textContent='Cannot load settings: '+error.message;}
    return {stop(){stopped=true;manager?.dispose();}};
  };
})(globalThis);
