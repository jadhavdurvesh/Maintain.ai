from datetime import datetime, timedelta

from .database import SessionLocal, engine, Base
from . import models
from .alerts_engine import evaluate_all

Base.metadata.create_all(bind=engine)


def seed():
    db = SessionLocal()
    if db.query(models.Machine).first():
        print("Already seeded, skipping.")
        db.close()
        return

    machines = [
        models.Machine(
            machine_code="M-001", name="Induction Motor M-001", category="induction_motor",
            manufacturer="Siemens", model_number="1LE1001", location="Bay 3", department="Production",
            operating_hours=4950, criticality=models.Criticality.high,
            health_score=87, maintenance_interval_hours=500,
            last_maintenance_date=datetime(2026, 8, 15), next_maintenance_date=datetime(2026, 9, 15),
            installation_date=datetime(2022, 3, 1),
        ),
        models.Machine(
            machine_code="M-002", name="Centrifugal Pump P-002", category="pump",
            manufacturer="Grundfos", model_number="CR-15", location="Utility Room", department="Utilities",
            operating_hours=3120, criticality=models.Criticality.medium,
            health_score=58, maintenance_interval_hours=750,
            last_maintenance_date=datetime(2026, 7, 1), next_maintenance_date=datetime(2026, 10, 1),
            installation_date=datetime(2021, 6, 10),
        ),
        models.Machine(
            machine_code="M-003", name="Conveyor Belt C-003", category="conveyor",
            manufacturer="Interroll", model_number="CB-500", location="Packaging Line", department="Packaging",
            operating_hours=8700, criticality=models.Criticality.medium,
            health_score=34, maintenance_interval_hours=1000,
            last_maintenance_date=datetime(2026, 5, 20), next_maintenance_date=datetime(2026, 9, 1),
            installation_date=datetime(2019, 11, 5),
        ),
        models.Machine(
            machine_code="M-004", name="Air Compressor AC-004", category="compressor",
            manufacturer="Atlas Copco", model_number="GA-30", location="Compressor House", department="Utilities",
            operating_hours=2100, criticality=models.Criticality.high,
            health_score=95, maintenance_interval_hours=600,
            last_maintenance_date=datetime(2026, 8, 25), next_maintenance_date=datetime(2026, 11, 25),
            installation_date=datetime(2023, 1, 15),
        ),
        models.Machine(
            machine_code="M-005", name="Induction Motor M-005", category="induction_motor",
            manufacturer="ABB", model_number="M3BP-132", location="Bay 1", department="Production",
            operating_hours=6200, criticality=models.Criticality.medium,
            health_score=76, maintenance_interval_hours=500,
            last_maintenance_date=datetime(2026, 8, 1), next_maintenance_date=datetime(2026, 9, 20),
            installation_date=datetime(2020, 9, 12),
        ),
        models.Machine(
            machine_code="M-006", name="Centrifugal Pump P-006", category="pump",
            manufacturer="KSB", model_number="Etanorm-100", location="Utility Room", department="Utilities",
            operating_hours=9100, criticality=models.Criticality.high,
            health_score=22, maintenance_interval_hours=750,
            last_maintenance_date=datetime(2026, 4, 10), next_maintenance_date=datetime(2026, 9, 5),
            installation_date=datetime(2018, 2, 20),
        ),
        models.Machine(
            machine_code="M-007", name="Conveyor Belt C-007", category="conveyor",
            manufacturer="Interroll", model_number="CB-800", location="Loading Dock", department="Logistics",
            operating_hours=5400, criticality=models.Criticality.low,
            health_score=91, maintenance_interval_hours=1000,
            last_maintenance_date=datetime(2026, 8, 18), next_maintenance_date=datetime(2026, 12, 1),
            installation_date=datetime(2022, 7, 1),
        ),
        models.Machine(
            machine_code="M-008", name="Air Compressor AC-008", category="compressor",
            manufacturer="Ingersoll Rand", model_number="R-Series-37", location="Compressor House", department="Utilities",
            operating_hours=7800, criticality=models.Criticality.high,
            health_score=63, maintenance_interval_hours=600,
            last_maintenance_date=datetime(2026, 7, 22), next_maintenance_date=datetime(2026, 9, 10),
            installation_date=datetime(2019, 5, 30),
        ),
    ]
    for m in machines:
        m.status = (
            models.HealthStatus.healthy if m.health_score >= 70
            else models.HealthStatus.attention if m.health_score >= 40
            else models.HealthStatus.critical
        )
    db.add_all(machines)
    db.commit()

    by_code = {m.machine_code: m for m in machines}

    parts = [
        models.SparePart(name="Motor Bearing 6205", part_number="BRG-6205", quantity=2,
                          minimum_stock=5, compatible_machine_categories="induction_motor"),
        models.SparePart(name="Pump Impeller CR-15", part_number="IMP-CR15", quantity=3,
                          minimum_stock=2, compatible_machine_categories="pump"),
        models.SparePart(name="Conveyor Idler Roller", part_number="IDL-500", quantity=8,
                          minimum_stock=4, compatible_machine_categories="conveyor"),
        models.SparePart(name="Compressor Air Filter", part_number="FLT-R37", quantity=1,
                          minimum_stock=3, compatible_machine_categories="compressor"),
        models.SparePart(name="Motor Cooling Fan", part_number="FAN-M3BP", quantity=6,
                          minimum_stock=2, compatible_machine_categories="induction_motor"),
        models.SparePart(name="Pump Mechanical Seal", part_number="SEAL-ETN100", quantity=4,
                          minimum_stock=2, compatible_machine_categories="pump"),
    ]
    db.add_all(parts)

    users = [
        models.User(username="admin", full_name="System Administrator", role=models.UserRole.admin),
        models.User(username="tech1", full_name="Ravi Kulkarni", role=models.UserRole.technician),
        models.User(username="tech2", full_name="Ananya Deshmukh", role=models.UserRole.technician),
        models.User(username="viewer1", full_name="Plant Manager", role=models.UserRole.viewer),
    ]
    db.add_all(users)
    db.commit()

    # ---- Fault history (with real causes, so charts/analytics aren't empty) ----
    faults = [
        ("M-003", "Belt drifting to one side under load", "belt drifting, rubbing, noise",
         "Misaligned idlers", models.AlertSeverity.warning, 2, None),
        ("M-006", "Cavitation noise at high flow", "gravel noise, vibration",
         "Air ingress / cavitation", models.AlertSeverity.critical, 6, None),
        ("M-006", "Loss of discharge pressure", "low pressure, low flow",
         "Worn impeller", models.AlertSeverity.high, 20, 3),
        ("M-002", "Intermittent overheating", "overheating, hot to touch",
         "Cooling path blockage", models.AlertSeverity.warning, 15, 10),
        ("M-008", "High discharge temperature trip", "overheating, high temperature",
         "Cooler fouling", models.AlertSeverity.high, 12, 8),
        ("M-001", "Minor bearing hum reported by operator", "noise",
         "Bearing wear", models.AlertSeverity.warning, 40, 35),
        ("M-005", "Vibration above baseline", "vibration",
         "Excessive load", models.AlertSeverity.warning, 25, 22),
    ]
    for code, desc, symptoms, cause, severity, reported_days_ago, resolved_days_ago in faults:
        m = by_code[code]
        db.add(models.FaultRecord(
            machine_id=m.id, description=desc, symptoms=symptoms, cause=cause, severity=severity,
            reported_date=datetime.utcnow() - timedelta(days=reported_days_ago),
            resolved_date=(datetime.utcnow() - timedelta(days=resolved_days_ago)) if resolved_days_ago else None,
        ))

    # ---- Maintenance history: mix of completed and scheduled, across all 4 types ----
    maint_records = [
        ("M-001", models.MaintenanceType.preventive, "Bearing inspection", 45, True, "tech1"),
        ("M-001", models.MaintenanceType.preventive, "Cooling fan check", 100, True, "tech1"),
        ("M-002", models.MaintenanceType.corrective, "Cooling path cleared", 10, True, "tech2"),
        ("M-002", models.MaintenanceType.preventive, "Scheduled service", -30, False, None),
        ("M-003", models.MaintenanceType.corrective, "Idler realignment", 90, True, "tech1"),
        ("M-003", models.MaintenanceType.breakdown, "Belt edge replacement", -2, False, None),
        ("M-004", models.MaintenanceType.preventive, "Filter change", 18, True, "tech2"),
        ("M-005", models.MaintenanceType.predictive, "Vibration trend review", 5, True, "tech1"),
        ("M-006", models.MaintenanceType.corrective, "Impeller replacement", 3, True, "tech2"),
        ("M-006", models.MaintenanceType.breakdown, "Seal emergency repair", -5, False, None),
        ("M-007", models.MaintenanceType.preventive, "Routine inspection", 60, True, "tech1"),
        ("M-008", models.MaintenanceType.corrective, "Cooler cleaning", 8, True, "tech2"),
        ("M-008", models.MaintenanceType.preventive, "Scheduled service", -15, False, None),
    ]
    for code, mtype, desc, days_offset, completed, performed_by in maint_records:
        m = by_code[code]
        if completed:
            completed_date = datetime.utcnow() - timedelta(days=days_offset)
            db.add(models.MaintenanceRecord(
                machine_id=m.id, type=mtype, description=desc,
                completed_date=completed_date, scheduled_date=completed_date,
                status=models.MaintenanceStatus.completed, performed_by=performed_by,
            ))
        else:
            db.add(models.MaintenanceRecord(
                machine_id=m.id, type=mtype, description=desc,
                scheduled_date=datetime.utcnow() + timedelta(days=abs(days_offset)),
                status=models.MaintenanceStatus.scheduled,
            ))

    # ---- Work orders across all three statuses ----
    work_orders = [
        ("M-006", "Pump impeller replacement — confirmed worn", models.Priority.critical,
         models.WorkOrderStatus.completed, "tech2",
         "Inspect impeller\nReplace if worn\nVerify flow restored", "Impeller replaced, flow restored to spec."),
        ("M-003", "Belt misalignment causing edge wear", models.Priority.high,
         models.WorkOrderStatus.in_progress, "tech1",
         "Inspect idler alignment\nCheck material loading\nInspect belt edges", None),
        ("M-008", "Cooler fouling causing high discharge temp", models.Priority.high,
         models.WorkOrderStatus.in_progress, "tech2",
         "Clean cooler fins\nCheck oil level\nMonitor temperature", None),
        ("M-002", "Recurring intermittent overheating", models.Priority.medium,
         models.WorkOrderStatus.pending, None,
         "Check cooling path\nReview load history", None),
        ("M-005", "Vibration trending upward", models.Priority.low,
         models.WorkOrderStatus.pending, None,
         "Log vibration readings\nCompare to baseline", None),
    ]
    for code, problem, priority, status, assigned_to, actions, resolution in work_orders:
        m = by_code[code]
        completed_at = datetime.utcnow() - timedelta(days=3) if status == models.WorkOrderStatus.completed else None
        db.add(models.WorkOrder(
            machine_id=m.id, problem=problem, priority=priority, status=status,
            assigned_to=assigned_to, recommended_actions=actions,
            completed_at=completed_at, resolution_notes=resolution,
            created_at=datetime.utcnow() - timedelta(days=7),
        ))

    # ---- A little AI diagnostic history, so "recent activity" isn't empty ----
    import json
    db.add(models.AIDiagnosticSession(
        machine_id=by_code["M-006"].id,
        problem_description="Pump losing pressure and making gravel-like noise",
        questions_asked=json.dumps(["Is there unusual noise resembling gravel or rattling?"]),
        answers=json.dumps(["Yes, constant rattling at high flow"]),
        likely_causes=json.dumps([{"cause": "Air ingress / cavitation", "confidence": 45, "certainty": "possible"}]),
        recommended_action="Check suction strainer; inspect for air leaks; check impeller condition.",
        final_technician_result="Confirmed worn impeller, replaced.",
        source="offline",
        created_at=datetime.utcnow() - timedelta(days=3),
    ))
    db.add(models.AIDiagnosticSession(
        machine_id=by_code["M-008"].id,
        problem_description="Compressor tripping on high discharge temperature",
        questions_asked=json.dumps([]),
        answers=json.dumps([]),
        likely_causes=json.dumps([{"cause": "Cooler fouling / blockage", "confidence": 68, "certainty": "likely"}]),
        recommended_action="Check and clean intercooler/aftercooler fins; check oil level and condition.",
        final_technician_result=None,
        source="offline",
        created_at=datetime.utcnow() - timedelta(hours=6),
    ))

    db.commit()
    evaluate_all(db)
    db.close()
    print("Seed complete.")


if __name__ == "__main__":
    seed()
