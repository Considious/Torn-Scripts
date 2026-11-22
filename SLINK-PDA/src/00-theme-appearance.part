/* Seasonal daylight palettes ported from SLINK Theme Lab. Artwork stays in the existing theme bundles. */
(function(g){
'use strict';
const contrastKey='slink.theme.high-contrast.v1',modeKey='slink.theme.last-torn-mode.v1';
const palettes={
 'halloween-2026':['#eee6f5','#fdf8ff','#29143a','#59436a','#80668f','#5d267c','#ecd9f8','#2d542c','#170822','#382746','#4a3658','#fffaff'],
 'slink-candy-cartel':['#f2e3d7','#fff8ef','#301921','#68424d','#92626d','#791d49','#f8dce7','#854515','#200e16','#492935','#583b46','#fffcf8'],
 'slink-naughty-list':['#ece8dc','#fffaf0','#30231d','#5e4c42','#806d60','#781f38','#f6dfe4','#255438','#201410','#41312a','#4c392e','#fffdf7']
};
const bindings=new WeakMap();
function declarations([bg,panel,text,muted,border,accent,control,ready]){
 const values={text,muted,border,accent,control,ready,card:panel,surface:panel,'bg-control':control,'border-soft':border,'panel-bg':panel,'topbar-bg':panel,'page-bg':bg,'button-bg':control,'selected-bg':control,link:accent,warning:'#733d00',error:'#8f1935'};
 const pda={bg,panel,card:panel,control,border,soft:border,text,muted,accent,alt:accent,ready,warning:'#733d00',error:'#8f1935',page:bg};
 return [...Object.entries(values).map(([k,v])=>'--slink-'+k+':'+v+'!important'),...Object.entries(pda).map(([k,v])=>'--s-'+k+':'+v+'!important'),'--slink-day-panel:'+panel,'--slink-day-text:'+text,'--slink-day-muted:'+muted,'--slink-day-border:'+border,'--slink-day-control:'+control,'--slink-day-accent:'+accent].join(';');
}
function css(shadow){
 const root=s=>shadow?':host('+s+')':':root'+s;
 let out='';
 const match=[];
 for(const [id,p] of Object.entries(palettes)){
  const theme=':is([data-slink-theme="'+id+'"],[data-theme="'+id+'"])';
  const light='[data-slink-appearance="light"]'+theme;
  match.push(root(light));
  out+=root(light)+'{color-scheme:light;'+declarations(p)+'}';
  out+=root(light+'[data-slink-contrast="high"]')+'{'+declarations([p[0],p[11],p[8],p[9],p[10],p[5],p[6],p[7]])+'}';
 }
 const forRoots=(roots,sel)=>roots.map(r=>r+' '+sel).join(',');
 out+=forRoots(match,':is(.head,.topbar,.module-head,.status,.card,.alert,.adhd-alert-card,.slink-adhd-alert,.target-card,.theme-card,.panel,.empty-state)')+'{background:var(--slink-day-panel)!important;color:var(--slink-day-text)!important;border-color:var(--slink-day-border)!important;text-shadow:none!important}';
 out+=forRoots(match,':is(button,input:not([type="range"]),select,textarea,.action-link,.tab,.group-tab,.badge,.module-tab)')+'{background-color:var(--slink-day-control)!important;background-image:none!important;color:var(--slink-day-text)!important;border-color:var(--slink-day-border)!important;text-shadow:none!important}';
 out+=forRoots(match,':is(button[aria-selected="true"],button[aria-pressed="true"],.tab.active,.group-tab.active)')+'{color:var(--slink-day-accent)!important;outline:2px solid var(--slink-day-accent);outline-offset:-2px}';
 out+=forRoots(match,':is(.muted,.subtitle,.alert small,.theme-summary)')+'{color:var(--slink-day-muted)!important;text-shadow:none!important}';
 out+=forRoots(match,'a:not(.action-link)')+'{color:var(--slink-day-accent)!important}';
 out+=forRoots(match,'.nav-alert-count')+'{background:#8f1935!important;color:#fff!important}';
 const high=root('[data-slink-contrast="high"]');
 out+=high+'{--slink-theme-panel-opacity:100%!important;--s-theme-panel-opacity:100%!important}';
 out+=high+' :is(button,a,input,select,textarea):focus-visible{outline:2px solid currentColor!important;outline-offset:2px}';
 return out;
}
function attach(host,root=host?.shadowRoot||host?.ownerDocument){
 if(!host||!root)return null;if(bindings.has(host))return bindings.get(host);
 const d=host.ownerDocument, onTorn=/(^|\.)torn\.com$/i.test(d.location?.hostname||'');
 const ext=g.chrome?.storage?.local;
 const mq=g.matchMedia?.('(prefers-color-scheme: dark)');
 const contrastMedia=g.matchMedia?.('(prefers-contrast: more)');
 const style=d.createElement('style');style.textContent=css(root!==d);(root===d?d.head:root).append(style);
 const localGet=k=>{try{return g.localStorage?.getItem(k);}catch{return null;}};
 let contrast=ext?null:localGet(contrastKey),last=ext?null:localGet(modeKey),body,control,storedMode=null,storageReady=!ext;
 function refresh(){
  const mode=onTorn&&d.body?(d.body.classList.contains('dark-mode')||d.documentElement.classList.contains('dark-mode')?'dark':'light'):storedMode||(mq?.matches===false?'light':'dark');
  if(storageReady&&onTorn&&d.body&&mode!==last){last=mode;try{if(ext)Promise.resolve(ext.set({[modeKey]:mode})).catch(()=>{});else g.localStorage?.setItem(modeKey,mode);}catch{}}
  host.dataset.slinkAppearance=mode;
  const high=contrast===null?contrastMedia?.matches===true:contrast==='1';
  host.dataset.slinkContrast=high?'high':'normal';
  if(control)control.checked=high;
 }
 function bind(input){
  if(!input||control===input)return;control=input;refresh();
  input.addEventListener('change',()=>{
   contrast=input.checked?'1':'0';refresh();
   try{if(ext)Promise.resolve(ext.set({[contrastKey]:contrast})).catch(()=>{});else g.localStorage?.setItem(contrastKey,contrast);}catch{}
  });
 }
 if(ext){Promise.resolve(ext.get([contrastKey,modeKey])).then(values=>{contrast=values?.[contrastKey]??contrast;last=storedMode=values?.[modeKey];storageReady=true;refresh();}).catch(()=>{});g.chrome.storage.onChanged?.addListener((changes,area)=>{if(area!=='local')return;if(changes[contrastKey])contrast=changes[contrastKey].newValue??null;if(changes[modeKey])storedMode=changes[modeKey].newValue;refresh();});}
 if(onTorn&&g.MutationObserver){
  const attributes=new g.MutationObserver(refresh);
  const watch=()=>{if(body===d.body)return;body=d.body;attributes.disconnect();attributes.observe(d.documentElement,{attributes:true,attributeFilter:['class']});if(body)attributes.observe(body,{attributes:true,attributeFilter:['class']});refresh();};
  watch();new g.MutationObserver(watch).observe(d.documentElement,{childList:true});
 }
 mq?.addEventListener?.('change',refresh);contrastMedia?.addEventListener?.('change',refresh);
 const api={bind};bindings.set(host,api);refresh();return api;
}
g.SLINK_THEME_APPEARANCE=Object.freeze({attach});
})(globalThis);
