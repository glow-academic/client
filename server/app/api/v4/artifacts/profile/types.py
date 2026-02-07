"""Handcrafted types for profile GET endpoint."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.resources.cohorts.get import QGetCohortsV4Item
from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetEmailsV4Item,
    QGetNamesV4Item,
    QGetRequestLimitsV4Item,
)

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]


class ProfileFlagConfig(BaseModel):
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


class GetProfileApiRequest(BaseModel):
    """Request model for get profile endpoint."""

    target_profile_id: UUID | None = None
    draft_id: UUID | None = None


class GetProfileApiResponse(BaseModel):
    """Response model for get profile endpoint."""

    # Required fields
    actor_name: str | None = None
    profile_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Profile ID (resolved target)
    profile_id: UUID | None = None

    # Role
    role: str | None = None
    role_options: list[str] | None = None
    roles: list[ProfileRoleResource] | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    emails_group_id: UUID | None = None
    request_limits_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    departments_group_id: UUID | None = None
    cohorts_group_id: UUID | None = None

    # Single-select resources: name
    show_name: bool | None = None
    name_domain_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    name_show_ai_generate: bool | None = None

    # Multi-select resources: emails
    show_emails: bool | None = None
    emails_domain_id: UUID | None = None
    emails_required: bool | None = None
    email_suggestions: list[UUID] | None = None
    emails_show_ai_generate: bool | None = None

    # Single-select resources: request_limit
    show_request_limit: bool | None = None
    request_limits_domain_id: UUID | None = None
    request_limit_required: bool | None = None
    request_limit_suggestions: list[UUID] | None = None
    request_limits_show_ai_generate: bool | None = None

    # Single-select resources: flag
    show_flag: bool | None = None
    flag_domain_id: UUID | None = None
    flag_required: bool | None = None
    flag_show_ai_generate: bool | None = None

    # Multi-select resources: departments
    show_departments: bool | None = None
    departments_domain_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments_show_ai_generate: bool | None = None

    # Multi-select resources: cohorts
    show_cohorts: bool | None = None
    cohorts_domain_id: UUID | None = None
    cohorts_required: bool | None = None
    cohort_suggestions: list[UUID] | None = None
    cohorts_show_ai_generate: bool | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None
    general_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs (for AI generation)
    name_create_tool_id: UUID | None = None
    emails_create_tool_id: UUID | None = None
    request_limits_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs (for AI suggestions)
    name_link_tool_id: UUID | None = None
    emails_link_tool_id: UUID | None = None
    request_limits_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    departments_link_tool_id: UUID | None = None
    cohorts_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: ProfileResources | None = None


class GetProfileWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_profile_websocket).

    Contains only what's needed for AI generation:
    - Domain IDs (for domain_to_resource mapping)
    - Domains list (for agent_id lookup)
    - Group ID (for existing group context)
    - Resources (for Jinja template context)
    """

    group_id: UUID | None = None

    # Domain IDs for domain_to_resource mapping
    name_domain_id: UUID | None = None
    emails_domain_id: UUID | None = None
    request_limits_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    departments_domain_id: UUID | None = None
    cohorts_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: ProfileResources | None = None


class ProfileRoleResource(BaseModel):
    """Role resource for profile."""

    role: str | None = None
    name: str | None = None
    description: str | None = None
    icon_value: str | None = None
    color_hex: str | None = None


class ProfileResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[QGetNamesV4Item] | None = None
    emails: list[QGetEmailsV4Item] | None = None
    request_limits: list[QGetRequestLimitsV4Item] | None = None
    flags: list[ProfileFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    cohorts: list[QGetCohortsV4Item] | None = None


class ProfileResources(BaseModel):
    """Full resources + current selections."""

    resources: ProfileResourceBucket | None = None
    current: ProfileResourceBucket | None = None


# ========== Save Endpoint Types ==========


class SaveProfileApiRequest(BaseModel):
    """Request model for save profile endpoint - accepts form data directly."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_profile_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    role: str | None = None
    active_flag_id: UUID | None = None
    request_limit_id: UUID | None = None

    # Optional multi-select resources
    email_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None


class SaveProfileApiResponse(BaseModel):
    """Response model for save profile endpoint."""

    success: bool
    profile_id: UUID
    message: str


class SaveProfileSqlParams(BaseModel):
    """SQL parameters for save profile - accepts form data directly."""

    # Context
    profile_id: UUID  # Added from header (actor)
    group_id: UUID  # REQUIRED
    input_profile_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    role: str | None = None
    active_flag_id: UUID | None = None
    request_limit_id: UUID | None = None

    # Optional multi-select resources
    email_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_profile_id,
            self.name_id,
            self.role,
            self.active_flag_id,
            self.request_limit_id,
            self.email_ids,
            self.department_ids,
            self.cohort_ids,
        )


class SaveProfileSqlRow(BaseModel):
    """SQL row for save profile."""

    profile_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteProfileApiRequest(BaseModel):
    """Request model for delete profile endpoint."""

    target_profile_id: UUID


class DeleteProfileApiResponse(BaseModel):
    """Response model for delete profile endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateProfileApiRequest(BaseModel):
    """Request model for duplicate profile endpoint."""

    target_profile_id: UUID


class DuplicateProfileApiResponse(BaseModel):
    """Response model for duplicate profile endpoint."""

    success: bool
    profile_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchProfileDraftApiRequest(BaseModel):
    """Request model for patch profile draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    role: str | None = None
    active_flag_id: UUID | None = None
    request_limit_id: UUID | None = None
    email_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchProfileDraftApiResponse(BaseModel):
    """Response model for patch profile draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
