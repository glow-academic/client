"""Staff V2 API schemas."""

from pydantic import BaseModel

from .analytics import TrendData
from .base import CohortMapping, DepartmentMapping

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class StaffFilters(BaseModel):
    """Filters for staff list."""

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
    last_active: str | None
    cohort_ids: list[str]
    department_ids: list[str]
    requests_per_day: int | None
    total_requests: int
    default_profile: bool
    requests_in_last_day: int
    can_edit: bool
    can_delete: bool


class StaffListResponse(BaseModel):
    """Response for staff list endpoint."""

    staff: list[StaffItem]
    cohort_mapping: CohortMapping
    department_mapping: DepartmentMapping
    trend_data: dict[str, list[TrendData]]  # Keys: active, admin, instructional, ta, total_requests


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
    requests_per_day: int | None | str = None  # int for limit, None for unlimited, "__keep__" to not update
    default_profile: bool | None = None
    currentProfileId: str  # Current user's profile ID for permission validation
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


# ============================================================================
# CREATE STAFF DATA SCHEMAS
# ============================================================================


class CreateStaffDataRequest(BaseModel):
    """Request for create staff data (mappings, etc.)."""

    departmentIds: list[str]
    profileId: str  # Current user's profile for permissions


class CreateStaffDataResponse(BaseModel):
    """Response with all data needed for create staff UI."""

    department_mapping: DepartmentMapping
    cohort_mapping: CohortMapping
    role_options: list[str]


# ============================================================================
# CSV PROCESSING SCHEMAS
# ============================================================================


class CSVColumnMapping(BaseModel):
    """Mapping of CSV column to target field."""

    csv_column: str
    target_field: str | None  # firstName, lastName, alias, department, cohort


class CSVRowError(BaseModel):
    """Error for a specific CSV row."""

    row_index: int
    field: str
    message: str


class ProcessCSVRequest(BaseModel):
    """Request to process CSV file."""

    csv_content: str
    column_mappings: list[CSVColumnMapping]


class ProcessedCSVRow(BaseModel):
    """Processed row from CSV."""

    row_index: int
    firstName: str | None
    lastName: str | None
    alias: str | None
    role: str | None
    department_ids: list[str] = []  # Array for multi-select support
    cohort_ids: list[str] = []  # Array for multi-select support
    errors: list[CSVRowError]


class ProcessCSVResponse(BaseModel):
    """Response from CSV processing."""

    success: bool
    rows: list[ProcessedCSVRow]
    headers: list[str]


# ============================================================================
# CREATE OR UPDATE STAFF SCHEMAS
# ============================================================================


class CreateOrUpdateStaffRequest(BaseModel):
    """Request to create or update a single staff member."""

    firstName: str
    lastName: str
    alias: str
    role: str
    department_ids: list[str] = []
    cohort_ids: list[str] = []


class CreateOrUpdateStaffResponse(BaseModel):
    """Response from create or update staff."""

    success: bool
    profileId: str
    created: bool  # True if created, False if updated
    message: str


class BulkCreateOrUpdateStaffRequest(BaseModel):
    """Request to bulk create or update staff members."""

    profiles: list[CreateOrUpdateStaffRequest]
    currentProfileId: str  # Current user's profile ID for role validation


class BulkCreateOrUpdateStaffResponse(BaseModel):
    """Response from bulk create or update staff."""

    success: bool
    profileIds: list[str]
    created_count: int
    updated_count: int
    message: str
