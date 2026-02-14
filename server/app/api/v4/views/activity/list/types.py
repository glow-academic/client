"""Types for activity list view."""

from datetime import date

from pydantic import BaseModel, Field


class ActivityViewItem(BaseModel):
    """Single activity row from the activity list view."""

    date_key: date
    event_type: str | None = None
    event_count: int = 0
    unique_profiles: int = 0
    saved_count: int = 0
    created_count: int = 0
    duplicated_count: int = 0
    uploaded_count: int = 0
    deleted_count: int = 0
    updated_count: int = 0


class GetActivityListViewResponse(BaseModel):
    """Response containing activity list data."""

    items: list[ActivityViewItem] = Field(
        default_factory=list, description="Activity data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
