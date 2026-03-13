"""Types for auth artifact — internal context + HTTP boundary types."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel

from app.infra.auth.create import CreateAuthItem
from app.infra.identity.settings import SettingsThemeResult
from app.infra.shared_types import (
    QGetAgentsV4Item,
    QGetProfileContextV4ThemeTokens,
    QGetSettingsV4Item,
    QGetSystemsV4Item,
    QGetToolsV4Item,
)
from app.infra.v5_types import BaseResourceSection, ListFilterSection
from app.tools.v5.entries.auth_drafts.types import GetAuthDraftResponse


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


# ---------------------------------------------------------------------------
# Auth artifact HTTP boundary types
# ---------------------------------------------------------------------------


class AuthFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class AuthItemResource(BaseModel):
    """Auth item resource shape for client/editing."""

    auth_item_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    position: int | None = None
    active: bool | None = None
    value_masked: str | None = None
    key_id: UUID | None = None
    encrypted: bool | None = None
    generated: bool | None = None


class AuthNameSection(BaseResourceSection):
    resource: object | None = None
    resources: list | None = None


class AuthDescriptionSection(BaseResourceSection):
    resource: object | None = None
    resources: list | None = None


class AuthFlagSection(BaseResourceSection):
    current: list[AuthFlagConfig] | None = None
    resources: list[AuthFlagConfig] | None = None


class AuthProtocolSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class AuthSlugSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class AuthItemSection(BaseResourceSection):
    current: list[AuthItemResource] | None = None
    resources: list[AuthItemResource] | None = None


class GetAuthApiRequest(BaseModel):
    """Request model for get auth endpoint."""

    auth_id: UUID | None = None
    draft_id: UUID | None = None


class GetAuthApiResponse(BaseModel):
    """Response model for get auth endpoint."""

    actor_name: str | None = None
    auth_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None

    names: AuthNameSection | None = None
    descriptions: AuthDescriptionSection | None = None
    flags: AuthFlagSection | None = None
    protocols: AuthProtocolSection | None = None
    slugs: AuthSlugSection | None = None
    items: AuthItemSection | None = None


class GetAuthDraftsApiResponse(BaseModel):
    """Response model for auth drafts list endpoint."""

    entries: list[GetAuthDraftResponse] | None = None


# ========== Shared Create/Update Types ==========


class AuthFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class AuthResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    auth_id: UUID | None = None
    message: str
    errors: list[AuthFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateAuthApiRequest(BaseModel):
    """Request model for bulk create auth endpoint."""

    auths: list[CreateAuthItem]


class CreateAuthApiResponse(BaseModel):
    """Response model for bulk create auth endpoint."""

    results: list[AuthResultItem]


# ========== Update Endpoint Types ==========


class UpdateAuthItem(BaseModel):
    """Single auth item for update — auth_id required, all fields optional."""

    auth_id: UUID  # Required — which auth to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    slug_id: UUID | None = None
    slug: str | None = None
    # Optional flag
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    protocol_ids: list[UUID] | None = None
    protocol: str | None = None
    item_ids: list[UUID] | None = None
    auth_resource_ids: list[UUID] | None = None


class UpdateAuthApiRequest(BaseModel):
    """Request model for bulk update auth endpoint."""

    auths: list[UpdateAuthItem]


class UpdateAuthApiResponse(BaseModel):
    """Response model for bulk update auth endpoint."""

    results: list[AuthResultItem]


class SaveAuthFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class DeleteAuthApiRequest(BaseModel):
    """Request model for bulk delete auth endpoint."""

    auth_ids: list[UUID]


class DeleteAuthResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    auth_id: UUID
    message: str


class DeleteAuthApiResponse(BaseModel):
    """Response model for bulk delete auth endpoint."""

    results: list[DeleteAuthResult]


class DuplicateAuthApiRequest(BaseModel):
    """Request model for duplicate auth endpoint."""

    auth_id: UUID


class DuplicateAuthApiResponse(BaseModel):
    """Response model for duplicate auth endpoint."""

    success: bool
    auth_id: UUID
    message: str


# ========== Draft Endpoint Types (composable infra) ==========


class PatchAuthDraftApiRequest(BaseModel):
    """Request model for new-style auth draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_id, department_ids, protocol_ids, slug_ids, item_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    input_draft_id: UUID | None = None
    expected_version: int = 0

    # Creatable single-select — provide value or ID
    name: str | None = None
    name_id: UUID | None = None
    description: str | None = None
    description_id: UUID | None = None

    # Non-creatable — ID-only
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    protocol_ids: list[UUID] | None = None
    slug_ids: list[UUID] | None = None
    item_ids: list[UUID] | None = None


class AuthDraftFormState(BaseModel):
    """Server-authoritative form state returned after draft save."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID]
    protocol_ids: list[UUID]
    slug_ids: list[UUID]
    item_ids: list[UUID]


class PatchAuthDraftApiResponse(BaseModel):
    """Response model for new-style auth draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
    form_state: AuthDraftFormState | None = None


# ========== Export Endpoint Types ==========


class ExportAuthApiRequest(BaseModel):
    """Request model for auth export."""

    auth_id: UUID | None = None


class ExportAuthApiResponse(BaseModel):
    """Response model for export auth endpoint."""

    content: str
    file_name: str
    mime_type: str
    row_count: int


class ListAuthApiAuth(BaseModel):
    """Auth type for list endpoint with computed permissions."""

    auth_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    item_count: int | None = None
    department_ids: list[str] | None = None
    is_inactive: bool | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None


class ListAuthApiResponse(BaseModel):
    """Response model for list auth endpoint with computed permissions."""

    actor_name: str | None = None
    auths: list[ListAuthApiAuth] | None = None
    department_filter: ListFilterSection | None = None
    total_count: int | None = None
