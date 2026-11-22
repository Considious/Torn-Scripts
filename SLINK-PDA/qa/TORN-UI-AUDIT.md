# Batch 1–6: Torn-page UI audit

The extension and PDA use the same opt-in Torn components stylesheet. It uses the active SLINK/Torn theme tokens with readable default light/dark surfaces, rather than theme-specific component rules. Cards, compact notes, action/link buttons, wrapping toolbars, label/control rows and switches are separate primitives. No Torn controls are opted in by tag or by a page-wide selector.

| Surface | Audit result |
| --- | --- |
| Page Tools | Shared surfaces for Quick Use, item effects/value, special shortcuts, custom links, update notices and the preferences panel; persistent settings are switches. |
| List filters | Faction, hospital, jail, abroad people, user list, friends/targets/enemies and shop/travel lists use styled controls. Stock, bounty and ranked-war filters retain native list placement. |
| Items / Armory / Attack | Weapon mastery and weapon XP use account-scoped six-hour snapshots, automatic loading through the existing limiter, and Retry on error. Armory filter/recaller and member selections keep their native item/confirmation assumptions. |
| Crimes | Arson, pickpocketing, cracking, disposal, forgery, hustling, scamming and guide links reviewed. Arson keeps its portal and picker layering; forgery stays inline with the Torn project title. |
| Casino | Game visibility uses one labeled switch per game; blackjack/high-low scenario inputs retain normal form controls. |
| Market and Bazaar | Quick Buy uses shared semantic colors; live geometry, matching, native purchase controls and intentional deal highlights were not changed. |
| Profile / City / Gym / Missions | Notes, city pickups, gym advice and mission hints use shared cards or compact annotations. Map markers and attack-slot indicators preserve native geometry. |
| Travel / Rehab / Bank / Properties / Stocks | Setup and action panels use shared surfaces; existing native interactions and anchors remain unchanged. |
| War / timers / Companion | Inline status, friendly-fire guidance, war-list tools and Companion settings reviewed; related controls align in the narrow shell. |
| Museums | Dashboard-only on the Batch 6 surfaces reviewed; no new Torn-page mount to migrate. |

Not redesigned: Torn's native/virtualized list rows, stock/bazaar buy controls, native weapon stat cells, map markers, native chat/faction-room shell and the broader SLINK dashboard theme. Rebuilding those controls, widening attack tiles or altering decorative art would be outside this scoped pass and risk gameplay/layout regressions. Compact annotations intentionally avoid full cards inside dense Torn rows.

Browser fixture checks: default light, default dark, Candy Cartel, Halloween 2026 and Christmas Naughty List, at 320px and 1024px. Casino switches/native list updates, Faction filters, Travel Run shadow styling, Page Tools switches, Companion alignment, focus and primary/action contrast were exercised. This is not live Torn or physical PDA certification.

Live acceptance: on a signed-in faction list, Items, Armory, Crimes, Casino, Market/Bazaar and Abroad, check the same palettes plus theme artwork/frames, the narrow panels, and list rerenders. Check Companion and crime guide links in both dashboards. Confirm one automatic weapon lookup per owner per six hours, no hidden-page loading, and no change to Torn's native controls or action confirmations.
