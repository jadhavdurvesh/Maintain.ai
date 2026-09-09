# MAINTAIN AI — Deep Technical Architecture & Internals

> A reverse-engineering guide for the MAINTAIN AI codebase. This document is intentionally deeper than a normal project README: it explains what each layer does, how the current code implements it, what the underlying runtime/framework is doing, and why the design choices matter.

## 0. The one-sentence mental model

MAINTAIN AI is a three-layer application: a React/Vite UI sends HTTP requests to a FastAPI Python service; FastAPI validates requests and runs business logic through SQLAlchemy against SQLite; an Electron shell can package the built React application together with a PyInstaller-built Python backend so the same system can run as a local desktop application.

The repository itself describes the same three major applications and the desktop artifact flow: `backend/`, `frontend/`, and `desktop/`. The desktop build consumes `frontend/dist` and `backend/dist`. 

---

# 1. System architecture

```text
                         MAINTAIN AI
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          Frontend          Backend          Desktop
        React + Vite       FastAPI          Electron
             │                │                │
             │ HTTP/JSON     │                │
             └───────────────►│                │
                              │                │
                        SQLAlchemy ORM         │
                              │                │
                              ▼                │
                           SQLite ◄────────────┘
                              │
                       maintain_ai.db

                    AI diagnostic subsystem
                         │            │
                    Offline KB      Gemini
                    JSON matching   optional API
                         │            │
                         └─────┬──────┘
                               ▼
                         Diagnostic result
```

There are two important boundaries:

1. **Process boundary:** browser/Electron renderer ↔ FastAPI backend.
2. **Persistence boundary:** application objects ↔ SQLAlchemy ↔ SQLite.

The React application does not directly manipulate SQLite. It asks the backend for data. This separation is one of the most important architectural ideas in the project.

---

# 2. What happens when the application starts?

## Web development mode

There are normally two processes:

```text
Terminal 1                         Terminal 2
FastAPI/Uvicorn                    Vite
    │                                │
    ▼                                ▼
127.0.0.1:8000                  localhost:5173
    ▲                                │
    └──────────── HTTP ──────────────┘
```

The frontend is JavaScript running in the browser. Vite serves the JavaScript modules and assets. FastAPI is a separate HTTP server.

When the browser loads the React application:

1. HTML loads the JavaScript bundle/module graph.
2. React mounts `App`.
3. React Router decides which page corresponds to the current URL.
4. A page component performs API calls.
5. The browser sends HTTP requests to port 8000.
6. Uvicorn receives the TCP/HTTP request.
7. FastAPI/Starlette dispatches it to the matching route.
8. Dependency injection creates a SQLAlchemy session where required.
9. Route code queries or modifies the database.
10. FastAPI serializes the Python result into JSON.
11. The browser receives JSON.
12. React state changes.
13. React re-renders the affected UI.

## Desktop mode

The packaged application changes the process topology but not the application logic:

```text
Electron main process
        │
        ├── starts packaged Python backend
        │       └── localhost:8000
        │
        └── opens renderer window
                └── React build from disk
```

This is powerful because the frontend and backend still communicate through the same HTTP API. Electron is essentially providing the operating-system window, process orchestration, and packaging layer.

---

# 3. Backend internals

## 3.1 `backend/app/main.py`

The backend entry point creates the FastAPI application, creates database tables, enables CORS, and registers routers.

Conceptually:

```python
Base.metadata.create_all(bind=engine)
app = FastAPI(...)
app.add_middleware(CORSMiddleware, ...)
app.include_router(machines.router)
...
```

### What `create_all()` actually means

SQLAlchemy's declarative models describe tables as Python classes. `Base.metadata` is the collection of table metadata registered by those classes. `create_all()` asks the configured database dialect to create tables that do not already exist.

It is not a migration system. It does not provide the same schema-versioning workflow as Alembic migrations. It is excellent for a zero-setup local/demo application, but production schema evolution would normally use migrations.

## 3.2 Routers

The backend is divided into domain routers rather than putting every endpoint in `main.py`.

Current router groups include machines, maintenance, work orders, alerts, spare parts, AI assistant, reports, users, and settings.

For example, the machine router declares:

```python
router = APIRouter(prefix="/api/machines", tags=["machines"])
```

An endpoint such as:

```python
@router.get("/{machine_id}")
def get_machine(...):
```

therefore becomes:

```text
GET /api/machines/123
```

This is route composition: the router supplies the common prefix and the decorator supplies the endpoint suffix.

---

# 4. FastAPI request processing — from bytes to Python objects

Suppose the frontend sends:

```http
POST /api/machines/7/readings
Content-Type: application/json

{
  "reading_type": "temperature",
  "value": 81.4,
  "unit": "°C"
}
```

The low-level path is roughly:

```text
Ethernet/Wi-Fi
   ↓
TCP connection
   ↓
HTTP request bytes
   ↓
Uvicorn
   ↓
ASGI application
   ↓
Starlette/FastAPI routing
   ↓
Pydantic request validation
   ↓
Python function arguments
   ↓
SQLAlchemy
   ↓
SQLite
```

FastAPI's major advantage is that Python type declarations become part of the API contract. A request schema can reject malformed input before business logic runs.

The response follows the reverse path:

