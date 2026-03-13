"""Types for health artifact."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.infra.runs_context import RunsContext
from app.infra.auth.types import AnalyticsFacets
from app.tools.v5.entries.health.types import GetHealthResponse
from app.tools.v5.entries.metrics.types import GetMetricsSearchResponse


class HealthRequest(BaseModel):
    """Request for getting health data."""

    service: str | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    page_limit: int = Field(default=168, ge=1, le=744)
    page_offset: int = Field(default=0, ge=0)


class HealthViews(BaseModel):
    """Health view data."""

    service_hourly: list[GetHealthResponse] = Field(default_factory=list)
    metrics_hourly: list[GetMetricsSearchResponse] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """Response with health data.

    Includes inline analytics facets for SSR filter rendering.
    """

    views: HealthViews = Field(default_factory=HealthViews)
    total_count: int = Field(default=0)
    analytics: AnalyticsFacets | None = None


@dataclass
class HealthInternalData:
    """Internal data from core health fetching (cacheable layer)."""

    # Domain entries (from MV search tools)
    health: list[GetHealthResponse] = field(default_factory=list)
    metrics: list[GetMetricsSearchResponse] = field(default_factory=list)
    # Config chain (from resource get tools)
    config_agents: list = field(default_factory=list)
    config_models: list = field(default_factory=list)
    config_providers: list = field(default_factory=list)
    config_tools: list = field(default_factory=list)
    config_systems: list = field(default_factory=list)
    config_profile: list = field(default_factory=list)
    runs_today: RunsContext | None = None
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    resource_system_ids: dict[str, UUID | None] = field(default_factory=dict)
    group_id: UUID | None = None


# =============================================================================
# Export Types
# =============================================================================


class ExportHealthApiResponse(BaseModel):
    """Response model for health export."""

    content: str
    file_name: str
    mime_type: str
    row_count: int
