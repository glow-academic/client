"""Types for health service hourly view (mv_health_service_hourly)."""

from datetime import datetime

from pydantic import BaseModel, Field


class HealthServiceHourlyItem(BaseModel):
    """Single hour from mv_health_service_hourly."""

    date_hour: datetime
    service: str

    check_count: int = 0
    ok_count: int = 0
    fail_count: int = 0

    uptime_percent: float = 0.0

    avg_latency_ms: float = 0.0
    min_latency_ms: float = 0.0
    max_latency_ms: float = 0.0

    latest_ok: bool | None = None
    latest_error: str | None = None


class GetHealthServiceHourlyRequest(BaseModel):
    """Request for getting health service hourly data."""

    service: str | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    page_limit: int = Field(default=168, ge=1, le=744)  # Default: 1 week (24*7)
    page_offset: int = Field(default=0, ge=0)


class GetHealthServiceHourlyResponse(BaseModel):
    """Response with health service hourly data."""

    items: list[HealthServiceHourlyItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
