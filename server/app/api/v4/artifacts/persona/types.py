"""Handcrafted types for persona GET endpoint."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.views.drafts.types import DraftPersonaViewItem
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
    QGetProvidersV4Item,
    QGetToolsV4Item,
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
    # Fields catalog (not a section — computed resource, never saved)
    fields: list[QGetFieldsV4Item] | None = None


class PersonaWebsocketViews(BaseModel):
    """Views data for websocket response."""

    draft_persona: DraftPersonaViewItem


class PersonaWebsocketResources(BaseModel):
    """Hydrated resources for websocket — selected only, no suggestions."""

    # 10 persona resources
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
    # 4 config resources
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None


class GetPersonaWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_persona_websocket).

    Uses views + resources pattern:
    - Views: draft persona view (convenience for Jinja templates)
    - Resources: hydrated selected objects + config for generation
    """

    views: PersonaWebsocketViews | None = None
    resources: PersonaWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


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
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    # Config resources (from denormalized chain, for generation)
    config_agent_resources: list[QGetAgentsV4Item] | None
    config_model_resources: list[QGetModelsV4Item] | None
    config_provider_resources: list[QGetProvidersV4Item] | None


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


class SavePersonaApiRequest(BaseModel):
    """Request model for save persona endpoint - accepts nested resource actions."""

    input_persona_id: UUID | None = None
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


class SavePersonaApiResponse(BaseModel):
    """Response model for save persona endpoint."""

    success: bool
    persona_id: UUID
    message: str


class SavePersonaSqlParams(BaseModel):
    """SQL parameters for save persona - nested resource actions with tool call tracking."""

    profile_id: UUID
    input_persona_id: UUID | None = None
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

    @classmethod
    def from_request(
        cls, request: SavePersonaApiRequest, profile_id: UUID
    ) -> SavePersonaSqlParams:
        return cls(profile_id=profile_id, **request.model_dump())

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution."""

        def single(a: PersonaResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: PersonaMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_persona_id,
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
    """Request model for patch persona draft endpoint - nested resource actions."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    expected_version: int = 0
    names: PersonaResourceAction | None = None
    descriptions: PersonaResourceAction | None = None
    colors: PersonaResourceAction | None = None
    icons: PersonaResourceAction | None = None
    instructions: PersonaResourceAction | None = None
    flags: PersonaResourceAction | None = None
    departments: PersonaMultiResourceAction | None = None
    parameter_fields: PersonaMultiResourceAction | None = None
    examples: PersonaMultiResourceAction | None = None
    parameters: PersonaMultiResourceAction | None = None


class PatchPersonaDraftApiResponse(BaseModel):
    """Response model for patch persona draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchPersonaDraftSqlParams(BaseModel):
    """SQL parameters for patch persona draft - nested resource actions."""

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
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchPersonaDraftApiRequest, profile_id: UUID
    ) -> PatchPersonaDraftSqlParams:
        _empty_single = PersonaResourceAction()
        _empty_multi = PersonaMultiResourceAction()
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=request.names or _empty_single,
            descriptions=request.descriptions or _empty_single,
            colors=request.colors or _empty_single,
            icons=request.icons or _empty_single,
            instructions=request.instructions or _empty_single,
            flags=request.flags or _empty_single,
            departments=request.departments or _empty_multi,
            parameter_fields=request.parameter_fields or _empty_multi,
            examples=request.examples or _empty_multi,
            parameters=request.parameters or _empty_multi,
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
            self.expected_version,
        )


class PatchPersonaDraftSqlRow(BaseModel):
    """SQL row for patch persona draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None
