import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const ctx=vm.createContext({URL});vm.runInContext(fs.readFileSync(new URL('./src/00-chat-inline-media.part',import.meta.url),'utf8'),ctx);const R=ctx.SLINK_CHAT_MEDIA.resolve;
assert.equal(R('https://giphy.com/gifs/a-title-abCD1234').key,'giphy:abCD1234');
assert.equal(R('https://media2.giphy.com/media/v1.public/abCD1234/giphy.gif').key,'giphy:abCD1234');
assert.equal(R('https://stickershop.line-scdn.net/stickershop/v1/sticker/123/android/sticker.png').still,'');
for(const url of ['http://media.giphy.com/media/abCD1234/giphy.gif','https://evil.test/a.gif','javascript:alert(1)','https://giphy.com.evil.test/gifs/abcd123','https://user:password@giphy.com/gifs/abcd123','https://api.giphy.com/v1/gifs/search?api_key=secret'])assert.equal(R(url),null,url);
console.log('Inline-media allowlist, GIPHY IDs, direct sticker URL handling, no arbitrary/credential/API URLs passed.');

vm.runInContext(fs.readFileSync(new URL('./src/addons/chat-giphy.addon.js',import.meta.url),'utf8'),ctx);
let settings={enabled:true};const client=ctx.SLINK_GIPHY.createClient({read:async()=>settings,write:async value=>{settings=JSON.parse(JSON.stringify(value));},authorize:async()=>{},request:async()=>{throw Error('No search should run');}});
assert.equal((await client.get()).inlineMedia,true);
assert.equal((await client.patch({inlineMedia:false})).inlineMedia,false);
assert.equal((await client.get()).inlineMedia,false);
assert.equal(settings.enabled,true);
console.log('Inline preview opt-out is acknowledged, survives reload reads and does not disable the picker or issue a search.');
