"""Types for pricing run facts view (mv_pricing_run_facts)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PricingRunFactsItem(BaseModel):
    """Single run from mv_pricing_run_facts."""

    # Entry IDs
    run_id: UUID
    group_id: UUID | None = None

    # Resource IDs
    agent_id: UUID | None = None
    model_id: UUID | None = None
    profile_id: UUID | None = None
    session_id: UUID | None = None

    # Token counts
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    total_tokens: int = 0

    # Computed costs
    input_cost: Decimal = Decimal("0")
    output_cost: Decimal = Decimal("0")
    cached_cost: Decimal = Decimal("0")
    total_cost: Decimal = Decimal("0")

    # Timestamps
    run_created_at: datetime | None = None

    # Group metadata
    group_name: str | None = None
    trace_id: str | None = None


class GetPricingRunFactsRequest(BaseModel):
    """Request for getting pricing run facts with filters."""

    # Filters
    group_id: UUID | None = Field(default=None, description="Filter by group ID")
    agent_id: UUID | None = Field(default=None, description="Filter by agent ID")
    model_id: UUID | None = Field(default=None, description="Filter by model ID")
    profile_id: UUID | None = Field(default=None, description="Filter by profile ID")
    session_id: UUID | None = Field(default=None, description="Filter by session ID")
    date_from: datetime | None = Field(default=None, description="Filter by date range start")
    date_to: datetime | None = Field(default=None, description="Filter by date range end")

    # Sorting
    sort_by: str = Field(default="date", description="Sort field: 'date' | 'cost' | 'tokens'")
    sort_order: str = Field(default="desc", description="Sort order: 'asc' | 'desc'")

    # Pagination
    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class GetPricingRunFactsResponse(BaseModel):
    """Response with pricing run facts."""

    items: list[PricingRunFactsItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
