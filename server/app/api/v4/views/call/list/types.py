"""Types for call list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CallViewItem(BaseModel):
    """Single call from the call list view."""

    call_id: UUID
    run_id: UUID | None = None
    call_created_at: datetime | None = None
    arguments_raw: str | None = None
    tool_id: UUID | None = None


class GetCallListViewResponse(BaseModel):
    """Response containing call list data."""

    items: list[CallViewItem] = Field(
        default_factory=list, description="Call data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
