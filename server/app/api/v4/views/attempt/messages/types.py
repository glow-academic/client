"""Types for attempt messages view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class HighlightItem(BaseModel):
    """Highlight within a strength."""

    section: str | None = None
    idx: int | None = None


class ReplacementItem(BaseModel):
    """Replacement within an improvement."""

    section: str | None = None
    replace_text: str | None = None
    idx: int | None = None


class StrengthItem(BaseModel):
    """Strength feedback for a message (id/message_id implied by parent)."""

    name: str | None = None
    description: str | None = None
    highlights: list[HighlightItem] | None = None


class ImprovementItem(BaseModel):
    """Improvement feedback for a message (id/message_id implied by parent)."""

    name: str | None = None
    description: str | None = None
    replacements: list[ReplacementItem] | None = None


class HintItem(BaseModel):
    """Hint for a message (practice-specific, message_id implied by parent)."""

    hint: str | None = None
    idx: int | None = None


class ContentItem(BaseModel):
    """Content item with persona_id only.

    Persona/profile metadata fetched via internal handlers in service layer.
    """

    content: str | None = None
    persona_id: UUID | None = None  # NULL for user messages, fetch metadata via handler
    created_at: datetime | None = None


class MessageViewItem(BaseModel):
    """Single message from the attempt messages view.

    Position derived in service layer, practice on attempt level.
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

    # Contents array with persona_id (metadata fetched via handler)
    contents: list[ContentItem] | None = None

    # Strengths and improvements (message_id implied)
    strengths: list[StrengthItem] | None = None
    improvements: list[ImprovementItem] | None = None

    # Hints (practice-specific, message_id implied)
    hints: list[HintItem] | None = None


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
