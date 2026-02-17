"""Types for simulation replacements view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ReplacementViewItem(BaseModel):
    """A single replacement view item."""

    replacement_id: UUID
    improvement_id: UUID | None = None
    section: str | None = None
    replace_text: str | None = None
    idx: int | None = None
    created_at: datetime | None = None


class GetReplacementsRequest(BaseModel):
    """Request for getting replacements."""

    improvement_ids: list[UUID]


class GetReplacementsResponse(BaseModel):
    """Response for getting replacements."""

    items: list[ReplacementViewItem]
