"""Types for pricing daily view (mv_pricing_daily)."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PricingDailyItem(BaseModel):
    """Single day from mv_pricing_daily."""

    date_key: date
    model_id: UUID | None = None
    agent_id: UUID | None = None

    run_count: int = 0
    group_count: int = 0
    unique_profiles: int = 0
    unique_sessions: int = 0

    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cached_tokens: int = 0
    total_tokens: int = 0

    total_input_cost: Decimal = Decimal("0")
    total_output_cost: Decimal = Decimal("0")
    total_cached_cost: Decimal = Decimal("0")
    total_cost: Decimal = Decimal("0")

    avg_tokens_per_run: float = 0.0
    avg_cost_per_run: Decimal = Decimal("0")


class GetPricingDailyRequest(BaseModel):
    """Request for getting pricing daily data."""

    model_id: UUID | None = Field(default=None)
    agent_id: UUID | None = Field(default=None)
    date_from: date | None = Field(default=None)
    date_to: date | None = Field(default=None)

    page_limit: int = Field(default=30, ge=1, le=365)
    page_offset: int = Field(default=0, ge=0)


class GetPricingDailyResponse(BaseModel):
    """Response with pricing daily data."""

    items: list[PricingDailyItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
