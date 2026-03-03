"""Types for pricing artifact."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.routes.v5.api.main.group.types import GetGroupListResponse
from app.routes.v5.api.main.types import FilterOption, InternalResponseBase
from app.routes.v5.api.entries.runs.search import GetRunListViewResponse, RunViewItem


class PricingDailyItem(BaseModel):
    """A single day+model aggregation bucket."""

    date_key: str
    model_id: str | None = None
    total_cost: Decimal = Decimal("0")
    run_count: int = 0


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
    daily: list[PricingDailyItem] = Field(default_factory=list)


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

    # Embedded group history
    history: GetGroupListResponse | None = None


# =============================================================================
# Export Types
# =============================================================================


class ExportPricingApiRequest(BaseModel):
    """Request model for pricing export (group-level analytical dump)."""

    start_date: datetime | None = Field(default=None)
    end_date: datetime | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    session_id: UUID | None = Field(default=None)
    model_id: UUID | None = Field(default=None)
    agent_id: UUID | None = Field(default=None)

    sort_by: str = Field(default="date")
    sort_order: str = Field(default="desc")

    @property
    def effective_date_from(self) -> datetime | None:
        return self.start_date or self.date_from

    @property
    def effective_date_to(self) -> datetime | None:
        return self.end_date or self.date_to


class ExportPricingApiResponse(BaseModel):
    """Response model for pricing export."""

    upload_id: UUID
    file_name: str
    row_count: int


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


class GetPricingWebsocketResponse(InternalResponseBase):
    """Websocket-facing pricing response with hydrated resources."""

    entries: PricingWebsocketEntries | None = None
    resources: PricingWebsocketResources
