"""Handcrafted types for eval artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.infra.eval_create import CreateEvalItem

# ========== Eval-specific resource types ==========


class EvalFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "active", "dynamic", "groups"
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


# ========== GET Endpoint Types - Section Types ==========


class EvalNameSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class EvalDescriptionSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class EvalFlagSection(BaseResourceSection):
    resource: EvalFlagConfig | None = None
    resources: list[EvalFlagConfig] | None = None


class EvalDepartmentSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class EvalModelSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class EvalModelFlagSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class EvalModelRubricSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class EvalModelPositionSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class GetEvalApiRequest(BaseModel):
    """Request model for get eval endpoint."""

    eval_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID


class GetEvalApiResponse(BaseModel):
    """Response model for get eval endpoint."""

    actor_name: str | None = None
    eval_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    model_show_ai_generate: bool | None = None

    names: EvalNameSection | None = None
    descriptions: EvalDescriptionSection | None = None
    active_flags: EvalFlagSection | None = None
    dynamic_flags: EvalFlagSection | None = None
    groups_flags: EvalFlagSection | None = None
    departments: EvalDepartmentSection | None = None
    models: EvalModelSection | None = None
    model_flags: EvalModelFlagSection | None = None
    model_rubrics: EvalModelRubricSection | None = None
    model_positions: EvalModelPositionSection | None = None


# ========== List Endpoint Types ==========


class ListEvalApiEval(BaseModel):
    """Eval type for list endpoint with computed permissions."""

    eval_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    is_inactive: bool | None = None
    is_dynamic: bool | None = None
    use_groups: bool | None = None
    num_runs: int | None = None
    num_groups: int | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListEvalApiResponse(BaseModel):
    """Response model for list eval endpoint with computed permissions."""

    actor_name: str | None = None
    evals: list[ListEvalApiEval] | None = None
    department_filter: ListFilterSection | None = None
    total_count: int | None = None
    user_role: str | None = None


# ========== Shared Create/Update Types ==========


class EvalFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class EvalResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    eval_id: UUID | None = None
    message: str
    errors: list[EvalFieldError] | None = None


# ========== Create Endpoint Types ==========



class CreateEvalApiRequest(BaseModel):
    """Request model for bulk create eval endpoint."""

    evals: list[CreateEvalItem]
    group_id: UUID | None = None


class CreateEvalApiResponse(BaseModel):
    """Response model for bulk create eval endpoint."""

    results: list[EvalResultItem]


# ========== Update Endpoint Types ==========


class UpdateEvalItem(BaseModel):
    """Single eval item for update — eval_id required, all fields optional.

    Only provided fields are updated (partial update).
    """

    eval_id: UUID  # Required — which eval to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    # Multi-select — IDs only (matching get.py junctions)
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    model_ids: list[UUID] | None = None
    model_flag_ids: list[UUID] | None = None
    model_rubric_ids: list[UUID] | None = None
    model_position_ids: list[UUID] | None = None


class UpdateEvalApiRequest(BaseModel):
    """Request model for bulk update eval endpoint."""

    evals: list[UpdateEvalItem]
    group_id: UUID | None = None


class UpdateEvalApiResponse(BaseModel):
    """Response model for bulk update eval endpoint."""

    results: list[EvalResultItem]


# ========== Legacy Save Types (backwards compat) ==========


class SaveEvalFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveEvalItem(BaseModel):
    """Single eval item for save — provide ID or value per field (not both).

    For required fields (name), exactly one of the *_id or value field
    must be provided.
    """

    input_eval_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    # Multi-select — IDs only (matching get.py junctions)
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    model_ids: list[UUID] | None = None
    model_flag_ids: list[UUID] | None = None
    model_rubric_ids: list[UUID] | None = None
    model_position_ids: list[UUID] | None = None


class SaveEvalApiRequest(BaseModel):
    """Request model for bulk save eval endpoint."""

    evals: list[SaveEvalItem]
    group_id: UUID | None = None


class SaveEvalResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    eval_id: UUID | None = None
    message: str
    errors: list[SaveEvalFieldError] | None = None


class SaveEvalApiResponse(BaseModel):
    """Response model for bulk save eval endpoint."""

    results: list[SaveEvalResult]


class SaveEvalSqlParams(BaseModel):
    profile_id: UUID
    group_id: UUID
    input_eval_id: UUID | None = None

    name_id: UUID
    description_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None
    model_flag_ids: list[UUID] | None = None
    model_rubric_ids: list[UUID] | None = None
    model_position_ids: list[UUID] | None = None

    @classmethod
    def from_request(
        cls,
        request: SaveEvalApiRequest,
        profile_id: UUID,
        group_id: UUID | None,
    ) -> SaveEvalSqlParams:
        return cls(
            profile_id=profile_id,
            group_id=group_id,
            input_eval_id=request.input_eval_id,
            name_id=request.name_id,
            description_id=request.description_id,
            flag_ids=request.flag_ids,
            department_ids=request.department_ids,
            rubric_ids=request.rubric_ids,
            model_ids=request.model_ids,
            model_flag_ids=request.model_flag_ids,
            model_rubric_ids=request.model_rubric_ids,
            model_position_ids=request.model_position_ids,
        )

    def to_tuple(self) -> tuple:
        return (
            self.profile_id,
            self.group_id,
            self.input_eval_id,
            self.name_id,
            self.description_id,
            self.flag_ids,
            self.department_ids,
            self.rubric_ids,
            self.model_ids,
            self.model_flag_ids,
            self.model_rubric_ids,
            self.model_position_ids,
        )


class SaveEvalSqlRow(BaseModel):
    """SQL row for save eval."""

    eval_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteEvalApiRequest(BaseModel):
    """Request model for bulk delete eval endpoint."""

    eval_ids: list[UUID]


class DeleteEvalResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    eval_id: UUID
    message: str


class DeleteEvalApiResponse(BaseModel):
    """Response model for bulk delete eval endpoint."""

    results: list[DeleteEvalResult]


# ========== Duplicate Endpoint Types ==========


class DuplicateEvalApiRequest(BaseModel):
    """Request model for duplicate eval endpoint."""

    eval_id: UUID


class DuplicateEvalApiResponse(BaseModel):
    """Response model for duplicate eval endpoint."""

    success: bool
    eval_id: UUID
    message: str


# ========== Draft Endpoint Types (composable infra) ==========


class PatchEvalDraftApiRequest(BaseModel):
    """Request model for new-style eval draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_ids, department_ids, model_ids, rubric_ids

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
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None


class PatchEvalDraftApiResponse(BaseModel):
    """Response model for new-style eval draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


# ========== Export Endpoint Types ==========


class ExportEvalApiResponse(BaseModel):
    """Response model for export eval endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int
