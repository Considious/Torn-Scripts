(function installGiphyPanel(global) {
  'use strict';
  // SLINK implementation, inspired by Carol [4021053]'s MIT-licensed
  // Torn Chat GIF & Image Embedder. No original source or key is redistributed.
  global.SLINK_GIPHY_PANEL = function createPanel(client = global.SLINK_GIPHY.client()) {
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
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tile{min-width:0}
      .tile img,.tile video{display:block;width:100%;height:110px;object-fit:contain;background:#111}
      .tile p{overflow-wrap:anywhere;margin:4px 0}.tile button{font-size:12px}
      a{color:#b5caff}[hidden]{display:none!important}.attribution{display:block;width:150px;height:auto;max-width:100%}
    </style><div class="panel"><h3>GIF picker</h3>
      <label><input type="checkbox" data-enabled disabled> Enable GIPHY</label>
      <label>API key<select data-mode disabled><option value="integrated">SLINK integrated key (shared quota)</option><option value="custom">My own GIPHY API key</option></select></label>
      <label data-key-label hidden>Your GIPHY key<input type="password" data-key autocomplete="off" maxlength="128" placeholder="Enter a GIPHY API key"></label>
      <div class="actions"><button type="button" data-clear hidden>Remove saved key</button><button type="button" data-retry hidden>Retry save</button></div>
      <p data-save role="status">Loading saved settings…</p>
      <p>Optional. Searches and previews contact GIPHY directly. Previews play only when clicked. Your message is never sent automatically.</p>
      <label>Search GIFs<input type="search" data-query maxlength="50" placeholder="Search GIPHY" disabled></label>
      <div class="actions"><button type="button" data-search disabled>Search</button><button type="button" data-trending disabled>Trending</button><button type="button" data-next hidden>Next results</button></div>
      <a href="https://giphy.com/" target="_blank" rel="noopener noreferrer"><img class="attribution" data-attribution alt="Powered by GIPHY"></a>
      <p data-status role="status"></p><div class="grid" data-results></div>
      <label data-link-label hidden>Selected GIF link — paste into chat<input data-link readonly></label>
      <p>Inspired by <a href="https://greasyfork.org/scripts/598147" target="_blank" rel="noopener noreferrer">Torn Chat GIF &amp; Image Embedder</a> by Carol [4021053].</p>
    </div>`;
    const $ = selector=>root.querySelector(selector);
    // Approved GIPHY attribution artwork, loaded from the provider, not recreated.
    $('[data-attribution]').src = 'data:image/png;base64,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';
    let model, stopped=false, revision=0, dirty={}, saveQueue=Promise.resolve(), timer, searching=false, query='', nextOffset=0;
    const enabled=$('[data-enabled]'),mode=$('[data-mode]'),key=$('[data-key]'),saveStatus=$('[data-save]'),status=$('[data-status]'),results=$('[data-results]');
    const activity=global.SLINK_EXTENSION?.core?.pageActivity || global.SLINK_PDA_PAGE_ACTIVITY;
    const active=()=>!stopped&&host.isConnected&&!document.hidden&&(!activity||activity.eligible());
    function stopMedia(){for(const video of results.querySelectorAll('video'))video.pause();for(const image of results.querySelectorAll('img[data-playing]')){image.src=image.dataset.still||'';delete image.dataset.playing;}}
    function state(){
      $('[data-key-label]').hidden=mode.value!=='custom';$('[data-clear]').hidden=!model?.hasCustomKey;
      const unavailable=!model||!enabled.checked||Object.keys(dirty).length>0;
      $('[data-query]').disabled=unavailable;
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
        }catch(error){if(!stopped){saveStatus.textContent='Not saved: '+error.message;$('[data-retry]').hidden=false;}}
        if(!stopped)state();
      });saveQueue=task;return task;
    }
    function change(name,value,delay=0){dirty[name]=value;revision++;stopMedia();results.replaceChildren();$('[data-next]').hidden=true;state();clearTimeout(timer);timer=setTimeout(save,delay);}
    enabled.addEventListener('change',()=>change('enabled',enabled.checked));
    mode.addEventListener('change',()=>change('keyMode',mode.value));
    key.addEventListener('input',()=>{if(key.value.trim())change('apiKey',key.value.trim(),500);});
    key.addEventListener('blur',()=>void save());
    $('[data-clear]').onclick=()=>{key.value='';change('apiKey','');};
    $('[data-retry]').onclick=()=>void save();
    async function load(text,offset=0){
      if(!active()||searching)return;await save();if(Object.keys(dirty).length)return;
      searching=true;const ticket=++revision;state();status.textContent='Loading GIPHY…';stopMedia();results.replaceChildren();$('[data-next]').hidden=true;
      try{
        const response=await client.search({query:text,offset});
        if(ticket!==revision||!active())return;
        query=text;nextOffset=response.nextOffset;
        for(const row of response.rows){
          const tile=document.createElement('div');tile.className='tile';
          const image=document.createElement('img');image.alt=row.title;image.loading='lazy';image.referrerPolicy='no-referrer';if(row.still)image.src=row.still;
          tile.append(image);const title=document.createElement('p');title.textContent=row.title+(row.creator?' · '+row.creator:'');tile.append(title);
          const actions=document.createElement('div');actions.className='actions';
          const play=document.createElement('button');play.type='button';play.textContent='Play / pause';play.disabled=!row.mp4&&!row.image;
          let video;
          play.onclick=()=>{
            if(!active())return;
            if(row.mp4){if(!video){video=document.createElement('video');video.muted=true;video.loop=true;video.playsInline=true;video.preload='none';video.src=row.mp4;image.replaceWith(video);}if(video.paused){stopMedia();void video.play().catch(()=>{status.textContent='Preview unavailable. You can still copy the link.';});}else video.pause();}
            else if(image.dataset.playing){image.src=row.still;delete image.dataset.playing;}else{stopMedia();image.dataset.still=row.still;image.dataset.playing='true';image.src=row.image;}
          };
          const copy=document.createElement('button');copy.type='button';copy.textContent='Copy link';copy.disabled=!row.url;
          copy.onclick=async()=>{if(!active())return;$('[data-link-label]').hidden=false;$('[data-link]').value=row.url;
            try{await navigator.clipboard.writeText(row.url);status.textContent='Link copied. Paste it into chat and send when ready.';}
            catch{status.textContent='Copy the selected link below and paste it into chat.';$('[data-link]').focus();$('[data-link]').select();}
          };
          actions.append(play,copy);tile.append(actions);results.append(tile);
        }
        $('[data-next]').hidden=!response.hasMore;status.textContent=response.rows.length?'Click Play to preview or Copy link to share.':'No GIFs found.';
      }catch(error){if(ticket===revision&&!stopped)status.textContent=error.message;}
      finally{searching=false;if(!stopped)state();}
    }
    $('[data-search]').onclick=()=>void load($('[data-query]').value);
    $('[data-trending]').onclick=()=>{ $('[data-query]').value='';void load('');};
    $('[data-next]').onclick=()=>void load(query,nextOffset);
    $('[data-query]').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();void load(event.target.value);}};
    const visibility=()=>{if(!active()){revision++;stopMedia();}};
    document.addEventListener('visibilitychange',visibility);
    const unsubscribe=activity?.subscribe(visibility);
    const visibleObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(entries.some(e=>!e.isIntersecting))stopMedia();}):null;
    visibleObserver?.observe(host);
    const ready=client.get().then(settings=>{if(stopped)return;model=settings;enabled.checked=settings.enabled;mode.value=settings.keyMode;
      enabled.disabled=false;mode.disabled=false;key.placeholder=settings.hasCustomKey?'Key saved — type to replace':'Enter a GIPHY API key';saveStatus.textContent='Settings save automatically.';state();
    }).catch(error=>{if(!stopped)saveStatus.textContent='Could not load settings: '+error.message;});
    return {host,ready,async stop(){stopped=true;revision++;stopMedia();clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);if(typeof unsubscribe==='function')unsubscribe();visibleObserver?.disconnect();await save();}};
  };
})(globalThis);
