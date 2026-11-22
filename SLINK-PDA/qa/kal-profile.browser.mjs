import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const local=fs.existsSync(new URL('./kal-ui.js',import.meta.url));
const read=file=>{let target=local?'./'+file:'../src/core/'+file;if(!fs.existsSync(new URL(target,import.meta.url)))target='../src/addons/'+(file==='kal.js'?'kal-model.js':file);return fs.readFileSync(new URL(target,import.meta.url),'utf8');};
const ui=read('kal-ui.js'),model=read('kal.js');
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 for(const width of [360,390,960]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.torn.com/**',r=>r.fulfill({contentType:'text/html',body:'<div class="user-profile"><div class="profile-wrapper"><div>User information and actions</div></div><div class="profile-wrapper medals-wrapper">Medals</div></div>'}));await page.goto('https://www.torn.com/profiles.php?XID=42');
  await page.addScriptTag({content:model});await page.addScriptTag({content:ui});
  await page.evaluate(()=>{
   window.calls=[];window.access=0;window.copied='';window.state={connected:true,enabled:true,display:'manual'};window.behavior='success';
   window.record=(older=false)=>({user_id:42,name:'Fixture',observed_at:older?1786331600:1786331700,equipment:[{id:226,name:'Pepper Spray',slot_name:'temporary',stats:{armor:0}},{id:8,name:'Claymore Sword',slot_name:'melee',rarity:'yellow'},{id:9,name:'Flamethrower',slot_name:'secondary',rarity:'red'},{id:25,name:older?'Old P90':'P90',slot_name:'primary',rarity:'orange',stats:{damage:59.23,accuracy:56.25},bonuses:[{title:'Warlord',value:23,description:'23% respect'}],mods:[{description:'+1.75 Acc'}]},{id:32,name:'Combat Helmet',slot_name:'helmet',stats:{armor:38.54}}],pagination:{next_cursor:older?null:'older'}});
   const client={status:async()=>state,load:async(id,cursor)=>{calls.push({id,cursor});if(behavior==='network')throw Object.assign(Error('KAL could not be reached. Try again later.'),{code:'KAL_NETWORK'});if(behavior==='empty')throw Object.assign(Error('No visible loadout is available.'),{code:'KAL_HTTP_13'});if(behavior==='pending')return new Promise(resolve=>window.release=resolve);return record(!!cursor);}};
   window.panel=SLINK_KAL_UI.mountPage({client,openAccess:()=>{access++;},clipboard:async value=>{copied=value;}});
  });
  await page.getByRole('button',{name:'Load equipment',exact:true}).waitFor();assert.equal(await page.evaluate(()=>calls.length),0,'Manual mode must not load invisibly');
  assert.equal(await page.locator('.user-profile > .profile-wrapper').first().evaluate(e=>e.nextElementSibling.id),'slink-kal-panel');assert.equal(await page.locator('#slink-kal-panel').evaluate(e=>getComputedStyle(e).position),'static');
  await page.getByRole('button',{name:'Load equipment',exact:true}).click();await page.getByText('P90',{exact:true}).waitFor();assert.equal(await page.locator('.slink-kal-item-plate img').count(),5);assert.match(await page.locator('.slink-kal-item-plate img').first().getAttribute('src'),/\/images\/items\/25\/medium.png$/);
  assert.deepEqual(await page.locator('.slink-kal-groups > div').first().locator('strong').allTextContents(),['P90','Flamethrower','Claymore Sword','Pepper Spray']);assert.equal(await page.locator('.slink-kal-item-plate[data-rarity]').count(),3);const rarityColors=await page.locator('.slink-kal-item-plate[data-rarity]').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).borderColor));assert.equal(new Set(rarityColors).size,3);
  await page.getByRole('button',{name:'Older loadout',exact:true}).click();await page.getByText('Old P90',{exact:true}).waitFor();await page.getByRole('button',{name:'Copy selected loadout',exact:true}).click();assert.match(await page.evaluate(()=>copied),/Old P90/);
  await page.getByRole('button',{name:'Newer loadout',exact:true}).click();await page.getByText('P90',{exact:true}).waitFor();await page.getByRole('button',{name:'Older loadout',exact:true}).click();await page.getByRole('button',{name:'Latest',exact:true}).click();await page.getByText('P90',{exact:true}).waitFor();
  for(const [bg,fg,accent]of [['#211125','#fff5df','#9438df'],['#faf5ed','#241d17','#6e287a']]){
   await page.locator('#slink-kal-panel').evaluate((root,{bg,fg,accent})=>{root.style.setProperty('--slink-panel-bg',bg);root.style.setProperty('--slink-surface',bg);root.style.setProperty('--slink-bg-control',bg);root.style.setProperty('--slink-text',fg);root.style.setProperty('--slink-accent',accent);},{bg,fg,accent});assert.deepEqual(await page.locator('.slink-kal-item-plate[data-rarity]').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).borderColor)),rarityColors);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert((await page.getByRole('button',{name:'Older loadout',exact:true}).boundingBox()).height>=32);
  }
  await page.evaluate(()=>{state={connected:false,enabled:false,display:'manual'};return panel.refresh();});await page.getByText(/No KAL API key is connected/).waitFor();await page.getByRole('button',{name:'Open SLINK Access',exact:true}).click();assert.equal(await page.evaluate(()=>access),1);
  await page.evaluate(()=>{state={connected:true,enabled:true,display:'slink'};behavior='pending';return panel.refresh();});await page.getByText('Loading KAL equipment…',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Copy selected loadout',exact:true}).isDisabled(),true);
  await page.evaluate(()=>release({...record(),equipment:[]}));await page.getByText(/KAL has no equipment records/).waitFor();
  await page.evaluate(()=>{behavior='network';return panel.refresh(true);});await page.getByText(/KAL could not be reached/).waitFor();const count=await page.evaluate(()=>calls.length);await page.evaluate(()=>{for(let i=0;i<10;i++)document.body.append(document.createElement('span'));});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>calls.length),count,'DOM updates must not loop failed requests');
  await page.evaluate(()=>{behavior='empty';return panel.refresh(true);});await page.getByText(/KAL has no visible equipment history/).waitFor();assert.equal(await page.locator('#slink-kal-panel').getAttribute('data-state'),'empty');
  await page.evaluate(()=>{behavior='pending';void panel.refresh(true);});await page.getByText('Loading KAL equipment…',{exact:true}).waitFor();await page.evaluate(()=>{history.pushState({},'','?XID=43');dispatchEvent(new PopStateEvent('popstate'));});await page.evaluate(()=>{state.enabled=false;return panel.refresh();});await page.evaluate(()=>release(record()));assert.equal(await page.locator('.slink-kal-equipment').count(),0,'Stale results must not appear after navigation/disable');
  assert.match(await page.locator('#slink-kal-panel footer').textContent(),/Kalends \[2032147\]/);await page.evaluate(()=>panel.destroy());assert.equal(await page.locator('#slink-kal-panel').count(),0);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('KAL profile: independent native anchor, images/stats, history/copy, states, no retry loop, stale reads, cleanup and responsive themes passed.');
}finally{await browser.close();}
