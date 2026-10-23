@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" "http://127.0.0.1:8765"
"C:\Program Files\nodejs\node.exe" "local\server.cjs"
pause
