# Archived root reports and operator evidence

Archived on 2026-08-16 during final handoff cleanup. These files preserve point-in-time reports and read-only query evidence that were previously tracked at repository root. They are not current production proof and must not be used as release tooling.

| Archived path | Scope | Canonical current replacement |
| --- | --- | --- |
| `B0_PRODUCTION_STATUS.txt` | B0 production status, 2026-08-07 | `docs/HANDOFF.md`, `docs/KNOWN_ISSUES.md` |
| `B0_STAGE3B_EXECUTIVE_SUMMARY.txt` | B0 Stage 3B internal pricing gate | `docs/HANDOFF.md` |
| `B0_STAGE3B_INTERNAL_PRICING_REPORT.txt` | B0 historical pricing report | `docs/HANDOFF.md` |
| `B0_STAGE3B_SUMMARY.txt` | B0 Stage 3B completion summary | `docs/HANDOFF.md` |
| `WAVE1_SUMMARY.txt` | Wave 1 historical closure state | `docs/HANDOFF.md` |
| `PEACENEST_DEFINITION_OF_DONE.md` | 2026-08-15 code-ready checklist | `README.md`, `docs/DEVELOPER_GUIDE.md` |
| `PROJECT_FAILURE_LEDGER.md` | Append-only historical failure ledger | `docs/KNOWN_ISSUES.md` for active issues |
| `count-business.sql` | Historical read-only count query | Production runbook, authorized operator path |
| `count-policy.sql` | Historical read-only pricing count query | Production runbook, authorized operator path |
| `extract-policy.sql` | Historical read-only pricing extraction query | Production runbook, authorized operator path |
| `production-policy-extract.txt` | Historical read-only pricing extract | `docs/HANDOFF.md` |

Source context: these files were part of the final pre-handoff source tree; their original bodies are preserved under the archive path. No credentials, runtime environment files, database dumps, or unreviewed untracked material is archived here.
