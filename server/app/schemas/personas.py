"""Personas V2 API schemas."""

from typing import Dict, List, Optional

from pydantic import BaseModel


class PersonasFilters(BaseModel):
    """Filters for personas list request."""

    departmentIds: List[str]
    profileId: str


class PersonaItem(BaseModel):
    """Individual persona item in the response."""

    persona_id: str
    name: str  # Added name
    description: Optional[str]
    color: str
    icon: str
    scenario_ids: List[str]  # Array of scenario IDs
    model_id: str
    reasoning: Optional[str]
    temperature: float
    num_scenarios: int
    can_edit: bool
    can_duplicate: bool
    can_delete: bool


# Centralized mapping types
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: Optional[str]


class PersonasListResponse(BaseModel):
    """Response for personas list endpoint."""

    personas: List[PersonaItem]
    scenario_mapping: Dict[str, str]  # scenario_id -> name
    model_mapping: Dict[str, str]  # model_id -> name


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


class PersonaDetailResponse(BaseModel):
    """Detailed persona response with all fields and metadata."""

    # Basic persona fields
    name: str
    description: Optional[str]
    department_id: str
    active: bool
    default_persona: bool
    color: str
    icon: str
    model_id: str
    reasoning: Optional[str]
    temperature: float
    system_prompt: str

    # Metadata/Options
    preset_colors: List[str]
    suggested_icons: List[str]
    valid_icons: List[str]
    valid_model_ids: List[str]
    reasoning_options: List[str]
    valid_department_ids: List[str]
    temperature_lower: float
    temperature_upper: float

    # Mappings
    model_mapping: Dict[str, str]  # model_id -> name
    department_mapping: Dict[str, DepartmentMappingItem]  # department_id -> {name, description}

    # Debug info
    debug_info: List[DebugInfoItem]


class PersonaDetailDefaultRequest(BaseModel):
    """Request to get default persona details."""

    profileId: str

# Response uses same PersonaDetailResponse


class CreatePersonaRequest(BaseModel):
    """Request to create a persona."""

    name: str
    description: Optional[str]
    department_id: str
    active: bool
    default_persona: bool
    color: str
    icon: str
    model_id: str
    reasoning: Optional[str]
    temperature: float
    system_prompt: str


class CreatePersonaResponse(BaseModel):
    """Response from create operation."""

    success: bool
    personaId: str
    message: str


class UpdatePersonaRequest(BaseModel):
    """Request to update a persona."""

    personaId: str
    name: str
    description: Optional[str]
    department_id: str
    active: bool
    default_persona: bool
    color: str
    icon: str
    model_id: str
    reasoning: Optional[str]
    temperature: float
    system_prompt: str


class UpdatePersonaResponse(BaseModel):
    """Response from update operation."""

    success: bool
    message: str

