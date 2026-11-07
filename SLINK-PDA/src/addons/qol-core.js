/* SLINK QoL helpers. Independent implementation; feature inspiration:
 * Mephiles/TornTools contributors (quick items, custom links, item information).
 * No TornTools implementation or data tables are copied here.
 * Blood compatibility here describes Torn game mechanics, not medical advice. */
(function(global){
  'use strict';
  const BLOOD=['A+','A-','B+','B-','AB+','AB-','O+','O-'];
  const SPECIAL=['heal-exit','heal-max','blood-heal','blood-hospital','points-energy','points-nerve'];
  const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function blood(value){const s=String(value||'').toUpperCase().replace(/\s/g,'').replace(/−/g,'-');return BLOOD.includes(s)?s:null;}
  function compatible(donor,recipient){
    donor=blood(donor);recipient=blood(recipient);if(!donor||!recipient)return null;
    const d=donor.slice(0,-1),r=recipient.slice(0,-1);
    return (d==='O'||d===r||r==='AB')&&(donor.endsWith('-')||recipient.endsWith('+'));
  }
  function safeUrl(value){try{const u=new URL(String(value||''),'https://www.torn.com');return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
  function normalize(input={}){
    const favorites=[];const seen=new Set();
    for(const row of Array.isArray(input.favorites)?input.favorites:[]){
      const source=row?.source==='armory'?'armory':'inventory',id=String(row?.id||'');
      if(!(SPECIAL.includes(id)||/^[1-9]\d{0,6}$/.test(id))||source==='inventory'&&id.startsWith('points-'))continue;
      const key=source+':'+id;if(seen.has(key))continue;seen.add(key);
      favorites.push({id,source,name:String(row.name||id).slice(0,100)});if(favorites.length>=40)break;
    }
    const links=[],ids=new Set();
    for(const row of Array.isArray(input.links)?input.links:[]){
      const href=safeUrl(row?.href),id=String(row?.id||'').slice(0,80);if(!href||!id||ids.has(id))continue;ids.add(id);
      links.push({id,href,name:String(row.name||'Link').slice(0,60),newTab:row.newTab===true});if(links.length>=30)break;
    }
    return {enabled:input.enabled!==false,quickItems:input.quickItems!==false,customLinks:input.customLinks!==false,effects:input.effects!==false,values:input.values!==false,
      bloodType:blood(input.bloodType),favorites,links,version:1};
  }
  function favoriteKey(row){return row.source+':'+row.id;}
  function addFavorite(settings,row){const next=normalize(settings);if(!next.favorites.some(x=>favoriteKey(x)===favoriteKey(row)))next.favorites.push(row);return normalize(next);}
  function move(rows,key,offset,keyFn=row=>row.id){const next=rows.slice(),i=next.findIndex(row=>keyFn(row)===key);if(i<0)return next;const j=clamp(i+offset,0,next.length-1);next.splice(j,0,next.splice(i,1)[0]);return next;}
  function perkText(value){
    if(typeof value==='string')return [value];if(Array.isArray(value))return value.flatMap(perkText);
    if(!value||typeof value!=='object')return [];
    if(typeof value.description==='string')return [value.description];
    if(typeof value.name==='string'&&typeof value.value==='number')return [value.name+' '+value.value+'%'];
    return Object.values(value).flatMap(perkText);
  }
  function bonuses(response){
    const source=response?.perks;const known=Array.isArray(source?.faction)&&Array.isArray(source?.education);
    const out={medical:known?0:null,candy:known?0:null,alcohol:known?0:null,energy:known?0:null,energyMultiplier:1,verified:known,unresolved:[]};
    for(const text of perkText(source)){
      const s=text.toLowerCase(),n=s.match(/(\d+(?:\.\d+)?)\s*%/);
      let kind=/medical(?: item)? effectiveness/.test(s)?'medical':/happy.*candy|candy.*(?:effect|happy)/.test(s)?'candy':/nerve.*alcohol|alcohol.*(?:effect|nerve)/.test(s)?'alcohol':/energy.*(?:can|drink)|(?:can|drink).*energy/.test(s)?'energy':null;
      if(!kind)continue;
      if(kind==='energy'&&/doubl/.test(s)){out.energyMultiplier*=2;continue;}
      if(n&&/increase|gain|extra|effect|boost|bonus/.test(s)&&out[kind]!==null)out[kind]+=Number(n[1]);
      else{out[kind]=null;out.unresolved.push(text);}
    }
    return out;
  }
  function effect(item,bonus={}){
    const text=String(item.effect||item.description||'').replace(/<[^>]*>/g,' '),name=String(item.name||''),category=String(item.type||'');
    const b=blood(name.match(/Blood Bag\s*:\s*(AB|A|B|O)\s*([+-])/i)?.slice(1).join(''));
    const med=text.match(/Reduces hospital time by\s*(\d+(?:\.\d+)?)\s*(?:mins?|minutes?)\s*and restores\s*(\d+(?:\.\d+)?)%\s*life[\s\S]*?Increases medical cooldown by\s*(\d+(?:\.\d+)?)\s*(?:mins?|minutes?)/i);
    // Official Torn Medical/Hospital wiki base values. All require the verified effectiveness bonus.
    const base=med?[Number(med[1]),Number(med[2]),Number(med[3])]:b?[120,30,30]:/^Small First Aid Kit$/i.test(name)?[20,5,10]:/^First Aid Kit$/i.test(name)?[40,10,15]:/^Morphine$/i.test(name)?[70,15,20]:null;
    if(base){const known=finite(bonus.medical)!==null,m=1+(bonus.medical||0)/100;return {kind:'medical',blood:b,verified:known,minutes:base[0]*m,lifePercent:base[1]*m,cooldown:base[2],label:known?`${+(base[1]*m).toFixed(2)}% life · ${+(base[0]*m).toFixed(2)}m hospital · ${base[2]}m cooldown`:'Medical bonus not loaded'};}
    const normalized=text.replace(/(increases?|restores?|gives?|provides?)\s+(energy|nerve|happiness|happy)\s+by\s+(\d+(?:\.\d+)?)/gi,'$1 $3 $2');
    const specs=[['energy',/(?:increases?|restores?|gives?|provides?|gain)\s*(\d+(?:\.\d+)?)\s*energy/i,'energy',/energy.?drink/i.test(category)||/^Can of /i.test(name)],['alcohol',/(?:increases?|restores?|gives?|provides?|gain)\s*(\d+(?:\.\d+)?)\s*nerve/i,'nerve',/alcohol/i.test(category)],['candy',/(?:increases?|restores?|gives?|provides?|gain)\s*(\d+(?:\.\d+)?)\s*(?:happiness|happy)/i,'happy',/candy/i.test(category)]];
    for(const [kind,re,unit,applicable]of specs){const match=normalized.match(re);if(match&&applicable){const known=finite(bonus[kind])!==null,value=Number(match[1])*(1+(bonus[kind]||0)/100)*(kind==='energy'?bonus.energyMultiplier||1:1);return {kind,verified:known,value:known?value:null,label:known?`${+value.toFixed(2)} ${unit}`:`${match[1]} ${unit} base · bonuses not loaded`};}}
    return text?{kind:'description',verified:false,label:text.slice(0,220)}:null;
  }
  function chooseBlood(items,type,hospitalize=false,source='inventory'){
    if(!blood(type))return {error:'Set your Torn blood type before using a blood shortcut.'};
    let candidates=items.filter(item=>item.quantity>0&&item.effect?.blood&&compatible(item.effect.blood,type)===!hospitalize);
    if(!candidates.length)return {error:hospitalize?'No known incompatible blood bag is available.':'No compatible blood bag is available.'};
    // Preserve universal O bags when another valid choice exists. Never sacrifice compatibility.
    if(source==='armory'&&candidates.some(x=>!x.effect.blood.startsWith('O')))candidates=candidates.filter(x=>!x.effect.blood.startsWith('O'));
    candidates.sort((a,b)=>(finite(a.price)??Infinity)-(finite(b.price)??Infinity)||b.quantity-a.quantity||Number(a.id)-Number(b.id));
    return {item:candidates[0],warning:hospitalize?'This uses an INCOMPATIBLE blood bag to hospitalize your Torn character.':''};
  }
  // Bounded integer shortest-path planner. Scores cooldown first, then overshoot, price and clicks.
  // Returns only the next item. It never executes the remaining plan automatically.
  function healPlan(items,{mode,type,missingLife,hospitalMinutes,maxCooldown=Infinity}={}){
    const needed=mode==='heal-exit'?finite(hospitalMinutes):finite(missingLife);
    if(needed===null)return {error:mode==='heal-exit'?'Current hospital time is unavailable.':'Current life is unavailable.'};
    if(needed<=0)return {error:mode==='heal-exit'?'You are not in hospital.':'Your life is already full.'};
    const list=items.filter(x=>x.quantity>0&&x.effect?.kind==='medical'&&x.effect.verified&&(!x.effect.blood||compatible(x.effect.blood,type)===true));
    if(!list.length)return {error:'No verified usable medical items. Load bonuses and your current medical list first.'};
    const unit=mode==='heal-exit'?'minutes':'lifePercent',scale=10,goal=Math.ceil(needed*scale),limit=goal+Math.ceil(Math.max(...list.map(x=>x.effect[unit]))*scale);
    if(limit>30000)return {error:'Hospital time is outside the supported planner range. Use a medical item directly.'};
    let states=new Map([[0,{cooldown:0,cost:0,ids:[],counts:{}}]]),operations=0;
    for(let i=0;i<list.length;i++){
      const item=list[i],gain=Math.floor(item.effect[unit]*scale),count=Math.min(Math.floor(item.quantity),Math.ceil(goal/gain)+1,100);
      if(gain<=0)continue;
      const prior=[...states];
      for(const [sum,state]of prior)for(let n=1;n<=count;n++){
        if(++operations>100000)return {error:'This medical plan is unusually large. Choose an item directly; nothing was used.'};
        const total=sum+n*gain;if(total>limit)break;
        const cooldown=state.cooldown+n*item.effect.cooldown;if(cooldown>maxCooldown)break;
        const candidate={cooldown,cost:state.cost+n*(finite(item.price)??1e12),ids:[...state.ids,...Array(n).fill(item.id)],counts:{...state.counts,[item.id]:n}};
        const old=states.get(total);if(!old||cooldown<old.cooldown||cooldown===old.cooldown&&(candidate.cost<old.cost||candidate.cost===old.cost&&candidate.ids.length<old.ids.length))states.set(total,candidate);
      }
      if(states.size>30001)return {error:'Medical planning limit reached. Use a medical item directly.'};
    }
    const solutions=[...states].filter(([sum])=>sum>=goal).sort((a,b)=>a[1].cooldown-b[1].cooldown||a[0]-b[0]||a[1].cost-b[1].cost||a[1].ids.length-b[1].ids.length);
    if(!solutions.length)return {error:'Available items/cooldown cannot meet this target.'};
    const [sum,plan]=solutions[0];return {item:list.find(x=>x.id===plan.ids[0]),...plan,totalGain:sum/scale};
  }
  function catalog(body){const raw=body?.items;const rows=Array.isArray(raw)?raw:Object.entries(raw||{}).map(([id,row])=>({...row,id:row.id||id}));return rows.filter(x=>x&&Number(x.id)>0).map(x=>({id:String(x.id),name:String(x.name||''),type:String(x.type||''),effect:String(x.effect||x.description||'').slice(0,1400),price:finite(x.value?.market_price??x.market_value??x.marketPrice??x.price),shopSellPrice:finite(x.shopSellPrice)}));}
  function versionCompare(a,b){const parse=v=>/^\d+(?:\.\d+){1,3}$/.test(String(v||''))?String(v).split('.').map(Number):null;const x=parse(a),y=parse(b);if(!x||!y)return null;for(let i=0;i<4;i++){const n=(x[i]||0)-(y[i]||0);if(n)return Math.sign(n);}return 0;}
  global.SLINK_QOL=Object.freeze({BLOOD,SPECIAL,finite,blood,compatible,safeUrl,normalize,favoriteKey,addFavorite,move,bonuses,effect,chooseBlood,healPlan,catalog,versionCompare});
})(globalThis);
