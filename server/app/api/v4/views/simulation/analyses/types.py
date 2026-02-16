"""Types for simulation analyses view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AnalysisViewItem(BaseModel):
    """A single analysis view item."""

    analysis_id: UUID
    grade_id: UUID | None = None
    content: str | None = None
    created_at: datetime | None = None


class GetAnalysesRequest(BaseModel):
    """Request for getting analyses."""

    grade_ids: list[UUID]


class GetAnalysesResponse(BaseModel):
    """Response for getting analyses."""

    items: list[AnalysisViewItem]
