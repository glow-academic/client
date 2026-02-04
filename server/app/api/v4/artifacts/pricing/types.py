"""Types for pricing artifact."""

from datetime import datetime, date
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.pricing.group_summary.types import PricingGroupSummaryItem
from app.api.v4.views.pricing.daily.types import PricingDailyItem


class PricingRequest(BaseModel):
    """Request for getting pricing data."""

    profile_id: UUID | None = Field(default=None)
    model_id: UUID | None = Field(default=None)
    agent_id: UUID | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class PricingViews(BaseModel):
    """Pricing view data."""

    group_summary: list[PricingGroupSummaryItem] = Field(default_factory=list)
    daily: list[PricingDailyItem] = Field(default_factory=list)


class PricingResources(BaseModel):
    """Pricing resource metadata."""

    agents: dict[str, dict] = Field(default_factory=dict)
    models: dict[str, dict] = Field(default_factory=dict)
    profiles: dict[str, dict] = Field(default_factory=dict)


class PricingResponse(BaseModel):
    """Response with pricing data."""

    views: PricingViews = Field(default_factory=PricingViews)
    resources: PricingResources = Field(default_factory=PricingResources)
    total_count: int = Field(default=0)