```text
SQLite row
   ↓
SQLAlchemy ORM object
   ↓
FastAPI response validation/serialization
   ↓
JSON
   ↓
HTTP response
   ↓
fetch()
   ↓
JavaScript object
   ↓
React state
   ↓
DOM update
```

---

# 5. Database architecture

## 5.1 SQLAlchemy is not the database

A critical distinction:

- **SQLite** is the database engine.
- **SQLAlchemy** is the Python database toolkit/ORM.
- **The ORM models** describe application objects and their database mappings.
- **A Session** tracks database work and transactions.

`database.py` currently chooses SQLite by default:

```python
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./maintain_ai.db")
```

The engine is then created with `create_engine()`, and `SessionLocal` is bound to it.

This also makes a future database change easier: a PostgreSQL URL can be supplied without rewriting the model layer.

## 5.2 Why `check_same_thread=False` exists

SQLite normally has restrictions around which thread uses a connection. FastAPI applications can handle requests in different execution contexts, so the project explicitly configures SQLite with:

```python
{"check_same_thread": False}
```

That does not magically make one Session safe to share between threads. The important design is that `get_db()` creates a Session for a request and closes it afterward.

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

FastAPI's `Depends(get_db)` therefore gives route functions a managed database session.

---

# 6. ORM internals

Consider:

```python
class Machine(Base):
    __tablename__ = "machines"
    id = Column(Integer, primary_key=True, index=True)
```

The class is a Python representation of a database table.

Conceptually:

```text
Python class Machine
       │
       ├── id
       ├── machine_code
       ├── name
       ├── category
       ├── health_score
       └── ...
              │
              ▼
        SQL table machines
```

When you execute:

```python
machine = db.get(models.Machine, machine_id)
```

SQLAlchemy uses the primary key to construct a database lookup. The resulting row is materialized as a `Machine` ORM object.

When you do:

```python
machine.health_score = 55
```

SQLAlchemy marks that object as dirty in the Session. The SQL UPDATE does not necessarily happen at the assignment line. It occurs during a flush/commit lifecycle.

Then:

```python
db.commit()
```

flushes pending SQL statements and commits the transaction.

---

# 7. Transactions — the part you should really understand

A transaction is a unit of database work that should move from one consistent state to another.

For a new machine:

```python
machine = models.Machine(...)
db.add(machine)
db.commit()
db.refresh(machine)
```

Think of it as:

```text
Python object
   ↓ add()
Session identity/unit-of-work
   ↓ flush()
INSERT INTO machines (...)
   ↓ commit()
SQLite durable transaction
   ↓ refresh()
Python object gets database-generated values
```

The Session acts as a unit-of-work manager. It tracks objects, changes, pending inserts, updates, deletes, and transaction state.

If an operation fails before commit, the transaction can be rolled back instead of leaving half-completed work committed.

---

# 8. Database indexing — from the beginner idea to the real structure

This is one of the most important concepts for understanding MAINTAIN AI.

The model contains declarations such as:

```python
id = Column(Integer, primary_key=True, index=True)
machine_code = Column(String, unique=True, index=True, nullable=False)
```

An index is an additional database data structure that makes finding rows by a particular column faster.

## Without an index

Imagine 1,000,000 sensor readings and this query:

```sql
SELECT * FROM sensor_readings WHERE machine_id = 42;
```

Without a useful index, the database may need to inspect a very large number of rows.

Conceptually:

```text
row 1 → machine 12? no
row 2 → machine 91? no
row 3 → machine 42? YES
...
row 1,000,000 → ...
```

That is roughly linear work in the amount of data for a simple scan.

## With an index

A conventional SQLite index is implemented using a B-tree-like structure. You can imagine sorted keys arranged into nodes:

```text
                 [42]
                /    \
        [10,20,30]  [50,70,90]
```

The exact physical structure is more complicated, but the important idea is that the database can navigate through ordered keys rather than inspecting every row.

For an index on `machine_id`, the index contains key/row-location information that lets SQLite locate matching records efficiently.

The trade-off is:

```text
Faster reads
    +
More disk space
    +
Extra work on INSERT/UPDATE/DELETE
```

Every time an indexed value changes or a new row is inserted, the relevant index structure must also be updated.

## Primary key indexes

`id = primary_key=True` gives the table a primary-key structure. In SQLite, an INTEGER PRIMARY KEY has especially strong integration with the underlying row storage.

## Unique indexes

`machine_code` and `part_number` are declared unique. That is not only a performance feature; it is also a data-integrity rule.

For example, two machines cannot legally have the same machine code.

---

# 9. Relationships and cascade behavior

A machine has related records:

```text
Machine
 ├── Components
 ├── FaultRecords
 ├── SensorReadings
 ├── MaintenanceRecords
 ├── WorkOrders
 ├── Alerts
 └── AIDiagnosticSessions
```

The ORM expresses this with `relationship()`.

For example:

```python
components = relationship(
    "Component",
    back_populates="machine",
    cascade="all, delete-orphan"
)
```

This means the ORM understands the object graph.

The important consequence of `delete-orphan` is that child objects that are removed from the parent's managed collection can be treated as orphans and deleted according to SQLAlchemy's relationship rules.

For a machine-management application, this keeps dependent records conceptually attached to their parent machine. However, in a real production system, deletion policies deserve careful thought because maintenance history is often audit data that should not be physically deleted.

