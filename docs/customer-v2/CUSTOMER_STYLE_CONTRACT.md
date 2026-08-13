# PeaceNest Customer V2 style contract

## Authority and scope

The attached human-approved PeaceNest contact sheet is the visual authority for Customer surfaces. This contract standardizes it; it does not authorize a new concept, generated imagery, invented brand content, or an Admin redesign.

## Design DNA

- Canvas: white to soft ivory, with thin warm-neutral dividers and very restrained elevation.
- Brand: deep natural PeaceNest green for the primary CTA, active state, and small functional emphasis. No navy Room Management legacy treatment, cobalt, purple, glow, or gradient-led styling.
- Typography: a quiet elegant serif for hospitality headings and a clean sans-serif for body text, controls, labels, and status. The serif is editorial, never oversized or ornamental.
- Layout: a light minimal top bar; wide but bounded desktop content; generous editorial whitespace; compact stacked phone layouts. Avoid card grids where a rail, image field, or open layout is the reference.
- Media: client-owned room/property photography is the visual lead. Images keep their correct room identity and natural crop, rather than receiving decorative overlays.
- Shape: restrained radius, one-pixel warm borders, low shadows, and clear focus states. No giant rounded SaaS containers or pill/badge accumulation.
- Motion: only reveal, panel, rail, and result-expansion motion that preserves hierarchy or spatial continuity. Prefer transform/opacity, 100-140 ms button feedback, 150-200 ms popovers, 200-320 ms result expansion, 200-280 ms drawers, and reduced-motion fallbacks.

## Reference surface mapping

| Contact-sheet surfaces                                         | Contracted Customer implementation                                                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Editorial landing hero with interval form and room photography | `/` with `CustomerHeader`, one `UnifiedBookingForm`, real landing media, catalog-derived discovery rail, and useful truthful stay information |
| Desktop and mobile expanded room results                       | `/booking/search` as the same form/state with real tier groups and horizontal room rails                                                      |
| Wabi/Nami room details in desktop/mobile variants              | `/rooms/[roomTypeId]` with exact-gallery media, API-owned facts, selected interval summary, desktop side CTA and mobile sticky CTA            |
| Checkout and confirmation variants                             | Existing quote/checkout route architecture restyled as steps 3-5, preserving payment authority and real data                                  |
| Login and account phone variants                               | Mobile-first Customer shell, not the Admin visual system                                                                                      |
| T-30 email and access cards                                    | Email-safe HTML plus authorized booking-detail access panel, both only from configured secure sources                                         |
| Admin property and physical-room configuration screens         | Existing Admin system only, with compact masked access-config controls                                                                        |

## Component and state rules

- Interactive Customer elements use the existing Base UI shadcn source primitives. Forms use `FieldGroup`, `Field`, labels, descriptions, errors, and correct invalid attributes.
- Date/time selection is composed from shadcn primitives and must remain keyboard/touch accessible. It must expose intent, not pricing mode.
- Loading uses geometry-matched Skeleton components. Empty, unavailable, error, and retry states are explicit and truthful.
- A carousel has real overflow-aware arrows, swipe, and keyboard interaction; it is not a static row decorated with arrows.
- All responsive changes are designed at 390x844, 430x932, 768x1024, 1024, 1440, and 1920 widths. The mobile form becomes an intentional single-column flow; room rails retain roughly one visible card plus continuation.
- No surface may add fake ratings, testimonials, awards, statistics, badge soup, placeholder links, no-op actions, or generic generated hospitality copy.

## Visual QA method

For every required screen capture the Customer render at its matching viewport, compare it to the contact-sheet region, record a concrete mismatch and its correction, then retest interactions and console health. The final fidelity ledger must include landing desktop/mobile, search desktop/mobile, detail desktop/mobile, login, account list, booking detail before/after T-30, checkout, confirmation, both emails, and the two required Admin configuration screens.
