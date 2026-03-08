"""Handcrafted types for rubric artifact endpoints."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.types import BaseResourceSection, ListFilterSection


class RubricFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class RubricNameSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class RubricDescriptionSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class RubricFlagSection(BaseResourceSection):
    current: list[RubricFlagConfig] | None = None
    resources: list[RubricFlagConfig] | None = None


class RubricDepartmentSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class RubricPointsSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class RubricStandardGroupsSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class RubricStandardsSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class GetRubricApiRequest(BaseModel):
    rubric_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID


class GetRubricApiResponse(BaseModel):
    actor_name: str | None = None
    rubric_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    content_show_ai_generate: bool | None = None

    names: RubricNameSection | None = None
    descriptions: RubricDescriptionSection | None = None
    flags: RubricFlagSection | None = None
    departments: RubricDepartmentSection | None = None
    points: RubricPointsSection | None = None
    standard_groups: RubricStandardGroupsSection | None = None
    standards: RubricStandardsSection | None = None


# ========== Shared Create/Update Types ==========


class RubricFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class RubricResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    rubric_id: UUID | None = None
    message: str
    errors: list[RubricFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateRubricItem(BaseModel):
    """Single rubric item for create — no rubric_id."""

    id: UUID | None = None

    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    # ID-only fields
    point_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


class CreateRubricApiRequest(BaseModel):
    """Request model for bulk create rubric endpoint."""

    rubrics: list[CreateRubricItem]
    group_id: UUID | None = None


class CreateRubricApiResponse(BaseModel):
    """Response model for bulk create rubric endpoint."""

    results: list[RubricResultItem]


# ========== Update Endpoint Types ==========


class UpdateRubricItem(BaseModel):
    """Single rubric item for update — rubric_id required, all fields optional."""

    rubric_id: UUID  # Required — which rubric to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    # ID-only fields
    point_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


class UpdateRubricApiRequest(BaseModel):
    """Request model for bulk update rubric endpoint."""

    rubrics: list[UpdateRubricItem]
    group_id: UUID | None = None


class UpdateRubricApiResponse(BaseModel):
    """Response model for bulk update rubric endpoint."""

    results: list[RubricResultItem]


# ========== Legacy Save Types (backwards compat) ==========


class SaveRubricFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveRubricItem(BaseModel):
    """Single rubric item for save — provide ID or value per field (not both).

    For required fields (name), exactly one of the *_id or value field must be provided.
    """

    input_rubric_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    # ID-only fields
    point_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None


class SaveRubricApiRequest(BaseModel):
    """Request model for bulk save rubric endpoint."""

    rubrics: list[SaveRubricItem]
    group_id: UUID | None = None


class SaveRubricResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    rubric_id: UUID | None = None
    message: str
    errors: list[SaveRubricFieldError] | None = None


class SaveRubricApiResponse(BaseModel):
    """Response model for bulk save rubric endpoint."""

    results: list[SaveRubricResult]


class DeleteRubricApiRequest(BaseModel):
    """Request model for bulk delete rubric endpoint."""

    rubric_ids: list[UUID]


class DeleteRubricResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    rubric_id: UUID
    message: str


class DeleteRubricApiResponse(BaseModel):
    """Response model for bulk delete rubric endpoint."""

    results: list[DeleteRubricResult]


class DuplicateRubricApiRequest(BaseModel):
    rubric_id: UUID


class DuplicateRubricApiResponse(BaseModel):
    success: bool
    rubric_id: UUID
    message: str


# ========== Draft Endpoint Types (composable infra) ==========


class PatchRubricDraftApiRequest(BaseModel):
    """Request model for new-style rubric draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_id, department_ids, point_ids, standard_group_ids, standard_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    group_id: UUID
    input_draft_id: UUID | None = None
    expected_version: int = 0

    # Creatable single-select — provide value or ID
    name: str | None = None
    name_id: UUID | None = None
    description: str | None = None
    description_id: UUID | None = None

    # Non-creatable — ID-only
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    point_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


class PatchRubricDraftApiResponse(BaseModel):
    """Response model for new-style rubric draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


# ========== Export Endpoint Types ==========


class ExportRubricApiResponse(BaseModel):
    """Response model for export rubric endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int


# ========== List Endpoint Types ==========


class ListRubricApiRubric(BaseModel):
    rubric_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None
    pass_points: int | None = None
    pass_percentage: int | None = None
    department_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    active_simulation_count: int | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None
    standard_group_ids: list[UUID] | None = None


class ListRubricApiStandardGroup(BaseModel):
    standard_group_id: UUID | None = None
    rubric_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None
    pass_points: int | None = None


class ListRubricApiStandard(BaseModel):
    standard_id: UUID | None = None
    standard_group_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None


class ListRubricApiResponse(BaseModel):
    actor_name: str | None = None
    rubrics: list[ListRubricApiRubric] | None = None
    standard_groups: list[ListRubricApiStandardGroup] | None = None
    standards: list[ListRubricApiStandard] | None = None
    department_filter: ListFilterSection | None = None
    simulation_filter: ListFilterSection | None = None
    total_count: int | None = None
