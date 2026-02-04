"""Types for activity daily view (mv_activity_daily)."""

from datetime import date

from pydantic import BaseModel, Field


class ActivityDailyItem(BaseModel):
    """Single day from mv_activity_daily."""

    date_key: date
    event_type: str

    event_count: int = 0
    unique_profiles: int = 0

    saved_count: int = 0
    created_count: int = 0
    duplicated_count: int = 0
    uploaded_count: int = 0
    deleted_count: int = 0
    updated_count: int = 0


class GetActivityDailyRequest(BaseModel):
    """Request for getting activity daily data."""

    event_type: str | None = Field(default=None)
    date_from: date | None = Field(default=None)
    date_to: date | None = Field(default=None)

    page_limit: int = Field(default=30, ge=1, le=365)
    page_offset: int = Field(default=0, ge=0)


class GetActivityDailyResponse(BaseModel):
    """Response with activity daily data."""

    items: list[ActivityDailyItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
