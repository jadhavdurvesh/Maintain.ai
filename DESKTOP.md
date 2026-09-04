# Building an Installable Desktop App

This turns the web app into a real installer (.exe on Windows, .dmg on Mac,
.AppImage/.deb on Linux) that a user can double-click and run — no Python,
no Node, no terminal required on their end.

I built and actually ran this pipeline end to end while putting it together
(including launching the packaged app itself, not just the pieces) — it
works. Two notes on what that testing did and didn't cover are at the
bottom.

## How it fits together

```
backend/  →  PyInstaller  →  a single native executable (~60MB, no Python needed)
frontend/ →  vite build   →  static HTML/CSS/JS
                                      │
                                      ▼
                    desktop/ (Electron) bundles both:
                    - spawns the backend executable as a child process
                    - loads the frontend from disk (file://)
                    - points the backend's database at the OS's per-user
                      app-data folder, so data survives updates/reinstalls
                                      │
                                      ▼
                    electron-builder → .exe / .dmg / .AppImage installer
```

The frontend still just calls the backend over `http://127.0.0.1:8000` —
same code path as the web version. Electron doesn't change how the app
works, only how it's launched and packaged.

## Build steps

Run these **on the OS you're targeting** — see the cross-compilation note
below for why.

**1. Build the frontend, pointed at the port the desktop app will use:**

```bash
cd frontend
npm install
VITE_API_URL=http://127.0.0.1:8000 npm run build
```

(On Windows PowerShell: `$env:VITE_API_URL="http://127.0.0.1:8000"; npm run build`)

**2. Freeze the backend into a standalone executable:**

```bash
cd backend
pip install -r requirements.txt --break-system-packages
pip install pyinstaller --break-system-packages
pyinstaller maintain-ai-backend.spec
```

This produces `backend/dist/maintain-ai-backend` (or `.exe` on Windows).
The `.spec` file (not a plain `--onefile` CLI call) is what makes sure
`knowledge_base.json` actually gets bundled — without it, the AI Assistant
would throw a file-not-found error at runtime that's easy to miss until
someone actually uses that feature.

**3. Package with Electron:**

```bash
cd desktop
npm install
npm run dist
```

Installers land in `desktop/dist/`. `electron-builder` copies the backend
executable and the frontend build into the app's resources automatically
(see the `extraResources` section of `desktop/package.json`) — you don't
need to move anything by hand.

## The cross-compilation caveat

PyInstaller and Electron's native installers can't reliably be built for a
different OS than the one you're running the build on. In practice:

- Build the Windows `.exe` **on Windows**
- Build the Mac `.dmg` **on a Mac**
- Build the Linux `.AppImage`/`.deb` **on Linux**

If you only have one machine, the common workaround is a CI pipeline (e.g.
GitHub Actions with a build matrix of `windows-latest` / `macos-latest` /
`ubuntu-latest` runners) that runs the same three steps above on each OS
and uploads the resulting installers as build artifacts. Worth setting up
once you're ready to hand this to someone on a different OS than yours —
not needed just to run it yourself.

## Where the Gemini API key lives (and why not just bake it in)

Short answer: it lives in the app's own local database, entered once
through **Settings → AI Assistant** in the running app. Never in source
code, never in the installer itself.

Why not just embed your key in the build so nobody has to enter one?

- **An installer isn't a secret container.** An Electron app is a folder of
  files (we even disabled `asar` packing for cleaner debugging, but even
  with it enabled, `.asar` archives are trivially unpacked with a
  one-line tool). Anyone who installs the app can extract any string baked
  into it, including an API key.
- **It would be *your* key, spending *your* quota**, for anyone who ever
  runs the installer — including if it ends up shared beyond who you
  intended.
- **The app doesn't need a key to work.** The offline diagnostic engine
  covers the AI Assistant with zero configuration. Gemini is opt-in
  enhancement, not a requirement — so shipping without a key is the
  correct default, not a missing feature.

If you're the only person who'll ever run this build, entering your own
key once via Settings (as we already built) is the right amount of
security — it's stored locally on your machine, same as any other app's
config. The only thing to actively avoid is pasting a real key into a file
that gets committed to git or built into a distributable installer.

## What I verified vs. what to check on your own machine

**Actually built and ran, in this environment:**
- The `pyinstaller` build, including confirming the frozen binary serves
  the AI assistant, PDF export, and Excel export correctly
- The full `electron-builder` package step (resource bundling)
- **Launched the actual packaged Linux app** under a virtual display,
  confirmed the backend auto-spawns, confirmed the database lands in the
  right per-user folder, and clicked through the UI to confirm routing
  works — this is what caught two real bugs (Vite's absolute asset paths
  and BrowserRouter both break under Electron's `file://` loading) that
  are now fixed (`base: './'` in `vite.config.js`, switched to
  `HashRouter`)

**Not tested here — worth a quick check on your end:**
- Windows and Mac builds specifically (I only have a Linux sandbox) — the
  pipeline is the same, but always worth confirming on the actual target OS
- The final installer files themselves (`.exe`/`.dmg`/`.AppImage`) — I
  tested the unpacked app (`--dir` build), which exercises the same
  resource-bundling and runtime logic, but not the installer/uninstaller
  wizard itself
