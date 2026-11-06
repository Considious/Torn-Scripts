# Candy Cartel

Layout update: equal side gutters around the candy rails, wrapping navigation with corner alert counts, 64px alert artwork, and compact content-sized action buttons. Checked in extension, PDA and dashboard layouts; no storage or API behavior changed.

Candy Cartel is available as a SLINK theme, with optional Torn-page styling through the existing theme settings. It includes the approved chocolate frames, purple/cherry/pistachio gradients, candy-chain rails, themed SL badge and twelve alert icons.

Permission: `slink.theme.candy-cartel`; `admin.*` is also accepted. Switching themes removes the decorations and restores normal controls. Theme effects do not start API checks or add polling.

The approved Theme Lab stylesheet is shipped as `assets/themes/candy-cartel-theme.css` and embedded byte-for-byte in the runtime package. Native interface sizes remain resizable. The extension's Torn panel and full dashboard use the same package.

Checked with the actual extension shell and Efficiency module, native PDA markup, dashboard markup, and opt-in Torn theme renderer at mobile/desktop widths. Not a physical-device PDA test. Native PDA storage-recovery and saved-setting acknowledgement tests passed; storage implementation was not changed.
