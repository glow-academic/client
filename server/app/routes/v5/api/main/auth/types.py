"""Handcrafted types for auth artifact endpoints."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.types import BaseResourceSection, ListFilterSection


class AuthFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class AuthItemResource(BaseModel):
    """Auth item resource shape for client/editing."""

    auth_item_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    position: int | None = None
    active: bool | None = None
    value_masked: str | None = None
    key_id: UUID | None = None
    encrypted: bool | None = None
    generated: bool | None = None


class AuthNameSection(BaseResourceSection):
    resource: object | None = None
    resources: list | None = None


class AuthDescriptionSection(BaseResourceSection):
    resource: object | None = None
    resources: list | None = None


class AuthFlagSection(BaseResourceSection):
    current: list[AuthFlagConfig] | None = None
    resources: list[AuthFlagConfig] | None = None


class AuthProtocolSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class AuthSlugSection(BaseResourceSection):
    current: list | None = None
    resources: list | None = None


class AuthItemSection(BaseResourceSection):
    current: list[AuthItemResource] | None = None
    resources: list[AuthItemResource] | None = None


class GetAuthApiRequest(BaseModel):
    """Request model for get auth endpoint."""

    auth_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID


class GetAuthApiResponse(BaseModel):
    """Response model for get auth endpoint."""

    actor_name: str | None = None
    auth_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None

    names: AuthNameSection | None = None
    descriptions: AuthDescriptionSection | None = None
    flags: AuthFlagSection | None = None
    protocols: AuthProtocolSection | None = None
    slugs: AuthSlugSection | None = None
    items: AuthItemSection | None = None


class SaveAuthItemInput(BaseModel):
    """Auth item input for save/draft endpoints."""

    name: str
    description: str | None = None
    encrypted: bool = True
    position: int | None = None
    active: bool = True
    key_id: UUID | None = None


# ========== Shared Create/Update Types ==========


class AuthFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class AuthResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    auth_id: UUID | None = None
    message: str
    errors: list[AuthFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateAuthItem(BaseModel):
    """Single auth item for create — no auth_id.

    Required fields (name): provide ID or value.
    """

    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    slug_id: UUID | None = None
    # Optional flag
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    protocol_ids: list[UUID] | None = None
    item_ids: list[UUID] | None = None
    auth_resource_ids: list[UUID] | None = None


class CreateAuthApiRequest(BaseModel):
    """Request model for bulk create auth endpoint."""

    auths: list[CreateAuthItem]
    group_id: UUID | None = None


class CreateAuthApiResponse(BaseModel):
    """Response model for bulk create auth endpoint."""

    results: list[AuthResultItem]


# ========== Update Endpoint Types ==========


class UpdateAuthItem(BaseModel):
    """Single auth item for update — auth_id required, all fields optional."""

    auth_id: UUID  # Required — which auth to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    slug_id: UUID | None = None
    # Optional flag
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    protocol_ids: list[UUID] | None = None
    item_ids: list[UUID] | None = None
    auth_resource_ids: list[UUID] | None = None


class UpdateAuthApiRequest(BaseModel):
    """Request model for bulk update auth endpoint."""

    auths: list[UpdateAuthItem]
    group_id: UUID | None = None


class UpdateAuthApiResponse(BaseModel):
    """Response model for bulk update auth endpoint."""

    results: list[AuthResultItem]


# ========== Legacy Save Types (backwards compat) ==========


class SaveAuthFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveAuthItem(BaseModel):
    """Single auth item for save — provide ID or value per field (not both).

    For required fields (name), exactly one of the *_id or value field must be provided.
    """

    input_auth_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    slug_id: UUID | None = None
    # Optional flag
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    protocol_ids: list[UUID] | None = None
    item_ids: list[UUID] | None = None
    auth_resource_ids: list[UUID] | None = None


class SaveAuthApiRequest(BaseModel):
    """Request model for bulk save auth endpoint."""

    auths: list[SaveAuthItem]
    group_id: UUID | None = None


class SaveAuthResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    auth_id: UUID | None = None
    message: str
    errors: list[SaveAuthFieldError] | None = None


class SaveAuthApiResponse(BaseModel):
    """Response model for bulk save auth endpoint."""

    results: list[SaveAuthResult]


class DeleteAuthApiRequest(BaseModel):
    """Request model for bulk delete auth endpoint."""

    auth_ids: list[UUID]


class DeleteAuthResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    auth_id: UUID
    message: str


class DeleteAuthApiResponse(BaseModel):
    """Response model for bulk delete auth endpoint."""

    results: list[DeleteAuthResult]


class DuplicateAuthApiRequest(BaseModel):
    """Request model for duplicate auth endpoint."""

    auth_id: UUID


class DuplicateAuthApiResponse(BaseModel):
    """Response model for duplicate auth endpoint."""

    success: bool
    auth_id: UUID
    message: str


# ========== Draft Endpoint Types (composable infra) ==========


class PatchAuthDraftApiRequest(BaseModel):
    """Request model for new-style auth draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_id, department_ids, protocol_ids, slug_ids, item_ids

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
    protocol_ids: list[UUID] | None = None
    slug_ids: list[UUID] | None = None
    item_ids: list[UUID] | None = None


class PatchAuthDraftApiResponse(BaseModel):
    """Response model for new-style auth draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


# ========== Export Endpoint Types ==========


class ExportAuthApiResponse(BaseModel):
    """Response model for export auth endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int


class ListAuthApiAuth(BaseModel):
    """Auth type for list endpoint with computed permissions."""

    auth_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    item_count: int | None = None
    department_ids: list[str] | None = None
    is_inactive: bool | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None


class ListAuthApiResponse(BaseModel):
    """Response model for list auth endpoint with computed permissions."""

    actor_name: str | None = None
    auths: list[ListAuthApiAuth] | None = None
    department_filter: ListFilterSection | None = None
    total_count: int | None = None
