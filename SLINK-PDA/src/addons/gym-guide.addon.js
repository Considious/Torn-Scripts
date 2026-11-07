(function(g){
  'use strict';
  const stats=['strength','speed','defense','dexterity'];
  const rules=[
    ['Balboas Gym',"Cha Cha's",['defense','dexterity'],['strength','speed']],
    ['Frontline Fitness',"Cha Cha's",['strength','speed'],['defense','dexterity']],
    ['Gym 3000',"George's",['strength']],['Mr. Isoyamas',"George's",['defense']],
    ['Total Rebound',"George's",['speed']],['Elites',"George's",['dexterity']]
  ];
  const exact=v=>typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v.trim().replaceAll(',',''))?Number(v.trim().replaceAll(',','')):null;
  const whole=n=>Math.ceil(n).toLocaleString();
  function assess(values,prerequisites){
    const known=stats.every(k=>Number.isFinite(values[k])&&values[k]>0);
    return rules.map(([name,prereq,main,other])=>{
      const gate=prerequisites[prereq]??null;
      if(!known)return {name,prereq,gate,met:null,gap:null};
      const sum=keys=>keys.reduce((n,k)=>n+values[k],0);
      const target=1.25*(other?sum(other):Math.max(...stats.filter(k=>k!==main[0]).map(k=>values[k])));
      const gap=Math.max(0,target-sum(main));
      return {name,prereq,gate,met:gap===0,gap,main};
    });
  }
  g.SLINK_GYM_GUIDE=Object.freeze({assess,exact});
  if(!g.document||location.pathname!=='/gym.php')return;
  const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const normalize=v=>String(v??'').toLowerCase().replaceAll('’',"'").trim();
  let mounted,queued=false;
  function mount(root){
    const box=make('details'),heading=make('summary','SLINK Gym progress'),progress=make('p'),gyms=make('ul');
    box.style.cssText='border:1px solid currentColor;border-radius:.35rem;padding:.45rem;margin:.5rem 0';
    box.append(heading,progress,gyms,make('small','Based on the stats and gym information Torn shows on this page. Torn makes the final eligibility decision.'));
    const anchor=root.querySelector('[class*="notificationText__"]')?.closest('[class*="notification__"]');
    if(anchor)anchor.after(box);else root.prepend(box);
    let previous='';
    const observer=new MutationObserver(records=>{if(records.some(r=>!box.contains(r.target)))schedule();});
    const render=()=>{
      if(!box.open||document.hidden)return;
      const values=Object.fromEntries(stats.map(k=>[k,exact(root.querySelector('[class*="'+k+'___"] [class*="propertyTitle___"] [class*="propertyValue___"]')?.textContent)]));
      const gymButtons=Array.from(root.querySelectorAll('[class*="gymButton_"]'));
      const label=n=>normalize(n.getAttribute('aria-label')||n.title||n.querySelector('[class*="gymName_"]')?.textContent||n.textContent);
      const prereqs={};
      for(const name of ["Cha Cha's","George's","Last Round"]){
        const match=gymButtons.find(n=>label(n).includes(normalize(name)));
        const classes=Array.from(match?.classList||[]);
        if(classes.some(c=>/^(?:active|owned|unlocked)_/.test(c)))prereqs[name]=true;
        else if(classes.some(c=>/^locked_/.test(c)))prereqs[name]=false;
      }
      const next=gymButtons.find(n=>Array.from(n.classList).some(c=>/^inProgress_/.test(c)));
      const pct=next?.querySelector('[class*="percentage_"]')?.textContent.trim().match(/^(\d+(?:\.\d+)?)\s*%$/)?.[1];
      const nextName=next?.querySelector('[class*="gymName_"]')?.textContent.trim()||next?.getAttribute('aria-label')||'Next gym';
      const headline=pct!==undefined&&Number(pct)<=100?nextName+' — '+pct+'% toward unlock.':'Torn isn’t showing next-gym progress here. Open the gym list to check.';
      const report=assess(values,prereqs).map(x=>{
        const gate=x.gate===true?x.prereq+' unlocked':x.gate===false?x.prereq+' still locked':x.prereq+' unlock not verified';
        const balance=x.met===null?'stat balance unknown':x.met?'stat balance met':'needs about '+whole(x.gap)+' more '+x.main.join(' + ')+' at current other stats';
        return x.name+': '+(x.gate===true&&x.met?'Meets listed requirements · ':'')+balance+' · '+gate;
      });
      report.push('Sports Science Lab: '+(prereqs['Last Round']===true?'Last Round unlocked':prereqs['Last Round']===false?'Last Round still locked':'Last Round unlock not verified')+' · Xanax and Ecstasy count not shown here.');
      const signature=JSON.stringify([headline,report]);if(signature===previous)return;previous=signature;
      progress.textContent=headline;gyms.replaceChildren(...report.map(s=>make('li',s)));
    };
    box.ontoggle=()=>{if(box.open){observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','aria-label','title']});render();}else observer.disconnect();};
    return {root,box,render,dispose(){observer.disconnect();box.remove();}};
  }
  function sync(){
    queued=false;if(document.hidden)return;
    const root=document.querySelector('#gymroot');
    if(root&&mounted?.root===root&&mounted.box.isConnected){mounted.render();return;}
    mounted?.dispose();mounted=root?mount(root):null;
  }
  function schedule(){if(!queued&&!document.hidden){queued=true;requestAnimationFrame(sync);}}
  function start(){
    new MutationObserver(()=>{if(!mounted?.box.isConnected)schedule();}).observe(document.querySelector('#mainContainer')||document.body,{childList:true,subtree:true});
    document.addEventListener('visibilitychange',schedule);sync();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
