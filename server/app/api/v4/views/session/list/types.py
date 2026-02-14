"""Types for session list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SessionViewItem(BaseModel):
    """Single session from the session list view."""

    session_id: UUID
    profile_id: UUID | None = None
    session_created_at: datetime | None = None
    active: bool = False


class GetSessionListViewResponse(BaseModel):
    """Response containing session list data."""

    items: list[SessionViewItem] = Field(
        default_factory=list, description="Session data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
