"""Handcrafted types for persona GET endpoint."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.artifacts.types import InternalResponseBase
from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.api.v4.types import BaseResourceSection, ListFilterSection
from app.sql.types import (
    QGetAgentsV4Item,
    QGetColorsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetExamplesV4Item,
    QGetFieldsV4Item,
    QGetIconsV4Item,
    QGetInstructionsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetParameterFieldsV4Item,
    QGetParametersV4Item,
    QGetPersonaDraftsEntriesV4Item,
    QGetProvidersV4Item,
    QGetVoicesV4Item,
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


class PersonaVoiceSection(BaseResourceSection):
    current: list[QGetVoicesV4Item] | None = None
    resources: list[QGetVoicesV4Item] | None = None


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
    # Optional group_id from layout context (avoids server-side creation)
    group_id: UUID | None = None


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
    fields: list[QGetFieldsV4Item] | None = None
    # Resolved parameter IDs (derived from saved parameter_fields)
    resolved_parameter_ids: list[str] | None = None


class PersonaWebsocketEntries(BaseModel):
    """Entries data for websocket response."""

    draft_persona: QGetPersonaDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class PersonaWebsocketResources(BaseModel):
    """Hydrated resources for websocket — selected only, no suggestions."""

    # 11 persona resources
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
    voices: list[QGetVoicesV4Item] | None = None
    fields: list[QGetFieldsV4Item] | None = None


class GetPersonaWebsocketResponse(InternalResponseBase):
    """Minimal response for WebSocket handlers (get_persona_websocket).

    Uses views + resources pattern:
    - Views: draft persona view (convenience for Jinja templates)
    - Resources: hydrated selected objects + config for generation
    """

    entries: PersonaWebsocketEntries | None = None
    resources: PersonaWebsocketResources


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
    voices: list[QGetVoicesV4Item] | None = None
    fields: list[QGetFieldsV4Item] | None = None


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
    link_tool_ids_map: dict[str, UUID | None]

    # Resolved parameter IDs (derived from saved parameter_fields)
    resolved_parameter_ids: list[str]

    # Config resources (from denormalized chain, for generation)
    config_agent_resources: list[QGetAgentsV4Item] | None
    config_model_resources: list[QGetModelsV4Item] | None
    config_provider_resources: list[QGetProvidersV4Item] | None


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
    scenario_filter: ListFilterSection | None = None
    field_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
    total_count: int | None = None
    import_fields: list[ImportField] | None = None


# ========== Resource Action Types (for tool call tracking) ==========


class PersonaResourceAction(BaseModel):
    """Single-select resource with tool call tracking."""

    resource_id: UUID | None = None
    create_tool_id: UUID | None = None  # Set if resource was just created (flush)
    link_tool_id: UUID | None = None  # Set if selection changed from previous


class PersonaMultiResourceAction(BaseModel):
    """Multi-select resource with tool call tracking."""

    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


# ========== Save Endpoint Types ==========


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


class SavePersonaSqlParams(BaseModel):
    """SQL parameters for save persona - flat resource IDs."""

    profile_id: UUID
    input_persona_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    color_id: UUID | None = None
    icon_id: UUID | None = None
    instructions_id: UUID | None = None
    active_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    example_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None
    personas_resource_id: UUID | None = None

    @classmethod
    def from_request(
        cls,
        request: SavePersonaItem,
        profile_id: UUID,
        personas_resource_id: UUID | None = None,
    ) -> SavePersonaSqlParams:
        return cls(
            profile_id=profile_id,
            input_persona_id=request.input_persona_id,
            name_id=request.name_id,
            description_id=request.description_id,
            color_id=request.color_id,
            icon_id=request.icon_id,
            instructions_id=request.instructions_id,
            active_flag_id=request.active_flag_id,
            department_ids=request.department_ids,
            parameter_field_ids=request.parameter_field_ids,
            example_ids=request.example_ids,
            voice_ids=request.voice_ids,
            personas_resource_id=personas_resource_id,
        )

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution.

        Arrays are passed as-is (None preserved) so SQL COALESCE can
        distinguish 'not provided' (NULL) from 'explicitly empty' ([]).
        """
        return (
            self.profile_id,
            self.input_persona_id,
            self.name_id,
            self.description_id,
            self.color_id,
            self.icon_id,
            self.instructions_id,
            self.active_flag_id,
            self.department_ids,
            self.parameter_field_ids,
            self.example_ids,
            self.voice_ids,
            self.personas_resource_id,
        )


class SavePersonaSqlRow(BaseModel):
    """SQL row for save persona."""

    persona_id: UUID | None = None
    actor_name: str | None = None


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


# ========== Draft Endpoint Types ==========


class PatchPersonaDraftApiRequest(BaseModel):
    """Request model for patch persona draft endpoint - flat resource IDs."""

    input_draft_id: UUID | None = None
    expected_version: int = 0
    group_id: UUID | None = None  # Tool tracking context from GET response
    # All optional (partial update)
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
    voice_ids: list[UUID] | None = None


class PatchPersonaDraftApiResponse(BaseModel):
    """Response model for patch persona draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchPersonaDraftSqlParams(BaseModel):
    """SQL parameters for patch persona draft - builds composites from flat IDs."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: PersonaResourceAction
    descriptions: PersonaResourceAction
    colors: PersonaResourceAction
    icons: PersonaResourceAction
    instructions: PersonaResourceAction
    flags: PersonaResourceAction
    departments: PersonaMultiResourceAction
    parameter_fields: PersonaMultiResourceAction
    examples: PersonaMultiResourceAction
    parameters: PersonaMultiResourceAction
    voices: PersonaMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls,
        request: PatchPersonaDraftApiRequest,
        profile_id: UUID,
        group_id: UUID | None = None,
    ) -> PatchPersonaDraftSqlParams:
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=group_id,
            names=PersonaResourceAction(resource_id=request.name_id),
            descriptions=PersonaResourceAction(resource_id=request.description_id),
            colors=PersonaResourceAction(resource_id=request.color_id),
            icons=PersonaResourceAction(resource_id=request.icon_id),
            instructions=PersonaResourceAction(resource_id=request.instructions_id),
            flags=PersonaResourceAction(resource_id=request.active_flag_id),
            departments=PersonaMultiResourceAction(resource_ids=request.department_ids),
            parameter_fields=PersonaMultiResourceAction(
                resource_ids=request.parameter_field_ids
            ),
            examples=PersonaMultiResourceAction(resource_ids=request.example_ids),
            parameters=PersonaMultiResourceAction(resource_ids=request.parameter_ids),
            voices=PersonaMultiResourceAction(resource_ids=request.voice_ids),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""

        def single(a: PersonaResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: PersonaMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.colors),
            single(self.icons),
            single(self.instructions),
            single(self.flags),
            multi(self.departments),
            multi(self.parameter_fields),
            multi(self.examples),
            multi(self.parameters),
            multi(self.voices),
            self.expected_version,
        )


class PatchPersonaDraftSqlRow(BaseModel):
    """SQL row for patch persona draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


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
