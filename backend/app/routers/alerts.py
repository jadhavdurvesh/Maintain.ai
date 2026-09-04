from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=List[schemas.AlertOut])
def list_alerts(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(models.Alert)
    if active_only:
        q = q.filter_by(resolved=False)
    return q.order_by(models.Alert.created_at.desc()).all()


@router.post("/{alert_id}/acknowledge", response_model=schemas.AlertOut)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(models.Alert, alert_id)
    if not alert:
        raise HTTPException(404, "alert not found")
    alert.acknowledged = True
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/{alert_id}/resolve", response_model=schemas.AlertOut)
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(models.Alert, alert_id)
    if not alert:
        raise HTTPException(404, "alert not found")
    alert.resolved = True
    db.commit()
    db.refresh(alert)
    return alert
