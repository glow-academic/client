"""Handcrafted types for field GET endpoint."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
    QGetParametersV4Item,
)

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]


class FieldFlagConfig(BaseModel):
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


class GetFieldApiRequest(BaseModel):
    """Request model for get field endpoint."""

    field_id: UUID | None = None
    draft_id: UUID | None = None
    # Search filters for resources
    description_search: str | None = None
    parameter_search: str | None = None
    # Show selected filters
    parameter_show_selected: bool | None = None


class GetFieldApiResponse(BaseModel):
    """Response model for get field endpoint."""

    # Required fields
    actor_name: str | None = None
    field_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    departments_group_id: UUID | None = None
    parameters_group_id: UUID | None = None

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

    # Multi-select resources: departments
    show_departments: bool | None = None
    departments_domain_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments_show_ai_generate: bool | None = None

    # Multi-select resources: parameters
    show_parameters: bool | None = None
    parameters_domain_id: UUID | None = None
    parameters_required: bool | None = None
    parameter_suggestions: list[UUID] | None = None
    parameters_show_ai_generate: bool | None = None

    # Step-level AI generation flags (for "Generate All Basic", etc.)
    basic_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs (for AI generation)
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs (for AI suggestions)
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    departments_link_tool_id: UUID | None = None
    parameters_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: FieldResources | None = None


class GetFieldWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_field_websocket).

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
    departments_domain_id: UUID | None = None
    parameters_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: FieldResources | None = None


class FieldResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[FieldFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    parameters: list[QGetParametersV4Item] | None = None


class FieldResources(BaseModel):
    """Full resources + current selections."""

    resources: FieldResourceBucket | None = None
    current: FieldResourceBucket | None = None


# ========== List Endpoint Types ==========


class ListFieldApiField(BaseModel):
    """Field type for list endpoint with computed permissions."""

    field_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    parameter_ids: list[UUID] | None = None
    is_inactive: bool | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListFieldApiParameter(BaseModel):
    """Parameter type for list endpoint."""

    parameter_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListFieldApiDepartment(BaseModel):
    """Department type for list endpoint."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListFieldApiResponse(BaseModel):
    """Response model for list field endpoint with computed permissions."""

    actor_name: str | None = None
    fields: list[ListFieldApiField] | None = None
    parameters: list[ListFieldApiParameter] | None = None
    departments: list[ListFieldApiDepartment] | None = None
    total_count: int | None = None


# ========== Save Endpoint Types ==========


class SaveFieldApiRequest(BaseModel):
    """Request model for save field endpoint - accepts resource IDs."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_field_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None


class SaveFieldApiResponse(BaseModel):
    """Response model for save field endpoint."""

    success: bool
    field_id: UUID
    message: str


class SaveFieldSqlParams(BaseModel):
    """SQL parameters for save field - accepts resource IDs."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED - which group to save to
    input_field_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_field_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.department_ids,
            self.parameter_ids,
        )


class SaveFieldSqlRow(BaseModel):
    """SQL row for save field."""

    field_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteFieldApiRequest(BaseModel):
    """Request model for delete field endpoint."""

    field_id: UUID


class DeleteFieldApiResponse(BaseModel):
    """Response model for delete field endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateFieldApiRequest(BaseModel):
    """Request model for duplicate field endpoint."""

    field_id: UUID


class DuplicateFieldApiResponse(BaseModel):
    """Response model for duplicate field endpoint."""

    success: bool
    field_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchFieldDraftApiRequest(BaseModel):
    """Request model for patch field draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchFieldDraftApiResponse(BaseModel):
    """Response model for patch field draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
