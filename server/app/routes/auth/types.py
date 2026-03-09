"""Types for profile context internal + HTTP layers."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel

from app.infra.auth.settings import SettingsThemeResult
from app.infra.profile_identity_context import ProfileIdentityContext
from app.routes.shared_types import (
    QGetAgentsV4Item,
    QGetCohortsV4Item,
    QGetDepartmentsV4Item,
    QGetProfileContextV4RoleResource,
    QGetProfileContextV4ThemeTokens,
    QGetSettingsV4Item,
    QGetSystemsV4Item,
    QGetToolsV4Item,
)


@dataclass
class AuthProfileInternalData:
    """Hydrated profile identity — identity context + departments + cohorts."""

    identity: ProfileIdentityContext
    profile_id: UUID
    scoped_roles: list[str]
    departments: list[QGetDepartmentsV4Item]
    cohorts: list[QGetCohortsV4Item]
    role_resources: list[QGetProfileContextV4RoleResource]
    session_id: UUID | None


@dataclass
class SettingsAgentToolEntry:
    """Flat agent→tool entry resolved from settings chain.

    Exactly one of resource/entry/artifact is set per tool:
    - resource: tool creates/uses a *_resource row (e.g. "names", "personas")
    - entry: tool creates a *_entry row (e.g. "contents", "feedbacks")
    - artifact: tool reads an artifact (e.g. "attempt", "persona")
    """

    agent_id: UUID
    tool_id: UUID
    is_creatable: bool  # from tools_resource.operation == 'create'
    resource: str | None = None  # e.g. "names", "personas", "objectives"
    entry: str | None = None  # e.g. "contents", "hints", "feedbacks"
    artifact: str | None = None  # e.g. "attempt", "persona", "scenario"

    @property
    def type_name(self) -> str:
        """The effective type name — exactly one of resource/entry/artifact."""
        return self.resource or self.entry or self.artifact or ""


@dataclass
class AuthSettingsInternalData:
    """Hydrated settings — settings resource + agents + tools + theme."""

    settings_id: UUID | None
    settings: QGetSettingsV4Item | None
    settings_systems: list[QGetSystemsV4Item]
    settings_agents: list[QGetAgentsV4Item]
    settings_tools: list[QGetToolsV4Item]
    settings_theme: SettingsThemeResult | None
    settings_tokens: QGetProfileContextV4ThemeTokens
    artifact_has_generate: dict[str, bool]
    agent_tool_entries: list[SettingsAgentToolEntry]


class GetProfileContextApiResponse(BaseModel):
    """Slim profile context response — only fields the client needs."""

    # Authorization
    is_authorized: bool | None = None
    # Profile basics
    id: UUID | None = None
    name: str | None = None
    role: str | None = None
    active: bool | None = None
    # Routing
    scoped_roles: list[str] | None = None
    available_sections: list[str] | None = None
    # Settings
    settings_id: str | None = None
    settings_success_threshold: int | None = None
    settings_warning_threshold: int | None = None
    settings_danger_threshold: int | None = None
    settings_tokens: QGetProfileContextV4ThemeTokens | None = None
    settings_agents: list[QGetAgentsV4Item] | None = None
    settings_tools: list[QGetToolsV4Item] | None = None
    # Resources
    role_resources: list[QGetProfileContextV4RoleResource] | None = None
    # Session
    session_id: UUID | None = None
    actor_name: str | None = None
    # Artifact generation capability
    artifact_has_generate: dict[str, bool] | None = None


class GetAuthProfileApiResponse(BaseModel):
    """Response for POST /auth/profile — identity + permissions."""

    is_authorized: bool | None = None
    id: UUID | None = None
    name: str | None = None
    role: str | None = None
    active: bool | None = None
    scoped_roles: list[str] | None = None
    available_sections: list[str] | None = None
    role_resources: list[QGetProfileContextV4RoleResource] | None = None
    session_id: UUID | None = None
    actor_name: str | None = None


class GetAuthSettingsApiResponse(BaseModel):
    """Response for POST /auth/settings — department-level settings + theme."""

    settings_id: str | None = None
    success_threshold: int | None = None
    warning_threshold: int | None = None
    danger_threshold: int | None = None
    tokens: QGetProfileContextV4ThemeTokens | None = None
    systems: list[QGetSystemsV4Item] | None = None
    agents: list[QGetAgentsV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None
    artifact_has_generate: dict[str, bool] | None = None


# ---------------------------------------------------------------------------
# Resolve group_id types
# ---------------------------------------------------------------------------


class ResolveGroupApiRequest(BaseModel):
    """Request body for POST /auth/group — resolve or create a group_id."""

    draft_id: UUID | None = None
    artifact_type: str | None = None
    attempt_id: UUID | None = None
    test_id: UUID | None = None


class ResolveGroupApiResponse(BaseModel):
    """Response for POST /auth/group — resolved group_id + optional attempt controls."""

    group_id: str
    show_controls: bool = False
    # Attempt controls (simulation path)
    attempt_id: str | None = None
    current_chat_id: str | None = None
    has_messages: bool = False
    # Test controls (benchmark path)
    test_id: str | None = None
    current_invocation_id: str | None = None
    has_runs_or_groups: bool = False


# ---------------------------------------------------------------------------
# Group messages types
# ---------------------------------------------------------------------------


class GroupMessageItem(BaseModel):
    """A single message within a group."""

    message_id: str | None = None
    run_id: str | None = None
    role: str | None = None
    message_created_at: str | None = None
    text_upload_ids: list[str] | None = None
    audio_upload_ids: list[str] | None = None
    image_upload_ids: list[str] | None = None
    video_upload_ids: list[str] | None = None
    file_upload_ids: list[str] | None = None
    call_upload_ids: list[str] | None = None


class GetGroupMessagesApiResponse(BaseModel):
    """Response model for /auth/group endpoint."""

    group_id: str | None = None
    group_name: str | None = None
    group_created_at: str | None = None
    session_id: str | None = None
    messages: list[GroupMessageItem] | None = None
    total_message_count: int = 0


# ---------------------------------------------------------------------------
# Analytics filters types
# ---------------------------------------------------------------------------


class AnalyticsFilterField(BaseModel):
    """Visibility/disabled state for a single filter field."""

    visible: bool = True
    disabled: bool = False


class AnalyticsFilterFields(BaseModel):
    """Per-page filter field visibility configuration."""

    date_range: AnalyticsFilterField = AnalyticsFilterField()
    departments: AnalyticsFilterField = AnalyticsFilterField()
    cohorts: AnalyticsFilterField = AnalyticsFilterField()
    roles: AnalyticsFilterField = AnalyticsFilterField()
    attempts: AnalyticsFilterField = AnalyticsFilterField()


class AnalyticsFilterOption(BaseModel):
    """A single filter option for dropdown selectors."""

    value: str
    label: str


class AnalyticsFacets(BaseModel):
    """Resolved analytics facets — embeddable in any artifact response.

    Contains filter field visibility, available options for dropdowns,
    and date range boundaries. Returned inline from artifact get/search
    responses so each page has its filter facets ready for SSR.
    """

    fields: AnalyticsFilterFields
    department_options: list[AnalyticsFilterOption] = []
    cohort_options: list[AnalyticsFilterOption] = []
    role_options: list[str] = []
    attempt_options: list[str] = []
    date_range_earliest: str | None = None
    date_range_latest: str | None = None


class GetAnalyticsFiltersApiResponse(AnalyticsFacets):
    """Response for POST /auth/analytics (backward-compatible)."""

    pass
