(function(g){
  'use strict';
  const ranks=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  function highLow(rank,seen=[]){
    const at=ranks.indexOf(rank);if(at<0)return null;
    const counts=Array(13).fill(4);counts[at]--;
    for(const card of seen){const i=ranks.indexOf(card);if(i<0||--counts[i]<0)return null;}
    const higher=counts.slice(at+1).reduce((a,b)=>a+b,0),lower=counts.slice(0,at).reduce((a,b)=>a+b,0),equal=counts[at];
    return higher+lower+equal>0?{higher,lower,equal,total:higher+lower+equal}:null;
  }
  const values=[[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,4]];
  const value=r=>r==='A'?1:/^[JQK]$/.test(r)?10:Number(r);
  const score=(low,ace)=>low+(ace&&low<=11?10:0);
  const mean=fn=>values.reduce((sum,[v,w])=>sum+w*fn(v),0)/13;
  function blackjack(cards,dealer,options={}){
    if(cards.length<2||cards.length>6||!ranks.includes(dealer)||cards.some(c=>!ranks.includes(c)))return null;
    const low=cards.reduce((n,c)=>n+value(c),0),ace=cards.includes('A'),total=score(low,ace),count=cards.length;
    if(total>21)return {total,done:'Bust'};
    if(count===6)return {total,done:'Six-card Charlie'};
    if(count===2&&total===21&&!options.splitHand)return {total,done:'Blackjack'};
    const distribution=new Map(),up=value(dealer);
    function deal(sum,soft,n,p){
      const s=score(sum,soft),end=s>21?'bust':n===2&&s===21?'natural':n===6?'charlie:'+s:s>=17?'stand:'+s:'';
      if(end){distribution.set(end,(distribution.get(end)||0)+p);return;}
      for(const [v,w] of values)deal(sum+v,soft||v===1,n+1,p*w/13);
    }
    for(const [v,w] of values)deal(up+v,up===1||v===1,2,w/13);
    const stand=(s,n)=>[...distribution].reduce((ev,[type,p])=>{
      const d=Number(type.split(':')[1]);
      const outcome=s>21||type==='natural'?-1:type==='bust'||n===6&&!type.startsWith('charlie')?1:n<6&&type.startsWith('charlie')?-1:Math.sign(s-d);
      return ev+p*outcome;
    },0);
    const memo=new Map();
    function best(sum,soft,n){
      const s=score(sum,soft);if(s>21)return -1;
      const stay=stand(s,n);if(n===6||s===21)return stay;
      const k=[sum,soft,n].join(':');if(memo.has(k))return memo.get(k);
      const ev=Math.max(stay,mean(v=>best(sum+v,soft||v===1,n+1)));memo.set(k,ev);return ev;
    }
    const moves=[['Stand',stand(total,count)]];
    if(total<21)moves.push(['Hit',mean(v=>best(low+v,ace||v===1,count+1))]);
    if(count===2&&options.double&&total<21)moves.push(['Double',2*mean(v=>stand(score(low+v,ace||v===1),3))]);
    moves.sort((a,b)=>b[1]-a[1]);
    return {total,moves,pair:count===2&&value(cards[0])===value(cards[1])};
  }
  g.SLINK_CASINO_GUIDE=Object.freeze({highLow,blackjack});
  if(!g.document)return;
  const sid=new URLSearchParams(location.search).get('sid')?.toLowerCase();
  const mode=location.pathname==='/casino.php'?'lobby':location.pathname==='/page.php'&&['highlow','blackjack','casino'].includes(sid)?sid==='casino'?'lobby':sid:'';
  if(!mode)return;
  const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const field=(label,n)=>{const l=make('label',label+' ');l.append(n);return l;};
  const select=()=>{
    const el=make('select');
    for(const rank of ['',...ranks]){const n=make('option',rank||'Select card');n.value=rank;el.append(n);}
    return el;
  };
  const parse=text=>text.trim().toUpperCase().split(/[\s,]+/).filter(Boolean);
  let mounted,queued=false;
  const key='slink.casino.hidden-games.v1',mark='data-slink-hidden-casino-game';
  const games={highlow:'High-Low',blackjack:'Blackjack',poker:'Poker',bookie:'Bookie',russianroulette:'Russian Roulette',slots:'Slots',spinwheel:'Spin the Wheel',roulette:'Roulette',lottery:'Lottery',keno:'Keno',craps:'Craps'};
  const gameId=value=>{
    const id=String(value??'').toLowerCase().replace(/\.php$/,'').replace(/[^a-z0-9]/g,'');
    const canonical=({bookies:'bookie',bookmaker:'bookie',spinthewheel:'spinwheel',wheel:'spinwheel',slotmachine:'slots',russian:'russianroulette'})[id]||id;
    return Object.hasOwn(games,canonical)?canonical:null;
  };
  function lobby(root,box){
    const list=make('div'),restore=make('button','Show all games'),status=make('span');
    restore.type='button';status.setAttribute('role','status');
    const style=make('style');style.textContent=`[${mark}]{display:none!important}`;
    box.append(list,restore,status,style);
    let hidden;
    try{const items=JSON.parse(localStorage.getItem(key)||'[]');hidden=new Set(Array.isArray(items)?items.map(gameId).filter(Boolean):[]);}catch{hidden=new Set();}
    let signature='',marked=new Set();
    const save=()=>{try{localStorage.setItem(key,JSON.stringify([...hidden]));status.textContent='';}catch{status.textContent='Changes could not be saved on this device.';}};
    const update=()=>{
      const entries=new Map(),next=new Set();
      for(const a of root.querySelectorAll('a[href]')){
        const url=new URL(a.href,location.href);if(url.origin!==location.origin||url.pathname==='/casino.php')continue;
        const slug=gameId(url.pathname==='/page.php'?url.searchParams.get('sid'):url.pathname.match(/^\/([\w-]+\.php)$/)?.[1]);
        if(!slug)continue;
        entries.set(slug,games[slug]);
        const li=a.closest('li'),target=li&&li!==root&&root.contains(li)&&li.querySelectorAll('a[href],button,input,select').length===1?li:a;
        if(hidden.has(slug)){target.setAttribute(mark,'');next.add(target);}
      }
      for(const node of marked)if(!next.has(node))node.removeAttribute(mark);marked=next;
      for(const slug of hidden)if(!entries.has(slug))entries.set(slug,games[slug]);
      const current=JSON.stringify([[...entries],...[...hidden].sort()]);
      if(current===signature)return;signature=current;
      list.replaceChildren(...Array.from(entries,([slug,label])=>{
        const input=make('input');input.type='checkbox';input.checked=!hidden.has(slug);
        input.onchange=()=>{if(input.checked)hidden.delete(slug);else hidden.add(slug);save();update();};
        return field(label,input);
      }));
      restore.disabled=!hidden.size;
      box.querySelector('summary').textContent='Show or hide casino games'+(hidden.size?' ('+hidden.size+' hidden)':'');
    };
    restore.onclick=()=>{hidden.clear();save();update();};
    return {update,clear(){for(const n of marked)n.removeAttribute(mark);}};
  }
  function advisor(box){
    const controls=make('div'),dealer=select(),cards=make('input'),result=make('p');
    controls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px';
    cards.type='text';cards.maxLength=130;cards.placeholder=mode==='highlow'?'e.g. 2, Q, 10':'e.g. A, 7';cards.autocomplete='off';
    result.setAttribute('role','status');
    const dbl=make('input'),split=make('input');dbl.type=split.type='checkbox';
    function calculate(){
      const hand=parse(cards.value);
      if(mode==='highlow'){
        const odds=highLow(dealer.value,hand);
        if(!odds){result.textContent=dealer.value?'Check the card ranks and counts.':'Choose the visible card.';return;}
        const pct=n=>(100*n/odds.total).toFixed(1)+'%';
        result.textContent=`Higher ${pct(odds.higher)} · Lower ${pct(odds.lower)} · Equal ${pct(odds.equal)}.`;return;
      }
      const model=blackjack(hand,dealer.value,{double:dbl.checked,splitHand:split.checked});
      if(!model){result.textContent='Enter your visible hand and the dealer’s upcard.';return;}
      result.textContent=model.done?`Total ${model.total} · ${model.done}.`:`Total ${model.total} · Suggested: ${model.moves[0][0]}.`+(model.pair?' This estimate does not compare splitting.':'');
    }
    controls.append(field(mode==='highlow'?'Visible card':'Dealer upcard',dealer),field(mode==='highlow'?'Other seen cards (optional)':'Your cards',cards));
    if(mode==='blackjack')controls.append(field('Double is available',dbl),field('Hand was split',split));
    for(const n of [dealer,cards,dbl,split])n.addEventListener('input',calculate);
    const note=mode==='highlow'?'Single-deck estimate. Only enter other cards you know are already out of the same deck. Equal ranks are shown separately.':
      'Approximate strategy for Hit, Stand, and Double, including soft 17 and six-card Charlie. Does not model Split, Surrender, Insurance, or exact shoe composition. Torn controls all play.';
    box.append(controls,result,make('small',note));calculate();
  }
  function sync(){
    queued=false;if(document.hidden)return;
    const root=document.querySelector(mode==='lobby'?'.games-list':mode==='highlow'?'.actions-wrap':'.player-cards');
    if(mounted&&mounted.root===root&&mounted.box.isConnected){mounted.update?.();return;}
    mounted?.dispose();mounted=null;if(!root)return;
    const box=make('details');box.style.cssText='padding:.5rem;margin:.5rem 0;border:1px solid currentColor;border-radius:.35rem';
    box.append(make('summary',mode==='lobby'?'Show or hide casino games':mode==='highlow'?'SLINK High-Low odds':'SLINK Blackjack advice'));
    root.before(box);
    const ui=mode==='lobby'?lobby(root,box):null;
    if(ui)ui.update();else advisor(box);
    mounted={root,box,update:ui?.update,dispose(){ui?.clear();box.remove();}};
  }
  function schedule(){if(!queued&&!document.hidden){queued=true;requestAnimationFrame(sync);}}
  function start(){
    new MutationObserver(records=>{if(!mounted?.box.isConnected||records.some(r=>!mounted.box.contains(r.target)))schedule();}).observe(document.querySelector('#mainContainer')||document.body,{childList:true,subtree:true});
    document.addEventListener('visibilitychange',schedule);sync();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
