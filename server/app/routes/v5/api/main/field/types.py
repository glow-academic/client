"""Handcrafted types for field artifact endpoints (section-first parity)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.infra.field_create import CreateFieldItem
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.routes.v5.tools.resources.parameters.types import GetParameterResponse


class FieldFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class FieldNameSection(BaseResourceSection):
    resource: object | None = None
    resources: list | None = None


class FieldDescriptionSection(BaseResourceSection):
    resource: object | None = None
    resources: list | None = None


class FieldFlagSection(BaseResourceSection):
    resource: FieldFlagConfig | None = None
    resources: list[FieldFlagConfig] | None = None


class FieldDepartmentSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class FieldConditionalParameterSection(BaseResourceSection):
    current: list[GetParameterResponse] | None = None
    resources: list[GetParameterResponse] | None = None


class GetFieldApiRequest(BaseModel):
    """Request model for get field endpoint."""

    field_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID | None = None
    descriptions_search: str | None = None
    conditional_parameter_search: str | None = None
    conditional_parameter_show_selected: bool | None = None


class GetFieldApiResponse(BaseModel):
    """Section-first client response for get field endpoint."""

    actor_name: str | None = None
    field_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None

    names: FieldNameSection | None = None
    descriptions: FieldDescriptionSection | None = None
    flags: FieldFlagSection | None = None
    departments: FieldDepartmentSection | None = None
    conditional_parameters: FieldConditionalParameterSection | None = None


# ========== List Endpoint Types ==========


class ListFieldApiField(BaseModel):
    field_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    conditional_parameter_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    is_inactive: bool | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListFieldApiResponse(BaseModel):
    actor_name: str | None = None
    fields: list[ListFieldApiField] | None = None
    parameter_filter: ListFilterSection | None = None
    persona_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
    total_count: int | None = None


# ========== Shared Create/Update Types ==========


class FieldFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class FieldResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    field_id: UUID | None = None
    message: str
    errors: list[FieldFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateFieldApiRequest(BaseModel):
    """Request model for bulk create field endpoint."""

    fields: list[CreateFieldItem]
    group_id: UUID | None = None


class CreateFieldApiResponse(BaseModel):
    """Response model for bulk create field endpoint."""

    results: list[FieldResultItem]


# ========== Update Endpoint Types ==========


class UpdateFieldItem(BaseModel):
    """Single field item for update — field_id required, all fields optional.

    Only provided fields are updated (partial update).
    """

    field_id: UUID  # Required — which field to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    # Optional single-select — provide ID only
    flag_id: UUID | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    conditional_parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None


class UpdateFieldApiRequest(BaseModel):
    """Request model for bulk update field endpoint."""

    fields: list[UpdateFieldItem]
    group_id: UUID | None = None


class UpdateFieldApiResponse(BaseModel):
    """Response model for bulk update field endpoint."""

    results: list[FieldResultItem]


# ========== Legacy Save Types (backwards compat) ==========


class SaveFieldFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveFieldItem(BaseModel):
    """Single field item for save — provide ID or value per field (not both).

    For required fields (name), exactly one of the *_id or value field must be provided.
    """

    input_field_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    # Optional single-select — provide ID only
    flag_id: UUID | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    conditional_parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None


class SaveFieldApiRequest(BaseModel):
    """Request model for bulk save field endpoint."""

    fields: list[SaveFieldItem]
    group_id: UUID | None = None


class SaveFieldResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    field_id: UUID | None = None
    message: str
    errors: list[SaveFieldFieldError] | None = None


class SaveFieldApiResponse(BaseModel):
    """Response model for bulk save field endpoint."""

    results: list[SaveFieldResult]


# ========== Draft Endpoint Types (composable infra) ==========


class PatchFieldDraftApiRequest(BaseModel):
    """Request model for new-style field draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_id, department_ids, conditional_parameter_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    group_id: UUID | None = None
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
    conditional_parameter_ids: list[UUID] | None = None


class FieldDraftFormState(BaseModel):
    """Server-authoritative form state returned after draft save."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID]
    conditional_parameter_ids: list[UUID]


class PatchFieldDraftApiResponse(BaseModel):
    """Response model for new-style field draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
    form_state: FieldDraftFormState | None = None


# ========== Delete Endpoint Types ==========


class DeleteFieldApiRequest(BaseModel):
    """Request model for bulk delete field endpoint."""

    field_ids: list[UUID]


class DeleteFieldResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    field_id: UUID
    message: str


class DeleteFieldApiResponse(BaseModel):
    """Response model for bulk delete field endpoint."""

    results: list[DeleteFieldResult]


# ========== Duplicate Endpoint Types ==========


class DuplicateFieldApiRequest(BaseModel):
    field_id: UUID


class DuplicateFieldApiResponse(BaseModel):
    success: bool
    field_id: UUID
    message: str


# ========== Export Endpoint Types ==========


class ExportFieldApiResponse(BaseModel):
    """Response model for export field endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int
