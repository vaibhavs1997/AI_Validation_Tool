@echo off
REM AI Validation Tool - Quick Start Script
REM Run this file to start the server when it's not responding

echo ======================================
echo AI Validation Tool - Server Starter
echo ======================================

REM Kill any existing node processes on port 4173
echo Checking for existing processes on port 4173...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :4173') do (
    echo Killing process %%i
    taskkill /F /PID %%i 2>nul
)

REM Start the server
echo Starting server...
cd /d "2026-07-04\i"
npm run dev

echo.
echo Server started! Open http://localhost:4173 in your browser.