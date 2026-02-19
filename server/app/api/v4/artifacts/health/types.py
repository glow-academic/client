"""Types for health artifact."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.sql.types import QGetHealthListViewV4Item, QGetMetricListViewV4Item


class HealthRequest(BaseModel):
    """Request for getting health data."""

    service: str | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    page_limit: int = Field(default=168, ge=1, le=744)
    page_offset: int = Field(default=0, ge=0)


class HealthViews(BaseModel):
    """Health view data."""

    service_hourly: list[QGetHealthListViewV4Item] = Field(default_factory=list)
    metrics_hourly: list[QGetMetricListViewV4Item] = Field(default_factory=list)


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


class HealthWebsocketViews(BaseModel):
    """Views data for health websocket response."""

    runs: "GetRunListViewResponse | None" = None


class HealthWebsocketResources(BaseModel):
    """Hydrated resources for health websocket — selected only."""

    config_agents: "list[QGetAgentsV4Item] | None" = None
    config_models: "list[QGetModelsV4Item] | None" = None
    config_providers: "list[QGetProvidersV4Item] | None" = None
    config_tools: "list[QGetToolsV4Item] | None" = None
    config_profile: "list[QGetProfilesV4Item] | None" = None


class GetHealthWebsocketResponse(BaseModel):
    """Websocket-facing health response with hydrated resources."""

    views: HealthWebsocketViews | None = None
    resources: HealthWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


from app.api.v4.entries.runs.search import GetRunListViewResponse  # noqa: E402
from app.sql.types import (  # noqa: E402
    QGetAgentsV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)

HealthWebsocketViews.model_rebuild()
HealthWebsocketResources.model_rebuild()
