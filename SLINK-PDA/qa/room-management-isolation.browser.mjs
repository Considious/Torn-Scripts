import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<main id="rooms"></main>');
 await page.evaluate(()=>{
  window.managementStarts=0;window.managementStops=0;window.saves=0;window.model={rooms:{enabled:true,noticeAccepted:'notice'},war:{minFF:1}};
  window.SLINK_PDA_PAGE_ACTIVITY={eligible:()=>true};
  window.SLINK_FACTION_NODE={ROOM_NOTICE:'notice',ROOM_NOTICE_TEXT:'Third-party rooms',create:()=>({}),createRoomActivity:()=>({}),patchRoomSettings:(a,b)=>({...a,...b})};
  window.SLINK_FACTION_NODE_UI={mount:()=>({sync(){},dispose(){}}),mountAdmin:({container})=>{managementStarts++;const field=document.createElement('input');field.dataset.roomName='';container.append(field);return {open:async()=>{},dispose(){managementStops++;}};}};
  window.SLINK_PDA_PLUGIN_API={settings:(id)=>id==='faction-rooms'?model.rooms:model.war,save:async()=>{saves++;},register:plugin=>{window.plugin=plugin;},shouldRender:()=>true,root:()=>document.getElementById('rooms'),factionChat:{central:async()=>({}),request(){},theme(){},view:{}},openFactionRooms(){}};
 });
 await page.addScriptTag({path:fileURLToPath(new URL('../src/addons/faction-node-settings.js',import.meta.url))});
 await page.addScriptTag({path:fileURLToPath(new URL('../src/addons/faction-rooms.addon.js',import.meta.url))});
 await page.evaluate(()=>{plugin.start();plugin.render();});await page.locator('[data-room-name]').fill('Unfinished room');
 await page.evaluate(()=>{window.retained=document.querySelector('[data-room-name]');for(let index=0;index<30;index++){model.war.minFF=index;plugin.render();}});
 assert.equal(await page.evaluate(()=>managementStarts),1);assert.equal(await page.evaluate(()=>managementStops),0);assert.equal(await page.evaluate(()=>saves),0);
 assert.equal(await page.evaluate(()=>retained===document.querySelector('[data-room-name]')),true);assert.equal(await page.locator('[data-room-name]').inputValue(),'Unfinished room');
 await page.evaluate(()=>{document.getElementById('rooms').replaceChildren();plugin.render();});await page.locator('[data-room-name]').waitFor();
 assert.equal(await page.evaluate(()=>managementStarts),2,'Only replacement of its own container may remount management');assert.equal(await page.evaluate(()=>managementStops),1);assert.deepEqual(errors,[]);
 console.log('Actual PDA addon + settings UI: repeated unrelated War updates retain the manager and draft, no saves occur, and replacing only its own container disposes/remounts once.');
}finally{await browser.close();}
