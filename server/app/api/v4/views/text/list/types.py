"""Types for text list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TextViewItem(BaseModel):
    """Single text from the text list view."""

    texts_id: UUID
    text_id: UUID
    content: str | None = None
    content_hash: str | None = None
    created_at: datetime | None = None


class GetTextListViewResponse(BaseModel):
    """Response containing text list data."""

    items: list[TextViewItem] = Field(
        default_factory=list, description="Text data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
