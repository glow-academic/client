"""Handcrafted types for department GET endpoint."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import DomainAgent, DomainData

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]


class DepartmentFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "active"
    label: str  # e.g., "Active"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None  # ID to use when enabling
    show: bool = True
    required: bool = False
    domain_id: UUID | None = None  # Domain ID for generation
    generated: bool | None = None


class GetDepartmentApiRequest(BaseModel):
    """Request model for get department endpoint."""

    department_id: UUID | None = None
    draft_id: UUID | None = None


class GetDepartmentApiResponse(BaseModel):
    """Response model for get department endpoint."""

    # Required fields
    actor_name: str | None = None
    department_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    settings_group_id: UUID | None = None

    # Single-select resources: name
    show_name: bool | None = None
    name_domain_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    name_show_ai_generate: bool | None = None

    # Single-select resources: description
    show_description: bool | None = None
    description_domain_id: UUID | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    description_show_ai_generate: bool | None = None

    # Single-select resources: flag
    show_flag: bool | None = None
    flag_domain_id: UUID | None = None
    flag_required: bool | None = None
    flag_show_ai_generate: bool | None = None

    # Multi-select resources: settings
    show_settings: bool | None = None
    settings_domain_id: UUID | None = None
    settings_required: bool | None = None
    settings_suggestions: list[UUID] | None = None
    settings_show_ai_generate: bool | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None
    settings_step_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs (for AI generation)
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs (for AI suggestions)
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    settings_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: DepartmentResources | None = None


class GetDepartmentWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_department_websocket).

    Contains only what's needed for AI generation:
    - Domain IDs (for domain_to_resource mapping)
    - Domains list (for agent_id lookup)
    - Group ID (for existing group context)
    - Resources (for Jinja template context)
    """

    group_id: UUID | None = None

    # Domain IDs for domain_to_resource mapping
    name_domain_id: UUID | None = None
    description_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    settings_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: DepartmentResources | None = None


class DepartmentResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list | None = None  # list[QGetNamesV4Item]
    descriptions: list | None = None  # list[QGetDescriptionsV4Item]
    flags: list[DepartmentFlagConfig] | None = None
    settings: list | None = None  # list[QGetSettingsV4Item]


class DepartmentResources(BaseModel):
    """Full resources + current selections."""

    resources: DepartmentResourceBucket | None = None
    current: DepartmentResourceBucket | None = None


# ========== List Endpoint Types ==========


class ListDepartmentApiDepartment(BaseModel):
    """Department type for list endpoint with computed permissions."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    staff_count: int | None = None
    is_inactive: bool | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListDepartmentApiCohort(BaseModel):
    """Cohort type for list endpoint."""

    cohort_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListDepartmentApiProfile(BaseModel):
    """Profile type for list endpoint."""

    profile_id: UUID | None = None
    name: str | None = None
    count: int | None = None


class ListDepartmentApiResponse(BaseModel):
    """Response model for list department endpoint with computed permissions."""

    actor_name: str | None = None
    departments: list[ListDepartmentApiDepartment] | None = None
    cohorts: list[ListDepartmentApiCohort] | None = None
    profiles: list[ListDepartmentApiProfile] | None = None
    total_count: int | None = None


# ========== Save Endpoint Types ==========


class SaveDepartmentApiRequest(BaseModel):
    """Request model for save department endpoint - accepts form data directly (no draft_id)."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_department_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    settings_ids: list[UUID] | None = None


class SaveDepartmentApiResponse(BaseModel):
    """Response model for save department endpoint."""

    success: bool
    department_id: UUID
    message: str


class SaveDepartmentSqlParams(BaseModel):
    """SQL parameters for save department - accepts form data directly (no draft_id)."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED - which group to save to
    input_department_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    settings_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_department_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.settings_ids,
        )


class SaveDepartmentSqlRow(BaseModel):
    """SQL row for save department."""

    department_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteDepartmentApiRequest(BaseModel):
    """Request model for delete department endpoint."""

    department_id: UUID


class DeleteDepartmentApiResponse(BaseModel):
    """Response model for delete department endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateDepartmentApiRequest(BaseModel):
    """Request model for duplicate department endpoint."""

    department_id: UUID


class DuplicateDepartmentApiResponse(BaseModel):
    """Response model for duplicate department endpoint."""

    success: bool
    department_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchDepartmentDraftApiRequest(BaseModel):
    """Request model for patch department draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    settings_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchDepartmentDraftApiResponse(BaseModel):
    """Response model for patch department draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
