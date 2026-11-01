(function installFactionNodeSettings(global){
  'use strict';
  global.SLINK_FACTION_NODE_SETTINGS=async function(root,{get,patch}){
    root.innerHTML='<h3>Faction rooms</h3><p>Use your faction’s own chat rooms alongside Torn chat. Your faction needs a separate Chat license and a connected Faction Node.</p><p>Test build: enabling this uses your saved Torn key to sign in to SLINK’s separate test service. Your normal SLINK login is unchanged.</p><label><input type="checkbox" data-node-enabled disabled> Show faction rooms in Torn chat</label><p data-node-save role="status"></p><button type="button" data-node-retry hidden>Retry</button>';
    const control=root.querySelector('[data-node-enabled]'),status=root.querySelector('[data-node-save]'),retry=root.querySelector('[data-node-retry]');let stopped=false,busy=false,desired;
    async function save(){if(busy||stopped)return;busy=true;control.disabled=true;retry.hidden=true;status.textContent='Saving…';try{const saved=await patch({enabled:desired});if(stopped)return;control.checked=saved.enabled===true;status.textContent='Saved.';}catch(error){if(!stopped){status.textContent='Not saved: '+error.message;retry.hidden=false;}}finally{busy=false;if(!stopped)control.disabled=false;}}
    control.onchange=()=>{desired=control.checked;void save();};retry.onclick=()=>void save();
    try{const saved=await get();if(!stopped){control.checked=saved.enabled===true;control.disabled=false;}}catch(error){if(!stopped)status.textContent='Cannot load settings: '+error.message;}
    return {stop(){stopped=true;}};
  };
})(globalThis);
