"""Types for pricing artifact."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.artifacts.group.types import GetGroupListResponse
from app.api.v4.artifacts.types import FilterOption, WebsocketConfig
from app.api.v4.entries.runs.search import GetRunListViewResponse, RunViewItem


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

    # Embedded group history params
    history_enabled: bool = False
    history_page: int = 0
    history_page_size: int = 50
    history_sort_by: str = "date"
    history_sort_order: str = "desc"
    history_session_id: UUID | None = None
    history_model_id: UUID | None = None
    history_agent_id: UUID | None = None

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

    # Embedded group history (when history_enabled=True)
    history: GetGroupListResponse | None = None


# =============================================================================
# WebSocket Types
# =============================================================================


class GetPricingApiRequest(BaseModel):
    """Request model for get pricing endpoint."""

    pricing_id: UUID | None = None
    draft_id: UUID | None = None


class PricingWebsocketEntries(BaseModel):
    """Entries data for pricing websocket response."""

    runs: GetRunListViewResponse | None = None


class PricingWebsocketResources(BaseModel):
    """Hydrated resources for pricing websocket — selected only."""

    pass


class GetPricingWebsocketResponse(BaseModel):
    """Websocket-facing pricing response with hydrated resources."""

    entries: PricingWebsocketEntries | None = None
    resources: PricingWebsocketResources
    config: WebsocketConfig | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None
