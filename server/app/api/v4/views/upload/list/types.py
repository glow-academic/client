"""Types for upload list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class UploadViewItem(BaseModel):
    """Single upload from the upload list view."""

    uploads_id: UUID
    upload_id: UUID
    file_path: str | None = None
    mime_type: str | None = None
    size: int | None = None
    created_at: datetime | None = None


class GetUploadListViewResponse(BaseModel):
    """Response containing upload list data."""

    items: list[UploadViewItem] = Field(
        default_factory=list, description="Upload data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
