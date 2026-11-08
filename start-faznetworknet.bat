@echo off
setlocal
set "APP_DIR=D:\FAZNETWORKNET"
if not exist "%APP_DIR%\package.json" (
  echo FAZNETWORKNET project not found at %APP_DIR%
  exit /b 1
)
if not exist "%APP_DIR%\logs" mkdir "%APP_DIR%\logs"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $web=Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue; if(-not $web){ Start-Process -FilePath $env:ComSpec -ArgumentList '/d /c npm start' -WorkingDirectory 'D:\FAZNETWORKNET' -WindowStyle Minimized -RedirectStandardOutput 'D:\FAZNETWORKNET\logs\server.log' -RedirectStandardError 'D:\FAZNETWORKNET\logs\server-error.log'; Write-Output 'FAZNETWORKNET starting on port 3000' } else { Write-Output 'FAZNETWORKNET already running on port 3000' }"
if errorlevel 1 (
  echo FAZNETWORKNET launch failed. Check D:\FAZNETWORKNET\logs\ for details.
  exit /b 1
)
echo FAZNETWORKNET startup request completed. See D:\FAZNETWORKNET\logs\ for server output.
endlocal
