# Final customer UI rebuild

## Scope delivered

- Rebuilt the public entry as a hospitality landing page with responsive navigation, a real availability form, hourly/overnight mode tabs, local room imagery, truthful alt text, and paths into search and guest booking management.
- Kept server authority intact: availability, quote issuance, HOLD expiry, payment settlement, RBAC, and physical-room allocation remain API-owned.
- Restyled guest OTP access and preserved the existing quote, HOLD, payment, and account flows.
- Reworked the ADMIN shell into grouped navigation with current-page state, responsive layout, report cards, server-backed room operations on the overview, and no client-side operational authority.
- Moved new report/dashboard copy through typed Vietnamese/English i18n and preserved existing route contracts.

## Visual evidence

- Desktop landing: `output/playwright/landing-desktop-final.png`
- Desktop hourly mode: `output/playwright/landing-hourly-desktop.png`
- Mobile landing: `output/playwright/landing-mobile-final.png`
- Mobile guest access: `output/playwright/guest-access-mobile.png`

The images are local generated assets in `apps/web/public/images/hospitality/`; no remote image dependency was added.

## Verification

| Gate                                                        | Result                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `pnpm --filter @room/web lint`                              | PASS                                                       |
| `pnpm --filter @room/web typecheck`                         | PASS                                                       |
| `pnpm --filter @room/web test:unit`                         | PASS, 35 files / 145 tests                                 |
| Focused UI, accessibility, OTP, report and room-board tests | PASS, 24 tests                                             |
| `pnpm check:i18n-critical`                                  | PASS, 78 files scanned / 0 direct Vietnamese critical copy |
| `pnpm check:endpoints`                                      | PASS, 78 runtime routes / 74 documented / 4 allowlisted    |
| `pnpm check:openapi`                                        | PASS                                                       |
| `pnpm db:status`                                            | PASS, `phase-8d-client-acceptance-v1`                      |
| `pnpm build`                                                | PASS, 9 packages                                           |
| Focused repaired browser suite                              | PASS, 15 tests                                             |
| `pnpm test:e2e` final run                                   | PASS, 72 browser tests plus 1 unavailable-state test       |

`pnpm format:check` remains a repository-wide baseline failure: it reports 314 pre-existing files plus transient `.playwright-cli` snapshots. All files changed for this delivery pass an explicit Prettier check.

## External readiness boundary

Local product checks are green. Provider checks still correctly report MoMo sandbox credentials and public HTTPS callbacks as external prerequisites; no provider credentials, deployment, or payment settlement behavior was changed in this UI delivery.
