"""Types for video list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class VideoViewItem(BaseModel):
    """Single video from the video list view."""

    video_id: UUID
    uploads_id: UUID | None = None
    file_path: str | None = None
    mime_type: str | None = None
    size: int | None = None
    length_seconds: int = 0
    created_at: datetime | None = None


class GetVideoListViewResponse(BaseModel):
    """Response containing video list data."""

    items: list[VideoViewItem] = Field(
        default_factory=list, description="Video data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
