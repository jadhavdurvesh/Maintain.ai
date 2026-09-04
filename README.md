# MAINTAIN AI
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/jadhavdurvesh/Maintain.ai)

MAINTAIN AI is an AI-powered predictive maintenance and intelligent maintenance management system. It can run as a web app or as an installable desktop app using the same codebase wrapped in Electron. The system currently supports manual data entry, with capabilities for future integration of real sensors. A key feature is the AI diagnostic assistant, which functions completely offline, using Gemini as an optional enhancement rather than a dependency.

## Quick Start (Web Version)

To get the web version of MAINTAIN AI up and running, follow these steps:

**Terminal 1 — Backend**
```bash
cd backend
pip install -r requirements.txt --break-system-packages
python3 -m app.seed_data
python3 -m uvicorn app.main:app --reload
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install
npm run dev
```

Once both servers are running, open **http://localhost:5173** in your browser. The seed script pre-loads the database with four demo machines (a motor, pump, conveyor, and compressor) to provide an initial populated dashboard. For a complete guide, including troubleshooting, please see `SETUP.md`.

## Installable Desktop App

The `desktop/` directory contains the configuration to package the frontend and backend into a standalone installer (`.exe`, `.dmg`, or `.AppImage`). This allows end-users to run the application without needing Python or Node.js installed on their machines. The build pipeline and details about API key management are documented in `DESKTOP.md`.

## Features

*   **Complete Visual Redesign**: A modern user interface featuring physically-modeled glass effects on the sidebar, top bar, and panels, powered by `@sohumsuthar/liquid-glass`. It includes an animated particle background and both light and dark themes.
*   **Dashboard**: A central hub displaying live health statuses, active alerts, maintenance tiles, and visualizations like a health-distribution donut chart and per-machine health bars.
*   **Asset Management**: Comprehensive management of machines, including profiles, components, manual sensor readings, and a full history of faults and maintenance.
*   **Smart Maintenance Scheduler**: Automatically schedules maintenance based on operating hours.
*   **Work Order Board**: A Kanban-style board to track work orders from pending to completed status. Completed orders are automatically logged in the machine's maintenance history.
*   **Smart Alert System**: Generates alerts for low health scores, overdue maintenance, and repeated unresolved faults.
*   **AI Maintenance Assistant**: An offline-first diagnostic tool that asks clarifying questions to identify potential causes of failure. It provides confidence ratings for each cause and a step-by-step inspection procedure. An optional integration with Gemini is available, configured within the app.
*   **Spare Parts Inventory**: Tracks spare parts and flags low-stock items.
*   **Reporting**: Generates reliability and failure-cause analysis reports with charts, available for export as CSV, PDF, or Excel files.
*   **User Management**: Basic records for user roles (admin, technician, viewer).
*   **Desktop Packaging**: The application is fully packaged for desktop installation using Electron and PyInstaller.

## Technical Trade-off

The physically-accurate glass effect, which includes ray-traced refraction and a live particle background, comes with a performance cost. Testing showed a sustained CPU usage of around 25-30% in the renderer process. The application includes an `FPSGuard` component that automatically degrades the effect on less powerful hardware, and users can toggle the particle animation off to improve performance.

## Future Work

*   **IoT/Sensor Integration**: The backend is ready to accept sensor data, but the hardware (e.g., ESP32/Arduino) integration is a future step.
*   **Authentication**: While user roles are defined, access control and enforcement are not yet implemented.
*   **ML-Based Health Scoring**: The current health scoring is rule-based. A machine learning model will be integrated once sufficient sensor data is collected.
*   **Platform-Specific Installers**: The build pipeline is set up, but generating `.exe` and `.dmg` installers requires running the build on Windows and macOS, respectively.

## Repository Layout

```
maintain-ai/
  ├── backend/      # FastAPI + SQLAlchemy backend (see backend/README.md)
  ├── frontend/     # React + Vite frontend (see frontend/README.md)
  └── desktop/      # Electron wrapper for the desktop app (see DESKTOP.md)
