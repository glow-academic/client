"""Rubric PDF generation endpoint - v3 API."""

import io
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class StandardGroupMappingItem(BaseModel):
    name: str
    description: str
    points: float
    passPoints: float


class StandardMappingItem(BaseModel):
    name: str
    description: str
    points: float


class GradingState(BaseModel):
    achievedStandards: dict[str, bool]
    passedStandards: dict[str, bool]
    gradeDescription: str | None = None
    feedbackByStandardId: dict[str, str] | None = None


class RubricStructure(BaseModel):
    standardGroups: dict[str, list[str]]
    standardGroupsMapping: dict[str, StandardGroupMappingItem]
    standardsMapping: dict[str, StandardMappingItem]


class GenerateRubricPdfRequest(BaseModel):
    rubricStructure: RubricStructure
    gradingState: GradingState | None = None
    simulationName: str | None = None


router = APIRouter()


@router.post("/rubric")
async def generate_rubric_pdf(request: GenerateRubricPdfRequest) -> Response:
    """Generate a rubric PDF from provided rubric data."""
    try:
        from reportlab.lib import colors  # type: ignore
        from reportlab.lib.pagesizes import letter  # type: ignore
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # type: ignore
        from reportlab.lib.units import inch  # type: ignore
        from reportlab.platypus import (  # type: ignore
            Paragraph,
            SimpleDocTemplate,
            Table,
            TableStyle,
        )

        rs = request.rubricStructure
        gs = request.gradingState

        # Build grouped standards sorted by points descending (like TableRubric desktop)
        grouped_standards = []
        for group_id, standard_ids in rs.standardGroups.items():
            group_info = rs.standardGroupsMapping.get(group_id)
            sorted_ids = sorted(
                standard_ids,
                key=lambda sid: rs.standardsMapping.get(sid, StandardMappingItem(name="", description="", points=0)).points,
                reverse=True,
            )
            grouped_standards.append((group_id, group_info, sorted_ids))

        max_standards = max((len(sids) for _, _, sids in grouped_standards), default=0)

        if max_standards == 0:
            raise HTTPException(status_code=400, detail="No standards found in rubric")

        # Create PDF
        buffer = io.BytesIO()
        pdf_title = f"{request.simulationName} - Results" if request.simulationName else "Rubric"
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            title=pdf_title,
            leftMargin=0.5 * inch,
            rightMargin=0.5 * inch,
            topMargin=0.5 * inch,
            bottomMargin=0.5 * inch,
        )
        story: list[Any] = []
        styles = getSampleStyleSheet()

        cell_style = ParagraphStyle(
            "CellStyle",
            parent=styles["Normal"],
            fontSize=7,
            leading=9,
            spaceBefore=0,
            spaceAfter=0,
        )

        cell_style_bold = ParagraphStyle(
            "CellStyleBold",
            parent=cell_style,
            fontName="Helvetica-Bold",
        )

        header_cell_style = ParagraphStyle(
            "HeaderCellStyle",
            parent=cell_style_bold,
            textColor=colors.white,
        )

        feedback_style = ParagraphStyle(
            "FeedbackStyle",
            parent=cell_style,
            fontName="Helvetica-Oblique",
            fontSize=6,
            leading=8,
            textColor=colors.HexColor("#333333"),
        )

        # Build header row using first group's standards for level names
        first_group_ids = grouped_standards[0][2] if grouped_standards else []
        header_row = [Paragraph("<b>Criteria</b>", header_cell_style)]
        for i in range(max_standards):
            if i < len(first_group_ids):
                std = rs.standardsMapping.get(first_group_ids[i])
                label = f"{std.name} ({int(std.points)})" if std else ""
            else:
                label = ""
            header_row.append(Paragraph(f"<b>{label}</b>", header_cell_style))

        # Build data rows
        table_data = [header_row]
        # Track which cells to highlight: (row, col) -> color
        cell_colors: dict[tuple[int, int], Any] = {}

        for row_idx, (group_id, group_info, standard_ids) in enumerate(grouped_standards):
            data_row_idx = row_idx + 1  # +1 for header
            row = [Paragraph(group_info.name if group_info else "Unknown", cell_style_bold)]

            for col_idx in range(max_standards):
                if col_idx < len(standard_ids):
                    sid = standard_ids[col_idx]
                    std_info = rs.standardsMapping.get(sid)
                    if not std_info:
                        row.append(Paragraph("", cell_style))
                        continue

                    is_achieved = gs and gs.achievedStandards.get(sid, False) if gs else False
                    is_passed = gs and gs.passedStandards.get(sid, False) if gs else False

                    # Build cell content
                    parts = []
                    parts.append(Paragraph(std_info.description, cell_style))

                    if is_achieved and gs and gs.feedbackByStandardId:
                        feedback = gs.feedbackByStandardId.get(sid)
                        if feedback:
                            parts.append(Paragraph(f"<i>Feedback: {feedback}</i>", feedback_style))

                    # Use a list of flowables for cells with feedback
                    if len(parts) == 1:
                        row.append(parts[0])
                    else:
                        row.append(parts)

                    if is_achieved:
                        bg = colors.HexColor("#bbf7d0") if is_passed else colors.HexColor("#fecaca")
                        cell_colors[(data_row_idx, col_idx + 1)] = bg
                else:
                    row.append(Paragraph("", cell_style))

            table_data.append(row)

        # Column widths
        available_width = letter[0] - 1.0 * inch  # page width minus margins
        criteria_width = available_width * 0.20
        level_width = (available_width - criteria_width) / max_standards

        col_widths = [criteria_width] + [level_width] * max_standards

        table = Table(table_data, colWidths=col_widths, repeatRows=1)

        # Base table style
        style_commands: list[Any] = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("TOPPADDING", (0, 0), (-1, 0), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 7),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 1), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ]

        # Alternating row backgrounds
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                style_commands.append(
                    ("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f9fafb"))
                )

        # Highlighted achieved cells
        for (r, c), bg_color in cell_colors.items():
            style_commands.append(("BACKGROUND", (c, r), (c, r), bg_color))

        table.setStyle(TableStyle(style_commands))
        story.append(table)

        doc.build(story)
        buffer.seek(0)
        pdf_bytes = buffer.getvalue()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'inline; filename="rubric.pdf"',
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        )

    except ImportError:
        raise HTTPException(
            status_code=500, detail="PDF generation library not available"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to generate rubric PDF")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate rubric PDF: {str(e)}"
        ) from e
