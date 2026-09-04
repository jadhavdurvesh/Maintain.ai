"""
Smart Alert System — turns machine state into Alert rows.

Kept as a plain function (not a background scheduler) so it can be called
from a cron job, a webhook after a sensor reading is posted, or a manual
"recompute alerts" button — whichever fits how this gets deployed.
"""
from sqlalchemy.orm import Session

from . import models


def evaluate_machine(db: Session, machine: models.Machine) -> list[models.Alert]:
    new_alerts = []

    def raise_alert(alert_type: str, severity: models.AlertSeverity, message: str):
        exists = (
            db.query(models.Alert)
            .filter_by(machine_id=machine.id, alert_type=alert_type, resolved=False)
            .first()
        )
        if exists:
            return
        alert = models.Alert(
            machine_id=machine.id, alert_type=alert_type, severity=severity, message=message
        )
        db.add(alert)
        new_alerts.append(alert)

    if machine.health_score < 40:
        raise_alert("low_health_score", models.AlertSeverity.critical,
                    f"{machine.name} health score is {machine.health_score}/100 — critical.")
    elif machine.health_score < 70:
        raise_alert("low_health_score", models.AlertSeverity.warning,
                    f"{machine.name} health score is {machine.health_score}/100 — attention needed.")

    interval = machine.maintenance_interval_hours or 500
    hours_remaining = interval - (machine.operating_hours % interval)
    if hours_remaining <= 0:
        raise_alert("maintenance_overdue", models.AlertSeverity.high,
                    f"{machine.name} maintenance is overdue.")
    elif hours_remaining <= interval * 0.1:
        raise_alert("maintenance_due_soon", models.AlertSeverity.warning,
                    f"{machine.name} has {round(hours_remaining)} operating hours left before service.")

    recent_faults = (
        db.query(models.FaultRecord)
        .filter_by(machine_id=machine.id, resolved_date=None)
        .count()
    )
    if recent_faults >= 3:
        raise_alert("repeated_failures", models.AlertSeverity.high,
                    f"{machine.name} has {recent_faults} unresolved faults on record.")

    if new_alerts:
        db.commit()
    return new_alerts


def evaluate_all(db: Session) -> int:
    count = 0
    for machine in db.query(models.Machine).all():
        count += len(evaluate_machine(db, machine))
    return count
