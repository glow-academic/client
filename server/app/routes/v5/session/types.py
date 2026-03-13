"""Types for session artifact endpoints."""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.infra.runs_context import RunsContext
from app.routes.v5.tools.entries.runs.search import RunViewItem


class ArtifactSessionGroup(BaseModel):
    """Single group entry for a session."""

    group_id: UUID
    group_name: str | None = None
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


@dataclass
class SessionInternalData:
    """Internal data from core session fetching (cacheable layer)."""

    # Domain entries (from MV search tools)
    session_exists: bool = False
    session: Any = None
    groups: list = field(default_factory=list)
    runs: list[RunViewItem] = field(default_factory=list)
    # Timeline source entries
    logins: list = field(default_factory=list)
    problems: list = field(default_factory=list)
    chats: list = field(default_factory=list)
    attempt_homes: list = field(default_factory=list)
    practices: list = field(default_factory=list)
    # Config chain (from resource get tools)
    config_agents: list = field(default_factory=list)
    config_models: list = field(default_factory=list)
    config_providers: list = field(default_factory=list)
    config_tools: list = field(default_factory=list)
    config_systems: list = field(default_factory=list)
    config_profile: list = field(default_factory=list)
    runs_today: RunsContext | None = None
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    resource_system_ids: dict[str, UUID | None] = field(default_factory=dict)
    group_id: UUID | None = None
    # Context
    actor_name: str | None = None
    profile_name: str | None = None
    # Resource maps
    name_map: dict[UUID, str] = field(default_factory=dict)


# =============================================================================
# Export Types
# =============================================================================


class ExportSessionApiResponse(BaseModel):
    """Response model for session export."""

    content: str
    file_name: str
    mime_type: str
    row_count: int
