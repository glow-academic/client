"""Handcrafted types for parameter endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
    QGetParameterFieldsV4Item,
)

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]


class ParameterFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "active", "simulation", "document"
    label: str  # e.g., "Active", "Simulation", "Document"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None  # ID to use when enabling
    show: bool = True
    required: bool = False
    domain_id: UUID | None = None  # Domain ID for generation
    generated: bool | None = None


class GetParameterApiRequest(BaseModel):
    """Request model for get parameter endpoint."""

    parameter_id: UUID | None = None
    draft_id: UUID | None = None
    # Search filters for resources
    field_search: str | None = None
    # Show selected filters
    field_show_selected: bool | None = None


class GetParameterApiResponse(BaseModel):
    """Response model for get parameter endpoint."""

    # Required fields
    actor_name: str | None = None
    parameter_exists: bool | None = None
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
    fields_group_id: UUID | None = None

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

    # Multi-select resources: fields
    show_fields: bool | None = None
    fields_domain_id: UUID | None = None
    fields_required: bool | None = None
    field_suggestions: list[UUID] | None = None
    fields_show_ai_generate: bool | None = None

    # Step-level AI generation flags (for "Generate All Basic", etc.)
    basic_show_ai_generate: bool | None = None
    fields_step_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs (for AI generation)
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None
    fields_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs (for AI suggestions)
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    departments_link_tool_id: UUID | None = None
    fields_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: ParameterResources | None = None


class GetParameterWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_parameter_websocket).

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
    fields_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: ParameterResources | None = None


class ParameterResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[ParameterFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    fields: list[QGetParameterFieldsV4Item] | None = None


class ParameterResources(BaseModel):
    """Full resources + current selections."""

    resources: ParameterResourceBucket | None = None
    current: ParameterResourceBucket | None = None


# ========== List Endpoint Types ==========


class ListParameterApiParameter(BaseModel):
    """Parameter type for list endpoint with computed permissions."""

    parameter_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[UUID] | None = None
    num_items: int | None = None
    sample_items: list[str] | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListParameterApiScenario(BaseModel):
    """Scenario type for list endpoint."""

    scenario_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    parameter_item_ids: list[UUID] | None = None
    count: int | None = None


class ListParameterApiDepartment(BaseModel):
    """Department type for list endpoint."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListParameterApiResponse(BaseModel):
    """Response model for list parameter endpoint with computed permissions."""

    actor_name: str | None = None
    parameters: list[ListParameterApiParameter] | None = None
    scenarios: list[ListParameterApiScenario] | None = None
    departments: list[ListParameterApiDepartment] | None = None
    total_count: int | None = None


# ========== Save Endpoint Types ==========


class FieldConnectionItem(BaseModel):
    """Field connection with per-junction metadata."""

    field_id: UUID
    default: bool = False
    active: bool = True


class SaveParameterApiRequest(BaseModel):
    """Request model for save parameter endpoint - accepts resource IDs."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_parameter_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    field_connections: list[FieldConnectionItem] | None = None


class SaveParameterApiResponse(BaseModel):
    """Response model for save parameter endpoint."""

    success: bool
    parameter_id: UUID
    message: str


class SaveParameterSqlParams(BaseModel):
    """SQL parameters for save parameter - accepts resource IDs."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED - which group to save to
    input_parameter_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    field_connections: list[FieldConnectionItem] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        # Convert field_connections to a format SQL can handle
        field_conn_tuples = None
        if self.field_connections:
            field_conn_tuples = [
                (fc.field_id, fc.default, fc.active) for fc in self.field_connections
            ]
        return (
            self.profile_id,
            self.group_id,
            self.input_parameter_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.flag_ids,
            self.department_ids,
            field_conn_tuples,
        )


class SaveParameterSqlRow(BaseModel):
    """SQL row for save parameter."""

    parameter_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteParameterApiRequest(BaseModel):
    """Request model for delete parameter endpoint."""

    parameter_id: UUID


class DeleteParameterApiResponse(BaseModel):
    """Response model for delete parameter endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateParameterApiRequest(BaseModel):
    """Request model for duplicate parameter endpoint."""

    parameter_id: UUID


class DuplicateParameterApiResponse(BaseModel):
    """Response model for duplicate parameter endpoint."""

    success: bool
    parameter_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchParameterDraftApiRequest(BaseModel):
    """Request model for patch parameter draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchParameterDraftApiResponse(BaseModel):
    """Response model for patch parameter draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
