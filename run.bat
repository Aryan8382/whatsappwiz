@echo off
title Whatsapp Wiz Launcher
cls
echo ==========================================
echo       WHATSAPP WIZ LAUNCHER (Windows)
echo ==========================================
echo.
echo Please select an option:
echo [1] Setup everything (Start Docker, install modules, migrate and seed DB)
echo [2] Start entire application (Docker + Backend + Frontend concurrently)
echo [3] Start Docker MySQL database container only
echo [4] Start Backend development server only
echo [5] Start Frontend development server only
echo [6] Stop Docker MySQL container
echo [7] Exit
echo.
set /p opt="Enter choice (1-7): "

if "%opt%"=="1" goto setup
if "%opt%"=="2" goto start_all
if "%opt%"=="3" goto docker_up
if "%opt%"=="4" goto backend
if "%opt%"=="5" goto frontend
if "%opt%"=="6" goto docker_down
if "%opt%"=="7" goto exit
goto invalid

:setup
echo.
echo [+] Starting Docker MySQL container...
call npm run docker:up
echo.
echo [+] Installing Backend dependencies and migrating/seeding database...
call npm run setup:backend
echo.
echo [+] Installing Frontend dependencies...
call npm run setup:frontend
echo.
echo [✓] Setup completed successfully!
pause
goto exit

:start_all
echo.
echo [+] Ensuring Docker MySQL container is running...
call npm run docker:up
echo.
echo [+] Launching Backend dev server in a new window...
start cmd /k "title Whatsapp Wiz Backend && npm run dev:backend"
echo.
echo [+] Launching Frontend dev server in a new window...
start cmd /k "title Whatsapp Wiz Frontend && npm run dev:frontend"
echo.
echo [✓] Both servers launched in new windows.
echo.
pause
goto exit

:docker_up
echo.
echo [+] Starting Docker MySQL container...
call npm run docker:up
pause
goto exit

:backend
echo.
echo [+] Starting Backend dev server...
call npm run dev:backend
pause
goto exit

:frontend
echo.
echo [+] Starting Frontend dev server...
call npm run dev:frontend
pause
goto exit

:docker_down
echo.
echo [+] Stopping Docker MySQL container...
call npm run docker:down
pause
goto exit

:invalid
echo Invalid choice.
pause
goto exit

:exit
