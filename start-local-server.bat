@echo off
rem ---------------------------------------------------------------------------
rem  Starts a local preview of your wedding website (Windows).
rem  Double-click this file. Nothing needs to be installed:
rem    1. If Python 3 is installed, it is used.
rem    2. Otherwise a small built-in PowerShell server is used.
rem  Close this window (or press Ctrl+C) to stop the server.
rem ---------------------------------------------------------------------------
cd /d "%~dp0"
title Wedding website - local preview

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -c "import sys" >nul 2>nul
  if not errorlevel 1 goto usepy
)
where python >nul 2>nul
if %errorlevel%==0 (
  python -c "import sys; sys.exit(0 if sys.version_info[0]>=3 else 1)" >nul 2>nul
  if not errorlevel 1 goto usepython
)
goto usepowershell

:usepy
echo.
echo   Your website is running at  http://localhost:8000/
echo   Edit js\config.js, save, then refresh the browser. Close this window to stop.
echo.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start "" http://localhost:8000/"
py -3 -m http.server 8000 --bind 127.0.0.1
goto end

:usepython
echo.
echo   Your website is running at  http://localhost:8000/
echo   Edit js\config.js, save, then refresh the browser. Close this window to stop.
echo.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start "" http://localhost:8000/"
python -m http.server 8000 --bind 127.0.0.1
goto end

:usepowershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1"

:end
echo.
echo   The server has stopped. If the window closed by itself, something went wrong; see START-HERE.html.
pause
