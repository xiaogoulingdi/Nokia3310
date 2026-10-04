@echo off
setlocal
title Nokia3310 - Local Preview
cd /d "%~dp0"
if errorlevel 1 goto failed
set "PYTHONUTF8=1"
set "PREVIEW_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
echo Building the phone preview and opening your browser...
echo Keep this window open. Press Ctrl+C or close it to stop.
echo.
if exist "%PREVIEW_PYTHON%" (
    "%PREVIEW_PYTHON%" web\build.py --serve 8000 --open-browser %*
    goto finished
)
where py.exe >nul 2>nul
if errorlevel 1 goto missing_python
py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if errorlevel 1 goto missing_python
py -3 web\build.py --serve 8000 --open-browser %*
goto finished

:missing_python
echo Python 3.10 or newer was not found. Install Python with the Windows py launcher, or restore the Codex runtime.
goto failed

:finished
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo Preview could not start. Keep the error above when asking for help.
pause
exit /b 1
