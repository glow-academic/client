"""Handcrafted types for persona GET endpoint."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.routes.v5.tools.resources.fields.types import GetFieldResponse
from app.routes.v5.tools.resources.parameters.types import GetParameterResponse

# =============================================================================
# Resource Types (handcrafted — no dependency on app.sql.types)
# =============================================================================


class PersonaNameResource(BaseModel):
    """Name resource for persona."""

    id: UUID | None = None
    name: str | None = None
    generated: bool | None = None


class PersonaDescriptionResource(BaseModel):
    """Description resource for persona."""

    id: UUID | None = None
    description: str | None = None
    generated: bool | None = None


class PersonaColorResource(BaseModel):
    """Color resource for persona."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    hex_code: str | None = None
    generated: bool | None = None


class PersonaIconResource(BaseModel):
    """Icon resource for persona."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    generated: bool | None = None


class PersonaInstructionResource(BaseModel):
    """Instruction resource for persona."""

    id: UUID | None = None
    template: str | None = None
    generated: bool | None = None


class PersonaDepartmentResource(BaseModel):
    """Department resource for persona."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class PersonaParameterFieldResource(BaseModel):
    """Parameter field resource for persona."""

    id: UUID | None = None
    field_id: UUID | None = None
    parameter_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class PersonaExampleResource(BaseModel):
    """Example resource for persona."""

    id: UUID | None = None
    example: str | None = None
    generated: bool | None = None


class PersonaVoiceResource(BaseModel):
    """Voice resource for persona."""

    id: UUID | None = None
    voice: str | None = None
    generated: bool | None = None


class PersonaAgentResource(BaseModel):
    """Agent resource for persona (config chain)."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    model_id: UUID | None = None
    temperature: float | None = None
    reasoning: str | None = None
    tool_ids: list[UUID] | None = None
    quality: str | None = None
    voices: list[str] | None = None
    prompt_id: UUID | None = None
    instruction_ids: list[UUID] | None = None
    active: bool | None = None
    generated: bool | None = None


class PersonaModelResource(BaseModel):
    """Model resource for persona (config chain)."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    provider_id: UUID | None = None
    modality_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    quality_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None


class PersonaProviderResource(BaseModel):
    """Provider resource for persona (config chain)."""

    id: UUID | None = None
    value: str | None = None
    name: str | None = None
    description: str | None = None
    endpoint: str | None = None
    key: str | None = None
    active: bool | None = None
    generated: bool | None = None


class PersonaDraftEntry(BaseModel):
    """Persona draft entry for websocket."""

    draft_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    version: int | None = None
    generated: bool | None = None
    mcp: bool | None = None
    active: bool | None = None
    group_id: UUID | None = None
    name_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    color_ids: list[UUID] | None = None
    icon_ids: list[UUID] | None = None
    instruction_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    example_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None


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


# Single-select sections (resource = singular current, resources = all options)
class PersonaNameSection(BaseResourceSection):
    resource: PersonaNameResource | None = None
    resources: list[PersonaNameResource] | None = None


class PersonaDescriptionSection(BaseResourceSection):
    resource: PersonaDescriptionResource | None = None
    resources: list[PersonaDescriptionResource] | None = None


class PersonaColorSection(BaseResourceSection):
    resource: PersonaColorResource | None = None
    resources: list[PersonaColorResource] | None = None


class PersonaIconSection(BaseResourceSection):
    resource: PersonaIconResource | None = None
    resources: list[PersonaIconResource] | None = None


class PersonaInstructionSection(BaseResourceSection):
    resource: PersonaInstructionResource | None = None
    resources: list[PersonaInstructionResource] | None = None


# Flag section (uses PersonaFlagConfig)
class PersonaFlagSection(BaseResourceSection):
    current: PersonaFlagConfig | None = None
    resources: list[PersonaFlagConfig] | None = None


# Multi-select sections (current = list, resources = all options)
class PersonaDepartmentSection(BaseResourceSection):
    current: list[PersonaDepartmentResource] | None = None
    resources: list[PersonaDepartmentResource] | None = None


class PersonaParameterFieldSection(BaseResourceSection):
    current: list[PersonaParameterFieldResource] | None = None
    resources: list[PersonaParameterFieldResource] | None = None


class PersonaExampleSection(BaseResourceSection):
    current: list[PersonaExampleResource] | None = None
    resources: list[PersonaExampleResource] | None = None


