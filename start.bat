@echo off

start "XTTS Server" cmd /k "python server.py"
timeout /t 5 /nobreak > nul
start "Assistant" cmd /k "node assistant.js"