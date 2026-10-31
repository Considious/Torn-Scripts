import fs from 'node:fs';
import vm from 'node:vm';
import { runtime as source, extractFunction } from './test-support/runtime.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(!source.includes('TRAVEL_SAFETY_SCOPE'), 'Headless travel safety must not require a feature grant.');
assert(source.includes('Math.ceil(Math.max(0, Number(oneWayMs) || 0) * 2 * (1 + TRAVEL_SAFETY_BUFFER_RATIO))'), 'Round-trip calculation or 10% buffer is missing.');
assert(source.includes('button[aria-label^="Travel to "]'), 'Generic Torn Travel button matching is missing.');
assert(source.includes('data-slink-travel-dialog'), 'Travel conflict dialog is missing.');
assert(source.includes("document.addEventListener('click', handleTravelSafetyClick, true)"), 'Capture-phase travel interception is missing.');
const context=vm.createContext({TRAVEL_SAFETY_BUFFER_RATIO:0.10,Date});
for(const name of ['travelSafetyTimestampMs','travelSafetyParseDurationMs','travelSafetyNormalizeCrime','travelSafetyRoundTripMs','travelSafetyAssessment'])
  vm.runInContext(extractFunction(name,'src/00-runtime-core.part'),context);
const now=1800000000000, minute=60000;
assert(context.travelSafetyParseDurationMs('0h 27m')===27*minute,'Torn one-way datetime must parse');
assert(context.travelSafetyParseDurationMs('00:27')===27*minute,'Visible one-way clock must parse');
assert(context.travelSafetyRoundTripMs(27*minute)===Math.ceil(27*minute*2.2),'Return journey needs the 10% buffer');
const crime=context.travelSafetyNormalizeCrime({organizedcrime:{id:7,ready_at:(now+50*minute)/1000}});
assert(context.travelSafetyAssessment(27*minute,crime,now).blocked,'A late return must be warned');
assert(!context.travelSafetyAssessment(20*minute,crime,now).blocked,'A safe return must not be blocked');
assert(!context.travelSafetyAssessment(27*minute,null,now).blocked,'Unknown OC state must not block a flight');
assert(!context.travelSafetyAssessment(27*minute,{...crime,executedAt:now-1},now).blocked,'Executed OCs must not block flights');
new Function(source);
console.log('PDA travel safety checks passed.');
