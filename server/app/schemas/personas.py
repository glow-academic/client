"""Personas V2 API schemas."""

from pydantic import BaseModel

from .base import (DepartmentMapping, ModelMapping, ReasoningMapping,
                   ScenarioMapping)


class PersonasFilters(BaseModel):
    """Filters for personas list request."""

    departmentIds: list[str]
    profileId: str


class PersonaItem(BaseModel):
    """Individual persona item in the response."""

    persona_id: str
    name: str  # Added name
    description: str | None
    color: str
    icon: str
    department_ids: list[str] | None  # None = cross-department (all departments)
    scenario_ids: list[str]  # Array of scenario IDs
    model_id: str
    reasoning: str | None
    temperature: float
    active: bool
    num_scenarios: int
    can_edit: bool
    can_duplicate: bool
    can_delete: bool


class PersonasListResponse(BaseModel):
    """Response for personas list endpoint."""

    personas: list[PersonaItem]
    scenario_mapping: ScenarioMapping
    model_mapping: ModelMapping


class DuplicatePersonaRequest(BaseModel):
    """Request to duplicate a persona."""

    personaId: str


class DuplicatePersonaResponse(BaseModel):
    """Response from duplicate operation."""

    success: bool
    personaId: str
    message: str


class DeletePersonaRequest(BaseModel):
    """Request to delete a persona."""

    personaId: str


class DeletePersonaResponse(BaseModel):
    """Response from delete operation."""

    success: bool
    message: str


class PersonaDetailRequest(BaseModel):
    """Request to get persona details."""

    personaId: str
    profileId: str


class DebugInfoItem(BaseModel):
    """Debug information item."""

    created_at: str
    model_id: str
    content: str


class PromptInfo(BaseModel):
    """Prompt information for version history."""

    system_prompt: str
    created_at: str
    updated_at: str
    department_ids: list[str] | None


class PersonaDetailResponse(BaseModel):
    """Detailed persona response with all fields and metadata."""

    # Basic persona fields
    name: str
    description: str | None
    department_ids: list[str] | None  # None = cross-department (all departments)
    active: bool
    color: str
    icon: str
    model_id: str
    reasoning: str | None
    temperature: float
    system_prompt: str
    prompt_id: str | None

    # Usage and permissions
    in_use: bool
    scenario_count: int
    can_edit: bool
    can_duplicate: bool
    can_delete: bool

    # Metadata/Options
    preset_colors: list[str]
    suggested_icons: list[str]
    valid_icons: list[str]
    valid_model_ids: list[str]
    reasoning_options: list[str]
    valid_department_ids: list[str]
    temperature_lower: float
    temperature_upper: float

    # Prompt version history
    prompt_mapping: dict[str, PromptInfo]

    # Mappings
    model_mapping: ModelMapping
    reasoning_mapping: ReasoningMapping
    department_mapping: DepartmentMapping

    # Debug info
    debug_info: list[DebugInfoItem]


class PersonaDetailDefaultRequest(BaseModel):
    """Request to get default persona details."""

    profileId: str


# Response uses same PersonaDetailResponse


class CreatePersonaRequest(BaseModel):
    """Request to create a persona."""

    name: str
    description: str | None
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    active: bool
    color: str
    icon: str
    model_id: str
    reasoning: str | None
    temperature: float
    prompt_id: str | None  # If provided, use existing prompt
    system_prompt: str  # If prompt_id is None, create new prompt with this


class CreatePersonaResponse(BaseModel):
    """Response from create operation."""

    success: bool
    personaId: str
    message: str


class UpdatePersonaRequest(BaseModel):
    """Request to update a persona."""

    personaId: str
    name: str
    description: str | None
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    active: bool
    color: str
    icon: str
    model_id: str
    reasoning: str | None
    temperature: float
    prompt_id: str | None  # If provided, use existing prompt
    system_prompt: str  # If prompt_id is None, create new prompt with this


class UpdatePersonaResponse(BaseModel):
    """Response from update operation."""

    success: bool
    message: str
