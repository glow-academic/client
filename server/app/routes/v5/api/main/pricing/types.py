"""Types for pricing artifact."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.routes.v5.api.main.types import FilterOption, InternalResponseBase
from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse


class PricingDailyItem(BaseModel):
    """A single day+model aggregation bucket."""

    date_key: str
    model_id: str | None = None
    total_cost: Decimal = Decimal("0")
    run_count: int = 0


class PricingRequest(BaseModel):
    """Request for pricing get endpoint (top chart)."""

    # Date filters (accept both naming conventions)
    start_date: datetime | None = Field(default=None)
    end_date: datetime | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    @property
    def effective_date_from(self) -> datetime | None:
        """Get effective start date (prefers start_date over date_from)."""
        return self.start_date or self.date_from

    @property
    def effective_date_to(self) -> datetime | None:
        """Get effective end date (prefers end_date over date_to)."""
        return self.end_date or self.date_to


class ListPricingRequest(BaseModel):
    """Request for pricing list endpoint (group history, paginated)."""

    # Date filters
    start_date: datetime | None = Field(default=None)
    end_date: datetime | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    # Pagination
    page: int = 0
    page_size: int = 50
    sort_order: str = "desc"
    session_id: UUID | None = None

    @property
    def effective_date_from(self) -> datetime | None:
        return self.start_date or self.date_from

    @property
    def effective_date_to(self) -> datetime | None:
        return self.end_date or self.date_to


class PricingResources(BaseModel):
    """Pricing resource metadata."""

    agents: dict[str, dict] = Field(default_factory=dict)
    models: dict[str, dict] = Field(default_factory=dict)


class PricingResponse(BaseModel):
    """Response for pricing get (top chart)."""

    daily: list[PricingDailyItem] = Field(default_factory=list)
    resources: PricingResources = Field(default_factory=PricingResources)
    total_count: int = Field(default=0)

    model_options: list[FilterOption] = Field(default_factory=list)
    agent_options: list[FilterOption] = Field(default_factory=list)


class PricingGroupItem(BaseModel):
    """A single group row in the pricing list."""

    group_id: UUID
    session_id: UUID | None = None
    group_name: str | None = None
    first_run_at: datetime | None = None
    last_run_at: datetime | None = None
    run_count: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    total_cost: Decimal = Decimal("0")
    agent_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None
    agent_names: list[str] | None = None
    model_names: list[str] | None = None


class ListPricingResponse(BaseModel):
    """Response for pricing list (group history, paginated)."""

    data: list[PricingGroupItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
    page: int = 0
    page_size: int = 50
    total_pages: int = 0


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
