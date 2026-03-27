import io
import csv
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.deps import get_db
from app.models import Process

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/processes.csv")
def export_processes_csv(db: Session = Depends(get_db)):
    processes = db.query(Process).order_by(Process.code).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Code", "Naam", "Beschrijving", "Doelstelling", "Eigenaar", "Afdeling",
        "Kritiek", "Reden kritiek", "Laatste beoordeling",
        "BIA B-score", "BIA I-score", "BIA V-score",
        "RTO waarde", "RTO eenheid", "RPO waarde", "RPO eenheid",
        "Aantal applicaties",
    ])
    for p in processes:
        writer.writerow([
            p.code, p.name, p.description or "", p.objective or "",
            p.owner or "", p.department or "",
            "Ja" if p.is_critical else "Nee",
            p.critical_reason or "",
            p.last_assessment_date or "",
            p.bia.availability_score if p.bia else "",
            p.bia.integrity_score if p.bia else "",
            p.bia.confidentiality_score if p.bia else "",
            p.rto_rpo.rto_value if p.rto_rpo else "",
            p.rto_rpo.rto_unit if p.rto_rpo else "",
            p.rto_rpo.rpo_value if p.rto_rpo else "",
            p.rto_rpo.rpo_unit if p.rto_rpo else "",
            len(p.applications),
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=procescheck_export.csv"},
    )


@router.get("/processes.xlsx")
def export_processes_xlsx(db: Session = Depends(get_db)):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    processes = db.query(Process).order_by(Process.code).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Processen"
    headers = [
        "Code", "Naam", "Beschrijving", "Doelstelling", "Eigenaar", "Afdeling",
        "Kritiek", "Reden kritiek", "Laatste beoordeling",
        "BIV-B", "BIV-I", "BIV-V",
        "RTO waarde", "RTO eenheid", "RPO waarde", "RPO eenheid",
        "# Applicaties",
    ]
    header_fill = PatternFill("solid", fgColor="003366")
    header_font = Font(color="FFFFFF", bold=True)
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    for row, p in enumerate(processes, 2):
        ws.append([
            p.code, p.name, p.description or "", p.objective or "",
            p.owner or "", p.department or "",
            "Ja" if p.is_critical else "Nee",
            p.critical_reason or "",
            str(p.last_assessment_date) if p.last_assessment_date else "",
            p.bia.availability_score if p.bia else None,
            p.bia.integrity_score if p.bia else None,
            p.bia.confidentiality_score if p.bia else None,
            float(p.rto_rpo.rto_value) if p.rto_rpo and p.rto_rpo.rto_value else None,
            p.rto_rpo.rto_unit if p.rto_rpo else "",
            float(p.rto_rpo.rpo_value) if p.rto_rpo and p.rto_rpo.rpo_value else None,
            p.rto_rpo.rpo_unit if p.rto_rpo else "",
            len(p.applications),
        ])
    for col in ws.columns:
        max_len = max(len(str(c.value or "")) for c in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=procescheck_export.xlsx"},
    )
