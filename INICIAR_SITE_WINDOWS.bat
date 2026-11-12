@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Virtum Agenda - Inicializador
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar_site_windows.ps1"
if errorlevel 1 (
 echo.
 echo Falha ao iniciar o Virtum Agenda. Veja a mensagem acima.
 pause
)
endlocal
