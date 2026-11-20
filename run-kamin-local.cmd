@echo off
REM ==========================================================
REM  KAMIN - double-click to run the app on this computer.
REM  Your browser opens http://localhost:5173 by itself.
REM  Close this window (or press Ctrl+C) to stop KAMIN.
REM ==========================================================
setlocal
cd /d "%~dp0"
title KAMIN local

where node >nul 2>nul || (echo [!] Node.js is not installed. Install Node 22+ from nodejs.org & pause & exit /b 1)

if not exist "node_modules\" (
  echo [*] First run: installing dependencies ^(npm ci^)...
  call npm ci || (echo [!] npm ci failed & pause & exit /b 1)
)

echo [*] Preparing the course map, knowledge graph, fonts and OCR files...
call node scripts/prepare-assets.mjs || (echo [!] Preparing the files failed & pause & exit /b 1)

echo [*] Starting KAMIN at http://localhost:5173 ^(or the next free port^) - your browser opens by itself.
echo     Close this window to stop it.
call npx vite --open

echo.
echo [*] KAMIN stopped.
pause
