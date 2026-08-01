<#
.SYNOPSIS
    Stop the local demo stack started by RUN-DEMO.ps1.

.DESCRIPTION
    Customer-facing wrapper around `node scripts/demo/stop.mjs`.
    Reads `.demo/start-manifest.json` and terminates ONLY the PIDs
    that the runner recorded. Refuses to scan ports or use
    `taskkill /F` against unknown listeners.

.EXAMPLE
    PS> .\STOP-DEMO.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

Write-Host '--- STOP-DEMO.ps1 ---' -ForegroundColor Cyan
Write-Host 'Stopping ONLY PIDs owned by scripts/demo/start-local.mjs (no port scanning, no image-name sweep)...'

& node scripts/demo/stop.mjs
exit $LASTEXITCODE