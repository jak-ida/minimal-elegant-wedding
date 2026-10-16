<#
  Builds the BUYER download:  dist/wedding-template-v<version>.zip

  Usage (PowerShell, from the project folder):
      powershell -ExecutionPolicy Bypass -File tools\make-zip.ps1                    # safe default
      powershell -ExecutionPolicy Bypass -File tools\make-zip.ps1 -Version 1.1
      powershell -ExecutionPolicy Bypass -File tools\make-zip.ps1 -IncludeDemoPhotos # see warning below

  SAFE BY DEFAULT: the ZIP contains neutral placeholder pictures (tools/placeholder-images) in place of the
  AI-generated demo photographs, and the picture descriptions (alt text) are replaced to match. The demo photos
  are only shipped if you pass -IncludeDemoPhotos, which you should do only after confirming that the terms of
  the tool that created them allow redistribution inside a paid product (see ASSETS.md and SELLER-GUIDE.md).

  The ZIP is built from an ALLOW-LIST, so development files (dev-tests, node_modules, .git, dist, editor files,
  author tools, logs) cannot leak in by accident. After building, tools\verify-zip.ps1 runs automatically.
#>
param(
    [string]$Version = '1.0',
    [switch]$IncludeDemoPhotos,
    [switch]$SkipVerify
)

$ErrorActionPreference = 'Stop'
$Root    = Split-Path -Parent $PSScriptRoot
$Dist    = Join-Path $Root 'dist'
$Name    = "wedding-template-v$Version"
$Stage   = Join-Path $env:TEMP "$Name-stage"
$Package = Join-Path $Stage 'wedding-template'
$ZipPath = Join-Path $Dist "$Name.zip"

# ---- 1. The allow-list: the ONLY things that can ship --------------------------------------------------------
$ShipFiles = @(
    'index.html', 'START-HERE.html', 'README.md', 'LICENSE.txt', 'ASSETS.md', 'TESTING.md',
    'start-local-server.bat', 'start-local-server.command'
)
$ShipDirs  = @('css', 'js', 'assets')                                     # copied recursively
$ShipTools = @('tools\serve.ps1', 'tools\optimise-images.py')             # individual files from tools\

foreach ($f in $ShipFiles + $ShipTools) { if (-not (Test-Path (Join-Path $Root $f))) { throw "Required file is missing from the project: $f" } }

if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Path $Package -Force | Out-Null
New-Item -ItemType Directory -Path $Dist -Force | Out-Null

foreach ($f in $ShipFiles) { Copy-Item (Join-Path $Root $f) -Destination $Package }
foreach ($d in $ShipDirs)  { Copy-Item (Join-Path $Root $d) -Destination $Package -Recurse }
New-Item -ItemType Directory -Path (Join-Path $Package 'tools') | Out-Null
foreach ($f in $ShipTools) { Copy-Item (Join-Path $Root $f) -Destination (Join-Path $Package 'tools') }

# Remove junk that may sit inside the shipped folders.
Get-ChildItem $Package -Recurse -Force -File | Where-Object { $_.Name -in @('Thumbs.db', '.DS_Store', 'desktop.ini') -or $_.Extension -in @('.log', '.map', '.psd', '.tmp') } | Remove-Item -Force

