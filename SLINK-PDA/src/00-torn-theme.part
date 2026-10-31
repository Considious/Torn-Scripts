(function installTornTheme(global) {
  'use strict';
  // Original SLINK implementation. Selector/variable reference: Verified-Madgod/
  // torn-theme-hub. We do not load its runtime, palettes or hardcoded-color overrides.
  const STORAGE_KEY='ui.tornTheme.v1', ATTRIBUTE='data-slink-torn-theme', STYLE_ID='slink-torn-page-theme';
  const DEFAULTS=Object.freeze({enabled:false,background:true,frames:true,ornaments:false,chat:false,opacity:92});
  function normalize(value={}) {
    const next={};for(const [name,fallback]of Object.entries(DEFAULTS))next[name]=name==='opacity'
      ?Number.isFinite(Number(value[name]))?Math.max(0,Math.min(100,Math.round(Number(value[name])))):fallback
      :typeof value[name]==='boolean'?value[name]:fallback;
    return next;
  }
  function asset(value) {
    if(!value||value==='none')return 'none';
    const match=String(value).match(/^url\("([^"\\]+)"\)$/);if(!match)return 'none';
    try{const url=new URL(match[1]);
      const remote=url.protocol==='https:'&&url.origin==='https://raw.githubusercontent.com'&&url.pathname.startsWith('/Considious/SLINK-Cloudflare-Services/main/themes/assets/');
      const packaged=url.protocol==='chrome-extension:'&&url.pathname.startsWith('/assets/themes/');
      if((remote||packaged)&&!url.search&&!url.hash&&!url.username&&!url.password&&/\.(png|jpe?g|webp|svg)$/i.test(url.pathname)&&!/[\s<>;{}]/.test(match[1]))return 'url("'+url.href+'")';
    }catch{}return 'none';
  }
  const S='html['+ATTRIBUTE+']';
  const CSS=`
${S} body{
  --default-bg-panel-color:var(--slt-panel)!important;--default-bg-panel-active-color:var(--slt-control)!important;
  --default-content-panel-color:var(--slt-text)!important;--default-content-title-color:var(--slt-text)!important;
  --default-color:var(--slt-text)!important;--default-blue-color:var(--slt-link)!important;--default-blue-color-new:var(--slt-link)!important;
  --default-blue-hover-color:var(--slt-link)!important;--content-title-color:var(--slt-text)!important;
  --appheader-links-color:var(--slt-muted)!important;--appheader-title-color:var(--slt-text)!important;
  --appheader-dropdown-background:var(--slt-panel)!important;--appheader-dropdown-links-color:var(--slt-text)!important;
  --autocomplete-background-color:var(--slt-control)!important;--autocomplete-color:var(--slt-text)!important;
  --btn-background:var(--slt-control)!important;--btn-color:var(--slt-text)!important;
  --btn-hover-background:var(--slt-bg)!important;--btn-hover-color:var(--slt-text)!important;--btn-text-shadow:none!important;
  --bbc-body-bg-color:var(--slt-panel)!important;--bbc-color:var(--slt-text)!important;
  --bbc-input-bg-color:var(--slt-control)!important;--bbc-input-color:var(--slt-text)!important;
  background-color:var(--slt-bg)!important;color:var(--slt-text)!important;
}
${S}[data-slink-torn-background] body{background-image:var(--slt-blood),var(--slt-roses),var(--slt-frame),var(--slt-image)!important;background-position:center top!important;background-size:100% auto!important;background-repeat:no-repeat!important;}
${S}[data-slink-torn-background] .backdrops-container{visibility:hidden!important;}
${S}[data-slink-torn-background] :is(.content-wrapper,#mainContainer,.content){background-color:transparent!important;}
${S} :is(#topHeaderBanner,.header-wrapper-top,.header-wrapper-bottom,#sidebar){background-color:var(--slt-panel)!important;}
${S} :is(.content-title,.title-black,.title-gray){background-color:var(--slt-control)!important;color:var(--slt-text)!important;}
${S} :is(.cont-gray,.cont-white){background-color:var(--slt-panel)!important;color:var(--slt-text)!important;}
${S}[data-slink-torn-frames] :is(.cont-gray,.cont-white){border-image-source:var(--slt-texture)!important;border-image-slice:25% 8% fill!important;border-image-width:20px!important;border-image-repeat:stretch!important;padding:28px 22px!important;}
${S} :is(#mainContainer,.content-wrapper) :is(input[type=text],input[type=search],input[type=password],textarea,select):not(:disabled){background-color:var(--slt-control)!important;color:var(--slt-text)!important;caret-color:var(--slt-text);}
${S} :is(#mainContainer,.content-wrapper) :is(input,textarea,select):focus-visible{outline:2px solid var(--slt-accent);outline-offset:2px;}
${S}[data-slink-torn-chat] #chatRoot,
${S}[data-slink-torn-chat] #chatRoot :is([id^="faction-"],[id^="private-"],[class*="header___"],[class*="chatBox___"],[class*="chat-box"],[class*="textarea___"],[class*="chatHeader___"]){background-color:var(--slt-panel)!important;color:var(--slt-text)!important;}
${S}[data-slink-torn-chat] #chatRoot textarea{background-color:var(--slt-control)!important;color:var(--slt-text)!important;}
`;
  const COLORS={bg:['--slink-bg','#121922'],surface:['--slink-surface','#161f2a'],control:['--slink-bg-control','#2b3745'],text:['--slink-text','#eaf4ff'],muted:['--slink-muted','#9eb0c2'],link:['--slink-link','#8fc9ff'],accent:['--slink-accent','#69b5f4'],border:['--slink-border','#756887']};
  function compile({theme={},settings={},assetCss={}}={}) {
    const options=normalize(settings),declarations=[];
    for(const [name,[token,fallback]]of Object.entries(COLORS)){
      const value=String(theme.tokens?.[token]||fallback);
      const safe=/^(#[a-fA-F0-9]{3,8}|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/.test(value)?value:fallback;
      declarations.push('--slt-'+name+':'+safe);
    }
    declarations.push('--slt-panel:color-mix(in srgb,var(--slt-surface) '+options.opacity+'%,transparent)');
    const image=asset(assetCss['--slink-theme-background-image']),frame=asset(assetCss['--slink-theme-frame-image']);
    declarations.push('--slt-image:'+image,'--slt-frame:'+(options.frames?frame:'none'),
      '--slt-texture:'+asset(assetCss['--slink-theme-panel-smoke-image']),
      '--slt-roses:'+(options.ornaments?asset(assetCss['--slink-theme-health-roses-image']):'none'),
      '--slt-blood:'+(options.ornaments?asset(assetCss['--slink-theme-health-blood-image']):'none'));
    return {options,hasImage:image!=='none',hasFrame:frame!=='none',css:S+'{'+declarations.join(';')+'}\n'+(global.SLINK_TORN_VARIABLE_CSS||'')+CSS+'\n'+(global.SLINK_TORN_PAGE_RULES?.css||'')};
  }
  function create({document=global.document,activity}={}) {
    let snapshot={},current=null,observer=null,unsubscribe=null,repairs=[],gaveUp=false,destroyed=false;
    const root=document.documentElement;
    const validPage=()=>global.location?.hostname==='www.torn.com'&&!document.body?.classList.contains('mediawiki');
    const eligible=()=>!activity||activity.eligible();
    function remove(){
      observer?.disconnect();current=null;
      for(const name of [ATTRIBUTE,'data-slink-torn-background','data-slink-torn-frames','data-slink-torn-chat'])root.removeAttribute(name);
      document.getElementById(STYLE_ID)?.remove();
    }
    function write(){
      if(!current||destroyed)return;
      let style=document.getElementById(STYLE_ID);
      if(!style){style=document.createElement('style');style.id=STYLE_ID;(document.head||root).append(style);}
      if(style.textContent!==current.css)style.textContent=current.css;
      const flags={[ATTRIBUTE]:'on','data-slink-torn-background':current.options.background&&current.hasImage?'on':null,
        'data-slink-torn-frames':current.options.frames&&current.hasFrame?'on':null,'data-slink-torn-chat':current.options.chat?'on':null};
      for(const [name,value]of Object.entries(flags))if(value===null){if(root.hasAttribute(name))root.removeAttribute(name);}else if(root.getAttribute(name)!==value)root.setAttribute(name,value);
    }
    function watch(){
      observer?.disconnect();if(!current||gaveUp||destroyed||!eligible())return;
      observer.observe(root,{attributes:true,attributeFilter:[ATTRIBUTE],childList:true});
      if(document.head)observer.observe(document.head,{childList:true});
    }
    observer=new MutationObserver(()=>{
      if(!current||!eligible()||gaveUp)return;
      if(!validPage()){remove();return;}
      if(root.hasAttribute(ATTRIBUTE)&&document.getElementById(STYLE_ID))return;
      const now=Date.now();repairs=repairs.filter(time=>now-time<10000);
      if(repairs.length>=5){gaveUp=true;observer.disconnect();return;}
      repairs.push(now);write();watch();
    });
    function update(patch={}){
      snapshot={...snapshot,...patch};const next=compile(snapshot);
      if(!next.options.enabled||!validPage()){remove();gaveUp=false;repairs=[];return;}
      if(gaveUp)return;
      if(current?.css===next.css&&JSON.stringify(current.options)===JSON.stringify(next.options)){write();watch();return;}
      current=next;write();watch();
    }
    if(activity)unsubscribe=activity.subscribe(()=>{if(eligible())update();else observer.disconnect();});
    return {update,stop(){destroyed=true;remove();if(typeof unsubscribe==='function')unsubscribe();},status:()=>({enabled:!!current,conflict:gaveUp})};
  }
  function mountSettings(container,{read,patch}) {
    const host=document.createElement('section');host.dataset.slinkTornThemeSettings='';host.dataset.uiExplicitCommit='true';
    host.innerHTML='<h3>Theme Torn pages</h3><p>Optional CSS styling using your selected SLINK theme. Gameplay/status colors stay native. No page layout or controls are rebuilt.</p>'+
      [['enabled','Apply my SLINK theme to Torn'],['background','Use the supplied page background'],['frames','Use supplied frame and panel textures (adds inner spacing)'],['ornaments','Show supplied health decorations'],['chat','Also style chat (experimental)']].map(([name,label])=>'<label style="display:flex;align-items:center;gap:8px;margin:8px 0"><input type="checkbox" data-torn-theme-field="'+name+'" disabled>'+label+'</label>').join('')+
      '<label style="display:grid;gap:6px">Torn panel color opacity <output>92%</output><input data-torn-theme-field="opacity" aria-label="Torn panel color opacity" type="range" min="0" max="100" value="92" style="width:100%" disabled></label><p>Supplied panel artwork remains opaque. Turn textures off to see through panel backgrounds.</p><p data-torn-theme-save role="status">Loading…</p><button type="button" data-torn-theme-retry hidden>Retry saving</button>';
    container.append(host);let queue=Promise.resolve(),timer,dirty={},disposed=false;
    const controls=[...host.querySelectorAll('[data-torn-theme-field]')],notice=host.querySelector('[data-torn-theme-save]'),retry=host.querySelector('[data-torn-theme-retry]');
    function save(){clearTimeout(timer);const changes={...dirty};if(!Object.keys(changes).length)return queue;
      queue=queue.catch(()=>{}).then(async()=>{if(!disposed)notice.textContent='Saving…';
        try{await patch(changes);for(const [name,value]of Object.entries(changes))if(dirty[name]===value)delete dirty[name];if(!disposed){notice.textContent=Object.keys(dirty).length?'Newer edits pending…':'Saved.';retry.hidden=true;}}
        catch{if(!disposed){notice.textContent='Not saved. Your selections remain here; retry saving.';retry.hidden=false;}}
      });return queue;
    }
    host.addEventListener('input',event=>{
      const input=event.target;if(!input.dataset.tornThemeField)return;
      const name=input.dataset.tornThemeField;dirty[name]=name==='opacity'?Number(input.value):input.checked;
      if(name==='opacity')host.querySelector('output').textContent=input.value+'%';
      clearTimeout(timer);timer=setTimeout(save,name==='opacity'?250:0);
    });
    host.addEventListener('change',()=>void save());retry.onclick=()=>void save();
    const ready=Promise.resolve().then(read).then(value=>{if(disposed)return;const settings=normalize(value);for(const input of controls){const name=input.dataset.tornThemeField;if(name==='opacity')input.value=String(settings[name]);else input.checked=settings[name];input.disabled=false;}host.querySelector('output').textContent=settings.opacity+'%';notice.textContent='Changes save automatically on this device.';}).catch(()=>{if(!disposed)notice.textContent='Settings unavailable. Reopen this page to retry.';});
    return {host,ready,async stop(){disposed=true;clearTimeout(timer);await save();}};
  }
  global.SLINK_TORN_THEME=Object.freeze({STORAGE_KEY,DEFAULTS,normalize,compile,asset,create,mountSettings});
})(globalThis);
