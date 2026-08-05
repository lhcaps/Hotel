# ADMIN V2 final visual acceptance V2

Date: 2026-08-05
Scope: current committed-candidate worktree before release packaging
Baseline: `7203905d09ab49bfa06a35e99e57510d9fa5b7f2`
Capture command: `pnpm exec playwright test tests/e2e/admin-v2-visual-acceptance.spec.ts`
Capture pass: `final-v2`

## Final verdict

PASS for the local authenticated visual harness. The current source rendered
all 26 required route entries at all five required widths: 130 PNG captures.
The browser assertion reported no document-width overflow on any route/width
pair.

Required widths:

- 390 × 844
- 768 × 1024
- 1280 × 800
- 1440 × 900
- 1920 × 1080

Evidence root: `output/playwright/admin-v2/acceptance/final-v2/`

The route-by-route manifest, principal, viewport expansion, and final verdict
are retained in [FINAL_VISUAL_ACCEPTANCE.md](./FINAL_VISUAL_ACCEPTANCE.md).
The manifest's evidence root is interpreted as the V2 root above for this
pass; each route has one file per required viewport.

## Fidelity ledger

| Surface            | Evidence inspected                                                                       | Verdict | Notes                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| Shared shell       | `desktop-1440/overview.png`, `desktop-wide-1920/overview.png`, `mobile-390/overview.png` | PASS    | Sidebar, topbar, content inset, active navigation, and mobile shell remain aligned.                                   |
| Overview           | `desktop-1440/overview.png`, `mobile-390/overview.png`                                   | PASS    | Five decision metrics, queues, analytics, filter toolbar, and honest empty/partial copy are visible without overflow. |
| Booking data table | `desktop-1440/bookings.png`, `mobile-390/bookings.png`                                   | PASS    | Desktop uses a full-width operational table; mobile switches to labelled records with readable values and actions.    |
| Account management | `desktop-1440/accounts.png`                                                              | PASS    | Customer/admin boundaries are visible, identifiers are masked, and account edits use a Sheet.                         |
| Pricing management | `desktop-1440/rate-plans.png`                                                            | PASS    | Pricing inputs and conditions are grouped by plan; condition editing is on demand in a Sheet.                         |
| Responsive system  | all five viewport folders                                                                | PASS    | Visual runner completed 26 × 5 captures and asserted `scrollWidth <= viewport width`.                                 |
| Motion policy      | current `globals.css` motion block and captured surfaces                                 | PASS    | Application animations and transitions remain disabled.                                                               |

## Quantitative checks

```text
ROUTES=26
VIEWPORTS=5
SCREENSHOTS=130
DOCUMENT_WIDTH_OVERFLOW=0
VISIBLE_RAW_ENUMS_IN_ACCEPTED_SURFACES=0
NAN_PAGINATION=0
NATIVE_MULTIPLE_SELECT=0
PERMANENT_INLINE_ROW_EDIT=0
DUPLICATE_ADMIN_SHELL=0
```

Local screenshots may include the Next.js development indicator. That is test
tooling chrome from the development server, not a product overlay; production
acceptance requires the optimized build and is tracked separately from this
local visual verdict.

## Boundaries

This document proves local authenticated rendering and responsive visual
behavior only. It does not claim production deployment, live-domain browser
acceptance, provider settlement, or real-money execution. Server-side RBAC,
PostgreSQL authority, customer-safe boundaries, and release gates remain
independent acceptance requirements.
