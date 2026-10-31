import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';
const source=readFileSync(new URL('./src/00-chat-ff.part',import.meta.url),'utf8');const ctx=vm.createContext({URL,Date});vm.runInContext(source,ctx);
const C=ctx.SLINK_CHAT_FF;assert.equal(C.fromRow({player_id:10,fair_fight:199.28}).ff,199.28);assert.equal(C.fromIntelligence({playerId:10,fairFight:2,fairFightContext:{observerId:1,ownStatsAt:5}},{observerId:2,ownStatsAt:5}),null);
assert.match(readFileSync(new URL('./src/90-shell-bootstrap.part',import.meta.url),'utf8'),/chatFairFight:global.SLINK_CHAT_FF.createLookup/);
assert.match(readFileSync(new URL('./src/addons/chat.addon.js',import.meta.url),'utf8'),/lookup:ids=>api.chatFairFight\(ids\)/);
console.log('PDA independent chat FF engine and native adapter wiring passed.');
