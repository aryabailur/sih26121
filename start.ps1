# NWIS one-command local start (Windows PowerShell).
#   .\start.ps1            # install if needed, reseed the demo knowledge base, start both servers
#   .\start.ps1 -NoSeed    # keep the current database (e.g. uploaded documents)
param([switch]$NoSeed)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "== NWIS backend ==" -ForegroundColor Cyan
Push-Location "$root\backend"
if (-not (Test-Path ".venv")) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
$tess = (Get-Command tesseract -ErrorAction SilentlyContinue) -or (Test-Path "C:\Program Files\Tesseract-OCR\tesseract.exe")
if (-not $tess) {
  Write-Host "Tesseract OCR not found - scanned reports will be flagged, not read." -ForegroundColor Yellow
  Write-Host "  Install once with:  winget install UB-Mannheim.TesseractOCR" -ForegroundColor Yellow
}
if (-not $NoSeed) { & .\.venv\Scripts\python.exe seed_data.py }
Start-Process -FilePath "$root\backend\.venv\Scripts\python.exe" `
  -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000" `
  -WorkingDirectory "$root\backend" -WindowStyle Minimized
Pop-Location

Write-Host "== NWIS frontend ==" -ForegroundColor Cyan
Push-Location "$root\frontend"
# Always sync dependencies (quick when up to date) so older checkouts pick up new packages.
npm install --no-audit --no-fund
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev -- --port 3000" -WorkingDirectory "$root\frontend" -WindowStyle Minimized
Pop-Location

Write-Host "Waiting for http://localhost:3000 ..." -ForegroundColor DarkGray
for ($i = 0; $i -lt 60; $i++) {
  try { Invoke-WebRequest -UseBasicParsing "http://localhost:3000/" -TimeoutSec 3 | Out-Null; break } catch { Start-Sleep -Seconds 2 }
}
Start-Process "http://localhost:3000/"
Write-Host "NWIS is running: UI http://localhost:3000  |  API docs http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "Stop: close the two minimized windows (uvicorn, npm)." -ForegroundColor DarkGray
