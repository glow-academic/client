"""Types for health artifact."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.routes.v5.tools.entries.health.types import GetHealthResponse
from app.routes.v5.tools.entries.metrics.types import GetMetricsSearchResponse
from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse


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
    """Response with health data."""

    views: HealthViews = Field(default_factory=HealthViews)
    total_count: int = Field(default=0)


# =============================================================================
# WebSocket Types
# =============================================================================


class GetHealthApiRequest(BaseModel):
    """Request model for get health endpoint."""

    health_id: UUID | None = None
    draft_id: UUID | None = None


class HealthWebsocketEntries(BaseModel):
    """Views data for health websocket response."""

    runs: GetRunListViewResponse | None = None


class HealthWebsocketResources(BaseModel):
    """Hydrated resources for health websocket — selected only."""

    pass


class GetHealthWebsocketResponse(BaseModel):
    """Websocket-facing health response with hydrated resources.

    Uses Any for config chain fields to accept resource fetcher types.
    """

    systems: list[Any] | None = None
    agents: list[Any] | None = None
    models: list[Any] | None = None
    providers: list[Any] | None = None
    tools: list[Any] | None = None
    args: list[Any] | None = None
    args_outputs: list[Any] | None = None
    profile: list[Any] | None = None
    params: BaseModel | None = None
    resource_system_ids: dict[str, UUID | None] | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None
    entries: HealthWebsocketEntries | None = None
    resources: HealthWebsocketResources


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
    runs_today: GetRunListViewResponse | None = None
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    resource_system_ids: dict[str, UUID | None] = field(default_factory=dict)
    group_id: UUID | None = None
