"""Types for run list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class RunPricingItem(BaseModel):
    """Single pricing entry for a run. Cost computed at runtime."""

    pricing_type: str | None = None
    count: int = 0
    unit_id: UUID | None = None
    pricing_id: UUID | None = None


class RunViewItem(BaseModel):
    """Single run from the run list view."""

    run_id: UUID
    group_id: UUID | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    run_created_at: datetime | None = None
    agent_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None
    provider_ids: list[UUID] | None = None
    pricing: list[RunPricingItem] = Field(default_factory=list)


class GetRunListViewResponse(BaseModel):
    """Response containing run list data."""

    items: list[RunViewItem] = Field(default_factory=list, description="Run data items")
    total_count: int = Field(default=0, description="Total count before pagination")
