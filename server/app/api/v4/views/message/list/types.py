"""Types for message list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MessageViewItem(BaseModel):
    """Single message from the message list view."""

    message_id: UUID
    run_id: UUID | None = None
    role: str | None = None
    message_created_at: datetime | None = None
    contents: list[str] = Field(default_factory=list)
    call_ids: list[UUID] = Field(default_factory=list)


class GetMessageListViewResponse(BaseModel):
    """Response containing message list data."""

    items: list[MessageViewItem] = Field(
        default_factory=list, description="Message data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
