"""Types for metric list view."""

from datetime import datetime

from pydantic import BaseModel, Field


class MetricViewItem(BaseModel):
    """Single metric row from the metric list view."""

    date_hour: datetime
    sample_count: int = 0
    avg_cpu_percent: float | None = None
    min_cpu_percent: float | None = None
    max_cpu_percent: float | None = None
    avg_latency_ms: float | None = None
    min_latency_ms: float | None = None
    max_latency_ms: float | None = None
    avg_memory_bytes: int | None = None
    min_memory_bytes: int | None = None
    max_memory_bytes: int | None = None
    max_requests_total: int | None = None
    max_errors_total: int | None = None


class GetMetricListViewResponse(BaseModel):
    """Response containing metric list data."""

    items: list[MetricViewItem] = Field(
        default_factory=list, description="Metric data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
