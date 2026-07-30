# Phase 8H Client Operations Parity Design

**Status:** Approved by the non-interactive Phase 8H request; Phase 8G visual direction remains authoritative.

## Goal

Close the repository-owned operational gaps exposed by the redacted client workbook without changing pricing authority, payment settlement, public booking visual direction, or adding speculative CRM/accounting architecture.

## Design

`rooms` gains one explicit housekeeping state: `CLEAN`, `DIRTY`, or `CLEANING`. Only ADMIN can read or mutate it. Each mutation uses the existing audit event boundary. A day-scoped ADMIN board joins the current property rooms to current/future booking occupancy server-side and offers state control with visible text, not colour-only meaning.

Reporting is a server aggregate over the current property bookings and payments. Its primary measure is gross booked final revenue: sum of `bookings.finalAmountVnd` for non-cancelled, non-expired bookings whose check-in belongs to the selected inclusive date range in the property timezone. Settled revenue is the same measure restricted to `payments.status = SUCCEEDED`; no outstanding amount is reported because partial payment is unsupported. The page has one daily time series, two categorical tables/visual summaries, a detailed table fallback, loading/empty/error/stale states, and last-updated text.

Existing ADMIN booking detail and rate-plan configuration remain their domain owners. The rate-plan page is reshaped only to show an understandable tier matrix from existing API values. Existing guest/account booking detail becomes the authorized confirmation surface through a safe projection and print stylesheet; it excludes all operational/internal fields.

## Security and scope boundaries

- No client PII from the workbook is written, logged, seeded, or captured.
- CUSTOMER responses do not contain housekeeping, physical room, source, employee, internal UUID, or raw payment data.
- The browser never calculates conflicts, pricing, duration totals, or report aggregates.
- Source, employee attribution, partial payment, manual surcharge, formula engine, multi-property architecture, WebSocket updates, refunds, and accounting are deferred.
- No generic dashboard/table framework, shadcn initialisation, or dependency is added unless an existing focused test proves the current stack cannot render the requirement.
