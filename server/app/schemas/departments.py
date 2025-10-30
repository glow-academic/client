"""Departments V2 API schemas."""

from pydantic import BaseModel

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class DepartmentsFilters(BaseModel):
    """Filters for departments list."""

    departmentIds: list[str]
    profileId: str


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class DepartmentItem(BaseModel):
    """Department item for list view."""

    department_id: str
    title: str
    description: str
    active: bool
    updated_at: str
    total_price_spent: float
    staff_count: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class DepartmentsListResponse(BaseModel):
    """Response for departments list."""

    departments: list[DepartmentItem]


# ============================================================================
# DETAIL SCHEMAS
# ============================================================================


class DepartmentDetailRequest(BaseModel):
    """Request for department detail."""

    departmentId: str
    profileId: str


class DepartmentDetailResponse(BaseModel):
    """Response for department detail."""

    # Basic fields
    title: str
    description: str
    active: bool

    # Permissions
    can_edit: bool
    can_duplicate: bool
    can_delete: bool

    # Usage/Stats
    in_use: bool
    staff_count: int
    total_price_spent: float


class DepartmentDetailDefaultRequest(BaseModel):
    """Request for default department detail."""

    profileId: str


# ============================================================================
# MUTATION SCHEMAS
# ============================================================================


class CreateDepartmentRequest(BaseModel):
    """Request for creating a department."""

    title: str
    description: str
    active: bool
    profile_id: str  # Creator's profile ID


class CreateDepartmentResponse(BaseModel):
    """Response for creating a department."""

    success: bool
    departmentId: str
    message: str


class UpdateDepartmentRequest(BaseModel):
    """Request for updating a department."""

    departmentId: str
    title: str
    description: str
    active: bool


class UpdateDepartmentResponse(BaseModel):
    """Response for updating a department."""

    success: bool
    message: str


class DuplicateDepartmentRequest(BaseModel):
    """Request for duplicating a department."""

    departmentId: str


class DuplicateDepartmentResponse(BaseModel):
    """Response for duplicating a department."""

    success: bool
    departmentId: str
    message: str


class DeleteDepartmentRequest(BaseModel):
    """Request for deleting a department."""

    departmentId: str


class DeleteDepartmentResponse(BaseModel):
    """Response for deleting a department."""

    success: bool
    message: str
