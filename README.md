# MAINTAIN AI

*(temporary name — rename anytime, it's just a folder name and a page title)*

AI-powered predictive maintenance & intelligent maintenance management
system. Runs as a web app or as an installable desktop app (same code,
Electron-wrapped), manual data entry for now with the door left open for
real sensors, and an AI diagnostic assistant that works completely offline
with Gemini as an optional enhancement rather than a dependency.

## Quick start (web version)

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt --break-system-packages
python3 -m app.seed_data
python3 -m uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. The seed script loads 4 demo machines
(a motor, pump, conveyor, and compressor) so the dashboard isn't empty.
Full walkthrough (including troubleshooting) is in `SETUP.md`.

## Installable desktop app

`desktop/` wraps the same frontend + backend into a real installer
(.exe/.dmg/.AppImage) — no Python or Node required on the end user's
machine. Full build pipeline, the cross-compilation caveat, and where the
Gemini API key actually lives (spoiler: never in the installer) are in
`DESKTOP.md`.

## What's built (V1, functional and tested end to end)

- Full visual redesign: real physically-modeled glass (via `@sohumsuthar/liquid-glass`,
  ray-traced refraction, not a fake blur) on the sidebar, topbar, and every
  page panel/stat-tile; an animated particle-network background; light and
  dark themes with a toggle (persisted locally), both tuned for the glass
  material specifically. Individual data rows/cards (table rows, work order
  cards) intentionally stay plain — glass is reserved for fixed-count
  structural panels, not lists that grow with data, per the library's own
  performance guidance.
- Dashboard with live health/alert/maintenance tiles and visual charts
  (health-distribution donut, per-machine health bars)
- Machine/asset management: profiles, components, manual sensor readings,
  fault + maintenance history
- Operating-hours-based smart maintenance scheduler
- Work order board (pending → in progress → completed), auto-logs to
  maintenance history on completion
- Smart Alert System (low health score, overdue/due-soon maintenance,
  repeated unresolved faults)
- AI Maintenance Assistant: asks clarifying questions before committing to
  a cause, rates each cause confirmed/likely/possible/insufficient-info,
  gives a step-by-step inspection procedure with a safety notice up front.
  Offline by default; optional Gemini path — key entered once via
  Settings in the app itself, stored in the local database. Every session
  is logged so predicted-vs-actual can be compared later.
- Spare parts inventory with low-stock flagging
- Reports: reliability, failure-cause breakdown, with charts and
  CSV/PDF/Excel export
- User/role records (admin / technician / viewer)
- **Installable desktop packaging** (Electron + PyInstaller) — built and
  test-launched end to end, see `DESKTOP.md`

## A real trade-off worth knowing about

Physically-accurate glass (ray-traced refraction + a live particle
background + cursor-tracked specular highlights) has a real, measured cost —
I saw roughly 25-30% sustained CPU in the renderer process during testing,
which is expected for this much continuous compositor work, not a bug. An
`FPSGuard` component is wired in to automatically degrade the effect if a
machine can't keep up, and there's a "particles" toggle in the sidebar to
turn off the background animation. If this runs on modest shop-floor
hardware rather than a modern laptop, worth keeping an eye on.

## What's next (not built yet — the spec's "optional/future" list)

- **IoT/sensor hardware** (ESP32/Arduino) — the reading endpoint already
  accepts a `source: sensor` field, so this is additive, not a rewrite
- **Auth** — roles are stored but nothing enforces them yet
- **Real ML-based health scoring** — current scoring is rule-based; once
  there's real sensor history, this is where a trained model would slot in
- **Windows/Mac installers specifically** — the pipeline is built and
  tested on Linux; producing the actual `.exe`/`.dmg` needs a build run on
  those OSes (see the cross-compilation note in `DESKTOP.md`)

## Repo layout

```
maintain-ai/
  backend/     FastAPI + SQLAlchemy — see backend/README.md
  frontend/    React + Vite — see frontend/README.md
  desktop/     Electron wrapper — see DESKTOP.md
```
