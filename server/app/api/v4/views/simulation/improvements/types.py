"""Types for simulation improvements view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ImprovementViewItem(BaseModel):
    """A single improvement view item."""

    improvement_id: UUID
    message_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    created_at: datetime | None = None


class GetImprovementsRequest(BaseModel):
    """Request for getting improvements."""

    message_ids: list[UUID]


class GetImprovementsResponse(BaseModel):
    """Response for getting improvements."""

    items: list[ImprovementViewItem]
