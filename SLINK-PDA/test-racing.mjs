import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(directory, 'SLINK_PDA_Dashboard.user.js'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

new Function(source);
assert(source.includes('@version      0.4.28'), 'PDA Racing release version is missing.');
assert(source.includes('data-page="quality-of-life"'), 'Quality of Life top-level page is missing.');
assert(source.includes('data-quality-of-life-tab="racing"'), 'Racing Quality of Life tab is missing.');
assert(source.includes('data-module-root="racing"'), 'Racing module root is missing.');
assert(source.includes("OFFICIAL_RACE_TRACK_SELECTOR:'.enlisted-btn-wrap'"), 'Supplied official-race selector is missing.');
assert(source.includes("OFFICIAL_RACE_CAR_NAME_SELECTOR:'[class^=\"model-car-name-\"]"), 'Supplied car-name selector is missing.');
assert(source.includes('new MutationObserver(() =>'), 'PDA DOM observer is missing.');

const coreStart = source.indexOf('const RACING_MAX_NICKNAME_LENGTH');
const coreEnd = source.indexOf('const MARKET_PRIORITIES', coreStart);
assert(coreStart >= 0 && coreEnd > coreStart, 'Racing model boundaries are missing.');
const context = {};
vm.createContext(context);
vm.runInContext(source.slice(coreStart, coreEnd) + '\nthis.racing={RACING_RECOMMENDED_BUILDS,RACING_DOM,suggestRacingNickname,validateRacingNickname,normalizeRacingState,racingRecommendationForTrack,matchVisibleRacingCar,parseOfficialRacingTrack};', context);
const racing = context.racing;
assert(racing.RACING_RECOMMENDED_BUILDS.length === 10, 'Expected all ten Class A build definitions.');
assert(racing.RACING_RECOMMENDED_BUILDS.every(build => racing.suggestRacingNickname(build.tracks).valid), 'A generated nickname exceeds Torn\'s limit.');
assert(racing.suggestRacingNickname(['Meltdown','Vector','Industrial']).value === 'Meltdwn|Vect|Industria', 'Known NSX nickname changed.');
assert(racing.suggestRacingNickname(['Withdrawal','Speedway','Uptown']).value === 'Withdraw|Speedwy|Uptow', 'Known LFA nickname changed.');
assert(racing.parseOfficialRacingTrack('Sewage - Official race') === 'Sewage', 'Official-race parser failed.');
assert(racing.parseOfficialRacingTrack('Sewage - Custom race') === null, 'Custom race must not activate Racing.');
const needed = racing.racingRecommendationForTrack('Sewage', {});
assert(needed.status === 'not-completed', 'Needed car was incorrectly treated as ready.');
const ready = racing.racingRecommendationForTrack('Sewage', { builds:{ [needed.definition.id]:{ completed:true } } });
assert(ready.status === 'ready', 'Completed car was not treated as ready.');
assert(racing.matchVisibleRacingCar(ready.nickname, [{ name:ready.nickname }]), 'Exact visible nickname did not match.');
assert(!racing.matchVisibleRacingCar(ready.nickname, [{ name:'Similar but wrong' }]), 'Assistant guessed a non-exact car.');
const scanner = source.slice(source.indexOf('function scanOfficialRaceDom()'), source.indexOf('function scheduleRacingScan', source.indexOf('function scanOfficialRaceDom()')));
assert(!scanner.includes('.click('), 'Racing assistant must never auto-select a car.');

console.log('PDA Racing validation passed.');
