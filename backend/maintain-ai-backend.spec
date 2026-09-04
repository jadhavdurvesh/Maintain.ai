# PyInstaller build spec for the standalone backend binary.
# Run from backend/:   pyinstaller maintain-ai-backend.spec
#
# Produces dist/maintain-ai-backend (or .exe on Windows) — a single file with
# no Python installation required to run it.

a = Analysis(
    ['run_server.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('app/ai/knowledge_base.json', 'app/ai'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='maintain-ai-backend',
    debug=False,
    strip=False,
    upx=True,
    console=True,
    onefile=True,
)
