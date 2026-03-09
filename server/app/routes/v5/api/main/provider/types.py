"""Handcrafted types for provider artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.infra.provider_create import CreateProviderItem
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.routes.v5.tools.entries.provider_drafts.types import GetProviderDraftResponse


class ProviderFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class ProviderNameSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class ProviderDescriptionSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class ProviderFlagSection(BaseResourceSection):
    current: list[ProviderFlagConfig] | None = None
    resources: list[ProviderFlagConfig] | None = None


class ProviderDepartmentSection(BaseResourceSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class ProviderValueSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class ProviderEndpointSection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class ProviderKeySection(BaseResourceSection):
    resource: Any | None = None
    resources: list[Any] | None = None


class GetProviderApiRequest(BaseModel):
    """Request model for get provider endpoint."""

    provider_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID | None = None


class GetProviderApiResponse(BaseModel):
    """Section-first response for provider editor."""

    actor_name: str | None = None
    provider_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    integrations_show_ai_generate: bool | None = None

    names: ProviderNameSection | None = None
    descriptions: ProviderDescriptionSection | None = None
    flags: ProviderFlagSection | None = None
    departments: ProviderDepartmentSection | None = None
    values: ProviderValueSection | None = None
    endpoints: ProviderEndpointSection | None = None
    keys: ProviderKeySection | None = None


class ListProviderApiProvider(BaseModel):
    """Provider type for list endpoint with computed permissions."""

    provider_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    active: bool | None = None
    updated_at: datetime | None = None
    department_ids: list[UUID] | None = None
    model_usage_count: int | None = None
    model_ids: list[UUID] | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None


class ListProviderApiResponse(BaseModel):
    actor_name: str | None = None
    providers: list[ListProviderApiProvider] | None = None
    department_filter: ListFilterSection | None = None
    model_filter: ListFilterSection | None = None
    status_filter: ListFilterSection | None = None
    total_count: int | None = None


# ========== Shared Create/Update Types ==========


class ProviderFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class ProviderResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    provider_id: UUID | None = None
    message: str
    errors: list[ProviderFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateProviderApiRequest(BaseModel):
    """Request model for bulk create provider endpoint."""

    providers: list[CreateProviderItem]
    group_id: UUID | None = None


class CreateProviderApiResponse(BaseModel):
    """Response model for bulk create provider endpoint."""

    results: list[ProviderResultItem]


# ========== Update Endpoint Types ==========


class UpdateProviderItem(BaseModel):
    """Single provider item for update — provider_id required, all fields optional."""

    provider_id: UUID  # Required — which provider to update
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
    endpoint_ids: list[UUID] | None = None
    key_ids: list[UUID] | None = None
    value_ids: list[UUID] | None = None


class UpdateProviderApiRequest(BaseModel):
    """Request model for bulk update provider endpoint."""

    providers: list[UpdateProviderItem]
    group_id: UUID | None = None


class UpdateProviderApiResponse(BaseModel):
    """Response model for bulk update provider endpoint."""

    results: list[ProviderResultItem]


class SaveProviderFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class DeleteProviderApiRequest(BaseModel):
    """Request model for bulk delete provider endpoint."""

    provider_ids: list[UUID]


class DeleteProviderResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    provider_id: UUID
    message: str


class DeleteProviderApiResponse(BaseModel):
    """Response model for bulk delete provider endpoint."""

    results: list[DeleteProviderResult]


class DuplicateProviderApiRequest(BaseModel):
    provider_id: UUID


class DuplicateProviderApiResponse(BaseModel):
    success: bool
    provider_id: UUID
    message: str


# ========== Draft Endpoint Types (composable infra) ==========


class PatchProviderDraftApiRequest(BaseModel):
    """Request model for new-style provider draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_id, department_ids, endpoint_ids, key_ids, value_ids

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
    endpoint_ids: list[UUID] | None = None
    key_ids: list[UUID] | None = None
    value_ids: list[UUID] | None = None


class ProviderDraftFormState(BaseModel):
    """Server-authoritative form state returned after draft save."""

    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID]
    endpoint_ids: list[UUID]
    key_ids: list[UUID]
    value_ids: list[UUID]


class PatchProviderDraftApiResponse(BaseModel):
    """Response model for new-style provider draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
    form_state: ProviderDraftFormState | None = None


class GetProviderDraftsApiResponse(BaseModel):
    """Response model for provider drafts list endpoint."""

    entries: list[GetProviderDraftResponse] | None = None


# ========== Export Endpoint Types ==========


class ExportProviderApiResponse(BaseModel):
    """Response model for export provider endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int
