// Torn map layout and runtime field names cross-checked against TornTools.
// Only reads the currently open map; never requests or picks up an item.
(function(g){
  'use strict';
  function entries(raw){
    if(!Array.isArray(raw))return null;
    const found=new Map();
    for(const item of raw.slice(0,2000)){
      const id=item?.row_id, product=item?.item_id, [x,y]=Array.isArray(item?.coordinates)?item.coordinates:[];
      if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(product)||product<=0||!Number.isFinite(x)||!Number.isFinite(y))continue;
      found.set(id,{id,product,x,y,name:typeof item.title==='string'&&item.title.trim()?item.title.trim().slice(0,120):'Item '+product});
    }
    return [...found.values()];
  }
  g.SLINK_CITY_ITEMS=Object.freeze({entries});
  if(!g.document||location.pathname!=='/city.php'||document.querySelector('[data-slink-city-items]'))return;
  let mapNode=null,map=null,model=null,observer=null,boot=null,panel=null,list=null,status=null,queued=false,enabled=true,signature='',retry=null,attempts=0;
  const dots=new Map();
  const visible=()=>document.visibilityState!=='hidden';
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  function clear(){
    for(const {layer} of dots.values())try{layer.remove();}catch{}
    dots.clear();
  }
  function detach(){
    observer?.disconnect();observer=null;
    model?.off?.('change:territoryUserItems',schedule);
    map?.off?.('zoomend moveend',schedule);
    clear();mapNode?.classList.remove('slink-city-highlight');
    panel?.remove();panel=list=status=mapNode=map=model=null;signature='';
  }
  function sync(){
    queued=false;if(!visible())return;
    const route=new URLSearchParams(location.hash.replace(/^#\/?\??/,'')).get('p');
    const node=document.querySelector('#map');
    if((route&&route!=='map')||!node?.getClientRects().length){
      if(mapNode)detach();return;
    }
    if(node!==mapNode){
      detach();mapNode=node;
      panel=el('section');panel.dataset.slinkCityItems='';panel.setAttribute('aria-label','SLINK City items');
      panel.style.cssText='margin:.5rem 0;padding:.55rem;border:1px solid currentColor;border-radius:.4rem;line-height:1.5';
      const label=el('label',' Highlight items on the map'),toggle=el('input');toggle.type='checkbox';toggle.checked=enabled;label.prepend(toggle);
      toggle.addEventListener('change',()=>{enabled=toggle.checked;schedule();});
      const details=el('details');details.append(el('summary','Item list'),list=el('ul'));
      const style=el('style','#map.slink-city-highlight .city-item:not(.tt-city-item-overlay){outline:2px solid #f8cf43;outline-offset:2px;border-radius:50%}.slink-city-dot{pointer-events:none!important}');
      status=el('p');
      panel.append(el('strong','SLINK City items'),el('br'),label,status,details,style);
      node.before(panel);
      observer=new MutationObserver(schedule);observer.observe(node,{childList:true,subtree:true,attributes:true,attributeFilter:['data-id','title','aria-label']});
    }
    const runtime=g.torn, nextMap=runtime?.map?.lmap??node._leaflet_map, nextModel=runtime?.model;
    if(nextMap!==map){map?.off?.('zoomend moveend',schedule);clear();map=nextMap;map?.on?.('zoomend moveend',schedule);}
    if(nextModel!==model){model?.off?.('change:territoryUserItems',schedule);model=nextModel;model?.on?.('change:territoryUserItems',schedule);}
    let raw;
    try{raw=model?.get?.('territoryUserItems');if(!Array.isArray(raw))raw=model?.get?.()?.territoryUserItems;}catch{}
    const items=entries(raw);
    const native=[...node.querySelectorAll('.city-item[data-id]:not(.tt-city-item-overlay):not(.slink-city-dot)')];
    const rows=items??native.map(n=>({name:n.getAttribute('title')||n.getAttribute('aria-label')||n.querySelector('img')?.alt||'Item '+n.dataset.id}));
    node.classList.toggle('slink-city-highlight',enabled);
    if(!enabled)clear();
    else{
      const desired=new Map((items||[]).map(x=>[x.id,x]));
      for(const [id,record] of dots){const row=desired.get(id);if(!row||record.x!==row.x||record.y!==row.y){try{record.layer.remove();}catch{}dots.delete(id);}}
      for(const row of desired.values()){
        if(dots.has(row.id))continue;
        try{
          const point=runtime.map.getLPoint([row.x/2,row.y/2]);
          const latlng=g.L.CRS.EPSG3857.pointToLatLng(point,runtime.map.minZoom);
          if(!Number.isFinite(latlng?.lat)||!Number.isFinite(latlng?.lng))continue;
          const layer=g.L.circleMarker(latlng,{interactive:false,bubblingMouseEvents:false,className:'slink-city-dot',radius:11,weight:3,color:'#f8cf43',fillOpacity:.12});
          layer.addTo(map);dots.set(row.id,{x:row.x,y:row.y,layer});
        }catch{}
      }
    }
    const message=rows.length?rows.length+' '+(rows.length===1?'item':'items')+' shown by Torn. Zoom in and use Torn’s own markers to collect.':
      items?'Torn’s loaded map has no items.':'Waiting for Torn’s map item data.';
    const nextSignature=JSON.stringify([message,rows.map(x=>x.name)]);
    if(signature!==nextSignature){signature=nextSignature;status.textContent=message;list.replaceChildren(...rows.map(x=>el('li',x.name)));}
    if((items===null||(!map&&items.length))&&!retry&&attempts<20){
      attempts++;retry=setTimeout(()=>{retry=null;schedule();},500);
    }
  }
  function schedule(){if(!queued&&visible()){queued=true;requestAnimationFrame(sync);}}
  function reset(){attempts=0;schedule();}
  function start(){
    boot=new MutationObserver(records=>{if(!mapNode?.isConnected||records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n===mapNode||n.nodeType===1&&n.querySelector?.('#map'))))schedule();});
    boot.observe(document.body,{childList:true,subtree:true});
    g.addEventListener('hashchange',reset);document.addEventListener('visibilitychange',reset);sync();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})(globalThis);
