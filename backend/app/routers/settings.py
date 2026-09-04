from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import settings_store
from ..database import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])

GEMINI_KEY_NAME = "gemini_api_key"


class ApiKeyIn(BaseModel):
    api_key: str


@router.get("/gemini-key")
def get_gemini_key_status(db: Session = Depends(get_db)):
    value = settings_store.get_setting(db, GEMINI_KEY_NAME)
    return {
        "configured": bool(value),
        "last4": value[-4:] if value else None,
    }


@router.post("/gemini-key")
def set_gemini_key(payload: ApiKeyIn, db: Session = Depends(get_db)):
    settings_store.set_setting(db, GEMINI_KEY_NAME, payload.api_key.strip())
    return {"saved": True}


@router.delete("/gemini-key")
def clear_gemini_key(db: Session = Depends(get_db)):
    settings_store.delete_setting(db, GEMINI_KEY_NAME)
    return {"deleted": True}
