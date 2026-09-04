from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])


class UserIn(BaseModel):
    username: str
    full_name: str | None = None
    role: str = "technician"  # admin | technician | viewer


class UserOut(UserIn):
    id: int

    class Config:
        from_attributes = True


@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()


@router.post("", response_model=UserOut)
def create_user(payload: UserIn, db: Session = Depends(get_db)):
    if db.query(models.User).filter_by(username=payload.username).first():
        raise HTTPException(400, "username already exists")
    user = models.User(**payload.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
