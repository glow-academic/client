"""Rubrics V2 API schemas with hierarchical structure."""

from typing import Dict, List

from pydantic import BaseModel

from .base import DepartmentMapping, StandardGroupsMapping, StandardsMapping

# ============================================================================
# CENTRALIZED MAPPING TYPES
# ============================================================================


class StandardGroupMappingItem(BaseModel):
    """Standard group mapping item for list response."""

    name: str
    description: str
    points: int
    passPoints: int


class StandardMappingItem(BaseModel):
    """Standard mapping item."""

    name: str
    description: str
    points: int


class StandardGroupMappingDetail(BaseModel):
    """Standard group mapping for detail response."""

    name: str
    description: str


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class RubricsFilters(BaseModel):
    """Filters for rubrics list."""

    departmentIds: List[str]
    profileId: str


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class RubricItem(BaseModel):
    """Rubric item in list response with hierarchical structure."""

    rubric_id: str
    name: str
    description: str
    points: int
    passPoints: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    # Hierarchical: standard_group_id -> array of standard_ids
    standard_groups: Dict[str, List[str]]


class RubricsListResponse(BaseModel):
    """Response for rubrics list endpoint."""

    rubrics: List[RubricItem]
    standard_groups_mapping: StandardGroupsMapping
    standards_mapping: StandardsMapping


# ============================================================================
# DETAIL SCHEMAS
# ============================================================================


class RubricDetailRequest(BaseModel):
    """Request for rubric detail."""

    rubricId: str
    profileId: str


class StandardGroupDetail(BaseModel):
    """Standard group detail for detail response."""

    points: int
    passPoints: int
    standard_ids: List[str]


class RubricDetailResponse(BaseModel):
    """Response for rubric detail endpoint."""

    # Basic fields
    name: str
    description: str
    department_id: str
    valid_department_ids: List[str]
    points: int
    passPoints: int
    active: bool
    default_rubric: bool

    # Standard groups structure
    standard_group_ids: List[str]
    standard_groups_detail: Dict[str, StandardGroupDetail]

    # Top-level mappings
    standard_groups_mapping: StandardGroupsMapping
    standards_mapping: StandardsMapping
    department_mapping: DepartmentMapping


class RubricDetailDefaultRequest(BaseModel):
    """Request for default rubric detail."""

    profileId: str


# ============================================================================
# MUTATION SCHEMAS - NESTED STRUCTURES
# ============================================================================


class StandardCreate(BaseModel):
    """Standard creation schema."""

    name: str
    description: str
    points: int


class StandardGroupCreate(BaseModel):
    """Standard group creation schema with nested standards."""

    name: str
    short_name: str
    description: str
    points: int
    passPoints: int
    standards: List[StandardCreate]


class CreateRubricRequest(BaseModel):
    """Request to create rubric with nested structure."""

    name: str
    description: str
    department_id: str
    active: bool
    default_rubric: bool
    points: int
    passPoints: int
    standard_groups: List[StandardGroupCreate]


class CreateRubricResponse(BaseModel):
    """Response from create rubric."""

    success: bool
    rubricId: str
    message: str


class UpdateRubricRequest(BaseModel):
    """Request to update rubric with nested structure."""

    rubricId: str
    name: str
    description: str
    department_id: str
    active: bool
    default_rubric: bool
    points: int
    passPoints: int
    standard_groups: List[StandardGroupCreate]


class UpdateRubricResponse(BaseModel):
    """Response from update rubric."""

    success: bool
    message: str


class DuplicateRubricRequest(BaseModel):
    """Request to duplicate rubric."""

    rubricId: str


class DuplicateRubricResponse(BaseModel):
    """Response from duplicate rubric."""

    success: bool
    rubricId: str
    message: str


class DeleteRubricRequest(BaseModel):
    """Request to delete rubric."""

    rubricId: str


class DeleteRubricResponse(BaseModel):
    """Response from delete rubric."""

    success: bool
    message: str

