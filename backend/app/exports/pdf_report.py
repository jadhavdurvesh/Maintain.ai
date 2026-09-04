"""Generates the PDF version of the maintenance report — same data as the
dashboard/reliability/failure-analysis endpoints, laid out for printing or
handing to a manager."""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from .. import models

HEADER_BG = colors.HexColor("#1f2733")
ACCENT = colors.HexColor("#4c8dff")


def _table(data, col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f6f8")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def build_pdf_report(db: Session) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=16 * mm, rightMargin=16 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleX", parent=styles["Title"], textColor=ACCENT)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], spaceBefore=14, spaceAfter=6)
    normal = styles["Normal"]

    story = [
        Paragraph("MAINTAIN AI", title_style),
        Paragraph("Maintenance & Reliability Report", styles["Heading3"]),
        Paragraph(f"Generated {datetime.utcnow().strftime('%d %b %Y, %H:%M UTC')}", normal),
        Spacer(1, 10),
    ]

    # --- Summary ---
    machines = db.query(models.Machine).all()
    open_wo = db.query(models.WorkOrder).filter(models.WorkOrder.status != models.WorkOrderStatus.completed).count()
    active_alerts = db.query(models.Alert).filter_by(resolved=False).count()
    summary_rows = [
        ["Metric", "Value"],
        ["Total machines", str(len(machines))],
        ["Healthy", str(sum(1 for m in machines if m.status == models.HealthStatus.healthy))],
        ["Needs attention", str(sum(1 for m in machines if m.status == models.HealthStatus.attention))],
        ["Critical", str(sum(1 for m in machines if m.status == models.HealthStatus.critical))],
        ["Open work orders", str(open_wo)],
        ["Active alerts", str(active_alerts)],
    ]
    story.append(Paragraph("Summary", h2))
    story.append(_table(summary_rows, col_widths=[100 * mm, 60 * mm]))

    # --- Reliability ---
    story.append(Paragraph("Machine Reliability", h2))
    rel_rows = [["Machine", "Faults", "Maint. Total", "Completed", "Completion %", "Health"]]
    for m in machines:
        faults = db.query(models.FaultRecord).filter_by(machine_id=m.id).count()
        records = db.query(models.MaintenanceRecord).filter_by(machine_id=m.id).all()
        completed = sum(1 for r in records if r.status == models.MaintenanceStatus.completed)
        rate = f"{round(completed / len(records) * 100, 1)}%" if records else "—"
        rel_rows.append([m.name, str(faults), str(len(records)), str(completed), rate, f"{m.health_score}/100"])
    story.append(_table(rel_rows, col_widths=[55 * mm, 20 * mm, 25 * mm, 22 * mm, 25 * mm, 20 * mm]))

    # --- Failure analysis ---
    faults = db.query(models.FaultRecord).all()
    if faults:
        from collections import Counter
        cause_counts = Counter((f.cause or "unspecified") for f in faults).most_common(10)
        story.append(Paragraph("Failure Analysis — Most Common Causes", h2))
        fa_rows = [["Cause", "Occurrences"]] + [[c, str(n)] for c, n in cause_counts]
        story.append(_table(fa_rows, col_widths=[120 * mm, 40 * mm]))

    # --- Active alerts ---
    alerts = db.query(models.Alert).filter_by(resolved=False).order_by(models.Alert.created_at.desc()).all()
    if alerts:
        story.append(Paragraph("Active Alerts", h2))
        alert_rows = [["Severity", "Message"]] + [[a.severity, a.message] for a in alerts]
        story.append(_table(alert_rows, col_widths=[25 * mm, 135 * mm]))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
