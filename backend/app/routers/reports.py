import csv
import io
from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..exports.pdf_report import build_pdf_report
from ..exports.excel_report import build_excel_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dashboard", response_model=schemas.DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    machines = db.query(models.Machine).all()
    return schemas.DashboardSummary(
        total_machines=len(machines),
        healthy=sum(1 for m in machines if m.status == models.HealthStatus.healthy),
        attention=sum(1 for m in machines if m.status == models.HealthStatus.attention),
        critical=sum(1 for m in machines if m.status == models.HealthStatus.critical),
        open_work_orders=db.query(models.WorkOrder)
            .filter(models.WorkOrder.status != models.WorkOrderStatus.completed).count(),
        upcoming_maintenance=db.query(models.MaintenanceRecord)
            .filter(models.MaintenanceRecord.status == models.MaintenanceStatus.scheduled).count(),
        active_alerts=db.query(models.Alert).filter_by(resolved=False).count(),
    )


@router.get("/reliability")
def reliability_report(db: Session = Depends(get_db)):
    """Failure counts and completion stats per machine — feeds the
    'Most Frequently Failing Machines' and 'Maintenance Completion Rate' dashboard sections."""
    machines = db.query(models.Machine).all()
    rows = []
    for m in machines:
        faults = db.query(models.FaultRecord).filter_by(machine_id=m.id).count()
        records = db.query(models.MaintenanceRecord).filter_by(machine_id=m.id).all()
        completed = sum(1 for r in records if r.status == models.MaintenanceStatus.completed)
        rows.append({
            "machine_id": m.id,
            "machine_code": m.machine_code,
            "name": m.name,
            "fault_count": faults,
            "maintenance_total": len(records),
            "maintenance_completed": completed,
            "completion_rate": round(completed / len(records) * 100, 1) if records else None,
            "health_score": m.health_score,
        })
    return sorted(rows, key=lambda r: r["fault_count"], reverse=True)


@router.get("/failure-analysis")
def failure_analysis(db: Session = Depends(get_db)):
    faults = db.query(models.FaultRecord).all()
    cause_counts = Counter((f.cause or "unspecified") for f in faults)
    return {
        "total_faults": len(faults),
        "most_common_causes": cause_counts.most_common(10),
    }


@router.get("/recent-faults")
def recent_faults(limit: int = 6, db: Session = Depends(get_db)):
    faults = (
        db.query(models.FaultRecord)
        .order_by(models.FaultRecord.reported_date.desc())
        .limit(limit)
        .all()
    )
    machines = {m.id: m for m in db.query(models.Machine).all()}
    return [
        {
            "id": f.id,
            "machine_name": machines[f.machine_id].name if f.machine_id in machines else "Unknown",
            "description": f.description,
            "cause": f.cause,
            "severity": f.severity,
            "reported_date": f.reported_date,
            "resolved": f.resolved_date is not None,
        }
        for f in faults
    ]


@router.get("/recent-activity")
def recent_activity(limit: int = 6, db: Session = Depends(get_db)):
    """Recently completed work orders and maintenance — the spec's
    'Recent Technician Activities' dashboard section."""
    machines = {m.id: m for m in db.query(models.Machine).all()}
    events = []

    completed_wos = (
        db.query(models.WorkOrder)
        .filter(models.WorkOrder.status == models.WorkOrderStatus.completed)
        .order_by(models.WorkOrder.completed_at.desc())
        .limit(limit)
        .all()
    )
    for wo in completed_wos:
        events.append({
            "type": "work_order",
            "machine_name": machines[wo.machine_id].name if wo.machine_id in machines else "Unknown",
            "description": f"Work order resolved: {wo.problem}",
            "performed_by": wo.assigned_to,
            "timestamp": wo.completed_at,
        })

    completed_maint = (
        db.query(models.MaintenanceRecord)
        .filter(models.MaintenanceRecord.status == models.MaintenanceStatus.completed)
        .order_by(models.MaintenanceRecord.completed_date.desc())
        .limit(limit)
        .all()
    )
    for r in completed_maint:
        events.append({
            "type": "maintenance",
            "machine_name": machines[r.machine_id].name if r.machine_id in machines else "Unknown",
            "description": f"{r.type.value.title()} maintenance: {r.description or r.type.value}",
            "performed_by": r.performed_by,
            "timestamp": r.completed_date,
        })

    events.sort(key=lambda e: e["timestamp"] or datetime.min, reverse=True)
    return events[:limit]


@router.get("/export/csv")
def export_machines_csv(db: Session = Depends(get_db)):
    machines = db.query(models.Machine).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "machine_code", "name", "category", "location", "department",
        "operating_hours", "health_score", "status", "criticality",
    ])
    for m in machines:
        writer.writerow([
            m.machine_code, m.name, m.category, m.location, m.department,
            m.operating_hours, m.health_score, m.status, m.criticality,
        ])
    buffer.seek(0)
    filename = f"machines_export_{datetime.utcnow().date()}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/pdf")
def export_pdf(db: Session = Depends(get_db)):
    pdf_bytes = build_pdf_report(db)
    filename = f"maintain_ai_report_{datetime.utcnow().date()}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/excel")
def export_excel(db: Session = Depends(get_db)):
    xlsx_bytes = build_excel_report(db)
    filename = f"maintain_ai_report_{datetime.utcnow().date()}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
