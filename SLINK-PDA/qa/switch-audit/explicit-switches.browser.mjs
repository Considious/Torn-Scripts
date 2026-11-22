import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SLINK_PLAYWRIGHT_MODULE||'playwright');
const read=file=>fs.readFileSync(new URL(file,import.meta.url),'utf8');
const local=fs.existsSync(new URL('torn-components.js',import.meta.url));
const extension=fs.existsSync(new URL('../../src/core/torn-components.js',import.meta.url));
const core=local?read('torn-components.js'):read(extension?'../../src/core/torn-components.js':'../../src/00-torn-components.part');
const cases=JSON.parse(read('controls.json')).filter(x=>x.tag),constructors=JSON.parse(read('constructors.json'));
if(!local){
 const platform=extension?'Extension':'PDA';
 for(const item of [...cases,...constructors].filter(x=>x.platform===platform)){
  const source=read('../../'+(item.file||item.path));
  assert(source.includes(item.tag||item.code),'Production control must match audited markup: '+(item.file||item.path)+' '+(item.id||item.variable));
 }
}
const shellCss=new Function('SLINK','return `'+JSON.parse(read('shell-css.json'))+'`;')({core:{themes:{cssVariables:()=>''}}});
const browser=await chromium.launch({headless:true,executablePath:process.env.SLINK_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:{width:mobile?390:1100,height:900},hasTouch:mobile}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="slink-extension-panel"></div><label><input id="native" type="checkbox">Torn native</label>');await page.addScriptTag({content:core});
  await page.evaluate(({cases,css})=>{
   const root=document.getElementById('slink-extension-panel').attachShadow({mode:'open'});window.testRoot=root;
   // Reproduce the exact initialization sequence that previously lost the CSS.
   SLINK_TORN_COMPONENTS.install(root);root.replaceChildren();
   const base=document.createElement('style');base.textContent=css;root.append(base);
   const controls=document.createElement('main');controls.style.cssText='width:100%;box-sizing:border-box;padding:10px';root.append(controls);
   cases.forEach((entry,index)=>{const label=document.createElement('label');label.dataset.case=String(index);label.style.display='block';label.innerHTML=entry.tag.replace(/\$\{[^}]*\}/g,'fixture')+'<span>'+entry.id+'</span>';controls.append(label);});
   const unlisted=document.createElement('label');unlisted.innerHTML='<input id="unlisted" type="checkbox">Unlisted SLINK preference';controls.append(unlisted);
   window.changes=0;root.addEventListener('change',()=>changes++);
  },{cases,css:shellCss});
  await page.waitForFunction(()=>testRoot.querySelector('style[data-slink-torn-components]'));
  const results=await page.evaluate(cases=>cases.map((entry,index)=>{const input=testRoot.querySelector('[data-case="'+index+'"] input');return {id:entry.id,role:input?.getAttribute('role'),classed:input?.classList.contains('slink-switch'),width:input?.getBoundingClientRect().width,appearance:input&&getComputedStyle(input).appearance};}),cases);
  for(let i=0;i<cases.length;i++){
   if(cases[i].converted){assert.equal(results[i].role,'switch',cases[i].file+' '+cases[i].id);assert.equal(results[i].classed,true);assert.equal(results[i].width,36,cases[i].id+' must have visible switch styling');assert.equal(results[i].appearance,'none');}
   else{assert.equal(results[i].classed,false,cases[i].id+' must stay a checkbox');assert.notEqual(results[i].role,'switch');}
  }
  assert.equal(await page.locator('#unlisted').getAttribute('role'),null);assert.equal(await page.locator('#native').getAttribute('role'),null);
  const war=page.locator('#war-alert-sound');await war.focus();await page.keyboard.press('Space');assert.equal(await war.isChecked(),true);assert.equal(await page.evaluate(()=>changes),1);
  await page.evaluate(constructors=>{for(const entry of constructors){const input=document.createElement('input');new Function(entry.variable,entry.code)(input);if(input.type!=='checkbox'||input.getAttribute('role')!=='switch'||!input.classList.contains('slink-switch'))throw Error(entry.path);}},constructors);
  await page.evaluate(()=>{const fragment=document.createDocumentFragment();for(const node of [...testRoot.children])if(!node.matches('[data-slink-torn-components]'))fragment.append(node);testRoot.replaceChildren(fragment);});
  await page.waitForFunction(()=>testRoot.querySelectorAll('style[data-slink-torn-components]').length===1);
  assert.equal(await war.evaluate(e=>getComputedStyle(e).appearance),'none','Switch style must recover after a second reset');assert.equal(await war.isChecked(),true,'Recovery must preserve the saved/input state');assert.equal(await page.evaluate(()=>changes),1,'Recovery must not fire settings writes');
  for(const [text,control,accent]of [['#edf7ff','#223140','#9438df'],['#241d17','#f4ede4','#6e287a']]){
   await page.evaluate(({text,control,accent})=>{const host=document.getElementById('slink-extension-panel');host.style.setProperty('--slink-text',text);host.style.setProperty('--slink-bg-control',control);host.style.setProperty('--slink-accent',accent);},{text,control,accent});
   assert.equal(await war.evaluate(e=>getComputedStyle(e).backgroundColor),accent==='#9438df'?'rgb(148, 56, 223)':'rgb(110, 40, 122)');
   await war.evaluate(e=>{e.disabled=true;});assert.equal(await war.isDisabled(),true);await war.evaluate(e=>{e.disabled=false;});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Passed '+cases.filter(x=>x.converted).length+' explicit switch templates, '+cases.filter(x=>!x.converted).length+' preserved checkbox templates, '+constructors.length+' dynamic constructors; War stylesheet-reset regression, keyboard, state preservation, themes and touch layout.');
}finally{await browser.close();}
