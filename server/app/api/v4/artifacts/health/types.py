"""Types for health artifact."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.api.v4.views.health.list.types import HealthViewItem
from app.api.v4.views.metric.list.types import MetricViewItem


class HealthRequest(BaseModel):
    """Request for getting health data."""

    service: str | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    page_limit: int = Field(default=168, ge=1, le=744)
    page_offset: int = Field(default=0, ge=0)


class HealthViews(BaseModel):
    """Health view data."""

    service_hourly: list[HealthViewItem] = Field(default_factory=list)
    metrics_hourly: list[MetricViewItem] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """Response with health data."""

    views: HealthViews = Field(default_factory=HealthViews)
    total_count: int = Field(default=0)
