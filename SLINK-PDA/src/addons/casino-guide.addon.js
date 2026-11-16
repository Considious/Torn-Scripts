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
    const canonical=({holdem:'poker',bookies:'bookie',bookmaker:'bookie',spinthewheel:'spinwheel',wheel:'spinwheel',slotmachine:'slots',russian:'russianroulette'})[id]||id;
    return Object.hasOwn(games,canonical)?canonical:null;
  };
  const compact='data-slink-casino-compact';
  const interactive='a[href],button,input,select,textarea,[role=button],[role=link]';
  const lobbyStyles=`
    [data-slink-casino-controls]{background:var(--sp-bg,Canvas);color:var(--sp-text,CanvasText);border:1px solid var(--sp-border,currentColor);border-radius:7px;padding:8px}
    [data-slink-casino-controls]>summary{color:inherit;cursor:pointer;padding:4px 0}
    [data-slink-casino-controls] .slink-page-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr));gap:6px;margin:6px 0}
    [data-slink-casino-controls] .slink-page-toggle{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;min-block-size:40px;padding:5px 8px;background:var(--sp-control,Canvas);color:var(--sp-text,CanvasText);border:1px solid var(--sp-border,currentColor);border-radius:5px;cursor:pointer}
    [data-slink-casino-controls] .slink-page-toggle:hover{border-color:var(--sp-text,CanvasText)}
    [data-slink-casino-controls] :is(summary,button,input):focus-visible{outline:2px solid var(--sp-text,CanvasText);outline-offset:2px}
    [data-slink-casino-controls] button:disabled{opacity:.65}
    [data-slink-hidden-casino-game]{display:none!important}
    ul.games-list[data-slink-casino-compact]{display:flex!important;flex-wrap:wrap!important;align-items:flex-start;justify-content:flex-start!important;gap:8px!important;height:auto!important}
    ul.games-list[data-slink-casino-compact]::before,ul.games-list[data-slink-casino-compact]::after{display:none!important}
    ul.games-list[data-slink-casino-compact]>li{float:none!important;clear:none!important;margin:0!important;max-inline-size:100%;flex:0 0 auto}
    ul.games-list[data-slink-casino-compact]>li.clear:empty{display:none!important}
  `;
  function linkGame(link){
    const url=new URL(link.href,location.href);
    if(url.origin!==location.origin||url.pathname==='/casino.php')return null;
    const route=url.pathname==='/page.php'?url.searchParams.get('sid'):url.pathname.match(/^\/([\w-]+\.php)$/)?.[1];
    return gameId(route);
  }
  function lobby(root,box){
    const list=make('div'),restore=make('button','Show all games'),status=make('span');
    const summary=box.querySelector('summary');
    box.setAttribute('data-slink-casino-controls','');
    list.classList.add('slink-page-grid');
    restore.type='button';
    status.setAttribute('role','status');
    const style=make('style');
    style.textContent=lobbyStyles;
    box.append(list,restore,status,style);
    let hidden;
    try{
      const items=JSON.parse(localStorage.getItem(key)||'[]');
      hidden=new Set(Array.isArray(items)?items.map(gameId).filter(Boolean):[]);
    }catch{hidden=new Set();}
    let marked=new Set();
    const switches=new Map();
    function save(){
      try{
        localStorage.setItem(key,JSON.stringify([...hidden]));
        status.textContent='';
      }catch{status.textContent='Changes could not be saved on this device.';}
    }
    function update(){
      const entries=new Set(),next=new Set(),tiles=new Set();
      for(const link of root.querySelectorAll('a[href]')){
        const slug=linkGame(link);
        if(!slug)continue;
        entries.add(slug);
        const li=link.closest('li');
        const tile=li?.parentElement===root&&li.querySelectorAll(interactive).length===1?li:null;
        if(tile)tiles.add(tile);
        if(hidden.has(slug))next.add(tile||link);
      }
      for(const node of marked)if(!next.has(node))node.removeAttribute(mark);
      for(const node of next)if(!node.hasAttribute(mark))node.setAttribute(mark,'');
      marked=next;
      // Use flex spacing only for a list containing native game tiles and the old float spacer.
      const canCompact=root.matches('ul.games-list')&&Array.from(root.children).every(node=>tiles.has(node)||node.matches('li.clear:empty'));
      root.toggleAttribute(compact,canCompact&&Array.from(next).some(node=>tiles.has(node)));
      for(const slug of hidden)entries.add(slug);
      for(const [slug,input] of switches)if(!entries.has(slug)){
        input.closest('label').remove();
        switches.delete(slug);
      }
      for(const slug of entries){
        let input=switches.get(slug);
        if(!input){
          input=make('input');
          input.type='checkbox';
          input.setAttribute('role','switch');
          input.addEventListener('change',()=>{
            if(input.checked)hidden.delete(slug);
            else hidden.add(slug);
            save();
            update();
          });
          const row=field(games[slug],input);
          row.classList.add('slink-page-toggle');
          list.append(row);
          switches.set(slug,input);
        }
        input.checked=!hidden.has(slug);
      }
      restore.disabled=!hidden.size;
      const caption='Show or hide casino games'+(hidden.size?' ('+hidden.size+' hidden)':'');
      if(summary.textContent!==caption)summary.textContent=caption;
    }
    restore.onclick=()=>{hidden.clear();save();update();summary.focus();};
    return {update,clear(){
      for(const node of marked)node.removeAttribute(mark);
      root.removeAttribute(compact);
    }};
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
    const box=make('details');globalThis.SLINK_TORN_COMPONENTS?.card(box);
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
