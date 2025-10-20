"""Parameters V2 API schemas with nested items."""

from pydantic import BaseModel

from .base import DepartmentMapping

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class ParametersFilters(BaseModel):
    """Filters for parameters list."""

    departmentIds: list[str]
    profileId: str


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class ParameterItem(BaseModel):
    """Parameter item in list response."""

    parameter_id: str
    name: str
    description: str
    numerical: bool
    active: bool
    default_parameter: bool
    num_items: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class ParametersListResponse(BaseModel):
    """Response for parameters list endpoint."""

    parameters: list[ParameterItem]


# ============================================================================
# DETAIL SCHEMAS
# ============================================================================


class ParameterDetailRequest(BaseModel):
    """Request for parameter detail."""

    parameterId: str
    profileId: str


class ParameterItemDetail(BaseModel):
    """Parameter item detail."""

    parameter_item_id: str
    name: str
    description: str
    value: str
    default_item: bool
    can_delete: bool


class ParameterDetailResponse(BaseModel):
    """Response for parameter detail endpoint."""

    # Parameter fields
    name: str
    description: str
    numerical: bool
    active: bool
    default_parameter: bool
    department_id: str
    valid_department_ids: list[str]

    # Nested parameter items
    parameter_items: list[ParameterItemDetail]

    # Top-level mappings
    department_mapping: DepartmentMapping


class ParameterDetailDefaultRequest(BaseModel):
    """Request for default parameter detail."""

    profileId: str


# ============================================================================
# MUTATION SCHEMAS - NESTED STRUCTURES
# ============================================================================


class ParameterItemCreate(BaseModel):
    """Parameter item creation schema."""

    name: str
    description: str
    value: str
    default_item: bool


class CreateParameterRequest(BaseModel):
    """Request to create parameter with nested items."""

    name: str
    description: str
    numerical: bool
    active: bool
    default_parameter: bool
    department_id: str
    parameter_items: list[ParameterItemCreate]


class CreateParameterResponse(BaseModel):
    """Response from create parameter."""

    success: bool
    parameterId: str
    message: str


class UpdateParameterRequest(BaseModel):
    """Request to update parameter with nested items."""

    parameterId: str
    name: str
    description: str
    numerical: bool
    active: bool
    default_parameter: bool
    department_id: str
    parameter_items: list[ParameterItemCreate]


class UpdateParameterResponse(BaseModel):
    """Response from update parameter."""

    success: bool
    message: str


class DuplicateParameterRequest(BaseModel):
    """Request to duplicate parameter."""

    parameterId: str


class DuplicateParameterResponse(BaseModel):
    """Response from duplicate parameter."""

    success: bool
    parameterId: str
    message: str


class DeleteParameterRequest(BaseModel):
    """Request to delete parameter."""

    parameterId: str


class DeleteParameterResponse(BaseModel):
    """Response from delete parameter."""

    success: bool
    message: str


# ============================================================================
# PARAMETER ITEM CREATION (for inline creation from pickers)
# ============================================================================


class CreateParameterItemRequest(BaseModel):
    """Request to create a single parameter item."""

    parameterId: str
    name: str
    description: str
    value: str
    default_item: bool


class CreateParameterItemResponse(BaseModel):
    """Response from create parameter item."""

    success: bool
    parameterItemId: str
    message: str
