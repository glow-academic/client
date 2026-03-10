"""Handcrafted types for profile artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.infra.profile.create import CreateProfileItem
from app.routes.shared_types import QGetProfileContextV4RoleResource
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.routes.v5.tools.entries.profile_drafts.types import GetProfileDraftResponse

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


class GetProfileDraftsApiResponse(BaseModel):
    """Response model for profile drafts list endpoint."""

    entries: list[GetProfileDraftResponse] | None = None


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


class UpdateProfileApiResponse(BaseModel):
    """Response model for bulk update profile endpoint."""

    results: list[ProfileResultItem]


class SaveProfileFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


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

    input_draft_id: UUID | None = None
    expected_version: int = 0

    # Creatable single-select — provide value or ID
    name: str | None = None
    name_id: UUID | None = None
    email: str | None = None
    request_limit: int | None = None

    # Non-creatable — ID-only
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    email_ids: list[UUID] | None = None
    role_ids: list[UUID] | None = None
    request_limit_ids: list[UUID] | None = None


class ProfileDraftFormState(BaseModel):
    """Server-authoritative form state returned after draft save."""

    name_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID]
    email_ids: list[UUID]
    role_ids: list[UUID]
    request_limit_ids: list[UUID]


class PatchProfileDraftApiResponse(BaseModel):
    """Response model for new-style profile draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
    form_state: ProfileDraftFormState | None = None


# ========== List Endpoint Types ==========


# ========== Export Endpoint Types ==========


class ExportProfileApiResponse(BaseModel):
    """Response model for export profile endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int


# ========== Emulate Endpoint Types ==========


class EmulateProfileApiRequest(BaseModel):
    """Request model for profile emulation."""

    target_profile_id: UUID
    ttl_minutes: int | None = 120


class EmulateProfileApiResponse(BaseModel):
    """Response model for profile emulation."""

    allowed: bool
    reason: str | None = None
    grant_id: UUID | None = None
    expires_at: datetime | None = None


# ========== Unemulate Endpoint Types ==========


class UnemulateProfileApiResponse(BaseModel):
    """Response model for exiting emulation (peel one layer)."""

    ok: bool
    reason: str | None = None


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


# ========== Context Endpoint Types ==========


class ThemePrimitives(BaseModel):
    """Raw theme color primitives (hex values) from settings.

    General-purpose — not CSS-specific. Clients derive their own
    presentation tokens (oklch, CSS variables, etc.) from these.
    """

    primary: str | None = None
    accent: str | None = None
    background: str | None = None
    surface: str | None = None
    success: str | None = None
    warning: str | None = None
    error: str | None = None
    chart1: str | None = None
    chart2: str | None = None
    chart3: str | None = None
    chart4: str | None = None
    chart5: str | None = None


class ProfileContextApiResponse(BaseModel):
    """Response for POST /artifacts/profiles/context — identity + permissions + theme.

    Thin wrapper over resolve_profile_identity_context().
    Replaces the old /auth/profile and /auth/settings endpoints.
    """

    # Identity
    id: UUID | None = None
    name: str | None = None
    role: str | None = None
    active: bool | None = None

    # Routing & permissions
    role_artifacts: list[str] | None = None
    available_sections: list[str] | None = None
    scoped_roles: list[str] | None = None

    # Departments
    department_ids: list[str] | None = None
    primary_department_id: str | None = None

    # Settings
    settings_id: str | None = None

    # Theme (raw color primitives from settings)
    theme: ThemePrimitives | None = None

    # Session
    session_id: UUID | None = None

    # Emulation
    is_emulation: bool | None = None
    emulation_depth: int | None = None

    # Role resources (all roles — for emulation role display)
    role_resources: list[QGetProfileContextV4RoleResource] | None = None
