<#
.SYNOPSIS
    Run the deterministic local demo verifier.

.DESCRIPTION
    Customer-facing wrapper around `node scripts/demo/verify.mjs`.
    Verifies the 16 deterministic checks (infra readiness, customer
    pages, admin auth, security) against the canonical localhost
    origins.

.EXAMPLE
    PS> .\VERIFY-DEMO.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

Write-Host '--- VERIFY-DEMO.ps1 ---' -ForegroundColor Cyan
Write-Host 'Running scripts/demo/verify.mjs against the canonical localhost stack...'

& node scripts/demo/verify.mjs
exit $LASTEXITCODE