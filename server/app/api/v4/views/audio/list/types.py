"""Types for audio list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AudioViewItem(BaseModel):
    """Single audio from the audio list view."""

    audio_id: UUID
    uploads_id: UUID | None = None
    file_path: str | None = None
    mime_type: str | None = None
    size: int | None = None
    length_seconds: int = 0
    voice_id: UUID | None = None
    created_at: datetime | None = None


class GetAudioListViewResponse(BaseModel):
    """Response containing audio list data."""

    items: list[AudioViewItem] = Field(
        default_factory=list, description="Audio data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
