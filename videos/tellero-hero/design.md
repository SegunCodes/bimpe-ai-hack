# Tellero — design spec (brand truth for the hero film)

Taken from the live marketing site (frontend/src/app/globals.css).

## Colour
| Role | Hex | Notes |
| --- | --- | --- |
| Background (every scene) | `#0b1220` ink | same field in all scenes so the loop is seamless |
| Raised surface | `#151e30` | call panel, chips |
| Foreground text | `#f4f5f8` paper | never pure white |
| Accent (one hue) | `#ffc20e` danfo yellow | focal hits, rider pin, mark tile; ink text on it |
| Product action | `#6366f1` indigo | "Scheduled" state only |
| Done | `#16a34a` green | "Confirmed" / "Ready for dispatch" only |
| Problem | `#ef4444` red | the vague-address circle and strike only |
| Address updated | `#a855f7` purple | status badge only (matches the dashboard) |

## Type
- Display: **Bricolage Grotesque** 700–800, tracking −0.035em, embedded locally (assets/fonts, OFL).
- UI/body: **Inter** 400/700 (bundled by HyperFrames; it is the product's UI font, so it stays despite being generic).
- Data/meta labels: **JetBrains Mono** 400/700, uppercase, +0.08em.

## Do / don't
- Do: Lagos specifics (landmark addresses, Pidgin, danfo yellow, riders).
- Don't: purple→blue "AI" gradients, gradient text, fake stats, real marketplace names.