---

# 10. The current data model

The current ORM layer contains these major entities:

| Model | Purpose |
|---|---|
| `Machine` | Main physical asset record |
| `Component` | Subsystem/component belonging to a machine |
| `FaultRecord` | Historical or current fault information |
| `SensorReading` | Temperature, vibration, current, load, etc. |
| `MaintenanceRecord` | Maintenance history/schedule |
| `WorkOrder` | Actionable maintenance task |
| `Alert` | System-generated warning/critical condition |
| `SparePart` | Inventory item |
| `KnowledgeBaseEntry` | Structured diagnostic knowledge stored in DB |
| `AIDiagnosticSession` | Historical AI/offline diagnosis session |
| `User` | Role record |
| `AppSetting` | Local key/value application settings |

The enums encode domain states such as health status, criticality, maintenance type/status, work-order status, priority, alert severity, and user role.

---

# 11. Machine API — exact execution example

The machine router provides CRUD and machine sub-resources.

For example, `POST /api/machines/{machine_id}/readings` does approximately this:

```python
machine = db.get(models.Machine, machine_id)
if not machine:
    raise HTTPException(404, "machine not found")

reading = models.SensorReading(
    machine_id=machine_id,
    **payload.model_dump()
)
db.add(reading)
db.commit()
db.refresh(reading)
return reading
```

Deeply:

1. FastAPI matches the URL.
2. `machine_id` is parsed as an integer.
3. Pydantic validates the request body.
4. `get_db()` provides a SQLAlchemy Session.
5. `db.get()` performs a primary-key lookup.
6. If missing, FastAPI converts the exception into HTTP 404.
7. A `SensorReading` Python object is created.
8. `db.add()` makes it pending in the Session.
9. `commit()` causes an INSERT and commits the transaction.
10. `refresh()` reloads the object from the database.
11. FastAPI serializes it according to the response schema.
12. The frontend receives JSON.

This exact pattern appears repeatedly throughout CRUD-style endpoints.

---

# 12. Health scoring — what the application currently does

The current machine router contains `_recompute_status()`:

```python
if machine.health_score >= 70:
    machine.status = HealthStatus.healthy
elif machine.health_score >= 40:
    machine.status = HealthStatus.attention
else:
    machine.status = HealthStatus.critical
```

This is a **rule-based classification**, not machine learning.

The mapping is:

```text
70–100  → healthy
40–69   → attention
0–39    → critical
```

The important distinction is that the current project does not infer the health score from a trained neural network. The score is an application-level value and the status is derived from thresholds.

That is why the README correctly identifies ML-based health scoring as future work.

A future ML implementation could consume time-series features such as:

```text
temperature mean / max / slope
vibration RMS / peak / kurtosis
current mean / variance
load profile
operating hours
fault history
maintenance age
```

and output a probability of failure or a health estimate. But that is a different algorithm from the current threshold logic.

---

# 13. Smart alerts — how to think about them

The alert subsystem evaluates machine conditions and creates alerts when configured rules are satisfied.

The important architectural concept is **derived state**:

```text
Stored machine/fault/maintenance data
                 ↓
          alert evaluation
                 ↓
          derived alert rows
```

An alert is therefore not necessarily raw sensor data. It is an interpretation of existing data.

Typical triggers in this project include:

1. Low health score.
2. Maintenance overdue or approaching due date.
3. Repeated unresolved faults.

Deduplication is important. Otherwise every evaluation cycle could create the same alert again:

```text
bad:
cycle 1 → alert A
cycle 2 → alert A again
cycle 3 → alert A again
```

A proper `raise_alert()` strategy checks whether an equivalent unresolved alert already exists before inserting another one.

---

# 14. Maintenance scheduling

The application models operating hours and a maintenance interval in hours.

Conceptually:

```text
operating_hours
        +
maintenance_interval_hours
        ↓
maintenance due calculation
        ↓
next_maintenance_date / maintenance status
```

The important domain idea is that maintenance can be triggered by machine usage, not just calendar time.

For industrial equipment this matters because two machines installed on the same date can have completely different wear exposure if one runs continuously and the other runs occasionally.

---

# 15. Work orders — state machine thinking

A work order has statuses:

```text
pending → in_progress → completed
```

Treat this as a state machine rather than just a string.

A state transition means a business event occurred.

For example:

```text
pending
   │ technician starts task
   ▼
in_progress
   │ task completed
   ▼
completed
```

The project also connects completion to maintenance history: completing a work order can automatically create a `MaintenanceRecord`.

That is a good example of business logic: one user action causes multiple persistent changes because the second record represents the historical fact that maintenance actually occurred.

---

# 16. AI diagnostic system — the most interesting subsystem

MAINTAIN AI deliberately uses a two-tier design:

```text
                 Technician problem
                         │
                         ▼
                  AI assistant API
                         │
               use_online_ai = true?
                    /            \
                  yes             no
                   │               │
                Gemini            │
                   │               │
             success?              │
              /     \             │
            yes      no            │
             │        │            │
             ▼        └─────────────┤
          result                    ▼
                              Offline engine
                                    │
                            local knowledge base
                                    │
                              symptom matching
                                    │
                            questions / causes
                                    │
                              procedure
```

This is **offline-first/fallback architecture**.