# ---- 2. Demo photographs -> neutral placeholders (unless explicitly overridden) ----------------------------------
$utf8 = New-Object System.Text.UTF8Encoding($false)
if ($IncludeDemoPhotos) {
    Write-Host 'WARNING: -IncludeDemoPhotos: the AI-generated demo photographs ARE in this ZIP. Confirm the image tool''s terms allow redistribution in a paid download.' -ForegroundColor Yellow
} else {
    $imgDir = Join-Path $Package 'assets\images'
    $phDir  = Join-Path $Root 'tools\placeholder-images'
    if (-not (Test-Path $phDir)) { throw "Placeholder images are missing. Run:  python tools/make-placeholders.py" }
    $swapped = 0
    foreach ($img in Get-ChildItem $imgDir -File) {
        $ph = Join-Path $phDir $img.Name
        if (-not (Test-Path $ph)) { throw "No placeholder for $($img.Name). Re-run:  python tools/make-placeholders.py" }
        Copy-Item $ph -Destination $img.FullName -Force
        $swapped++
    }
    Write-Host "Placeholders: replaced $swapped demo photographs."

    # The picture descriptions in the demo describe the demo photos, so they must not ship with placeholders.
    $altText = 'Placeholder image. Replace this with your own photograph and describe what it shows.'
    $cfgPath = Join-Path $Package 'js\config.js'
    $cfg = [IO.File]::ReadAllText($cfgPath)
    $cfg = [regex]::Replace($cfg, '(?m)(\balt:\s*)"(?:[^"\\]|\\.)*"', ('$1"' + $altText + '"'))
    [IO.File]::WriteAllText($cfgPath, $cfg, $utf8)

    $idxPath = Join-Path $Package 'index.html'
    $idx = [IO.File]::ReadAllText($idxPath)
    $idx = [regex]::Replace($idx, '(<img class="hero__image"[^>]*?\salt=")[^"]*(")', ('$1' + $altText + '$2'))
    $idx = [regex]::Replace($idx, '(<meta property="og:image:alt" content=")[^"]*(")', '$1Describe your social sharing image here$2')
    [IO.File]::WriteAllText($idxPath, $idx, $utf8)
}

# ---- 3. Line endings: the Windows launcher needs CRLF, the macOS/Linux launcher needs LF ---------------------------
$bat = Join-Path $Package 'start-local-server.bat'
[IO.File]::WriteAllText($bat, (([IO.File]::ReadAllText($bat)) -replace "`r?`n", "`r`n"), $utf8)
$cmd = Join-Path $Package 'start-local-server.command'
[IO.File]::WriteAllText($cmd, (([IO.File]::ReadAllText($cmd)) -replace "`r?`n", "`n"), $utf8)

# ---- 4. Placeholders the AUTHOR still has to fill in (warnings, not errors) ------------------------------------------
$todo = @()
if ((Get-Content (Join-Path $Package 'LICENSE.txt') -Raw) -match '\[Your Name|\[your-email|\[Year\]') { $todo += 'LICENSE.txt still contains [square-bracket] placeholders (your name, e-mail, year).' }
if ((Get-Content (Join-Path $Package 'js\config.js') -Raw) -match 'Your Studio Name') { $todo += 'js/config.js footer.attributionText still says "Your Studio Name".' }

# ---- 5. Build the ZIP with forward-slash entry names (Compress-Archive in Windows PowerShell writes backslashes,
#         which break on macOS and Linux) ---------------------------------------------------------------------------
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
$zip = [IO.Compression.ZipFile]::Open($ZipPath, [IO.Compression.ZipArchiveMode]::Create)
try {
    # Use the real (long-form) path: $env:TEMP can be an 8.3 short path such as C:\Users\NAME~1, which would
    # not match the full names returned below and would corrupt the entry names.
    $base = (Get-Item $Package).Parent.FullName.TrimEnd('\') + '\'
    Get-ChildItem $Package -Recurse -File -Force | Sort-Object FullName | ForEach-Object {
        $entryName = $_.FullName.Substring($base.Length).Replace('\', '/')
        $entry = $zip.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
        $entry.LastWriteTime = [DateTimeOffset](Get-Date)
        try { $entry.ExternalAttributes = if ($_.Extension -eq '.command') { (0x81ED -shl 16) } else { (0x81A4 -shl 16) } } catch { }
        $in = [IO.File]::OpenRead($_.FullName); $out = $entry.Open()
        try { $in.CopyTo($out) } finally { $out.Dispose(); $in.Dispose() }
    }
} finally { $zip.Dispose() }

Remove-Item $Stage -Recurse -Force
$size = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host "Created $ZipPath ($size MB)  [$(if ($IncludeDemoPhotos) { 'WITH demo photographs' } else { 'placeholder images' })]" -ForegroundColor Green
foreach ($t in $todo) { Write-Host "TO DO BEFORE SELLING: $t" -ForegroundColor Yellow }

# ---- 6. Verify what was just built ---------------------------------------------------------------------------------
if (-not $SkipVerify) {
    $verify = Join-Path $PSScriptRoot 'verify-zip.ps1'
    $args = @{ ZipPath = $ZipPath }
    if ($IncludeDemoPhotos) { $args.AllowDemoPhotos = $true }
    & $verify @args
    if ($LASTEXITCODE -ne 0) { throw 'ZIP verification failed.' }
}
