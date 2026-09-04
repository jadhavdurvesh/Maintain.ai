from sqlalchemy.orm import Session

from . import models


def get_setting(db: Session, key: str) -> str | None:
    row = db.query(models.AppSetting).filter_by(key=key).first()
    return row.value if row else None


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(models.AppSetting).filter_by(key=key).first()
    if row:
        row.value = value
    else:
        db.add(models.AppSetting(key=key, value=value))
    db.commit()


def delete_setting(db: Session, key: str) -> None:
    row = db.query(models.AppSetting).filter_by(key=key).first()
    if row:
        db.delete(row)
        db.commit()
