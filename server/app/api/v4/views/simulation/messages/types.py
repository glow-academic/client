"""Types for simulation messages view."""

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
    """Strength feedback for a message."""

    id: UUID
    message_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    highlights: list[HighlightItem] | None = None


class ImprovementItem(BaseModel):
    """Improvement feedback for a message."""

    id: UUID
    message_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    replacements: list[ReplacementItem] | None = None


class HintItem(BaseModel):
    """Hint for a message (practice-specific)."""

    message_id: UUID | None = None
    hint: str | None = None
    idx: int | None = None


class ContentItem(BaseModel):
    """Content item within a message with persona info."""

    id: UUID
    content: str | None = None
    persona_id: UUID | None = None
    persona_name: str | None = None
    persona_color: str | None = None
    persona_icon: str | None = None
    created_at: datetime | None = None


class MessageViewItem(BaseModel):
    """Single message from the simulation messages view."""

    # Primary key
    message_id: UUID

    # Foreign keys
    chat_id: UUID | None = None
    attempt_id: UUID | None = None

    # Practice flag
    practice: bool = False

    # Message data
    content: str | None = None  # First content for backward compatibility
    type: str | None = None  # 'query' or 'response'
    created_at: datetime | None = None
    completed: bool = False
    message_position: int | None = None

    # Contents array with persona info
    contents: list[ContentItem] | None = None

    # Strengths and improvements
    strengths: list[StrengthItem] | None = None
    improvements: list[ImprovementItem] | None = None

    # Hints (practice-specific)
    hints: list[HintItem] | None = None


class GetMessagesRequest(BaseModel):
    """Request for getting message data."""

    attempt_id: UUID | None = Field(
        default=None, description="Filter by attempt ID"
    )
    chat_id: UUID | None = Field(
        default=None, description="Filter by chat ID"
    )
    message_ids: list[UUID] | None = Field(
        default=None, description="List of specific message IDs to fetch"
    )
    practice: bool | None = Field(
        default=None,
        description="Filter by practice mode. None=all, True=practice, False=home",
    )


class GetMessagesResponse(BaseModel):
    """Response containing message data."""

    items: list[MessageViewItem] = Field(
        default_factory=list, description="Message data items"
    )
