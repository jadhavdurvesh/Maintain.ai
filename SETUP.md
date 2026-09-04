# Setup Guide

Two things run side by side: the **backend** (FastAPI, serves data on port
8000) and the **frontend** (React, serves the UI on port 5173). The frontend
is useless without the backend running — always start the backend first.

## 0. Prerequisites

Check what you already have:

```bash
python3 --version   # need 3.10 or newer
node --version       # need 18 or newer
npm --version
```

- No Python? Install from https://www.python.org/downloads/ (check "Add to
  PATH" on Windows).
- No Node? Install from https://nodejs.org — get the LTS version, it includes
  npm automatically.

Unzip the project anywhere, e.g. `Documents/maintain-ai/`. You should see
`backend/` and `frontend/` folders inside it.

## 1. Start the backend

```bash
cd maintain-ai/backend
pip install -r requirements.txt --break-system-packages
```

If `pip` isn't found, try `pip3` instead. If you're on Windows and
`--break-system-packages` errors out, just drop that flag — it's only needed
on some Linux setups that block system-wide installs.

Load some demo data so the dashboard isn't empty:

```bash
python3 -m app.seed_data
```

You should see `Seed complete.` Now start the server:

```bash
python3 -m uvicorn app.main:app --reload
```

Leave this terminal window open — it needs to keep running. You should see
`Uvicorn running on http://127.0.0.1:8000`. Visit
http://localhost:8000/docs in a browser to confirm it's alive — you'll see
an interactive API explorer.

## 2. Start the frontend

Open a **second** terminal window (leave the backend one running):

```bash
cd maintain-ai/frontend
npm install
npm run dev
```

You should see something like `Local: http://localhost:5173/`. Open that
URL in your browser — that's the actual app.

If the dashboard shows "Couldn't reach the backend," it almost always means
step 1's terminal window got closed or crashed. Check it's still running.

## 3. (Optional) Turn on the Gemini AI path

The AI Assistant works fully offline out of the box — no key needed. If you
want to also try the Gemini-backed path:

1. Get a free API key at https://aistudio.google.com/apikey
2. In `backend/`, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` in any text editor and paste your key:
   ```
   GEMINI_API_KEY=your-key-here
   ```
4. Restart the backend (Ctrl+C in that terminal, then run the `uvicorn`
   command again).
5. In the app, go to AI Assistant and check "Use Gemini" before submitting a
   problem.

If the key is missing, wrong, or there's no internet, it automatically falls
back to the offline engine — nothing breaks.

## 4. Everyday use after the first setup

Once it's installed, you don't need to repeat `pip install` / `npm install`
every time — just:

```bash
# Terminal 1
cd maintain-ai/backend && python3 -m uvicorn app.main:app --reload

# Terminal 2
cd maintain-ai/frontend && npm run dev
```

## Troubleshooting

**"Address already in use" on port 8000 or 5173**
Something else is already using that port. Either close it, or run the
backend on a different port (`--port 8001`) — then update
`frontend/.env` (`VITE_API_URL=http://localhost:8001`) to match.

**`ModuleNotFoundError` when starting the backend**
The `pip install -r requirements.txt` step didn't finish or targeted a
different Python than the one running uvicorn. Try
`python3 -m pip install -r requirements.txt --break-system-packages`
to be sure it's the same interpreter both times.

**Frontend shows a blank page / console errors about "recharts" or similar**
Delete `frontend/node_modules` and run `npm install` again — an interrupted
install is the usual cause.

**Want to wipe demo data and start clean**
Stop the backend, delete `backend/maintain_ai.db`, then run
`python3 -m app.seed_data` again (or skip seeding entirely if you'd rather
start with zero machines).

**Exporting reports**
Once the backend is running, these URLs work directly in a browser or via
the Reports page's buttons:
- http://localhost:8000/api/reports/export/csv
- http://localhost:8000/api/reports/export/pdf
- http://localhost:8000/api/reports/export/excel
