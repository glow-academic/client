"""Types for attempt messages view (lean — no composites)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MessageViewItem(BaseModel):
    """Single message from the attempt messages view.

    Lean: entry attrs + resource IDs only. Composites (contents, strengths,
    improvements, hints, branch_path) fetched via simulation/* views.
    """

    # Primary key
    message_id: UUID

    # Foreign keys
    chat_id: UUID | None = None
    attempt_id: UUID | None = None

    # Message data (position derived in service layer)
    type: str | None = None  # 'query' or 'response'
    created_at: datetime | None = None
    completed: bool = False

    # Run resource ID (one hop to hydrate)
    runs_id: UUID | None = None

    # History content (for LLM context)
    history_content: str | None = None

    # Audio resource ID
    audio_id: UUID | None = None


class GetMessagesRequest(BaseModel):
    """Request for getting message data.

    Note: Practice filtering is done at attempt level, not here.
    """

    attempt_id: UUID = Field(description="Attempt ID to fetch messages for")


class GetMessagesResponse(BaseModel):
    """Response containing message data."""

    items: list[MessageViewItem] = Field(
        default_factory=list, description="Message data items"
    )
