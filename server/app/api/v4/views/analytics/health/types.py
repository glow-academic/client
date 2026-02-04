"""Types for analytics health endpoint."""

from pydantic import BaseModel, Field


class HealthTrendItem(BaseModel):
    """Single trend data point for a service."""

    date: str
    value: float = 0.0
    latency: float = 0.0
    count: int = 0


class HealthKpiItem(BaseModel):
    """Health KPI for a service."""

    ok: bool = False
    latency_ms: float = 0.0
    error: str | None = None
    trend: list[HealthTrendItem] = Field(default_factory=list)


class HealthKpis(BaseModel):
    """Collection of KPIs by service."""

    websocket: HealthKpiItem | None = None
    redis: HealthKpiItem | None = None
    document: HealthKpiItem | None = None
    database: HealthKpiItem | None = None
    authentication: HealthKpiItem | None = None


class HealthMetricsItem(BaseModel):
    """Metrics time series data point."""

    date: str
    cpu_percent: float = 0.0
    latency_ms: float = 0.0
    memory_bytes: int = 0
    requests_total: int = 0
    errors_total: int = 0
    sample_count: int = 0


class GetHealthAnalyticsRequest(BaseModel):
    """Request for health analytics bundle."""

    pass


class GetHealthAnalyticsResponse(BaseModel):
    """Response for health analytics bundle."""

    actor_name: str | None = None
    health_kpis: HealthKpis | None = None
    metrics: list[HealthMetricsItem] = Field(default_factory=list)
