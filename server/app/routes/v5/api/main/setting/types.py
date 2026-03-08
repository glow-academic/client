"""Handcrafted types for settings artifact — GET, SAVE, DRAFT, LIST, DELETE, DUPLICATE."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.routes.v5.api.types import BaseResourceSection

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
    resource: dict | None = None
    resources: list | None = None


class SettingDescriptionSection(BaseResourceSection):
    resource: dict | None = None
    resources: list | None = None


# Flag section (uses SettingFlagConfig)
class SettingFlagSection(BaseResourceSection):
    current: SettingFlagConfig | None = None
    resources: list[SettingFlagConfig] | None = None


# Multi-select sections
class SettingColorSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class SettingDepartmentSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class SettingProfileSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class SettingAuthSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class SettingProviderKeySection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class SettingAuthItemKeySection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class SettingSystemSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


# ========== GET Endpoint Types ==========


class GetSettingApiRequest(BaseModel):
    """Request model for get setting endpoint."""

    model_config = ConfigDict(populate_by_name=True)

    setting_id: UUID | None = Field(default=None, alias="settings_id")
    color_search: str | None = None
    draft_id: UUID | None = None
    group_id: UUID
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
    systems: SettingSystemSection | None = None


# ========== Generation Completion Event ==========


class SettingGenerationCompleteEvent(BaseModel):
    """Typed event emitted on socket generation completion."""

    artifact_type: str = "setting"
    resource_type: str
    run_id: str | None = None
    group_id: str | None = None
    success: bool = False


# ========== Shared Save/Create/Update Types ==========


class SettingFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SettingResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    setting_id: UUID | None = None
    message: str
    errors: list[SettingFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateSettingItem(BaseModel):
    """Single setting item for create — no setting_id.

    Required fields (name): provide ID or value.
    """

    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    # Optional flag
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    color_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None
    provider_key_ids: list[UUID] | None = None
    auth_item_key_ids: list[UUID] | None = None
    auth_item_value_ids: list[UUID] | None = None
    system_ids: list[UUID] | None = None
    threshold_ids: list[UUID] | None = None
    setting_resource_ids: list[UUID] | None = None


class CreateSettingApiRequest(BaseModel):
    """Request model for bulk create setting endpoint."""

    settings: list[CreateSettingItem]
    group_id: UUID | None = None


class CreateSettingApiResponse(BaseModel):
    """Response model for bulk create setting endpoint."""

    results: list[SettingResultItem]


# ========== Update Endpoint Types ==========


class UpdateSettingItem(BaseModel):
    """Single setting item for update — setting_id required, all fields optional.

    Only provided fields are updated (partial update).
    """

    setting_id: UUID  # Required — which setting to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    # Optional flag
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    color_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None
    provider_key_ids: list[UUID] | None = None
    auth_item_key_ids: list[UUID] | None = None
    auth_item_value_ids: list[UUID] | None = None
    system_ids: list[UUID] | None = None
    threshold_ids: list[UUID] | None = None
    setting_resource_ids: list[UUID] | None = None


class UpdateSettingApiRequest(BaseModel):
    """Request model for bulk update setting endpoint."""

    settings: list[UpdateSettingItem]
    group_id: UUID | None = None


class UpdateSettingApiResponse(BaseModel):
    """Response model for bulk update setting endpoint."""

    results: list[SettingResultItem]


# ========== Legacy Save Endpoint Types (backwards compat) ==========


class SaveSettingFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveSettingItem(BaseModel):
    """Single setting item for save — provide ID or value per field (not both).

    For required fields (name), exactly one of the *_id or value field must be provided.
    """

    input_setting_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    # Optional flag
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    color_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None
    provider_key_ids: list[UUID] | None = None
    auth_item_key_ids: list[UUID] | None = None
    auth_item_value_ids: list[UUID] | None = None
    system_ids: list[UUID] | None = None
    threshold_ids: list[UUID] | None = None
    setting_resource_ids: list[UUID] | None = None


class SaveSettingApiRequest(BaseModel):
    """Request model for bulk save setting endpoint."""

    settings: list[SaveSettingItem]
    group_id: UUID | None = None


class SaveSettingResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    setting_id: UUID | None = None
    message: str
    errors: list[SaveSettingFieldError] | None = None


class SaveSettingApiResponse(BaseModel):
    """Response model for bulk save setting endpoint."""

    results: list[SaveSettingResult]


# ========== Draft Endpoint Types (composable infra) ==========


class PatchSettingDraftApiRequest(BaseModel):
    """Request model for new-style setting draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_id, department_ids, color_ids, profile_ids, auth_ids,
        provider_key_ids, auth_item_key_ids, threshold_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    group_id: UUID
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
    color_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None
    provider_key_ids: list[UUID] | None = None
    auth_item_key_ids: list[UUID] | None = None
    threshold_ids: list[UUID] | None = None


class PatchSettingDraftApiResponse(BaseModel):
    """Response model for new-style setting draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


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
    """Request model for bulk delete setting endpoint."""

    setting_ids: list[UUID]


class DeleteSettingResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    setting_id: UUID
    message: str


class DeleteSettingApiResponse(BaseModel):
    """Response model for bulk delete setting endpoint."""

    results: list[DeleteSettingResult]


# ========== Duplicate Endpoint Types ==========


class DuplicateSettingApiRequest(BaseModel):
    """Request model for duplicate setting endpoint."""

    setting_id: UUID


class DuplicateSettingApiResponse(BaseModel):
    """Response model for duplicate setting endpoint."""

    success: bool
    setting_id: UUID
    message: str
