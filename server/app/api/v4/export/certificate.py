"""Document certificate generation endpoint - v4 API following DHH principles."""

import io
import os
import subprocess
import tempfile
import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.main import get_db
from app.sql.types import (GetCertificateDataApiRequest,
                           GetCertificateDataSqlParams,
                           GetCertificateDataSqlRow)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

logger = get_logger(__name__)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/documents/get_certificate_data_complete.sql"


router = APIRouter()


@router.post(
    "/certificate",
    dependencies=[
        audit_activity(
            "document.certificate",
            "{{ actor.name }} generated certificate for document '{{ document.name }}'",
        )
    ],
)
async def export_certificate(
    request: GetCertificateDataApiRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Response:
    """Generate a certificate PDF/text for a profile."""
    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        params = GetCertificateDataSqlParams(
            **request.model_dump(), profile_id=profile_id
        )

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            GetCertificateDataSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result or not result.profile_name:
            raise HTTPException(
                status_code=404, detail="Profile not found or no cohort data available"
            )

        # Parse JSON response
        profile_name = result.profile_name
        actor_name = result.actor_name

        # Set audit context
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                document={"name": "Certificate", "id": ""},
            )
        # cohorts is already parsed by execute_sql_typed as list[QGetCertificateDataV3Cohort]
        cohorts = result.cohorts or []

        # Try to generate PDF using reportlab
        try:
            # Drawing and Rect not used, removed to fix F401
            from reportlab.lib import colors  # type: ignore
            from reportlab.lib.pagesizes import letter  # type: ignore
            from reportlab.lib.styles import ParagraphStyle  # type: ignore
            from reportlab.lib.styles import \
                getSampleStyleSheet  # type: ignore
            from reportlab.lib.units import inch  # type: ignore
            from reportlab.platypus import Frame  # type: ignore
            from reportlab.platypus import PageTemplate  # type: ignore
            from reportlab.platypus import Paragraph  # type: ignore
            from reportlab.platypus import SimpleDocTemplate  # type: ignore
            from reportlab.platypus import Spacer  # type: ignore
            from reportlab.platypus import Table  # type: ignore
            from reportlab.platypus import TableStyle  # type: ignore

            # Create PDF in memory
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                leftMargin=0.5 * inch,
                rightMargin=0.5 * inch,
                topMargin=0.5 * inch,
                bottomMargin=0.5 * inch,
            )
            story = []

            # Create content frame
            content_frame = Frame(
                doc.leftMargin + 0.2 * inch,
                doc.bottomMargin + 0.2 * inch,
                doc.width - 0.4 * inch,
                doc.height - 0.4 * inch,
                leftPadding=0.1 * inch,
                bottomPadding=0.1 * inch,
                rightPadding=0.1 * inch,
                topPadding=0.1 * inch,
                showBoundary=1,
            )

            # Get styles
            styles = getSampleStyleSheet()

            # Create custom styles
            title_style = ParagraphStyle(
                "CustomTitle",
                parent=styles["Heading1"],
                fontSize=24,
                spaceAfter=30,
                alignment=1,
                textColor=colors.darkblue,
            )

            name_style = ParagraphStyle(
                "NameStyle",
                parent=styles["Heading2"],
                fontSize=28,
                spaceAfter=20,
                alignment=1,
                textColor=colors.black,
            )

            status_style = ParagraphStyle(
                "StatusStyle",
                parent=styles["Heading2"],
                fontSize=20,
                spaceAfter=30,
                alignment=1,
                fontWeight="bold",
            )

            header_style = ParagraphStyle(
                "HeaderStyle",
                parent=styles["Heading3"],
                fontSize=14,
                spaceAfter=10,
                textColor=colors.darkblue,
            )

            # Add title
            story.append(Paragraph("Certificate of Completion", title_style))
            story.append(Spacer(1, 10))

            # Add profile name
            story.append(Paragraph(profile_name, name_style))
            story.append(Spacer(1, 30))

            # Calculate overall status
            total_cohorts = len(cohorts)
            passed_cohorts = sum(1 for cohort in cohorts if cohort.passed)
            all_passed = passed_cohorts == total_cohorts and total_cohorts > 0

            # Add status
            if all_passed:
                status_text = "COMPLETE"
                status_color = colors.green
            else:
                status_text = "INCOMPLETE"
                status_color = colors.red

            status_style.textColor = status_color
            story.append(Paragraph(status_text, status_style))
            story.append(Spacer(1, 30))

            # Add progress summary
            summary_text = (
                f"Progress: {passed_cohorts} of {total_cohorts} cohorts completed"
            )
            story.append(Paragraph(summary_text, styles["Normal"]))
            story.append(Spacer(1, 20))

            # Add cohort details
            if cohorts:
                story.append(Paragraph("Cohort Progress", header_style))

                # Helper function to truncate text for table cells
                def truncate_text(text: str, max_length: int = 24) -> str:
                    """Truncate text to max_length and add ellipsis if needed."""
                    if len(text) <= max_length:
                        return text
                    return text[: max_length - 3] + "..."

                # Create table data
                table_data = [["Cohort", "Simulation", "Score", "Status"]]

                for cohort in cohorts:
                    cohort_name = cohort.name or "Unknown Cohort"
                    simulations = cohort.simulations or []

                    # Truncate cohort name to prevent overlap (max 20 chars for 1.8 inch column)
                    truncated_cohort_name = truncate_text(cohort_name)

                    for sim in simulations:
                        sim_name = sim.name or "Unknown Simulation"
                        score = sim.score or 0
                        passed = sim.passed or False

                        # Ensure score is whole number (round to nearest integer)
                        score_int = int(round(float(score))) if score > 0 else 0
                        score_text = f"{score_int}%" if score_int > 0 else "No attempts"
                        status_text = (
                            "PASS"
                            if passed
                            else "FAIL"
                            if score_int > 0
                            else "Not attempted"
                        )

                        table_data.append(
                            [truncated_cohort_name, sim_name, score_text, status_text]
                        )

                # Create table
                table = Table(
                    table_data, colWidths=[1.8 * inch, 2.5 * inch, 1 * inch, 1 * inch]
                )
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.darkblue),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, 0), 11),
                            ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                            ("BACKGROUND", (0, 1), (-1, -1), colors.lightblue),
                            ("GRID", (0, 0), (-1, -1), 1, colors.darkblue),
                            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                            ("FONTSIZE", (0, 1), (-1, -1), 9),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                            ("WORDWRAP", (0, 0), (-1, -1), True),
                            ("LEFTPADDING", (0, 0), (-1, -1), 6),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                            ("TOPPADDING", (0, 0), (-1, -1), 4),
                            ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
                        ]
                    )
                )

                story.append(table)
                story.append(Spacer(1, 30))

            # Custom page template with decorative border
            def certificate_page(canvas: Any, doc: Any) -> None:  # type: ignore  # noqa: ANN401
                # Draw outer border
                canvas.setStrokeColor(colors.darkblue)
                canvas.setLineWidth(3)
                canvas.rect(
                    doc.leftMargin + 0.1 * inch,
                    doc.bottomMargin + 0.1 * inch,
                    doc.width - 0.2 * inch,
                    doc.height - 0.2 * inch,
                )

                # Draw inner border
                canvas.setLineWidth(1)
                canvas.rect(
                    doc.leftMargin + 0.2 * inch,
                    doc.bottomMargin + 0.2 * inch,
                    doc.width - 0.4 * inch,
                    doc.height - 0.4 * inch,
                )

                # Draw corner decorations
                canvas.setFillColor(colors.lightblue)
                corner_size = 0.15 * inch
                for x, y in [
                    (
                        doc.leftMargin + 0.1 * inch,
                        doc.bottomMargin + doc.height - 0.25 * inch,
                    ),
                    (
                        doc.leftMargin + doc.width - 0.25 * inch,
                        doc.bottomMargin + doc.height - 0.25 * inch,
                    ),
                    (doc.leftMargin + 0.1 * inch, doc.bottomMargin + 0.1 * inch),
                    (
                        doc.leftMargin + doc.width - 0.25 * inch,
                        doc.bottomMargin + 0.1 * inch,
                    ),
                ]:
                    canvas.rect(x, y, corner_size, corner_size, fill=1)

                # Add branding
                canvas.setFont("Helvetica", 10)
                canvas.setFillColor(colors.darkblue)
                canvas.drawString(
                    doc.leftMargin + 0.3 * inch,
                    doc.bottomMargin + 0.3 * inch,
                    "GLOW | Purdue University",
                )

            page_template = PageTemplate(
                id="certificate", frames=[content_frame], onPage=certificate_page
            )
            doc.addPageTemplates([page_template])
            doc.build(story)
            buffer.seek(0)
            original_pdf_bytes = buffer.getvalue()
            pdf_bytes_to_return = original_pdf_bytes

            # Try PDF/A conversion with Ghostscript (best-effort)
            try:

                def find_srgb_icc() -> str | None:
                    candidate_paths = [
                        "/usr/share/color/icc/ghostscript/srgb.icc",
                        "/usr/share/color/icc/srgb.icc",
                        "/usr/share/icc/colord/sRGB.icc",
                        "/usr/share/ghostscript/iccprofiles/srgb.icc",
                        "/usr/share/ghostscript/10.00.0/iccprofiles/srgb.icc",
                        "/usr/share/ghostscript/9.56.1/iccprofiles/srgb.icc",
                    ]
                    for path in candidate_paths:
                        if os.path.exists(path):
                            return path
                    return None

                srgb_icc = find_srgb_icc()

                with (
                    tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as in_file,
                    tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as out_file,
                ):
                    in_file.write(original_pdf_bytes)
                    in_file.flush()

                    gs_cmd = [
                        "gs",
                        "-dBATCH",
                        "-dNOPAUSE",
                        "-sDEVICE=pdfwrite",
                        "-dPDFSETTINGS=/prepress",
                        "-sProcessColorModel=DeviceRGB",
                        "-sColorConversionStrategy=sRGB",
                        "-dUseCIEColor",
                        "-dPDFA=2",
                        "-dPDFACompatibilityPolicy=1",
                        f"-sOutputFile={out_file.name}",
                    ]

                    if srgb_icc:
                        gs_cmd.append(f"-sOutputICCProfile={srgb_icc}")

                    gs_cmd.append(in_file.name)

                    proc = subprocess.run(gs_cmd, capture_output=True, text=True)
                    if (
                        proc.returncode == 0
                        and os.path.exists(out_file.name)
                        and os.path.getsize(out_file.name) > 0
                    ):
                        with open(out_file.name, "rb") as f_out:
                            pdf_bytes_to_return = f_out.read()
                    else:
                        logger.warning(
                            "Ghostscript PDF/A conversion failed; returning original PDF. stderr=%s",
                            proc.stderr,
                        )
            except FileNotFoundError:
                logger.info("Ghostscript not found; returning non-PDF/A PDF")
            except Exception as conv_err:
                logger.warning(
                    "PDF/A conversion error; returning original PDF: %s", str(conv_err)
                )

            # Generate filename
            filename = f"certificate_{profile_name.replace(' ', '_')}_{uuid.uuid4().hex[:8]}.pdf"

            headers = {
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }

            return Response(
                content=pdf_bytes_to_return,
                media_type="application/pdf",
                headers=headers,
            )

        except ImportError:
            # Fallback to text if reportlab not available
            logger.warning("ReportLab not available, using simple text generation")

            text_content = []
            text_content.append("Certificate of Completion")
            text_content.append("=" * 30)
            text_content.append("")
            text_content.append(f"Name: {profile_name}")
            text_content.append("")

            total_cohorts = len(cohorts)
            passed_cohorts = sum(1 for cohort in cohorts if cohort.passed)
            all_passed = passed_cohorts == total_cohorts and total_cohorts > 0

            text_content.append(f"Status: {'COMPLETE' if all_passed else 'INCOMPLETE'}")
            text_content.append(
                f"Progress: {passed_cohorts} of {total_cohorts} cohorts completed"
            )
            text_content.append("")

            text_content.append("Cohort Progress:")
            text_content.append("-" * 20)

            for cohort in cohorts:
                cohort_name = cohort.name or "Unknown Cohort"
                simulations = cohort.simulations or []

                text_content.append(f"\n{cohort_name}:")
                for sim in simulations:
                    sim_name = sim.name or "Unknown Simulation"
                    score = sim.score or 0
                    passed = sim.passed or False

                    # Ensure score is whole number (round to nearest integer)
                    score_int = int(round(float(score))) if score > 0 else 0
                    score_text = f"{score_int}%" if score_int > 0 else "No attempts"
                    status_text = (
                        "PASS"
                        if passed
                        else "FAIL"
                        if score_int > 0
                        else "Not attempted"
                    )

                    text_content.append(f"  - {sim_name}: {score_text} ({status_text})")

            text_content.append("")
            text_content.append("GLOW | Purdue University")

            filename = f"certificate_{profile_name.replace(' ', '_')}_{uuid.uuid4().hex[:8]}.txt"

            headers = {
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }

            return Response(
                content="\n".join(text_content).encode("utf-8"),
                media_type="text/plain",
                headers=headers,
            )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate certificate: {str(e)}"
        ) from e
