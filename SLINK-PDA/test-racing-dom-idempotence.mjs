import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const platform="pda";
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const source=read("./src/20-quality-of-life.part");
const segment=(value,start,end)=>{const a=value.indexOf(start),b=value.indexOf(end,a);assert.ok(a>=0&&b>a);return value.slice(a,b);};
let labels=0,reads=0,scrolls=0,observerCallback=null;
const mutations=[],timers=[];
const parent={closest:()=>null};
function car(name){
 const classes=new Set();
 return {textContent:name,isConnected:true,getClientRects:()=>[{}],classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)},
 after(label){this.marked=true;label.isConnected=true;mutations.push({target:parent,addedNodes:[label],removedNodes:[]});},
 scrollIntoView(){scrolls++;}};
}
const hiddenCar=car('Fixture car');hiddenCar.getClientRects=()=>[];
let cars=[hiddenCar,car('Fixture car')];
const ctx={
 console,URL,context:{presentation:'full'},stopped:false,scanTimer:null,saveTimer:null,userState:{},
 highlightedNode:null,recommendationLabel:null,recommendationKey:'',assistantRoot:null,assistantSignature:'',
 HIGHLIGHT_CLASS:'fixture-highlight',LABEL_ATTRIBUTE:'data-slink-racing-label',
 RACING_HIGHLIGHT_CLASS:'fixture-highlight',RACING_LABEL_ATTRIBUTE:'data-slink-pda-racing-label',HOST_ID:'slink-pda-dashboard-host',RACING_SCOPE:'slink.qol.racing',
 racingScanTimer:null,racingAssistant:{},moduleRoot:()=>null,escapeHtml:value=>String(value),
 ui:{getContentElement:()=>({querySelector:()=>null})},
 document:{hidden:false,hasFocus:()=>platform==='extension',querySelectorAll(selector){reads++;return selector==='track'?[{textContent:'Wrong - Official race',getClientRects:()=>[]},{textContent:'Fixture - Official race',getClientRects:()=>[{}]}]:cars;},
 createElement(){labels++;return {nodeType:1,isConnected:false,setAttribute(){},matches:()=>true,remove(){if(!this.isConnected)return;this.isConnected=false;mutations.push({target:parent,addedNodes:[],removedNodes:[this]});}};}},
 global:{location:{href:'https://www.torn.com/loader.php?sid=racing'},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){}},
 MutationObserver:class {constructor(callback){observerCallback=callback;}observe(){}},
 ensureHighlightStyle(){},ensureRacingHighlightStyle(){},hasScope:()=>true
};
const racing={RACEWAY_DOM:{OFFICIAL_RACE_TRACK_SELECTOR:'track',OFFICIAL_RACE_CAR_NAME_SELECTOR:'car'},parseOfficialRaceTrack:text=>text==='Fixture - Official race'?'Fixture':null,
 recommendationForTrack:()=>({status:'ready',nickname:'Fixture car'}),matchVisibleCar:(_name,nodes)=>nodes.length?nodes[0]:null};
Object.assign(ctx,{racing,RACING_DOM:racing.RACEWAY_DOM,parseOfficialRacingTrack:racing.parseOfficialRaceTrack,racingRecommendationForTrack:racing.recommendationForTrack,racingSettings:()=>({}),matchVisibleRacingCar:racing.matchVisibleCar});
vm.createContext(ctx);
ctx.pdaDomActive=()=>!ctx.document.hidden;
if(platform==='extension'){
 vm.runInContext(segment(source,'      function clearHighlight()','      function queueSave()'),ctx);
 const observer=segment(source,'observer = new MutationObserver(mutations => {','      observer.observe(');
 vm.runInContext(observer,ctx);
}else{
 const market=read('./src/10-market-runtime.part');
 vm.runInContext(market.slice(market.indexOf('function clearRacingHighlight()')),ctx);
 vm.runInContext(source.slice(0,source.indexOf('function renderRacing()')),ctx);
 observerCallback=records=>{if(records.some(ctx.racingMutationRelevant))ctx.scheduleRacingScan();};
}
ctx.scanOfficialRaceDom();
assert.equal(labels,1);assert.equal(scrolls,0,'Background recommendation updates must not repeatedly scroll the page.');
assert.equal(hiddenCar.marked,undefined,'Hidden matching cars must never steal the recommendation');
assert.equal(cars[1].marked,true,'The visible supplied car row must receive the label');
observerCallback(mutations.splice(0));
assert.equal(timers.length,0,'SLINK label insertion must not schedule another scan.');
ctx.scanOfficialRaceDom();
assert.equal(labels,1,'An unchanged car keeps its existing recommendation label.');
cars=[car('Fixture car')];
observerCallback([{target:parent,addedNodes:[cars[0]],removedNodes:[]}]);
assert.equal(timers.length,1);
timers.shift()();
assert.equal(labels,2,'Replacing the native car list must create one new recommendation.');
observerCallback(mutations.splice(0));
assert.equal(timers.length,0);
ctx.document.hidden=true;const before=reads;ctx.scanOfficialRaceDom();
assert.equal(reads,before,'A queued scan must not read Torn DOM after the page becomes hidden.');
if(platform==='extension'){
 ctx.document.hidden=false;ctx.document.hasFocus=()=>false;ctx.scanOfficialRaceDom();
 assert.equal(reads,before,'An unfocused extension page must not scrape.');
}
console.log(platform+' Racing DOM idempotence, self-mutation filtering, list replacement and visibility tests passed.');
