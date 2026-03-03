"""Handcrafted types for settings artifact — GET, SAVE, DRAFT, LIST, DELETE, DUPLICATE."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.routes.v5.api.main.types import InternalResponseBase
from app.routes.v5.api.types import BaseResourceSection
from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse
from app.sql.types import (
    QGetAgentsV4Item,
    QGetAuthItemKeysV4Item,
    QGetAuthsV4Item,
    QGetColorsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetProfilesV4Item,
    QGetProviderKeysV4Item,
    QGetProvidersV4Item,
    QGetRolesV4Item,
    QGetSettingDraftsEntriesV4Item,
)

# ========== Flag Enrichment ==========


class SettingFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "active"
    label: str  # e.g., "Active"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None  # ID to use when enabling
    show: bool = True
    required: bool = False
    generated: bool | None = None


# ========== Per-Resource Section Types ==========


# Single-select sections
class SettingNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class SettingDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


# Flag section (uses SettingFlagConfig)
class SettingFlagSection(BaseResourceSection):
    current: SettingFlagConfig | None = None
    resources: list[SettingFlagConfig] | None = None


# Multi-select sections
class SettingColorSection(BaseResourceSection):
    current: list[QGetColorsV4Item] | None = None
    resources: list[QGetColorsV4Item] | None = None


class SettingDepartmentSection(BaseResourceSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class SettingProfileSection(BaseResourceSection):
    current: list[QGetProfilesV4Item] | None = None
    resources: list[QGetProfilesV4Item] | None = None


class SettingAuthSection(BaseResourceSection):
    current: list[QGetAuthsV4Item] | None = None
    resources: list[QGetAuthsV4Item] | None = None


class SettingProviderKeySection(BaseResourceSection):
    current: list[QGetProviderKeysV4Item] | None = None
    resources: list[QGetProviderKeysV4Item] | None = None


class SettingAuthItemKeySection(BaseResourceSection):
    current: list[QGetAuthItemKeysV4Item] | None = None
    resources: list[QGetAuthItemKeysV4Item] | None = None


class SettingRoleSection(BaseResourceSection):
    current: list[QGetRolesV4Item] | None = None
    resources: list[QGetRolesV4Item] | None = None


# ========== GET Endpoint Types ==========


class GetSettingApiRequest(BaseModel):
    """Request model for get setting endpoint."""

    model_config = ConfigDict(populate_by_name=True)

    setting_id: UUID | None = Field(default=None, alias="settings_id")
    color_search: str | None = None
    draft_id: UUID | None = None
    # Optional group_id from layout context (avoids server-side creation)
    group_id: UUID | None = None
    mcp: bool | None = False


class GetSettingApiResponse(BaseModel):
    """Section-first response model for get setting endpoint."""

    # Context
    actor_name: str | None = None
    setting_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    # Per-resource sections (10 total)
    names: SettingNameSection | None = None
    descriptions: SettingDescriptionSection | None = None
    colors: SettingColorSection | None = None
    flags: SettingFlagSection | None = None
    departments: SettingDepartmentSection | None = None
    profiles: SettingProfileSection | None = None
    auths: SettingAuthSection | None = None
    provider_keys: SettingProviderKeySection | None = None
    auth_item_keys: SettingAuthItemKeySection | None = None
    roles: SettingRoleSection | None = None


# ========== Websocket Types ==========


class SettingWebsocketEntries(BaseModel):
    """Entries data for websocket response."""

    draft_setting: QGetSettingDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class SettingWebsocketResources(BaseModel):
    """Hydrated resources for websocket — selected only, no suggestions."""

    # 10 setting resources
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    colors: list[QGetColorsV4Item] | None = None
    flags: list[SettingFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    profiles: list[QGetProfilesV4Item] | None = None
    auths: list[QGetAuthsV4Item] | None = None
    provider_keys: list[QGetProviderKeysV4Item] | None = None
    auth_item_keys: list[QGetAuthItemKeysV4Item] | None = None
    roles: list[QGetRolesV4Item] | None = None


class GetSettingWebsocketResponse(InternalResponseBase):
    """Minimal response for WebSocket handlers (get_setting_websocket).

    Uses views + resources pattern:
    - Views: draft setting view (convenience for Jinja templates)
    - Resources: hydrated selected objects + config for generation
    """

    entries: SettingWebsocketEntries | None = None
    resources: SettingWebsocketResources


# ========== Generation Completion Event ==========


class SettingGenerationCompleteEvent(BaseModel):
    """Typed event emitted on socket generation completion."""

    artifact_type: str = "setting"
    resource_type: str
    run_id: str | None = None
    group_id: str | None = None
    success: bool = False
    # Hydrated resources (only one populated per event)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    color_resources: list[QGetColorsV4Item] | None = None
    flag_resource: SettingFlagConfig | None = None
    department_resources: list[QGetDepartmentsV4Item] | None = None
    profile_resources: list[QGetProfilesV4Item] | None = None
    auth_resources: list[QGetAuthsV4Item] | None = None
    provider_key_resources: list[QGetProviderKeysV4Item] | None = None
    auth_item_key_resources: list[QGetAuthItemKeysV4Item] | None = None
    role_resources: list[QGetRolesV4Item] | None = None


# ========== Internal Data Types ==========


class SettingResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    colors: list[QGetColorsV4Item] | None = None
    flags: list[SettingFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    profiles: list[QGetProfilesV4Item] | None = None
    auths: list[QGetAuthsV4Item] | None = None
    provider_keys: list[QGetProviderKeysV4Item] | None = None
    auth_item_keys: list[QGetAuthItemKeysV4Item] | None = None
    roles: list[QGetRolesV4Item] | None = None


class SettingResources(BaseModel):
    """Full resources + current selections."""

    resources: SettingResourceBucket | None = None
    current: SettingResourceBucket | None = None


@dataclass
class SettingInternalData:
    """Internal data from core setting fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_setting_websocket() - minimal data for WebSocket handlers
    - get_setting_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    setting_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    # Agent mappings (resource_type -> agent_id)
    resource_agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_map: dict[str, bool]
    required_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: agent exists for resource)
    show_ai_generate_map: dict[str, bool]

    # Resources payload
    resources_payload: SettingResources

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    # Config resources (from denormalized chain, for generation)
    config_agent_resources: list[QGetAgentsV4Item] | None
    config_model_resources: list[QGetModelsV4Item] | None
    config_provider_resources: list[QGetProvidersV4Item] | None


