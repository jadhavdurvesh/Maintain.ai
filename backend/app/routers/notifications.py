import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class DeviceRegistrationIn(BaseModel):
    worker_username: str
    device_token: str
    platform: str = "android"


class NotificationOut(BaseModel):
    id: int
    notification_type: str
    title: str
    body: str
    data: dict
    created_at: datetime
    read: bool


@router.post("/register-device")
def register_device(payload: DeviceRegistrationIn, db: Session = Depends(get_db)):
    worker = db.query(models.User).filter_by(username=payload.worker_username).first()
    if not worker:
        raise HTTPException(404, "worker not found")

    device = db.query(models.WorkerDevice).filter_by(device_token=payload.device_token).first()
    if device:
        device.worker_username = payload.worker_username
        device.platform = payload.platform
        device.enabled = True
        device.last_seen = datetime.utcnow()
    else:
        device = models.WorkerDevice(
            worker_username=payload.worker_username,
            device_token=payload.device_token,
            platform=payload.platform,
        )
        db.add(device)
    db.commit()
    return {"registered": True}


@router.delete("/device")
def unregister_device(device_token: str, db: Session = Depends(get_db)):
    device = db.query(models.WorkerDevice).filter_by(device_token=device_token).first()
    if device:
        device.enabled = False
        db.commit()
    return {"registered": False}


@router.get("", response_model=List[NotificationOut])
def list_notifications(worker_username: str, unread_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.WorkerNotification).filter_by(worker_username=worker_username)
    if unread_only:
        query = query.filter(models.WorkerNotification.read_at.is_(None))
    rows = query.order_by(models.WorkerNotification.created_at.desc()).limit(100).all()
    result = []
    for row in rows:
        try:
            data = json.loads(row.data_json or "{}")
        except json.JSONDecodeError:
            data = {}
        result.append(NotificationOut(
            id=row.id,
            notification_type=row.notification_type,
            title=row.title,
            body=row.body,
            data=data,
            created_at=row.created_at,
            read=row.read_at is not None,
        ))
    return result


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, worker_username: str, db: Session = Depends(get_db)):
    row = db.query(models.WorkerNotification).filter_by(
        id=notification_id,
        worker_username=worker_username,
    ).first()
    if not row:
        raise HTTPException(404, "notification not found")
    row.read_at = datetime.utcnow()
    db.commit()
    return {"read": True}


@router.post("/read-all")
def mark_all_read(worker_username: str, db: Session = Depends(get_db)):
    db.query(models.WorkerNotification).filter(
        models.WorkerNotification.worker_username == worker_username,
        models.WorkerNotification.read_at.is_(None),
    ).update({models.WorkerNotification.read_at: datetime.utcnow()}, synchronize_session=False)
    db.commit()
    return {"read": True}
