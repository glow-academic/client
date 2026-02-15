"""Types for activity list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ActivityViewItem(BaseModel):
    """Single activity from the activity list view."""

    activity_id: UUID
    profile_id: UUID | None = None
    session_id: UUID | None = None
    last_active: datetime | None = None
    created_at: datetime | None = None


class GetActivityListViewResponse(BaseModel):
    """Response containing activity list data."""

    items: list[ActivityViewItem] = Field(
        default_factory=list, description="Activity data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
