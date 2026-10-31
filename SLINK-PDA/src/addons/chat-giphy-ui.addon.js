(function installGiphyPanel(global) {
  'use strict';
  // SLINK implementation, inspired by Carol [4021053]'s MIT-licensed
  // Torn Chat GIF & Image Embedder. No original source or key is redistributed.
  global.SLINK_GIPHY_PANEL = function createPanel(client = global.SLINK_GIPHY.client(), options = {}) {
    const host = document.createElement('section');
    host.dataset.slinkGiphy = ''; host.dataset.uiExplicitCommit = 'true';
    // An isolated UI avoids Torn's/theme CSS stretching controls or modifying them.
    const root = host.attachShadow({mode:'open'});
    root.innerHTML = `<style>
      :host{display:block;min-width:0;color:inherit}*{box-sizing:border-box}
      .panel{padding:10px;border:1px solid #777;border-radius:8px;background:#15151beb;color:#eee;font:14px/1.4 system-ui}
      h3{margin:0 0 8px}p{margin:8px 0;font-size:12px}label{display:block;margin:8px 0}
      input:not([type=checkbox]),select{width:100%;min-width:0;padding:9px;background:#222;color:#fff;border:1px solid #888;border-radius:4px}
      button{padding:8px;cursor:pointer;background:#303039;color:white;border:1px solid #888;border-radius:4px}
      button:disabled{opacity:.6;cursor:default}.actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(130px,45%),1fr));gap:8px}.tile{min-width:0}
      .provider{margin-top:12px}.provider h4{margin:8px 0}.tile small{display:block;color:#ccc}
      [data-media-type][aria-pressed=true]{background:#645184;border-color:#d3b6ff}
      .tile img,.tile video{display:block;width:100%;height:110px;object-fit:contain;background:#111}
      .tile p{overflow-wrap:anywhere;margin:4px 0}.tile button{font-size:12px}
      a{color:#b5caff}[hidden]{display:none!important}.attribution{display:block;width:150px;height:auto;max-width:100%}
    </style><div class="panel"><h3>Chat media picker</h3>
      <label><input type="checkbox" data-enabled disabled> Enable GIFs &amp; stickers</label>
      <label>API key<select data-mode disabled><option value="integrated">SLINK integrated key (shared quota)</option><option value="custom">My own GIPHY API key</option></select></label>
      <label data-key-label hidden>Your GIPHY key<input type="password" data-key autocomplete="off" maxlength="128" placeholder="Enter a GIPHY API key"></label>
      <div class="actions"><button type="button" data-clear hidden>Remove saved key</button><button type="button" data-retry hidden>Retry save</button></div>
      <p data-save role="status">Loading saved settings…</p>
      <p>Optional. GIF searches contact GIPHY; sticker searches also contact ChatSticker. Animated previews play only when clicked. Your message is never sent automatically.</p>
      <div class="actions" aria-label="Media type"><button type="button" data-media-type="gif" aria-pressed="true" disabled>GIFs</button><button type="button" data-media-type="sticker" aria-pressed="false" disabled>Stickers</button></div>
      <label>Search GIFs &amp; stickers<input type="search" data-query maxlength="50" placeholder="Search GIFs & stickers" disabled></label>
      <div class="actions"><button type="button" data-search disabled>Search</button><button type="button" data-trending disabled>Trending / popular</button><button type="button" data-next hidden>Next results</button></div>
      <a href="https://giphy.com/" target="_blank" rel="noopener noreferrer"><img class="attribution" data-attribution alt="Powered by GIPHY"></a>
      <p data-status role="status"></p><div data-results></div>
      <label data-link-label hidden>Selected media link — paste into chat<input data-link readonly></label>
      <p>Inspired by <a href="https://greasyfork.org/scripts/598147" target="_blank" rel="noopener noreferrer">Torn Chat GIF &amp; Image Embedder</a> by Carol [4021053].</p>
    </div>`;
    const $ = selector=>root.querySelector(selector);
    // Approved GIPHY attribution artwork, loaded from the provider, not recreated.
    $('[data-attribution]').src = 'data:image/png;base64,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';
    let model, stopped=false, suspended=false, revision=0, dirty={}, saveQueue=Promise.resolve(), timer, searchTimer, searching=false, query='', mediaType='gif', cursors={}, queued=null,lastSearch=-Infinity;
    const enabled=$('[data-enabled]'),mode=$('[data-mode]'),key=$('[data-key]'),saveStatus=$('[data-save]'),status=$('[data-status]'),results=$('[data-results]');
    const activity=global.SLINK_EXTENSION?.core?.pageActivity || global.SLINK_PDA_PAGE_ACTIVITY;
    const active=()=>!stopped&&!suspended&&options.isActive?.()!==false&&host.isConnected&&!document.hidden&&(!activity||activity.eligible());
    function stopMedia(){for(const video of results.querySelectorAll('video'))video.pause();for(const image of results.querySelectorAll('img[data-playing]')){image.src=image.dataset.still||'';delete image.dataset.playing;}}
    function state(){
      $('[data-key-label]').hidden=mode.value!=='custom';$('[data-clear]').hidden=!model?.hasCustomKey;
      const unavailable=!model||!enabled.checked||Object.keys(dirty).length>0;
      $('[data-query]').disabled=unavailable;
      for(const button of root.querySelectorAll('[data-media-type]'))button.disabled=unavailable;
      for(const selector of ['[data-search]','[data-trending]','[data-next]'])$(selector).disabled=unavailable||searching;
    }
    function save(){
      clearTimeout(timer);const changes={...dirty};if(!Object.keys(changes).length)return saveQueue;
      const task=saveQueue.catch(()=>{}).then(async()=>{
        saveStatus.textContent='Saving…';
        try{model=await client.patch(changes);
          for(const [name,value]of Object.entries(changes))if(dirty[name]===value)delete dirty[name];
          if(stopped)return;
          if(Object.hasOwn(changes,'apiKey')&&!Object.hasOwn(dirty,'apiKey'))key.value='';
          key.placeholder=model.hasCustomKey?'Key saved — type to replace':'Enter a GIPHY API key';
          saveStatus.textContent=Object.keys(dirty).length?'Newer edits pending…':'Saved on this device.';$('[data-retry]').hidden=true;
        }catch(error){if(!stopped){saveStatus.textContent='Not saved: '+((globalThis.SLINK_ERRORS?.message(error))||String(error?.message||'The action failed. Please retry.'));$('[data-retry]').hidden=false;}}
        if(!stopped)state();
      });saveQueue=task;return task;
    }
    function change(name,value,delay=0){dirty[name]=value;revision++;queued=null;clearTimeout(searchTimer);stopMedia();results.replaceChildren();$('[data-next]').hidden=true;state();clearTimeout(timer);timer=setTimeout(save,delay);}
    enabled.addEventListener('change',()=>change('enabled',enabled.checked));
    mode.addEventListener('change',()=>change('keyMode',mode.value));
    key.addEventListener('input',()=>{if(key.value.trim())change('apiKey',key.value.trim(),500);});
    key.addEventListener('blur',()=>void save());
    $('[data-clear]').onclick=()=>{key.value='';change('apiKey','');};
    $('[data-retry]').onclick=()=>void save();
    function schedule(text,next=false,delay=450){
      revision++;queued={text,next};clearTimeout(searchTimer);
      if(!active())return;
      searchTimer=setTimeout(()=>{if(!searching){const job=queued;queued=null;if(job)void load(job.text,job.next);}},Math.max(delay,1100-(Date.now()-lastSearch)));
    }
    async function load(text,next=false){
      if(!active())return;
      if(searching){schedule(text,next);return;}
      clearTimeout(searchTimer);queued=null;await save();if(Object.keys(dirty).length||!active())return;
      if(searching){schedule(text,next);return;}
      searching=true;lastSearch=Date.now();const ticket=++revision,type=mediaType;state();status.textContent=type==='sticker'?'Searching stickers…':'Loading GIPHY…';stopMedia();results.replaceChildren();$('[data-next]').hidden=true;
      const providers=type==='sticker'?['giphy','chatsticker']:['giphy'];
      const requested=providers.filter(provider=>!next||cursors[provider]?.hasMore);
      try{
        const responses=await Promise.allSettled(requested.map(provider=>client.search({query:text,provider,type,offset:next?cursors[provider].nextOffset:0})));
        if(ticket!==revision||!active())return;
        query=text;if(!next)cursors={};let total=0,successes=0;
        for(let index=0;index<responses.length;index++){
          const outcome=responses[index],provider=requested[index];
          if(outcome.status!=='fulfilled'){cursors[provider]={hasMore:false};continue;}
          successes++;const response=outcome.value;
          // GIPHY forbids mixed-provider grids, reordering and response caching.
          // Only pagination metadata is retained; result URLs stay in the visible cards.
          cursors[provider]={nextOffset:response.nextOffset,hasMore:response.hasMore};
          const section=document.createElement('section');section.className='provider';section.dataset.provider=provider;
          const heading=document.createElement('h4');heading.textContent=provider==='giphy'?(type==='sticker'?'GIPHY stickers':'GIPHY GIFs'):'ChatSticker stickers';
          const grid=document.createElement('div');grid.className='grid';section.append(heading,grid);results.append(section);
          total+=response.rows.length;
          if(!response.rows.length){const empty=document.createElement('p');empty.textContent=type==='sticker'?'No stickers found.':'No GIFs found.';section.append(empty);}
          for(const row of response.rows){
          const tile=document.createElement('div');tile.className='tile';
          const still=row.previewUrl||row.still||'',full=row.image||row.imageUrl||'',share=row.shareUrl||row.url||'';
          const image=document.createElement('img');image.alt=row.title;image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';if(still)image.src=still;
          tile.append(image);const title=document.createElement('p');title.textContent=row.title+(row.creator?' · '+row.creator:'');tile.append(title);
          if(row.provider==='chatsticker'&&row.animated&&!row.animationAvailable){const note=document.createElement('small');note.textContent='Still fallback — provider supplied no animation.';tile.append(note);}
          const actions=document.createElement('div');actions.className='actions';
          const play=document.createElement('button');play.type='button';play.textContent='Play / pause';play.disabled=row.animated===false||(!row.mp4&&!full)||row.animationAvailable===false;
          let video;
          play.onclick=()=>{
            if(!active())return;
            if(row.mp4){if(!video){video=document.createElement('video');video.muted=true;video.loop=true;video.playsInline=true;video.preload='none';video.src=row.mp4;image.replaceWith(video);}if(video.paused){stopMedia();void video.play().catch(()=>{status.textContent='Preview unavailable. You can still copy the link.';});}else video.pause();}
            else if(image.dataset.playing){image.src=still;delete image.dataset.playing;}else{stopMedia();image.dataset.still=still;image.dataset.playing='true';image.src=full;}
          };
          const copy=document.createElement('button');copy.type='button';copy.textContent='Copy link';copy.disabled=!share;
          copy.onclick=async()=>{if(!active())return;$('[data-link-label]').hidden=false;$('[data-link]').value=share;
            try{await navigator.clipboard.writeText(share);status.textContent='Link copied. Paste it into chat and send when ready.';}
            catch{status.textContent='Copy the selected link below and paste it into chat.';$('[data-link]').focus();$('[data-link]').select();}
          };
          actions.append(play,copy);tile.append(actions);grid.append(tile);
          }
        }
        $('[data-next]').hidden=!Object.values(cursors).some(cursor=>cursor.hasMore);
        status.textContent=!successes?(type==='sticker'?'Sticker search is temporarily unavailable.':'GIF search is temporarily unavailable.'):total?'Click Play to preview or Copy link to share.':type==='sticker'?'No stickers found.':'No GIFs found.';
      }catch{if(ticket===revision&&!stopped)status.textContent=type==='sticker'?'Sticker search is temporarily unavailable.':'GIF search is temporarily unavailable.';}
      finally{searching=false;if(!stopped){state();if(queued){const job=queued;schedule(job.text,job.next,0);}}}
    }
    $('[data-search]').onclick=()=>schedule($('[data-query]').value,false,0);
    $('[data-trending]').onclick=()=>{ $('[data-query]').value='';schedule('',false,0);};
    $('[data-next]').onclick=()=>schedule(query,true,0);
    for(const button of root.querySelectorAll('[data-media-type]'))button.onclick=()=>{
      if(mediaType===button.dataset.mediaType)return;mediaType=button.dataset.mediaType;cursors={};
      for(const tab of root.querySelectorAll('[data-media-type]'))tab.setAttribute('aria-pressed',String(tab===button));
      schedule($('[data-query]').value,false,0);
    };
    $('[data-query]').oninput=event=>schedule(event.target.value);
    $('[data-query]').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();schedule(event.target.value,false,0);}};
    const visibility=()=>{if(!active()){revision++;queued=null;clearTimeout(searchTimer);stopMedia();}};
    document.addEventListener('visibilitychange',visibility);
    const unsubscribe=activity?.subscribe(visibility);
    const visibleObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(entries.some(e=>!e.isIntersecting))stopMedia();}):null;
    visibleObserver?.observe(host);
    function applySettings(settings){if(stopped)return;model=settings;enabled.checked=settings.enabled;mode.value=settings.keyMode;
      enabled.disabled=false;mode.disabled=false;key.placeholder=settings.hasCustomKey?'Key saved — type to replace':'Enter a GIPHY API key';saveStatus.textContent='Settings save automatically.';state();
    }
    const ready=client.get().then(applySettings).catch(error=>{if(!stopped)saveStatus.textContent='Could not load settings: '+((globalThis.SLINK_ERRORS?.message(error))||String(error?.message||'The action failed. Please retry.'));});
    function suspend(){suspended=true;revision++;queued=null;clearTimeout(searchTimer);stopMedia();}
    if(options.chatWindow){root.querySelector('h3').hidden=true;root.querySelector('[aria-label="Media type"]').hidden=true;}
    return {host,ready,suspend,async open(type){
      const opening=++revision;suspended=false;await ready;await save();if(opening!==revision||!active())return;
      const ticket=revision;
      try{const settings=await client.get();if(ticket===revision&&!Object.keys(dirty).length&&active())applySettings(settings);}catch{status.textContent='Could not refresh media settings. Please retry.';return;}
      if(opening!==revision||!active())return;mediaType=type==='sticker'?'sticker':'gif';cursors={};
      for(const tab of root.querySelectorAll('[data-media-type]'))tab.setAttribute('aria-pressed',String(tab.dataset.mediaType===mediaType));
      if(enabled.checked)schedule($('[data-query]').value,false,0);
    },async stop(){stopped=true;suspend();clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);if(typeof unsubscribe==='function')unsubscribe();visibleObserver?.disconnect();await save();}};
  };
  // Retain the media node across macro updates; its owner supplies activity/placement.
  global.SLINK_CHAT_WINDOW_MEDIA = function attachMedia({menu,macros,isActive,layout}) {
    const tabs=document.createElement('div');tabs.className='ccb-media-tabs';tabs.setAttribute('aria-label','SLINK chat tools');
    const surface=document.createElement('div');surface.dataset.ccbMedia='';surface.hidden=true;
    let panel=null,current='macros';
    function select(type){
      if(!isActive())return;current=type;macros.hidden=type!=='macros';surface.hidden=type==='macros';
      menu.dataset.ccbMediaOpen=String(type!=='macros');
      for(const button of tabs.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.ccbView===type));
      if(type==='macros')panel?.suspend();else {
        if(!panel){panel=global.SLINK_GIPHY_PANEL(undefined,{chatWindow:true,isActive:()=>isActive()&&!surface.hidden&&!menu.hidden});surface.append(panel.host);}
        void panel.open(type==='stickers'?'sticker':'gif');
      }layout();
    }
    for(const [type,label] of [['macros','Custom buttons'],['gifs','GIFs'],['stickers','Stickers']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.ccbView=type;button.setAttribute('aria-pressed',String(type==='macros'));button.onclick=()=>select(type);tabs.append(button);
    }
    menu.append(tabs,macros,surface);
    return {select,suspend(){panel?.suspend();},resume(){select(current);}};
  };
})(globalThis);
