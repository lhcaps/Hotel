# Original golden-flow matrix

This truth table follows the lifecycle stated by the original authority. It
does not infer production verification from local source or test evidence.

| STEP                                         | IMPLEMENTED | AUTOMATED_TEST | E2E     | PRODUCTION | FIRST_GAP                                                                 |
| -------------------------------------------- | ----------- | -------------- | ------- | ---------- | ------------------------------------------------------------------------- |
| Search room type and quote                   | YES         | YES            | PARTIAL | PARTIAL    | Complete original policy-explanation matrix not traced                    |
| Create one HOLD / allocate one physical room | YES         | YES            | PARTIAL | PARTIAL    | Final multi-night acceptance trace pending                                |
| Verified Demo payment confirms booking       | YES         | YES            | PARTIAL | PARTIAL    | Full original lifecycle trace pending                                     |
| Keep same physical room for continuous stay  | PARTIAL     | PARTIAL        | PARTIAL | PARTIAL    | Current B0 evidence must be re-run against final acceptance matrix        |
| Establish room readiness before arrival      | PARTIAL     | PARTIAL        | NO      | NO         | No authoritative composite readiness model                                |
| Issue T-30 access credential                 | NO          | NO             | NO      | NO         | No persistent credential/provider/worker lifecycle                        |
| Check in                                     | YES         | YES            | PARTIAL | PARTIAL    | T-30 credential link absent                                               |
| Occupy through final checkout                | PARTIAL     | PARTIAL        | NO      | NO         | Connected multi-night/access proof absent                                 |
| Check out -> room DIRTY -> one turnover task | YES         | YES            | PARTIAL | NO         | Browser-level canonical lifecycle coverage remains                        |
| Assign/reassign cleaner                      | PARTIAL     | YES            | NO      | NO         | Versioned assignment exists; staff-specific RBAC and browser proof absent |
| Start, complete, verify/reopen cleaning      | YES         | YES            | NO      | NO         | Dedicated staff role and browser proof remain                             |
| Derive ready room for next booking           | PARTIAL     | PARTIAL        | NO      | NO         | Client-side room grouping is not authoritative derived state              |
| Allocate next booking without overlap        | YES         | YES            | PARTIAL | PARTIAL    | Must be proven after the new readiness/housekeeping flow                  |

`ORIGINAL_GOLDEN_FLOW_STATUS=PARTIAL`

`FIRST_MISSING_GOLDEN_FLOW_TRANSITION=CONFIRMED_AND_READY -> T-30_PERSISTED_ACCESS_CREDENTIAL`
