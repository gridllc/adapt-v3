@echo off
REM Adapt V3 Development Setup Script (Windows)
REM Handles port conflicts and starts both frontend and backend

echo 🚀 Starting Adapt V3 Development Environment

REM Function to check if port is available
:check_port
setlocal enabledelayedexpansion
set port=%1
netstat -ano | findstr :%port% >nul 2>&1
if %errorlevel% equ 0 (
    echo Port %port% is BUSY
    exit /b 1
) else (
    echo Port %port% is FREE
    exit /b 0
)
goto :eof

REM Function to find next available port
:find_next_port
setlocal enabledelayedexpansion
set base_port=%1
set port=%base_port%
:check_loop
call :check_port %port%
if %errorlevel% equ 1 (
    set /a port+=1
    goto check_loop
)
echo %port%
goto :eof

echo 🔍 Checking port availability...

REM Check current ports
call :check_port 8000
if %errorlevel% equ 0 (echo Backend (8000): ✅) else (echo Backend (8000): ❌)
call :check_port 5173
if %errorlevel% equ 0 (echo Frontend (5173): ✅) else (echo Frontend (5173): ❌)

REM Find available ports
for /f %%i in ('powershell -command "& { $port = 8000; while (Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -ErrorAction SilentlyContinue) { $port++ }; $port }"') do set BACKEND_PORT=%%i
for /f %%i in ('powershell -command "& { $port = 5173; while (Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -ErrorAction SilentlyContinue) { $port++ }; $port }"') do set FRONTEND_PORT=%%i

echo.
echo 📋 Port Configuration:
echo   Backend will use: %BACKEND_PORT%
echo   Frontend will use: %FRONTEND_PORT%

echo.
echo 🔧 Starting services...

REM Start backend in background
echo 📡 Starting backend on port %BACKEND_PORT%...
start "Backend" cmd /c "cd backend && set BACKEND_PORT=%BACKEND_PORT% && npm run dev"

timeout /t 3 /nobreak >nul

REM Start frontend in background
echo 🌐 Starting frontend on port %FRONTEND_PORT%...
start "Frontend" cmd /c "cd frontend && set FRONTEND_PORT=%FRONTEND_PORT% && set BACKEND_URL=http://localhost:%BACKEND_PORT% && npm run dev"

echo.
echo ✅ Services starting up...
echo   Backend: http://localhost:%BACKEND_PORT%
echo   Frontend: http://localhost:%FRONTEND_PORT%
echo.
echo 💡 Useful commands:
echo   Check ports: npm run check-ports (in respective directories)
echo   Kill processes: Use Task Manager or taskkill /f /im node.exe
echo.
echo Press any key to exit...
pause >nul
