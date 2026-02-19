"""Types for pricing artifact."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.artifacts.types import FilterOption
from app.api.v4.entries.runs.search import GetRunListViewResponse, RunViewItem
from app.sql.types import (
    QGetAgentsV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)


class PricingRequest(BaseModel):
    """Request for getting pricing data."""

    # Date filters (accept both naming conventions)
    start_date: datetime | None = Field(default=None)
    end_date: datetime | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    # Resource filters
    model_id: UUID | None = Field(default=None)
    agent_id: UUID | None = Field(default=None)

    # Pagination
    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)

    @property
    def effective_date_from(self) -> datetime | None:
        """Get effective start date (prefers start_date over date_from)."""
        return self.start_date or self.date_from

    @property
    def effective_date_to(self) -> datetime | None:
        """Get effective end date (prefers end_date over date_to)."""
        return self.end_date or self.date_to


class PricingViews(BaseModel):
    """Pricing view data."""

    runs: list[RunViewItem] = Field(default_factory=list)


class PricingResources(BaseModel):
    """Pricing resource metadata."""

    agents: dict[str, dict] = Field(default_factory=dict)
    models: dict[str, dict] = Field(default_factory=dict)


class PricingResponse(BaseModel):
    """Response with pricing data."""

    views: PricingViews = Field(default_factory=PricingViews)
    resources: PricingResources = Field(default_factory=PricingResources)
    total_count: int = Field(default=0)

    model_options: list[FilterOption] = Field(default_factory=list)
    agent_options: list[FilterOption] = Field(default_factory=list)


# =============================================================================
# WebSocket Types
# =============================================================================


class GetPricingApiRequest(BaseModel):
    """Request model for get pricing endpoint."""

    pricing_id: UUID | None = None
    draft_id: UUID | None = None


class PricingWebsocketViews(BaseModel):
    """Views data for pricing websocket response."""

    runs: GetRunListViewResponse | None = None


class PricingWebsocketResources(BaseModel):
    """Hydrated resources for pricing websocket — selected only."""

    config_agents: list[QGetAgentsV4Item] | None = None
    config_models: list[QGetModelsV4Item] | None = None
    config_providers: list[QGetProvidersV4Item] | None = None
    config_tools: list[QGetToolsV4Item] | None = None
    config_profile: list[QGetProfilesV4Item] | None = None


class GetPricingWebsocketResponse(BaseModel):
    """Websocket-facing pricing response with hydrated resources."""

    views: PricingWebsocketViews | None = None
    resources: PricingWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None
