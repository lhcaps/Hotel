# PEACENEST final-closure audit reconciliation

This reconciliation separates prior audit observations into product defects,
test/fixture defects, coverage gaps, safety boundaries, and external blockers.
It records only evidence actually executed in this closure run. Production
mutation and production database access remain prohibited.

## Prior non-PASS items

ITEM=P2-001 ROOM_STATUS_VIEWER extra navigation and read scope
PREVIOUS_VERDICT=FAIL_DEFECT
ACTUAL_EVENT=Production viewer evidence showed links for rooms, maintenance, and property in addition to the approved room-status surface; server read APIs were permitted by the existing viewer grants.
EXECUTED=Production read-only viewer session; source navigation review; focused navigation unit test; local browser viewer regression.
EVIDENCE_LAYER=SOURCE_UNIT_BROWSER_PRODUCTION_READ_ONLY
HTTP_STATUS=200 for permitted viewer reads; 403 for restricted viewer routes and mutations
ERROR=Approved viewer menu contract was broader than the intended room-operations surface.
PRODUCT_DEFECT=YES
TEST_DEFECT=NO
COVERAGE_GAP=NO
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=NO source correction is not deployed by this run; no production mutation was performed.
CORRECTED_VERDICT=PASS_UNIT
DEFECT_ID=P2-001

ITEM=P2-007 production secure admin session cookie forwarding
PREVIOUS_VERDICT=NOT_PREVIOUSLY_RECORDED
ACTUAL_EVENT=Production-mode Better Auth emitted __Secure-better-auth.session_token, but both same-origin web auth proxy routes only forwarded the legacy better-auth.session_token name. The isolated production-mode parity reproduction returned a successful login without a forwarded session cookie.
EXECUTED=Isolated production-mode parity auth reproduction; source helper test for secure and legacy cookie forwarding; local admin-auth browser regression.
EVIDENCE_LAYER=PARITY_SOURCE_UNIT_BROWSER
HTTP_STATUS=Upstream login 200; pre-fix web proxy response omitted Set-Cookie; repaired proxy response forwards the secure cookie and local admin-auth test passes.
ERROR=Hard-coded legacy cookie-name filter prevented production secure sessions from reaching the web origin.
PRODUCT_DEFECT=YES
TEST_DEFECT=NO
COVERAGE_GAP=YES production-mode secure-cookie coverage was absent from the prior local test configuration.
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=NO source correction requires a release deployment before production PASS can be claimed.
CORRECTED_VERDICT=PASS_UNIT
DEFECT_ID=P2-007

ITEM=P2-002 coupon concurrent E3 ordering
PREVIOUS_VERDICT=FAIL_DEFECT
ACTUAL_EVENT=The lock-holder release permits either the application insert or disable waiter to acquire the row lock first. The trigger correctly rejects an insert after disable; the test incorrectly required the application insert to win.
EXECUTED=Focused PostgreSQL test independently three times; full database integration suite once.
EVIDENCE_LAYER=DB_INTEGRATION
HTTP_STATUS=NOT_APPLICABLE
ERROR=coupon is disabled was a legal serialization outcome, not a product error.
PRODUCT_DEFECT=NO
TEST_DEFECT=YES
COVERAGE_GAP=NO
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=YES local disposable test database only; no production DDL or volume operation.
CORRECTED_VERDICT=PASS_DB_INTEGRATION
DEFECT_ID=P2-002

ITEM=P2-003 reversed date range direct-form E2E timing
PREVIOUS_VERDICT=FAIL_DEFECT
ACTUAL_EVENT=The original test filled the date controls before asynchronous URL hydration completed, so hydration could overwrite the test input. The direct form contract itself already validated correctly once the test waited for initial data.
EXECUTED=Focused and full browser suite with initial-list readiness; direct form, Enter, same-day, from-only, and to-only cases.
EVIDENCE_LAYER=TEST_BROWSER
HTTP_STATUS=200 page response; zero booking-list request for invalid direct and Enter submissions
ERROR=Test readiness race.
PRODUCT_DEFECT=NO
TEST_DEFECT=YES
COVERAGE_GAP=YES prior URL-state coverage was incomplete.
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=YES local browser stack only.
CORRECTED_VERDICT=PASS_BROWSER
DEFECT_ID=P2-003

