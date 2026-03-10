"""Handcrafted types for department artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.infra.department_create import CreateDepartmentItem
from app.routes.v5.api.types import BaseResourceSection
from app.routes.v5.tools.entries.department_drafts.types import (
    GetDepartmentDraftResponse,
)


class GetDepartmentDraftsApiResponse(BaseModel):
    """Response model for department drafts list endpoint."""

    entries: list[GetDepartmentDraftResponse] | None = None


class DepartmentFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class DepartmentNameSection(BaseResourceSection):
    resource: object | None = None
    resources: list | None = None


class DepartmentDescriptionSection(BaseResourceSection):
    resource: object | None = None
    resources: list | None = None


class DepartmentFlagSection(BaseResourceSection):
    current: list[DepartmentFlagConfig] | None = None
    resources: list[DepartmentFlagConfig] | None = None


class DepartmentSettingSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class GetDepartmentApiRequest(BaseModel):
    department_id: UUID | None = None
    draft_id: UUID | None = None


class GetDepartmentApiResponse(BaseModel):
    actor_name: str | None = None
    department_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None

    names: DepartmentNameSection | None = None
    descriptions: DepartmentDescriptionSection | None = None
    flags: DepartmentFlagSection | None = None
    settings: DepartmentSettingSection | None = None


# ========== Shared Create/Update Types ==========


class DepartmentFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class DepartmentResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    department_id: UUID | None = None
    message: str
    errors: list[DepartmentFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateDepartmentApiRequest(BaseModel):
    """Request model for bulk create department endpoint."""

    departments: list[CreateDepartmentItem]


class CreateDepartmentApiResponse(BaseModel):
    """Response model for bulk create department endpoint."""

    results: list[DepartmentResultItem]


# ========== Update Endpoint Types ==========


class UpdateDepartmentItem(BaseModel):
    """Single department item for update — department_id required, all fields optional."""

    department_id: UUID  # Required — which department to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # ID-only fields
    settings_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None


class UpdateDepartmentApiRequest(BaseModel):
    """Request model for bulk update department endpoint."""

    departments: list[UpdateDepartmentItem]


class UpdateDepartmentApiResponse(BaseModel):
    """Response model for bulk update department endpoint."""

    results: list[DepartmentResultItem]


class SaveDepartmentFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class DeleteDepartmentApiRequest(BaseModel):
    """Request model for bulk delete department endpoint."""

    department_ids: list[UUID]


class DeleteDepartmentResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    department_id: UUID
    message: str


class DeleteDepartmentApiResponse(BaseModel):
    """Response model for bulk delete department endpoint."""

    results: list[DeleteDepartmentResult]


class DuplicateDepartmentApiRequest(BaseModel):
    department_id: UUID


class DuplicateDepartmentApiResponse(BaseModel):
    success: bool
    department_id: UUID
    message: str


# ========== Draft Endpoint Types (composable infra) ==========


class PatchDepartmentDraftApiRequest(BaseModel):
    """Request model for new-style department draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_id, setting_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    input_draft_id: UUID | None = None
    expected_version: int = 0

    # Creatable single-select — provide value or ID
    name: str | None = None
    name_id: UUID | None = None
    description: str | None = None
    description_id: UUID | None = None

    # Non-creatable — ID-only
    flag_id: UUID | None = None
    setting_ids: list[UUID] | None = None


class DepartmentDraftFormState(BaseModel):
    """Server-authoritative form state returned after draft save."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    setting_ids: list[UUID]


class PatchDepartmentDraftApiResponse(BaseModel):
    """Response model for new-style department draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
    form_state: DepartmentDraftFormState | None = None


# ========== Export Endpoint Types ==========


class ExportDepartmentApiResponse(BaseModel):
    """Response model for export department endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int


class ListDepartmentApiDepartment(BaseModel):
    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    staff_count: int | None = None
    is_inactive: bool | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListDepartmentApiResponse(BaseModel):
    actor_name: str | None = None
    departments: list[ListDepartmentApiDepartment] | None = None
    total_count: int | None = None
