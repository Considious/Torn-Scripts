import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { runtime as source, assertVersionConsistency, extractFunction } from './test-support/runtime.mjs';
const preview = fs.readFileSync(new URL('./preview.html', import.meta.url), 'utf8');

assertVersionConsistency();
assert.match(source, /@grant\s+GM_xmlhttpRequest/);
assert.match(source, /@grant\s+GM_notification/);
assert.match(source, /@connect\s+api\.torn\.com/);
assert.match(source, /@connect\s+weav3r\.dev/);
assert.match(source, /@connect\s+slinkmuggingworker\.richard-johnson554\.workers\.dev/);
assert.match(source, /No HTTP origin is configured for/);
assert.doesNotMatch(source, /@require\b/);
assert.match(source, /viewport-fit=cover|safe-area-inset/);
assert.match(source, /grid-template-columns:minmax\(0,1fr\)/);
assert.match(source, /\.scroll\{width:100%;min-width:0;min-height:0/);
assert.match(source, /\.launcher\[hidden\]\{display:none\}/);
assert.match(source, /launcher\.hidden = true/);
assert.match(source, /launcher\.hidden = state\.minimizedMode === 'chat'/);
// Landscape has an intentional minimized-bar layout, not an alternate or hidden dashboard.
assert.match(source, /@media\(orientation:landscape\)[^\n]+\.launcher\[data-mode="bar"\]/);
assert.doesNotMatch(source, /@media\(orientation:landscape\)[^\n]+\.overlay\{display:none/);
assert.doesNotMatch(source, /padding-right:104px/);
assert.match(source, /data-action="reset-layout"/);
assert.match(source, /orientationchange/);
assert.match(source, /MutationObserver/);
assert.match(source, /dashboardOpen = false/);
assert.match(source, /function normalizeUiState/);
assert.match(source, /GM_API\.get\(STORAGE_KEY, \{\}\)/);
assert.match(source, /GM_API\.set\(STORAGE_KEY, snapshot\)/);
assert.match(source, /page:\['combat', 'efficiency', 'quality-of-life', 'access'\]/);
assert.match(source, /data-page="combat"/);
assert.match(source, /data-page="efficiency"/);
assert.match(source, /data-page="access"/);
assert.match(source, /data-combat-tab="leveling"/);
assert.match(source, /data-efficiency-tab="merits"/);
assert.match(source, /data-efficiency-tab="market"/);
assert.match(source, /data-efficiency-tab="dollarBazaars"/);
assert.match(source, /slinkcontributionworker\.richard-johnson554\.workers\.dev/);
assert.match(source, /slinkyleveling\.richard-johnson554\.workers\.dev/);
assert.match(source, /slinkwarworker\.richard-johnson554\.workers\.dev/);
assert.match(source, /slink\.level/);
assert.match(source, /slink\.war\.officer/);
assert.match(source, /slink\.adhd\.alerts/);
assert.match(source, /slink\.adhd\.marketwatch\.\(\\d\+\)|slink\\\.adhd\\\.marketwatch/);
assert.match(source, /admin\.\*/);
assert.match(source, /hasAdminScope\(\) \|\| hasGrantedScope\(required\)/);
assert.match(source, /\/api\/themes/);
assert.match(source, /validateThemeCatalog/);
assert.match(source, /slink\.theme\.dragons-breath|themeCatalog\(\)/);
assert.match(source, /data-field="ff-key"/);
assert.match(source, /data-field="use-pda-api-key"/);
assert.match(source, /data-field="use-pda-ff-key"/);
assert.match(source, /refineWithFfScouter/);
assert.match(source, /data-action="merit-page"/);
assert.match(source, /data-field="merit-filter"/);
assert.match(source, /Only the next incomplete award in each milestone family is shown/);
assert.match(source, /laterMilestones:family\.slice\(1\)/);
assert.match(source, /data-action="hide-city-until-reset"/);
assert.match(source, /cityDoneDay/);
assert.match(source, /cityAtReset/);
assert.match(source, /cityBaselineVersion:2/);
assert.match(source, /GOOGLE_PLAY_POINTS_ANDROID_INTENT/);
assert.match(source, /https:\/\/support\.google\.com\/googleplay\/answer\/9077192/);
assert.match(source, /googlePlayPointsClaimedAt/);
assert.match(source, /data-action="claim-google-play-points"/);
assert.match(source, /Math\.floor\(reset \/ 1000\) - 1/);
assert.match(source, /function raceActive/);
assert.match(source, /waiting\\s\+for\\s\+\(\?:a\\s\+\)\?race/);
assert.match(source, /enlistedcars,icons/);
assert.match(source, /launcher-alert-count/);
assert.match(source, /reconcileAlertNotifications/);
assert.match(source, /Date\.now\(\) - moduleState\.alerts\.lastAttemptAt >= 5 \* 60_000/);
assert.match(source, /const visibleGoals = goals\.slice\(\(page - 1\) \* pageSize, page \* pageSize\)/);
assert.match(source, /considious:torn-api-ledger:v1/);
assert.match(source, /data-module-root="leveling"/);
assert.match(source, /data-module-root="war"/);
assert.match(source, /data-module-root="stats"/);
assert.match(source, /data-module-root="alerts"/);
assert.match(source, /data-module-root="market"/);
assert.match(source, /data-module-root="merits"/);
assert.match(source, /data-module-root="dollarBazaars"/);
assert.match(source, /\/v2\/market\/\$\{encodeURIComponent\(watch\.itemId\)\}\/itemmarket\?limit=5/);
assert.match(source, /\/api\/marketplace\/\$\{encodeURIComponent\(target\.itemId\)\}/);
assert.match(source, /\/api\/marketplace`/);
assert.match(source, /\/api\/pricelist\/\$\{encodeURIComponent\(userId\)\}/);
assert.match(source, /function pollMarketWeaverTargets/);
assert.match(source, /function weaverDollarBazaarItems/);
assert.match(source, /function refreshDollarBazaars/);
assert.match(source, /\/api\/dollar-bazaars\/bazaars\?page=1&limit=\$\{DOLLAR_BAZAAR_LIMIT\}/);
assert.match(source, /totalMarketValue/);
assert.match(source, /function sellerBazaarUrl/);
assert.match(source, /DOLLAR_BAZAAR_REFRESH_MS = 60 \* 60_000/);
assert.match(source, /data-action="refresh-dollar-bazaars"/);
assert.match(source, /No page scraping and no Torn API usage/);
assert.match(source, /data-field="market-weaver-pricelist"/);
assert.match(source, /data-field="market-weaver-source-order"/);
assert.match(source, /data-action="sync-market-weaver-pricelist"/);
assert.match(source, /selections=pointsmarket/);
assert.match(source, /cacheTimestamp \* 1_000 \+ cacheDelayMs \+ 1_000/);
assert.match(source, /TORN_PRIORITY_LIMITS = Object\.freeze\(\{ high:60, normal:50, low:40 \}\)/);
assert.match(source, /MARKET_TIERS = Object\.freeze\(\[5, 10, 15, 20, 25, 30, 35, 40\]\)/);
assert.match(source, /MARKET_SUGGESTION_LIMIT = 10/);
assert.match(source, /data-market-item-suggestions/);
assert.match(source, /bottom:calc\(100% \+ 6px\)/);
assert.doesNotMatch(source, /<datalist\b/);
assert.match(source, /captureMarketDraft/);
assert.match(source, /renderMarketUnlessEditing/);
assert.match(source, /renderPending:false/);
assert.match(source, /data-keyboard-open/);
assert.match(source, /keyboardEditable/);
assert.match(source, /guardUnexpectedBottomJump/);
assert.match(source, /keepFocusedFieldVisible/);
assert.match(source, /overflow-anchor:none/);
assert.match(source, /visibility:hidden;pointer-events:none/);
assert.match(source, /\.overlay input[^\n]+font-size:16px/);
assert.match(source, /\.scroll\{padding:8px[^\n]+58px/);
assert.doesNotMatch(source, /data-keyboard-open[^\n]+\.subnav\{display:none/);
assert.doesNotMatch(source, /API only: Torn Item\/Points Market/);
assert.match(source, /refreshPermissions:true/);
assert.match(source, /ensurePermissionSession\(refreshPermissions\)/);
assert.match(source, /marketwatch tier \(\.5 through \.40\)/);
assert.match(source, /data-action="refresh-market-permissions"/);
assert.match(source, /function refreshMarketPermissions/);
assert.match(source, /data-action="dismiss-market-deal"/);
assert.match(source, /data-action="send-market-deal"/);
assert.match(source, /data-tdd-quick-buy/);
assert.match(source, /data-tdd-item-market-shop-profit/);
assert.match(source, /data-tdd-bazaar-shop-profit/);
assert.match(source, /data-tdd-item-market-one-dollar/);
assert.match(source, /data-tdd-bazaar-one-dollar/);
assert.match(source, /price < sellPrice/);
assert.match(source, /native\.click\(\)/);
assert.match(source, /href:deal\.href/);
assert.match(source, /onclick:\(\) => openAlertDestination\(href\)/);
assert.match(source, /alert\.links\?\.\[0\]\?\.\[1\]/);
assert.match(source, /\^You mugged \(\.\+\?\) and stole \\\$\(\[\\d,\]\+\)\$/);
assert.match(source, /torn_attack_result_dom/);
assert.match(source, /data-action="copy-war-mug-report"/);
assert.match(source, /scanAttackMugResults/);
assert.match(source, /data-war-tab="\$\{name\}"/);
assert.match(source, /\['targets', 'outside', 'claims'/);
assert.match(source, /armoryOfficer \? \['armory'\] : \[\]/);
assert.match(source, /officer \? \['logs', 'settings'\] : \[\]/);
assert.match(source, /data-action="refresh-war-outside"/);
assert.match(source, /api\/v1\/get-targets/);
assert.match(source, /data-action="claim-war-target"/);
assert.match(source, /\/claims`/);
assert.match(source, /data-action="dismiss-war-retal"/);
assert.match(source, /data-action="send-war-retal"/);
assert.match(source, /data-action="resolve-war-armory-request"/);
assert.match(source, /\/item-requests`/);
assert.match(source, /data-action="save-war-settings"/);
assert.match(source, /\/config`/);
assert.match(source, /\/logs\?limit=200&include_stored=1/);
assert.match(source, /data-action="retrieve-war-armory"/);
assert.match(source, /data-action="toggle-war-armory-rank"/);
assert.match(source, /Search name, rank, or ID/);
assert.match(source, /warArmoryEligible/);
assert.match(source, /\/heartbeat`/);
assert.match(source, /\/status`/);
assert.match(source, /\/attacks`/);
assert.match(source, /function warInsideGate/);
assert.match(source, /data-action="war-inside-attack"/);
assert.match(source, /\[\[0, 100\], \[200, 250\], \[450, 500\]/);
assert.match(source, /moduleState\.war\.renderPending/);
assert.match(source, /root\.contains\(shadow\?\.activeElement\)/);
assert.doesNotMatch(source, /members\.slice\(0, 30\)/);
assert.doesNotMatch(source, /requestJson\([^\n]*(?:bazaar\.php|ItemMarket)/);
assert.match(source, /page\.php\?sid=attack&user2ID=/);
assert.doesNotMatch(source, /loader2?\.php/i);
assert.doesNotMatch(source, /location\.(?:reload|replace|assign)\s*\(/);
assert.doesNotMatch(source, /history\.(?:go|back|forward)\s*\(/);
assert.doesNotMatch(source, /chrome\.(?:runtime|storage|alarms)/);
assert.match(preview, /SLINK_PDA_Dashboard\.user\.js/);

// Exercise the real open/close functions for every saved minimize mode. The
// previous launcher.hidden=false assertion would incorrectly reject chat mode.
for (const mode of ['bubble','bar','chat']) {
  const calls=[];
  const launcher={hidden:false,setAttribute:() => {},querySelector:() => ({textContent:''}),focus:() => calls.push('launcher-focus')};
  const context=vm.createContext({
    dashboardOpen:false,overlay:{hidden:true},launcher,
    state:{page:'efficiency',minimizedMode:mode},host:{removeAttribute:() => {}},
    pdaChatButton:{focus:() => calls.push('chat-focus')},
    shadow:{querySelector:() => ({focus:() => calls.push('close-focus')})},
    moduleState:{alerts:{data:{}}},dataState:{caches:{}},
    syncPdaChatButtonVisibility:() => calls.push('sync-chat'),
    lockTornScroll:() => calls.push('lock'),unlockTornScroll:() => calls.push('unlock'),
    selectPage:(page,persist) => calls.push(['page',page,persist]),
    renderAllModules:() => calls.push('render'),loadActiveModule:async () => calls.push('load'),
    alertRows:() => [{id:'test'}],updateAlertIndicator:count => calls.push(['count',count]),
    clampLauncher:() => calls.push('clamp'),global:{setTimeout:callback => callback()}
  });
  vm.runInContext(extractFunction('openDashboard')+'\n'+extractFunction('closeDashboard'),context);
  context.openDashboard();
  assert.equal(context.dashboardOpen,true);
  assert.equal(context.overlay.hidden,false);
  assert.equal(launcher.hidden,true);
  assert(calls.some(row => Array.isArray(row)&&row[0]==='page'&&row[1]==='efficiency'&&row[2]===false),'Opening must restore, not reset or overwrite the saved page');
  context.closeDashboard();
  assert.equal(context.dashboardOpen,false);
  assert.equal(context.overlay.hidden,true);
  assert.equal(launcher.hidden,mode==='chat');
  assert(calls.includes(mode==='chat'?'chat-focus':'launcher-focus'));
  assert(calls.includes('unlock'));
  assert(calls.some(row => Array.isArray(row)&&row[0]==='count'&&row[1]===1));
  assert.equal(context.state.page,'efficiency');
}
const roles=vm.createContext({hasScope:scope => roles.grants.has(scope),grants:new Set()});
vm.runInContext(extractFunction('warOfficer')+'\n'+extractFunction('warArmoryOfficer'),roles);
for (const scope of ['slink.war.officer','slink.officer.armory','admin.*']) {
  roles.grants=new Set([scope]);
  assert.equal(roles.warArmoryOfficer(),true);
  assert.equal(roles.warOfficer(),scope!=='slink.officer.armory','Armory-only scope must not grant War settings/log access');
}
roles.grants=new Set();
assert.equal(roles.warArmoryOfficer(),false);

console.log('SLINK PDA overlay static safety and recovery checks passed.');

