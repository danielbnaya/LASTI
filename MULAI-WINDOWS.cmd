@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Instal Node.js 22 LTS lalu buka kembali. & pause & exit /b 1)
if not exist ".venv\Scripts\python.exe" (
    where py >nul 2>nul
    if errorlevel 1 (python -m venv .venv) else (py -3 -m venv .venv)
    if errorlevel 1 goto gagal
)
if not exist ".venv\prc-ready" (
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 goto gagal
    echo ready> ".venv\prc-ready"
)
if not exist "node_modules\hardhat\package.json" (
    call npm.cmd ci
    if errorlevel 1 goto gagal
)
".venv\Scripts\python.exe" start.py
if errorlevel 1 goto gagal
exit /b 0
:gagal
echo Periksa pesan di atas. Panduan ada di README.md.
pause
exit /b 1
