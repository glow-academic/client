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

    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    total_cost: Decimal = Decimal("0")

    agent_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None

    # Hydrated metadata
    profile_name: str | None = None
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


# ---- Group Detail types ----


class GroupDetailContentItem(BaseModel):
    """Single content block in a message."""

    content: str | None = None


class GroupDetailCallItem(BaseModel):
    """A tool/function call made during the run."""

    id: UUID
    template_name: str | None = None
    arguments: str | None = None
    created_at: datetime


class GroupDetailMessageItem(BaseModel):
    """A message with contents."""

    id: UUID | None = None
    role: str | None = None
    contents: list[GroupDetailContentItem] = Field(default_factory=list)
    calls: list[GroupDetailCallItem] = Field(default_factory=list)


class GroupDetailRunItem(BaseModel):
    """Run metadata for the detail response."""

    id: UUID
    created_at: datetime
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    cost: float = 0
    model_id: UUID | None = None
    agent_id: UUID | None = None
    profile_id: UUID | None = None


class GroupDetailRunWithMessages(BaseModel):
    """A run with its messages and context boundary."""

    run: GroupDetailRunItem
    messages: list[GroupDetailMessageItem] = Field(default_factory=list)
    previous_context_start_index: int | None = None


class GroupDetailResourceItem(BaseModel):
    """A named resource (model, agent, or profile)."""

    model_id: UUID | None = None
    agent_id: UUID | None = None
    profile_id: UUID | None = None
    name: str | None = None


class GetGroupDetailRequest(BaseModel):
    """Request for group detail endpoint."""

    group_id: UUID


class GetGroupDetailResponse(BaseModel):
    """Response for group detail endpoint."""

    group_exists: bool = False
    actor_name: str | None = None
    runs: list[GroupDetailRunWithMessages] = Field(default_factory=list)
    models: list[GroupDetailResourceItem] = Field(default_factory=list)
    agents: list[GroupDetailResourceItem] = Field(default_factory=list)
    profiles: list[GroupDetailResourceItem] = Field(default_factory=list)