The key design rule is: Gemini is an enhancement, not a dependency.

---

# 17. AI request flow in exact detail

The endpoint is:

```text
POST /api/ai/diagnose
```

The router first attempts to identify the selected machine:

```python
machine = db.get(models.Machine, payload.machine_id) if payload.machine_id else None
machine_category = machine.category if machine else None
```

If online AI is requested:

```python
result = gemini_client.diagnose_with_gemini(...)
```

If that returns `None` for any reason:

```python
result = offline_engine.diagnose(...)
```

The result is then persisted into an `AIDiagnosticSession`.

That means the system is not merely answering the technician and forgetting the answer. It creates an auditable history containing:

- machine ID
- problem description
- questions
- answers
- likely causes
- recommended action
- final technician result, when later supplied
- source (`offline` or `gemini`)
- timestamp

---

# 18. Offline engine — this is not an LLM

This distinction is essential.

The offline diagnostic engine is a **deterministic knowledge-base matching system**.

It does not contain a transformer model, neural network, embeddings database, or generative model.

Its architecture is:

```text
Problem text
    ↓
lowercase normalization
    ↓
filter KB by machine category
    ↓
score symptom matches
    ↓
sort candidates
    ↓
select highest-scoring entry
    ↓
if insufficient signal → ask questions
    ↓
otherwise return causes + procedure
```

This is closer to a small expert system than a conventional LLM.

---

# 19. The symptom scoring algorithm

The current `_score_entry()` algorithm is intentionally simple:

```python
score = 0
for symptom in entry.get("symptoms", []):
    s = symptom.lower()
    if s in text:
        score += 2
    if s in combined_answers:
        score += 3
```

This means:

```text
symptom appears in original problem → +2
symptom appears in technician answers → +3
```

Answers have a higher weight because they are additional evidence collected after the initial complaint.

Example:

```text
Problem:
"Motor is overheating and making noise"

Knowledge entry symptoms:
["overheating", "noise", "high current"]
```

Two symptoms match the original text:

```text
overheating → +2
noise       → +2
----------------
score = 4
```

A later answer containing `high current` adds another +3.

This is a simple weighted lexical matcher. It is explainable because you can literally show which terms caused the score.

### Limitations

It does not understand synonyms automatically.

For example, if the knowledge base contains `overheating` but the technician writes `running too hot`, a plain substring matcher may fail to recognize the semantic equivalence.

A future upgrade could use:

- synonym dictionaries
- stemming/lemmatization
- TF-IDF
- embeddings/vector search
- a small local classifier
- a trained fault classifier

But each upgrade increases complexity and usually reduces the transparency of the current rule system.

---

# 20. Diagnostic confidence labels

The engine maps confidence numbers to labels:

```text
>= 85 → confirmed
>= 60 → likely
>= 30 → possible
< 30  → insufficient_information
```

This is a **presentation classification**, not statistical calibration.

A value of 85 in the knowledge base does not mean there is mathematically an 85% probability of failure. It is a domain confidence score chosen by the knowledge-base author.

That distinction is important when explaining the system in a viva or technical presentation.

A stronger future implementation would define how confidence is calibrated against historical outcomes.

---

# 21. Why the offline engine asks questions

If the top symptom score is low, the engine does not immediately invent a diagnosis.

It can return:

```json
{
  "needs_more_info": true,
  "clarifying_questions": [...],
  "possible_causes": [],
  "recommended_procedure": []
}
```

This is a conservative design.

The decision is approximately:

```text
No useful match
      ↓
ask generic questions

Useful candidate but weak evidence
      ↓
ask entry-specific questions

Enough evidence
      ↓
return causes + procedure
```

This is much safer than always returning a confident-sounding answer.

---

# 22. Frozen application path resolution

One subtle but important implementation detail is the knowledge-base path.

During normal Python execution, the engine loads:

```text
backend/app/ai/knowledge_base.json
```

When packaged by PyInstaller, files can be extracted into a temporary runtime directory represented by `sys._MEIPASS`.

The code therefore checks:

```python
if getattr(sys, "frozen", False):
    _KB_PATH = os.path.join(
        sys._MEIPASS,
        "app",
        "ai",
        "knowledge_base.json"
    )
```

This is necessary because a packaged executable does not have the same normal source-tree filesystem layout.

This tiny piece of code is one of the reasons the offline AI remains functional inside the desktop build.

---

# 23. Gemini integration — what actually happens

The Gemini client first resolves the API key.

Priority is:

```text
local database setting
        ↓ if absent
GEMINI_API_KEY environment variable
        ↓ if absent
None
```

The database setting is useful in a desktop application because the user can enter a key through the Settings UI instead of modifying an environment file.

The client then creates a Gemini model with a system instruction that defines the expected diagnostic behavior and JSON structure.

The response is requested using an application/json MIME type, then parsed using `json.loads()`.

If anything fails — missing package, missing key, network error, quota issue, bad response, JSON parsing failure — the function returns `None`.

That behavior is intentional:

```text
Gemini failure
      ↓
return None
      ↓
router detects no result
      ↓
offline engine runs
```

This is graceful degradation.

---

# 24. Prompt engineering in this project

The Gemini system instruction does several important things:

