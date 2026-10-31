import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const platform='pda';
const source=fs.readFileSync(new URL(platform==='extension'?'../src/core/form-state.js':'./src/90-shell-bootstrap.part',import.meta.url),'utf8');
let writes=0,queued=0;
const document={activeElement:null};
class Element {
 constructor(tag='DIV'){this.tagName=tag;this.dataset={};this.listeners=new Map();this.controls=[];this.isConnected=true;this.textContent='';}
 matches(selector){
  if(selector==='[data-ui-autosave="true"]')return this.dataset.uiAutosave==='true';
  if(selector==='[contenteditable="true"]')return false;
  if(selector==='details[data-ui-key]')return this.tagName==='DETAILS'&&!!this.dataset.uiKey;
  return ['INPUT','TEXTAREA','SELECT','DETAILS'].includes(this.tagName)&&/input|textarea|select|details/.test(selector);
 }
 querySelectorAll(selector){return this.controls.filter(control=>control.matches(selector));}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 closest(selector){
  if(selector.includes('data-ui-explicit-commit'))return form;
  if(selector.includes('button')&&this.tagName==='BUTTON')return this;
  if(selector.includes('data-slink-module-id')||selector.includes('data-module-root'))return form;
  return this.parentElement||null;
 }
 contains(node){return node===this||this.controls.includes(node);}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 emit(type,target){const event={target};for(const fn of this.listeners.get(type)||[])fn(event);return event;}
 focus(){document.activeElement=this;root.activeElement=this;}
 setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;}
}
class HTMLInputElement extends Element {
 constructor(id,type='text',value=''){super('INPUT');this.id=id;this.type=type;this._value=value;this.checked=false;this.selectionStart=0;this.selectionEnd=0;this.selectionDirection='none';}
 get value(){return this._value;}set value(v){writes++;this._value=v;}
}
class HTMLSelectElement extends Element {}
const root=new Element(),form=new Element();
form.dataset={slinkModuleId:'target-list',moduleRoot:'targetList',uiExplicitCommit:'true'};
function mount(note='model',checked=false){
 for(const field of root.controls)field.isConnected=false;
 const text=new HTMLInputElement('note','text',note),checkbox=new HTMLInputElement('enabled','checkbox');checkbox.checked=checked;
 const auto=new HTMLInputElement('autosave','checkbox');auto.checked=checked;auto.dataset.uiAutosave='true';
 const details=new Element('DETAILS');details.id='details';details.dataset.uiKey='target-options';details.open=false;
 root.controls=form.controls=[text,checkbox,auto,details];
 for(const control of root.controls)control.parentElement=form;
 return {text,checkbox,auto,details};
}
let nodes=mount(),observer;
const api={core:{storage:{get:async()=>({}),set:async()=>{}}},define(group,key,value){this[group][key]=value;}};
const context=vm.createContext({console,document,Element,HTMLInputElement,HTMLSelectElement,SLINK_EXTENSION:api,
 state:{panels:{}},writeState(){},scrollTo(){},setTimeout,clearTimeout,
 queueMicrotask(fn){queued++;queueMicrotask(fn);},MutationObserver:class{constructor(fn){this.callback=fn;observer=this;}observe(){}disconnect(){}}});
context.global=context;
if(platform==='extension')vm.runInContext(source,context);
else vm.runInContext(source.slice(source.indexOf('function protectEditableState('),source.indexOf('const moduleRenderGuards')),context);
const guard=platform==='extension'?api.core.formState.protect(root):context.protectEditableState(root);
await Promise.resolve();queued=0;
const edit=(node,value)=>{if(node.type==='checkbox')node.checked=value;else node.value=value;root.emit('input',node);root.emit('change',node);};
edit(nodes.text,'unsaved');nodes.text.focus();nodes.text.setSelectionRange(2,4,'forward');root.emit('input',nodes.text);
root.emit('click',new Element('BUTTON'));
await new Promise(resolve=>setTimeout(resolve,5));
nodes=mount('background');guard.restore();assert.equal(nodes.text.value,'unsaved','A Save-labelled click without acknowledgement must not release the draft.');
assert.equal(nodes.text.selectionStart,2);assert.equal(nodes.text.selectionEnd,4);
edit(nodes.checkbox,true);const pending=guard.begin(form);
edit(nodes.text,'newer edit');assert.equal(guard.isCurrent(pending),false);
assert.equal(guard.commit(pending),false,'Acknowledging an older save must report newer edits.');
nodes=mount('normalized saved value',false);guard.restore();
assert.equal(nodes.text.value,'newer edit','Newer text survives the old acknowledgement.');
assert.equal(nodes.checkbox.checked,false,'An acknowledged checkbox must accept normalized model state, not its old draft.');
const failed=guard.begin(form);nodes=mount('old server value');guard.restore();assert.equal(nodes.text.value,'newer edit','A failed save with no commit retains the draft.');
guard.cancel(form);assert.equal(guard.isCurrent(failed),false);
nodes=mount('fresh model');guard.restore();assert.equal(nodes.text.value,'fresh model','Explicit cancel releases that editor.');
edit(nodes.auto,true);nodes=mount('fresh model',false);guard.restore();assert.equal(nodes.auto.checked,false,'Autosaved model controls must not be resurrected by an old UI snapshot.');
const fresh=guard.begin(form);assert.equal(guard.commit(fresh),true);assert.equal(guard.commit(fresh),false,'A ticket cannot be acknowledged twice.');
const before=writes;queued=0;observer.callback([{addedNodes:[],target:form}]);await Promise.resolve();
assert.equal(writes,before);assert.equal(queued,0,'Text-only countdown changes must not reapply editor values.');
nodes.details.open=true;root.emit('toggle',nodes.details);nodes=mount();guard.restore();assert.equal(nodes.details.open,true,'Expanded sections remain open across rendering.');
const focusOut=root.emit('focusout',nodes.text);focusOut.target=null;await Promise.resolve();
guard.stop();
console.log(platform+' explicit form commit: failed saves, newer drafts, normalized acknowledgements, cancel, caret, autosave, details and text-only update isolation passed.');

