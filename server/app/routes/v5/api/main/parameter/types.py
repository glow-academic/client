"""Handcrafted types for parameter artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.main.types import InternalResponseBase
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse

# ---------------------------------------------------------------------------
# Handcrafted resource types (replaces Q types from app.sql.types)
# ---------------------------------------------------------------------------


class ParameterNameResource(BaseModel):
    """Name resource for parameter."""

    id: UUID | None = None
    name: str | None = None
    generated: bool | None = None


class ParameterDescriptionResource(BaseModel):
    """Description resource for parameter."""

    id: UUID | None = None
    description: str | None = None
    generated: bool | None = None


class ParameterDepartmentResource(BaseModel):
    """Department resource for parameter."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class ParameterFieldResource(BaseModel):
    """Parameter field resource for parameter."""

    id: UUID | None = None
    field_id: UUID | None = None
    parameter_id: UUID | None = None
    name: str | None = None
    generated: bool | None = None


class ParameterDraftEntry(BaseModel):
    """Draft entry for parameter."""

    id: UUID | None = None
    version: int | None = None
    created_at: datetime | None = None
    generated: bool | None = None
    mcp: bool | None = None
    active: bool | None = None
    group_id: UUID | None = None
    session_id: UUID | None = None
    department_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    name_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None


class ParameterFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


# ---------------------------------------------------------------------------
# Section types
# ---------------------------------------------------------------------------


class ParameterNameSection(BaseResourceSection):
    resource: ParameterNameResource | None = None
    resources: list[ParameterNameResource] | None = None


class ParameterDescriptionSection(BaseResourceSection):
    resource: ParameterDescriptionResource | None = None
    resources: list[ParameterDescriptionResource] | None = None


class ParameterFlagSection(BaseResourceSection):
    current: list[ParameterFlagConfig] | None = None
    resources: list[ParameterFlagConfig] | None = None


class ParameterDepartmentSection(BaseResourceSection):
    current: list[ParameterDepartmentResource] | None = None
    resources: list[ParameterDepartmentResource] | None = None


class ParameterFieldSection(BaseResourceSection):
    current: list[ParameterFieldResource] | None = None
    resources: list[ParameterFieldResource] | None = None


# ---------------------------------------------------------------------------
# GET endpoint types
# ---------------------------------------------------------------------------


class GetParameterApiRequest(BaseModel):
    """Request model for get parameter endpoint."""

    parameter_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID


class GetParameterApiResponse(BaseModel):
    """Section-first client response for get parameter endpoint."""

    actor_name: str | None = None
    parameter_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    fields_step_show_ai_generate: bool | None = None

    names: ParameterNameSection | None = None
    descriptions: ParameterDescriptionSection | None = None
    flags: ParameterFlagSection | None = None
    departments: ParameterDepartmentSection | None = None
    fields: ParameterFieldSection | None = None


# ---------------------------------------------------------------------------
# Websocket types
# ---------------------------------------------------------------------------


class ParameterWebsocketEntries(BaseModel):
    draft_parameter: ParameterDraftEntry | None = None
    runs: GetRunListViewResponse | None = None


class ParameterWebsocketResources(BaseModel):
    """Hydrated selected resources for websocket generation context."""

    names: list[ParameterNameResource] | None = None
    descriptions: list[ParameterDescriptionResource] | None = None
    flags: list[ParameterFlagConfig] | None = None
    departments: list[ParameterDepartmentResource] | None = None
    fields: list[ParameterFieldResource] | None = None


class GetParameterWebsocketResponse(InternalResponseBase):
    entries: ParameterWebsocketEntries | None = None
    resources: ParameterWebsocketResources


# ========== List Endpoint Types ==========


class ListParameterApiParameter(BaseModel):
    parameter_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    num_items: int | None = None
    sample_items: list[str] | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListParameterApiResponse(BaseModel):
    actor_name: str | None = None
    parameters: list[ListParameterApiParameter] | None = None
    scenario_filter: ListFilterSection | None = None
    field_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
    total_count: int | None = None


# ========== Save/Draft Types ==========


class SaveParameterFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveParameterItem(BaseModel):
    """Single parameter item for save — provide ID or value per field (not both).

    For required fields (name), exactly one of the *_id or value field must be provided.
    """

    input_parameter_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    flag_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None


class SaveParameterApiRequest(BaseModel):
    """Request model for bulk save parameter endpoint."""

    parameters: list[SaveParameterItem]
    group_id: UUID | None = None


class SaveParameterResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    parameter_id: UUID | None = None
    message: str
    errors: list[SaveParameterFieldError] | None = None


class SaveParameterApiResponse(BaseModel):
    """Response model for bulk save parameter endpoint."""

    results: list[SaveParameterResult]


# ========== Draft Endpoint Types (composable infra) ==========


class PatchParameterDraftApiRequest(BaseModel):
    """Request model for new-style parameter draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_ids, department_ids, field_ids

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
    field_ids: list[UUID] | None = None


class PatchParameterDraftApiResponse(BaseModel):
    """Response model for new-style parameter draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


# ========== Delete Endpoint Types ==========


class DeleteParameterApiRequest(BaseModel):
    """Request model for bulk delete parameter endpoint."""

    parameter_ids: list[UUID]


class DeleteParameterResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    parameter_id: UUID
    message: str


class DeleteParameterApiResponse(BaseModel):
    """Response model for bulk delete parameter endpoint."""

    results: list[DeleteParameterResult]


# ========== Duplicate Endpoint Types ==========


class DuplicateParameterApiRequest(BaseModel):
    parameter_id: UUID


class DuplicateParameterApiResponse(BaseModel):
    success: bool
    parameter_id: UUID
    message: str
