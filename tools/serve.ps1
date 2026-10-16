<#
  A tiny local web server for Windows that needs NOTHING installed (it uses PowerShell, which ships with Windows).
  It only serves the template folder to your own computer (http://localhost). It is not for putting the site online.

  Normally you start it by double-clicking  start-local-server.bat  in the main folder.
  Manual use:   powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8000] [-NoBrowser]
  Stop it with Ctrl+C or by closing the window.
#>
param(
    [int]$Port = 8000,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$Mime = @{
    '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'
    '.webp' = 'image/webp'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.png' = 'image/png'; '.gif' = 'image/gif'
    '.ico' = 'image/x-icon'; '.avif' = 'image/avif'
    '.woff2' = 'font/woff2'; '.woff' = 'font/woff'; '.ttf' = 'font/ttf'
    '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'; '.xml' = 'application/xml'
}

# Find a free port, starting with the one requested.
$listener = $null
foreach ($p in $Port..($Port + 10)) {
    $candidate = New-Object System.Net.HttpListener
    $candidate.Prefixes.Add("http://localhost:$p/")
    try { $candidate.Start(); $listener = $candidate; $Port = $p; break }
    catch { $candidate.Close() }
}
if (-not $listener) { Write-Host "Could not open a local port between $Port and $($Port + 10). Close other programs using them and try again." -ForegroundColor Red; exit 1 }

$url = "http://localhost:$Port/"
Write-Host ''
Write-Host "  Your wedding website is running on your computer at:  $url" -ForegroundColor Green
Write-Host '  Edit js/config.js, save, then refresh the browser to see changes.'
Write-Host '  Press Ctrl+C (or close this window) to stop.'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request; $res = $ctx.Response
        try {
            $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
            if ($rel -eq '' ) { $rel = 'index.html' }
            $full = [IO.Path]::GetFullPath((Join-Path $Root $rel))
            if (Test-Path -LiteralPath $full -PathType Container) { $full = Join-Path $full 'index.html' }

            # Never serve anything outside the template folder.
            if (-not $full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
                $res.StatusCode = 403
            }
            elseif ($req.HttpMethod -notin @('GET', 'HEAD')) {
                $res.StatusCode = 405
            }
            elseif (Test-Path -LiteralPath $full -PathType Leaf) {
                $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
                $res.ContentType = if ($Mime.ContainsKey($ext)) { $Mime[$ext] } else { 'application/octet-stream' }
                $res.AddHeader('Cache-Control', 'no-cache')
                $bytes = [IO.File]::ReadAllBytes($full)
                $res.ContentLength64 = $bytes.Length
                if ($req.HttpMethod -eq 'GET') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
            }
            else {
                $res.StatusCode = 404
                $msg = [Text.Encoding]::UTF8.GetBytes("404 - file not found: $rel")
                $res.ContentType = 'text/plain; charset=utf-8'
                $res.ContentLength64 = $msg.Length
                $res.OutputStream.Write($msg, 0, $msg.Length)
                Write-Host "  404  $rel" -ForegroundColor Yellow
            }
        }
        catch { try { $res.StatusCode = 500 } catch {} }
        finally { try { $res.OutputStream.Close() } catch {} }
    }
}
finally { $listener.Stop(); $listener.Close() }
