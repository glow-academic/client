"""Types for health list view."""

from datetime import datetime

from pydantic import BaseModel, Field


class HealthViewItem(BaseModel):
    """Single health row from the health list view."""

    date_hour: datetime
    service: str | None = None
    check_count: int = 0
    ok_count: int = 0
    fail_count: int = 0
    uptime_percent: float | None = None
    avg_latency_ms: float | None = None
    min_latency_ms: float | None = None
    max_latency_ms: float | None = None
    latest_ok: bool | None = None
    latest_error: str | None = None


class GetHealthListViewResponse(BaseModel):
    """Response containing health list data."""

    items: list[HealthViewItem] = Field(
        default_factory=list, description="Health data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