# ========== Resource Action Types (for tool call tracking) ==========


class SettingResourceAction(BaseModel):
    """Single-select resource with tool call tracking."""

    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SettingMultiResourceAction(BaseModel):
    """Multi-select resource with tool call tracking."""

    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


# ========== Save Endpoint Types ==========


class SaveSettingApiRequest(BaseModel):
    """Request model for save setting endpoint - flat resource IDs."""

    input_setting_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    flag_id: UUID | None = None
    color_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None
    provider_key_ids: list[UUID] | None = None
    auth_item_key_ids: list[UUID] | None = None
    role_ids: list[UUID] | None = None


class SaveSettingApiResponse(BaseModel):
    """Response model for save setting endpoint."""

    success: bool = True
    setting_id: UUID
    message: str = ""
    actor_name: str | None = None


class SaveSettingSqlParams(BaseModel):
    """SQL parameters for save setting - nested resource actions with tool call tracking."""

    profile_id: UUID
    group_id: UUID | None = None
    input_setting_id: UUID | None = None
    names: SettingResourceAction
    descriptions: SettingResourceAction
    colors: SettingMultiResourceAction
    flags: SettingResourceAction
    departments: SettingMultiResourceAction
    profiles: SettingMultiResourceAction
    auths: SettingMultiResourceAction
    provider_keys: SettingMultiResourceAction
    auth_item_keys: SettingMultiResourceAction
    roles: SettingMultiResourceAction

    @classmethod
    def from_request(
        cls,
        request: SaveSettingApiRequest,
        profile_id: UUID,
        group_id: UUID | None,
    ) -> SaveSettingSqlParams:
        return cls(
            profile_id=profile_id,
            group_id=group_id,
            input_setting_id=request.input_setting_id,
            names=SettingResourceAction(resource_id=request.name_id),
            descriptions=SettingResourceAction(resource_id=request.description_id),
            flags=SettingResourceAction(resource_id=request.flag_id),
            colors=SettingMultiResourceAction(resource_ids=request.color_ids),
            departments=SettingMultiResourceAction(resource_ids=request.department_ids),
            profiles=SettingMultiResourceAction(resource_ids=request.profile_ids),
            auths=SettingMultiResourceAction(resource_ids=request.auth_ids),
            provider_keys=SettingMultiResourceAction(
                resource_ids=request.provider_key_ids
            ),
            auth_item_keys=SettingMultiResourceAction(
                resource_ids=request.auth_item_key_ids
            ),
            roles=SettingMultiResourceAction(resource_ids=request.role_ids),
        )

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""

        def single(a: SettingResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: SettingMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.group_id,
            self.input_setting_id,
            single(self.names),
            single(self.descriptions),
            multi(self.colors),
            single(self.flags),
            multi(self.departments),
            multi(self.profiles),
            multi(self.auths),
            multi(self.provider_keys),
            multi(self.auth_item_keys),
            multi(self.roles),
        )


