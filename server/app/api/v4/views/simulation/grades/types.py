"""Types for simulation grades view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GradeViewItem(BaseModel):
    """A single grade view item."""

    grade_id: UUID
    chat_id: UUID | None = None
    score: float | None = None
    passed: bool | None = None
    time_taken: int | None = None
    total_points: int | None = None
    pass_points: int | None = None
    rubric_id: UUID | None = None
    created_at: datetime | None = None


class GetGradesRequest(BaseModel):
    """Request for getting grades."""

    chat_ids: list[UUID]


class GetGradesResponse(BaseModel):
    """Response for getting grades."""

    items: list[GradeViewItem]
