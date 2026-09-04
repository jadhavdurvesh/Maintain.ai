"""
Entry point used to freeze the backend into a standalone executable with
PyInstaller, so an installed copy of MAINTAIN AI doesn't require the end
user to have Python on their machine at all.

Not used in normal development — for that, keep using:
    python3 -m uvicorn app.main:app --reload

Build the standalone binary with (run from backend/):
    pyinstaller --onefile --name maintain-ai-backend run_server.py

The resulting binary reads the same environment variables as the dev server
(DATABASE_URL, GEMINI_API_KEY, PORT) — the desktop wrapper sets DATABASE_URL
to a path inside the OS's per-user app-data folder so data survives updates.
"""
import os
import uvicorn

from app.main import app

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
