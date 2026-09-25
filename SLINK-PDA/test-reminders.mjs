import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert(start >= 0, `Missing ${name}`);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}
let now = 1_800_000_000_000;
const settings = { stackModeSince:now, snoozedUntil:{}, timer24EndsAt:0 };
const notifications = [];
const context = vm.createContext({
  Date:{ now:() => now },
  dataState:{ settings:{ alerts:settings }, caches:{ alertNotificationIds:[] } },
  WEEK_MS:7 * 86_400_000,
  utcDay:() => Math.floor(now / 86_400_000),
  number:String, duration:String,
  acceptedMissions:() => [], raceActive:() => false,
  googlePlayPointsAccess:() => ({ detail:'', links:[] }),
  showSystemAlert:alert => notifications.push(alert.id), updateAlertIndicator:() => {}
});
for (const name of ['finite', 'refillAvailable', 'cooldownSeconds', 'alertRows', 'endStackIfSpent', 'timer24Label', 'reconcileAlertNotifications']) {
  vm.runInContext(extract(name), context);
}
const snapshot = energy => ({ at:now, body:{ bars:{ energy:{ current:energy, maximum:150 } }, refills:{ energy:{ available:true } } } });
for (const energy of [150, 151, 1000, null, undefined, '', 'bad']) {
  now++;
  assert.equal(context.endStackIfSpent(snapshot(energy)), false, `Incorrectly ended stack at ${energy}`);
  assert(!context.alertRows(snapshot(energy)).some(a => ['energyFull', 'energyRefill'].includes(a.id)));
}
assert.equal(context.endStackIfSpent({ ...snapshot(149), at:settings.stackModeSince - 1 }), false, 'Cached reading must not end stacking');
now++;
assert.equal(context.endStackIfSpent(snapshot(149)), true);
assert.equal(settings.stackModeSince, 0);
assert(context.alertRows(snapshot(149)).some(a => a.id === 'energyRefill'));
assert(!context.alertRows(snapshot(149)).some(a => a.id === 'energyFull'));
assert(context.alertRows(snapshot(150)).some(a => a.id === 'energyFull'), 'Next full-energy cycle must alert normally');
settings.timer24EndsAt = now + 86_400_000;
settings.stackModeSince = now;
assert(!context.alertRows(snapshot(1000)).some(a => a.id === 'timer24'));
now += 86_400_000;
context.reconcileAlertNotifications(snapshot(1000));
context.reconcileAlertNotifications(snapshot(1000));
assert.equal(notifications.filter(id => id === 'timer24').length, 1, 'Timer must notify once even while stacking');
assert.match(context.timer24Label(), /finished/);
settings.timer24EndsAt = 0;
assert(!context.alertRows(snapshot(1000)).some(a => a.id === 'timer24'));
assert.match(context.timer24Label(), /not started/);
console.log('PDA fresh-energy transitions, alert rearming, independent timer and notification deduplication passed.');
