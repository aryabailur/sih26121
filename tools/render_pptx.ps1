param([string]$Deck, [string]$OutDir, [string]$Pdf = "")
# Export each slide to PNG using the installed PowerPoint (true rendering for visual QA).
# -Pdf <abs path> also saves the deck as PDF (the format the SIH portal accepts).
New-Item -ItemType Directory -Force $OutDir | Out-Null
Get-ChildItem $OutDir -Filter *.png -ErrorAction SilentlyContinue | Remove-Item -Force
$app = New-Object -ComObject PowerPoint.Application
try {
  $pres = $app.Presentations.Open($Deck, $true, $false, $false)  # ReadOnly, Untitled=false, WithWindow=false
  $i = 1
  foreach ($slide in $pres.Slides) {
    $slide.Export((Join-Path $OutDir ("slide-{0:D2}.png" -f $i)), "PNG", 1600, 900)
    $i++
  }
  if ($Pdf -ne "") {
    $pres.SaveCopyAs($Pdf, 32)  # ppSaveAsPDF
    "pdf -> $Pdf"
  }
  $pres.Close()
  "exported $($i - 1) slides"
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}
