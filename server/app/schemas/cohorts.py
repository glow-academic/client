"""Cohorts V2 API schemas."""

from typing import Dict, List, Optional

from pydantic import BaseModel

from .personas import DepartmentMappingItem

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
    profile_ids: List[str]
    simulation_ids: List[str]


class CohortsListResponse(BaseModel):
    """Response for cohorts list endpoint."""

    cohorts: List[CohortItem]
    profile_mapping: Dict[str, str]  # profile_id -> name
    simulation_mapping: Dict[str, str]  # simulation_id -> name


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
    simulation_mapping: Dict[str, str]
    profile_mapping: Dict[str, str]
    department_mapping: Dict[str, DepartmentMappingItem]


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

