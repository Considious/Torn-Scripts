const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.SLINK_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless:true,...(process.env.SLINK_BROWSER_EXECUTABLE?{executablePath:process.env.SLINK_BROWSER_EXECUTABLE}:{channel:'chrome'}) });
  try {
    for (const width of [360, 960]) {
      const narrow = width < 500;
      const page = await browser.newPage({ viewport:{width,height:700}, reducedMotion:'reduce' });
      await page.setContent('<button id="toggle">Open dashboard</button><section id="dashboard" style="position:fixed;inset:0 0 auto auto;width:min(350px,100vw);height:670px;background:#222;z-index:999999" hidden><header style="display:flex"><button id="close">Minimize</button><span id="perch" style="width:49px;height:45px" hidden></span></header></section>');
      await page.addScriptTag({path:process.env.SLINK_COMPANION_SOURCE||path.resolve(__dirname,'../src/80-companion.part')});
      await page.evaluate(narrow => {
        const dashboard = document.querySelector('#dashboard'), perch = document.querySelector('#perch');
        const context = document.createElement('canvas');
        context.getContext('2d').fillRect(0,0,100,100);
        window.opens=0;
        window.saved=JSON.stringify({positions:{'jack-o-slink':{x:1,y:.6,manual:true}}});
        const setOpen = value => {dashboard.hidden=!value;window.jackCompanion?.onVisibility();};
        document.querySelector('#toggle').onclick=()=>setOpen(true);
        document.querySelector('#close').onclick=()=>setOpen(false);
        window.jackCompanion=SLINK_COMPANIONS.create({
          allowed:()=>true,open:()=>{window.opens++;setOpen(true);},asset:()=>context.toDataURL(),settingsParent:document.body,
          avoidElements:()=>[dashboard],dockTarget:()=>narrow&&!dashboard.hidden?perch:null,
          storage:{getItem:()=>window.saved,setItem:(_key,value)=>{window.saved=value;}}
        });
      },narrow);
      const jack=page.getByRole('button',{name:/Jack O/});
      await jack.waitFor();
      const original=await jack.boundingBox(), saved=await page.evaluate(()=>window.saved);
      await jack.click();
      assert.equal(await page.evaluate(()=>window.opens),1);
      if(narrow){
        await page.waitForFunction(()=>!!document.querySelector('#perch > div')?.shadowRoot.querySelector('canvas'));
        assert.equal(await jack.count(),0,'the reserved header pose is decorative');
      }else{
        await page.waitForFunction(()=>document.querySelector('#dashboard').getBoundingClientRect().left >
          [...document.body.children].find(node=>node.shadowRoot?.getElementById('jack')).shadowRoot.getElementById('jack').getBoundingClientRect().right);
        const side=await jack.boundingBox();
        await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
        assert.deepEqual(await jack.boundingBox(),side);
        await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
      }
      await page.locator('#close').click();
      await page.waitForFunction(x=>[...document.body.children].find(node=>node.shadowRoot?.getElementById('jack'))?.shadowRoot.getElementById('jack').getBoundingClientRect().left===x,original.x);
      assert.deepEqual(await jack.boundingBox(),original);
      assert.equal(await page.evaluate(()=>window.saved),saved);
      await page.mouse.move(original.x+45,original.y+45);
      await page.mouse.down();
      await page.mouse.move(original.x+12,original.y+8,{steps:5});
      await page.mouse.up();
      assert.equal(await page.evaluate(()=>window.opens),1,'drag does not open the dashboard');
      assert.notEqual(await page.evaluate(()=>window.saved),saved,'drag persists the placement');
      await page.close();
    }
    console.log('Jack placement passed: desktop avoidance, narrow/PDA perch, blur, restoration and drag.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