1. Defines the assistant's role.
2. Forces a JSON response shape.
3. Defines `needs_more_info`.
4. Defines confidence/certainty representation.
5. Prevents unsupported claims of confirmation.
6. Requires safety/isolation language when physical inspection is implied.
7. Requires concrete industrial procedures.

The prompt is therefore functioning as a lightweight output contract.

However, prompt instructions are not a substitute for validation. A robust production system should additionally validate the returned JSON against a schema before trusting it.

The current application parses the JSON and passes it into the response model, so FastAPI's response validation provides an additional layer, but explicit AI-output validation and defensive handling could be strengthened further.

---

# 25. Diagnostic outcome feedback loop

The endpoint:

```text
POST /api/ai/sessions/{session_id}/outcome
```

stores what the technician actually found.

That creates this valuable future dataset:

```text
reported symptoms
       ↓
AI/offline prediction
       ↓
recommended action
       ↓
actual technician finding
```

Eventually this can become training/evaluation data.

For example:

```text
Predicted: bearing wear
Actual:    bearing wear
→ correct prediction

Predicted: overload
Actual:    misalignment
→ incorrect prediction
```

With enough historical cases, the system could calculate diagnostic precision/recall, confusion matrices, calibration, and eventually train a statistical model.

This is the bridge between the current rule-based system and the future ML system.

---

# 26. Reports and exports

The reporting layer is another example of backend-generated derived information.

Instead of sending raw tables to the frontend and asking JavaScript to calculate everything, the backend can aggregate domain information into report structures.

Export technologies are specialized by format:

```text
CSV   → Python standard library
PDF   → ReportLab
Excel → openpyxl
```

The important engineering principle is that a file format is generated on the backend, where the server can consistently reproduce the same report from database state.

---

# 27. React frontend internals

The frontend entry point builds an application shell around routed pages.

The main navigation contains:

```text
Dashboard
Machines
Maintenance
Work Orders
AI Assistant
Alerts
Spare Parts
Reports
Settings
```

React Router maps paths to components. For example:

```text
/                  → Dashboard
/machines          → Machines
/machines/:id      → MachineDetail
/maintenance       → Maintenance
/work-orders       → WorkOrders
/ai-assistant      → AIAssistant
/alerts            → Alerts
/spare-parts       → SpareParts
/reports           → Reports
/settings          → Settings
```

A route such as `/machines/:id` contains a dynamic parameter. React Router extracts the `id` and the component can use it to request the corresponding backend resource.

---

# 28. React rendering model

When a user clicks something, React does not usually redraw the entire operating-system window.

The conceptual sequence is:

```text
click
 ↓
React event handler
 ↓
state update / API call
 ↓
component function executes again
 ↓
new React element tree
 ↓
React reconciliation
 ↓
DOM mutations only where needed
```

This is why the UI can feel like a desktop application even though the core renderer is a web technology.

---

# 29. API client and environment configuration

The frontend uses an API base URL with a fallback to localhost.

Conceptually:

```js
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'
```

During a Vite build, environment variables beginning with `VITE_` can be injected into frontend code.

For the desktop build, the backend still listens on `127.0.0.1:8000`, so the packaged renderer can use the same endpoint.

This is a useful example of keeping the frontend/backend contract stable across deployment modes.

---

# 30. Why `base: './'` matters for Electron

The Vite configuration uses:

```js
base: './'
```

A normal web deployment can assume assets are available at paths such as:

```text
/assets/index.js
```

But the packaged Electron renderer can load the application from a local `file://` URL.

Relative asset paths are therefore much safer:

```text
./assets/index.js
```

Without the correct base path, the browser can request an absolute web-style asset path that does not resolve correctly from the packaged local application.

This is one of those bugs that makes the application appear to have "nothing wrong" in web development while failing only after packaging.

---

# 31. Electron internals

Electron has two conceptual sides:

```text
Main process
    │
    ├── operating-system integration
    ├── BrowserWindow
    ├── child process management
    └── application lifecycle

Renderer process
    │
    └── React/Vite UI
```

The main process is where MAINTAIN AI starts the Python backend.

The renderer talks to the backend using normal HTTP just as the web application does.

That means Electron is not replacing FastAPI. It is wrapping the same web application inside a desktop runtime.

---

# 32. Desktop backend spawning

The desktop main process determines the correct backend executable name by platform.

Conceptually:

```text
Windows → maintain-ai-backend.exe
Linux/macOS → maintain-ai-backend
```

It starts that executable as a child process and waits for the backend health endpoint to respond.

The wait loop is important because process creation is asynchronous:

```text
spawn backend
     ↓
backend imports Python modules
     ↓
creates engine/app
     ↓
starts Uvicorn
     ↓
port 8000 begins accepting requests
```

If Electron immediately loads the UI before the backend is ready, API requests can fail. The health-check loop solves the startup race.

---

# 33. Per-user desktop database

A desktop application should not normally write its mutable database into the application's installation directory.

The desktop wrapper therefore uses Electron's user-data location for the database path.

Conceptually:

```text
Application installation
    ├── executable
    ├── frontend files
    └── backend executable

User data directory
    └── maintain_ai.db
```

This separation is important because installation directories can have restricted permissions and can be replaced during application upgrades.

It also means different OS users can have different MAINTAIN AI databases.

---

# 34. PyInstaller — turning Python into an executable

