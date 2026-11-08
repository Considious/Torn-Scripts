// Port of Considious's standalone Torn ADHD Pickpocket helper: advice only.
(function(global){
  'use strict';
  const marks=[
    [100,'Drunk man|Drunk woman|Elderly man|Elderly woman|Homeless person|Junkie'],
    [150,'Classy lady|Laborer|Postal worker|Young man|Young woman|Student'],
    [200,'Rich kid|Sex worker|Thug'],[250,'Businessman|Businesswoman|Jogger|Gang member|Mobster'],
    [300,'Cyclist'],[350,'Police officer']
  ];
  const rating=new Map(marks.flatMap(([score,names])=>names.split('|').map(name=>[name,score])));
  const tiers=['Drunk man|Drunk woman|Homeless person|Junkie|Elderly man|Elderly woman','Laborer|Postal worker|Young man|Young woman|Student','Classy lady|Rich kid|Sex worker','Thug|Jogger|Businessman|Businesswoman|Gang member','Cyclist','Mobster|Police officer'];
  const tier=new Map(tiers.flatMap((names,i)=>names.split('|').map(name=>[name,i])));
  const starts=[1,10,35,65,90,100];
  const builds={Businessman:['Skinny'],'Drunk man':['Muscular'],'Gang member':['Muscular'],'Sex worker':['Muscular'],Student:['Athletic'],Thug:['Muscular']};
  const statuses={Businessman:['Walking'],'Drunk man':['Distracted'],'Drunk woman':['Distracted'],'Homeless person':['Loitering'],Junkie:['Loitering'],Laborer:['Distracted'],'Police officer':['Walking'],'Sex worker':['Distracted'],Thug:['Loitering','Walking']};
  function advice(mark,skill,build,activity){
    if(!rating.has(mark))return null;
    const warning=builds[mark]?.includes(build)?build:statuses[mark]?.includes(activity)?activity:null;
    let band='unknown',label='Skill not shown';
    if(warning){band='risk';label='Caution: '+warning;}
    else if(Number.isFinite(skill)&&skill>=0&&skill<=100){
      const distance=Math.max(0,starts.filter(start=>skill>=start).length-1)-tier.get(mark);
      [band,label]=distance<0?['risk','Above your skill band']:distance===0?['ideal','Recommended band']:distance===1?['easy','Easier band']:['easy','Well below your skill band'];
    }
    return {rating:rating.get(mark),band,label};
  }
  const range=(min,max)=>{
    const bound=(v,f)=>v===''||v==null||!Number.isFinite(Number(v))?f:Math.min(350,Math.max(1,Math.trunc(Number(v))));
    const a=bound(min,1),b=bound(max,350);return [Math.min(a,b),Math.max(a,b)];
  };
  const rootSelector='.pickpocketing-root,.pickpocket-root,.crimes-app .crime-root';
  const titles='[class*="titleAndProps"]',wrappers='[class*="crimeOptionWrapper___"],.crime-option';
  const route=()=>global.location.pathname==='/page.php'&&new URLSearchParams(global.location.search).get('sid')?.toLowerCase()==='crimes'&&/^#\/?pickpocket(?:ing)?(?:[/?]|$)/i.test(global.location.hash);
  function readSkill(root){
    const panel=root.closest('.crimes-app')||root;
    for(const el of panel.querySelectorAll('#crime-stats-panel,[id*="crime-stats" i],[class*="crimeStats" i],[aria-label*="crime skill" i]')){
      const value=[el.getAttribute('aria-label'),el.textContent].join(' ').match(/\b(?:crime\s*skill|skill(?:\s*level)?)\s*[:\s]*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
      if(value!==undefined&&Number(value)<=100)return Number(value);
    }
    return null;
  }
  function connect({eligible}){
    const doc=global.document,key='slink.pickpocket.range.v1';
    let root=null,tool=null,style=null,observer=null,discovery=null,frame=null,stopped=false,enabled=false;
    let known=new Map(),limits=[1,350];
    try{const saved=JSON.parse(global.localStorage.getItem(key));if(Array.isArray(saved))limits=range(...saved);}catch{}
    const active=()=>!stopped&&enabled&&!doc.hidden&&route()&&eligible();
    const add=(tag,txt)=>{const el=doc.createElement(tag);if(txt)el.textContent=txt;return el;};
    const clean=()=>{for(const [card,badge] of known){card.removeAttribute('data-slink-pickpocket-filter');badge.remove();}known.clear();};
    const remove=()=>{if(frame!==null)global.cancelAnimationFrame(frame);frame=null;observer?.disconnect();observer=null;discovery?.disconnect();discovery=null;clean();tool?.remove();tool=null;style?.remove();style=null;root=null;};
    function controls(){
      if(tool?.isConnected)return;
      tool=add('div');tool.dataset.slinkPickpocketTools='';tool.setAttribute('aria-label','SLINK Pickpocket filters');
      tool.append(add('strong','Pickpocket target rating'));
      const fields=['Min','Max'].map((name,i)=>{const label=add('label',name+' '),input=add('input');input.type='number';input.min='1';input.max='350';input.step='1';input.value=limits[i];label.append(input);tool.append(label);return input;});
      function set(a,b){limits=range(a,b);fields.forEach((field,i)=>field.value=limits[i]);try{global.localStorage.setItem(key,JSON.stringify(limits));}catch{}schedule();}
      fields.forEach(field=>field.addEventListener('change',()=>set(fields[0].value,fields[1].value)));
      const reset=add('button','Show all');reset.type='button';reset.onclick=()=>set(1,350);
      const count=add('span');count.dataset.slinkPickpocketCount='';tool.append(reset,count);
      root.before(tool);
    }
    function render(){
      frame=null;if(!active()||!root?.isConnected)return;
      const skill=readSkill(root),next=new Map();let visible=0;
      for(const group of root.querySelectorAll(titles)){
        const card=group.closest(wrappers),title=group.firstElementChild;
        if(!card||!title||next.has(card))continue;
        const name=title.textContent.trim().replace(/\s+/g,' ');
        const mark=rating.has(name)?name:[...rating.keys()].find(key=>name.startsWith(key+' '));
        const build=group.children[1]?.textContent.trim().match(/^[A-Za-z]+/)?.[0];
        const activity=card.querySelector('[class*="activity" i]')?.textContent.trim().match(/^[A-Za-z]+/)?.[0];
        const info=advice(mark,skill,build,activity);if(!info)continue;
        let badge=known.get(card);
        if(!badge||badge.parentElement!==group){badge?.remove();badge=add('span');badge.dataset.slinkPickpocketBadge='';group.append(badge);}
        const label=info.rating+' · '+info.label;if(badge.textContent!==label)badge.textContent=label;
        badge.dataset.band=info.band;next.set(card,badge);
        if(info.rating>=limits[0]&&info.rating<=limits[1]){visible++;card.removeAttribute('data-slink-pickpocket-filter');}
        else card.dataset.slinkPickpocketFilter=card.closest('.virtual-item,[class*="virtualItem___"],[style*="position: absolute"]')?'mask':'hide';
      }
      for(const [card,badge] of known)if(!next.has(card)){card.removeAttribute('data-slink-pickpocket-filter');badge.remove();}
      known=next;
      if(!known.size){tool?.remove();tool=null;return;}
      controls();const count=tool.querySelector('[data-slink-pickpocket-count]');
      const text=visible+' of '+known.size+' loaded targets';if(count.textContent!==text)count.textContent=text;
    }
    function schedule(){if(frame===null&&active())frame=global.requestAnimationFrame(render);}
    function discover(){
      const next=doc.querySelector(rootSelector);
      if(next===root)return;
      observer?.disconnect();clean();tool?.remove();tool=null;root=next;
      if(!root)return;
      observer=new global.MutationObserver(records=>{if(records.some(r=>!(r.target.nodeType===1?r.target:r.target.parentElement)?.closest('[data-slink-pickpocket-badge]')&&!(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].every(n=>n.matches?.('[data-slink-pickpocket-badge]')))))schedule();});
      observer.observe(root.closest('.crimes-app')||root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label']});
      schedule();
    }
    function sync(){
      if(!active()){remove();return;}
      if(!style){
        style=add('style');style.textContent=`
[data-slink-pickpocket-tools]{position:static;display:flex;flex-wrap:wrap;align-items:center;gap:.5em;margin:.5em 0;padding:.5em;color:var(--slt-text,#eee);background:var(--slt-control,#272c34);border:1px solid var(--slt-border,#69717d);border-radius:6px}
[data-slink-pickpocket-tools] :is(input,button){font:inherit;color:inherit;background:var(--slt-bg,#191d24);border:1px solid var(--slt-border,#69717d);border-radius:4px;padding:.35em}
[data-slink-pickpocket-tools] input{width:5em}
[data-slink-pickpocket-badge]{display:inline-block;max-width:100%;font-size:.82em;font-weight:700;color:#f2f2f2;background:#363a46;padding:.12em .38em;border-radius:4px;pointer-events:none}
[data-slink-pickpocket-badge][data-band=ideal]{background:#1b512c}[data-slink-pickpocket-badge][data-band=easy]{background:#31566b}[data-slink-pickpocket-badge][data-band=risk]{background:#812f3d}
[data-slink-pickpocket-filter=hide]{display:none!important}[data-slink-pickpocket-filter=mask],[data-slink-pickpocket-filter=mask] *{visibility:hidden!important;pointer-events:none!important}
`;doc.head.append(style);
      }
      if(!discovery&&doc.body){
        discovery=new global.MutationObserver(records=>{if(!root?.isConnected||records.some(r=>[...r.addedNodes].some(n=>n.matches?.(rootSelector)||n.querySelector?.(rootSelector))))discover();});
        discovery.observe(doc.querySelector('#mainContainer')||doc.body,{subtree:true,childList:true});
      }
      discover();schedule();
    }
    const events=[[global,'hashchange',sync],[global,'popstate',sync],[global,'pageshow',sync],[global,'pagehide',remove],[global,'focus',sync],[global,'blur',sync],[doc,'visibilitychange',sync]];
    for(const [node,event,handler] of events)node.addEventListener(event,handler);
    return {setEnabled(value){enabled=value===true;sync();},sync,dispose(){stopped=true;remove();for(const [node,event,handler] of events)node.removeEventListener(event,handler);}};
  }
  global.SLINK_PICKPOCKET=Object.freeze({advice,range,connect});
  const S=global.SLINK_EXTENSION;
  if(!S?.core?.pageActivity||!global.document||new URLSearchParams(global.location.search).get('sid')?.toLowerCase()!=='crimes')return;
  const activity=S.core.pageActivity,toggle='crimes.pickpocket.enabled',session='access.session.v1';
  let allowed=false,expires=0,revision=0;
  const helper=connect({eligible:()=>allowed&&expires>Date.now()&&activity.eligible()});
  async function refresh(){
    const rev=++revision;
    try{
      const [enabled,access]=await Promise.all([S.core.storage.get(toggle,false),S.core.storage.get(session,null)]);
      if(rev!==revision)return;
      allowed=enabled===true&&S.core.permissions.hasScope(access||{},'slink.adhd.alerts');expires=Number(access?.expiresAt)||0;
      helper.setEnabled(allowed);
    }catch{if(rev===revision){allowed=false;helper.setEnabled(false);}}
  }
  activity.subscribe(()=>{helper.sync();if(activity.eligible())void refresh();});
  global.chrome?.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&[toggle,session].some(k=>Object.hasOwn(changes,S.STORAGE_PREFIX+k)))void refresh();});
  void refresh();
})(globalThis);
