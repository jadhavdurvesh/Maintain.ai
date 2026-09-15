"""Notification persistence and optional Firebase Cloud Messaging delivery."""

import json
import os
from datetime import datetime
from typing import Iterable

import firebase_admin
from firebase_admin import credentials, messaging
from sqlalchemy.orm import Session

from . import models


_firebase_ready = False


def _firebase_app():
    global _firebase_ready
    if _firebase_ready:
        return firebase_admin.get_app()

    try:
        firebase_admin.get_app()
        _firebase_ready = True
        return firebase_admin.get_app()
    except ValueError:
        pass

    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if raw:
        try:
            service_account = json.loads(raw)
            app = firebase_admin.initialize_app(credentials.Certificate(service_account))
            _firebase_ready = True
            return app
        except Exception:
            return None

    try:
        app = firebase_admin.initialize_app()
        _firebase_ready = True
        return app
    except Exception:
        return None


def create_notification(
    db: Session,
    worker_username: str,
    notification_type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> models.WorkerNotification:
    notification = models.WorkerNotification(
        worker_username=worker_username,
        notification_type=notification_type,
        title=title,
        body=body,
        data_json=json.dumps(data or {}),
    )
    db.add(notification)
    db.flush()
    return notification


def _device_tokens(db: Session, worker_usernames: Iterable[str]) -> list[str]:
    names = {name.strip() for name in worker_usernames if name and name.strip()}
    if not names:
        return []
    rows = (
        db.query(models.WorkerDevice)
        .filter(models.WorkerDevice.worker_username.in_(names))
        .filter(models.WorkerDevice.enabled.is_(True))
        .all()
    )
    return list(dict.fromkeys(row.device_token for row in rows if row.device_token))


def send_push(
    db: Session,
    worker_usernames: Iterable[str],
    title: str,
    body: str,
    data: dict | None = None,
) -> int:
    """Send a push when Firebase is configured; persistence never depends on FCM."""
    app = _firebase_app()
    if app is None:
        return 0

    tokens = _device_tokens(db, worker_usernames)
    if not tokens:
        return 0

    payload_data = {key: str(value) for key, value in (data or {}).items()}
    messages = [
        messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=payload_data,
            token=token,
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="maintain_ai_alerts",
                    sound="default",
                ),
            ),
        )
        for token in tokens
    ]

    sent = 0
    for message in messages:
        try:
            messaging.send(message, app=app)
            sent += 1
        except Exception:
            # A stale/invalid token must never break the maintenance API request.
            continue
    return sent


def notify_workers(
    db: Session,
    worker_usernames: Iterable[str],
    notification_type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> int:
    names = list(dict.fromkeys(name.strip() for name in worker_usernames if name and name.strip()))
    for username in names:
        create_notification(db, username, notification_type, title, body, data)
    db.commit()
    return send_push(db, names, title, body, data)


def workers_for_machine(db: Session, machine_id: int) -> list[str]:
    """Resolve workers currently associated with a machine through active work orders."""
    rows = (
        db.query(models.WorkOrder.assigned_to)
        .filter(models.WorkOrder.machine_id == machine_id)
        .filter(models.WorkOrder.assigned_to.isnot(None))
        .filter(models.WorkOrder.status != models.WorkOrderStatus.completed)
        .distinct()
        .all()
    )
    return [row[0] for row in rows if row[0]]
