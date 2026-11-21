/* Shared by the extension and PDA. Only opt-in SLINK nodes are styled. */
(function installTornComponents(global){
  'use strict';
  const css=`
:root:has(body.dark-mode),body.dark-mode{
  --sp-native-bg:#242831;--sp-native-text:#edf1f7;--sp-native-control:#343b48
}
:where(.slink-page-ui,.slink-page-note,.slink-page-action,.slink-page-positive,.slink-weapon-modifiers){
  --sp-bg:var(--slt-surface,var(--slink-surface,var(--slink-bg,var(--sp-native-bg,#f2f4f7))));
  --sp-text:var(--slt-text,var(--slink-text,var(--sp-native-text,#202934)));
  --sp-control:var(--slt-control,var(--slink-bg-control,var(--sp-native-control,#fff)));
  --sp-muted:color-mix(in srgb,var(--sp-text) 78%,var(--sp-bg));
  --sp-link:color-mix(in srgb,var(--slt-link,var(--slink-link,#145589)) 62%,var(--sp-text));
  --sp-accent:var(--slt-accent,var(--slink-accent,#26649b));
  --sp-border:color-mix(in srgb,var(--slt-border,var(--slink-border,#8996a3)) 72%,var(--sp-text));
  --sp-success:color-mix(in srgb,var(--slt-success,var(--slink-success,#2e8a4e)) 48%,var(--sp-text));
  --sp-danger:color-mix(in srgb,var(--slt-danger,var(--slink-danger,#b43b43)) 48%,var(--sp-text));
}
:host([data-slink-appearance="dark"]) :where(.slink-page-ui,.slink-page-note,.slink-page-action,.slink-page-positive,.slink-weapon-modifiers){
  --sp-bg:var(--slt-surface,var(--slink-surface,var(--slink-bg,#242831)));
  --sp-text:var(--slt-text,var(--slink-text,#edf1f7));
  --sp-control:var(--slt-control,var(--slink-bg-control,#343b48));
}
.slink-page-ui,.slink-page-note{box-sizing:border-box;max-inline-size:100%;min-inline-size:0;background:var(--sp-bg);color:var(--sp-text);font:inherit;line-height:1.45;overflow-wrap:anywhere}
.slink-page-ui.slink-page-card{display:block;border:1px solid var(--sp-border);border-radius:7px;padding:7px 9px;margin:6px 0}
.slink-page-ui.slink-page-card.slink-page-toolbar{display:flex}
.slink-page-ui[hidden],.slink-page-ui [hidden]{display:none!important}
.slink-page-ui :where(p){margin:4px 0}
.slink-page-ui :where(summary,.slink-page-title){font-weight:700;color:var(--sp-text);line-height:1.35}
.slink-page-ui summary{cursor:pointer;min-block-size:24px}
.slink-page-ui[open]>summary{margin-block-end:6px}
.slink-page-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:5px 7px;min-inline-size:0}
.slink-page-toolbar>*{min-inline-size:0;max-inline-size:100%}
.slink-page-ui :where(small,[role=status],.slink-page-muted){color:var(--sp-muted)}
.slink-page-ui :where([role=status]):empty{display:none}
.slink-page-ui :where(a:any-link),a.slink-page-action:any-link{color:var(--sp-link)!important;text-decoration:underline;text-underline-offset:2px}
.slink-page-ui a:hover,.slink-page-action:hover{color:var(--sp-text)!important}
.slink-page-action,.slink-page-ui :is(button,select,textarea,input:not([type=checkbox],[type=radio],[type=hidden],[type=range])){
  box-sizing:border-box;max-inline-size:100%;min-inline-size:0;min-block-size:28px;padding:3px 7px;border:1px solid var(--sp-border);border-radius:5px;
  background:var(--sp-control);color:var(--sp-text);font:inherit;line-height:1.35
}
.slink-page-ui :is(button,select),.slink-page-action{cursor:pointer}
.slink-page-ui :is(button,select):enabled:hover,.slink-page-action:hover,.slink-page-ui button[aria-pressed=true]{background:color-mix(in srgb,var(--sp-accent) 18%,var(--sp-control));border-color:var(--sp-accent)}
.slink-page-ui :is(button,input,textarea,select):disabled{color:var(--sp-muted);background:var(--sp-bg);cursor:not-allowed}
.slink-page-ui :is(input,textarea)::placeholder{color:var(--sp-muted);opacity:1}
.slink-page-ui option{background:var(--sp-control);color:var(--sp-text)}
.slink-page-ui :is(button,select,input,textarea,a,summary):focus-visible,.slink-page-action:focus-visible{outline:2px solid var(--sp-link);outline-offset:2px}
.slink-page-ui :is(input[type=checkbox],input[type=radio],input[type=range]){accent-color:var(--sp-accent)}
.slink-page-grid{display:grid;gap:4px;min-inline-size:0}
.slink-page-row,.slink-page-toggle{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px 8px;align-items:center;margin:0;min-inline-size:0}
.slink-page-toggle{grid-template-columns:minmax(0,1fr) auto;min-block-size:30px;padding:2px 6px;background:var(--sp-control);border:1px solid var(--sp-border);border-radius:5px;cursor:pointer}
.slink-page-ui .slink-page-toggle input[role=switch]{appearance:none;box-sizing:border-box;position:relative;inline-size:34px;block-size:20px;min-block-size:0;margin:0;padding:0;background:var(--sp-bg);border:1px solid var(--sp-border);border-radius:20px;cursor:pointer}
.slink-page-toggle input[role=switch]::before{content:'';position:absolute;inline-size:12px;block-size:12px;inset:3px auto auto 3px;border-radius:50%;background:var(--sp-text)}
.slink-page-toggle input[role=switch]:checked{background:color-mix(in srgb,var(--sp-accent) 45%,var(--sp-bg));border-color:var(--sp-accent)}
.slink-page-toggle input[role=switch]:checked::before{transform:translateX(14px)}
.slink-page-toggle:hover{border-color:var(--sp-link)}
.slink-page-row select{width:100%}
.slink-page-ui label{overflow-wrap:anywhere}
.slink-page-note{padding:1px 4px;border:1px solid var(--sp-border);border-radius:4px;font-size:.9em}
.slink-page-positive{color:var(--sp-success)!important;font-weight:700}
.slink-weapon-stat-cell.slink-weapon-stat-cell{
  display:inline-grid!important;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);
  align-items:center;justify-items:center;min-inline-size:58px;min-block-size:23px;
  box-sizing:border-box;white-space:nowrap;vertical-align:middle;
}
.slink-weapon-stat-cell>:first-child{
  grid-area:1/1;justify-self:start;align-self:center;margin-block-end:10px;
  display:inline-flex!important;align-items:center;max-block-size:12px;line-height:1!important;
}
.slink-weapon-stat-cell>.slink-weapon-stat{grid-area:1/1}
.slink-weapon-stat-cell>.slink-weapon-stat{
  display:inline-flex!important;flex:0 0 auto;flex-direction:column;align-items:center;
  justify-content:center;gap:0!important;margin:0!important;padding:0!important;
  inline-size:auto!important;block-size:auto!important;min-block-size:0!important;
  max-inline-size:none!important;overflow:visible!important;text-indent:0!important;
  line-height:1!important;text-align:center!important;font-variant-numeric:tabular-nums;
}
.slink-weapon-market-value{
  display:inline-flex!important;flex-direction:column;justify-content:center;align-items:center;
  gap:0;min-block-size:21px;padding-block:1px;vertical-align:middle;line-height:1!important;
  font-variant-numeric:tabular-nums;
}
.slink-weapon-stat>[aria-hidden="true"]{
  display:block!important;float:none!important;margin:0!important;padding:0!important;
  block-size:auto!important;min-block-size:0!important;line-height:1!important;
}
.slink-weapon-stat>.slink-weapon-modifiers{
  display:flex!important;align-items:center;justify-content:center;gap:0 3px!important;
  float:none!important;position:static!important;margin:0!important;padding:0!important;
  inline-size:auto!important;block-size:auto!important;min-block-size:0!important;
  color:inherit;font-size:10px!important;font-weight:700;line-height:1!important;white-space:nowrap;
}
.slink-weapon-modifiers>span{
  display:block!important;float:none!important;position:static!important;
  margin:0!important;padding:0!important;block-size:auto!important;min-block-size:0!important;
  font:inherit!important;line-height:1!important;white-space:nowrap;
}
.slink-weapon-stat-cell.slink-weapon-shop-stat{min-inline-size:0;min-block-size:20px}
:is([class*="infoBonuses___"],[class*="properties___"]):has(> .slink-weapon-shop-stat){min-block-size:20px}
.slink-weapon-shop-stat .slink-weapon-modifiers,.slink-weapon-market-value>.slink-weapon-modifiers{gap:0 2px!important;font-size:9px!important}
@media(max-width:480px){.slink-weapon-stat-cell.slink-weapon-stat-cell:not(.slink-weapon-shop-stat){min-inline-size:53px}}
.slink-weapon-modifiers>[data-slink-weapon-merit]{color:var(--sp-success)}
.slink-weapon-modifiers>[data-slink-weapon-xp]{color:color-mix(in srgb,var(--sp-text) 56%,#267de2)}
.slink-page-ui .slink-page-warning{color:var(--sp-danger)}
@media(pointer:coarse){.slink-page-ui :is(button,select,summary),.slink-page-toggle,.slink-page-action{min-block-size:34px}}

/* Shared boolean controls; consent and task-completion checkboxes stay native. */
input[type=checkbox].slink-switch,button.slink-switch-button{
 --sw-text:var(--slt-text,var(--slink-text,var(--s-text,currentColor)));
 --sw-bg:var(--slt-control,var(--slink-bg-control,var(--s-control,#343b48)));
 --sw-accent:var(--slt-accent,var(--slink-accent,var(--s-accent,#8435c5)));
 --sw-border:var(--slt-border,var(--slink-border,var(--s-border,#8391a3)));
 cursor:pointer;color:var(--sw-text);vertical-align:middle;flex-shrink:0;
}
input[type=checkbox].slink-switch{
 appearance:none!important;-webkit-appearance:none!important;position:relative!important;display:inline-block!important;
 inline-size:36px!important;width:36px!important;min-inline-size:36px!important;max-inline-size:36px!important;
 block-size:22px!important;height:22px!important;min-block-size:22px!important;max-block-size:22px!important;
 padding:0!important;margin:0!important;border:1px solid var(--sw-border)!important;border-radius:999px!important;
 background:var(--sw-bg)!important;box-sizing:border-box!important;box-shadow:none!important;align-self:center;order:1;
}
input[type=checkbox].slink-switch::before{
 content:''!important;position:absolute!important;inset:3px auto auto 3px!important;width:14px!important;height:14px!important;
 inline-size:14px!important;block-size:14px!important;border-radius:50%!important;background:var(--sw-text)!important;transform:none!important;
}
input[type=checkbox].slink-switch:checked{background:var(--sw-accent)!important;border-color:var(--sw-accent)!important}
input[type=checkbox].slink-switch:checked::before{transform:translateX(14px)!important}
label.slink-switch-label{display:flex!important;align-items:center!important;justify-content:space-between;gap:10px!important;min-block-size:36px;min-inline-size:0;cursor:pointer}
button.slink-switch-button{display:inline-flex;align-items:center;justify-content:space-between;gap:10px;min-block-size:36px;max-inline-size:100%;padding:5px 8px;border:1px solid var(--sw-border);border-radius:7px;background:var(--sw-bg);font:inherit}
button.slink-switch-button::after{content:'';flex:none;width:36px;height:22px;box-sizing:border-box;border:1px solid var(--sw-border);border-radius:999px;background:radial-gradient(circle at 10px 50%,var(--sw-text) 0 7px,transparent 7.5px),var(--sw-bg)}
button.slink-switch-button[aria-checked=true]::after{background:radial-gradient(circle at 24px 50%,var(--sw-text) 0 7px,transparent 7.5px),var(--sw-accent);border-color:var(--sw-accent)}
:is(input.slink-switch,button.slink-switch-button):focus-visible{outline:2px solid var(--sw-accent)!important;outline-offset:3px!important}
:is(input.slink-switch,button.slink-switch-button):disabled{opacity:.5;cursor:not-allowed}
@media(pointer:coarse){label.slink-switch-label,button.slink-switch-button{min-block-size:44px}}
@media(forced-colors:active){input[type=checkbox].slink-switch{appearance:auto!important;inline-size:22px!important;width:22px!important}input.slink-switch::before{display:none!important}button.slink-switch-button::after{content:'Off';background:none}button.slink-switch-button[aria-checked=true]::after{content:'On'}}

input[type=checkbox][data-racing-toggle]{appearance:auto!important;width:18px!important;inline-size:18px!important;min-inline-size:18px!important;max-inline-size:18px!important;height:18px!important;block-size:18px!important;min-block-size:18px!important;margin:0 6px 0 0!important;padding:0!important;accent-color:var(--slink-accent,var(--s-accent,#8435c5))}
label:has(>input[data-racing-toggle]){display:inline-flex;align-items:center;gap:6px;min-height:36px}
`;
  const switchRoots=new WeakSet();
  function slinkNode(node){
    return !!node&&(String(node.id||'').startsWith('slink-')||String(node.className||'').split(/\s+/).some(c=>c.startsWith('slink-'))||Object.keys(node.dataset||{}).some(k=>k.startsWith('slink')));
  }
  function switchInput(input,root){
    const label=input.closest('label')||input.labels?.[0];
    const identity=[input.id,input.name,...Object.keys(input.dataset||{})].join(' ');
    if(input.matches('[data-switch-exempt],[data-racing-toggle]')||/consent|terms|disclosure|agreement|accept|api.?scope|api.?feature|api.?use/i.test(identity)||/\b(?:accept|agree|consent|authorize|grant|acknowledge|understand)\b|terms|disclosure|use saved.*api key/i.test(label?.textContent||''))return;
    if(root.nodeType===9&&!/^(?:chrome|moz)-extension:$/.test(root.location?.protocol||'')){
      let own=false;for(let n=input;n;n=n.parentElement)if(slinkNode(n)){own=true;break;}
      if(!own)return;
    }
    input.classList.add('slink-switch');input.setAttribute('role','switch');label?.classList.add('slink-switch-label');
  }
  function enhanceSwitches(root){
    if(!root||switchRoots.has(root))return;switchRoots.add(root);
    const scan=node=>{
      if(node.nodeType!==1&&node!==root)return;
      if(node.matches?.('input[type=checkbox]'))switchInput(node,root);
      for(const input of node.querySelectorAll?.('input[type=checkbox]')||[])switchInput(input,root);
      for(const host of [node,...node.querySelectorAll?.('*')||[]])if(host.shadowRoot&&slinkNode(host))install(host.shadowRoot);
    };
    scan(root);
    new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)scan(node);}).observe(root,{childList:true,subtree:true});
  }

  const installed=new WeakSet();
  function install(root=global.document){
    if(!root||installed.has(root)||(root.nodeType!==9&&!root.host))return;
    const parent=root.nodeType===9?root.head||root.documentElement:root;
    if(!parent)return;
    const style=(root.ownerDocument||root).createElement('style');
    style.dataset.slinkTornComponents='';style.textContent=css;parent.append(style);installed.add(root);enhanceSwitches(root);
  }
  function mark(node,...classes){node.classList.add(...classes);install(node.ownerDocument);return node;}
  function card(node){return mark(node,'slink-page-ui','slink-page-card');}
  function switchRow(label,input){
    label.classList.add('slink-page-toggle');
    input.setAttribute('role','switch');return label;
  }
  function weaponStat(icon,kind,value,label){
    return decorateWeaponValue(icon?.nextElementSibling,kind,value,label,false);
  }
  function decorateWeaponValue(base,kind,value,label,shop){
    if(!value||!base?.matches('span'))return null;
    const cell=base.parentElement;
    if(cell?.children.length!==2||cell.lastElementChild!==base)return null;
    const native=Array.from(base.childNodes).filter(n=>!n.matches?.('.slink-weapon-modifiers'));
    if(native.some(n=>n.nodeType===1&&!(shop&&n.matches('span[aria-hidden="true"]:not(:has(*))'))))return null;
    if(!/^\d+(?:\.\d+)?$/.test(native.map(n=>n.textContent).join('').trim()))return null;
    const nativeMarket=shop&&cell.matches('[class*="property___"]');
    let group=base.querySelector(':scope > .slink-weapon-modifiers');
    if(!group){
      group=base.ownerDocument.createElement('span');group.className='slink-weapon-modifiers';
      base.append(group);base.classList.add('slink-weapon-stat');
      if(nativeMarket)base.classList.add('slink-weapon-market-value');
      else {cell.classList.add('slink-weapon-stat-cell');if(shop)cell.classList.add('slink-weapon-shop-stat');}
    }
    const marker=kind==='merit'?'data-slink-weapon-merit':'data-slink-weapon-xp';
    let piece=group.querySelector('['+marker+']');
    if(!piece){piece=base.ownerDocument.createElement('span');piece.setAttribute(marker,'');if(kind==='merit')group.prepend(piece);else group.append(piece);}
    if(piece.textContent!==value)piece.textContent=value;
    if(piece.title!==label)piece.title=label;
    return piece;
  }
  const marketWeaponRows='[data-testid="item"],[class^="itemTile___"],[class*=" itemTile___"]';
  const marketStatSelectors={
    damage:'.bonus-attachment-item-damage-bonus + span,[class*="property___"] > span[aria-label$=" damage points"]',
    accuracy:'.bonus-attachment-item-accuracy-bonus + span,[class*="property___"] > span[aria-label$=" accuracy points"]'
  };
  const marketStats=Object.values(marketStatSelectors).join(',');
  function marketWeaponId(row){
    const img=row.querySelector('[data-testid="img-container"] img,[class*="tileImage___"] img,img[src*="/images/items/"]');
    return [img?.getAttribute('src'),img?.getAttribute('srcset')].join(' ').match(/\/images\/items\/(\d+)\//)?.[1]||'';
  }
  function marketWeaponStat(row,stat,kind,value,label){
    return decorateWeaponValue(row.querySelector(marketStatSelectors[stat]),kind,value,label,true);
  }
  function clearWeaponStat(piece){
    const group=piece.parentElement,base=group?.parentElement;
    piece.remove();
    if(group&&!group.childElementCount){group.remove();base?.classList.remove('slink-weapon-stat','slink-weapon-market-value');base?.parentElement?.classList.remove('slink-weapon-stat-cell','slink-weapon-shop-stat');}
  }
  global.SLINK_TORN_COMPONENTS=Object.freeze({install,mark,card,switchRow,enhanceSwitches,weaponStat,clearWeaponStat,marketWeaponRows,marketStats,marketWeaponId,marketWeaponStat});
  if(global.document)install();
})(globalThis);
