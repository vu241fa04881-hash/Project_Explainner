@echo off
cd /d "%~dp0"
echo ========================================================
echo        Starting Project Explainer Application
echo ========================================================
echo.
echo Starting FastAPI Backend on http://127.0.0.1:8000...
start "Project Explainer Backend" cmd /k "cd /d ""%~dp0"" && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting Vite React Frontend on http://localhost:5173...
start "Project Explainer Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo Both services launched! 
echo Open http://localhost:5173 in your browser.
echo ========================================================
