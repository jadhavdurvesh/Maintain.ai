# MAINTAIN AI — Backend

FastAPI + SQLAlchemy. SQLite by default, zero setup required.

## Run it

```bash
cd backend
pip install -r requirements.txt --break-system-packages   # drop the flag if you're in a venv
cp .env.example .env                                      # optional — only needed for Gemini
python3 -m app.seed_data                                  # creates the DB and loads 4 demo machines
python3 -m uvicorn app.main:app --reload
```

API docs (auto-generated): http://localhost:8000/docs

## Architecture

```
app/
  main.py            FastAPI app, wires up all routers
  database.py         SQLAlchemy engine/session (SQLite by default, Postgres-ready)
  models.py            All tables: Machine, Component, FaultRecord, SensorReading,
                       MaintenanceRecord, WorkOrder, Alert, SparePart,
                       KnowledgeBaseEntry, AIDiagnosticSession, User, AppSetting
  schemas.py            Pydantic request/response shapes
  alerts_engine.py     Smart Alert System — scans machine state, raises alerts
  settings_store.py     Generic local key-value store (the Gemini key lives here)
  seed_data.py          Demo data loader
  routers/
    machines.py         Asset management: CRUD, components, sensor readings
    maintenance.py       Scheduling, history, the operating-hours scheduler math
    work_orders.py        Work order lifecycle (pending -> in_progress -> completed)
    alerts.py              Acknowledge / resolve
    spare_parts.py          Inventory + low-stock flag
    ai_assistant.py          Routes to Gemini or the offline engine, logs every session
    reports.py               Dashboard summary, reliability, failure analysis, CSV/PDF/Excel export
    users.py                  Role records (admin / technician / viewer) — no auth yet
    settings.py                Get/set/clear the locally-stored Gemini key
  ai/
    offline_engine.py   Symptom-matching against knowledge_base.json — no API needed
    knowledge_base.json  Sample fault library (motor, pump, conveyor, compressor)
    gemini_client.py     Optional online path — returns None on any failure so the
                         router always has a safe fallback to the offline engine
  exports/
    pdf_report.py         Builds the printable PDF report (reportlab)
    excel_report.py       Builds the multi-sheet Excel workbook (openpyxl)

run_server.py         PyInstaller-freezable entry point (see ../DESKTOP.md)
maintain-ai-backend.spec  PyInstaller build spec — bundles knowledge_base.json correctly
```

## The offline-first AI assistant

`POST /api/ai/diagnose` is the core of the spec's "AI Maintenance Assistant":

1. First call with just `problem_description` → if there isn't enough signal yet,
   it comes back with `needs_more_info: true` and a list of `clarifying_questions`.
2. Send the same problem plus `answers` (the technician's replies) → once there's
   enough signal, it returns `possible_causes` (each labelled `confirmed` /
   `likely` / `possible` / `insufficient_information`, never overclaiming) and a
   step-by-step `recommended_procedure`.
3. Pass `use_online_ai: true` to try Gemini first — this only does anything if
   a key is set, either via `POST /api/settings/gemini-key` (what the app's
   Settings page uses — stored in the local DB, this is what an installed
   desktop build should use) or the `GEMINI_API_KEY` env var / `.env` (handy
   for development). The DB-stored key wins if both are set. Any failure (no
   key, no internet, bad response) silently falls back to the offline engine.
   The frontend never needs to know which one answered — `source` in the
   response tells you.

Every diagnosis is logged as an `AIDiagnosticSession`. Once a technician confirms
what they actually found (`POST /api/ai/sessions/{id}/outcome`), you have a
predicted-vs-actual dataset — useful later for tuning the knowledge base or
training a real model.

## What's stubbed / a known gap (call these out if this is going in a report)

- **No auth.** Roles exist as data but nothing enforces them yet.
- **Report exports** — CSV, PDF (print-ready summary), and Excel (multi-sheet
  workbook: machines, reliability, failures, work orders, spare parts, alerts)
  all work today via `/api/reports/export/{csv,pdf,excel}`.
- **IoT/sensor hardware** isn't connected — `POST /api/machines/{id}/readings`
  accepts both `source: manual` and `source: sensor`, so an ESP32 can post to
  the same endpoint later without any schema change.
- **Predictive health scoring** is currently simple (maintenance completion
  bumps it up, nothing decays it automatically) — a good next step once you
  have real sensor history to train against.
