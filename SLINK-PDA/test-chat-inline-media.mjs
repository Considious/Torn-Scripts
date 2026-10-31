import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const ctx=vm.createContext({URL});vm.runInContext(fs.readFileSync(new URL('./src/00-chat-inline-media.part',import.meta.url),'utf8'),ctx);
const R=ctx.SLINK_CHAT_MEDIA.getMediaUrl;
assert.equal(R('https://giphy.com/gifs/UnBoxFestival-slinky-unbox-unboxfestival-XtiszAuc6r7byvYqZiy'),'https://media.giphy.com/media/XtiszAuc6r7byvYqZiy/giphy.gif');
for(const url of ['https://media1.giphy.com/media/v1.Y2lkPTQxLONG_ENCODED_VALUE/200w.gif','https://media2.giphy.com/media/v1.public/abCD1234/giphy.gif','https://stickershop.line-scdn.net/stickershop/v1/sticker/123/android/sticker.png','https://example.com/image.avif?size=2'])
 assert.equal(R(url),url,'Original renderer must preserve the supplied direct URL, including encoded GIPHY CDN paths');
assert.equal(R('https://giphy.com/stickers/a-name-abCD1234'),'https://media.giphy.com/media/abCD1234/giphy.gif');
assert.equal(R('ordinary text'),null);
assert.equal(R('javascript:alert(1)'),null);
console.log('Original direct-media and GIF-page conversion retained; sticker pages supported without changing direct CDN URLs.');
vm.runInContext(fs.readFileSync(new URL('./src/addons/chat-giphy.addon.js',import.meta.url),'utf8'),ctx);
let settings={enabled:true};const client=ctx.SLINK_GIPHY.createClient({read:async()=>settings,write:async value=>{settings=JSON.parse(JSON.stringify(value));},authorize:async()=>{},request:async()=>{throw Error('No search should run');}});
assert.equal((await client.get()).inlineMedia,true);
assert.equal((await client.patch({inlineMedia:false})).inlineMedia,false);
assert.equal((await client.get()).inlineMedia,false);
assert.equal(settings.enabled,true);
console.log('Inline preview opt-out is acknowledged, survives reload reads and does not disable the picker or issue a search.');