class PersonaParameterSection(BaseResourceSection):
    current: list[GetParameterResponse] | None = None
    resources: list[GetParameterResponse] | None = None


class PersonaVoiceSection(BaseResourceSection):
    current: list[PersonaVoiceResource] | None = None
    resources: list[PersonaVoiceResource] | None = None


class GetPersonaApiRequest(BaseModel):
    """Request model for get persona endpoint."""

    persona_id: UUID | None = None
    draft_id: UUID | None = None
    # Search filters for resources
    color_search: str | None = None
    icon_search: str | None = None
    descriptions_search: str | None = None
    instructions_search: str | None = None
    parameter_field_search: str | None = None
    parameter_ids: list[str] | None = (
        None  # URL render filter: which parameter groups are expanded
    )
    # Show selected filters
    color_show_selected: bool | None = None
    icon_show_selected: bool | None = None
    parameter_field_show_selected: bool | None = None
    group_id: UUID


class GetPersonaApiResponse(BaseModel):
    """Response model for get persona endpoint."""

    # Context
    actor_name: str | None = None
    persona_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

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
    voices: PersonaVoiceSection | None = None
    # Fields catalog (not a section — computed resource, never saved)
    fields: list[GetFieldResponse] | None = None
    # Resolved parameter IDs (derived from saved parameter_fields)
    resolved_parameter_ids: list[str] | None = None


class PersonaResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[PersonaNameResource] | None = None
    descriptions: list[PersonaDescriptionResource] | None = None
    colors: list[PersonaColorResource] | None = None
    icons: list[PersonaIconResource] | None = None
    instructions: list[PersonaInstructionResource] | None = None
    flags: list[PersonaFlagConfig] | None = None
    departments: list[PersonaDepartmentResource] | None = None
    parameter_fields: list[PersonaParameterFieldResource] | None = None
    examples: list[PersonaExampleResource] | None = None
    parameters: list[GetParameterResponse] | None = None
    voices: list[PersonaVoiceResource] | None = None
    fields: list[GetFieldResponse] | None = None


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

    # Per-resource tool IDs (from selected agents)
    tool_ids_map: dict[str, UUID | None]

    # Resolved parameter IDs (derived from saved parameter_fields)
    resolved_parameter_ids: list[str]

    # Config resources (from denormalized chain, for generation)
    config_agent_resources: list[PersonaAgentResource] | None
    config_model_resources: list[PersonaModelResource] | None
    config_provider_resources: list[PersonaProviderResource] | None


# ========== Import Field Types ==========


class ImportField(BaseModel):
    """Field descriptor for CSV import column mapping."""

    key: str
    label: str
    required: bool = False
    multi: bool = False
    type: str = "string"
    example: str | None = None
    description: str | None = None


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
    field_ids: list[UUID] | None = None
    is_inactive: bool | None = None
    generated: bool | None = None
    mcp: bool | None = None
    num_scenarios: int | None = None
    num_profiles: int | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListPersonaApiResponse(BaseModel):
    """Response model for list persona endpoint with computed permissions."""

    actor_name: str | None = None
    personas: list[ListPersonaApiPersona] | None = None
    # Core filters
    scenario_filter: ListFilterSection | None = None
    field_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
    # Bulk edit filters
    color_filter: ListFilterSection | None = None
    icon_filter: ListFilterSection | None = None
    voice_filter: ListFilterSection | None = None
    instruction_filter: ListFilterSection | None = None
    total_count: int | None = None
    import_fields: list[ImportField] | None = None


# ========== Shared Save/Create/Update Types ==========


class PersonaFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class PersonaResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    persona_id: UUID | None = None
    message: str
    errors: list[PersonaFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreatePersonaItem(BaseModel):
    """Single persona item for create — no persona_id.

    Required fields (name, color, icon, instructions): provide ID or value.
    """

    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    color_id: UUID | None = None
    color: str | None = None
    icon_id: UUID | None = None
    icon: str | None = None
    instructions_id: UUID | None = None
    instructions: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    parameter_field_ids: list[UUID] | None = None
    parameter_fields: list[str] | None = None
    example_ids: list[UUID] | None = None
    examples: list[str] | None = None
    voice_ids: list[UUID] | None = None
    voices: list[str] | None = None


class CreatePersonaApiRequest(BaseModel):
    """Request model for bulk create persona endpoint."""

    personas: list[CreatePersonaItem]
    group_id: UUID | None = None


class CreatePersonaApiResponse(BaseModel):
    """Response model for bulk create persona endpoint."""

    results: list[PersonaResultItem]


# ========== Update Endpoint Types ==========


class UpdatePersonaItem(BaseModel):
    """Single persona item for update — persona_id required, all fields optional.

    Only provided fields are updated (partial update).
    """

    persona_id: UUID  # Required — which persona to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    color_id: UUID | None = None
    color: str | None = None
    icon_id: UUID | None = None
    icon: str | None = None
    instructions_id: UUID | None = None
    instructions: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    parameter_field_ids: list[UUID] | None = None
    parameter_fields: list[str] | None = None
    example_ids: list[UUID] | None = None
    examples: list[str] | None = None
    voice_ids: list[UUID] | None = None
    voices: list[str] | None = None


class UpdatePersonaApiRequest(BaseModel):
    """Request model for bulk update persona endpoint."""

    personas: list[UpdatePersonaItem]
    group_id: UUID | None = None


class UpdatePersonaApiResponse(BaseModel):
    """Response model for bulk update persona endpoint."""

    results: list[PersonaResultItem]


# ========== Legacy Save Types (backwards compat) ==========


class SavePersonaFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SavePersonaItem(BaseModel):
    """Single persona item for save — provide ID or value per field (not both).

    For required fields (name, color, icon, instructions), exactly one of
    the *_id or value field must be provided.
    """

    input_persona_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    color_id: UUID | None = None
    color: str | None = None
    icon_id: UUID | None = None
    icon: str | None = None
    instructions_id: UUID | None = None
    instructions: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    parameter_field_ids: list[UUID] | None = None
    parameter_fields: list[str] | None = None
    example_ids: list[UUID] | None = None
    examples: list[str] | None = None
    voice_ids: list[UUID] | None = None
    voices: list[str] | None = None


class SavePersonaApiRequest(BaseModel):
    """Request model for bulk save persona endpoint."""

    personas: list[SavePersonaItem]
    group_id: UUID | None = None  # Tool tracking context from GET response


class SavePersonaResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    persona_id: UUID | None = None
    message: str
    errors: list[SavePersonaFieldError] | None = None


class SavePersonaApiResponse(BaseModel):
    """Response model for bulk save persona endpoint."""

    results: list[SavePersonaResult]


# ========== Delete Endpoint Types ==========


class DeletePersonaApiRequest(BaseModel):
    """Request model for bulk delete persona endpoint."""

    persona_ids: list[UUID]


class DeletePersonaResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    persona_id: UUID
    message: str


class DeletePersonaApiResponse(BaseModel):
    """Response model for bulk delete persona endpoint."""

    results: list[DeletePersonaResult]


# ========== Duplicate Endpoint Types ==========


class DuplicatePersonaApiRequest(BaseModel):
    """Request model for duplicate persona endpoint."""

    persona_id: UUID


class DuplicatePersonaApiResponse(BaseModel):
    """Response model for duplicate persona endpoint."""

    success: bool
    persona_id: UUID
    message: str


# ========== Draft Endpoint Types (composable infra) ==========


class PatchPersonaDraftApiRequest(BaseModel):
    """Request model for new-style persona draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id, instructions/instructions_id, examples/example_ids
    ID-only for non-creatable resources:
      - color_id, icon_id, flag_id, department_ids, parameter_field_ids, voice_ids

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
    instructions: str | None = None
    instructions_id: UUID | None = None

    # Creatable multi-select — provide values or IDs
    examples: list[str] | None = None
    example_ids: list[UUID] | None = None

    # Non-creatable — ID-only
    color_id: UUID | None = None
    icon_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None


class PatchPersonaDraftApiResponse(BaseModel):
    """Response model for new-style persona draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


# ========== Export Endpoint Types ==========


class ExportPersonaApiRequest(BaseModel):
    """Request model for export persona endpoint."""

    # Same filters as list endpoint
    search: str | None = None
    scenario_ids: list[str] | None = None
    field_ids: list[str] | None = None
    filter_department_ids: list[str] | None = None


class ExportPersonaApiResponse(BaseModel):
    """Response model for export persona endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int
