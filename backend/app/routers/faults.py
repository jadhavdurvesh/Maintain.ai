from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..notifications import notify_workers, workers_for_machine

router = APIRouter(prefix="/api/faults", tags=["faults"])


@router.get("", response_model=List[schemas.FaultOut])
def list_faults(db: Session = Depends(get_db)):
    return db.query(models.FaultRecord).order_by(models.FaultRecord.reported_date.desc()).all()


@router.post("", response_model=schemas.FaultOut)
def create_fault(payload: schemas.FaultIn, db: Session = Depends(get_db)):
    machine = db.get(models.Machine, payload.machine_id)
    if not machine:
        raise HTTPException(404, "machine not found")

    try:
        severity = models.AlertSeverity(payload.severity)
    except ValueError as exc:
        raise HTTPException(400, "invalid fault severity") from exc

    fault = models.FaultRecord(
        machine_id=payload.machine_id,
        description=payload.description,
        symptoms=payload.symptoms,
        severity=severity,
    )
    db.add(fault)
    db.commit()
    db.refresh(fault)

    title_prefix = {
        models.AlertSeverity.critical: "CRITICAL fault",
        models.AlertSeverity.high: "HIGH fault",
        models.AlertSeverity.warning: "New fault",
        models.AlertSeverity.normal: "Fault reported",
    }[severity]
    notify_workers(
        db,
        workers_for_machine(db, machine.id),
        "critical_fault" if severity == models.AlertSeverity.critical else "fault",
        f"{title_prefix}: {machine.name}",
        fault.description,
        {
            "type": "fault",
            "fault_id": fault.id,
            "machine_id": machine.id,
            "severity": severity.value,
        },
    )
    return fault