class SaveSettingSqlRow(BaseModel):
    """SQL row for save setting."""

    setting_id: UUID | None = None


# ========== Draft Endpoint Types ==========


class PatchSettingDraftApiRequest(BaseModel):
    """Request model for patch setting draft endpoint - flat resource IDs."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    color_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None
    provider_key_ids: list[UUID] | None = None
    auth_item_key_ids: list[UUID] | None = None
    role_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchSettingDraftApiResponse(BaseModel):
    """Response model for patch setting draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchSettingDraftSqlParams(BaseModel):
    """SQL parameters for patch setting draft - nested resource actions."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: SettingResourceAction
    descriptions: SettingResourceAction
    flags: SettingResourceAction
    colors: SettingMultiResourceAction
    departments: SettingMultiResourceAction
    profiles: SettingMultiResourceAction
    auths: SettingMultiResourceAction
    provider_keys: SettingMultiResourceAction
    auth_item_keys: SettingMultiResourceAction
    roles: SettingMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls,
        request: PatchSettingDraftApiRequest,
        profile_id: UUID,
    ) -> PatchSettingDraftSqlParams:
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=SettingResourceAction(resource_id=request.name_id),
            descriptions=SettingResourceAction(resource_id=request.description_id),
            flags=SettingResourceAction(resource_id=request.flag_id),
            colors=SettingMultiResourceAction(resource_ids=request.color_ids),
            departments=SettingMultiResourceAction(resource_ids=request.department_ids),
            profiles=SettingMultiResourceAction(resource_ids=request.profile_ids),
            auths=SettingMultiResourceAction(resource_ids=request.auth_ids),
            provider_keys=SettingMultiResourceAction(
                resource_ids=request.provider_key_ids
            ),
            auth_item_keys=SettingMultiResourceAction(
                resource_ids=request.auth_item_key_ids
            ),
            roles=SettingMultiResourceAction(resource_ids=request.role_ids),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""

        def single(a: SettingResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: SettingMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.colors),
            multi(self.departments),
            multi(self.profiles),
            multi(self.auths),
            multi(self.provider_keys),
            multi(self.auth_item_keys),
            multi(self.roles),
            self.expected_version,
        )


class PatchSettingDraftSqlRow(BaseModel):
    """SQL row for patch setting draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# ========== List Endpoint Types ==========


class ListSettingApiSetting(BaseModel):
    """Setting type for list endpoint with computed permissions."""

    settings_id: UUID | None = None
    created_at: datetime | None = None
    active: bool | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None


class ListSettingApiKey(BaseModel):
    """Key type for list endpoint."""

    key_id: UUID | None = None
    name: str | None = None
    key_masked: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None


class ListSettingApiResponse(BaseModel):
    """Response model for list setting endpoint."""

    actor_name: str | None = None
    user_role: str | None = None
    settings: list[ListSettingApiSetting] | None = None
    keys: list[ListSettingApiKey] | None = None


# ========== Delete Endpoint Types ==========


class DeleteSettingApiRequest(BaseModel):
    """Request model for delete setting endpoint."""

    setting_id: UUID


class DeleteSettingApiResponse(BaseModel):
    """Response model for delete setting endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateSettingApiRequest(BaseModel):
    """Request model for duplicate setting endpoint."""

    setting_id: UUID


class DuplicateSettingApiResponse(BaseModel):
    """Response model for duplicate setting endpoint."""

    success: bool
    setting_id: UUID
    message: str
