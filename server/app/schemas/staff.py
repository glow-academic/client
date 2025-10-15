"""Staff V2 API schemas."""

from typing import List, Optional

from pydantic import BaseModel

from .base import CohortMapping, DepartmentMapping

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class StaffFilters(BaseModel):
    """Filters for staff list."""

    departmentIds: List[str]
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
    lastActive: Optional[str]
    cohort_ids: List[str]
    requests_per_day: Optional[int]
    default_profile: bool
    requests_in_last_day: int
    can_edit: bool
    can_delete: bool


class StaffListResponse(BaseModel):
    """Response for staff list endpoint."""

    staff: List[StaffItem]
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
    requests_per_day: Optional[int]
    active: bool
    department_id: str
    valid_department_ids: List[str]
    cohort_ids: List[str]

    # Metadata
    role_options: List[str]

    # Top-level mappings
    cohort_mapping: CohortMapping
    department_mapping: DepartmentMapping


class StaffDetailBulkRequest(BaseModel):
    """Request for staff detail bulk."""

    profileIds: List[str]
    currentProfileId: str


class StaffDetailBulkResponse(BaseModel):
    """Response for staff detail bulk endpoint."""

    # Common editable fields across selected profiles
    role: Optional[str]  # null if mixed
    requests_per_day: Optional[int]  # null if mixed
    department_ids: List[str]
    valid_department_ids: List[str]

    # Metadata
    role_options: List[str]

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
    department_id: Optional[str] = None


class BulkCreateStaffRequest(BaseModel):
    """Request to bulk create staff members."""

    profiles: List[CreateStaffRequest]


class CreateStaffResponse(BaseModel):
    """Response from create staff."""

    success: bool
    profileId: str
    message: str


class BulkCreateStaffResponse(BaseModel):
    """Response from bulk create staff."""

    success: bool
    profileIds: List[str]
    message: str


class UpdateStaffRequest(BaseModel):
    """Request to update staff."""

    profileId: str
    role: str
    requests_per_day: Optional[int]
    department_id: str
    active: bool


class UpdateStaffResponse(BaseModel):
    """Response from update staff."""

    success: bool
    message: str


class BulkUpdateStaffRequest(BaseModel):
    """Request to bulk update staff."""

    profileIds: List[str]
    role: Optional[str] = None
    requests_per_day: Optional[int] = None
    department_id: Optional[str] = None
    active: Optional[bool] = None


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

    profileIds: List[str]


class BulkDeleteStaffResponse(BaseModel):
    """Response from bulk delete staff."""

    success: bool
    message: str

