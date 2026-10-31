(function installInlineChatMedia(global){
 'use strict';
 // Independent renderer; feature inspiration: Torn Chat GIF & Image Embedder
 // by Carol [4021053] (MIT). No FF Scouter/GPL source is used.
 function resolve(value){
  try{
   const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')return null;
   const host=u.hostname.toLowerCase(),path=u.pathname;
   if(host==='giphy.com'||host==='www.giphy.com'||/^media[0-4]?\.giphy\.com$/.test(host)){
    let id='';
    if(host==='giphy.com'||host==='www.giphy.com'){const parts=path.split('/').filter(Boolean);if(!['gifs','stickers'].includes(parts[0]))return null;id=(parts[1]||'').split('-').at(-1)||'';}
    else {const parts=path.split('/').filter(Boolean),at=parts.indexOf('media');id=parts[at+1]||'';if(id.startsWith('v1.'))id=parts[at+2]||'';}
    if(!/^[a-zA-Z0-9]{4,100}$/.test(id))return null;
    return {kind:'GIF / sticker',still:'https://media.giphy.com/media/'+id+'/giphy_s.gif',animated:'https://media.giphy.com/media/'+id+'/giphy.gif',key:'giphy:'+id};
   }
   if(host==='stickershop.line-scdn.net'&&/^\/stickershop\//.test(path)&&/\.(?:png|webp|gif)$/i.test(path))return {kind:'Sticker',still:'',animated:u.origin+path,key:u.origin+path};
   if(['chatsticker.com','www.chatsticker.com','media.tenor.com'].includes(host)&&/\.(?:gif|png|webp|jpe?g)$/i.test(path))return {kind:'Image / sticker',still:'',animated:u.origin+path,key:u.origin+path};
   return null;
  }catch{return null;}
 }
 function mount({activity,enabled,settings,document=global.document}){
  document.__slinkInlineChatMedia?.stop();
  const views=new Map();let root=null,observer=null,intersection=null,timer=null,model={enabled:false,inlineMedia:true},generation=0,stopped=false;
  const active=()=>!stopped&&enabled()&&activity.eligible()&&model.enabled&&model.inlineMedia!==false;
  const eligible=a=>a.isConnected&&root?.contains(a)&&!!a.closest('p[class*="message___"],[class*="chat-box-message"]')&&a.getClientRects().length>0&&!a.closest('[hidden],[aria-hidden="true"],textarea,[contenteditable="true"],[data-slink-inline-media]');
  function remove(a,v){intersection?.unobserve(a);v.image.removeAttribute('src');v.card.remove();views.delete(a);}
  function pause(){for(const v of views.values())if(v.playing){v.playing=false;if(v.media.still)v.image.src=v.media.still;else v.image.removeAttribute('src');v.button.textContent=v.media.still?'Play':'Show preview';}}
  function show(v){if(!active()||!eligible(v.anchor))return;if(!v.image.hasAttribute('src')&&v.media.still)v.image.src=v.media.still;}
  function add(a){
   if(!eligible(a)||views.has(a)||a.parentElement?.querySelector('.torn-chat-custom-gif'))return;
   const media=resolve(a.href);if(!media)return;
   const card=document.createElement('span');card.dataset.slinkInlineMedia='';card.style.cssText='display:block;max-width:min(260px,100%);margin:5px 0;contain:layout style';
   const image=document.createElement('img');image.alt=media.kind+' preview';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.style.cssText='display:block;max-width:100%;max-height:160px;width:auto;height:auto;object-fit:contain;border-radius:5px';
   const button=document.createElement('button');button.type='button';button.textContent=media.still?'Play':'Show preview';button.style.cssText='display:inline-block;min-height:28px;padding:3px 8px;margin-top:3px;color:inherit;background:rgba(80,80,80,.35);border:1px solid currentColor;border-radius:4px;cursor:pointer;font:inherit';
   const v={anchor:a,media,card,image,button,playing:false};card.append(image,button);a.after(card);views.set(a,v);
   image.addEventListener('error',()=>{image.removeAttribute('src');button.textContent='Preview unavailable — use link';v.failed=true;});
   button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(!active()||!eligible(a)||v.failed)return;v.playing=!v.playing;if(v.playing){image.src=media.animated;button.textContent='Hide / pause';}else{if(media.still)image.src=media.still;else image.removeAttribute('src');button.textContent=media.still?'Play':'Show preview';}});
   intersection?.observe(a);if(!intersection)show(v);
   while(views.size>20){const [old,entry]=views.entries().next().value;remove(old,entry);}
  }
  function scan(node){
   if(!active()||node.nodeType!==1||node.closest?.('[data-slink-inline-media]'))return;
   const links=[...(node.matches?.('a[href]')?[node]:[]),...node.querySelectorAll('a[href]')].slice(-20);for(const a of links)add(a);
  }
  function observe(){
   if(!active())return;const next=document.getElementById('chatRoot');if(root===next&&observer)return;
   observer?.disconnect();root=next;if(!root)return;
   observer=new global.MutationObserver(records=>{
    if(!active())return;
    for(const [a,v]of views){if(!eligible(a)||resolve(a.href)?.key!==v.media.key||a.parentElement?.querySelector('.torn-chat-custom-gif'))remove(a,v);else if(!v.card.isConnected)a.after(v.card);}
    for(const r of records){if(r.target?.closest?.('[data-slink-inline-media]'))continue;if([...r.removedNodes||[]].some(node=>node.nodeType===1&&(node.matches?.('.torn-chat-custom-gif')||node.querySelector?.('.torn-chat-custom-gif'))))scan(r.target);if(r.type==='attributes')add(r.target);else for(const node of r.addedNodes)if(node.nodeType===1&&!node.matches?.('[data-slink-inline-media]'))scan(node);}
   });
   observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});scan(root);
  }
  function sync(){
   if(!active()){observer?.disconnect();observer=null;intersection?.disconnect();intersection=null;pause();for(const [a,v]of views)remove(a,v);root=null;return;}
   if(!intersection&&global.IntersectionObserver)intersection=new global.IntersectionObserver(records=>{for(const r of records){const v=views.get(r.target);if(!v)continue;if(r.isIntersecting)show(v);else if(v.playing){v.playing=false;if(v.media.still)v.image.src=v.media.still;else v.image.removeAttribute('src');v.button.textContent=v.media.still?'Play':'Show preview';}}});
   observe();
  }
  async function refresh(){const token=++generation;try{const value=await settings();if(token!==generation||stopped)return;model=value;sync();}catch{if(token===generation){model={enabled:false};sync();}}}
  const unsubscribe=activity.subscribe(sync);sync();
  const api={sync,refresh,stop(){stopped=true;generation++;unsubscribe?.();sync();global.clearTimeout(timer);}};document.__slinkInlineChatMedia=api;return api;
 }
 global.SLINK_CHAT_MEDIA=Object.freeze({resolve,mount});
})(globalThis);
