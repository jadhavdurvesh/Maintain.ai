# MAINTAIN AI — Frontend

React + Vite. Talks to the FastAPI backend over REST.

## Run it

```bash
cd frontend
npm install
cp .env.example .env     # only needed if the backend isn't on localhost:8000
npm run dev
```

Opens at http://localhost:5173 — make sure the backend is running first
(see `../backend/README.md`), or every page will show a "couldn't reach
the backend" panel instead of data.

## Pages

- **Dashboard** — the control center: health tiles, active alerts, upcoming
  maintenance, most-frequently-failing machines.
- **Machines** — asset list + add form; click through to a machine's profile
  (components, manual/sensor readings, maintenance history).
- **Maintenance** — the operating-hours-based smart scheduler, plus manual
  scheduling and completion.
- **Work Orders** — a simple pending / in-progress / completed board.
- **AI Assistant** — the diagnostic flow: describe a problem, answer its
  follow-up questions, get confidence-rated causes and a recommended
  procedure. Toggle "Use Gemini" to try the online path.
- **Alerts** — acknowledge / resolve.
- **Spare Parts** — inventory with a low-stock flag.
- **Reports** — reliability and failure-cause breakdowns, CSV export.
- **Settings** — user/role records (no login flow yet).

## Design

Dark, high-contrast, instrument-panel look rather than a generic SaaS
dashboard — mono type for all data/numbers, hairline borders instead of
shadows, sharp corners. Tokens live in `src/index.css` if you want to
reskin it (e.g. for desktop packaging later).

## Desktop later

You said web first, desktop eventually — this is a plain Vite/React app
with no browser-only APIs, so wrapping it in Tauri (lighter) or Electron
(more tooling/examples) later is a matter of pointing either at this
build, not a rewrite.
