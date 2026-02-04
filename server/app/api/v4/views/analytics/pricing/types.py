"""Types for analytics pricing endpoints."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PricingDebugInfoItem(BaseModel):
    """Debug info entry for a run."""

    id: UUID
    created_at: datetime
    content: str


class PricingModelRunItem(BaseModel):
    """Run summary for pricing analytics chart."""

    run_id: UUID
    created_at: datetime | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    model_id: UUID | None = None
    profile_id: UUID | None = None
    agent_id: UUID | None = None
    run_cost: Decimal = Decimal("0")
    debug_info: list[PricingDebugInfoItem] = Field(default_factory=list)


class PricingModelItem(BaseModel):
    """Model reference data for pricing analytics."""

    model_id: UUID
    name: str | None = None
    description: str | None = None
    input_ppm: Decimal = Decimal("0")
    output_ppm: Decimal = Decimal("0")


class PricingProfileItem(BaseModel):
    """Profile reference data for pricing analytics."""

    profile_id: UUID
    name: str | None = None


class PricingAgentItem(BaseModel):
    """Agent reference data for pricing analytics."""

    agent_id: UUID
    name: str | None = None


class GetPricingAnalyticsRequest(BaseModel):
    """Request for pricing analytics summary."""

    start_date: datetime | None = Field(default=None)
    end_date: datetime | None = Field(default=None)
    department_ids: list[UUID] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    cohort_ids: list[UUID] = Field(default_factory=list)
    simulation_filters: list[str] = Field(default_factory=list)


class GetPricingAnalyticsResponse(BaseModel):
    """Response for pricing analytics summary."""

    actor_name: str | None = None
    model_runs: list[PricingModelRunItem] = Field(default_factory=list)
    models: list[PricingModelItem] = Field(default_factory=list)
    profiles: list[PricingProfileItem] = Field(default_factory=list)
    agents: list[PricingAgentItem] = Field(default_factory=list)


class PricingRunSummaryItem(BaseModel):
    """Run summary row for pricing list."""

    run_id: UUID
    created_at: datetime | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cost: Decimal = Decimal("0")
    model_id: UUID | None = None
    profile_id: UUID | None = None
    agent_id: UUID | None = None
    debug_info_entry: list[PricingDebugInfoItem] = Field(default_factory=list)


class PricingGroupRunItem(BaseModel):
    """Group summary for pricing list."""

    group_id: UUID
    created_at: datetime | None = None
    run_count: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost: Decimal = Decimal("0")
    runs_entry: list[PricingRunSummaryItem] = Field(default_factory=list)


class PricingFilterOption(BaseModel):
    """Filter option for pricing list UI."""

    value: str | None = None
    label: str | None = None
    count: int | None = None


class GetPricingRunsRequest(BaseModel):
    """Request for pricing runs list."""

    start_date: datetime | None = Field(default=None)
    end_date: datetime | None = Field(default=None)
    department_ids: list[UUID] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    cohort_ids: list[UUID] = Field(default_factory=list)
    simulation_filters: list[str] = Field(default_factory=list)
    search: str | None = Field(default=None)
    model_ids: list[UUID] = Field(default_factory=list)
    profile_ids: list[UUID] = Field(default_factory=list)
    actor_ids: list[UUID] = Field(default_factory=list)
    sort_by: str = Field(default="createdAt")
    sort_order: str = Field(default="desc")
    limit_count: int = Field(default=10, ge=1, le=100)
    offset_count: int = Field(default=0, ge=0)


class GetPricingRunsResponse(BaseModel):
    """Response for pricing runs list."""

    actor_name: str | None = None
    group_runs: list[PricingGroupRunItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
    page: int = Field(default=0)
    page_size: int = Field(default=10)
    total_pages: int = Field(default=0)
    model_options: list[PricingFilterOption] = Field(default_factory=list)
    profile_options: list[PricingFilterOption] = Field(default_factory=list)
    actor_options: list[PricingFilterOption] = Field(default_factory=list)
    models: list[PricingModelItem] = Field(default_factory=list)
    profiles: list[PricingProfileItem] = Field(default_factory=list)
    agents: list[PricingAgentItem] = Field(default_factory=list)
