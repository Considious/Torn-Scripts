(function(g){
  'use strict';
  const SELL_FEE=.001, valid=n=>Number.isSafeInteger(n)&&n>=0;
  function threshold(base, shares, {passive=false,cap=Infinity}={}){
    if(!valid(base)||!base||!valid(shares))return null;
    for(let i=1,total=base;i<=cap&&valid(total);i++,total=total*2+base){
      if(total>shares)return i===1||!passive?total:null;
    }
    return null;
  }
  function portfolio(holdings,prices){
    if(!Array.isArray(holdings))return null;
    let value=0,basis=0,hasValue=true,hasBasis=true;
    for(const h of holdings){
      if(!valid(h?.shares)){hasValue=hasBasis=false;continue;}
      if(!h.shares)continue;
      const price=prices.get(h.id);
      if(!(price>0&&Number.isFinite(price)))hasValue=false;else value+=h.shares*price;
      const lots=h.transactions;
      if(!Array.isArray(lots)||lots.some(l=>!valid(l?.shares)||!(typeof l.price==='number'&&l.price>0&&Number.isFinite(l.price)))||lots.reduce((n,l)=>n+l.shares,0)!==h.shares)hasBasis=false;
      else basis+=lots.reduce((n,l)=>n+l.shares*l.price,0);
    }
    return {value:hasValue?value:null,profit:hasValue&&hasBasis?value-basis:null};
  }
  function amount(text){
    const s=String(text).trim();
    if(!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(s))return null;
    const n=Number(s.replace(/[$,]/g,''));return n>0&&Number.isSafeInteger(Math.round(n*100))?n:null;
  }
  function quote(dollars,price,sell=false,limit=null){
    if(!(dollars>0&&Number.isFinite(dollars)&&price>0&&Number.isFinite(price)))return null;
    const cents=Math.round(dollars*100), priceCents=Math.round(price*100);
    if(!valid(cents)||!valid(priceCents)||!priceCents||Math.abs(price-priceCents/100)>1e-8)return null;
    const factor=sell?999n:1000n;
    const shares=Number(BigInt(cents)*1000n/(BigInt(priceCents)*factor));
    const unit=price*(sell?1-SELL_FEE:1);
    if(!valid(shares)||!shares)return null;
    return {shares,total:shares*unit,exceeds:valid(limit)&&shares>limit};
  }
  function educationRemaining(user, catalog){
    const completed=user?.education?.complete, groups=catalog?.education;
    if(!Array.isArray(completed)||!Array.isArray(groups))return null;
    const ids=groups.flatMap(group=>Array.isArray(group?.courses)?group.courses.map(course=>Number(course.id)):[]);
    if(!ids.length||ids.some(id=>!Number.isSafeInteger(id)||id<=0))return null;
    const known=completed.map(course=>Number(course?.id??course));
    if(known.some(id=>!Number.isSafeInteger(id)||id<=0))return null;
    const done=new Set(known);
    return ids.some(id=>!done.has(id));
  }
  function recommendations(snapshot, {affordableOnly=false,sort='monthlyRoi',hidden=[]}={}){
    if(!Array.isArray(snapshot?.holdings)||!Array.isArray(snapshot?.market))return [];
    const owned=new Set(snapshot.holdings.filter(row=>Number(row.shares)>0).map(row=>Number(row.id)));
    const excluded=new Set(hidden), market=new Map(snapshot.market.map(row=>[Number(row.id),row]));
    const cash=typeof snapshot.cash==='number'&&Number.isFinite(snapshot.cash)&&snapshot.cash>=0?snapshot.cash:null;
    const choices=(Array.isArray(snapshot.benefitRows)?snapshot.benefitRows:[]).filter(row=>
      row.acronym!=='WSU'&&!owned.has(Number(row.id))&&!excluded.has(Number(row.id))&&market.get(Number(row.id))?.bonus?.passive!==true&&
      row.incrementalCost>0&&row.weeklyValue>0&&row.monthlyRoi>0&&
      Number.isFinite(row.weeklyValue)&&Number.isFinite(row.monthlyRoi));
    const wsu=snapshot.market.find(row=>row.acronym==='WSU');
    if(wsu&&snapshot.educationRemaining===true&&!owned.has(Number(wsu.id))&&!excluded.has(Number(wsu.id))){
      const shares=Number(wsu.bonus?.requirement),price=Number(wsu.market?.price);
      if(Number.isSafeInteger(shares)&&shares>0&&price>0&&Number.isFinite(price)){
        choices.push({id:wsu.id,acronym:'WSU',name:wsu.name,incrementalCost:Math.ceil(shares*price),
          education:true,benefitDescription:wsu.bonus?.description||'Reduced education time'});
      }
    }
    return choices.filter(row=>!affordableOnly||(cash!==null&&row.incrementalCost<=cash))
      .sort((a,b)=>Number(Boolean(b.education))-Number(Boolean(a.education))||
        (sort==='weeklyValue'?b.weeklyValue-a.weeklyValue:b.monthlyRoi-a.monthlyRoi)||Number(a.id)-Number(b.id))
      .slice(0,3);
  }
  g.SLINK_STOCKS_MODEL=Object.freeze({threshold,portfolio,amount,quote,educationRemaining,recommendations});
})(globalThis);
