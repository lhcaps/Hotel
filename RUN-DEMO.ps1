<#
.SYNOPSIS
    Start the local demo stack (Web + API + worker + simulator).

.DESCRIPTION
    Customer-facing wrapper around `node scripts/demo/start-local.mjs`.
    This wrapper does one thing only: forwards the request to the
    canonical runner and surfaces its exit code. It is intentionally
    thin so the same logic powers both the wrapper and CI use.

    The runner is Windows-only. On other operating systems this
    wrapper exits with a clear message.

.EXAMPLE
    PS> .\RUN-DEMO.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

if ($IsLinux -or $IsMacOS) {
    Write-Error 'RUN-DEMO.ps1 is Windows-only. On macOS / Linux, run `node scripts/demo/start-local.mjs` directly with a POSIX-compatible runner (this package does not provide one).'
    exit 2
}

Write-Host '--- RUN-DEMO.ps1 ---' -ForegroundColor Cyan
Write-Host 'Starting Web, API, worker, and simulator via scripts/demo/start-local.mjs...'

& node scripts/demo/start-local.mjs
exit $LASTEXITCODE