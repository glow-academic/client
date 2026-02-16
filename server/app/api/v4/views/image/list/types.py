"""Types for image list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ImageViewItem(BaseModel):
    """Single image from the image list view."""

    image_id: UUID
    uploads_id: UUID | None = None
    upload_id: UUID | None = None
    file_path: str | None = None
    mime_type: str | None = None
    size: int | None = None
    quality_id: UUID | None = None
    created_at: datetime | None = None


class GetImageListViewResponse(BaseModel):
    """Response containing image list data."""

    items: list[ImageViewItem] = Field(
        default_factory=list, description="Image data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
