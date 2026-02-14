"""Document certificate generation endpoint - v4 API following DHH principles."""

import io
import os
import subprocess
import tempfile
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.views.attempt.chats.get import get_attempt_chats_internal
from app.api.v4.views.attempt.list.get import get_attempt_list_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.main import get_db, get_pool
from app.sql.types import (
    GetCertificateDataApiRequest,
    GetCertificateDataSqlParams,
    GetCertificateDataSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/documents/get_certificate_data_complete.sql"


@dataclass
class SimulationResult:
    """Simulation result for certificate rendering."""

    name: str
    score: int
    passed: bool


@dataclass
class CohortResult:
    """Cohort result for certificate rendering."""

    name: str
    passed: bool
    simulations: list[SimulationResult] = field(default_factory=list)


async def _compute_certificate_scores(
    conn: asyncpg.Connection,
    profile_id: UUID,
    structure_rows: list[GetCertificateDataSqlRow],
) -> list[CohortResult]:
    """Compute certificate scores using attempt view internals.

    Fetches attempt/chat data via view internal APIs, computes per-simulation
    scores, and builds cohort/simulation results for rendering.
    """
    if not structure_rows:
        return []

    # Extract simulation_ids and build lookup maps
    simulation_ids = list(
        {row.simulation_id for row in structure_rows if row.simulation_id}
    )
    expected_scenarios: dict[UUID, int] = {}
    pass_thresholds: dict[UUID, float] = {}
    for row in structure_rows:
        if row.simulation_id:
            expected_scenarios[row.simulation_id] = row.expected_scenarios or 0
            pass_thresholds[row.simulation_id] = float(row.pass_threshold_percent or 70)

    # Fetch non-practice, non-archived attempts for this profile
    attempts_response = await get_attempt_list_internal(
        conn=conn,
        profile_id_filter=profile_id,
        practice_filter=False,
        is_archived_filter=False,
        page_limit=10000,
        bypass_cache=True,
    )

    # Filter to only relevant simulations
    relevant_attempts = [
        a
        for a in attempts_response.items
        if a.simulation_id and a.simulation_id in simulation_ids
    ]

    # Fetch chats for those attempts
    chats = []
    if relevant_attempts:
        attempt_ids = [a.attempt_id for a in relevant_attempts]
        chats = await get_attempt_chats_internal(
            conn=conn,
            attempt_ids=attempt_ids,
            bypass_cache=True,
        )

    # Map attempt_id -> simulation_id
    sim_by_attempt: dict[UUID, UUID] = {}
    for a in relevant_attempts:
        if a.simulation_id:
            sim_by_attempt[a.attempt_id] = a.simulation_id

    # Group chats by attempt_id
    chats_by_attempt: dict[UUID, list[Any]] = defaultdict(list)
    for chat in chats:
        if chat.attempt_id:
            chats_by_attempt[chat.attempt_id].append(chat)

    # Compute per-attempt, per-simulation scores
    # For each attempt: sum grade_score of completed chats / expected_scenarios
    sim_attempt_scores: dict[UUID, list[float]] = defaultdict(list)
    for attempt_id, attempt_chats in chats_by_attempt.items():
        sim_id = sim_by_attempt.get(attempt_id)
        if not sim_id:
            continue
        sum_completed_pct = sum(
            (chat.grade.score or 0)
            for chat in attempt_chats
            if chat.completed and chat.grade and chat.grade.score is not None
        )
        expected = expected_scenarios.get(sim_id, 0)
        avg_pct = sum_completed_pct / expected if expected > 0 else 0
        sim_attempt_scores[sim_id].append(avg_pct)

    # Per simulation: best attempt score and pass check
    sim_results: dict[UUID, tuple[int, bool]] = {}
    for sim_id, scores in sim_attempt_scores.items():
        best = max(scores) if scores else 0
        threshold = pass_thresholds.get(sim_id, 70)
        passed = any(s >= threshold for s in scores)
        sim_results[sim_id] = (round(best), passed)

    # Build cohort -> simulation nested structure
    cohort_map: dict[UUID, CohortResult] = {}
    cohort_order: list[UUID] = []
    for row in structure_rows:
        cid = row.cohort_id
        if not cid:
            continue
        if cid not in cohort_map:
            cohort_map[cid] = CohortResult(
                name=row.cohort_name or "Unknown Cohort",
                passed=False,
                simulations=[],
            )
            cohort_order.append(cid)

        sim_id = row.simulation_id
        if sim_id:
            score, passed = sim_results.get(sim_id, (0, False))
            cohort_map[cid].simulations.append(
                SimulationResult(
                    name=row.simulation_name or "Unknown Simulation",
                    score=score,
                    passed=passed,
                )
            )

    # Determine cohort pass status
    for cohort in cohort_map.values():
        cohort.passed = (
            all(s.passed for s in cohort.simulations) if cohort.simulations else False
        )

    # Sort by cohort name
    return sorted(cohort_map.values(), key=lambda c: c.name)


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

        # Fetch user context for audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
        else:
            actor_name = None

        # Fetch cohort/simulation structure from SQL (flat rows)
        params = GetCertificateDataSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        structure_rows = cast(
            list[GetCertificateDataSqlRow],
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
                multi_row=True,
            ),
        )

        if not structure_rows:
            raise HTTPException(
                status_code=404, detail="Profile not found or no cohort data available"
            )

        profile_name = structure_rows[0].profile_name or "Unknown"

        # Compute scores via attempt view internals
        cohorts = await _compute_certificate_scores(conn, profile_id, structure_rows)

        # Set audit context
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                document={"name": "Certificate", "id": ""},
            )

        # Try to generate PDF using reportlab
        try:
            # Drawing and Rect not used, removed to fix F401
            from reportlab.lib import colors  # type: ignore
            from reportlab.lib.pagesizes import letter  # type: ignore
            from reportlab.lib.styles import (
                ParagraphStyle,  # type: ignore
                getSampleStyleSheet,  # type: ignore
            )
            from reportlab.lib.units import inch  # type: ignore
            from reportlab.platypus import (
                Frame,  # type: ignore
                PageTemplate,  # type: ignore
                Paragraph,  # type: ignore
                SimpleDocTemplate,  # type: ignore
                Spacer,  # type: ignore
                Table,  # type: ignore
                TableStyle,  # type: ignore
            )

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