PyInstaller does not magically translate Python into native machine instructions in the same way a traditional C compiler does.

Instead, it packages:

```text
Python interpreter/runtime
+ Python bytecode/modules
+ dependencies
+ application code
+ declared data files
```

into a distributable application.

That is why the packaged backend can run on a machine without requiring the user to separately install Python.

The `.spec` file controls important packaging behavior, including the inclusion of `knowledge_base.json`.

A crucial deployment rule is that Python executables are platform-specific. A Linux Python build cannot simply be renamed to `.exe` and expected to work on Windows.

That is why native GitHub Actions runners are used for Windows, macOS, and Linux builds.

---

# 35. Electron Builder — turning the app into installers

Electron Builder takes the Electron application and its resources and produces platform-specific distributables.

The MAINTAIN AI configuration maps:

```text
backend/dist   → packaged backend resource directory
frontend/dist  → packaged frontend resource directory
```

Targets include:

```text
Windows → NSIS installer (.exe)
macOS   → DMG
Linux   → AppImage + deb
```

The application ID is:

```text
com.dmjgroup.maintainai
```

and the application product name is:

```text
MAINTAIN AI
```

The application icon is configured through the desktop build configuration.

---

# 36. Why the build must happen on each operating system

Native application packaging depends on platform-specific binaries.

The project therefore uses a matrix such as:

```text
windows-latest
macos-latest
ubuntu-latest
```

Each runner builds:

```text
React/Vite frontend
       ↓
frontend/dist

Python backend
       ↓
PyInstaller executable

Electron
       ↓
electron-builder installer
```

This is more reliable than trying to create all three native artifacts from one operating system.

---

# 37. GitHub Actions CI/CD pipeline

The desktop workflow can run in two ways:

```text
manual workflow_dispatch

or

push tag matching v*
```

For every OS, the workflow performs approximately:

1. Checkout repository.
2. Install Python 3.12.
3. Install Node.js 20.
4. Install frontend dependencies.
5. Build frontend with the API URL.
6. Install backend dependencies.
7. Install PyInstaller.
8. Build backend executable.
9. Install desktop dependencies.
10. Run Electron Builder.
11. Upload generated installer artifacts.

This is a classic build pipeline: source code → platform-specific build artifact.

---

# 38. Why the Codespace PyInstaller problem happens

A common trap is assuming:

```text
If Python runs in Linux Codespaces,
then PyInstaller can make a Windows .exe.
```

That is not generally true.

PyInstaller bundles a runtime appropriate to the platform on which it is built. The local environment therefore matters.

The repository's GitHub Actions strategy solves this by using:

```text
Windows runner → Windows executable
macOS runner   → macOS artifact
Linux runner   → Linux artifact
```

The correct mental model is **build natively for the target OS**.

---

# 39. CORS — why it exists here

In web development, the frontend and backend are different origins:

```text
http://localhost:5173
http://localhost:8000
```

Different ports mean different origins.

Browsers enforce the same-origin policy, so a frontend JavaScript application cannot freely make cross-origin requests unless the server explicitly permits them.

FastAPI therefore installs `CORSMiddleware`.

The current configuration allows all origins, methods, and headers. That is convenient for development but should be tightened for a real internet-facing deployment.

In a packaged desktop application, the renderer origin may be a local `file://` context, but keeping the backend CORS configuration permissive avoids unnecessary friction during the current architecture.

---

# 40. What the system is actually "predictive" about today

This deserves an honest technical explanation.

The project is a predictive-maintenance **platform**, but the current health intelligence is primarily rule-based rather than trained predictive ML.

Current intelligence includes:

```text
health thresholds
maintenance scheduling
fault repetition detection
alert rules
knowledge-base diagnosis
optional generative AI assistance
```

The future ML layer can become genuinely predictive once enough real sensor history exists.

For example:

```text
Sensor stream
   ↓
feature extraction
   ↓
time-series window
   ↓
ML model
   ↓
probability of fault / remaining useful life
   ↓
health score
   ↓
maintenance recommendation
```

That is a different architecture from simply adding Gemini to the application.

---

# 41. What "real sensor integration" would look like

The existing `SensorReading` model already separates readings into:

```text
machine_id
reading_type
value
unit
source
recorded_at
```

That is a reasonable abstraction for eventually accepting hardware data.

A future ESP32/Arduino pipeline could look like:

```text
Temperature sensor
Vibration sensor
Current sensor
       │
       ▼
ESP32/Arduino
       │
       │ Wi-Fi / serial / MQTT / HTTP
       ▼
MAINTAIN AI ingestion endpoint
       │
       ▼
SensorReading rows
       │
       ├── health calculation
       ├── alert engine
       ├── charts
       └── ML pipeline
```

The important design point is that the UI should not need to know whether a reading came from a technician typing it or from a sensor. The `source` field already expresses this distinction.

---

# 42. A complete click-to-database execution trace

Imagine the technician adds a temperature reading.

## Layer 1 — User experience

The technician enters:

```text
Temperature = 81.4 °C
```

and clicks Save.

## Layer 2 — React

The event handler collects the form values and sends a `fetch()` request.

## Layer 3 — HTTP

The browser creates an HTTP request:

```text
POST /api/machines/7/readings
```

with JSON.

## Layer 4 — Uvicorn/ASGI

