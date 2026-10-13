(function installMoneyPropertyPda(global) {
'use strict';
const api = global.SLINK_PDA_PLUGIN_API;
if (!api) throw new Error('SLINK PDA plugin API is unavailable.');
const ID = 'moneyProperty';
const SCOPE = 'slink.qol.money-property';
const CACHE_MS = 15 * 60_000;
const CATALOG_MS = 7 * 86_400_000;
const URLS = Object.freeze({
bank:'https://www.torn.com/city.php#/p=bank',
loan:'https://www.torn.com/loan.php',
property:'https://www.torn.com/properties.php',
stocks:'https://www.torn.com/page.php?sid=stocks',
items:'https://www.torn.com/item.php'
});
const defaults = Object.freeze({
enabled:true, bankLeadHours:2, rentalLeadDays:3, cashierLeadHours:24,
upkeepThreshold:1000000, loanReminder:true, soundEnabled:false, stockAlerts:{}
});
let busy = false;
let error = '';

function finite(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function integer(value) { const parsed = finite(value); return parsed === null ? 0 : Math.max(0, Math.trunc(parsed)); }
function rows(value) { return Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []; }
function firstFinite(...values) { for (const value of values) { const parsed = finite(value); if (parsed !== null) return parsed; } return null; }
function timestampMs(value) {
const parsed = finite(value);
if (parsed === null || parsed <= 0) return 0;
return parsed < 10000000000 ? Math.trunc(parsed * 1000) : Math.trunc(parsed);
}
function money(value) { return '$' + integer(value).toLocaleString(); }
function duration(ms) {
if (!Number.isFinite(ms)) return 'unknown';
if (ms <= 0) return 'now';
const hours = Math.ceil(ms / 3600000);
if (hours < 48) return hours + 'h';
return Math.ceil(hours / 24) + 'd';
}
function textAmount(value) {
const match = String(value || '').replace(/,/g, '').match(/\$?([\d.]+)\s*([kmbt])?/i);
if (!match) return 0;
return Math.max(0, Number(match[1]) * ({k:1e3,m:1e6,b:1e9,t:1e12}[String(match[2] || '').toLowerCase()] || 1)) || 0;
}
function daysFromFrequency(value, description = '') {
const parsed = finite(value);
if (parsed !== null && parsed > 0) return parsed > 366 ? parsed / 86400 : parsed;
const text = String(description || '').toLowerCase();
const match = text.match(/every\s+(\d+(?:\.\d+)?)\s*(day|week|month|year)/);
if (match) return Number(match[1]) * ({day:1,week:7,month:30.4375,year:365}[match[2]] || 1);
if (/daily|each day/.test(text)) return 1;
if (/weekly|each week/.test(text)) return 7;
if (/monthly|each month/.test(text)) return 30.4375;
return 0;
}
function settings() {
const value = api.settings(ID, defaults);
const bounded = (key, fallback, min, max) => {
const parsed = Number(value[key]);
return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
value.enabled = value.enabled !== false;
value.bankLeadHours = bounded('bankLeadHours', 2, 0, 168);
value.rentalLeadDays = bounded('rentalLeadDays', 3, 0, 30);
value.cashierLeadHours = bounded('cashierLeadHours', 24, 0, 168);
value.upkeepThreshold = Math.max(0, integer(value.upkeepThreshold ?? 1000000));
value.loanReminder = value.loanReminder !== false;
value.soundEnabled = value.soundEnabled === true;
value.stockAlerts = value.stockAlerts && typeof value.stockAlerts === 'object' ? value.stockAlerts : {};
return value;
}
function cache() { return api.cache(ID, {fetchedAt:0,status:null,itemCatalogAt:0,itemCatalog:[]}); }
function normalizeBank(moneyData = {}, now = Date.now()) {
const raw = moneyData.city_bank || moneyData.cityBank || moneyData.bank || {};
const amount = integer(raw.amount ?? raw.invested ?? raw.balance);
const timeLeft = firstFinite(raw.time_left, raw.timeLeft, raw.seconds_remaining, raw.remaining);
const maturedAt = timestampMs(raw.matures_at ?? raw.maturity ?? raw.end_time ?? raw.ends_at) || (timeLeft !== null ? now + Math.max(0,timeLeft) * 1000 : 0);
return {amount, interest:integer(raw.interest ?? raw.profit ?? raw.return_amount), maturedAt, matured:amount > 0 && ((timeLeft !== null && timeLeft <= 0) || (maturedAt > 0 && maturedAt <= now))};
}
function normalizeChecks(moneyData = {}, now = Date.now()) {
return rows(moneyData.cashier_checks || moneyData.cashiers_checks || moneyData.cashierChecks || moneyData.checks).map((entry,index) => {
const expiresAt = timestampMs(entry?.expires_at ?? entry?.expiration ?? entry?.valid_until ?? entry?.end_time);
return {id:String(entry?.id ?? index),amount:integer(entry?.amount ?? entry?.value),expiresAt,expired:expiresAt > 0 && expiresAt <= now};
}).filter(entry => entry.amount > 0 || entry.expiresAt > 0);
}
function normalizeProperties(payload = {}, now = Date.now()) {
return rows(payload.properties ?? payload).map((entry,index) => {
const rental = entry?.rental || entry?.rented || {};
const lease = entry?.lease_extension ?? entry?.leaseExtension ?? null;
const daysLeft = firstFinite(rental?.days_left,rental?.daysLeft,entry?.days_left);
const rentalEndsAt = timestampMs(rental?.expires_at ?? rental?.end_date ?? rental?.until ?? entry?.rental_ends_at) || (daysLeft !== null ? now + Math.max(0,daysLeft) * 86400000 : 0);
return {
id:integer(entry?.id ?? entry?.property_id) || index + 1,
name:String(entry?.property?.name ?? entry?.name ?? entry?.property ?? 'Property'),
status:String(entry?.status || ''),
current:entry?.current === true || entry?.active === true || /rented|occupied/i.test(String(entry?.status || '')),
rentalEndsAt,
upkeepPerDay:integer(entry?.upkeep ?? entry?.upkeep_per_day),
upkeepOwed:integer(entry?.upkeep_owed ?? entry?.upkeep_due ?? entry?.owed?.upkeep),
leaseExtension:lease && typeof lease === 'object' ? {status:String(lease.status || 'pending').toLowerCase(),cost:integer(lease.cost),period:integer(lease.period)} : null
};
});
}
function achievementNames(user = {}) {
return [...rows(user.honors),...rows(user.medals),...rows(user.merits),...rows(user.achievements)]
.map(entry => String(entry?.name ?? entry?.title ?? entry?.description ?? '')).filter(Boolean);
}
function benefitValue(benefit = {}, itemCatalog = []) {
const description = String(benefit.description || benefit.name || '');
const direct = firstFinite(benefit.value,benefit.cash,benefit.payout,benefit.reward?.value);
if (direct !== null && direct > 0) return direct;
const cashMatch = description.match(/\$[\d,.]+\s*[kmbt]?/i);
if (cashMatch) return textAmount(cashMatch[0]);
const item = benefit.item || benefit.reward?.item || {};
const itemId = integer(item.id ?? benefit.item_id);
const itemName = String(item.name ?? benefit.item_name ?? '');
const quantity = Math.max(1,integer(item.amount ?? benefit.quantity ?? benefit.amount) || 1);
const match = rows(itemCatalog).find(row => (itemId && integer(row?.id) === itemId) || (itemName && String(row?.name || '').toLowerCase() === itemName.toLowerCase()));
return quantity * Math.max(0,firstFinite(match?.marketPrice,match?.market_value,match?.marketValue) || 0);
}
function stockRows(userStocks = {}, tornStocks = {}, itemCatalog = [], availableCash = 0) {
const owned = new Map(rows(userStocks.stocks ?? userStocks).map(entry => [integer(entry?.id ?? entry?.stock_id),integer(entry?.shares ?? entry?.total_shares ?? entry?.amount)]).filter(([id]) => id));
return rows(tornStocks.stocks ?? tornStocks).flatMap(stock => {
const id = integer(stock?.id ?? stock?.stock_id);
const price = Math.max(0,firstFinite(stock?.current_price,stock?.currentPrice,stock?.price) || 0);
const definitions = Array.isArray(stock?.benefits) ? stock.benefits.map(entry => ({...entry,repeatable:false})) : Array.isArray(stock?.bonus?.tiers) ? stock.bonus.tiers.map(entry => ({...entry,repeatable:false})) : stock?.bonus && typeof stock.bonus === 'object' ? [{...stock.bonus,repeatable:true}] : [];
if (!id || !price || !definitions.length) return [];
const sharesOwned = owned.get(id) || 0;
const tiers = definitions.map(benefit => ({benefit,requirement:integer(benefit.requirement ?? benefit.shares_required ?? benefit.shares ?? benefit.minimum_shares)})).filter(entry => entry.requirement > 0).sort((a,b) => a.requirement-b.requirement);
if (!tiers.length) return [];
let next = tiers.find(entry => entry.requirement > sharesOwned);
let threshold = next?.requirement || 0;
if (!next) {
const base = tiers[tiers.length-1];
if (!base.benefit.repeatable) return [];
next = base;
threshold = base.requirement * (Math.floor(sharesOwned/base.requirement)+1);
}
const sharesNeeded = Math.max(0,threshold-sharesOwned);
const incrementalCost = Math.ceil(sharesNeeded*price);
const blockCost = Math.ceil(threshold*price);
const value = benefitValue(next.benefit,itemCatalog);
const days = daysFromFrequency(next.benefit.frequency ?? next.benefit.interval,next.benefit.description);
const weeklyValue = value > 0 && days > 0 ? value*7/days : 0;
const monthlyValue = value > 0 && days > 0 ? value*30.4375/days : 0;
return [{id,name:String(stock.name || stock.acronym || ''),acronym:String(stock.acronym || ''),sharesOwned,nextThreshold:threshold,sharesNeeded,incrementalCost,blockCost,affordable:incrementalCost > 0 && availableCash >= incrementalCost,benefitDescription:String(next.benefit.description || next.benefit.name || 'Benefit value unavailable'),weeklyValue,monthlyValue,weeklyRoi:blockCost ? weeklyValue/blockCost : 0,monthlyRoi:blockCost ? monthlyValue/blockCost : 0,alertKey:id+':'+threshold}];
}).sort((a,b) => b.monthlyRoi-a.monthlyRoi || a.incrementalCost-b.incrementalCost);
}
function buildStatus(input = {}, now = Date.now()) {
const user = input.user || {};
const moneyData = user.money || user;
const cashOnHand = integer(moneyData.cash ?? moneyData.money_onhand ?? moneyData.moneyOnHand);
const factionCash = integer(moneyData.faction?.money ?? moneyData.faction_money ?? moneyData.armory?.money);
const vaultCash = integer(moneyData.vault?.amount ?? moneyData.vault);
const properties = normalizeProperties(user.properties || {},now);
const names = achievementNames(user);
const loanRaw = moneyData.duke_loan ?? moneyData.dukeLoan ?? moneyData.loan ?? moneyData.duke ?? {};
const loan = typeof loanRaw === 'number' ? {amount:integer(loanRaw),dueAt:0} : {amount:integer(loanRaw?.amount ?? loanRaw?.balance ?? loanRaw?.owed ?? loanRaw?.debt),dueAt:timestampMs(loanRaw?.due_at ?? loanRaw?.expires_at ?? loanRaw?.end_time)};
const availableCash = cashOnHand+factionCash;
return {at:now,money:{cashOnHand,factionCash,vaultCash,availableCash},bank:normalizeBank(moneyData,now),cashierChecks:normalizeChecks(moneyData,now),properties,currentProperty:properties.find(entry=>entry.current)||properties[0]||null,loan,loanSharkEarned:names.length?names.some(name=>/loan shark/i.test(name)):null,stocks:stockRows(user.stocks || {},input.tornStocks || {},input.itemCatalog || [],availableCash)};
}
function buildAlerts(status = {}, now = Date.now()) {
const config = settings();
if (!config.enabled) return [];
const result = [];
const push = (id,title,detail,links) => result.push({id:'money-property:'+id,title,detail,links});
const bank = status.bank || {};
if (bank.matured) push('bank-matured','Bank investment is ready','Your completed bank investment is still waiting to be collected.',[['Bank',URLS.bank]]);
else if (bank.amount > 0 && bank.maturedAt > now && bank.maturedAt-now <= config.bankLeadHours*3600000) push('bank-soon','Bank investment matures soon','Your bank investment is approaching maturity.',[['Bank',URLS.bank]]);
for (const check of status.cashierChecks || []) {
if (!check.expiresAt || check.expiresAt-now > config.cashierLeadHours*3600000) continue;
push('cashier:'+check.id,check.expired?'Cashier check expired':'Cashier check expires soon',(check.amount?money(check.amount)+' · ':'')+(check.expired?'Review it now.':'Collect or use it before it expires.'),[['Items',URLS.items]]);
}
const property = status.currentProperty;
if (property?.rentalEndsAt && property.rentalEndsAt-now <= config.rentalLeadDays*86400000) push('rental',property.rentalEndsAt<=now?'Property rental expired':'Property rental expires soon',property.name,[['Property',URLS.property]]);
if (property?.upkeepOwed >= config.upkeepThreshold && config.upkeepThreshold > 0) push('upkeep','Property upkeep needs attention',money(property.upkeepOwed)+' is currently owed.',[['Property',URLS.property]]);
if (property?.leaseExtension && !['accepted','declined'].includes(property.leaseExtension.status)) push('lease-extension','Rental extension offer waiting',property.name+' has a pending lease-extension offer.',[['Property',URLS.property]]);
if (status.loan?.amount > 0) push('duke-loan','Duke loan is outstanding',money(status.loan.amount)+' is currently owed.',[['Duke',URLS.loan]]);
else if (config.loanReminder && status.loanSharkEarned === false) push('loan-shark','Loan Shark merit is still available','You have no Duke loan and have not earned Loan Shark yet.',[['Duke',URLS.loan]]);
for (const stock of status.stocks || []) if (config.stockAlerts[stock.alertKey] === true && stock.affordable) push('stock:'+stock.alertKey,(stock.acronym||stock.name)+' next benefit is affordable','Cash on hand plus faction armory cash can cover '+money(stock.incrementalCost)+'.',[['Stocks',URLS.stocks]]);
return result;
}
function summaryCard(label,value,detail='') { return '<article class="card"><span class="muted">'+api.escapeHtml(label)+'</span><h2>'+api.escapeHtml(value)+'</h2>'+(detail?'<p>'+api.escapeHtml(detail)+'</p>':'')+'</article>'; }
function render() {
const root = api.root(ID);
if (!root) return;
if (!api.hasScope(SCOPE)) { root.innerHTML = api.lockedModule(SCOPE,'Money & Property'); return; }
const current = cache();
const status = current.status;
const config = settings();
if (!status) {
root.innerHTML = '<div class="grid"><article class="card wide"><div class="card-head"><div><h2>Money &amp; Property</h2><span class="muted">Bank, property, loan, cashier-check and stock-benefit reminders.</span></div><button type="button" data-mp-action="refresh">'+(busy?'Checking…':'Refresh')+'</button></div>'+(error?api.moduleMessage(error,'error'):'')+'<p>Refresh to load your current Torn financial snapshot.</p></article></div>';
bind(root); return;
}
const property = status.currentProperty;
const stockRowsHtml = status.stocks.length ? status.stocks.map(stock => {
const checked = config.stockAlerts[stock.alertKey] === true ? ' checked' : '';
return '<tr><td><strong>'+api.escapeHtml(stock.acronym||stock.name)+'</strong><br><span class="muted">'+api.escapeHtml(stock.benefitDescription)+'</span></td><td>'+money(stock.incrementalCost)+'<br><span class="muted">'+stock.sharesNeeded.toLocaleString()+' shares</span></td><td>'+money(Math.round(stock.weeklyValue))+' / wk<br><span class="muted">'+money(Math.round(stock.monthlyValue))+' / mo</span></td><td>'+((stock.monthlyRoi*100).toFixed(3))+'%</td><td><label><input type="checkbox" data-mp-stock="'+api.escapeHtml(stock.alertKey)+'"'+checked+'> Alert</label></td></tr>';
}).join('') : '<tr><td colspan="5">No next stock-benefit tiers were returned.</td></tr>';
root.innerHTML = '<div class="grid"><article class="card wide"><div class="card-head"><div><h2>Money &amp; Property</h2><span class="muted">Updated '+api.relativeTime(status.at)+' · cached for 15 minutes</span></div><button type="button" data-mp-action="refresh">'+(busy?'Checking…':'Refresh')+'</button></div>'+(error?api.moduleMessage(error,'error'):'')+'<label class="check-row"><input type="checkbox" data-mp-setting="enabled"'+(config.enabled?' checked':'')+'> Enable Money &amp; Property reminders</label></article>'+
summaryCard('Cash on hand',money(status.money.cashOnHand),'Personal cash')+
summaryCard('Faction armory cash',money(status.money.factionCash),'Included for affordability alerts')+
summaryCard('Available for stocks',money(status.money.availableCash),'Cash + faction armory')+
summaryCard('Property',property?.name||'Unavailable',property?.rentalEndsAt?'Rental ends in '+duration(property.rentalEndsAt-Date.now()):'No rental timer returned')+
'<article class="card wide"><h2>Reminder settings</h2><div class="form-grid"><label>Bank lead hours<input type="number" min="0" max="168" data-mp-setting="bankLeadHours" value="'+config.bankLeadHours+'"></label><label>Rental lead days<input type="number" min="0" max="30" data-mp-setting="rentalLeadDays" value="'+config.rentalLeadDays+'"></label><label>Cashier-check lead hours<input type="number" min="0" max="168" data-mp-setting="cashierLeadHours" value="'+config.cashierLeadHours+'"></label><label>Upkeep alert threshold<input type="number" min="0" step="1000" data-mp-setting="upkeepThreshold" value="'+config.upkeepThreshold+'"></label></div><label class="check-row"><input type="checkbox" data-mp-setting="loanReminder"'+(config.loanReminder?' checked':'')+'> Remind me to pursue Loan Shark when the achievement state is available</label><label class="check-row"><input type="checkbox" data-mp-setting="soundEnabled"'+(config.soundEnabled?' checked':'')+'> Play sounds for Money &amp; Property alerts</label></article>'+
'<article class="card wide"><div class="card-head"><div><h2>Financial status</h2><span class="muted">Only fields actually returned by Torn are shown.</span></div></div><p><strong>Bank:</strong> '+(status.bank.amount?money(status.bank.amount)+(status.bank.matured?' · ready to collect':status.bank.maturedAt?' · '+duration(status.bank.maturedAt-Date.now())+' remaining':''):'No active investment returned')+'</p><p><strong>Duke:</strong> '+(status.loan.amount?money(status.loan.amount)+' owed':'No balance returned')+'</p><p><strong>Upkeep owed:</strong> '+(property?money(property.upkeepOwed):'Unavailable')+'</p><p><strong>Cashier checks:</strong> '+status.cashierChecks.length+'</p><div class="target-actions">'+api.actionLink('Open Bank',URLS.bank)+api.actionLink('Open Property',URLS.property)+api.actionLink('Open Duke',URLS.loan)+'</div></article>'+
'<article class="card full"><div class="card-head"><div><h2>Stock benefit planner</h2><span class="muted">Sorted by estimated monthly return on the full next benefit block.</span></div>'+api.actionLink('Open Stocks',URLS.stocks)+'</div><div class="table-wrap"><table><thead><tr><th>Stock / benefit</th><th>Cost to next tier</th><th>Estimated value</th><th>Monthly ROI</th><th>Reminder</th></tr></thead><tbody>'+stockRowsHtml+'</tbody></table></div></article></div>';
bind(root);
}
function bind(root) {
if (root.dataset.moneyPropertyBound === 'true') return;
root.dataset.moneyPropertyBound = 'true';
root.addEventListener('click', event => {
const button = event.target.closest('[data-mp-action="refresh"]');
if (button) void refresh(true);
});
root.addEventListener('change', event => {
const target = event.target;
const config = settings();
if (target.matches('[data-mp-setting]')) {
const key = target.dataset.mpSetting;
config[key] = target.type === 'checkbox' ? target.checked : Number(target.value);
}
if (target.matches('[data-mp-stock]')) config.stockAlerts[target.dataset.mpStock] = target.checked;
api.save();
api.alertsChanged();
});
}
async function refresh(force = false) {
const current = cache();
if (busy) return current.status;
if (!force && current.status && Date.now()-Number(current.fetchedAt||0)<CACHE_MS) { render(); return current.status; }
busy = true; error = ''; render();
try {
await api.ensurePermission(false);
if (!api.hasScope(SCOPE)) throw new Error('Your SLINK account does not have '+SCOPE+' permission.');
const [user,tornStocks] = await Promise.all([
api.tornJson('/v2/user?selections=money,properties,stocks,honors,medals,merits','SLINK PDA Money and Property'),
api.tornJson('/v2/torn/stocks','SLINK PDA stock benefit catalog')
]);
if (!current.itemCatalogAt || Date.now()-current.itemCatalogAt>=CATALOG_MS) {
const catalogBody = await api.tornJson('/v2/torn/items?cat=All&sort=ASC','SLINK PDA Money and Property item values');
current.itemCatalog = api.catalogItems(catalogBody);
current.itemCatalogAt = Date.now();
}
current.status = buildStatus({user,tornStocks,itemCatalog:current.itemCatalog || []});
current.fetchedAt = Date.now();
api.save();
api.alertsChanged();
return current.status;
} catch (caught) {
error = api.errorMessage(caught);
throw caught;
} finally { busy = false; render(); }
}
function alerts() {
const status = cache().status;
return status ? buildAlerts(status) : [];
}
function start() {
if (api.hasScope(SCOPE)) void refresh(false).catch(() => undefined);
global.setInterval(() => {
if (api.hasScope(SCOPE) && Date.now()-Number(cache().fetchedAt||0)>=CACHE_MS) void refresh(false).catch(() => undefined);
},60000);
}
api.register({id:ID,title:'Money & Property',shortTitle:'Money',scope:SCOPE,render,refresh,alerts,start,test:Object.freeze({buildStatus,buildAlerts})});
})(globalThis);
