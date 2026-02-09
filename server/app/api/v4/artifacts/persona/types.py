"""Handcrafted types for persona GET endpoint."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.sql.types import (
    QGetColorsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetExamplesV4Item,
    QGetIconsV4Item,
    QGetInstructionsV4Item,
    QGetNamesV4Item,
    QGetParameterFieldsV4Item,
    QGetParametersV4Item,
)


class PersonaFlagConfig(BaseModel):
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


class BaseResourceSection(BaseModel):
    """Common metadata fields for all resource sections."""

    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    group_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


# Single-select sections (resource = singular current, resources = all options)
class PersonaNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class PersonaDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class PersonaColorSection(BaseResourceSection):
    resource: QGetColorsV4Item | None = None
    resources: list[QGetColorsV4Item] | None = None


class PersonaIconSection(BaseResourceSection):
    resource: QGetIconsV4Item | None = None
    resources: list[QGetIconsV4Item] | None = None


class PersonaInstructionSection(BaseResourceSection):
    resource: QGetInstructionsV4Item | None = None
    resources: list[QGetInstructionsV4Item] | None = None


# Flag section (uses PersonaFlagConfig)
class PersonaFlagSection(BaseResourceSection):
    current: PersonaFlagConfig | None = None
    resources: list[PersonaFlagConfig] | None = None


# Multi-select sections (current = list, resources = all options)
class PersonaDepartmentSection(BaseResourceSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class PersonaParameterFieldSection(BaseResourceSection):
    current: list[QGetParameterFieldsV4Item] | None = None
    resources: list[QGetParameterFieldsV4Item] | None = None


class PersonaExampleSection(BaseResourceSection):
    current: list[QGetExamplesV4Item] | None = None
    resources: list[QGetExamplesV4Item] | None = None


class PersonaParameterSection(BaseResourceSection):
    current: list[QGetParametersV4Item] | None = None
    resources: list[QGetParametersV4Item] | None = None


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

    # Context
    actor_name: str | None = None
    persona_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None
    content_show_ai_generate: bool | None = None
    parameters_step_show_ai_generate: bool | None = None

    # Per-resource sections
    names: PersonaNameSection | None = None
    descriptions: PersonaDescriptionSection | None = None
    colors: PersonaColorSection | None = None
    icons: PersonaIconSection | None = None
    instructions: PersonaInstructionSection | None = None
    flags: PersonaFlagSection | None = None
    departments: PersonaDepartmentSection | None = None
    parameter_fields: PersonaParameterFieldSection | None = None
    examples: PersonaExampleSection | None = None
    parameters: PersonaParameterSection | None = None


class GetPersonaWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_persona_websocket).

    Contains only what's needed for AI generation:
    - Resource-to-agent mapping (for agent_id lookup by resource type)
    - Per-resource group IDs (for existing group context)
    - Resources (for Jinja template context)
    """

    # Resource type -> agent_id mapping (server resolves domains internally)
    resource_agent_ids: dict[str, UUID | None] | None = None

    # Per-resource group IDs (resource_type -> group_id)
    resource_group_ids: dict[str, UUID | None] | None = None

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


# ========== Internal Data Types ==========


@dataclass
class PersonaInternalData:
    """Internal data from core persona fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_persona_websocket() - minimal data for WebSocket handlers
    - get_persona_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    persona_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    # Agent mappings (resource_type -> agent_id)
    agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: agent exists for resource)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    content_show_ai_generate: bool
    parameters_step_show_ai_generate: bool

    # Resources payload
    resources_payload: PersonaResources

    # Per-resource group IDs (from draft MV)
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]


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
    input_persona_id: UUID | None = None  # For update mode

    # Per-resource group IDs
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
    input_persona_id: UUID | None = None  # For update mode

    # Per-resource group IDs
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
            self.input_persona_id,
            self.names_group_id,
            self.descriptions_group_id,
            self.colors_group_id,
            self.icons_group_id,
            self.instructions_group_id,
            self.flags_group_id,
            self.departments_group_id,
            self.parameter_fields_group_id,
            self.examples_group_id,
            self.parameters_group_id,
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