Uvicorn accepts the network connection and passes the request into the ASGI application.

## Layer 5 — FastAPI

FastAPI resolves the route and validates the request body against its Pydantic schema.

## Layer 6 — dependency injection

`Depends(get_db)` creates a SQLAlchemy Session.

## Layer 7 — SQLAlchemy

The route constructs a `SensorReading` ORM object and adds it to the Session.

## Layer 8 — SQL

On flush/commit, SQLAlchemy emits an INSERT statement appropriate for SQLite.

## Layer 9 — SQLite

SQLite modifies the database file and commits the transaction.

## Layer 10 — ORM refresh

`db.refresh(reading)` reloads the stored row, including generated values such as the ID/timestamp where applicable.

## Layer 11 — FastAPI response

The ORM object is converted to the declared response shape and serialized to JSON.

## Layer 12 — Browser

`fetch()` receives the response.

## Layer 13 — React

State is updated and the relevant component renders the new reading.

That entire chain is what happens behind a seemingly simple "Save" button.

---

# 43. A complete AI diagnosis execution trace

Now consider a technician entering:

```text
Motor is overheating and making unusual noise.
```

with a selected induction motor.

The flow is:

```text
React AIAssistant page
        ↓
POST /api/ai/diagnose
        ↓
FastAPI validates request
        ↓
lookup Machine by ID
        ↓
get machine.category
        ↓
use_online_ai?
     /        \
   yes         no
    ↓           ↓
Gemini       offline engine
    │           │
 failure ───────┘
                ↓
      load knowledge_base.json
                ↓
       filter machine category
                ↓
      calculate symptom scores
                ↓
          choose best entry
                ↓
       enough information?
          /            \
        no              yes
        ↓                 ↓
   ask questions     causes/procedure
          \             /
           └──────┬────┘
                  ↓
        create AIDiagnosticSession
                  ↓
              SQLite
                  ↓
            JSON response
                  ↓
           React diagnosis UI
```

The important thing is that **Gemini and the offline engine converge on the same response contract**. That is what makes fallback possible without forcing the frontend to understand two completely different APIs.

---

# 44. Why a shared response shape is an excellent design choice

Both AI paths return fields such as:

```text
safety_notice
clarifying_questions
possible_causes
recommended_procedure
source
needs_more_info
```

This gives the frontend one contract:

```text
if source == offline:
    render same UI

if source == gemini:
    render same UI
```

Without this, the frontend might need:

```text
if Gemini response:
    use fields A/B/C
else:
    use fields X/Y/Z
```

That would make the UI tightly coupled to the AI provider.

The current design avoids that.

---

# 45. Configuration and secrets

The Gemini key can live in the local `AppSetting` table or in `GEMINI_API_KEY`.

This is better than hard-coding a key into React source because frontend JavaScript is distributed to the client and can be inspected.

However, storing an API key in a local SQLite database is not equivalent to a hardened secret vault. A determined local user with access to the machine can potentially inspect local application data.

For a personal/local desktop application this can be an acceptable trade-off. For a multi-user enterprise application, a proper backend secret-management architecture would be preferable.

---

# 46. Current architecture strengths

## 46.1 Same API contract across web and desktop

The desktop app does not need a second backend implementation.

## 46.2 Offline diagnostic capability

A technician can still receive useful structured diagnostics without an internet connection or Gemini key.

## 46.3 Clear domain separation

Machines, work orders, maintenance, alerts, inventory, reports, and AI have separate router/model responsibilities.

## 46.4 Easy local setup

SQLite means the application can start without configuring PostgreSQL or another database server.

## 46.5 Future hardware compatibility

`SensorReading.source` and the sensor-reading model give a natural bridge from manual input to hardware ingestion.

## 46.6 Desktop packaging

Electron + PyInstaller turns the multi-process development architecture into a user-installable product.

---

# 47. Current architectural weaknesses / trade-offs

These are not necessarily bugs; they are design limitations worth knowing.

## 47.1 `create_all()` instead of migrations

Good for a prototype/local application. Less suitable for controlled production schema evolution.

## 47.2 Broad CORS

`allow_origins=["*"]` is convenient but should be restricted for production deployment.

## 47.3 Rule-based health scoring

It is explainable but does not learn from time-series sensor data.

## 47.4 Lexical offline diagnosis

Simple substring matching is transparent but misses semantic similarity.

## 47.5 JSON stored inside Text columns

Fields such as `likely_causes` and `answers` are stored as JSON strings inside relational text columns. This is simple and practical for the current project, but querying individual nested values is less powerful than using normalized tables or a database-native JSON type.

## 47.6 Role records without enforcement

The project has admin/technician/viewer roles, but the current architecture does not yet enforce authorization boundaries.

## 47.7 SQLite concurrency ceiling

SQLite is excellent for a local single-user desktop application. Heavy multi-user concurrent writes would be a reason to move to PostgreSQL or another server database.

---

# 48. How to explain MAINTAIN AI in a viva

If someone asks **"What is MAINTAIN AI?"**, a technically honest answer is:

> MAINTAIN AI is a predictive-maintenance and maintenance-management platform built with React/Vite on the frontend and FastAPI/SQLAlchemy on the backend. The backend persists machine, sensor, fault, maintenance, work-order, alert, inventory, and diagnostic-session data in SQLite. Its current health intelligence is rule-based, while its diagnostic assistant uses a local knowledge-base engine with an optional Gemini enhancement and automatic offline fallback. Electron and PyInstaller package the same application into a standalone desktop product.