ITEM=P2-004 admin booking lifecycle fixture
PREVIOUS_VERDICT=FAIL_DEFECT
ACTUAL_EVENT=Eleven catalog-test failures came from fixtures omitting the immutable cancellation-policy snapshot required by the current service guard.
EXECUTED=Fixture repair; admin booking lifecycle integration suite; full API catalog suite.
EVIDENCE_LAYER=DB_INTEGRATION_API_INTEGRATION
HTTP_STATUS=NOT_APPLICABLE
ERROR=Booking has no immutable cancellation policy snapshot was caused by stale synthetic setup.
PRODUCT_DEFECT=NO
TEST_DEFECT=YES
COVERAGE_GAP=NO
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=YES local disposable test database only.
CORRECTED_VERDICT=PASS_DB_INTEGRATION
DEFECT_ID=P2-004

ITEM=P2-005 Phase 8I reporting payment-review fixture
PREVIOUS_VERDICT=FAIL_DEFECT
ACTUAL_EVENT=The report expected one REVIEW_REQUIRED payment while development seed data created SUCCEEDED, PENDING, and CANCELLED payments only.
EXECUTED=Seed repair adding a valid review-required timestamp/state; focused reporting integration test; full API catalog suite.
EVIDENCE_LAYER=DB_INTEGRATION_API_INTEGRATION
HTTP_STATUS=NOT_APPLICABLE
ERROR=paymentReviewCount was 0 instead of the fixture contract's expected 1.
PRODUCT_DEFECT=NO
TEST_DEFECT=YES
COVERAGE_GAP=NO
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=YES local disposable test database only.
CORRECTED_VERDICT=PASS_DB_INTEGRATION
DEFECT_ID=P2-005

ITEM=ROOM-TYPE-TEST-001 archive expectation
PREVIOUS_VERDICT=FAIL_DEFECT
ACTUAL_EVENT=The browser test expected an ACTIVE status after requesting archive, while the server correctly rejected the archive because an active rate plan still depended on the room type.
EXECUTED=Targeted room-type browser test after changing the assertion to the documented safety rejection.
EVIDENCE_LAYER=API_BROWSER
HTTP_STATUS=Archive request returned a safe client error and the page rendered the dependency alert.
ERROR=Stale test assertion contradicted the catalog archive safety contract.
PRODUCT_DEFECT=NO
TEST_DEFECT=YES
COVERAGE_GAP=NO
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=YES local synthetic browser stack only.
CORRECTED_VERDICT=PASS_BROWSER
DEFECT_ID=ROOM-TYPE-TEST-001

ITEM=P2-006 reversed date range URL hydration
PREVIOUS_VERDICT=NOT_PREVIOUSLY_RECORDED
ACTUAL_EVENT=Read-only production reproduction with a reversed URL query issued one booking-list request and rendered a generic load error instead of the controlled Vietnamese validation state. Direct form submission did not reproduce the defect.
EXECUTED=Production SUPER_ADMIN read-only URL, reload, and browser-history reproduction; source fix; focused and full local browser coverage.
EVIDENCE_LAYER=PRODUCTION_READ_ONLY_SOURCE_UNIT_BROWSER
HTTP_STATUS=Production page 200; invalid URL state caused one admin-bookings API request and an error state.
ERROR=URL hydration marked the page ready before the reversed-range guard prevented refresh.
PRODUCT_DEFECT=YES
TEST_DEFECT=NO
COVERAGE_GAP=YES URL, reload, and history coverage was missing.
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=NO source correction requires a release deployment before production PASS can be claimed.
CORRECTED_VERDICT=PASS_BROWSER
DEFECT_ID=P2-006

ITEM=ROOM_STATUS_VIEWER route/API boundary
PREVIOUS_VERDICT=PARTIAL_EVIDENCE
ACTUAL_EVENT=Prior production viewer evidence already showed server guards denying restricted page/API access and mutation while permitted room-operation reads remained available.
EXECUTED=Read-only viewer route, API, payload-minimization, mutation-denial, and logout checks; local navigation regression.
EVIDENCE_LAYER=PRODUCTION_READ_ONLY_BROWSER_SOURCE_UNIT
HTTP_STATUS=Permitted reads 200; restricted routes/APIs/mutations 403; logout-protected access 401.
ERROR=None in the server authorization boundary; the defect was navigation scope.
PRODUCT_DEFECT=NO
TEST_DEFECT=NO
COVERAGE_GAP=NO
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=YES read-only identity and authorization checks only.
CORRECTED_VERDICT=PASS_BROWSER
DEFECT_ID=P2-001

