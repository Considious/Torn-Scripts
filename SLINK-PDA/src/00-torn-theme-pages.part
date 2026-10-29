(function installTornPageThemeRules(global) {
  'use strict';
  // Derived from the actual page captures supplied by the owner, October 2026.
  // Match stable roots and CSS-module name prefixes, never build hash suffixes,
  // button positions, user IDs, or game-state classes.
  const scope='html[data-slink-torn-theme][data-slink-torn-theme]';
  const groups=Object.freeze([
    {id:'crimes',selector:'.crimes-app :is(.crimes-hub-root,.crime-root,[class*="crimeOptionWrapper___"],[class*="statsPanel___"],[class*="virtualItemsBackdrop___"])',role:'panel'},
    {id:'crime-hub-cards',selector:'.crimes-app .crimes-hub-crime:not(.max-level)',role:'panel'},
    {id:'crime-header',selector:'.crimes-app .crimes-app-header',role:'control'},
    {id:'travel',selector:'#travel-root :is([class*="departPanel___"],[class*="inventoryPanel___"],[class*="searchResults___"],[class*="flightTypeList___"]):not([class*="selected___"]):not([class*="disabled___"])',role:'panel'},
    {id:'attack',selector:'#attack-root [class*="coreWrap___"]',role:'panel'},
    {id:'attack-header',selector:'#attack-root [class*="appHeaderWrapper___"]',role:'control'},
    {id:'attack-log',selector:'[aria-label="Attack log"], [aria-label="Attack log"] :is([class*="containerHeader___"],[class*="containerBody___"],[class*="logContent___"])',role:'panel'},
    {id:'chat-panels',selector:'#chatRoot :is(#settings_panel,#notes_panel,#private-channel-list,#company,#faction,[id^="private-"])',role:'panel',chat:true},
    {id:'chat-buttons',selector:'#chatRoot :is([id^="chat_panel_button:"],#notes_panel_button,#notes_settings_button,[title="Settings"],[title="Your private chats"])',role:'control',chat:true}
  ]);
  const css=groups.map(group=>scope+(group.chat?'[data-slink-torn-chat]':'')+' '+group.selector.split(', ').join(', '+scope+(group.chat?'[data-slink-torn-chat]':'')+' ')+
    '{background-color:var(--slt-'+group.role+')!important;color:var(--slt-text)!important;}').join('\n');
  // Do not rewrite background-image, dimensions, overflow, positions, filters,
  // pseudo-elements or descendants' semantic colors. Native layout/state stays.
  global.SLINK_TORN_PAGE_RULES=Object.freeze({groups,css});
})(globalThis);
