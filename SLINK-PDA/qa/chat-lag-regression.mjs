import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.SLINK_BROWSER_PACKAGE||'playwright');
const browser=await chromium.launch({executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage();
 await page.route('**/*',r=>r.fulfill({contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')}));
 await page.setContent('<main id="attack-root"></main><div id="chatRoot"><div id="faction"><button class="header___fixture"><span>Faction</span><svg aria-label="Minimize"></svg></button><div id="messages"></div><textarea placeholder="Type your message here..."></textarea></div></div>');
 await page.evaluate(()=>{
  document.querySelector('#messages').innerHTML=Array.from({length:200},(_,i)=>'<div class="virtualItem___fixture"><span class="senderContainer___fixture"><a class="sender___fixture" href="/profiles.php?XID='+(100+i)+'">Member</a></span><span class="message___fixture messageContent___fixture">Hello '+i+'</span></div>').join('');
  window.IntersectionObserver=undefined;
  window.urlChecks=0;const NativeURL=window.URL;window.URL=class extends NativeURL{constructor(...args){super(...args);urlChecks++;}};
  window.active=true;window.activityListeners=new Set();window.activity={eligible:()=>active,subscribe(fn){activityListeners.add(fn);return()=>activityListeners.delete(fn);},cancel:id=>clearTimeout(id),defer:(fn,delay)=>setTimeout(()=>{if(active)fn();},delay)};
  window.chatConfig={ffBubbles:true,highlights:[{term:'hello',enabled:true,color:'green'}]};
  window.SLINK_PDA_PAGE_ACTIVITY=activity;window.SLINK_GIPHY={client:()=>({get:async()=>({enabled:true,inlineMedia:true})})};
  window.lookups=0;window.SLINK_PDA_PLUGIN_API={settings:()=>chatConfig,hasScope:()=>true,register(module){window.chatModule=module;},root:()=>null,chatFairFight:async ids=>{lookups++;return ids.map(id=>({id,ff:2.4,source:'fixture',at:Date.now()}));}};
  window.perf={queries:0,walkers:0,layouts:0};
  for(const proto of [Element.prototype,Document.prototype])for(const method of ['querySelector','querySelectorAll']){const native=proto[method];proto[method]=function(...args){perf.queries++;return native.apply(this,args);};}
  const walk=Document.prototype.createTreeWalker;Document.prototype.createTreeWalker=function(...args){perf.walkers++;return walk.apply(this,args);};
  const rect=Element.prototype.getClientRects;Element.prototype.getClientRects=function(...args){perf.layouts++;return rect.apply(this,args);};
 });
 for(const file of ['src/00-chat-ff.part','src/00-chat-inline-media.part','src/addons/chat.addon.js'])await page.addScriptTag({content:fs.readFileSync(process.env.SLINK_CHAT_SOURCE_ROOT?resolve(process.env.SLINK_CHAT_SOURCE_ROOT,file):new URL('../'+file,import.meta.url),'utf8')});
 await page.evaluate(()=>chatModule.start());await page.waitForTimeout(650);
 const initial=await page.evaluate(()=>({badges:document.querySelectorAll('[data-slink-chat-ff]').length,highlights:document.querySelectorAll('mark').length,urlChecks,...perf}));
 console.log('initial',initial);assert.equal(initial.badges,200);assert.equal(initial.highlights,200);
 await page.evaluate(()=>{perf={queries:0,walkers:0,layouts:0};});
 for(let i=0;i<40;i++)await page.evaluate(i=>{const e=document.createElement('div');e.innerHTML='<span>Attack '+i+'</span>';document.getElementById('attack-root').replaceChildren(e);},i);
 await page.waitForTimeout(180);const unrelated=await page.evaluate(()=>({...perf}));console.log('40 unrelated attack updates',unrelated);
 await page.evaluate(()=>{perf={queries:0,walkers:0,layouts:0};});
 for(let i=0;i<40;i++)await page.evaluate(i=>{document.querySelector('#messages .message___fixture').textContent='Chat tick '+i;},i);
 await page.waitForTimeout(180);const message=await page.evaluate(()=>({...perf}));console.log('40 single-message updates',message);
 if(!process.argv.includes('--baseline')){assert(initial.urlChecks<1200,'Fixed sender slots must avoid quadratic duplicate searches');assert.equal(unrelated.walkers,0);assert.equal(unrelated.layouts,0);assert(unrelated.queries<100,'Unrelated gameplay must not repeatedly search chat or each added gameplay subtree');assert(message.layouts<10,'Text updates must not remeasure every sender');assert(message.walkers<12,'A changed message must not walk all messages again');}
 await page.evaluate(()=>{document.querySelectorAll('.message___fixture')[1].innerHTML='<a href="https://media.giphy.com/media/fixture/giphy.gif">GIF</a>';});await page.waitForTimeout(180);assert.equal(await page.locator('img[data-slink-inline-media]').count(),1);
 await page.evaluate(()=>{active=false;for(const fn of activityListeners)fn(false);perf={queries:0,walkers:0,layouts:0};});
 for(let i=0;i<20;i++)await page.evaluate(i=>{document.getElementById('messages').append(document.createTextNode('paused'+i));},i);
 await page.waitForTimeout(180);assert.deepEqual(await page.evaluate(()=>({...perf})),{queries:0,walkers:0,layouts:0});
 assert.equal(await page.locator('[data-slink-chat-ff]').count(),200);assert.equal(await page.locator('img[data-slink-inline-media]').count(),1);
 await page.evaluate(()=>{active=true;for(const fn of activityListeners)fn(true);});await page.waitForTimeout(200);
 assert.equal(await page.locator('[data-slink-chat-ff]').count(),200);assert.equal(await page.locator('img[data-slink-inline-media]').count(),1);
 // Torn replaces the chat root during navigation; tools must reattach once.
 await page.evaluate(()=>{const root=document.getElementById('chatRoot');root.replaceWith(root.cloneNode(true));});await page.waitForTimeout(300);
 assert.equal(await page.locator('[data-ccb-media-trigger]').count(),1);
 assert.equal(await page.locator('[data-slink-chat-ff]').count(),200,'Replaced chat gets one badge per fixed sender slot, never a cloned duplicate');
 console.log('Full PDA chat: tools, media, FF, highlights, inactive gating and replacement checked.');
} finally {await browser.close();}

