"""Document certificate generation endpoint - v4 API following DHH principles."""

import asyncio
import io
import os
import subprocess
import tempfile
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.entries.chat.get import get_chats_internal
from app.api.v4.resources.cohorts.get import get_cohorts_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.main import get_db, get_pool
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


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
    pool: asyncpg.Pool,
    profile_id: UUID,
) -> tuple[str, list[CohortResult]]:
    """Compute certificate scores using MV + resource hydration pattern.

    Pass 1: Fetch chat-grain rows from mv_profile_facts.
    Pass 2: Hydrate cohort/simulation/profile resources in parallel.
    Compute scores from MV data and build CohortResult/SimulationResult.

    Returns (profile_name, cohort_results).
    """
    # Pass 1 — MV fetch
    async with pool.acquire() as conn:
        facts = await get_chats_internal(
            conn=conn,
            profile_id=profile_id,
            attempt_type="general",
            is_archived=False,
            bypass_cache=True,
        )

    if not facts.items:
        return "Unknown", []

    # Extract unique IDs from MV items
    cohort_ids = list({item.cohort_id for item in facts.items if item.cohort_id})
    simulation_ids = list({item.simulation_id for item in facts.items})

    # Pass 2 — Parallel resource hydration (each gets its own connection)
    async def fetch_profiles(ids: list[UUID]) -> list[Any]:
        async with pool.acquire() as conn:
            return await get_profiles_internal(conn=conn, ids=ids)

    async def fetch_cohorts(ids: list[UUID]) -> list[Any]:
        async with pool.acquire() as conn:
            return await get_cohorts_internal(conn=conn, ids=ids)

    async def fetch_simulations(ids: list[UUID]) -> list[Any]:
        async with pool.acquire() as conn:
            return await get_simulations_internal(conn=conn, ids=ids)

    profiles, cohorts, simulations = await asyncio.gather(
        fetch_profiles([profile_id]),
        fetch_cohorts(cohort_ids),
        fetch_simulations(simulation_ids),
    )

    # Get profile name
    profile_name = profiles[0].name if profiles and profiles[0].name else "Unknown"

    # Filter by active cohorts/simulations
    active_cohort_ids = {c.cohort_id for c in cohorts if c.active}
    active_simulation_ids = {s.simulation_id for s in simulations if s.active}
    relevant_items = [
        item
        for item in facts.items
        if item.cohort_id in active_cohort_ids
        and item.simulation_id in active_simulation_ids
    ]

    if not relevant_items:
        return profile_name, []

    # Build lookup maps for names
    cohort_names: dict[UUID, str] = {
        c.cohort_id: c.title or "Unknown Cohort"
        for c in cohorts
        if c.cohort_id and c.active
    }
    simulation_names: dict[UUID, str] = {
        s.simulation_id: s.name or "Unknown Simulation"
        for s in simulations
        if s.simulation_id and s.active
    }

    # Group by (attempt_id, simulation_id) — each group = one attempt's chats for a simulation
    attempt_sim_chats: dict[tuple[UUID, UUID], list[Any]] = defaultdict(list)
    for item in relevant_items:
        attempt_sim_chats[(item.attempt_id, item.simulation_id)].append(item)

    # Per attempt score = sum(grade_percent of completed chats) / count(all chats in group)
    # Incomplete chats contribute 0 to numerator, 1 to denominator
    sim_attempt_scores: dict[UUID, list[float]] = defaultdict(list)
    sim_attempt_passed: dict[UUID, list[bool]] = defaultdict(list)

    for (_attempt_id, sim_id), chats in attempt_sim_chats.items():
        total_chats = len(chats)
        sum_grade = sum(
            (chat.grade_percent or 0)
            for chat in chats
            if chat.completed and chat.grade_percent is not None
        )
        avg_pct = sum_grade / total_chats if total_chats > 0 else 0
        sim_attempt_scores[sim_id].append(avg_pct)

        # An attempt passes if ALL chats have passed=True
        all_passed = all(chat.passed is True for chat in chats)
        sim_attempt_passed[sim_id].append(all_passed)

    # Per simulation: best attempt score and pass check
    sim_results: dict[UUID, tuple[int, bool]] = {}
    for sim_id in set(
        list(sim_attempt_scores.keys()) + list(sim_attempt_passed.keys())
    ):
        scores = sim_attempt_scores.get(sim_id, [])
        best = max(scores) if scores else 0
        passed = any(sim_attempt_passed.get(sim_id, []))
        sim_results[sim_id] = (round(best), passed)

    # Build cohort -> simulation nested structure
    # Track which simulations belong to which cohorts
    cohort_sim_ids: dict[UUID, set[UUID]] = defaultdict(set)
    for item in relevant_items:
        if item.cohort_id:
            cohort_sim_ids[item.cohort_id].add(item.simulation_id)

    cohort_results: list[CohortResult] = []
    for cohort_id in sorted(
        cohort_sim_ids.keys(), key=lambda cid: cohort_names.get(cid, "")
    ):
        sims = []
        for sim_id in cohort_sim_ids[cohort_id]:
            score, passed = sim_results.get(sim_id, (0, False))
            sims.append(
                SimulationResult(
                    name=simulation_names.get(sim_id, "Unknown Simulation"),
                    score=score,
                    passed=passed,
                )
            )
        cohort_passed = all(s.passed for s in sims) if sims else False
        cohort_results.append(
            CohortResult(
                name=cohort_names.get(cohort_id, "Unknown Cohort"),
                passed=cohort_passed,
                simulations=sims,
            )
        )

    return profile_name, cohort_results


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

        if not pool:
            raise HTTPException(status_code=500, detail="Database pool not available")

        # Compute scores via MV + resource hydration
        profile_name, cohorts = await _compute_certificate_scores(pool, profile_id)

        if not cohorts:
            raise HTTPException(
                status_code=404, detail="Profile not found or no cohort data available"
            )

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