ITEM=FORMAT-CHECK untracked evidence documents
PREVIOUS_VERDICT=FAIL_DEFECT
ACTUAL_EVENT=Repository-wide Prettier check reports twelve existing untracked audit/integration documents; source files changed in this run pass focused formatting checks.
EXECUTED=pnpm format:check; focused Prettier check for changed source and test files.
EVIDENCE_LAYER=WORKTREE_FORMAT
HTTP_STATUS=NOT_APPLICABLE
ERROR=Untracked evidence documents are not formatted by the current repository formatter configuration.
PRODUCT_DEFECT=NO
TEST_DEFECT=NO
COVERAGE_GAP=YES owner decision or formatting policy is still needed for those documents.
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=YES
CORRECTED_VERDICT=PARTIAL_EVIDENCE
DEFECT_ID=WORKTREE-FORMAT-001

ITEM=EXTERNAL_PROVIDER_ACCEPTANCE
PREVIOUS_VERDICT=BLOCKED_EXTERNAL
ACTUAL_EVENT=Google live OAuth, live SMTP, MoMo sandbox, VNPAY sandbox, and public HTTPS callback acceptance require provider credentials, external callback delivery, or an authorized recipient.
EXECUTED=Local provider readiness checks only; no live provider or callback was invoked.
EVIDENCE_LAYER=LOCAL_PROVIDER_CHECK
HTTP_STATUS=NOT_APPLICABLE
ERROR=Required external authorization and provider-side evidence unavailable in this run.
PRODUCT_DEFECT=NO
TEST_DEFECT=NO
COVERAGE_GAP=YES external acceptance remains unproven.
EXTERNAL_BLOCKER=YES
SAFE_PRODUCTION_EXECUTION=NO without explicit provider authorization.
CORRECTED_VERDICT=BLOCKED_EXTERNAL
DEFECT_ID=EXTERNAL-001

ITEM=PRODUCTION_MUTATION_ACCEPTANCE
PREVIOUS_VERDICT=NOT_SAFE_FOR_PRODUCTION_EXECUTION
ACTUAL_EVENT=Production CRUD, booking/HOLD, payment, coupon, inventory, maintenance, and direct database operations were not executed.
EXECUTED=Read-only production health, catalog, availability, auth-boundary, viewer, and reversed-URL checks only.
EVIDENCE_LAYER=PRODUCTION_READ_ONLY
HTTP_STATUS=Read-only endpoints returned their observed 200/401/403 statuses; no mutation status exists.
ERROR=Mutation acceptance is intentionally outside the safe evidence boundary.
PRODUCT_DEFECT=NOT_PROVEN
TEST_DEFECT=NO
COVERAGE_GAP=YES
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=NO
CORRECTED_VERDICT=NOT_SAFE_FOR_PRODUCTION_EXECUTION
DEFECT_ID=SAFETY-001

ITEM=OPERATIONS_V3_AND_PUBLIC_OVERHAUL
PREVIOUS_VERDICT=NOT_IMPLEMENTED
ACTUAL_EVENT=Operations V3 redesign, public-overhaul work, unrelated UI redesign, production inventory reimport, production DDL, and production payment/booking mutation acceptance were not started.
EXECUTED=Scope review only.
EVIDENCE_LAYER=SCOPE
HTTP_STATUS=NOT_APPLICABLE
ERROR=No implementation was requested within the current closure scope.
PRODUCT_DEFECT=NOT_PROVEN
TEST_DEFECT=NO
COVERAGE_GAP=YES future design/approval scope.
EXTERNAL_BLOCKER=NO
SAFE_PRODUCTION_EXECUTION=NO
CORRECTED_VERDICT=NOT_IMPLEMENTED
DEFECT_ID=SCOPE-001

## Current reconciliation summary

REAL_DEFECT_IDS=P2-001,P2-006,P2-007
TEST_DEFECT_IDS=P2-002,P2-003,P2-004,P2-005,ROOM-TYPE-TEST-001
COVERAGE_GAPS=URL hydration/history coverage is now added; external provider acceptance and the untracked-document formatter policy remain open.
EXTERNAL_BLOCKERS=EXTERNAL-001
UNSAFE_PRODUCTION_FLOWS=SAFETY-001
NO_FALSE_PASS=TRUE
