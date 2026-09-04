from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/spare-parts", tags=["spare_parts"])


@router.get("", response_model=List[schemas.SparePartOut])
def list_parts(low_stock_only: bool = False, db: Session = Depends(get_db)):
    parts = db.query(models.SparePart).all()
    if low_stock_only:
        parts = [p for p in parts if p.quantity <= p.minimum_stock]
    return parts


@router.post("", response_model=schemas.SparePartOut)
def create_part(payload: schemas.SparePartIn, db: Session = Depends(get_db)):
    if db.query(models.SparePart).filter_by(part_number=payload.part_number).first():
        raise HTTPException(400, "part_number already exists")
    part = models.SparePart(**payload.model_dump())
    db.add(part)
    db.commit()
    db.refresh(part)
    return part


@router.patch("/{part_id}", response_model=schemas.SparePartOut)
def update_part(part_id: int, quantity: int, db: Session = Depends(get_db)):
    part = db.get(models.SparePart, part_id)
    if not part:
        raise HTTPException(404, "part not found")
    part.quantity = quantity
    db.commit()
    db.refresh(part)
    return part
