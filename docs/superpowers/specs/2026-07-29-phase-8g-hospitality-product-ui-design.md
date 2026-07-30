# Phase 8G Hospitality Product UI Design

Date: 2026-07-29
Status: Approved direction implemented
Visual authority: `docs/design/references/phase-8g-hospitality-product-concept.png`

## Scope

Phase 8G turns existing authoritative booking, account, payment, and ADMIN flows into a coherent hospitality product. It is a frontend completion phase. The API, pricing, HOLD allocation, payment settlement, roles, migrations, and provider architecture are not redesigned.

## Product character

- Trustworthy, friendly, calm hospitality product.
- Public booking pages are spacious and action-led.
- CUSTOMER pages prioritize clear summaries and safely editable account data.
- ADMIN pages are compact, table-driven operating surfaces.
- UI reflects real server data and actions only. It must not imply room allocation, payment success, provider readiness, or personalised recommendation authority that the server has not returned.

## Visual system

### Tokens

The established global CSS receives semantic tokens only:

- `--background`: white
- `--surface-subtle`: cool slate wash
- `--surface`: white
- `--foreground`: deep ink
- `--muted-foreground`: slate
- `--border`: light neutral
- `--primary`: `#2563eb`
- `--primary-hover`: darker blue
- `--secondary-accent`: `#0ea5e9`
- `--success`: `#16a34a`
- `--warning`: `#f59e0b`
- `--destructive`: `#ef4444`

Raw palette values are localized to CSS tokens and existing semantic state styles. No glass, purple gradients, neon, or dark-mode variant is added.

### Typography and geometry

- Retain the repository sans stack because no font is currently configured.
- Use deliberate hierarchy: compact labels, 14-16px form/table text, 20-28px page headings, and a restrained public display heading.
- Keep public radii at 10-14px and admin radii at 8px.
- Use a 4/8px spacing rhythm, borders before shadows, and restrained shadow only for focal interactive surfaces.
- Provide 44px useful touch targets for primary interactions.

### Motion

- CSS transitions only for focus, hover, disclosure, progress and state acknowledgement, within 140-220ms.
- `prefers-reduced-motion` retains the existing motion override.
- No animation dependency, parallax, or decorative loading sequence.

### Image rule

The approved concept is documentation reference. The existing public availability contract has no local room image field and the repository has no local hospitality imagery. The UI therefore does not introduce fake photography or external images. It uses consistent neutral content surfaces and does not make functionality depend on imagery.

## Surface contracts

### Header

Anonymous header has brand, `Phòng & giá` (booking entry), booking lookup, locale control and login. CUSTOMER header has brand, `Đặt phòng mới`, `Đặt phòng của tôi`, locale control, and an account-menu trigger containing profile/bookings/logout. The client session probe remains the existing authoritative customer session endpoint; no client cookie parsing is introduced. ADMIN remains isolated under `/admin`.

### Public discovery

`/` remains the booking entry. The search form sends interval and occupancy only to existing authoritative availability and quote endpoints. Results show only returned room type name, capacity and availability count. The UI must not fabricate amenities, description, room identity, price, or rate-plan choices that the availability response does not expose.

### Quote, recommendations and HOLD

The quote page is organized as a desktop content/summary layout and mobile single column. The existing quote remains authoritative. Stable rate-plan codes use customer dictionary labels with a generic fallback. Recommendation candidates show the returned dates, duration, plan label, amounts, saving and shift. Applying a candidate creates an authoritative new quote; it creates no booking, HOLD, coupon reservation or payment.

The existing contact form and hold countdown stay in their current route/state model. The browser countdown is informational and rechecks the server; expired UI disables payment continuation and sends the customer back to search.

### Payment

Provider readiness continues to derive from `GET /public/payment-providers`. Each VNPAY/MoMo option visibly distinguishes ready, sandbox and unavailable configuration without naming credentials or showing raw errors. Initiation only redirects to a valid HTTPS URL returned from the server. Browser return remains display-only and persisted application status remains authoritative.

### Customer account

Profile keeps linked email protected, exposes only contract-permitted contact and address fields, and provides loaded, saving, saved and safe-error states. Account booking list/detail uses readable row/list treatment based only on available server fields and does not invent contact, room-type, or lifecycle events that the account contracts omit.

### ADMIN

The existing ADMIN route set is rendered through an efficient desktop sidebar/topbar/workspace and internally-scrollable table regions. Existing catalog managers and operation pages retain their entity-specific forms and endpoints. A small CSS/table convention may be reused; no schema-driven CRUD engine, dynamic form builder, new table package, or extra routes are introduced.

## Accessibility and responsive constraints

- Required viewport evidence: 390x844, 768x1024, 1366x768, 1440x900.
- No document-level horizontal overflow. ADMIN tables scroll only inside their content region.
- Header, primary CTA, forms, payment selection and account menu remain keyboard usable.
- Labels, visible focus, dialog/sheet titles where used, status text beyond color, and the existing reduced-motion handling are preserved.
- Focused axe evaluation must show zero critical and serious violations for critical surfaces.

## Non-goals and safety

No migration, role, pricing formula, payment settlement, provider readiness architecture, cookies-as-authority, secrets, external image, OAuth, AI, new UI dependency, rate-plan calculation, physical-room disclosure, fake provider action, or browser-driven settlement behavior is introduced.
