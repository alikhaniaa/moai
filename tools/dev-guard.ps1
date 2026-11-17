# ──────────────────────────────────────────────────────────────
#  dev-guard - runs `next dev` with a hard ceiling on processes.
#
#  Why this exists:
#  Next.js 16 (Turbopack) generates a dev build worker at
#  .next/dev/build/<hash>.js. If that file is corrupt - which happens
#  when the dev server is force-killed mid-write - the worker throws on
#  startup and Next respawns it with NO retry limit. Within seconds that
#  is thousands of node processes and a frozen machine.
#
#  Two protections:
#   1. If the previous run did not exit cleanly, .next is cleared first
#      (a corrupt cache is exactly what triggers the loop).
#   2. If the node process count ever exceeds -MaxNode, the dev server is
#      killed immediately.
# ──────────────────────────────────────────────────────────────
param(
  [int]$MaxNode = 40,
  [int]$Port = 3000
)

$root    = Split-Path -Parent $PSScriptRoot
$nextDir = Join-Path $root ".next"
$marker  = Join-Path $nextDir ".dev-running"

if (Test-Path $marker) {
  Write-Host "[dev-guard] last session did not exit cleanly - clearing .next cache" -ForegroundColor Yellow
  Remove-Item -Recurse -Force $nextDir -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $nextDir | Out-Null
Set-Content -Path $marker -Value "running" -Encoding utf8

$npx = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
if (-not $npx) { $npx = "npx.cmd" }

Write-Host "[dev-guard] starting next dev on port $Port (process ceiling: $MaxNode)" -ForegroundColor Cyan
$proc = Start-Process -FilePath $npx -ArgumentList "next","dev","-p",$Port `
                      -NoNewWindow -PassThru -WorkingDirectory $root

$aborted = $false
try {
  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 2
    $count = @(Get-Process -Name node -ErrorAction SilentlyContinue).Count
    if ($count -gt $MaxNode) {
      $aborted = $true
      Write-Host ""
      Write-Host "[dev-guard] ABORT: $count node processes (ceiling $MaxNode)." -ForegroundColor Red
      Write-Host "[dev-guard] Turbopack worker respawn loop detected." -ForegroundColor Red
      taskkill /F /T /PID $proc.Id 2>&1 | Out-Null
      Start-Sleep -Seconds 3
      if (@(Get-Process -Name node -ErrorAction SilentlyContinue).Count -gt $MaxNode) {
        Write-Host "[dev-guard] children outlived the tree kill - sweeping node.exe" -ForegroundColor Red
        taskkill /F /IM node.exe 2>&1 | Out-Null
      }
      Write-Host "[dev-guard] .next will be cleared automatically on next start." -ForegroundColor Yellow
      break
    }
  }
}
finally {
  if (-not $aborted) { Remove-Item $marker -Force -ErrorAction SilentlyContinue }
}
