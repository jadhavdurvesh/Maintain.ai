# Desktop app — dev mode

For quick testing without doing a full PyInstaller + electron-builder pass,
Electron can just point at your regular dev servers:

```bash
# Terminal 1
cd ../backend && python3 -m uvicorn app.main:app --reload

# Terminal 2
cd ../frontend && npm run dev

# Terminal 3
cd . && npm install && npm run dev
```

This opens an Electron window loading `http://localhost:5173`, same as
opening it in a browser, just in a native window with devtools attached.
It does **not** spawn the backend binary or test the production resource
bundling — for that, see `../DESKTOP.md` for the full build.
