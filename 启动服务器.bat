@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Starting Gaokao volunteer app...
echo.

python -c "import flask, flask_cors" 2>nul
if errorlevel 1 (
    echo Flask dependencies are missing.
    echo Run this first:
    echo   pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo URL: http://localhost:5000
echo Press Ctrl+C to stop.
echo.
python server.py
