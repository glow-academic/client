"""Handcrafted types for profile artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.infra.profile_create import CreateProfileItem
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection

# ---------------------------------------------------------------------------
# Handcrafted resource types (replaces Q types from app.sql.types)
# ---------------------------------------------------------------------------


class ProfileNameResource(BaseModel):
    """Name resource for profile."""

    id: UUID | None = None
    name: str | None = None
    generated: bool | None = None


class ProfileEmailResource(BaseModel):
    """Email resource for profile."""

    id: UUID | None = None
    email: str | None = None
    generated: bool | None = None


class ProfileRequestLimitResource(BaseModel):
    """Request limit resource for profile."""

    id: UUID | None = None
    requests_per_day: int | None = None
    generated: bool | None = None


class ProfileDepartmentResource(BaseModel):
    """Department resource for profile."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class ProfileRoleResource(BaseModel):
    """Role resource for profile."""

    id: UUID | None = None
    role: str | None = None
    name: str | None = None
    description: str | None = None
    icon_value: str | None = None
    color_hex: str | None = None


class ProfileFlagConfig(BaseModel):
    """Enriched profile flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class ProfileDraftEntry(BaseModel):
    """Draft entry for profile."""

    id: UUID | None = None
    version: int | None = None
    created_at: datetime | None = None
    generated: bool | None = None
    mcp: bool | None = None
    active: bool | None = None
    group_id: UUID | None = None
    session_id: UUID | None = None
    department_ids: list[UUID] | None = None
    email_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    name_ids: list[UUID] | None = None
    request_limit_ids: list[UUID] | None = None
    role_ids: list[UUID] | None = None


# ---------------------------------------------------------------------------
# Section types
# ---------------------------------------------------------------------------


class ProfileNameSection(BaseResourceSection):
    resource: ProfileNameResource | None = None
    resources: list[ProfileNameResource] | None = None


class ProfileRequestLimitSection(BaseResourceSection):
    resource: ProfileRequestLimitResource | None = None
    resources: list[ProfileRequestLimitResource] | None = None


class ProfileFlagSection(BaseResourceSection):
    current: ProfileFlagConfig | None = None
    resources: list[ProfileFlagConfig] | None = None


class ProfileEmailSection(BaseResourceSection):
    current: list[ProfileEmailResource] | None = None
    resources: list[ProfileEmailResource] | None = None


class ProfileDepartmentSection(BaseResourceSection):
    current: list[ProfileDepartmentResource] | None = None
    resources: list[ProfileDepartmentResource] | None = None


class ProfileRoleSection(BaseResourceSection):
    current: list[ProfileRoleResource] | None = None
    resources: list[ProfileRoleResource] | None = None


# ---------------------------------------------------------------------------
# GET endpoint types
# ---------------------------------------------------------------------------


class GetProfileApiRequest(BaseModel):
    target_profile_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID


class GetProfileApiResponse(BaseModel):
    actor_name: str | None = None
    profile_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None
    profile_id: UUID | None = None

    role: str | None = None
    role_options: list[str] | None = None

    basic_show_ai_generate: bool | None = None
    general_show_ai_generate: bool | None = None

    names: ProfileNameSection | None = None
    emails: ProfileEmailSection | None = None
    request_limits: ProfileRequestLimitSection | None = None
    flags: ProfileFlagSection | None = None
    departments: ProfileDepartmentSection | None = None
    roles: ProfileRoleSection | None = None


# ========== Shared Create/Update Types ==========


class ProfileFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class ProfileResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    profile_id: UUID | None = None
    message: str
    errors: list[ProfileFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateProfileApiRequest(BaseModel):
    """Request model for bulk create profile endpoint."""

    profiles: list[CreateProfileItem]
    group_id: UUID | None = None


class CreateProfileApiResponse(BaseModel):
    """Response model for bulk create profile endpoint."""

    results: list[ProfileResultItem]


# ========== Update Endpoint Types ==========


class UpdateProfileItem(BaseModel):
    """Single profile item for update — profile_id required, all fields optional."""

    profile_id: UUID  # Required — which profile to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    request_limit_id: UUID | None = None
    flag_id: UUID | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    email_ids: list[UUID] | None = None
    role_ids: list[UUID] | None = None


class UpdateProfileApiRequest(BaseModel):
    """Request model for bulk update profile endpoint."""

    profiles: list[UpdateProfileItem]
    group_id: UUID | None = None


class UpdateProfileApiResponse(BaseModel):
    """Response model for bulk update profile endpoint."""

    results: list[ProfileResultItem]


# ========== Legacy Save Types (backwards compat) ==========


class SaveProfileFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveProfileItem(BaseModel):
    """Single profile item for save — provide ID or value per field (not both).

    For required fields (name), exactly one of the *_id or value field must be provided.
    """

    input_profile_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide IDs only
    request_limit_id: UUID | None = None
    flag_id: UUID | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    email_ids: list[UUID] | None = None
    role_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None


class SaveProfileApiRequest(BaseModel):
    """Request model for bulk save profile endpoint."""

    profiles: list[SaveProfileItem]
    group_id: UUID | None = None


class SaveProfileResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    profile_id: UUID | None = None
    message: str
    errors: list[SaveProfileFieldError] | None = None


class SaveProfileApiResponse(BaseModel):
    """Response model for bulk save profile endpoint."""

    results: list[SaveProfileResult]


class DeleteProfileApiRequest(BaseModel):
    """Request model for bulk delete profile endpoint."""

    profile_ids: list[UUID]


class DeleteProfileResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    profile_id: UUID
    message: str


class DeleteProfileApiResponse(BaseModel):
    """Response model for bulk delete profile endpoint."""

    results: list[DeleteProfileResult]


class DuplicateProfileApiRequest(BaseModel):
    target_profile_id: UUID


class DuplicateProfileApiResponse(BaseModel):
    success: bool
    profile_id: UUID
    message: str


# ========== Draft Endpoint Types (composable infra) ==========


class PatchProfileDraftApiRequest(BaseModel):
    """Request model for new-style profile draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id
    ID-only for non-creatable resources:
      - flag_id, department_ids, email_ids, role_ids, request_limit_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    group_id: UUID
    input_draft_id: UUID | None = None
    expected_version: int = 0

    # Creatable single-select — provide value or ID
    name: str | None = None
    name_id: UUID | None = None

    # Non-creatable — ID-only
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    email_ids: list[UUID] | None = None
    role_ids: list[UUID] | None = None
    request_limit_ids: list[UUID] | None = None


class PatchProfileDraftApiResponse(BaseModel):
    """Response model for new-style profile draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


# ========== List Endpoint Types ==========


# ========== Export Endpoint Types ==========


class ExportProfileApiResponse(BaseModel):
    """Response model for export profile endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int


class ListProfilesApiProfile(BaseModel):
    """Profile type for list endpoint with computed permissions."""

    profile_id: UUID | None = None
    emails: list[str] | None = None
    primary_email: str | None = None
    name: str | None = None
    role: str | None = None
    initials: str | None = None
    department_ids: list[str] | None = None
    primary_department_id: str | None = None
    requests_per_day: int | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None


class ListProfilesApiResponse(BaseModel):
    """Response model for profiles list endpoint with computed permissions."""

    actor_name: str | None = None
    profiles: list[ListProfilesApiProfile] | None = None
    department_filter: ListFilterSection | None = None
    role_filter: ListFilterSection | None = None
    total_count: int | None = None
