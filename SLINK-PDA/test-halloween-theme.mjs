import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const read=p=>readFile(new URL('./'+p,import.meta.url),'utf8'),source=await read('src/00-halloween-theme.part'),c=vm.createContext({URL,console});vm.runInContext(source,c);
assert.equal(c.SLINK_HALLOWEEN_THEME.definition.scope,'slink.theme.halloween');
assert.equal(c.SLINK_HALLOWEEN_THEME.files.length,14);
assert.doesNotMatch(source,/MutationObserver|setInterval|localStorage|fetch\(/);
const manifest=JSON.parse(await read('source-manifest.json'));
const halloweenIndex=manifest.fragments.indexOf('src/00-halloween-theme.part');
assert.ok(halloweenIndex>=0&&halloweenIndex<manifest.fragments.indexOf('src/00-runtime-core.part'));
assert.match(await read('src/00-runtime-core.part'),/catalog\[index\]=halloween/);
const shell=await read('src/90-shell-bootstrap.part');
assert.match(shell,/SLINK_HALLOWEEN_THEME\?\.apply\(host,theme\)/);
assert.match(shell,/wallpaperTheme:host\.dataset\.theme/);
assert.match(await read('src/40-war.part'),/data-halloween-kind/);assert.match(await read('src/40-war.part'),/SLINK_HALLOWEEN_THEME\?\.refresh\(host\)/);
assert.match(await read('src/00-torn-theme.part'),/halloween-2026.*data-slink-torn-frames/);
const torn=await read('src/00-torn-theme.part');
vm.runInContext(torn,c);
const css=c.SLINK_TORN_THEME.compile({theme:{id:'halloween-2026'}}).css;
for(const size of ['scroll','wide']){
 const filename='halloween-2026-haunted-background-'+size+'-v1.webp';
 assert.ok(css.includes('/Torn-Scripts/main/SLINK-PDA/assets/themes/'+filename));
 assert.ok((await readFile(new URL('./assets/themes/'+filename,import.meta.url))).length>500);
}
assert.match(css,/linear-gradient\(transparent 78%,var\(--slt-bg\) 96%\)/);
assert.match(css,/@media \(min-width:768px\) and \(min-aspect-ratio:8\/5\)/);
console.log('PDA Halloween: existing permission, startup, refreshed alert decoration, Torn frame integration and no storage writes passed.');
