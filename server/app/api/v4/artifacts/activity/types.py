"""Types for activity artifact."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.sql.types import (
    GetActivityListViewSqlRow,
    GetAuditListViewSqlRow,
    GetGrantListViewSqlRow,
    GetLoginListViewSqlRow,
    GetProblemListViewSqlRow,
    GetSessionListViewSqlRow,
    QGetActivityListViewV4Item,
    QGetAgentsV4Item,
    QGetAuditListViewV4Item,
    QGetGrantListViewV4Item,
    QGetLoginListViewV4Item,
    QGetModelsV4Item,
    QGetProblemListViewV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetSessionListViewV4Item,
    QGetToolsV4Item,
)


@dataclass
class ActivityInternalData:
    """Internal data from core activity fetching (cacheable layer)."""

    # Views
    activity_result: GetActivityListViewSqlRow
    sessions_result: GetSessionListViewSqlRow
    logins_result: GetLoginListViewSqlRow
    audits_result: GetAuditListViewSqlRow
    problems_result: GetProblemListViewSqlRow
    grants_result: GetGrantListViewSqlRow
    # Config chain
    config_agents: list[QGetAgentsV4Item] = field(default_factory=list)
    config_models: list[QGetModelsV4Item] = field(default_factory=list)
    config_providers: list[QGetProvidersV4Item] = field(default_factory=list)
    config_tools: list[QGetToolsV4Item] = field(default_factory=list)
    config_profile: list[QGetProfilesV4Item] = field(default_factory=list)
    runs_today: Any = None  # GetRunListViewResponse — lazy to avoid circular import
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    group_id: UUID | None = None


class ActivityRequest(BaseModel):
    """Request for getting activity data."""

    profile_id: UUID | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    department_ids: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)

    # Embedded session history params
    history_enabled: bool = False
    history_page: int = 0
    history_page_size: int = 50
    history_sort_by: str = "date"
    history_sort_order: str = "desc"
    history_active: bool | None = None


class ActivityViews(BaseModel):
    """Activity view data."""

    sessions: list[QGetSessionListViewV4Item] = Field(default_factory=list)
    activity: list[QGetActivityListViewV4Item] = Field(default_factory=list)
    logins: list[QGetLoginListViewV4Item] = Field(default_factory=list)
    audits: list[QGetAuditListViewV4Item] = Field(default_factory=list)
    problems: list[QGetProblemListViewV4Item] = Field(default_factory=list)
    grants: list[QGetGrantListViewV4Item] = Field(default_factory=list)


class ActivityResources(BaseModel):
    """Activity resource metadata."""

    profiles: dict[str, dict] = Field(default_factory=dict)


class ActivityChartPoint(BaseModel):
    """Single chart data point for activity metrics graph."""

    date: str
    event_id: str
    count: int = 0


class ActivityAvailableEvent(BaseModel):
    """Available event type for the activity chart selector."""

    id: str
    name: str
    total_count: int = 0


class ActivityResponse(BaseModel):
    """Response with activity data."""

    # Header metrics (flat)
    sessions_count: int = 0
    active_profiles_count: int = 0
    logins_count: int = 0
    emulations_count: int = 0
    # Chart data
    chart_data: list[ActivityChartPoint] = Field(default_factory=list)
    available_events: list[ActivityAvailableEvent] = Field(default_factory=list)
    # Problems
    problems: list[QGetProblemListViewV4Item] = Field(default_factory=list)
    # Keep views/resources for any other consumers
    views: ActivityViews = Field(default_factory=ActivityViews)
    resources: ActivityResources = Field(default_factory=ActivityResources)
    total_count: int = Field(default=0)

    # Embedded session history (when history_enabled=True)
    history: Any = None  # GetSessionListResponse — avoids circular import


# =============================================================================
# WebSocket Types
# =============================================================================


class GetActivityApiRequest(BaseModel):
    """Request model for get activity endpoint."""

    activity_id: UUID | None = None
    draft_id: UUID | None = None


class ActivityWebsocketViews(BaseModel):
    """Views data for activity websocket response."""

    runs: Any = None  # GetRunListViewResponse — lazy to avoid circular import
    # Domain views (from internal layer)
    sessions: list[QGetSessionListViewV4Item] | None = None
    activity: list[QGetActivityListViewV4Item] | None = None
    logins: list[QGetLoginListViewV4Item] | None = None
    audits: list[QGetAuditListViewV4Item] | None = None
    problems: list[QGetProblemListViewV4Item] | None = None
    grants: list[QGetGrantListViewV4Item] | None = None


class ActivityWebsocketResources(BaseModel):
    """Hydrated resources for activity websocket — selected only."""

    config_agents: list[QGetAgentsV4Item] | None = None
    config_models: list[QGetModelsV4Item] | None = None
    config_providers: list[QGetProvidersV4Item] | None = None
    config_tools: list[QGetToolsV4Item] | None = None
    config_profile: list[QGetProfilesV4Item] | None = None


class GetActivityWebsocketResponse(BaseModel):
    """Websocket-facing activity response with hydrated resources."""

    views: ActivityWebsocketViews | None = None
    resources: ActivityWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None
