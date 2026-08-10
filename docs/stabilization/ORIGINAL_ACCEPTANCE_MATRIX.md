# Original acceptance matrix

Only scenarios explicitly required by the Operations V3 authority are listed.
`NO_EXECUTABLE_TEST` is evidence of a gap, not a failure suppression.

| SCENARIO                                                                        | SOURCE_REQUIREMENT | TEST_FILE                                                    | LOCAL_STATUS | E2E_STATUS | PRODUCTION_STATUS | NEXT_WAVE |
| ------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------ | ------------ | ---------- | ----------------- | --------- |
| Checkout creates exactly one turnover task and DIRTY room                       | 15.2               | NO_EXECUTABLE_TEST                                           | NO           | NO         | NO                | W5        |
| Concurrent housekeeping assignment and version conflict                         | 15.2               | NO_EXECUTABLE_TEST                                           | NO           | NO         | NO                | W5        |
| Cross-property housekeeping assignment denied                                   | 15.2               | NO_EXECUTABLE_TEST                                           | NO           | NO         | NO                | W5/W6     |
| No credential before/exactly at T-30; confirmed-only                            | 15.3               | NO_EXECUTABLE_TEST                                           | NO           | NO         | NO                | W5        |
| Credential denial: HOLD/cancelled/expired/maintenance/not-ready/no-room         | 15.3               | NO_EXECUTABLE_TEST                                           | NO           | NO         | NO                | W5        |
| Credential duplicate/retry/revoke/late/redaction                                | 15.3               | NO_EXECUTABLE_TEST                                           | NO           | NO         | NO                | W5        |
| Property read/mutation/list/aggregate scope and UUID substitution denial        | 15.4               | NO_EXECUTABLE_TEST                                           | NO           | NO         | NO                | W6        |
| Original property preserves 23-room inventory                                   | 15.4               | Existing catalog/inventory tests, no direct acceptance trace | PARTIAL      | NO         | NO                | W6        |
| Pricing 11:00–14:00, 11:00–15:00, 14:45–18:00                                   | 15.5               | pricing-policy suites, original trace incomplete             | PARTIAL      | PARTIAL    | NO                | W6        |
| Pricing 18:00/20:00/21:00–09:00 and 23:00–03:00 candidates                      | 15.5               | pricing-policy suites, original trace incomplete             | PARTIAL      | PARTIAL    | NO                | W6        |
| Pricing exact/over 3h, 4h, 5h, 16h, 24h                                         | 15.5               | pricing-policy suites, original trace incomplete             | PARTIAL      | PARTIAL    | NO                | W6        |
| Pricing month/year/leap-day/timezone/coverage/tie/coupon/snapshot/client amount | 15.5               | Phase 8 audits and pricing tests, original trace incomplete  | PARTIAL      | PARTIAL    | NO                | W6        |
| Every operational profile: navigation/API/mutation/minimization/session/audit   | 15.6               | `room-status-viewer.spec.ts` plus auth suites                | PARTIAL      | PARTIAL    | PARTIAL           | W5/W6     |
| Required six viewports, overflow, keyboard, focus, states, i18n, reduced motion | 15.7               | Admin V2 responsive/a11y suites                              | PARTIAL      | PARTIAL    | NO                | W8        |
| Full browser lifecycle through next booking                                     | Phase H / 27–29    | NO_EXECUTABLE_TEST                                           | NO           | NO         | NO                | W9        |
