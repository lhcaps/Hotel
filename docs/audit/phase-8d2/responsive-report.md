# Phase 8D.2 responsive report

The focused browser matrix ran at `390x844`, `768x1024`, `1366x768`, and `1440x900` with `workers=1`, `retries=0`.

| Coverage                                                                                               | Result                       |
| ------------------------------------------------------------------------------------------------------ | ---------------------------- |
| English public search, locale switch, search action and reload                                         | PASS                         |
| English customer profile and booking list                                                              | PASS                         |
| English ADMIN rate plans, coupons, bookings, operational reviews and payments at every locked viewport | PASS                         |
| Document horizontal overflow                                                                           | `CRITICAL_LAYOUT_OVERFLOW=0` |
| Clipped labels                                                                                         | 0                            |
| Offscreen non-table actions                                                                            | 0                            |

The P1 defect found at 390px and 768px was a broad ADMIN form/table width. Mobile form controls now use an inline-size constrained flow; data tables retain semantic table markup and provide an internal horizontal scroll container rather than expanding the document. No design-system replacement or product feature was added.

Representative evidence is the deterministic `tests/e2e/phase-8d2-localization.spec.ts` browser matrix. It also checks English copy at every route, visible main content, and page-error absence where the public flow is exercised.
