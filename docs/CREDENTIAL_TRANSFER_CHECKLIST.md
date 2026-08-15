# Credential-transfer checklist

## Rules

This is an owner checklist, not a credential store. Record ticket IDs, secret-manager references, responsible roles, dates, and PASS/FAIL only. Never record a secret value, recovery code, private key, token, session, OTP, database URL, or payment credential.

## Transfer record

| Capability                                     | Current owner | Successor owner | System-of-record reference | Human proof date | Result  |
| ---------------------------------------------- | ------------- | --------------- | -------------------------- | ---------------- | ------- |
| GitHub organization, protected `main`, CI      | Pending       | Pending         | Pending                    | Pending          | Pending |
| Production application administration          | Pending       | Pending         | Pending                    | Pending          | Pending |
| Governed SSH/bastion and release operator path | Pending       | Pending         | Pending                    | Pending          | Pending |
| Cloud/project and runtime observability        | Pending       | Pending         | Pending                    | Pending          | Pending |
| Database backup and restore evidence access    | Pending       | Pending         | Pending                    | Pending          | Pending |
| Payment and external-provider consoles         | Pending       | Pending         | Pending                    | Pending          | Pending |
| Domain, DNS, TLS, and callback registrations   | Pending       | Pending         | Pending                    | Pending          | Pending |

## Human verification procedure

1. The responsible owner grants the successor an individual least-privilege role through the authoritative console.
2. The successor independently signs in and performs one approved, non-destructive verification for that capability.
3. The owner records the system-of-record reference, date, verifier, and PASS/FAIL in the protected transfer record.
4. The successor and owner confirm rotation responsibility, emergency contact, and recovery process.
5. Repeat for every row. A failed or skipped row leaves the overall result pending.

## Final state

- Before all technical gates: `RELEASE_CLOSURE_IN_PROGRESS`.
- After technical gates but before every row is human-proven: `READY_PENDING_HUMAN_CREDENTIAL_TRANSFER`.
- `READY_FOR_SUCCESSOR` is forbidden until every row is proved and accepted by the responsible human owners.
- Do not revoke outgoing access until the final human acceptance is recorded. Revocation is a separate approved action, not an automatic consequence of this checklist.
