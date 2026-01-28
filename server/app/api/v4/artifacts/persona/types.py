"""Handcrafted types for persona GET endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.sql.types import (
    QGetColorsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetExamplesV4Item,
    QGetFieldsV4Item,
    QGetFlagsV4Item,
    QGetIconsV4Item,
    QGetInstructionsV4Item,
    QGetNamesV4Item,
    QGetParametersV4Item,
)


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
    parameter_search: str | None = None
    # Show selected filters
    color_show_selected: bool | None = None
    icon_show_selected: bool | None = None
    parameter_field_show_selected: bool | None = None
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

    # Single-select resources: name
    name_id: UUID | None = None
    name_resource: QGetNamesV4Item | None = None
    show_name: bool | None = None
    name_agent_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    names: list[QGetNamesV4Item] | None = None

    # Single-select resources: description
    description_id: UUID | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    show_description: bool | None = None
    description_agent_id: UUID | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None

    # Single-select resources: color
    color_id: UUID | None = None
    color_resource: QGetColorsV4Item | None = None
    show_color: bool | None = None
    color_agent_id: UUID | None = None
    color_required: bool | None = None
    color_suggestions: list[UUID] | None = None
    colors: list[QGetColorsV4Item] | None = None

    # Single-select resources: icon
    icon_id: UUID | None = None
    icon_resource: QGetIconsV4Item | None = None
    show_icon: bool | None = None
    icon_agent_id: UUID | None = None
    icon_required: bool | None = None
    icon_suggestions: list[UUID] | None = None
    icons: list[QGetIconsV4Item] | None = None

    # Single-select resources: instructions
    instructions_id: UUID | None = None
    instructions_resource: QGetInstructionsV4Item | None = None
    show_instructions: bool | None = None
    instructions_agent_id: UUID | None = None
    instructions_required: bool | None = None
    instructions_suggestions: list[UUID] | None = None
    instructions: list[QGetInstructionsV4Item] | None = None

    # Single-select resources: flag
    active_flag_id: UUID | None = None
    flag_resource: QGetFlagsV4Item | None = None
    show_flag: bool | None = None
    flag_agent_id: UUID | None = None
    flag_required: bool | None = None
    flags: list[QGetFlagsV4Item] | None = None

    # Multi-select resources: departments
    department_ids: list[UUID] | None = None
    department_resources: list[QGetDepartmentsV4Item] | None = None
    show_departments: bool | None = None
    departments_agent_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None

    # Multi-select resources: parameter_fields
    parameter_field_ids: list[UUID] | None = None
    parameter_field_resources: list[QGetFieldsV4Item] | None = None
    show_parameter_fields: bool | None = None
    parameter_fields_agent_id: UUID | None = None
    parameter_fields_required: bool | None = None
    parameter_field_suggestions: list[UUID] | None = None
    parameter_fields: list[QGetFieldsV4Item] | None = None

    # Multi-select resources: examples
    example_ids: list[UUID] | None = None
    example_resources: list[QGetExamplesV4Item] | None = None
    show_examples: bool | None = None
    examples_agent_id: UUID | None = None
    examples_required: bool | None = None
    example_suggestions: list[UUID] | None = None
    examples: list[QGetExamplesV4Item] | None = None

    # Multi-select resources: parameters
    parameter_ids: list[UUID] | None = None
    parameter_resources: list[QGetParametersV4Item] | None = None
    show_parameters: bool | None = None
    parameters_agent_id: UUID | None = None
    parameters_required: bool | None = None
    parameter_suggestions: list[UUID] | None = None
    parameters: list[QGetParametersV4Item] | None = None

    # Multi-resource combination agent IDs
    basic_agent_id: UUID | None = None
    content_agent_id: UUID | None = None
    general_agent_id: UUID | None = None


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
    updated_at: str | None = None


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
    general_agent_id: UUID | None = None


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
