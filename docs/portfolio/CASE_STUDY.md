# Booking and room operations — case study

**Evidence: VERIFIED_IMPLEMENTED.** This is an anonymized account of a booking and room-operations codebase. It does not establish current production usage, customer adoption, or a verified local demo at this revision.

## Problem and scope

A booking flow must show availability, calculate a server-owned price, and avoid allocating the same room to overlapping stays. The repository contains a Next.js web application, a NestJS API, a worker, and PostgreSQL-backed booking and pricing components. The case study describes code in this repository; individual contribution and live operations require separate evidence.

## Decisions and tradeoffs

1. **Quote as a snapshot.** Search and quote do not reserve a room. The server calculates and persists a time-limited price snapshot rather than accepting a client total. This makes the price decision inspectable but requires inventory to be checked again at HOLD. See `apps/api/src/pricing/quote.service.ts`, `apps/api/src/pricing/quote.repository.ts`, and `docs/engineering/quote-architecture.md`.
2. **Transactional HOLD.** The HOLD service locks the quote, handles an existing booking for an equivalent contact, checks expiry, selects available inventory, and inserts the booking, inventory block, audit and outbox within a transaction. A different contact reusing the quote is rejected. The inventory block is backed by a PostgreSQL overlap exclusion constraint; allocation conflicts must fail safely. See `packages/booking/src/services/create-booking-hold.ts` and `packages/booking/src/repository/booking-repository.ts`.
3. **Verified payment event boundary.** The payment core accepts an adapter-verified event marker, tracks event identity and handles review paths before a successful confirmation. Payment provider behavior and callback delivery require their own runtime evidence; source code is not evidence of a live payment. See `packages/booking/src/payment/payment-service.ts` and `apps/api/src/payment/providers/`.

## Failure cases and limitations

Expired quotes require a new quote; conflicting allocations or busy inventory can fail rather than silently double-book. A previous quote consumed by another contact is rejected. Tests in `packages/booking/src/services/create-booking-hold.retry.test.ts` cover collision and allocation scenarios but were not executed in this audit because the clean checkout lacks dependencies and a reachable Docker daemon. No performance, reliability or production-use metrics are claimed.

The local demo is **BLOCKED / NOT VERIFIED**. See [demo checklist](DEMO_CHECKLIST.md) before attempting it. Never use customer records, real payment credentials, or real booking data for a portfolio demonstration.

## Evidence baseline

Source inspected at commit `32e3b3eb4f8ebbb9d59dc0d7c4b05f32c1d55763`; this document is a later documentation-only commit. Evidence class applies to the inspected implementation, not a hosted deployment. [Architecture](ARCHITECTURE.md) | [3-minute walkthrough](DEMO_3MIN.md) | [10-minute walkthrough](DEMO_10MIN.md)
