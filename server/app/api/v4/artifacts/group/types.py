"""Types for group artifact endpoints."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class GroupListItem(BaseModel):
    """Single group in the list response with hydrated metadata."""

    group_id: UUID
    session_id: UUID | None = None
    profile_id: UUID | None = None

    group_name: str | None = None
    trace_id: str | None = None

    first_run_at: datetime | None = None
    last_run_at: datetime | None = None

    run_count: int = 0
    unique_agents: int = 0
    unique_models: int = 0

    total_tokens: int = 0
    total_cost: Decimal = Decimal("0")

    agent_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None

    # Hydrated metadata
    agent_names: list[str] | None = None
    model_names: list[str] | None = None


class GetGroupListRequest(BaseModel):
    """Request for group list endpoint."""

    session_id: UUID | None = Field(default=None)
    agent_id: UUID | None = Field(default=None)
    model_id: UUID | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    sort_by: str = Field(default="date", description="'date' | 'cost' | 'tokens' | 'runs'")
    sort_order: str = Field(default="desc")

    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class GetGroupListResponse(BaseModel):
    """Response for group list endpoint."""

    actor_name: str | None = None
    items: list[GroupListItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
