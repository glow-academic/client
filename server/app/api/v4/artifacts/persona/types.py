"""Handcrafted types for persona GET endpoint."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.sql.types import (
    QGetColorsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetExamplesV4Item,
    QGetFlagsV4Item,
    QGetIconsV4Item,
    QGetInstructionsV4Item,
    QGetNamesV4Item,
    QGetParameterFieldsV4Item,
    QGetParametersV4Item,
)


class DomainAgent(BaseModel):
    """Maps a domain to its assigned agent and group. Used internally by server."""

    domain_id: UUID
    agent_id: UUID | None = None
    group_id: UUID | None = None  # Per-resource group ID for this domain


class DomainData(BaseModel):
    """Rich metadata for a domain, used in generate/regenerate modals."""

    domain_id: UUID
    name: str  # Display name, e.g., "Name", "Description", "Instructions"
    description: str  # Description for tooltips/modals
    resource: str  # Internal resource type (for server use if needed)
    icon: str | None = None  # Optional display icon
    required: bool = False
    show: bool = True


class PersonaFlagConfig(BaseModel):
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


class GetPersonaApiRequest(BaseModel):
    """Request model for get persona endpoint."""

    persona_id: UUID | None = None
    draft_id: UUID | None = None
    # Search filters for resources
    color_search: str | None = None
    icon_search: str | None = None
    descriptions_search: str | None = None
    instructions_search: str | None = None
    parameter_search: str | None = None
    # Show selected filters
    color_show_selected: bool | None = None
    icon_show_selected: bool | None = None
    parameter_show_selected: bool | None = None


class GetPersonaApiResponse(BaseModel):
    """Response model for get persona endpoint."""

    # Required fields
    actor_name: str | None = None
    persona_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    colors_group_id: UUID | None = None
    icons_group_id: UUID | None = None
    instructions_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    departments_group_id: UUID | None = None
    parameter_fields_group_id: UUID | None = None
    examples_group_id: UUID | None = None
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

    # Single-select resources: color
    show_color: bool | None = None
    color_domain_id: UUID | None = None
    color_required: bool | None = None
    color_suggestions: list[UUID] | None = None
    color_show_ai_generate: bool | None = None

    # Single-select resources: icon
    show_icon: bool | None = None
    icon_domain_id: UUID | None = None
    icon_required: bool | None = None
    icon_suggestions: list[UUID] | None = None
    icon_show_ai_generate: bool | None = None

    # Single-select resources: instructions
    show_instructions: bool | None = None
    instructions_domain_id: UUID | None = None
    instructions_required: bool | None = None
    instructions_suggestions: list[UUID] | None = None
    instructions_show_ai_generate: bool | None = None

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

    # Multi-select resources: parameter_fields
    show_parameter_fields: bool | None = None
    parameter_fields_domain_id: UUID | None = None
    parameter_fields_required: bool | None = None
    parameter_field_suggestions: list[UUID] | None = None
    parameter_fields_show_ai_generate: bool | None = None

    # Multi-select resources: examples
    show_examples: bool | None = None
    examples_domain_id: UUID | None = None
    examples_required: bool | None = None
    example_suggestions: list[UUID] | None = None
    examples_show_ai_generate: bool | None = None

    # Multi-select resources: parameters
    show_parameters: bool | None = None
    parameters_domain_id: UUID | None = None
    parameters_required: bool | None = None
    parameter_suggestions: list[UUID] | None = None
    parameters_show_ai_generate: bool | None = None

    # Step-level AI generation flags (for "Generate All Basic", etc.)
    basic_show_ai_generate: bool | None = None
    content_show_ai_generate: bool | None = None
    parameters_step_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs (for AI generation)
    # Only for resources that have actual create_* tools in the DB
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None
    color_create_tool_id: UUID | None = None
    instructions_create_tool_id: UUID | None = None
    parameter_fields_create_tool_id: UUID | None = None
    examples_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs (for AI suggestions)
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    color_link_tool_id: UUID | None = None
    icon_link_tool_id: UUID | None = None
    instructions_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    departments_link_tool_id: UUID | None = None
    parameter_fields_link_tool_id: UUID | None = None
    examples_link_tool_id: UUID | None = None
    parameters_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: PersonaResources | None = None


class GetPersonaWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_persona_websocket).

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
    color_domain_id: UUID | None = None
    icon_domain_id: UUID | None = None
    instructions_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    departments_domain_id: UUID | None = None
    parameter_fields_domain_id: UUID | None = None
    examples_domain_id: UUID | None = None
    parameters_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: PersonaResources | None = None


class PersonaResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    colors: list[QGetColorsV4Item] | None = None
    icons: list[QGetIconsV4Item] | None = None
    instructions: list[QGetInstructionsV4Item] | None = None
    flags: list[PersonaFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    parameter_fields: list[QGetParameterFieldsV4Item] | None = None
    examples: list[QGetExamplesV4Item] | None = None
    parameters: list[QGetParametersV4Item] | None = None


class PersonaResources(BaseModel):
    """Full resources + current selections."""

    resources: PersonaResourceBucket | None = None
    current: PersonaResourceBucket | None = None


# ========== List Endpoint Types ==========


class ListPersonaApiPersona(BaseModel):
    """Persona type for list endpoint with computed permissions."""

    persona_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    reasoning: str | None = None
    temperature_display: str | None = None
    is_inactive: bool | None = None
    num_scenarios: int | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListPersonaApiScenario(BaseModel):
    """Scenario type for list endpoint."""

    scenario_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    persona_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    parameter_item_ids: list[UUID] | None = None
    count: int | None = None


class ListPersonaApiField(BaseModel):
    """Field type for list endpoint."""

    field_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListPersonaApiDepartment(BaseModel):
    """Department type for list endpoint."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListPersonaApiResponse(BaseModel):
    """Response model for list persona endpoint with computed permissions."""

    actor_name: str | None = None
    personas: list[ListPersonaApiPersona] | None = None
    scenarios: list[ListPersonaApiScenario] | None = None
    fields: list[ListPersonaApiField] | None = None
    departments: list[ListPersonaApiDepartment] | None = None
    total_count: int | None = None


