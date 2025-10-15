"""Cohorts V2 API schemas."""

from typing import List, Optional

from pydantic import BaseModel

from .base import (CohortMapping, DepartmentMapping, ProfileMapping,
                   SimulationMapping)
from .staff import StaffItem

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class CohortsFilters(BaseModel):
    """Filters for cohorts list."""

    departmentIds: List[str]
    profileId: str


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class CohortItem(BaseModel):
    """Cohort item in list response."""

    cohort_id: str
    name: str  # Maps to cohorts.title
    description: Optional[str]
    active: bool
    default_cohort: bool
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    can_leave: bool
    profile_ids: List[str]
    simulation_ids: List[str]
    num_members: int


class CohortsListResponse(BaseModel):
    """Response for cohorts list endpoint."""

    cohorts: List[CohortItem]
    profile_mapping: ProfileMapping
    simulation_mapping: SimulationMapping


# ============================================================================
# DETAIL SCHEMAS
# ============================================================================


class CohortDetailRequest(BaseModel):
    """Request for cohort detail."""

    cohortId: str
    profileId: str


class CohortDetailResponse(BaseModel):
    """Response for cohort detail endpoint."""

    # Basic fields
    title: str  # cohorts.title
    description: Optional[str]
    department_id: str
    valid_department_ids: List[str]
    active: bool
    default_cohort: bool

    # Relationships
    simulation_ids: List[str]
    valid_simulation_ids: List[str]
    profile_ids: List[str]
    valid_profile_ids: List[str]

    # Top-level mappings
    simulation_mapping: SimulationMapping
    profile_mapping: ProfileMapping
    department_mapping: DepartmentMapping


class CohortDetailDefaultRequest(BaseModel):
    """Request for default cohort detail."""

    profileId: str


# ============================================================================
# MUTATION SCHEMAS
# ============================================================================


class CreateCohortRequest(BaseModel):
    """Request to create cohort."""

    title: str
    description: Optional[str]
    department_id: str
    active: bool
    default_cohort: bool
    simulation_ids: List[str]
    profile_ids: List[str]


class CreateCohortResponse(BaseModel):
    """Response from create cohort."""

    success: bool
    cohortId: str
    message: str


class UpdateCohortRequest(BaseModel):
    """Request to update cohort."""

    cohortId: str
    title: str
    description: Optional[str]
    department_id: str
    active: bool
    default_cohort: bool
    simulation_ids: List[str]
    profile_ids: List[str]


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
    departmentIds: List[str]  # Needed for creating new profiles with dept relationships
    existingProfileIds: Optional[List[str]] = None
    newProfiles: Optional[List[NewProfileForCohort]] = None


class AddProfilesToCohortResponse(BaseModel):
    """Response from add profiles to cohort."""

    success: bool
    message: str


class RemoveProfilesFromCohortRequest(BaseModel):
    """Request to remove profiles from cohort."""

    cohortId: str
    profileIds: List[str]


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
    departmentIds: List[str]
    currentProfileId: str


class CohortDetailWithProfilesResponse(BaseModel):
    """Response for cohort detail with available profiles."""

    # Cohort info
    cohort_id: str
    title: str
    description: Optional[str]
    active: bool

    # Profile IDs already in cohort
    current_profile_ids: List[str]

    # Available profiles (filtered: instructional/ta, not in cohort, not default)
    available_profiles: List[StaffItem]

    # Mappings
    department_mapping: DepartmentMapping
    cohort_mapping: CohortMapping

