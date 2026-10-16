<#
  Checks a built buyer ZIP. Exit code 0 = every check passed, 1 = at least one failed.

      powershell -ExecutionPolicy Bypass -File tools\verify-zip.ps1 -ZipPath dist\wedding-template-v1.0.zip

  It extracts the ZIP into a temporary folder and checks:
    - every required file is present and non-empty
    - nothing development-only or personal is inside (tests, node_modules, .git, logs, author tools, local paths)
    - entry names use forward slashes (portable to macOS / Linux)
    - every local file that index.html, css/styles.css and js/config.js refer to actually exists
    - no demo photograph (by file hash) unless -AllowDemoPhotos was given
    - the documentation does not promise backend features
  It does not open a browser. For a real load test, run:  node dev-tests/zip-smoke.js
#>
param(
    [Parameter(Mandatory)][string]$ZipPath,
    [switch]$AllowDemoPhotos
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$script:fail = 0
function Check($name, $ok, $detail = '') {
    if ($ok) { Write-Host ("  PASS  " + $name) -ForegroundColor Green }
    else { Write-Host ("  FAIL  " + $name + $(if ($detail) { "  -> $detail" })) -ForegroundColor Red; $script:fail++ }
}

if (-not [IO.Path]::IsPathRooted($ZipPath)) { $ZipPath = Join-Path (Get-Location) $ZipPath }
Write-Host "`nVerifying $ZipPath"
Add-Type -AssemblyName System.IO.Compression.FileSystem

# ---- entry names ------------------------------------------------------------------------------------------------
$z = [IO.Compression.ZipFile]::OpenRead($ZipPath)
$names = @($z.Entries | Where-Object { $_.Length -gt 0 -or -not $_.FullName.EndsWith('/') } | ForEach-Object { $_.FullName })
$z.Dispose()
Check 'Entry names use forward slashes (work on Windows, macOS and Linux)' (-not ($names | Where-Object { $_ -match '\\' })) (($names | Where-Object { $_ -match '\\' } | Select-Object -First 3) -join ', ')
Check 'Everything sits inside one top-level folder "wedding-template/"' (-not ($names | Where-Object { -not $_.StartsWith('wedding-template/') }))

$tmp = Join-Path $env:TEMP ('wt-verify-' + [guid]::NewGuid().ToString('N'))
[IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $tmp)
$tmp = (Get-Item $tmp).FullName            # long-form path (TEMP may be an 8.3 short path)
$pkg = Join-Path $tmp 'wedding-template'
if (-not (Test-Path $pkg)) { Write-Host '  FAIL  The ZIP has no wedding-template/ folder at its top level' -ForegroundColor Red; Remove-Item $tmp -Recurse -Force; exit 1 }

try {
    # ---- required files ---------------------------------------------------------------------------------------
    $required = @(
        'index.html', 'START-HERE.html', 'README.md', 'LICENSE.txt', 'ASSETS.md', 'TESTING.md',
        'start-local-server.bat', 'start-local-server.command',
        'css/styles.css', 'js/config.js', 'js/main.js', 'js/boot.js',
        'tools/serve.ps1', 'tools/optimise-images.py',
        'assets/fonts/OFL.txt', 'assets/icons/favicon.svg', 'assets/images/og-image.jpg'
    )
    $missing = $required | Where-Object { -not (Test-Path (Join-Path $pkg $_)) -or (Get-Item (Join-Path $pkg $_)).Length -eq 0 }
    Check "All $($required.Count) required files are present and not empty" (-not $missing) ($missing -join ', ')

    # ---- nothing that should not be there ----------------------------------------------------------------------
    $all = Get-ChildItem $pkg -Recurse -Force
    $banned = $all | Where-Object {
        $_.FullName.Substring($pkg.Length) -match '(?i)[\\/](dev-tests|node_modules|\.git|\.vscode|\.cursor|\.idea|dist|__pycache__)([\\/]|$)' -or
        $_.Name -match '(?i)^(package(-lock)?\.json|make-zip\.ps1|verify-zip\.ps1|make-placeholders\.py|SELLER-GUIDE\.md|serve-gzip\.py|.*\.log|.*\.zip|thumbs\.db|\.ds_store)$' -or
        $_.FullName -match '(?i)placeholder-images'
    }
    Check 'No development, test, author or editor files are included' (-not $banned) (($banned | ForEach-Object { $_.Name }) -join ', ')

    $texts = Get-ChildItem $pkg -Recurse -File -Include *.html, *.css, *.js, *.md, *.txt, *.ps1, *.py, *.bat, *.command, *.svg
    $leaks = $texts | Select-String -Pattern 'C:\\Users', 'Pamela', 'AppData', 'puppeteer', 'dev-tests', 'wt-test' -SimpleMatch -List | Where-Object { $_.Path -notmatch 'verify-zip' }
    Check 'No local paths, personal names or references to development tests inside any text file' (-not $leaks) (($leaks | ForEach-Object { Split-Path $_.Path -Leaf }) -join ', ')

    # ---- every referenced local file exists ---------------------------------------------------------------------
    $refs = @{}
    foreach ($f in 'index.html', 'css/styles.css', 'js/config.js', 'js/main.js') {
        $content = [IO.File]::ReadAllText((Join-Path $pkg $f))
        [regex]::Matches($content, '(?<![A-Za-z0-9_/.-])(?:\.\./)?((?:assets|css|js)/[A-Za-z0-9_./-]+\.(?:webp|jpg|jpeg|png|svg|woff2|css|js))') | ForEach-Object { $refs[$_.Groups[1].Value] = $f }
    }
    $dead = $refs.Keys | Where-Object { -not (Test-Path (Join-Path $pkg $_)) }
    Check "All $($refs.Count) local files referenced by index.html, styles.css and config.js exist" (-not $dead) (($dead | ForEach-Object { "$_ (from $($refs[$_]))" }) -join '; ')

    $assetFiles = Get-ChildItem (Join-Path $pkg 'assets') -Recurse -File | Where-Object { $_.Name -ne 'OFL.txt' } | ForEach-Object { $_.FullName.Substring($pkg.Length + 1).Replace('\', '/') }
    # og-image.jpg is referenced by an absolute https:// URL in index.html (the buyer's future domain), so the
    # relative-path scan above cannot see it.
    $unused = $assetFiles | Where-Object { -not $refs.ContainsKey($_) -and $_ -ne 'assets/images/og-image.jpg' }
    Check 'No unused files in assets/' (-not $unused) ($unused -join ', ')

    # ---- demo photographs ---------------------------------------------------------------------------------------
    $srcImgs = Join-Path $Root 'assets\images'
    $demoHashes = @{}
    if (Test-Path $srcImgs) { Get-ChildItem $srcImgs -File | ForEach-Object { $demoHashes[(Get-FileHash $_.FullName -Algorithm SHA256).Hash] = $_.Name } }
    $leakedDemo = Get-ChildItem (Join-Path $pkg 'assets\images') -File | Where-Object { $demoHashes.ContainsKey((Get-FileHash $_.FullName -Algorithm SHA256).Hash) } | ForEach-Object { $_.Name }
    if ($AllowDemoPhotos) { Write-Host "  NOTE  Demo photographs are included on purpose (-AllowDemoPhotos): $(@($leakedDemo).Count) files." -ForegroundColor Yellow }
    else { Check 'The AI-generated demo photographs are NOT in the ZIP (placeholders only)' (-not $leakedDemo) ($leakedDemo -join ', ') }

    $cfgText = [IO.File]::ReadAllText((Join-Path $pkg 'js/config.js'))
    if (-not $AllowDemoPhotos) {
        Check 'Picture descriptions in config.js were replaced (they described the demo photos)' (-not ($cfgText -match 'walking hand in hand|bouquet of white garden roses|golden meadow')) ''
    }

    # ---- fonts: licence travels with the files ------------------------------------------------------------------
    $ofl = [IO.File]::ReadAllText((Join-Path $pkg 'assets/fonts/OFL.txt'))
    Check 'Font licence file contains the licence text and both copyright lines' ($ofl -match 'SIL OPEN FONT LICENSE' -and $ofl -match 'Cormorant Project Authors' -and $ofl -match 'DM Sans Project Authors')

    # ---- honest documentation -------------------------------------------------------------------------------------
    $docs = ($required | Where-Object { $_ -match '\.(md|html)$' } | ForEach-Object { [IO.File]::ReadAllText((Join-Path $pkg $_)) }) -join "`n"
    Check 'Documentation states that RSVPs are not stored without a backend/service' ($docs -match '(?i)does not store|cannot (save|store)|not stored|nothing is stored|stores nothing')
    Check 'Documentation does not claim the template is "production-ready" for data collection' (-not ($docs -match '(?i)production-ready for data|guaranteed|100% secure|fully secure'))
    Check 'Demo mode is the shipped RSVP setting' ($cfgText -match 'mode:\s*"demo"')
    Check 'config.js contains no API keys or secrets (token/secret/password/apikey)' (-not ($cfgText -match '(?i)(api[_-]?key|secret|password|bearer|token)\s*[:=]\s*"[^"]+"'))
}
finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host ''
if ($script:fail -eq 0) { Write-Host 'ZIP verification: all checks passed.' -ForegroundColor Green; exit 0 }
else { Write-Host "ZIP verification: $script:fail check(s) FAILED." -ForegroundColor Red; exit 1 }
