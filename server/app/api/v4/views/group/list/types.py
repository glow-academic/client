"""Types for group list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class GroupViewItem(BaseModel):
    """Single group from the group list view."""

    group_id: UUID
    session_id: UUID | None = None
    group_created_at: datetime | None = None
    trace_id: str | None = None
    group_name: str | None = None
    active: bool = False


class GetGroupListViewResponse(BaseModel):
    """Response containing group list data."""

    items: list[GroupViewItem] = Field(
        default_factory=list, description="Group data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
