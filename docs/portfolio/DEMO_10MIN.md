# Ten-minute walkthrough — DEMO / SYNTHETIC

**Status: walkthrough pending a successful local rehearsal.** Follow [the readiness checklist](DEMO_CHECKLIST.md) and record actual outcomes before presenting this as a working demo.

1. **Context (1 minute):** Explain the availability, price, and inventory problem using an anonymous scenario.
2. **Public journey (3 minutes):** Search a synthetic date range, request a quote, then create a HOLD with a synthetic contact. Note the displayed expiry and do not reveal actual booking data.
3. **Consistency (3 minutes):** Walk through `create-booking-hold.ts` and `booking-repository.ts`: quote row lock, contact-equivalent replay, inventory selection, exclusion constraint, transaction, audit and outbox. Explain what happens if the quote expired or the room became unavailable. These are source observations unless reproduced in the rehearsal.
4. **Boundaries (2 minutes):** Show [the architecture](ARCHITECTURE.md). Explain that payment adapters and callbacks need independent verification and that no production usage is asserted.
5. **Evidence and cleanup (1 minute):** Report commit, commands, results and limitations; use the runner's own documented teardown and verify only its disposable resources were removed.

Do not use real guest, customer, provider, or institution identifiers. If the seeded quote flow fails, show the failure honestly and avoid presenting the journey as passed.
