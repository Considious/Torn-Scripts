import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const ui=readFileSync(new URL('./src/addons/chat-giphy-ui.addon.js',import.meta.url),'utf8');
const buttons=readFileSync(new URL('./src/addons/chat.addon.js',import.meta.url),'utf8');
class Element {
 constructor(){this.children=[];this.dataset={};this.hidden=false;this.attrs={};}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(key,value){this.attrs[key]=value;}
 querySelectorAll(selector){return selector==='button'?this.children.filter(node=>node.type==='button'):[];}
}
const calls=[];let active=true,layouts=0,created=0;
const context=vm.createContext({document:{createElement:()=>new Element()},SLINK_GIPHY_PANEL(_client,options){created++;assert.equal(options.chatWindow,true);return {host:new Element(),open:type=>{calls.push(type);},suspend:()=>calls.push('pause')};}});
const begin=ui.indexOf('  global.SLINK_CHAT_WINDOW_MEDIA =');assert.ok(begin>0);
context.global=context;
vm.runInContext(ui.slice(begin,ui.lastIndexOf('})(globalThis);')).replace('global.SLINK_CHAT_WINDOW_MEDIA','globalThis.SLINK_CHAT_WINDOW_MEDIA'),context);
const menu=new Element(),macros=new Element(),helper=context.SLINK_CHAT_WINDOW_MEDIA({menu,macros,isActive:()=>active,layout:()=>layouts++});
assert.equal(created,0,'No picker/API setup before choosing media');assert.equal(menu.children.length,3);
assert.deepEqual(menu.children[0].children.map(node=>node.textContent),['Custom buttons','GIFs','Stickers']);
helper.select('gifs');assert.equal(created,1);assert.equal(calls.at(-1),'gif');assert.equal(macros.hidden,true);assert.equal(menu.children[2].hidden,false);
const host=menu.children[2].children[0];helper.select('stickers');assert.equal(created,1);assert.equal(calls.at(-1),'sticker');assert.equal(menu.children[2].children[0],host);
helper.select('macros');assert.equal(macros.hidden,false);assert.equal(calls.at(-1),'pause');
helper.suspend();const count=calls.length;active=false;helper.select('gifs');assert.equal(calls.length,count,'No inactive access');
active=true;helper.resume();assert.equal(created,1);assert.ok(layouts>=4);
assert.match(buttons,/menuMacros\.replaceChildren\(\)/);assert.doesNotMatch(buttons,/menu\.replaceChildren\(\)/,'Macro refresh must not replace the media draft');
assert.match(buttons,/test\(id\)\)return 'private'/);assert.match(buttons,/if\(id==='company'\)return 'company'/);
console.log('Chat-window tools: one retained picker, lazy setup, tabs, activity gating and independent macro content passed.');
