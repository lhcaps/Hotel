# Three-minute walkthrough — DEMO / SYNTHETIC

**Status: walkthrough pending a successful local rehearsal.** Complete [the readiness checklist](DEMO_CHECKLIST.md) first. If any step fails, stop and report the observed result; do not substitute a recording from another revision as current evidence.

1. **Problem (30 seconds):** Explain that availability and pricing can change between search and booking. Show only synthetic room types and dates.
2. **Flow (90 seconds):** Search availability, request a quote, and request HOLD using a synthetic contact. Point out that the quote is not a reservation and that HOLD rechecks inventory. Show no real guest or customer data.
3. **Engineering boundary (60 seconds):** Use [the diagram](ARCHITECTURE.md) to explain quote locking, transactional inventory allocation, and audit/outbox. State that payment and current production use are not demonstrated.

Finish with the exact source SHA and the actual rehearsal outcome. No payment provider call or real transaction is required.
