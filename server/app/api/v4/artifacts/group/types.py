"""Types for group artifact endpoints."""

from dataclasses import dataclass, field
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

    sort_by: str = Field(
        default="date", description="'date' | 'cost' | 'tokens' | 'runs'"
    )
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


# =============================================================================
# WebSocket Types
# =============================================================================


class GetGroupApiRequest(BaseModel):
    """Request model for get group endpoint."""

    group_id: UUID | None = None
    draft_id: UUID | None = None


class GroupWebsocketEntries(BaseModel):
    """Entries data for group websocket response."""

    runs: "GetRunListViewResponse | None" = None
    # Domain views (from internal layer)
    group_runs: "list[RunViewItem] | None" = None
    messages: "list[MessageViewItem] | None" = None
    calls: "list[QGetCallListViewV4Item] | None" = None


class GroupWebsocketResources(BaseModel):
    """Hydrated resources for group websocket — selected only."""

    config_agents: "list[QGetAgentsV4Item] | None" = None
    config_models: "list[QGetModelsV4Item] | None" = None
    config_providers: "list[QGetProvidersV4Item] | None" = None
    config_tools: "list[QGetToolsV4Item] | None" = None
    config_args: "list[QGetArgsV4Item] | None" = None
    config_args_outputs: "list[QGetArgsOutputsV4Item] | None" = None
    config_profile: "list[QGetProfilesV4Item] | None" = None


class GetGroupWebsocketResponse(BaseModel):
    """Websocket-facing group response with hydrated resources."""

    entries: GroupWebsocketEntries | None = None
    resources: GroupWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


from app.api.v4.entries.runs.search import (  # noqa: E402
    GetRunListViewResponse,
    RunViewItem,
)
from app.api.v4.views.message.list.types import (  # noqa: E402
    GetMessageListViewResponse,
    MessageViewItem,
)
from app.sql.types import (  # noqa: E402
    GetCallListViewSqlRow,
    GetGroupListViewSqlRow,
    QGetAgentsV4Item,
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetCallListViewV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)

GroupWebsocketEntries.model_rebuild()
GroupWebsocketResources.model_rebuild()


@dataclass
class GroupInternalData:
    """Internal data from core group fetching (cacheable layer)."""

    # Views
    group_view: GetGroupListViewSqlRow
    runs_result: GetRunListViewResponse
    messages_result: GetMessageListViewResponse
    calls_result: GetCallListViewSqlRow
    # Config chain
    config_agents: list[QGetAgentsV4Item] = field(default_factory=list)
    config_models: list[QGetModelsV4Item] = field(default_factory=list)
    config_providers: list[QGetProvidersV4Item] = field(default_factory=list)
    config_tools: list[QGetToolsV4Item] = field(default_factory=list)
    config_profile: list[QGetProfilesV4Item] = field(default_factory=list)
    runs_today: GetRunListViewResponse | None = None
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    group_id: UUID | None = None
    # Context
    actor_name: str | None = None
