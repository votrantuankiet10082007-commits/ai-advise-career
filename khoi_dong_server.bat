@echo off
cd /d "%~dp0"
node --version || goto :end
if not exist .env copy .env.example .env >nul
call npm run dev
:end
pause
