(function installFactionNodeSettings(global){
  'use strict';
  global.SLINK_FACTION_NODE_SETTINGS=async function(root,{get,patch,createManager}){
    root.style.display='block';root.style.alignContent='start';
    root.innerHTML='<div style="display:grid;gap:10px;align-content:start"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-node-enabled disabled> Show faction rooms in Torn chat</label><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-node-media disabled> Show GIFs and stickers automatically</label><p data-node-save role="status" hidden style="margin:0"></p><button type="button" data-node-retry hidden>Retry</button><details style="margin:0"><summary>About third-party Rooms</summary><p data-node-disclosure style="margin:6px 0"></p></details><section style="margin:0;padding:0;min-width:0"><h3 style="margin:0 0 8px">Room management</h3><div data-node-manager></div></section></div>';
    const find=s=>root.querySelector(s),control=find('[data-node-enabled]'),mediaControl=find('[data-node-media]'),status=find('[data-node-save]'),retry=find('[data-node-retry]');let stopped=false,busy=false,desired,manager;
    find('[data-node-disclosure]').textContent=global.SLINK_FACTION_NODE.ROOM_NOTICE_TEXT;
    const report=text=>{if(!stopped){status.textContent=text;status.hidden=!text;}};
    async function save(){if(busy||stopped)return;busy=true;control.disabled=true;mediaControl.disabled=true;retry.hidden=true;report('Saving…');try{const saved=await patch(desired);if(stopped)return;control.checked=saved.enabled!==false;mediaControl.checked=saved.autoMedia!==false;report('Saved.');}catch(error){report('Not saved: '+error.message);retry.hidden=false;}finally{busy=false;if(!stopped){control.disabled=false;mediaControl.disabled=false;}}}
    control.onchange=()=>{desired={enabled:control.checked};void save();};mediaControl.onchange=()=>{desired={autoMedia:mediaControl.checked};void save();};retry.onclick=()=>void save();
    try{const saved=await get();if(!stopped){control.checked=saved.enabled!==false;mediaControl.checked=saved.autoMedia!==false;control.disabled=false;mediaControl.disabled=false;manager=createManager?.(find('[data-node-manager]'));if(manager)void manager.open().catch(error=>report(error.message));else report('Room management is not available.');}}catch(error){report(error.message||'Cannot load room management.');}
    return {suspend(){manager?.suspend?.();},resume(){manager?.resume?.();},stop(){stopped=true;manager?.dispose();}};
  };
})(globalThis);