# ========== Save Endpoint Types ==========


class SavePersonaApiRequest(BaseModel):
    """Request model for save persona endpoint - accepts form data directly (no draft_id)."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_persona_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED
    color_id: UUID  # REQUIRED
    icon_id: UUID  # REQUIRED
    instructions_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    example_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None


class SavePersonaApiResponse(BaseModel):
    """Response model for save persona endpoint."""

    success: bool
    persona_id: UUID
    message: str


class SavePersonaSqlParams(BaseModel):
    """SQL parameters for save persona - accepts form data directly (no draft_id)."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED - which group to save to
    input_persona_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED
    color_id: UUID  # REQUIRED
    icon_id: UUID  # REQUIRED
    instructions_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    active_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    example_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_persona_id,
            self.name_id,
            self.color_id,
            self.icon_id,
            self.instructions_id,
            self.description_id,
            self.active_flag_id,
            self.department_ids,
            self.parameter_field_ids,
            self.example_ids,
            self.parameter_ids,
        )


class SavePersonaSqlRow(BaseModel):
    """SQL row for save persona."""

    persona_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeletePersonaApiRequest(BaseModel):
    """Request model for delete persona endpoint."""

    persona_id: UUID


class DeletePersonaApiResponse(BaseModel):
    """Response model for delete persona endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicatePersonaApiRequest(BaseModel):
    """Request model for duplicate persona endpoint."""

    persona_id: UUID


class DuplicatePersonaApiResponse(BaseModel):
    """Response model for duplicate persona endpoint."""

    success: bool
    persona_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchPersonaDraftApiRequest(BaseModel):
    """Request model for patch persona draft endpoint."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    color_id: UUID | None = None
    icon_id: UUID | None = None
    instructions_id: UUID | None = None
    active_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    example_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchPersonaDraftApiResponse(BaseModel):
    """Response model for patch persona draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
