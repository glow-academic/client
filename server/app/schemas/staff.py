"""Staff V2 API schemas."""


from pydantic import BaseModel

from .base import CohortMapping, DepartmentMapping

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class StaffFilters(BaseModel):
    """Filters for staff list."""

    departmentIds: list[str]
    profileId: str  # Current user's profile for permissions


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class StaffItem(BaseModel):
    """Staff item in list response."""

    profile_id: str
    first_name: str
    last_name: str
    alias: str
    name: str  # Combined first_name + last_name
    role: str
    email: str  # alias + campus email domain
    initials: str  # Derived from first_name + last_name
    active: bool
    lastActive: str | None
    cohort_ids: list[str]
    requests_per_day: int | None
    default_profile: bool
    requests_in_last_day: int
    can_edit: bool
    can_delete: bool


class StaffListResponse(BaseModel):
    """Response for staff list endpoint."""

    staff: list[StaffItem]
    cohort_mapping: CohortMapping
    department_mapping: DepartmentMapping


# ============================================================================
# DETAIL SCHEMAS
# ============================================================================


class StaffDetailRequest(BaseModel):
    """Request for staff detail."""

    profileId: str
    currentProfileId: str  # For permissions/validation


class StaffDetailResponse(BaseModel):
    """Response for staff detail endpoint."""

    # Basic fields
    name: str
    email: str
    role: str
    requests_per_day: int | None
    active: bool
    department_id: str
    valid_department_ids: list[str]
    cohort_ids: list[str]

    # Metadata
    role_options: list[str]

    # Top-level mappings
    cohort_mapping: CohortMapping
    department_mapping: DepartmentMapping


class StaffDetailBulkRequest(BaseModel):
    """Request for staff detail bulk."""

    profileIds: list[str]
    currentProfileId: str


class StaffDetailBulkResponse(BaseModel):
    """Response for staff detail bulk endpoint."""

    # Common editable fields across selected profiles
    role: str | None  # null if mixed
    requests_per_day: int | None  # null if mixed
    department_ids: list[str]
    valid_department_ids: list[str]

    # Metadata
    role_options: list[str]

    # Top-level mappings
    department_mapping: DepartmentMapping


# ============================================================================
# MUTATION SCHEMAS
# ============================================================================


class CreateStaffRequest(BaseModel):
    """Request to create a single staff member."""

    firstName: str
    lastName: str
    alias: str
    role: str
    department_id: str | None = None


class BulkCreateStaffRequest(BaseModel):
    """Request to bulk create staff members."""

    profiles: list[CreateStaffRequest]


class CreateStaffResponse(BaseModel):
    """Response from create staff."""

    success: bool
    profileId: str
    message: str


class BulkCreateStaffResponse(BaseModel):
    """Response from bulk create staff."""

    success: bool
    profileIds: list[str]
    message: str


class UpdateStaffRequest(BaseModel):
    """Request to update staff."""

    profileId: str
    role: str
    requests_per_day: int | None
    department_id: str
    active: bool


class UpdateStaffResponse(BaseModel):
    """Response from update staff."""

    success: bool
    message: str


class BulkUpdateStaffRequest(BaseModel):
    """Request to bulk update staff."""

    profileIds: list[str]
    role: str | None = None
    requests_per_day: int | None = None
    department_id: str | None = None
    active: bool | None = None


class BulkUpdateStaffResponse(BaseModel):
    """Response from bulk update staff."""

    success: bool
    message: str


class DeleteStaffRequest(BaseModel):
    """Request to delete staff."""

    profileId: str


class DeleteStaffResponse(BaseModel):
    """Response from delete staff."""

    success: bool
    message: str


class BulkDeleteStaffRequest(BaseModel):
    """Request to bulk delete staff."""

    profileIds: list[str]


class BulkDeleteStaffResponse(BaseModel):
    """Response from bulk delete staff."""

    success: bool
    message: str
