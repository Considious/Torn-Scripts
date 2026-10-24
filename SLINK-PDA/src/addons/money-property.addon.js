(function installMoneyPropertyPda(global) {
'use strict';
const api = global.SLINK_PDA_PLUGIN_API;
if (!api) throw new Error('SLINK PDA plugin API is unavailable.');
const ID = 'moneyProperty';
const SCOPE = 'slink.qol.money-property';
const CACHE_MS = 15 * 60_000;
const CATALOG_MS = 7 * 86_400_000;

const BANK_RATE_CACHE_MS = 60 * 60_000;
const BANK_AMOUNT_LIMIT = 2_000_000_000;
const BANK_TERMS = Object.freeze([{days:7,label:'1 week'},{days:14,label:'2 weeks'},{days:30,label:'1 month'},{days:60,label:'2 months'},{days:90,label:'3 months'}]);
function bankMeritLevel(userMerits, meritCatalog) {
  const merits=userMerits?.merits ?? userMerits;
  if(!merits || typeof merits!=='object')return null;
  const named=Object.entries(merits).find(([name])=>/bank[ _-]*interest|nothing for nothing/i.test(name));
  if(named){const n=Number(named[1]?.level ?? named[1]);return Number.isFinite(n)?Math.max(0,Math.min(10,n)):null;}
  const upgrades=Array.isArray(merits.upgrades)?merits.upgrades:Array.isArray(merits)?merits:null;
  if(!upgrades)return null;
  const definitions=Array.isArray(meritCatalog?.merits)?meritCatalog.merits:[];
  const definition=definitions.find(row=>/bank.*interest|nothing for nothing/i.test(String(row.name||'')+' '+String(row.description||'')));
  const entry=upgrades.find(row=>/bank.*interest|nothing for nothing/i.test(String(row.name||'')) || (definition && Number(row.id)===Number(definition.id)));
  if(!entry)return definition?0:null;
  const level=Number(entry.level);
  return Number.isFinite(level)?Math.max(0,Math.min(10,level)):null;
}
function bankStockBonus(userStocks, tornStocks) {
  const catalog=Array.isArray(tornStocks?.stocks)?tornStocks.stocks:Object.values(tornStocks?.stocks||{});
  const definition=catalog.find(stock=>/^(TCI|TCB)$/i.test(stock.acronym||'') || /bank.*interest/i.test(stock.bonus?.description||''));
  if(!definition || !Array.isArray(userStocks?.stocks))return {active:null,label:'Bank stock benefit unavailable'};
  const holding=userStocks.stocks.find(stock=>Number(stock.id)===Number(definition.id));
  const label=String(definition.acronym||'TCI');
  if(!holding)return {active:false,label:label+' not owned'};
  const required=Number(definition.bonus?.requirement);
  const shares=Number(holding.shares ?? holding.total_shares);
  if(Number.isFinite(required) && Number.isFinite(shares) && shares<required)return {active:false,label:label+' below benefit threshold'};
  if(typeof holding.bonus?.available==='boolean')return {active:holding.bonus.available,label:label+(holding.bonus.available?' active · +10% interest':' held · benefit not active yet')};
  return {active:null,label:label+' benefit activation unavailable'};
}
function bankRateRows(body) {
  const bank=body?.bank;
  if(!Array.isArray(bank))return [];
  return bank.filter(row=>BANK_TERMS.some(term=>term.days===Number(row.days)) && row.rate!==null && row.rate!=='' && Number.isFinite(Number(row.rate)) && Number(row.rate)>=0)
    .map(row=>({days:Number(row.days),baseApr:Number(row.rate)}));
}
function bankComparison(input, amount) {
  const principal=Number(amount);
  if(!Number.isFinite(principal)||principal<0||principal>BANK_AMOUNT_LIMIT)return {error:'Enter an amount from $0 to $2,000,000,000.',rows:[]};
  const meritLevel=bankMeritLevel(input?.userMerits,input?.meritCatalog);
  const stock=bankStockBonus(input?.userStocks,input?.tornStocks);
  if(meritLevel===null||stock.active===null)return {error:'Your bank interest bonuses could not be verified. Refresh to load your merits and stock benefit.',rows:[],meritLevel,stock};
  const multiplier=(1+meritLevel*.05)*(stock.active?1.1:1);
  const rates=bankRateRows(input?.rates);
  const comparisons=BANK_TERMS.map(term=>{
    const rate=rates.find(row=>row.days===term.days);
    if(!rate)return {...term,available:false};
    // Torn's rate is the base APR for THIS term, expressed as a percent.
    // Use each term independently; 30/60/90 days are Torn's fixed month terms.
    const effectiveApr=rate.baseApr*multiplier;
    const roi=effectiveApr/100*term.days/365;
    const profit=Math.floor(principal*roi);
    return {...term,available:true,baseApr:rate.baseApr,effectiveApr,roi,profit,total:principal+profit,perDay:profit/term.days,dailyRoi:roi/term.days};
  });
  const best=comparisons.filter(row=>row.available).sort((a,b)=>b.dailyRoi-a.dailyRoi||a.days-b.days)[0]?.days ?? null;
  return {amount:principal,meritLevel,stock,rows:comparisons,best,error:rates.length?'':'Bank rates are unavailable. Refresh to try again.'};
}
const URLS = Object.freeze({
bank:'https://www.torn.com/city.php#/p=bank',
loan:'https://www.torn.com/loan.php',
property:'https://www.torn.com/properties.php',
stocks:'https://www.torn.com/page.php?sid=stocks',
items:'https://www.torn.com/item.php'
});
const defaults = Object.freeze({
enabled:true, bankLeadHours:2, rentalLeadDays:3, cashierLeadHours:24,
upkeepThreshold:1000000, loanReminder:true, soundEnabled:false, stockAlerts:{}, bankAmount:2000000000
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
function money(value) {
const amount=integer(value);
if(amount<1000000)return '$'+amount.toLocaleString();
const units=[[1e12,'T'],[1e9,'B'],[1e6,'M']],unit=units.find(([scale])=>amount>=scale),scaled=amount/unit[0],digits=scaled>=100?0:scaled>=10?1:2;
return '$'+scaled.toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0+$/,'')+unit[1];
}
function exactMoney(value){return '$'+integer(value).toLocaleString()}
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
function cadenceLabel(days) {
const value=Number(days);
if(!Number.isFinite(value)||value<=0)return'Cadence unavailable';
if(Math.abs(value-1)<0.01)return'Every day';
if(Math.abs(value-7)<0.01)return'Every week';
if(Math.abs(value-14)<0.01)return'Every 2 weeks';
if(Math.abs(value-30.4375)<0.1)return'Every month';
return'Every '+Number(value.toFixed(1))+' days';
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
function cache() {
const value=api.cache(ID,{schema:2,fetchedAt:0,status:null,itemCatalogAt:0,itemCatalog:[]});
if(value.schema!==2){value.schema=2;value.fetchedAt=0;value.status=null;value.itemCatalogAt=0;value.itemCatalog=[]}
return value;
}
function normalizeBank(moneyData = {}, now = Date.now()) {
const raw = moneyData.city_bank || moneyData.cityBank || moneyData.bank || {};
const amount = integer(raw.amount ?? raw.invested ?? raw.balance);
const timeLeft = firstFinite(raw.time_left, raw.timeLeft, raw.seconds_remaining, raw.remaining);
const maturedAt = timestampMs(raw.until ?? raw.matures_at ?? raw.maturity ?? raw.end_time ?? raw.ends_at) || (timeLeft !== null ? now + Math.max(0,timeLeft) * 1000 : 0);
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
const daysLeft = firstFinite(rental?.days_left,rental?.daysLeft,entry?.days_left,entry?.rental_period_remaining);
const rentalEndsAt = timestampMs(rental?.expires_at ?? rental?.end_date ?? rental?.until ?? entry?.rental_ends_at) || (daysLeft !== null ? now + Math.max(0,daysLeft) * 86400000 : 0);
const status=String(entry?.status||''),upkeep=entry?.upkeep&&typeof entry.upkeep==='object'?entry.upkeep:null;
const upkeepPerDay=upkeep?integer(upkeep.property)+integer(upkeep.staff):integer(entry?.upkeep??entry?.upkeep_per_day);
const upkeepOwedRaw=firstFinite(entry?.upkeep_owed,entry?.upkeep_due,entry?.owed?.upkeep);
const modifications=rows(entry?.modifications).map(value=>String(value||'').trim()).filter(Boolean);
return {
id:integer(entry?.id ?? entry?.property_id) || index + 1,
name:String(entry?.property?.name ?? entry?.name ?? entry?.property ?? 'Property'),
status,
current:entry?.current === true || entry?.active === true || /^(?:in_use|rented|occupied)$/i.test(status),
rentalEndsAt,
upkeepPerDay,
upkeepOwed:upkeepOwedRaw===null?null:integer(upkeepOwedRaw),
modifications,
hasAirstrip:modifications.some(value=>/airstrip/i.test(value)),
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
const catalog=rows(itemCatalog),lowerDescription=description.toLowerCase();
const match=catalog.find(row => (itemId && integer(row?.id) === itemId) || (itemName && String(row?.name || '').toLowerCase() === itemName.toLowerCase()))
||catalog.filter(row=>String(row?.name||'').length>=4&&lowerDescription.includes(String(row.name).toLowerCase())).sort((left,right)=>String(right?.name||'').length-String(left?.name||'').length)[0];
const describedQuantity=Number(description.match(/(?:^|\s)(\d+)\s*(?:x|×)?\s+/i)?.[1])||quantity;
return describedQuantity * Math.max(0,firstFinite(match?.marketPrice,match?.market_value,match?.marketValue) || 0);
}
function stockRows(userStocks = {}, tornStocks = {}, itemCatalog = [], availableCash = 0) {
const owned = new Map(rows(userStocks.stocks ?? userStocks).map(entry => {const id=integer(entry?.id??entry?.stock_id);return[id,{shares:integer(entry?.shares??entry?.total_shares??entry?.amount),bonus:entry?.bonus&&typeof entry.bonus==='object'?{...entry.bonus}:{}}]}).filter(([id]) => id));
return rows(tornStocks.stocks ?? tornStocks).flatMap(stock => {
const id = integer(stock?.id ?? stock?.stock_id);
const price = Math.max(0,firstFinite(stock?.market?.price,stock?.current_price,stock?.currentPrice,stock?.price) || 0);
const definitions = Array.isArray(stock?.benefits) ? stock.benefits.map(entry => ({...entry,repeatable:false})) : Array.isArray(stock?.bonus?.tiers) ? stock.bonus.tiers.map(entry => ({...entry,repeatable:false})) : stock?.bonus && typeof stock.bonus === 'object' ? [{...stock.bonus,repeatable:true}] : [];
if (!id || !price || !definitions.length) return [];
const holding=owned.get(id)||{shares:0,bonus:{}};
const sharesOwned=holding.shares;
const tiers = definitions.map(benefit => ({benefit,requirement:integer(benefit.requirement ?? benefit.shares_required ?? benefit.shares ?? benefit.minimum_shares)})).filter(entry => entry.requirement > 0).sort((a,b) => a.requirement-b.requirement);
if (!tiers.length) return [];
let next = tiers.find(entry => entry.requirement > sharesOwned);
let threshold = next?.requirement || 0;
if (!next) {
const base = tiers[tiers.length-1];
if (!base.benefit.repeatable) return [];
next = base;
threshold = base.requirement * Math.max(1,integer(holding.bonus?.increment)+1,Math.floor(sharesOwned/base.requirement)+1);
}
const sharesNeeded = Math.max(0,threshold-sharesOwned);
const incrementalCost = Math.ceil(sharesNeeded*price);
const blockCost = Math.ceil(threshold*price);
const value = benefitValue(next.benefit,itemCatalog);
const days = daysFromFrequency(next.benefit.frequency ?? next.benefit.interval,next.benefit.description);
if(!(value>0)||!(days>0))return[];
const weeklyValue=value*7/days;
const monthlyValue=value*30.4375/days;
return [{id,name:String(stock.name || stock.acronym || ''),acronym:String(stock.acronym || ''),sharesOwned,nextThreshold:threshold,sharesNeeded,incrementalCost,blockCost,affordable:incrementalCost > 0 && availableCash >= incrementalCost,benefitDescription:String(next.benefit.description || next.benefit.name || 'Income benefit'),payoutValue:value,periodDays:days,cadenceLabel:cadenceLabel(days),weeklyValue,monthlyValue,weeklyRoi:blockCost ? weeklyValue/blockCost : 0,monthlyRoi:blockCost ? monthlyValue/blockCost : 0,alertKey:id+':'+threshold}];
}).sort((a,b) => b.monthlyRoi-a.monthlyRoi || a.incrementalCost-b.incrementalCost);
}
function buildStatus(input = {}, now = Date.now()) {
const user = input.user || {};
const moneyData = user.money || user;
const cashOnHand = integer(moneyData.wallet ?? moneyData.cash ?? moneyData.money_onhand ?? moneyData.moneyOnHand);
const factionCash = integer(moneyData.faction?.money ?? moneyData.faction_money ?? moneyData.armory?.money);
const vaultCash = integer(moneyData.vault?.amount ?? moneyData.vault);
const properties = normalizeProperties(user.properties || {},now);
const currentPropertyPayload=user.currentProperty||input.currentProperty||null;
const currentProperty=currentPropertyPayload?normalizeProperties([currentPropertyPayload.property||currentPropertyPayload],now)[0]||null:null;
const names = achievementNames(user);
const loanRaw = moneyData.duke_loan ?? moneyData.dukeLoan ?? moneyData.loan ?? moneyData.duke ?? {};
const loan = typeof loanRaw === 'number' ? {amount:integer(loanRaw),dueAt:0} : {amount:integer(loanRaw?.amount ?? loanRaw?.balance ?? loanRaw?.owed ?? loanRaw?.debt),dueAt:timestampMs(loanRaw?.due_at ?? loanRaw?.expires_at ?? loanRaw?.end_time)};
const availableCash = cashOnHand+factionCash;
return {at:now,money:{cashOnHand,factionCash,vaultCash,availableCash},bank:normalizeBank(moneyData,now),cashierChecks:normalizeChecks(moneyData,now),properties,currentProperty:currentProperty||properties.find(entry=>entry.current)||properties.find(entry=>/^(?:in_use|rented)$/i.test(entry.status))||properties[0]||null,loan,loanSharkEarned:names.length?names.some(name=>/loan shark/i.test(name)):null,stocks:stockRows(user.stocks || {},input.tornStocks || {},input.itemCatalog || [],availableCash)};
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
if (Number.isFinite(property?.upkeepOwed) && property.upkeepOwed >= config.upkeepThreshold && config.upkeepThreshold > 0) push('upkeep','Property upkeep needs attention',money(property.upkeepOwed)+' is currently owed.',[['Property',URLS.property]]);
if (property?.leaseExtension && !['accepted','declined'].includes(property.leaseExtension.status)) push('lease-extension','Rental extension offer waiting',property.name+' has a pending lease-extension offer.',[['Property',URLS.property]]);
if (status.loan?.amount > 0) push('duke-loan','Duke loan is outstanding',money(status.loan.amount)+' is currently owed.',[['Duke',URLS.loan]]);
else if (config.loanReminder && status.loanSharkEarned === false) push('loan-shark','Loan Shark merit is still available','You have no Duke loan and have not earned Loan Shark yet.',[['Duke',URLS.loan]]);
for (const stock of status.stocks || []) if (config.stockAlerts[stock.alertKey] === true && stock.affordable) push('stock:'+stock.alertKey,(stock.acronym||stock.name)+' next benefit is affordable','Cash on hand plus faction armory cash can cover '+money(stock.incrementalCost)+'.',[['Stocks',URLS.stocks]]);
return result;
}
function summaryCard(label,value,detail='') { return '<article class="card"><span class="muted">'+api.escapeHtml(label)+'</span><h2>'+api.escapeHtml(value)+'</h2>'+(detail?'<p>'+api.escapeHtml(detail)+'</p>':'')+'</article>'; }
function bankResultsHtml(amount) {
const comparison=bankComparison(cache().bankPlanner,amount);
if(comparison.error)return api.moduleMessage(comparison.error,'error');
const pct=value=>(value*100).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')+'%';
return '<p>Bank interest merits: '+comparison.meritLevel+'/10 (+ '+comparison.meritLevel*5+'%) · '+api.escapeHtml(comparison.stock.label)+'</p><div class="grid">'+comparison.rows.map(row=>'<article class="card"><h3>'+row.label+(row.days===comparison.best?' · Best daily ROI':'')+'</h3>'+(row.available?'<p>APR: '+row.effectiveApr.toFixed(3)+'% · '+row.days+' days</p><p><strong>Profit: '+exactMoney(row.profit)+'</strong><br>Per day: '+exactMoney(row.perDay)+'<br>Total returned: '+exactMoney(row.total)+'<br>Term ROI: '+pct(row.roi)+' · Daily ROI: '+pct(row.dailyRoi)+'</p>':'<p>No rate returned for this term.</p>')+'</article>').join('')+'</div>';
}
function bankPlannerHtml() {
const current=cache();
return '<article class="card full"><div class="card-head"><div><h2>Bank investment comparison</h2><span class="muted">Rates checked '+api.relativeTime(current.bankPlanner?.fetchedAt)+' · cached for up to 1 hour</span></div>'+api.actionLink('Open Bank',URLS.bank)+'</div><p>Uses Torn’s individual APR for each term, your bank interest merits, and your active bank stock benefit. Estimated daily income is paid at maturity, not daily.</p>'+(current.bankPlanner?.error?api.moduleMessage(current.bankPlanner.error,'error'):'')+'<label>Amount to invest (maximum $2 billion)<input type="number" inputmode="numeric" min="0" max="2000000000" step="1" data-mp-bank-amount value="'+integer(settings().bankAmount ?? 2000000000)+'" style="width:100%;min-height:44px;margin:6px 0 10px"></label><div data-mp-bank-results>'+bankResultsHtml(settings().bankAmount ?? 2000000000)+'</div></article>';
}
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
const checked=config.stockAlerts[stock.alertKey]===true?' checked':'';
const roi=(stock.monthlyRoi*100).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')+'%';
return '<article class="card"><div class="card-head"><div><h2>'+api.escapeHtml(stock.acronym||stock.name)+'</h2><span class="muted">'+api.escapeHtml(stock.benefitDescription)+'</span></div><strong title="'+api.escapeHtml(exactMoney(stock.payoutValue))+'">'+money(stock.payoutValue)+'</strong></div><p><strong>Actual payout:</strong> '+money(stock.payoutValue)+' · '+api.escapeHtml(stock.cadenceLabel)+'</p><div class="stats"><div><strong>'+money(stock.incrementalCost)+'</strong><span>Next block · '+stock.sharesNeeded.toLocaleString()+' shares</span></div><div><strong>'+money(Math.round(stock.weeklyValue))+'</strong><span>Weekly value</span></div><div><strong>'+money(Math.round(stock.monthlyValue))+'</strong><span>Monthly value</span></div><div><strong>'+roi+'</strong><span>Monthly ROI</span></div></div><label class="check-row"><input type="checkbox" data-mp-stock="'+api.escapeHtml(stock.alertKey)+'"'+checked+'> Alert when affordable</label></article>';
}).join('') : '<article class="card wide">No income-producing stock benefit could be valued from Torn’s current stock and item data.</article>';
root.innerHTML = '<div class="grid"><article class="card wide"><div class="card-head"><div><h2>Money &amp; Property</h2><span class="muted">Updated '+api.relativeTime(status.at)+' · cached for 15 minutes</span></div><button type="button" data-mp-action="refresh">'+(busy?'Checking…':'Refresh')+'</button></div>'+(error?api.moduleMessage(error,'error'):'')+'<label class="check-row"><input type="checkbox" data-mp-setting="enabled"'+(config.enabled?' checked':'')+'> Enable Money &amp; Property reminders</label></article>'+
summaryCard('Cash on hand',money(status.money.cashOnHand),'Personal cash')+
summaryCard('Faction armory cash',money(status.money.factionCash),'Included for affordability alerts')+
summaryCard('Available for stocks',money(status.money.availableCash),'Cash + faction armory')+
summaryCard('Property',property?.name||'Unavailable',property?.rentalEndsAt?'Rental ends in '+duration(property.rentalEndsAt-Date.now()):'No rental timer returned')+
'<article class="card wide"><h2>Reminder settings</h2><div class="form-grid"><label>Bank lead hours<input type="number" min="0" max="168" data-mp-setting="bankLeadHours" value="'+config.bankLeadHours+'"></label><label>Rental lead days<input type="number" min="0" max="30" data-mp-setting="rentalLeadDays" value="'+config.rentalLeadDays+'"></label><label>Cashier-check lead hours<input type="number" min="0" max="168" data-mp-setting="cashierLeadHours" value="'+config.cashierLeadHours+'"></label><label>Upkeep alert threshold<input type="number" min="0" step="1000" data-mp-setting="upkeepThreshold" value="'+config.upkeepThreshold+'"></label></div><label class="check-row"><input type="checkbox" data-mp-setting="loanReminder"'+(config.loanReminder?' checked':'')+'> Remind me to pursue Loan Shark when the achievement state is available</label><label class="check-row"><input type="checkbox" data-mp-setting="soundEnabled"'+(config.soundEnabled?' checked':'')+'> Play sounds for Money &amp; Property alerts</label></article>'+
'<article class="card wide"><div class="card-head"><div><h2>Financial status</h2><span class="muted">Only fields actually returned by Torn are shown.</span></div></div><p><strong>Bank:</strong> '+(status.bank.amount?money(status.bank.amount)+(status.bank.matured?' · ready to collect':status.bank.maturedAt?' · '+duration(status.bank.maturedAt-Date.now())+' remaining':''):'No active investment returned')+'</p><p><strong>Duke:</strong> '+(status.loan.amount?money(status.loan.amount)+' owed':'No balance returned')+'</p><p><strong>Daily property upkeep:</strong> '+(property?money(property.upkeepPerDay):'Unavailable')+'</p><p><strong>Upkeep owed:</strong> '+(property&&Number.isFinite(property.upkeepOwed)?money(property.upkeepOwed):'Not exposed by Torn API')+'</p><p><strong>Cashier checks:</strong> '+status.cashierChecks.length+'</p><div class="target-actions">'+api.actionLink('Open Bank',URLS.bank)+api.actionLink('Open Property',URLS.property)+api.actionLink('Open Duke',URLS.loan)+'</div></article>'+
bankPlannerHtml()+'<article class="card full"><div class="card-head"><div><h2>Income-producing stock benefits</h2><span class="muted">Actual payout value and cadence, sorted by estimated monthly ROI. Non-income perks are omitted.</span></div>'+api.actionLink('Open Stocks',URLS.stocks)+'</div><div class="grid">'+stockRowsHtml+'</div></article></div>';
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
if(target.matches('[data-mp-bank-amount]')){
if(target.validity.valid){config.bankAmount=Number(target.value);api.save();}
return;
}
if (target.matches('[data-mp-setting]')) {
const key = target.dataset.mpSetting;
config[key] = target.type === 'checkbox' ? target.checked : Number(target.value);
}
if (target.matches('[data-mp-stock]')) config.stockAlerts[target.dataset.mpStock] = target.checked;
api.save();
api.alertsChanged();
});
root.addEventListener('input',event=>{
if(!event.target.matches('[data-mp-bank-amount]'))return;
const results=root.querySelector('[data-mp-bank-results]');
if(results)results.innerHTML=bankResultsHtml(event.target.value);
});
}
async function refresh(force = false) {
const current = cache();
if (busy) return current.status;
if (!force && current.status && current.bankPlanner && Date.now()-Number(current.fetchedAt||0)<CACHE_MS) { render(); return current.status; }
busy = true; error = ''; render();
try {
await api.ensurePermission(false);
if (!api.hasScope(SCOPE)) throw new Error('Your SLINK account does not have '+SCOPE+' permission.');
const [moneyData,propertiesData,currentPropertyData,stocksData,achievements,tornStocks,userMerits] = await Promise.all([
api.tornJson('/v2/user/money','SLINK PDA Money and Property'),
api.tornJson('/v2/user/properties?limit=100','SLINK PDA Money and Property'),
api.tornJson('/v2/user/property','SLINK PDA current property').catch(()=>({})),
api.tornJson('/v2/user/stocks','SLINK PDA Money and Property'),
api.tornJson('/v2/user?selections=honors,medals,merits','SLINK PDA Money and Property').catch(()=>({})),
api.tornJson('/v2/torn/stocks','SLINK PDA stock benefit catalog'),
api.tornJson('/v2/user/merits','SLINK PDA bank interest merits').catch(()=>null)
]);
const previousPlanner=current.bankPlanner||{};
let rates=previousPlanner.rates,meritCatalog=previousPlanner.meritCatalog,fetchedAt=previousPlanner.fetchedAt;
let bankError='';
try{
if(force||!bankRateRows(rates).length||Date.now()-Number(fetchedAt||0)>=BANK_RATE_CACHE_MS){
const updatedRates=await api.tornJson('/v2/torn/bank','SLINK PDA bank term rates');
if(!bankRateRows(updatedRates).length)throw new Error('Torn returned no usable bank term rates.');
rates=updatedRates;
fetchedAt=Date.now();
}
if(!meritCatalog||Date.now()-Number(previousPlanner.meritCatalogAt||0)>=CATALOG_MS){
meritCatalog=await api.tornJson('/v2/torn/merits','SLINK PDA merit names');
current.bankPlanner={...previousPlanner,meritCatalogAt:Date.now()};
}
}catch(caught){bankError='Bank comparison refresh: '+api.errorMessage(caught);}
current.bankPlanner={...(current.bankPlanner||previousPlanner),rates,meritCatalog,fetchedAt,userMerits,userStocks:stocksData,tornStocks,error:bankError};
const user={...achievements,money:moneyData?.money||{},properties:propertiesData?.properties||[],currentProperty:currentPropertyData?.property||currentPropertyData?.properties?.[0]||null,stocks:stocksData?.stocks||[]};
if (force || !current.itemCatalogAt || Date.now()-current.itemCatalogAt>=CATALOG_MS) {
const catalogBody = await api.tornJson('/v2/torn/items?sort=ASC','SLINK PDA Money and Property item values');
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
api.register({id:ID,title:'Money & Property',shortTitle:'Money',scope:SCOPE,render,refresh,alerts,start,test:Object.freeze({buildStatus,buildAlerts,bankComparison,bankMeritLevel,bankStockBonus,bankRateRows})});
})(globalThis);
