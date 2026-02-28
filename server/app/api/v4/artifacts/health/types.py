"""Types for health artifact."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.artifacts.types import InternalResponseBase
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


class HealthWebsocketEntries(BaseModel):
    """Views data for health websocket response."""

    runs: "GetRunListViewResponse | None" = None


class HealthWebsocketResources(BaseModel):
    """Hydrated resources for health websocket — selected only."""

    pass


class GetHealthWebsocketResponse(InternalResponseBase):
    """Websocket-facing health response with hydrated resources."""

    entries: HealthWebsocketEntries | None = None
    resources: HealthWebsocketResources


from app.api.v4.entries.runs.search import GetRunListViewResponse  # noqa: E402

HealthWebsocketEntries.model_rebuild()
HealthWebsocketResources.model_rebuild()
GetHealthWebsocketResponse.model_rebuild()