If asked **"Is it really AI?"**, say:

> The application has an AI diagnostic subsystem with an optional generative AI path, but the core offline diagnostic engine is a deterministic knowledge-based expert system, and the current health score is rule-based rather than ML-trained. The architecture is designed to evolve toward sensor-driven machine learning when sufficient historical data exists.

That answer is much stronger than claiming that every part is already machine learning.

---

# 49. The five levels of understanding

Use these levels when learning any part of the project.

## Level 1 — What?

"This button saves a sensor reading."

## Level 2 — How does our code do it?

"The React handler calls the machine-reading API, and the FastAPI router creates a `SensorReading` model and commits it."

## Level 3 — What does the framework do?

"FastAPI validates the body and injects a database Session; SQLAlchemy translates ORM operations into SQL; SQLite stores the row."

## Level 4 — What happens underneath?

"HTTP is carried over TCP; Uvicorn runs the ASGI server; SQLAlchemy flushes a unit of work into SQL statements; SQLite executes those statements and updates B-tree/index structures as required."

## Level 5 — Why was it designed this way?

"Separating the React UI from the database through an HTTP API allows the same backend to serve both browser and Electron clients, while SQLite minimizes setup and the offline AI fallback removes a network dependency."

If you can explain a feature at all five levels, you genuinely understand that feature.

---

# 50. The entire MAINTAIN AI stack in one diagram

```text
┌────────────────────────────────────────────────────────────────────┐
│                         USER / TECHNICIAN                          │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                    REACT + VITE FRONTEND                           │
│                                                                    │
│ Dashboard | Machines | Maintenance | Work Orders | AI | Alerts    │
│ Spare Parts | Reports | Settings                                  │
└────────────────────────────────┬───────────────────────────────────┘
                                 │ fetch / HTTP / JSON
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                     FASTAPI + UVICORN                              │
│                                                                    │
│ Routers → validation → dependencies → business logic               │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                         SQLALCHEMY                                 │
│                                                                    │
│ ORM objects | Session | transactions | relationships               │
└────────────────────────────────┬───────────────────────────────────┘
                                 │ SQL
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                            SQLITE                                  │
│                                                                    │
│ tables | rows | primary keys | indexes | B-tree structures         │
└────────────────────────────────────────────────────────────────────┘

AI path:

React → /api/ai/diagnose → Gemini (optional)
                         ↘ offline_engine
                              ↓
                       knowledge_base.json
                              ↓
                      symptom scoring
                              ↓
                     diagnosis response
                              ↓
                    AIDiagnosticSession
```

Desktop path:

```text
GitHub Actions
      │
      ├── Vite build ───────────► frontend/dist
      │
      ├── PyInstaller ──────────► backend/dist
      │
      └── Electron Builder
                 │
                 ▼
        Windows / macOS / Linux installer
                 │
                 ▼
              Electron
             /        \
      backend child    React renderer
       process              │
          │                 │
          └── HTTP ◄────────┘
```

---

# 51. What you should learn next to truly master the project

The highest-value concepts to study, in order, are:

1. **HTTP:** methods, headers, status codes, JSON, localhost, ports.
2. **FastAPI:** routing, dependencies, Pydantic validation, response models.
3. **SQLAlchemy:** Session lifecycle, flush, commit, rollback, relationships, lazy loading.
4. **SQL:** SELECT/INSERT/UPDATE/DELETE, JOIN, WHERE, ORDER BY, indexes.
5. **SQLite internals:** pages, B-trees, indexes, query planning, transactions.
6. **React:** components, props, state, effects, reconciliation, routing.
7. **Vite:** module bundling, environment variables, build output, asset paths.
8. **Electron:** main process, renderer process, child processes, app lifecycle.
9. **PyInstaller:** frozen applications, hidden imports, bundled data files.
10. **ML fundamentals:** features, labels, train/validation/test splits, time-series leakage, classification, regression, calibration.
11. **Industrial predictive maintenance:** vibration analysis, temperature trends, current signatures, failure modes, MTBF, MTTR, RUL.

The last two are what will eventually turn MAINTAIN AI from a rule-based predictive-maintenance platform into a data-driven predictive-maintenance system.

---

# 52. Final mental model

Do not think of MAINTAIN AI as "a website plus some Python files."

Think of it as a chain of contracts:

```text
UI contract
   ↓
HTTP/API contract
   ↓
validation contract
   ↓
business-logic contract
   ↓
ORM/database contract
   ↓
persistence contract
```

And for diagnostics:

```text
technician evidence
   ↓
diagnostic input contract
   ↓
Gemini OR deterministic offline engine
   ↓
shared diagnostic response contract
   ↓
historical session
   ↓
actual technician outcome
   ↓
future evaluation/training data
```

The deepest architectural idea in the project is therefore **separation of concerns combined with stable interfaces**. React does not need to know how SQLite works. SQLite does not need to know what React looks like. Gemini does not own the diagnostic UI. Electron does not own the business logic. Each layer has a job, and the interfaces between the layers allow them to work together.

That is the foundation that makes the current project understandable, testable, packageable, and extensible.
