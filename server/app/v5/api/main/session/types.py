"""Types for session artifact endpoints."""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.v5.api.main.types import InternalResponseBase


class ArtifactSessionGroup(BaseModel):
    """Single group entry for a session."""

    group_id: UUID
    group_name: str | None = None
    trace_id: str | None = None
    first_run_at: datetime | None = None
    last_run_at: datetime | None = None
    run_count: int = 0
    total_tokens: int = 0
    total_cost: Decimal = Decimal("0")


class SessionListItem(BaseModel):
    """Single session in the list response with hydrated metadata."""

    session_id: UUID
    profile_id: UUID | None = None
    profile_name: str | None = None

    session_created_at: datetime | None = None
    session_updated_at: datetime | None = None

    active: bool = False

    group_count: int = 0
    run_count: int = 0
    first_run_at: datetime | None = None
    last_run_at: datetime | None = None

    total_tokens: int = 0
    total_cost: Decimal = Decimal("0")

    # Enrichment counts (Phase 1)
    chat_count: int = 0
    attempt_count: int = 0
    message_count: int = 0
    problem_count: int = 0


class GetSessionListRequest(BaseModel):
    """Request for session list endpoint."""

    active: bool | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    department_ids: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)

    sort_by: str = Field(
        default="date", description="'date' | 'cost' | 'tokens' | 'groups' | 'runs'"
    )
    sort_order: str = Field(default="desc")

    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class GetSessionListResponse(BaseModel):
    """Response for session list endpoint."""

    actor_name: str | None = None
    items: list[SessionListItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
    page: int = Field(default=0)
    page_size: int = Field(default=50)
    total_pages: int = Field(default=0)


class SessionTimelineItem(BaseModel):
    """Single event in the unified session timeline."""

    event_type: str | None = None
    entity_id: UUID | None = None
    entity_name: str | None = None
    created_at: datetime | None = None
    extra_1: str | None = None
    extra_2: str | None = None


class GetSessionDetailRequest(BaseModel):
    """Request for session detail endpoint."""

    session_id: UUID


class GetSessionDetailResponse(BaseModel):
    """Response for session detail endpoint."""

    actor_name: str | None = None
    session_exists: bool = False
    session_id: UUID | None = None
    profile_id: UUID | None = None
    profile_name: str | None = None
    session_created_at: datetime | None = None
    active: bool = False
    groups: list[ArtifactSessionGroup] = Field(default_factory=list)
    timeline: list[SessionTimelineItem] = Field(default_factory=list)


# =============================================================================
# WebSocket Types
# =============================================================================


class GetSessionApiRequest(BaseModel):
    """Request model for get session endpoint."""

    session_id: UUID | None = None
    draft_id: UUID | None = None


class SessionWebsocketEntries(BaseModel):
    """Entries data for session websocket response."""

    runs: "GetRunListViewResponse | None" = None
    # Domain views (from internal layer)
    groups: "list[QGetGroupListViewV4Item] | None" = None


class SessionWebsocketResources(BaseModel):
    """Hydrated resources for session websocket — selected only."""

    pass


class GetSessionWebsocketResponse(InternalResponseBase):
    """Websocket-facing session response with hydrated resources."""

    entries: SessionWebsocketEntries | None = None
    resources: SessionWebsocketResources


from app.v5.api.entries.runs.search import GetRunListViewResponse  # noqa: E402
from app.v5.sql.types import (  # noqa: E402
    GetGroupListViewSqlRow,
    GetSessionListViewSqlRow,
    GetSessionTimelineViewSqlRow,
    QGetAgentsV4Item,
    QGetGroupListViewV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)

SessionWebsocketEntries.model_rebuild()
SessionWebsocketResources.model_rebuild()
GetSessionWebsocketResponse.model_rebuild()


@dataclass
class SessionInternalData:
    """Internal data from core session fetching (cacheable layer)."""

    # Views
    session_view: GetSessionListViewSqlRow
    groups_result: GetGroupListViewSqlRow
    runs_result: GetRunListViewResponse
    # Config chain
    config_agents: list[QGetAgentsV4Item] = field(default_factory=list)
    config_models: list[QGetModelsV4Item] = field(default_factory=list)
    config_providers: list[QGetProvidersV4Item] = field(default_factory=list)
    config_tools: list[QGetToolsV4Item] = field(default_factory=list)
    config_profile: list[QGetProfilesV4Item] = field(default_factory=list)
    runs_today: GetRunListViewResponse | None = None
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    group_id: UUID | None = None
    # Timeline
    timeline_result: GetSessionTimelineViewSqlRow | None = None
    # Context
    actor_name: str | None = None
    profile_name: str | None = None
