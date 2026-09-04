from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/machines", tags=["machines"])


def _recompute_status(machine: models.Machine):
    """Health score -> status, and derive next maintenance date from operating hours."""
    if machine.health_score >= 70:
        machine.status = models.HealthStatus.healthy
    elif machine.health_score >= 40:
        machine.status = models.HealthStatus.attention
    else:
        machine.status = models.HealthStatus.critical


@router.get("", response_model=List[schemas.MachineOut])
def list_machines(db: Session = Depends(get_db)):
    return db.query(models.Machine).all()


@router.post("", response_model=schemas.MachineOut)
def create_machine(payload: schemas.MachineIn, db: Session = Depends(get_db)):
    if db.query(models.Machine).filter_by(machine_code=payload.machine_code).first():
        raise HTTPException(400, "machine_code already exists")
    machine = models.Machine(**payload.model_dump())
    machine.health_score = 100
    _recompute_status(machine)
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


@router.get("/{machine_id}", response_model=schemas.MachineOut)
def get_machine(machine_id: int, db: Session = Depends(get_db)):
    machine = db.get(models.Machine, machine_id)
    if not machine:
        raise HTTPException(404, "machine not found")
    return machine


@router.patch("/{machine_id}", response_model=schemas.MachineOut)
def update_machine(machine_id: int, payload: schemas.MachineUpdate, db: Session = Depends(get_db)):
    machine = db.get(models.Machine, machine_id)
    if not machine:
        raise HTTPException(404, "machine not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(machine, field, value)
    _recompute_status(machine)
    db.commit()
    db.refresh(machine)
    return machine


@router.delete("/{machine_id}")
def delete_machine(machine_id: int, db: Session = Depends(get_db)):
    machine = db.get(models.Machine, machine_id)
    if not machine:
        raise HTTPException(404, "machine not found")
    db.delete(machine)
    db.commit()
    return {"deleted": True}


@router.post("/{machine_id}/components", response_model=schemas.ComponentOut)
def add_component(machine_id: int, payload: schemas.ComponentIn, db: Session = Depends(get_db)):
    if not db.get(models.Machine, machine_id):
        raise HTTPException(404, "machine not found")
    component = models.Component(machine_id=machine_id, **payload.model_dump())
    db.add(component)
    db.commit()
    db.refresh(component)
    return component


@router.get("/{machine_id}/components", response_model=List[schemas.ComponentOut])
def list_components(machine_id: int, db: Session = Depends(get_db)):
    return db.query(models.Component).filter_by(machine_id=machine_id).all()


@router.post("/{machine_id}/readings", response_model=schemas.SensorReadingOut)
def add_reading(machine_id: int, payload: schemas.SensorReadingIn, db: Session = Depends(get_db)):
    machine = db.get(models.Machine, machine_id)
    if not machine:
        raise HTTPException(404, "machine not found")
    reading = models.SensorReading(machine_id=machine_id, **payload.model_dump())
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@router.get("/{machine_id}/readings", response_model=List[schemas.SensorReadingOut])
def list_readings(machine_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.SensorReading)
        .filter_by(machine_id=machine_id)
        .order_by(models.SensorReading.recorded_at.desc())
        .all()
    )
