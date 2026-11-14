/* Shared by the extension and PDA. Only opt-in SLINK nodes are styled. */
(function installTornComponents(global){
  'use strict';
  const css=`
:root:has(body.dark-mode),body.dark-mode{
  --sp-native-bg:#242831;--sp-native-text:#edf1f7;--sp-native-control:#343b48
}
:where(.slink-page-ui,.slink-page-note,.slink-page-action,.slink-page-positive){
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
:host([data-slink-appearance="dark"]) :where(.slink-page-ui,.slink-page-note,.slink-page-action,.slink-page-positive){
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
.slink-page-ui .slink-page-warning{color:var(--sp-danger)}
@media(pointer:coarse){.slink-page-ui :is(button,select,summary),.slink-page-toggle,.slink-page-action{min-block-size:34px}}
`;
  const installed=new WeakSet();
  function install(root=global.document){
    if(!root||installed.has(root)||(root.nodeType!==9&&!root.host))return;
    const parent=root.nodeType===9?root.head||root.documentElement:root;
    if(!parent)return;
    const style=(root.ownerDocument||root).createElement('style');
    style.dataset.slinkTornComponents='';style.textContent=css;parent.append(style);installed.add(root);
  }
  function mark(node,...classes){node.classList.add(...classes);install(node.ownerDocument);return node;}
  function card(node){return mark(node,'slink-page-ui','slink-page-card');}
  function switchRow(label,input){
    label.classList.add('slink-page-toggle');
    input.setAttribute('role','switch');return label;
  }
  global.SLINK_TORN_COMPONENTS=Object.freeze({install,mark,card,switchRow});
  if(global.document)install();
})(globalThis);
