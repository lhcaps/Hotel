# Documentation archive policy

Active operating documents belong at their canonical paths under `docs/`. Historical reports remain useful evidence only when their date, source SHA, environment, and scope are explicit.

## Archive rules

- Store superseded or point-in-time reports in `docs/archive/YYYY-MM/`.
- Preserve the original content; do not rewrite an old result as current.
- Add a short header identifying the report date, source SHA or release ID when known, scope, and canonical replacement path.
- Keep checksums beside source archives when an archive is deliberately published. Embedded checksums are advisory; the separately recorded checksum is the verification value.
- Do not archive secrets, runtime environment files, credential exports, database dumps, browser profiles, or unreviewed untracked material.

The repository's existing historical documents predate this convention. They should be migrated only after an owner confirms their evidentiary status; their absence from this directory does not make them current.
