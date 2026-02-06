"""Types for pricing artifact."""

from datetime import datetime, date
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.artifacts.types import FilterOption
from app.api.v4.views.pricing.group_summary.types import PricingGroupSummaryItem
from app.api.v4.views.pricing.daily.types import PricingDailyItem


class PricingRequest(BaseModel):
    """Request for getting pricing data."""

    # Date filters (accept both naming conventions)
    start_date: datetime | None = Field(default=None)
    end_date: datetime | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    # Resource filters
    profile_id: UUID | None = Field(default=None)
    model_id: UUID | None = Field(default=None)
    agent_id: UUID | None = Field(default=None)

    # Analytics filters
    cohort_ids: list[UUID] = Field(default_factory=list)
    department_ids: list[UUID] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    simulation_filters: list[str] = Field(default_factory=list)

    # Pagination
    page_limit: int = Field(default=50, ge=1, le=100)
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

    model_options: list[FilterOption] = Field(default_factory=list)
    agent_options: list[FilterOption] = Field(default_factory=list)
