@echo off
title Offline Spotify Server
echo --------------------------------------------------
echo        🚀 STARTING OFFLINE SPOTIFY 🚀
echo --------------------------------------------------
echo.
echo 💻 Opening host player in your browser...
start http://localhost:3000
echo.
echo 📱 Starting Node.js server...
echo.
node server.js
pause
