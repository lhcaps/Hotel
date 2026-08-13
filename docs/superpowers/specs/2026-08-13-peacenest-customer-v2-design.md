# PeaceNest Customer Experience V2 design

## Approval and boundaries

The explicit master brief and the attached human-approved PeaceNest contact sheet are the approved design source for this specification. No new visual concept, generated imagery, fake business data, Customer mode selector, production deployment, branch, worktree, reset, clean, stash, or broad staging is authorized.

## Product architecture

Customer V2 is one interval-led experience. The Customer expresses arrival instant, departure instant, adults, and children. A server-side resolver determines valid commercial representations from the active policy, chooses the lowest valid complete total using existing deterministic tie-breaks, and returns safe public failure reasons. The Customer never selects or sees `hourly`, `overnight`, `multi_night`, package codes, pricing-graph nodes, component lines, or physical room identity.

The public catalog becomes the business authority for room identity, description, tier, capacity, amenities, and starting price. It will add the stable `roomTypeCode`. A small media-only manifest resolves that code to client-owned image paths and an optional public slug. No price, tier, capacity, amenity, availability, name, or physical-room data belongs in the manifest. Unknown codes resolve only to a neutral missing-media state.

Customer UI is a server-first Next.js shell with small isolated Client Components for form state, search lifecycle, carousel interaction, and account/payment actions. It reuses Base UI shadcn primitives, shares one booking-search state across landing/search/detail routes, cancels or generations-gates stale requests, and uses truthful Skeleton, Empty, Alert, and retry states.

## Customer flow

```text
Landing or /booking/search
  -> one unified interval form
  -> server availability with no required mode
  -> API-owned tier rail and exact offer
  -> room concept detail, preserving interval and guests
  -> authoritative quote
  -> transactional HOLD of one physical room for the full interval
  -> provider settlement callback
  -> one confirmed booking, one semantic confirmation notification
  -> account or guest booking detail
  -> T-30 authorized QR and configured arrival package
  -> scanner check-in and checkout/revocation
```

## Notification and access architecture

Payment settlement remains the sole confirmation authority. The payment service creates one durable semantic notification identity per booking-confirmed event. The worker may retry SMTP, but duplicate provider callbacks must not create a second logical confirmation. HOLD events remain security/expiry mechanics and do not send a normal reservation summary.

At T-30, the worker evaluates the database clock, booking confirmation, full-stay room allocation, room active/clean state, and overlapping maintenance. It resolves a separate, encrypted guest-access configuration only at delivery time. Property data owns gate pass, Wi-Fi, support, and defaults; physical-room data owns room pass, location, and room-specific overrides. Normal Admin reads return only configuration state for secrets. Audit events record the actor, target, and field category but never a secret value. Provider credential references remain opaque and are never rendered.

The existing signed BookingAccessPass QR is retained, not replaced. A dedicated authorized booking-detail endpoint returns the customer-safe T-30 package with `Cache-Control: no-store`; before T-30 it returns an explanatory readiness state without secrets.

## Visual and interaction system

The contact sheet defines a lightly editorial PeaceNest system: white/soft-ivory canvas, natural deep green emphasis, serif hospitality headings, clean sans UI type, thin warm borders, restrained radii/shadows, real photography, minimal navigation, and intentional mobile states. Desktop presents a compact horizontal interval form, tier rails, useful room detail summary, and a real checkout path. Phone layouts use a Sheet/Drawer navigation, a vertical booking form, approximately 1.1 rail cards, gallery-first details, and a sticky CTA only when it represents a real next action.

Every visible control has an API, navigation, state, or accessible disclosure result. Async actions provide pending, success/transition, and safe error feedback. Motion is limited to transform/opacity, fast and interruptible, with reduced-motion handling. The visual contract and interaction ledger are the acceptance matrix.

## Failure and safety behavior

- Catalog, availability, and pricing failures show explicit unavailable/retry states and never synthetic rooms, rates, room counts, or booking data.
- Public API errors are mapped to Vietnamese customer-safe reasons such as no room, no pricing candidate, invalid interval, minimum/maximum stay, lead time, advance limit, and capacity.
- Quotes and HOLDs persist the selected authoritative representation and immutable money snapshot; the browser never calculates a price.
- Customer-facing physical-room numbers, UUIDs, provider credential references, encryption keys, plaintext secrets, and internal pricing explanations remain unavailable.
- Customer registration is rendered only if the existing governing policy permits and a complete verified Customer-only lifecycle exists. Otherwise unsupported controls do not appear.

## Verification design

Each production behavior starts with a regression test that fails for the missing/incorrect behavior, then receives the smallest passing implementation. The final proof separates unit, integration, database, build, browser, visual, hosted CI, and production evidence. This task stops after exact-SHA hosted CI succeeds; no production action occurs.
