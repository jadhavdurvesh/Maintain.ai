from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/work-orders", tags=["work_orders"])


@router.get("", response_model=List[schemas.WorkOrderOut])
def list_work_orders(status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(models.WorkOrder)
    if status:
        q = q.filter_by(status=status)
    return q.order_by(models.WorkOrder.created_at.desc()).all()


@router.post("", response_model=schemas.WorkOrderOut)
def create_work_order(payload: schemas.WorkOrderIn, db: Session = Depends(get_db)):
    if not db.get(models.Machine, payload.machine_id):
        raise HTTPException(404, "machine not found")
    wo = models.WorkOrder(**payload.model_dump())
    db.add(wo)
    db.commit()
    db.refresh(wo)
    return wo


@router.patch("/{wo_id}", response_model=schemas.WorkOrderOut)
def update_work_order(wo_id: int, payload: schemas.WorkOrderUpdate, db: Session = Depends(get_db)):
    wo = db.get(models.WorkOrder, wo_id)
    if not wo:
        raise HTTPException(404, "work order not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(wo, field, value)
    if payload.status == "completed":
        wo.completed_at = datetime.utcnow()
        # completed work automatically becomes maintenance history
        record = models.MaintenanceRecord(
            machine_id=wo.machine_id,
            type=models.MaintenanceType.corrective,
            description=wo.problem,
            completed_date=wo.completed_at,
            status=models.MaintenanceStatus.completed,
            performed_by=wo.assigned_to,
            notes=wo.resolution_notes,
        )
        db.add(record)
    db.commit()
    db.refresh(wo)
    return wo
