"""Types for simulation messages view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class MessageViewItem(BaseModel):
    """A single message view item."""

    message_id: UUID
    chat_id: UUID | None = None
    attempt_id: UUID | None = None
    type: str | None = None
    created_at: datetime | None = None
    completed: bool = False
    runs_id: UUID | None = None
    text_id: UUID | None = None
    audio_id: UUID | None = None
    history_content: str | None = None


class GetMessagesRequest(BaseModel):
    """Request for getting messages."""

    attempt_id: UUID


class GetMessagesResponse(BaseModel):
    """Response for getting messages."""

    items: list[MessageViewItem]
