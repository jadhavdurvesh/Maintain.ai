import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..ai import offline_engine, gemini_client

router = APIRouter(prefix="/api/ai", tags=["ai_assistant"])


@router.post("/diagnose", response_model=schemas.DiagnoseResponse)
def diagnose(payload: schemas.DiagnoseRequest, db: Session = Depends(get_db)):
    machine = db.get(models.Machine, payload.machine_id) if payload.machine_id else None
    machine_category = machine.category if machine else None

    result = None
    if payload.use_online_ai:
        machine_context = {"name": machine.name, "category": machine.category} if machine else None
        result = gemini_client.diagnose_with_gemini(
            payload.problem_description, machine_context, payload.answers, db=db
        )

    if result is None:
        result = offline_engine.diagnose(
            db, machine_category, payload.problem_description, payload.answers
        )

    session = models.AIDiagnosticSession(
        machine_id=payload.machine_id,
        problem_description=payload.problem_description,
        questions_asked=json.dumps(result.get("clarifying_questions", [])),
        answers=json.dumps(payload.answers or []),
        likely_causes=json.dumps(result.get("possible_causes", [])),
        recommended_action="; ".join(result.get("recommended_procedure", [])),
        source=result.get("source", "offline"),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return schemas.DiagnoseResponse(
        session_id=session.id,
        safety_notice=result.get("safety_notice", offline_engine.SAFETY_NOTICE),
        clarifying_questions=result.get("clarifying_questions", []),
        possible_causes=result.get("possible_causes", []),
        recommended_procedure=result.get("recommended_procedure", []),
        source=result.get("source", "offline"),
        needs_more_info=result.get("needs_more_info", False),
    )


@router.post("/sessions/{session_id}/outcome")
def record_outcome(session_id: int, final_technician_result: str, db: Session = Depends(get_db)):
    """Lets a technician record what was actually found, so predicted-vs-actual
    can be compared later to improve the system, per the spec's AI Diagnostic History."""
    session = db.get(models.AIDiagnosticSession, session_id)
    if not session:
        raise HTTPException(404, "session not found")
    session.final_technician_result = final_technician_result
    db.commit()
    return {"updated": True}


@router.get("/sessions")
def list_sessions(machine_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.AIDiagnosticSession)
    if machine_id:
        q = q.filter_by(machine_id=machine_id)
    sessions = q.order_by(models.AIDiagnosticSession.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "machine_id": s.machine_id,
            "problem_description": s.problem_description,
            "likely_causes": json.loads(s.likely_causes or "[]"),
            "recommended_action": s.recommended_action,
            "final_technician_result": s.final_technician_result,
            "source": s.source,
            "created_at": s.created_at,
        }
        for s in sessions
    ]
