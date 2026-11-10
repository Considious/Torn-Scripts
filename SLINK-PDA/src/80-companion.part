;(function installCompanion(global) {
  'use strict';
  const catalogue = new Map();
  const clamp = (v,a,b) => Math.min(Math.max(v,a),b);
  const smooth = v => { v=clamp(v,0,1); return v*v*(3-2*v); };
  const critical = 'a,button,input,textarea,select,label,summary,[contenteditable],[tabindex]:not([tabindex="-1"]),[role="button"],[role="link"],[role="dialog"],[aria-modal="true"],header,nav,#chatRoot,#sidebar';
  function register(entry) { catalogue.set(entry.id,Object.freeze(entry)); }
  function create({allowed,open,asset,settingsParent,isObscured=()=>false,storage}) {
    const doc=global.document, motion=global.matchMedia('(prefers-reduced-motion: reduce)'), key='slink.companions.v1';
    let settings={};
    try { storage??=global.localStorage;settings=JSON.parse(storage.getItem(key))||{}; } catch {}
    const write=()=>{ try { void Promise.resolve(storage?.setItem(key,JSON.stringify(settings))).catch(()=>{}); } catch {} };
    let entry=null, art=null, x=0,y=0, facing=1, state='idle', started=0, frame=0, timer=0, speechTimer=0, resumeSpeech=null, dragging=null, mouseOver=false, initialized=false, lastLine='', lastTalk=0, pending=null, latest=null, focused=true, safetyFrame=0;
    const samples=new Map(), controller=new AbortController(), {signal}=controller;
    const host=doc.createElement('div');
    host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9500;overflow:hidden';
    host.hidden=true;
    const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML='<style>:host([hidden]){display:none!important}#position{position:absolute;left:0;top:0;width:105px;height:96px}#jack{display:block;position:absolute;inset:0;padding:0;border:0;background:none;cursor:grab;touch-action:none;pointer-events:auto;color:white}#jack[hidden],#speech[hidden]{display:none}canvas{width:100%;height:100%;pointer-events:none}#speech{position:absolute;width:min(165px,43vw);border:1px solid #ec974b;background:#211620;color:#fff2e1;border-radius:10px;padding:8px;font:13px/1.3 system-ui;pointer-events:auto;cursor:pointer;box-shadow:0 3px 12px #0009}</style><div id="position"><button type="button" id="jack"><canvas width="220" height="200"></canvas></button><button type="button" id="speech" hidden></button></div>';
    const box=shadow.querySelector('#position'), jack=shadow.querySelector('#jack'), speech=shadow.querySelector('#speech'), canvas=shadow.querySelector('canvas'), ctx=canvas.getContext('2d');
    doc.body.append(host);
    const panel=doc.createElement('details');
    panel.style.cssText='padding:5px 9px;color:inherit;font:13px/1.5 system-ui;max-width:100%';
    panel.innerHTML='<summary>Companion settings</summary><div style="display:grid;gap:5px;padding:5px 0"><label>Companion <select data-pref="id"></select></label><label>Movement <select data-pref="movement"><option value="wander">Wander</option><option value="stay">Stay where I put him</option></select></label><label>Companion alerts <select data-pref="alerts"><option value="all">All</option><option value="important">Important only</option><option value="minimal">Minimal</option><option value="silent">Silent</option></select></label><label><input type="checkbox" data-pref="chatter"> Idle chatter</label><label><input type="checkbox" data-pref="reduced"> Reduced motion</label></div>';
    settingsParent.append(panel);
    const field=name=>panel.querySelector('[data-pref="'+name+'"]');
    const reduced=()=>Boolean(settings.reduced)||motion.matches;
    const visible=()=>!doc.hidden&&focused&&!isObscured();
    const bounds=()=>{const v=global.visualViewport;const l=v?.offsetLeft||0,t=v?.offsetTop||0,w=v?.width||global.innerWidth,h=v?.height||global.innerHeight;return {l,t,w,h};};
    function fit(a,b) {const {l,t,w,h}=bounds();return [clamp(a,l,l+Math.max(0,w-105)),clamp(b,t,t+Math.max(0,h-96))];}
    function safeRect(a,b,w,h){
      // Hit-test only at interaction boundaries and before an occasional move.
      for(const i of [.12,.5,.88])for(const j of [.13,.5,.87]){
        const nodes=doc.elementsFromPoint(a+i*w,b+j*h);
        if(nodes.some(n=>n!==host&&n.closest?.(critical)))return false;
      }
      return true;
    }
    function place(a,b,allowHide=true){
      [x,y]=fit(a,b);box.style.transform='translate3d('+x+'px,'+y+'px,0)';
      jack.hidden=allowHide&&!safeRect(x,y,105,96);
    }
    function spots(){
      const {l,t,w,h}=bounds();
      return [.2,.39,.61,.77].flatMap(height=>[l+4,l+w-109].map(side=>fit(side,t+(h-96)*height))).filter(([a,b])=>safeRect(a,b,105,96));
    }
    function restorePosition(){
      const p=settings.positions?.[entry?.id],{l,t,w,h}=bounds();
      if(p?.manual&&Number.isFinite(p.x)&&Number.isFinite(p.y)){
        place(l+p.x*Math.max(0,w-105),t+p.y*Math.max(0,h-96));return;
      }
      const spot=spots().at(-1);if(spot)place(...spot);else place(l,t);
    }
    function paint(reach=0,dy=0,squash=0,glow=false,tilt=0){
      if(!ctx||!art?.naturalWidth)return;
      ctx.clearRect(0,0,220,200);ctx.save();
      if(facing<0){ctx.translate(220,0);ctx.scale(-1,1);}
      if(tilt){ctx.translate(110,190);ctx.rotate(tilt);ctx.translate(-110,-190);}
      ctx.filter=glow?'brightness(1.16)':'none';
      if(entry?.draw){try{entry.draw(ctx,art,{reach,dy,squash,glow,tilt,width:220,height:200});}finally{ctx.restore();}return;}
      const w=171,h=w*art.naturalHeight/art.naturalWidth,foot=194, rows=36;
      const height=f=>foot-h*(1-f)+dy*(1-f)+squash*(1-f*f);
      for(let i=0;i<rows;i++){
        const a=i/rows,b=(i+1)/rows,follow=a<.59?1:Math.pow((1-a)/.41,1.12);
        ctx.drawImage(art,0,art.naturalHeight*a,art.naturalWidth,art.naturalHeight/rows,(220-w)/2+reach*follow,height(a),w,height(b)-height(a)+.5);
      }
      ctx.restore();
    }
    function idle(){
      global.clearTimeout(timer);
      if(!entry||!visible())return;
      timer=global.setTimeout(()=>{
        if(!entry||!visible()||dragging||mouseOver||!speech.hidden||jack.hidden){idle();return;}
        if(settings.chatter&&Date.now()-lastTalk>180000){say('idle');return;}
        if(reduced()){paint(0,0,18);idle();return;}
        if(settings.movement==='stay'||settings.positions?.[entry.id]?.manual){animate('sleep');return;}
        if(Math.random()<.45){animate('sleep');return;}
        const {l,w}=bounds(), left=x<l+w/2, edge=left?l:l+w-105;
        if(Math.abs(x-edge)<12&&Math.random()<.5){facing=left?1:-1;animate('peek');return;}
        const target=fit(x+(left?1:-1)*Math.min(150,w*.4),y);
        const direction=target[0]>=x?1:-1;
        if(Math.abs(target[0]-x)>15&&[.25,.5,.75,1].every(f=>safeRect(x+(target[0]-x)*f,y,105,96))){
          facing=direction;animate('walk',target[0]);
        }else animate('sleep');
      },18000+Math.random()*24000);
    }
    function stop(){global.cancelAnimationFrame(frame);frame=0;state='idle';box.style.transform='translate3d('+x+'px,'+y+'px,0)';}
    function animate(kind,destination=x){
      stop();state=kind;started=global.performance.now();
      const from=x,steps=Math.max(1,Math.ceil(Math.abs(destination-from)/20));
      const duration={walk:steps*410,peek:1950,sleep:2450,alert:730,ignored:2500}[kind]||700;
      if(reduced()){paint(0,kind==='alert'?-8:0,kind==='ignored'||kind==='sleep'?28:0,kind==='alert');return;}
      const tick=now=>{
        if(!visible()||dragging||mouseOver||(kind==='walk'||kind==='peek')&&!speech.hidden){stop();paint();idle();return;}
        const ms=now-started,t=ms/1000,p=clamp(ms/duration,0,1);
        let reach=0,dy=0,squash=0,edge=0,tilt=0;
        if(kind==='walk'){
          const step=p*steps,k=step%1,front=smooth(k/.58),rear=smooth((k-.34)/.66);
          x=from+(destination-from)*(Math.floor(step)+rear)/steps;
          reach=(front-rear)*32;dy=-Math.sin(Math.PI*k)*5;
        }else if(kind==='alert'){dy=-13*Math.sin(p*Math.PI)*Math.exp(-p*.9);}
        else if(kind==='sleep'){squash=45*smooth(p*4);tilt=.24*smooth(p*4);}
        else if(kind==='ignored'){squash=t<1.4?36*smooth(t/.24):36*Math.cos((t-1.4)*17)*Math.exp(-(t-1.4)*6);}
        else if(kind==='peek'){
          edge=-facing*(t<.42?91*smooth(t/.42):t<.91?91-39*smooth((t-.58)/.33):52*(1-smooth((t-1.6)/.35)));
        }
        box.style.transform='translate3d('+(x+edge)+'px,'+y+'px,0)';
        paint(reach,dy,squash,kind==='alert'&&p<.85,tilt);
        if(p<1)frame=global.requestAnimationFrame(tick);else{stop();if(kind!=='sleep')paint();idle();}
      };
      frame=global.requestAnimationFrame(tick);
    }
    function clearSpeech(){global.clearTimeout(speechTimer);resumeSpeech=null;speech.hidden=true;idle();}
    function say(category){
      if(!entry||!visible()||host.hidden||jack.hidden||dragging||mouseOver)return false;
      const pool=(entry.phrases[category]||entry.phrases.general||[]).filter(line=>line!==lastLine);
      if(!pool.length)return false;
      const {l,t,w,h}=bounds(), bw=Math.min(165,w*.43), bh=64;
      const candidates=[[x+92,y-16],[x-bw+10,y-16],[x+3,y-bh],[x+3,y+94]];
      const spot=candidates.map(([a,b])=>[clamp(a,l,l+w-bw),clamp(b,t,t+h-bh)]).find(([a,b])=>safeRect(a,b,bw,bh));
      if(!spot)return false;
      lastLine=pool[Math.floor(Math.random()*pool.length)];lastTalk=Date.now();
      speech.textContent=lastLine;speech.style.left=(spot[0]-x)+'px';speech.style.top=(spot[1]-y)+'px';speech.hidden=false;
      const expire=()=>{global.clearTimeout(speechTimer);speechTimer=global.setTimeout(clearSpeech,5200);};
      resumeSpeech=expire;expire();
      if(category!=='idle')animate(category==='ignored'?'ignored':'alert');else stop();
      return true;
    }
    function sync(){
      const eligible=[...catalogue.values()].filter(item=>allowed(item.scope));
      const requested=settings.id??eligible.find(item=>item.defaultEnabled)?.id;
      const next=eligible.find(item=>item.id===requested)||null;
      panel.hidden=!eligible.length;
      const signature=eligible.map(item=>item.id).join(',');
      if(field('id').dataset.items!==signature){
        field('id').dataset.items=signature;
        field('id').replaceChildren(new Option('Off','off'),...eligible.map(item=>new Option(item.name,item.id)));
      }
      field('id').value=next?.id||'off';
      field('movement').value=settings.movement||(settings.positions?.[next?.id]?.manual?'stay':'wander');field('alerts').value=settings.alerts||'important';
      field('chatter').checked=Boolean(settings.chatter);field('reduced').checked=Boolean(settings.reduced)||motion.matches;
      if(entry===next&&initialized)return;
      stop();clearSpeech();pending=null;initialized=true;entry=next;host.hidden=true;
      if(!entry)return;
      jack.setAttribute('aria-label',entry.name+' — Open SLINK. Drag to move.');
      const image=new Image();art=image;
      image.onload=()=>{if(art!==image||signal.aborted)return;restorePosition();host.hidden=isObscured();paint();idle();};
      image.src=asset(entry);
    }
    function observe(source,rows){
      if(!Array.isArray(rows))return;
      const byId=new Map(rows.filter(row=>row?.id).map(row=>[String(row.id),row])),before=samples.get(source);
      samples.set(source,byId);
      if(!before||!entry)return;
      const now=Date.now(), mode=settings.alerts||'important';
      if(mode==='silent'||!visible())return;
      const current=rows.find(row=>row?.id&&!before.has(String(row.id))&&(mode==='all'||row.important&&(mode!=='minimal'||row.critical)));
      if(current&&now-lastTalk>(current.critical?20000:60000)&&say(current.category||'general')){
        latest={source,id:String(current.id)};
        pending=current.important?{...latest,after:now+180000}:null;
      }else if(pending&&pending.source===source){
        if(!byId.has(pending.id))pending=null;
        else if(mode!=='minimal'&&now>=pending.after&&now-lastTalk>90000&&say('ignored'))pending=null;
      }
    }
    function onVisibility(){
      if(!entry||!art?.naturalWidth)return;
      host.hidden=isObscured();
      if(!visible()){stop();clearSpeech();global.clearTimeout(timer);}
      else{place(x,y);if(jack.hidden&&!settings.positions?.[entry.id]?.manual)restorePosition();paint();idle();}
    }
    panel.addEventListener('change',event=>{
      const name=event.target.dataset.pref;if(!name)return;
      settings[name]=event.target.type==='checkbox'?event.target.checked:event.target.value;
      if(name==='movement'&&settings.movement==='wander'&&settings.positions?.[entry?.id])settings.positions[entry.id].manual=false;
      if(name==='alerts'&&settings.alerts==='silent'){clearSpeech();pending=null;}
      write();sync();if(name==='reduced'){stop();paint();}idle();
    },{signal});
    jack.addEventListener('pointerdown',event=>{
      if(event.button!==0||!entry)return;
      stop();clearSpeech();dragging={id:event.pointerId,a:event.clientX,b:event.clientY,x,y,moved:false};jack.setPointerCapture(event.pointerId);
    },{signal});
    jack.addEventListener('pointermove',event=>{
      if(dragging?.id!==event.pointerId)return;
      const dx=event.clientX-dragging.a,dy=event.clientY-dragging.b;
      if(Math.hypot(dx,dy)>7)dragging.moved=true;
      if(dragging.moved){place(dragging.x+dx,dragging.y+dy,false);paint(0,-5,0);}
    },{signal});
    function finish(event){
      if(dragging?.id!==event.pointerId)return;
      const moved=dragging.moved;dragging=null;
      if(moved&&entry){
        const {l,t,w,h}=bounds();
        if(!safeRect(x,y,105,96)){
          const fallback=spots().sort((a,b)=>Math.hypot(a[0]-x,a[1]-y)-Math.hypot(b[0]-x,b[1]-y))[0];
          if(fallback)place(...fallback);
        }
        settings.movement='stay';field('movement').value='stay';
        settings.positions??={};
        settings.positions[entry.id]={x:(x-l)/Math.max(1,w-105),y:(y-t)/Math.max(1,h-96),manual:true};
        write();place(x,y);paint();
      }
      else if(event.type==='pointerup'){clearSpeech();pending=null;open();onVisibility();}
      idle();
    }
    for(const type of ['pointerup','pointercancel','lostpointercapture'])jack.addEventListener(type,finish,{signal});
    jack.addEventListener('click',event=>{if(event.detail===0&&event.pointerType!=='touch'&&event.pointerType!=='mouse'){open();onVisibility();}},{signal});
    jack.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')mouseOver=true;},{signal});
    jack.addEventListener('pointerleave',()=>{mouseOver=false;idle();},{signal});
    speech.addEventListener('pointerenter',()=>global.clearTimeout(speechTimer),{signal});
    speech.addEventListener('pointerleave',()=>resumeSpeech?.(),{signal});
    speech.addEventListener('click',clearSpeech,{signal});
    global.addEventListener('focus',()=>{focused=true;onVisibility();},{signal});
    global.addEventListener('blur',()=>{focused=false;onVisibility();},{signal});
    global.addEventListener('resize',onVisibility,{signal});
    function recheck(){
      if(!entry||!visible()||dragging||safetyFrame)return;
      safetyFrame=global.requestAnimationFrame(()=>{
        safetyFrame=0;if(!entry||!visible()||dragging)return;
        if(!safeRect(x,y,105,96)){stop();clearSpeech();place(x,y);if(!settings.positions?.[entry.id]?.manual)restorePosition();}
        else if(jack.hidden)place(x,y);
        if(!speech.hidden&&!safeRect(x+parseFloat(speech.style.left),y+parseFloat(speech.style.top),speech.offsetWidth,speech.offsetHeight))clearSpeech();
      });
    }
    global.addEventListener('scroll',recheck,{capture:true,passive:true,signal});
    doc.addEventListener('click',recheck,{capture:true,signal});
    global.visualViewport?.addEventListener('resize',onVisibility,{signal});
    doc.addEventListener('visibilitychange',onVisibility,{signal});
    motion.addEventListener('change',()=>{sync();stop();paint();idle();},{signal});
    sync();
    return Object.freeze({sync,observe,onVisibility,destroy(){controller.abort();stop();global.cancelAnimationFrame(safetyFrame);global.clearTimeout(timer);global.clearTimeout(speechTimer);host.remove();panel.remove();}});
  }
  function efficiencyRows(rows) {
    const categories={energyFull:'energy_full',nerveFull:'nerve_high',energyRefill:'energy_high',nerveRefill:'nerve_high',drugCooldown:'cooldown_ready',medicalCooldown:'cooldown_ready',boosterCooldown:'cooldown_ready'};
    return rows.filter(row=>row?.id).map(row=>{const id=String(row.id),category=categories[id]||(/retal/i.test(id)?'retal':/stakeout/i.test(id)?'war_target':/market/i.test(id)?'market_alert':/travel|flight|abroad/i.test(id)?'travel_ready':'general');return {id,category,important:row.tone==='urgent'||['energyFull','nerveFull'].includes(id)||['retal','war_target','market_alert','travel_ready'].includes(category),critical:id==='energyFull'||category==='retal'};});
  }
  global.SLINK_COMPANIONS=Object.freeze({register,create,efficiencyRows});
  register({id:'jack-o-slink',name:'Jack O’ Slink',scope:'slink.theme.halloween',asset:'jack-o-slink.webp',defaultEnabled:true,phrases:{
    energy_high:['There’s energy to spare. A terrible thing to waste.','Fresh energy. Shall we make poor choices?'],
    energy_full:['Your energy’s rotting. Use it.','A full bar and no violence? Disturbing.','Don’t let that energy die on the vine.'],
    nerve_high:['Nerve’s ripe. Go make bad decisions.','Those crimes aren’t committing themselves.'],
    cooldown_ready:['The coast is clear. Mostly.','Back for another round, are we?'],
    war_target:['The harvest is ready.','Go on then. Reap.'],
    retal:['Someone’s begging to be haunted.','Another soul for the stack.'],
    market_alert:['Something valuable crawled out of the dark.','A bargain has risen from the grave.'],
    travel_ready:['The night flight is calling.','Leaving so soon? How suspicious.'],
    chat_mention:['Someone spoke your name. I’d investigate.','Psst. You’ve been summoned.'],
    idle:['A lovely night for terrible behavior.','The night is young. Your targets are not.'],
    ignored:['Still ignoring me? Bold.','Don’t make me haunt you about this.'],
    general:['Something stirred. Thought you’d want to know.','Psst. A little trouble just turned up.']
  }});
})(globalThis);
