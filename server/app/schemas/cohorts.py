"""Cohorts V2 API schemas."""

from pydantic import BaseModel

from .base import (CohortMapping, DepartmentMapping, ProfileMapping,
                   SimulationMapping)
from .staff import StaffItem

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class CohortsFilters(BaseModel):
    """Filters for cohorts list."""

    profileId: str


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class CohortItem(BaseModel):
    """Cohort item in list response."""

    cohort_id: str
    name: str  # Maps to cohorts.title
    description: str | None
    active: bool
    department_ids: list[str] | None  # None = cross-department (all departments)
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    can_leave: bool
    profile_ids: list[str]
    simulation_ids: list[str]
    num_members: int


class CohortsListResponse(BaseModel):
    """Response for cohorts list endpoint."""

    cohorts: list[CohortItem]
    profile_mapping: ProfileMapping
    simulation_mapping: SimulationMapping
    department_mapping: DepartmentMapping


# ============================================================================
# DETAIL SCHEMAS
# ============================================================================


class CohortDetailRequest(BaseModel):
    """Request for cohort detail."""

    cohortId: str
    profileId: str


class SimulationInCohort(BaseModel):
    """Simulation with cohort-specific statistics."""

    simulation_id: str
    name: str
    description: str
    time_limit: int | None
    active: bool

    # Cohort-specific statistics
    usage_count: int  # Number of attempts by cohort members
    success_rate: int  # Percentage (0-100) of graded attempts that passed
    last_used: str | None  # ISO timestamp or None
    can_remove: bool  # True if usage_count == 0


class CohortDetailResponse(BaseModel):
    """Response for cohort detail endpoint."""

    # Basic fields
    title: str  # cohorts.title
    description: str | None
    department_ids: list[str] | None  # None = cross-department (all departments)
    valid_department_ids: list[str]
    active: bool

    # Relationships
    simulation_ids: list[str]
    valid_simulation_ids: list[str]
    profile_ids: list[str]
    valid_profile_ids: list[str]

    # Full simulation objects with cohort-specific statistics
    simulations: list[SimulationInCohort]

    # Staff list (full ProfileListItem format)
    staff: list[StaffItem]

    # Top-level mappings
    simulation_mapping: SimulationMapping
    profile_mapping: ProfileMapping
    department_mapping: DepartmentMapping
    # Mappings for staff display (cohorts and departments)
    cohort_mapping: CohortMapping | None = None
    department_mapping_for_staff: DepartmentMapping | None = None


class CohortDetailDefaultRequest(BaseModel):
    """Request for default cohort detail."""

    profileId: str


# ============================================================================
# MUTATION SCHEMAS
# ============================================================================


class SimulationInRequest(BaseModel):
    """Simulation with active state for create/update requests."""

    simulation_id: str
    active: bool = True


class CreateCohortRequest(BaseModel):
    """Request to create cohort."""

    title: str
    description: str | None
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    active: bool
    simulation_ids: list[str] | list[SimulationInRequest]  # Support both formats
    profile_ids: list[str]


class CreateCohortResponse(BaseModel):
    """Response from create cohort."""

    success: bool
    cohortId: str
    message: str


class UpdateCohortRequest(BaseModel):
    """Request to update cohort."""

    cohortId: str
    title: str
    description: str | None
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    active: bool
    simulation_ids: list[str] | list[SimulationInRequest]  # Support both formats
    profile_ids: list[str]


class UpdateCohortResponse(BaseModel):
    """Response from update cohort."""

    success: bool
    message: str


class DuplicateCohortRequest(BaseModel):
    """Request to duplicate cohort."""

    cohortId: str


class DuplicateCohortResponse(BaseModel):
    """Response from duplicate cohort."""

    success: bool
    cohortId: str
    message: str


class DeleteCohortRequest(BaseModel):
    """Request to delete cohort."""

    cohortId: str


class DeleteCohortResponse(BaseModel):
    """Response from delete cohort."""

    success: bool
    message: str


class LeaveCohortRequest(BaseModel):
    """Request to leave cohort."""

    cohortId: str
    profileId: str


class LeaveCohortResponse(BaseModel):
    """Response from leave cohort."""

    success: bool
    message: str


class NewProfileForCohort(BaseModel):
    """New profile to create and add to cohort."""

    firstName: str
    lastName: str
    alias: str
    role: str


class AddProfilesToCohortRequest(BaseModel):
    """Request to add profiles to cohort (supports both existing and new)."""

    cohortId: str
    departmentIds: list[str]  # Needed for creating new profiles with dept relationships
    existingProfileIds: list[str] | None = None
    newProfiles: list[NewProfileForCohort] | None = None


class AddProfilesToCohortResponse(BaseModel):
    """Response from add profiles to cohort."""

    success: bool
    message: str


class RemoveProfilesFromCohortRequest(BaseModel):
    """Request to remove profiles from cohort."""

    cohortId: str
    profileIds: list[str]
    currentProfileId: str  # Current user's profile ID for permission validation


class RemoveProfilesFromCohortResponse(BaseModel):
    """Response from remove profiles from cohort."""

    success: bool
    message: str


# ============================================================================
# COHORT DETAIL WITH PROFILES (unified endpoint)
# ============================================================================


class CohortDetailWithProfilesRequest(BaseModel):
    """Request for cohort detail with available profiles."""

    cohortId: str
    departmentIds: list[str]
    currentProfileId: str


class CohortDetailWithProfilesResponse(BaseModel):
    """Response for cohort detail with available profiles."""

    # Cohort info
    cohort_id: str
    title: str
    description: str | None
    active: bool

    # Profile IDs already in cohort
    current_profile_ids: list[str]

    # Available profiles (filtered: instructional/ta, not in cohort, not default)
    available_profiles: list[StaffItem]

    # Mappings
    department_mapping: DepartmentMapping
    cohort_mapping: CohortMapping
