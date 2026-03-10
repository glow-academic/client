"""Types for profile context internal + HTTP layers."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel

from app.infra.identity.settings import SettingsThemeResult
from app.routes.shared_types import (
    QGetAgentsV4Item,
    QGetProfileContextV4ThemeTokens,
    QGetSettingsV4Item,
    QGetSystemsV4Item,
    QGetToolsV4Item,
)


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
