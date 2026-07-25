$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logs = Join-Path $root ".devlogs"
New-Item -ItemType Directory -Path $logs -Force | Out-Null

function Test-Port($port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Start-Server($dir, $log) {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev > `"$log`" 2>&1" -WorkingDirectory $dir -WindowStyle Hidden | Out-Null
}

$report = @()

if (Test-Port 3000) {
  $report += "[ok] public site already running on http://localhost:3000"
} else {
  Start-Server $root (Join-Path $logs "next.log")
  $report += "[..] starting public site (Next.js) -> http://localhost:3000"
}

if (Test-Port 5173) {
  $report += "[ok] admin panel already running on http://localhost:5173/admin"
} else {
  Start-Server (Join-Path $root "admin-panel") (Join-Path $logs "vite.log")
  $report += "[..] starting admin panel (Vite) -> http://localhost:5173/admin"
}

$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline) {
  if ((Test-Port 3000) -and (Test-Port 5173)) { break }
  Start-Sleep -Seconds 1
}

if (Test-Port 3000) { $report += "[ok] public site up on http://localhost:3000" } else { $report += "[!!] public site did not come up; see .devlogs\next.log" }
if (Test-Port 5173) { $report += "[ok] admin panel up on http://localhost:5173/admin" } else { $report += "[!!] admin panel did not come up; see .devlogs\vite.log" }

$portFile = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\DevToolsActivePort"
$bridge = "disconnected"

function Sync-PortFile {
  $v = Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/version" -TimeoutSec 5
  $ws = $v.webSocketDebuggerUrl -replace "ws://127.0.0.1:9222",""
  $parent = Split-Path -Parent $portFile
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Set-Content -Path $portFile -Value "9222`n$ws" -NoNewline -Encoding ASCII
}

if (Test-Port 9222) {
  try {
    Sync-PortFile
    $bridge = "connected (port 9222)"
  } catch {
    $bridge = "port 9222 open but handshake failed"
  }
} else {
  $chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
  if (Test-Path $chrome) {
    $debugDir = Join-Path $env:LOCALAPPDATA "ChromeDebug"
    Start-Process -FilePath $chrome -ArgumentList "--remote-debugging-port=9222","--user-data-dir=$debugDir","--no-first-run","--disable-session-crashed-bubble","http://localhost:3000","http://localhost:5173/admin" | Out-Null
    Start-Sleep -Seconds 6
    try {
      Sync-PortFile
      $bridge = "connected (launched debug Chrome on 9222)"
    } catch {
      $bridge = "could not start debug bridge; double-click chrome-debug.bat"
    }
  } else {
    $bridge = "Chrome not found at default path"
  }
}

$report += "[i ] browser bridge: $bridge"
$report += ""
$report += "Public site : http://localhost:3000"
$report += "Admin panel : http://localhost:5173/admin"
$report -join "`n"
