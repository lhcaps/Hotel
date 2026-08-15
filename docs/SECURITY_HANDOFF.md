# Security handoff

## Security posture for transfer

This document inventories responsibility classes, not credentials. Do not place tokens, passwords, connection strings, private keys, cookies, OTPs, recovery codes, or provider secrets in this document, Git, terminal logs, archive manifests, or screenshots.

## Ownership inventory

| Capability class           | System of record                           | Transfer owner             | Success criterion                                                                            |
| -------------------------- | ------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------- |
| Source and CI              | Git hosting organization and CI settings   | Repository owner           | Successor can view protected branch rules, workflows, and release evidence.                  |
| Application administration | Production application RBAC                | Application security owner | Successor has least-privilege admin role and can complete an approved non-destructive check. |
| Infrastructure operations  | Approved SSH/bastion and cloud account     | Infrastructure owner       | Successor can access the governed operator path without sharing an existing account.         |
| Data and backups           | Managed database/backup control plane      | Data owner                 | Successor can view backup and restore-rehearsal evidence without direct production DDL.      |
| Payments and providers     | Provider consoles and registered callbacks | Finance/provider owner     | Successor can inspect settings and roles; no real payment is needed for access proof.        |
| Domain, DNS, TLS           | Registrar/DNS/certificate control plane    | Domain owner               | Successor can inspect delegated domain and callback configuration.                           |

## Required controls

- Keep production configuration in the protected external configuration store. The repository environment contract identifies variable names and secret classification only.
- Use individual, auditable identities with least privilege; never transfer a shared password or a browser profile.
- Confirm rotation and emergency-contact ownership before changing an owner or revoking access.
- Retain incident and audit data according to the operating policy. Redact identifiers in cross-team evidence when not needed for the decision.
- For a suspected secret exposure, stop dissemination, notify the security owner, rotate through the official system of record, and document only the incident reference and completion state.

## Access revocation gate

Outgoing access may be revoked only after the successor has independently proven required access and the responsible owner has accepted the evidence. A pending or failed proof means no revocation, no account deletion, and no statement that handoff is complete.

## Code and release guardrails

The only release mechanics are the tracked scripts in `scripts/release/` and associated deployment documentation. Untracked deployment/debug helpers, direct SQL, manually edited runtime environment files, and manual restart commands are outside the security boundary and must not be used.
