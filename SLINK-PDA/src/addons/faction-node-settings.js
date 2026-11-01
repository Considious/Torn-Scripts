(function installFactionNodeSettings(global){
  'use strict';
  global.SLINK_FACTION_NODE_SETTINGS=async function(root,{get,patch}){
    root.innerHTML='<h3>Faction rooms</h3><p>Use your faction’s own chat rooms alongside Torn chat. Your faction needs a separate Chat license and a connected Faction Node.</p><p>Uses your saved Torn key to verify faction chat access. Your normal SLINK login is unchanged.</p><label><input type="checkbox" data-node-enabled disabled> Show faction rooms in Torn chat</label><label><input type="checkbox" data-node-sound disabled> Play a short sound for new messages</label><p data-node-save role="status"></p><button type="button" data-node-retry hidden>Retry</button>';
    const control=root.querySelector('[data-node-enabled]'),sound=root.querySelector('[data-node-sound]'),status=root.querySelector('[data-node-save]'),retry=root.querySelector('[data-node-retry]');let stopped=false,busy=false,desired;
    async function save(){if(busy||stopped)return;busy=true;control.disabled=sound.disabled=true;retry.hidden=true;status.textContent='Saving…';try{const saved=await patch(desired);if(stopped)return;control.checked=saved.enabled===true;sound.checked=saved.soundEnabled!==false;status.textContent='Saved.';}catch(error){if(!stopped){status.textContent='Not saved: '+error.message;retry.hidden=false;}}finally{busy=false;if(!stopped)control.disabled=sound.disabled=false;}}
    control.onchange=()=>{desired={enabled:control.checked};void save();};sound.onchange=()=>{desired={soundEnabled:sound.checked};void save();};retry.onclick=()=>void save();
    try{const saved=await get();if(!stopped){control.checked=saved.enabled===true;control.disabled=false;}}catch(error){if(!stopped)status.textContent='Cannot load settings: '+error.message;}
    return {stop(){stopped=true;}};
  };
})(globalThis);
