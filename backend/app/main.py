from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import machines, maintenance, work_orders, alerts, spare_parts, ai_assistant, reports, users, settings

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MAINTAIN AI",
    description="AI-powered predictive maintenance & intelligent maintenance management system",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(machines.router)
app.include_router(maintenance.router)
app.include_router(work_orders.router)
app.include_router(alerts.router)
app.include_router(spare_parts.router)
app.include_router(ai_assistant.router)
app.include_router(reports.router)
app.include_router(users.router)
app.include_router(settings.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "MAINTAIN AI backend"}
