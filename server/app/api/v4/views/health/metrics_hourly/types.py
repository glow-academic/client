"""Types for health metrics hourly view (mv_health_metrics_hourly)."""

from datetime import datetime

from pydantic import BaseModel, Field


class HealthMetricsHourlyItem(BaseModel):
    """Single hour from mv_health_metrics_hourly."""

    date_hour: datetime

    sample_count: int = 0

    avg_cpu_percent: float = 0.0
    min_cpu_percent: float = 0.0
    max_cpu_percent: float = 0.0

    avg_latency_ms: float = 0.0
    min_latency_ms: float = 0.0
    max_latency_ms: float = 0.0

    avg_memory_bytes: int = 0
    min_memory_bytes: int = 0
    max_memory_bytes: int = 0

    max_requests_total: int = 0
    max_errors_total: int = 0


class GetHealthMetricsHourlyRequest(BaseModel):
    """Request for getting health metrics hourly data."""

    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    page_limit: int = Field(default=168, ge=1, le=744)  # Default: 1 week (24*7)
    page_offset: int = Field(default=0, ge=0)


class GetHealthMetricsHourlyResponse(BaseModel):
    """Response with health metrics hourly data."""

    items: list[HealthMetricsHourlyItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
