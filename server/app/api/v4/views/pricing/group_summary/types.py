"""Types for pricing group summary view (mv_pricing_group_summary)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PricingGroupSummaryItem(BaseModel):
    """Single group from mv_pricing_group_summary."""

    group_id: UUID
    session_id: UUID | None = None
    profile_id: UUID | None = None
    primary_agent_id: UUID | None = None
    primary_model_id: UUID | None = None

    # Name resource IDs (pre-resolved for lightweight hydration)
    primary_model_name_id: UUID | None = None
    primary_agent_name_id: UUID | None = None
    profile_name_id: UUID | None = None

    first_run_at: datetime | None = None
    last_run_at: datetime | None = None

    run_count: int = 0
    unique_agents: int = 0
    unique_models: int = 0

    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cached_tokens: int = 0
    total_tokens: int = 0

    total_input_cost: Decimal = Decimal("0")
    total_output_cost: Decimal = Decimal("0")
    total_cached_cost: Decimal = Decimal("0")
    total_cost: Decimal = Decimal("0")

    group_name: str | None = None
    trace_id: str | None = None

    agent_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None

    # Name resource ID arrays (for batch hydration)
    agent_name_ids: list[UUID] | None = None
    model_name_ids: list[UUID] | None = None


class GetPricingGroupSummaryRequest(BaseModel):
    """Request for getting pricing group summary."""

    session_id: UUID | None = Field(default=None)
    profile_id: UUID | None = Field(default=None)
    agent_id: UUID | None = Field(default=None)
    model_id: UUID | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    sort_by: str = Field(
        default="date", description="'date' | 'cost' | 'tokens' | 'runs'"
    )
    sort_order: str = Field(default="desc")

    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class GetPricingGroupSummaryResponse(BaseModel):
    """Response with pricing group summary."""

    items: list[PricingGroupSummaryItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
