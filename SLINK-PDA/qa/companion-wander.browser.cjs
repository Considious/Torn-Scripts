const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const source=process.env.SLINK_COMPANION_SOURCE||path.resolve(__dirname,'../src/80-companion.part');
const now=Date.parse('2026-11-21T20:00:00Z');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SLINK_BROWSER_EXECUTABLE?{executablePath:process.env.SLINK_BROWSER_EXECUTABLE}:{channel:'msedge'})});
 async function boot({width=960,movement='wander',reduced=false,edge=.7,roll=.2}={}){
  const page=await browser.newPage({viewport:{width,height:700},reducedMotion:reduced?'reduce':'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.torn.com/**',route=>route.fulfill({contentType:'text/html',body:'<button id="ordinary" style="position:fixed;inset:0;width:100vw;height:100vh">Ordinary Torn link/button area</button><textarea id="chat" style="position:fixed;left:120px;top:530px;width:140px;height:35px"></textarea><section id="dashboard" hidden style="position:fixed;right:0;top:0;width:300px;height:500px;z-index:99999;background:#222"><span id="perch" hidden style="display:block;width:49px;height:45px"></span></section><section id="settings" style="position:absolute;top:900px"></section>'}));
  await page.goto('https://www.torn.com/index.php');await page.clock.install({time:now});await page.clock.pauseAt(now+1000);await page.addScriptTag({path:source});
  await page.evaluate(({movement,edge,roll,width})=>{
   window.roll=roll;Math.random=()=>window.roll;window.opens=0;window.nativeClicks=0;window.intervals=0;
   const interval=window.setInterval;window.setInterval=(...args)=>{intervals++;return interval(...args);};
   const asset=document.createElement('canvas');asset.width=100;asset.height=100;asset.getContext('2d').fillRect(0,0,100,100);
   window.saved=JSON.stringify({movement,chatter:false,positions:{'jack-o-slink':{x:edge,y:.55,manual:true}}});
   const dashboard=document.getElementById('dashboard'),perch=document.getElementById('perch');
   window.api=SLINK_COMPANIONS.create({allowed:()=>true,open:()=>opens++,asset:()=>asset.toDataURL(),settingsParent:document.getElementById('settings'),avoidElements:()=>[dashboard],dockTarget:()=>width<500&&!dashboard.hidden?perch:null,storage:{getItem:()=>saved,setItem:(_k,v)=>saved=v}});
   document.getElementById('ordinary').onclick=()=>nativeClicks++;
   window.jackHost=[...document.body.children].find(n=>n.shadowRoot?.getElementById('jack'));
  },{movement,edge,roll,width});
  await page.waitForFunction(()=>!jackHost.hidden);await page.clock.runFor(32);
  const jack=page.getByRole('button',{name:/Jack O/});
  const rect=()=>page.evaluate(()=>{const r=jackHost.shadowRoot.getElementById('jack').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
  const advance=ms=>page.clock.runFor(ms);
  const drag=async(dx=35,dy=-35)=>{const r=await rect();await page.mouse.move(r.x+r.w/2,r.y+r.h/2);await page.mouse.down();await page.mouse.move(r.x+r.w/2+dx,r.y+r.h/2+dy,{steps:5});await page.mouse.up();await page.mouse.move(2,2);await advance(20);return rect();};
  return {page,jack,rect,advance,drag,errors};
 }
 try{
  for(let direction=0;direction<8;direction++){
   const {page,rect,advance,errors}=await boot();const before=await rect();await page.evaluate(direction=>{const values=[.2,.5,(direction+.01)/8];Math.random=()=>values.length?values.shift():.2;},direction);await advance(6500);const after=await rect();const [dx,dy]=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]][direction];assert.equal(Math.sign(after.x-before.x),dx,'Horizontal component for direction '+direction);assert.equal(Math.sign(after.y-before.y),dy,'Vertical component for direction '+direction);assert.deepEqual(errors,[]);await page.close();
  }
  // Dragging must preserve both modes and use one deadline across refreshes.
  for(const movement of ['wander','stay']){
   const t=await boot({movement}),{page,rect,advance,drag}=t;
   const placed=await drag();assert.equal(await page.evaluate(()=>JSON.parse(saved).movement),movement);assert.equal(await page.locator('[data-pref="movement"]').inputValue(),movement);assert.equal(await page.evaluate(()=>opens),0);
   if(movement==='wander'){
    await page.evaluate(()=>{api.observe('test',[]);api.observe('test',[{id:'important',important:true,critical:true,category:'general'}]);});
    assert.equal(await page.evaluate(()=>jackHost.shadowRoot.getElementById('speech').hidden),false,'Important companion alerts must work during the manual pause');
   }
   await advance(14000);await page.evaluate(()=>api.sync());await advance(14000);assert.deepEqual(await rect(),placed);
   await advance(1900);assert.deepEqual(await rect(),placed,'Manual position must remain for at least 30 seconds');
   await advance(1400);if(movement==='wander')assert.notDeepEqual(await rect(),placed,'Wander must resume automatically');else assert.deepEqual(await rect(),placed);
   await page.evaluate(()=>api.destroy());await advance(60000);assert.equal(await page.locator('#jack').count(),0);assert.deepEqual(t.errors,[]);await page.close();
  }
  {
   const {page,rect,advance,drag,errors}=await boot();await drag();await advance(20000);const second=await drag(-25,-25);await advance(28000);assert.deepEqual(await rect(),second,'Second drag restarts the pause');await advance(4000);assert.notDeepEqual(await rect(),second);assert.deepEqual(errors,[]);await page.close();
  }
  {
   const {page,rect,advance,errors}=await boot();const before=await rect();await advance(5200);const during=await rect();assert.notDeepEqual(during,before,'Walking must visibly interpolate before its destination');assert(Math.hypot(during.x-before.x,during.y-before.y)<50,'A walking frame must not jump to the full destination');
   await page.evaluate(()=>{const dialog=document.createElement('div');dialog.id='important-dialog';dialog.setAttribute('role','dialog');dialog.style.cssText='position:fixed;inset:0;z-index:999999';document.body.append(dialog);});
   await advance(400);const blocked=await rect();await advance(10000);assert.deepEqual(await rect(),blocked,'An open dialog must stop automatic paths through it');
   await page.evaluate(()=>document.getElementById('important-dialog').remove());await advance(10000);assert.notDeepEqual(await rect(),blocked,'Movement must recover after a dialog closes');assert.deepEqual(errors,[]);await page.close();
  }
  for(const width of [390,960]){
   const {page,jack,rect,advance,drag,errors}=await boot({width});let previous=await rect(),moves=0,vertical=false;
   for(let i=0;i<60;i++){await advance(1000);const r=await rect();assert(r.x>=-.01&&r.y>=-.01&&r.x+r.w<=width+.01&&r.y+r.h<=700.01,'Normal walking must stay entirely visible');if(Math.hypot(r.x-previous.x,r.y-previous.y)>2)moves++;if(Math.abs(r.y-previous.y)>2)vertical=true;previous=r;}
   assert(moves>=6,'Multiple visible walks should occur in one minute over ordinary interactive content');assert(vertical,'Walking should include vertical movement');assert.equal(await page.evaluate(()=>intervals),0);
   await page.locator('#ordinary').click({position:{x:5,y:5}});assert.equal(await page.evaluate(()=>nativeClicks),1);await page.locator('#chat').fill('Still editable');assert.equal(await page.locator('#chat').inputValue(),'Still editable');
   const paused=await rect();await page.evaluate(()=>dispatchEvent(new Event('blur')));await advance(12000);assert.deepEqual(await rect(),paused);await page.evaluate(()=>dispatchEvent(new Event('focus')));await advance(11000);assert.notDeepEqual(await rect(),paused);
   await page.evaluate(()=>{window.testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>testHidden});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await rect();await advance(12000);assert.deepEqual(await rect(),hidden);await page.evaluate(()=>{testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await advance(11000);assert.notDeepEqual(await rect(),hidden);
   const hovered=await rect();await page.mouse.move(hovered.x+hovered.w/2,hovered.y+hovered.h/2);await advance(12000);assert.deepEqual(await rect(),hovered);await page.mouse.move(2,2);await advance(11000);assert.notDeepEqual(await rect(),hovered);
   // Interrupt a live walk, then clicking must still open SLINK during the pause.
   const manual=await drag();await advance(1000);assert.deepEqual(await rect(),manual);await jack.click();assert.equal(await page.evaluate(()=>opens),1);await page.mouse.move(2,2);
   await page.evaluate(()=>{document.getElementById('dashboard').hidden=false;api.onVisibility();});await advance(10000);if(width<500)assert.equal(await jack.count(),0,'PDA perch remains decorative');
   await page.evaluate(()=>{document.getElementById('dashboard').hidden=true;api.onVisibility();});await advance(40000);assert.equal(await jack.count(),1);assert.deepEqual(errors,[]);await page.close();
  }
  for(const edge of [0,1]){
   const {page,rect,advance,errors}=await boot({edge,roll:.1});const origin=await rect(),saved=await page.evaluate(()=>window.saved);await advance(4800);const peek=await rect();assert(edge===0?peek.x<0:peek.x+peek.w>960,'Screen peek must work at either edge');await advance(2200);assert.deepEqual(await rect(),origin);assert.equal(await page.evaluate(()=>window.saved),saved,'Peek must not change saved position or mode');assert.deepEqual(errors,[]);await page.close();
  }
  {
   const {page,rect,advance,errors}=await boot({reduced:true});const initial=await rect();await advance(60000);assert.deepEqual(await rect(),initial,'Reduced motion must prevent wandering');assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Companion wandering passed: mode preservation, 30s pause/restart, ordinary controls, smooth bounded XY walks, focus/visibility/hover recovery, click/drag, docking/PDA, both-edge peek, reduced motion and no recurring timer additions.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
